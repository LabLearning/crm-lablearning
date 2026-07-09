import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AgendaClient } from './AgendaClient'

export const dynamic = 'force-dynamic'

export default async function AgendaPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [interactionsRes, sessionsRes, tachesRes, usersRes, poeiRes, leadFormationsRes] = await Promise.all([
    supabase
      .from('lead_interactions')
      .select('*, lead:leads(contact_nom, contact_prenom, entreprise)')
      .eq('organization_id', orgId)
      .order('date', { ascending: true }),
    supabase
      .from('sessions')
      .select('id, reference, date_debut, date_fin, horaires, horaires_jours, lieu, status, formation:formation_id(intitule, is_poei), formateur:formateurs(prenom, nom)')
      .eq('organization_id', orgId)
      .in('status', ['planifiee', 'confirmee', 'en_cours']),
    supabase
      .from('crm_taches')
      .select(
        `id, titre, status, priorite, due_date, assignee_id, entity_type, entity_label,
         assignee:users!crm_taches_assignee_id_fkey(id, first_name, last_name, email)`,
      )
      .eq('organization_id', orgId)
      .is('archived_at', null)
      .not('due_date', 'is', null),
    supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('organization_id', orgId)
      .eq('status', 'active'),
    // Sessions rattachées à un projet POEI
    supabase
      .from('poei')
      .select('session_id')
      .eq('organization_id', orgId)
      .not('session_id', 'is', null),
    // Formations de leads avec une date mais pas encore de session → prévisionnel
    supabase
      .from('lead_formations')
      .select('id, lead_id, date_souhaitee, date_confirmee, formation:formation_id(intitule, duree_jours), lead:leads(id, entreprise, status)')
      .eq('organization_id', orgId)
      .is('session_id', null),
  ])

  const poeiSessionIds = new Set((poeiRes.data || []).map((p: any) => p.session_id))

  // Blocs prévisionnels : date confirmée ou souhaitée, lead encore actif
  const previsionnels = (leadFormationsRes.data || [])
    .filter((lf: any) => (lf.date_confirmee || lf.date_souhaitee) && lf.lead && !['perdu'].includes(lf.lead.status))
    .map((lf: any) => {
      const dateDebut = (lf.date_confirmee || lf.date_souhaitee).split('T')[0]
      const dureeJours = Math.max(1, Number(lf.formation?.duree_jours) || 1)
      const fin = new Date(dateDebut)
      fin.setDate(fin.getDate() + dureeJours - 1)
      return {
        id: `prev-${lf.id}`,
        titre: lf.formation?.intitule || 'Formation (lead)',
        reference: '',
        dateDebut,
        dateFin: fin.toISOString().split('T')[0],
        horaires: '',
        horairesJours: [],
        lieu: '',
        status: 'previsionnel',
        formateurNom: null,
        isPoei: false,
        isPrevisionnel: true,
        leadId: lf.lead_id,
        entreprise: lf.lead?.entreprise || '',
      }
    })

  return (
    <div className="animate-fade-in">
      <AgendaClient
        interactions={(interactionsRes.data || []).map((i: any) => ({
          id: i.id,
          type: i.type || 'note',
          titre: i.contenu ? i.contenu.substring(0, 60) : i.type || 'Interaction',
          date: i.date ? i.date.split('T')[0] : '',
          heure: i.date ? i.date.split('T')[1]?.substring(0, 5) || '09:00' : '09:00',
          leadName: i.lead ? `${i.lead.contact_nom || ''} ${i.lead.contact_prenom || ''}`.trim() : '',
          leadEntreprise: i.lead?.entreprise || '',
          done: false,
        }))}
        sessions={[...previsionnels, ...(sessionsRes.data || []).map((s: any) => ({
          id: s.id,
          titre: s.formation?.intitule || s.reference || 'Session',
          reference: s.reference || '',
          dateDebut: s.date_debut,
          dateFin: s.date_fin,
          horaires: s.horaires || '',
          horairesJours: Array.isArray(s.horaires_jours) ? s.horaires_jours : [],
          lieu: s.lieu || '',
          status: s.status,
          formateurNom: s.formateur ? `${s.formateur.prenom || ''} ${s.formateur.nom || ''}`.trim() : null,
          isPoei: !!(s.formation?.is_poei) || poeiSessionIds.has(s.id),
        }))]}
        taches={(tachesRes.data || []).map((t: any) => ({
          id: t.id,
          titre: t.titre,
          status: t.status,
          priorite: t.priorite,
          dueDate: t.due_date,
          assigneeId: t.assignee_id,
          assigneeName: t.assignee
            ? [t.assignee.first_name, t.assignee.last_name].filter(Boolean).join(' ') || t.assignee.email
            : null,
          entityType: t.entity_type,
          entityLabel: t.entity_label,
        }))}
        users={(usersRes.data || []) as any[]}
        currentUserId={session.user.id}
      />
    </div>
  )
}
