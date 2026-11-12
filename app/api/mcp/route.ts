import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifierCleClaude } from '@/lib/api-keys'
import { VERSIONS, traiterMessage, type ContexteConnecteur, type JournalConnecteur } from '@/lib/connecteur-claude/protocole'

/**
 * Connecteur Claude (serveur MCP, transport HTTP sans session) : Claude lit
 * tout le CRM en lecture seule avec une clé « ll_claude_… » créée dans
 * Paramètres. Chaque appel d'outil réserve d'abord sa ligne de journal
 * (audit_logs, entity_type connecteur_claude) ; une clé est limitée à
 * 120 appels par minute et à 5 appels par requête.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APPELS_PAR_MINUTE = 120
const APPELS_PAR_REQUETE = 5
/** Requêtes de toute sorte (initialize, tools/list…) par clé et par minute, dans une instance */
const REQUETES_PAR_MINUTE = 300
const TAILLE_CORPS_MAX = 256_000
const TYPE_JOURNAL = 'connecteur_claude'

const json = (corps: unknown, status = 200, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json', ...entetes } })
const erreur = (status: number, code: number, message: string, entetes: Record<string, string> = {}) =>
  json({ jsonrpc: '2.0', id: null, error: { code, message } }, status, entetes)

/**
 * Fenêtre glissante par clé dans l'instance : réservée de façon synchrone,
 * elle arrête les rafales parallèles avant que le journal ne les voie
 */
const fenetres = new Map<string, number[]>()
function reserverDansInstance(cle: string, n: number, plafond: number): boolean {
  const maintenant = Date.now()
  const recents = (fenetres.get(cle) || []).filter((t) => maintenant - t < 60_000)
  if (recents.length + n > plafond) { fenetres.set(cle, recents); return false }
  for (let i = 0; i < n; i++) recents.push(maintenant)
  fenetres.set(cle, recents)
  return true
}

// Une trace par minute au plus pour une clé révoquée rejouée
const refusTraces = new Map<string, number>()

export async function POST(req: Request) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '')

  // Version du protocole annoncée par le client après initialize
  const version = req.headers.get('mcp-protocol-version')
  if (version && !VERSIONS.includes(version)) return erreur(400, -32600, 'Version du protocole MCP non prise en charge')
  // Un navigateur d'un autre site ne parle pas au connecteur (les serveurs de Claude n'envoient pas d'Origin)
  const origine = req.headers.get('origin')
  if (origine && origine !== new URL(base).origin) return erreur(403, -32600, 'Origine refusée')

  const brut = await req.text()
  if (brut.length > TAILLE_CORPS_MAX) return erreur(413, -32600, 'Requête trop volumineuse')
  let corps: any
  try {
    corps = JSON.parse(brut)
  } catch {
    return erreur(400, -32700, 'JSON invalide')
  }
  const messages: any[] = Array.isArray(corps) ? corps : [corps]
  if (!messages.length || messages.length > 20) return erreur(400, -32600, 'Lot vide ou trop grand')
  const appels = messages.filter((m) => m && typeof m === 'object' && m.method === 'tools/call' && 'id' in m).length
  if (appels > APPELS_PAR_REQUETE) return erreur(400, -32600, `${APPELS_PAR_REQUETE} appels d'outils au plus par requête`)

  const supabase = await createServiceRoleClient()
  const verif = await verifierCleClaude(
    supabase,
    req.headers.get('authorization') || req.headers.get('x-api-key'),
    messages.some((m) => m?.method === 'initialize'),
  )
  if (verif.etat === 'indisponible') return erreur(503, -32603, 'Base momentanément indisponible, réessaie dans un instant', { 'Retry-After': '10' })
  if (verif.etat !== 'ok') {
    if (verif.etat === 'refusee') {
      const derniere = refusTraces.get(verif.cleId) || 0
      if (Date.now() - derniere > 60_000) {
        refusTraces.set(verif.cleId, Date.now())
        await supabase.from('audit_logs').insert({
          organization_id: verif.organizationId,
          action: 'connecteur_claude_refus',
          entity_type: TYPE_JOURNAL,
          entity_id: verif.cleId,
          details: { motif: 'clé révoquée ou auteur sans accès' },
        })
      }
    }
    return erreur(401, -32001, 'Clé du connecteur absente, invalide ou révoquée', { 'WWW-Authenticate': 'Bearer realm="crm-lab-learning"' })
  }
  const cle = verif

  // Premier filtre, dans l'instance : toute requête, puis les appels d'outils
  if (!reserverDansInstance(`r:${cle.cleId}`, 1, REQUETES_PAR_MINUTE)) return erreur(429, -32000, 'Trop de requêtes en une minute, réessaie dans un instant', { 'Retry-After': '30' })
  if (appels && !reserverDansInstance(`a:${cle.cleId}`, appels, APPELS_PAR_MINUTE)) return erreur(429, -32000, 'Trop d’appels en une minute, réessaie dans un instant', { 'Retry-After': '30' })

  const reservees = new Map<string, Record<string, unknown>>()
  const journal: JournalConnecteur = {
    /**
     * Inscrit d'abord la ligne, puis compte celles de la dernière minute, la
     * sienne comprise : des requêtes simultanées sur plusieurs instances se
     * voient toutes, et au pire se refusent toutes (jamais l'inverse). Une
     * ligne en trop est reclassée en refus et ne compte plus.
     */
    reserver: async (e) => {
      const details = { ...e, cle_de: 'connecteur Claude' }
      const { data, error } = await supabase.from('audit_logs').insert({
        organization_id: cle.organizationId,
        user_id: cle.userId,
        action: TYPE_JOURNAL,
        entity_type: TYPE_JOURNAL,
        entity_id: cle.cleId,
        details,
      }).select('id').single()
      if (error || !data) { console.error('[connecteur claude] journal', error?.message); return null }
      const { count, error: errCompte } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true })
        .eq('entity_type', TYPE_JOURNAL).eq('entity_id', cle.cleId).eq('action', TYPE_JOURNAL)
        .gte('created_at', new Date(Date.now() - 60_000).toISOString())
      if (errCompte || (count || 0) > APPELS_PAR_MINUTE) {
        await supabase.from('audit_logs').update({ action: 'connecteur_claude_plafond', details: { ...details, refus: errCompte ? 'comptage impossible' : 'plafond atteint' } }).eq('id', data.id)
        return null
      }
      reservees.set(data.id, details)
      return data.id as string
    },
    conclure: async (id, e) => {
      const { error } = await supabase.from('audit_logs').update({ details: { ...(reservees.get(id) || {}), ...e } }).eq('id', id)
      if (error) console.error('[connecteur claude] journal', error.message)
    },
  }

  const ctx: ContexteConnecteur = { organizationId: cle.organizationId, userId: cle.userId, cleId: cle.cleId, base }
  // L'un après l'autre : un lot ne multiplie pas la charge sur la base
  const reponses: any[] = []
  for (const m of messages) {
    try {
      const r = await traiterMessage(m, ctx, journal)
      if (r !== null) reponses.push(r)
    } catch (e) {
      // Un message qui fait échouer le traitement n'emporte pas les réponses des autres
      console.error('[connecteur claude] message', e)
      if (m && typeof m === 'object' && 'id' in m) reponses.push({ jsonrpc: '2.0', id: typeof m.id === 'string' || typeof m.id === 'number' ? m.id : null, error: { code: -32603, message: 'Erreur interne' } })
    }
  }
  // Notifications ou réponses seules : accusé de réception sans corps
  if (!reponses.length) return new Response(null, { status: 202 })
  return json(Array.isArray(corps) ? reponses : reponses[0])
}

// Pas de flux serveur ni de session : seul POST est servi
export async function GET() {
  return new Response('Méthode non prise en charge', { status: 405, headers: { Allow: 'POST' } })
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}
