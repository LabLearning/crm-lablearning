'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mail, GraduationCap, Users, UserCheck, CheckCircle2, Clock, XCircle,
  Send, Loader2, Eye, ChevronRight, FileSignature,
} from '@/components/ui/icons'
import { Modal, Button, useToast } from '@/components/ui'
import { formatDate, cn } from '@/lib/utils'
import { sendSessionInfoToFormateurAction, sendConvocationToReferentAction } from './actions'
import { envoyerMailApprenantAction, envoyerMailATousAction, envoyerDocumentsAuReferentAction, envoyerDemandeAppreciationAction, type MailApprenantType } from '../mails-actions'

interface EmailLog {
  id: string; to_email: string; to_name: string | null; subject: string
  status: string | null; sent_at: string | null; created_at: string
}
interface Person { id?: string; nom: string; email: string | null; sub?: string | null }

const norm = (e?: string | null) => (e || '').trim().toLowerCase()

/**
 * Les courriels qu'on peut adresser à un stagiaire, et comment retrouver leurs
 * envois passés dans email_logs : par le début de l'objet, stable par
 * construction puisque c'est ce code qui les envoie.
 */
const TYPES_APPRENANT: {
  key: MailApprenantType
  label: string
  aide: string
  match: (subject: string) => boolean
  hygieneSeulement?: boolean
  supportsSeulement?: boolean
}[] = [
  {
    key: 'convocation', label: 'Convocation',
    aide: 'PDF joint · part aussi automatiquement à J-3',
    match: (s) => s.startsWith('Convocation — '),
  },
  {
    key: 'attestation', label: 'Attestation de fin de formation',
    aide: 'Document de clôture remis au stagiaire',
    match: (s) => s.startsWith('Votre attestation de formation'),
  },
  {
    key: 'certificat', label: 'Certificat de réalisation',
    aide: 'Justificatif pour l’employeur et le financeur',
    match: (s) => s.startsWith('Votre certificat de réalisation'),
  },
  {
    key: 'hygiene', label: "Attestation d'hygiène alimentaire",
    aide: 'Arrêté du 12 février 2024 · présentée en contrôle sanitaire',
    match: (s) => s.startsWith("Votre attestation d'hygi"),
    hygieneSeulement: true,
  },
  {
    key: 'supports', label: 'Supports pédagogiques',
    aide: 'Mise à disposition tracée · lien vers le portail du stagiaire (ind. 19)',
    match: (s) => s.startsWith('Vos supports de formation'),
    supportsSeulement: true,
  },
]

/** Les courriels adressables au référent de l'établissement. */
const TYPES_REFERENT: {
  key: 'convocation_ref' | 'attestation' | 'certificat' | 'hygiene' | 'appreciation'
  label: string
  aide: string
  match: (subject: string) => boolean
  hygieneSeulement?: boolean
}[] = [
  {
    key: 'convocation_ref', label: 'Convocation de formation',
    aide: 'Participants + PDF · à transmettre aux stagiaires',
    match: (s) => s.startsWith('Convocation de formation —'),
  },
  {
    key: 'attestation', label: 'Attestations de fin de formation',
    aide: 'Un exemplaire par stagiaire, à remettre en main propre',
    match: (s) => s.startsWith('Attestations de fin de formation'),
  },
  {
    key: 'certificat', label: 'Certificats de réalisation',
    aide: 'Un exemplaire par stagiaire · justificatif pour le financeur',
    match: (s) => s.startsWith('Certificats de réalisation'),
  },
  {
    key: 'hygiene', label: "Attestations d'hygiène alimentaire",
    aide: 'PDF unique, une page par stagiaire · contrôle sanitaire',
    match: (s) => s.startsWith("Attestations d'hygi"),
    hygieneSeulement: true,
  },
  {
    key: 'appreciation', label: "Demande d'appréciation",
    aide: "L'entreprise note la prestation : quatre questions, deux minutes (ind. 30)",
    match: (s) => s.startsWith('Votre appréciation —'),
  },
]

/** Les courriels adressables au formateur. */
const TYPES_FORMATEUR_MAILS: {
  key: 'fiche' | 'contrat'
  label: string
  aide: string
  match: (subject: string) => boolean
}[] = [
  {
    key: 'fiche', label: 'Fiche mission de la session',
    aide: 'Dates, lieu, participants, déroulé',
    match: (s) => s.startsWith('Votre prochaine formation'),
  },
  {
    key: 'contrat', label: 'Contrat de prestation',
    aide: 'PDF contractuel joint · à conserver par le formateur',
    match: (s) => s.startsWith('Contrat de prestation —'),
  },
]

function StatusPill({ status, openedAt }: { status: string | null; openedAt?: string | null }) {
  const s = status || 'pending'
  if (openedAt) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600"><Eye className="h-3 w-3" /> Ouvert</span>
  if (s === 'sent') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Envoyé</span>
  if (s === 'failed') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger-600"><XCircle className="h-3 w-3" /> Échec</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><Clock className="h-3 w-3" /> En cours</span>
}

/**
 * Mails de la session.
 *
 * Le volet Apprenants est une matrice : une ligne par type de courriel, un
 * stagiaire sélectionné à gauche. Sans sélection, chaque ligne montre combien
 * de stagiaires ont reçu ce courriel et l'envoie à tout le groupe ; un
 * stagiaire sélectionné, elle montre son historique à lui et l'envoi se fait
 * après aperçu — on voit ce qui va partir avant que ça parte.
 */
export function SessionMails({
  sessionId, formateur, apprenants, contacts, emailLogs, hygiene = false, nbSupports = 0, onGoTab,
}: {
  sessionId: string
  formateur: { prenom?: string; nom?: string; email?: string | null } | null
  apprenants: Person[]
  contacts: { prenom?: string; nom?: string; poste?: string | null; email: string | null }[]
  emailLogs: EmailLog[]
  /** La formation relève de l'hygiène alimentaire réglementaire. */
  hygiene?: boolean
  /** Supports pédagogiques déposés sur la session. */
  nbSupports?: number
  onGoTab?: (t: string) => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [tab, setTab] = useState<'apprenants' | 'referent' | 'formateur'>('apprenants')
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<{ html: string; subject?: string; to?: string } | null>(null)
  const [previewKind, setPreviewKind] = useState<'formateur' | 'convocation'>('formateur')
  const [envoiApprenant, setEnvoiApprenant] = useState<{ apprenantId: string; type: MailApprenantType } | null>(null)
  const [envoiReferent, setEnvoiReferent] = useState<{ type: 'attestation' | 'certificat' | 'hygiene' } | null>(null)
  const [envoiTous, setEnvoiTous] = useState<{ type: MailApprenantType } | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [selectionne, setSelectionne] = useState<Person | null>(null)
  const [contactSel, setContactSel] = useState<Person | null>(null)

  const types = TYPES_APPRENANT.filter((t) =>
    (!t.hygieneSeulement || hygiene) && (!t.supportsSeulement || nbSupports > 0))

  const logsFor = (email?: string | null) => emailLogs.filter((l) => norm(l.to_email) === norm(email)).slice(0, 12)

  /** Dernier envoi d'un type donné pour un stagiaire donné. */
  const dernierEnvoi = (p: Person, match: (s: string) => boolean) =>
    emailLogs.find((l) => norm(l.to_email) === norm(p.email) && p.email && match(l.subject || ''))

  /**
   * Dernier envoi d'un type donné, tous contacts confondus : le serveur choisit
   * le destinataire (signataire, sinon principal), l'historique doit donc se
   * lire sur l'ensemble des adresses de l'établissement.
   */
  const dernierEnvoiParmi = (emails: (string | null)[], match: (s: string) => boolean) => {
    const set = new Set(emails.filter(Boolean).map((e) => norm(e)))
    return emailLogs.find((l) => set.has(norm(l.to_email)) && match(l.subject || ''))
  }


  /** Combien de stagiaires ont reçu ce courriel au moins une fois. */
  const compteurs = useMemo(() => {
    const out: Record<string, number> = {}
    for (const t of types) {
      out[t.key] = apprenants.filter((p) => dernierEnvoi(p, t.match)).length
    }
    return out
  }, [types, apprenants, emailLogs])

  // ── Aperçu & envoi par stagiaire ──
  async function apercuApprenant(p: Person, type: MailApprenantType) {
    if (!p.id) return
    setPreviewLoading(`${p.id}-${type}`)
    const r = await envoyerMailApprenantAction(sessionId, p.id, type, { preview: true })
    setPreviewLoading(null)
    if (r.success && r.data?.html) {
      setEnvoiReferent(null)
      setEnvoiTous(null)
      setEnvoiApprenant({ apprenantId: p.id, type })
      setPreview({ html: r.data.html, subject: r.data.subject, to: r.data.email || p.email || 'adresse inconnue' })
    } else {
      toast('error', r.error || "Impossible de générer l'aperçu")
    }
  }

  /**
   * Beaucoup de stagiaires n'ont pas d'adresse : leur employeur, si. Le
   * référent reçoit un exemplaire par stagiaire et les remet en main propre.
   */
  const [envoiAppreciation, setEnvoiAppreciation] = useState(false)
  async function apercuAppreciation() {
    setPreviewLoading('ref-appreciation')
    const r = await envoyerDemandeAppreciationAction(sessionId, { preview: true })
    setPreviewLoading(null)
    if (r.success && r.data?.html) {
      setEnvoiApprenant(null); setEnvoiReferent(null); setEnvoiTous(null)
      setEnvoiAppreciation(true)
      setPreview({ html: r.data.html, subject: r.data.subject, to: r.data.email || 'adresse inconnue' })
    } else toast('error', r.error || "Impossible de générer l'aperçu")
  }

  async function apercuReferent(type: 'attestation' | 'certificat' | 'hygiene') {
    setPreviewLoading(`ref-${type}`)
    const r = await envoyerDocumentsAuReferentAction(sessionId, type, { preview: true })
    setPreviewLoading(null)
    if (r.success && r.data?.html) {
      setEnvoiApprenant(null)
      setEnvoiTous(null)
      setEnvoiReferent({ type })
      setPreview({ html: r.data.html, subject: r.data.subject, to: r.data.email || 'adresse inconnue' })
    } else {
      toast('error', r.error || "Impossible de générer l'aperçu")
    }
  }

  async function apercuTous(type: MailApprenantType) {
    // L'aperçu montre le mail du premier stagiaire doté d'une adresse ; chaque
    // destinataire recevra le sien, personnalisé à son nom.
    const exemple = apprenants.find((p) => p.id && p.email)
    if (!exemple?.id) { toast('error', "Aucun apprenant n'a d'adresse email"); return }
    setPreviewLoading(`tous-${type}`)
    const r = await envoyerMailApprenantAction(sessionId, exemple.id, type, { preview: true })
    setPreviewLoading(null)
    if (r.success && r.data?.html) {
      setEnvoiApprenant(null)
      setEnvoiReferent(null)
      setEnvoiTous({ type })
      const avecEmail = apprenants.filter((p) => p.email).length
      setPreview({
        html: r.data.html,
        subject: r.data.subject,
        to: `Tous les apprenants (${avecEmail} avec adresse sur ${apprenants.length}) · exemple : ${exemple.email}`,
      })
    } else {
      toast('error', r.error || "Impossible de générer l'aperçu")
    }
  }

  // ── Aperçu & envoi référent / formateur (inchangés) ──
  async function openPreview(kind: 'formateur' | 'convocation') {
    setPreviewLoading(kind)
    const fn = kind === 'convocation' ? sendConvocationToReferentAction : sendSessionInfoToFormateurAction
    const r = await fn(sessionId, { preview: true })
    setPreviewLoading(null)
    if ((r as any)?.success && (r as any).data?.html) {
      setEnvoiApprenant(null)
      setEnvoiReferent(null)
      setEnvoiTous(null)
      setPreviewKind(kind)
      setPreview({ html: (r as any).data.html, subject: (r as any).data.subject, to: (r as any).data.email })
    } else {
      toast('error', (r as any)?.error || "Impossible de générer l'aperçu")
    }
  }

  function confirmSend() {
    setSending(true)
    startTransition(async () => {
      let r: any
      if (envoiAppreciation) {
        r = await envoyerDemandeAppreciationAction(sessionId)
        setSending(false)
        if (r?.success) {
          toast('success', `Demande envoyée à ${r.data?.email}`)
          setPreview(null); setEnvoiAppreciation(false); router.refresh()
        } else toast('error', r?.error || 'Erreur')
        return
      }
      if (envoiTous) {
        r = await envoyerMailATousAction(sessionId, envoiTous.type)
        setSending(false)
        if (r?.success) {
          const d = r.data || {}
          const details = [
            d.envoyes ? `${d.envoyes} envoyé(s)` : null,
            d.sansEmail ? `${d.sansEmail} sans adresse` : null,
            d.echecs ? `${d.echecs} en échec` : null,
          ].filter(Boolean).join(' · ')
          toast(d.echecs ? 'error' : 'success', details || 'Terminé')
          setPreview(null); setEnvoiTous(null); router.refresh()
        } else toast('error', r?.error || 'Erreur')
        return
      }
      if (envoiReferent) {
        r = await envoyerDocumentsAuReferentAction(sessionId, envoiReferent.type)
      } else if (envoiApprenant) {
        r = await envoyerMailApprenantAction(sessionId, envoiApprenant.apprenantId, envoiApprenant.type)
      } else {
        const fn = previewKind === 'convocation' ? sendConvocationToReferentAction : sendSessionInfoToFormateurAction
        r = await fn(sessionId)
      }
      setSending(false)
      if (r?.success) {
        toast('success', `Email envoyé${r.data?.email ? ` à ${r.data.email}` : ''}`)
        setPreview(null); setEnvoiApprenant(null); setEnvoiReferent(null); router.refresh()
      } else toast('error', r?.error || 'Erreur')
    })
  }

  const referents: Person[] = contacts.map((c) => ({
    nom: `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Contact',
    email: c.email, sub: c.poste || null,
  }))
  const formateurPerson: Person | null = formateur
    ? { nom: `${formateur.prenom || ''} ${formateur.nom || ''}`.trim(), email: formateur.email || null }
    : null

  const tabs = [
    { id: 'apprenants' as const, label: 'Apprenants', icon: Users, count: apprenants.length },
    { id: 'referent' as const, label: 'Référent', icon: UserCheck, count: referents.length },
    { id: 'formateur' as const, label: 'Formateur', icon: GraduationCap, count: formateurPerson ? 1 : 0 },
  ]


  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
        <Mail className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mails de la session</span>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 px-3 pt-2 shadow-[inset_0_-1px_0_0_theme(colors.surface.100)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] shrink-0 whitespace-nowrap text-sm font-medium border-b-2 transition-colors ${active ? 'border-surface-900 text-surface-900' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>
              <Icon className="h-4 w-4" /> {t.label}
              {t.count > 0 && <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${active ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-500'}`}>{t.count}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'apprenants' && (
        apprenants.length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-400">Aucun apprenant inscrit</div>
        ) : (
          <div className="grid md:grid-cols-[1fr,1.3fr] md:divide-x divide-surface-100">
            {/* ── Stagiaires ── */}
            <div className="divide-y divide-surface-100 max-h-[480px] overflow-y-auto">
              <button
                onClick={() => setSelectionne(null)}
                className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors',
                  !selectionne ? 'bg-surface-900 text-white' : 'text-surface-700 hover:bg-surface-50')}
              >
                Tous les apprenants
                <span className={cn('ml-2 text-2xs font-bold px-1.5 py-0.5 rounded', !selectionne ? 'bg-white/20' : 'bg-surface-100 text-surface-500')}>
                  {apprenants.length}
                </span>
              </button>
              {apprenants.map((p, i) => {
                const actif = selectionne?.id === p.id
                return (
                  <button key={p.id || i} onClick={() => setSelectionne(actif ? null : p)}
                    className={cn('w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors',
                      actif ? 'bg-surface-900 text-white' : 'hover:bg-surface-50')}>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm font-medium truncate', actif ? 'text-white' : 'text-surface-900')}>{p.nom}</div>
                      <div className={cn('text-xs truncate', actif ? 'text-white/60' : 'text-surface-400')}>
                        {p.email || 'Pas d’email'}
                      </div>
                    </div>
                    <ChevronRight className={cn('h-4 w-4 shrink-0', actif ? 'text-white/70' : 'text-surface-300')} />
                  </button>
                )
              })}
            </div>

            {/* ── Types de courriels ── */}
            <div>
              <div className="px-4 py-2.5 border-b border-surface-100 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                {selectionne ? selectionne.nom : 'Récapitulatif des envois'}
              </div>
              <div className="divide-y divide-surface-100">
                {types.map((t) => {
                  const envoi = selectionne ? dernierEnvoi(selectionne, t.match) : null
                  return (
                    <div key={t.key} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                        <div className="text-sm text-surface-900">{t.label}</div>
                        <div className="text-[11px] text-surface-400 mt-0.5">{t.aide}</div>
                      </div>

                      {!selectionne ? (
                        <>
                          <span className={cn('text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full',
                            compteurs[t.key] >= apprenants.length ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-600')}>
                            {compteurs[t.key]} / {apprenants.length}
                          </span>
                          <button onClick={() => apercuTous(t.key)} disabled={previewLoading === `tous-${t.key}`}
                            className="btn-secondary inline-flex items-center gap-1.5 !py-1 !px-2.5 min-h-[40px] sm:min-h-0 text-xs disabled:opacity-60">
                            {previewLoading === `tous-${t.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            À tous
                          </button>
                          {/*
                            Tous les exemplaires en un mail au référent de
                            l'établissement — la voie qui marche quand les
                            stagiaires n'ont pas d'adresse.
                          */}
                          {t.key !== 'convocation' && (
                            <button onClick={() => apercuReferent(t.key as 'attestation' | 'certificat' | 'hygiene')}
                              disabled={previewLoading === `ref-${t.key}`}
                              title="Envoyer les documents de tous les stagiaires au référent de l'établissement"
                              className="btn-secondary inline-flex items-center gap-1.5 !py-1 !px-2.5 min-h-[40px] sm:min-h-0 text-xs disabled:opacity-60">
                              {previewLoading === `ref-${t.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                              Au référent
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {envoi ? (
                            <span className="flex items-center gap-2 shrink-0">
                              <StatusPill status={envoi.status} openedAt={(envoi as any).opened_at} />
                              <span className="text-[11px] text-surface-400">{formatDate(envoi.sent_at || envoi.created_at, { day: 'numeric', month: 'short' })}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-surface-300 shrink-0">Jamais envoyé</span>
                          )}
                          <button
                            onClick={() => apercuApprenant(selectionne, t.key)}
                            disabled={!selectionne.email || previewLoading === `${selectionne.id}-${t.key}`}
                            title={selectionne.email ? 'Voir le mail avant envoi' : "Cet apprenant n'a pas d'adresse email"}
                            className="btn-secondary inline-flex items-center gap-1.5 !py-1 !px-2.5 min-h-[40px] sm:min-h-0 text-xs disabled:opacity-40">
                            {previewLoading === `${selectionne.id}-${t.key}`
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Eye className="h-3.5 w-3.5" />}
                            Aperçu & envoi
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Historique complet du stagiaire sélectionné */}
              {selectionne && logsFor(selectionne.email).length > 0 && (
                <div className="px-4 py-3 border-t border-surface-100">
                  <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Historique</div>
                  <div className="rounded-lg border border-surface-100 divide-y divide-surface-100">
                    {logsFor(selectionne.email).map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="text-xs text-surface-700 truncate">{l.subject}</span>
                        <span className="flex items-center gap-3 shrink-0">
                          <StatusPill status={l.status} openedAt={(l as any).opened_at} />
                          <span className="text-[11px] text-surface-400">{formatDate(l.sent_at || l.created_at, { day: 'numeric', month: 'short' })}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {tab === 'referent' && (
        referents.length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-400">Aucun contact référent sur le client</div>
        ) : (
          <div className="grid md:grid-cols-[1fr,1.3fr] md:divide-x divide-surface-100">
            {/* ── Contacts de l'établissement ── */}
            <div className="divide-y divide-surface-100 max-h-[480px] overflow-y-auto">
              {referents.map((p, i) => {
                const actif = contactSel?.email === p.email && contactSel?.nom === p.nom
                return (
                  <button key={i} onClick={() => setContactSel(actif ? null : p)}
                    className={cn('w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors',
                      actif ? 'bg-surface-900 text-white' : 'hover:bg-surface-50')}>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm font-medium truncate', actif ? 'text-white' : 'text-surface-900')}>
                        {p.nom}{p.sub ? <span className={cn('font-normal', actif ? 'text-white/60' : 'text-surface-400')}> · {p.sub}</span> : null}
                      </div>
                      <div className={cn('text-xs truncate', actif ? 'text-white/60' : 'text-surface-400')}>
                        {p.email || 'Pas d’email'}
                      </div>
                    </div>
                    <ChevronRight className={cn('h-4 w-4 shrink-0', actif ? 'text-white/70' : 'text-surface-300')} />
                  </button>
                )
              })}
            </div>

            {/* ── Types de courriels ── */}
            <div>
              <div className="px-4 py-2.5 border-b border-surface-100 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                Envois au référent
              </div>
              <div className="divide-y divide-surface-100">
                {TYPES_REFERENT.filter((t) => !t.hygieneSeulement || hygiene).map((t) => {
                  const envoi = dernierEnvoiParmi(referents.map((r) => r.email), t.match)
                  const cle = t.key === 'convocation_ref' ? 'convocation' : `ref-${t.key}`
                  return (
                    <div key={t.key} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                        <div className="text-sm text-surface-900">{t.label}</div>
                        <div className="text-[11px] text-surface-400 mt-0.5">{t.aide}</div>
                      </div>
                      {envoi ? (
                        <span className="flex items-center gap-2 shrink-0">
                          <StatusPill status={envoi.status} openedAt={(envoi as any).opened_at} />
                          <span className="text-[11px] text-surface-400">{formatDate(envoi.sent_at || envoi.created_at, { day: 'numeric', month: 'short' })}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-surface-300 shrink-0">Jamais envoyé</span>
                      )}
                      <button
                        onClick={() => t.key === 'convocation_ref'
                          ? openPreview('convocation')
                          : t.key === 'appreciation'
                            ? apercuAppreciation()
                            : apercuReferent(t.key as 'attestation' | 'certificat' | 'hygiene')}
                        disabled={previewLoading === cle}
                        className="btn-secondary inline-flex items-center gap-1.5 !py-1 !px-2.5 min-h-[40px] sm:min-h-0 text-xs disabled:opacity-40">
                        {previewLoading === cle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        Aperçu & envoi
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Historique du contact sélectionné, sinon de tous les contacts */}
              {(() => {
                const logs = contactSel
                  ? logsFor(contactSel.email)
                  : referents.flatMap((r) => logsFor(r.email)).slice(0, 12)
                if (logs.length === 0) return null
                return (
                  <div className="px-4 py-3 border-t border-surface-100">
                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">
                      Historique{contactSel ? ` — ${contactSel.nom}` : ''}
                    </div>
                    <div className="rounded-lg border border-surface-100 divide-y divide-surface-100">
                      {logs.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <span className="text-xs text-surface-700 truncate">{l.subject}</span>
                          <span className="flex items-center gap-3 shrink-0">
                            <StatusPill status={l.status} openedAt={(l as any).opened_at} />
                            <span className="text-[11px] text-surface-400">{formatDate(l.sent_at || l.created_at, { day: 'numeric', month: 'short' })}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      )}

      {tab === 'formateur' && (
        !formateurPerson ? (
          <div className="text-center py-8 text-sm text-surface-400">Aucun formateur rattaché</div>
        ) : (
          <div className="grid md:grid-cols-[1fr,1.3fr] md:divide-x divide-surface-100">
            <div className="px-4 py-2.5">
              <div className="text-sm font-medium text-surface-900 truncate">{formateurPerson.nom}</div>
              <div className="text-xs text-surface-400 truncate">{formateurPerson.email || 'Pas d’email'}</div>
            </div>

            <div>
              <div className="px-4 py-2.5 border-b border-surface-100 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                Envois au formateur
              </div>
              <div className="divide-y divide-surface-100">
                {TYPES_FORMATEUR_MAILS.map((t) => {
                  const envoi = dernierEnvoi(formateurPerson, t.match)
                  return (
                    <div key={t.key} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                        <div className="text-sm text-surface-900">{t.label}</div>
                        <div className="text-[11px] text-surface-400 mt-0.5">{t.aide}</div>
                      </div>
                      {envoi ? (
                        <span className="flex items-center gap-2 shrink-0">
                          <StatusPill status={envoi.status} openedAt={(envoi as any).opened_at} />
                          <span className="text-[11px] text-surface-400">{formatDate(envoi.sent_at || envoi.created_at, { day: 'numeric', month: 'short' })}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-surface-300 shrink-0">Jamais envoyé</span>
                      )}
                      {t.key === 'fiche' ? (
                        <button onClick={() => openPreview('formateur')}
                          disabled={!formateurPerson.email || previewLoading === 'formateur'}
                          className="btn-secondary inline-flex items-center gap-1.5 !py-1 !px-2.5 min-h-[40px] sm:min-h-0 text-xs disabled:opacity-40">
                          {previewLoading === 'formateur' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                          Aperçu & envoi
                        </button>
                      ) : (
                        <button onClick={() => onGoTab?.('conventions')}
                          className="btn-secondary inline-flex items-center gap-1.5 !py-1 !px-2.5 min-h-[40px] sm:min-h-0 text-xs">
                          <FileSignature className="h-3.5 w-3.5" />
                          Gérer dans Contractualisation
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {logsFor(formateurPerson.email).length > 0 && (
                <div className="px-4 py-3 border-t border-surface-100">
                  <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Historique</div>
                  <div className="rounded-lg border border-surface-100 divide-y divide-surface-100">
                    {logsFor(formateurPerson.email).map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="text-xs text-surface-700 truncate">{l.subject}</span>
                        <span className="flex items-center gap-3 shrink-0">
                          <StatusPill status={l.status} openedAt={(l as any).opened_at} />
                          <span className="text-[11px] text-surface-400">{formatDate(l.sent_at || l.created_at, { day: 'numeric', month: 'short' })}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      )}

      <div className="px-4 py-2 bg-surface-50/60 text-[11px] text-surface-500 border-t border-surface-100">
        Chaque email envoyé depuis le CRM (convocations, attestations, infos formateur…) est tracé ici, par destinataire.
      </div>

      {/* Aperçu de l'email avant envoi */}
      <Modal isOpen={!!preview} onClose={() => { setPreview(null); setEnvoiApprenant(null); setEnvoiReferent(null); setEnvoiTous(null) }} title="Aperçu de l'email" size="lg">
        {preview && (
          <div className="space-y-3">
            <div className="text-xs text-surface-500">
              <div><span className="font-semibold text-surface-700">À :</span> {preview.to}</div>
              <div><span className="font-semibold text-surface-700">Objet :</span> {preview.subject}</div>
            </div>
            <div className="rounded-xl border border-surface-200 overflow-hidden bg-white">
              <iframe title="Aperçu email" srcDoc={preview.html} className="w-full" style={{ height: 460, border: 0 }} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => { setPreview(null); setEnvoiApprenant(null); setEnvoiReferent(null); setEnvoiTous(null) }}>Annuler</Button>
              <Button onClick={confirmSend} isLoading={sending || pending} icon={<Send className="h-4 w-4" />}>Confirmer l'envoi</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
