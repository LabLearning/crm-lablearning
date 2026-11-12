import { randomBytes } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirectionAutorisee } from '@/lib/connecteur-claude/oauth'

/**
 * Enregistrement dynamique d'un client (RFC 7591), repli des identités
 * publiées de Claude. Seules les adresses de retour de Claude sont acceptées
 * (applications et Claude Code), et l'enregistrement ne donne aucun accès :
 * il faut encore l'autorisation d'un super administrateur connecté.
 * Garde-fous : JSON obligatoire (pas de requête « simple » depuis un autre
 * site), plafond global en base, plafond par adresse hors Anthropic, purge.
 */
export const dynamic = 'force-dynamic'

const PAR_HEURE_ET_ADRESSE = 60
const PAR_HEURE_AU_TOTAL = 200
const enregistrements = new Map<string, number[]>()

const erreur = (code: string, description: string, status = 400) =>
  Response.json({ error: code, error_description: description }, { status, headers: { 'Cache-Control': 'no-store' } })

/** Sortie des serveurs de Claude (160.79.104.0/21) : partagée par tous les comptes Claude, pas de plafond par adresse */
function depuisAnthropic(ip: string): boolean {
  const m = /^160\.79\.(\d+)\.\d+$/.exec(ip)
  return !!m && Number(m[1]) >= 104 && Number(m[1]) <= 111
}

export async function POST(req: Request) {
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return erreur('invalid_client_metadata', 'Content-Type application/json is required', 415)
  }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnue'
  if (!depuisAnthropic(ip)) {
    const maintenant = Date.now()
    if (enregistrements.size > 10_000) enregistrements.clear()
    // IPv6 : plafond par préfixe /64 (une machine en change à volonté)
    const cle = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip
    const recents = (enregistrements.get(cle) || []).filter((t) => maintenant - t < 3_600_000)
    if (recents.length >= PAR_HEURE_ET_ADRESSE) return erreur('invalid_client_metadata', 'too many registrations, retry later', 429)
    recents.push(maintenant)
    enregistrements.set(cle, recents)
  }

  const brut = await req.text()
  if (brut.length > 20_000) return erreur('invalid_client_metadata', 'metadata too large')
  let m: any
  try { m = JSON.parse(brut) } catch { return erreur('invalid_client_metadata', 'invalid JSON') }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return erreur('invalid_client_metadata', 'JSON object expected')

  const uris = m.redirect_uris
  if (!Array.isArray(uris) || !uris.length || uris.length > 5) return erreur('invalid_redirect_uri', 'redirect_uris must list 1 to 5 URIs')
  if (!uris.every(redirectionAutorisee)) return erreur('invalid_redirect_uri', 'only Claude redirect URIs are accepted')
  // Types demandés : authorization_code doit y être ; les autres (jwt-bearer…) sont ignorés (RFC 7591 §3.2.1)
  if (Array.isArray(m.grant_types) && !m.grant_types.includes('authorization_code')) return erreur('invalid_client_metadata', 'grant_types must include authorization_code')
  const nom = typeof m.client_name === 'string' && m.client_name.trim() ? m.client_name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100) : 'Claude'

  const supabase = await createServiceRoleClient()
  // Plafond global : la table ne se remplit pas, même depuis mille adresses
  const { count, error: errCompte } = await supabase.from('oauth_clients').select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString())
  if (errCompte) return erreur('server_error', 'temporarily unavailable', 503)
  if ((count || 0) >= PAR_HEURE_AU_TOTAL) return erreur('invalid_client_metadata', 'too many registrations, retry later', 429)

  const client_id = `ll_client_${randomBytes(16).toString('hex')}`
  const { error } = await supabase.from('oauth_clients').insert({ client_id, client_name: nom, redirect_uris: uris })
  if (error) {
    console.error('[oauth] enregistrement', error.message)
    return erreur('server_error', 'registration failed', 503)
  }
  // Purge des enregistrements de plus de 90 jours (les jetons déjà émis restent valables)
  await supabase.from('oauth_clients').delete().lt('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())

  return Response.json(
    {
      client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: nom,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      // Clients publics : pas de secret, PKCE obligatoire
      token_endpoint_auth_method: 'none',
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
}
