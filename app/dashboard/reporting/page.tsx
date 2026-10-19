import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { peutVoirChiffreAffaires } from '@/lib/acces-reserves'
import { getDashboardData } from './data'
import { ReportingDashboard } from './ReportingDashboard'

export default async function ReportingPage() {
  // Chiffre d'affaires de l'organisme : l'admin seul (lib/acces-reserves)
  if (!peutVoirChiffreAffaires((await getSession()).user.role)) redirect('/dashboard')
  const data = await getDashboardData()

  return (
    <div className="animate-fade-in">
      <ReportingDashboard data={data} />
    </div>
  )
}
