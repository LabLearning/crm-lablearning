import { getPortalContext } from '@/lib/portal-auth'
import { redirect } from 'next/navigation'
import { ContenuSessionView } from '@/app/mon-espace/_formateur/ContenuSessionView'

export const dynamic = 'force-dynamic'

export default async function PortalContenuSessionPage({
  params,
}: {
  params: { token: string; sessionId: string }
}) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  return (
    <ContenuSessionView
      formateurId={context.formateur.id}
      formateurName={`${context.formateur.prenom} ${context.formateur.nom}`}
      token={params.token}
      basePath={`/portail/${params.token}`}
      sessionId={params.sessionId}
      deniedRedirect="/portail/expired"
    />
  )
}
