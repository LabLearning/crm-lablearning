'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReceiptEuro, FileText, Clock, Download } from '@/components/ui/icons'
import { PoeiSection } from './PoeiSection'
import { Button, useToast, Modal, Input } from '@/components/ui'
import { generateFacturesPerCandidatPoeiAction, setCandidatNumeroEngagementAction } from '../actions'

interface Candidat {
  id: string
  numero_engagement?: string | null
  apprenant?: { id: string; prenom: string | null; nom: string | null } | null
}
interface FactureInfo { id: string; numero: string | null; status: string; montant_ttc: number | null }

const FACT_STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-surface-100 text-surface-600' },
  emise: { label: 'Émise', cls: 'bg-blue-100 text-blue-700' },
  envoyee: { label: 'Envoyée', cls: 'bg-indigo-100 text-indigo-700' },
  payee_partiellement: { label: 'Payée en partie', cls: 'bg-amber-100 text-warning-700' },
  payee: { label: 'Payée', cls: 'bg-emerald-100 text-success-700' },
  en_retard: { label: 'En retard', cls: 'bg-rose-100 text-danger-700' },
  annulee: { label: 'Annulée', cls: 'bg-surface-100 text-surface-400' },
}

interface Agence { id: string; nom: string; ville?: string | null }

/** N° d'engagement France Travail d'un candidat, saisi puis reporté sur sa facture. */
function EngagementCandidat({ candidatId, valeur, verrouille }: { candidatId: string; valeur: string; verrouille: boolean }) {
  const { toast } = useToast()
  const router = useRouter()
  const [v, setV] = useState(valeur)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (v.trim() === valeur.trim()) return
    setBusy(true)
    const r = await setCandidatNumeroEngagementAction(candidatId, v)
    setBusy(false)
    if (r.success) { toast('success', 'N° d’engagement enregistré'); router.refresh() }
    else { toast('error', r.error || 'Erreur'); setV(valeur) }
  }

  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      disabled={verrouille || busy}
      placeholder="N° engagement"
      title={verrouille ? 'Facture déjà émise : numéro figé' : 'N° d’engagement France Travail de ce candidat'}
      className={`input-base !py-2 sm:!py-1 !px-2 text-xs font-mono w-full sm:w-36 ${!v ? 'border-amber-300 bg-warning-50/40' : ''} disabled:opacity-60`}
    />
  )
}

export function PoeiFacturation({
  poeiId, sessionId, sessionTerminee, candidats, facturesByCandidat, agences = [], currentAgenceId = null,
  signatures = {},
}: {
  poeiId: string
  sessionId: string | null
  sessionTerminee: boolean
  candidats: Candidat[]
  signatures?: Record<string, { signed_at: string | null; sent_at: string | null }>
  facturesByCandidat: Record<string, FactureInfo>
  agences?: Agence[]
  currentAgenceId?: string | null
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [gen, setGen] = useState(false)




  async function generate() {
    setGen(true)
    const r = await generateFacturesPerCandidatPoeiAction(poeiId)
    setGen(false)
    if (r.success) {
      const { created, updated, skipped, supprimees, orphelinesEmises } = (r.data || {}) as
        { created: number; updated: number; skipped: number; supprimees?: number; orphelinesEmises?: number }
      const parts: string[] = []
      if (created) parts.push(`${created} générée${created > 1 ? 's' : ''}`)
      if (updated) parts.push(`${updated} mise${updated > 1 ? 's' : ''} à jour`)
      if (skipped) parts.push(`${skipped} déjà émise${skipped > 1 ? 's' : ''}`)
      if (supprimees) parts.push(`${supprimees} supprimée${supprimees > 1 ? 's' : ''} (candidat retiré)`)
      if (orphelinesEmises) {
        toast('error', `${orphelinesEmises} facture(s) émise(s) concernent un candidat retiré du dossier, à annuler manuellement`)
      }
      toast('success', parts.length ? `Factures : ${parts.join(', ')}` : 'Aucune facture modifiée')
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  const nbFactures = Object.keys(facturesByCandidat).length

  return (
    <PoeiSection
      icone={ReceiptEuro}
      titre="Facturation"
      sous="Une facture par candidat, adressée à France Travail."
      actions={sessionTerminee ? (
        <>
          {nbFactures > 0 && (
            <a href={`/api/pdf/poei-factures/${poeiId}`}
              className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm">
              <Download className="h-4 w-4" /> Toutes les factures (ZIP)
            </a>
          )}
          <Button onClick={generate} isLoading={gen} size="sm" icon={<ReceiptEuro className="h-4 w-4" />}>
            {nbFactures > 0 ? 'Mettre à jour les factures' : 'Générer les factures'}
          </Button>
        </>
      ) : undefined}
    >
      <div className="card p-4 sm:p-5 space-y-4">

      {!sessionTerminee ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface-50 border border-surface-200/70 px-4 py-3 text-sm text-surface-500">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Les factures pourront être générées une fois la <strong className="text-surface-700">session terminée</strong>.</span>
        </div>
      ) : candidats.length === 0 ? (
        <div className="text-sm text-surface-500">Aucun candidat.</div>
      ) : (
        <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 overflow-hidden">
          {candidats.map((c) => {
            const nom = `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat'
            const fac = facturesByCandidat[c.id]
            const st = fac ? (FACT_STATUS[fac.status] || FACT_STATUS.brouillon) : null
            return (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{nom}</div>
                  {fac && (
                    <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${st!.cls}`}>{st!.label}</span>
                      {fac.numero && <span>{fac.numero}</span>}
                      {fac.montant_ttc != null && <span className="tabular-nums">{Number(fac.montant_ttc).toLocaleString('fr-FR')} €</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                  <EngagementCandidat
                    candidatId={c.id}
                    valeur={c.numero_engagement || ''}
                    verrouille={!!fac && fac.status !== 'brouillon'}
                  />
                  {fac ? (
                    <a href={`/api/pdf/facture/${fac.id}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 min-h-[40px] sm:min-h-0 text-xs font-medium text-surface-700 hover:bg-surface-50 shrink-0 whitespace-nowrap">
                      <FileText className="h-3.5 w-3.5" /> Facture
                    </a>
                  ) : (
                    <span className="text-xs text-surface-300 px-2.5 shrink-0 whitespace-nowrap">Pas de facture</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </PoeiSection>
  )
}
