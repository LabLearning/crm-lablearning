'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Landmark, Loader2 } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { montantFr } from '@/lib/tresorerie'
import { MOTIF_LABEL, type Proposition } from '@/lib/rapprochement-formateurs'
import { appliquerRapprochementsAction, confirmerRapprochementAction } from './actions'

const jourFr = (j: string) => `${j.slice(8, 10)}/${j.slice(5, 7)}/${j.slice(0, 4)}`

function Ligne({ p, children }: { p: Proposition; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
      <span className="min-w-0 flex-1 basis-64">
        <span className="block truncate text-sm font-medium text-surface-800">
          {p.facture.formateurNom} · <span className="font-mono text-[13px]">{p.facture.numero}</span>
          {p.facture.client && <span className="font-normal text-surface-500"> · {p.facture.client}</span>}
        </span>
        <span className="block truncate text-xs text-surface-500">
          Virement du {jourFr(p.virement.jour)}{p.virement.libelle ? ` « ${p.virement.libelle} »` : ''}{p.virement.compte ? `, compte ${p.virement.compte}` : ''}
        </span>
        <span className="block text-[11px] text-surface-400">{MOTIF_LABEL[p.motif]}{!p.sur && /avance|acompte/i.test(p.virement.libelle) ? ', mais il est libellé « avance »' : ''}</span>
      </span>
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-surface-900">{montantFr(p.facture.montantTtc, 2)}</span>
      {children}
    </li>
  )
}

/** Les factures que la banque montre réglées : les sûres d'un seul geste, les autres une à une. */
export function RapprochementBanque({ propositions }: { propositions: Proposition[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()
  const sures = propositions.filter((p) => p.sur)
  const aConfirmer = propositions.filter((p) => !p.sur)
  if (!propositions.length) return null

  const toutMarquer = () => start(async () => {
    const r = await appliquerRapprochementsAction()
    if (r.success) { toast('success', `${r.data?.nb || 0} facture${(r.data?.nb || 0) > 1 ? 's marquées payées' : ' marquée payée'}`); router.refresh() }
    else toast('error', r.error || 'Erreur')
  })
  const confirmer = (p: Proposition) => start(async () => {
    const r = await confirmerRapprochementAction(p.facture.id, p.virement.id)
    if (r.success) { toast('success', `${p.facture.numero} marquée payée`); router.refresh() }
    else toast('error', r.error || 'Erreur')
  })

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="rapprochement-titre">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <Landmark className="h-5 w-5 text-brand-600" />
        </div>
        <div className="min-w-0">
          <h2 id="rapprochement-titre" className="font-heading font-semibold text-surface-900">Factures réglées en banque</h2>
          <p className="mt-0.5 text-xs text-surface-500">
            Des virements Qonto au nom du formateur ont exactement le montant de ces factures, encore ouvertes dans le CRM.
          </p>
        </div>
      </div>

      {sures.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-label">Sûres : le virement cite la facture ou son client</h3>
            <button type="button" onClick={toutMarquer} disabled={pending} className="btn-primary !py-2 text-sm inline-flex min-h-10 items-center gap-1.5">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Marquer {sures.length > 1 ? `ces ${sures.length} factures payées` : 'cette facture payée'}
            </button>
          </div>
          <ul className="mt-1 divide-y divide-surface-100">
            {sures.map((p) => <Ligne key={`${p.facture.id}-${p.virement.id}`} p={p} />)}
          </ul>
        </div>
      )}

      {aConfirmer.length > 0 && (
        <div className="mt-4">
          <h3 className="section-label">À confirmer une par une</h3>
          <ul className="mt-1 divide-y divide-surface-100">
            {aConfirmer.map((p) => (
              <Ligne key={`${p.facture.id}-${p.virement.id}`} p={p}>
                <button type="button" onClick={() => confirmer(p)} disabled={pending} className="btn-secondary !py-1.5 text-xs inline-flex min-h-9 items-center">
                  Confirmer
                </button>
              </Ligne>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
