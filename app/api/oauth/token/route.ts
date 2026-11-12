import { createServiceRoleClient } from '@/lib/supabase/server'
import { echangerCode, renouveler } from '@/lib/connecteur-claude/oauth'

/**
 * Point de jetons (RFC 6749, OAuth 2.1) : échange d'un code d'autorisation
 * (PKCE vérifié) ou renouvellement avec rotation. Corps
 * application/x-www-form-urlencoded, comme l'envoie Claude ; JSON accepté aussi.
 */
export const dynamic = 'force-dynamic'

const SANS_CACHE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

export async function POST(req: Request) {
  const brut = await req.text()
  if (brut.length > 20_000) return Response.json({ error: 'invalid_request', error_description: 'request too large' }, { status: 400, headers: SANS_CACHE })
  const type = req.headers.get('content-type') || ''
  let p: Record<string, string> = {}
  try {
    if (type.includes('application/json')) {
      const j = JSON.parse(brut)
      for (const [k, v] of Object.entries(j || {})) if (typeof v === 'string') p[k] = v
    } else {
      p = Object.fromEntries(new URLSearchParams(brut))
    }
  } catch {
    return Response.json({ error: 'invalid_request', error_description: 'unreadable body' }, { status: 400, headers: SANS_CACHE })
  }

  const supabase = await createServiceRoleClient()
  const resultat = p.grant_type === 'authorization_code' ? await echangerCode(supabase, p)
    : p.grant_type === 'refresh_token' ? await renouveler(supabase, p)
      : { erreur: 'unsupported_grant_type' as const, description: 'authorization_code or refresh_token' }

  if ('erreur' in resultat) {
    // Panne passagère : 503, jamais invalid_grant (Claude réessaie au lieu d'abandonner la connexion)
    const status = resultat.erreur === 'server_error' ? 503 : resultat.erreur === 'invalid_client' ? 401 : 400
    return Response.json({ error: resultat.erreur, error_description: resultat.description }, { status, headers: SANS_CACHE })
  }
  return Response.json(resultat, { headers: SANS_CACHE })
}
