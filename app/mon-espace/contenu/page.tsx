import { resolveFormateur } from '../_formateur/guard'
import { ContenuListView } from '../_formateur/ContenuListView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { formateurId } = await resolveFormateur()
  return <ContenuListView formateurId={formateurId} basePath="/mon-espace" />
}
