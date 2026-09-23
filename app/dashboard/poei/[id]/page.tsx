import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, GraduationCap, Calendar, CheckSquare, FileText } from '@/components/ui/icons'
import { Badge, BackLink } from '@/components/ui'
import { POEI_STATUS_LABELS, POEI_STATUS_COLORS } from '@/lib/types/poei'
import { formatDate, companyLabel } from '@/lib/utils'
import { PoeiEditor } from './PoeiEditor'
import { PoeiCandidats } from './PoeiCandidats'
import { PoeiPositionnement, type PositionnementCandidat } from './PoeiPositionnement'
import { PoeiFacturation } from './PoeiFacturation'
import { PoeiEvaluations } from './PoeiEvaluations'
import { PoeiEmailHistory } from './PoeiEmailHistory'
import { PoeiInterventions } from './PoeiInterventions'
import { PoeiShell } from './PoeiShell'
import { PoeiPilotage } from './PoeiPilotage'
import { PoeiDocuments } from './PoeiDocuments'
import { PoeiMandat } from './PoeiMandat'
import { PoeiMails } from './PoeiMails'
import { PoeiIncidents } from '@/components/poei/PoeiIncidents'
import { PoeiPlanning } from './PoeiPlanning'
import { PoeiEmargement, type LigneEmargementCandidat, type SessionEmargement } from './PoeiEmargement'
import type { CandidatMail } from './PoeiMails'
import type { CandidatDoc } from './PoeiDocuments'
import type { LigneCandidat, Etat } from './PoeiPilotage'
import type { Poei, PoeiCandidat } from '@/lib/types/poei'

export const dynamic = 'force-dynamic'

export default async function PoeiDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select(`*, client:clients(raison_sociale, nom_commercial, sigle), formation:formations(intitule), session:sessions(id, reference, date_debut, date_fin, status)`)
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!poei) redirect('/dashboard/poei')
  const p = poei as Poei

  // Formation « terminée » = statut POEI terminé, session terminée, ou date de fin
  // passée (le statut de session peut être en retard).
  const _sess = (p as any).session
  const formationTerminee = p.statut === 'terminee'
    || _sess?.status === 'terminee'
    || (!!_sess?.date_fin && new Date(_sess.date_fin) < new Date())

  const [{ data: candidatsRaw }, { data: clients }, { data: formations }, { data: apprenants }, { data: emailLogs }] = await Promise.all([
    supabase
      .from('poei_candidats')
      .select('*, apprenant:apprenants(id, nom, prenom, email, telephone, date_naissance)')
      .eq('poei_id', params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('clients').select('id, raison_sociale, nom_commercial, sigle').eq('organization_id', session.organization.id).order('raison_sociale'),
    supabase
      .from('formations').select('id, intitule').eq('organization_id', session.organization.id).eq('is_active', true).order('intitule'),
    // Apprenants de l'établissement du projet (client), pas tout le monde.
    // Repli sur toute l'org si le projet n'a pas encore de client lié.
    (p.client_id
      ? supabase.from('apprenants').select('id, nom, prenom, email').eq('organization_id', session.organization.id).eq('client_id', p.client_id).order('nom')
      : supabase.from('apprenants').select('id, nom, prenom, email').eq('organization_id', session.organization.id).order('nom').limit(1000)),
    // Tous les emails envoyés pour ce projet (historique + statut attestations)
    supabase
      .from('email_logs')
      .select('id, to_email, to_name, subject, template, status, error, sent_at, created_at')
      .eq('organization_id', session.organization.id)
      .eq('entity_type', 'poei')
      .eq('entity_id', params.id)
      .order('created_at', { ascending: false }),
  ])
  const candidats = (candidatsRaw || []) as PoeiCandidat[]

  // Statut déduit des faits (candidats, dépôt/accord FT, dates de session) et
  // ce qui empêche le dossier d'avancer.
  const { statutAttenduPoei } = await import('@/lib/poei-statut')
  const faits = {
    statut: (poei as any).statut,
    nb_candidats: candidats.length,
    date_depot_ft: (poei as any).date_depot_ft,
    date_accord_ft: (poei as any).date_accord_ft,
    session_date_debut: (poei as any).session?.date_debut,
    session_date_fin: (poei as any).session?.date_fin,
    date_debut: (poei as any).date_debut,
    date_fin: (poei as any).date_fin,
  }
  const statutCalcule = statutAttenduPoei(faits)

  // Interventions formateurs (plusieurs formateurs possibles sur un POEI)
  const [{ data: interventions }, { data: formateursList }] = await Promise.all([
    supabase
      .from('poei_interventions')
      .select('*, formateur:formateurs(prenom, nom), contrat:contrats_formateur(id, numero, status, signature_formateur_date)')
      .eq('poei_id', params.id)
      .order('ordre', { ascending: true })
      .order('date_debut', { ascending: true }),
    supabase
      .from('formateurs')
      .select('id, prenom, nom, tarif_journalier, zone_intervention')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('nom'),
  ])

  // ── Émargement du parcours : la session chapeau et celles des interventions ──
  // La session d'une intervention porte le lien (sessions.poei_intervention_id),
  // l'intervention n'a pas de colonne session.
  const idsInterventions = ((interventions || []) as any[]).map((iv) => iv.id)
  const { data: sessionsInterv } = idsInterventions.length
    ? await supabase.from('sessions').select('id, poei_intervention_id').in('poei_intervention_id', idsInterventions)
    : { data: [] as any[] }
  const idsSessionsPoei = [
    (p as any).session?.id,
    ...((sessionsInterv || []) as any[]).map((x) => x.id),
  ].filter(Boolean) as string[]

  let sessionsEmargement: SessionEmargement[] = []
  let candidatsEmargement: LigneEmargementCandidat[] = []
  if (idsSessionsPoei.length) {
    const [{ data: sessionsPoei }, { data: feuilles }, { data: lignesEm }] = await Promise.all([
      supabase.from('sessions').select('id, reference, intitule, date_debut, date_fin, poei_intervention_id').in('id', idsSessionsPoei),
      supabase.from('emargement_feuilles').select('session_id, date, creneau, validated_at').in('session_id', idsSessionsPoei),
      supabase.from('emargements').select('apprenant_id, session_id, date, creneau, signature_data, motif_absence').in('session_id', idsSessionsPoei),
    ])
    const libelleParIntervention = new Map(((interventions || []) as any[]).map((iv) => [iv.id, iv.libelle]))
    const libelleIntervention = new Map(((sessionsInterv || []) as any[]).map((x) => [x.id, libelleParIntervention.get(x.poei_intervention_id) || null]))
    sessionsEmargement = ((sessionsPoei || []) as any[]).map((sp) => {
      const f = (feuilles || []).filter((x: any) => x.session_id === sp.id)
      const creneaux = new Set(((lignesEm || []) as any[]).filter((x: any) => x.session_id === sp.id).map((x: any) => `${x.date}|${x.creneau}`))
      return {
        id: sp.id, reference: sp.reference, intitule: sp.intitule, date_debut: sp.date_debut, date_fin: sp.date_fin,
        intervention: libelleIntervention.get(sp.id) || null,
        feuillesValidees: f.filter((x: any) => x.validated_at).length,
        feuillesTotal: creneaux.size,
      }
    }).sort((a, b) => String(a.date_debut).localeCompare(String(b.date_debut)))

    const { heuresCertificats } = await import('@/lib/certificat-heures')
    const heures = (p as any).session?.id
      ? await heuresCertificats(supabase, { sessionId: (p as any).session.id, organizationId: session.organization.id, dureeFormation: (p as any).formation?.duree_heures })
      : new Map()
    candidatsEmargement = candidats.map((c: any) => {
      const aid = c.apprenant?.id || c.apprenant_id || ''
      const siennes = ((lignesEm || []) as any[]).filter((x: any) => x.apprenant_id === aid)
      const absences = siennes.filter((x: any) => x.motif_absence)
        .map((x: any) => ({ date: x.date, creneau: x.creneau, motif: x.motif_absence }))
        .sort((x, y) => String(x.date).localeCompare(String(y.date)))
      return {
        apprenantId: aid,
        nom: `${c.apprenant?.prenom || c.prenom || ''} ${c.apprenant?.nom || c.nom || ''}`.trim() || 'Candidat',
        signees: siennes.filter((x: any) => x.signature_data).length,
        absences,
        aSigner: siennes.filter((x: any) => !x.signature_data && !x.motif_absence).length,
        heuresCertifiees: heures.get(String(aid))?.heures ?? Number(p.duree_heures || 0),
      }
    })
  }

  // Formateurs intervenus (uniques) et état des évaluations demandées au
  // référent pour chacun d'eux, résilient avant la migration 146.
  const formateursPoei = Array.from(
    new Map(((interventions || []) as any[])
      .filter((iv) => iv.formateur_id)
      .map((iv) => [String(iv.formateur_id), { id: String(iv.formateur_id), nom: `${iv.formateur?.prenom || ''} ${iv.formateur?.nom || ''}`.trim() || 'Formateur' }]))
      .values(),
  )
  const { data: evalsFormateurs } = await supabase
    .from('appreciations_parties_prenantes')
    .select('id, formateur_id, statut, sent_at, repondu_at, note_globale')
    .eq('poei_id', params.id).eq('type', 'evaluation_formateur')
  const etatEvaluations: Record<string, { id: string; statut: string; date: string | null; note: number | null }> = {}
  for (const e of (evalsFormateurs || []) as any[]) {
    if (!e.formateur_id) continue
    const prev = etatEvaluations[e.formateur_id]
    if (!prev || e.statut === 'repondu') etatEvaluations[e.formateur_id] = { id: e.id, statut: e.statut, date: e.repondu_at || e.sent_at || null, note: e.note_globale ?? null }
  }
  // Planning de travail des candidats (post-théorie) + période proposée par
  // défaut : du lendemain de la fin de POEI, sur 4 semaines.
  const { data: planningJours } = await supabase
    .from('poei_plannings')
    .select('id, candidat_id, date, repos, creneau1_debut, creneau1_fin, creneau2_debut, creneau2_fin, note')
    .eq('poei_id', params.id)
    .order('date')
  const baseDebut = p.date_fin ? new Date(new Date(p.date_fin + 'T12:00:00Z').getTime() + 24 * 3600 * 1000) : new Date()
  const planningDefaults = {
    dateDebut: baseDebut.toISOString().slice(0, 10),
    dateFin: new Date(baseDebut.getTime() + 27 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  }

  // Devis POEI existants → map candidat_id → devis (pour le bouton de téléchargement par personne)
  const { data: devisPoei } = await supabase
    .from('devis')
    .select('id, numero, notes_internes')
    .eq('organization_id', session.organization.id)
    .ilike('notes_internes', `%[POEI:${params.id}:%`)
  const devisByCandidat: Record<string, { id: string; numero: string | null }> = {}
  for (const d of devisPoei || []) {
    const m = (d.notes_internes || '').match(new RegExp(`\\[POEI:${params.id}:([^\\]]+)\\]`))
    if (m) devisByCandidat[m[1]] = { id: d.id, numero: d.numero }
  }

  // Factures POEI existantes → map candidat_id → facture (section Facturation)
  const { data: facturesPoei } = await supabase
    .from('factures')
    .select('id, numero, status, montant_ttc, montant_paye, notes_internes')
    .eq('organization_id', session.organization.id)
    .ilike('notes_internes', `%[POEI-FACT:${params.id}:%`)
  const facturesByCandidat: Record<string, { id: string; numero: string | null; status: string; montant_ttc: number | null }> = {}
  for (const f of facturesPoei || []) {
    const m = (f.notes_internes || '').match(new RegExp(`\\[POEI-FACT:${params.id}:([^\\]]+)\\]`))
    if (m) facturesByCandidat[m[1]] = { id: f.id, numero: f.numero, status: f.status, montant_ttc: f.montant_ttc }
  }

  // Agences France Travail (résilient : table absente avant migration 100)
  const { data: agencesFt } = await supabase
    .from('agences_france_travail')
    .select('id, nom, ville')
    .eq('organization_id', session.organization.id).eq('is_active', true).order('nom')

  // Signatures des certificats par les candidats (résilient : migration 109)
  const sigMap: Record<string, { signed_at: string | null; sent_at: string | null }> = {}
  {
    const r = await supabase.from('certificat_signatures')
      .select('apprenant_id, signed_at, sent_at')
      .eq('poei_id', params.id).eq('organization_id', session.organization.id)
    if (!r.error) for (const x of r.data || []) sigMap[String((x as any).apprenant_id)] = { signed_at: (x as any).signed_at, sent_at: (x as any).sent_at }
  }

  // Grilles d'évaluation des candidats (résilient : table absente avant migration 108)
  const { data: grilles } = await supabase
    .from('poei_grilles')
    .select('*')
    .eq('poei_id', params.id).eq('organization_id', session.organization.id)
    .order('semaine', { ascending: true, nullsFirst: false })

  // Le contact référent de l'entreprise : signataire de l'attestation,
  // destinataire du lien de signature. Une seule source, la fiche client.
  let referent: any = null
  if (p.client_id) {
    const { data: contactsClient } = await supabase
      .from('contacts').select('prenom, nom, email, telephone, est_signataire, est_principal')
      .eq('client_id', p.client_id)
    referent = (contactsClient || []).find((x: any) => x.est_signataire)
      || (contactsClient || []).find((x: any) => x.est_principal)
      || (contactsClient || [])[0] || null
  }
  // Destinataire affiché dans l'onglet Mails pour les évaluations formateur
  // (l'action d'envoi refait sa propre résolution, référent formation en tête).
  const referentMail = referent?.email ? { nom: `${referent.prenom || ''} ${referent.nom || ''}`.trim(), email: referent.email as string } : null

  // Signature de l'employeur sur l'attestation de développement de
  // compétences : demandée, signée, ou encore à envoyer. Résilient avant la
  // migration 131 (colonne role absente).
  let sigEmployeur: { sent_at?: string | null; signed_at?: string | null; signataire_nom?: string | null } | null = null
  try {
    const { data, error } = await supabase.from('certificat_signatures')
      .select('sent_at, signed_at, signataire_nom')
      .eq('poei_id', params.id).eq('role', 'employeur').maybeSingle()
    if (!error) sigEmployeur = data
  } catch { sigEmployeur = null }

  // Mandat POEI (délégation France Travail) : à faire signer, envoyé, ou
  // signé. Résilient avant la migration 135.
  let mandatPoei: { sent_at?: string | null; signed_at?: string | null; signataire_nom?: string | null; date_emission?: string | null } | null = null
  try {
    const { data, error } = await supabase.from('poei_mandats')
      .select('sent_at, signed_at, signataire_nom, date_emission')
      .eq('poei_id', params.id).eq('organization_id', session.organization.id).maybeSingle()
    if (!error) mandatPoei = data
  } catch { mandatPoei = null }

  // Dernier statut d'envoi d'attestation par adresse email (le plus récent gagne)
  const emailStatus: Record<string, { status: string; date: string | null }> = {}
  for (const log of (emailLogs || []).filter((l: any) => l.template === 'attestation_entree')) {
    const key = (log.to_email || '').toLowerCase()
    if (key && !emailStatus[key]) emailStatus[key] = { status: log.status, date: log.sent_at || log.created_at }
  }

  // ── Cockpit : une ligne par candidat, un jalon par colonne ──
  const grillesParApprenant: Record<string, any[]> = {}
  for (const g of (grilles || []) as any[]) {
    const k = String(g.apprenant_id)
    ;(grillesParApprenant[k] = grillesParApprenant[k] || []).push(g)
  }
  const FACT_LABEL: Record<string, string> = {
    brouillon: 'Brouillon', emise: 'Émise', envoyee: 'Envoyée',
    payee_partiellement: 'Payée en partie', payee: 'Payée', en_retard: 'En retard', annulee: 'Annulée',
  }

  const lignesPilotage: LigneCandidat[] = candidats.map((c: any) => {
    const apprenantId = c.apprenant?.id || c.apprenant_id || null
    const nom = `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat'

    const refs = [c.identifiant_ft, c.numero_convention, c.numero_engagement].filter(Boolean).length
    const references = refs === 3
      ? { etat: 'ok' as const, texte: 'Complètes' }
      : { etat: (refs === 0 ? 'manque' : 'partiel') as Etat, texte: `${refs}/3 renseignées` }

    const mail = emailStatus[(c.apprenant?.email || '').toLowerCase()]
    const attestation = mail
      ? { etat: (mail.status === 'sent' ? 'ok' : 'partiel') as Etat, texte: mail.status === 'sent' ? 'Envoyée' : mail.status }
      : { etat: 'manque' as const, texte: 'Non envoyée' }

    const devis = devisByCandidat[c.id]
    const planCharge = devis
      ? { etat: 'ok' as const, texte: devis.numero || 'Généré', href: `/api/pdf/pdc/${c.id}` }
      : { etat: 'manque' as const, texte: 'À générer' }

    const gs = grillesParApprenant[String(apprenantId)] || []
    const finale = gs.some((g) => g.semaine == null)
    const hebdo = gs.filter((g) => g.semaine != null).length
    const evaluations = finale
      ? { etat: 'ok' as const, texte: `Bilan final${hebdo ? ` + ${hebdo} sem.` : ''}` }
      : hebdo > 0
        ? { etat: 'partiel' as const, texte: `${hebdo} semaine${hebdo > 1 ? 's' : ''}, pas de bilan` }
        : { etat: 'manque' as const, texte: 'Aucune' }

    const sig = apprenantId ? sigMap[String(apprenantId)] : undefined
    const certificat = sig?.signed_at
      ? { etat: 'ok' as const, texte: 'Signé' }
      : sig?.sent_at
        ? { etat: 'partiel' as const, texte: 'Envoyé, non signé' }
        : { etat: 'manque' as const, texte: 'Non envoyé' }

    const fac = facturesByCandidat[c.id]
    const facture = fac
      ? {
          etat: (['payee', 'envoyee', 'emise'].includes(fac.status) ? 'ok' : 'partiel') as Etat,
          texte: `${fac.numero || ''} ${FACT_LABEL[fac.status] || fac.status}`.trim(),
          href: `/api/pdf/facture/${fac.id}`,
        }
      : { etat: (formationTerminee ? 'manque' : 'na') as Etat, texte: formationTerminee ? 'À générer' : 'En fin de formation' }

    return { id: c.id, nom, apprenantId, references, attestation, planCharge, evaluations, certificat, facture }
  })

  // Positionnements d'entrée. Table absente tant que la migration 152 n'est
  // pas appliquée : la section s'affiche vide plutôt que de casser la fiche.
  let positionnements: any[] = []
  {
    const { data } = await supabase
      .from('poei_positionnements')
      .select('candidat_id, token, statut, reponses, note, maitrise_globale, heures_preconisees, complete_le')
      .eq('poei_id', params.id).eq('organization_id', session.organization.id)
    positionnements = data || []
  }
  const baseLien = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const parCandidat = new Map(positionnements.map((x: any) => [x.candidat_id, x]))
  const candidatsPositionnement: PositionnementCandidat[] = candidats.map((c: any) => {
    const p2: any = parCandidat.get(c.id)
    return {
      candidatId: c.id,
      nom: `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat',
      email: c.apprenant?.email || null,
      statut: (p2?.statut === 'complete' ? 'complete' : p2 ? 'envoye' : 'absent') as 'absent' | 'envoye' | 'complete',
      lien: p2?.token ? `${baseLien}/positionnement/${p2.token}` : null,
      reponses: p2?.reponses || null,
      note: p2?.note != null ? Number(p2.note) : null,
      maitrise: p2?.maitrise_globale != null ? Number(p2.maitrise_globale) : null,
      heures: p2?.heures_preconisees != null ? Number(p2.heures_preconisees) : null,
      completeLe: p2?.complete_le || null,
    }
  })

  const candidatsDocs: CandidatDoc[] = candidats.map((c: any) => {
    const aid = c.apprenant?.id || c.apprenant_id || null
    return {
      id: c.id,
      nom: `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat',
      apprenantId: aid,
      devis: devisByCandidat[c.id] || null,
      facture: facturesByCandidat[c.id] || null,
      aGrille: (grillesParApprenant[String(aid)] || []).some((g: any) => g.semaine == null),
      certificatSigne: !!(aid && sigMap[String(aid)]?.signed_at),
    }
  })

  const candidatsMails: CandidatMail[] = candidats.map((c: any) => {
    const aid = c.apprenant?.id || c.apprenant_id || null
    const sig = aid ? sigMap[String(aid)] : undefined
    return {
      id: c.id,
      nom: `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat',
      email: c.apprenant?.email || null,
      apprenantId: aid,
      attestationEnvoyeeLe: emailStatus[(c.apprenant?.email || '').toLowerCase()]?.date || null,
      certificatEnvoyeLe: sig?.sent_at || null,
      certificatSigneLe: sig?.signed_at || null,
    }
  })

  // Incidents du dossier (résilient : table sans poei_id avant migration 123)
  let incidentsPoei: any[] = []
  {
    const r = await supabase.from('incidents')
      .select('id, date_incident, type, gravite, titre, description, mesures_prises, statut, apprenant_id, formateur_id, created_at')
      .eq('poei_id', params.id).eq('organization_id', session.organization.id)
      .order('date_incident', { ascending: false })
    if (!r.error) incidentsPoei = r.data || []
  }
  const candidatsIncident = candidats.map((c: any) => ({
    id: c.apprenant?.id || c.apprenant_id,
    nom: `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat',
  })).filter((c: any) => c.id)

  const montantTotal = (Number(p.duree_heures) || 0) * (Number(p.montant_horaire) || 0)
  // Vérité financière unique : les factures du dossier.
  const finances = {
    total: (facturesPoei || []).reduce((a: number, f: any) => a + Number(f.montant_ttc || 0), 0),
    encaisse: (facturesPoei || []).reduce((a: number, f: any) => a + Number(f.montant_paye || 0), 0),
    nbFactures: (facturesPoei || []).length,
  }
  const nbFactures = Object.keys(facturesByCandidat).length
  const nbSignes = Object.values(sigMap).filter((s) => s.signed_at).length

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div>
        <BackLink fallbackHref="/dashboard/poei" label="Retour aux POEI" className="inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-0 text-sm text-surface-500 hover:text-surface-800 mb-1 sm:mb-3" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-bold text-surface-900 inline-flex items-center gap-2">
              <Building2 className="h-5 w-5 text-sky-500" />
              {p.client_id ? (
                <Link href={`/dashboard/clients/${p.client_id}`} className="inline-flex items-center min-h-[40px] hover:text-brand-600 hover:underline transition-colors">
                  {companyLabel(p.client) || 'Projet POEI'}
                </Link>
              ) : (companyLabel(p.client) || 'Projet POEI')}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-surface-500">
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold">POEI</span>
              <span className="font-mono">{p.numero}</span>
              <Badge variant={POEI_STATUS_COLORS[statutCalcule]} dot>{POEI_STATUS_LABELS[statutCalcule]}</Badge>
              {p.formation?.intitule && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {p.formation.intitule}</span>}
              {p.date_debut && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(p.date_debut, { day: '2-digit', month: 'short' })}{p.date_fin ? ' → ' + formatDate(p.date_fin, { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Chiffres clés du dossier, visibles quel que soit l'onglet */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Candidats', valeur: candidats.length, alerte: candidats.length === 0 },
          { label: 'Durée', valeur: p.duree_heures ? `${p.duree_heures} h` : '—', alerte: !p.duree_heures },
          { label: 'Taux horaire', valeur: p.montant_horaire ? `${Number(p.montant_horaire).toLocaleString('fr-FR')} €` : '—', alerte: !p.montant_horaire },
          { label: 'Montant par candidat', valeur: montantTotal ? `${montantTotal.toLocaleString('fr-FR')} €` : '—' },
          { label: 'Factures', valeur: `${nbFactures}/${candidats.length}` },
          { label: 'Certificats signés', valeur: `${nbSignes}/${candidats.length}` },
        ].map((k) => (
          <div key={k.label} className="card p-3.5">
            <div className="text-[11px] text-surface-500">{k.label}</div>
            <div className={`text-lg font-heading font-bold ${k.alerte ? 'text-danger-600' : 'text-surface-900'}`}>{k.valeur}</div>
          </div>
        ))}
      </div>

      <PoeiShell
        pilotage={<PoeiPilotage lignes={lignesPilotage} />}
        incidents={
          <PoeiIncidents
            poeiId={p.id}
            incidents={incidentsPoei as any[]}
            candidats={candidatsIncident}
            peutTraiter
          />
        }
        documents={
          <>
            {/* Feuilles d'émargement de la session POEI : vierge à faire
                signer, et l'état signé tel que tenu dans le CRM. */}
            {(p as any).session?.id && (
              <div className="card p-4 flex items-center gap-3 flex-wrap">
                <CheckSquare className="h-4 w-4 text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-heading font-semibold text-surface-900">Feuilles d&apos;émargement</div>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Session {(p as any).session.reference || ''}, feuille à faire signer et feuille d&apos;état des présences.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <a href={`/api/pdf/emargement/${(p as any).session.id}`} target="_blank" rel="noopener noreferrer"
                    className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 flex-1 sm:flex-none">
                    <FileText className="h-3.5 w-3.5" /> Feuille vierge
                  </a>
                  <a href={`/api/pdf/emargement-signe/${(p as any).session.id}`} target="_blank" rel="noopener noreferrer"
                    className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 flex-1 sm:flex-none">
                    <CheckSquare className="h-3.5 w-3.5" /> Feuille des présences
                  </a>
                </div>
              </div>
            )}
            <PoeiMandat poeiId={p.id} mandat={mandatPoei} />
            <PoeiDocuments
              poeiId={p.id}
              candidats={candidatsDocs}
              devisPrevisionnel={devisByCandidat['previsionnel'] || null}
              formationTerminee={formationTerminee}
            />
          </>
        }
        nbCandidats={candidats.length}
        nbInterventions={(interventions || []).length}
        nbMails={(emailLogs || []).length}
        nbIncidents={incidentsPoei.length}
        alertes={{
          candidats: candidats.length === 0 ? 1 : 0,
          facturation: formationTerminee && nbFactures < candidats.length ? 1 : 0,
          incidents: incidentsPoei.filter((i: any) => ['ouvert', 'en_cours'].includes(i.statut)).length,
        }}
        dossier={<PoeiEditor poei={p} clients={clients || []} formations={formations || []} nbCandidats={candidats.length} finances={finances} agences={(agencesFt || []) as any[]} referent={referent} />}
        candidats={
          <PoeiCandidats
            poeiId={p.id}
            projet={{ date_debut: p.date_debut, date_fin: p.date_fin, duree_heures: p.duree_heures }}
            interventions={((interventions || []) as any[]).map((iv) => ({ date_debut: iv.date_debut, nb_heures: iv.nb_heures, libelle: iv.libelle }))}
            candidats={candidats} apprenants={apprenants || []} emailStatus={emailStatus}
            clientNom={companyLabel(p.client) || null} clientId={p.client_id}
            devisByCandidat={devisByCandidat} sessionTerminee={formationTerminee}
          />
        }
        positionnement={
          <PoeiPositionnement
            poeiId={p.id}
            dureeParcours={p.duree_heures ? Number(p.duree_heures) : null}
            candidats={candidatsPositionnement}
          />
        }
        interventions={
          <PoeiInterventions
            poeiId={p.id}
            interventions={((interventions || []) as any[]).map((iv) => ({
              ...iv,
              contrat: Array.isArray(iv.contrat) ? iv.contrat[0] || null : iv.contrat || null,
            }))}
            formateurs={(formateursList || []) as any[]}
            dureeTotale={p.duree_heures}
          />
        }
        planning={
          <PoeiPlanning
            poeiId={p.id}
            candidats={candidats.map((c: any) => ({ id: c.id, nom: `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat' }))}
            jours={(planningJours || []) as any[]}
            defaults={planningDefaults}
          />
        }
        emargement={
          <PoeiEmargement
            sessions={sessionsEmargement}
            candidats={candidatsEmargement}
            dureeParcours={Number(p.duree_heures) || null}
          />
        }
        evaluations={
          <PoeiEvaluations
            poeiId={p.id}
            candidats={candidats.map((c: any) => ({ id: c.id, apprenant_id: c.apprenant?.id || c.apprenant_id || null, nom: `${c.apprenant?.prenom || c.prenom || ''} ${c.apprenant?.nom || c.nom || ''}`.trim() || 'Candidat' }))}
            grilles={(grilles || []) as any[]}
            signatureEmployeur={sigEmployeur}
          />
        }
        facturation={
          <PoeiFacturation
            poeiId={p.id}
            sessionId={(p as any).session?.id || null}
            sessionTerminee={formationTerminee}
            candidats={candidats as any[]}
            facturesByCandidat={facturesByCandidat}
            agences={(agencesFt || []) as any[]}
            signatures={sigMap}
            currentAgenceId={(p as any).agence_ft_id || null}
          />
        }
        mails={
          <PoeiMails
            poeiId={p.id}
            candidats={candidatsMails}
            formateurs={formateursPoei}
            etatEvaluations={etatEvaluations}
            referent={referentMail}
            historique={<PoeiEmailHistory logs={(emailLogs || []) as any[]} />}
          />
        }
      />
    </div>
  )
}
