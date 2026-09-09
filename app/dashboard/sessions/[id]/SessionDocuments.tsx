'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSignature, Send, Download, Eye, Loader2, Check, Copy, Clock,
  CheckCircle2, AlertCircle, Mail, FileText, XCircle,
} from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { sendConventionForSignatureAction, sendContratToFormateurAction } from './actions'
import { cn } from '@/lib/utils'

interface Convention {
  id: string; numero: string | null; status: string | null
  sent_at: string | null; signature_client_date: string | null; signature_client_nom: string | null
  signature_of_date: string | null; signature_token: string | null
}
interface Contrat {
  id: string; numero: string | null; status: string | null
  sent_at: string | null; signature_formateur_date: string | null; signature_formateur_nom: string | null
  montant_ht: number | null; signature_token: string | null
}

/** Envoi tracé dans email_logs, rattaché à une pièce précise du dossier. */
interface EnvoiDoc {
  id: string; to_email: string; to_name: string | null; subject: string
  status: string | null; sent_at: string | null; opened_at: string | null; created_at: string
  entity_type: string | null; entity_id: string | null
}

interface Props {
  sessionId: string
  hasClient: boolean
  hasFormateur: boolean
  formateurId?: string | null
  formateurNom?: string | null
  formateurEmail?: string | null
  clientNom?: string | null
  clientEmail?: string | null
  formationNom?: string | null
  dates?: string | null
  convention?: Convention | null
  contrat?: Contrat | null
  docEmailLogs?: EnvoiDoc[]
  /** Session inter : contractualisation par partie (entreprises + particuliers) */
  typeSession?: string | null
  participants?: { id: string; prenom: string | null; nom: string | null; email: string | null; client_id?: string | null }[]
  clientsApprenants?: { id: string; type: string | null; raison_sociale: string | null; nom_commercial: string | null }[]
  conventionsSession?: { id: string; numero: string; client_id: string | null; sent_at: string | null; signature_client_date: string | null; participants_snapshot: { apprenant_id?: string }[] | null }[]
}

function fmtDateHeure(d: string | null | undefined): string {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} à ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  } catch { return '' }
}

/** Pastille d'état d'un document */
function StatutBadge({ etat, date }: { etat: 'absent' | 'attente' | 'partiel' | 'signe'; date?: string | null }) {
  const map = {
    absent: { label: 'Non envoyé', cls: 'bg-surface-100 text-surface-500', Icon: Clock },
    attente: { label: 'En attente de signature', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
    partiel: { label: 'Signé par le client', cls: 'bg-blue-50 text-blue-700', Icon: CheckCircle2 },
    signe: { label: 'Signé', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  }[etat]
  const { Icon } = map
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0', map.cls)}>
      <Icon className="h-3 w-3" /> {map.label}{date ? ` · ${fmtDateHeure(date)}` : ''}
    </span>
  )
}

export function SessionDocuments(props: Props) {
  const [envoiContrat, setEnvoiContrat] = useState<string | null>(null)
  async function envoyerContratParticulier(apprenantId: string) {
    setEnvoiContrat(apprenantId)
    const { envoyerContratParticulierAction } = await import('./actions')
    const r = await envoyerContratParticulierAction(props.sessionId, apprenantId)
    setEnvoiContrat(null)
    if (r.success) { toast('success', 'Contrat envoyé pour signature'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }
  async function envoyerConventionEntreprise(clientId: string) {
    setEnvoiContrat(clientId)
    const { envoyerConventionEntrepriseInterAction } = await import('./actions')
    const r = await envoyerConventionEntrepriseInterAction(props.sessionId, clientId)
    setEnvoiContrat(null)
    if (r.success) { toast('success', 'Convention envoyée pour signature'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }
  /** Lien de signature seul (sans email) : la convention est préparée, le lien s'affiche à copier. */
  async function genererLienEntreprise(clientId: string) {
    setEnvoiContrat(`lien:${clientId}`)
    setSignUrl(null); setCopied(false)
    const { envoyerConventionEntrepriseInterAction } = await import('./actions')
    const r = await envoyerConventionEntrepriseInterAction(props.sessionId, clientId, { lienSeul: true })
    setEnvoiContrat(null)
    if (r.success && r.data?.url) { setSignUrl(r.data.url); toast('success', 'Lien de signature prêt (à copier ci-dessous)'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  const {
    sessionId, hasClient, hasFormateur, formateurId, formateurNom, formateurEmail,
    clientNom, clientEmail, formationNom, dates, convention, contrat, docEmailLogs = [],
  } = props
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<'conv' | 'contrat' | null>(null)
  const [preview, setPreview] = useState<'conv' | 'contrat' | null>(null)
  const [signUrl, setSignUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [histo, setHisto] = useState<'conv' | 'contrat' | null>(null)
  // Contrôle de conformité de la convention (mentions obligatoires)
  const [check, setCheck] = useState<{ ok: boolean; blocking: { section: string; label: string }[] } | null>(null)
  const [checking, setChecking] = useState(false)

  async function openPreview(kind: 'conv' | 'contrat') {
    setPreview(kind)
    if (kind !== 'conv') return
    setChecking(true); setCheck(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/convention-check`)
      if (res.ok) setCheck(await res.json())
    } catch { /* le contrôle reste indicatif */ }
    setChecking(false)
  }

  // ── États ──
  const convEtat: 'absent' | 'attente' | 'partiel' | 'signe' =
    !convention ? 'absent'
    : convention.status === 'signee_complete' ? 'signe'
    : convention.status === 'signee_client' ? 'partiel'
    : convention.sent_at || convention.status === 'envoyee' ? 'attente'
    : 'absent'
  const convDate = convention?.signature_client_date || convention?.sent_at

  const contratEtat: 'absent' | 'attente' | 'partiel' | 'signe' =
    !contrat ? 'absent'
    : contrat.signature_formateur_date || contrat.status === 'signe_formateur' ? 'signe'
    : contrat.sent_at || contrat.status === 'envoye' ? 'attente'
    : 'absent'
  const contratDate = contrat?.signature_formateur_date || contrat?.sent_at

  // ── Envois ──
  function doSendConvention() {
    setBusy('conv'); setSignUrl(null)
    startTransition(async () => {
      const r = await sendConventionForSignatureAction(sessionId)
      setBusy(null); setPreview(null)
      if (r.success) {
        toast('success', (r as any).data?.email ? `Convention envoyée à ${(r as any).data.email}` : 'Convention prête à signer')
        if ((r as any).data?.url) setSignUrl((r as any).data.url)
        router.refresh()
      } else toast('error', r.error || 'Erreur')
    })
  }
  /** Lien de signature seul, sans email : la convention est préparée et le lien s'affiche à copier. */
  function doLinkConvention() {
    setBusy('conv'); setSignUrl(null); setCopied(false)
    startTransition(async () => {
      const r = await sendConventionForSignatureAction(sessionId, undefined, { lienSeul: true })
      setBusy(null)
      if (r.success && (r as any).data?.url) {
        setSignUrl((r as any).data.url)
        toast('success', 'Lien de signature prêt (à copier ci-dessous)')
        router.refresh()
      } else toast('error', r.error || 'Erreur')
    })
  }

  function performCancelConvention() {
    if (!convention) return
    setBusy('conv')
    startTransition(async () => {
      const { cancelSignatureRequestAction } = await import('@/app/dashboard/conventions/signature-actions')
      const r = await cancelSignatureRequestAction(convention.id)
      setBusy(null); setSignUrl(null); setConfirmCancelOpen(false)
      if (r.success) { toast('success', 'Demande de signature annulée'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  function doSendContrat() {
    setBusy('contrat')
    startTransition(async () => {
      const r = await sendContratToFormateurAction(sessionId)
      setBusy(null); setPreview(null)
      if (r.success) {
        toast('success', `Contrat envoyé à ${(r as any).data?.email || 'au formateur'}`)
        router.refresh()
      } else toast('error', r.error || 'Erreur')
    })
  }

  async function copyLink() {
    if (!signUrl) return
    await navigator.clipboard.writeText(signUrl)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  // URLs d'aperçu (rendu réel du PDF, même avant génération).
  // #toolbar=0&navpanes=0 : visionneuse épurée dans la modale (sans barre ni vignettes)
  const VIEWER = '#toolbar=0&navpanes=0&statusbar=0&view=FitH'
  const convPdfUrl = `/api/pdf/preview/convention/${sessionId}`
  // Dès qu'un contrat existe en base, on le rend par son id : c'est la seule
  // façon d'obtenir la version signée (le rendu par session est une projection).
  const contratRef = contrat?.id ? `contrat=${contrat.id}` : `session=${sessionId}`
  // inline=1 : sinon le navigateur télécharge le contrat au lieu de l'afficher
  const contratPdfUrl = formateurId ? `/api/pdf/contrat-formateur/${formateurId}?${contratRef}&inline=1` : null
  const contratDlUrl = formateurId ? `/api/pdf/contrat-formateur/${formateurId}?${contratRef}` : null

  // Les envois sont rattachés à la pièce elle-même : la convention et le
  // contrat ne se mélangent pas, même s'ils partent au même destinataire.
  const envoisConvention = docEmailLogs.filter((l) => l.entity_type === 'convention')
  const envoisContrat = docEmailLogs.filter((l) => l.entity_type === 'contrat_formateur')

  // ── Historique des envois d'une pièce ──
  function Historique({ envois }: { envois: EnvoiDoc[] }) {
    if (envois.length === 0) {
      return (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-surface-400">
            Aucun envoi tracé. Les envois antérieurs au suivi ne sont pas remontés ici.
          </p>
        </div>
      )
    }
    return (
      <div className="px-4 pb-3 -mt-1">
        <ol className="rounded-lg border border-surface-100 divide-y divide-surface-100 bg-surface-50/40">
          {envois.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="text-xs text-surface-700 flex-1 min-w-[160px] truncate">{e.subject}</span>
              <span className="text-[11px] text-surface-500 truncate">{e.to_name || e.to_email}</span>
              {e.opened_at && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                  <Eye className="h-3 w-3" /> Ouvert
                </span>
              )}
              <span className={cn(
                'inline-flex items-center gap-1 text-[11px] font-medium shrink-0',
                e.status === 'sent' ? 'text-emerald-600' : e.status === 'failed' ? 'text-danger-600' : 'text-amber-600',
              )}>
                {e.status === 'sent' ? <CheckCircle2 className="h-3 w-3" /> : e.status === 'failed' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {e.status === 'sent' ? 'Envoyé' : e.status === 'failed' ? 'Échec' : 'En cours'}
              </span>
              <span className="text-[11px] text-surface-400 shrink-0 tabular-nums">{fmtDateHeure(e.sent_at || e.created_at)}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  // ── Ligne document ──
  function DocRow({
    icon, titre, sousTitre, etat, date, onPreview, onSend, sendLabel, downloadUrl, disabled, disabledReason, busyKey, onCancel, envois, onLink,
  }: {
    icon: React.ReactNode; titre: string; sousTitre: string
    etat: 'absent' | 'attente' | 'partiel' | 'signe'; date?: string | null
    onPreview: () => void; onSend: () => void; sendLabel: string
    downloadUrl: string | null; disabled?: boolean; disabledReason?: string; busyKey: 'conv' | 'contrat'
    onCancel?: () => void; envois: EnvoiDoc[]
    /** Génère le lien de signature sans envoyer d'email */
    onLink?: () => void
  }) {
    const ouvert = histo === busyKey
    return (
      <div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <span className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">{icon}</span>
        <div className="flex-1 min-w-[180px]">
          <div className="text-sm font-semibold text-surface-900">{titre}</div>
          <div className="text-xs text-surface-500">{sousTitre}</div>
        </div>
        <StatutBadge etat={etat} date={date} />
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setHisto(ouvert ? null : busyKey)}
            title="Historique des envois de ce document"
            aria-expanded={ouvert}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium',
              ouvert ? 'border-surface-900 bg-surface-900 text-white' : 'border-surface-200 text-surface-700 hover:bg-surface-50',
            )}
          >
            <Mail className="h-3.5 w-3.5" /> Mails
            {envois.length > 0 && (
              <span className={cn('text-[10px] font-bold px-1 rounded', ouvert ? 'bg-white/20' : 'bg-surface-100 text-surface-500')}>
                {envois.length}
              </span>
            )}
          </button>
          <button
            onClick={onPreview}
            disabled={disabled}
            title={disabled ? disabledReason : 'Visualiser le document et l\'email avant envoi'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eye className="h-3.5 w-3.5" /> Aperçu
          </button>
          {downloadUrl && etat !== 'absent' && (
            <a href={downloadUrl} target="_blank" rel="noreferrer"
              title={etat === 'signe' ? 'Télécharger le document signé' : 'Télécharger le document'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50">
              <Download className="h-3.5 w-3.5" /> {etat === 'signe' ? 'Signé' : 'PDF'}
            </a>
          )}
          {onCancel && etat === 'attente' && (
            <button
              onClick={onCancel}
              disabled={pending}
              title="Annuler la demande de signature (invalide le lien)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-danger-200 text-danger-600 text-xs font-medium hover:bg-danger-50 disabled:opacity-40"
            >
              <XCircle className="h-3.5 w-3.5" /> Annuler
            </button>
          )}
          {onLink && etat !== 'signe' && (
            <button
              onClick={onLink}
              disabled={disabled || pending}
              title={disabled ? disabledReason : 'Générer le lien de signature sans envoyer d\'email'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy className="h-3.5 w-3.5" /> Lien
            </button>
          )}
          {etat !== 'signe' && (
            <button
              onClick={onSend}
              disabled={disabled || pending}
              title={disabled ? disabledReason : undefined}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === busyKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {etat === 'absent' ? sendLabel : 'Relancer'}
            </button>
          )}
        </div>
      </div>
      {ouvert && <Historique envois={envois} />}
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Contractualisation</span>
      </div>

      {/* Session inter : une ligne par partie (entreprise → convention, particulier → contrat) */}
      {props.typeSession === 'inter' && (props.participants || []).length > 0 && (() => {
        const clients = new Map((props.clientsApprenants || []).map((c) => [c.id, c]))
        const convs = props.conventionsSession || []
        // Regroupe : entreprises (clé client_id) / particuliers & non rattachés (individuel)
        const groupes = new Map<string, typeof props.participants>()
        const individuels: NonNullable<typeof props.participants> = []
        for (const a of props.participants || []) {
          const cli = a.client_id ? clients.get(a.client_id) : null
          if (cli && cli.type === 'entreprise') {
            if (!groupes.has(cli.id)) groupes.set(cli.id, [])
            groupes.get(cli.id)!.push(a)
          } else individuels.push(a)
        }
        const convEntreprise = (cid: string) => convs.find((c) => c.client_id === cid && (c.participants_snapshot?.length ?? 0) >= 1 && !individuels.some((i) => c.participants_snapshot?.length === 1 && c.participants_snapshot[0]?.apprenant_id === i.id))
        const convParticulier = (aid: string) => convs.find((c) => c.participants_snapshot?.length === 1 && c.participants_snapshot[0]?.apprenant_id === aid)
        return (
          <div className="px-4 py-4 border-b border-surface-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-heading font-semibold text-surface-900">Contractualisation</h3>
              <span className="text-xs text-surface-400">{groupes.size + individuels.length} partie{groupes.size + individuels.length > 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-surface-500 mb-3">
              Session inter : une convention par entreprise (couvrant ses stagiaires), un contrat
              individuel par particulier (art. L.6353-3 — rétractation 10 j incluse).
            </p>
            <div className="divide-y divide-surface-100">
              {[...groupes.entries()].map(([cid, apps]) => {
                const cli = clients.get(cid)
                const c = convEntreprise(cid)
                return (
                  <div key={cid} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-surface-900">{cli?.nom_commercial || cli?.raison_sociale}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 ml-2">Convention</span>
                      <div className="text-xs text-surface-400 truncate">{(apps || []).map((a) => `${a.prenom || ''} ${a.nom || ''}`.trim()).join(', ')}</div>
                    </div>
                    {c ? <StatutBadge etat={c.signature_client_date ? 'signe' : c.sent_at ? 'attente' : 'absent'} date={c.signature_client_date || c.sent_at} /> : <StatutBadge etat="absent" />}
                    {c ? (
                      <a href={`/api/pdf/convention/${c.id}`} target="_blank" rel="noreferrer"
                        title={c.signature_client_date ? 'Télécharger la convention signée' : 'Télécharger la convention'}
                        className="inline-flex items-center gap-1.5 text-xs font-medium rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-surface-700 hover:border-surface-300 transition-colors shrink-0">
                        <Download className="h-3.5 w-3.5" /> {c.signature_client_date ? 'Signée' : 'PDF'}
                      </a>
                    ) : (
                      /* Pas encore envoyée : aperçu et téléchargement de la projection pour cette entreprise */
                      <>
                        <a href={`/api/pdf/preview/convention/${sessionId}?client=${cid}`} target="_blank" rel="noreferrer"
                          title="Aperçu de la convention telle qu'elle sera envoyée"
                          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-surface-700 hover:border-surface-300 transition-colors shrink-0">
                          <Eye className="h-3.5 w-3.5" /> Aperçu
                        </a>
                        <a href={`/api/pdf/preview/convention/${sessionId}?client=${cid}&download=1`}
                          title="Télécharger la convention (non envoyée)"
                          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-surface-700 hover:border-surface-300 transition-colors shrink-0">
                          <Download className="h-3.5 w-3.5" /> PDF
                        </a>
                      </>
                    )}
                    {!c?.signature_client_date && (
                      <>
                        <button disabled={envoiContrat === `lien:${cid}`} onClick={() => genererLienEntreprise(cid)}
                          title="Générer le lien de signature sans envoyer d'email"
                          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-surface-700 hover:border-surface-300 transition-colors disabled:opacity-40 shrink-0">
                          {envoiContrat === `lien:${cid}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                          Lien
                        </button>
                        <button disabled={envoiContrat === cid} onClick={() => envoyerConventionEntreprise(cid)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-surface-700 hover:border-surface-300 transition-colors disabled:opacity-40 shrink-0">
                          {envoiContrat === cid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          {c ? 'Renvoyer' : 'Envoyer la convention'}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
              {individuels.map((a) => {
                const c = convParticulier(a.id)
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-surface-900">{a.prenom} {a.nom}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 ml-2">Contrat particulier</span>
                      <span className="text-xs text-surface-400 ml-2">{a.email || 'sans email'}</span>
                    </div>
                    {c ? <StatutBadge etat={c.signature_client_date ? 'signe' : c.sent_at ? 'attente' : 'absent'} date={c.signature_client_date || c.sent_at} /> : <StatutBadge etat="absent" />}
                    {c && (
                      <a href={`/api/pdf/convention/${c.id}`} target="_blank" rel="noreferrer"
                        title={c.signature_client_date ? 'Télécharger le contrat signé' : 'Télécharger le contrat'}
                        className="inline-flex items-center gap-1.5 text-xs font-medium rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-surface-700 hover:border-surface-300 transition-colors shrink-0">
                        <Download className="h-3.5 w-3.5" /> {c.signature_client_date ? 'Signé' : 'PDF'}
                      </a>
                    )}
                    {!c?.signature_client_date && (
                      <button disabled={!a.email || envoiContrat === a.id} onClick={() => envoyerContratParticulier(a.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-surface-700 hover:border-surface-300 transition-colors disabled:opacity-40 shrink-0">
                        {envoiContrat === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {c ? 'Renvoyer' : 'Envoyer le contrat'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <div className="divide-y divide-surface-100">
        {props.typeSession !== 'inter' && <DocRow
          icon={<FileSignature className="h-4 w-4 text-brand-600" />}
          titre="Convention de formation"
          sousTitre={clientNom ? `Client : ${clientNom}${convention?.numero ? ` · ${convention.numero}` : ''}` : 'Aucun client rattaché'}
          etat={convEtat} date={convDate}
          onPreview={() => openPreview('conv')}
          onSend={doSendConvention}
          onLink={doLinkConvention}
          onCancel={() => setConfirmCancelOpen(true)}
          sendLabel="Envoyer en signature"
          downloadUrl={convention ? `/api/pdf/convention/${convention.id}` : null}
          disabled={!hasClient} disabledReason="Aucun client entreprise rattaché à la session"
          busyKey="conv"
          envois={envoisConvention}
        />}
        <DocRow
          icon={<FileText className="h-4 w-4 text-blue-600" />}
          titre="Contrat de prestation formateur"
          sousTitre={formateurNom ? `Formateur : ${formateurNom}${contrat?.numero ? ` · ${contrat.numero}` : ''}` : 'Aucun formateur rattaché'}
          etat={contratEtat} date={contratDate}
          onPreview={() => openPreview('contrat')}
          onSend={doSendContrat}
          sendLabel="Envoyer au formateur"
          downloadUrl={contratDlUrl}
          disabled={!hasFormateur} disabledReason="Aucun formateur rattaché à la session"
          busyKey="contrat"
          envois={envoisContrat}
        />
      </div>

      {signUrl && (
        <div className="flex items-center gap-2 bg-surface-50 px-4 py-2.5 border-t border-surface-100">
          <span className="text-xs text-surface-500 shrink-0">Lien de signature :</span>
          <span className="text-xs text-surface-700 truncate flex-1 font-mono">{signUrl}</span>
          <button onClick={copyLink} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0">
            {copied ? <><Check className="h-3.5 w-3.5" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
          </button>
        </div>
      )}

      {/* Aperçu avant envoi : document + email */}
      <Modal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview === 'conv' ? 'Aperçu — Convention de formation' : 'Aperçu — Contrat de prestation'}
        size="lg"
      >
        {preview && (
          <div className="space-y-4">
            {/* Contrôle de conformité (convention) — avant même l'envoi */}
            {preview === 'conv' && (checking || check) && (
              checking ? (
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vérification des mentions obligatoires…
                </div>
              ) : check && !check.ok ? (
                <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-danger-700 mb-1.5">
                    <AlertCircle className="h-4 w-4" /> Convention incomplète — l&apos;envoi sera refusé
                  </div>
                  <ul className="space-y-0.5">
                    {check.blocking.map((b, i) => (
                      <li key={i} className="text-xs text-danger-700">• <strong>{b.section}</strong> — {b.label}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Toutes les mentions obligatoires sont présentes.
                </div>
              )
            )}

            {/* Email qui sera envoyé */}
            <div className="rounded-xl border border-surface-200 overflow-hidden">
              <div className="px-3 py-2 bg-surface-50 border-b border-surface-200 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-surface-400" />
                <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Email envoyé</span>
              </div>
              <div className="p-3 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-xs text-surface-400 w-20 shrink-0">Destinataire</span>
                  <span className="text-surface-800">
                    {preview === 'conv'
                      ? (clientEmail || <span className="text-amber-600">aucun email client — le lien de signature sera à copier</span>)
                      : (formateurEmail || <span className="text-amber-600">aucun email formateur</span>)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-surface-400 w-20 shrink-0">Objet</span>
                  <span className="text-surface-800">
                    {preview === 'conv'
                      ? `Convention de formation à signer — ${formationNom || 'Formation'}`
                      : `Contrat de prestation — ${formationNom || 'Formation'}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-surface-400 w-20 shrink-0">Message</span>
                  <span className="text-surface-600 text-xs leading-relaxed">
                    {preview === 'conv'
                      ? <>Bonjour, veuillez trouver la convention de formation « {formationNom} » ({dates}) à signer en ligne. Un bouton « Signer la convention » mène à la signature électronique (lien valable 30 jours).</>
                      : <>Bonjour, voici votre contrat de prestation pour la session « {formationNom} » ({dates}), avec le récapitulatif de la mission et le montant convenu.</>}
                  </span>
                </div>
              </div>
            </div>

            {/* Document */}
            <div className="rounded-xl border border-surface-200 overflow-hidden">
              <div className="px-3 py-2 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-surface-400" />
                  <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Document</span>
                </div>
                <a href={preview === 'conv' ? convPdfUrl : (contratPdfUrl || '#')} target="_blank" rel="noreferrer"
                  className="text-xs text-brand-600 hover:underline">Ouvrir en plein écran</a>
              </div>
              <iframe
                src={(preview === 'conv' ? convPdfUrl : (contratPdfUrl || '')) + VIEWER}
                className="w-full h-[52vh] bg-surface-50"
                title="Aperçu du document"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-surface-400 inline-flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Vérifiez le document avant l&apos;envoi.
              </span>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setPreview(null)}>Fermer</Button>
                <Button
                  onClick={preview === 'conv' ? doSendConvention : doSendContrat}
                  isLoading={busy !== null}
                  disabled={preview === 'conv' && (checking || (check ? !check.ok : false))}
                  icon={<Send className="h-4 w-4" />}
                >
                  {preview === 'conv' ? 'Envoyer en signature' : 'Envoyer au formateur'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation d'annulation de la demande de signature */}
      <Modal isOpen={confirmCancelOpen} onClose={() => setConfirmCancelOpen(false)} title="Annuler la demande de signature ?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            Le lien envoyé au client sera <strong>invalidé</strong> et la convention repassera en <strong>brouillon</strong>.
            Vous pourrez la renvoyer avec les dates à jour.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmCancelOpen(false)}>Retour</Button>
            <Button onClick={performCancelConvention} isLoading={busy === 'conv'} className="!bg-danger-600 hover:!bg-danger-700" icon={<XCircle className="h-4 w-4" />}>
              Annuler la demande
            </Button>
          </div>
        </div>
      </Modal>


    </div>
  )
}
