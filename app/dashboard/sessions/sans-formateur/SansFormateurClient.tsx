'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserPlus, CheckCircle2, Loader2, Search, Briefcase, ArrowRight } from '@/components/ui/icons'
import { useToast, BackLink } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { assignerFormateurAction } from './actions'

interface Ligne {
  id: string
  reference: string | null
  status: string
  date_debut: string | null
  client: string | null
  formation: string | null
  inscrits: number
}

/** Affectation à la volée : choisir un formateur dans la liste enregistre
 *  immédiatement — la ligne passe en vert, rien d'autre à faire. */
interface ParcoursPoei {
  id: string
  numero: string | null
  date_debut: string | null
  date_fin: string | null
  client: string | null
  formation: string | null
}

export function SansFormateurClient({ sessions, formateurs, parcoursPoei = [] }: {
  sessions: Ligne[]
  formateurs: { id: string; nom: string }[]
  /** Parcours POEI dont aucune intervention n'a de formateur. */
  parcoursPoei?: ParcoursPoei[]
}) {
  const { toast } = useToast()
  const [faits, setFaits] = useState<Record<string, string>>({})
  const [enCours, setEnCours] = useState<string | null>(null)
  const [filtre, setFiltre] = useState('')

  async function affecter(sessionId: string, formateurId: string) {
    if (!formateurId) return
    setEnCours(sessionId)
    const r = await assignerFormateurAction(sessionId, formateurId)
    setEnCours(null)
    if (r.success) {
      setFaits((x) => ({ ...x, [sessionId]: formateurId }))
      toast('success', 'Formateur affecté')
    } else toast('error', r.error || 'Erreur')
  }

  const t = filtre.trim().toLowerCase()
  const visibles = sessions.filter((s) =>
    !t || [s.reference, s.client, s.formation].join(' ').toLowerCase().includes(t))
  const restantes = sessions.length - Object.keys(faits).length

  return (
    <div className="space-y-5">
      <div>
        <BackLink fallbackHref="/dashboard/sessions" label="Sessions" />
        <div className="flex items-center justify-between gap-3 flex-wrap mt-1">
          <h1 className="text-xl font-heading font-bold text-surface-900 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-brand-500" /> Sessions sans formateur
          </h1>
          <span className="text-sm text-surface-500 tabular-nums">{restantes} à affecter</span>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)}
          placeholder="Filtrer par référence, client, formation…"
          className="input-base !pl-9" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50/60 text-left">
                {['Session', 'Début', 'Client', 'Formation', 'Insc.', 'Formateur'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {visibles.map((s) => {
                const fait = faits[s.id]
                return (
                  <tr key={s.id} className={fait ? 'bg-emerald-50/40' : undefined}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link href={`/dashboard/sessions/${s.id}`} className="font-medium text-surface-900 hover:text-brand-600">
                        {s.reference || s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-surface-500 whitespace-nowrap">
                      {s.date_debut ? formatDate(s.date_debut, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-surface-700 max-w-[220px] truncate">{s.client || '—'}</td>
                    <td className="px-4 py-2.5 text-surface-500 max-w-[280px] truncate">{s.formation || '—'}</td>
                    <td className="px-4 py-2.5 text-surface-500 tabular-nums">{s.inscrits}</td>
                    <td className="px-4 py-2.5 min-w-[220px]">
                      {fait ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          {formateurs.find((f) => f.id === fait)?.nom}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select className="input-base !py-1.5 text-sm" defaultValue=""
                            disabled={enCours === s.id}
                            onChange={(e) => affecter(s.id, e.target.value)}>
                            <option value="" disabled>Choisir un formateur…</option>
                            {formateurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                          </select>
                          {enCours === s.id && <Loader2 className="h-4 w-4 animate-spin text-surface-400 shrink-0" />}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-surface-400">Aucune session à afficher.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {parcoursPoei.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Parcours POEI sans formateur ({parcoursPoei.length})</span>
          </div>
          <p className="px-4 pt-3 text-xs text-surface-500">
            Le formateur d&apos;une POEI se choisit sur chaque intervention du parcours : ouvrez le dossier pour l&apos;affecter.
          </p>
          <div className="divide-y divide-surface-100 mt-2">
            {parcoursPoei.map((p) => (
              <Link key={p.id} href={`/dashboard/poei/${p.id}?onglet=interventions`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{p.client || p.numero || 'Parcours POEI'}</div>
                  <div className="text-xs text-surface-500 truncate">
                    {[p.numero, p.formation, p.date_debut ? `${formatDate(p.date_debut, { day: '2-digit', month: 'short' })}${p.date_fin ? ` au ${formatDate(p.date_fin, { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}` : 'dates à fixer'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 shrink-0">
                  Affecter <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
