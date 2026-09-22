import { getApporteurSession } from '@/lib/apporteur-auth'
import { nomApporteur } from '@/lib/commission-apporteur'
import { Handshake } from '@/components/ui/icons'
import { ApporteurShell } from './ApporteurShell'

export const dynamic = 'force-dynamic'

export default async function ApporteurLayout({ children }: { children: React.ReactNode }) {
  const { user, apporteur, organization, impersonatedBy } = await getApporteurSession()

  return (
    <ApporteurShell
      user={user}
      apporteurName={apporteur ? nomApporteur(apporteur) : `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Apporteur'}
      orgName={organization.name}
      isImpersonating={!!impersonatedBy}
    >
      {apporteur ? children : (
        <div className="card flex flex-col items-center justify-center text-center py-16 px-8 max-w-xl mx-auto">
          <Handshake className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm font-medium text-surface-800">Votre compte n&apos;est rattaché à aucune fiche apporteur</p>
          <p className="text-xs text-surface-500 mt-1">
            Contactez {organization.name} pour que votre fiche d&apos;apporteur d&apos;affaires soit liée à ce compte. Vos commissions apparaîtront ici ensuite.
          </p>
        </div>
      )}
    </ApporteurShell>
  )
}
