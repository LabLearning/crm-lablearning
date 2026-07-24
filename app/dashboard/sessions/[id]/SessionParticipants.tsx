'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Plus, Check, Building2, Loader2 } from 'lucide-react'
import { Button, Modal, useToast } from '@/components/ui'
import { ApprenantForm } from '@/app/dashboard/apprenants/ApprenantForm'
import { inscrireApprenantAction } from '@/app/dashboard/apprenants/actions'
import { searchApprenantsForSessionAction } from './actions'

interface Result {
  id: string
  prenom: string
  nom: string
  email: string | null
  entreprise: string | null
  dejaInscrit: boolean
}

/**
 * Ajout de participants directement depuis la session : recherche d'un
 * apprenant existant (nom / prénom / email / entreprise) ou création complète,
 * sans passer par l'édition de toute la session.
 */
export function SessionParticipants({
  sessionId, clientId, clients,
}: {
  sessionId: string
  clientId: string | null
  clients: { id: string; raison_sociale: string | null }[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  async function runSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const r = await searchApprenantsForSessionAction(sessionId, q)
    setSearching(false)
    if (r.success) setResults((r.data as Result[]) || [])
  }

  async function addExisting(id: string) {
    setAddingId(id)
    const r = await inscrireApprenantAction(id, sessionId)
    setAddingId(null)
    if (r.success) {
      toast('success', 'Apprenant inscrit à la session')
      setResults((rs) => rs.map((x) => (x.id === id ? { ...x, dejaInscrit: true } : x)))
      router.refresh()
    } else {
      toast('error', r.error || 'Erreur')
    }
  }

  async function onCreated(created?: any) {
    setCreateOpen(false)
    if (created?.id) {
      const r = await inscrireApprenantAction(created.id, sessionId)
      if (r.success) toast('success', 'Apprenant créé et inscrit')
      else toast('error', r.error || 'Apprenant créé mais non inscrit')
      router.refresh()
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="section-label">Ajouter un participant</span>
        <Button size="sm" onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Créer un apprenant</Button>
      </div>

      <div className="flex items-center gap-2 bg-surface-50 rounded-xl px-3 py-2 border border-surface-200/60">
        <Search className="h-4 w-4 text-surface-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom, email ou entreprise…"
          className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 flex-1 focus:outline-none"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-surface-400 shrink-0" />}
      </div>

      {query.trim().length >= 2 && (
        <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 max-h-72 overflow-y-auto">
          {results.length === 0 && !searching && (
            <div className="px-3 py-3 text-xs text-surface-500">Aucun apprenant trouvé pour « {query} ». Utilisez « Créer un apprenant ».</div>
          )}
          {results.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">{a.prenom} {a.nom}</div>
                <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap mt-0.5">
                  {a.email && <span className="truncate">{a.email}</span>}
                  {a.entreprise && <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{a.entreprise}</span>}
                </div>
              </div>
              {a.dejaInscrit ? (
                <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 shrink-0"><Check className="h-3.5 w-3.5" /> Déjà inscrit</span>
              ) : (
                <Button size="sm" variant="secondary" disabled={addingId === a.id} onClick={() => addExisting(a.id)}
                  icon={addingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}>
                  Ajouter
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvel apprenant" size="lg">
        <ApprenantForm clients={clients} defaultClientId={clientId || undefined} onDone={onCreated} />
      </Modal>
    </div>
  )
}
