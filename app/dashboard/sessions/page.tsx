import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SessionsList } from './SessionsList'
import type { Session } from '@/lib/types/formation'

export const dynamic = 'force-dynamic'

type Periode = 'actives' | 'passees' | 'toutes'

/**
 * Complétude documentaire par session, pour la pastille de la liste :
 * vert = rien ne manque (convention signée + contrat formateur), ambre =
 * convention OK mais contrat formateur manquant, rose = pas de convention
 * signée. L'émargement n'entre pas dans le critère : la présence est tenue
 * par les questionnaires, tous les émargements sont réputés couverts.
 * La convention signée peut être un document déposé ou une signature
 * électronique aboutie dans le module conventions.
 */
async function etatsDossiers(supabase: any, orgId: string) {
  const convSessions = new Set<string>()
  const contratSessions = new Set<string>()
  // Le contrat de prestation vaut pour le formateur : rangé sur sa fiche,
  // il couvre toutes ses sessions même sans lien session direct.
  const formateursAvecContrat = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('documents')
      .select('session_id, formateur_id, type')
      .eq('organization_id', orgId)
      .in('type', ['convention_signee', 'contrat_formateur'])
      .range(from, from + 999)
    for (const d of data || []) {
      if (d.type === 'convention_signee' && d.session_id) convSessions.add(d.session_id)
      if (d.type === 'contrat_formateur') {
        if (d.session_id) contratSessions.add(d.session_id)
        if (d.formateur_id) formateursAvecContrat.add(d.formateur_id)
      }
    }
    if (!data || data.length < 1000) break
  }
  const { data: convElec } = await supabase.from('conventions')
    .select('session_id')
    .eq('organization_id', orgId)
    .not('session_id', 'is', null)
    .or('status.eq.signee_complete,signature_client_date.not.is.null')
  for (const c of convElec || []) convSessions.add(c.session_id)
  return { convSessions, contratSessions, formateursAvecContrat }
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: { periode?: string }
}) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // Par défaut : uniquement les sessions en cours et à venir
  // (les 350+ sessions passées ne sont chargées que sur demande)
  const periode: Periode = ['passees', 'toutes'].includes(searchParams.periode || '')
    ? (searchParams.periode as Periode)
    : 'actives'
  const today = new Date().toISOString().slice(0, 10)
  const depuis = periode === 'actives' ? today : null
  const jusqua = periode === 'passees' ? today : null

  // Vue par défaut : ordre chronologique (prochaine session en premier)
  const sortSessions = (list: any[]) =>
    periode === 'actives'
      ? [...list].sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''))
      : list

  // Une POEI = une ligne : chapeau (ou première intervention s'il n'y en a
  // pas), les autres sessions d'intervention sont masquées (lib/poei-sessions)
  const { cartePoeiSessions } = await import('@/lib/poei-sessions')
  const [dossiers, { doublons: doublonsPoei, poeiParSession }] = await Promise.all([
    etatsDossiers(supabase, orgId),
    cartePoeiSessions(supabase, orgId),
  ])
  // Formateurs de chaque parcours, portés par ses interventions
  const { formateursDesPoei } = await import('@/lib/poei-formateurs')
  const formateursPoei = await formateursDesPoei(supabase, [...poeiParSession.values()])
  const formateursDuParcours = (sessionId: string) => {
    const pid = poeiParSession.get(sessionId)
    return pid ? formateursPoei.get(pid) || null : null
  }
  const avecDossier = (s: any) => {
    const conv = dossiers.convSessions.has(s.id)
    const contrat = dossiers.contratSessions.has(s.id) ||
      (s.formateur_id && dossiers.formateursAvecContrat.has(s.formateur_id))
    const manque = [...(conv ? [] : ['convention signée']), ...(contrat ? [] : ['contrat formateur'])]
    return {
      _dossier: manque.length === 0 ? 'complet' : conv ? 'partiel' : 'incomplet',
      _dossier_manque: manque,
    }
  }

  // ── Voie rapide : tout en 1 requête SQL (RPC sessions_page_data).
  // Évite 8 allers-retours, les .in() à 371 UUIDs dans l'URL et le
  // plafond PostgREST de 1000 lignes (1705 inscriptions, 1220 apprenants).
  try {
    const { data, error } = await supabase.rpc('sessions_page_data', { org: orgId, depuis, jusqua })
    if (!error && data && Array.isArray(data.sessions)) {
      const sessionsWithCounts = sortSessions(data.sessions.filter((s: any) => !doublonsPoei.has(s.id))).map((s: any) => ({
        ...s,
        ...avecDossier(s),
        _nb_inscrits: (s._inscrits_ids || []).length,
        _inscrits_ids: s._inscrits_ids || [],
        _formation_ids: s._formation_ids || [],
        _is_poei: !!s._is_poei || poeiParSession.has(s.id) || s._poei_role === 'intervention',
        _poei_role: poeiParSession.has(s.id) ? 'parcours' : s._poei_role,
        _poei_id: poeiParSession.get(s.id) || null,
        _poei_formateurs: formateursDuParcours(s.id),
      }))
      return (
        <div className="animate-fade-in">
          <SessionsList
            sessions={sessionsWithCounts as Session[]}
            formations={(data.formations || []) as any[]}
            formateurs={(data.formateurs || []) as any[]}
            clients={(data.clients || []) as any[]}
            apprenants={(data.apprenants || []) as any[]}
            periode={periode}
          />
        </div>
      )
    }
  } catch { /* repli legacy ci-dessous */ }

  // ── Repli : requêtes classiques tant que la migration 067 n'est pas appliquée ──
  let sessionsQuery = supabase
    .from('sessions')
    .select(`
      *,
      formation:formation_id(intitule, reference, modalite, duree_heures, is_poei),
      formateur:formateurs(prenom, nom),
      client:client_id(raison_sociale, nom_commercial, sigle)
    `)
    .eq('organization_id', orgId)
    .order('date_debut', { ascending: false })
  if (depuis) sessionsQuery = sessionsQuery.or(`date_fin.gte.${depuis},date_fin.is.null`)
  if (jusqua) sessionsQuery = sessionsQuery.lt('date_fin', jusqua)
  const { data: sessions } = await sessionsQuery

  const sessionIds = (sessions || []).map((s) => s.id)

  const [
    { data: allInscrits },
    { data: allLinkedFormations },
    { data: formations },
    { data: formateurs },
    { data: clients },
    { data: apprenants },
    { data: poeiLinks },
  ] = await Promise.all([
    sessionIds.length > 0
      ? supabase.from('inscriptions').select('session_id, apprenant_id').in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")').range(0, 9999)
      : Promise.resolve({ data: [] as any[] }),
    sessionIds.length > 0
      ? supabase.from('session_formations').select('session_id, formation_id, ordre').in('session_id', sessionIds).order('ordre')
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('formations')
      .select('id, intitule, reference, modalite, duree_heures, duree_jours')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('intitule'),
    supabase
      .from('formateurs')
      .select('id, prenom, nom, tarif_journalier')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('nom'),
    supabase
      .from('clients')
      .select('id, raison_sociale, nom_commercial, sigle, siret, adresse, code_postal, ville')
      .eq('organization_id', orgId)
      .eq('type', 'entreprise')
      .order('raison_sociale'),
    supabase
      .from('apprenants')
      .select('id, prenom, nom, email, client_id')
      .eq('organization_id', orgId)
      .order('nom')
      .range(0, 9999),
    supabase
      .from('poei')
      .select('session_id')
      .eq('organization_id', orgId)
      .not('session_id', 'is', null),
  ])

  const inscritsBySession: Record<string, string[]> = {}
  for (const i of allInscrits || []) {
    ;(inscritsBySession[i.session_id] ||= []).push(i.apprenant_id)
  }
  const formationsBySession: Record<string, string[]> = {}
  for (const f of allLinkedFormations || []) {
    ;(formationsBySession[f.session_id] ||= []).push(f.formation_id)
  }

  const poeiSessionIds = new Set((poeiLinks || []).map((p: any) => p.session_id))

  const sessionsWithCounts = sortSessions((sessions || []).filter((s: any) => !doublonsPoei.has(s.id))).map((s) => {
    const inscritsIds = inscritsBySession[s.id] || []
    return {
      ...s,
      ...avecDossier(s),
      _nb_inscrits: inscritsIds.length,
      _inscrits_ids: inscritsIds,
      _formation_ids: formationsBySession[s.id] || [],
      _is_poei: !!((s as any).formation?.is_poei) || poeiSessionIds.has(s.id) || poeiParSession.has(s.id) || !!(s as any).poei_intervention_id,
      _poei_role: poeiParSession.has(s.id) ? 'parcours' : (s as any).poei_intervention_id ? 'intervention' : null,
      _poei_id: poeiParSession.get(s.id) || null,
      _poei_formateurs: formateursDuParcours(s.id),
    }
  })

  return (
    <div className="animate-fade-in">
      <SessionsList
        sessions={sessionsWithCounts as Session[]}
        formations={(formations || []) as any[]}
        formateurs={(formateurs || []) as any[]}
        clients={(clients || []) as any[]}
        apprenants={(apprenants || []) as any[]}
        periode={periode}
      />
    </div>
  )
}
