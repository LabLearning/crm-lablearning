import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFormateurPortalToken } from '@/lib/formateur-portal'

export const dynamic = 'force-dynamic'

// Onglet du menu /mon-espace : redirige vers la page correspondante du
// portail formateur (le token est résolu côté serveur, créé si besoin).
export default async function Page() {
  const session = await getSession()
  if (session.user.role !== 'formateur') redirect('/mon-espace')
  const supabase = await createServiceRoleClient()
  const token = await getFormateurPortalToken(supabase, session.organization.id, session.user.id, session.user.email)
  if (!token) redirect('/mon-espace')
  redirect(`/portail/${token}/emargement`)
}
