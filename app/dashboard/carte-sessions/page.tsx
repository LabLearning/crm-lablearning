import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { CarteClient } from './CarteClient'

export default async function CarteSessionsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Une POEI = un point : chapeau, ou première intervention s'il n'y en a pas
  const { cartePoeiSessions } = await import('@/lib/poei-sessions')
  const { doublons: doublonsPoei } = await cartePoeiSessions(supabase, session.organization.id)

  const [{ data: sessions }, { data: franchises }, { data: etabs }] = await Promise.all([
    supabase
    .from('sessions')
    .select('id, reference, intitule, status, date_debut, date_fin, lieu, ville, code_postal, formation:formation_id(intitule, duree_heures, categorie), formateur:formateurs(prenom, nom), client:client_id(raison_sociale, nom_commercial, sigle)')
    .eq('organization_id', session.organization.id)
      // Les annulées sont affichées (pastille rouge), pas exclues.
      .order('date_debut', { ascending: false }),
    supabase
      .from('franchises')
      .select('id, nom, raison_sociale, logo_url, secteur, nombre_etablissements')
      .eq('organization_id', session.organization.id).eq('is_active', true).order('nom'),
    supabase
      .from('clients')
      .select('id, raison_sociale, nom_commercial, ville, code_postal, adresse, franchise_id')
      .eq('organization_id', session.organization.id).not('franchise_id', 'is', null).order('raison_sociale'),
  ])

  return (
    <div className="animate-fade-in">
      <CarteClient sessions={((sessions || []) as any[]).filter((s) => !doublonsPoei.has(s.id))} franchises={(franchises || []) as any[]} etablissements={(etabs || []) as any[]} />
    </div>
  )
}
