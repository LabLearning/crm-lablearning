import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Receipt, Euro, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function ApporteurCommissionsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apporteur') redirect('/portail/expired')
  const supabase = await createServiceRoleClient()

  // Get commissions + leads gagnes for potential commissions
  const [{ data: commissions }, { data: leadsGagnes }] = await Promise.all([
    supabase
      .from('commissions')
      .select('id, montant_commission, status, created_at, date_paiement, lead:leads(contact_nom, entreprise, montant_estime)')
      .eq('apporteur_id', context.apporteur.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('leads')
      .select('id, contact_nom, entreprise, montant_estime, converted_at')
      .eq('apporteur_id', context.apporteur.id)
      .eq('status', 'gagne'),
  ])

  const allComm = commissions || []
  const totalGagne = allComm.reduce((s, c: any) => s + (c.montant_commission || 0), 0)
  const totalPaye = allComm.filter((c: any) => c.status === 'payee').reduce((s, c: any) => s + (c.montant_commission || 0), 0)
  const enAttente = allComm.filter((c: any) => c.status !== 'payee').reduce((s, c: any) => s + (c.montant_commission || 0), 0)
  const taux = context.apporteur.taux_commission || 0
  const mode = context.apporteur.mode_calcul || 'pourcentage'

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">Mes commissions</h1>
      <p className="text-surface-500 text-sm mb-6">
        Taux : {mode === 'pourcentage' ? taux + '%' : taux + ' EUR fixe'} par lead converti
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total commissions', value: Number(totalGagne).toLocaleString('fr-FR') + ' EUR', color: 'text-surface-900' },
          { label: 'Payees', value: Number(totalPaye).toLocaleString('fr-FR') + ' EUR', color: 'text-success-600' },
          { label: 'En attente', value: Number(enAttente).toLocaleString('fr-FR') + ' EUR', color: enAttente > 0 ? 'text-warning-600' : 'text-surface-400' },
          { label: 'Leads gagnes', value: (leadsGagnes || []).length, color: 'text-brand-600' },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <div className={`text-xl font-heading font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Commissions table */}
      {allComm.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-surface-100">
            <div className="text-sm font-heading font-semibold text-surface-900">Historique des commissions</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Lead</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Montant</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100">
                {allComm.map((c: any) => (
                  <tr key={c.id} className="hover:bg-surface-50/50">
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-surface-900">{c.lead?.contact_nom || '--'}</div>
                      <div className="text-xs text-surface-400">{c.lead?.entreprise || ''}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-surface-600">
                      {c.created_at ? formatDate(c.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={c.status === 'payee' ? 'success' : c.status === 'validee' ? 'info' : 'warning'}>
                        {c.status === 'payee' ? 'Payee' : c.status === 'validee' ? 'Validee' : 'En attente'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-right font-bold text-surface-900">
                      {c.montant_commission ? Number(c.montant_commission).toLocaleString('fr-FR') + ' EUR' : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leads gagnes sans commission */}
      {(leadsGagnes || []).length > 0 && (
        <div className="card p-5">
          <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Leads gagnes</div>
          <div className="space-y-2">
            {(leadsGagnes || []).map((l: any) => {
              const hasCommission = allComm.some((c: any) => c.lead?.contact_nom === l.contact_nom)
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-800 truncate">{l.contact_nom}</div>
                    <div className="text-xs text-surface-400 truncate">{l.entreprise || ''}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {l.montant_estime && <span className="text-xs text-surface-500">{Number(l.montant_estime).toLocaleString('fr-FR')} EUR</span>}
                    {hasCommission ? (
                      <Badge variant="success">Commission calculee</Badge>
                    ) : (
                      <Badge variant="warning">En attente</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {allComm.length === 0 && (leadsGagnes || []).length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-16">
          <Receipt className="h-8 w-8 text-surface-300 mb-3" />
          <p className="text-sm text-surface-500">Aucune commission pour le moment</p>
          <p className="text-xs text-surface-400 mt-1">Les commissions sont calculees automatiquement quand vos leads sont convertis</p>
        </div>
      )}
    </div>
  )
}
