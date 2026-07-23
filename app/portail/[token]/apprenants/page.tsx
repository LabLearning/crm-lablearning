import { getPortalContext } from '@/lib/portal-auth'
import { redirect } from 'next/navigation'
import { ApprenantsView } from '@/app/mon-espace/_formateur/ApprenantsView'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function PortalApprenantsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  return <ApprenantsView formateurId={context.formateur.id} token={params.token} />
}
