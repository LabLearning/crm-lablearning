'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { ROLES_INCIDENTS_POEI } from '@/lib/rapport-france-travail'

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string }

/**
 * Un incident de dossier POEI a pu partir chez France Travail dans un rapport :
 * il obéit aux règles du dossier (rôle et accès au module, trace au journal),
 * même quand on le touche depuis ce registre général.
 */
async function lireIncident(supabase: any, session: Awaited<ReturnType<typeof getSession>>, id: string): Promise<{ incident: any | null; refus?: string }> {
  const { data: incident } = await supabase.from('incidents').select('*').eq('id', id).eq('organization_id', session.organization.id).maybeSingle()
  if (!incident) return { incident: null, refus: 'Incident introuvable' }
  if (incident.poei_id && !(ROLES_INCIDENTS_POEI.includes(session.user.role)
    && checkDashboardAccess('/dashboard/poei', session.user.role as any, session.permissions).allowed)) {
    return { incident, refus: 'Cet incident appartient à un dossier POEI : il se traite depuis le dossier, par l’équipe qui en a la charge' }
  }
  return { incident }
}

function rafraichir(poeiId?: string | null) {
  revalidatePath('/dashboard/incidents')
  if (poeiId) { revalidatePath(`/dashboard/poei/${poeiId}`); revalidatePath('/mon-espace/poei') }
}

export async function createIncidentAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const titre = (formData.get('titre') as string || '').trim()
  if (!titre) return { success: false, error: 'Le titre est requis' }

  const clientId = (formData.get('client_id') as string) || null
  const sessionId = (formData.get('session_id') as string) || null

  // Déduire la franchise depuis le client
  let franchiseId: string | null = null
  if (clientId) {
    const { data: client } = await supabase
      .from('clients').select('franchise_id').eq('id', clientId).eq('organization_id', session.organization.id).single()
    franchiseId = client?.franchise_id || null
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      organization_id: session.organization.id,
      client_id: clientId,
      session_id: sessionId,
      franchise_id: franchiseId,
      date_incident: (formData.get('date_incident') as string) || new Date().toISOString().split('T')[0],
      type: (formData.get('type') as string) || 'autre',
      gravite: (formData.get('gravite') as string) || 'mineur',
      titre,
      description: (formData.get('description') as string) || null,
      mesures_prises: (formData.get('mesures_prises') as string) || null,
      statut: (formData.get('statut') as string) || 'ouvert',
      auteur_id: session.user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Notifier les comptes franchise rattachés
  if (franchiseId) {
    try {
      const { createNotifications } = await import('@/lib/email')
      const { data: fUsers } = await supabase
        .from('users').select('id').eq('franchise_id', franchiseId).eq('role', 'franchise').eq('status', 'active')
      if (fUsers && fUsers.length > 0) {
        await createNotifications(fUsers.map((u: any) => ({
          organizationId: session.organization.id,
          userId: u.id,
          titre: 'Nouveau rapport d\'incident',
          message: `Un incident a été signalé : ${titre}`,
          type: 'warning',
          lienUrl: '/franchise/incidents',
          lienLabel: 'Voir l\'incident',
          entityType: 'incident',
          entityId: data.id,
        })))
      }
    } catch (e) { console.error('[incident notify]', e) }
  }

  await logAudit({ action: 'create', entity_type: 'incident', entity_id: data.id })
  revalidatePath('/dashboard/incidents')
  return { success: true, data }
}

export async function updateIncidentStatutAction(id: string, statut: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { incident, refus } = await lireIncident(supabase, session, id)
  if (refus) return { success: false, error: refus }
  // Même statut : rien à écrire (la date de résolution, imprimée au rapport, ne doit pas être redatée)
  if (incident.statut === statut) return { success: true }
  const { error } = await supabase
    .from('incidents')
    .update({ statut, resolu_at: (statut === 'resolu' || statut === 'clos') ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }
  if (incident.poei_id) await logAudit({ action: 'update', entity_type: 'incident', entity_id: id, details: { statut, poei: incident.poei_id } })
  rafraichir(incident.poei_id)
  return { success: true }
}

export async function deleteIncidentAction(id: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { incident, refus } = await lireIncident(supabase, session, id)
  if (refus) return { success: false, error: refus }
  // Incident POEI : son contenu reste au journal avant de disparaître, ou il ne disparaît pas
  if (incident.poei_id) {
    const champs = ['titre', 'date_incident', 'type', 'gravite', 'statut', 'resolu_at', 'apprenant_id', 'formateur_id', 'auteur_id', 'description', 'mesures_prises', 'created_at']
    const journalise = await logAudit({
      action: 'delete', entity_type: 'incident', entity_id: id,
      details: { poei: incident.poei_id, supprime: Object.fromEntries(champs.map((c) => [c, incident[c] ?? null])) },
    })
    if (!journalise) return { success: false, error: 'La suppression n’a pas pu être consignée au journal : rien n’a été supprimé, réessayez' }
  }
  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }
  rafraichir(incident.poei_id)
  return { success: true }
}
