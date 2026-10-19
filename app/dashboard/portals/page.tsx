import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { peutAdministrer } from '@/lib/acces-reserves'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PortalManagement } from './PortalManagement'

export default async function PortalsPage() {
  const session = await getSession()
  // Partie Système : l'admin seul (lib/acces-reserves), même en arrivant d'une autre page du tableau de bord
  if (!peutAdministrer(session.user.role)) redirect('/dashboard')
  const supabase = await createServiceRoleClient()

  const [
    { data: tokens },
    { data: apprenants },
    { data: formateurs },
    { data: clients },
    { data: apporteurs },
  ] = await Promise.all([
    supabase
      .from('portal_access_tokens')
      .select('*, apprenant:apprenants(prenom, nom, email), formateur:formateurs(prenom, nom, email)')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('apprenants')
      .select('id, prenom, nom, email')
      .eq('organization_id', session.organization.id)
      .order('nom'),
    supabase
      .from('formateurs')
      .select('id, prenom, nom, email')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('nom'),
    supabase
      .from('clients')
      .select('id, raison_sociale, email, type')
      .eq('organization_id', session.organization.id)
      .order('raison_sociale'),
    supabase
      .from('apporteurs_affaires')
      .select('id, nom, prenom, email, categorie, nom_enseigne')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('nom'),
  ])

  return (
    <div className="animate-fade-in">
      <PortalManagement
        tokens={tokens || []}
        apprenants={apprenants || []}
        formateurs={formateurs || []}
        clients={clients || []}
        apporteurs={apporteurs || []}
        appUrl={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
      />
    </div>
  )
}
