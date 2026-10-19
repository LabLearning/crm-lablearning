import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { peutAdministrer } from '@/lib/acces-reserves'
import { isSuperAdmin } from '@/lib/permissions'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const { user, organization } = await getSession()
  // Partie Système : l'admin seul (lib/acces-reserves), même en arrivant d'une autre page du tableau de bord
  if (!peutAdministrer(user.role)) redirect('/dashboard')
  const canEdit = isSuperAdmin(user.role)

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="page-header mb-5 sm:mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Paramètres</h1>
          <p className="text-surface-500 mt-1 text-sm">
            Informations de votre organisme de formation
          </p>
        </div>
      </div>
      <SettingsForm organization={organization} canEdit={canEdit} />
    </div>
  )
}
