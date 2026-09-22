import type { BadgeVariant } from '@/lib/types'
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
  MapPin, ChevronRight, Briefcase,
} from '@/components/ui/icons'
import { Badge } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { OnboardingGuide } from './OnboardingGuide'
import { SessionsTable } from './SessionsTable'

const ROLE_REDIRECTS: Record<string, string> = {
  directeur_commercial: '/dashboard/dirco-home',
  commercial: '/dashboard/commercial',
  // Les rôles ci-dessous ont une interface portail dédiée (pas de dashboard admin)
  apporteur_affaires: '/apporteur',
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
      .select('id, reference, status, date_debut, date_fin, lieu, intitule, mission_status, convocations_sent_at, poei_intervention_id, formation:formation_id(intitule, is_poei), formateur:formateurs(prenom, nom), client:client_id(raison_sociale)')
      .eq('organization_id', organization.id)
      .gte('date_fin', today)
      .lte('date_debut', inThreeMonths)
      .not('status', 'eq', 'annulee')
      .is('poei_intervention_id', null)
      .order('date_debut', { ascending: true })
      .limit(60),
    Promise.all([
      supabase.from('organizations').select('siret, representant_legal_nom, logo_url').eq('id', organization.id).single(),
      headCount('formations'), headCount('clients'), headCount('leads'),
      headCount('sessions'), headCount('devis'), headCount('factures'), headCount('users'),
    ]),
  ])

  const allSessions = upcomingSessions || []

  // Terminées récemment (30 derniers jours)
  const ilYA30j = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const { data: terminees } = await supabase
    .from('sessions')
    .select('id, reference, status, date_debut, date_fin, intitule, poei_intervention_id, formation:formation_id(intitule, is_poei), formateur:formateurs(prenom, nom), client:client_id(raison_sociale)')
    .eq('organization_id', organization.id)
    .eq('status', 'terminee')
    .gte('date_fin', ilYA30j)
    .lt('date_fin', today)
    .is('poei_intervention_id', null)
    .order('date_fin', { ascending: false })
    .limit(30)

  // État du process par session (conventions, contrats, inscriptions) — requêtes batchées
  const sessionIds = [...allSessions, ...(terminees || [])].map((s: any) => s.id)
  const [convRows, contratRows, inscRows, poeiRows] = sessionIds.length > 0
    ? await Promise.all([
        supabase.from('conventions').select('session_id, status').in('session_id', sessionIds),
        supabase.from('contrats_formateur').select('session_id, signature_formateur_date').in('session_id', sessionIds).neq('status', 'annule'),
        supabase.from('inscriptions').select('session_id').in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")'),
        // Sessions « parcours » POEI : elles n'ont pas de formateur par nature
        supabase.from('poei').select('id, session_id').in('session_id', sessionIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }] as any

  const parcoursPoei = new Set<string>()
  const poeiParSession = new Map<string, string>()
  for (const p of (poeiRows.data || []) as any[]) if (p.session_id) { parcoursPoei.add(p.session_id); poeiParSession.set(p.session_id, p.id) }

  // Parcours POEI de la fenêtre (30 jours passés à 3 mois), lus dans le
  // dossier lui-même : un dossier sans session chapeau y figure quand même,
  // et ce sont ses dates qui disent s'il est en cours, à venir ou terminé
  // (le statut de la session chapeau n'est pas tenu à jour).
  const { data: poeis } = await supabase.from('poei')
    .select('id, numero, statut, date_debut, date_fin, session_id, poste_vise, client:client_id(raison_sociale), formation:formation_id(intitule), candidats:poei_candidats(id, statut)')
    .eq('organization_id', organization.id)
    .not('date_debut', 'is', null).gte('date_fin', ilYA30j).lte('date_debut', inThreeMonths)
    .order('date_debut', { ascending: true })

  // Formateurs des parcours POEI : portés par les interventions, pas par la
  // session chapeau. Celui qui intervient aujourd'hui est cité en premier.
  const formateursParPoei = new Map<string, string>()
  const poeiIds = ((poeis || []) as any[]).map((p) => p.id)
  if (poeiIds.length) {
    // Le formateur est sur l'intervention, ou sur la session d'intervention
    // qu'elle a engendrée (c'est elle que le formateur anime) : on lit les deux.
    const { data: interv } = await supabase.from('poei_interventions')
      .select('id, poei_id, date_debut, date_fin, formateur:formateur_id(prenom, nom)')
      .in('poei_id', poeiIds).order('date_debut', { ascending: true })
    const intervIds = ((interv || []) as any[]).map((i) => i.id)
    const { data: sessInterv } = intervIds.length
      ? await supabase.from('sessions').select('poei_intervention_id, formateur:formateurs(prenom, nom)').in('poei_intervention_id', intervIds).not('formateur_id', 'is', null)
      : { data: [] as any[] }
    const formateurSessionInterv = new Map<string, any>()
    for (const x of (sessInterv || []) as any[]) if (x.formateur) formateurSessionInterv.set(x.poei_intervention_id, x.formateur)
    const parPoei = new Map<string, { nom: string; enCours: boolean }[]>()
    for (const i of (interv || []) as any[]) {
      const f = i.formateur || formateurSessionInterv.get(i.id)
      const nom = `${f?.prenom || ''} ${f?.nom || ''}`.trim()
      if (!nom) continue
      const liste = parPoei.get(i.poei_id) || []
      const enCours = !!i.date_debut && !!i.date_fin && i.date_debut <= today && i.date_fin >= today
      const existant = liste.find((x) => x.nom === nom)
      if (existant) existant.enCours = existant.enCours || enCours
      else liste.push({ nom, enCours })
      parPoei.set(i.poei_id, liste)
    }
    for (const [pid, liste] of parPoei) {
      const tries = [...liste].sort((a, b) => Number(b.enCours) - Number(a.enCours))
      formateursParPoei.set(pid, tries.slice(0, 2).map((x) => x.nom).join(', ') + (tries.length > 2 ? ` +${tries.length - 2}` : ''))
    }
  }

  // Deux familles : les sessions OPCO (plan de développement des compétences)
  // et les parcours POEI. Les sessions d'intervention POEI sont des sous-
  // périodes du parcours : elles n'apparaissent pas en plus de lui.
  const estPoei = (s: any) => !!s.formation?.is_poei || parcoursPoei.has(s.id) || !!s.poei_intervention_id
  const coteOpco = (s: any) => !estPoei(s)

  // Une ligne de tableau par dossier POEI : état déduit des dates du dossier,
  // stagiaires = candidats non abandonnés, clic vers le dossier.
  const poeiEnLigne = (p: any) => {
    const fin = p.date_fin || p.date_debut
    const status = fin < today ? 'terminee' : p.date_debut > today ? 'planifiee' : 'en_cours'
    return {
      id: p.id,
      intitule: p.formation?.intitule || (p.poste_vise ? `POEI ${p.poste_vise}` : `POEI ${p.numero || ''}`.trim()),
      formation: p.formation, client: p.client, formateur: null,
      date_debut: p.date_debut, date_fin: fin, status,
      _inscrits: ((p.candidats || []) as any[]).filter((c) => c.statut !== 'abandonne').length,
      _href: `/dashboard/poei/${p.id}`, _poei: true, _formateurs: formateursParPoei.get(p.id),
    }
  }
  const poeiLignes = ((poeis || []) as any[]).map(poeiEnLigne)
  const poeiEnCours = poeiLignes.filter((x) => x.status === 'en_cours')
  const poeiAVenir = poeiLignes.filter((x) => x.status === 'planifiee')
  const poeiTerminees = poeiLignes.filter((x) => x.status === 'terminee').sort((a, b) => String(b.date_fin).localeCompare(String(a.date_fin)))

  const convBySession = new Map<string, string>()
  for (const c of (convRows.data || []) as any[]) convBySession.set(c.session_id, c.status)
  const contratSigneBySession = new Set<string>()
  for (const c of (contratRows.data || []) as any[]) if (c.signature_formateur_date) contratSigneBySession.add(c.session_id)
  const inscritsBySession = new Map<string, number>()
  for (const i of (inscRows.data || []) as any[]) inscritsBySession.set(i.session_id, (inscritsBySession.get(i.session_id) || 0) + 1)

  /** Session + état d'avancement, pour la barre de process du tableau de bord */
  const sessionsEnCours = allSessions.filter(s => s.date_debut <= today && s.date_fin >= today)
  const sessionsAVenir = allSessions.filter(s => s.date_debut > today)

  const enTableau = (s: any) => (s._poei ? s : { ...s, _inscrits: inscritsBySession.get(s.id) || 0, _poei: false })
  const colonnes = [
    {
      cle: 'opco', titre: 'Sessions OPCO', Icone: Calendar, lienTous: '/dashboard/sessions', lienPassees: '/dashboard/sessions?periode=passees',
      enCours: sessionsEnCours.filter(coteOpco), aVenir: sessionsAVenir.filter(coteOpco), terminees: (terminees || []).filter(coteOpco),
    },
    {
      cle: 'poei', titre: 'POEI', Icone: Briefcase, lienTous: '/dashboard/poei', lienPassees: '/dashboard/poei',
      enCours: poeiEnCours, aVenir: poeiAVenir, terminees: poeiTerminees,
    },
  ]
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

  // Convention de couleur commune (cf. SESSION_STATUS_COLORS)
  const SESSION_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
    planifiee: { label: 'Planifiée', variant: 'info' },
    confirmee: { label: 'Confirmée', variant: 'info' },
    en_cours: { label: 'En cours', variant: 'success' },
    terminee: { label: 'Terminée', variant: 'purple' },
    annulee: { label: 'Annulée', variant: 'danger' },
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
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="page-header mb-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-surface-900 tracking-display">
            {getGreeting()}, {user.first_name}
          </h1>
          <p className="text-surface-500 mt-1 text-sm">{organization.name}</p>
        </div>
        {/* Accès rapides : grille 2 x 2 avec libellés sur téléphone, ligne sur desktop */}
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className="flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-sm font-medium text-surface-600 bg-white border border-surface-200/80 hover:border-surface-300 hover:shadow-card hover:text-surface-800 transition-all duration-200 group">
              <link.icon className="h-4 w-4 text-surface-400 group-hover:text-brand-500 transition-colors shrink-0" />
              <span className="truncate">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Guide de démarrage (masquable) */}
      <OnboardingGuide flags={onboardingFlags} firstName={user.first_name} />

      {/* ── Agenda : sessions OPCO d'un côté, parcours POEI de l'autre, chacun en cours / à venir / terminées ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {colonnes.map((c) => (
          <section key={c.cle} className="space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <c.Icone className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">{c.titre}</h2>
              </div>
              <span className="text-xs text-surface-400 tabular-nums">
                {c.enCours.length} en cours · {c.aVenir.length} à venir · {c.terminees.length} terminée{c.terminees.length > 1 ? 's' : ''}
              </span>
            </div>
            <SessionsTable
              compact
              titre="En cours"
              badge={<div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />}
              sessions={c.enCours.map(enTableau)}
              vide={c.cle === 'poei' ? 'Aucun parcours POEI en cours' : 'Aucune session en cours'}
            />
            <SessionsTable
              compact
              titre="À venir"
              sessions={c.aVenir.slice(0, 8).map(enTableau)}
              vide={c.cle === 'poei' ? 'Aucun parcours POEI programmé' : 'Aucune session programmée'}
              lienTous={c.lienTous}
            />
            <SessionsTable
              compact
              titre="Terminées récemment"
              sessions={c.terminees.slice(0, 6).map(enTableau)}
              vide={c.cle === 'poei' ? 'Aucun parcours POEI terminé sur les 30 derniers jours' : 'Aucune session terminée sur les 30 derniers jours'}
              lienTous={c.lienPassees}
            />
          </section>
        ))}
      </div>

      {data ? (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'CA Réalisé', value: `${data.ca_realise.toLocaleString('fr-FR')} €`, sub: `${data.ca_mois.toLocaleString('fr-FR')} € ce mois`, icon: Euro, iconBg: 'bg-surface-100', iconColor: 'text-surface-600' },
              { label: 'Encaissé', value: `${data.encaisse.toLocaleString('fr-FR')} €`, sub: null, icon: CreditCard, iconBg: 'bg-success-50', iconColor: 'text-success-600' },
              { label: 'Sessions', value: String(data.sessions_en_cours), sub: `en cours · ${data.sessions_a_venir} à venir`, icon: Calendar, iconBg: 'bg-brand-50', iconColor: 'text-brand-600' },
              { label: 'Apprenants', value: String(data.apprenants_formes), sub: `formés · ${data.apprenants_en_cours} en cours`, icon: GraduationCap, iconBg: 'bg-surface-100', iconColor: 'text-surface-600' },
            ].map((kpi) => (
              <div key={kpi.label} className="stat-card p-4 sm:p-5 gap-3 sm:gap-4 flex-col sm:flex-row">
                <div className={`stat-icon ${kpi.iconBg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="stat-label">{kpi.label}</p>
                  <p className="stat-value text-surface-900 mt-0.5 text-xl sm:text-2xl break-words">{kpi.value}</p>
                  {kpi.sub && <p className="stat-sub">{kpi.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Alerts */}
            <div className="card p-4 sm:p-6 space-y-5">
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
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Pipeline */}
              <div className="card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Pipeline commercial</h2>
                  <Link href="/dashboard/leads" className="text-xs text-surface-500 hover:text-brand-600 font-medium flex items-center gap-1 min-h-[40px] sm:min-h-0 -my-2 sm:my-0 transition-colors">
                    Voir tout <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Leads', value: data.leads_total, color: 'text-surface-800' },
                    { label: 'Devis en attente', value: data.devis_en_attente, color: 'text-brand-600' },
                    { label: 'Transformation', value: `${data.taux_transformation}%`, color: 'text-success-600' },
                    { label: 'Valeur pipeline', value: `${data.leads_valeur.toLocaleString('fr-FR')} €`, color: 'text-surface-800' },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl bg-surface-50">
                      <div className={`text-lg sm:text-xl font-heading font-bold tracking-tight break-words ${s.color}`}>{s.value}</div>
                      <div className="text-[11px] text-surface-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div className="card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Activité récente</h2>
                  <Link href="/dashboard/reporting" className="text-xs text-surface-500 hover:text-brand-600 font-medium flex items-center gap-1 min-h-[40px] sm:min-h-0 -my-2 sm:my-0 transition-colors">
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
                            <span className="text-surface-400"> · </span>
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
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Conformité Qualiopi</h2>
              </div>
              <Link href="/dashboard/qualiopi" className="text-xs text-surface-500 hover:text-brand-600 font-medium flex items-center gap-1 min-h-[40px] sm:min-h-0 -my-2 sm:my-0 transition-colors">
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
        <div className="card p-8 sm:p-16 text-center">
          <BarChart3 className="h-6 w-6 text-surface-300 mx-auto mb-3" />
          <p className="text-sm text-surface-500">Les données du tableau de bord seront disponibles après la création de vos premières données.</p>
        </div>
      )}
    </div>
  )
}
