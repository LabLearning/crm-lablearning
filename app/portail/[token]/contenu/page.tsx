import { getPortalContext } from '@/lib/portal-auth'
import { redirect } from 'next/navigation'
import { ContenuListView } from '@/app/mon-espace/_formateur/ContenuListView'

export const dynamic = 'force-dynamic'

export default async function PortalContenuPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  return <ContenuListView formateurId={context.formateur.id} basePath={`/portail/${params.token}`} />
}
