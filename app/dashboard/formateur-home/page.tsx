import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AccountNotLinked } from '@/components/dashboard/AccountNotLinked'
import { PointageButton } from '@/app/dashboard/pointage/PointageButton'
import {
  Calendar, Users, ClipboardCheck, Clock, ChevronRight, CheckCircle2,
  ListChecks, FileText, MapPin, LogIn, LogOut, UserCheck,
} from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default async function FormateurHomePage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const today = new Date().toISOString().split('T')[0]

  // Trouver la fiche formateur liée
  const { data: formateur } = await supabase
    .from('formateurs')
    .select('id, prenom, nom')
    .eq('user_id', session.user.id)
    .single()

  if (!formateur) {
    return (
      <div className="animate-fade-in">
        <AccountNotLinked roleName="Formateur" userName={session.user.first_name || 'Formateur'} />
      </div>
    )
  }

  // Requêtes indépendantes de premier niveau (sessions + pointages + QCM) en parallèle
  const [
    { data: sessions },
    { data: todayPointages },
    { data: allPointages },
    { count: qcmCount },
  ] = await Promise.all([
    // Sessions du formateur (toutes sauf annulées)
    supabase
      .from('sessions')
      .select('id, reference, status, date_debut, date_fin, lieu, formation:formation_id(intitule, duree_heures)')
      .eq('formateur_id', formateur.id)
      .not('status', 'eq', 'annulee')
      .order('date_debut', { ascending: true }),
    // Pointages du jour
    supabase
      .from('pointages_formateur')
      .select('id, heure_arrivee, heure_depart, photo_arrivee_url, photo_depart_url, session_id, session:sessions(reference, formation:formation_id(intitule))')
      .eq('formateur_id', formateur.id)
      .eq('date', today),
    // Tous les pointages (historique récent)
    supabase
      .from('pointages_formateur')
      .select('id, date, heure_arrivee, heure_depart, session:sessions(reference, formation:formation_id(intitule))')
      .eq('formateur_id', formateur.id)
      .order('date', { ascending: false })
      .limit(20),
    // QCM à corriger
    supabase
      .from('qcm')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', session.organization.id),
  ])

  const allSessions = sessions || []
  const sessionsActives = allSessions.filter(s => ['confirmee', 'en_cours'].includes(s.status))
  const sessionsTerminees = allSessions.filter(s => s.status === 'terminee')

  // Apprenants inscrits + émargements en attente (dépendent de activeIds, indépendants entre eux)
  const activeIds = sessionsActives.map(s => s.id)
  let nbApprenants = 0
  let emargementsPending = 0
  if (activeIds.length > 0) {
    const [{ count: apprenantsCount }, { count: emargementsCount }] = await Promise.all([
      supabase
        .from('inscriptions')
        .select('id', { count: 'exact', head: true })
        .in('session_id', activeIds)
        .not('status', 'in', '("annule","abandonne")'),
      supabase
        .from('emargements')
        .select('id', { count: 'exact', head: true })
        .in('session_id', activeIds)
        .eq('date', today)
        .eq('est_present', false),
    ])
    nbApprenants = apprenantsCount || 0
    emargementsPending = emargementsCount || 0
  }

  // Calcul heures totales pointées
  const totalHeures = (allPointages || []).reduce((sum, p: any) => {
    if (p.heure_arrivee && p.heure_depart) {
      return sum + (new Date(p.heure_depart).getTime() - new Date(p.heure_arrivee).getTime()) / 3600000
    }
    return sum
  }, 0)

  function formatHeure(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function calcDuree(a: string, d: string) {
    const diff = new Date(d).getTime() - new Date(a).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h${String(m).padStart(2, '0')}`
  }

  // Nombre de jours de formation par session (pour afficher J1/J2/J3...)
  function getSessionDays(dateDebut: string, dateFin: string): string[] {
    const days: string[] = []
    const d = new Date(dateDebut)
    const end = new Date(dateFin)
    while (d <= end) {
      days.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }
    return days
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Bonjour, {session.user.first_name}
        </h1>
        <p className="text-surface-500 mt-1 text-sm">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' — Espace formateur'}
        </p>
      </div>

      {/* Pointeuse du jour */}
      {sessionsActives.length > 0 && (
        <PointageButton
          todayPointages={(todayPointages || []) as any[]}
          sessionsToday={sessionsActives.map(s => ({ id: s.id, reference: s.reference, formation: s.formation as any }))}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-blue-50">
          <div className="text-2xl font-heading font-bold text-blue-600">{sessionsActives.length}</div>
          <div className="text-xs font-medium text-surface-600 mt-1">Sessions actives</div>
        </div>
        <div className="rounded-2xl p-4 bg-emerald-50">
          <div className="text-2xl font-heading font-bold text-emerald-600">{nbApprenants}</div>
          <div className="text-xs font-medium text-surface-600 mt-1">Apprenants inscrits</div>
        </div>
        <div className="rounded-2xl p-4 bg-amber-50">
          <div className="text-2xl font-heading font-bold text-amber-600">{emargementsPending}</div>
          <div className="text-xs font-medium text-surface-600 mt-1">Émargements en attente</div>
        </div>
        <div className="rounded-2xl p-4 bg-violet-50">
          <div className="text-2xl font-heading font-bold text-violet-600">{Math.round(totalHeures)}h</div>
          <div className="text-xs font-medium text-surface-600 mt-1">Heures pointées</div>
        </div>
      </div>

      {/* Outils formateur */}
      <div className="card p-4">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Mes outils</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Émargement', href: '/dashboard/emargement', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50', desc: 'Feuilles de présence' },
            { label: 'Mes apprenants', href: '/dashboard/apprenants', icon: Users, color: 'text-blue-600 bg-blue-50', desc: 'Liste par session' },
            { label: 'Rapports', href: '/dashboard/formateur-home/rapports', icon: FileText, color: 'text-rose-600 bg-rose-50', desc: 'Bilans de formation' },
            { label: 'Planning', href: '/dashboard/formateur-home/planning', icon: Calendar, color: 'text-teal-600 bg-teal-50', desc: 'Disponibilités' },
            { label: 'Mon profil', href: '/dashboard/formateur-home/profil', icon: Users, color: 'text-surface-600 bg-surface-100', desc: 'Compétences & tarifs' },
            { label: 'QCM', href: '/dashboard/qcm', icon: ListChecks, color: 'text-violet-600 bg-violet-50', desc: 'Banque de questions' },
            { label: 'Évaluations', href: '/dashboard/evaluations', icon: ClipboardCheck, color: 'text-amber-600 bg-amber-50', desc: 'Satisfaction' },
            { label: 'Documents', href: '/dashboard/documents', icon: FileText, color: 'text-amber-600 bg-amber-50', desc: 'Supports & contrats' },
            { label: 'Catalogue', href: '/dashboard/formations', icon: Calendar, color: 'text-surface-600 bg-surface-100', desc: 'Formations' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-surface-200/80 hover:shadow-card transition-all active:scale-[0.98]">
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', a.color)}>
                <a.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-800">{a.label}</div>
                <div className="text-[10px] text-surface-400 hidden sm:block">{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Sessions actives avec détail des jours et pointages */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes sessions actives</div>
        {sessionsActives.length > 0 ? sessionsActives.map((s: any) => {
          const days = getSessionDays(s.date_debut, s.date_fin)
          const sessionPointages = (allPointages || []).filter((p: any) => {
            const pSession = p.session as any
            return pSession?.reference === s.reference
          })

          return (
            <div key={s.id} className="card overflow-hidden">
              {/* En-tête session — cliquable */}
              <Link href={`/dashboard/sessions/${s.id}`} className="px-4 py-3 border-b border-surface-100 flex items-center justify-between hover:bg-surface-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-surface-900 truncate">
                    {s.formation?.intitule || s.reference}
                  </div>
                  <div className="text-xs text-surface-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                      {formatDate(s.date_debut, { day: 'numeric', month: 'short' })} — {formatDate(s.date_fin, { day: 'numeric', month: 'short' })}
                    </span>
                    {s.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.lieu}</span>}
                    {s.formation?.duree_heures && <span>{s.formation.duree_heures}h</span>}
                  </div>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0',
                  s.status === 'en_cours' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                )}>
                  {s.status === 'en_cours' ? 'En cours' : 'Confirmée'}
                </span>
              </Link>

              {/* Jours de formation avec statut de pointage */}
              <div className="divide-y divide-surface-100">
                {days.map((day, idx) => {
                  const dayPointage = sessionPointages.find((p: any) => p.date === day)
                  const isToday = day === today
                  const isPast = day < today
                  const isFuture = day > today
                  const hasArrivee = dayPointage?.heure_arrivee
                  const hasDepart = dayPointage?.heure_depart

                  return (
                    <div key={day} className={cn('px-4 py-2.5 flex items-center gap-3', isToday && 'bg-brand-50/30')}>
                      {/* Indicateur jour */}
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                        hasArrivee && hasDepart ? 'bg-emerald-100 text-emerald-700' :
                        hasArrivee ? 'bg-amber-100 text-amber-700' :
                        isToday ? 'bg-brand-100 text-brand-700' :
                        isPast ? 'bg-surface-100 text-surface-400' :
                        'bg-surface-50 text-surface-400'
                      )}>
                        J{idx + 1}
                      </div>

                      {/* Date */}
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm', isToday ? 'font-semibold text-surface-900' : 'text-surface-600')}>
                          {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          {isToday && <span className="ml-2 text-[10px] text-brand-600 font-semibold uppercase">Aujourd'hui</span>}
                        </div>
                        {/* Heures pointées */}
                        {hasArrivee && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs">
                            <span className="flex items-center gap-1 text-emerald-600">
                              <LogIn className="h-3 w-3" />{formatHeure(dayPointage.heure_arrivee)}
                            </span>
                            {hasDepart && (
                              <>
                                <span className="flex items-center gap-1 text-red-600">
                                  <LogOut className="h-3 w-3" />{formatHeure(dayPointage.heure_depart)}
                                </span>
                                <span className="font-bold text-surface-800">{calcDuree(dayPointage.heure_arrivee, dayPointage.heure_depart)}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Statut */}
                      <div className="shrink-0">
                        {hasArrivee && hasDepart ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : hasArrivee ? (
                          <Clock className="h-4 w-4 text-amber-500" />
                        ) : isPast ? (
                          <span className="text-[10px] text-surface-400">Non pointé</span>
                        ) : isFuture ? (
                          <span className="text-[10px] text-surface-300">À venir</span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }) : (
          <div className="card p-12 text-center text-sm text-surface-400">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-surface-300" />
            Aucune session active
          </div>
        )}
      </div>

      {/* Historique des pointages récents */}
      {(allPointages || []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Historique pointages</span>
            <Link href="/dashboard/pointage" className="text-xs text-brand-600 font-medium">Voir tout</Link>
          </div>
          <div className="divide-y divide-surface-100">
            {(allPointages || []).slice(0, 5).map((p: any) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-surface-700 truncate">{p.session?.formation?.intitule || p.session?.reference}</div>
                  <div className="text-xs text-surface-400">{formatDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  {p.heure_arrivee && <span className="text-emerald-600 font-mono">{formatHeure(p.heure_arrivee)}</span>}
                  {p.heure_arrivee && p.heure_depart && (
                    <>
                      <span className="text-surface-300">—</span>
                      <span className="text-red-600 font-mono">{formatHeure(p.heure_depart)}</span>
                      <span className="font-bold text-surface-800">{calcDuree(p.heure_arrivee, p.heure_depart)}</span>
                    </>
                  )}
                  {p.heure_arrivee && !p.heure_depart && (
                    <span className="text-amber-600 font-medium">En cours</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
