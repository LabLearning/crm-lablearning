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
    .select('*, formation:formation_id(intitule, reference, duree_heures, categorie, modalite, is_poei), formateur:formateurs(id, prenom, nom, email, telephone, user_id, tarif_journalier), client:client_id(id, raison_sociale, email)')
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
    .select('id, status, date_inscription, apprenant:apprenants(id, prenom, nom, email, entreprise, telephone)')
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
    // QCM sessions (passages des apprenants)
    supabase
      .from('qcm_sessions')
      .select('id, status, score, completed_at, apprenant_id, qcm:qcm(titre)')
      .eq('session_id', params.id),
    // Conventions liées à la session
    supabase
      .from('conventions')
      .select('id, numero, type, status, montant_ttc, sent_at, signature_token, signature_client_date, signature_client_nom, signature_of_date')
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
    supabase.from('clients').select('id, raison_sociale, siret, adresse, code_postal, ville')
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

  // Est-ce que le user est le formateur de cette session ?
  const isFormateur = session.user.role === 'formateur' && (sessionData.formateur as any)?.user_id === session.user.id

  return (
    <div className="animate-fade-in">
      <SessionDetailClient
        session={sessionData as any}
        inscriptions={(inscriptions || []) as any[]}
        emargements={(emargements || []) as any[]}
        pointages={(pointages || []) as any[]}
        rapport={rapport as any}
        evaluations={(evaluations || []) as any[]}
        qcmSessions={(qcmSessions || []) as any[]}
        conventions={(conventions || []) as any[]}
        contratFormateur={contratFormateur as any}
        formationsRef={(formationsRef || []) as any[]}
        formateursRef={(formateursRef || []) as any[]}
        clientsRef={(clientsRef || []) as any[]}
        apprenantsRef={(apprenantsRef || []) as any[]}
        sessionFormationIds={((sessionFormations || []) as any[]).map((r) => r.formation_id)}
        evaluationsAppr={(evaluationsAppr || []) as any[]}
        supports={supports as any[]}
        positionnement={positionnement as any[]}
        isFormateur={isFormateur}
        userRole={session.user.role}
        isPoei={isPoei}
      />
    </div>
  )
}
