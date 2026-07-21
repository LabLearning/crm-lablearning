'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSignature, Send, Download, Eye, Loader2, Check, Copy, Clock,
  CheckCircle2, AlertCircle, Mail, FileText,
} from 'lucide-react'
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
  const {
    sessionId, hasClient, hasFormateur, formateurId, formateurNom, formateurEmail,
    clientNom, clientEmail, formationNom, dates, convention, contrat,
  } = props
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<'conv' | 'contrat' | null>(null)
  const [preview, setPreview] = useState<'conv' | 'contrat' | null>(null)
  const [signUrl, setSignUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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

  // ── Ligne document ──
  function DocRow({
    icon, titre, sousTitre, etat, date, onPreview, onSend, sendLabel, downloadUrl, disabled, disabledReason, busyKey,
  }: {
    icon: React.ReactNode; titre: string; sousTitre: string
    etat: 'absent' | 'attente' | 'partiel' | 'signe'; date?: string | null
    onPreview: () => void; onSend: () => void; sendLabel: string
    downloadUrl: string | null; disabled?: boolean; disabledReason?: string; busyKey: 'conv' | 'contrat'
  }) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <span className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">{icon}</span>
        <div className="flex-1 min-w-[180px]">
          <div className="text-sm font-semibold text-surface-900">{titre}</div>
          <div className="text-xs text-surface-500">{sousTitre}</div>
        </div>
        <StatutBadge etat={etat} date={date} />
        <div className="flex items-center gap-1.5 shrink-0">
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
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Documents de la session</span>
      </div>

      <div className="divide-y divide-surface-100">
        <DocRow
          icon={<FileSignature className="h-4 w-4 text-brand-600" />}
          titre="Convention de formation"
          sousTitre={clientNom ? `Client : ${clientNom}${convention?.numero ? ` · ${convention.numero}` : ''}` : 'Aucun client rattaché'}
          etat={convEtat} date={convDate}
          onPreview={() => openPreview('conv')}
          onSend={doSendConvention}
          sendLabel="Envoyer en signature"
          downloadUrl={convention ? `/api/pdf/convention/${convention.id}` : null}
          disabled={!hasClient} disabledReason="Aucun client entreprise rattaché à la session"
          busyKey="conv"
        />
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
    </div>
  )
}
