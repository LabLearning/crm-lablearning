'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, Save, Camera, Loader2,
  Presentation, Star, Award, Clock, Calendar, Euro,
  CheckCircle2, XCircle, ShieldCheck, AlertTriangle, MapPin, KeyRound,
  ArrowUp, ArrowDown, ChevronsUpDown,
} from '@/components/ui/icons'
import { Button, Badge, Input, Select, Modal, Avatar, useToast, RowMenu } from '@/components/ui'
import {
  createFormateurAction, updateFormateurAction, deleteFormateurAction,
  toggleFormateurAction, updateHabilitationAction, sendFormateurAccessAction, sendAuditAccessAction,
} from './actions'
import { formatDate } from '@/lib/utils'
import { FACTURE_MODELES } from '@/lib/pdf/facture-modeles'
import type { Formateur } from '@/lib/types/formation'

interface FormateursListProps {
  formateurs: Formateur[]
  sessionCounts: Record<string, number>
}

const contratLabels: Record<string, string> = {
  salarie: 'Salarié',
  prestataire: 'Prestataire',
  benevole: 'Bénévole',
}

const contratOptions = Object.entries(contratLabels).map(([v, l]) => ({ value: v, label: l }))

// Mots-clés qui suggèrent l'accès à l'outil Audit Hygiène & DUERP
const AUDIT_KEYWORDS = /hygi|haccp|duerp|pr[ée]vention|s[ée]curit|pms|risqu/i

function FormateurForm({ formateur, onDone }: { formateur?: Formateur; onDone: () => void }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [auditAccess, setAuditAccess] = useState(
    AUDIT_KEYWORDS.test((formateur?.domaines_expertise || []).join(' '))
  )
  const [photoUrl, setPhotoUrl] = useState<string | null>((formateur as any)?.photo_url || null)
  const [uploading, setUploading] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/formateurs/upload-photo', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (res.ok) setPhotoUrl(json.url)
    else toast('error', json.error || "Échec de l'envoi")
    setUploading(false)
    if (photoRef.current) photoRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = formateur ? await updateFormateurAction(formateur.id, fd) : await createFormateurAction(fd)
    if (result.success) {
      toast('success', formateur ? 'Formateur mis à jour' : 'Formateur créé')
      if (result.warning) toast('warning', result.warning)
      onDone()
    }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <input type="hidden" name="photo_url" value={photoUrl || ''} />
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar firstName={formateur?.prenom || ''} lastName={formateur?.nom || ''} src={photoUrl} size="xl" className="!h-16 !w-16" />
          <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm ring-2 ring-white hover:bg-brand-600 disabled:opacity-60">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          </button>
        </div>
        <div className="text-sm">
          <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading}
            className="font-medium text-brand-600 hover:text-brand-700">Importer une photo</button>
          {photoUrl && <button type="button" onClick={() => setPhotoUrl(null)} className="block text-xs text-surface-400 hover:text-danger-600 mt-0.5">Retirer</button>}
          <p className="text-xs text-surface-400 mt-0.5">PNG, JPG — 5 Mo max</p>
        </div>
      </div>
      <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhoto} />

      <div className="grid grid-cols-3 gap-3">
        <Select id="civilite" name="civilite" label="Civilité" options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} defaultValue={formateur?.civilite || ''} />
        <Input id="prenom" name="prenom" label="Prénom *" defaultValue={formateur?.prenom || ''} error={errors.prenom?.[0]} />
        <Input id="nom" name="nom" label="Nom *" defaultValue={formateur?.nom || ''} error={errors.nom?.[0]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="email" name="email" type="email" label="Email" defaultValue={formateur?.email || ''} error={errors.email?.[0]} />
        <Input id="telephone" name="telephone" label="Téléphone" defaultValue={formateur?.telephone || ''} />
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <Input id="whatsapp" name="whatsapp" label="WhatsApp" placeholder="06 12 34 56 78" defaultValue={(formateur as any)?.whatsapp || ''} />
        <label className="flex items-center gap-2 text-sm text-surface-700 pb-2.5 cursor-pointer">
          <input type="checkbox" name="whatsapp_opt_in" value="true" defaultChecked={(formateur as any)?.whatsapp_opt_in || false}
            className="h-4 w-4 rounded border-surface-300 text-emerald-600 focus:ring-emerald-500" />
          Reçoit les liens de signature par WhatsApp
        </label>
      </div>

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Qualifications (Qualiopi C5)</div>
      <textarea id="qualifications" name="qualifications" rows={3} className="input-base resize-none" placeholder="Diplômes, formations, expériences..." defaultValue={formateur?.qualifications || ''} />
      <Input id="domaines_expertise" name="domaines_expertise" label="Domaines d'expertise" placeholder="Management, Bureautique, Sécurité (séparés par des virgules)" defaultValue={formateur?.domaines_expertise?.join(', ') || ''}
        onChange={(e) => { if (AUDIT_KEYWORDS.test(e.target.value)) setAuditAccess(true) }} />

      {/* Onboarding : uniquement à la création */}
      {!formateur && (
        <div className="rounded-xl bg-sky-50/60 border border-sky-100 px-4 py-3 space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
            <input type="checkbox" name="audit_tool_access" value="true" checked={auditAccess} onChange={(e) => setAuditAccess(e.target.checked)}
              className="h-4 w-4 rounded border-surface-300 text-sky-600 focus:ring-sky-500" />
            Donner accès à l&apos;outil <strong>Audit Hygiène &amp; DUERP</strong>
          </label>
          <p className="text-2xs text-surface-500 pl-6">
            Coché automatiquement si les domaines contiennent hygiène, HACCP, DUERP, prévention ou sécurité.
            Le formateur recevra un email de bienvenue unique : création de compte CRM{auditAccess ? ' + activation de l\'outil d\'audit' : ''}.
          </p>
        </div>
      )}
      <Input id="certifications" name="certifications" label="Certifications" placeholder="PMP, ITIL, PSM (séparés par des virgules)" defaultValue={formateur?.certifications?.join(', ') || ''} />

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Contrat</div>
      <div className="grid grid-cols-2 gap-3">
        <Select id="type_contrat" name="type_contrat" label="Type de contrat" options={contratOptions} defaultValue={formateur?.type_contrat || 'prestataire'} />
        <Input id="siret" name="siret" label="SIRET (si prestataire)" defaultValue={formateur?.siret || ''} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="tarif_journalier" name="tarif_journalier" type="number" label="Tarif journalier (€)" defaultValue={formateur?.tarif_journalier?.toString() || ''} />
        <Input id="tarif_horaire" name="tarif_horaire" type="number" label="Tarif horaire (€)" defaultValue={formateur?.tarif_horaire?.toString() || ''} />
      </div>
      <div>
        <Select id="taux_tva" name="taux_tva" label="TVA facturée"
          options={[{ value: '0', label: '0 % (non assujetti ou exonéré)' }, { value: '20', label: '20 %' }]}
          defaultValue={String((formateur as any)?.taux_tva ?? 0)} />
        <p className="text-2xs text-surface-400 mt-1">
          Sert au calcul de la marge des sessions : l&apos;organisme ne récupère pas la TVA, le coût réel d&apos;un contrat HT inclut donc celle du formateur.
        </p>
      </div>
      <Input id="zone_intervention" name="zone_intervention" label="Zone d'intervention" placeholder="Île-de-France, National, Grand Est..." defaultValue={(formateur as any)?.zone_intervention || ''} />

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Facturation</div>
      <div>
        <Select id="facture_modele" name="facture_modele" label="Modèle de facture"
          options={FACTURE_MODELES.map((m) => ({ value: m.value, label: `${m.label} — ${m.description}` }))}
          defaultValue={(formateur as any)?.facture_modele || 'epure'} />
        <p className="text-2xs text-surface-400 mt-1">
          Style du PDF quand le formateur émet ses factures de prestation. La facture est à son nom (pas de branding Lab Learning).
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-2xs text-surface-400">Aperçu :</span>
          {FACTURE_MODELES.map((m) => (
            <a key={m.value} href={`/api/pdf/facture-modele-apercu?modele=${m.value}`} target="_blank" rel="noreferrer"
              className="text-2xs font-medium text-brand-600 hover:underline">{m.label}</a>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
          {formateur ? 'Mettre à jour' : 'Créer le formateur'}
        </Button>
      </div>
    </form>
  )
}

function HabilitationModal({ formateur, onDone }: { formateur: Formateur; onDone: () => void }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await updateHabilitationAction(formateur.id, fd)
    if (result.success) { toast('success', 'Habilitation mise à jour'); onDone() }
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-surface-600">
        Mise à jour des habilitations de <strong>{formateur.prenom} {formateur.nom}</strong> (Qualiopi C5, Indicateur 21)
      </p>
      <Input id="date_derniere_habilitation" name="date_derniere_habilitation" type="date" label="Date de dernière habilitation" defaultValue={formateur.date_derniere_habilitation || ''} />
      <Input id="prochaine_mise_a_jour" name="prochaine_mise_a_jour" type="date" label="Prochaine mise à jour prévue" defaultValue={formateur.prochaine_mise_a_jour || ''} />
      <textarea id="habilitation_notes" name="habilitation_notes" rows={2} className="input-base resize-none" placeholder="Notes sur la mise à jour..." />

      {/* History */}
      {(formateur as any).historique_habilitations && ((formateur as any).historique_habilitations as unknown[]).length > 0 && (
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Historique</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {((formateur as any).historique_habilitations as { date: string; notes: string }[]).reverse().map((h, i) => (
              <div key={i} className="text-xs text-surface-600 p-2 bg-surface-50 rounded-lg">
                <span className="font-medium">{h.date}</span>
                {h.notes && <span className="text-surface-400"> — {h.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>Fermer</Button>
        <Button type="submit" isLoading={isLoading} icon={<ShieldCheck className="h-4 w-4" />}>Enregistrer</Button>
      </div>
    </form>
  )
}

type SortKey = 'nom' | 'contrat' | 'sessions' | 'tarif' | 'note'

// En-tête de colonne triable (clic pour trier, flèche indiquant le sens)
function SortHeader({ label, k, sort, onSort, className = '' }: {
  label: string; k: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort.key === k
  const alignRight = className.includes('text-right')
  return (
    <th className={`py-2.5 px-3 text-2xs font-semibold uppercase tracking-wider ${active ? 'text-surface-700' : 'text-surface-400'} ${className}`}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-surface-700 transition-colors ${alignRight ? 'flex-row-reverse' : ''}`}>
        {label}
        {active ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 text-surface-300" />}
      </button>
    </th>
  )
}

export function FormateursList({ formateurs, sessionCounts }: FormateursListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editFormateur, setEditFormateur] = useState<Formateur | null>(null)
  const [habilitationFormateur, setHabilitationFormateur] = useState<Formateur | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'nom', dir: 'asc' })

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const filtered = useMemo(() => {
    if (!search) return formateurs
    const s = search.toLowerCase()
    return formateurs.filter((f) =>
      (f.prenom || '').toLowerCase().includes(s) || (f.nom || '').toLowerCase().includes(s) ||
      (f.domaines_expertise || []).some((d) => d.toLowerCase().includes(s)) ||
      (f.email || '').toLowerCase().includes(s)
    )
  }, [formateurs, search])

  const sorted = useMemo(() => {
    const mul = sort.dir === 'asc' ? 1 : -1
    const val = (f: Formateur): string | number => {
      switch (sort.key) {
        case 'sessions': return sessionCounts[f.id] || 0
        case 'tarif': return Number(f.tarif_journalier) || 0
        case 'note': return Number(f.note_moyenne) || 0
        case 'contrat': return (contratLabels[f.type_contrat] || f.type_contrat || '').toLowerCase()
        default: return `${f.nom || ''} ${f.prenom || ''}`.toLowerCase()
      }
    }
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return -1 * mul
      if (va > vb) return 1 * mul
      return 0
    })
  }, [filtered, sort, sessionCounts])

  function needsRenewal(f: Formateur): boolean {
    if (!f.prochaine_mise_a_jour) return false
    const diff = new Date(f.prochaine_mise_a_jour).getTime() - Date.now()
    return diff < 30 * 24 * 60 * 60 * 1000 // < 30 jours
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce formateur ?')) return
    const result = await deleteFormateurAction(id)
    if (result.success) toast('success', 'Formateur supprimé')
    else toast('error', result.error || 'Erreur')
  }

  async function handleToggle(id: string, current: boolean) {
    const result = await toggleFormateurAction(id, !current)
    if (result.success) toast('success', !current ? 'Formateur activé' : 'Formateur désactivé')
  }

  async function handleSendAccess(id: string, nom: string) {
    if (!confirm(`Envoyer l'accès à son espace (compte + lien portail) à ${nom} par email ?`)) return
    const result = await sendFormateurAccessAction(id)
    if (result.success) toast('success', `Accès envoyé à ${(result.data as any)?.email || nom}`)
    else toast('error', result.error || 'Erreur')
  }

  async function handleSendAudit(id: string, nom: string) {
    if (!confirm(`Envoyer le lien d'accès à l'outil d'audit à ${nom} par email ?`)) return
    const result = await sendAuditAccessAction(id)
    if (result.success) toast('success', `Accès outil d'audit envoyé à ${(result.data as any)?.email || nom}`)
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Formateurs</h1>
          <p className="text-surface-500 mt-1 text-sm">{formateurs.length} formateur{formateurs.length > 1 ? 's' : ''}</p>
        </div>
        {/* Trame de l'audit blanc (ind. 21) : pour les entretiens de recrutement à venir. */}
        <a href="/api/pdf/grille-entretien" target="_blank" rel="noreferrer"
          className="btn-secondary inline-flex items-center gap-1.5 !py-2 !px-3 text-sm">
          Grille d&apos;entretien (PDF)
        </a>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouveau formateur</Button>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 max-w-md mb-5">
        <Search className="h-4 w-4 text-surface-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, expertise..." className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50/60">
                <SortHeader label="Formateur" k="nom" sort={sort} onSort={toggleSort} className="text-left pl-4" />
                <th className="py-2.5 px-3 text-left text-2xs font-semibold uppercase tracking-wider text-surface-400">Expertise</th>
                <SortHeader label="Contrat" k="contrat" sort={sort} onSort={toggleSort} className="text-left" />
                <SortHeader label="Sessions" k="sessions" sort={sort} onSort={toggleSort} className="text-right" />
                <SortHeader label="Tarif / j" k="tarif" sort={sort} onSort={toggleSort} className="text-right" />
                <SortHeader label="Note" k="note" sort={sort} onSort={toggleSort} className="text-right" />
                <th className="py-2.5 px-3 text-left text-2xs font-semibold uppercase tracking-wider text-surface-400">État</th>
                <th className="py-2.5 px-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr key={f.id} onClick={() => router.push(`/dashboard/formateurs/${f.id}`)}
                  className={`border-b border-surface-100 last:border-0 hover:bg-surface-50/70 cursor-pointer transition-colors ${!f.is_active ? 'opacity-55' : ''}`}>
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar firstName={f.prenom} lastName={f.nom} src={(f as any).photo_url} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium text-surface-900 truncate">{f.civilite} {f.prenom} {f.nom}</div>
                        <div className="text-xs text-surface-500 flex items-center gap-2 flex-wrap">
                          {f.email && <span className="truncate">{f.email}</span>}
                          {(f as any).zone_intervention && <span className="inline-flex items-center gap-0.5 text-brand-600"><MapPin className="h-3 w-3" />{(f as any).zone_intervention}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 max-w-[220px]">
                    <div className="flex flex-wrap gap-1">
                      {(f.domaines_expertise || []).slice(0, 3).map((d) => <Badge key={d} variant="info">{d}</Badge>)}
                      {(f.domaines_expertise || []).length > 3 && <span className="text-2xs text-surface-400">+{(f.domaines_expertise || []).length - 3}</span>}
                      {(f.domaines_expertise || []).length === 0 && <span className="text-surface-300">—</span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-surface-700">{contratLabels[f.type_contrat] || f.type_contrat}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-surface-700">{sessionCounts[f.id] || 0}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {f.tarif_journalier ? <span className="text-surface-800">{Number(f.tarif_journalier).toLocaleString('fr-FR')} €</span> : <span className="text-surface-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {f.note_moyenne
                      ? <span className="inline-flex items-center gap-1 font-medium text-surface-700"><Star className="h-3 w-3 text-warning-500 fill-warning-500" />{f.note_moyenne}</span>
                      : <span className="text-surface-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {f.is_active ? <Badge variant="success">Actif</Badge> : <Badge variant="default">Inactif</Badge>}
                      {needsRenewal(f) && <span title="Habilitation à renouveler"><AlertTriangle className="h-3.5 w-3.5 text-warning-600" /></span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      width={208}
                      items={[
                        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditFormateur(f) },
                        { label: "Envoyer l'accès à son espace", icon: <KeyRound className="h-4 w-4 text-brand-600" />, onClick: () => handleSendAccess(f.id, `${f.prenom} ${f.nom}`), hidden: !f.email },
                        { label: "Envoyer l'accès à l'outil d'audit", icon: <ShieldCheck className="h-4 w-4 text-sky-600" />, onClick: () => handleSendAudit(f.id, `${f.prenom} ${f.nom}`), hidden: !f.email },
                        { label: 'Habilitations', icon: <ShieldCheck className="h-4 w-4 text-brand-600" />, onClick: () => setHabilitationFormateur(f) },
                        {
                          label: f.is_active ? 'Désactiver' : 'Activer',
                          icon: f.is_active ? <XCircle className="h-4 w-4 text-warning-600" /> : <CheckCircle2 className="h-4 w-4 text-success-600" />,
                          onClick: () => handleToggle(f.id, f.is_active),
                        },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(f.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-14 px-8">
            <Presentation className="h-6 w-6 text-surface-400 mb-2" />
            <p className="text-sm text-surface-500">Aucun formateur trouvé</p>
          </div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau formateur" size="lg">
        <FormateurForm onDone={() => setCreateOpen(false)} />
      </Modal>
      <Modal isOpen={!!editFormateur} onClose={() => setEditFormateur(null)} title="Modifier le formateur" size="lg">
        {editFormateur && <FormateurForm formateur={editFormateur} onDone={() => setEditFormateur(null)} />}
      </Modal>
      <Modal isOpen={!!habilitationFormateur} onClose={() => setHabilitationFormateur(null)} title="Gestion des habilitations">
        {habilitationFormateur && <HabilitationModal formateur={habilitationFormateur} onDone={() => setHabilitationFormateur(null)} />}
      </Modal>
    </div>
  )
}
