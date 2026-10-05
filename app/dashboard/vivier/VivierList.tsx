'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Search, Save, Pencil, Trash2, CheckCircle2, Users, Briefcase, FileText, Upload, Loader2 } from '@/components/ui/icons'
import { Button, Badge, Input, Select, SearchSelectField, Modal, useToast, RowMenu } from '@/components/ui'
import { formatDate, companyLabel } from '@/lib/utils'
import {
  createCandidatVivierAction, updateCandidatVivierAction, updateCandidatVivierStatutAction,
  assignCandidatToPoeiAction, deleteCandidatVivierAction, validerCandidatVivierAction,
  updateCandidatEvaluationAction, uploadCandidatCvAction, deleteCandidatCvAction,
} from './actions'

type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'purple'
const STATUTS: { value: string; label: string; variant: BadgeVariant }[] = [
  { value: 'nouveau', label: 'Nouveau', variant: 'info' },
  { value: 'qualifie', label: 'Qualifié', variant: 'purple' },
  { value: 'presente', label: 'Présenté entreprise', variant: 'warning' },
  { value: 'retenu', label: 'Retenu', variant: 'success' },
  { value: 'valide', label: 'Validé', variant: 'success' },
  { value: 'refuse', label: 'Refusé', variant: 'danger' },
  { value: 'vivier', label: 'En vivier', variant: 'default' },
]
const statutMeta = (s: string) => STATUTS.find((x) => x.value === s) || STATUTS[0]

// Pastilles d'évaluation recruteur
const EVALUATIONS: { value: string; label: string; cls: string }[] = [
  { value: 'top', label: 'Top', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'bon', label: 'Bon profil', cls: 'bg-sky-100 text-sky-700' },
  { value: 'moyen', label: 'Moyen', cls: 'bg-amber-100 text-amber-700' },
  { value: 'a_tester', label: 'À tester', cls: 'bg-violet-100 text-violet-700' },
  { value: 'a_ecarter', label: 'À écarter', cls: 'bg-surface-200 text-surface-600' },
]
const evalMeta = (e: string | null) => EVALUATIONS.find((x) => x.value === e) || null

interface Candidat {
  id: string; civilite: string | null; prenom: string; nom: string; sexe: string | null
  email: string | null; telephone: string | null; date_naissance: string | null
  lieu_naissance: string | null; numero_securite_sociale: string | null
  adresse: string | null; code_postal: string | null; ville: string | null; type_contrat: string | null
  source: string | null; disponibilite: string | null; permis: boolean | null; statut: string; notes: string | null
  evaluation: string | null; cv_url: string | null; cv_nom: string | null
  client_id: string | null; poei_id: string | null; poei_prevision_id: string | null; poste_vise: string | null; identifiant_ft: string | null
  apprenant_id: string | null
  client?: { raison_sociale: string | null; nom_commercial?: string | null; sigle?: string | null } | null
  poei?: { numero: string | null; formation?: { intitule: string | null } | null } | null
  poei_prevision?: { entreprise: string | null; date_debut_formation_prevue: string | null; client?: { raison_sociale: string | null } | null } | null
}
interface ClientLite { id: string; raison_sociale: string | null; nom_commercial?: string | null; sigle?: string | null }
interface PoeiLite { id: string; numero: string | null; formation?: { intitule: string | null } | null; client?: { raison_sociale: string | null } | null }
interface PrevisionLite { id: string; entreprise: string | null; date_debut_formation_prevue: string | null; statut?: string | null; client?: { raison_sociale: string | null } | null }

const previsionLabel = (p: PrevisionLite) =>
  `${p.entreprise || companyLabel(p.client) || 'Prévision'}${p.date_debut_formation_prevue ? ' — ' + formatDate(p.date_debut_formation_prevue, { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}`

// Valeur actuelle de rattachement d'un candidat ("poei:<id>" / "prev:<id>" / "")
const currentTarget = (c: Candidat) => c.poei_id ? `poei:${c.poei_id}` : c.poei_prevision_id ? `prev:${c.poei_prevision_id}` : ''

// Sélecteur de cible groupé : projets POEI créés + POEI à planifier (prévisions)
function TargetSelect({ value, poeis, previsions, name, disabled, onChange, className }: {
  value?: string; poeis: PoeiLite[]; previsions: PrevisionLite[]
  name?: string; disabled?: boolean; onChange?: (v: string) => void; className?: string
}) {
  const opts = (
    <>
      <option value="">Aucun projet</option>
      {poeis.length > 0 && (
        <optgroup label="Projets POEI">
          {/* On identifie un projet par son entreprise, pas par l'intitulé de
              formation qui est le même pour tous les projets POEI. */}
          {poeis.map((p) => <option key={p.id} value={`poei:${p.id}`}>{`${p.numero || 'POEI'} — ${companyLabel(p.client) || p.formation?.intitule || ''}`.trim()}</option>)}
        </optgroup>
      )}
      {previsions.length > 0 && (
        <optgroup label="À planifier">
          {previsions.map((p) => <option key={p.id} value={`prev:${p.id}`}>{previsionLabel(p)}</option>)}
        </optgroup>
      )}
    </>
  )
  if (onChange) return <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className}>{opts}</select>
  return <select name={name} defaultValue={value} className={className}>{opts}</select>
}

export function VivierList({ candidats, clients, poeis, previsions = [], embedded, cvUrls = {} }: { candidats: Candidat[]; clients: ClientLite[]; poeis: PoeiLite[]; previsions?: PrevisionLite[]; embedded?: boolean; cvUrls?: Record<string, string> }) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editCand, setEditCand] = useState<Candidat | null>(null)
  const [detailCand, setDetailCand] = useState<Candidat | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidats.filter((c) => {
      const matchQ = !q ||
        `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.client?.raison_sociale || '').toLowerCase().includes(q)
      const matchS = !statutFilter || c.statut === statutFilter
      return matchQ && matchS
    })
  }, [candidats, search, statutFilter])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of candidats) m[c.statut] = (m[c.statut] || 0) + 1
    return m
  }, [candidats])

  async function changeStatut(id: string, statut: string) {
    setBusy(id)
    const r = await updateCandidatVivierStatutAction(id, statut)
    setBusy(null)
    if (r.success) router.refresh()
    else toast('error', r.error || 'Erreur')
  }
  async function changeEvaluation(id: string, evaluation: string) {
    setBusy(id)
    const r = await updateCandidatEvaluationAction(id, evaluation || null)
    setBusy(null)
    if (r.success) router.refresh()
    else toast('error', r.error || 'Erreur')
  }
  async function changeTarget(id: string, target: string) {
    setBusy(id)
    const r = await assignCandidatToPoeiAction(id, target || null)
    setBusy(null)
    if (r.success) { toast('success', 'Rattachement mis à jour'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }
  async function valider(c: Candidat) {
    if (!c.poei_id) { toast('error', 'Rattachez d’abord le candidat à un projet POEI'); return }
    if (!confirm(`Valider ${c.prenom} ${c.nom} ? Cela crée l’apprenant et l’inscrit au projet POEI.`)) return
    setBusy(c.id)
    const r = await validerCandidatVivierAction(c.id)
    setBusy(null)
    if (r.success) { toast('success', 'Candidat validé — apprenant créé et rattaché au projet'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }
  async function remove(c: Candidat) {
    if (!confirm(`Supprimer ${c.prenom} ${c.nom} du vivier ?`)) return
    const r = await deleteCandidatVivierAction(c.id)
    if (r.success) { toast('success', 'Candidat supprimé'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${embedded ? 'mb-4' : 'mb-6'}`}>
        <div>
          {!embedded && <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Vivier de candidats</h1>}
          <p className={`text-surface-500 text-sm ${embedded ? '' : 'mt-1'}`}>{candidats.length} candidat{candidats.length > 1 ? 's' : ''} sourcé{candidats.length > 1 ? 's' : ''} · alimente les projets POEI</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<UserPlus className="h-4 w-4" />}>Nouveau candidat</Button>
      </div>

      {/* Filtres + compteurs par statut */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 text-surface-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (nom, email, entreprise)…" className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setStatutFilter('')} className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${!statutFilter ? 'bg-surface-900 text-white' : 'bg-white text-surface-500 border border-surface-200/80 hover:text-surface-700'}`}>Tous</button>
          {STATUTS.map((s) => (
            <button key={s.value} onClick={() => setStatutFilter(s.value)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${statutFilter === s.value ? 'bg-surface-900 text-white' : 'bg-white text-surface-500 border border-surface-200/80 hover:text-surface-700'}`}>
              {s.label}{counts[s.value] ? ` · ${counts[s.value]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50/60 text-left text-2xs font-semibold uppercase tracking-wider text-surface-400">
                <th className="py-2.5 pl-4 pr-3">Candidat</th>
                <th className="py-2.5 px-3">Entreprise</th>
                <th className="py-2.5 px-3">Projet POEI</th>
                <th className="py-2.5 px-3">Statut</th>
                <th className="py-2.5 px-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const valide = !!c.apprenant_id || c.statut === 'valide'
                return (
                  <tr key={c.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50/60 transition-colors">
                    <td className="py-2.5 pl-4 pr-3">
                      <button type="button" onClick={() => setDetailCand(c)} className="text-left font-medium text-surface-900 hover:text-brand-600 transition-colors">
                        {c.prenom} {c.nom}
                      </button>
                      <div className="text-xs text-surface-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {c.email && <span className="truncate">{c.email}</span>}
                        {c.telephone && <span>{c.telephone}</span>}
                        {c.source && <span className="text-surface-400">via {c.source}</span>}
                        {c.permis && <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-medium">Permis</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <select value={c.evaluation || ''} disabled={busy === c.id} onChange={(e) => changeEvaluation(c.id, e.target.value)}
                          className={`rounded-full text-[10px] font-medium px-2 py-0.5 border-0 cursor-pointer focus:outline-none ${evalMeta(c.evaluation)?.cls || 'bg-surface-100 text-surface-500'}`}>
                          <option value="">Évaluer…</option>
                          {EVALUATIONS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                        <CvButton c={c} url={c.cv_url ? cvUrls[c.cv_url] || null : null} onDone={() => router.refresh()} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-surface-700">{companyLabel(c.client) || <span className="text-surface-300">—</span>}</td>
                    <td className="py-2.5 px-3">
                      {valide ? (
                        <span className="text-xs text-surface-600">{c.poei?.numero || '—'}</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <TargetSelect
                            value={currentTarget(c)} poeis={poeis} previsions={previsions}
                            disabled={busy === c.id} onChange={(v) => changeTarget(c.id, v)}
                            className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs text-surface-600 max-w-[220px] focus:outline-none focus:border-surface-300"
                          />
                          {c.poei_prevision_id && !c.poei_id && <Badge variant="warning">à planifier</Badge>}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {valide ? (
                        <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-0.5" />Validé</Badge>
                      ) : (
                        <select value={c.statut} disabled={busy === c.id} onChange={(e) => changeStatut(c.id, e.target.value)}
                          className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs font-medium text-surface-600 focus:outline-none focus:border-surface-300">
                          {STATUTS.filter((s) => s.value !== 'valide').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <RowMenu items={[
                        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditCand(c) },
                        ...(!valide ? [{ label: 'Valider (→ apprenant)', icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, onClick: () => valider(c) }] : []),
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => remove(c), danger: true },
                      ]} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-14 px-8">
            <Users className="h-6 w-6 text-surface-400 mb-2" />
            <p className="text-sm text-surface-500">{search || statutFilter ? 'Aucun candidat ne correspond.' : 'Aucun candidat dans le vivier. Ajoutez un premier profil sourcé.'}</p>
          </div>
        )}
      </div>

      <Modal isOpen={!!detailCand} onClose={() => setDetailCand(null)} title={detailCand ? `${detailCand.prenom} ${detailCand.nom}` : ''} size="lg">
        {detailCand && (
          <CandidatDetail
            c={detailCand}
            onEdit={() => { const cc = detailCand; setDetailCand(null); setEditCand(cc) }}
            onValider={!detailCand.apprenant_id && detailCand.statut !== 'valide' ? () => { const cc = detailCand; setDetailCand(null); valider(cc) } : undefined}
          />
        )}
      </Modal>
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau candidat (vivier)" size="lg">
        <CandidatForm clients={clients} poeis={poeis} previsions={previsions} onDone={() => { setCreateOpen(false); toast('success', 'Candidat ajouté au vivier'); router.refresh() }} />
      </Modal>
      <Modal isOpen={!!editCand} onClose={() => setEditCand(null)} title="Modifier le candidat" size="lg">
        {editCand && <CandidatForm candidat={editCand} clients={clients} poeis={poeis} previsions={previsions} onDone={() => { setEditCand(null); toast('success', 'Candidat mis à jour'); router.refresh() }} />}
      </Modal>
    </div>
  )
}

function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === false) return null
  return (
    <div className="flex gap-3 py-1.5 border-b border-surface-100 last:border-0">
      <div className="w-40 shrink-0 text-xs text-surface-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-surface-800 flex-1 min-w-0">{value}</div>
    </div>
  )
}

function DSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">{title}</div>
      <div>{children}</div>
    </div>
  )
}

/** Vue complète (lecture seule) d'un candidat du vivier */
function CvButton({ c, url, onDone }: { c: Candidat; url: string | null; onDone: () => void }) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true)
    const fd = new FormData(); fd.set('id', c.id); fd.set('file', file)
    const r = await uploadCandidatCvAction(fd)
    setBusy(false)
    if (r.success) { toast('success', 'CV ajouté'); onDone() } else toast('error', r.error || 'Erreur')
  }
  async function del() {
    if (!confirm('Supprimer le CV ?')) return
    setBusy(true)
    const r = await deleteCandidatCvAction(c.id); setBusy(false)
    if (r.success) { toast('success', 'CV supprimé'); onDone() } else toast('error', r.error || 'Erreur')
  }

  if (c.cv_url) return (
    <span className="inline-flex items-center gap-1.5">
      {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:underline"><FileText className="h-3 w-3" /> Voir CV</a>}
      <button type="button" onClick={del} disabled={busy} title="Supprimer le CV" className="text-surface-300 hover:text-danger-500">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </span>
  )
  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={onFile} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-surface-400 hover:text-brand-600">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Ajouter CV
      </button>
    </>
  )
}

function CandidatDetail({ c, onEdit, onValider }: { c: Candidat; onEdit: () => void; onValider?: () => void }) {
  const sm = statutMeta(c.statut)
  const adresse = [c.adresse, [c.code_postal, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const cible = c.poei?.numero
    ? `${c.poei.numero}${c.poei.formation?.intitule ? ' — ' + c.poei.formation.intitule : ''}`
    : c.poei_prevision
    ? `À planifier — ${c.poei_prevision.entreprise || companyLabel(c.poei_prevision.client) || ''}`
    : null
  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={sm.variant as any}>{sm.label}</Badge>
        {c.permis && <Badge variant="success">Permis de conduire</Badge>}
        {c.apprenant_id && <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-0.5" />Validé (apprenant créé)</Badge>}
      </div>

      <DSection title="Identité">
        <DRow label="Civilité" value={c.civilite} />
        <DRow label="Nom / Prénom" value={`${c.prenom} ${c.nom}`} />
        <DRow label="Sexe" value={c.sexe === 'H' ? 'Homme' : c.sexe === 'F' ? 'Femme' : null} />
        <DRow label="Email" value={c.email} />
        <DRow label="Téléphone" value={c.telephone} />
      </DSection>

      <DSection title="État civil">
        <DRow label="Date de naissance" value={c.date_naissance} />
        <DRow label="Lieu de naissance" value={c.lieu_naissance} />
        <DRow label="N° sécurité sociale" value={c.numero_securite_sociale} />
        <DRow label="Adresse" value={adresse} />
        <DRow label="Type de contrat" value={c.type_contrat} />
        <DRow label="Permis de conduire" value={c.permis ? 'Oui' : 'Non'} />
      </DSection>

      <DSection title="Sourcing">
        <DRow label="Source" value={c.source} />
        <DRow label="Disponibilité" value={c.disponibilite} />
        <DRow label="Poste visé" value={c.poste_vise} />
        <DRow label="Identifiant France Travail" value={c.identifiant_ft} />
      </DSection>

      <DSection title="Rattachement">
        <DRow label="Entreprise pressentie" value={companyLabel(c.client)} />
        <DRow label="POEI cible" value={cible} />
      </DSection>

      {c.notes && <DSection title="Notes"><p className="text-sm text-surface-700 whitespace-pre-line">{c.notes}</p></DSection>}

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        {onValider && <Button variant="secondary" onClick={onValider} icon={<CheckCircle2 className="h-4 w-4" />}>Valider (→ apprenant)</Button>}
        <Button onClick={onEdit} icon={<Pencil className="h-4 w-4" />}>Modifier</Button>
      </div>
    </div>
  )
}

function CandidatForm({ candidat, clients, poeis, previsions, onDone }: { candidat?: Candidat; clients: ClientLite[]; poeis: PoeiLite[]; previsions: PrevisionLite[]; onDone: () => void }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const clientOptions = [{ value: '', label: 'Aucune entreprise' }, ...clients.map((c) => ({ value: c.id, label: companyLabel(c) || c.id }))]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setIsLoading(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const r = candidat ? await updateCandidatVivierAction(candidat.id, fd) : await createCandidatVivierAction(fd)
    setIsLoading(false)
    if (r.success) onDone()
    else if (r.errors) setErrors(r.errors)
    else toast('error', r.error || 'Erreur')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-3 gap-3">
        <Select id="civilite" name="civilite" label="Civilité" options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} defaultValue={candidat?.civilite || ''} />
        <Input id="prenom" name="prenom" label="Prénom *" defaultValue={candidat?.prenom || ''} error={errors.nom?.[0]} />
        <Input id="nom" name="nom" label="Nom *" defaultValue={candidat?.nom || ''} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="email" name="email" type="email" label="Email" defaultValue={candidat?.email || ''} />
        <Input id="telephone" name="telephone" label="Téléphone" defaultValue={candidat?.telephone || ''} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select id="sexe" name="sexe" label="Sexe" options={[{ value: '', label: '—' }, { value: 'H', label: 'Homme' }, { value: 'F', label: 'Femme' }]} defaultValue={candidat?.sexe || ''} />
        <Input id="date_naissance" name="date_naissance" type="date" label="Date de naissance" copiable defaultValue={candidat?.date_naissance || ''} />
        <Input id="lieu_naissance" name="lieu_naissance" label="Lieu de naissance" defaultValue={candidat?.lieu_naissance || ''} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="numero_securite_sociale" name="numero_securite_sociale" label="N° de sécurité sociale" defaultValue={candidat?.numero_securite_sociale || ''} />
        <Input id="type_contrat" name="type_contrat" label="Type de contrat visé" placeholder="CDI, CDD, Alternance…" defaultValue={candidat?.type_contrat || ''} />
      </div>
      <Input id="adresse" name="adresse" label="Adresse" defaultValue={candidat?.adresse || ''} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="code_postal" name="code_postal" label="Code postal" defaultValue={candidat?.code_postal || ''} />
        <Input id="ville" name="ville" label="Ville" defaultValue={candidat?.ville || ''} />
      </div>

      {/* Sourcing */}
      <div className="pt-2 border-t border-surface-100 grid grid-cols-2 gap-3">
        <Input id="source" name="source" label="Source" placeholder="LinkedIn, France Travail, cooptation…" defaultValue={candidat?.source || ''} />
        <Input id="disponibilite" name="disponibilite" label="Disponibilité" placeholder="Immédiate, sous 1 mois…" defaultValue={candidat?.disponibilite || ''} />
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <Input id="poste_vise" name="poste_vise" label="Poste visé" defaultValue={candidat?.poste_vise || ''} />
        <Input id="identifiant_ft" name="identifiant_ft" label="Identifiant France Travail" defaultValue={candidat?.identifiant_ft || ''} />
      </div>
      <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
        <input type="checkbox" name="permis" value="true" defaultChecked={!!candidat?.permis}
          className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
        Titulaire du permis de conduire
      </label>

      {/* Rattachements */}
      <div className="grid grid-cols-2 gap-3">
        <SearchSelectField name="client_id" label="Entreprise pressentie" options={clientOptions.filter((o) => o.value)} defaultValue={candidat?.client_id || ''} placeholder="Rechercher une entreprise…" clearable />
        <div>
          <label htmlFor="poei_target" className="block text-sm font-medium text-surface-700 mb-1.5">POEI cible (projet ou à planifier)</label>
          <TargetSelect name="poei_target" value={candidat ? currentTarget(candidat) : ''} poeis={poeis} previsions={previsions} className="input-base w-full" />
        </div>
      </div>
      <Select id="statut" name="statut" label="Statut" options={STATUTS.filter((s) => s.value !== 'valide').map((s) => ({ value: s.value, label: s.label }))} defaultValue={candidat?.statut && candidat.statut !== 'valide' ? candidat.statut : 'nouveau'} />
      <textarea id="notes" name="notes" rows={2} className="input-base resize-none" placeholder="Notes de sourcing…" defaultValue={candidat?.notes || ''} />

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>{candidat ? 'Mettre à jour' : 'Ajouter au vivier'}</Button>
      </div>
    </form>
  )
}
