// Endpoint test Sentry — déclenche une exception pour vérifier la capture
// À supprimer une fois Sentry validé en prod
export const dynamic = 'force-dynamic'

export async function GET() {
  throw new Error('Sentry test — capture serveur OK ?')
}
