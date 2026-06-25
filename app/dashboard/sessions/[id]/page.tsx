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
    .select('*, formation:formation_id(intitule, reference, duree_heures, categorie, modalite), formateur:formateurs(id, prenom, nom, email, telephone, user_id)')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!sessionData) redirect('/dashboard/sessions')

  // Inscriptions avec apprenants
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('id, status, date_inscription, apprenant:apprenants(id, prenom, nom, email, entreprise, telephone)')
    .eq('session_id', params.id)
    .not('status', 'in', '("annule","abandonne")')
    .order('date_inscription', { ascending: true })

  // Auto-générer les émargements pour chaque jour × chaque apprenant
  const allInscriptions = inscriptions || []
  if (allInscriptions.length > 0 && sessionData.date_debut && sessionData.date_fin) {
    const days: string[] = []
    const d = new Date(sessionData.date_debut)
    const end = new Date(sessionData.date_fin)
    while (d <= end) {
      days.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }

    const creneaux = ['matin', 'apres_midi']
    for (const day of days) {
      const apprenantIds = allInscriptions.map((i: any) => (i.apprenant as any)?.id).filter(Boolean)
      if (apprenantIds.length === 0) continue

      for (const creneau of creneaux) {
        const { data: existing } = await supabase
          .from('emargements')
          .select('apprenant_id')
          .eq('session_id', params.id)
          .eq('date', day)
          .eq('creneau', creneau)

        const existingIds = new Set((existing || []).map((e: any) => e.apprenant_id))
        const toInsert = apprenantIds
          .filter((id: string) => !existingIds.has(id))
          .map((id: string) => ({
            organization_id: session.organization.id,
            session_id: params.id,
            apprenant_id: id,
            date: day,
            creneau,
            est_present: false,
          }))

        if (toInsert.length > 0) {
          await supabase.from('emargements').insert(toInsert)
        }
      }
    }
  }

  // Récupérer les émargements (y compris ceux qu'on vient de créer)
  const { data: emargements } = await supabase
    .from('emargements')
    .select('id, apprenant_id, date, creneau, est_present, signature_data, signed_at')
    .eq('session_id', params.id)
    .order('date', { ascending: true })

  // Pointages du formateur
  const { data: pointages } = await supabase
    .from('pointages_formateur')
    .select('id, date, heure_arrivee, heure_depart, photo_arrivee_url, photo_depart_url')
    .eq('session_id', params.id)
    .order('date', { ascending: true })

  // Rapport de session
  const formateurId = (sessionData.formateur as any)?.id
  let rapport = null
  if (formateurId) {
    const { data } = await supabase
      .from('rapports_session')
      .select('id, status, submitted_at')
      .eq('session_id', params.id)
      .eq('formateur_id', formateurId)
      .single()
    rapport = data
  }

  // Évaluations de satisfaction (apprenants)
  const { data: evaluations } = await supabase
    .from('evaluations_satisfaction')
    .select('id, type, note_globale, completee_at, apprenant_id')
    .eq('session_id', params.id)

  // QCM sessions (passages des apprenants)
  const { data: qcmSessions } = await supabase
    .from('qcm_sessions')
    .select('id, status, score, completed_at, apprenant_id, qcm:qcm(titre)')
    .eq('session_id', params.id)

  // Conventions liées à la session
  const { data: conventions } = await supabase
    .from('conventions')
    .select('id, numero, type, status, montant_ttc, signature_client_date, signature_of_date')
    .eq('session_id', params.id)
    .order('created_at', { ascending: false })

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
        isFormateur={isFormateur}
        userRole={session.user.role}
      />
    </div>
  )
}
