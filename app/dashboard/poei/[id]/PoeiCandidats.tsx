'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Trash2, Users, FileText, GraduationCap, Pencil, Mail, Send, CheckCircle2, XCircle, Paperclip, Euro, Download } from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, SearchSelect } from '@/components/ui'
import { addPoeiCandidatAction, removePoeiCandidatAction, updateCandidatStatutAction, updatePoeiCandidatAction, sendAttestationsEntreeAction, generateDevisPerCandidatAction, sendGroupEmailToCandidatsAction, getPoeiEmailTemplatesAction, savePoeiEmailTemplateAction } from '../actions'
import { CANDIDAT_STATUT_LABELS, TYPE_CONTRAT_LABELS } from '@/lib/types/poei'
import type { PoeiCandidat } from '@/lib/types/poei'

interface Props {
  poeiId: string
  candidats: PoeiCandidat[]
  apprenants: { id: string; nom: string | null; prenom: string | null; email?: string | null }[]
  emailStatus?: Record<string, { status: string; date: string | null }>
  clientNom?: string | null
  clientId?: string | null
  devisByCandidat?: Record<string, { id: string; numero: string | null }>
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

export function PoeiCandidats({ poeiId, candidats, apprenants, emailStatus = {}, clientNom, clientId, devisByCandidat = {} }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [apprenantId, setApprenantId] = useState('')
  const [genDevisOpen, setGenDevisOpen] = useState(false)
  const [genDevis, setGenDevis] = useState(false)
  // Mail groupé personnalisé
  const [mailOpen, setMailOpen] = useState(false)
  const [mailSubject, setMailSubject] = useState('')
  const [mailMessage, setMailMessage] = useState('')
  const [mailJoindre, setMailJoindre] = useState(false)
  const [mailSending, setMailSending] = useState(false)
  const [mailTargets, setMailTargets] = useState<string[]>([])
  const [mailFiles, setMailFiles] = useState<File[]>([])
  const mailFileRef = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState<{ id: string; slug: string; nom: string; sujet: string; corps_texte: string }[]>([])

  function applyTemplate(slug: string) {
    const t = templates.find((x) => x.slug === slug)
    if (!t) return
    setMailSubject(t.sujet || '')
    setMailMessage(t.corps_texte || '')
  }

  async function handleSaveTemplate() {
    const nom = prompt('Nom du modèle (il sera réutilisable sur tous les projets POEI) :')
    if (!nom?.trim()) return
    const r = await savePoeiEmailTemplateAction(nom, mailSubject, mailMessage)
    if (r.success) {
      toast('success', 'Modèle enregistré')
      const list = await getPoeiEmailTemplatesAction()
      if (list.success) setTemplates((list.data as any[]) || [])
    } else toast('error', r.error || 'Erreur')
  }

  const mailRecipients = candidats.filter((c) => mailTargets.includes(c.id))
  const mailSansEmail = mailRecipients.filter((c) => !c.apprenant?.email)

  async function openGroupMail() {
    setMailTargets(candidats.map((c) => c.id))
    setMailSubject('')
    setMailMessage('')
    setMailJoindre(false)
    setMailFiles([])
    setMailOpen(true)
    // Charge les modèles réutilisables (ex : « Déroulé du parcours POEI »)
    const list = await getPoeiEmailTemplatesAction()
    if (list.success) setTemplates((list.data as any[]) || [])
  }

  async function handleSendGroupMail() {
    const ids = mailRecipients.filter((c) => c.apprenant?.email).map((c) => c.id)
    if (ids.length === 0) { toast('error', 'Aucun destinataire avec email'); return }
    setMailSending(true)
    try {
      // Route API (et non Server Action) : les pièces jointes dépassent la limite de 1 Mo
      const fd = new FormData()
      fd.set('poeiId', poeiId)
      fd.set('candidatIds', JSON.stringify(ids))
      fd.set('subject', mailSubject)
      fd.set('message', mailMessage)
      fd.set('joindreAttestation', String(mailJoindre))
      mailFiles.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/poei/group-email', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast('error', data.error || 'Erreur'); return }
      const { sent, skipped } = data as { sent: number; skipped: string[] }
      if (sent > 0) toast('success', `${sent} email${sent > 1 ? 's' : ''} envoyé${sent > 1 ? 's' : ''}`)
      if (skipped?.length) toast('error', `Non envoyés : ${skipped.join(', ')}`)
      setMailOpen(false)
      router.refresh()
    } catch {
      toast('error', "Erreur lors de l'envoi")
    } finally {
      setMailSending(false)
    }
  }

  async function handleGenerateDevis() {
    setGenDevis(true)
    const r = await generateDevisPerCandidatAction(poeiId)
    setGenDevis(false)
    setGenDevisOpen(false)
    if (r.success) {
      const { created, skipped } = (r.data || {}) as { created: number; skipped: number }
      if (created > 0) toast('success', `${created} devis généré${created > 1 ? 's' : ''}${skipped ? ` (${skipped} déjà existant${skipped > 1 ? 's' : ''})` : ''}`)
      else toast('success', r.warning || 'Aucun nouveau devis')
      router.refresh()
    } else {
      toast('error', r.error || 'Erreur')
    }
  }
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [editCand, setEditCand] = useState<PoeiCandidat | null>(null)
  // Aperçu email avant envoi
  const [previewTargets, setPreviewTargets] = useState<PoeiCandidat[] | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)


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
    else fd.set('apprenant_id', apprenantId)
    const result = await addPoeiCandidatAction(poeiId, fd)
    if (result.success) { toast('success', 'Candidat ajouté'); setOpen(false); setApprenantId(''); router.refresh() }
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
            <>
              <Button onClick={() => setGenDevisOpen(true)} size="sm" variant="secondary" icon={<Euro className="h-4 w-4" />}>
                Générer les devis
              </Button>
              {Object.keys(devisByCandidat).length > 0 && (
                <a href={`/api/pdf/poei-devis/${poeiId}`} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm">
                  <Download className="h-4 w-4" /> Télécharger les devis (ZIP)
                </a>
              )}
              <Button onClick={openGroupMail} size="sm" variant="secondary" icon={<Mail className="h-4 w-4" />}>
                Mail groupé
              </Button>
              <Button onClick={() => openPreview(candidats)} size="sm" variant="secondary" icon={<Send className="h-4 w-4" />}>
                Envoyer attestations d&apos;entrée à tous
              </Button>
            </>
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
                {devisByCandidat[c.id] && (
                  <IconAction label={`Télécharger le devis ${devisByCandidat[c.id].numero || ''}`} href={`/api/pdf/devis/${devisByCandidat[c.id].id}`} className="hover:bg-amber-50 hover:text-amber-600">
                    <Euro className="h-4 w-4" />
                  </IconAction>
                )}
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

      {/* Mail groupé personnalisé */}
      <Modal isOpen={mailOpen} onClose={() => setMailOpen(false)} title="Mail groupé aux candidats" size="lg">
        <div className="space-y-4">
          {/* Destinataires */}
          <div>
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
              Destinataires ({mailRecipients.filter((c) => c.apprenant?.email).length})
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {candidats.map((c) => {
                const on = mailTargets.includes(c.id)
                const sansEmail = !c.apprenant?.email
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setMailTargets((t) => on ? t.filter((x) => x !== c.id) : [...t, c.id])}
                    title={sansEmail ? 'Pas d\'email renseigné' : c.apprenant?.email || ''}
                    className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                      sansEmail ? 'bg-surface-50 text-surface-300 border-surface-200 line-through'
                        : on ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-white text-surface-500 border-surface-200'
                    }`}
                  >
                    {`${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat'}
                  </button>
                )
              })}
            </div>
            {mailSansEmail.length > 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                {mailSansEmail.length} candidat{mailSansEmail.length > 1 ? 's' : ''} sans email : ils ne recevront rien.
              </p>
            )}
          </div>

          {/* Modèles réutilisables */}
          {templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2">
              <span className="text-xs font-semibold text-sky-800">Modèle :</span>
              {templates.map((t) => (
                <button key={t.slug} type="button" onClick={() => applyTemplate(t.slug)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors">
                  {t.nom}
                </button>
              ))}
            </div>
          )}

          <Input id="mail_subject" label="Objet *" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)}
            placeholder="Ex : Votre entrée en formation {formation}" />

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Message *</label>
            <textarea
              rows={7} className="input-base resize-none w-full"
              value={mailMessage}
              onChange={(e) => setMailMessage(e.target.value)}
              placeholder={'Bonjour {prenom},\n\nVotre formation {formation} démarre {dates}...'}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs text-surface-400">Variables :</span>
              {['{prenom}', '{nom}', '{formation}', '{entreprise}', '{dates}', '{lieu}', '{duree_heures}', '{date_debut}', '{date_fin}'].map((v) => (
                <button key={v} type="button"
                  onClick={() => setMailMessage((m) => m + v)}
                  className="px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 text-xs font-mono hover:bg-surface-200">
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-surface-700">
              <input type="checkbox" checked={mailJoindre} onChange={(e) => setMailJoindre(e.target.checked)}
                className="rounded border-surface-300 text-sky-600 focus:ring-sky-500" />
              <Paperclip className="h-3.5 w-3.5 text-surface-400" />
              Joindre l&apos;attestation d&apos;entrée de chaque candidat
            </label>

            {/* Pièces jointes libres (communes à tous) */}
            <div>
              <input
                ref={mailFileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const fs = Array.from(e.target.files || [])
                  setMailFiles((prev) => [...prev, ...fs])
                  if (mailFileRef.current) mailFileRef.current.value = ''
                }}
              />
              <button type="button" onClick={() => mailFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700">
                <Paperclip className="h-3.5 w-3.5" /> Ajouter une pièce jointe
              </button>
              {mailFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {mailFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-surface-600 bg-surface-50 rounded-lg px-2.5 py-1.5">
                      <Paperclip className="h-3 w-3 text-surface-400 shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-surface-400 shrink-0">{(f.size / 1024).toFixed(0)} Ko</span>
                      <button type="button" onClick={() => setMailFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-surface-400 hover:text-danger-600 shrink-0">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="text-2xs text-surface-400">Ces fichiers sont envoyés à tous les destinataires (20 Mo max au total).</p>
                </div>
              )}
            </div>
          </div>

          {/* Aperçu personnalisé sur le 1er destinataire */}
          {mailMessage.trim() && mailRecipients[0] && (
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
                Aperçu pour {`${mailRecipients[0].apprenant?.prenom || ''} ${mailRecipients[0].apprenant?.nom || ''}`.trim()}
              </div>
              <div className="text-sm font-semibold text-surface-900 mb-1">
                {mailSubject.replace(/\{prenom\}/gi, mailRecipients[0].apprenant?.prenom || '').replace(/\{nom\}/gi, mailRecipients[0].apprenant?.nom || '')}
              </div>
              <div className="text-sm text-surface-600 whitespace-pre-wrap">
                {mailMessage
                  .replace(/\{prenom\}/gi, mailRecipients[0].apprenant?.prenom || '')
                  .replace(/\{nom\}/gi, mailRecipients[0].apprenant?.nom || '')}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={handleSaveTemplate}
              disabled={!mailSubject.trim() || !mailMessage.trim()}
              className="text-xs font-medium text-surface-500 hover:text-surface-700 disabled:opacity-40">
              Enregistrer comme modèle
            </button>
            <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMailOpen(false)}>Annuler</Button>
            <Button onClick={handleSendGroupMail} isLoading={mailSending}
              disabled={!mailSubject.trim() || !mailMessage.trim()}
              icon={<Send className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">
              Envoyer à {mailRecipients.filter((c) => c.apprenant?.email).length} candidat{mailRecipients.filter((c) => c.apprenant?.email).length > 1 ? 's' : ''}
            </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation génération des devis */}
      <Modal isOpen={genDevisOpen} onClose={() => setGenDevisOpen(false)} title="Générer les devis" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Euro className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-sm text-surface-700">
              Un devis va être créé pour <strong>chacun des {candidats.length} candidat{candidats.length > 1 ? 's' : ''}</strong> du projet
              (formation × taux horaire × durée, exonéré de TVA).
              <div className="text-xs text-surface-500 mt-1">Les candidats déjà couverts par un devis sont ignorés. Les devis sont émis directement (statut « envoyé ») pour le dossier France Travail.</div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setGenDevisOpen(false)}>Annuler</Button>
            <Button onClick={handleGenerateDevis} isLoading={genDevis} icon={<Euro className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">
              Générer {candidats.length} devis
            </Button>
          </div>
        </div>
      </Modal>

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
            <div>
              <SearchSelect
                id="apprenant_id"
                label={clientNom ? `Apprenant de ${clientNom}` : 'Apprenant'}
                options={apprenants.map((a) => ({
                  value: a.id,
                  label: `${a.prenom || ''} ${a.nom || ''}`.trim() || a.id,
                  ...(a.email ? { preview: { title: `${a.prenom || ''} ${a.nom || ''}`.trim(), lines: [{ label: 'Email', value: a.email }] } } : {}),
                }))}
                value={apprenantId}
                onChange={setApprenantId}
                placeholder="Rechercher un apprenant…"
              />
              {apprenants.length === 0 && (
                <p className="mt-1.5 text-xs text-surface-500">
                  Aucun apprenant enregistré pour {clientNom || 'cet établissement'}.
                  {clientId && (
                    <> Ajoutez-les depuis la <a href={`/dashboard/clients/${clientId}`} className="text-sky-600 hover:underline">fiche entreprise</a>, ou créez un « Nouveau candidat » ci-dessus.</>
                  )}
                </p>
              )}
            </div>
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
