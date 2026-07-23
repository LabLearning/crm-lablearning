import { getPortalContext } from '@/lib/portal-auth'
import { redirect } from 'next/navigation'
import { EmargementListView } from '@/app/mon-espace/_formateur/EmargementListView'

export const dynamic = 'force-dynamic'

export default async function PortalEmargementPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  return <EmargementListView formateurId={context.formateur.id} basePath={`/portail/${params.token}`} />
}
