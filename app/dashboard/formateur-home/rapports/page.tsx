import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RapportsList } from './RapportsList'

export default async function RapportsFormateurPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: formateur } = await supabase.from('formateurs').select('id').eq('user_id', session.user.id).single()
  if (!formateur) redirect('/dashboard/formateur-home')

  // Sessions + rapports (indépendants) en parallèle
  const [{ data: sessions }, { data: rapports }] = await Promise.all([
    // Sessions du formateur (pour savoir lesquelles ont besoin d'un rapport)
    supabase
      .from('sessions')
      .select('id, reference, status, date_debut, date_fin, lieu, formation:formation_id(intitule)')
      .eq('formateur_id', formateur.id)
      .in('status', ['en_cours', 'terminee'])
      .order('date_debut', { ascending: false }),
    // Rapports existants
    supabase
      .from('rapports_session')
      .select('*')
      .eq('formateur_id', formateur.id),
  ])

  // Apprenants par session (pour les commentaires)
  const sessionIds = (sessions || []).map(s => s.id)
  let inscriptions: any[] = []
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from('inscriptions')
      .select('session_id, apprenant:apprenants(id, prenom, nom)')
      .in('session_id', sessionIds)
      .not('status', 'in', '("annule","abandonne")')
    inscriptions = data || []
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Rapports de session</h1>
        <p className="text-surface-500 mt-1 text-sm">Rédigez vos bilans de formation après chaque session</p>
      </div>
      <RapportsList
        sessions={(sessions || []) as any[]}
        rapports={(rapports || []) as any[]}
        inscriptions={inscriptions as any[]}
      />
    </div>
  )
}
