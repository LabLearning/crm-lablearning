import { resolveFormateur } from '../_formateur/guard'
import { ApprenantsView } from '../_formateur/ApprenantsView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { formateurId, token } = await resolveFormateur()
  return <ApprenantsView formateurId={formateurId} token={token} />
}
