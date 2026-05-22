import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFranchiseStats } from '@/lib/franchise-data'
import { commissionTypeLabel, commissionStatusLabel } from '@/lib/commission'
import { Banknote, Percent, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))

const STATUS_STYLE: Record<string, string> = {
  a_venir: 'bg-surface-100 text-surface-600',
  validee: 'bg-blue-50 text-blue-700',
  payee: 'bg-emerald-50 text-emerald-700',
  annulee: 'bg-rose-50 text-rose-700',
}

export default async function FranchiseFinancierPage() {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  const stats = await getFranchiseStats(supabase, franchise.id, orgId)

  // Détail dossier par dossier
  const { data: clients } = await supabase
    .from('clients').select('id').eq('franchise_id', franchise.id).eq('organization_id', orgId)
  const clientIds = (clients || []).map((c: any) => c.id)
  const orFilter = clientIds.length
    ? `franchise_id.eq.${franchise.id},client_id.in.(${clientIds.join(',')})`
    : `franchise_id.eq.${franchise.id}`

  const { data: dossiers } = await supabase
    .from('dossiers_formation')
    .select(`
      id, numero, date_creation, montant_prise_en_charge, cout_formateur,
      commission_montant, commission_taux, commission_type, commission_status,
      client:clients(raison_sociale), formation:formations(intitule)
    `)
    .eq('organization_id', orgId)
    .or(orFilter)
    .order('date_creation', { ascending: false })

  const ds = dossiers || []
  const isNet = franchise.commission_type === 'budget_net'

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Financier</h1>
        <p className="text-surface-500 text-sm mt-1">Vos commissions, dossier par dossier.</p>
      </div>

      {/* Mode de commission */}
      <div className="card p-4 flex items-start gap-3 bg-brand-50/30 border-brand-100">
        <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shrink-0">
          <Percent className="h-4 w-4 text-brand-600" />
        </div>
        <div className="text-sm">
          <div className="font-semibold text-surface-900">{franchise.taux_commission}% — {commissionTypeLabel(franchise.commission_type)}</div>
          <div className="text-xs text-surface-500 mt-0.5 inline-flex items-center gap-1">
            <Info className="h-3 w-3" />
            {isNet
              ? 'Calculé sur la prise en charge OPCO après déduction des frais de formateur.'
              : 'Calculé sur le montant de prise en charge OPCO débloqué.'}
          </div>
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Box label="Total commissions" value={fmtEuro(stats.commissionTotale)} accent />
        <Box label="À venir" value={fmtEuro(stats.commissionAVenir)} />
        <Box label="Validées (à payer)" value={fmtEuro(stats.commissionValidee)} tone="blue" />
        <Box label="Payées" value={fmtEuro(stats.commissionPayee)} tone="emerald" />
      </div>

      {/* Tableau dossiers */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-50/60 border-b border-surface-200">
            <tr className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">
              <th className="px-4 py-3 text-left">Dossier</th>
              <th className="px-4 py-3 text-left">Établissement</th>
              <th className="px-4 py-3 text-right">Prise en charge</th>
              {isNet && <th className="px-4 py-3 text-right">Frais formateur</th>}
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {ds.length === 0 ? (
              <tr><td colSpan={isNet ? 6 : 5} className="px-4 py-8 text-center text-sm text-surface-400">Aucun dossier pour le moment.</td></tr>
            ) : ds.map((d) => (
              <tr key={d.id} className="border-b border-surface-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-surface-900">{d.numero}</div>
                  {d.formation && <div className="text-xs text-surface-400 truncate max-w-[160px]">{(d.formation as any).intitule}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-surface-700 truncate max-w-[160px]">{(d.client as any)?.raison_sociale || '—'}</td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-surface-700">{fmtEuro(d.montant_prise_en_charge)}</td>
                {isNet && <td className="px-4 py-3 text-right text-sm tabular-nums text-surface-500">{fmtEuro(d.cout_formateur)}</td>}
                <td className="px-4 py-3 text-right text-sm font-bold text-amber-600 tabular-nums">{fmtEuro(d.commission_montant)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-semibold ${STATUS_STYLE[d.commission_status || 'a_venir']}`}>
                    {commissionStatusLabel(d.commission_status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Box({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: 'blue' | 'emerald' }) {
  const col = accent ? 'text-amber-600' : tone === 'blue' ? 'text-blue-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-surface-900'
  return (
    <div className="card p-4">
      <div className="text-xs text-surface-500">{label}</div>
      <div className={`text-xl font-heading font-bold mt-1 tabular-nums ${col}`}>{value}</div>
    </div>
  )
}
