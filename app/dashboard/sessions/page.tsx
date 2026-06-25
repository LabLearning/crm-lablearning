import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SessionsList } from './SessionsList'
import type { Session, Formation, Formateur } from '@/lib/types/formation'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      formation:formation_id(intitule, reference, modalite, duree_heures),
      formateur:formateurs(prenom, nom),
      client:client_id(raison_sociale)
    `)
    .eq('organization_id', session.organization.id)
    .order('date_debut', { ascending: false })

  // Count + IDs des inscriptions + formations liées (pour pré-cocher en édition)
  const sessionsWithCounts = await Promise.all(
    (sessions || []).map(async (s) => {
      const [{ data: inscrits, count }, { data: linkedFormations }] = await Promise.all([
        supabase.from('inscriptions').select('apprenant_id', { count: 'exact' }).eq('session_id', s.id).not('status', 'in', '("annule","abandonne")'),
        supabase.from('session_formations').select('formation_id, ordre').eq('session_id', s.id).order('ordre'),
      ])
      return {
        ...s,
        _nb_inscrits: count || 0,
        _inscrits_ids: (inscrits || []).map(i => i.apprenant_id),
        _formation_ids: (linkedFormations || []).map(f => f.formation_id),
      }
    })
  )

  const { data: formations } = await supabase
    .from('formations')
    .select('id, intitule, reference, modalite, duree_heures, duree_jours')
    .eq('organization_id', session.organization.id)
    .eq('is_active', true)
    .order('intitule')

  const { data: formateurs } = await supabase
    .from('formateurs')
    .select('id, prenom, nom, tarif_journalier')
    .eq('organization_id', session.organization.id)
    .eq('is_active', true)
    .order('nom')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, raison_sociale, adresse, code_postal, ville')
    .eq('organization_id', session.organization.id)
    .eq('type', 'entreprise')
    .order('raison_sociale')

  const { data: apprenants } = await supabase
    .from('apprenants')
    .select('id, prenom, nom, email, client_id')
    .eq('organization_id', session.organization.id)
    .order('nom')

  return (
    <div className="animate-fade-in">
      <SessionsList
        sessions={sessionsWithCounts as Session[]}
        formations={(formations || []) as any[]}
        formateurs={(formateurs || []) as any[]}
        clients={(clients || []) as any[]}
        apprenants={(apprenants || []) as any[]}
      />
    </div>
  )
}
