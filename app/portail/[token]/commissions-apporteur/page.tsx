import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Receipt, Percent } from '@/components/ui/icons'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import {
  syncCommissionsApporteur, chargerCommissionsApporteur, totauxCommissions, descriptionCommission, libelleLigne,
  LIBELLES_STATUT_COMMISSION, type StatutCommissionApporteur,
} from '@/lib/commission-apporteur'

// Données temps réel : jamais de cache statique (accès par token, sans cookies)
export const dynamic = 'force-dynamic'

const eur = (n: number | string | null) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`

/**
 * Commissions vues par l'apporteur depuis son lien portail : une ligne par
 * formation réalisée chez un établissement apporté, avec son état.
 */
export default async function ApporteurCommissionsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apporteur') redirect('/portail/expired')
  const supabase = await createServiceRoleClient()
  const orgId = context.organization.id

  await syncCommissionsApporteur(supabase, orgId, { apporteurId: context.apporteur.id })
  const [lignes, { data: leadsGagnes }] = await Promise.all([
    chargerCommissionsApporteur(supabase, context.apporteur.id, orgId),
    supabase.from('leads').select('id, contact_nom, entreprise, montant_estime')
      .eq('apporteur_id', context.apporteur.id).eq('status', 'gagne'),
  ])
  const visibles = lignes.filter((l) => l.status !== 'annulee')
  const t = totauxCommissions(visibles)

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">Mes commissions</h1>
      <p className="text-surface-500 text-sm mb-6 inline-flex items-center gap-1.5">
        <Percent className="h-3.5 w-3.5 text-brand-500" /> {descriptionCommission(context.apporteur as any)}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'À vous verser', value: eur(t.validee), color: t.validee > 0 ? 'text-brand-600' : 'text-surface-400' },
          { label: 'En attente d’encaissement', value: eur(t.en_attente), color: t.en_attente > 0 ? 'text-warning-600' : 'text-surface-400' },
          { label: 'Déjà versées', value: eur(t.payee), color: 'text-success-600' },
          { label: 'Formations', value: String(visibles.length), color: 'text-surface-900' },
        ].map((k) => (
          <div key={k.label} className="card p-4 text-center">
            <div className={`text-lg font-heading font-bold tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {visibles.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-surface-100">
            <div className="text-sm font-heading font-semibold text-surface-900">Détail par formation</div>
          </div>
          <div className="table-scroll">
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Formation</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">État</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Commission</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100">
                {visibles.map((c) => {
                  const { titre, sousTitre } = libelleLigne(c)
                  const statut = c.status as StatutCommissionApporteur
                  return (
                    <tr key={c.id} className="hover:bg-surface-50/50">
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-surface-900">{titre}</div>
                        {sousTitre && <div className="text-xs text-surface-400">{sousTitre}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-surface-600 whitespace-nowrap">
                        {c.date_session ? formatDate(c.date_session, { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={statut === 'payee' ? 'success' : statut === 'validee' ? 'info' : 'warning'}>
                          {LIBELLES_STATUT_COMMISSION[statut] || c.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-bold text-surface-900 tabular-nums">{eur(c.montant_commission)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(leadsGagnes || []).length > 0 && (
        <div className="card p-5">
          <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Leads gagnés</div>
          <div className="space-y-2">
            {(leadsGagnes || []).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-surface-800 truncate">{l.contact_nom}</div>
                  <div className="text-xs text-surface-400 truncate">{l.entreprise || ''}</div>
                </div>
                {l.montant_estime && <span className="text-xs text-surface-500">{Number(l.montant_estime).toLocaleString('fr-FR')} €</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {visibles.length === 0 && (leadsGagnes || []).length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-16">
          <Receipt className="h-8 w-8 text-surface-300 mb-3" />
          <p className="text-sm text-surface-500">Aucune commission pour le moment</p>
          <p className="text-xs text-surface-400 mt-1">Une ligne apparaît dès qu&apos;une formation est terminée chez un établissement que vous avez apporté</p>
        </div>
      )}
    </div>
  )
}
