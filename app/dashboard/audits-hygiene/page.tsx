import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchAllPaged } from '@/lib/supabase/fetch-all'
import { suggestions } from '@/lib/audithygiene'
import { AuditsHygieneClient } from './AuditsHygieneClient'

export const dynamic = 'force-dynamic'

export default async function AuditsHygienePage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [etabRes, auditRes, duerpRes, actionRes, syncRes] = await Promise.all([
    supabase.from('ah_etablissements').select('*').eq('organization_id', orgId).order('nom'),
    supabase.from('ah_audits').select('*').eq('organization_id', orgId).order('date_audit', { ascending: false }).limit(500),
    supabase.from('ah_duerps').select('*').eq('organization_id', orgId).order('date_evaluation', { ascending: false }).limit(500),
    supabase.from('ah_duerp_actions').select('id, duerp_id, description, responsable, echeance, statut').eq('organization_id', orgId).limit(2000),
    supabase.from('ah_syncs').select('*').eq('organization_id', orgId).order('demarre_at', { ascending: false }).limit(1),
  ])

  const { data: franchisesRows } = await supabase
    .from('franchises').select('id, nom, logo_url').eq('organization_id', orgId)
  const franchises = new Map(((franchisesRows as any[]) || []).map((f) => [f.id, f]))

  // Migration 114 non appliquée : la page reste lisible et l'explique.
  const tableManquante = !!etabRes.error
  if (etabRes.error) console.error('[audits-hygiene]', etabRes.error.message)

  const etablissements = (etabRes.data as any[]) || []
  const clients = await fetchAllPaged((from, to) =>
    supabase.from('clients')
      .select('id, raison_sociale, nom_commercial, adresse, ville, code_postal, franchise_id')
      .eq('organization_id', orgId)
      .order('raison_sociale')
      .range(from, to),
  )

  const parClient = new Map(clients.map((c: any) => [c.id, c]))
  const orphelins = etablissements
    .filter((e) => !e.client_id && !e.ignore_rapprochement)
    .map((e) => ({
      ...e,
      _franchise: e.franchise_id ? franchises.get(e.franchise_id) || null : null,
      _suggestions: suggestions(e, clients as any[]).map((s) => ({
        id: s.client.id,
        label: s.client.raison_sociale || s.client.nom_commercial,
        ville: s.client.ville,
        note: Math.round(s.note * 100),
      })),
    }))

  const enrichir = (rows: any[]) =>
    rows.map((r) => {
      const etab = etablissements.find((e) => e.id === r.etablissement_id) || null
      return {
        ...r,
        _etab: etab ? { id: etab.id, nom: etab.nom, ville: etab.ville, client_id: etab.client_id } : null,
        _client: etab?.client_id ? parClient.get(etab.client_id) || null : null,
        _franchise: etab?.franchise_id ? franchises.get(etab.franchise_id) || null : null,
      }
    })

  return (
    <AuditsHygieneClient
      audits={enrichir((auditRes.data as any[]) || [])}
      duerps={enrichir((duerpRes.data as any[]) || [])}
      actions={(actionRes.data as any[]) || []}
      etablissements={etablissements.map((e) => ({ ...e, _franchise: e.franchise_id ? franchises.get(e.franchise_id) || null : null }))}
      orphelins={orphelins}
      clients={clients as any[]}
      derniereSync={(syncRes.data as any[])?.[0] || null}
      tableManquante={tableManquante}
      peutSynchroniser={['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)}
    />
  )
}
