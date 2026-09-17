'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createClientSchema } from '@/lib/validations/crm'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createClientAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()

  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return {
      success: false,
      errors: fieldErrors,
      error: formErrors.length > 0 ? formErrors[0] : undefined,
    }
  }

  const supabase = await createServiceRoleClient()

  // Anti-doublon SIRET (cross-entité : clients + leads)
  {
    const { normalizeSiret, findSiretOwner, siretDuplicateMessage } = await import('@/lib/siret')
    const owner = await findSiretOwner(supabase, session.organization.id, normalizeSiret(parsed.data.siret))
    if (owner) return { success: false, errors: { siret: [siretDuplicateMessage(owner)] }, error: siretDuplicateMessage(owner) }
  }

  const insertData = {
    organization_id: session.organization.id,
    type: parsed.data.type,
    raison_sociale: parsed.data.raison_sociale || null,
    siret: parsed.data.siret || null,
    code_naf: parsed.data.code_naf || null,
    secteur_activite: parsed.data.secteur_activite || null,
    branche: parsed.data.branche || null,
    franchise_id: parsed.data.franchise_id || null,
    apporteur_id: parsed.data.apporteur_id || null,
    taille_entreprise: parsed.data.taille_entreprise || null,
    civilite: parsed.data.civilite || null,
    nom: parsed.data.nom || null,
    prenom: parsed.data.prenom || null,
    adresse: parsed.data.adresse || null,
    code_postal: parsed.data.code_postal || null,
    ville: parsed.data.ville || null,
    telephone: parsed.data.telephone || null,
    whatsapp: parsed.data.whatsapp || null,
    whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
    email: parsed.data.email || null,
    site_web: parsed.data.site_web || null,
    financeur_type: parsed.data.financeur_type || null,
    numero_opco: parsed.data.numero_opco || null,
    opco_id: parsed.data.opco_id || null,
    opco_compte_status: parsed.data.opco_compte_status || 'aucun',
    code_idcc: parsed.data.code_idcc || null,
    convention_collective: parsed.data.convention_collective || null,
    sigle: parsed.data.sigle || null,
    nom_commercial: parsed.data.nom_commercial || null,
    forme_juridique: parsed.data.forme_juridique || null,
    date_creation_entreprise: parsed.data.date_creation_entreprise || null,
    effectif_libelle: parsed.data.effectif_libelle || null,
    tva_intra: parsed.data.tva_intra || null,
    est_qualiopi: parsed.data.est_qualiopi === true,
    est_organisme_formation: parsed.data.est_organisme_formation === true,
    notes: parsed.data.notes || null,
    assigned_to: parsed.data.assigned_to || session.user.id,
    created_by: session.user.id,
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[Create Client]', error)
    return { success: false, error: 'Erreur lors de la création du client' }
  }

  // Si on a un dirigeant pré-rempli depuis l'autocomplete data.gouv,
  // créer automatiquement un contact principal lié à ce client
  if (parsed.data.dirigeant_nom && parsed.data.dirigeant_prenom) {
    await supabase.from('contacts').insert({
      organization_id: session.organization.id,
      client_id: data.id,
      prenom: parsed.data.dirigeant_prenom,
      nom: parsed.data.dirigeant_nom,
      poste: parsed.data.dirigeant_qualite || null,
      est_principal: true,
      created_by: session.user.id,
    })
  }

  await logAudit({ action: 'create', entity_type: 'client', entity_id: data.id })
  revalidatePath('/dashboard/clients')
  return { success: true, data }
}

export async function updateClientAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }
  // Les SIRET hérités (Dendreo, saisies anciennes) contiennent parfois des
  // espaces : on les normalise AVANT validation pour ne pas bloquer
  // l'enregistrement d'une fiche qu'on n'a même pas touchée.
  if (typeof raw.siret === 'string') raw.siret = raw.siret.replace(/\s/g, '')

  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return { success: false, errors: fieldErrors, error: formErrors[0] }
  }

  // Anti-doublon SIRET (cross-entité : clients + leads), en excluant ce client.
  // Vérifié UNIQUEMENT si le SIRET change : une fiche dont le doublon existe
  // déjà en base doit rester modifiable (le doublon se règle par fusion).
  {
    const { normalizeSiret, findSiretOwner, siretDuplicateMessage } = await import('@/lib/siret')
    const { data: actuel } = await supabase.from('clients').select('siret').eq('id', id).eq('organization_id', session.organization.id).single()
    const nouveau = normalizeSiret(parsed.data.siret)
    if (nouveau && nouveau !== normalizeSiret(actuel?.siret)) {
      const owner = await findSiretOwner(supabase, session.organization.id, nouveau, { clientId: id })
      if (owner) return { success: false, errors: { siret: [siretDuplicateMessage(owner)] }, error: siretDuplicateMessage(owner) }
    }
  }

  const updateData = {
    type: parsed.data.type,
    raison_sociale: parsed.data.raison_sociale || null,
    siret: parsed.data.siret || null,
    code_naf: parsed.data.code_naf || null,
    secteur_activite: parsed.data.secteur_activite || null,
    branche: parsed.data.branche || null,
    franchise_id: parsed.data.franchise_id || null,
    apporteur_id: parsed.data.apporteur_id || null,
    taille_entreprise: parsed.data.taille_entreprise || null,
    civilite: parsed.data.civilite || null,
    nom: parsed.data.nom || null,
    prenom: parsed.data.prenom || null,
    adresse: parsed.data.adresse || null,
    code_postal: parsed.data.code_postal || null,
    ville: parsed.data.ville || null,
    telephone: parsed.data.telephone || null,
    whatsapp: parsed.data.whatsapp || null,
    whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
    email: parsed.data.email || null,
    site_web: parsed.data.site_web || null,
    financeur_type: parsed.data.financeur_type || null,
    numero_opco: parsed.data.numero_opco || null,
    opco_id: parsed.data.opco_id || null,
    opco_compte_status: parsed.data.opco_compte_status || 'aucun',
    code_idcc: parsed.data.code_idcc || null,
    convention_collective: parsed.data.convention_collective || null,
    sigle: parsed.data.sigle || null,
    nom_commercial: parsed.data.nom_commercial || null,
    forme_juridique: parsed.data.forme_juridique || null,
    date_creation_entreprise: parsed.data.date_creation_entreprise || null,
    effectif_libelle: parsed.data.effectif_libelle || null,
    tva_intra: parsed.data.tva_intra || null,
    est_qualiopi: parsed.data.est_qualiopi === true,
    est_organisme_formation: parsed.data.est_organisme_formation === true,
    notes: parsed.data.notes || null,
  } as Record<string, unknown>

  // N'écrase l'assignation que si le champ est présent dans le formulaire.
  // (Les commerciaux ne voient pas ce champ → il est absent → assignation préservée.
  //  Les managers l'envoient toujours, vide = désassigner.)
  if (parsed.data.assigned_to !== undefined) {
    updateData.assigned_to = parsed.data.assigned_to || null
  }

  // État du compte OPCO avant modification : sa date suit tout changement d'état
  const { data: avantMaj } = await supabase.from('clients').select('opco_compte_status')
    .eq('id', id).eq('organization_id', session.organization.id).maybeSingle()

  const { error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: `Erreur lors de la mise à jour : ${error.message}` }
  }

  if (avantMaj && (avantMaj as any).opco_compte_status !== updateData.opco_compte_status) {
    // Colonne de la migration 154 : son absence ne doit pas faire échouer la fiche
    await supabase.from('clients').update({ opco_compte_date: new Date().toISOString().slice(0, 10) })
      .eq('id', id).eq('organization_id', session.organization.id)
  }

  await logAudit({ action: 'update', entity_type: 'client', entity_id: id })
  revalidatePath('/dashboard/clients')
  return { success: true }
}

export async function updateClientNotesAction(id: string, notes: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('clients')
    .update({ notes: notes || null })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors de l\'enregistrement' }
  }

  await logAudit({ action: 'update', entity_type: 'client', entity_id: id })
  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${id}`)
  return { success: true }
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Impossible de supprimer ce client (données liées existantes)' }
  }

  await logAudit({ action: 'delete', entity_type: 'client', entity_id: id })
  revalidatePath('/dashboard/clients')
  return { success: true }
}

// ── Compte OPCO chiffré (coffre-fort par mot de passe) ──
const OPCO_ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial']

const STATUTS_COMPTE_OPCO = ['aucun', 'courrier_envoye', 'en_attente_validation', 'actif', 'inactif']

/**
 * État du compte OPCO du client, sa date et l'identifiant de connexion.
 *
 * La date suit l'état : quand on passe le compte à « actif », c'est le jour
 * de création du compte ; on la laisse modifiable pour une saisie a posteriori.
 */
export async function setClientCompteOpcoAction(
  clientId: string,
  compte: { status: string; date?: string | null; identifiant?: string | null },
): Promise<ActionResult> {
  const session = await getSession()
  if (!OPCO_ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!STATUTS_COMPTE_OPCO.includes(compte.status)) return { success: false, error: 'État inconnu' }
  const supabase = await createServiceRoleClient()

  const { data: avant } = await supabase.from('clients')
    .select('opco_compte_status').eq('id', clientId).eq('organization_id', session.organization.id).maybeSingle()
  if (!avant) return { success: false, error: 'Client introuvable' }

  const changeEtat = (avant as any).opco_compte_status !== compte.status
  const patch: Record<string, unknown> = {
    opco_compte_status: compte.status,
    opco_compte_identifiant: (compte.identifiant || '').trim() || null,
    // Date fournie, sinon aujourd'hui si l'état change, sinon inchangée
    ...(compte.date ? { opco_compte_date: compte.date } : changeEtat ? { opco_compte_date: new Date().toISOString().slice(0, 10) } : {}),
  }
  const { error } = await supabase.from('clients').update(patch)
    .eq('id', clientId).eq('organization_id', session.organization.id)
  let partiel = false
  if (error) {
    const code = String((error as any).code)
    if (code !== '42703' && code !== 'PGRST204') return { success: false, error: 'Enregistrement impossible' }
    // Migration 154 non appliquée : l'état (colonne de 2025) s'enregistre quand même
    const { error: e2 } = await supabase.from('clients').update({ opco_compte_status: compte.status })
      .eq('id', clientId).eq('organization_id', session.organization.id)
    if (e2) return { success: false, error: 'Enregistrement impossible' }
    partiel = true
  }
  await logAudit({ action: 'update', entity_type: 'client', entity_id: clientId, details: { compte_opco: partiel ? { opco_compte_status: compte.status } : patch } })
  revalidatePath(`/dashboard/clients/${clientId}`)
  return { success: true, data: { partiel } }
}

const COFFRE_MAX_ECHECS = 5
const COFFRE_FENETRE_MIN = 15

/**
 * Le coffre n'a que la phrase secrète pour défense : après cinq phrases
 * fausses en quinze minutes sur un même client, l'utilisateur attend. Le
 * compteur vit dans le journal d'audit, qui survit aux instances serverless.
 */
async function verrouCoffre(supabase: any, userId: string, clientId: string): Promise<string | null> {
  const depuis = new Date(Date.now() - COFFRE_FENETRE_MIN * 60_000).toISOString()
  const { count } = await supabase.from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('entity_type', 'client').eq('entity_id', clientId)
    .eq('action', 'opco_secret_echec').gte('created_at', depuis)
  if ((count || 0) >= COFFRE_MAX_ECHECS) {
    return `Trop de phrases secrètes erronées. Réessayez dans ${COFFRE_FENETRE_MIN} minutes.`
  }
  return null
}

/** Enregistre (chiffre) les identifiants du compte OPCO d'un client. */
export async function saveClientOpcoSecretAction(
  clientId: string,
  secret: { identifiant?: string; mot_de_passe?: string; url?: string; notes?: string },
  password: string,
  hint?: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!OPCO_ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!password || password.length < 8) return { success: false, error: 'Phrase secrète trop courte : huit caractères au moins' }
  const clean = {
    identifiant: (secret.identifiant || '').trim(),
    mot_de_passe: (secret.mot_de_passe || '').trim(),
    url: (secret.url || '').trim(),
    notes: (secret.notes || '').trim(),
  }
  if (!clean.identifiant && !clean.mot_de_passe && !clean.url && !clean.notes) {
    return { success: false, error: 'Renseignez au moins un champ' }
  }
  const { encryptSecret } = await import('@/lib/secret-vault')
  const blob = encryptSecret(clean, password, hint || null)

  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('clients')
    .update({ opco_compte_chiffre: blob })
    .eq('id', clientId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de l\'enregistrement' }
  await logAudit({ action: 'save_opco_secret', entity_type: 'client', entity_id: clientId })
  revalidatePath(`/dashboard/clients/${clientId}`)
  return { success: true }
}

/** Déchiffre et renvoie le compte OPCO si le mot de passe est correct. */
export async function revealClientOpcoSecretAction(
  clientId: string, password: string,
): Promise<ActionResult & { data?: any }> {
  const session = await getSession()
  if (!OPCO_ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data: c } = await supabase.from('clients')
    .select('opco_compte_chiffre').eq('id', clientId).eq('organization_id', session.organization.id).maybeSingle()
  if (!c?.opco_compte_chiffre) return { success: false, error: 'Aucun compte OPCO enregistré' }
  const verrou = await verrouCoffre(supabase, session.user.id, clientId)
  if (verrou) return { success: false, error: verrou }
  const { decryptSecret } = await import('@/lib/secret-vault')
  const plain = decryptSecret(c.opco_compte_chiffre as any, password)
  if (!plain) {
    await logAudit({ action: 'opco_secret_echec', entity_type: 'client', entity_id: clientId, details: { operation: 'afficher' } })
    return { success: false, error: 'Phrase secrète incorrecte' }
  }
  await logAudit({ action: 'reveal_opco_secret', entity_type: 'client', entity_id: clientId })
  return { success: true, data: plain }
}

/** Supprime le compte OPCO chiffré (mot de passe requis pour prouver l'accès). */
export async function deleteClientOpcoSecretAction(clientId: string, password: string): Promise<ActionResult> {
  const session = await getSession()
  if (!OPCO_ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data: c } = await supabase.from('clients')
    .select('opco_compte_chiffre').eq('id', clientId).eq('organization_id', session.organization.id).maybeSingle()
  if (!c?.opco_compte_chiffre) return { success: false, error: 'Aucun compte OPCO' }
  const verrou = await verrouCoffre(supabase, session.user.id, clientId)
  if (verrou) return { success: false, error: verrou }
  const { decryptSecret } = await import('@/lib/secret-vault')
  if (!decryptSecret(c.opco_compte_chiffre as any, password)) {
    await logAudit({ action: 'opco_secret_echec', entity_type: 'client', entity_id: clientId, details: { operation: 'supprimer' } })
    return { success: false, error: 'Phrase secrète incorrecte' }
  }
  const { error } = await supabase.from('clients')
    .update({ opco_compte_chiffre: null }).eq('id', clientId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  await logAudit({ action: 'delete_opco_secret', entity_type: 'client', entity_id: clientId })
  revalidatePath(`/dashboard/clients/${clientId}`)
  return { success: true }
}
