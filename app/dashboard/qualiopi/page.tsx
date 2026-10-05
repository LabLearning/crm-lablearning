import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { QualiopiDashboard } from './QualiopiDashboard'
import type { QualiopiIndicateur } from '@/lib/types/qualiopi'

export interface CrmEvidence { label: string; href: string; count: number; warn?: boolean }

export default async function QualiopiPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: indicateurs } = await supabase
    .from('qualiopi_indicateurs')
    .select('*, preuves:qualiopi_preuves(*)')
    .eq('organization_id', orgId)
    .order('critere', { ascending: true })
    .order('indicateur', { ascending: true })

  // Signer les preuves stockées (bucket privé) en un seul appel batch (createSignedUrls)
  const preuvesToSign: { p: any; path: string }[] = []
  for (const ind of indicateurs || []) {
    for (const p of (ind as any).preuves || []) {
      if (!p.document_url) continue
      if (/^https?:\/\//.test(p.document_url)) {
        p.signed_url = p.document_url
      } else {
        preuvesToSign.push({ p, path: p.document_url })
      }
    }
  }
  if (preuvesToSign.length > 0) {
    const { data: signedList } = await supabase.storage
      .from('dossiers')
      .createSignedUrls(preuvesToSign.map((x) => x.path), 3600)
    ;(signedList || []).forEach((signed, idx) => {
      preuvesToSign[idx].p.signed_url = signed?.error ? null : signed?.signedUrl || null
    })
  }

  // Preuves vivantes réelles produites par le CRM.
  // On distingue les VRAIS compteurs de preuve (émargements signés, QCM complétés,
  // conventions…) des volumes bruts trompeurs — un auditeur repère le gonflage.
  const cnt = async (table: string, apply?: (q: any) => any): Promise<number> => {
    try {
      let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
      if (apply) q = apply(q)
      const { count } = await q
      return count || 0
    } catch { return 0 }
  }
  const [
    nbSessionsTerm, nbEmargSignes, nbQcmComplets, nbConventions, nbContratsForm,
    nbFormateurs, nbFormations, nbDocs, nbRecla, nbActions, nbApprenants, orgRow,
  ] = await Promise.all([
    cnt('sessions', (q) => q.eq('status', 'terminee')),
    // Une présence constatée dans le CRM vaut émargement au même titre qu'une
    // signature électronique : c'est la trace de la présence qui est auditée.
    cnt('emargements', (q) => q.or('signed_at.not.is.null,est_present.eq.true')),
    cnt('qcm_reponses', (q) => q.eq('is_complete', true)),
    cnt('conventions'),
    cnt('contrats_formateur'),
    cnt('formateurs'),
    cnt('formations'),
    cnt('documents'),
    cnt('reclamations'),
    cnt('actions_amelioration'),
    cnt('apprenants'),
    supabase.from('organizations').select('referent_handicap_nom, numero_da, delai_acces').eq('id', orgId).single().then((r) => (r.data as any) || null),
  ])
  const hasReferentHandicap = !!(orgRow?.referent_handicap_nom)
  const hasNda = !!(orgRow?.numero_da)

  // Recompte les veilles VALIDÉES par type (résilient si la colonne statut n'existe
  // pas encore — migration 102 non appliquée → on compte toutes les entrées).
  const cntVeilleValid = async (type: string): Promise<number> => {
    try {
      const { count, error } = await supabase.from('veilles').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('type', type).eq('statut', 'validee')
      if (error) throw error
      return count || 0
    } catch {
      try {
        const { count } = await supabase.from('veilles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('type', type)
        return count || 0
      } catch { return 0 }
    }
  }
  const [nbVL, nbVM, nbVP, nbVH] = await Promise.all([
    cntVeilleValid('legale'), cntVeilleValid('metier'), cntVeilleValid('pedagogique'), cntVeilleValid('handicap'),
  ])

  // Vivier de formateurs de secours (plan de continuité) — résilient avant migration 103.
  let nbSecours = 0
  try {
    const { count, error } = await supabase.from('formateurs').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('formateur_secours', true)
    if (!error) nbSecours = count || 0
  } catch { nbSecours = 0 }

  // Évaluations des acquis réelles importées de Dendreo — résilient avant migration 104.
  let nbEvalAcquis = 0
  try {
    const { count, error } = await supabase.from('evaluations_acquis').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
    if (!error) nbEvalAcquis = count || 0
  } catch { nbEvalAcquis = 0 }

  // Recueils du besoin complétés (ind. 4) — résilient avant migration 105.
  let nbRecueils = 0
  try {
    const { count, error } = await supabase.from('recueils_besoin').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('statut', 'complete')
    if (!error) nbRecueils = count || 0
  } catch { nbRecueils = 0 }

  // Formations dont le besoin est validé (ind. 4) — résilient avant migration 107.
  let nbFormBesoin = 0
  try {
    const { count, error } = await supabase.from('formations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('besoin_valide', true)
    if (!error) nbFormBesoin = count || 0
  } catch { nbFormBesoin = 0 }

  // Relances à froid tracées dans l'historique des mails (ind. 30).
  let nbRelancesFroid = 0
  try {
    const { count } = await supabase.from('email_logs').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).ilike('subject', 'Rappel — Trois mois%')
    nbRelancesFroid = count || 0
  } catch { nbRelancesFroid = 0 }

  // Feuilles d'émargement papier numérisées et déposées au dossier (ind. 12).
  const nbFeuillesDeposees = await cnt('documents', (q) => q.eq('type', 'emargement_signe'))

  // Questionnaires complétés par nature (ind. 8, 11, 28, 30). Le type est porté
  // par le QCM, pas par la réponse : on passe par la jointure.
  const cntQcm = async (types: string[]): Promise<number> => {
    try {
      const { data } = await supabase.from('qcm').select('id').eq('organization_id', orgId).in('type', types)
      const ids = (data || []).map((q: any) => q.id)
      if (ids.length === 0) return 0
      const { count } = await supabase.from('qcm_reponses').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('is_complete', true).in('qcm_id', ids)
      return count || 0
    } catch { return 0 }
  }
  const [nbPositionnement, nbAcquisQcm, nbSatisChaud, nbSatisFroid] = await Promise.all([
    cntQcm(['positionnement']), cntQcm(['sortie']),
    cntQcm(['satisfaction_chaud']), cntQcm(['satisfaction_froid']),
  ])

  // Absences sans motif (ind. 12) — même règle que l'écran /dashboard/absences :
  // seules les sessions dont la présence est suivie dans le CRM portent de
  // vraies absences ; ailleurs, les lignes non pointées sont des présences
  // jamais numérisées, pas des absents.
  let nbAbsencesSansMotif = 0
  try {
    const lignes: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from('emargements')
        .select('session_id, est_present, motif_absence, signature_data')
        .eq('organization_id', orgId).range(f, f + 999)
      if (error) throw error
      lignes.push(...(data || []))
      if ((data || []).length < 1000) break
    }
    const parSession = new Map<string, any[]>()
    for (const e of lignes) {
      if (!parSession.has(e.session_id)) parSession.set(e.session_id, [])
      parSession.get(e.session_id)!.push(e)
    }
    for (const rows of parSession.values()) {
      if (!rows.some((r) => r.est_present || r.signature_data)) continue
      // est_present=false uniquement : null = créneau pas encore passé
      // (session en cours), ce n'est pas une absence.
      nbAbsencesSansMotif += rows.filter((r) => r.est_present === false && !r.signature_data && !r.motif_absence).length
    }
  } catch { nbAbsencesSansMotif = 0 }

  // Réseau handicap (ind. 26) — résilient avant migration 136.
  let nbReseauHandicap = 0
  try {
    const { count: cRh, error: eRh } = await supabase.from('reseau_handicap')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
    if (!eRh) nbReseauHandicap = cRh || 0
  } catch { /* table absente */ }

  // Appréciations des parties prenantes (ind. 30) — résilient avant migration 134.
  let nbAppreciationsEntreprise = 0
  let nbAppreciationsFinanceur = 0
  let nbAppreciationsFormateur = 0
  try {
    const { count: c1, error: e1 } = await supabase.from('appreciations_parties_prenantes')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('type', 'entreprise')
    if (!e1) nbAppreciationsEntreprise = c1 || 0
    const { count: c2, error: e2 } = await supabase.from('appreciations_parties_prenantes')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('type', 'financeur')
    if (!e2) nbAppreciationsFinanceur = c2 || 0
    const { count: c3, error: e3 } = await supabase.from('appreciations_parties_prenantes')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('type', 'formateur')
    if (!e3) nbAppreciationsFormateur = c3 || 0
  } catch { /* table absente avant migration 134 */ }

  // Dysfonctionnements constatés et traités (ind. 30, 31, 32).
  const [nbIncidents, nbIncidentsResolus, nbHabilitations, nbFormateursCv] = await Promise.all([
    cnt('incidents'),
    cnt('incidents', (q) => q.eq('statut', 'resolu')),
    cnt('formateurs', (q) => q.not('date_derniere_habilitation', 'is', null)),
    cnt('formateurs', (q) => q.not('cv_url', 'is', null)),
  ])

  // Indicateurs de résultats publiés (ind. 2) — résilient avant migration 106.
  let resultatsPublies = false
  try {
    const { data, error } = await supabase.from('indicateurs_resultats').select('publie').eq('organization_id', orgId).eq('publie', true).maybeSingle()
    if (!error) resultatsPublies = !!data
  } catch { resultatsPublies = false }

  // Mapping indicateur → preuves réelles du CRM (compteurs honnêtes).
  // warn:true = trou à combler avant l'audit.
  const crmEvidence: Record<number, CrmEvidence[]> = {
    1: [{ label: 'Site & catalogue publics', href: 'https://www.lab-learning.fr/formations', count: nbFormations }],
    2: [{ label: resultatsPublies ? 'Indicateurs de résultats publiés' : 'Indicateurs de résultats — à publier', href: '/dashboard/indicateurs-resultats', count: resultatsPublies ? 1 : 0, warn: !resultatsPublies }],
    4: [
      { label: 'Formations avec besoin validé', href: '/dashboard/formations', count: nbFormBesoin, warn: nbFormBesoin === 0 },
      { label: 'Recueils du besoin complétés (par session)', href: '/dashboard/sessions', count: nbRecueils, warn: nbRecueils === 0 },
      { label: 'Conventions / devis', href: '/dashboard/conventions', count: nbConventions },
    ],
    5: [{ label: 'Programmes avec objectifs', href: '/dashboard/formations', count: nbFormations }],
    6: [{ label: 'Programmes détaillés', href: '/dashboard/formations', count: nbFormations }],
    7: [{ label: 'Devis et conventions par financeur', href: '/dashboard/devis', count: nbConventions }],
    8: [{ label: 'Questionnaires de positionnement complétés', href: '/dashboard/qcm', count: nbPositionnement, warn: nbPositionnement < nbSessionsTerm / 2 }],
    9: [{ label: 'Sessions réalisées (convocations, déroulé)', href: '/dashboard/sessions', count: nbSessionsTerm }],
    10: [
      { label: "Processus d'adaptation des prestations (PDF)", href: '/api/pdf/processus/adaptation', count: 1 },
      { label: 'Recueils du besoin (contexte, adaptations, handicap)', href: '/dashboard/sessions', count: nbRecueils },
      { label: 'Positionnements individuels à l’entrée', href: '/dashboard/qcm', count: nbPositionnement },
      { label: 'Procédure PSH dans le recueil (analyse des besoins)', href: '/dashboard/sessions', count: 1 },
      { label: 'Réseau handicap par région (contacts vérifiés)', href: '/dashboard/qualiopi/handicap', count: 1 },
      { label: 'Sessions avec déroulé pédagogique renseigné', href: '/dashboard/sessions', count: nbSessionsTerm },
    ],
    11: [
      { label: 'Évaluations des acquis (questionnaires)', href: '/dashboard/qcm', count: nbAcquisQcm, warn: nbAcquisQcm < nbSessionsTerm / 2 },
      { label: 'Évaluations des acquis reprises de Dendreo', href: '/dashboard/evaluations-acquis', count: nbEvalAcquis },
    ],
    12: [
      { label: 'Présences constatées (signature ou émargement CRM)', href: '/dashboard/emargement', count: nbEmargSignes, warn: nbEmargSignes < nbApprenants / 2 },
      { label: 'Feuilles papier numérisées et déposées', href: '/dashboard/emargement', count: nbFeuillesDeposees },
      { label: 'Absences à justifier', href: '/dashboard/absences', count: nbAbsencesSansMotif, warn: nbAbsencesSansMotif > 0 },
      { label: 'Processus de prévention des abandons (PDF)', href: '/api/pdf/processus/abandons', count: 1 },
    ],
    13: [{ label: 'Suivi des parcours POEI', href: '/dashboard/poei', count: nbSessionsTerm > 0 ? 1 : 0 }],
    15: [{ label: 'Parcours certifiants suivis', href: '/dashboard/sessions', count: nbSessionsTerm }],
    16: [{ label: hasReferentHandicap ? 'Référent handicap renseigné' : 'Référent handicap à renseigner', href: '/dashboard/settings', count: hasReferentHandicap ? 1 : 0, warn: !hasReferentHandicap }],
    17: [
      { label: 'Moyens humains et matériels (PDF)', href: '/api/pdf/processus/moyens', count: 1 },
      { label: 'Fiches formateurs (CV, diplômes, contrats)', href: '/dashboard/formateurs', count: nbFormateurs },
      { label: 'Contrats de prestation rattachés aux fiches', href: '/dashboard/formateurs', count: nbContratsForm },
    ],
    18: [
      { label: 'Organigramme fonctionnel (PDF, généré du CRM)', href: '/api/pdf/organigramme', count: 1 },
      { label: 'Contrats formateur', href: '/dashboard/formateurs', count: nbContratsForm },
      { label: 'Vivier de formateurs de secours (plan de continuité)', href: '/dashboard/formateurs/vivier', count: nbSecours, warn: nbSecours === 0 },
    ],
    19: [{ label: "Livret d'accueil et règlement intérieur transmis", href: '/dashboard/documents', count: nbDocs }],
    20: [{ label: 'Contrats de prestation formateur', href: '/dashboard/formateurs', count: nbContratsForm }],
    21: [
      { label: 'Processus recrutement & compétences formateurs (PDF)', href: '/api/pdf/processus/formateurs', count: 1 },
      { label: "Grille d'entretien de recrutement (PDF)", href: '/api/pdf/grille-entretien', count: 1 },
      { label: 'Formateurs dont le CV est au dossier', href: '/dashboard/formateurs', count: nbFormateursCv, warn: nbFormateursCv < nbFormateurs },
    ],
    22: [
      { label: 'Plan de développement des compétences (classeur)', href: 'https://drive.google.com/file/d/1HRbYTW_d8bO2kI_iTadKQakWVsQu8neO/view', count: 1 },
      { label: 'Formation interne « Prise en main du CRM »', href: '/dashboard/formations', count: 1 },
      { label: 'Formation du référent handicap (module JLO du 3/09)', href: '/dashboard/qualiopi/handicap', count: 1 },
      { label: 'Formateurs dont le maintien des compétences est daté', href: '/dashboard/formateurs', count: nbHabilitations, warn: nbHabilitations === 0 },
    ],
    23: [
      { label: 'Registre de veille — actions datées (PDF)', href: '/api/pdf/veille-registre', count: 1 },
      { label: 'Veille légale & réglementaire', href: '/dashboard/veille', count: nbVL, warn: nbVL === 0 },
    ],
    24: [
      { label: 'Registre de veille — actions datées (PDF)', href: '/api/pdf/veille-registre', count: 1 },
      { label: 'Veille métier & emploi', href: '/dashboard/veille', count: nbVM, warn: nbVM === 0 },
    ],
    25: [
      { label: 'Registre de veille — actions datées (PDF)', href: '/api/pdf/veille-registre', count: 1 },
      { label: 'Veille pédagogique & techno', href: '/dashboard/veille', count: nbVP, warn: nbVP === 0 },
    ],
    26: [
      { label: hasReferentHandicap ? 'Veille handicap' : 'Référent/veille handicap à constituer', href: '/dashboard/veille', count: nbVH + (hasReferentHandicap ? 1 : 0), warn: nbVH === 0 && !hasReferentHandicap },
      { label: 'Réseau handicap par région (contacts actualisés)', href: '/dashboard/qualiopi/handicap', count: nbReseauHandicap },
    ],
    27: [{ label: hasNda ? 'N° DA / Qualiopi / RGPD' : 'N° déclaration d\'activité à renseigner', href: '/dashboard/settings', count: hasNda ? 1 : 0, warn: !hasNda }],
    28: [{ label: 'Satisfaction à chaud recueillie', href: '/dashboard/evaluations', count: nbSatisChaud, warn: nbSatisChaud < nbSessionsTerm / 2 }],
    29: [{ label: 'Registre des réclamations', href: '/dashboard/reclamations', count: nbRecla, warn: nbRecla === 0 }],
    30: [
      { label: 'Satisfaction à froid (J+90) recueillie', href: '/dashboard/evaluations', count: nbSatisFroid },
      { label: 'Relances à froid mensuelles envoyées (tracées)', href: '/dashboard/evaluations', count: nbRelancesFroid },
      { label: 'Appréciations des entreprises clientes', href: '/dashboard/qualiopi/appreciations', count: nbAppreciationsEntreprise, warn: nbAppreciationsEntreprise === 0 },
      { label: 'Appréciations des financeurs (lien de sollicitation annuelle)', href: '/dashboard/qualiopi/appreciations', count: nbAppreciationsFinanceur },
      { label: 'Appréciations des formateurs (lien depuis leurs grilles)', href: '/dashboard/qualiopi/appreciations', count: nbAppreciationsFormateur },
      { label: 'Dysfonctionnements constatés', href: '/dashboard/incidents', count: nbIncidents, warn: nbIncidents === 0 },
    ],
    31: [
      { label: 'Constats traités et clôturés', href: '/dashboard/incidents', count: nbIncidentsResolus },
      { label: 'Analyse des causes / bilans', href: '/dashboard/reclamations', count: nbActions, warn: nbActions === 0 },
    ],
    32: [
      { label: "Plan d'amélioration continue — tableau de suivi (PDF)", href: '/api/pdf/plan-amelioration', count: 1 },
      { label: "Mesures d'amélioration suivies (réclamations, aléas, abandons, veille)", href: '/dashboard/reclamations', count: nbActions, warn: nbActions === 0 },
      { label: 'Réclamations traitées et datées', href: '/dashboard/reclamations', count: nbRecla },
      { label: "Questionnaire d'abandon J+1 (banque QCM)", href: '/dashboard/qcm', count: 1 },
    ],
  }

  // Fiches processus maison — visibles en tête de page, pas seulement dans le
  // détail des indicateurs : l'auditeur les demande en premier.
  const fichesProcessus = [
    { ref: 'PROC-06', titre: "Déroulé d'une formation en entreprise", href: '/api/pdf/processus/intra' },
    { ref: 'PROC-10', titre: 'Adaptation des prestations, accompagnement et suivi', href: '/api/pdf/processus/adaptation' },
    { ref: 'PROC-12', titre: 'Prévention et gestion des abandons', href: '/api/pdf/processus/abandons' },
    { ref: 'PROC-17', titre: 'Moyens humains, matériels et pédagogiques', href: '/api/pdf/processus/moyens' },
    { ref: 'PROC-21', titre: 'Recrutement et compétences des formateurs', href: '/api/pdf/processus/formateurs' },
    { ref: 'VEILLE', titre: 'Registre de veille (actions datées)', href: '/api/pdf/veille-registre' },
    { ref: 'PLAN', titre: "Plan d'amélioration continue", href: '/api/pdf/plan-amelioration' },
    { ref: 'ORG', titre: 'Organigramme fonctionnel', href: '/api/pdf/organigramme' },
  ]

  return (
    <div className="animate-fade-in space-y-5">
      <div className="card p-4">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Fiches processus & organigramme (PDF)</div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {fichesProcessus.map((f) => (
            <a key={f.ref} href={f.href} target="_blank" rel="noreferrer"
              className="flex items-start gap-2.5 rounded-xl border border-surface-200 px-3.5 py-3 hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
              <span className="text-[11px] font-bold text-brand-600 mt-0.5 shrink-0">{f.ref}</span>
              <span className="text-sm text-surface-700 leading-snug">{f.titre}</span>
            </a>
          ))}
        </div>
      </div>
      <QualiopiDashboard
        indicateurs={(indicateurs || []) as QualiopiIndicateur[]}
        initialized={(indicateurs || []).length > 0}
        crmEvidence={crmEvidence}
      />
    </div>
  )
}
