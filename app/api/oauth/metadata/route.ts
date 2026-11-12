import { PORTEE, baseCrm } from '@/lib/connecteur-claude/oauth'

/**
 * Métadonnées du serveur d'autorisation (RFC 8414), servies sous
 * /.well-known/oauth-authorization-server (réécriture dans next.config.js).
 * Clients publics uniquement (PKCE S256 obligatoire), enregistrement dynamique.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const base = baseCrm()
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      // Identités publiées de Claude (application et Claude Code) : pas d'enregistrement nécessaire
      client_id_metadata_document_supported: true,
      scopes_supported: [PORTEE],
      service_documentation: `${base}/dashboard/settings`,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
