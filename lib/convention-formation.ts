// La convention suit le programme de sa session.
//
// Une session peut changer de formation après la création de sa convention
// (passage à un programme de 14 h, par exemple). La convention garde sa propre
// formation : son intitulé, sa durée et son annexe restaient alors ceux de
// l'ancien programme, à côté de dates et de participants déjà à jour.
//
// - Convention en brouillon, ou envoyée sans être encore signée : elle suit
//   d'elle-même, le client signera le document à jour.
// - Convention déjà signée par le client : rien ne change sans un geste
//   volontaire, « Reprendre le programme de la session » sur sa fiche. Le
//   programme est alors remplacé sans avenant ; l'ancien reste écrit dans les
//   notes internes de la convention et l'appelant le consigne au journal.

/** Statuts où le client a déjà signé : le programme ne change plus tout seul. */
const SIGNEES = ['signee_client', 'signee_of', 'signee_complete']
export const estSigneeParLeClient = (status: unknown) => SIGNEES.includes(String(status || ''))

export interface ProgrammeRef {
  id: string
  intitule: string
  dureeHeures: number | null
}

export interface EcartFormation {
  conventionId: string
  numero: string
  status: string
  sessionReference: string | null
  /** Le programme que porte la convention ; null si elle n'en avait pas. */
  avant: ProgrammeRef | null
  /** Le programme de la session. */
  apres: ProgrammeRef
}

const ref = (f: any): ProgrammeRef => ({ id: f.id, intitule: f.intitule || 'Formation', dureeHeures: f.duree_heures != null ? Number(f.duree_heures) : null })

/** « Intitulé » (14 h) : la façon dont un programme est cité dans les notes et les messages. */
export const citerProgramme = (p: ProgrammeRef | null) => (p ? `« ${p.intitule} »${p.dureeHeures != null ? ` (${String(p.dureeHeures).replace('.', ',')} h)` : ''}` : 'aucun programme')

/**
 * Les écarts entre des conventions et la formation de leur session. Une
 * convention est alignée dès que sa formation figure parmi celles de la
 * session (une session peut en porter plusieurs) ; sinon elle doit reprendre
 * la formation principale.
 */
async function ecarts(supabase: any, organizationId: string, filtre: { conventionId?: string; sessionId?: string }): Promise<{ ecart: EcartFormation; conv: any }[]> {
  let q = supabase
    .from('conventions')
    .select('id, numero, status, objet, duree_heures, notes_internes, session_id, formation_id, formation:formations(id, intitule, duree_heures)')
    .eq('organization_id', organizationId)
    .not('session_id', 'is', null)
  if (filtre.conventionId) q = q.eq('id', filtre.conventionId)
  if (filtre.sessionId) q = q.eq('session_id', filtre.sessionId)
  const { data: convs } = await q
  const liste = (convs || []) as any[]
  if (!liste.length) return []

  const sessionIds = [...new Set(liste.map((c) => c.session_id))]
  const [{ data: sessions }, { data: liens }] = await Promise.all([
    supabase.from('sessions').select('id, reference, formation_id').eq('organization_id', organizationId).in('id', sessionIds),
    supabase.from('session_formations').select('session_id, formation_id, ordre').in('session_id', sessionIds).order('ordre', { ascending: true }),
  ])
  const parSession = new Map<string, { reference: string | null; principale: string | null; toutes: Set<string> }>()
  for (const s of (sessions || []) as any[]) {
    const autres = ((liens || []) as any[]).filter((l) => l.session_id === s.id).map((l) => l.formation_id as string)
    parSession.set(s.id, { reference: s.reference || null, principale: s.formation_id || autres[0] || null, toutes: new Set([s.formation_id, ...autres].filter(Boolean)) })
  }

  const aCharger = [...new Set(liste.map((c) => parSession.get(c.session_id)?.principale).filter(Boolean))] as string[]
  const { data: formations } = aCharger.length
    ? await supabase.from('formations').select('id, intitule, duree_heures').eq('organization_id', organizationId).in('id', aCharger)
    : { data: [] }
  const parId = new Map(((formations || []) as any[]).map((f) => [f.id, f]))

  const trouves: { ecart: EcartFormation; conv: any }[] = []
  for (const c of liste) {
    const s = parSession.get(c.session_id)
    if (!s?.principale || (c.formation_id && s.toutes.has(c.formation_id))) continue
    const cible = parId.get(s.principale)
    if (!cible) continue
    trouves.push({
      conv: c,
      ecart: { conventionId: c.id, numero: c.numero, status: c.status, sessionReference: s.reference, avant: c.formation ? ref(c.formation) : null, apres: ref(cible) },
    })
  }
  return trouves
}

/** L'écart d'une convention avec le programme de sa session ; null si elle est alignée ou sans session. */
export async function ecartFormation(supabase: any, conventionId: string, organizationId: string): Promise<EcartFormation | null> {
  return (await ecarts(supabase, organizationId, { conventionId }))[0]?.ecart || null
}

/** Remplace le programme de la convention par celui de la session : formation, intitulé de l'objet, durée. */
async function appliquer(supabase: any, organizationId: string, conv: any, e: EcartFormation): Promise<boolean> {
  const patch: Record<string, unknown> = { formation_id: e.apres.id }
  if (e.apres.dureeHeures != null) patch.duree_heures = e.apres.dureeHeures
  if (!conv.objet) patch.objet = `Convention de formation — ${e.apres.intitule}`
  else if (e.avant && String(conv.objet).includes(e.avant.intitule)) patch.objet = String(conv.objet).replace(e.avant.intitule, e.apres.intitule)
  if (estSigneeParLeClient(conv.status)) {
    const note = `[${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}] Programme repris de la session ${e.sessionReference || ''} : ${citerProgramme(e.avant)} remplacé par ${citerProgramme(e.apres)}, sans avenant.`.replace(/\s+:/, ' :')
    patch.notes_internes = [conv.notes_internes, note].filter(Boolean).join('\n')
  }
  const { error } = await supabase.from('conventions').update(patch).eq('id', conv.id).eq('organization_id', organizationId)
  return !error
}

/** Geste volontaire depuis la fiche de la convention, quel que soit son statut. Renvoie ce qui a changé, null s'il n'y avait rien à reprendre. */
export async function reprendreFormationSession(supabase: any, conventionId: string, organizationId: string): Promise<EcartFormation | null> {
  const trouve = (await ecarts(supabase, organizationId, { conventionId }))[0]
  if (!trouve) return null
  return (await appliquer(supabase, organizationId, trouve.conv, trouve.ecart)) ? trouve.ecart : null
}

/**
 * Après la modification d'une session : ses conventions non signées
 * reprennent le nouveau programme ; celles que le client a signées sont
 * signalées, à reprendre depuis leur fiche.
 */
export async function syncConventionsFormationSession(
  supabase: any,
  sessionId: string,
  organizationId: string,
): Promise<{ suivies: EcartFormation[]; aReprendre: EcartFormation[] }> {
  const suivies: EcartFormation[] = []
  const aReprendre: EcartFormation[] = []
  for (const { conv, ecart } of await ecarts(supabase, organizationId, { sessionId })) {
    if (conv.status === 'annulee') continue
    if (estSigneeParLeClient(conv.status)) aReprendre.push(ecart)
    else if (await appliquer(supabase, organizationId, conv, ecart)) suivies.push(ecart)
  }
  return { suivies, aReprendre }
}
