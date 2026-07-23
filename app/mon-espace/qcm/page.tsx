import { resolveFormateur } from '../_formateur/guard'
import { QcmListView } from '../_formateur/QcmListView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { formateurId } = await resolveFormateur()
  return <QcmListView formateurId={formateurId} basePath="/mon-espace" />
}
