import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SessionDetailClient } from './SessionDetailClient'

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const today = new Date().toISOString().split('T')[0]

  // Session avec formation et formateur
  const { data: sessionData } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(intitule, reference, duree_heures, categorie, modalite, is_poei), formateur:formateurs(id, prenom, nom, email, telephone, user_id, tarif_journalier), client:client_id(id, raison_sociale, nom_commercial, sigle, email, opco_id, financeur_type, franchise:franchise_id(nom))')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!sessionData) redirect('/dashboard/sessions')

  // POEI : formation éligible OU projet POEI rattaché à la session
  const { data: poeiLink } = await supabase
    .from('poei')
    .select('id')
    .eq('session_id', params.id)
    .eq('organization_id', session.organization.id)
    .limit(1)
    .maybeSingle()
  const isPoei = !!((sessionData as any).formation?.is_poei) || !!poeiLink

  // Inscriptions avec apprenants
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('id, status, date_inscription, apprenant:apprenants(id, civilite, prenom, nom, sexe, email, entreprise, telephone, whatsapp, whatsapp_opt_in, date_naissance, lieu_naissance, numero_securite_sociale, adresse, code_postal, ville, type_contrat, poste, client_id, situation_handicap, type_handicap, besoins_adaptation, notes)')
    .eq('session_id', params.id)
    .not('status', 'in', '("annule","abandonne")')
    .order('date_inscription', { ascending: true })

  // Génération des feuilles d'émargement (jours ouvrés, idempotente).
  // Même helper que le portail formateur : une seule règle, un seul endroit.
  const allInscriptions = inscriptions || []
  if (allInscriptions.length > 0) {
    const { ensureEmargements } = await import('@/lib/emargements')
    await ensureEmargements(supabase, params.id, session.organization.id)
  }

  // Lectures indépendantes (toutes filtrées par session_id, après la génération des émargements)
  const formateurId = (sessionData.formateur as any)?.id
  const [
    { data: emargements },
    { data: pointages },
    { data: rapportRes },
    { data: evaluations },
    { data: qcmSessions },
    { data: qcmReponses },
    { data: qcmBank },
    { data: conventions },
    { data: evaluationsAppr },
  ] = await Promise.all([
    // Récupérer les émargements (y compris ceux qu'on vient de créer)
    supabase
      .from('emargements')
      .select('id, apprenant_id, date, creneau, est_present, signature_data, signed_at')
      .eq('session_id', params.id)
      .order('date', { ascending: true }),
    // Pointages du formateur
    supabase
      .from('pointages_formateur')
      .select('id, date, heure_arrivee, heure_depart, photo_arrivee_url, photo_depart_url')
      .eq('session_id', params.id)
      .order('date', { ascending: true }),
    // Rapport de session
    formateurId
      ? supabase
          .from('rapports_session')
          .select('id, status, submitted_at')
          .eq('session_id', params.id)
          .eq('formateur_id', formateurId)
          .single()
      : Promise.resolve({ data: null }),
    // Évaluations de satisfaction (apprenants)
    supabase
      .from('evaluations_satisfaction')
      .select('id, type, note_globale, completee_at, apprenant_id')
      .eq('session_id', params.id),
    // QCM rattachés à la session (questionnaires)
    supabase
      .from('qcm_sessions')
      .select('id, qcm_id, date_ouverture, envoye_at, qcm:qcm(id, titre, type, score_min_reussite)')
      .eq('session_id', params.id)
      .order('date_ouverture', { ascending: false }),
    // Réponses des apprenants (qui a répondu + score). Le nombre de lignes de
    // détail dit si le stagiaire a répondu question par question ou si seul le
    // résultat a été reporté depuis le questionnaire papier du formateur : sans
    // détail, il n'y a rien à ouvrir.
    supabase
      .from('qcm_reponses')
      .select('id, qcm_id, apprenant_id, score, is_reussi, is_complete, completed_at, date_realisation, detail:qcm_reponses_detail(count)')
      .eq('session_id', params.id),
    // Banque de QCM de l'organisation (pour rattacher) — formation_id pour
    // repérer le QCM propre à la formation de la session
    supabase
      .from('qcm')
      .select('id, titre, type, status, formation_id')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    // Conventions liées à la session
    supabase
      .from('conventions')
      .select('id, numero, type, status, montant_ttc, sent_at, signature_token, signature_client_date, signature_client_nom, signature_of_date, participants_snapshot, client_id')
      .eq('session_id', params.id)
      .order('created_at', { ascending: false }),
    // Évaluations (notes) des apprenants pour cette session
    supabase
      .from('evaluations_apprenant')
      .select('id, apprenant_id, intitule, note, note_max, appreciation, evaluateur, validated, date_evaluation')
      .eq('session_id', params.id),
  ])

  // Listes de référence pour le formulaire « Modifier la session »
  const [{ data: formationsRef }, { data: formateursRef }, { data: clientsRef }, { data: apprenantsRef }, { data: sessionFormations }] = await Promise.all([
    supabase.from('formations').select('id, intitule, reference, modalite, duree_heures, duree_jours')
      .eq('organization_id', session.organization.id).eq('is_active', true).order('intitule'),
    supabase.from('formateurs').select('id, prenom, nom, tarif_journalier')
      .eq('organization_id', session.organization.id).eq('is_active', true).order('nom'),
    supabase.from('clients').select('id, raison_sociale, nom_commercial, sigle, siret, adresse, code_postal, ville')
      .eq('organization_id', session.organization.id).eq('type', 'entreprise').order('raison_sociale'),
    supabase.from('apprenants').select('id, prenom, nom, email, client_id')
      .eq('organization_id', session.organization.id).order('nom').range(0, 9999),
    supabase.from('session_formations').select('formation_id, ordre').eq('session_id', params.id).order('ordre'),
  ])

  // Contrat de prestation formateur lié à la session (état + signature)
  const { data: contratFormateur } = await supabase
    .from('contrats_formateur')
    .select('id, numero, status, montant_ht, sent_at, signature_token, signature_formateur_date, signature_formateur_nom')
    .eq('session_id', params.id)
    // Un contrat annulé (changement de formateur) n'est plus le contrat en vigueur
    .neq('status', 'annule')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const rapport = rapportRes

  // Retours client (appels post-formation) — appréciations d'entreprise
  // rattachées à la session. Résilient avant migration 134.
  let retoursClient: any[] = []
  try {
    const { data, error } = await supabase.from('appreciations_parties_prenantes')
      .select('id, note_globale, commentaire, repondant_nom, repondant_fonction, created_at')
      .eq('session_id', params.id).eq('type', 'entreprise')
      .order('created_at', { ascending: false })
    if (!error) retoursClient = data || []
  } catch { retoursClient = [] }

  // Socle qualité : état RÉEL des 4 jalons, calculé sur les questionnaires
  // rattachés et les réponses effectivement complétées.
  const { SOCLE, estFormationHygiene } = await import('@/lib/dpo')
  const typeParJalon: Record<string, string[]> = {
    positionnement: ['positionnement'],
    evaluation_acquis: ['sortie'],
    satisfaction_chaud: ['satisfaction_chaud'],
    satisfaction_froid: ['satisfaction_froid'],
  }
  const socleEtat = SOCLE.map((j) => {
    const types = typeParJalon[j.cle] || []
    const qs = (qcmSessions || []).filter((q: any) => types.includes(q.qcm?.type))
    if (qs.length === 0) return { cle: j.cle, fait: false, detail: 'Aucun questionnaire rattaché à la session' }
    const ids = qs.map((q: any) => q.qcm_id)
    const repondu = (qcmReponses || []).filter((r: any) => ids.includes(r.qcm_id) && r.is_complete).length
    const attendus = (inscriptions || []).length
    return {
      cle: j.cle,
      fait: repondu > 0,
      detail: repondu > 0
        ? `${repondu} réponse${repondu > 1 ? 's' : ''} complétée${repondu > 1 ? 's' : ''}${attendus ? ` sur ${attendus} inscrit${attendus > 1 ? 's' : ''}` : ''}`
        : 'Questionnaire rattaché mais aucune réponse complétée',
    }
  })
  const estHygiene = estFormationHygiene((sessionData as any).formation?.intitule || (sessionData as any).intitule)

  // Déroulé opérationnel : validations des 7 étapes (migration 119)
  const derouleRes = await supabase
    .from('session_deroule_etapes')
    .select('etape_cle, statut, commentaire, validated_at')
    .eq('session_id', params.id)
  const derouleValidations = (derouleRes.data as any[]) || []
  const derouleTableManquante = !!derouleRes.error

  // Recueil du besoin (ind. 4) — modèles par thème + recueil de la session.
  // Résilient : les tables n'existent qu'après la migration 105.
  let recueilTemplates: any[] = []
  let recueil: any = null
  {
    const tpls = await supabase.from('recueil_besoin_templates').select('id, theme, nom, questions').eq('organization_id', session.organization.id).eq('is_active', true)
    if (!tpls.error) recueilTemplates = tpls.data || []
    const rec = await supabase.from('recueils_besoin').select('template_id, theme, reponses, statut, date_recueil').eq('session_id', params.id).eq('organization_id', session.organization.id).maybeSingle()
    if (!rec.error) recueil = rec.data || null
  }

  // Nombre d'évaluations des acquis réelles (Dendreo) pour cette session — résilient.
  let nbEvalAcquis = 0
  {
    const r = await supabase.from('evaluations_acquis').select('*', { count: 'exact', head: true }).eq('session_id', params.id).eq('organization_id', session.organization.id)
    if (!r.error) nbEvalAcquis = r.count || 0
  }

  // Contenu pédagogique : supports téléversés + état du positionnement des inscrits
  const { getAllSessionSupports, getPositionnementEtat } = await import('@/lib/session-contenu')
  const inscritsRefs = allInscriptions
    .map((i: any) => i.apprenant)
    .filter(Boolean)
    .map((a: any) => ({ id: a.id, prenom: a.prenom, nom: a.nom }))
  const [supports, positionnement] = await Promise.all([
    getAllSessionSupports(supabase, params.id),
    getPositionnementEtat(supabase, params.id, inscritsRefs),
  ])

  // Contacts du client + historique des emails de la session (par destinataire)
  const { data: clientContacts } = sessionData.client_id
    ? await supabase.from('contacts')
        .select('id, prenom, nom, poste, email, telephone, mobile, est_signataire, est_principal')
        .eq('client_id', sessionData.client_id)
    : { data: [] as any[] }
  const peopleEmails = Array.from(new Set([
    ...(inscriptions || []).map((i: any) => i.apprenant?.email),
    (sessionData.formateur as any)?.email,
    ...((clientContacts || []) as any[]).map((c: any) => c.email),
  ].filter(Boolean)))
  let emailLogs: any[] = []
  if (peopleEmails.length > 0) {
    const { data } = await supabase.from('email_logs')
      .select('id, to_email, to_name, subject, status, sent_at, created_at, opened_at')
      .eq('organization_id', session.organization.id)
      .in('to_email', peopleEmails)
      .order('created_at', { ascending: false })
      .limit(150)
    emailLogs = data || []
  }

  // Historique des envois des documents contractuels. Il se cherche par pièce
  // (entity_id), pas par destinataire : un formateur qui intervient sur vingt
  // sessions recevrait sinon, sur chacune, les contrats des dix-neuf autres.
  const docEntityIds = [
    params.id,
    ...(conventions || []).map((c: any) => c.id),
    ...(contratFormateur ? [(contratFormateur as any).id] : []),
  ].filter(Boolean)
  const { data: docEmailLogs } = await supabase.from('email_logs')
    .select('id, to_email, to_name, subject, status, sent_at, opened_at, created_at, entity_type, entity_id')
    .eq('organization_id', session.organization.id)
    .in('entity_type', ['convention', 'contrat_formateur'])
    .in('entity_id', docEntityIds)
    .order('created_at', { ascending: false })
    .limit(60)

  // ── Facturation OPCO ────────────────────────────────────────────────────
  // La facture d'une session se retrouve par son session_id ; l'accord de
  // prise en charge est le justificatif du financement, déposé au dossier.
  const [{ data: opcos }, { data: factureSession }, { data: accordPec }] = await Promise.all([
    supabase.from('opco').select('id, code, nom').eq('is_active', true).order('nom'),
    supabase.from('factures')
      .select('id, numero, status, montant_ttc, financeur_type')
      .eq('organization_id', session.organization.id)
      .eq('session_id', params.id)
      // Tous financeurs : la facture AGEFICE ou directe doit apparaître
      // dans Documents comme la facture OPCO.
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('documents')
      .select('id, file_name, date_piece, created_at')
      .eq('organization_id', session.organization.id)
      .eq('session_id', params.id)
      .eq('type', 'accord_prise_en_charge')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Est-ce que le user est le formateur de cette session ?
  const isFormateur = session.user.role === 'formateur' && (sessionData.formateur as any)?.user_id === session.user.id

  // Pièces du dossier : produites par le CRM, ou justifiées par un document
  // déposé (migration 124).
  const piecesRes = await supabase
    .from('documents')
    .select('id, type, origine, date_piece, file_name, created_at')
    .eq('session_id', params.id)
  const piecesTableManquante = !!piecesRes.error
  const docsParType = new Map<string, any>()
  for (const d of (piecesRes.data as any[]) || []) if (!docsParType.has(d.type)) docsParType.set(d.type, d)

  const { PIECES: PIECES_DOSSIER } = await import('@/lib/pieces-session')
  const aRepondu = (types: string[]) =>
    (qcmReponses || []).some((r: any) => r.is_complete &&
      (qcmSessions || []).some((q: any) => q.qcm_id === r.qcm_id && types.includes(q.qcm?.type)))

  const natif: Record<string, boolean> = {
    recueil: !!recueil,
    convention: (conventions || []).some((c: any) => c.signature_client_date),
    contrat: !!contratFormateur,
    positionnement: aRepondu(['positionnement']),
    // Une présence relevée sur la feuille papier vaut émargement : le CRM en
    // édite la feuille attestée, et l'original du formateur reste au dossier.
    emargement: (emargements || []).some((e: any) => e.signature_data || e.est_present),
    acquis: aRepondu(['sortie']) || nbEvalAcquis > 0,
    satisfaction: aRepondu(['satisfaction_chaud', 'satisfaction_froid']),
  }

  const etatsPieces = PIECES_DOSSIER.map((p) => {
    const doc = docsParType.get(p.typeDocument)
    if (natif[p.cle]) return { cle: p.cle, presente: true, source: 'crm', documentId: doc?.id || null, fichier: doc?.file_name || null, dateDepot: doc?.date_piece || null }
    if (doc) return { cle: p.cle, presente: true, source: doc.origine || 'mail', documentId: doc.id, fichier: doc.file_name, dateDepot: doc.date_piece || doc.created_at }
    return { cle: p.cle, presente: false, source: null, documentId: null, fichier: null, dateDepot: null }
  })


  // Fiches clients des apprenants inscrits (contractualisation inter par partie)
  const idsClientsApprenants = [...new Set((allInscriptions as any[]).map((i: any) => i.apprenant?.client_id).filter(Boolean))]
  const { data: clientsApprenants } = idsClientsApprenants.length
    ? await supabase.from('clients').select('id, type, raison_sociale, nom_commercial').in('id', idsClientsApprenants)
    : { data: [] as any[] }

  // Dossiers AGEFICE liés à la session : UN PAR DIRIGEANT (une session peut
  // porter plusieurs dossiers quand des dirigeants se forment ensemble)
  let dossiersAgefice: any[] = []
  try {
    const { data: dAg } = await supabase.from('dossiers_agefice')
      .select('*, client:client_id(raison_sociale, nom_commercial), apprenant:apprenant_id(prenom, nom), formation:formation_id(intitule)')
      .eq('session_id', sessionData.id).order('created_at')
    dossiersAgefice = dAg || []
  } catch { /* table absente avant migration 143 */ }

  return (
    <div className="animate-fade-in">
      <SessionDetailClient
        session={sessionData as any}
        inscriptions={(inscriptions || []) as any[]}
        emargements={(emargements || []) as any[]}
        pointages={(pointages || []) as any[]}
        rapport={rapport as any}
        retoursClient={retoursClient as any[]}
        evaluations={(evaluations || []) as any[]}
        qcmSessions={(qcmSessions || []) as any[]}
        qcmReponses={(qcmReponses || []) as any[]}
        qcmBank={(qcmBank || []) as any[]}
        conventions={(conventions || []) as any[]}
        contratFormateur={contratFormateur as any}
        formationsRef={(formationsRef || []) as any[]}
        formateursRef={(formateursRef || []) as any[]}
        clientsRef={(clientsRef || []) as any[]}
        clientContacts={(clientContacts || []) as any[]}
        emailLogs={emailLogs as any[]}
        docEmailLogs={(docEmailLogs || []) as any[]}
        opcos={(opcos || []) as any[]}
        factureOpco={factureSession as any}
        accordPec={accordPec as any}
        apprenantsRef={(apprenantsRef || []) as any[]}
        sessionFormationIds={((sessionFormations || []) as any[]).map((r) => r.formation_id)}
        evaluationsAppr={(evaluationsAppr || []) as any[]}
        supports={supports as any[]}
        positionnement={positionnement as any[]}
        isFormateur={isFormateur}
        dossiersAgefice={dossiersAgefice}
        clientsApprenants={(clientsApprenants || []) as any[]}
        userRole={session.user.role}
        isPoei={isPoei}
        recueilTemplates={recueilTemplates as any[]}
        recueil={recueil as any}
        formationIntitule={(sessionData as any).formation?.intitule || ''}
        nbEvalAcquis={nbEvalAcquis}
        derouleValidations={derouleValidations}
        derouleTableManquante={derouleTableManquante}
        socleEtat={socleEtat}
        etatsPieces={etatsPieces}
        piecesTableManquante={piecesTableManquante}
        estHygiene={estHygiene}
      />
    </div>
  )
}
