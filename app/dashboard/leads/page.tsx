import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { LeadsPipeline } from './LeadsPipeline'
import type { Lead } from '@/lib/types/crm'

export default async function LeadsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Apporteur d'affaires: only sees leads they sourced
  let leadsQuery = supabase
    .from('leads')
    .select(`
      *,
      assigned_user:users!leads_assigned_to_fkey(first_name, last_name),
      submitted_user:users!leads_submitted_by_fkey(first_name, last_name),
      validated_user:users!leads_validated_by_fkey(first_name, last_name),
      gestionnaire:users!leads_gestionnaire_id_fkey(first_name, last_name),
      apporteur:apporteurs_affaires(nom, prenom)
    `)
    .eq('organization_id', session.organization.id)
    .order('updated_at', { ascending: false })

  if (session.user.role === 'apporteur_affaires') {
    // Find linked apporteur record
    const { data: apporteurRecord } = await supabase
      .from('apporteurs_affaires')
      .select('id')
      .eq('user_id', session.user.id)
      .single()
    if (apporteurRecord) {
      leadsQuery = leadsQuery.eq('apporteur_id', apporteurRecord.id)
    } else {
      leadsQuery = leadsQuery.eq('apporteur_id', '00000000-0000-0000-0000-000000000000')
    }
  } else if (session.user.role === 'commercial') {
    leadsQuery = leadsQuery.eq('assigned_to', session.user.id)
  } else if (session.user.role === 'gestionnaire') {
    // Gestionnaire ne voit que les dossiers qui lui sont assignés
    leadsQuery = leadsQuery.eq('gestionnaire_id', session.user.id)
  }

  const { data: leads } = await leadsQuery

  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, role')
    .eq('organization_id', session.organization.id)
    .eq('status', 'active')
    .in('role', ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial'])

  // Gestionnaires (pour assignation à la validation)
  const { data: gestionnaires } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('organization_id', session.organization.id)
    .eq('status', 'active')
    .in('role', ['gestionnaire', 'super_admin'])

  // Formations pour le sélecteur (apporteur)
  const { data: formations } = await supabase
    .from('formations')
    .select('id, intitule, prix_ht')
    .eq('organization_id', session.organization.id)
    .eq('is_active', true)
    .order('intitule')

  const isApporteur = session.user.role === 'apporteur_affaires'

  return (
    <div className="animate-fade-in">
      <LeadsPipeline
        leads={(leads || []) as Lead[]}
        users={users || []}
        gestionnaires={gestionnaires || []}
        currentUserRole={session.user.role}
        currentUserId={session.user.id}
        formations={formations || []}
        isApporteur={isApporteur}
      />
    </div>
  )
}
