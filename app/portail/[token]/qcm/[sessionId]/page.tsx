import { getPortalContext } from '@/lib/portal-auth'
import { redirect } from 'next/navigation'
import { QcmSessionView } from '@/app/mon-espace/_formateur/QcmSessionView'

export const dynamic = 'force-dynamic'

export default async function PortalQcmSessionPage({
  params,
}: {
  params: { token: string; sessionId: string }
}) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  return (
    <QcmSessionView
      formateurId={context.formateur.id}
      formateurName={`${context.formateur.prenom} ${context.formateur.nom}`}
      token={params.token}
      basePath={`/portail/${params.token}`}
      sessionId={params.sessionId}
      deniedRedirect="/portail/expired"
    />
  )
}
