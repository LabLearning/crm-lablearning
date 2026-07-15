import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { NouveauLeadForm } from './NouveauLeadForm'

const SL: Record<string, string> = {
  nouveau: 'Nouveau', contacte: 'Contacte', qualification: 'Qualification',
  proposition_envoyee: 'Proposition', negociation: 'Negociation',
  gagne: 'Gagne', perdu: 'Perdu',
}
const SV: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  nouveau: 'info', contacte: 'default', qualification: 'warning',
  proposition_envoyee: 'info', negociation: 'warning', gagne: 'success', perdu: 'danger',
}

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function ApporteurLeadsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apporteur') redirect('/portail/expired')
  const supabase = await createServiceRoleClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, contact_nom, contact_prenom, entreprise, status, montant_estime, created_at')
    .eq('apporteur_id', context.apporteur.id)
    .order('created_at', { ascending: false })

  const all = leads || []
  const gagnes = all.filter(l => l.status === 'gagne')
  const enCours = all.filter(l => !['gagne', 'perdu'].includes(l.status))
  const tx = all.length > 0 ? Math.round((gagnes.length / all.length) * 100) : 0

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">Mes leads</h1>
      <p className="text-surface-500 text-sm mb-6">Soumettez un prospect ou consultez l&apos;avancement de vos leads transmis</p>

      {/* New lead form */}
      <div className="mb-8">
        <NouveauLeadForm token={params.token} />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-surface-100" />
        <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Vos leads transmis</span>
        <div className="flex-1 h-px bg-surface-100" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: all.length, color: 'text-surface-900' },
          { label: 'En cours', value: enCours.length, color: 'text-blue-600' },
          { label: 'Gagnes', value: gagnes.length, color: 'text-success-600' },
          { label: 'Conversion', value: tx + '%', color: tx >= 20 ? 'text-success-600' : 'text-warning-600' },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <div className={`text-xl font-heading font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {all.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Pipeline</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(SL).map(([key, label]) => {
              const count = all.filter(l => l.status === key).length
              if (count === 0) return null
              return (
                <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-50">
                  <Badge variant={SV[key]}>{label}</Badge>
                  <span className="text-sm font-bold text-surface-800">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-surface-100">
              <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Contact</th>
              <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Entreprise</th>
              <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Statut</th>
              <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Montant</th>
              <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100">
              {all.map((l: any) => (
                <tr key={l.id} className="hover:bg-surface-50/50">
                  <td className="px-5 py-3.5"><div className="text-sm font-medium text-surface-900">{l.contact_prenom} {l.contact_nom}</div></td>
                  <td className="px-5 py-3.5 text-sm text-surface-600">{l.entreprise || '--'}</td>
                  <td className="px-5 py-3.5"><Badge variant={SV[l.status] || 'default'}>{SL[l.status] || l.status}</Badge></td>
                  <td className="px-5 py-3.5 text-sm text-right font-medium text-surface-800">{l.montant_estime ? Number(l.montant_estime).toLocaleString('fr-FR') + ' EUR' : '--'}</td>
                  <td className="px-5 py-3.5 text-sm text-surface-500">{formatDate(l.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {all.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <Users className="h-8 w-8 text-surface-300 mb-3" />
            <p className="text-sm text-surface-500">Aucun lead apporte pour le moment</p>
          </div>
        )}
      </div>
    </div>
  )
}
