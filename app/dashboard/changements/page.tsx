import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import ChangementsClient from './ChangementsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Changements participants — CRM Lab Learning' }

export default async function ChangementsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: demandes } = await supabase
    .from('demandes_changement_participants')
    .select(`
      id, type, statut, motif, nouveau_nom, nouveau_prenom, nouveau_email, nouveau_telephone,
      created_at, validated_at, reponse_gestionnaire,
      session:sessions(id, reference, date_debut, formation:formation_id(intitule)),
      formateur:formateurs(prenom, nom),
      apprenant:apprenants(prenom, nom)
    `)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return <ChangementsClient demandes={(demandes || []) as any[]} />
}
