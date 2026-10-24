import type { SessionContext } from '@/lib/auth'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { hasPermission, isAdmin } from '@/lib/permissions'

/**
 * Droits sur les leads, communs à la page Leads, aux anciennes actions du
 * module et à l'assistant « Nouveau dossier ».
 *
 * Le portefeuille d'un commercial compte les clients issus d'un lead converti
 * qui lui est attribué (fiche client, compte OPCO, Starkk). Attribuer un lead
 * ou le relier à un client ouvre donc l'accès à ce client : seuls les
 * responsables le font librement.
 */

/** Responsables : réattribuent, suppriment, relient un lead à n'importe quel client. */
export function estResponsableLeads(role: string | null | undefined): boolean {
  return isAdmin(role as any) || role === 'directeur_commercial'
}

/** Personnel qui suit les leads : accès à la page et droit de modifier (ou de supprimer) dans le module. */
export function peutSuivreLeads(session: SessionContext, droit: 'update' | 'delete' = 'update'): boolean {
  if (!checkDashboardAccess('/dashboard/leads', session.user.role as any, session.permissions).allowed) return false
  if (droit === 'update' && session.user.role === 'directeur_commercial') return true
  return isAdmin(session.user.role) || hasPermission(session.permissions, 'leads', droit)
}

/**
 * Changement de suivi permis : un responsable attribue à qui il veut ; les
 * autres prennent un lead sans suivi ou cessent de suivre le leur, jamais sur
 * un lead déjà gagné. Renvoie le motif du refus, ou null.
 */
export function refusAttribution(
  session: SessionContext,
  lead: { assigned_to?: string | null; converted_client_id?: string | null; status?: string | null },
  cible: string | null,
): string | null {
  if (estResponsableLeads(session.user.role)) return null
  if (lead.converted_client_id || lead.status === 'gagne') return 'Un lead gagné change de suivi par un responsable'
  const prendre = cible === session.user.id && !lead.assigned_to
  const cesser = cible === null && lead.assigned_to === session.user.id
  if (prendre || cesser) return null
  return 'Vous pouvez prendre un lead sans suivi ou cesser de suivre le vôtre ; un responsable attribue les autres'
}

/**
 * Un lead peut-il être relié à ce client par cette personne ? Un responsable,
 * oui. Un commercial seulement à un client qu'il suit déjà, à celui qu'il
 * vient de créer, ou à celui que son propre lead désigne déjà : sinon le lien
 * lui ouvrirait la fiche d'un client confié à un autre. Le lien déjà fait
 * d'un lead sans suivi ne compte pas : reprendre ce lead donnerait le client.
 */
export async function peutRelierLeadAuClient(
  supabase: any,
  session: SessionContext,
  lead: { converted_client_id?: string | null; assigned_to?: string | null },
  clientId: string,
  options: { clientCreeIci?: boolean } = {},
): Promise<boolean> {
  if (session.user.role !== 'commercial') return true
  if (options.clientCreeIci) return true
  if (lead.converted_client_id === clientId && lead.assigned_to === session.user.id) return true
  const { data: c } = await supabase.from('clients').select('assigned_to')
    .eq('id', clientId).eq('organization_id', session.organization.id).maybeSingle()
  return !!c && c.assigned_to === session.user.id
}

/**
 * Suppression d'un lead : le journal des réceptions garde sa trace (canal,
 * identifiant chez Meta ou Google, statut) pour que le relevé Meta ne
 * réimporte pas la personne, sans ses coordonnées ni ses réponses. Ses
 * notifications partent avec lui, et les e-mails envoyés à son sujet
 * (modèle gratuit, message de la page Contact) perdent adresse, nom et objet.
 * Ses échanges notés partent avec le lead (suppression en cascade).
 * À appeler avant de supprimer le lead (le lien du journal s'efface ensuite).
 */
export async function purgerTracesLead(supabase: any, orgId: string, leadId: string): Promise<void> {
  // Journal absent avant la migration 167 : rien à purger
  await supabase.from('prospects_recus').update({ resume: null, donnees: null, erreur: null })
    .eq('organization_id', orgId).eq('lead_id', leadId)
  await supabase.from('notifications').delete()
    .eq('organization_id', orgId).eq('entity_type', 'lead').eq('entity_id', leadId)
  // Adresse et objet obligatoires dans le journal des e-mails : remplacés, la ligne reste pour les comptes
  await supabase.from('email_logs').update({ to_email: 'efface@lead-supprime.invalid', to_name: null, subject: 'E-mail d’un lead supprimé', variables: null })
    .eq('organization_id', orgId).in('entity_type', ['lead', 'contact_site']).eq('entity_id', leadId)
}
