'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Calendar, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui'
import { toggleTacheAction } from './taches-actions'

interface Tache {
  id: string
  type: string
  libelle: string
  description: string | null
  bloque_facturation: boolean
  complete: boolean
  date_completion: string | null
}

interface SessionWithTaches {
  id: string
  reference: string | null
  date_debut: string
  date_fin: string
  formation_intitule: string
  facturation_status: string | null
  taches: Tache[]
}

export function TachesFormateurSection({ sessions }: { sessions: SessionWithTaches[] }) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleToggle(tacheId: string, current: boolean) {
    setLoadingId(tacheId)
    const r = await toggleTacheAction(tacheId, !current)
    if (r.success) {
      if ((r.data as any)?.debloque) {
        toast('success', 'Toutes les tâches validées — facturation débloquée !')
      } else {
        toast('success', current ? 'Tâche retirée' : 'Tâche validée')
      }
    } else {
      toast('error', r.error || 'Erreur')
    }
    setLoadingId(null)
  }

  if (sessions.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
        Check-list de fin de session ({sessions.length})
      </div>
      {sessions.map((sess) => {
        const isOpen = expanded[sess.id]
        const bloquantes = sess.taches.filter((t) => t.bloque_facturation)
        const completedBloquantes = bloquantes.filter((t) => t.complete).length
        const totalBloquantes = bloquantes.length
        const pct = totalBloquantes > 0 ? Math.round((completedBloquantes / totalBloquantes) * 100) : 0
        const debloque = sess.facturation_status === 'debloquee' || sess.facturation_status === 'facture_emise' || sess.facturation_status === 'payee'

        return (
          <div key={sess.id} className="card overflow-hidden">
            <button
              onClick={() => setExpanded((p) => ({ ...p, [sess.id]: !isOpen }))}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-50 transition-colors text-left"
            >
              <Calendar className="h-4 w-4 text-surface-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">{sess.formation_intitule}</div>
                <div className="text-xs text-surface-500">
                  {sess.reference} · Du {new Date(sess.date_debut).toLocaleDateString('fr-FR')} au {new Date(sess.date_fin).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-xs">
                  <span className={pct === 100 ? 'text-emerald-600 font-semibold' : 'text-surface-600'}>
                    {completedBloquantes}/{totalBloquantes}
                  </span>
                </div>
                <div className="w-16 h-1.5 rounded-full bg-surface-200">
                  <div
                    className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {debloque && (
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                    Facturation OK
                  </span>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4 text-surface-400" /> : <ChevronDown className="h-4 w-4 text-surface-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-surface-100 px-4 py-3 space-y-2">
                {sess.taches.map((t) => (
                  <div key={t.id} className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${t.complete ? 'bg-emerald-50/40' : 'hover:bg-surface-50'}`}>
                    <button
                      onClick={() => handleToggle(t.id, t.complete)}
                      disabled={loadingId === t.id}
                      className="shrink-0 mt-0.5"
                    >
                      {t.complete
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        : <Circle className="h-5 w-5 text-surface-300 hover:text-surface-500" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${t.complete ? 'text-emerald-900 line-through' : 'text-surface-900'}`}>
                        {t.libelle}
                        {!t.bloque_facturation && (
                          <span className="ml-2 text-2xs text-surface-400 font-normal">(non bloquant)</span>
                        )}
                      </div>
                      {t.description && <div className="text-xs text-surface-500 mt-0.5">{t.description}</div>}
                      {t.date_completion && (
                        <div className="text-2xs text-emerald-600 mt-0.5">
                          Validée le {new Date(t.date_completion).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!debloque && completedBloquantes < totalBloquantes && (
                  <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Validez toutes les tâches bloquantes pour débloquer votre facturation.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
