'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, Save, Camera, Loader2,
  Presentation, Star, Award, Clock, Calendar, Euro,
  CheckCircle2, XCircle, ShieldCheck, AlertTriangle, MapPin,
} from 'lucide-react'
import { Button, Badge, Input, Select, Modal, Avatar, useToast, RowMenu } from '@/components/ui'
import {
  createFormateurAction, updateFormateurAction, deleteFormateurAction,
  toggleFormateurAction, updateHabilitationAction,
} from './actions'
import { formatDate } from '@/lib/utils'
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
    if (result.success) { toast('success', formateur ? 'Formateur mis à jour' : 'Formateur créé'); onDone() }
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
      <Input id="zone_intervention" name="zone_intervention" label="Zone d'intervention" placeholder="Île-de-France, National, Grand Est..." defaultValue={(formateur as any)?.zone_intervention || ''} />

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

export function FormateursList({ formateurs, sessionCounts }: FormateursListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editFormateur, setEditFormateur] = useState<Formateur | null>(null)
  const [habilitationFormateur, setHabilitationFormateur] = useState<Formateur | null>(null)

  const filtered = useMemo(() => {
    if (!search) return formateurs
    const s = search.toLowerCase()
    return formateurs.filter((f) =>
      (f.prenom || '').toLowerCase().includes(s) || (f.nom || '').toLowerCase().includes(s) ||
      (f.domaines_expertise || []).some((d) => d.toLowerCase().includes(s)) ||
      (f.email || '').toLowerCase().includes(s)
    )
  }, [formateurs, search])

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Formateurs</h1>
          <p className="text-surface-500 mt-1 text-sm">{formateurs.length} formateur{formateurs.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouveau formateur</Button>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 max-w-md mb-5">
        <Search className="h-4 w-4 text-surface-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, expertise..." className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((f) => (
          <div key={f.id} onClick={() => router.push(`/dashboard/formateurs/${f.id}`)}
            className={`card p-5 hover:shadow-card hover:border-brand-200 transition-all cursor-pointer ${!f.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar firstName={f.prenom} lastName={f.nom} src={(f as any).photo_url} size="lg" />
                <div>
                  <div className="text-sm font-semibold text-surface-900">{f.civilite} {f.prenom} {f.nom}</div>
                  <div className="text-xs text-surface-500">{contratLabels[f.type_contrat] || f.type_contrat}</div>
                  {f.note_moyenne && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="h-3 w-3 text-warning-500 fill-warning-500" />
                      <span className="text-xs font-medium text-surface-700">{f.note_moyenne}/5</span>
                      <span className="text-2xs text-surface-400">({f.nombre_evaluations})</span>
                    </div>
                  )}
                  {(f as any).zone_intervention && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-2xs font-medium">
                      <MapPin className="h-3 w-3" />
                      {(f as any).zone_intervention}
                    </span>
                  )}
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <RowMenu
                  width={208}
                  items={[
                    { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditFormateur(f) },
                    { label: 'Habilitations', icon: <ShieldCheck className="h-4 w-4 text-brand-600" />, onClick: () => setHabilitationFormateur(f) },
                    {
                      label: f.is_active ? 'Désactiver' : 'Activer',
                      icon: f.is_active ? <XCircle className="h-4 w-4 text-warning-600" /> : <CheckCircle2 className="h-4 w-4 text-success-600" />,
                      onClick: () => handleToggle(f.id, f.is_active),
                    },
                    { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(f.id) },
                  ]}
                />
              </div>
            </div>

            {/* Expertise tags */}
            {(f.domaines_expertise || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {(f.domaines_expertise || []).map((d) => (
                  <Badge key={d} variant="info">{d}</Badge>
                ))}
              </div>
            )}

            {/* Certifications */}
            {(f.certifications || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {(f.certifications || []).map((c) => (
                  <Badge key={c} variant="success"><Award className="h-3 w-3 mr-0.5" />{c}</Badge>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-surface-500 pt-3 border-t border-surface-100">
              <span className="flex items-center gap-1">
                <Presentation className="h-3.5 w-3.5" />
                {sessionCounts[f.id] || 0} sessions
              </span>
              {f.tarif_journalier && (
                <span className="flex items-center gap-1">
                  <Euro className="h-3.5 w-3.5" />
                  {Number(f.tarif_journalier).toLocaleString('fr-FR')} €/j
                </span>
              )}
              {needsRenewal(f) && (
                <span className="flex items-center gap-1 text-warning-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Renouvellement
                </span>
              )}
            </div>

            {/* Habilitation status */}
            {f.date_derniere_habilitation && (
              <div className="text-2xs text-surface-400 mt-2">
                Dernière habilitation : {formatDate(f.date_derniere_habilitation, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Presentation className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">Aucun formateur trouvé</p>
        </div>
      )}

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
