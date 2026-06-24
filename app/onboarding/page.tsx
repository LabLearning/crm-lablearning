import { getSession } from '@/lib/auth'
import { OnboardingWizard } from './OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const { user, organization } = await getSession()
  return (
    <OnboardingWizard
      defaultName={organization.name || ''}
      defaultPrenom={(user as any).first_name || ''}
      defaultNom={(user as any).last_name || ''}
    />
  )
}
