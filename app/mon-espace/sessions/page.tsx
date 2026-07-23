import { resolveFormateur } from '../_formateur/guard'
import { SessionsView } from '../_formateur/SessionsView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { formateurId } = await resolveFormateur()
  return <SessionsView formateurId={formateurId} basePath="/mon-espace" />
}
