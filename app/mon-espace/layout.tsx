import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MonEspaceShell } from './MonEspaceShell'

const PORTAIL_ROLES = ['apporteur_affaires', 'formateur', 'apprenant']

export default async function MonEspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // Seuls les rôles portail accèdent ici — sauf un administrateur en mode
  // aperçu, qui doit pouvoir voir cet espace ET en ressortir.
  if (!PORTAIL_ROLES.includes(session.user.role)) {
    redirect('/dashboard')
  }
  // Les apporteurs d'affaires ont leur propre espace (commissions, établissements)
  if (session.user.role === 'apporteur_affaires') {
    redirect('/apporteur')
  }

  return (
    <MonEspaceShell user={session.user} orgName={session.organization.name} impersonatedBy={session.impersonatedBy}>
      {children}
    </MonEspaceShell>
  )
}
