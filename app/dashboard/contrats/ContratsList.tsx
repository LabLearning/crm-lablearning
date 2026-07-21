'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, FileSignature, Download, Send, Clock, CheckCircle2, Building2,
  AlertTriangle, Archive, Mail, ExternalLink,
} from 'lucide-react'
import { useToast, RowMenu } from '@/components/ui'
import { resendContratSignatureAction, resendSignedContratAction } from './actions'
import { cn, formatDate } from '@/lib/utils'

export interface ContratLigne {
  id: string
  numero: string | null
  formateurId: string | null
  formateurNom: string
  formateurEmail: string | null
  intitule: string
  clientNom: string | null
  origine: string
  lienUrl: string | null
  dateMission: string | null
  montantHt: number | null
  envoyeLe: string | null
  signeLe: string | null
  signePar: string | null
  archive: boolean
  lienExpire: boolean
  annule: boolean
}

export function ContratsList({ contrats }: { contrats: ContratLigne[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'pending' | 'signed'>('all')
  const [busy, setBusy] = useState<string | null>(null)

  // Un contrat annulé (changement de formateur) n'est plus à signer
  const pendingCount = contrats.filter((c) => !c.signeLe && !c.annule).length
  const signedCount = contrats.filter((c) => c.signeLe && !c.annule).length

  const filtered = useMemo(() => {
    let result = contrats
    if (tab === 'pending') result = result.filter((c) => !c.signeLe && !c.annule)
    if (tab === 'signed') result = result.filter((c) => c.signeLe && !c.annule)
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((c) =>
        [c.numero, c.formateurNom, c.intitule, c.clientNom]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      )
    }
    return result
  }, [contrats, tab, search])

  async function handleResend(c: ContratLigne) {
    if (!c.formateurEmail) { toast('error', 'Ce formateur n\'a pas d\'adresse email'); return }
    setBusy(c.id)
    const r = await resendContratSignatureAction(c.id)
    setBusy(null)
    if (r.success) { toast('success', `Contrat renvoyé à ${c.formateurEmail}`); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  async function handleResendSigned(c: ContratLigne) {
    setBusy(c.id)
    const r = await resendSignedContratAction(c.id)
    setBusy(null)
    if (r.success) toast('success', 'Copie du contrat signé envoyée au formateur et à l\'organisme')
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Contrats formateurs</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {contrats.length} contrat{contrats.length > 1 ? 's' : ''} de prestation
          </p>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 bg-surface-100 rounded-lg p-0.5 mb-4 max-w-full overflow-x-auto">
        {([
          { id: 'all' as const, label: 'Tous', count: contrats.length },
          { id: 'pending' as const, label: 'À signer', count: pendingCount },
          { id: 'signed' as const, label: 'Signés', count: signedCount },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap',
              tab === t.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500 hover:text-surface-800',
            )}
          >
            {t.label}
            <span className={cn(
              'text-2xs px-1.5 py-0.5 rounded-full',
              tab === t.id ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-500',
            )}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 max-w-md mb-5">
        <Search className="h-4 w-4 text-surface-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Formateur, référence, formation…"
          className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card px-4 py-12 text-center text-sm text-surface-400">
          Aucun contrat {tab === 'pending' ? 'en attente de signature' : tab === 'signed' ? 'signé' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="card px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                <FileSignature className="h-4 w-4 text-surface-500" />
              </div>

              <div className="flex-1 min-w-[220px]">
                <div className="text-sm font-medium text-surface-900 truncate">{c.intitule}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-surface-500">
                  {c.numero && <span className="font-mono text-surface-400">{c.numero}</span>}
                  <span className="font-medium text-surface-700">{c.formateurNom}</span>
                  {c.clientNom && (
                    <span className="flex items-center gap-1 min-w-0">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.clientNom}</span>
                    </span>
                  )}
                  {c.origine === 'poei' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-semibold">POEI</span>
                  )}
                  {c.dateMission && (
                    <span>{formatDate(c.dateMission, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  )}
                  {c.montantHt != null && Number(c.montantHt) > 0 && (
                    <span className="font-medium text-surface-700">
                      {Number(c.montantHt).toLocaleString('fr-FR')} EUR HT
                    </span>
                  )}
                </div>
              </div>

              {c.annule ? (
                <span
                  title="Contrat caduc — le formateur de la session a changé"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-500 text-[11px] font-semibold shrink-0 line-through"
                >
                  Annulé
                </span>
              ) : c.signeLe ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                  Signé le {formatDate(c.signeLe, { day: 'numeric', month: 'short' })}
                </span>
              ) : c.envoyeLe ? (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0',
                  c.lienExpire ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700',
                )}>
                  {c.lienExpire ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {c.lienExpire ? 'Lien expiré' : 'En attente de signature'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-semibold shrink-0">
                  Brouillon
                </span>
              )}

              {c.signeLe && c.archive && (
                <span title="Exemplaire signé archivé" className="shrink-0 text-surface-300">
                  <Archive className="h-3.5 w-3.5" />
                </span>
              )}

              {!c.signeLe && !c.annule && (
                <button
                  onClick={() => handleResend(c)}
                  disabled={busy === c.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-surface-900 hover:bg-surface-800 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  {busy === c.id ? 'Envoi…' : c.envoyeLe ? 'Renvoyer' : 'Envoyer en signature'}
                </button>
              )}

              <div className="shrink-0">
                <RowMenu items={[
                  ...(c.formateurId ? [{
                    label: c.signeLe ? 'Télécharger le contrat signé' : 'Voir le contrat',
                    icon: <Download className="h-4 w-4 text-surface-400" />,
                    onClick: () => window.open(`/api/pdf/contrat-formateur/${c.formateurId}?contrat=${c.id}`, '_blank'),
                  }] : []),
                  ...(c.signeLe ? [{
                    label: 'Renvoyer la copie signée par email',
                    icon: <Mail className="h-4 w-4 text-surface-400" />,
                    onClick: () => handleResendSigned(c),
                  }] : []),
                  ...(c.lienUrl ? [{
                    label: c.origine === 'poei' ? 'Ouvrir le projet POEI' : 'Ouvrir la session',
                    icon: <ExternalLink className="h-4 w-4 text-surface-400" />,
                    onClick: () => router.push(c.lienUrl!),
                  }] : []),
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
