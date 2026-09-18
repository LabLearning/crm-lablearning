'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Plus, Check, Building2, Loader2, Users } from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { ApprenantForm } from '@/app/dashboard/apprenants/ApprenantForm'
import { inscrireApprenantAction } from '@/app/dashboard/apprenants/actions'
import { searchApprenantsForSessionAction, getClientApprenantsForSessionAction } from './actions'

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
  const [clientAppr, setClientAppr] = useState<Result[]>([])
  const [loadingClient, setLoadingClient] = useState(false)

  const loadClientApprenants = useCallback(async () => {
    if (!clientId) { setClientAppr([]); return }
    setLoadingClient(true)
    const r = await getClientApprenantsForSessionAction(sessionId, clientId)
    setLoadingClient(false)
    if (r.success) setClientAppr((r.data as Result[]) || [])
  }, [clientId, sessionId])

  useEffect(() => { loadClientApprenants() }, [loadClientApprenants])

  const markInscrit = (id: string) => {
    setResults((rs) => rs.map((x) => (x.id === id ? { ...x, dejaInscrit: true } : x)))
    setClientAppr((rs) => rs.map((x) => (x.id === id ? { ...x, dejaInscrit: true } : x)))
  }

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
      markInscrit(id)
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
      loadClientApprenants()
      router.refresh()
    }
  }

  const clientDispo = clientAppr.filter((a) => !a.dejaInscrit)

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="section-label">Ajouter un participant</span>
        <Button size="sm" onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}
          className="w-full sm:w-auto justify-center min-h-[40px] sm:min-h-0 text-[13px] sm:text-xs">Créer un apprenant</Button>
      </div>

      {clientId && (clientAppr.length > 0 || loadingClient) && (
        <div className="rounded-xl border border-surface-200 bg-surface-50/50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-100 text-xs font-medium text-surface-600">
            <Users className="h-3.5 w-3.5 text-surface-400" />
            Apprenants de l'entreprise
            {loadingClient && <Loader2 className="h-3.5 w-3.5 animate-spin text-surface-400 ml-1" />}
            {!loadingClient && clientDispo.length > 0 && <span className="ml-auto text-surface-400">{clientDispo.length} à inscrire</span>}
          </div>
          {!loadingClient && clientDispo.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-surface-500">Tous les apprenants de l'entreprise sont déjà inscrits.</div>
          ) : (
            <div className="divide-y divide-surface-100 max-h-64 overflow-y-auto">
              {clientAppr.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{a.prenom} {a.nom}</div>
                    {a.email && <div className="text-xs text-surface-500 truncate mt-0.5">{a.email}</div>}
                  </div>
                  {a.dejaInscrit ? (
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 shrink-0"><Check className="h-3.5 w-3.5" /> Déjà inscrit</span>
                  ) : (
                    <Button size="sm" variant="secondary" disabled={addingId === a.id} onClick={() => addExisting(a.id)}
                      className="min-h-[40px] sm:min-h-0 shrink-0"
                      icon={addingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}>
                      Ajouter
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 bg-surface-50 rounded-xl px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 border border-surface-200/60">
        <Search className="h-4 w-4 text-surface-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Rechercher un apprenant (nom, email, entreprise)"
          className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 flex-1 min-w-0 focus:outline-none"
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
                  {a.email && <span className="truncate max-w-full">{a.email}</span>}
                  {a.entreprise && <span className="inline-flex items-center gap-1 min-w-0 max-w-full"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{a.entreprise}</span></span>}
                </div>
              </div>
              {a.dejaInscrit ? (
                <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 shrink-0"><Check className="h-3.5 w-3.5" /> Déjà inscrit</span>
              ) : (
                <Button size="sm" variant="secondary" disabled={addingId === a.id} onClick={() => addExisting(a.id)}
                  className="min-h-[40px] sm:min-h-0 shrink-0"
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
