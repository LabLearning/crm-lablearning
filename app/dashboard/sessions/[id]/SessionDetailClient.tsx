'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ApprenantHoverCard } from '@/components/apprenants/ApprenantHoverCard'
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, UserCheck, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, LogIn, LogOut, FileText, Plus, Loader2,
  GraduationCap, Mail, Phone, Building2, Camera, PenTool, Download,
  Star, ListChecks, FileSignature, Award, Euro, BookOpen, ClipboardList, FolderCheck, Mails, Route,
  QrCode, ChevronRight, CheckCircle, MinusCircle, Trash2, Pencil, Sparkles, ReceiptEuro, Printer,
  TrendingUp,
  ShieldCheck as PackHygieneIcon,
} from '@/components/ui/icons'
import { Badge, PoeiBadge, useToast, RowMenu, Modal, BackLink } from '@/components/ui'
import { SessionRetourClient } from './SessionRetourClient'
import { DerouleOperationnel } from '@/components/deroule/DerouleOperationnel'
import { PiecesDossier } from '@/components/sessions/PiecesDossier'
import { etatDeroule } from '@/lib/dpo'
import { ApprenantForm } from '@/app/dashboard/apprenants/ApprenantForm'
import { sendDocumentToApprenantAction } from '../actions'
import { estFormationHygiene } from '@/lib/formation-hygiene'
import { dernierEnvoiDoc } from '@/lib/emails-session'
import { cn, formatDate, companyLabel } from '@/lib/utils'
import { updateSessionStatusAction, togglePresenceAction, updateCoutFormateurAction, updateSessionPrixAction, desinscrireApprenantAction } from './actions'
import { SessionParticipants } from './SessionParticipants'
import { SessionDocsTab } from './SessionDocsTab'
import { SessionPackHygiene } from './SessionPackHygiene'
import { LiensSignatureEmargement } from '@/components/sessions/LiensSignatureEmargement'
import { SessionDocuments } from './SessionDocuments'
import { SessionMails } from './SessionMails'
import { FacturationOpco } from './FacturationOpco'
import { SessionAgefice } from './SessionAgefice'
import { SessionRentabilite } from './SessionRentabilite'
import { SaisieQuestionnaire } from '@/components/qcm/SaisieQuestionnaire'
import { SaisieRapide } from '@/components/qcm/SaisieRapide'
import { DetailReponse } from '@/components/qcm/DetailReponse'
import { marquerJourneePresentAction } from './actions'
import { SessionContenuPedagogique } from './SessionContenuPedagogique'
import { SessionRecueil } from './SessionRecueil'
import { SessionForm } from '../SessionForm'
import type { BadgeVariant } from '@/lib/types'

const CONVENTION_STATUS: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'danger' }> = {
  brouillon: { label: 'Brouillon', variant: 'default' },
  envoyee: { label: 'Envoyée', variant: 'info' },
  signee_client: { label: 'Signée client', variant: 'success' },
  signee_of: { label: 'Signée OF', variant: 'success' },
  signee_complete: { label: 'Signée (complète)', variant: 'success' },
  annulee: { label: 'Annulée', variant: 'danger' },
}

interface Props {
  session: any
  dossiersAgefice?: any[]
  clientsApprenants?: any[]
  inscriptions: any[]
  emargements: any[]
  pointages: any[]
  rapport: any
  retoursClient?: any[]
  evaluations?: any[]
  qcmSessions?: any[]
  qcmReponses?: any[]
  qcmBank?: any[]
  conventions?: any[]
  contratFormateur?: any
  formationsRef?: any[]
  formateursRef?: any[]
  clientsRef?: any[]
  clientContacts?: any[]
  emailLogs?: any[]
  docEmailLogs?: any[]
  opcos?: any[]
  factureOpco?: any
  accordPec?: any
  apprenantsRef?: any[]
  sessionFormationIds?: string[]
  evaluationsAppr?: any[]
  supports?: any[]
  positionnement?: any[]
  isFormateur: boolean
  userRole: string
  isPoei?: boolean
  recueilTemplates?: any[]
  recueil?: any
  formationIntitule?: string
  nbEvalAcquis?: number
  derouleValidations?: any[]
  derouleTableManquante?: boolean
  socleEtat?: any[]
  etatsPieces?: any[]
  piecesTableManquante?: boolean
  estHygiene?: boolean
  rentabilite?: any
}

const QCM_TYPE_LABELS: Record<string, string> = {
  positionnement: 'Positionnement',
  entree: "Évaluation d'entrée",
  sortie: 'Évaluation des acquis',
  satisfaction_chaud: 'Satisfaction à chaud',
  satisfaction_froid: 'Satisfaction à froid',
}

// Convention de couleur commune (cf. SESSION_STATUS_COLORS)
const SESSION_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  planifiee: { label: 'Planifiée', variant: 'info' },
  confirmee: { label: 'Confirmée', variant: 'info' },
  en_cours: { label: 'En cours', variant: 'success' },
  terminee: { label: 'Terminée', variant: 'purple' },
  annulee: { label: 'Annulée', variant: 'danger' },
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planifiee: ['confirmee', 'annulee'],
  confirmee: ['en_cours', 'annulee'],
  en_cours: ['terminee'],
  terminee: [],
  annulee: [],
}

export function SessionDetailClient({ session, inscriptions, emargements, pointages, rapport, evaluations = [], qcmSessions = [], qcmReponses = [], qcmBank = [], conventions = [], contratFormateur = null, formationsRef = [], formateursRef = [], clientsRef = [], clientContacts = [], emailLogs = [], docEmailLogs = [], opcos = [], factureOpco = null, accordPec = null, apprenantsRef = [], sessionFormationIds = [], evaluationsAppr = [], supports = [], positionnement = [], retoursClient = [], isFormateur, userRole, isPoei, recueilTemplates = [], recueil = null, formationIntitule = '', nbEvalAcquis = 0, derouleValidations = [], derouleTableManquante = false, socleEtat = [], estHygiene = false, etatsPieces = [], piecesTableManquante = false, dossiersAgefice = [], clientsApprenants = [], rentabilite = null }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  // Pastille de l'onglet : jalons du socle non couverts + étapes terrain manquantes
  const socleManquants = socleEtat.filter((s: any) => !s.fait).length
  const derouleIncomplet = socleManquants + (estHygiene ? etatDeroule(derouleValidations).manquantes.length : 0)

  const [saisie, setSaisie] = useState<{ id: string; nom: string } | null>(null)
  const [rapide, setRapide] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [jourEnCours, setJourEnCours] = useState<string | null>(null)
  const [scanEnCours, setScanEnCours] = useState(false)

  // Le scan de la feuille papier est la pièce justificative : on y accède
  // depuis l'onglet Émargement, là où on la cherche, pas seulement au Dossier.
  const scanEmargement = (etatsPieces as any[]).find(
    (p: any) => p.cle === 'emargement' && p.documentId,
  )?.documentId as string | undefined

  async function ouvrirScanEmargement() {
    if (!scanEmargement) return
    setScanEnCours(true)
    const { lienPieceAction } = await import('./pieces-actions')
    const r = await lienPieceAction(scanEmargement)
    setScanEnCours(false)
    if ((r as any).success) window.open(((r as any).data as any).url, '_blank')
    else toast('error', (r as any).error || 'Lien indisponible')
  }

  // Le formateur a fait signer sur papier : cocher trente cases une par une
  // n'apporte rien de plus que de cocher la journée.
  async function marquerJournee(date: string) {
    setJourEnCours(date)
    const r = await marquerJourneePresentAction(session.id, date)
    setJourEnCours(null)
    if ((r as any).success) {
      toast('success', `${(r as any).data?.marques ?? 0} présence(s) enregistrée(s)`)
      router.refresh()
    } else toast('error', (r as any).error || 'Erreur')
  }
  const estAgefice = dossiersAgefice.length > 0 || (session as any).client?.financeur_type === 'agefice'
  const [tab, setTab] = useState<'session' | 'presences' | 'apprenants' | 'pointages' | 'rapport' | 'evaluations' | 'qcm' | 'conventions' | 'docs' | 'contenu' | 'recueil' | 'deroule' | 'dossier' | 'mails' | 'facturation' | 'pack'>(() => {
    // Arrivée ciblée (ex. ?tab=facturation depuis la vue AGEFICE)
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab')
      const ALIAS: Record<string, string> = { pointages: 'session', evaluations: 'qcm', contenu: 'docs', deroule: 'dossier' }
      if (t) return (ALIAS[t] || t) as any
    }
    return 'session'
  })
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showMontantModal, setShowMontantModal] = useState(false)
  const [montantValue, setMontantValue] = useState('')
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const [editSessionOpen, setEditSessionOpen] = useState(false)
  // Rémunération formateur éditable depuis la fiche
  const [editCout, setEditCout] = useState(false)
  const [coutValue, setCoutValue] = useState('')
  // Prix de vente de la session (→ convention) éditable depuis la fiche
  const [editPrix, setEditPrix] = useState(false)
  const [prixValue, setPrixValue] = useState('')
  const [expandedQcm, setExpandedQcm] = useState<Record<string, boolean>>({})

  function cancelSignature(convId: string) {
    if (!confirm('Annuler la demande de signature ? Le lien envoyé au client sera invalidé et la convention repassera en brouillon (vous pourrez la renvoyer avec les infos à jour).')) return
    startTransition(async () => {
      const { cancelSignatureRequestAction } = await import('@/app/dashboard/conventions/signature-actions')
      const r = await cancelSignatureRequestAction(convId)
      if (r.success) { toast('success', 'Demande de signature annulée'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  function saveCout() {
    const montant = coutValue.trim() === '' ? null : Number(coutValue)
    if (montant !== null && !Number.isFinite(montant)) return
    setEditCout(false)
    startTransition(async () => { await updateCoutFormateurAction(session.id, montant) })
  }

  function savePrix() {
    const montant = prixValue.trim() === '' ? null : Number(prixValue)
    if (montant !== null && !Number.isFinite(montant)) return
    setEditPrix(false)
    startTransition(async () => { await updateSessionPrixAction(session.id, montant); router.refresh() })
  }

  const [editApprenant, setEditApprenant] = useState<any | null>(null)

  function handleSendDoc(apprenantId: string, docType: 'attestation' | 'certificat' | 'hygiene', label: string) {
    startTransition(async () => {
      const r = await sendDocumentToApprenantAction(session.id, apprenantId, docType)
      if ((r as any)?.success) toast('success', `${label} envoyé${(r as any).data?.email ? ` à ${(r as any).data.email}` : ''}`)
      else toast('error', (r as any)?.error || 'Erreur lors de l\'envoi')
    })
  }

  function handleDesinscrire(apprenantId: string, nom: string) {
    if (!apprenantId) return
    if (!confirm(`Retirer ${nom} de cette session ?`)) return
    startTransition(async () => {
      const r = await desinscrireApprenantAction(session.id, apprenantId)
      if (r.success) { toast('success', 'Apprenant retiré'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  const formation = session.formation
  const formateur = session.formateur
  const etablissement = companyLabel((session as any).client) || null
  const adresseComplete = [session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ') || session.lieu || null
  // Les questionnaires de satisfaction vivent dans l'onglet « Évaluations »
  // (évaluation de satisfaction) ; le QCM garde le pédagogique.
  const SATIS_TYPES = ['satisfaction_chaud', 'satisfaction_froid']
  const qcmPedago = qcmSessions.filter((q: any) => !SATIS_TYPES.includes(q.qcm?.type))
  const qcmSatisfaction = qcmSessions.filter((q: any) => SATIS_TYPES.includes(q.qcm?.type))

  const canChangeStatus = isFormateur || ['super_admin', 'gestionnaire', 'directeur_commercial'].includes(userRole)
  const canEmarge = isFormateur || ['super_admin', 'gestionnaire'].includes(userRole)
  const nextStatuses = STATUS_TRANSITIONS[session.status] || []
  const today = new Date().toISOString().split('T')[0]

  // Jours de la session
  function getSessionDays(): string[] {
    // Même règle que la génération des feuilles (lib/emargements) : les
    // week-ends sont exclus SAUF s'ils portent réellement des données
    // (émargement existant ou créneau planifié) — sinon ils apparaissaient
    // comme des jours « sans présence » alors qu'aucune feuille n'existe.
    const joursAvecDonnees = new Set<string>([
      ...emargements.map((e: any) => e.date),
      ...(Array.isArray((session as any).horaires_jours) ? (session as any).horaires_jours.map((j: any) => j.date) : []),
    ].filter(Boolean))
    const days: string[] = []
    const d = new Date(session.date_debut)
    const end = new Date(session.date_fin)
    while (d <= end) {
      const iso = d.toISOString().split('T')[0]
      const we = d.getDay() === 0 || d.getDay() === 6
      if (!we || joursAvecDonnees.has(iso)) days.push(iso)
      d.setDate(d.getDate() + 1)
    }
    return days
  }
  const sessionDays = getSessionDays()

  // Émargements groupés par date puis créneau
  const emargementsByDateCreneau: Record<string, Record<string, any[]>> = {}
  emargements.forEach(e => {
    if (!emargementsByDateCreneau[e.date]) emargementsByDateCreneau[e.date] = {}
    if (!emargementsByDateCreneau[e.date][e.creneau]) emargementsByDateCreneau[e.date][e.creneau] = []
    emargementsByDateCreneau[e.date][e.creneau].push(e)
  })

  const CRENEAU_LABELS: Record<string, string> = { matin: 'Matin', apres_midi: 'Après-midi', journee: 'Journée' }

  // Helper : tous les émargements d'un jour (tous créneaux confondus)
  function getDayEmargements(day: string): any[] {
    const byC = emargementsByDateCreneau[day] || {}
    return Object.values(byC).flat()
  }

  // Pointages par date
  const pointagesByDate: Record<string, any> = {}
  pointages.forEach(p => { pointagesByDate[p.date] = p })

  function formatHeure(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function handleStatusChange(newStatus: string) {
    setShowStatusMenu(false)
    // Validation de la session → le montant formateur doit être confirmé (il est figé sur la session)
    if (newStatus === 'confirmee' && !isFormateur) {
      setMontantValue(session.cout_formateur != null ? String(session.cout_formateur) : (formateur?.tarif_journalier != null ? String(formateur.tarif_journalier) : ''))
      setShowMontantModal(true)
      return
    }
    startTransition(async () => { await updateSessionStatusAction(session.id, newStatus) })
  }

  function confirmWithMontant() {
    const montant = montantValue === '' ? null : Number(montantValue)
    if (montantValue !== '' && !Number.isFinite(montant)) return
    setShowMontantModal(false)
    startTransition(async () => { await updateSessionStatusAction(session.id, 'confirmee', montant) })
  }

  function handleTogglePresence(emargementId: string, valeur: boolean | null, motif?: string | null) {
    startTransition(async () => {
      await togglePresenceAction(emargementId, valeur, motif ?? null)
      router.refresh()
    })
  }
  function handleMarquerAbsent(emargementId: string) {
    // Motif optionnel — champ prévu par la feuille d'émargement
    const motif = window.prompt('Motif d\'absence (optionnel) :') || null
    handleTogglePresence(emargementId, false, motif)
  }



  // Stats émargement globales
  const totalEmargements = emargements.length
  const totalPresents = emargements.filter(e => e.est_present).length
  // Créneaux échus (présence renseignée) : base honnête du % d'assiduité
  const totalEchus = emargements.filter(e => e.est_present !== null && e.est_present !== undefined).length

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <BackLink fallbackHref="/dashboard/sessions" iconOnly />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading truncate">
              {formation?.intitule || session.reference}
            </h1>
            {isPoei && <PoeiBadge />}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-surface-500 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
              {formatDate(session.date_debut, { day: 'numeric', month: 'long' })} — {formatDate(session.date_fin, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {etablissement && (
              session.client_id ? (
                <Link href={`/dashboard/clients/${session.client_id}`}
                  className="flex items-center gap-1 hover:text-brand-600 hover:underline transition-colors">
                  <Building2 className="h-3.5 w-3.5" />{etablissement}
                </Link>
              ) : (
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{etablissement}</span>
              )
            )}
            {adresseComplete && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{adresseComplete}</span>}
            {formation?.duree_heures && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formation.duree_heures}h</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{inscriptions.length} apprenant{inscriptions.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {session.formation_id && (
              <a href={`/api/pdf/programme/${session.formation_id}?session=${session.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-500 text-xs font-medium hover:bg-brand-100 transition-colors">
                <Download className="h-3.5 w-3.5" /> Programme (avec dates de session)
              </a>
            )}
            <a href={`/api/pdf/convocation-session/${session.id}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-500 text-xs font-medium hover:bg-brand-100 transition-colors">
              <Download className="h-3.5 w-3.5" /> Convocation
            </a>
          </div>
        </div>
        {/* Modifier la session */}
        {!isFormateur && (
          <button
            onClick={() => setEditSessionOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 text-xs font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50/50 transition-colors shrink-0"
          >
            <PenTool className="h-3.5 w-3.5" /> Modifier
          </button>
        )}
        {/* Statut */}
        <div className="relative shrink-0">
          <button
            onClick={() => canChangeStatus && nextStatuses.length > 0 && setShowStatusMenu(!showStatusMenu)}
            className={cn('flex items-center gap-1.5', canChangeStatus && nextStatuses.length > 0 && 'cursor-pointer')}
          >
            <Badge variant={SESSION_STATUS[session.status]?.variant || 'default'}>
              {SESSION_STATUS[session.status]?.label || session.status}
            </Badge>
            {canChangeStatus && nextStatuses.length > 0 && <ChevronDown className="h-3.5 w-3.5 text-surface-400" />}
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border shadow-elevated py-1 z-20">
              {nextStatuses.map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-surface-700 hover:bg-surface-50">
                  <Badge variant={SESSION_STATUS[s]?.variant || 'default'}>{SESSION_STATUS[s]?.label}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Validation du montant formateur à la confirmation de la session */}
      {showMontantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-5 space-y-4">
            <div>
              <h3 className="text-sm font-heading font-bold text-surface-900">Valider la session</h3>
              <p className="text-xs text-surface-500 mt-1">
                Confirmez le montant de la prestation formateur pour cette session — c&apos;est ce montant qui figurera sur le contrat de prestation.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Montant formateur (€ HT)</label>
              <input type="number" min="0" step="0.01" value={montantValue} onChange={(e) => setMontantValue(e.target.value)}
                className="input-base w-full" placeholder="Ex. 450" autoFocus />
              {formateur?.tarif_journalier != null && (
                <p className="text-2xs text-surface-400 mt-1">Tarif indicatif de la fiche formateur : {formateur.tarif_journalier} €/j</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMontantModal(false)} className="px-3 py-2 rounded-xl text-sm text-surface-600 bg-surface-100 hover:bg-surface-200 transition-colors">Annuler</button>
              <button onClick={confirmWithMontant} className="px-3 py-2 rounded-xl text-sm font-medium text-white bg-surface-900 hover:bg-surface-800 transition-colors">Valider la session</button>
            </div>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 bg-surface-100 rounded-lg p-0.5 overflow-x-auto">
        {[
          { id: 'session' as const, label: 'Session', icon: Calendar },
          ...(!isFormateur ? [{ id: 'dossier' as const, label: derouleIncomplet ? `Conformité (${derouleIncomplet} à faire)` : 'Conformité', icon: FolderCheck }] : []),
          { id: 'apprenants' as const, label: `Apprenants (${inscriptions.length})`, icon: Users },
          ...(!isFormateur ? [{ id: 'recueil' as const, label: 'Recueil du besoin', icon: ClipboardList }] : []),
          { id: 'presences' as const, label: 'Émargement', icon: UserCheck },
          { id: 'qcm' as const, label: `Questionnaires (${qcmPedago.length + qcmSatisfaction.length})`, icon: ListChecks },
          { id: 'rapport' as const, label: 'Bilan', icon: FileText },
          ...(!isFormateur ? [{ id: 'conventions' as const, label: 'Contractualisation', icon: FileSignature }] : []),
          ...(!isFormateur ? [{ id: 'docs' as const, label: 'Documents', icon: FileText }] : []),
          ...(!isFormateur && estFormationHygiene((session as any).formation || { intitule: session.intitule }) ? [{ id: 'pack' as const, label: 'Pack Hygiène', icon: PackHygieneIcon }] : []),
          ...(!isFormateur ? [{ id: 'facturation' as const, label: estAgefice ? 'AGEFICE' : 'Facturation', icon: ReceiptEuro }] : []),
          ...(!isFormateur ? [{ id: 'mails' as const, label: `Mails (${emailLogs.length})`, icon: Mails }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0',
              tab === t.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500 hover:text-surface-800')}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════
          ONGLET SESSION — Planning + Formateur + Pointages
          ═══════════════════════════════════════════════ */}

      {tab === 'session' && (
        <div className="space-y-4">
          {/* Prix de vente de la session (→ convention) — éditable ici */}
          {!isFormateur && (
            <div className="card p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <Euro className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider text-surface-400 leading-none">Prix de la session (HT)</div>
                <div className="text-lg font-heading font-bold text-surface-900 mt-1">
                  {session.prix_ht != null
                    ? `${Number(session.prix_ht).toLocaleString('fr-FR')} €`
                    : <span className="text-sm font-normal text-surface-400">À définir</span>}
                </div>
                <div className="text-2xs text-surface-500 mt-0.5">Ce montant est repris sur la convention de formation.</div>
              </div>
              {editPrix ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative">
                    <input
                      type="number" step="0.01" autoFocus value={prixValue}
                      onChange={(e) => setPrixValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') savePrix(); if (e.key === 'Escape') setEditPrix(false) }}
                      placeholder="0"
                      className="w-32 pl-3 pr-7 py-2 rounded-xl border border-brand-300 bg-white text-sm font-semibold text-surface-900 text-right focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-surface-400 pointer-events-none">€</span>
                  </div>
                  <button onClick={savePrix} disabled={isPending} title="Enregistrer"
                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setEditPrix(false)} title="Annuler"
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-surface-200 text-surface-400 hover:bg-surface-50 hover:text-surface-600 transition-colors">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setPrixValue(session.prix_ht != null ? String(session.prix_ht) : ''); setEditPrix(true) }}
                  title="Modifier le prix de la session"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-200 text-surface-600 text-sm font-medium hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600 transition-colors shrink-0"
                >
                  <PenTool className="h-3.5 w-3.5" /> Modifier
                </button>
              )}
            </div>
          )}

          {/* Formateur */}
          {formateur && (
            <div className="card p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900">{formateur.prenom} {formateur.nom}</div>
                <div className="text-xs text-surface-500 flex items-center gap-3">
                  {formateur.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{formateur.email}</span>}
                  {formateur.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{formateur.telephone}</span>}
                </div>
              </div>
              {/* Rémunération formateur — modifiable directement ici */}
              {!isFormateur && (
                editCout ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <input
                        type="number" autoFocus value={coutValue}
                        onChange={(e) => setCoutValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveCout(); if (e.key === 'Escape') setEditCout(false) }}
                        placeholder={formateur.tarif_journalier ? String(formateur.tarif_journalier) : '0'}
                        className="w-28 pl-3 pr-7 py-2 rounded-xl border border-brand-300 bg-white text-sm font-semibold text-surface-900 text-right focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-surface-400 pointer-events-none">€</span>
                    </div>
                    <button onClick={saveCout} disabled={isPending} title="Enregistrer"
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditCout(false)} title="Annuler"
                      className="h-9 w-9 flex items-center justify-center rounded-xl border border-surface-200 text-surface-400 hover:bg-surface-50 hover:text-surface-600 transition-colors">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setCoutValue(session.cout_formateur != null ? String(session.cout_formateur) : ''); setEditCout(true) }}
                    title="Modifier la rémunération du formateur"
                    className={cn(
                      'group flex items-center gap-2.5 rounded-xl border px-3 py-2 shrink-0 transition-all',
                      session.cout_formateur != null
                        ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50'
                        : 'border-dashed border-surface-300 bg-surface-50 hover:border-brand-300 hover:bg-brand-50/40',
                    )}
                  >
                    <span className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                      session.cout_formateur != null ? 'bg-emerald-100' : 'bg-surface-200/70',
                    )}>
                      <Euro className={cn('h-3.5 w-3.5', session.cout_formateur != null ? 'text-emerald-600' : 'text-surface-400')} />
                    </span>
                    <span className="text-left">
                      <span className="block text-[10px] uppercase tracking-wider text-surface-400 leading-none">Rémunération</span>
                      <span className={cn(
                        'block text-sm font-semibold leading-tight mt-0.5',
                        session.cout_formateur != null ? 'text-emerald-800' : 'text-surface-400 font-normal',
                      )}>
                        {session.cout_formateur != null
                          ? `${Number(session.cout_formateur).toLocaleString('fr-FR')} €`
                          : 'À définir'}
                      </span>
                    </span>
                    <PenTool className="h-3.5 w-3.5 text-surface-300 group-hover:text-brand-500 shrink-0 transition-colors" />
                  </button>
                )
              )}
              {!isFormateur && formateur.id && (
                <a href={`/api/pdf/contrat-formateur/${formateur.id}?session=${session.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-500 text-xs font-medium hover:bg-brand-100 transition-colors shrink-0">
                  <Download className="h-3.5 w-3.5" /> Contrat prestation
                </a>
              )}
            </div>
          )}

          {/* Planning jour par jour */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                Planning — {sessionDays.length} jour{sessionDays.length > 1 ? 's' : ''}
                {(() => {
                  const totalH = pointages.reduce((t: number, p: any) => {
                    if (!p.heure_arrivee || !p.heure_depart) return t
                    const h = (new Date(p.heure_depart).getTime() - new Date(p.heure_arrivee).getTime()) / 3600000
                    return h > 0 ? t + h : t
                  }, 0)
                  return totalH > 0 ? <span className="text-surface-400 font-normal"> · {Math.floor(totalH)}h{String(Math.round((totalH % 1) * 60)).padStart(2, '0')} pointées{(session as any).formation?.duree_heures ? ` / ${(session as any).formation.duree_heures}h` : ''}</span> : null
                })()}
              </span>
            </div>
            <div className="divide-y divide-surface-100">
              {sessionDays.map((day, idx) => {
                const dayPointage = pointagesByDate[day]
                const dayEmargements = getDayEmargements(day)
                const presentCount = dayEmargements.filter((e: any) => e.est_present).length
                const isToday = day === today

                return (
                  <div key={day} className={cn('px-4 py-3 flex items-center gap-3', isToday && 'bg-brand-50/30')}>
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                      dayPointage?.heure_depart ? 'bg-emerald-100 text-emerald-700' :
                      dayPointage?.heure_arrivee ? 'bg-amber-100 text-amber-700' :
                      isToday ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-500'
                    )}>
                      J{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-sm', isToday ? 'font-semibold text-surface-900' : 'text-surface-700')}>
                        {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {isToday && <span className="ml-2 text-[10px] text-brand-600 font-semibold uppercase">Aujourd'hui</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                        {dayPointage?.heure_arrivee && (
                          <span className="flex items-center gap-1 text-emerald-600"><LogIn className="h-3 w-3" />{formatHeure(dayPointage.heure_arrivee)}</span>
                        )}
                        {dayPointage?.heure_depart && (
                          <span className="flex items-center gap-1 text-red-600"><LogOut className="h-3 w-3" />{formatHeure(dayPointage.heure_depart)}</span>
                        )}
                        {dayEmargements.length > 0 && (
                          <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{presentCount}/{dayEmargements.length}</span>
                        )}
                        {dayPointage?.photo_arrivee_url && (
                          <a href={dayPointage.photo_arrivee_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-500 hover:text-emerald-600"><Camera className="h-3 w-3" />Arrivée</a>
                        )}
                        {dayPointage?.photo_depart_url && (
                          <a href={dayPointage.photo_depart_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-red-500 hover:text-red-600"><Camera className="h-3 w-3" />Départ</a>
                        )}
                      </div>
                    </div>
                    {dayPointage?.heure_depart ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : dayPointage?.heure_arrivee ? (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET CONTENU PÉDAGOGIQUE
          ═══════════════════════════════════════════════ */}
      {tab === 'dossier' && !isFormateur && (
        <div className="space-y-4">
        <PiecesDossier
          sessionId={session.id}
          etats={etatsPieces}
          tableManquante={piecesTableManquante}
          formationId={session.formation_id || null}
          nbSupports={supports.length}
          rapportFait={!!(rapport?.submitted_at || rapport?.status === 'soumis')}
          nbInscrits={inscriptions.length}
          hygiene={estFormationHygiene(session.formation)}
          onGoTab={(t) => setTab(t as any)}
          envoisDocs={(docEmailLogs as any[]).map((l: any) => ({ subject: l.subject, sent_at: l.sent_at || l.created_at, to_email: l.to_email }))}
        />
        {/* Parcours qualité (ex-onglet Déroulé) : socle + étapes hygiène */}
        <DerouleOperationnel
          sessionId={session.id}
          validations={derouleValidations}
          canValidate
          tableManquante={derouleTableManquante}
          socle={socleEtat}
          estHygiene={estHygiene}
        />
        </div>
      )}


      {tab === 'recueil' && !isFormateur && (
        <div className="card p-6">
          <SessionRecueil
            sessionId={session.id}
            formationIntitule={formationIntitule}
            templates={recueilTemplates as any[]}
            initial={recueil as any}
          />
        </div>
      )}


      {/* ═══════════════════════════════════════════════
          ONGLET PRÉSENCES — Émargement par jour
          ═══════════════════════════════════════════════ */}
      {tab === 'presences' && (
        <div className="space-y-4">
          {!isFormateur && (
            <div className="flex flex-wrap justify-end gap-2">
              <LiensSignatureEmargement sessionId={session.id} />
              <a href={`/api/pdf/emargement/${session.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors">
                <Download className="h-3.5 w-3.5" /> Feuille vierge (PDF)
              </a>
              {emargements.some((e: any) => e.signature_data || e.est_present) && (
                <a href={`/api/pdf/emargement-signe/${session.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors">
                  <Download className="h-3.5 w-3.5" /> Feuille signée (PDF)
                </a>
              )}
              {scanEmargement && (
                <button onClick={ouvrirScanEmargement} disabled={scanEnCours}
                  title="Feuille papier scannée, déposée au dossier de la session"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-900 text-white text-xs font-medium hover:bg-surface-800 transition-colors disabled:opacity-50">
                  {scanEnCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Feuille scannée
                </button>
              )}
            </div>
          )}
          {/* Stats émargement */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-4 bg-blue-50 text-center">
              <div className="text-2xl font-heading font-bold text-blue-600">{inscriptions.length}</div>
              <div className="text-xs text-surface-600">Inscrits</div>
            </div>
            <div className="rounded-2xl p-4 bg-emerald-50 text-center">
              <div className="text-2xl font-heading font-bold text-emerald-600">{totalPresents}</div>
              <div className="text-xs text-surface-600">Présences</div>
            </div>
            <div className="rounded-2xl p-4 bg-amber-50 text-center">
              <div className="text-2xl font-heading font-bold text-amber-600">
                {totalEchus > 0 ? Math.round((totalPresents / totalEchus) * 100) : 0}%
              </div>
              <div className="text-xs text-surface-600">Assiduité{totalEmargements > totalEchus ? ` (${totalEmargements - totalEchus} à venir)` : ''}</div>
            </div>
          </div>

          {/* Émargement par jour — matin + après-midi */}
          {sessionDays.map((day, idx) => {
            const dayCreneaux = emargementsByDateCreneau[day] || {}
            const creneauxList = Object.keys(dayCreneaux).sort() // matin avant apres_midi
            if (creneauxList.length === 0) return null
            const allDay = getDayEmargements(day)
            const presentCount = allDay.filter((e: any) => e.est_present).length
            const isExpanded = expandedDays[day] !== false

            return (
              <div key={day} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedDays({ ...expandedDays, [day]: !isExpanded })}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                      presentCount === allDay.length ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600'
                    )}>
                      J{idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-surface-900">
                        {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                      <div className="text-xs text-surface-500">
                        {creneauxList.map(c => CRENEAU_LABELS[c] || c).join(' + ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
                      presentCount === allDay.length ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600'
                    )}>
                      {presentCount}/{allDay.length} présent{presentCount > 1 ? 's' : ''}
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-surface-400" /> : <ChevronDown className="h-4 w-4 text-surface-400" />}
                  </div>
                </button>

                {!isFormateur && presentCount < allDay.length && (
                  <div className="px-4 pb-3 -mt-1">
                    <button
                      onClick={() => marquerJournee(day)}
                      disabled={jourEnCours === day}
                      title="Le formateur a fait signer sur papier : marquer la journée entière"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50">
                      {jourEnCours === day ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      Tous présents ce jour
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="border-t border-surface-100">
                    {creneauxList.map(creneau => {
                      const creneauEmargements = dayCreneaux[creneau] || []
                      const creneauPresent = creneauEmargements.filter((e: any) => e.est_present).length
                      return (
                        <div key={creneau}>
                          {/* Sous-en-tête créneau */}
                          <div className="px-4 py-2 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-surface-600">
                              {CRENEAU_LABELS[creneau] || creneau}
                            </span>
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              creneauPresent === creneauEmargements.length ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-surface-500'
                            )}>
                              {creneauPresent}/{creneauEmargements.length}
                            </span>
                          </div>
                          {creneauEmargements.map((em: any) => {
                      const apprenant = inscriptions.find(i => (i.apprenant as any)?.id === em.apprenant_id)?.apprenant
                      const isSigned = em.est_present && em.signature_data

                      return (
                        <div
                          key={em.id}
                          className={cn('flex items-center gap-3 px-4 py-3 border-b border-surface-100/60 last:border-0',
                            em.est_present ? 'bg-emerald-50/50' : 'bg-white'
                          )}
                        >
                          <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                            isSigned ? 'bg-emerald-100' : em.est_present ? 'bg-emerald-100' : 'bg-surface-100'
                          )}>
                            {/* Icône unique pour tous les présents, signés ou non :
                                la feuille PDF reste la référence des signatures.
                                null = créneau pas encore passé (session en cours). */}
                            {em.est_present
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              : em.est_present === false
                              ? <XCircle className="h-4 w-4 text-surface-300" />
                              : <Clock className="h-4 w-4 text-surface-300" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-surface-900">{apprenant?.prenom} {apprenant?.nom}</div>
                            <div className="text-xs text-surface-400 flex items-center gap-2">
                              {/* Même sous-titre pour tous : l'établissement (celui du
                                  stagiaire, sinon le client de la session). */}
                              {(apprenant?.entreprise || (session as any).client?.raison_sociale) && (
                                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />
                                  {apprenant?.entreprise || (session as any).client?.nom_commercial || (session as any).client?.raison_sociale}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Bascule 3 états : Présent · Absent (motif) · À venir */}
                          {canEmarge ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleTogglePresence(em.id, em.est_present === true ? null : true)}
                                disabled={isPending}
                                className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                  em.est_present === true ? 'bg-emerald-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Présent
                              </button>
                              <button
                                onClick={() => em.est_present === false ? handleTogglePresence(em.id, null) : handleMarquerAbsent(em.id)}
                                disabled={isPending}
                                title={em.motif_absence || undefined}
                                className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                  em.est_present === false ? 'bg-red-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Absent
                              </button>
                            </div>
                          ) : (
                            <span className={cn('text-xs font-semibold shrink-0', em.est_present ? 'text-emerald-600' : 'text-surface-400')}>
                              {em.est_present ? 'Présent' : em.est_present === false ? (em.motif_absence ? `Absent · ${em.motif_absence}` : 'Absent') : 'À venir'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Info si tous les jours sont émargés */}
          {sessionDays.every(day => getDayEmargements(day).length > 0) && (
            <div className="text-xs text-surface-400 text-center py-2">
              Feuilles d'émargement générées pour les {sessionDays.length} jours de formation
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET APPRENANTS — Liste simple
          ═══════════════════════════════════════════════ */}
      {tab === 'apprenants' && (
        <div className="space-y-4">
        {!isFormateur && (
          <SessionParticipants sessionId={session.id} clientId={session.client_id || null} clients={clientsRef as any} />
        )}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              {inscriptions.length} apprenant{inscriptions.length > 1 ? 's' : ''} inscrit{inscriptions.length > 1 ? 's' : ''}
            </span>
          </div>
          {inscriptions.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {inscriptions.map((ins: any) => {
                const a = ins.apprenant
                const appEmargements = emargements.filter((e: any) => e.apprenant_id === a?.id)
                const appPresent = appEmargements.filter((e: any) => e.est_present).length
                // Assiduité sur les seuls créneaux ÉCHUS (est_present renseigné) :
                // inclure les créneaux à venir faussait le % en cours de session.
                const appEchus = appEmargements.filter((e: any) => e.est_present !== null && e.est_present !== undefined).length
                const appAVenir = appEmargements.length - appEchus
                const assiduity = appEchus > 0 ? Math.round((appPresent / appEchus) * 100) : null

                const evalBadges = evaluationsAppr.filter((e) => e.apprenant_id === a?.id && e.note != null)
                const base = `?session=${session.id}`
                return (
                  <div key={ins.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">{(a?.prenom?.[0] || '')}{(a?.nom?.[0] || '')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a?.id
                          ? <ApprenantHoverCard apprenant={a}><Link href={`/dashboard/apprenants/${a.id}`} className="text-sm font-medium text-surface-900 hover:text-brand-600 transition-colors">{a?.prenom} {a?.nom}</Link></ApprenantHoverCard>
                          : <span className="text-sm font-medium text-surface-900">{a?.prenom} {a?.nom}</span>}
                        <Badge variant={ins.status === 'confirme' ? 'success' : ins.status === 'inscrit' ? 'info' : 'default'}>
                          {ins.status === 'confirme' ? 'Confirmé' : ins.status === 'inscrit' ? 'Inscrit' : ins.status}
                        </Badge>
                        {evalBadges.map((e) => {
                          const ratio = e.note_max ? e.note / e.note_max : null
                          const color = ratio == null ? 'bg-surface-100 text-surface-600' : ratio >= 0.7 ? 'bg-emerald-50 text-emerald-700' : ratio >= 0.5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                          return (
                            <span key={e.id} title={e.intitule || ''} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', color)}>
                              <Award className="h-3 w-3" />{Number(e.note)}{e.note_max ? `/${Number(e.note_max)}` : ''}
                            </span>
                          )
                        })}
                      </div>
                      <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap mt-0.5">
                        {a?.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{a.email}</span>}
                        {a?.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{a.telephone}</span>}
                        {a?.entreprise && <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{a.entreprise}</span>}
                      </div>
                      {/* Ce que ce stagiaire a déjà reçu — l'info manquait partout */}
                      {a?.email && (() => {
                        const docs: [string, string][] = [['convocation', 'Convocation'], ['attestation', 'Attestation'], ['certificat', 'Certificat']]
                        if (estFormationHygiene((session as any).formation || { intitule: session.intitule })) docs.push(['hygiene', 'Hygiène'])
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {docs.map(([type, label]) => {
                              const envoi = dernierEnvoiDoc(emailLogs as any[], type as any, a.email)
                              return (
                                <span key={type}
                                  title={envoi ? `Envoyé le ${new Date((envoi.sent_at || envoi.created_at)!).toLocaleDateString('fr-FR')}` : 'Jamais envoyé'}
                                  className={cn('text-[10px] font-medium rounded-full px-1.5 py-0.5 border',
                                    envoi ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-surface-50 text-surface-400 border-surface-200')}>
                                  {label}{envoi ? ' ✓'.replace(' ✓', '') : ''}
                                </span>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                    {assiduity !== null && (
                      <div className="text-right shrink-0">
                        <div className={cn('text-sm font-bold leading-none', assiduity >= 80 ? 'text-emerald-600' : assiduity >= 50 ? 'text-amber-600' : 'text-red-600')}>{assiduity}%</div>
                        <div className="text-[10px] text-surface-400 mt-0.5">{appPresent}/{appEchus} créneau{appEchus > 1 ? 'x' : ''}{appAVenir > 0 ? ` · ${appAVenir} à venir` : ''}</div>
                      </div>
                    )}
                    {/* Un seul menu d'actions (modifier, documents, envoi, retrait) */}
                    {!isFormateur && (
                      <div className="shrink-0">
                        <RowMenu items={[
                          { label: 'Modifier l\'apprenant', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditApprenant(a) },
                          { label: 'Attestation d\'entrée (PDF)', icon: <Download className="h-4 w-4 text-surface-400" />, onClick: () => window.open(`/api/pdf/attestation-entree/${a?.id}${base}`, '_blank') },
                          { label: 'Convocation (PDF)', icon: <Download className="h-4 w-4 text-surface-400" />, onClick: () => window.open(`/api/pdf/convocation/${a?.id}${base}`, '_blank') },
                          { label: 'Attestation (PDF)', icon: <Download className="h-4 w-4 text-surface-400" />, onClick: () => window.open(`/api/pdf/attestation/${a?.id}${base}`, '_blank') },
                          { label: 'Envoyer l\'attestation par email', icon: <Mail className="h-4 w-4 text-surface-400" />, onClick: () => handleSendDoc(a?.id, 'attestation', 'Attestation') },
                          { label: 'Certificat de réalisation (PDF)', icon: <Download className="h-4 w-4 text-surface-400" />, onClick: () => window.open(`/api/pdf/certificat-realisation/${a?.id}${base}`, '_blank') },
                          { label: 'Envoyer le certificat par email', icon: <Mail className="h-4 w-4 text-surface-400" />, onClick: () => handleSendDoc(a?.id, 'certificat', 'Certificat') },
                          // Document réglementaire de l'arrêté du 12 février 2024, exigé
                          // en plus des documents de clôture sur toute formation en
                          // hygiène alimentaire.
                          ...(estFormationHygiene(session.formation) ? [
                            { label: "Attestation d'hygiène alimentaire (PDF)", icon: <Download className="h-4 w-4 text-surface-400" />, onClick: () => window.open(`/api/pdf/attestation-hygiene?session=${session.id}&apprenant=${a?.id}`, '_blank') },
                            { label: "Envoyer l'attestation d'hygiène par email", icon: <Mail className="h-4 w-4 text-surface-400" />, onClick: () => handleSendDoc(a?.id, 'hygiene', "Attestation d'hygiène") },
                          ] : []),
                          { label: 'Retirer de la session', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDesinscrire(a?.id, `${a?.prenom || ''} ${a?.nom || ''}`.trim()), danger: true },
                        ]} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-surface-400">Aucun apprenant inscrit</div>
          )}
        </div>
        <Modal isOpen={!!editApprenant} onClose={() => setEditApprenant(null)} title="Modifier l'apprenant" size="lg">
          {editApprenant && (
            <ApprenantForm
              apprenant={editApprenant as any}
              clients={clientsRef as any}
              onDone={() => { setEditApprenant(null); router.refresh() }}
            />
          )}
        </Modal>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET RAPPORT
          ═══════════════════════════════════════════════ */}
      {tab === 'rapport' && (
        <div className="space-y-4">
          {rapport ? (
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-surface-500" />
                  <div>
                    <div className="text-sm font-semibold text-surface-900">Rapport de session</div>
                    <div className="text-xs text-surface-500">
                      {rapport.status === 'valide'
                        ? `Validé${rapport.submitted_at ? ` — soumis le ${formatDate(rapport.submitted_at, { day: 'numeric', month: 'long' })}` : ''}`
                        : rapport.status === 'soumis' ? 'Soumis le ' + formatDate(rapport.submitted_at, { day: 'numeric', month: 'long' }) : 'Brouillon en cours'}
                    </div>
                  </div>
                </div>
                <Badge variant={rapport.status === 'valide' ? 'success' : rapport.status === 'soumis' ? 'warning' : 'default'}>
                  {rapport.status === 'valide' ? 'Validé' : rapport.status === 'soumis' ? 'Soumis' : 'Brouillon'}
                </Badge>
              </div>
              {/* Le contenu du rapport, rubrique par rubrique */}
              <div className="grid gap-3 md:grid-cols-2 pt-1">
                {[
                  ['Contenu abordé', rapport.contenu_aborde],
                  ['Objectifs atteints', rapport.objectifs_atteints],
                  ['Objectifs non atteints', rapport.objectifs_non_atteints],
                  ['Difficultés rencontrées', rapport.difficultes_rencontrees],
                  ['Points positifs', rapport.points_positifs],
                  ['Recommandations', rapport.recommandations],
                  ['Commentaires généraux', rapport.commentaires_generaux],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-surface-50/60 border border-surface-100 p-3">
                    <div className="text-2xs font-semibold uppercase tracking-wider text-surface-400 mb-1">{l}</div>
                    <div className="text-sm text-surface-800 whitespace-pre-line">{v}</div>
                  </div>
                ))}
              </div>
              {isFormateur && (
                <Link href="/dashboard/formateur-home/rapports"
                  className="btn-primary inline-flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" /> Modifier le rapport
                </Link>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <FileText className="h-8 w-8 text-surface-300 mx-auto mb-3" />
              <div className="text-sm font-medium text-surface-700 mb-1">Aucun rapport rédigé</div>
              <p className="text-xs text-surface-500 mb-4">
                {isFormateur
                  ? 'Rédigez votre bilan pédagogique pour cette session.'
                  : 'Le formateur n\'a pas encore soumis de rapport.'}
              </p>
              {isFormateur && ['en_cours', 'terminee'].includes(session.status) && (
                <Link href="/dashboard/formateur-home/rapports"
                  className="btn-primary inline-flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" /> Rédiger le rapport
                </Link>
              )}
            </div>
          )}

          {/* Le second regard sur la même session : ce que le CLIENT en dit,
              recueilli par téléphone — sous le rapport du formateur. */}
          {!isFormateur && <SessionRetourClient sessionId={session.id} retours={retoursClient as any[]} />}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET POINTAGES (formateur)
          ═══════════════════════════════════════════════ */}
      
      {/* ═══════════════════════════════════════════════
          ONGLET ÉVALUATIONS
          ═══════════════════════════════════════════════ */}
      {tab === 'qcm' && (
        <div className="space-y-3">
          {qcmSatisfaction.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-100 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                Questionnaires de satisfaction
              </div>
              <div className="divide-y divide-surface-100">
                {qcmSatisfaction.map((q: any) => {
                  const rep = qcmReponses.filter((r: any) => r.qcm_id === q.qcm_id)
                  const done = rep.filter((r: any) => r.is_complete).length
                  const chaud = q.qcm?.type === 'satisfaction_chaud'
                  return (
                    <div key={q.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <Star className="h-4 w-4 text-amber-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-surface-900 truncate">{q.qcm?.titre || 'Questionnaire'}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-2xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {chaud ? 'Satisfaction à chaud' : 'Satisfaction à froid'}
                          </span>
                          <span className="text-xs text-surface-500 tabular-nums">{done}/{rep.length} répondu</span>
                        </div>
                      </div>
                      {rep.length === 0 && (
                        <span className="text-2xs text-surface-400">
                          {chaud ? 'Envoyé en fin de session' : 'Envoyé 3 mois après la formation'}
                        </span>
                      )}
                      {/*
                        La satisfaction se recueille aussi sur papier : le
                        formateur la fait remplir en fin de séance, sans
                        dépendre d'un stagiaire qui relèvera ses mails.
                      */}
                      <a
                        href={`/api/pdf/questionnaire-papier?session=${session.id}&qcm=${q.qcm_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="btn-secondary !py-1 !px-2.5 text-xs inline-flex items-center gap-1.5 shrink-0"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Imprimer
                      </a>

                      {/* Les réponses par stagiaire — même lecture que les
                          questionnaires pédagogiques : note /5 et détail. */}
                      {rep.length > 0 && (
                        <div className="w-full pt-1">
                          <div className="divide-y divide-surface-50 rounded-xl border border-surface-100 overflow-hidden">
                            {rep.map((r: any) => {
                              const a = inscriptions.find((i: any) => i.apprenant?.id === r.apprenant_id)?.apprenant
                              return (
                                <div key={r.id} className="px-3 py-2 flex items-center gap-3 bg-white">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm text-surface-900">{a ? `${a.prenom} ${a.nom}` : 'Apprenant'}</span>
                                    <span className="text-xs text-surface-400 ml-2">
                                      {r.is_complete
                                        ? (r.date_realisation || r.completed_at ? `le ${new Date(r.date_realisation || r.completed_at).toLocaleDateString('fr-FR')}` : 'répondu')
                                        : 'en attente'}
                                    </span>
                                  </div>
                                  {r.is_complete && r.score != null && (
                                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                                      Number(r.score) >= 70 ? 'bg-emerald-50 text-emerald-700' : Number(r.score) >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
                                      {(Number(r.score) / 20).toFixed(1)} / 5
                                    </span>
                                  )}
                                  {r.is_complete && !isFormateur && (r.detail?.[0]?.count ?? 0) > 0 && (
                                    <button onClick={() => setDetail(r.id)}
                                      className="btn-secondary !py-1 !px-2.5 text-xs shrink-0">
                                      Réponses
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {evaluations.length === 0 && qcmSatisfaction.length === 0 ? (
            <div className="card p-8 text-center">
              <Star className="h-8 w-8 text-surface-300 mx-auto mb-2" />
              <div className="text-sm text-surface-500">Aucune évaluation de satisfaction enregistrée</div>
              <div className="text-xs text-surface-400 mt-1">Les apprenants peuvent évaluer la formation à chaud (fin) ou à froid (3 mois après).</div>
            </div>
          ) : evaluations.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="divide-y divide-surface-100">
                {evaluations.map((e: any) => (
                  <div key={e.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                    <Star className="h-4 w-4 text-amber-400 shrink-0" fill={e.note_globale && e.note_globale >= 4 ? 'currentColor' : 'none'} />
                    <div className="font-medium text-surface-900">
                      {e.type === 'a_chaud' ? 'Satisfaction à chaud' : e.type === 'a_froid' ? 'Satisfaction à froid' : e.type}
                    </div>
                    {e.note_globale && (
                      <div className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {e.note_globale}/10
                      </div>
                    )}
                    {e.completee_at && (
                      <div className="ml-auto text-xs text-surface-500">
                        Le {new Date(e.completee_at).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET QCM — Questionnaires rattachés + QR code
          ═══════════════════════════════════════════════ */}
      {tab === 'qcm' && (
        <div className="space-y-4">
          {/* Les questionnaires sont liés à la formation : rien à rattacher ici,
              seul le QR code à projeter reste utile en salle. */}
          {!isFormateur && (
            <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <ListChecks className="h-4 w-4 text-brand-500" />
                </span>
                <div className="text-xs text-surface-500">
                  Chaque apprenant inscrit répond sur son téléphone en scannant son QR code.
                </div>
              </div>
              <a
                href={`/api/sessions/${session.id}/qr-codes`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-900 text-white text-xs font-semibold hover:bg-surface-800 transition-colors shrink-0"
              >
                <QrCode className="h-3.5 w-3.5" /> QR codes à projeter
              </a>
            </div>
          )}

          {/* Progression entrée -> sortie : le positionnement porte les mêmes
              questions que l'évaluation des acquis — l'écart entre les deux
              scores est la preuve de progression (indicateur 11). */}
          {(() => {
            const typeDe = (qcmId: string) => qcmSessions.find((q: any) => q.qcm_id === qcmId)?.qcm?.type
            const parApprenant = new Map<string, { entree?: number; sortie?: number }>()
            for (const r of qcmReponses as any[]) {
              if (!r.is_complete || r.score == null || !r.apprenant_id) continue
              const t = typeDe(r.qcm_id)
              const cle = t === 'positionnement' || t === 'entree' ? 'entree' : t === 'sortie' ? 'sortie' : null
              if (!cle) continue
              const e = parApprenant.get(r.apprenant_id) || {}
              if ((e as any)[cle] == null) { (e as any)[cle] = Number(r.score); parApprenant.set(r.apprenant_id, e) }
            }
            const lignes = inscriptions
              .map((i: any) => ({ nom: `${i.apprenant?.prenom || ''} ${i.apprenant?.nom || ''}`.trim(), p: parApprenant.get(i.apprenant?.id) }))
              .filter((x: any) => x.p && x.p.entree != null && x.p.sortie != null)
            if (!lignes.length) return null
            return (
              <div className="card p-4">
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-brand-500" /> Progression entrée → sortie
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {lignes.map((l: any) => {
                    const delta = l.p.sortie - l.p.entree
                    return (
                      <div key={l.nom} className="flex items-center justify-between gap-3 text-sm border-b border-surface-100 pb-1.5 last:border-0">
                        <span className="text-surface-800 truncate">{l.nom}</span>
                        <span className="tabular-nums text-surface-500 shrink-0">
                          {l.p.entree}% → <span className="font-semibold text-surface-900">{l.p.sortie}%</span>
                          <span className={delta >= 0 ? 'text-emerald-600 ml-1.5' : 'text-danger-600 ml-1.5'}>
                            {delta >= 0 ? '+' : ''}{delta}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Liste des questionnaires rattachés + suivi des réponses */}
          {qcmPedago.length === 0 ? (
            <div className="card p-8 text-center">
              <ListChecks className="h-8 w-8 text-surface-300 mx-auto mb-2" />
              <div className="text-sm text-surface-500">Aucun questionnaire rattaché à cette session</div>
              <div className="text-xs text-surface-400 mt-1">Les questionnaires sont créés automatiquement avec la formation.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {qcmPedago.map((q: any) => {
                const reponses = qcmReponses.filter((r: any) => r.qcm_id === q.qcm_id)
                const completed = reponses.filter((r: any) => r.is_complete)
                const scoreMin = q.qcm?.score_min_reussite != null ? Number(q.qcm.score_min_reussite) : null
                const isExpanded = expandedQcm[q.id] === true
                return (
                  <div key={q.id} className="card overflow-hidden">
                    <button
                      onClick={() => setExpandedQcm({ ...expandedQcm, [q.id]: !isExpanded })}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-50 transition-colors text-left"
                    >
                      <span className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                        <ListChecks className="h-4 w-4 text-brand-500" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">{q.qcm?.titre || 'QCM'}</div>
                        <div className="text-xs text-surface-500 flex items-center gap-2 flex-wrap">
                          {q.qcm?.type && <Badge variant="info">{QCM_TYPE_LABELS[q.qcm.type] || q.qcm.type}</Badge>}
                          <span>{completed.length}/{reponses.length} répondu{completed.length > 1 ? 's' : ''}</span>
                          {scoreMin != null && <span className="text-surface-400">Seuil {scoreMin}%</span>}
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-surface-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-surface-400 shrink-0" />}
                    </button>
                    {/*
                      Le formateur mène l'entretien sur papier, un stagiaire à la
                      fois : il lui faut le questionnaire imprimé, un exemplaire
                      par stagiaire, en-tête déjà rempli pour que la feuille
                      ramassée reste rattachable à son dossier. Le formateur y a
                      accès comme l'administratif : c'est lui qui imprime.
                    */}
                    <div className="px-4 pb-3 -mt-1">
                      <a
                        href={`/api/pdf/questionnaire-papier?session=${session.id}&qcm=${q.qcm_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="btn-secondary !py-1 !px-2.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Imprimer les exemplaires vierges
                      </a>
                      <button onClick={() => setRapide(true)}
                        className="btn-secondary !py-1 !px-2.5 text-xs inline-flex items-center gap-1.5 ml-2">
                        <Pencil className="h-3.5 w-3.5" />
                        Saisie rapide des réponses
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-surface-100 divide-y divide-surface-100">
                        {reponses.length === 0 ? (
                          <div className="px-4 py-4 text-xs text-surface-400 text-center">Aucun apprenant destinataire.</div>
                        ) : (
                          reponses.map((r: any) => {
                            const a = inscriptions.find((i: any) => (i.apprenant as any)?.id === r.apprenant_id)?.apprenant
                            // L'orange signale un score sous le seuil, jamais un
                            // questionnaire simplement rempli : une satisfaction
                            // n'a pas de seuil et doit ressortir verte.
                            const echec = scoreMin != null && r.score != null && Number(r.score) < scoreMin
                            return (
                              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                                <span className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                                  r.is_complete ? (echec ? 'bg-amber-100' : 'bg-emerald-100') : 'bg-surface-100')}>
                                  {r.is_complete
                                    ? (echec ? <MinusCircle className="h-4 w-4 text-amber-600" /> : <CheckCircle className="h-4 w-4 text-emerald-600" />)
                                    : <Clock className="h-4 w-4 text-surface-400" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-surface-900 truncate">{a ? `${a.prenom} ${a.nom}` : 'Apprenant'}</div>
                                  <div className="text-xs text-surface-400">
                                    {r.is_complete
                                      ? (r.date_realisation || r.completed_at ? `Réalisé le ${new Date(r.date_realisation || r.completed_at).toLocaleDateString('fr-FR')}` : 'Réalisé')
                                      : 'En attente de réponse'}
                                  </div>
                                </div>
                                {r.is_complete && r.score != null && (
                                  <div className={cn('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                                    Number(r.score) >= 70 ? 'bg-emerald-50 text-emerald-700' : Number(r.score) >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
                                    {String(q.qcm?.type || '').startsWith('satisfaction')
                                      ? `${(Number(r.score) / 20).toFixed(1)} / 5`
                                      : `${Number(r.score)} %`}
                                  </div>
                                )}
                                {r.is_complete && !isFormateur && (r.detail?.[0]?.count ?? 0) > 0 && (
                                  <button onClick={() => setDetail(r.id)}
                                    title="Voir les réponses du stagiaire"
                                    className="btn-secondary !py-1 !px-2.5 text-xs shrink-0">
                                    Réponses
                                  </button>
                                )}
                                {!r.is_complete && !isFormateur && (
                                  <button
                                    onClick={() => setSaisie({ id: r.id, nom: a ? `${a.prenom} ${a.nom}` : 'ce stagiaire' })}
                                    title="Reporter les réponses recueillies auprès du stagiaire"
                                    className="btn-secondary !py-1 !px-2.5 text-xs shrink-0">
                                    Saisir
                                  </button>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET CONVENTIONS
          ═══════════════════════════════════════════════ */}
      {tab === 'mails' && !isFormateur && (
        <SessionMails
          sessionId={session.id}
          formateur={formateur ? { prenom: formateur.prenom, nom: formateur.nom, email: formateur.email } : null}
          apprenants={inscriptions.map((i: any) => ({ id: i.apprenant?.id, nom: `${i.apprenant?.prenom || ''} ${i.apprenant?.nom || ''}`.trim(), email: i.apprenant?.email || null }))}
          contacts={clientContacts as any[]}
          emailLogs={emailLogs as any[]}
          hygiene={estFormationHygiene(session.formation)}
          nbSupports={supports.length}
          onGoTab={(t) => setTab(t as any)}
        />
      )}

      {tab === 'facturation' && !isFormateur && rentabilite && <SessionRentabilite vue={rentabilite} sessionId={session.id} />}
      {tab === 'facturation' && !isFormateur && estAgefice && (
        <SessionAgefice sessionId={session.id} dossiers={dossiersAgefice} />
      )}
      {tab === 'facturation' && !isFormateur && !estAgefice && (
        <FacturationOpco
          sessionId={session.id}
          statutSession={session.status || null}
          dendreoId={(session as any).dendreo_id || null}
          opcos={opcos}
          opcoId={(session as any).opco_id || (session as any).client?.opco_id || null}
          numeroDossier={(session as any).numero_dossier_opco || null}
          montantFinance={(session as any).montant_finance_opco ?? null}
          accordDate={(session as any).accord_pec_date || null}
          prixHt={(session as any).prix_ht ?? null}
          dejaFactureAilleurs={Number((session as any).deja_facture_ailleurs || 0)}
          accord={accordPec}
          facture={factureOpco}
        />
      )}

      {tab === 'docs' && !isFormateur && (
        <div className="space-y-4">
        <SessionDocsTab
          sessionId={session.id}
          formationId={session.formation_id || null}
          estHygiene={estFormationHygiene((session as any).formation || { intitule: session.intitule })}
          aClient={!!session.client_id}
          facture={factureOpco || null}
          participants={inscriptions.map((i: any) => i.apprenant).filter(Boolean).map((a: any) => ({ id: a.id, prenom: a.prenom, nom: a.nom, email: a.email }))}
          envois={emailLogs as any[]}
        />
        {/* Supports pédagogiques téléversés — ex-onglet Contenu */}
        <SessionContenuPedagogique
          sessionId={session.id}
          formationId={session.formation_id || null}
          deroule={session.deroule_pedagogique || null}
          materiel={session.materiel_necessaire || null}
          supports={supports as any[]}
          positionnement={positionnement as any[]}
          apprenants={inscriptions.map((i: any) => i.apprenant).filter(Boolean)}
        />
        </div>
      )}

      {tab === 'pack' && !isFormateur && (
        <SessionPackHygiene
          sessionId={session.id}
          etablissement={(session as any).client?.nom_commercial || (session as any).client?.raison_sociale || null}
          franchiseNom={(session as any).client?.franchise?.nom || null}
          formateur={(session as any).formateur || null}
        />
      )}

      {tab === 'conventions' && !isFormateur && (
        <div className="space-y-4">
          {/* Contractualisation : aperçu, envoi, état de signature */}
          {!isFormateur && (
            <SessionDocuments
              sessionId={session.id}
              hasClient={!!session.client_id}
              hasFormateur={!!(formateur?.id || session.formateur_id)}
              formateurId={formateur?.id || session.formateur_id}
              formateurNom={formateur ? `${formateur.prenom || ''} ${formateur.nom || ''}`.trim() : null}
              formateurEmail={formateur?.email || null}
              clientNom={companyLabel((session as any).client) || null}
              clientEmail={(session as any).client?.email || null}
              formationNom={(session as any).formation?.intitule || session.intitule || null}
              dates={`du ${new Date(session.date_debut).toLocaleDateString('fr-FR')} au ${new Date(session.date_fin).toLocaleDateString('fr-FR')}`}
              convention={conventions[0] || null}
              typeSession={(session as any).type_session || null}
              participants={inscriptions.map((i: any) => i.apprenant).filter(Boolean).map((a: any) => ({ id: a.id, prenom: a.prenom, nom: a.nom, email: a.email, client_id: a.client_id || null }))}
              clientsApprenants={clientsApprenants}
              conventionsSession={(conventions as any[]).map((c: any) => ({
                id: c.id, numero: c.numero, client_id: c.client_id || null, sent_at: c.sent_at || null,
                signature_client_date: c.signature_client_date || null,
                participants_snapshot: Array.isArray(c.participants_snapshot) ? c.participants_snapshot : null,
              }))}
              contrat={contratFormateur || null}
              docEmailLogs={docEmailLogs}
            />
          )}

        </div>
      )}

      <DetailReponse reponseId={detail} onClose={() => setDetail(null)} />

      <SaisieRapide
        sessionId={session.id}
        ouvert={rapide}
        onClose={() => setRapide(false)}
        qcmSessions={qcmSessions as any[]}
        reponses={qcmReponses as any[]}
        apprenants={inscriptions.map((i: any) => i.apprenant).filter(Boolean)}
        dateFin={session.date_fin || session.date_debut}
      />

      <SaisieQuestionnaire
        reponseId={saisie?.id || null}
        apprenantNom={saisie?.nom || ''}
        onClose={() => setSaisie(null)}
      />

      {/* Modal signature */}
      {/* Modifier la session */}
      {editSessionOpen && !isFormateur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 backdrop-blur-sm p-4"
          onClick={() => setEditSessionOpen(false)}>
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="text-base font-heading font-semibold text-surface-900">Modifier la session</h3>
              <button onClick={() => setEditSessionOpen(false)} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <SessionForm
                session={{ ...session, _formation_ids: sessionFormationIds } as any}
                formations={formationsRef}
                formateurs={formateursRef}
                clients={clientsRef}
                apprenants={apprenantsRef}
                initialInscrits={inscriptions.map((i: any) => i.apprenant?.id).filter(Boolean)}
                onSuccess={() => { setEditSessionOpen(false); router.refresh() }}
                onCancel={() => setEditSessionOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
