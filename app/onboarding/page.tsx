import { getSession } from '@/lib/auth'
import { OnboardingWizard } from './OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const { user } = await getSession()
  return <OnboardingWizard prenom={(user as any).first_name || ''} />
}
