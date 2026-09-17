'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { CONDITIONS_PAIEMENT_DEFAUT, DELAI_PAIEMENT_JOURS } from '@/lib/facturation'
import type { ActionResult } from '@/lib/types'

const ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial']

/** Marqueur qui rend la génération idempotente et retrouvable. */
const marqueur = (sessionId: string) => `[SESSION-FACT:${sessionId}]`

/**
 * Génère la facture d'une session, sur le modèle des factures Dendreo : une
 * facture par session, une ligne unique « Formation ». Avec un OPCO, elle lui
 * est adressée « pour le compte de » l'entreprise, par subrogation. Sans OPCO,
 * elle est adressée directement à l'entreprise, qui règle l'organisme.
 *
 * Refuse si la session a déjà été facturée ailleurs (montant repris de
 * Dendreo) : c'est le cas de 158 sessions 2026, qu'il ne faut pas refacturer.
 */
export async function genererFactureOpcoAction(
  sessionId: string,
  options?: { montantHt?: number; forcer?: boolean; sansAffacturage?: boolean },
): Promise<ActionResult> {
  const session = await getSession()
  if (!ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: s } = await supabase
    .from('sessions')
    .select(`
      id, reference, intitule, type_session, date_debut, date_fin, lieu, adresse, code_postal, ville,
      prix_ht, opco_id, numero_dossier_opco, montant_finance_opco, deja_facture_ailleurs,
      formation:formation_id(intitule, duree_heures),
      client:client_id(id, raison_sociale, opco_id, adresse, code_postal, ville, siret)
    `)
    .eq('id', sessionId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!s) return { success: false, error: 'Session introuvable' }

  // Déjà facturée : dans Dendreo, ou déjà ici.
  const dejaAilleurs = Number((s as any).deja_facture_ailleurs || 0)
  if (dejaAilleurs > 0 && !options?.forcer) {
    return {
      success: false,
      error: `Cette session a déjà été facturée pour ${dejaAilleurs.toLocaleString('fr-FR')} € (reprise de Dendreo). Générer une facture ici ferait double emploi.`,
    }
  }

  const { data: existante } = await supabase
    .from('factures')
    .select('id, numero, status')
    .eq('organization_id', orgId)
    .ilike('notes_internes', `%${marqueur(sessionId)}%`)
    .maybeSingle()
  if (existante) {
    return { success: false, error: `La facture ${(existante as any).numero} existe déjà pour cette session.` }
  }

  // Sans OPCO, la facture part à l'entreprise elle-même
  const opcoId = (s as any).opco_id || (s as any).client?.opco_id || null
  const directe = !opcoId
  if (directe && !(s as any).client?.id) {
    return { success: false, error: "Aucun client rattaché à la session : impossible de savoir à qui adresser la facture." }
  }

  const montantHt = Number(
    options?.montantHt ?? (s as any).montant_finance_opco ?? (s as any).prix_ht ?? 0,
  )
  if (!(montantHt > 0)) {
    return { success: false, error: 'Montant à facturer inconnu : renseignez le prix de la session.' }
  }

  const today = new Date().toISOString().slice(0, 10)
  const echeance = new Date()
  echeance.setDate(echeance.getDate() + DELAI_PAIEMENT_JOURS)

  const intitule = (s as any).formation?.intitule || (s as any).intitule || 'Formation'

  const { data: facture, error } = await supabase
    .from('factures')
    .insert({
      organization_id: orgId,
      type: 'facture',
      client_id: (s as any).client?.id || null,
      session_id: sessionId,
      objet: `Formation « ${intitule} »`,
      status: 'brouillon',
      date_emission: today,
      date_echeance: echeance.toISOString().slice(0, 10),
      taux_tva: 0,
      financeur_type: directe ? null : 'opco',
      numero_prise_en_charge: directe ? null : ((s as any).numero_dossier_opco || null),
      subrogation: !directe,
      conditions_paiement: CONDITIONS_PAIEMENT_DEFAUT,
      montant_ht: montantHt,
      montant_tva: 0,
      montant_ttc: montantHt,
      montant_restant: montantHt,
      notes_internes: `${directe ? 'Facture directe' : 'Facture OPCO'} de la session ${(s as any).reference || ''}. ${marqueur(sessionId)}`,
      created_by: session.user.id,
      // Réglée à l'organisme : le PDF ne porte ni cession ni IBAN du factor
      ...(options?.sansAffacturage ? { sans_affacturage: true } : {}),
    })
    .select('id, numero')
    .single()

  if (error || !facture) {
    console.error('[facture opco]', error)
    if ((error as any)?.code === '42703' || (error as any)?.code === 'PGRST204') {
      return {
        success: false,
        error: options?.sansAffacturage
          ? 'Colonne absente : appliquer la migration 153_facture_sans_affacturage.sql'
          : 'Colonnes absentes : appliquer la migration 122_facturation_opco.sql',
      }
    }
    return { success: false, error: 'Création de la facture impossible' }
  }

  // Ligne unique « Formation », comme sur les factures OPCO existantes.
  await supabase.from('facture_lignes').insert({
    facture_id: facture.id,
    designation: 'Formation',
    quantite: 1,
    unite: 'forfait',
    prix_unitaire_ht: montantHt,
    montant_ht: montantHt,
    position: 0,
  })

  await logAudit({ action: 'create', entity_type: 'facture', entity_id: facture.id, details: { session: sessionId, opco: opcoId, directe, sans_affacturage: !!options?.sansAffacturage } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  revalidatePath('/dashboard/factures')
  return { success: true, data: facture }
}

/**
 * Sort une facture de l'affacturage, ou l'y remet : le PDF change de bloc de
 * règlement (IBAN de l'organisme ou cession au factor). Impossible dès que
 * la créance a été cédée, le factor attend alors le paiement.
 */
export async function basculerAffacturageFactureAction(
  factureId: string,
  sansAffacturage: boolean,
): Promise<ActionResult> {
  const session = await getSession()
  if (!ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: f } = await supabase
    .from('factures')
    .select('id, numero, session_id, affacturage_status')
    .eq('id', factureId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!f) return { success: false, error: 'Facture introuvable' }
  if ((f as any).affacturage_status) {
    return { success: false, error: `La facture ${(f as any).numero} a déjà été cédée au factor : elle ne peut plus en sortir.` }
  }

  const { error } = await supabase
    .from('factures')
    .update({ sans_affacturage: sansAffacturage, updated_at: new Date().toISOString() })
    .eq('id', factureId)
    .eq('organization_id', orgId)
  if (error) {
    console.error('[facture affacturage]', error)
    if ((error as any)?.code === '42703' || (error as any)?.code === 'PGRST204') {
      return { success: false, error: 'Colonne absente : appliquer la migration 153_facture_sans_affacturage.sql' }
    }
    return { success: false, error: 'Modification impossible' }
  }

  await logAudit({ action: 'update', entity_type: 'facture', entity_id: factureId, details: { sans_affacturage: sansAffacturage } })
  if ((f as any).session_id) revalidatePath(`/dashboard/sessions/${(f as any).session_id}`)
  revalidatePath('/dashboard/factures')
  return { success: true }
}

/**
 * Enregistre le financement OPCO de la session : l'organisme, le numéro de
 * dossier et le montant accordé. Ces trois informations sont reprises telles
 * quelles sur la facture — le numéro de dossier devient le numéro de prise en
 * charge, que l'OPCO exige pour régler.
 */
export async function enregistrerFinancementOpcoAction(
  sessionId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession()
  if (!ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const texte = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v || null
  }
  const montantBrut = texte('montant_finance_opco')
  const montant = montantBrut === null ? null : Number(montantBrut.replace(',', '.'))
  if (montant !== null && !Number.isFinite(montant)) {
    return { success: false, error: 'Montant financé invalide' }
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      opco_id: texte('opco_id'),
      numero_dossier_opco: texte('numero_dossier_opco'),
      montant_finance_opco: montant,
      accord_pec_date: texte('accord_pec_date'),
    })
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)

  if (error) {
    console.error('[financement opco]', error)
    if ((error as any).code === '42703') {
      return { success: false, error: 'Colonnes absentes : appliquer les migrations 122 et 126' }
    }
    return { success: false, error: 'Enregistrement impossible' }
  }

  await logAudit({ action: 'update', entity_type: 'session', entity_id: sessionId, details: { financement_opco: true } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

/**
 * Dépose l'accord de prise en charge reçu de l'OPCO.
 *
 * Le fichier arrive tel quel — PDF du portail OPCO ou pièce jointe de mail —
 * et devient le justificatif du financement au dossier de la session.
 */
export async function deposerAccordPecAction(
  sessionId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession()
  if (!ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const fichier = formData.get('fichier') as File | null
  if (!fichier || fichier.size === 0) return { success: false, error: 'Aucun fichier' }
  if (fichier.size > 15 * 1024 * 1024) return { success: false, error: 'Fichier trop lourd (15 Mo maximum)' }

  const { data: sess } = await supabase
    .from('sessions').select('id, reference, client_id, numero_dossier_opco')
    .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const contenu = Buffer.from(await fichier.arrayBuffer())

  // Lecture du numéro de dossier dans l'accord : le recopier à la main est la
  // première source d'erreur, et un numéro faux fait rejeter la facture.
  let numeroLu: string | null = null
  try {
    const { lireAccordPec } = await import('@/lib/accord-pec-parse')
    const lu = await lireAccordPec(contenu, fichier.type)
    numeroLu = lu.numero_dossier
  } catch (e) {
    console.error('[accord pec — lecture]', e)
  }

  const ext = (fichier.name.split('.').pop() || 'pdf').toLowerCase()
  const chemin = `${orgId}/sessions/${sessionId}/accord-pec-${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(chemin, contenu, {
      contentType: fichier.type || 'application/pdf',
      upsert: false,
    })
  if (upErr) {
    console.error('[accord pec]', upErr.message)
    return { success: false, error: 'Dépôt du fichier impossible' }
  }

  const { data, error } = await supabase.from('documents').insert({
    organization_id: orgId,
    nom: `Accord de prise en charge — ${(sess as any).reference || 'session'}`,
    type: 'accord_prise_en_charge',
    session_id: sessionId,
    client_id: (sess as any).client_id || null,
    storage_path: chemin,
    file_name: fichier.name,
    file_size: fichier.size,
    mime_type: fichier.type || null,
    origine: String(formData.get('origine') || 'mail'),
    date_piece: String(formData.get('date_piece') || '') || null,
    created_by: session.user.id,
  }).select('id').single()

  if (error) {
    // Le fichier est déjà déposé : on le retire pour ne pas laisser d'orphelin.
    await supabase.storage.from('documents').remove([chemin])
    console.error('[accord pec]', error)
    if ((error as any).code === '22P02') {
      return { success: false, error: "Type absent : appliquer la migration 126_accord_prise_en_charge.sql" }
    }
    return { success: false, error: 'Enregistrement impossible' }
  }

  // Le numéro lu ne remplace jamais une saisie existante.
  let numeroEcrit: string | null = null
  if (numeroLu && !(sess as any).numero_dossier_opco) {
    const { error: majErr } = await supabase
      .from('sessions').update({ numero_dossier_opco: numeroLu }).eq('id', sessionId)
    if (!majErr) numeroEcrit = numeroLu
  }

  await logAudit({ action: 'create', entity_type: 'document', entity_id: data.id, details: { session: sessionId, piece: 'accord_prise_en_charge', numero_lu: numeroLu } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { ...data, numero_lu: numeroLu, numero_ecrit: numeroEcrit } }
}

/**
 * Récupère le financement OPCO depuis Dendreo, où l'accord de prise en charge
 * a déjà été saisi lors du montage du dossier.
 */
export async function recupererFinancementDendreoAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!ROLES.includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  try {
    const { importerFinancementSession } = await import('@/lib/dendreo-financements')
    const r = await importerFinancementSession(supabase, session.organization.id, sessionId)
    if (!r.trouve) return { success: false, error: r.raison || 'Aucun financement trouvé' }

    await logAudit({ action: 'update', entity_type: 'session', entity_id: sessionId, details: { financement: 'dendreo' } })
    revalidatePath(`/dashboard/sessions/${sessionId}`)
    return { success: true, data: r }
  } catch (e: any) {
    console.error('[financement dendreo]', e)
    return { success: false, error: e?.message || 'Dendreo injoignable' }
  }
}
