'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Trash2, Users, FileText, GraduationCap, Pencil, Mail, Send, CheckCircle2, XCircle, Paperclip, Euro, Download, FileDown, CalendarClock } from '@/components/ui/icons'
import { Button, Badge, Modal, Input, Select, useToast, SearchSelect, RowMenu } from '@/components/ui'
import { addPoeiCandidatAction, removePoeiCandidatAction, updateCandidatStatutAction, updatePoeiCandidatAction, sendAttestationsEntreeAction, generateDevisPerCandidatAction, generateDevisPrevisionnelPoeiAction, sendGroupEmailToCandidatsAction, getPoeiEmailTemplatesAction, savePoeiEmailTemplateAction, declarerAbandonCandidatAction } from '../actions'
import { PoeiSection } from './PoeiSection'
import { CANDIDAT_STATUT_LABELS, TYPE_CONTRAT_LABELS } from '@/lib/types/poei'
import type { PoeiCandidat } from '@/lib/types/poei'
import { cn } from '@/lib/utils'
import { heuresDepuisInterventions } from '@/lib/poei-candidat'

/** Calendrier du projet, pour situer la période d'un candidat. */
export interface ProjetPoeiPeriode {
  date_debut: string | null
  date_fin: string | null
  duree_heures: number | null
}

/** Périodes du planning, pour déduire les heures d'une entrée décalée. */
export interface InterventionPlanning {
  date_debut: string | null
  nb_heures: number | null
  libelle?: string | null
}

interface Props {
  poeiId: string
  projet: ProjetPoeiPeriode
  interventions?: InterventionPlanning[]
  sessionTerminee?: boolean
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
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tip:block whitespace-nowrap rounded-lg bg-surface-900 text-white text-[11px] font-medium px-2 py-1 z-30 shadow-elevated">
        {label}
      </span>
    </div>
  )
}

function fmtDateTime(d: string | null): string {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export function PoeiCandidats({ poeiId, projet, interventions = [], candidats, apprenants, emailStatus = {}, clientNom, clientId, devisByCandidat = {}, sessionTerminee = false }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [apprenantId, setApprenantId] = useState('')
  const [genDevisOpen, setGenDevisOpen] = useState(false)
  const [genDevis, setGenDevis] = useState(false)
  const [genPrev, setGenPrev] = useState(false)
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

  async function handleGenerateDevisPrevisionnel() {
    setGenPrev(true)
    const r = await generateDevisPrevisionnelPoeiAction(poeiId)
    setGenPrev(false)
    if (r.success) {
      toast('success', r.warning || 'Devis prévisionnel à jour, disponible dans le module Devis')
      router.refresh()
    } else {
      toast('error', r.error || 'Erreur')
    }
  }

  async function handleGenerateDevis() {
    setGenDevis(true)
    const r = await generateDevisPerCandidatAction(poeiId)
    setGenDevis(false)
    setGenDevisOpen(false)
    if (r.success) {
      const { created, updated, skipped } = (r.data || {}) as { created: number; updated: number; skipped: number }
      const parts: string[] = []
      if (created) parts.push(`${created} généré${created > 1 ? 's' : ''}`)
      if (updated) parts.push(`${updated} mis à jour`)
      if (skipped) parts.push(`${skipped} déjà accepté${skipped > 1 ? 's' : ''}`)
      if (created || updated) toast('success', `Devis : ${parts.join(', ')}`)
      else toast('success', r.warning || 'Aucun devis modifié')
      router.refresh()
    } else {
      toast('error', r.error || 'Erreur')
    }
  }
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [editCand, setEditCand] = useState<PoeiCandidat | null>(null)
  const [abandonCand, setAbandonCand] = useState<PoeiCandidat | null>(null)
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
    // L'abandon n'est pas un simple statut : il porte date, heures et prorata
    // de facturation, il passe par sa propre modal.
    if (statut === 'abandonne') { setAbandonCand(candidats.find((x) => x.id === id) || null); return }
    const r = await updateCandidatStatutAction(id, poeiId, statut)
    if (r.success) router.refresh(); else toast('error', r.error || 'Erreur')
  }

  async function handleAbandon(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!abandonCand) return
    setSaving(true)
    const r = await declarerAbandonCandidatAction(abandonCand.id, poeiId, new FormData(e.currentTarget))
    setSaving(false)
    if (r.success) {
      toast('success', 'Abandon déclaré, facture recalculée au prorata')
      if ((r as any).warning) toast('error', (r as any).warning)
      setAbandonCand(null)
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  async function handleRemove(id: string) {
    if (!confirm('Retirer ce candidat du projet ? (la fiche apprenant est conservée)')) return
    const r = await removePoeiCandidatAction(id, poeiId)
    if (r.success) { toast('success', 'Candidat retiré'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  const nom = (c: PoeiCandidat) => `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || '—'

  return (
    <PoeiSection
      icone={Users}
      titre={`Candidats (${candidats.length})`}
      sous="Les personnes du dossier. Documents et envois ont leurs propres onglets."
      actions={
        <>
          <Button onClick={() => { setErrors({}); setMode('new'); setOpen(true) }} size="sm" icon={<UserPlus className="h-4 w-4" />}>Ajouter</Button>
        </>
      }
    >
      <div className="card p-5">

      {candidats.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-500">
          <Users className="h-7 w-7 text-surface-300 mx-auto mb-2" />
          Aucun candidat inscrit
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {candidats.map((c) => {
            const st = statusFor(c)
            // Un candidat entré après le démarrage suit moins d'heures : il se
            // repère dans la liste, sinon on le facture comme les autres.
            const entreApres = c.statut !== 'abandonne'
              && !!(c as any).date_debut && !!projet.date_debut && (c as any).date_debut > projet.date_debut
            return (
              <div key={c.id} className={cn('flex flex-wrap sm:flex-nowrap items-center gap-x-2.5 gap-y-2 py-2.5', entreApres && 'border-l-2 border-amber-400 -ml-3 pl-3 bg-amber-50/30')}>
                <button onClick={() => setEditCand(c)} className="flex-1 min-w-0 text-left group">
                  <div className="text-sm font-medium text-surface-900 truncate group-hover:text-brand-600 transition-colors flex items-center gap-2">
                    <span className="truncate">{nom(c)}</span>
                    {entreApres && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        <CalendarClock className="h-3 w-3" /> Entré en cours
                      </span>
                    )}
                  </div>
                  {/* Sur téléphone la ligne se replie : le numéro FT ou de convention reste lisible */}
                  <div className="text-xs text-surface-500 break-words sm:truncate">
                    {[c.apprenant?.email, c.poste_vise, c.type_contrat ? TYPE_CONTRAT_LABELS[c.type_contrat] : null, c.identifiant_ft ? `FT ${c.identifiant_ft}` : null, (c as any).numero_convention ? `Conv. ${(c as any).numero_convention}` : null, (c as any).entretien ? `Entretien${(c as any).entretien_date ? ` du ${new Date((c as any).entretien_date).toLocaleDateString('fr-FR')}` : ' mené'}` : null].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {c.statut !== 'abandonne' && ((c as any).date_debut || (c as any).date_fin || (c as any).duree_heures != null) && (
                    <div className={cn('text-xs mt-0.5 font-medium', entreApres ? 'text-amber-700' : 'text-brand-600')}>
                      {(c as any).date_debut && (c as any).date_debut !== projet.date_debut
                        ? `Entré le ${frDate((c as any).date_debut)}`
                        : (c as any).date_fin && (c as any).date_fin !== projet.date_fin
                          ? `Sortie le ${frDate((c as any).date_fin)}`
                          : 'Période propre'}
                      {(c as any).duree_heures != null ? ` · ${Number((c as any).duree_heures).toLocaleString('fr-FR')} h sur ${projet.duree_heures ?? '—'} h du parcours` : ''}
                    </div>
                  )}
                  {c.statut === 'abandonne' && (c as any).date_abandon && (
                    <div className="text-xs text-red-600 mt-0.5">
                      Abandon le {new Date((c as any).date_abandon).toLocaleDateString('fr-FR')}
                      {(c as any).heures_effectuees != null ? ` · ${Number((c as any).heures_effectuees).toLocaleString('fr-FR')} h effectuées (facturées au prorata)` : ''}
                    </div>
                  )}
                </button>

                {/* Sur téléphone le statut passe sous le nom, pleine largeur : le nom garde sa place. */}
                <select value={c.statut} onChange={(e) => handleStatut(c.id, e.target.value)} className="order-3 sm:order-2 w-full sm:w-auto text-xs rounded-lg border border-surface-200 px-2 py-2.5 sm:py-1 min-h-[40px] sm:min-h-0 bg-white shrink-0" title="Statut du candidat">
                  {statutOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* Six icônes par ligne × neuf candidats saturaient l'écran :
                    les documents et envois passent dans un menu, l'état de
                    chacun se lit dans l'onglet Pilotage. */}
                <div className="order-2 sm:order-3 shrink-0">
                <RowMenu
                  width={260}
                  triggerClassName="h-10 w-10 sm:h-auto sm:w-auto inline-flex items-center justify-center"
                  items={[
                    { label: 'Modifier les informations', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditCand(c) },
                    { label: 'Déclarer un abandon', icon: <XCircle className="h-4 w-4" />, onClick: () => setAbandonCand(c) },
                    ...(c.statut === 'abandonne' && c.apprenant_id ? [{
                      label: 'Attestation de sortie',
                      icon: <FileDown className="h-4 w-4" />,
                      onClick: () => window.open(`/api/pdf/attestation-sortie/${c.apprenant_id}?poei=${poeiId}&candidat=${c.id}`, '_blank'),
                    }] : []),
                    { label: 'Retirer du projet', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleRemove(c.id), danger: true },
                  ]}
                />
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>

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
                        : on ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-surface-500 border-surface-200'
                    }`}
                  >
                    {`${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat'}
                  </button>
                )
              })}
            </div>
            {mailSansEmail.length > 0 && (
              <p className="text-xs text-warning-600 mt-1.5">
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
                  className="px-2.5 py-1 rounded-lg bg-white border border-brand-200 text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors">
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
              {['{prenom}', '{nom}', '{formation}', '{entreprise}', '{dates}', '{lieu}', '{adresse}', '{horaires}', '{formateur}', '{planning}', '{duree_heures}', '{date_debut}', '{date_fin}'].map((v) => (
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
                className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
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
                  <p className="text-[11px] text-surface-400">Ces fichiers sont envoyés à tous les destinataires (20 Mo max au total).</p>
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

          <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={handleSaveTemplate}
              disabled={!mailSubject.trim() || !mailMessage.trim()}
              className="text-xs font-medium text-surface-500 hover:text-surface-700 disabled:opacity-40 min-h-[40px] sm:min-h-0">
              Enregistrer comme modèle
            </button>
            <div className="flex flex-wrap gap-3 ml-auto">
            <Button variant="secondary" onClick={() => setMailOpen(false)}>Annuler</Button>
            <Button onClick={handleSendGroupMail} isLoading={mailSending}
              disabled={!mailSubject.trim() || !mailMessage.trim()}
              icon={<Send className="h-4 w-4" />} className="">
              Envoyer à {mailRecipients.filter((c) => c.apprenant?.email).length} candidat{mailRecipients.filter((c) => c.apprenant?.email).length > 1 ? 's' : ''}
            </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation génération des devis */}
      <Modal isOpen={genDevisOpen} onClose={() => setGenDevisOpen(false)} title="Générer les devis" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-warning-50 border border-warning-200 p-4">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Euro className="h-4 w-4 text-warning-600" />
            </div>
            <div className="text-sm text-surface-700">
              Un devis va être créé pour <strong>chacun des {candidats.length} candidat{candidats.length > 1 ? 's' : ''}</strong> du projet
              (formation × taux horaire × durée, exonéré de TVA).
              <div className="text-xs text-surface-500 mt-1">Les candidats déjà couverts par un devis sont ignorés. Les devis sont émis directement (statut « envoyé ») pour le dossier France Travail.</div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setGenDevisOpen(false)}>Annuler</Button>
            <Button onClick={handleGenerateDevis} isLoading={genDevis} icon={<Euro className="h-4 w-4" />} className="">
              Générer {candidats.length} devis
            </Button>
          </div>
        </div>
      </Modal>

      {/* Aperçu de l'email avant envoi */}
      <Modal isOpen={!!previewTargets} onClose={() => setPreviewTargets(null)} title="Aperçu de l'email, attestation d'entrée" size="lg">
        {previewTargets && (
          <div className="space-y-4">
            {/* Destinataires */}
            <div>
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
                Destinataires ({previewTargets.filter((c) => c.apprenant?.email).length}/{previewTargets.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previewTargets.map((c) => c.apprenant?.email ? (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success-50 text-success-700 text-xs border border-success-100">
                    {nom(c)} <span className="text-success-500">({c.apprenant.email})</span>
                  </span>
                ) : (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-danger-50 text-danger-600 text-xs border border-danger-100" title="Sans email, ne recevra pas l'attestation">
                    <XCircle className="h-3 w-3 shrink-0" /> {nom(c)}, sans email
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
                <div className="bg-[#205040] text-white px-4 py-3 text-sm font-bold">Lab Learning</div>
                <div className="p-4 space-y-3 bg-white">
                  <div className="text-sm font-bold text-surface-900">Attestation d&apos;entrée en formation</div>
                  <p className="text-sm text-surface-600">
                    Bonjour <strong>{previewTargets.length === 1 ? nom(previewTargets[0]) : 'Prénom Nom'}</strong>,<br />
                    {message}
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-success-50 border border-success-100 px-3 py-2">
                    <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-success-700">
                      attestation-entree-{previewTargets.length === 1 ? (previewTargets[0].apprenant?.nom || 'NOM') : 'NOM'}.pdf
                    </span>
                    <span className="text-[11px] text-surface-400">personnalisée pour chaque candidat</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-1">
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

          <PeriodeCandidatChamps key={open ? 'ouvert' : 'ferme'} prefixe="" projet={projet} interventions={interventions} />

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={saving} icon={<UserPlus className="h-4 w-4" />} className="">Ajouter</Button>
          </div>
        </form>
      </Modal>

      {/* Édition */}
      {/* Déclaration d'abandon : date + heures réelles → facture au prorata */}
      <Modal isOpen={!!abandonCand} onClose={() => setAbandonCand(null)}
        title={`Déclarer l'abandon, ${abandonCand ? nom(abandonCand) : ''}`}
        description="Les heures réellement effectuées servent à la facturation au prorata (modèle France Travail)."
        size="md">
        {abandonCand && (
          <form onSubmit={handleAbandon} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input id="date_abandon" name="date_abandon" type="date" label="Date de l'abandon *"
                defaultValue={new Date().toISOString().slice(0, 10)} required />
              <Input id="heures_effectuees" name="heures_effectuees" type="number" step="0.5" min="0"
                label="Heures réellement effectuées *" placeholder="ex. 120" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-800 mb-1.5">Motif</label>
              <textarea name="motif_abandon" rows={3} className="input-base resize-none"
                placeholder="Ce que le candidat ou l'employeur a indiqué, alimente l'analyse des causes d'abandon (PROC-12)" />
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
              La facture du candidat sera recalculée : heures effectuées × taux horaire du projet.
              Si elle est déjà émise, un avoir sera à prévoir. Le questionnaire d&apos;abandon est préparé
              automatiquement pour l&apos;apprenant.
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAbandonCand(null)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Déclaration…' : "Déclarer l'abandon"}</Button>
            </div>
          </form>
        )}
      </Modal>

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
              {/* Entretien de recrutement/positionnement, trace d'individualisation (ind. 4/10) */}
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div className="col-span-2">
                  <label htmlFor="e_entretien" className="block text-sm font-medium text-surface-700 mb-1.5">Entretien (compte rendu)</label>
                  <textarea
                    id="e_entretien" name="entretien" rows={4} className="input-base resize-y"
                    defaultValue={(editCand as any).entretien || ''}
                    placeholder="Motivation, parcours, disponibilités, besoins d'adaptation repérés, conclusion de l'entretien…"
                  />
                </div>
                <Input id="e_entretien_date" name="entretien_date" type="date" label="Date de l'entretien" defaultValue={(editCand as any).entretien_date || ''} />
              </div>
            </div>

            <PeriodeCandidatChamps
              key={editCand.id}
              prefixe="e_"
              projet={projet}
              interventions={interventions}
              toujoursVisible
              valeurs={{
                date_debut: (editCand as any).date_debut || '',
                date_fin: (editCand as any).date_fin || '',
                duree_heures: (editCand as any).duree_heures ?? '',
              }}
            />
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="secondary" onClick={() => setEditCand(null)}>Annuler</Button>
              <Button type="submit" isLoading={saving} icon={<Pencil className="h-4 w-4" />}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Modal>
    </PoeiSection>
  )
}

const frDate = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : null)

/**
 * Période propre à un candidat. Laissée vide, le candidat suit le calendrier
 * du projet : c'est le cas courant, la saisie ne sert qu'aux entrées décalées.
 */
function PeriodeCandidatChamps({
  prefixe, projet, interventions, valeurs, toujoursVisible,
}: {
  prefixe: string
  projet: ProjetPoeiPeriode
  interventions: InterventionPlanning[]
  valeurs?: { date_debut: string; date_fin: string; duree_heures: number | string }
  /** En modification, les champs restent affichés : c'est là qu'on corrige une entrée décalée. */
  toujoursVisible?: boolean
}) {
  const [ouvert, setOuvert] = useState(
    toujoursVisible || !!(valeurs && (valeurs.date_debut || valeurs.date_fin || valeurs.duree_heures !== '')),
  )
  const [debut, setDebut] = useState(valeurs?.date_debut || '')
  const [fin, setFin] = useState(valeurs?.date_fin || '')
  const [heures, setHeures] = useState(
    valeurs?.duree_heures === '' || valeurs?.duree_heures == null ? '' : String(valeurs.duree_heures),
  )
  // Heures du planning comprises dans la période saisie : une entrée décalée
  // dont on oublie la durée serait facturée plein temps.
  const suggestion = heuresDepuisInterventions(interventions, debut || null, fin || null)
  const proposer = suggestion != null && heures !== String(suggestion)
  const calendrier = [
    frDate(projet.date_debut) && frDate(projet.date_fin)
      ? `du ${frDate(projet.date_debut)} au ${frDate(projet.date_fin)}`
      : frDate(projet.date_debut) ? `à partir du ${frDate(projet.date_debut)}` : null,
    projet.duree_heures != null ? `${projet.duree_heures} h` : null,
  ].filter(Boolean).join(' · ')

  if (!ouvert) {
    return (
      <div className="border-t border-surface-100 pt-3">
        <button
          type="button" onClick={() => setOuvert(true)}
          className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <CalendarClock className="h-4 w-4" /> Ce candidat entre en cours de parcours
        </button>
        <p className="text-xs text-surface-400 mt-1">
          Par défaut il suit le calendrier du projet{calendrier ? ` : ${calendrier}` : ''}.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-surface-100 pt-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-surface-800">Période propre à ce candidat</div>
          <p className="text-xs text-surface-400 mt-0.5">
            Ses dates figureront sur sa convention, son attestation d&apos;entrée et sa facture France Travail.
            {calendrier ? ` Le projet court ${calendrier}.` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setDebut(''); setFin(''); setHeures(''); if (!toujoursVisible) setOuvert(false) }}
          className="text-xs font-medium text-surface-400 hover:text-surface-600 shrink-0"
        >
          Suivre le projet
        </button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Input id={`${prefixe}date_debut`} name="date_debut" type="date" label="Entrée en formation"
          value={debut} onChange={(e) => setDebut(e.target.value)}
          min={projet.date_debut || undefined} max={projet.date_fin || undefined} />
        <Input id={`${prefixe}date_fin`} name="date_fin" type="date" label="Sortie prévue"
          value={fin} onChange={(e) => setFin(e.target.value)}
          min={projet.date_debut || undefined} max={projet.date_fin || undefined} />
        <Input id={`${prefixe}duree_heures`} name="duree_heures" type="number" step="0.5" min="0"
          label="Heures suivies" placeholder={projet.duree_heures != null ? String(projet.duree_heures) : 'ex. 250'}
          value={heures} onChange={(e) => setHeures(e.target.value)} />
      </div>
      {proposer ? (
        <button
          type="button" onClick={() => setHeures(String(suggestion))}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Le planning compte {suggestion!.toLocaleString('fr-FR')} h sur cette période, reprendre cette durée
        </button>
      ) : (
        <p className="text-xs text-surface-400">
          Les heures servent à facturer France Travail. Laissez le champ vide pour facturer la durée complète du parcours.
        </p>
      )}
    </div>
  )
}
