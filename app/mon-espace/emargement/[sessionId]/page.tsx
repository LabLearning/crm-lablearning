import { resolveFormateur } from '../../_formateur/guard'
import { EmargementSessionView } from '../../_formateur/EmargementSessionView'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { sessionId: string } }) {
  const { formateurId, formateurName, token } = await resolveFormateur()
  return (
    <EmargementSessionView
      formateurId={formateurId}
      formateurName={formateurName}
      token={token}
      basePath="/mon-espace"
      sessionId={params.sessionId}
      deniedRedirect="/mon-espace"
    />
  )
}
