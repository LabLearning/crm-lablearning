import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { Calendar, Briefcase } from '@/components/ui/icons'
import { formatDate } from '@/lib/utils'
import { OnboardingGuide } from './OnboardingGuide'
import { SessionsTable } from './SessionsTable'
import { ObjectifMoisUne } from './ObjectifMoisUne'
import { chargerObjectifMois, ROLES_OBJECTIF } from '@/lib/objectif-mois'

/** Lundi de la semaine qui contient la date (ISO, sans fuseau). */
const lundiDe = (iso: string) => {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
const plusJours = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Regroupe des sessions par semaine : une session en cours est rangée dans
 * la semaine courante, une session à venir dans la semaine de son premier
 * jour. « Cette semaine » et « Semaine prochaine » sont toujours présentes,
 * même vides ; les semaines suivantes n'apparaissent que si elles ont
 * quelque chose.
 */
function parSemaine<T extends { date_debut: string }>(lignes: T[], today: string) {
  const ceLundi = lundiDe(today)
  const lundiSuivant = plusJours(ceLundi, 7)
  const groupes = new Map<string, T[]>()
  for (const s of lignes) {
    const cle = lundiDe(s.date_debut > today ? s.date_debut : today)
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle)!.push(s)
  }
  const cles = [ceLundi, lundiSuivant, ...[...groupes.keys()].filter((k) => k !== ceLundi && k !== lundiSuivant).sort()]
  return cles.map((cle, i) => ({
    cle,
    label: i === 0 ? 'Cette semaine' : i === 1 ? 'Semaine prochaine' : `Semaine du ${formatDate(cle, { day: 'numeric', month: 'short' })}`,
    sousTitre: `${formatDate(cle, { day: 'numeric', month: 'short' })} au ${formatDate(plusJours(cle, 6), { day: 'numeric', month: 'short' })}`,
    lignes: (groupes.get(cle) || []).slice().sort((a, b) => a.date_debut.localeCompare(b.date_debut)),
  }))
}

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

  // Les 3 blocs sont indépendants → exécutés en parallèle (agenda, compteurs onboarding, objectif du mois)
  const [{ data: upcomingSessions }, [orgRow, fCnt, cCnt, lCnt, sCnt, dCnt, factCnt, uCnt], objectifMois] = await Promise.all([
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
    chargerObjectifMois(supabase, organization.id).catch(() => null),
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
  // session chapeau (lib/poei-formateurs)
  const { formateursDesPoei } = await import('@/lib/poei-formateurs')
  const formateursParPoei = await formateursDesPoei(supabase, ((poeis || []) as any[]).map((p) => p.id), today)

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
      semaines: parSemaine([...sessionsEnCours, ...sessionsAVenir].filter(coteOpco), today), terminees: (terminees || []).filter(coteOpco),
    },
    {
      cle: 'poei', titre: 'POEI', Icone: Briefcase, lienTous: '/dashboard/poei', lienPassees: '/dashboard/poei',
      semaines: parSemaine([...poeiEnCours, ...poeiAVenir], today), terminees: poeiTerminees,
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

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

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
      </div>

      {/* Guide de démarrage (masquable) */}
      <OnboardingGuide flags={onboardingFlags} firstName={user.first_name} />

      {/* Objectif du mois : établissements calés pour le mois suivant */}
      {objectifMois && <ObjectifMoisUne data={objectifMois} peutModifier={ROLES_OBJECTIF.includes(user.role)} />}

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
                {c.semaines[0].lignes.length} cette semaine · {c.semaines[1].lignes.length} semaine prochaine · {c.semaines.slice(2).reduce((n, w) => n + w.lignes.length, 0)} plus tard
              </span>
            </div>
            {c.semaines.map((sem, i) => (sem.lignes.length > 0 || i < 2) && (
              <SessionsTable
                key={sem.cle}
                compact
                titre={sem.label}
                badge={i === 0 ? <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" /> : undefined}
                sousTitre={sem.sousTitre}
                sessions={sem.lignes.map(enTableau)}
                vide={c.cle === 'poei'
                  ? (i === 0 ? 'Aucun parcours POEI cette semaine' : 'Aucun parcours POEI programmé')
                  : (i === 0 ? 'Aucune session cette semaine' : 'Aucune session programmée')}
                lienTous={i === 1 ? c.lienTous : undefined}
              />
            ))}
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
    </div>
  )
}
