import { getPortalContext } from '@/lib/portal-auth'
import { redirect } from 'next/navigation'
import { QcmListView } from '@/app/mon-espace/_formateur/QcmListView'

export const dynamic = 'force-dynamic'

export default async function PortalQcmPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  return <QcmListView formateurId={context.formateur.id} basePath={`/portail/${params.token}`} />
}
