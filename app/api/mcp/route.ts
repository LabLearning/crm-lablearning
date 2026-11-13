import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifierCleClaude, type VerificationCleClaude } from '@/lib/api-keys'
import { VERSIONS, traiterMessage, type ContexteConnecteur, type JournalConnecteur } from '@/lib/connecteur-claude/protocole'
import { PORTEE, adresseMetadonneesRessource, verifierJetonAcces } from '@/lib/connecteur-claude/oauth'

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

/** Messages qui ne lisent aucune donnée : ouverture, test de présence, liste des outils, notifications et réponses du client */
const METHODES_PUBLIQUES = new Set(['initialize', 'ping', 'tools/list'])
const messagePublic = (m: any) => !!m && typeof m === 'object' && !Array.isArray(m)
  && (typeof m.method !== 'string' || m.method.startsWith('notifications/') || METHODES_PUBLIQUES.has(m.method))

type Diagnostic = { corps?: string; auth?: string | null }

/**
 * Relevé temporaire (12/11/2026) : l'application Claude n'arrive pas à se
 * connecter et reçoit des 400. Pour les appels venus de Claude, on écrit dans
 * les journaux Vercel ce qu'il envoie et ce qu'on répond : en-têtes utiles,
 * corps tronqué, jamais de clé ni de jeton (préfixe et longueur seulement).
 */
export async function POST(req: Request) {
  const diag: Diagnostic = {}
  const reponse = await traiterPost(req, diag)
  const ua = req.headers.get('user-agent') || ''
  if (/claude|anthropic|python-httpx/i.test(ua)) {
    const corps = (diag.corps || '')
      .replace(/ll_[a-z]+_[a-f0-9]{16,}/g, (m) => `${m.slice(0, 10)}…`)
      .replace(/[a-f0-9]{32,}/gi, '[jeton]')
      .slice(0, 400)
    console.info('[mcp diag]', JSON.stringify({
      statut: reponse.status,
      ua: ua.slice(0, 80),
      accept: req.headers.get('accept'),
      type: req.headers.get('content-type'),
      version: req.headers.get('mcp-protocol-version'),
      origine: req.headers.get('origin'),
      session: req.headers.get('mcp-session-id'),
      auth: diag.auth ?? null,
      corps,
    }))
  }
  return reponse
}

async function traiterPost(req: Request, diag: Diagnostic): Promise<Response> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '')

  // Version du protocole : jamais de refus sur une version inconnue (la négociation se fait dans
  // initialize ; un client plus récent que nous doit pouvoir s'y présenter)
  void VERSIONS
  // Un navigateur d'un autre site ne parle pas au connecteur (les serveurs de Claude n'envoient pas d'Origin)
  const origine = req.headers.get('origin')
  if (origine && origine !== new URL(base).origin) return erreur(403, -32600, 'Origine refusée')

  const brut = await req.text()
  diag.corps = brut
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
  const entete = req.headers.get('authorization') || req.headers.get('x-api-key')
  const presente = String(entete || '').replace(/^Bearer\s+/i, '').trim()
  diag.auth = presente ? `${presente.slice(0, 10)}… (${presente.length} car.)` : null
  // Jeton de l'application Claude (connexion par compte CRM) ou clé de Claude Code
  let verif: VerificationCleClaude
  if (presente.startsWith('ll_oauth_')) {
    const j = await verifierJetonAcces(supabase, presente)
    verif = j.etat === 'ok' ? { etat: 'ok', organizationId: j.organizationId, userId: j.userId, cleId: j.famille }
      : j.etat === 'indisponible' ? { etat: 'indisponible' } : { etat: 'inconnue' }
  } else {
    verif = await verifierCleClaude(supabase, entete, messages.some((m) => m?.method === 'initialize'))
  }
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
    /**
     * Ouverture sans compte (schéma d'Anthropic, « lazy authentication ») :
     * initialize, ping, tools/list et les notifications passent sans jeton.
     * Ils ne contiennent aucune donnée du CRM (le code est public sur GitHub),
     * et Claude doit pouvoir ouvrir la connexion avant de faire signer : sinon
     * l'application affiche « impossible de joindre ». Toute lecture de données
     * (tools/call) exige un jeton ou une clé valide. Un jeton présenté mais
     * invalide est toujours refusé, pour que Claude le renouvelle.
     */
    if (!presente && messages.every(messagePublic)) {
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnue'
      if (!reserverDansInstance(`ip:${ip}`, 1, REQUETES_PAR_MINUTE)) return erreur(429, -32000, 'Trop de requêtes en une minute, réessaie dans un instant', { 'Retry-After': '30' })
      const ctxPublic: ContexteConnecteur = { organizationId: '', userId: '', cleId: '', base }
      const reponses: any[] = []
      for (const m of messages) {
        const r = await traiterMessage(m, ctxPublic)
        if (r !== null) reponses.push(r)
      }
      if (!reponses.length) return new Response(null, { status: 202 })
      return json(Array.isArray(corps) ? reponses : reponses[0])
    }
    // Forme attendue par Claude pour lancer la connexion : 401 et WWW-Authenticate avec resource_metadata
    const defi = [
      'Bearer error="invalid_token"',
      'error_description="Authentication required"',
      `resource_metadata="${adresseMetadonneesRessource()}"`,
      `scope="${PORTEE}"`,
    ].join(', ')
    return json({ error: 'invalid_token', error_description: 'Authentication required' }, 401, { 'WWW-Authenticate': defi })
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
