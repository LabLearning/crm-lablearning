import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AbsencesList } from './AbsencesList'

export const dynamic = 'force-dynamic'

/**
 * Absences à justifier (indicateur 12) : chaque absence d'une session dont la
 * présence est suivie dans le CRM doit porter son motif.
 *
 * Les sessions où aucune présence n'a jamais été enregistrée sont exclues :
 * leurs lignes ne sont pas des absences, ce sont des présences jamais
 * numérisées (l'émargement papier fait foi) — les traiter en absences
 * fabriquerait 4 000 faux absents.
 */
export default async function AbsencesPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Pagination PARALLÈLE : le nombre total est connu d'un count, puis toutes
  // les pages partent ensemble — la table dépasse 10 000 lignes, le chargement
  // séquentiel de tout l'historique rendait la page inutilisable.
  // Les filtres s'appliquent APRÈS .select() (contrainte du client Supabase).
  const pagesParalleles = async (colonnes: string, filtres: (q: any) => any) => {
    const { count } = await filtres(
      supabase.from('emargements').select(colonnes, { count: 'exact', head: true }))
    const nb = Math.ceil((count || 0) / 1000)
    const lots = await Promise.all(Array.from({ length: nb }, (_, i) =>
      filtres(supabase.from('emargements').select(colonnes))
        .range(i * 1000, i * 1000 + 999).then((r: any) => r.data || [])))
    return lots.flat()
  }

  // 1) Les absences candidates : non présent, non signé, sans motif — seul
  //    sous-ensemble utile (quelques milliers de lignes). Les justifiées sont
  //    chargées à part : elles restent affichées comme TRACE (indicateur 12).
  const [absencesBrutes, justifieesBrutes] = await Promise.all([
    pagesParalleles(
      'id, session_id, apprenant_id, date, creneau, apprenant:apprenant_id(prenom, nom)',
      // Seul est_present=false est une absence ; null = créneau pas encore
      // passé (session en cours), ce n'est pas une absence à justifier.
      (q) => q.eq('organization_id', session.organization.id)
        .eq('est_present', false)
        .is('signature_data', null)
        .is('motif_absence', null),
    ),
    pagesParalleles(
      'id, session_id, apprenant_id, date, creneau, motif_absence, apprenant:apprenant_id(prenom, nom)',
      (q) => q.eq('organization_id', session.organization.id)
        .eq('est_present', false)
        .not('motif_absence', 'is', null)
        // Un jour de repos n'est pas une absence (lib/emargement-repos)
        .not('motif_absence', 'ilike', 'repos'),
    ),
  ])

  // 2) Les sessions où la présence est réellement suivie (≥ 1 présent ou
  //    1 signature) : colonnes minimales, en parallèle.
  const [presents, signes] = await Promise.all([
    pagesParalleles('session_id',
      (q) => q.eq('organization_id', session.organization.id).eq('est_present', true)),
    pagesParalleles('session_id',
      (q) => q.eq('organization_id', session.organization.id).not('signature_data', 'is', null)),
  ])
  const suivies = new Set([...presents, ...signes].map((r: any) => r.session_id))

  // Les sessions où aucune présence n'a jamais été enregistrée sont exclues :
  // leurs lignes ne sont pas des absences, ce sont des présences jamais
  // numérisées (l'émargement papier fait foi).
  const parSession = new Map<string, any[]>()
  for (const e of absencesBrutes) {
    if (!suivies.has(e.session_id)) continue
    if (!parSession.has(e.session_id)) parSession.set(e.session_id, [])
    parSession.get(e.session_id)!.push(e)
  }
  const sessionsAvecAbsences: { sessionId: string; absences: any[] }[] = []
  for (const [sessionId, absences] of parSession) {
    if (absences.length) sessionsAvecAbsences.push({ sessionId, absences })
  }

  const parSessionJustifiees = new Map<string, any[]>()
  for (const e of justifieesBrutes) {
    if (!parSessionJustifiees.has(e.session_id)) parSessionJustifiees.set(e.session_id, [])
    parSessionJustifiees.get(e.session_id)!.push(e)
  }

  const ids = [...new Set([...sessionsAvecAbsences.map((x) => x.sessionId), ...parSessionJustifiees.keys()])]
  const lotsSessions = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) =>
      supabase.from('sessions')
        .select('id, reference, date_debut, date_fin, intitule, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)')
        .in('id', ids.slice(i * 200, i * 200 + 200))
        .then((r) => r.data || [])),
  )
  const sessions = lotsSessions.flat()
  const sessionPar = new Map(sessions.map((s: any) => [s.id, s]))

  const groupes = sessionsAvecAbsences
    .map(({ sessionId, absences }) => {
      const s: any = sessionPar.get(sessionId)
      return {
        sessionId,
        reference: s?.reference || '(sans référence)',
        formation: s?.formation?.intitule || s?.intitule || '',
        client: s?.client?.nom_commercial || s?.client?.raison_sociale || '—',
        dateDebut: s?.date_debut || '',
        absences: absences
          .map((a) => ({
            id: a.id,
            apprenant: `${a.apprenant?.prenom || ''} ${a.apprenant?.nom || ''}`.trim() || 'Stagiaire',
            apprenantId: a.apprenant_id,
            date: a.date,
            creneau: a.creneau,
          }))
          .sort((a, b) => a.apprenant.localeCompare(b.apprenant, 'fr') || String(a.date).localeCompare(String(b.date))),
      }
    })
    .sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut)))

  // Trace des absences justifiées : par session, un stagiaire + son motif.
  const groupesJustifies = [...parSessionJustifiees.entries()]
    .map(([sessionId, lignes]) => {
      const s: any = sessionPar.get(sessionId)
      const parStagiaire = new Map<string, any[]>()
      for (const l of lignes) {
        if (!parStagiaire.has(l.apprenant_id)) parStagiaire.set(l.apprenant_id, [])
        parStagiaire.get(l.apprenant_id)!.push(l)
      }
      return {
        sessionId,
        reference: s?.reference || '(sans référence)',
        formation: s?.formation?.intitule || s?.intitule || '',
        client: s?.client?.nom_commercial || s?.client?.raison_sociale || '—',
        dateDebut: s?.date_debut || '',
        stagiaires: [...parStagiaire.values()].map((abs) => ({
          apprenant: `${abs[0].apprenant?.prenom || ''} ${abs[0].apprenant?.nom || ''}`.trim() || 'Stagiaire',
          motif: abs[0].motif_absence,
          dates: abs.map((a) => String(a.date)).sort(),
          nb: abs.length,
          ids: abs.map((a) => a.id),
          apprenantId: abs[0].apprenant_id,
        })).sort((a, b) => a.apprenant.localeCompare(b.apprenant, 'fr')),
      }
    })
    .sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut)))

  // Le questionnaire d'abandon, affiché directement sur la page : ses
  // questions se consultent sans quitter l'écran, le lien s'envoie par
  // stagiaire depuis chaque ligne.
  const { data: qcmAbandon } = await supabase.from('qcm')
    .select('id, titre, questions:qcm_questions(texte, position)')
    .eq('organization_id', session.organization.id)
    .eq('type', 'abandon')
    .limit(1).maybeSingle()

  return (
    <div className="animate-fade-in">
      <AbsencesList
        groupes={groupes}
        justifies={groupesJustifies}
        questionnaireAbandon={qcmAbandon ? {
          titre: (qcmAbandon as any).titre,
          questions: ((qcmAbandon as any).questions || [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((q: any) => q.texte),
        } : null}
      />
    </div>
  )
}
