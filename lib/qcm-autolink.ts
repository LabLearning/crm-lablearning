/**
 * Un questionnaire SANS formation, choisi dans la banque pour une session (les
 * quiz d'une POEI passés au fil du cours, novembre 2026), remplace pour son type
 * ceux de la formation : le rattachement automatique ne les ajoute pas et le
 * semis des réponses ne les prépare pas. Sans cette règle, le stagiaire verrait
 * dès le premier matin un positionnement, une évaluation des acquis et une
 * satisfaction génériques en plus des questionnaires du formateur.
 */
export async function typesRemplaces(supabase: any, sessionId: string): Promise<Set<string>> {
  const { data } = await supabase.from('qcm_sessions').select('qcm:qcm_id(type, formation_id)').eq('session_id', sessionId)
  return new Set(((data || []) as any[]).filter((l) => l.qcm && !l.qcm.formation_id).map((l) => l.qcm.type as string))
}

/** La même règle pour toute une organisation : clés « session|type ». */
export async function typesRemplacesOrg(supabase: any, orgId: string): Promise<Set<string>> {
  const out = new Set<string>()
  const { data: qcms } = await supabase.from('qcm').select('id, type').eq('organization_id', orgId).is('formation_id', null)
  const typeDe = new Map(((qcms || []) as any[]).map((q) => [q.id as string, q.type as string]))
  if (typeDe.size === 0) return out
  const ids = Array.from(typeDe.keys())
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('qcm_sessions').select('session_id, qcm_id')
      .eq('organization_id', orgId).in('qcm_id', ids).range(from, from + 999)
    if (error || !data || data.length === 0) break
    for (const l of data as any[]) out.add(`${l.session_id}|${typeDe.get(l.qcm_id)}`)
    if (data.length < 1000) break
  }
  return out
}

/**
 * Rattache automatiquement TOUS les QCM publiés (positionnement, entrée, acquis,
 * satisfaction…) de la/des formation(s) d'une session à cette session
 * (qcm_sessions). Idempotent : n'ajoute que les liens manquants. Non bloquant
 * (jamais d'erreur remontée : le rattachement est un confort, pas une condition
 * de création).
 */
export async function autolinkFormationQcms(
  supabase: any,
  params: { sessionId: string; organizationId: string; formationIds: (string | null | undefined)[] },
): Promise<number> {
  try {
    const formationIds = Array.from(new Set((params.formationIds || []).filter(Boolean))) as string[]
    if (formationIds.length === 0) return 0

    const { data: qcms } = await supabase
      .from('qcm')
      .select('id, type')
      .eq('organization_id', params.organizationId)
      .eq('status', 'publie')
      .in('formation_id', formationIds)
    if (!qcms || qcms.length === 0) return 0

    const { data: existing } = await supabase
      .from('qcm_sessions')
      .select('qcm_id, qcm:qcm_id(type, formation_id)')
      .eq('session_id', params.sessionId)
    const already = new Set((existing || []).map((r: any) => r.qcm_id))
    // Un questionnaire sans formation déjà rattaché remplace ceux de son type (typesRemplaces)
    const remplaces = new Set((existing || []).filter((r: any) => r.qcm && !r.qcm.formation_id).map((r: any) => r.qcm.type))

    const rows = qcms
      .filter((q: any) => !already.has(q.id) && !remplaces.has(q.type))
      .map((q: any) => ({
        organization_id: params.organizationId,
        qcm_id: q.id,
        session_id: params.sessionId,
        date_ouverture: new Date().toISOString(),
      }))
    if (rows.length === 0) return 0

    await supabase.from('qcm_sessions').insert(rows)
    return rows.length
  } catch (e) {
    console.error('[autolinkFormationQcms]', e)
    return 0
  }
}

/**
 * Récupère TOUTES les lignes d'une table pour une org, par pages de 1000
 * (PostgREST plafonne une requête à 1000 lignes : sans pagination, l'ensemble
 * « déjà lié » est incomplet dès que l'org dépasse 1000 qcm_sessions, ce qui
 * ré-insère les mêmes liens à chaque exécution → doublons).
 */
async function fetchAll(supabase: any, table: string, columns: string, orgId: string): Promise<any[]> {
  const out: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select(columns).eq('organization_id', orgId)
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

/**
 * Rattache, pour toute une organisation, les QCM publiés des formations à
 * TOUTES leurs sessions non encore liées. Idempotent — appelé après le sync
 * Dendreo pour couvrir les sessions importées automatiquement.
 */
export async function backfillOrgQcmSessions(supabase: any, orgId: string): Promise<number> {
  try {
    const qcms = (await fetchAll(supabase, 'qcm', 'id, formation_id, status, type', orgId))
      .filter((q: any) => q.status === 'publie' && q.formation_id)
    if (qcms.length === 0) return 0
    const qcmByForm = new Map<string, { id: string; type: string }[]>()
    for (const q of qcms) {
      const arr = qcmByForm.get(q.formation_id) || []; arr.push({ id: q.id, type: q.type }); qcmByForm.set(q.formation_id, arr)
    }

    const sessions = await fetchAll(supabase, 'sessions', 'id, formation_id', orgId)
    const existing = await fetchAll(supabase, 'qcm_sessions', 'session_id, qcm_id', orgId)
    const linked = new Set(existing.map((e: any) => `${e.session_id}:${e.qcm_id}`))
    const remplaces = await typesRemplacesOrg(supabase, orgId)

    const rows: any[] = []
    for (const s of (sessions || [])) {
      for (const { id: qid, type } of (qcmByForm.get(s.formation_id) || [])) {
        const key = `${s.id}:${qid}`
        if (linked.has(key) || remplaces.has(`${s.id}|${type}`)) continue
        linked.add(key)
        rows.push({ organization_id: orgId, qcm_id: qid, session_id: s.id, date_ouverture: new Date().toISOString() })
      }
    }
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('qcm_sessions').insert(rows.slice(i, i + 500))
    }
    return rows.length
  } catch (e) {
    console.error('[backfillOrgQcmSessions]', e)
    return 0
  }
}
