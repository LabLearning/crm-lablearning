import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ManagerClient, type ManagerStats } from './ManagerClient'

export default async function ManagerPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // ── Voie rapide : tous les KPIs en 1 requête SQL (RPC manager_kpis) ──
  let stats: ManagerStats | null = null
  try {
    const { data: k, error } = await supabase.rpc('manager_kpis', { org: orgId })
    if (!error && k && typeof k === 'object') {
      stats = {
        leadsTotal: Number(k.leads_total) || 0,
        leadsMois: Number(k.leads_mois) || 0,
        leadsParStatut: (k.leads_par_statut || {}) as ManagerStats['leadsParStatut'],
        devisTotal: Number(k.devis_total) || 0,
        devisAcceptes: Number(k.devis_acceptes) || 0,
        devisMontant: Number(k.devis_montant) || 0,
        facturesParStatut: (k.factures_par_statut || {}) as Record<string, number>,
        caFacture: Number(k.ca_facture) || 0,
        caPaye: Number(k.ca_paye) || 0,
        impayes: Number(k.impayes) || 0,
        sessionsParStatut: (k.sessions_par_statut || {}) as Record<string, number>,
        dossiersParStatut: (k.dossiers_par_statut || {}) as Record<string, number>,
        apprenants: Number(k.apprenants) || 0,
        reclamationsOuvertes: Number(k.reclamations_ouvertes) || 0,
      }
    }
  } catch { /* repli legacy ci-dessous */ }

  // ── Repli : requêtes classiques tant que la migration 065 n'est pas appliquée ──
  if (!stats) {
    const now = new Date()
    const thisMonth = now.toISOString().substring(0, 7)
    const [
      { data: leads }, { data: sessions }, { data: devis }, { data: factures },
      { count: apprenantsCount }, { data: dossiers }, { count: reclamationsOuvertes },
    ] = await Promise.all([
      supabase.from('leads').select('status, montant_estime, created_at').eq('organization_id', orgId),
      supabase.from('sessions').select('status').eq('organization_id', orgId),
      supabase.from('devis').select('status, montant_ht').eq('organization_id', orgId),
      supabase.from('factures').select('status, montant_ht').eq('organization_id', orgId),
      supabase.from('apprenants').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('dossiers_formation').select('status').eq('organization_id', orgId),
      supabase.from('reclamations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['recue', 'en_analyse']),
    ])
    const groupCount = (rows: any[] | null, key = 'status') => {
      const out: Record<string, number> = {}
      for (const r of rows || []) out[r[key]] = (out[r[key]] || 0) + 1
      return out
    }
    const leadsParStatut: ManagerStats['leadsParStatut'] = {}
    for (const l of leads || []) {
      const st = (leadsParStatut[l.status] ||= { count: 0, montant: 0 })
      st.count++; st.montant += Number(l.montant_estime) || 0
    }
    stats = {
      leadsTotal: (leads || []).length,
      leadsMois: (leads || []).filter((l) => l.created_at?.startsWith(thisMonth)).length,
      leadsParStatut,
      devisTotal: (devis || []).length,
      devisAcceptes: (devis || []).filter((d) => d.status === 'accepte').length,
      devisMontant: (devis || []).reduce((s, d) => s + (Number(d.montant_ht) || 0), 0),
      facturesParStatut: groupCount(factures),
      caFacture: (factures || []).filter((f) => f.status !== 'annulee').reduce((s, f) => s + (Number(f.montant_ht) || 0), 0),
      caPaye: (factures || []).filter((f) => f.status === 'payee').reduce((s, f) => s + (Number(f.montant_ht) || 0), 0),
      impayes: (factures || []).filter((f) => ['en_retard', 'relancee'].includes(f.status)).reduce((s, f) => s + (Number(f.montant_ht) || 0), 0),
      sessionsParStatut: groupCount(sessions),
      dossiersParStatut: groupCount(dossiers),
      apprenants: apprenantsCount || 0,
      reclamationsOuvertes: reclamationsOuvertes || 0,
    }
  }

  return (
    <div className="animate-fade-in">
      <ManagerClient stats={stats} />
    </div>
  )
}
