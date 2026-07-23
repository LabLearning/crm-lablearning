import { getPortalContext } from '@/lib/portal-auth'
import { redirect } from 'next/navigation'
import { SessionsView } from '@/app/mon-espace/_formateur/SessionsView'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function PortalSessionsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  return <SessionsView formateurId={context.formateur.id} basePath={`/portail/${params.token}`} />
}
