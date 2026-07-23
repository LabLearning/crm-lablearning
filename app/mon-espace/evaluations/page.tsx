import { resolveFormateur } from '../_formateur/guard'
import { FormateurEvaluationsView } from '../_formateur/FormateurEvaluationsView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { formateurId } = await resolveFormateur()
  return <FormateurEvaluationsView formateurId={formateurId} />
}
