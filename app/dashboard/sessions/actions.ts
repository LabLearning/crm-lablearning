'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createSessionSchema } from '@/lib/validations/formation'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createSessionAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createSessionSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return { success: false, errors: fieldErrors, error: formErrors[0] }
  }

  const supabase = await createServiceRoleClient()

  const { count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)

  const ref = parsed.data.reference || `SES-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const hasFormateur = !!parsed.data.formateur_id
  const horairesJours = parsed.data.horaires_jours ? safeParseJson(parsed.data.horaires_jours) : []
  const apprenantIds = (parsed.data.apprenant_ids || '').split(',').filter(Boolean)

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      organization_id: session.organization.id,
      formation_id: parsed.data.formation_id,
      type_session: parsed.data.type_session || 'inter',
      modalite: parsed.data.modalite || 'presentiel',
      client_id: parsed.data.client_id || null,
      reference: ref,
      intitule: parsed.data.intitule || null,
      date_debut: parsed.data.date_debut,
      date_fin: parsed.data.date_fin,
      horaires: parsed.data.horaires || null,
      horaires_jours: horairesJours,
      lieu: parsed.data.lieu || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      lien_visio: parsed.data.lien_visio || null,
      places_min: parsed.data.places_min,
      places_max: parsed.data.places_max,
      formateur_id: parsed.data.formateur_id || null,
      status: parsed.data.status || 'planifiee',
      cout_formateur: parsed.data.cout_formateur || null,
      cout_salle: parsed.data.cout_salle || null,
      cout_materiel: parsed.data.cout_materiel || null,
      notes_internes: parsed.data.notes_internes || null,
      notes_logistiques: parsed.data.notes_logistiques || null,
      created_by: session.user.id,
      mission_status: hasFormateur ? 'pending' : 'not_required',
      mission_proposed_at: hasFormateur ? new Date().toISOString() : null,
      mission_proposed_by: hasFormateur ? session.user.id : null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Create Session]', error)
    return { success: false, error: 'Erreur lors de la création' }
  }

  // Inscrire les apprenants sélectionnés
  if (apprenantIds.length > 0) {
    await supabase.from('inscriptions').insert(
      apprenantIds.map(aid => ({
        organization_id: session.organization.id,
        session_id: data.id,
        apprenant_id: aid,
        status: 'inscrit',
      }))
    )
  }

  // Lier les formations multiples (table de jonction session_formations)
  const formationIds = (parsed.data.formation_ids || parsed.data.formation_id || '').split(',').filter(Boolean)
  if (formationIds.length > 0) {
    await supabase.from('session_formations').insert(
      formationIds.map((fid, i) => ({ session_id: data.id, formation_id: fid, ordre: i }))
    )
  }

  if (hasFormateur && parsed.data.formateur_id) {
    await notifyFormateurOfMission(parsed.data.formateur_id, data.id, supabase, session)
  }

  await logAudit({ action: 'create', entity_type: 'session', entity_id: data.id })
  revalidatePath('/dashboard/sessions')
  return { success: true, data }
}

function safeParseJson(s: string): any[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

/** Helper : notif in-app + email "mission proposée" pour le formateur */
async function notifyFormateurOfMission(formateurId: string, sessionId: string, supabase: any, session: any) {
  const { createNotification, sendDocumentEmail } = await import('@/lib/email')
  const { data: formateur } = await supabase
    .from('formateurs').select('user_id, prenom, nom, email').eq('id', formateurId).single()
  if (!formateur) return

  const { data: sessionData } = await supabase
    .from('sessions')
    .select('reference, date_debut, date_fin, lieu, horaires, formation:formation_id(intitule)')
    .eq('id', sessionId).single()

  const intitule = sessionData?.formation?.intitule || 'Formation'
  const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  const periode = `du ${fmtFr(sessionData?.date_debut)} au ${fmtFr(sessionData?.date_fin)}`

  // Notif in-app (cloche) si le formateur a un compte
  if (formateur.user_id) {
    await createNotification({
      organizationId: session.organization.id,
      userId: formateur.user_id,
      titre: 'Nouvelle mission proposée',
      message: `Mission "${intitule}" ${periode}. Acceptez ou refusez depuis votre espace.`,
      type: 'session',
      lienUrl: `/mon-espace`,
      lienLabel: 'Voir la mission',
      entityType: 'session',
      entityId: sessionId,
    })
  }

  // Email de proposition de mission (dès qu'un email est renseigné)
  if (formateur.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
    const { data: org } = await supabase
      .from('organizations').select('name, email, email_contact, logo_url, is_qualiopi')
      .eq('id', session.organization.id).single()
    await sendDocumentEmail({
      to: formateur.email,
      orgName: org?.name || 'Lab Learning',
      orgEmail: org?.email_contact || org?.email,
      orgLogoUrl: org?.logo_url,
      qualiopiCertified: org?.is_qualiopi !== false,
      recipientName: formateur.prenom || 'Bonjour',
      subject: `Nouvelle mission proposée — ${intitule}`,
      docTitle: 'Proposition de mission',
      intro: `Une nouvelle mission de formation vous est proposée. Connectez-vous à votre espace formateur pour l'accepter ou la refuser.`,
      metadata: [
        ['Formation', intitule],
        ['Période', periode],
        ...(sessionData?.lieu ? [['Lieu', sessionData.lieu] as [string, string]] : []),
        ...(sessionData?.horaires ? [['Horaires', sessionData.horaires] as [string, string]] : []),
        ['Référence', sessionData?.reference || ''],
      ],
      ctaLabel: 'Voir la mission dans mon espace',
      ctaUrl: `${appUrl}/mon-espace`,
      footerNote: 'Merci de répondre rapidement afin que nous puissions confirmer la session.',
    })
  }
}

// ============================================================
// Workflow mission formateur : accepter / refuser
// ============================================================

export async function acceptMissionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Vérifier que le user est bien le formateur de la session
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, formateur_id, mission_status, organization_id, mission_proposed_by, formation_id, client_id, type_session, date_debut, date_fin, lieu, cout_formateur, formation:formation_id(intitule, duree_heures, duree_jours, tarif_inter_ht, tarif_intra_ht)')
    .eq('id', sessionId).single()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: formateur } = await supabase
    .from('formateurs').select('id, prenom, nom, email').eq('user_id', session.user.id).single()
  if (!formateur || formateur.id !== sess.formateur_id) {
    return { success: false, error: 'Cette mission ne vous est pas adressée' }
  }
  if (sess.mission_status !== 'pending') return { success: false, error: 'Cette mission n\'est plus en attente' }

  const { error } = await supabase
    .from('sessions')
    .update({ mission_status: 'accepted', mission_responded_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) return { success: false, error: 'Erreur lors de l\'acceptation' }

  // ── AUTO : créer une convention en brouillon pour cette session ──
  const { count: existingConv } = await supabase
    .from('conventions').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)

  if (!existingConv && sess.client_id) {
    // Compter les apprenants inscrits
    const { count: nbApprenants } = await supabase
      .from('inscriptions').select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')

    // Numéro de convention : CV-YYYY-NNN
    const { count: convCount } = await supabase
      .from('conventions').select('*', { count: 'exact', head: true })
      .eq('organization_id', sess.organization_id)
    const numero = `CV-${new Date().getFullYear()}-${String((convCount || 0) + 1).padStart(3, '0')}`

    const formation = (sess as any).formation
    const tarifBase = sess.type_session === 'intra' ? formation?.tarif_intra_ht : formation?.tarif_inter_ht
    const montantHt = tarifBase ? tarifBase * (nbApprenants || 1) : null

    await supabase.from('conventions').insert({
      organization_id: sess.organization_id,
      numero,
      type: sess.type_session === 'intra' ? 'intra_entreprise' : 'inter_entreprise',
      session_id: sessionId,
      client_id: sess.client_id,
      formation_id: sess.formation_id,
      status: 'brouillon',
      objet: `Convention de formation — ${formation?.intitule || 'Formation'}`,
      nombre_stagiaires: nbApprenants || 0,
      duree_heures: formation?.duree_heures || null,
      lieu: sess.lieu || null,
      dates_formation: `Du ${sess.date_debut} au ${sess.date_fin}`,
      montant_ht: montantHt,
      // Organisme de formation exonéré de TVA (art. 261-4-4° a du CGI)
      taux_tva: 0,
      montant_ttc: montantHt,
      created_by: sess.mission_proposed_by || session.user.id,
    })
  }

  // ── AUTO : contrat de prestation prêt à signer immédiatement ──
  let contratSignUrl: string | null = null
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
    const { data: existingContrat } = await supabase
      .from('contrats_formateur')
      .select('id, signature_token, status')
      .eq('session_id', sessionId)
      .maybeSingle()

    let contratToken = existingContrat?.signature_token
    if (!existingContrat) {
      const { count: contratCount } = await supabase
        .from('contrats_formateur')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', sess.organization_id)
      const numero = `CT-${new Date().getFullYear()}-${String((contratCount || 0) + 1).padStart(3, '0')}`

      const { data: formateurRow } = await supabase
        .from('formateurs').select('tarif_journalier').eq('id', sess.formateur_id).single()
      const tarif = formateurRow?.tarif_journalier || null
      const duree = (sess as any).formation?.duree_jours || null
      // Le montant saisi sur la session fait foi ; sinon calcul tarif journalier × jours
      const montantContrat = sess.cout_formateur != null
        ? Number(sess.cout_formateur)
        : ((tarif && duree) ? Number(tarif) * Number(duree) : null)

      const { randomBytes, createHash } = await import('crypto')
      contratToken = createHash('sha256').update(randomBytes(32)).digest('hex')
      const expires = new Date()
      expires.setDate(expires.getDate() + 30)

      await supabase.from('contrats_formateur').insert({
        organization_id: sess.organization_id,
        session_id: sessionId,
        formateur_id: sess.formateur_id,
        numero,
        status: 'envoye',
        tarif_journalier: tarif,
        nombre_jours: duree,
        montant_ht: montantContrat,
        signature_token: contratToken,
        signature_token_expires_at: expires.toISOString(),
        sent_at: new Date().toISOString(),
        created_by: sess.mission_proposed_by || session.user.id,
      })
    }
    if (contratToken && existingContrat?.status !== 'signe') {
      contratSignUrl = `${appUrl}/contrat-formateur/${contratToken}/signer`

      // Email avec le lien de signature (s'il ne signe pas immédiatement)
      if (formateur.email) {
        const { sendDocumentEmail } = await import('@/lib/email')
        const { data: org } = await supabase
          .from('organizations').select('name, email, email_contact, logo_url, is_qualiopi')
          .eq('id', sess.organization_id).single()
        const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
        await sendDocumentEmail({
          to: formateur.email,
          orgName: org?.name || 'Lab Learning',
          orgEmail: org?.email_contact || org?.email,
          orgLogoUrl: org?.logo_url,
          qualiopiCertified: org?.is_qualiopi !== false,
          recipientName: formateur.prenom || 'Bonjour',
          subject: `Contrat de prestation à signer — ${(sess as any).formation?.intitule || 'Formation'}`,
          docTitle: 'Contrat de prestation à signer',
          intro: `Merci d'avoir accepté la mission. Votre contrat de prestation est prêt : signez-le en ligne en quelques secondes.`,
          metadata: [
            ['Formation', (sess as any).formation?.intitule || ''],
            ['Période', `du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`],
            ...(sess.lieu ? [['Lieu', sess.lieu] as [string, string]] : []),
          ],
          ctaLabel: 'Signer mon contrat',
          ctaUrl: contratSignUrl,
          footerNote: 'Lien valable 30 jours. La session sera confirmée dès la signature du contrat et de la convention client.',
        })
      }
    }
  } catch (e) { console.error('[accept mission — contrat]', e) }

  // Notifier le gestionnaire qui a proposé
  if (sess.mission_proposed_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: sess.organization_id,
      userId: sess.mission_proposed_by,
      titre: 'Mission acceptée — convention en brouillon',
      message: `${session.user.first_name} ${session.user.last_name} a accepté la mission "${(sess as any).formation?.intitule || 'Formation'}". Une convention a été créée en brouillon, prête à être envoyée au client.`,
      type: 'session',
      lienUrl: `/dashboard/conventions`,
      lienLabel: 'Voir la convention',
      entityType: 'session',
      entityId: sessionId,
    })
  }

  await logAudit({ action: 'accept_mission', entity_type: 'session', entity_id: sessionId })
  revalidatePath('/mon-espace')
  revalidatePath('/dashboard/sessions')
  revalidatePath('/dashboard/conventions')
  // Le formateur est redirigé directement vers la signature de son contrat
  return { success: true, data: { contratSignUrl } }
}

export async function refuseMissionAction(sessionId: string, comment: string): Promise<ActionResult> {
  if (!comment.trim()) return { success: false, error: 'Un motif de refus est requis' }
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions')
    .select('formateur_id, mission_status, organization_id, mission_proposed_by, formation:formation_id(intitule)')
    .eq('id', sessionId).single()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: formateur } = await supabase
    .from('formateurs').select('id').eq('user_id', session.user.id).single()
  if (!formateur || formateur.id !== sess.formateur_id) {
    return { success: false, error: 'Cette mission ne vous est pas adressée' }
  }
  if (sess.mission_status !== 'pending') return { success: false, error: 'Cette mission n\'est plus en attente' }

  const { error } = await supabase
    .from('sessions')
    .update({
      mission_status: 'refused',
      mission_responded_at: new Date().toISOString(),
      mission_response_comment: comment,
      formateur_id: null,  // Retirer le formateur pour permettre une réattribution
    })
    .eq('id', sessionId)
  if (error) return { success: false, error: 'Erreur lors du refus' }

  // Notifier le gestionnaire qui a proposé
  if (sess.mission_proposed_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: sess.organization_id,
      userId: sess.mission_proposed_by,
      titre: 'Mission refusée',
      message: `${session.user.first_name} ${session.user.last_name} a refusé la mission "${(sess as any).formation?.intitule || 'Formation'}". Motif : ${comment}`,
      type: 'session',
      lienUrl: `/dashboard/sessions/${sessionId}`,
      lienLabel: 'Réattribuer un formateur',
      entityType: 'session',
      entityId: sessionId,
    })
  }

  await logAudit({ action: 'refuse_mission', entity_type: 'session', entity_id: sessionId, details: { comment } })
  revalidatePath('/mon-espace')
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function updateSessionAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createSessionSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return { success: false, errors: fieldErrors, error: formErrors[0] }
  }

  const supabase = await createServiceRoleClient()

  const horairesJours = parsed.data.horaires_jours ? safeParseJson(parsed.data.horaires_jours) : []

  // Détecte un changement de formateur → relance le workflow mission
  const { data: before } = await supabase
    .from('sessions')
    .select('formateur_id, mission_status')
    .eq('id', id)
    .eq('organization_id', session.organization.id)
    .single()
  const newFormateurId = parsed.data.formateur_id || null
  const formateurChanged = !!newFormateurId && newFormateurId !== before?.formateur_id

  const { error } = await supabase
    .from('sessions')
    .update({
      // Nouveau formateur assigné → mission à proposer
      ...(formateurChanged ? {
        mission_status: 'pending',
        mission_proposed_at: new Date().toISOString(),
        mission_proposed_by: session.user.id,
        mission_responded_at: null,
      } : {}),
      formation_id: parsed.data.formation_id,
      type_session: parsed.data.type_session || 'inter',
      modalite: parsed.data.modalite || 'presentiel',
      client_id: parsed.data.client_id || null,
      reference: parsed.data.reference || undefined,
      intitule: parsed.data.intitule || null,
      date_debut: parsed.data.date_debut,
      date_fin: parsed.data.date_fin,
      horaires: parsed.data.horaires || null,
      horaires_jours: horairesJours,
      lieu: parsed.data.lieu || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      lien_visio: parsed.data.lien_visio || null,
      places_min: parsed.data.places_min,
      places_max: parsed.data.places_max,
      formateur_id: parsed.data.formateur_id || null,
      status: parsed.data.status || undefined,
      cout_formateur: parsed.data.cout_formateur || null,
      cout_salle: parsed.data.cout_salle || null,
      cout_materiel: parsed.data.cout_materiel || null,
      notes_internes: parsed.data.notes_internes || null,
      notes_logistiques: parsed.data.notes_logistiques || null,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  // Nouveau formateur assigné → notification + email de proposition de mission
  if (formateurChanged && newFormateurId) {
    try { await notifyFormateurOfMission(newFormateurId, id, supabase, session) }
    catch (e) { console.error('[notify mission update]', e) }
  }

  // Synchroniser les formations liées : remplace tout
  const newFormationIds = (parsed.data.formation_ids || parsed.data.formation_id || '').split(',').filter(Boolean)
  await supabase.from('session_formations').delete().eq('session_id', id)
  if (newFormationIds.length > 0) {
    await supabase.from('session_formations').insert(
      newFormationIds.map((fid, i) => ({ session_id: id, formation_id: fid, ordre: i }))
    )
  }

  // Synchroniser les inscriptions apprenants : ajoute les nouveaux, garde les existants
  const newApprenantIds = (parsed.data.apprenant_ids || '').split(',').filter(Boolean)
  if (newApprenantIds.length > 0) {
    const { data: existing } = await supabase
      .from('inscriptions').select('apprenant_id').eq('session_id', id)
    const existingIds = new Set((existing || []).map(e => e.apprenant_id))
    const toInsert = newApprenantIds.filter(aid => !existingIds.has(aid))
    if (toInsert.length > 0) {
      await supabase.from('inscriptions').insert(
        toInsert.map(aid => ({
          organization_id: session.organization.id,
          session_id: id,
          apprenant_id: aid,
          status: 'inscrit',
        }))
      )
      // Convention déjà envoyée/signée ? → avenant automatique
      try {
        const { syncConventionAvenant } = await import('@/lib/convention-avenants')
        await syncConventionAvenant(supabase, id, session.user.id)
      } catch (e) { console.error('[avenant]', e) }
    }
  }

  await logAudit({ action: 'update', entity_type: 'session', entity_id: id })
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function updateSessionStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  // À la fin de la session → seed QCM sortie + satisfaction à chaud
  if (status === 'terminee') {
    const { seedQcmReponsesForSession, notifyApprenantsForQcm } = await import('@/lib/qcm-auto-seed')
    for (const t of ['sortie', 'satisfaction_chaud'] as const) {
      const r = await seedQcmReponsesForSession(supabase, id, t)
      if (r.created > 0) await notifyApprenantsForQcm(supabase, id, t)
    }
  }

  await logAudit({ action: 'update_status', entity_type: 'session', entity_id: id, details: { status } })
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (inscriptions liées)' }

  await logAudit({ action: 'delete', entity_type: 'session', entity_id: id })
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

/**
 * Émet l'attestation de fin de formation ou le certificat de réalisation d'un
 * apprenant : génère le PDF, le stocke (visible dans son portail) et l'envoie
 * par WhatsApp (lien portail) + notification interne.
 */
export async function sendDocumentToApprenantAction(
  sessionId: string,
  apprenantId: string,
  docType: 'attestation' | 'certificat',
): Promise<ActionResult & { whatsapp?: string }> {
  const session = await getSession()
  if (session.user.role === 'formateur') {
    return { success: false, error: 'Action réservée aux gestionnaires' }
  }
  const supabase = await createServiceRoleClient()

  const { data: apprenant } = await supabase.from('apprenants').select('*').eq('id', apprenantId).single()
  if (!apprenant) return { success: false, error: 'Apprenant introuvable' }
  if (apprenant.organization_id !== session.organization.id) {
    return { success: false, error: 'Apprenant hors organisation' }
  }

  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formateur:formateurs(prenom, nom)')
    .eq('id', sessionId).single()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: formation } = await supabase.from('formations').select('*').eq('id', sess.formation_id).single()
  const { data: org } = await supabase.from('organizations').select('*').eq('id', apprenant.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const orgDoc = await withDocumentLogo(supabase, org)

  // Assiduité (émargements)
  const { data: emargements } = await supabase
    .from('emargements').select('est_present').eq('session_id', sessionId).eq('apprenant_id', apprenantId)
  const totalEm = (emargements || []).length
  const present = (emargements || []).filter((e: any) => e.est_present).length
  const assiduite = totalEm > 0 ? Math.round((present / totalEm) * 100) : undefined
  const heuresPresence = formation?.duree_heures && assiduite ? Math.round(formation.duree_heures * assiduite / 100) : undefined

  // Rendu du PDF
  const { createElement } = await import('react')
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const formationNom = formation?.intitule || 'votre formation'
  let buffer: Buffer
  let docDbType: string
  let docNom: string
  try {
    if (docType === 'attestation') {
      const { AttestationFormationPDF } = await import('@/lib/pdf/attestation-formation-pdf')
      buffer = await renderToBuffer(createElement(AttestationFormationPDF, { apprenant, session: sess, formation, org: orgDoc, assiduite }) as any)
      docDbType = 'attestation_fin'
      docNom = `Attestation de formation — ${formationNom}`
    } else {
      const { CertificatRealisationPDF } = await import('@/lib/pdf/certificat-realisation-pdf')
      buffer = await renderToBuffer(createElement(CertificatRealisationPDF, { apprenant, session: sess, formation, org: orgDoc, assiduite, heuresPresence }) as any)
      docDbType = 'certificat_realisation'
      docNom = `Certificat de réalisation — ${formationNom}`
    }
  } catch (e: any) {
    return { success: false, error: 'Erreur de génération du PDF' }
  }

  // Upload dans le bucket privé "dossiers" (chemin stable → écrase à chaque renvoi)
  const path = `attestations/${sessionId}/${docType}-${apprenantId}.pdf`
  const { error: upErr } = await supabase.storage
    .from('dossiers')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
  if (upErr) return { success: false, error: 'Erreur de stockage du document' }

  // Documents row (visible dans le portail apprenant). On stocke le chemin storage.
  const fileName = `${docType}-${apprenant.nom}-${apprenant.prenom}.pdf`
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id')
    .eq('apprenant_id', apprenantId)
    .eq('session_id', sessionId)
    .eq('type', docDbType)
    .maybeSingle()
  const docPayload = {
    organization_id: apprenant.organization_id,
    nom: docNom,
    type: docDbType,
    file_url: path,
    file_name: fileName,
    file_size: buffer.length,
    mime_type: 'application/pdf',
    apprenant_id: apprenantId,
    session_id: sessionId,
    formation_id: sess.formation_id,
    created_by: session.user.id,
  }
  if (existingDoc) {
    await supabase.from('documents').update(docPayload).eq('id', existingDoc.id)
  } else {
    await supabase.from('documents').insert(docPayload)
  }

  // Token portail apprenant (pour le bouton WhatsApp)
  const { getOrCreateApprenantToken } = await import('@/lib/portal-token')
  const token = await getOrCreateApprenantToken(supabase, apprenantId, apprenant.organization_id, apprenant.email)

  // Notification interne
  const { createNotification } = await import('@/lib/email')
  if (apprenant.user_id) {
    await createNotification({
      organizationId: apprenant.organization_id,
      userId: apprenant.user_id,
      titre: docType === 'attestation' ? 'Votre attestation de formation' : 'Votre certificat de réalisation',
      message: `${docNom} est disponible dans votre espace.`,
      type: 'document',
      lienUrl: token ? `/portail/${token}/documents` : '/mon-espace',
      lienLabel: 'Voir le document',
      entityType: 'session',
      entityId: sessionId,
    })
  }

  // WhatsApp (si opt-in + numéro) — templates approuvés, bouton → portail
  let whatsappStatus = 'skipped'
  if (apprenant.whatsapp_opt_in && apprenant.whatsapp && token) {
    const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')
    const prenom = apprenant.prenom || apprenant.nom || 'bonjour'
    const r = docType === 'attestation'
      ? await sendWhatsAppTemplate({
          organizationId: apprenant.organization_id,
          to: apprenant.whatsapp,
          toName: `${apprenant.prenom || ''} ${apprenant.nom || ''}`.trim(),
          template: 'attestation_dispo',
          languageCode: 'fr',
          bodyParams: [prenom, formationNom],
          buttonUrlParam: token,
          entityType: 'session',
          entityId: sessionId,
        })
      : await sendWhatsAppTemplate({
          organizationId: apprenant.organization_id,
          to: apprenant.whatsapp,
          toName: `${apprenant.prenom || ''} ${apprenant.nom || ''}`.trim(),
          template: 'document_disponible',
          languageCode: 'fr',
          bodyParams: [prenom, 'certificat de réalisation', formationNom],
          buttonUrlParam: token,
          entityType: 'session',
          entityId: sessionId,
        })
    whatsappStatus = r.status
  }

  // Email brandé avec PDF joint (envoi best-effort, ne bloque pas si Resend down)
  if (apprenant.email) {
    try {
      const { sendDocumentEmail } = await import('@/lib/email')
      const formationDates = sess.date_debut
        ? `Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin || sess.date_debut).toLocaleDateString('fr-FR')}`
        : '—'
      const portalUrl = token ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/portail/${token}/documents` : undefined
      const isAtt = docType === 'attestation'
      await sendDocumentEmail({
        to: apprenant.email,
        orgName: org?.name || 'Lab Learning',
        orgEmail: org?.email_contact || org?.email,
        orgLogoUrl: org?.logo_url,
        qualiopiCertified: org?.is_qualiopi !== false,
        recipientName: `${apprenant.prenom || ''} ${apprenant.nom || ''}`.trim() || 'Madame, Monsieur',
        subject: isAtt
          ? `Votre attestation de formation — ${formationNom}`
          : `Votre certificat de réalisation — ${formationNom}`,
        docTitle: isAtt ? 'Votre attestation de fin de formation' : 'Votre certificat de réalisation',
        intro: isAtt
          ? `Votre formation est terminée. Voici votre attestation de fin de formation, à conserver précieusement.`
          : `Votre formation est terminée. Voici votre certificat de réalisation, justificatif officiel auprès de votre employeur ou financeur.`,
        metadata: [
          ['Formation', formationNom],
          ['Période', formationDates],
          ['Durée', formation?.duree_heures ? `${formation.duree_heures} h` : '—'],
        ],
        pdfBuffer: buffer,
        pdfFilename: fileName,
        ctaLabel: portalUrl ? 'Voir tous mes documents' : undefined,
        ctaUrl: portalUrl,
        footerNote: 'Document également disponible dans votre espace personnel.',
      })
    } catch (e) { console.error('[email doc]', e) }
  }

  await logAudit({ action: `send_${docType}`, entity_type: 'apprenant', entity_id: apprenantId })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, whatsapp: whatsappStatus }
}
