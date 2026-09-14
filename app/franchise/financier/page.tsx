import Link from 'next/link'
import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFranchiseStats, getFranchiseCommissionLines, type LigneCommissionSession } from '@/lib/franchise-data'
import { commissionTypeLabel, syncFranchiseCommissions } from '@/lib/commission'
import { Percent, Info, Banknote, Clock, CheckCircle, Download } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))
const fmtEuroPrecis = (n: number | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n || 0))
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

type Etat = 'validee' | 'a_venir' | 'payee'

const BLOCS: { etat: Etat; titre: string; texte: string; icone: typeof Banknote; teinte: string; couleur: string }[] = [
  {
    etat: 'validee',
    titre: 'À vous verser',
    texte: "Ces dossiers sont terminés et encaissés. Votre commission est due, son versement est en préparation.",
    icone: Banknote, teinte: 'bg-brand-50 text-brand-600', couleur: 'text-brand-600',
  },
  {
    etat: 'a_venir',
    titre: 'En cours',
    texte: "Formations délivrées, dont le règlement du financeur n'est pas encore arrivé. La commission passe « à vous verser » dès l'encaissement.",
    icone: Clock, teinte: 'bg-amber-50 text-amber-600', couleur: 'text-amber-600',
  },
  {
    etat: 'payee',
    titre: 'Déjà versées',
    texte: 'Commissions réglées, conservées pour votre historique.',
    icone: CheckCircle, teinte: 'bg-emerald-50 text-emerald-600', couleur: 'text-emerald-600',
  },
]

/**
 * Commissions du portail franchise, groupées par état plutôt qu'en une seule
 * liste : la franchise voit d'abord ce qui lui est dû, puis ce qui arrive.
 */
export default async function FranchiseFinancierPage() {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  await syncFranchiseCommissions(supabase, franchise.id, orgId)
  const [stats, lignes] = await Promise.all([
    getFranchiseStats(supabase, franchise.id, orgId),
    getFranchiseCommissionLines(supabase, franchise.id, orgId),
  ])
  const isNet = franchise.commission_type === 'budget_net'
  const par = (etat: Etat) => lignes.filter((l) => l.status === etat && Number(l.commission_montant || 0) > 0)
  const totalDe = (l: LigneCommissionSession[]) => l.reduce((t, x) => t + Number(x.commission_montant || 0), 0)
  const aucune = lignes.every((l) => Number(l.commission_montant || 0) <= 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Commissions</h1>
        <p className="text-surface-500 text-sm mt-1">
          Où en est chaque commission de votre réseau. Les montants indiqués sont des montants TTC.
        </p>
      </div>

      {/* Ce qui vous est dû, en premier */}
      <div className="card p-5 bg-brand-50/40 border-brand-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">À vous verser aujourd&apos;hui</div>
            <div className="text-3xl font-heading font-bold text-brand-700 tabular-nums mt-1">
              {fmtEuroPrecis(stats.commissionValidee)}
            </div>
            <div className="text-xs text-surface-500 mt-1">
              {fmtEuroPrecis(stats.commissionAVenir)} en cours · {fmtEuroPrecis(stats.commissionPayee)} déjà versées
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm bg-white rounded-xl px-3 py-2 border border-brand-100">
            <Percent className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-surface-900">{franchise.taux_commission}%</div>
              <div className="text-xs text-surface-500">{commissionTypeLabel(franchise.commission_type)}</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-3 inline-flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          {isNet
            ? 'Calculé sur la prise en charge de chaque session, après déduction des frais de formateur.'
            : 'Calculé sur le montant de prise en charge de chaque session.'}
        </p>
      </div>

      {stats.nbSessionsSansMontant > 0 && (
        <div className="card p-3 text-xs text-surface-600 bg-amber-50/50 border-amber-100">
          {stats.nbSessionsSansMontant} session{stats.nbSessionsSansMontant > 1 ? 's' : ''} n&apos;{stats.nbSessionsSansMontant > 1 ? 'ont' : 'a'} pas encore de montant de prise en charge renseigné : la commission correspondante apparaîtra dès que {organization.name} l&apos;aura complété.
        </div>
      )}

      {aucune ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Banknote className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucune commission pour le moment. Elles apparaîtront dès la première formation facturée dans votre réseau.</p>
        </div>
      ) : BLOCS.map((b) => {
        const l = par(b.etat)
        if (!l.length) return null
        const Icone = b.icone
        return (
          <div key={b.etat} className="card overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-4 pt-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${b.teinte}`}>
                  <Icone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-heading font-semibold text-surface-900">{b.titre}</h2>
                  <p className="text-xs text-surface-400 mt-0.5 tabular-nums">
                    {l.length} formation{l.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-lg font-heading font-bold tabular-nums ${b.couleur}`}>{fmtEuroPrecis(totalDe(l))}</div>
                <a
                  href={`/api/pdf/releve-commissions/${franchise.id}?etat=${b.etat}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-brand-600"
                >
                  <Download className="h-3.5 w-3.5" /> Relevé PDF
                </a>
              </div>
            </div>
            <p className="text-xs text-surface-500 px-4 pt-2 pb-3 max-w-3xl">{b.texte}</p>

            <div className="overflow-x-auto border-t border-surface-100">
              <table className="w-full">
                <thead className="bg-surface-50/60 border-b border-surface-200">
                  <tr className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">
                    <th className="px-4 py-2.5 text-left">Formation</th>
                    <th className="px-4 py-2.5 text-left">Établissement</th>
                    <th className="px-4 py-2.5 text-right">Prise en charge</th>
                    {isNet && <th className="px-4 py-2.5 text-right">Frais formateur</th>}
                    <th className="px-4 py-2.5 text-right">Commission TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {l.map((x) => {
                    const s = x.session
                    const titre = s?.formation?.intitule || s?.intitule || 'Formation'
                    return (
                      <tr key={x.id} className="border-b border-surface-100 last:border-0">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-surface-900 truncate max-w-[260px]">{titre}</div>
                          <div className="text-xs text-surface-400">
                            {s?.reference ? `${s.reference} · ` : ''}{fmtDate(s?.date_debut)}
                            {s?.date_fin && s.date_fin !== s.date_debut ? ` → ${fmtDate(s.date_fin)}` : ''}
                            {x.payee_at && b.etat === 'payee' ? ` · versée le ${fmtDate(x.payee_at)}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-surface-700 truncate max-w-[160px]">
                          {x.client?.id
                            ? <Link href={`/franchise/etablissements/${x.client.id}`} className="hover:text-brand-600">{x.client.raison_sociale}</Link>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-surface-700">
                          {Number(x.base_montant) > 0 ? fmtEuro(x.base_montant) : <span className="text-xs text-surface-400">à compléter</span>}
                        </td>
                        {isNet && <td className="px-4 py-3 text-right text-sm tabular-nums text-surface-500">{fmtEuro(x.cout_formateur)}</td>}
                        <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${b.couleur}`}>
                          {fmtEuroPrecis(x.commission_montant)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
