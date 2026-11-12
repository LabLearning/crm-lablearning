import { PORTEE, baseCrm, ressourceMcp } from '@/lib/connecteur-claude/oauth'

/**
 * Métadonnées de la ressource protégée (RFC 9728) : indiquent à Claude où se
 * connecter pour obtenir un jeton du connecteur. Servies aussi sous
 * /.well-known/oauth-protected-resource (réécriture dans next.config.js).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(
    {
      resource: ressourceMcp(),
      authorization_servers: [baseCrm()],
      scopes_supported: [PORTEE],
      bearer_methods_supported: ['header'],
      resource_name: 'CRM Lab Learning',
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
