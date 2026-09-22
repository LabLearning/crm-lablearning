import { getApporteurSession } from '@/lib/apporteur-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  syncCommissionsApporteur, chargerCommissionsApporteur, totauxCommissions, descriptionCommission, libelleLigne,
  type CommissionApporteurLigne, type StatutCommissionApporteur,
} from '@/lib/commission-apporteur'
import { Percent, Info, Banknote, Clock, CheckCircle2, Download } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number | string | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n || 0))
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

type Etat = Extract<StatutCommissionApporteur, 'validee' | 'en_attente' | 'payee'>

const BLOCS: { etat: Etat; titre: string; texte: string; icone: typeof Banknote; teinte: string; couleur: string }[] = [
  {
    etat: 'validee',
    titre: 'À vous verser',
    texte: 'Ces formations sont terminées et encaissées. Votre commission est due, son versement est en préparation.',
    icone: Banknote, teinte: 'bg-brand-50 text-brand-600', couleur: 'text-brand-600',
  },
  {
    etat: 'en_attente',
    titre: 'En attente d’encaissement',
    texte: 'Formations réalisées dont le règlement n’est pas encore arrivé. La commission passe « à vous verser » dès l’encaissement.',
    icone: Clock, teinte: 'bg-amber-50 text-amber-600', couleur: 'text-amber-600',
  },
  {
    etat: 'payee',
    titre: 'Déjà versées',
    texte: 'Commissions réglées, conservées pour votre historique.',
    icone: CheckCircle2, teinte: 'bg-emerald-50 text-emerald-600', couleur: 'text-emerald-600',
  },
]

/** Commissions de l'apporteur, groupées par état : ce qui est dû d'abord. */
export default async function ApporteurCommissionsPage() {
  const { apporteur, organization } = await getApporteurSession()
  if (!apporteur) return null
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  const sync = await syncCommissionsApporteur(supabase, orgId, { apporteurId: apporteur.id })
  const lignes = await chargerCommissionsApporteur(supabase, apporteur.id, orgId)
  const t = totauxCommissions(lignes)
  const par = (etat: Etat) => lignes.filter((l) => l.status === etat)
  const totalDe = (l: CommissionApporteurLigne[]) => l.reduce((s, x) => s + Number(x.montant_commission || 0), 0)
  const aucune = lignes.every((l) => l.status === 'annulee')

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Commissions</h1>
        <p className="text-surface-500 text-sm mt-1">Où en est chaque commission, formation par formation.</p>
      </div>

      <div className="card p-5 bg-brand-50/40 border-brand-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">À vous verser aujourd&apos;hui</div>
            <div className="text-3xl font-heading font-bold text-brand-700 tabular-nums mt-1">{fmtEuro(t.validee)}</div>
            <div className="text-xs text-surface-500 mt-1">{fmtEuro(t.en_attente)} en attente · {fmtEuro(t.payee)} déjà versées</div>
          </div>
          <div className="flex items-start gap-2 text-sm bg-white rounded-xl px-3 py-2 border border-brand-100">
            <Percent className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-surface-900">{apporteur.mode_calcul === 'fixe' ? 'Montant fixe' : `${Number(apporteur.taux_commission || 0).toLocaleString('fr-FR')} %`}</div>
              <div className="text-xs text-surface-500">{descriptionCommission(apporteur)}</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-3 inline-flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          Base de calcul : le montant pris en charge par le financeur, sinon le prix HT de la formation. Les montants sont hors TVA.
        </p>
      </div>

      {sync.sansMontant.length > 0 && (
        <div className="card p-3 text-xs text-surface-600 bg-amber-50/50 border-amber-100">
          {sync.sansMontant.length} formation{sync.sansMontant.length > 1 ? 's' : ''} terminée{sync.sansMontant.length > 1 ? 's' : ''} n&apos;{sync.sansMontant.length > 1 ? 'ont' : 'a'} pas encore de montant connu : la commission correspondante apparaîtra dès que {organization.name} l&apos;aura complété.
        </div>
      )}

      {aucune ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Banknote className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucune commission pour le moment. Elles apparaîtront dès la première formation terminée chez un établissement que vous avez apporté.</p>
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
                  <p className="text-xs text-surface-400 mt-0.5 tabular-nums">{l.length} formation{l.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-lg font-heading font-bold tabular-nums ${b.couleur}`}>{fmtEuro(totalDe(l))}</div>
                <a href={`/api/pdf/releve-commissions-apporteur/${apporteur.id}?etat=${b.etat}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-brand-600">
                  <Download className="h-3.5 w-3.5" /> Relevé PDF
                </a>
              </div>
            </div>
            <p className="text-xs text-surface-500 px-4 pt-2 pb-3 max-w-3xl">{b.texte}</p>

            <div className="table-scroll border-t border-surface-100">
              <table className="w-full">
                <thead className="bg-surface-50/60 border-b border-surface-200">
                  <tr className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">
                    <th className="px-4 py-2.5 text-left">Formation</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-right">Base</th>
                    <th className="px-4 py-2.5 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {l.map((x) => {
                    const { titre, sousTitre } = libelleLigne(x)
                    return (
                      <tr key={x.id}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-surface-900">{titre}</div>
                          {sousTitre && <div className="text-xs text-surface-400">{sousTitre}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">{fmtDate(x.date_session || x.session?.date_debut)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm tabular-nums text-surface-700">{fmtEuro(x.montant_base)}</div>
                          {x.taux_applique != null && <div className="text-[10px] text-surface-400">{Number(x.taux_applique).toLocaleString('fr-FR')} %</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-bold text-surface-900 tabular-nums">{fmtEuro(x.montant_commission)}</div>
                          {x.status === 'payee' && x.date_paiement && (
                            <div className="text-[10px] text-surface-400">versée le {fmtDate(x.date_paiement)}{x.reference_paiement ? ` · ${x.reference_paiement}` : ''}</div>
                          )}
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
