'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Send, GraduationCap, Award, Users, Check, Loader2, PenLine, ArrowLeft, ArrowRight, Eye, Paperclip, AlertTriangle, ClipboardCheck, ShieldCheck, Download } from '@/components/ui/icons'
import { Button, Modal, Input, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { PoeiSection } from './PoeiSection'
import { sendAttestationsEntreeAction, sendGroupEmailToCandidatsAction, getPoeiEmailTemplatesAction } from '../actions'
import { sendCertificatSignatureAction, sendAllCertificatSignaturesAction } from '../certificat-signature-actions'
import { apercuEnvoiPoeiAction, type ApercuMail } from '../apercu-mail-actions'
import { envoyerEvaluationsFormateursAction } from '../evaluation-formateur-actions'
import { envoyerHygienePoeiAction } from '../hygiene-poei-actions'

export interface CandidatMail {
  id: string
  nom: string
  email: string | null
  apprenantId: string | null
  attestationEnvoyeeLe?: string | null
  certificatEnvoyeLe?: string | null
  certificatSigneLe?: string | null
}

export interface FormateurMail { id: string; nom: string }
export type EtatEvaluation = { id: string; statut: string; date: string | null; note: number | null }

type TypeEnvoi = 'attestation' | 'certificat' | 'libre' | 'evaluation_formateur' | 'hygiene'

const TYPES: { cle: TypeEnvoi; titre: string; sous: string; icone: React.ElementType }[] = [
  { cle: 'attestation', titre: "Attestation d'entrée en formation", sous: 'À envoyer au démarrage du parcours', icone: GraduationCap },
  { cle: 'certificat', titre: 'Certificat de réalisation à signer', sous: 'Lien de signature envoyé en fin de parcours', icone: Award },
  { cle: 'libre', titre: 'Message libre', sous: 'Courrier personnalisé, avec ou sans pièce jointe', icone: PenLine },
  { cle: 'hygiene', titre: 'Attestations d’hygiène et diplôme de l’établissement', sous: 'Envoyés au référent en fin de parcours, une attestation par candidat', icone: ShieldCheck },
  { cle: 'evaluation_formateur', titre: 'Évaluation du formateur par le référent', sous: 'Un questionnaire par formateur, adressé au référent de l’établissement', icone: ClipboardCheck },
]

/** Durée du module hygiène alimentaire portée sur les attestations (modifiable, jamais 0). */
const HEURES_HYGIENE_DEFAUT = 14

/**
 * Centre d'envoi du dossier : on choisit un type d'envoi, les destinataires,
 * puis on VOIT chaque email tel qu'il partira (un aperçu par candidat, même
 * gabarit et mêmes textes que l'envoi réel) avant de confirmer.
 */
export function PoeiMails({
  poeiId, candidats, historique, formateurs = [], etatEvaluations = {}, referent = null,
}: {
  poeiId: string
  candidats: CandidatMail[]
  historique: React.ReactNode
  /** Formateurs intervenus sur la POEI (évaluation par le référent). */
  formateurs?: FormateurMail[]
  etatEvaluations?: Record<string, EtatEvaluation>
  /** Référent de l'établissement, destinataire des évaluations formateur. */
  referent?: { nom: string; email: string } | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [type, setType] = useState<TypeEnvoi | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [selectionFormateurs, setSelectionFormateurs] = useState<string[]>([])
  const [selectionHygiene, setSelectionHygiene] = useState<string[]>([])
  const [heuresHygiene, setHeuresHygiene] = useState<string>(String(HEURES_HYGIENE_DEFAUT))
  const [sujet, setSujet] = useState('')
  const [message, setMessage] = useState('')
  const [templates, setTemplates] = useState<{ slug: string; nom: string; sujet: string; corps_texte: string }[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [chargementApercu, setChargementApercu] = useState(false)
  const [apercus, setApercus] = useState<ApercuMail[] | null>(null)
  const [index, setIndex] = useState(0)

  const avecEmail = candidats.filter((c) => c.email)

  async function ouvrir(t: TypeEnvoi) {
    setType(t)
    setApercus(null)
    setIndex(0)
    setSelection(avecEmail.map((c) => c.id))
    setSelectionFormateurs(formateurs.filter((f) => etatEvaluations[f.id]?.statut !== 'repondu').map((f) => f.id))
    setSelectionHygiene(candidats.filter((c) => c.apprenantId).map((c) => c.id))
    if (t === 'libre') {
      setSujet('')
      setMessage('')
      const r = await getPoeiEmailTemplatesAction()
      if (r.success) setTemplates((r.data as any[]) || [])
    }
  }

  function fermer() { setType(null); setApercus(null); setIndex(0) }

  function basculer(id: string) {
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function previsualiser() {
    if (type === 'hygiene') {
      const heures = Number(heuresHygiene)
      if (!selectionHygiene.length) { toast('error', 'Aucun candidat sélectionné'); return }
      if (!(heures > 0)) { toast('error', 'Indiquez la durée du module hygiène (jamais 0 heure)'); return }
      setChargementApercu(true)
      const r = await envoyerHygienePoeiAction(poeiId, { candidatIds: selectionHygiene, heures, preview: true })
      setChargementApercu(false)
      if (r.success && r.data?.apercus) { setApercus(r.data.apercus); setIndex(0) }
      else toast('error', r.error || "Impossible de préparer l'aperçu")
      return
    }
    if (type === 'evaluation_formateur') {
      if (selectionFormateurs.length === 0) { toast('error', 'Aucun formateur sélectionné'); return }
      setChargementApercu(true)
      const r = await envoyerEvaluationsFormateursAction(poeiId, selectionFormateurs, { preview: true })
      setChargementApercu(false)
      if (r.success && r.data?.apercus) { setApercus(r.data.apercus); setIndex(0) }
      else toast('error', r.error || "Impossible de préparer l'aperçu")
      return
    }
    if (selection.length === 0) { toast('error', 'Aucun destinataire sélectionné'); return }
    if (type === 'libre' && (!sujet.trim() || !message.trim())) { toast('error', 'Sujet et message sont requis'); return }
    setChargementApercu(true)
    const r = await apercuEnvoiPoeiAction(poeiId, type!, selection, type === 'libre' ? { subject: sujet, message } : undefined)
    setChargementApercu(false)
    if (r.success && r.data) { setApercus(r.data.apercus); setIndex(0) }
    else toast('error', r.error || "Impossible de préparer l'aperçu")
  }

  async function envoyer() {
    if (type === 'hygiene') {
      setEnvoi(true)
      const r = await envoyerHygienePoeiAction(poeiId, { candidatIds: selectionHygiene, heures: Number(heuresHygiene) })
      setEnvoi(false)
      if (r.success) {
        toast('success', `Attestations d'hygiène et diplôme envoyés à ${r.data?.referent?.email || 'l’établissement'}`)
        fermer()
        router.refresh()
      } else toast('error', r.error || "L'envoi a échoué")
      return
    }
    if (type === 'evaluation_formateur') {
      setEnvoi(true)
      const r = await envoyerEvaluationsFormateursAction(poeiId, selectionFormateurs)
      setEnvoi(false)
      if (r.success) {
        toast('success', `Questionnaire${(r.data?.sent || 0) > 1 ? 's' : ''} envoyé${(r.data?.sent || 0) > 1 ? 's' : ''} à ${r.data?.referent?.email || 'référent'}${r.data?.skipped?.length ? ` (ignorés : ${r.data.skipped.join(', ')})` : ''}`)
        fermer()
        router.refresh()
      } else toast('error', r.error || "L'envoi a échoué")
      return
    }
    if (selection.length === 0) { toast('error', 'Aucun destinataire sélectionné'); return }
    setEnvoi(true)
    let r: any
    if (type === 'attestation') {
      r = await sendAttestationsEntreeAction(poeiId, selection)
    } else if (type === 'certificat') {
      // Un lien de signature est propre à chaque candidat : envoi individuel.
      const cibles = candidats.filter((c) => selection.includes(c.id) && c.apprenantId)
      if (cibles.length === candidats.filter((c) => c.apprenantId).length) {
        r = await sendAllCertificatSignaturesAction(poeiId)
      } else {
        const res = await Promise.all(cibles.map((c) => sendCertificatSignatureAction(poeiId, c.apprenantId!)))
        const ok = res.filter((x: any) => x.success).length
        r = { success: ok > 0, data: { sent: ok }, error: ok === 0 ? 'Aucun envoi abouti' : undefined }
      }
    } else {
      r = await sendGroupEmailToCandidatsAction(poeiId, selection, { subject: sujet, message })
    }
    setEnvoi(false)
    if (r?.success) {
      toast('success', `Envoi effectué${r.data?.sent ? `, ${r.data.sent} destinataire(s)` : ''}`)
      fermer()
      router.refresh()
    } else toast('error', r?.error || "L'envoi a échoué")
  }

  const etatPour = (c: CandidatMail, t: TypeEnvoi) => {
    if (t === 'attestation') return c.attestationEnvoyeeLe ? `Envoyée le ${formatDate(c.attestationEnvoyeeLe)}` : null
    if (t === 'certificat') {
      if (c.certificatSigneLe) return `Signé le ${formatDate(c.certificatSigneLe)}`
      if (c.certificatEnvoyeLe) return `Envoyé le ${formatDate(c.certificatEnvoyeLe)}`
    }
    return null
  }

  const courant = apercus ? apercus[Math.min(index, apercus.length - 1)] : null
  const nbEnvoyables = apercus ? apercus.filter((a) => a.html).length : 0

  return (
    <PoeiSection
      icone={Mail}
      titre="Envois aux candidats"
      sous="Choisissez un type d'envoi, les destinataires, puis vérifiez chaque email avant de confirmer."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TYPES.map((t) => {
          const Icone = t.icone
          const estEval = t.cle === 'evaluation_formateur'
          const estHygiene = t.cle === 'hygiene'
          const total = estEval ? formateurs.length : candidats.length
          const faits = t.cle === 'attestation'
            ? candidats.filter((c) => c.attestationEnvoyeeLe).length
            : t.cle === 'certificat'
              ? candidats.filter((c) => c.certificatEnvoyeLe || c.certificatSigneLe).length
              : estEval
                ? formateurs.filter((f) => etatEvaluations[f.id]?.statut === 'repondu').length
                : null
          const inactif = estEval
            ? (formateurs.length === 0 || !referent)
            : estHygiene
              ? (candidats.length === 0 || !referent)
              : avecEmail.length === 0
          return (
            <button
              key={t.cle}
              onClick={() => ouvrir(t.cle)}
              disabled={inactif}
              title={(estEval || estHygiene) && !referent ? 'Aucun référent avec email sur la fiche client' : undefined}
              className="card p-4 text-left hover:border-surface-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-2">
                <Icone className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
                {faits !== null && (
                  <span className={cn(
                    'text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
                    faits === total && total > 0 ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700',
                  )}>
                    {faits}/{total}
                  </span>
                )}
              </div>
              <div className="text-sm font-heading font-semibold text-surface-900 mt-2">{t.titre}</div>
              <div className="text-xs text-surface-500 mt-0.5">{t.sous}</div>
            </button>
          )
        })}
      </div>

      {avecEmail.length === 0 && candidats.length > 0 && (
        <div className="card p-4 border-warning-200 bg-warning-50/50 text-sm text-surface-700">
          Aucun candidat n&apos;a d&apos;adresse e-mail : complétez leurs fiches dans l&apos;onglet Candidats.
        </div>
      )}

      {historique}

      <Modal
        isOpen={!!type}
        onClose={fermer}
        title={apercus ? `Aperçu avant envoi, ${TYPES.find((t) => t.cle === type)?.titre || ''}` : (TYPES.find((t) => t.cle === type)?.titre || 'Envoi')}
        size="lg"
      >
        {apercus && courant ? (
          /* ── Étape 2 : l'aperçu, un email par candidat ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="h-10 w-10 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-full border border-surface-200 text-surface-600 hover:bg-surface-50 disabled:opacity-40"
                  aria-label="Email précédent"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-surface-700 tabular-nums">
                  Email {index + 1} / {apercus.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(apercus.length - 1, i + 1))}
                  disabled={index >= apercus.length - 1}
                  className="h-10 w-10 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-full border border-surface-200 text-surface-600 hover:bg-surface-50 disabled:opacity-40"
                  aria-label="Email suivant"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {apercus.map((a, i) => (
                  <button
                    key={a.candidatId}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      'text-xs px-2.5 py-2 sm:py-1 rounded-full border transition-colors',
                      i === index ? 'bg-surface-900 text-white border-surface-900' : 'border-surface-200 text-surface-600 hover:border-surface-400',
                      a.avertissement && i !== index && 'border-warning-300 text-warning-700',
                    )}
                  >
                    {a.nom}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-surface-200 overflow-hidden">
              <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 space-y-1">
                <div className="text-xs text-surface-500">
                  À : <span className="text-surface-800">{courant.nom}</span> <span className="text-surface-500">&lt;{courant.to}&gt;</span>
                </div>
                {courant.subject && (
                  <div className="text-sm font-semibold text-surface-900">{courant.subject}</div>
                )}
                {courant.pieceJointe && (
                  <div className="text-xs text-surface-600 inline-flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> {courant.pieceJointe}
                    <span className="text-surface-400">(PDF généré à l&apos;envoi)</span>
                  </div>
                )}
                {courant.avertissement && (
                  <div className="text-xs text-warning-700 inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> {courant.avertissement}
                  </div>
                )}
              </div>
              {courant.html ? (
                <iframe
                  title={`Aperçu de l'email pour ${courant.nom}`}
                  srcDoc={courant.html}
                  sandbox=""
                  className="w-full h-[60vh] sm:h-[480px] bg-white"
                />
              ) : (
                <div className="p-6 text-sm text-surface-500">Aucun email ne sera envoyé à ce candidat.</div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="secondary" onClick={() => setApercus(null)} icon={<ArrowLeft className="h-4 w-4" />}>
                Modifier
              </Button>
              <div className="flex flex-wrap justify-end gap-2 ml-auto">
                <Button variant="secondary" onClick={fermer}>Annuler</Button>
                <Button onClick={envoyer} isLoading={envoi} icon={<Send className="h-4 w-4" />} disabled={nbEnvoyables === 0}>
                  Confirmer l&apos;envoi à {nbEnvoyables} candidat{nbEnvoyables > 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Étape 1 : rédaction et destinataires ── */
          <div className="space-y-4">
            {type === 'libre' && (
              <>
                {templates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => { setSujet(t.sujet); setMessage(t.corps_texte) }}
                        className="text-xs px-2.5 py-2 sm:py-1 rounded-full border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-700"
                      >
                        {t.nom}
                      </button>
                    ))}
                  </div>
                )}
                <Input id="sujet" label="Sujet" value={sujet} onChange={(e) => setSujet(e.target.value)} />
                <div>
                  <label htmlFor="msg" className="block text-sm font-medium text-surface-700 mb-1.5">Message</label>
                  <textarea id="msg" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className="input-base w-full resize-none" />
                  <p className="mt-1 text-xs text-surface-400">
                    Variables : {'{prenom} {nom} {formation} {entreprise} {dates} {lieu} {horaires} {formateur} {planning}'}
                  </p>
                </div>
              </>
            )}

            {type === 'hygiene' ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm">
                  <span className="text-surface-500">Destinataire : </span>
                  {referent ? (
                    <span className="text-surface-900">{referent.nom || 'Référent'} <span className="text-surface-500">&lt;{referent.email}&gt;</span></span>
                  ) : (
                    <span className="text-danger-700">aucun référent avec email sur la fiche client</span>
                  )}
                  <div className="text-xs text-surface-500 mt-0.5">Un seul email : les attestations d’hygiène des candidats cochés (une page chacun) et le diplôme de l’établissement en pièces jointes.</div>
                </div>
                <label className="block text-sm font-medium text-surface-700">
                  Durée du module hygiène alimentaire portée sur les attestations (heures)
                  <input type="number" min={1} step={0.5} value={heuresHygiene} onChange={(e) => setHeuresHygiene(e.target.value)} className="input-base mt-1.5 w-40" />
                </label>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="section-label">Candidats ({selectionHygiene.length}/{candidats.length})</span>
                    <button
                      type="button"
                      onClick={() => setSelectionHygiene(selectionHygiene.length === candidats.length ? [] : candidats.map((c) => c.id))}
                      className="text-xs text-brand-600 hover:underline min-h-[40px] sm:min-h-0 inline-flex items-center"
                    >
                      {selectionHygiene.length === candidats.length ? 'Tout décocher' : 'Tout sélectionner'}
                    </button>
                  </div>
                  <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 max-h-64 overflow-y-auto">
                    {candidats.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={selectionHygiene.includes(c.id)}
                          onChange={() => setSelectionHygiene((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                          className="h-4 w-4 rounded border-surface-300 text-brand-600"
                        />
                        <span className="min-w-0 flex-1 text-sm text-surface-800 truncate">{c.nom}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : type === 'evaluation_formateur' ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm">
                  <span className="text-surface-500">Destinataire : </span>
                  {referent ? (
                    <span className="text-surface-900">{referent.nom || 'Référent'} <span className="text-surface-500">&lt;{referent.email}&gt;</span></span>
                  ) : (
                    <span className="text-danger-700">aucun référent avec email sur la fiche client</span>
                  )}
                  <div className="text-xs text-surface-500 mt-0.5">Le référent reçoit un questionnaire distinct pour chaque formateur coché.</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="section-label">Formateurs ({selectionFormateurs.length}/{formateurs.length})</span>
                    <button
                      type="button"
                      onClick={() => setSelectionFormateurs(selectionFormateurs.length === formateurs.length ? [] : formateurs.map((f) => f.id))}
                      className="text-xs text-brand-600 hover:underline min-h-[40px] sm:min-h-0 inline-flex items-center"
                    >
                      {selectionFormateurs.length === formateurs.length ? 'Tout décocher' : 'Tout sélectionner'}
                    </button>
                  </div>
                  <div className="rounded-xl border border-surface-200 divide-y divide-surface-100">
                    {formateurs.map((f) => {
                      const etat = etatEvaluations[f.id]
                      return (
                        <label key={f.id} className="flex items-center gap-3 px-3 py-2 min-h-[44px] flex-wrap">
                          <input
                            type="checkbox"
                            checked={selectionFormateurs.includes(f.id)}
                            onChange={() => setSelectionFormateurs((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                            className="h-4 w-4 rounded border-surface-300 text-brand-600"
                          />
                          <span className="min-w-0 flex-1 text-sm text-surface-800 truncate">{f.nom}</span>
                          {etat?.statut === 'repondu' && (
                            <span className="text-[11px] text-success-600 shrink-0 inline-flex items-center gap-1">
                              <Check className="h-3 w-3" /> Évalué{etat.note != null ? ` ${etat.note}/5` : ''}{etat.date ? ` le ${formatDate(etat.date)}` : ''}
                              <a href={`/api/pdf/evaluation-formateur-referent/${etat.id}`} target="_blank" rel="noreferrer"
                                title="Télécharger l'évaluation en PDF"
                                className="ml-1 inline-flex items-center gap-0.5 rounded-md border border-success-200 bg-white px-1.5 py-0.5 text-success-700 hover:bg-success-50">
                                <Download className="h-3 w-3" /> PDF
                              </a>
                            </span>
                          )}
                          {etat?.statut === 'envoye' && (
                            <span className="text-[11px] text-surface-500 shrink-0">Envoyé{etat.date ? ` le ${formatDate(etat.date)}` : ''}, en attente</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="section-label">Destinataires ({selection.length}/{avecEmail.length})</span>
                <button
                  type="button"
                  onClick={() => setSelection(selection.length === avecEmail.length ? [] : avecEmail.map((c) => c.id))}
                  className="text-xs text-brand-600 hover:underline min-h-[40px] sm:min-h-0 inline-flex items-center"
                >
                  {selection.length === avecEmail.length ? 'Tout décocher' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 max-h-64 overflow-y-auto">
                {candidats.map((c) => {
                  const etat = type ? etatPour(c, type) : null
                  return (
                    <label
                      key={c.id}
                      className={cn('flex items-center gap-3 px-3 py-2 min-h-[44px]', !c.email && 'opacity-50 cursor-not-allowed')}
                    >
                      <input
                        type="checkbox"
                        checked={selection.includes(c.id)}
                        disabled={!c.email}
                        onChange={() => basculer(c.id)}
                        className="h-4 w-4 rounded border-surface-300 text-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-surface-800 truncate">{c.nom}</span>
                        <span className="block text-xs text-surface-500 truncate">{c.email || 'Pas d’adresse e-mail'}</span>
                      </span>
                      {etat && (
                        <span className="text-[11px] text-success-600 shrink-0 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" />{etat}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={fermer}>Annuler</Button>
              <Button onClick={previsualiser} isLoading={chargementApercu} icon={<Eye className="h-4 w-4" />}>
                {type === 'evaluation_formateur'
                  ? `Prévisualiser (${selectionFormateurs.length} questionnaire${selectionFormateurs.length > 1 ? 's' : ''})`
                  : type === 'hygiene'
                    ? `Prévisualiser (${selectionHygiene.length} attestation${selectionHygiene.length > 1 ? 's' : ''} + diplôme)`
                    : `Prévisualiser (${selection.length} candidat${selection.length > 1 ? 's' : ''})`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PoeiSection>
  )
}
