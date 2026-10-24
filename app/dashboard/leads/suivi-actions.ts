'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession, type SessionContext } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { ETAPES, STATUT_DE_L_ETAPE, type EtapeLead } from '@/lib/leads-entrants'
import { estResponsableLeads, peutSuivreLeads, purgerTracesLead, refusAttribution } from '@/lib/leads-acces'
import type { ActionResult } from '@/lib/types'

/**
 * Suivi des demandes entrantes depuis la page Leads (étape, échanges, rappel,
 * attribution, coordonnées). Comme toute action exportée d'un module
 * 'use server', chacune vérifie elle-même le rôle et l'organisme du lead
 * (règles communes dans lib/leads-acces).
 */

const propre = (v: unknown, max = 200) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const TYPES_ECHANGE = ['appel', 'email', 'rdv', 'note'] as const
type TypeEchange = typeof TYPES_ECHANGE[number]

async function leadDeLOrganisme(supabase: any, session: SessionContext, leadId: string) {
  if (typeof leadId !== 'string' || !leadId) return null
  const { data } = await supabase.from('leads').select('*')
    .eq('id', leadId).eq('organization_id', session.organization.id).maybeSingle()
  return data || null
}

/** Change l'étape d'un lead. Le premier passage à « Contacté » est horodaté (délai de rappel). */
export async function changerEtapeLeadAction(leadId: string, etape: EtapeLead, motif?: string | null): Promise<ActionResult> {
  const session = await getSession()
  if (!peutSuivreLeads(session)) return { success: false, error: 'Accès non autorisé' }
  if (!ETAPES.some((e) => e.id === etape)) return { success: false, error: 'Étape inconnue' }
  const supabase = await createServiceRoleClient()
  const lead = await leadDeLOrganisme(supabase, session, leadId)
  if (!lead) return { success: false, error: 'Lead introuvable' }
  // Relié à un client, le lead reste « Gagné » (l'écran le montre ainsi) : seul « Perdu » le sort de là
  if (lead.converted_client_id && etape !== 'gagne' && etape !== 'perdu') {
    return { success: false, error: 'Ce lead est relié à un client : il reste « Gagné », ou passez-le à « Perdu »' }
  }

  const maintenant = new Date().toISOString()
  const motifPropre = etape === 'perdu' ? (propre(motif, 300) || null) : null
  const maj: Record<string, unknown> = { status: STATUT_DE_L_ETAPE[etape] }
  if (etape === 'perdu') maj.lost_reason = motifPropre
  // Premier contact (délai de rappel) : quand le lead quitte « à traiter » parce que le prospect a été joint,
  // pas au tri d'un doublon ou d'un hors cible, ni des jours plus tard sur un lead déjà contacté.
  // La colonne n'existe qu'après la migration 167 : on ne l'écrit que si le lead la porte
  if ((etape === 'contacte' || etape === 'qualifie') && lead.status === 'nouveau' && 'contacte_le' in lead && !lead.contacte_le) maj.contacte_le = maintenant

  const { error } = await supabase.from('leads').update(maj).eq('id', leadId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Le changement d’étape a échoué' }

  const libelle = ETAPES.find((e) => e.id === etape)!.label
  await supabase.from('lead_interactions').insert({
    organization_id: session.organization.id,
    lead_id: leadId,
    type: 'autre',
    subject: 'Étape',
    content: `Passé à « ${libelle} »${motifPropre ? ` : ${motifPropre}` : ''}`,
    user_id: session.user.id,
  })
  await logAudit({ action: 'update_status', entity_type: 'lead', entity_id: leadId, details: { etape, statut: maj.status, motif: motifPropre } })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

/**
 * Note un échange avec le prospect (appel, e-mail, rendez-vous, simple note).
 * Un appel, un e-mail ou un rendez-vous sur un lead « à traiter » le fait
 * passer à « Contacté ».
 */
export async function ajouterEchangeLeadAction(leadId: string, type: TypeEchange, contenu: string): Promise<ActionResult<{ etapeChangee: boolean }>> {
  const session = await getSession()
  if (!peutSuivreLeads(session)) return { success: false, error: 'Accès non autorisé' }
  if (!TYPES_ECHANGE.includes(type)) return { success: false, error: 'Type d’échange inconnu' }
  const texte = String(contenu ?? '').replace(/[<>]/g, '').trim().slice(0, 4000)
  if (!texte) return { success: false, error: 'Écrivez quelques mots sur l’échange' }
  const supabase = await createServiceRoleClient()
  const lead = await leadDeLOrganisme(supabase, session, leadId)
  if (!lead) return { success: false, error: 'Lead introuvable' }

  const { error } = await supabase.from('lead_interactions').insert({
    organization_id: session.organization.id,
    lead_id: leadId,
    type,
    content: texte,
    user_id: session.user.id,
  })
  if (error) return { success: false, error: 'L’échange n’a pas été enregistré' }

  // Appel, e-mail ou rendez-vous sur un lead à traiter : le prospect est joint (« Contacté », heure du premier contact)
  let etapeChangee = false
  if (type !== 'note' && lead.status === 'nouveau') {
    const maj: Record<string, unknown> = {}
    if (!lead.converted_client_id) maj.status = 'contacte'
    if ('contacte_le' in lead && !lead.contacte_le) maj.contacte_le = new Date().toISOString()
    if (Object.keys(maj).length) {
      const { error: e2 } = await supabase.from('leads').update(maj).eq('id', leadId).eq('organization_id', session.organization.id)
      etapeChangee = !e2 && maj.status === 'contacte'
    }
  }
  revalidatePath('/dashboard/leads')
  return { success: true, data: { etapeChangee } }
}

/** Prochain rappel : une date (ou rien) et ce qu'il faut faire. */
export async function planifierRappelLeadAction(leadId: string, date: string | null, quoi: string | null): Promise<ActionResult> {
  const session = await getSession()
  if (!peutSuivreLeads(session)) return { success: false, error: 'Accès non autorisé' }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: 'Date invalide' }
  const supabase = await createServiceRoleClient()
  const lead = await leadDeLOrganisme(supabase, session, leadId)
  if (!lead) return { success: false, error: 'Lead introuvable' }
  const { error } = await supabase.from('leads').update({
    next_action_date: date || null,
    next_action: date ? (propre(quoi, 200) || 'Rappeler') : (propre(quoi, 200) || null),
  }).eq('id', leadId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Le rappel n’a pas été enregistré' }
  revalidatePath('/dashboard/leads')
  return { success: true }
}

/**
 * Qui suit le lead (personne de l'équipe, ou personne). Un responsable
 * attribue à qui il veut ; les autres prennent un lead sans suivi ou cessent
 * de suivre le leur (lib/leads-acces, refusAttribution).
 */
export async function attribuerLeadAction(leadId: string, userId: string | null): Promise<ActionResult> {
  const session = await getSession()
  if (!peutSuivreLeads(session)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const lead = await leadDeLOrganisme(supabase, session, leadId)
  if (!lead) return { success: false, error: 'Lead introuvable' }
  const cible = typeof userId === 'string' && userId ? userId : null
  if ((lead.assigned_to || null) === cible) return { success: true }
  const refus = refusAttribution(session, lead, cible)
  if (refus) {
    // Pris entre-temps par quelqu'un d'autre : on le dit, avec son nom
    if (cible === session.user.id && lead.assigned_to && lead.assigned_to !== session.user.id) {
      const { data: u } = await supabase.from('users').select('first_name, last_name').eq('id', lead.assigned_to).maybeSingle()
      const nom = u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : ''
      return { success: false, error: nom ? `Ce lead est déjà suivi par ${nom}` : 'Ce lead est déjà suivi par une autre personne' }
    }
    return { success: false, error: refus }
  }
  if (cible) {
    const { data: u } = await supabase.from('users').select('id, role, status')
      .eq('id', cible).eq('organization_id', session.organization.id).maybeSingle()
    if (!u || u.status !== 'active' || ['formateur', 'apprenant', 'apporteur_affaires', 'franchise'].includes(u.role)) {
      return { success: false, error: 'Personne introuvable dans l’équipe' }
    }
  }
  // Prise d'un lead libre : la condition reste dans la requête, deux commerciaux ne le prennent pas tous les deux
  let requete = supabase.from('leads').update({ assigned_to: cible })
    .eq('id', leadId).eq('organization_id', session.organization.id)
  requete = lead.assigned_to ? requete.eq('assigned_to', lead.assigned_to) : requete.is('assigned_to', null)
  const { data: maj, error } = await requete.select('id')
  if (error) return { success: false, error: 'L’attribution a échoué' }
  if (!maj?.length) return { success: false, error: 'Le suivi de ce lead vient de changer : la fiche est mise à jour' }
  await logAudit({ action: 'assign', entity_type: 'lead', entity_id: leadId, details: { assigned_to: cible, avant: lead.assigned_to || null } })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

/** Corrige les coordonnées du prospect (après un appel, par exemple). */
export async function modifierCoordonneesLeadAction(leadId: string, champs: {
  contact_prenom?: string | null; contact_nom?: string | null; contact_email?: string | null; contact_telephone?: string | null
  contact_poste?: string | null; entreprise?: string | null; ville?: string | null; code_postal?: string | null
}): Promise<ActionResult> {
  const session = await getSession()
  if (!peutSuivreLeads(session)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const lead = await leadDeLOrganisme(supabase, session, leadId)
  if (!lead) return { success: false, error: 'Lead introuvable' }

  const nom = propre(champs.contact_nom, 80)
  if (!nom) return { success: false, error: 'Le nom du contact est obligatoire' }
  const email = propre(champs.contact_email, 200).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { success: false, error: 'Adresse e-mail invalide' }
  const telephone = propre(champs.contact_telephone, 30)
  if (telephone && telephone.replace(/\D/g, '').length < 9) return { success: false, error: 'Numéro de téléphone incomplet' }

  const { error } = await supabase.from('leads').update({
    contact_prenom: propre(champs.contact_prenom, 80) || null,
    contact_nom: nom,
    contact_email: email || null,
    contact_telephone: telephone || null,
    contact_poste: propre(champs.contact_poste, 120) || null,
    entreprise: propre(champs.entreprise, 160) || null,
    ville: propre(champs.ville, 120) || null,
    code_postal: propre(champs.code_postal, 10) || null,
  }).eq('id', leadId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Les coordonnées n’ont pas été enregistrées' }
  await logAudit({ action: 'update', entity_type: 'lead', entity_id: leadId, details: { coordonnees: true } })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

/** Échanges notés et réceptions du lead (chaque fois qu'il a rempli un formulaire). */
export async function historiqueLeadAction(leadId: string): Promise<ActionResult<{
  echanges: { id: string; type: string; subject: string | null; content: string | null; date: string; auteur: string | null }[]
  receptions: { id: string; canal: string; recu_le: string; statut: string; evenement: string | null; reponses: { question: string; reponse: string }[]; attribution: Record<string, unknown> | null }[]
}>> {
  const session = await getSession()
  if (!checkDashboardAccess('/dashboard/leads', session.user.role as any, session.permissions).allowed) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()
  const lead = await leadDeLOrganisme(supabase, session, leadId)
  if (!lead) return { success: false, error: 'Lead introuvable' }

  const [{ data: echanges }, receptionsRes] = await Promise.all([
    supabase.from('lead_interactions')
      .select('id, type, subject, content, date, user:users(first_name, last_name)')
      .eq('lead_id', leadId).eq('organization_id', session.organization.id)
      .order('date', { ascending: false }).limit(200),
    // Journal des réceptions : absent avant la migration 167
    supabase.from('prospects_recus')
      .select('id, canal, recu_le, statut, donnees')
      .eq('lead_id', leadId).eq('organization_id', session.organization.id)
      .order('recu_le', { ascending: false }).limit(50),
  ])
  return {
    success: true,
    data: {
      echanges: ((echanges || []) as any[]).map((e) => ({
        id: e.id, type: e.type, subject: e.subject || null, content: e.content || null, date: e.date,
        auteur: e.user ? [e.user.first_name, e.user.last_name].filter(Boolean).join(' ') || null : null,
      })),
      receptions: (((receptionsRes as any).error ? [] : (receptionsRes as any).data) || []).map((r: any) => ({
        id: r.id, canal: r.canal, recu_le: r.recu_le, statut: r.statut,
        evenement: r.donnees?.evenement || null,
        reponses: Array.isArray(r.donnees?.reponses) ? r.donnees.reponses : [],
        attribution: r.donnees?.attribution || null,
      })),
    },
  }
}

/**
 * Supprime un lead : responsables qui ont le droit de suppression du module.
 * Le journal des réceptions perd les coordonnées et les réponses, et garde la
 * trace qui empêche le relevé Meta de réimporter la personne.
 */
export async function supprimerLeadAction(leadId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!peutSuivreLeads(session, 'delete') || !estResponsableLeads(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const lead = await leadDeLOrganisme(supabase, session, leadId)
  if (!lead) return { success: false, error: 'Lead introuvable' }
  await purgerTracesLead(supabase, session.organization.id, leadId)
  const { error } = await supabase.from('leads').delete().eq('id', leadId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'La suppression a échoué' }
  await logAudit({ action: 'delete', entity_type: 'lead', entity_id: leadId, details: { entreprise: lead.entreprise || null, source: lead.source } })
  revalidatePath('/dashboard/leads')
  return { success: true }
}
