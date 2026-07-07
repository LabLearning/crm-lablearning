'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, Loader2, Unlink } from 'lucide-react'
import { linkClientToFranchiseAction } from '../actions'

interface Client { id: string; raison_sociale: string; ville: string | null; franchise_id: string | null }

export default function LinkEtablissementClient({
  franchiseId, allClients, variant = 'link',
}: { franchiseId: string; allClients: Client[]; variant?: 'link' | 'button' }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // Clients non rattachés à CETTE franchise (libres ou rattachés ailleurs)
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allClients
      .filter((c) => c.franchise_id !== franchiseId)
      .filter((c) => !q || c.raison_sociale.toLowerCase().includes(q))
      .slice(0, 30)
  }, [allClients, franchiseId, query])

  const link = (clientId: string) => {
    setBusy(clientId)
    startTransition(async () => {
      const r = await linkClientToFranchiseAction(clientId, franchiseId)
      setBusy(null)
      if (!r.success) alert((r as any).error || 'Erreur')
      else { setQuery(''); router.refresh() }
    })
  }

  const panel = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client à rattacher…" className="input-base pl-9 w-full text-sm" />
        </div>
        <button onClick={() => { setOpen(false); setQuery('') }} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-surface-100 border border-surface-200 rounded-lg">
        {candidates.length === 0 ? (
          <div className="px-3 py-3 text-sm text-surface-400">Aucun client disponible</div>
        ) : candidates.map((c) => (
          <button key={c.id} onClick={() => link(c.id)} disabled={busy === c.id}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-50 disabled:opacity-50">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 truncate">{c.raison_sociale}</div>
              {c.ville && <div className="text-xs text-surface-400">{c.ville}</div>}
            </div>
            {c.franchise_id && <span className="text-[10px] text-amber-600 shrink-0">déjà rattaché ailleurs</span>}
            {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin text-surface-400 shrink-0" /> : <Plus className="h-4 w-4 text-brand-500 shrink-0" />}
          </button>
        ))}
      </div>
    </>
  )

  // Variante bouton (header de page) : panneau en menu déroulant
  if (variant === 'button') {
    return (
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="btn-primary inline-flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> Rattacher un établissement
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[90vw] z-30 card p-3 shadow-lg">
            {panel}
          </div>
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
        <Plus className="h-3.5 w-3.5" /> Rattacher un établissement
      </button>
    )
  }

  return <div className="card p-3 mt-2">{panel}</div>
}

export function UnlinkButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        if (!confirm('Détacher cet établissement de la franchise ?')) return
        startTransition(async () => {
          const r = await linkClientToFranchiseAction(clientId, null)
          if (!r.success) alert((r as any).error || 'Erreur'); else router.refresh()
        })
      }}
      className="shrink-0 p-1.5 rounded-md text-surface-300 hover:text-rose-600 hover:bg-rose-50"
      title="Détacher">
      <Unlink className="h-3.5 w-3.5" />
    </button>
  )
}
