'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardCheck, Plus, Search, Star, Building2, Store, FileText, Trash2,
  X, Loader2, KeyRound, Copy, Check, ShieldAlert, Webhook, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createAuditAction, deleteAuditAction, createApiKeyAction, revokeApiKeyAction,
} from './actions'

interface Client { id: string; raison_sociale: string; franchise_id: string | null }
interface Audit {
  id: string
  date_audit: string
  type_audit: string
  note_globale: number | null
  note_sur: number
  points_forts: string | null
  points_amelioration: string | null
  bilan: string | null
  commentaires: string | null
  fichier_url: string | null
  client: { id: string; raison_sociale: string; ville: string | null } | null
  franchise: { id: string; nom_enseigne: string | null; raison_sociale: string | null } | null
  auteur: { first_name: string | null; last_name: string | null } | null
}
interface ApiKey {
  id: string; name: string; key_prefix: string; scopes: string[]
  last_used_at: string | null; request_count: number; is_active: boolean; created_at: string
}

const TYPE_META: Record<string, { label: string; bg: string; text: string }> = {
  hygiene: { label: 'Hygiène', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  conformite: { label: 'Conformité', bg: 'bg-blue-50', text: 'text-blue-700' },
  qualite: { label: 'Qualité', bg: 'bg-violet-50', text: 'text-violet-700' },
  autre: { label: 'Autre', bg: 'bg-surface-100', text: 'text-surface-600' },
}

function noteColor(note: number | null, sur: number) {
  if (note == null) return 'text-surface-400'
  const pct = (note / sur) * 100
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 60) return 'text-amber-600'
  return 'text-rose-600'
}

function franchiseName(f: Audit['franchise']) {
  if (!f) return null
  return f.nom_enseigne || f.raison_sociale
}

export default function AuditsClient({
  audits, clients, apiKeys, isAdmin, ingestUrl,
}: { audits: Audit[]; clients: Client[]; apiKeys: ApiKey[]; isAdmin: boolean; ingestUrl: string }) {
  const [tab, setTab] = useState<'audits' | 'api'>('audits')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return audits.filter((a) => {
      if (typeFilter !== 'all' && a.type_audit !== typeFilter) return false
      if (q) {
        const hay = `${a.client?.raison_sociale || ''} ${franchiseName(a.franchise) || ''} ${a.bilan || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [audits, query, typeFilter])

  // Stats
  const withNote = audits.filter((a) => a.note_globale != null)
  const avgNote20 = withNote.length
    ? withNote.reduce((s, a) => s + (Number(a.note_globale) / a.note_sur) * 20, 0) / withNote.length
    : null

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Audits</h1>
          <p className="text-surface-500 text-sm mt-1">
            Audits hygiène & conformité réalisés chez les clients.
          </p>
        </div>
        {tab === 'audits' && (
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouvel audit
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-surface-900">{audits.length}</div>
            <div className="text-xs text-surface-500">Audits réalisés</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Star className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-surface-900">
              {avgNote20 != null ? `${avgNote20.toFixed(1)}/20` : '—'}
            </div>
            <div className="text-xs text-surface-500">Note moyenne</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-surface-900">
              {new Set(audits.map((a) => a.client?.id).filter(Boolean)).size}
            </div>
            <div className="text-xs text-surface-500">Établissements audités</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex items-center gap-1 border-b border-surface-200">
          {([
            { id: 'audits' as const, label: 'Audits', icon: ClipboardCheck },
            { id: 'api' as const, label: 'API / Intégration', icon: Webhook },
          ]).map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-all',
                  active ? 'text-surface-900 border-surface-900' : 'text-surface-500 border-transparent hover:text-surface-700')}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            )
          })}
        </div>
      )}

      {tab === 'audits' ? (
        <>
          {/* Filters */}
          <div className="card p-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Établissement, franchise, bilan…" className="input-base pl-9 w-full text-sm" />
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-base text-sm">
              <option value="all">Tous types</option>
              <option value="hygiene">Hygiène</option>
              <option value="conformite">Conformité</option>
              <option value="qualite">Qualité</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
              <ClipboardCheck className="h-6 w-6 text-surface-400 mb-3" />
              <p className="text-sm text-surface-500">Aucun audit</p>
              <p className="text-xs text-surface-400 mt-1">Ajoutez un audit manuellement ou via l'API depuis votre outil terrain.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((a) => <AuditCard key={a.id} audit={a} />)}
            </div>
          )}
        </>
      ) : (
        <ApiSection apiKeys={apiKeys} ingestUrl={ingestUrl} />
      )}

      {showCreate && (
        <CreateAuditModal clients={clients} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}

function AuditCard({ audit }: { audit: Audit }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const meta = TYPE_META[audit.type_audit] || TYPE_META.autre
  const fname = franchiseName(audit.franchise)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Note circle */}
        <div className="shrink-0 h-12 w-12 rounded-xl bg-surface-50 flex flex-col items-center justify-center">
          <span className={cn('text-base font-heading font-bold leading-none', noteColor(audit.note_globale, audit.note_sur))}>
            {audit.note_globale != null ? audit.note_globale : '—'}
          </span>
          <span className="text-[9px] text-surface-400 mt-0.5">/{audit.note_sur}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', meta.bg, meta.text)}>
              {meta.label}
            </span>
            <Link href={audit.client ? `/dashboard/clients/${audit.client.id}` : '#'}
              className="text-sm font-medium text-surface-900 truncate hover:text-brand-600">
              {audit.client?.raison_sociale || 'Établissement'}
            </Link>
          </div>
          <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{new Date(audit.date_audit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {fname && <span className="inline-flex items-center gap-1"><Store className="h-3 w-3" />{fname}</span>}
            {audit.auteur && <span>· {[audit.auteur.first_name, audit.auteur.last_name].filter(Boolean).join(' ')}</span>}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {audit.fichier_url && (
            <a href={audit.fichier_url} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-surface-50" title="Rapport PDF">
              <FileText className="h-4 w-4" />
            </a>
          )}
          {(audit.bilan || audit.points_forts || audit.points_amelioration || audit.commentaires) && (
            <button onClick={() => setExpanded((v) => !v)} className="p-2 rounded-lg text-surface-400 hover:bg-surface-50">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Supprimer cet audit ?')) {
                startTransition(async () => {
                  const r = await deleteAuditAction(audit.id)
                  if (!r.success) alert(r.error || 'Erreur'); else router.refresh()
                })
              }
            }}
            className="p-2 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {audit.points_forts && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Points forts</div>
              <p className="text-surface-700 whitespace-pre-wrap">{audit.points_forts}</p>
            </div>
          )}
          {audit.points_amelioration && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-1">À améliorer</div>
              <p className="text-surface-700 whitespace-pre-wrap">{audit.points_amelioration}</p>
            </div>
          )}
          {audit.bilan && (
            <div className="sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1">Bilan</div>
              <p className="text-surface-700 whitespace-pre-wrap">{audit.bilan}</p>
            </div>
          )}
          {audit.commentaires && (
            <div className="sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1">Commentaires</div>
              <p className="text-surface-600 whitespace-pre-wrap">{audit.commentaires}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// API SECTION
// ════════════════════════════════════════════════════════════
function ApiSection({ apiKeys, ingestUrl }: { apiKeys: ApiKey[]; ingestUrl: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('Outil audit hygiène')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = () => {
    startTransition(async () => {
      const r = await createApiKeyAction(newName)
      if (r.success && r.data) {
        setGeneratedKey(r.data.key)
        setCreating(false)
        router.refresh()
      } else alert((r as any).error || 'Erreur')
    })
  }

  const curlExample = `curl -X POST "${ingestUrl}" \\
  -H "Authorization: Bearer ll_audit_VOTRE_CLE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "siret": "12345678900012",
    "date_audit": "2026-05-18",
    "type_audit": "hygiene",
    "note_globale": 17.5,
    "note_sur": 20,
    "points_forts": "Traçabilité OK, chaîne du froid respectée",
    "points_amelioration": "Étiquetage DLC à renforcer",
    "bilan": "Établissement conforme dans l'\\''ensemble",
    "fichier_url": "https://votre-outil.fr/rapports/123.pdf"
  }'`

  return (
    <div className="space-y-5">
      {/* Doc d'intégration */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Webhook className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-heading font-semibold text-surface-900">Connecter votre outil d'audit</h3>
        </div>
        <p className="text-sm text-surface-600 mb-3">
          Votre outil terrain envoie chaque audit via une requête HTTP. Le CRM retrouve automatiquement
          l'établissement (par SIRET) et sa franchise, puis enregistre l'audit.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-bold bg-surface-900 text-white px-1.5 py-0.5 rounded shrink-0 mt-0.5">POST</span>
            <code className="text-xs bg-surface-50 px-2 py-1 rounded text-surface-700 break-all flex-1">{ingestUrl}</code>
          </div>
          <pre className="text-[11px] bg-surface-900 text-surface-100 rounded-xl p-3 overflow-x-auto leading-relaxed">{curlExample}</pre>
          <div className="text-xs text-surface-500 space-y-1 pt-1">
            <div><span className="font-semibold text-surface-700">Identification établissement :</span> <code>siret</code> (recommandé), ou <code>client_id</code>, ou <code>etablissement_nom</code></div>
            <div><span className="font-semibold text-surface-700">Champs :</span> date_audit, type_audit (hygiene/conformite/qualite), note_globale, note_sur, points_forts, points_amelioration, bilan, commentaires, fichier_url, formateur_email</div>
          </div>
        </div>
      </div>

      {/* Clé générée (affichée une fois) */}
      {generatedKey && (
        <div className="card p-4 border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-800">Clé créée — copiez-la maintenant (non ré-affichable)</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-emerald-200 rounded-lg px-3 py-2 font-mono break-all">{generatedKey}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(generatedKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
          <button onClick={() => setGeneratedKey(null)} className="text-xs text-emerald-700 hover:underline mt-2">J'ai copié la clé</button>
        </div>
      )}

      {/* Liste des clés */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-surface-400" />
            <span className="text-sm font-semibold text-surface-900">Clés API</span>
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)} className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Générer une clé
            </button>
          )}
        </div>

        {creating && (
          <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 flex items-center gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de la clé"
              className="input-base text-sm flex-1" />
            <button onClick={handleCreate} className="btn-primary px-3 py-2 text-sm">Générer</button>
            <button onClick={() => setCreating(false)} className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-600">Annuler</button>
          </div>
        )}

        {apiKeys.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-surface-400">Aucune clé API. Générez-en une pour connecter votre outil.</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {apiKeys.map((k) => (
              <div key={k.id} className={cn('flex items-center gap-3 px-4 py-3', !k.is_active && 'opacity-50')}>
                <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                  <KeyRound className="h-4 w-4 text-surface-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900">{k.name}</div>
                  <div className="text-xs text-surface-400 font-mono">{k.key_prefix}••••••••</div>
                </div>
                <div className="text-xs text-surface-500 text-right shrink-0">
                  <div>{k.request_count} requête{k.request_count > 1 ? 's' : ''}</div>
                  {k.last_used_at && <div className="text-[10px]">Utilisée {new Date(k.last_used_at).toLocaleDateString('fr-FR')}</div>}
                </div>
                {k.is_active ? (
                  <button
                    onClick={() => {
                      if (confirm('Révoquer cette clé ? Votre outil ne pourra plus envoyer de données.')) {
                        startTransition(async () => {
                          const r = await revokeApiKeyAction(k.id)
                          if (!r.success) alert(r.error || 'Erreur'); else router.refresh()
                        })
                      }
                    }}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 shrink-0">
                    Révoquer
                  </button>
                ) : (
                  <span className="text-xs text-surface-400 shrink-0">Révoquée</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// CREATE AUDIT MODAL
// ════════════════════════════════════════════════════════════
function CreateAuditModal({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState('')

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients.slice(0, 50)
    return clients.filter((c) => c.raison_sociale.toLowerCase().includes(q)).slice(0, 50)
  }, [clients, clientSearch])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!clientId) { setError('Sélectionnez un établissement'); return }
    const fd = new FormData(e.currentTarget)
    fd.set('client_id', clientId)
    setError(null)
    startTransition(async () => {
      const r = await createAuditAction(fd)
      if (r.success) { router.refresh(); onClose() }
      else setError((r as any).error || 'Erreur')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-modal max-h-[95vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between shrink-0">
          <div className="text-base font-heading font-semibold text-surface-900">Nouvel audit</div>
          <button onClick={onClose} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-4">
            {/* Établissement */}
            <div>
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Établissement *</label>
              <input value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientId('') }}
                placeholder="Rechercher…" className="input-base w-full mt-1 text-sm" />
              {clientSearch && !clientId && (
                <div className="mt-1 max-h-40 overflow-y-auto border border-surface-200 rounded-lg divide-y divide-surface-100">
                  {filteredClients.map((c) => (
                    <button key={c.id} type="button"
                      onClick={() => { setClientId(c.id); setClientSearch(c.raison_sociale) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-50">
                      {c.raison_sociale}
                    </button>
                  ))}
                  {filteredClients.length === 0 && <div className="px-3 py-2 text-sm text-surface-400">Aucun résultat</div>}
                </div>
              )}
              {clientId && <div className="text-xs text-emerald-600 mt-1 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Sélectionné</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Type</label>
                <select name="type_audit" defaultValue="hygiene" className="input-base w-full mt-1 text-sm">
                  <option value="hygiene">Hygiène</option>
                  <option value="conformite">Conformité</option>
                  <option value="qualite">Qualité</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Date</label>
                <input type="date" name="date_audit" defaultValue={new Date().toISOString().split('T')[0]} className="input-base w-full mt-1 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Note globale</label>
                <input type="number" name="note_globale" step="0.1" placeholder="17.5" className="input-base w-full mt-1 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Barème</label>
                <select name="note_sur" defaultValue="20" className="input-base w-full mt-1 text-sm">
                  <option value="20">/20</option>
                  <option value="100">/100</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Points forts</label>
              <textarea name="points_forts" rows={2} className="input-base w-full mt-1 text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">À améliorer</label>
              <textarea name="points_amelioration" rows={2} className="input-base w-full mt-1 text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Bilan</label>
              <textarea name="bilan" rows={3} className="input-base w-full mt-1 text-sm resize-none" />
            </div>

            {error && <div className="text-xs text-rose-600">{error}</div>}
          </div>

          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-end gap-2 bg-surface-50/60">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-white">Annuler</button>
            <button type="submit" disabled={isPending} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer l'audit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
