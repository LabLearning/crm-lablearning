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
/**
 * Trousseau de chiffrement du mot de passe OPCO, de la clé courante à la plus
 * ancienne : OPCO_SECRET_KEY, puis OPCO_SECRET_KEY_PREVIOUS (liste séparée par
 * des virgules), puis une clé dérivée de la clé de service Supabase (et de ses
 * précédentes dans SUPABASE_SERVICE_ROLE_KEY_PREVIOUS). On chiffre toujours
 * avec la première ; on déchiffre avec celle dont l'identifiant est inscrit
 * dans le blob, et un blob lu avec une vieille clé est re-chiffré aussitôt.
 * Changer de clé sans garder l'ancienne dans _PREVIOUS rendrait les mots de
 * passe illisibles : c'est la règle à respecter.
 */
type CleCoffre = { kid: string; key: string }
async function trousseauOpco(): Promise<CleCoffre[]> {
  const { createHash } = await import('crypto')
  const empreinte = (k: string) => createHash('sha256').update(k).digest('hex').slice(0, 12)
  const liste = (v?: string) => (v || '').split(',').map((x) => x.trim()).filter(Boolean)
  const cles: CleCoffre[] = []
  for (const k of [process.env.OPCO_SECRET_KEY || '', ...liste(process.env.OPCO_SECRET_KEY_PREVIOUS)].filter(Boolean)) {
    cles.push({ kid: `env:${empreinte(k)}`, key: k })
  }
  for (const k of [process.env.SUPABASE_SERVICE_ROLE_KEY || '', ...liste(process.env.SUPABASE_SERVICE_ROLE_KEY_PREVIOUS)].filter(Boolean)) {
    cles.push({ kid: `srk:${empreinte(k)}`, key: createHash('sha256').update(`opco:${k}`).digest('hex') })
  }
  if (!cles.length) throw new Error('Coffre OPCO : aucune clé de chiffrement (OPCO_SECRET_KEY)')
  return cles
}

export async function setClientCompteOpcoAction(
  clientId: string,
  compte: {
    status: string
    /** undefined : inchangée (date du jour si l'état change) ; null : effacée ; sinon enregistrée. */
    date?: string | null
    identifiant?: string | null
    /** undefined : inchangé ; chaîne vide : effacé ; blanc : ignoré ; sinon enregistré chiffré. */
    mot_de_passe?: string | null
  },
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
    // Date fournie : enregistrée ; null : effacée ; absente : aujourd'hui si l'état change, sinon inchangée
    ...(compte.date ? { opco_compte_date: compte.date }
      : compte.date === null ? { opco_compte_date: null }
      : changeEtat ? { opco_compte_date: new Date().toISOString().slice(0, 10) } : {}),
  }
  if (compte.mot_de_passe !== undefined && compte.mot_de_passe !== null) {
    // Chaîne vide : effacement demandé ; blanc seul : ignoré ; sinon chiffré tel que saisi (les espaces comptent)
    const mdp = compte.mot_de_passe
    if (mdp === '') patch.opco_compte_chiffre = null
    else if (mdp.trim()) {
      let courante: CleCoffre
      try { [courante] = await trousseauOpco() } catch { return { success: false, error: 'Coffre OPCO non configuré : contactez l\u2019administrateur' } }
      const { encryptSecret } = await import('@/lib/secret-vault')
      patch.opco_compte_chiffre = { ...encryptSecret({ mot_de_passe: mdp }, courante.key, null, courante.kid), mode: 'serveur' }
    }
  }
  const { error } = await supabase.from('clients').update(patch)
    .eq('id', clientId).eq('organization_id', session.organization.id)
  let partiel = false
  if (error) {
    const code = String((error as any).code)
    if (code !== '42703' && code !== 'PGRST204') return { success: false, error: 'Enregistrement impossible' }
    // Migration 154 non appliquée : l'état et le mot de passe (colonnes existantes) s'enregistrent quand même
    const repli: Record<string, unknown> = { opco_compte_status: compte.status }
    if ('opco_compte_chiffre' in patch) repli.opco_compte_chiffre = patch.opco_compte_chiffre
    const { error: e2 } = await supabase.from('clients').update(repli)
      .eq('id', clientId).eq('organization_id', session.organization.id)
    if (e2) return { success: false, error: 'Enregistrement impossible' }
    partiel = true
  }
  const trace: Record<string, unknown> = { ...(partiel ? { opco_compte_status: compte.status } : patch) }
  if ('opco_compte_chiffre' in trace) trace.opco_compte_chiffre = patch.opco_compte_chiffre ? 'modifié' : 'effacé'
  await logAudit({ action: 'update', entity_type: 'client', entity_id: clientId, details: { compte_opco: trace } })
  revalidatePath(`/dashboard/clients/${clientId}`)
  return { success: true, data: { partiel } }
}

/** Déchiffre le mot de passe du portail OPCO, pour l'afficher ou le copier. Chaque lecture est journalisée. */
export async function revealClientOpcoPasswordAction(clientId: string): Promise<ActionResult<{ mot_de_passe: string }>> {
  const session = await getSession()
  if (!OPCO_ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data: c } = await supabase.from('clients')
    .select('opco_compte_chiffre').eq('id', clientId).eq('organization_id', session.organization.id).maybeSingle()
  const blob: any = c?.opco_compte_chiffre
  if (!blob) return { success: false, error: 'Aucun mot de passe enregistré' }
  if (blob.mode !== 'serveur') {
    return { success: false, error: 'Mot de passe enregistré avec l\u2019ancienne phrase secrète : ressaisissez-le.' }
  }
  let trousseau: CleCoffre[]
  try { trousseau = await trousseauOpco() } catch { return { success: false, error: 'Coffre OPCO non configuré : contactez l\u2019administrateur' } }
  const { decryptSecret, encryptSecret } = await import('@/lib/secret-vault')
  // La clé désignée par le blob d'abord, puis le reste du trousseau (blobs sans identifiant)
  const candidates = [...trousseau.filter((c) => c.kid === blob.kid), ...trousseau.filter((c) => c.kid !== blob.kid)]
  let plain: { mot_de_passe: string } | null = null
  let cleUtilisee: CleCoffre | null = null
  for (const c of candidates) {
    plain = decryptSecret<{ mot_de_passe: string }>(blob, c.key)
    if (plain?.mot_de_passe) { cleUtilisee = c; break }
  }
  if (!plain?.mot_de_passe || !cleUtilisee) {
    const cleConnue = trousseau.some((c) => c.kid === blob.kid)
    return {
      success: false,
      error: cleConnue || !blob.kid
        ? 'Mot de passe illisible : ressaisissez-le.'
        : 'La clé du coffre a changé : remettez l\u2019ancienne clé dans OPCO_SECRET_KEY_PREVIOUS, puis réessayez.',
    }
  }
  // Chaque lecture laisse une trace ; sans trace, pas de lecture
  const journalise = await logAudit({ action: 'reveal_opco_secret', entity_type: 'client', entity_id: clientId })
  if (!journalise) return { success: false, error: 'Lecture non journalisée : réessayez.' }
  // Blob lu avec une ancienne clé : re-chiffré avec la courante, sans bloquer la réponse
  if (cleUtilisee.kid !== trousseau[0].kid) {
    const neuf = { ...encryptSecret({ mot_de_passe: plain.mot_de_passe }, trousseau[0].key, null, trousseau[0].kid), mode: 'serveur' }
    await supabase.from('clients').update({ opco_compte_chiffre: neuf }).eq('id', clientId).eq('organization_id', session.organization.id)
    await logAudit({ action: 'rekey_opco_secret', entity_type: 'client', entity_id: clientId, details: { de: cleUtilisee.kid, vers: trousseau[0].kid } })
  }
  return { success: true, data: { mot_de_passe: plain.mot_de_passe } }
}
