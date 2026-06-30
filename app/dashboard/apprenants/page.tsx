import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ApprenantsList } from './ApprenantsList'
import type { Apprenant, Session, Inscription } from '@/lib/types/formation'
import type { Client } from '@/lib/types/crm'

export default async function ApprenantsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: apprenants }, { data: clients }, { data: sessions }] = await Promise.all([
    supabase
      .from('apprenants')
      .select('*, client:clients(raison_sociale)')
      .eq('organization_id', session.organization.id)
      .order('nom', { ascending: true }),
    supabase
      .from('clients')
      .select('id, raison_sociale')
      .eq('organization_id', session.organization.id)
      .eq('type', 'entreprise')
      .order('raison_sociale'),
    // Available sessions (upcoming or in progress)
    supabase
      .from('sessions')
      .select('id, reference, date_debut, date_fin, formation:formations(intitule)')
      .eq('organization_id', session.organization.id)
      .in('status', ['planifiee', 'confirmee', 'en_cours'])
      .order('date_debut', { ascending: true }),
  ])

  // All inscriptions for these apprenants
  const apprenantIds = (apprenants || []).map((a) => a.id)
  let inscriptions: Inscription[] = []
  if (apprenantIds.length > 0) {
    const { data } = await supabase
      .from('inscriptions')
      .select('*, session:sessions(reference, date_debut, date_fin)')
      .in('apprenant_id', apprenantIds)
      .order('date_inscription', { ascending: false })
    inscriptions = (data || []) as Inscription[]
  }

  return (
    <div className="animate-fade-in">
      <ApprenantsList
        apprenants={(apprenants || []) as Apprenant[]}
        clients={(clients || []) as any[]}
        sessions={(sessions || []) as any[]}
        inscriptions={inscriptions}
      />
    </div>
  )
}
