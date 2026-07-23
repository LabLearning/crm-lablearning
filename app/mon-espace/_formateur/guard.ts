import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFormateurPortalToken } from '@/lib/formateur-portal'
import { redirect } from 'next/navigation'

/**
 * Résout le formateur À PARTIR DU COMPTE CONNECTÉ uniquement (jamais d'un id
 * d'URL). Le token de portail est résolu côté serveur : il appartient au
 * formateur connecté et sert aux server actions d'émargement / à l'API QR.
 */
export async function resolveFormateur() {
  const session = await getSession()
  if (session.user.role !== 'formateur') redirect('/mon-espace')

  const supabase = await createServiceRoleClient()
  const { data: formateur } = await supabase
    .from('formateurs')
    .select('id, prenom, nom, email')
    .eq('user_id', session.user.id)
    .single()
  if (!formateur) redirect('/mon-espace')

  const token = await getFormateurPortalToken(
    supabase, session.organization.id, session.user.id, session.user.email,
  )
  if (!token) redirect('/mon-espace')

  return {
    formateurId: formateur.id as string,
    formateurName: `${formateur.prenom} ${formateur.nom}`,
    formateurEmail: (formateur.email as string | null) ?? null,
    organizationId: session.organization.id as string,
    token,
  }
}
