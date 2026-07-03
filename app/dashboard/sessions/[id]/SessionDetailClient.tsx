'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, UserCheck, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, LogIn, LogOut, FileText, Plus, Loader2,
  GraduationCap, Mail, Phone, Building2, Camera, PenTool, Download,
  Star, ListChecks, FileSignature, Award,
} from 'lucide-react'
import { Badge, PoeiBadge } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { updateSessionStatusAction, togglePresenceAction, createEmargementJourAction, signEmargementAction } from './actions'
import { SignaturePad } from './SignaturePad'
import { SendDocButton } from './SendDocButton'
import { SessionDocActions } from './SessionDocActions'

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
  inscriptions: any[]
  emargements: any[]
  pointages: any[]
  rapport: any
  evaluations?: any[]
  qcmSessions?: any[]
  conventions?: any[]
  evaluationsAppr?: any[]
  isFormateur: boolean
  userRole: string
  isPoei?: boolean
}

const SESSION_STATUS: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'danger' }> = {
  planifiee: { label: 'Planifiée', variant: 'default' },
  confirmee: { label: 'Confirmée', variant: 'info' },
  en_cours: { label: 'En cours', variant: 'success' },
  terminee: { label: 'Terminée', variant: 'default' },
  annulee: { label: 'Annulée', variant: 'danger' },
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planifiee: ['confirmee', 'annulee'],
  confirmee: ['en_cours', 'annulee'],
  en_cours: ['terminee'],
  terminee: [],
  annulee: [],
}

export function SessionDetailClient({ session, inscriptions, emargements, pointages, rapport, evaluations = [], qcmSessions = [], conventions = [], evaluationsAppr = [], isFormateur, userRole, isPoei }: Props) {
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'session' | 'presences' | 'apprenants' | 'pointages' | 'rapport' | 'evaluations' | 'qcm' | 'conventions'>('session')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const [createDate, setCreateDate] = useState('')
  const [createCreneau, setCreateCreneau] = useState('journee')
  const [signingEmargement, setSigningEmargement] = useState<{ id: string; name: string } | null>(null)

  const formation = session.formation
  const formateur = session.formateur
  const canChangeStatus = isFormateur || ['super_admin', 'gestionnaire', 'directeur_commercial'].includes(userRole)
  const canEmarge = isFormateur || ['super_admin', 'gestionnaire'].includes(userRole)
  const nextStatuses = STATUS_TRANSITIONS[session.status] || []
  const today = new Date().toISOString().split('T')[0]

  // Jours de la session
  function getSessionDays(): string[] {
    const days: string[] = []
    const d = new Date(session.date_debut)
    const end = new Date(session.date_fin)
    while (d <= end) {
      days.push(d.toISOString().split('T')[0])
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
    startTransition(async () => { await updateSessionStatusAction(session.id, newStatus) })
  }

  function handleTogglePresence(emargementId: string, current: boolean) {
    startTransition(async () => { await togglePresenceAction(emargementId, !current) })
  }

  function handleCreateEmargement() {
    if (!createDate) return
    startTransition(async () => {
      await createEmargementJourAction(session.id, createDate, createCreneau)
      setCreateDate('')
    })
  }

  function handleSign(signatureBase64: string) {
    if (!signingEmargement) return
    startTransition(async () => {
      await signEmargementAction(signingEmargement.id, signatureBase64)
      setSigningEmargement(null)
    })
  }

  // Stats émargement globales
  const totalEmargements = emargements.length
  const totalPresents = emargements.filter(e => e.est_present).length

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/sessions" className="mt-1 p-2 rounded-xl hover:bg-surface-100 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5 text-surface-500" />
        </Link>
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
            {session.lieu && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{session.lieu}</span>}
            {formation?.duree_heures && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formation.duree_heures}h</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{inscriptions.length} apprenant{inscriptions.length > 1 ? 's' : ''}</span>
          </div>
          {session.formation_id && (
            <a href={`/api/pdf/programme/${session.formation_id}?session=${session.id}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-500 text-xs font-medium hover:bg-brand-100 transition-colors">
              <Download className="h-3.5 w-3.5" /> Programme (avec dates de session)
            </a>
          )}
        </div>
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

      {/* Onglets */}
      <div className="flex gap-1 bg-surface-100 rounded-lg p-0.5 overflow-x-auto">
        {[
          { id: 'session' as const, label: 'Session', icon: Calendar },
          { id: 'apprenants' as const, label: `Apprenants (${inscriptions.length})`, icon: Users },
          { id: 'presences' as const, label: 'Émargement', icon: UserCheck },
          { id: 'pointages' as const, label: `Pointages (${pointages.length})`, icon: Clock },
          { id: 'evaluations' as const, label: `Évaluations (${evaluations.length})`, icon: Star },
          { id: 'qcm' as const, label: `QCM (${qcmSessions.length})`, icon: ListChecks },
          { id: 'rapport' as const, label: 'Rapport', icon: FileText },
          ...(!isFormateur ? [{ id: 'conventions' as const, label: `Conventions (${conventions.length})`, icon: FileSignature }] : []),
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
          {/* Envois : convention en signature + contrat formateur */}
          {!isFormateur && (
            <SessionDocActions sessionId={session.id} hasClient={!!session.client_id} hasFormateur={!!(formateur?.id || session.formateur_id)} />
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
          ONGLET PRÉSENCES — Émargement par jour
          ═══════════════════════════════════════════════ */}
      {tab === 'presences' && (
        <div className="space-y-4">
          {!isFormateur && (
            <div className="flex justify-end">
              <a href={`/api/pdf/emargement/${session.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors">
                <Download className="h-3.5 w-3.5" /> Feuille d'émargement (PDF)
              </a>
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
                {totalEmargements > 0 ? Math.round((totalPresents / totalEmargements) * 100) : 0}%
              </div>
              <div className="text-xs text-surface-600">Assiduité</div>
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
                      const signedTime = em.signed_at ? new Date(em.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null

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
                            {isSigned
                              ? <PenTool className="h-4 w-4 text-emerald-600" />
                              : em.est_present
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              : <XCircle className="h-4 w-4 text-surface-300" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-surface-900">{apprenant?.prenom} {apprenant?.nom}</div>
                            <div className="text-xs text-surface-400 flex items-center gap-2">
                              {apprenant?.entreprise && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{apprenant.entreprise}</span>}
                              {signedTime && <span className="text-emerald-500">Signé à {signedTime}</span>}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isSigned && em.signature_data && (
                              <a href={em.signature_data} target="_blank" rel="noopener noreferrer"
                                className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                                <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                              </a>
                            )}

                            {!em.est_present && canEmarge && (
                              <button
                                onClick={() => setSigningEmargement({ id: em.id, name: `${apprenant?.prenom} ${apprenant?.nom}` })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 transition-colors"
                              >
                                <PenTool className="h-3.5 w-3.5" /> Faire signer
                              </button>
                            )}

                            {!em.est_present && canEmarge && (
                              <button
                                onClick={() => handleTogglePresence(em.id, em.est_present)}
                                disabled={isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 text-surface-600 text-xs font-medium hover:bg-surface-200 transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Présent
                              </button>
                            )}

                            {em.est_present && !isSigned && canEmarge && (
                              <button
                                onClick={() => handleTogglePresence(em.id, em.est_present)}
                                disabled={isPending}
                                className="text-xs text-surface-400 hover:text-red-500 transition-colors"
                              >
                                Annuler
                              </button>
                            )}
                          </div>
                          <span className={cn('text-xs font-semibold shrink-0 hidden sm:block', em.est_present ? 'text-emerald-600' : 'text-surface-400')}>
                            {em.est_present ? 'Présent' : 'Absent'}
                          </span>
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
                const appTotal = appEmargements.length
                const assiduity = appTotal > 0 ? Math.round((appPresent / appTotal) * 100) : null

                return (
                  <div key={ins.id} className="px-4 py-3.5 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">{(a?.prenom?.[0] || '')}{(a?.nom?.[0] || '')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900">{a?.prenom} {a?.nom}</div>
                      <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap">
                        {a?.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{a.email}</span>}
                        {a?.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{a.telephone}</span>}
                        {a?.entreprise && <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{a.entreprise}</span>}
                      </div>
                      {evaluationsAppr.filter((e) => e.apprenant_id === a?.id && e.note != null).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {evaluationsAppr.filter((e) => e.apprenant_id === a?.id && e.note != null).map((e) => {
                            const ratio = e.note_max ? e.note / e.note_max : null
                            const color = ratio == null ? 'bg-surface-100 text-surface-600' : ratio >= 0.7 ? 'bg-emerald-50 text-emerald-700' : ratio >= 0.5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                            return (
                              <span key={e.id} title={e.intitule || ''} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', color)}>
                                <Award className="h-3 w-3" />{Number(e.note)}{e.note_max ? `/${Number(e.note_max)}` : ''}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {assiduity !== null && (
                        <div className="text-right">
                          <div className={cn('text-sm font-bold', assiduity >= 80 ? 'text-emerald-600' : assiduity >= 50 ? 'text-amber-600' : 'text-red-600')}>
                            {assiduity}%
                          </div>
                          <div className="text-[10px] text-surface-400">assiduité</div>
                        </div>
                      )}
                      <Badge variant={ins.status === 'confirme' ? 'success' : ins.status === 'inscrit' ? 'info' : 'default'}>
                        {ins.status === 'confirme' ? 'Confirmé' : ins.status === 'inscrit' ? 'Inscrit' : ins.status}
                      </Badge>
                    </div>
                    {/* Documents : télécharger (admin) + envoyer à l'apprenant */}
                    {!isFormateur && (
                      <div className="flex items-center gap-1 mt-2 sm:mt-0 flex-wrap justify-end">
                        <a href={`/api/pdf/attestation-entree/${a?.id}?session=${session.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-medium hover:bg-emerald-100 transition-colors">
                          <Download className="h-3 w-3" /> Attestation d&apos;entrée
                        </a>
                        <a href={`/api/pdf/convocation/${a?.id}?session=${session.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-50 text-surface-500 text-[10px] font-medium hover:bg-surface-100 transition-colors">
                          <Download className="h-3 w-3" /> Convocation
                        </a>
                        <a href={`/api/pdf/attestation/${a?.id}?session=${session.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-50 text-surface-500 text-[10px] font-medium hover:bg-surface-100 transition-colors">
                          <Download className="h-3 w-3" /> Attestation
                        </a>
                        <SendDocButton sessionId={session.id} apprenantId={a?.id} docType="attestation" label="Envoyer" />
                        <a href={`/api/pdf/certificat-realisation/${a?.id}?session=${session.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-50 text-surface-500 text-[10px] font-medium hover:bg-surface-100 transition-colors">
                          <Download className="h-3 w-3" /> Certificat
                        </a>
                        <SendDocButton sessionId={session.id} apprenantId={a?.id} docType="certificat" label="Envoyer" />
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
                      {rapport.status === 'soumis' ? 'Soumis le ' + formatDate(rapport.submitted_at, { day: 'numeric', month: 'long' }) : 'Brouillon en cours'}
                    </div>
                  </div>
                </div>
                <Badge variant={rapport.status === 'valide' ? 'success' : rapport.status === 'soumis' ? 'warning' : 'default'}>
                  {rapport.status === 'valide' ? 'Validé' : rapport.status === 'soumis' ? 'Soumis' : 'Brouillon'}
                </Badge>
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET POINTAGES (formateur)
          ═══════════════════════════════════════════════ */}
      {tab === 'pointages' && (
        <div className="space-y-3">
          {pointages.length === 0 ? (
            <div className="card p-8 text-center">
              <Clock className="h-8 w-8 text-surface-300 mx-auto mb-2" />
              <div className="text-sm text-surface-500">Aucun pointage enregistré pour cette session</div>
              {isFormateur && <div className="text-xs text-surface-400 mt-1">Le formateur peut pointer son arrivée/départ chaque jour depuis son espace.</div>}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-surface-100">
                {pointages.map((p: any) => (
                  <div key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-surface-400 shrink-0" />
                    <div className="font-medium text-surface-900 w-32">
                      {new Date(p.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    {p.heure_arrivee && (
                      <div className="flex items-center gap-1.5 text-xs text-surface-700">
                        <LogIn className="h-3 w-3 text-emerald-600" /> {p.heure_arrivee}
                      </div>
                    )}
                    {p.heure_depart && (
                      <div className="flex items-center gap-1.5 text-xs text-surface-700">
                        <LogOut className="h-3 w-3 text-red-500" /> {p.heure_depart}
                      </div>
                    )}
                    {(p.photo_arrivee_url || p.photo_depart_url) && (
                      <div className="ml-auto flex gap-2">
                        {p.photo_arrivee_url && (
                          <a href={p.photo_arrivee_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                            <Camera className="h-3 w-3" /> arrivée
                          </a>
                        )}
                        {p.photo_depart_url && (
                          <a href={p.photo_depart_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                            <Camera className="h-3 w-3" /> départ
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET ÉVALUATIONS
          ═══════════════════════════════════════════════ */}
      {tab === 'evaluations' && (
        <div className="space-y-3">
          {evaluations.length === 0 ? (
            <div className="card p-8 text-center">
              <Star className="h-8 w-8 text-surface-300 mx-auto mb-2" />
              <div className="text-sm text-surface-500">Aucune évaluation de satisfaction enregistrée</div>
              <div className="text-xs text-surface-400 mt-1">Les apprenants peuvent évaluer la formation à chaud (fin) ou à froid (3 mois après).</div>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET QCM
          ═══════════════════════════════════════════════ */}
      {tab === 'qcm' && (
        <div className="space-y-3">
          {qcmSessions.length === 0 ? (
            <div className="card p-8 text-center">
              <ListChecks className="h-8 w-8 text-surface-300 mx-auto mb-2" />
              <div className="text-sm text-surface-500">Aucun QCM passé pour cette session</div>
              <div className="text-xs text-surface-400 mt-1">Les QCM (test de positionnement, milieu de formation, etc.) seront listés ici.</div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-surface-100">
                {qcmSessions.map((q: any) => (
                  <div key={q.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                    <ListChecks className="h-4 w-4 text-brand-500 shrink-0" />
                    <div className="font-medium text-surface-900 flex-1 min-w-0 truncate">
                      {q.qcm?.titre || 'QCM'}
                    </div>
                    {q.score !== null && q.score !== undefined && (
                      <div className={`text-xs px-2 py-0.5 rounded-full ${
                        q.score >= 70 ? 'bg-emerald-50 text-emerald-700' : q.score >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {q.score}%
                      </div>
                    )}
                    <span className="text-xs text-surface-500 capitalize">{q.status}</span>
                    {q.completed_at && (
                      <span className="text-xs text-surface-500">
                        {new Date(q.completed_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ONGLET CONVENTIONS
          ═══════════════════════════════════════════════ */}
      {tab === 'conventions' && !isFormateur && (
        <div className="space-y-4">
          <SessionDocActions sessionId={session.id} hasClient={!!session.client_id} hasFormateur={!!(formateur?.id || session.formateur_id)} />

          {conventions.length === 0 ? (
            <div className="card p-8 text-center">
              <FileSignature className="h-8 w-8 text-surface-300 mx-auto mb-2" />
              <div className="text-sm text-surface-500">Aucune convention pour cette session</div>
              <div className="text-xs text-surface-400 mt-1">Utilisez « Convention en signature » ci-dessus pour la créer et l'envoyer au client.</div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-surface-100">
                {conventions.map((c: any) => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <FileSignature className="h-5 w-5 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900">{c.numero}</div>
                      <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap">
                        {c.montant_ttc != null && <span>{Number(c.montant_ttc).toLocaleString('fr-FR')} € TTC</span>}
                        <span className={c.signature_client_date ? 'text-emerald-600' : 'text-surface-400'}>
                          Client {c.signature_client_date ? 'signé' : 'en attente'}
                        </span>
                        <span className={c.signature_of_date ? 'text-emerald-600' : 'text-surface-400'}>
                          OF {c.signature_of_date ? 'signé' : 'en attente'}
                        </span>
                      </div>
                    </div>
                    <Badge variant={CONVENTION_STATUS[c.status]?.variant || 'default'}>
                      {CONVENTION_STATUS[c.status]?.label || c.status}
                    </Badge>
                    <a href={`/api/pdf/convention/${c.id}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-50 text-surface-600 text-xs font-medium hover:bg-surface-100 transition-colors shrink-0">
                      <Download className="h-3.5 w-3.5" /> PDF
                    </a>
                    <Link href={`/dashboard/conventions/${c.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors shrink-0">
                      Ouvrir
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal signature */}
      {signingEmargement && (
        <SignaturePad
          apprenantName={signingEmargement.name}
          onSign={handleSign}
          onCancel={() => setSigningEmargement(null)}
          isPending={isPending}
        />
      )}
    </div>
  )
}
