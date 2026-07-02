import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { CarteClient } from './CarteClient'

export default async function CarteSessionsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, status, date_debut, date_fin, lieu, formation:formation_id(intitule, duree_heures, categorie), formateur:formateurs(prenom, nom)')
    .eq('organization_id', session.organization.id)
    .not('status', 'eq', 'annulee')
    .order('date_debut', { ascending: true })

  return (
    <div className="animate-fade-in">
      <CarteClient sessions={(sessions || []) as any[]} />
    </div>
  )
}
