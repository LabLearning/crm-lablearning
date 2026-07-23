import { resolveFormateur } from '../_formateur/guard'
import { FormateurDocumentsView } from '../_formateur/FormateurDocumentsView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { formateurId, formateurEmail, organizationId, token } = await resolveFormateur()
  return (
    <FormateurDocumentsView
      formateurId={formateurId}
      formateurEmail={formateurEmail}
      organizationId={organizationId}
      token={token}
    />
  )
}
