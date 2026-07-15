import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Receipt, CheckCircle2, Clock, AlertTriangle, Euro } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function ClientFacturesPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'client') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  const { data: factures } = await supabase
    .from('factures')
    .select('id, numero, status, montant_ht, montant_ttc, date_emission, date_echeance, type')
    .eq('client_id', context.client.id)
    .order('date_emission', { ascending: false })

  const statusConfig: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'danger' }> = {
    brouillon: { label: 'Brouillon', variant: 'default' },
    emise: { label: 'Emise', variant: 'info' },
    envoyee: { label: 'Envoyee', variant: 'info' },
    payee_partiellement: { label: 'Partiellement payee', variant: 'warning' },
    payee: { label: 'Payee', variant: 'success' },
    en_retard: { label: 'En retard', variant: 'danger' },
    annulee: { label: 'Annulee', variant: 'default' },
  }

  const totalDu = (factures || [])
    .filter((f: any) => ['emise', 'envoyee', 'payee_partiellement', 'en_retard'].includes(f.status))
    .reduce((sum: number, f: any) => sum + (f.montant_ttc || 0), 0)

  const totalPaye = (factures || [])
    .filter((f: any) => f.status === 'payee')
    .reduce((sum: number, f: any) => sum + (f.montant_ttc || 0), 0)

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">Factures</h1>
      <p className="text-surface-500 text-sm mb-6">Suivi de votre facturation</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-xl md:text-2xl font-heading font-bold text-surface-900">{(factures || []).length}</div>
          <div className="text-[11px] text-surface-400 mt-0.5">Total factures</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-lg md:text-2xl font-heading font-bold text-success-600 break-all">{Number(totalPaye).toLocaleString('fr-FR')} EUR</div>
          <div className="text-[11px] text-surface-400 mt-0.5">Paye</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-lg md:text-2xl font-heading font-bold text-warning-600 break-all">{Number(totalDu).toLocaleString('fr-FR')} EUR</div>
          <div className="text-[11px] text-surface-400 mt-0.5">En attente</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xl md:text-2xl font-heading font-bold text-danger-600">
            {(factures || []).filter((f: any) => f.status === 'en_retard').length}
          </div>
          <div className="text-[11px] text-surface-400 mt-0.5">En retard</div>
        </div>
      </div>

      {/* Factures list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Numero</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Echeance</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Montant TTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {(factures || []).map((f: any) => {
                const sc = statusConfig[f.status] || statusConfig.brouillon
                const isLate = f.status === 'en_retard'
                return (
                  <tr key={f.id} className={isLate ? 'bg-danger-50/30' : 'hover:bg-surface-50/50'}>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-surface-900">{f.numero}</div>
                      <div className="text-xs text-surface-400 capitalize">{f.type === 'acompte' ? 'Acompte' : f.type === 'avoir' ? 'Avoir' : 'Facture'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-surface-600">
                      {f.date_emission ? formatDate(f.date_emission, { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-surface-600">
                      {f.date_echeance ? formatDate(f.date_echeance, { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-right font-medium text-surface-800">
                      {f.montant_ttc ? Number(f.montant_ttc).toLocaleString('fr-FR') + ' EUR' : '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {(!factures || factures.length === 0) && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <Receipt className="h-8 w-8 text-surface-300 mb-3" />
            <p className="text-sm text-surface-500">Aucune facture pour le moment</p>
          </div>
        )}
      </div>
    </div>
  )
}
