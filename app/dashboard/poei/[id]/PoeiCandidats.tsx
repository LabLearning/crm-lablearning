'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Trash2, Users, FileText, GraduationCap, Pencil, Mail, Send, CheckCircle2, XCircle, Paperclip } from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { addPoeiCandidatAction, removePoeiCandidatAction, updateCandidatStatutAction, updatePoeiCandidatAction, sendAttestationsEntreeAction } from '../actions'
import { CANDIDAT_STATUT_LABELS, TYPE_CONTRAT_LABELS } from '@/lib/types/poei'
import type { PoeiCandidat } from '@/lib/types/poei'

interface Props {
  poeiId: string
  candidats: PoeiCandidat[]
  apprenants: { id: string; nom: string | null; prenom: string | null }[]
  emailStatus?: Record<string, { status: string; date: string | null }>
}

const contratOptions = [{ value: '', label: '—' }, ...Object.entries(TYPE_CONTRAT_LABELS).map(([v, l]) => ({ value: v, label: l as string }))]
const statutOptions = Object.entries(CANDIDAT_STATUT_LABELS).map(([v, l]) => ({ value: v, label: l }))

// Bouton/lien d'action avec tooltip visible au survol
function IconAction({ label, onClick, href, disabled, className, children }: {
  label: string; onClick?: () => void; href?: string; disabled?: boolean; className?: string; children: React.ReactNode
}) {
  // flex : force la même boîte pour <a> (inline par défaut) et <button>, sinon le
  // tooltip centré sur le conteneur est décalé sur les icônes-liens
  const base = `flex items-center justify-center p-1.5 rounded-lg text-surface-400 transition-colors shrink-0 disabled:opacity-50 ${className || 'hover:bg-surface-100 hover:text-surface-700'}`
  return (
    <div className="relative group/tip shrink-0">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={base}>{children}</a>
      ) : (
        <button onClick={onClick} disabled={disabled} className={base}>{children}</button>
      )}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tip:block whitespace-nowrap rounded-lg bg-surface-900 text-white text-[10px] font-medium px-2 py-1 z-30 shadow-elevated">
        {label}
      </span>
    </div>
  )
}

function fmtDateTime(d: string | null): string {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export function PoeiCandidats({ poeiId, candidats, apprenants, emailStatus = {} }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [editCand, setEditCand] = useState<PoeiCandidat | null>(null)
  // Aperçu email avant envoi
  const [previewTargets, setPreviewTargets] = useState<PoeiCandidat[] | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const apprenantOptions = [{ value: '', label: 'Sélectionner…' }, ...apprenants.map((a) => ({ value: a.id, label: `${a.prenom || ''} ${a.nom || ''}`.trim() || a.id }))]

  function statusFor(c: PoeiCandidat): { status: string; date: string | null } | null {
    const email = (c.apprenant?.email || '').toLowerCase()
    return email ? (emailStatus[email] || null) : null
  }

  function openPreview(targets: PoeiCandidat[]) {
    setPreviewTargets(targets)
    setSubject("Votre attestation d'entrée en formation")
    setMessage("Vous trouverez ci-joint votre attestation d'entrée en formation, à transmettre à France Travail si nécessaire.")
  }

  async function confirmSend() {
    if (!previewTargets) return
    const withEmail = previewTargets.filter((c) => c.apprenant?.email)
    if (withEmail.length === 0) { toast('error', 'Aucun destinataire avec email'); return }
    setSending(true)
    const r = await sendAttestationsEntreeAction(poeiId, withEmail.map((c) => c.id), { subject, message })
    if (!r.success) toast('error', r.error || 'Erreur')
    else {
      const { sent, skipped } = (r.data || {}) as { sent: number; skipped: string[] }
      if (sent > 0) toast('success', `${sent} attestation${sent > 1 ? 's' : ''} envoyée${sent > 1 ? 's' : ''}`)
      if (skipped?.length) toast('error', `Échec : ${skipped.join(', ')}`)
      setPreviewTargets(null)
      router.refresh()
    }
    setSending(false)
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    if (mode === 'new') fd.delete('apprenant_id')
    const result = await addPoeiCandidatAction(poeiId, fd)
    if (result.success) { toast('success', 'Candidat ajouté'); setOpen(false); router.refresh() }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setSaving(false)
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editCand) return
    setSaving(true)
    const result = await updatePoeiCandidatAction(editCand.id, poeiId, new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Candidat mis à jour'); setEditCand(null); router.refresh() }
    else toast('error', result.error || 'Erreur')
    setSaving(false)
  }

  async function handleStatut(id: string, statut: string) {
    const r = await updateCandidatStatutAction(id, poeiId, statut)
    if (r.success) router.refresh(); else toast('error', r.error || 'Erreur')
  }

  async function handleRemove(id: string) {
    if (!confirm('Retirer ce candidat du projet ? (la fiche apprenant est conservée)')) return
    const r = await removePoeiCandidatAction(id, poeiId)
    if (r.success) { toast('success', 'Candidat retiré'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  const nom = (c: PoeiCandidat) => `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || '—'

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="section-label">Candidats</span>
          <Badge variant="default" className="!bg-sky-100 !text-sky-700 !border-transparent">{candidats.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {candidats.length > 0 && (
            <Button onClick={() => openPreview(candidats)} size="sm" variant="secondary" icon={<Send className="h-4 w-4" />}>
              Envoyer attestations d&apos;entrée à tous
            </Button>
          )}
          <Button onClick={() => { setErrors({}); setMode('new'); setOpen(true) }} size="sm" icon={<UserPlus className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">Ajouter</Button>
        </div>
      </div>

      {candidats.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-500">
          <Users className="h-7 w-7 text-surface-300 mx-auto mb-2" />
          Aucun candidat inscrit
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {candidats.map((c) => {
            const st = statusFor(c)
            return (
              <div key={c.id} className="flex items-center gap-2.5 py-2.5">
                <button onClick={() => setEditCand(c)} className="flex-1 min-w-0 text-left group">
                  <div className="text-sm font-medium text-surface-900 truncate group-hover:text-sky-700 transition-colors">{nom(c)}</div>
                  <div className="text-xs text-surface-500 truncate">
                    {[c.apprenant?.email, c.poste_vise, c.type_contrat ? TYPE_CONTRAT_LABELS[c.type_contrat] : null, c.identifiant_ft ? `FT ${c.identifiant_ft}` : null, (c as any).numero_convention ? `Conv. ${(c as any).numero_convention}` : null].filter(Boolean).join(' · ') || '—'}
                  </div>
                </button>

                {/* Statut d'envoi de l'attestation */}
                {st?.status === 'sent' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-2xs font-medium shrink-0" title={`Attestation envoyée le ${fmtDateTime(st.date)}`}>
                    <CheckCircle2 className="h-3 w-3 shrink-0" /> Envoyée
                  </span>
                ) : st?.status === 'failed' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-50 text-danger-700 text-2xs font-medium shrink-0" title="Le dernier envoi a échoué">
                    <XCircle className="h-3 w-3 shrink-0" /> Échec
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-400 text-2xs font-medium shrink-0" title={c.apprenant?.email ? 'Attestation pas encore envoyée' : 'Pas d\'email renseigné'}>
                    Non envoyée
                  </span>
                )}

                <IconAction label={c.apprenant?.email ? "Envoyer l'attestation par email" : 'Pas d\'email — cliquez sur le nom pour en ajouter un'} onClick={() => c.apprenant?.email ? openPreview([c]) : toast('error', 'Ce candidat n\'a pas d\'email — modifiez sa fiche d\'abord')} className="hover:bg-emerald-50 hover:text-emerald-600">
                  <Mail className="h-4 w-4" />
                </IconAction>
                <IconAction label="Télécharger l'attestation d'entrée" href={`/api/pdf/attestation-entree/${c.apprenant_id}?poei=${poeiId}&candidat=${c.id}`} className="hover:bg-emerald-50 hover:text-emerald-600">
                  <GraduationCap className="h-4 w-4" />
                </IconAction>
                <IconAction label="Plan de développement des compétences (France Travail)" href={`/api/pdf/pdc/${c.id}`} className="hover:bg-sky-50 hover:text-sky-600">
                  <FileText className="h-4 w-4" />
                </IconAction>
                <IconAction label="Modifier les informations" onClick={() => setEditCand(c)}>
                  <Pencil className="h-4 w-4" />
                </IconAction>
                <select value={c.statut} onChange={(e) => handleStatut(c.id, e.target.value)} className="text-xs rounded-lg border border-surface-200 px-2 py-1 bg-white" title="Statut du candidat">
                  {statutOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <IconAction label="Retirer du projet" onClick={() => handleRemove(c.id)} className="hover:bg-danger-50 hover:text-danger-600">
                  <Trash2 className="h-4 w-4" />
                </IconAction>
              </div>
            )
          })}
        </div>
      )}

      {/* Aperçu de l'email avant envoi */}
      <Modal isOpen={!!previewTargets} onClose={() => setPreviewTargets(null)} title="Aperçu de l'email — attestation d'entrée" size="lg">
        {previewTargets && (
          <div className="space-y-4">
            {/* Destinataires */}
            <div>
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
                Destinataires ({previewTargets.filter((c) => c.apprenant?.email).length}/{previewTargets.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previewTargets.map((c) => c.apprenant?.email ? (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-100">
                    {nom(c)} <span className="text-emerald-500">({c.apprenant.email})</span>
                  </span>
                ) : (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-danger-50 text-danger-600 text-xs border border-danger-100" title="Sans email — ne recevra pas l'attestation">
                    <XCircle className="h-3 w-3 shrink-0" /> {nom(c)} — sans email
                  </span>
                ))}
              </div>
            </div>

            <Input label="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Message</label>
              <textarea rows={3} className="input-base resize-none w-full" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            {/* Aperçu visuel de l'email */}
            <div>
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Aperçu</div>
              <div className="rounded-xl border border-surface-200 overflow-hidden">
                <div className="bg-[#195144] text-white px-4 py-3 text-sm font-bold">Lab Learning</div>
                <div className="p-4 space-y-3 bg-white">
                  <div className="text-sm font-bold text-surface-900">Attestation d&apos;entrée en formation</div>
                  <p className="text-sm text-surface-600">
                    Bonjour <strong>{previewTargets.length === 1 ? nom(previewTargets[0]) : 'Prénom Nom'}</strong>,<br />
                    {message}
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-700">
                      attestation-entree-{previewTargets.length === 1 ? (previewTargets[0].apprenant?.nom || 'NOM') : 'NOM'}.pdf
                    </span>
                    <span className="text-2xs text-surface-400">— personnalisée pour chaque candidat</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setPreviewTargets(null)}>Annuler</Button>
              <Button onClick={confirmSend} isLoading={sending} icon={<Send className="h-4 w-4" />}>
                Envoyer {previewTargets.filter((c) => c.apprenant?.email).length > 1 ? `aux ${previewTargets.filter((c) => c.apprenant?.email).length} candidats` : ''}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ajout */}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Ajouter un candidat" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex gap-2 p-1 bg-surface-100 rounded-xl">
            {(['new', 'existing'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === m ? 'bg-white shadow-sm text-sky-700' : 'text-surface-500'}`}>
                {m === 'new' ? 'Nouveau candidat' : 'Apprenant existant'}
              </button>
            ))}
          </div>

          {mode === 'existing' ? (
            <Select id="apprenant_id" name="apprenant_id" label="Apprenant" options={apprenantOptions} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input id="prenom" name="prenom" label="Prénom" />
                <Input id="nom" name="nom" label="Nom *" error={errors.nom?.[0]} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input id="email" name="email" type="email" label="Email" />
                <Input id="telephone" name="telephone" label="Téléphone" />
              </div>
            </>
          )}

          <div className="border-t border-surface-100 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input id="identifiant_ft" name="identifiant_ft" label="Identifiant France Travail" />
              <Input id="poste_vise" name="poste_vise" label="Poste visé" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select id="type_contrat" name="type_contrat" label="Type de contrat" options={contratOptions} />
              <Input id="date_embauche_prevue" name="date_embauche_prevue" type="date" label="Embauche prévue" />
            </div>
            <Input id="numero_convention" name="numero_convention" label="N° de convention" placeholder="Ex. CONV-2026-001 ou n° France Travail" />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={saving} icon={<UserPlus className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">Ajouter</Button>
          </div>
        </form>
      </Modal>

      {/* Édition */}
      <Modal isOpen={!!editCand} onClose={() => setEditCand(null)} title="Modifier le candidat" size="md">
        {editCand && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input id="e_prenom" name="prenom" label="Prénom" defaultValue={editCand.apprenant?.prenom || ''} />
              <Input id="e_nom" name="nom" label="Nom *" defaultValue={editCand.apprenant?.nom || ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input id="e_email" name="email" type="email" label="Email" defaultValue={editCand.apprenant?.email || ''} />
              <Input id="e_telephone" name="telephone" label="Téléphone" defaultValue={editCand.apprenant?.telephone || ''} />
            </div>
            <Input id="e_date_naissance" name="date_naissance" type="date" label="Date de naissance" defaultValue={(editCand.apprenant as any)?.date_naissance || ''} />
            <div className="border-t border-surface-100 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input id="e_identifiant_ft" name="identifiant_ft" label="Identifiant France Travail" defaultValue={editCand.identifiant_ft || ''} />
                <Input id="e_poste_vise" name="poste_vise" label="Poste visé" defaultValue={editCand.poste_vise || ''} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select id="e_type_contrat" name="type_contrat" label="Type de contrat" options={contratOptions} defaultValue={editCand.type_contrat || ''} />
                <Input id="e_date_embauche_prevue" name="date_embauche_prevue" type="date" label="Embauche prévue" defaultValue={editCand.date_embauche_prevue || ''} />
              </div>
              <Input id="e_numero_convention" name="numero_convention" label="N° de convention" defaultValue={(editCand as any).numero_convention || ''} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="secondary" onClick={() => setEditCand(null)}>Annuler</Button>
              <Button type="submit" isLoading={saving} icon={<Pencil className="h-4 w-4" />}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
