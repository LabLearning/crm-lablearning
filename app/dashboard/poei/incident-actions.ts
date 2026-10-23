'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { ROLES_INCIDENTS_POEI, TYPES_INCIDENT, GRAVITES_INCIDENT } from '@/lib/rapport-france-travail'
import { checkDashboardAccess } from '@/lib/dashboard-guard'

/** L'équipe qui traite les incidents : le rôle, et l'accès au module POEI comme pour les rapports. */
function traiteLesIncidents(session: Awaited<ReturnType<typeof getSession>>): boolean {
  return ROLES_INCIDENTS_POEI.includes(session.user.role)
    && checkDashboardAccess('/dashboard/poei', session.user.role as any, session.permissions).allowed
}

/** Date du jour à Paris (AAAA-MM-JJ) : après minuit, le serveur en temps universel dirait la veille. */
const aujourdhuiParis = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })

// Un module 'use server' ne peut exporter QUE des fonctions async : exporter
// une constante ici casse l'appel de l'action côté client (spinner infini).
// Les listes de types, de gravités et de rôles vivent dans lib/rapport-france-travail.ts.

/**
 * Résout le formateur du compte connecté, et vérifie qu'il intervient bien sur
 * ce dossier POEI. L'équipe interne n'a pas cette contrainte, mais il lui faut
 * le rôle et l'accès au module, comme pour la suite du circuit : ce module est
 * embarqué dans /mon-espace/poei, où le garde central ne joue pas.
 */
async function autoriser(supabase: any, poeiId: string, orgId: string, session: Awaited<ReturnType<typeof getSession>>) {
  if (traiteLesIncidents(session)) {
    return { formateurId: null as string | null }
  }
  const user = session.user
  if (user.role !== 'formateur') return null

  const { data: f } = await supabase.from('formateurs').select('id').eq('user_id', user.id).maybeSingle()
  if (!f) return null

  const { data: itv } = await supabase
    .from('poei_interventions')
    .select('id')
    .eq('poei_id', poeiId)
    .eq('formateur_id', f.id)
    .eq('organization_id', orgId)
    .limit(1)
  if (!itv || itv.length === 0) return null

  return { formateurId: f.id as string }
}

/** Déclare un incident sur un dossier POEI. */
export async function declarerIncidentPoeiAction(poeiId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const droit = await autoriser(supabase, poeiId, orgId, session)
  if (!droit) return { success: false, error: 'Ce dossier ne vous est pas rattaché' }

  const titre = String(formData.get('titre') || '').trim()
  if (!titre) return { success: false, error: 'Le titre est requis' }

  const { data: poei } = await supabase
    .from('poei').select('client_id, session_id').eq('id', poeiId).eq('organization_id', orgId).maybeSingle()
  if (!poei) return { success: false, error: 'Dossier introuvable' }

  // Le stagiaire concerné est un candidat du dossier, comme à la correction : le
  // rapport transmis à France Travail imprime son nom.
  const apprenantId = String(formData.get('apprenant_id') || '').trim() || null
  if (apprenantId) {
    const { data: candidat } = await supabase.from('poei_candidats').select('id')
      .eq('poei_id', poeiId).eq('organization_id', orgId).eq('apprenant_id', apprenantId).limit(1)
    if (!candidat || candidat.length === 0) return { success: false, error: 'Ce stagiaire ne fait pas partie du dossier' }
  }
  // Type et gravité pris dans les listes du rapport, sinon les valeurs par défaut
  const typeDemande = String(formData.get('type') || '')
  const graviteDemandee = String(formData.get('gravite') || '')
  const type = TYPES_INCIDENT.some((t) => t.value === typeDemande) ? typeDemande : 'autre'
  const gravite = GRAVITES_INCIDENT.some((g) => g.value === graviteDemandee) ? graviteDemandee : 'mineur'

  let franchiseId: string | null = null
  if (poei?.client_id) {
    const { data: c } = await supabase.from('clients').select('franchise_id').eq('id', poei.client_id).maybeSingle()
    franchiseId = c?.franchise_id || null
  }

  const { data, error } = await supabase.from('incidents').insert({
    organization_id: orgId,
    poei_id: poeiId,
    client_id: poei.client_id || null,
    session_id: poei.session_id || null,
    franchise_id: franchiseId,
    formateur_id: droit.formateurId,
    apprenant_id: apprenantId,
    date_incident: String(formData.get('date_incident') || '') || aujourdhuiParis(),
    type,
    gravite,
    titre,
    // Un texte fait de blancs n'est pas une description : le rapport et la relecture le tiennent pour absent
    description: String(formData.get('description') || '').trim() || null,
    mesures_prises: String(formData.get('mesures_prises') || '').trim() || null,
    statut: 'ouvert',
    auteur_id: session.user.id,
  }).select('id').single()

  if (error) {
    console.error('[incident poei]', error)
    if ((error as any).code === '42703') {
      return { success: false, error: 'Colonnes absentes : appliquer la migration 123_incidents_poei.sql' }
    }
    return { success: false, error: "Enregistrement impossible" }
  }

  await logAudit({ action: 'create', entity_type: 'incident', entity_id: data.id, details: { poei: poeiId } })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  revalidatePath('/mon-espace/poei')
  revalidatePath('/dashboard/incidents')
  return { success: true, data }
}

/**
 * Corrige un incident déjà déclaré : c'est le gestionnaire qui complète les
 * mesures prises et relit le texte avant de produire le rapport pour France
 * Travail. Le formateur, lui, déclare et ne retouche pas.
 *
 * Ce qui change est consigné au journal d'audit, avant et après : la
 * déclaration d'origine du formateur doit pouvoir être retrouvée si le rapport
 * est contesté (la table incidents n'est pas suivie par le journal d'activité).
 */
export async function modifierIncidentPoeiAction(id: string, formData: FormData): Promise<ActionResult<{ inchange?: boolean }>> {
  const session = await getSession()
  if (!traiteLesIncidents(session)) {
    return { success: false, error: 'Seule l’équipe interne peut modifier un incident' }
  }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const titre = String(formData.get('titre') || '').trim()
  if (!titre) return { success: false, error: 'Le titre est requis' }

  const { data: avant } = await supabase.from('incidents')
    .select('id, poei_id, titre, date_incident, type, gravite, apprenant_id, description, mesures_prises')
    .eq('id', id).eq('organization_id', orgId).maybeSingle()
  if (!avant || !avant.poei_id) return { success: false, error: 'Incident introuvable' }

  // Le stagiaire concerné ne change que pour un candidat du dossier : un identifiant
  // venu d'ailleurs est refusé, et celui déjà enregistré reste valable même si le
  // candidat a été retiré du projet depuis.
  const demande = String(formData.get('apprenant_id') || '').trim() || null
  if (demande && demande !== avant.apprenant_id) {
    const { data: candidat } = await supabase.from('poei_candidats').select('id')
      .eq('poei_id', avant.poei_id).eq('organization_id', orgId).eq('apprenant_id', demande).limit(1)
    if (!candidat || candidat.length === 0) return { success: false, error: 'Ce stagiaire ne fait pas partie du dossier' }
  }

  // Un formulaire envoie ses retours à la ligne avec un retour chariot : mis à plat, pour qu'un texte
  // inchangé ne passe pas pour modifié (et ne laisse pas une fausse ligne au journal).
  const texte = (v: unknown) => String(v ?? '').replace(/\r\n?/g, '\n').trim() || null
  const apres: Record<string, string | null> = {
    titre,
    // Un champ vidé garde la valeur enregistrée : corriger un texte ne redate pas l'incident
    date_incident: String(formData.get('date_incident') || '').trim() || String(avant.date_incident || '').slice(0, 10) || null,
    type: String(formData.get('type') || '').trim() || avant.type,
    gravite: String(formData.get('gravite') || '').trim() || avant.gravite,
    apprenant_id: demande,
    description: texte(formData.get('description')),
    mesures_prises: texte(formData.get('mesures_prises')),
  }
  const valeur = (champ: string, v: unknown) => (champ === 'date_incident' ? String(v ?? '').slice(0, 10) || null : texte(v))
  const champs = Object.keys(apres).filter((c) => valeur(c, (avant as any)[c]) !== valeur(c, apres[c]))
  if (champs.length === 0) return { success: true, data: { inchange: true } }

  const trace = {
    poei: avant.poei_id, champs,
    avant: Object.fromEntries(champs.map((c) => [c, (avant as any)[c] ?? null])),
    apres: Object.fromEntries(champs.map((c) => [c, apres[c]])),
  }
  const { error } = await supabase.from('incidents').update(trace.apres).eq('id', id).eq('organization_id', orgId)
  if (error) {
    console.error('[incident poei]', error)
    return { success: false, error: 'Modification impossible' }
  }

  // Sans sa ligne au journal, la déclaration d'origine serait perdue : la modification est défaite
  if (!(await logAudit({ action: 'update', entity_type: 'incident', entity_id: id, details: trace }))) {
    await supabase.from('incidents').update(trace.avant).eq('id', id).eq('organization_id', orgId)
    return { success: false, error: 'La modification n’a pas pu être consignée au journal : rien n’a été changé, réessayez' }
  }
  revalidatePath(`/dashboard/poei/${avant.poei_id}`)
  revalidatePath('/mon-espace/poei')
  revalidatePath('/dashboard/incidents')
  return { success: true }
}

/** Fait avancer un incident : ouvert → en cours → résolu → clos. */
export async function changerStatutIncidentPoeiAction(id: string, statut: string): Promise<ActionResult> {
  const session = await getSession()
  if (!traiteLesIncidents(session)) {
    return { success: false, error: 'Seule l’équipe interne peut clore un incident' }
  }
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase.from('incidents')
    .update({ statut, resolu_at: ['resolu', 'clos'].includes(statut) ? new Date().toISOString() : null })
    .eq('id', id).eq('organization_id', session.organization.id)
    .select('poei_id').single()

  if (error) return { success: false, error: 'Mise à jour impossible' }

  await logAudit({ action: 'update', entity_type: 'incident', entity_id: id, details: { statut } })
  if (data?.poei_id) revalidatePath(`/dashboard/poei/${data.poei_id}`)
  revalidatePath('/mon-espace/poei')
  return { success: true }
}
