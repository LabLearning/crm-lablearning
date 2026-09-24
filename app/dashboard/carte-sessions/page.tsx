import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { CarteClient } from './CarteClient'

export default async function CarteSessionsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Carte des sessions OPCO : les sessions d'une POEI (chapeau, interventions) se voient dans le module POEI
  const { cartePoeiSessions } = await import('@/lib/poei-sessions')
  const { doublons: doublonsPoei, poeiParSession } = await cartePoeiSessions(supabase, session.organization.id)
  const estPoei = (s: any) => doublonsPoei.has(s.id) || poeiParSession.has(s.id) || !!s.poei_intervention_id || !!s.formation?.is_poei

  const [{ data: sessions }, { data: franchises }, { data: etabs }] = await Promise.all([
    supabase
    .from('sessions')
    .select('id, reference, intitule, status, date_debut, date_fin, lieu, ville, code_postal, poei_intervention_id, formation:formation_id(intitule, duree_heures, categorie, is_poei), formateur:formateurs(prenom, nom), client:client_id(raison_sociale, nom_commercial, sigle)')
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
      <CarteClient sessions={((sessions || []) as any[]).filter((s) => !estPoei(s))} franchises={(franchises || []) as any[]} etablissements={(etabs || []) as any[]} />
    </div>
  )
}
