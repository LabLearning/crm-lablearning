import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getDashboardData } from './reporting/data'
import Link from 'next/link'
import {
  TrendingUp, Calendar, GraduationCap, Users, Euro,
  CreditCard, Clock, AlertTriangle, FileText, Receipt,
  UserPlus, ShieldCheck, Star, MessageSquareWarning,
  ArrowRight, CheckCircle2, BarChart3, Zap, ArrowUpRight,
  MapPin, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { OnboardingGuide } from './OnboardingGuide'
import { SessionProcessRow } from './SessionProcessRow'

const ROLE_REDIRECTS: Record<string, string> = {
  directeur_commercial: '/dashboard/dirco-home',
  commercial: '/dashboard/commercial',
  // Les rôles ci-dessous ont une interface portail dédiée (pas de dashboard admin)
  apporteur_affaires: '/mon-espace',
  formateur: '/mon-espace',
  apprenant: '/mon-espace',
  franchise: '/franchise',
}

export default async function DashboardPage() {
  const { user, organization } = await getSession()

  if (ROLE_REDIRECTS[user.role]) {
    redirect(ROLE_REDIRECTS[user.role])
  }

  const supabase = await createServiceRoleClient()
  const today = new Date().toISOString().split('T')[0]
  const inThreeMonths = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
  const headCount = (table: string) => supabase.from(table).select('*', { count: 'exact', head: true }).eq('organization_id', organization.id)

  // Les 3 blocs sont indépendants → exécutés en parallèle (KPIs, agenda, compteurs onboarding)
  const [data, { data: upcomingSessions }, [orgRow, fCnt, cCnt, lCnt, sCnt, dCnt, factCnt, uCnt]] = await Promise.all([
    getDashboardData().catch(() => null),
    supabase
      .from('sessions')
      .select('id, reference, status, date_debut, date_fin, lieu, intitule, mission_status, convocations_sent_at, formation:formation_id(intitule), formateur:formateurs(prenom, nom), client:client_id(raison_sociale)')
      .eq('organization_id', organization.id)
      .gte('date_fin', today)
      .lte('date_debut', inThreeMonths)
      .not('status', 'eq', 'annulee')
      .order('date_debut', { ascending: true })
      .limit(15),
    Promise.all([
      supabase.from('organizations').select('siret, representant_legal_nom, logo_url').eq('id', organization.id).single(),
      headCount('formations'), headCount('clients'), headCount('leads'),
      headCount('sessions'), headCount('devis'), headCount('factures'), headCount('users'),
    ]),
  ])

  const allSessions = upcomingSessions || []

  // État du process par session (conventions, contrats, inscriptions) — 3 requêtes batchées
  const sessionIds = allSessions.map((s: any) => s.id)
  const [convRows, contratRows, inscRows] = sessionIds.length > 0
    ? await Promise.all([
        supabase.from('conventions').select('session_id, status').in('session_id', sessionIds),
        supabase.from('contrats_formateur').select('session_id, signature_formateur_date').in('session_id', sessionIds),
        supabase.from('inscriptions').select('session_id').in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }] as any

  const convBySession = new Map<string, string>()
  for (const c of (convRows.data || []) as any[]) convBySession.set(c.session_id, c.status)
  const contratSigneBySession = new Set<string>()
  for (const c of (contratRows.data || []) as any[]) if (c.signature_formateur_date) contratSigneBySession.add(c.session_id)
  const inscritsBySession = new Map<string, number>()
  for (const i of (inscRows.data || []) as any[]) inscritsBySession.set(i.session_id, (inscritsBySession.get(i.session_id) || 0) + 1)

  /** Session + état d'avancement, pour la barre de process du tableau de bord */
  const toProcess = (s: any) => ({
    id: s.id,
    reference: s.reference,
    intitule: s.formation?.intitule || s.intitule || s.reference || 'Session',
    clientNom: s.client?.raison_sociale || null,
    formateurNom: s.formateur ? `${s.formateur.prenom || ''} ${s.formateur.nom || ''}`.trim() : null,
    lieu: s.lieu || null,
    dateDebut: s.date_debut,
    status: s.status,
    formateurCale: !!s.formateur && (s.mission_status === 'accepted' || s.mission_status === 'not_required'),
    contratSigne: contratSigneBySession.has(s.id),
    conventionSignee: ['signee_client', 'signee_of', 'signee_complete'].includes(convBySession.get(s.id) || ''),
    participants: inscritsBySession.get(s.id) || 0,
    convocationsEnvoyees: !!s.convocations_sent_at,
  })
  const sessionsEnCours = allSessions.filter(s => s.status === 'en_cours' || (s.date_debut <= today && s.date_fin >= today))
  const sessionsAVenir = allSessions.filter(s => s.date_debut > today)
  const onboardingFlags = {
    org: !!((orgRow.data as any)?.siret && (orgRow.data as any)?.representant_legal_nom && (orgRow.data as any)?.logo_url),
    formations: (fCnt.count || 0) > 0,
    clients: (cCnt.count || 0) > 0,
    leads: (lCnt.count || 0) > 0,
    sessions: (sCnt.count || 0) > 0,
    devis: (dCnt.count || 0) > 0,
    factures: (factCnt.count || 0) > 0,
    team: (uCnt.count || 0) > 1,
  }

  const SESSION_STATUS: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' }> = {
    planifiee: { label: 'Planifiée', variant: 'default' },
    confirmee: { label: 'Confirmée', variant: 'info' },
    en_cours: { label: 'En cours', variant: 'success' },
    terminee: { label: 'Terminée', variant: 'default' },
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const quickLinks = [
    { label: 'Nouveau lead', href: '/dashboard/leads', icon: UserPlus },
    { label: 'Créer un devis', href: '/dashboard/devis', icon: FileText },
    { label: 'Sessions', href: '/dashboard/sessions', icon: Calendar },
    { label: 'Factures', href: '/dashboard/factures', icon: Receipt },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-surface-900 tracking-display">
            {getGreeting()}, {user.first_name}
          </h1>
          <p className="text-surface-500 mt-1 text-sm">{organization.name}</p>
        </div>
        <div className="flex gap-2">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-surface-600 bg-white border border-surface-200/80 hover:border-surface-300 hover:shadow-card hover:text-surface-800 transition-all duration-200 group">
              <link.icon className="h-4 w-4 text-surface-400 group-hover:text-brand-500 transition-colors" />
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Guide de démarrage (masquable) */}
      <OnboardingGuide flags={onboardingFlags} firstName={user.first_name} />

      {/* ── Agenda des sessions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions en cours */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between" style={{ backgroundColor: 'rgba(25,82,69,0.04)' }}>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">En cours</span>
            </div>
            <span className="text-xs text-surface-400">{sessionsEnCours.length}</span>
          </div>
          {sessionsEnCours.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {sessionsEnCours.map((s: any) => (
                <SessionProcessRow key={s.id} session={toProcess(s)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-surface-400">Aucune session en cours</div>
          )}
        </div>

        {/* Sessions à venir */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Sessions à venir</span>
            <Link href="/dashboard/sessions" className="text-xs text-brand-500 font-medium flex items-center gap-1 hover:text-brand-600">
              Toutes les sessions <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {sessionsAVenir.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {sessionsAVenir.slice(0, 6).map((s: any) => (
                <SessionProcessRow key={s.id} session={toProcess(s)} showDate />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-surface-400">Aucune session programmée</div>
          )}
        </div>
      </div>

      {data ? (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'CA Réalisé', value: `${data.ca_realise.toLocaleString('fr-FR')} €`, sub: `${data.ca_mois.toLocaleString('fr-FR')} € ce mois`, icon: Euro, iconBg: 'bg-surface-100', iconColor: 'text-surface-600' },
              { label: 'Encaissé', value: `${data.encaisse.toLocaleString('fr-FR')} €`, sub: null, icon: CreditCard, iconBg: 'bg-success-50', iconColor: 'text-success-600' },
              { label: 'Sessions', value: String(data.sessions_en_cours), sub: `en cours · ${data.sessions_a_venir} à venir`, icon: Calendar, iconBg: 'bg-brand-50', iconColor: 'text-brand-600' },
              { label: 'Apprenants', value: String(data.apprenants_formes), sub: `formés · ${data.apprenants_en_cours} en cours`, icon: GraduationCap, iconBg: 'bg-surface-100', iconColor: 'text-surface-600' },
            ].map((kpi) => (
              <div key={kpi.label} className="stat-card">
                <div className={`stat-icon ${kpi.iconBg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="stat-label">{kpi.label}</p>
                  <p className="stat-value text-surface-900 mt-0.5">{kpi.value}</p>
                  {kpi.sub && <p className="stat-sub">{kpi.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Alerts */}
            <div className="card p-6 space-y-5">
              <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Alertes</h2>
              <div className="space-y-2.5">
                {data.factures_en_retard > 0 && (
                  <Link href="/dashboard/factures" className="flex items-center gap-3 p-3.5 rounded-xl bg-danger-50/60 border border-danger-100 hover:bg-danger-50 transition-colors group">
                    <Receipt className="h-4 w-4 text-danger-500 shrink-0" />
                    <span className="text-sm text-danger-700 flex-1">{data.factures_en_retard} facture{data.factures_en_retard > 1 ? 's' : ''} en retard</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-danger-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                )}
                {data.impaye > 0 && (
                  <Link href="/dashboard/factures" className="flex items-center gap-3 p-3.5 rounded-xl bg-warning-50/60 border border-warning-100 hover:bg-warning-50 transition-colors group">
                    <AlertTriangle className="h-4 w-4 text-warning-500 shrink-0" />
                    <span className="text-sm text-warning-700 flex-1">{data.impaye.toLocaleString('fr-FR')} € d&apos;impayés</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-warning-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                )}
                {data.reclamations_ouvertes > 0 && (
                  <Link href="/dashboard/reclamations" className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-50 border border-surface-200/80 hover:bg-surface-100 transition-colors group">
                    <MessageSquareWarning className="h-4 w-4 text-surface-500 shrink-0" />
                    <span className="text-sm text-surface-700 flex-1">{data.reclamations_ouvertes} réclamation{data.reclamations_ouvertes > 1 ? 's' : ''}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                )}
                {data.habilitations_a_renouveler > 0 && (
                  <Link href="/dashboard/formateurs" className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-50 border border-surface-200/80 hover:bg-surface-100 transition-colors group">
                    <ShieldCheck className="h-4 w-4 text-surface-500 shrink-0" />
                    <span className="text-sm text-surface-700 flex-1">{data.habilitations_a_renouveler} habilitation{data.habilitations_a_renouveler > 1 ? 's' : ''}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                )}
                {data.factures_en_retard === 0 && data.impaye === 0 && data.reclamations_ouvertes === 0 && data.habilitations_a_renouveler === 0 && (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-success-50/60 border border-success-100">
                    <CheckCircle2 className="h-4 w-4 text-success-500" />
                    <span className="text-sm text-success-700">Tout est en ordre</span>
                  </div>
                )}
              </div>

              {/* Quality mini-stats */}
              <div className="pt-4 border-t border-surface-100 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-2xs text-surface-400">Satisfaction</div><div className="text-sm font-semibold text-surface-800">{data.taux_satisfaction}%</div></div>
                <div><div className="text-2xs text-surface-400">Réussite</div><div className="text-sm font-semibold text-surface-800">{data.taux_reussite}%</div></div>
                <div><div className="text-2xs text-surface-400">Qualiopi</div><div className="text-sm font-semibold text-brand-600">{data.conformite_qualiopi}%</div></div>
              </div>
            </div>

            {/* Right column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Pipeline */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Pipeline commercial</h2>
                  <Link href="/dashboard/leads" className="text-xs text-surface-500 hover:text-brand-600 font-medium flex items-center gap-1 transition-colors">
                    Voir tout <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Leads', value: data.leads_total, color: 'text-surface-800' },
                    { label: 'Devis en attente', value: data.devis_en_attente, color: 'text-brand-600' },
                    { label: 'Transformation', value: `${data.taux_transformation}%`, color: 'text-success-600' },
                    { label: 'Valeur pipeline', value: `${data.leads_valeur.toLocaleString('fr-FR')} €`, color: 'text-surface-800' },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl bg-surface-50">
                      <div className={`text-xl font-heading font-bold tracking-tight ${s.color}`}>{s.value}</div>
                      <div className="text-[11px] text-surface-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Activité récente</h2>
                  <Link href="/dashboard/reporting" className="text-xs text-surface-500 hover:text-brand-600 font-medium flex items-center gap-1 transition-colors">
                    Rapports <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {data.activite_recente.length > 0 ? (
                  <div className="space-y-0">
                    {data.activite_recente.slice(0, 6).map((event, i) => (
                      <div key={i} className="flex items-start gap-3 py-2.5 border-b border-surface-100/80 last:border-0">
                        <div className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-400" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-surface-600">
                            <span className="font-medium text-surface-800">{event.user_name}</span>
                            <span className="text-surface-400"> — </span>
                            {event.action} {event.entity_type}
                          </div>
                          <div className="text-[11px] text-surface-400 mt-0.5">{formatDateTime(event.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Clock className="h-5 w-5 mx-auto text-surface-300 mb-2" />
                    <p className="text-sm text-surface-400">L&apos;activité apparaîtra ici</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Qualiopi bar */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Conformité Qualiopi</h2>
              </div>
              <Link href="/dashboard/qualiopi" className="text-xs text-surface-500 hover:text-brand-600 font-medium flex items-center gap-1 transition-colors">
                Détail <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
              <div className="h-full rounded-full bg-brand-500 transition-all duration-700 ease-out" style={{ width: `${data.conformite_qualiopi}%` }} />
            </div>
            <div className="text-xs text-surface-400 mt-2">{data.conformite_qualiopi}% de conformité sur les 32 indicateurs</div>
          </div>
        </>
      ) : (
        <div className="card p-16 text-center">
          <BarChart3 className="h-6 w-6 text-surface-300 mx-auto mb-3" />
          <p className="text-sm text-surface-500">Les données du tableau de bord seront disponibles après la création de vos premières données.</p>
        </div>
      )}
    </div>
  )
}
