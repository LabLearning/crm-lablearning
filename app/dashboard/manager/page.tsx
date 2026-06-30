import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ManagerClient } from './ManagerClient'

export default async function ManagerPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [
    // Leads stats
    { data: leads },
    // Sessions stats
    { data: sessions },
    // Devis stats
    { data: devis },
    // Factures stats
    { data: factures },
    // Apprenants count
    { count: apprenantsCount },
    // Inscriptions
    { data: inscriptions },
    // Dossiers
    { data: dossiers },
    // Reclamations
    { count: reclamationsOuvertes },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id, status, montant_estime, created_at, converted_at')
      .eq('organization_id', orgId),
    supabase
      .from('sessions')
      .select('id, status, date_debut, date_fin, capacite_max')
      .eq('organization_id', orgId),
    supabase
      .from('devis')
      .select('id, status, montant_ht, created_at')
      .eq('organization_id', orgId),
    supabase
      .from('factures')
      .select('id, status, montant_ht, montant_ttc, date_emission')
      .eq('organization_id', orgId),
    supabase
      .from('apprenants')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('inscriptions')
      .select('id, status, session_id')
      .eq('organization_id', orgId),
    supabase
      .from('dossiers_formation')
      .select('id, status, created_at')
      .eq('organization_id', orgId),
    supabase
      .from('reclamations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['recue', 'en_analyse']),
  ])

  return (
    <div className="animate-fade-in">
      <ManagerClient
        leads={leads || []}
        sessions={sessions || []}
        devis={devis || []}
        factures={factures || []}
        apprenants={apprenantsCount || 0}
        inscriptions={inscriptions || []}
        dossiers={dossiers || []}
        reclamationsOuvertes={reclamationsOuvertes || 0}
      />
    </div>
  )
}
