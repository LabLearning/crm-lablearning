import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchAllPaged } from '@/lib/supabase/fetch-all'
import { dateDemande, estEntrant, etapeDuLead, origineDuLead, type OrigineLead } from '@/lib/leads-entrants'
import { estResponsableLeads, peutSuivreLeads } from '@/lib/leads-acces'
import { peutGererSessions } from '@/lib/sessions-acces'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { LeadsInbox } from './LeadsInbox'

export const dynamic = 'force-dynamic'

/**
 * Leads : les demandes entrantes, du site et des publicités Meta et Google
 * Ads (décision du 24/10/2026). Chaque personne de l'équipe voit toutes les
 * demandes : une demande nouvelle n'est encore attribuée à personne.
 * Les indicateurs sont calculés ici, une fois : l'écran ne lit pas l'heure
 * pendant le rendu, ce qui éviterait un écart entre serveur et navigateur.
 */
export default async function LeadsPage({ searchParams }: { searchParams?: { lead?: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const maintenant = Date.now()
  const il_y_a = (jours: number) => new Date(maintenant - jours * 86400000).toISOString()

  const [leads, { data: equipe }, receptionsRes, canauxRes] = await Promise.all([
    // « * » : reponses, attribution et contacte_le n'existent qu'après la migration 167
    fetchAllPaged<any>((de, a) => supabase.from('leads')
      .select('*, assigned_user:users!leads_assigned_to_fkey(first_name, last_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(de, a)),
    supabase.from('users').select('id, first_name, last_name, role')
      .eq('organization_id', orgId).eq('status', 'active')
      .in('role', ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial'])
      .order('first_name'),
    // Clients déjà connus qui ont rempli un formulaire : pas de lead, mais l'équipe doit le voir.
    // Seulement ce qui s'affiche : le journal garde aussi coordonnées et réponses
    supabase.from('prospects_recus')
      .select('id, canal, recu_le, client_id, resume, evenement:donnees->>evenement, client:client_id(raison_sociale, nom_commercial)')
      .eq('organization_id', orgId).eq('statut', 'client_connu').gte('recu_le', il_y_a(60))
      .order('recu_le', { ascending: false }).limit(100),
    supabase.from('canaux_prospects').select('canal, actif, derniere_reception_at, derniere_erreur, derniere_erreur_at')
      .eq('organization_id', orgId),
  ])

  // La dernière demande d'abord : un prospect déjà connu qui revient remonte en tête
  const temps = (l: any) => Date.parse(dateDemande(l)) || 0
  leads.sort((a, b) => temps(b) - temps(a))
  const depuis = (jours: number) => maintenant - jours * 86400000

  // ── Indicateurs : les demandes entrantes seulement (site, publicités, apporteurs, anciens leads qui reviennent),
  //    comme la liste par défaut ──
  const entrants = leads.filter(estEntrant)
  const ouverts = entrants.filter((l) => ['a_traiter', 'contacte', 'qualifie'].includes(etapeDuLead(l)))
  const aTraiter = entrants.filter((l) => etapeDuLead(l) === 'a_traiter')
  const aTraiterDepuis24h = aTraiter.filter((l) => temps(l) < depuis(1)).length
  const recents = entrants.filter((l) => temps(l) >= depuis(7))
  const parOrigine7j: Record<OrigineLead, number> = { site: 0, meta: 0, google_ads: 0, apporteur: 0, ancien: 0 }
  for (const l of recents) parOrigine7j[origineDuLead(l.source)]++
  // Délai du premier contact sur 30 jours (médiane), lu sur contacte_le (migration 167)
  const delais = entrants
    .filter((l) => l.contacte_le && l.created_at >= il_y_a(30))
    .map((l) => new Date(l.contacte_le).getTime() - new Date(l.created_at).getTime())
    .filter((d) => d >= 0)
    .sort((a, b) => a - b)
  const delaiMedianMs = delais.length ? delais[Math.floor((delais.length - 1) / 2)] : null
  const entrants90j = entrants.filter((l) => temps(l) >= depuis(90))
  const gagnes90j = entrants90j.filter((l) => etapeDuLead(l) === 'gagne').length

  const role = session.user.role
  const peutSuivre = peutSuivreLeads(session)
  const estResponsable = estResponsableLeads(role)
  const peutSupprimer = estResponsable && peutSuivreLeads(session, 'delete')
  const peutGererCanaux = role === 'super_admin'
  // « Créer le dossier » ouvre l'assistant, qui crée une session : les deux droits sont nécessaires
  const peutCreerDossier = peutGererSessions(session, 'create')
    && checkDashboardAccess('/dashboard/dossiers/nouveau', role as any, session.permissions).allowed

  // Avant la migration 167, les tables des canaux n'existent pas : on le dit aux administrateurs
  const migrationManquante = !!(canauxRes as any).error
  const canaux = migrationManquante ? [] : ((canauxRes as any).data || []) as any[]

  // Un commercial ne voit que les clients de son portefeuille : assignés à lui, ou issus d'un lead qui lui est
  // attribué (même règle que la fiche client). Pour lui, la liste des clients ouvrables accompagne les leads
  let clientsQuiOntRepondu = (((receptionsRes as any).error ? [] : (receptionsRes as any).data) || []) as any[]
  let clientsAccessibles: string[] | null = null
  if (role === 'commercial') {
    const ids = Array.from(new Set([
      ...clientsQuiOntRepondu.map((r) => r.client_id),
      ...leads.map((l) => l.converted_client_id),
    ].filter(Boolean))) as string[]
    const siens = new Set<string>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from('clients').select('id').eq('organization_id', orgId)
        .in('id', ids.slice(i, i + 200)).eq('assigned_to', session.user.id)
      for (const c of (data || []) as any[]) siens.add(c.id)
    }
    for (const l of leads) if (l.converted_client_id && l.assigned_to === session.user.id) siens.add(l.converted_client_id)
    clientsAccessibles = Array.from(siens)
    clientsQuiOntRepondu = clientsQuiOntRepondu.filter((r) => siens.has(r.client_id))
  }

  return (
    <div className="animate-fade-in">
      <LeadsInbox
        leads={leads}
        equipe={(equipe || []) as any[]}
        clientsQuiOntRepondu={clientsQuiOntRepondu}
        canaux={canaux}
        migrationManquante={migrationManquante}
        indicateurs={{
          ouverts: ouverts.length,
          aTraiter: aTraiter.length,
          aTraiterDepuis24h,
          recus7j: recents.length,
          parOrigine7j,
          delaiMedianMs,
          delaisMesures: delais.length,
          entrants90j: entrants90j.length,
          gagnes90j,
        }}
        aujourdhui={new Date(maintenant).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })}
        moi={session.user.id}
        leadOuvert={typeof searchParams?.lead === 'string' ? searchParams.lead : null}
        peutSuivre={peutSuivre}
        estResponsable={estResponsable}
        peutSupprimer={peutSupprimer}
        peutGererCanaux={peutGererCanaux}
        peutCreerDossier={peutCreerDossier}
        clientsAccessibles={clientsAccessibles}
      />
    </div>
  )
}
