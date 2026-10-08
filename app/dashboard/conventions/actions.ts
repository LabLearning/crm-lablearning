'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createConventionSchema } from '@/lib/validations/dossier'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import type { ActionResult, Permission } from '@/lib/types'

/**
 * Changer le statut d'une convention ou la supprimer : mêmes droits que la
 * page Conventions, selon les permissions de l'organisme. Sans ce contrôle,
 * tout compte connecté (formateur, franchise, apporteur) pouvait appeler ces
 * deux actions.
 */
function accesConventions(session: { user: { role: string }; permissions: Permission[] }): boolean {
  return checkDashboardAccess('/dashboard/conventions', session.user.role as any, session.permissions).allowed
}

/**
 * Une convention « porte une signature électronique » dès que l'image de la
 * signature du client est enregistrée : c'est aussi la condition du certificat
 * de signature. L'image n'est jamais chargée pour le savoir, seulement comptée.
 * Renvoie null si la vérification n'a pas pu se faire.
 */
async function porteSignatureElectronique(supabase: any, conventionId: string, organizationId: string): Promise<boolean | null> {
  const { count, error } = await supabase
    .from('conventions')
    .select('id', { count: 'exact', head: true })
    .eq('id', conventionId)
    .eq('organization_id', organizationId)
    .not('signature_client_signature_data', 'is', null)
  if (error) return null
  return (count || 0) > 0
}

/**
 * On ne revient sur une signature que par « Annuler la signature », seule voie
 * qui en laisse la trace. Elle n'agit que sur un statut signé ; ailleurs (une
 * convention annulée qui garde une image, par exemple) il n'y a rien à
 * proposer : la convention est à vérifier.
 */
const annulationProposee = (status: unknown) => ['signee_client', 'signee_complete'].includes(String(status))
const MENU_ANNULER = '« Annuler la signature », dans le menu de la convention (liste des conventions)'
const STATUT_SANS_SIGNATURE = 'Son statut n’indique pas cette signature : la convention est à vérifier avant toute modification.'

const VERIFICATION_IMPOSSIBLE = 'Vérification de la signature impossible : réessayez dans un instant'
const CONVENTION_MODIFIEE = 'La convention vient d’être signée ou modifiée : rechargez la page'

export async function createConventionAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createConventionSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { count } = await supabase
    .from('conventions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)

  const numero = `CONV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
  const montant_ttc = parsed.data.montant_ht * (1 + parsed.data.taux_tva / 100)

  const { data, error } = await supabase
    .from('conventions')
    .insert({
      organization_id: session.organization.id,
      numero,
      type: parsed.data.type,
      client_id: parsed.data.client_id,
      formation_id: parsed.data.formation_id,
      session_id: parsed.data.session_id || null,
      devis_id: parsed.data.devis_id || null,
      dossier_id: parsed.data.dossier_id || null,
      objet: parsed.data.objet || null,
      nombre_stagiaires: parsed.data.nombre_stagiaires,
      duree_heures: parsed.data.duree_heures || null,
      lieu: parsed.data.lieu || null,
      dates_formation: parsed.data.dates_formation || null,
      montant_ht: parsed.data.montant_ht,
      taux_tva: parsed.data.taux_tva,
      montant_ttc: Math.round(montant_ttc * 100) / 100,
      financeur_type: parsed.data.financeur_type || null,
      financeur_nom: parsed.data.financeur_nom || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'convention', entity_id: data.id })
  revalidatePath('/dashboard/conventions')
  return { success: true, data }
}

/**
 * Change le statut d'une convention à la main : « Marquer envoyée », puis le
 * marquage d'une convention signée sur papier (« Signée par le client »,
 * « Signature complète »).
 *
 * Une convention qui porte une signature électronique ne passe plus par ici :
 * la repasser en « envoyée » la donnerait pour non signée, signature en place
 * et voie rouverte à une seconde ; la marquer « signée par le client »
 * réécrirait la date portée. On ne revient sur une signature que par
 * « Annuler la signature », qui en laisse la trace. Seule exception, la
 * contre-signature de l'organisme (signée par le client → signature
 * complète) : elle ajoute sa date sans toucher aux preuves du client.
 */
export async function updateConventionStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  if (!accesConventions(session)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const [{ data: conv }, signee] = await Promise.all([
    supabase
      .from('conventions')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', session.organization.id)
      .maybeSingle(),
    porteSignatureElectronique(supabase, id, session.organization.id),
  ])
  if (!conv) return { success: false, error: 'Convention introuvable' }
  if (signee === null) return { success: false, error: VERIFICATION_IMPOSSIBLE }

  const contreSignature = conv.status === 'signee_client' && status === 'signee_complete'
  if (signee && !contreSignature) {
    return {
      success: false,
      error: `Cette convention porte une signature électronique : son statut ne se change plus à la main. ${annulationProposee(conv.status)
        ? `Pour revenir sur la signature, utilisez ${MENU_ANNULER} : l’annulation est journalisée, l’exemplaire archivé et le journal de signature sont conservés.`
        : STATUT_SANS_SIGNATURE}`,
    }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'envoyee') updateData.sent_at = new Date().toISOString()
  if (status === 'signee_client') updateData.signature_client_date = new Date().toISOString()
  if (status === 'signee_complete') updateData.signature_of_date = new Date().toISOString()

  const ecriture = supabase
    .from('conventions')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  // La garde est reposée sur l'écriture elle-même : une signature arrivée
  // par le lien entre la vérification et l'écriture n'est pas écrasée
  const { data: ecrites, error } = await (signee
    ? ecriture.eq('status', 'signee_client')
    : ecriture.is('signature_client_signature_data', null)
  ).select('id')

  if (error) return { success: false, error: 'Erreur' }
  if (!ecrites?.length) return { success: false, error: CONVENTION_MODIFIEE }

  await logAudit({ action: 'update_status', entity_type: 'convention', entity_id: id, details: { status } })
  revalidatePath('/dashboard/conventions')
  return { success: true }
}

export async function updateConventionDetailsAction(
  id: string,
  details: { session_id?: string | null; financeur_type?: string | null; financeur_nom?: string | null },
): Promise<ActionResult> {
  const session = await getSession()

  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const updateData: Record<string, unknown> = {}
  if ('session_id' in details) updateData.session_id = details.session_id || null
  if ('financeur_type' in details) updateData.financeur_type = details.financeur_type || null
  if ('financeur_nom' in details) updateData.financeur_nom = details.financeur_nom || null

  const { error } = await supabase
    .from('conventions')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'convention', entity_id: id, details })
  revalidatePath(`/dashboard/conventions/${id}`)
  revalidatePath('/dashboard/conventions')
  return { success: true }
}

/**
 * Supprime une convention. La base supprime avec elle ses avenants et son
 * journal de signature (clés en cascade) : une convention qui porte une
 * signature électronique ne se supprime donc pas, il faut d'abord annuler la
 * signature, ce qui en garde la trace.
 */
export async function deleteConventionAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!accesConventions(session)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const [{ data: conv }, signee] = await Promise.all([
    supabase
      .from('conventions')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', session.organization.id)
      .maybeSingle(),
    porteSignatureElectronique(supabase, id, session.organization.id),
  ])
  if (!conv) return { success: false, error: 'Convention introuvable' }
  if (signee === null) return { success: false, error: VERIFICATION_IMPOSSIBLE }
  if (signee) {
    return {
      success: false,
      error: `Cette convention porte une signature électronique : elle ne se supprime pas. ${annulationProposee(conv.status)
        ? `Annulez d’abord la signature par ${MENU_ANNULER} : l’annulation est tracée et l’exemplaire archivé conservé.`
        : STATUT_SANS_SIGNATURE}`,
    }
  }

  const { data: supprimees, error } = await supabase
    .from('conventions')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)
    // Signée par le lien entre la vérification et la suppression : rien ne part
    .is('signature_client_signature_data', null)
    .select('id')

  if (error) return { success: false, error: 'Erreur' }
  if (!supprimees?.length) return { success: false, error: CONVENTION_MODIFIEE }

  await logAudit({ action: 'delete', entity_type: 'convention', entity_id: id })
  revalidatePath('/dashboard/conventions')
  return { success: true }
}

/**
 * Modifie le prix, la durée ou la prise en charge d'une convention.
 *
 * Tant qu'elle est en brouillon, la modification est directe. Dès qu'elle a
 * été envoyée ou signée, la convention est mise à jour et un avenant numéroté
 * en garde la trace : le PDF régénéré porte la nouvelle valeur et mentionne
 * l'avenant, sans nouvelle signature à demander.
 */
export async function updateConventionContenuAction(
  id: string,
  contenu: { montant_ht?: number | null; duree_heures?: number | null; numero_prise_en_charge?: string | null },
): Promise<ActionResult<{ avenant: number | null }>> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select('id, status, montant_ht, taux_tva, duree_heures, numero_prise_en_charge')
    .eq('id', id).eq('organization_id', session.organization.id).maybeSingle()
  if (!conv) return { success: false, error: 'Convention introuvable' }

  const { STATUTS_CONTRACTUELS, corrigerPrixConvention, enregistrerAvenantModification } = await import('@/lib/convention-avenants')
  const changements: { champ: string; libelle: string; avant: string | number | null; apres: string | number | null }[] = []
  if ('duree_heures' in contenu && Number(contenu.duree_heures ?? 0) !== Number(conv.duree_heures ?? 0)) {
    changements.push({ champ: 'duree_heures', libelle: 'Durée (h)', avant: conv.duree_heures ?? null, apres: contenu.duree_heures ?? null })
  }
  if ('numero_prise_en_charge' in contenu && (contenu.numero_prise_en_charge || '') !== (conv.numero_prise_en_charge || '')) {
    changements.push({ champ: 'numero_prise_en_charge', libelle: 'Numéro de prise en charge', avant: conv.numero_prise_en_charge || null, apres: contenu.numero_prise_en_charge || null })
  }
  const montantChange = 'montant_ht' in contenu && contenu.montant_ht != null && Number(contenu.montant_ht) !== Number(conv.montant_ht)
  if (!montantChange && changements.length === 0) return { success: true, data: { avenant: null } }

  if (STATUTS_CONTRACTUELS.includes(conv.status)) {
    // Le prix se corrige sans avenant ni mention ; la durée et la prise en charge gardent leur avenant
    if (montantChange) {
      const c = await corrigerPrixConvention(supabase, id, Number(contenu.montant_ht), session.user.id)
      if (!c) return { success: false, error: 'Le prix n’a pas pu être corrigé' }
      await logAudit({ action: 'corriger_prix_convention', entity_type: 'convention', entity_id: id, details: { numero: c.numero, avant: c.avant, apres: c.apres } })
    }
    let numeroAvenant: number | null = null
    if (changements.length) {
      const r = await enregistrerAvenantModification(supabase, id, { changements }, session.user.id)
      if (!r) return { success: false, error: "L'avenant n'a pas pu être créé" }
      numeroAvenant = r.numero
      await logAudit({ action: 'avenant_convention', entity_type: 'convention', entity_id: id, details: { numero: r.numero, changements } })
    }
    revalidatePath(`/dashboard/conventions/${id}`)
    revalidatePath('/dashboard/conventions')
    return { success: true, data: { avenant: numeroAvenant } }
  }

  const patch: Record<string, unknown> = {}
  if (montantChange) {
    const tva = Number(conv.taux_tva || 0)
    patch.montant_ht = Number(contenu.montant_ht)
    patch.montant_ttc = Math.round(Number(contenu.montant_ht) * (1 + tva / 100) * 100) / 100
  }
  for (const c of changements) patch[c.champ] = c.apres
  const { error } = await supabase.from('conventions').update(patch).eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }
  await logAudit({ action: 'update', entity_type: 'convention', entity_id: id, details: contenu })
  revalidatePath(`/dashboard/conventions/${id}`)
  revalidatePath('/dashboard/conventions')
  return { success: true, data: { avenant: null } }
}

/**
 * La session est passée sur un autre programme : la convention le reprend
 * (formation, intitulé, durée, donc annexe). Geste volontaire, nécessaire dès
 * que le client a signé ; le changement est tracé dans les notes internes de
 * la convention et au journal, sans avenant.
 */
export async function reprendreFormationSessionAction(conventionId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { reprendreFormationSession, estSigneeParLeClient } = await import('@/lib/convention-formation')
  const e = await reprendreFormationSession(supabase, conventionId, session.organization.id)
  if (!e) return { success: false, error: 'Cette convention porte déjà le programme de sa session' }

  await logAudit({
    action: 'reprendre_formation_session', entity_type: 'convention', entity_id: conventionId,
    details: { numero: e.numero, session: e.sessionReference, avant: e.avant?.intitule ?? null, duree_avant: e.avant?.dureeHeures ?? null, apres: e.apres.intitule, duree_apres: e.apres.dureeHeures, signee: estSigneeParLeClient(e.status) },
  })
  revalidatePath('/dashboard/conventions')
  revalidatePath(`/dashboard/conventions/${conventionId}`)
  return { success: true }
}

/**
 * La convention ne porte plus le prix de sa session (prix modifié sur la
 * session avant que la convention ne suive d'elle-même) : elle le reprend.
 * Un prix modifié est une correction : ni avenant ni mention, trace interne.
 */
export async function reprendrePrixSessionAction(conventionId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions').select('id, status, session_id')
    .eq('id', conventionId).eq('organization_id', session.organization.id).maybeSingle()
  if (!conv?.session_id) return { success: false, error: 'Cette convention n’est liée à aucune session' }
  if (conv.status === 'annulee') return { success: false, error: 'Cette convention est annulée' }
  const { data: sess } = await supabase
    .from('sessions').select('prix_ht')
    .eq('id', conv.session_id).eq('organization_id', session.organization.id).maybeSingle()
  if (sess?.prix_ht == null) return { success: false, error: 'La session n’a pas de prix' }

  const { corrigerPrixConvention } = await import('@/lib/convention-avenants')
  const c = await corrigerPrixConvention(supabase, conventionId, Number(sess.prix_ht), session.user.id)
  if (!c) return { success: false, error: 'Cette convention porte déjà le prix de sa session' }

  await logAudit({ action: 'corriger_prix_convention', entity_type: 'convention', entity_id: conventionId, details: { numero: c.numero, avant: c.avant, apres: c.apres, origine: 'fiche' } })
  revalidatePath('/dashboard/conventions')
  revalidatePath(`/dashboard/conventions/${conventionId}`)
  return { success: true }
}

/**
 * Retire un avenant créé pour corriger une erreur : le prix signé était faux,
 * ou la liste des participants ne correspondait pas aux stagiaires réellement
 * formés, et le client connaît la bonne valeur. La convention garde la valeur
 * corrigée et n'en fait plus mention.
 *
 * C'est un geste du gestionnaire, avenant par avenant, jamais automatique. La
 * correction reste tracée : notes internes de la convention, journal
 * d'activité, et certificat de signature, qui continue de lister ce qui a
 * changé après la signature. L'exemplaire signé archivé n'est pas touché.
 *
 * Seul le dernier avenant se retire, pour que la numérotation reste continue.
 * Un avenant de durée ou de prise en charge ne se retire pas ainsi.
 */
export async function retirerAvenantCorrectionAction(avenantId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: avenant } = await supabase
    .from('convention_avenants').select('id, convention_id, numero, motif, montant_avant, montant_apres, nombre_avant, nombre_apres, changements, created_at')
    .eq('id', avenantId).eq('organization_id', session.organization.id).maybeSingle()
  if (!avenant) return { success: false, error: 'Avenant introuvable' }
  const dePrix = avenant.montant_apres != null
  // Avenant de participants : ni prix, ni autre changement (durée, prise en charge)
  const deParticipants = !dePrix && avenant.nombre_avant != null && avenant.nombre_apres != null
    && !(Array.isArray(avenant.changements) && avenant.changements.length)
  if (!dePrix && !deParticipants) {
    return { success: false, error: 'Seul un avenant de prix ou de participants se retire comme correction d’erreur' }
  }

  const { data: suivants } = await supabase
    .from('convention_avenants').select('id').eq('convention_id', avenant.convention_id).gt('numero', avenant.numero).limit(1)
  if (suivants?.length) return { success: false, error: 'Un avenant plus récent existe : retirez d’abord celui-là' }

  const { data: conv } = await supabase
    .from('conventions').select('id, numero, notes_internes')
    .eq('id', avenant.convention_id).eq('organization_id', session.organization.id).maybeSingle()
  if (!conv) return { success: false, error: 'Convention introuvable' }

  const { error } = await supabase.from('convention_avenants').delete().eq('id', avenantId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors du retrait de l’avenant' }

  const euros = (n: unknown) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0\u2009]/g, ' ')} €`
  const jour = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
  const note = dePrix
    ? `[${jour}] Prix corrigé de ${euros(avenant.montant_avant)} à ${euros(avenant.montant_apres)} : erreur de saisie connue du client. L’avenant n°${avenant.numero} est retiré, la convention n’en fait plus mention.`
    : `[${jour}] Liste des participants corrigée de ${avenant.nombre_avant} à ${avenant.nombre_apres} stagiaire${Number(avenant.nombre_apres) > 1 ? 's' : ''} (${avenant.motif || 'modification'}) : erreur connue du client. L’avenant n°${avenant.numero} est retiré, la convention n’en fait plus mention.`
  await supabase.from('conventions')
    .update({ notes_internes: [conv.notes_internes, note].filter(Boolean).join('\n') })
    .eq('id', conv.id).eq('organization_id', session.organization.id)

  await logAudit({
    action: 'retirer_avenant_correction', entity_type: 'convention', entity_id: conv.id,
    details: {
      numero: conv.numero, avenant: avenant.numero, nature: dePrix ? 'prix' : 'participants', motif: avenant.motif,
      montant_avant: avenant.montant_avant, montant_apres: avenant.montant_apres,
      nombre_avant: avenant.nombre_avant, nombre_apres: avenant.nombre_apres, avenant_cree_le: avenant.created_at,
    },
  })
  revalidatePath('/dashboard/conventions')
  revalidatePath(`/dashboard/conventions/${conv.id}`)
  return { success: true }
}
