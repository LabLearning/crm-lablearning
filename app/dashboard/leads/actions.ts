'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createLeadSchema, updateLeadStatusSchema, createInteractionSchema } from '@/lib/validations/crm'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { extractParticipantsFromText, type ExtractedParticipant } from '@/lib/ai'
import type { ActionResult } from '@/lib/types'

export async function createLeadAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()

  // Champs obligatoires qui doivent rester en string même vide
  const requiredFields = ['contact_nom', 'source']
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key === 'formation_id') continue
    // Champs optionnels : convertir '' en undefined pour éviter les erreurs de coerce
    raw[key] = (!requiredFields.includes(key) && value === '') ? undefined : value
  }

  // Pour l'apporteur, forcer la source
  if (session.user.role === 'apporteur_affaires') {
    raw.source = 'apporteur_affaires'
  }

  const parsed = createLeadSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[Create Lead Validation]', JSON.stringify(parsed.error.flatten()))
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServiceRoleClient()

  // Si c'est un apporteur, auto-lier le lead à sa fiche
  let apporteurId = parsed.data.apporteur_id || null
  if (session.user.role === 'apporteur_affaires' && !apporteurId) {
    const { data: apporteurRecord } = await supabase
      .from('apporteurs_affaires')
      .select('id')
      .eq('user_id', session.user.id)
      .single()
    apporteurId = apporteurRecord?.id || null
  }

  const insertData = {
    ...parsed.data,
    organization_id: session.organization.id,
    type: parsed.data.type || 'entreprise',
    contact_email: parsed.data.contact_email || null,
    montant_estime: parsed.data.montant_estime || null,
    nombre_stagiaires: parsed.data.nombre_stagiaires || null,
    date_souhaitee: parsed.data.date_souhaitee || null,
    date_fin_souhaitee: parsed.data.date_fin_souhaitee || null,
    date_creation_entreprise: parsed.data.date_creation_entreprise || null,
    site_web: parsed.data.site_web || null,
    opco_id: parsed.data.opco_id || null,
    opco_compte_status: parsed.data.opco_compte_status || 'aucun',
    financeur_type: parsed.data.financeur_type || null,
    est_qualiopi: parsed.data.est_qualiopi === true,
    est_organisme_formation: parsed.data.est_organisme_formation === true,
    apporteur_id: apporteurId,
    assigned_to: parsed.data.assigned_to || (session.user.role === 'apporteur_affaires' ? null : session.user.id),
    source: session.user.role === 'apporteur_affaires' ? 'apporteur_affaires' : (parsed.data.source || 'autre'),
    formation_id: (() => { const f = formData.get('formation_id') as string; return f && f !== '__custom' ? f : null })(),
    status: 'nouveau' as const,
  }

  const { data, error } = await supabase
    .from('leads')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[Create Lead Insert]', error.message, error.details, error.hint)
    return { success: false, error: `Erreur : ${error.message}` }
  }

  // Modèle multi-formations : une lead_formation par formation sélectionnée
  const rawFids = ((formData.get('formation_ids') as string) || '').split(',').map((s) => s.trim()).filter(Boolean)
  const fids = Array.from(new Set(rawFids.length ? rawFids : (insertData.formation_id ? [insertData.formation_id] : [])))
  if (fids.length > 0) {
    await supabase.from('lead_formations').insert(fids.map((fid) => ({
      organization_id: session.organization.id,
      lead_id: data.id,
      formation_id: fid,
      date_souhaitee: parsed.data.date_souhaitee || null,
      date_fin_souhaitee: parsed.data.date_fin_souhaitee || null,
      planification_status: 'a_planifier',
    })))
  }

  await logAudit({
    action: 'create',
    entity_type: 'lead',
    entity_id: data.id,
    details: { contact: parsed.data.contact_nom, entreprise: parsed.data.entreprise },
  })

  // Si soumis par un apporteur → notifier le(s) directeur(s) commercial(aux)
  if (session.user.role === 'apporteur_affaires') {
    const { sendNewLeadFromApporteurEmail, createNotification } = await import('@/lib/email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

    // Trouver les directeurs commerciaux (et super_admin en fallback)
    const { data: dircos } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('organization_id', session.organization.id)
      .eq('status', 'active')
      .in('role', ['directeur_commercial', 'super_admin'])

    const apporteurName = `${session.user.first_name} ${session.user.last_name}`.trim()

    for (const dirco of (dircos || [])) {
      // Email
      await sendNewLeadFromApporteurEmail({
        adminEmail: dirco.email,
        orgName: session.organization.name,
        apporteurName,
        apporteurEmail: session.user.email,
        lead: {
          contact_prenom: parsed.data.contact_prenom || '',
          contact_nom: parsed.data.contact_nom || '',
          contact_email: parsed.data.contact_email || '',
          contact_telephone: parsed.data.contact_telephone || '',
          entreprise: parsed.data.entreprise || '',
          formation_souhaitee: parsed.data.formation_souhaitee || '',
          nombre_stagiaires: String(parsed.data.nombre_stagiaires || ''),
          date_souhaitee: parsed.data.date_souhaitee || '',
          commentaire: parsed.data.commentaire || '',
        },
        dashboardUrl: `${appUrl}/dashboard/leads`,
      })

      // Notification in-app
      await createNotification({
        organizationId: session.organization.id,
        userId: dirco.id,
        titre: 'Nouveau lead apporteur',
        message: `${apporteurName} a soumis un lead : ${parsed.data.contact_prenom || ''} ${parsed.data.contact_nom} — ${parsed.data.entreprise || 'Pas d\'entreprise'}`,
        type: 'lead',
        lienUrl: `/dashboard/leads?lead=${data.id}`,
        lienLabel: 'Voir le lead',
        entityType: 'lead',
        entityId: data.id,
      })
    }

    // Assigner le lead au premier directeur commercial trouvé
    const dirco = (dircos || []).find(d => d.email !== session.user.email)
    if (dirco) {
      await supabase.from('leads').update({ assigned_to: dirco.id }).eq('id', data.id)
    }
  }

  // Notifier super_admin + gestionnaires de TOUT nouveau lead (hors apporteur, déjà géré ci-dessus)
  if (session.user.role !== 'apporteur_affaires') {
    const { createNotification } = await import('@/lib/email')
    const { data: managers } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', session.organization.id)
      .eq('status', 'active')
      .in('role', ['super_admin', 'gestionnaire'])
    const creatorName = `${session.user.first_name || ''} ${session.user.last_name || ''}`.trim() || 'Un commercial'
    const label = `${parsed.data.contact_prenom || ''} ${parsed.data.contact_nom}`.trim() + (parsed.data.entreprise ? ` — ${parsed.data.entreprise}` : '')
    const planif = parsed.data.date_souhaitee ? ` — date souhaitée le ${formatFrDate(parsed.data.date_souhaitee)}, à planifier` : ''
    for (const m of managers || []) {
      if (m.id === session.user.id) continue // ne pas se notifier soi-même
      await createNotification({
        organizationId: session.organization.id,
        userId: m.id,
        titre: 'Nouveau lead créé',
        message: `${creatorName} a créé un nouveau lead : ${label}${planif}`,
        type: 'lead',
        lienUrl: `/dashboard/leads?lead=${data.id}`,
        lienLabel: parsed.data.date_souhaitee ? 'Planifier' : 'Voir le lead',
        entityType: 'lead',
        entityId: data.id,
      })
    }
  }

  revalidatePath('/dashboard/leads')
  return { success: true, data }
}

// ── Helpers planification ──
function formatFrDate(d: string): string {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return d }
}
function addDaysIso(d: string, days: number): string {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}
function leadLabel(lead: any): string {
  return `${lead.contact_prenom || ''} ${lead.contact_nom || ''}`.trim() + (lead.entreprise ? ` — ${lead.entreprise}` : '')
}

export async function updateLeadAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = createLeadSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const updateData = {
    ...parsed.data,
    type: parsed.data.type || 'entreprise',
    contact_email: parsed.data.contact_email || null,
    montant_estime: parsed.data.montant_estime || null,
    nombre_stagiaires: parsed.data.nombre_stagiaires || null,
    date_souhaitee: parsed.data.date_souhaitee || null,
    date_fin_souhaitee: parsed.data.date_fin_souhaitee || null,
    date_creation_entreprise: parsed.data.date_creation_entreprise || null,
    site_web: parsed.data.site_web || null,
    opco_id: parsed.data.opco_id || null,
    opco_compte_status: parsed.data.opco_compte_status || 'aucun',
    financeur_type: parsed.data.financeur_type || null,
    est_qualiopi: parsed.data.est_qualiopi === true,
    est_organisme_formation: parsed.data.est_organisme_formation === true,
    apporteur_id: parsed.data.apporteur_id || null,
    assigned_to: parsed.data.assigned_to || null,
    formation_id: (() => { const f = formData.get('formation_id') as string; return f && f !== '__custom' ? f : null })(),
  }

  const { error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors de la mise à jour' }
  }

  await logAudit({ action: 'update', entity_type: 'lead', entity_id: id })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function updateLeadStatusAction(
  id: string,
  status: string,
  lostReason?: string
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const parsed = updateLeadStatusSchema.safeParse({ id, status, lost_reason: lostReason })
  if (!parsed.success) {
    return { success: false, error: 'Données invalides' }
  }

  const updateData: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'perdu' && lostReason) {
    updateData.lost_reason = lostReason
  }

  const { error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors du changement de statut' }
  }

  // ── AUTO: Lead gagné → créer dossier Suivi Admin ──
  if (parsed.data.status === 'gagne') {
    try {
      const { data: leadData } = await supabase
        .from('leads')
        .select('contact_nom, contact_prenom, entreprise, contact_telephone, montant_estime, nombre_stagiaires, formation_souhaitee')
        .eq('id', id)
        .single()

      if (leadData) {
        // Create dossier_formation entry
        await supabase.from('dossiers_formation').insert({
          organization_id: session.organization.id,
          status: 'en_creation',
          notes: [
            'Dossier cree automatiquement depuis le lead: ' + (leadData.contact_prenom || '') + ' ' + leadData.contact_nom,
            leadData.entreprise ? 'Entreprise: ' + leadData.entreprise : '',
            leadData.contact_telephone ? 'Tel: ' + leadData.contact_telephone : '',
            leadData.montant_estime ? 'Montant: ' + leadData.montant_estime + ' EUR' : '',
            leadData.nombre_stagiaires ? 'Stagiaires: ' + leadData.nombre_stagiaires : '',
            leadData.formation_souhaitee ? 'Formation: ' + leadData.formation_souhaitee : '',
          ].filter(Boolean).join('\n'),
          created_by: session.user.id,
        })
      }
    } catch (e) {
      console.error('[Auto dossier]', e)
    }
  }

  await logAudit({
    action: 'update_status',
    entity_type: 'lead',
    entity_id: id,
    details: { new_status: status },
  })

  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/dossiers')
  return { success: true }
}

export async function deleteLeadAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors de la suppression' }
  }

  await logAudit({ action: 'delete', entity_type: 'lead', entity_id: id })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function convertLeadToClientAction(leadId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Fetch lead
  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)
    .single()

  if (fetchError || !lead) {
    return { success: false, error: 'Lead introuvable' }
  }

  // Create client from lead — propage toutes les infos enrichies
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      organization_id: session.organization.id,
      type: lead.type || 'entreprise',
      raison_sociale: lead.entreprise,
      siret: lead.siret,
      sigle: lead.sigle,
      code_naf: lead.code_naf,
      secteur_activite: lead.secteur_activite,
      taille_entreprise: lead.taille_entreprise,
      forme_juridique: lead.forme_juridique,
      date_creation_entreprise: lead.date_creation_entreprise,
      effectif_libelle: lead.effectif_libelle,
      tva_intra: lead.tva_intra,
      est_qualiopi: lead.est_qualiopi,
      est_organisme_formation: lead.est_organisme_formation,
      adresse: lead.adresse,
      code_postal: lead.code_postal,
      ville: lead.ville,
      site_web: lead.site_web,
      telephone: lead.contact_telephone,
      email: lead.contact_email,
      financeur_type: lead.financeur_type,
      opco_id: lead.opco_id,
      opco_compte_status: lead.opco_compte_status || 'aucun',
      code_idcc: lead.code_idcc,
      convention_collective: lead.convention_collective,
      numero_opco: lead.numero_opco,
      assigned_to: lead.assigned_to || session.user.id,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (clientError) {
    return { success: false, error: 'Erreur lors de la création du client' }
  }

  // Create contact (= dirigeant) from lead info
  await supabase.from('contacts').insert({
    organization_id: session.organization.id,
    client_id: client.id,
    civilite: lead.contact_civilite,
    prenom: lead.contact_prenom || '',
    nom: lead.contact_nom,
    email: lead.contact_email,
    telephone: lead.contact_telephone,
    poste: lead.contact_qualite || lead.contact_poste,
    est_principal: true,
  })

  // Update lead as converted
  await supabase
    .from('leads')
    .update({
      status: 'gagne',
      converted_client_id: client.id,
      converted_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  await logAudit({
    action: 'convert',
    entity_type: 'lead',
    entity_id: leadId,
    details: { client_id: client.id },
  })

  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/clients')
  return { success: true, data: { client_id: client.id } }
}

export async function addInteractionAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()

  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = createInteractionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase.from('lead_interactions').insert({
    organization_id: session.organization.id,
    lead_id: parsed.data.lead_id,
    type: parsed.data.type,
    subject: parsed.data.subject || null,
    content: parsed.data.content,
    duration_minutes: parsed.data.duration_minutes || null,
    user_id: session.user.id,
  })

  if (error) {
    return { success: false, error: 'Erreur lors de l\'ajout de l\'interaction' }
  }

  revalidatePath('/dashboard/leads')
  return { success: true }
}

// ============================================================
// Workflow validation : commercial → directeur commercial → gestionnaire
// ============================================================

export async function submitLeadForValidationAction(leadId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('id, validation_status, contact_nom, contact_prenom, entreprise, formation_souhaitee')
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!lead) return { success: false, error: 'Lead introuvable' }
  if (lead.validation_status === 'pending') return { success: false, error: 'Déjà soumis pour validation' }
  if (lead.validation_status === 'approved') return { success: false, error: 'Déjà validé' }

  const { error } = await supabase
    .from('leads')
    .update({
      validation_status: 'pending',
      submitted_at: new Date().toISOString(),
      submitted_by: session.user.id,
    })
    .eq('id', leadId)

  if (error) return { success: false, error: 'Erreur lors de la soumission' }

  // Notifier les directeurs commerciaux
  const { createNotification } = await import('@/lib/email')
  const { data: dircos } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .eq('organization_id', session.organization.id)
    .eq('status', 'active')
    .in('role', ['directeur_commercial', 'super_admin'])

  const submitter = `${session.user.first_name} ${session.user.last_name}`.trim()
  const leadLabel = `${lead.contact_prenom || ''} ${lead.contact_nom}${lead.entreprise ? ` — ${lead.entreprise}` : ''}`.trim()

  for (const dirco of dircos || []) {
    await createNotification({
      organizationId: session.organization.id,
      userId: dirco.id,
      titre: 'Lead à valider',
      message: `${submitter} a soumis un lead pour validation : ${leadLabel}`,
      type: 'lead',
      lienUrl: `/dashboard/leads?lead=${leadId}&tab=validation`,
      lienLabel: 'Voir le lead',
      entityType: 'lead',
      entityId: leadId,
    })
  }

  await logAudit({ action: 'submit_for_validation', entity_type: 'lead', entity_id: leadId })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function approveLeadAction(
  leadId: string,
  gestionnaireId: string,
  comment?: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!['directeur_commercial', 'super_admin'].includes(session.user.role)) {
    return { success: false, error: 'Action réservée au directeur commercial' }
  }

  const supabase = await createServiceRoleClient()

  // Vérifier que le gestionnaire existe et a le bon rôle
  const { data: gestionnaire } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, role')
    .eq('id', gestionnaireId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!gestionnaire) return { success: false, error: 'Gestionnaire introuvable' }
  if (!['gestionnaire', 'super_admin'].includes(gestionnaire.role)) {
    return { success: false, error: 'L\'utilisateur sélectionné n\'a pas le rôle gestionnaire' }
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('contact_nom, contact_prenom, entreprise')
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!lead) return { success: false, error: 'Lead introuvable' }

  const { error } = await supabase
    .from('leads')
    .update({
      validation_status: 'approved',
      validated_at: new Date().toISOString(),
      validated_by: session.user.id,
      validation_comment: comment || null,
      gestionnaire_id: gestionnaireId,
    })
    .eq('id', leadId)

  if (error) return { success: false, error: 'Erreur lors de la validation' }

  // Notifier le gestionnaire
  const { createNotification } = await import('@/lib/email')
  const leadLabel = `${lead.contact_prenom || ''} ${lead.contact_nom}${lead.entreprise ? ` — ${lead.entreprise}` : ''}`.trim()
  await createNotification({
    organizationId: session.organization.id,
    userId: gestionnaireId,
    titre: 'Nouveau dossier à traiter',
    message: `Le lead "${leadLabel}" t'a été assigné par ${session.user.first_name} ${session.user.last_name}`,
    type: 'lead',
    lienUrl: `/dashboard/leads?lead=${leadId}`,
    lienLabel: 'Voir le dossier',
    entityType: 'lead',
    entityId: leadId,
  })

  await logAudit({
    action: 'approve_lead',
    entity_type: 'lead',
    entity_id: leadId,
    details: { gestionnaire_id: gestionnaireId, comment: comment || null },
  })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function rejectLeadAction(leadId: string, comment: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['directeur_commercial', 'super_admin'].includes(session.user.role)) {
    return { success: false, error: 'Action réservée au directeur commercial' }
  }
  if (!comment.trim()) return { success: false, error: 'Un commentaire de refus est requis' }

  const supabase = await createServiceRoleClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('submitted_by, contact_nom, contact_prenom, entreprise')
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!lead) return { success: false, error: 'Lead introuvable' }

  const { error } = await supabase
    .from('leads')
    .update({
      validation_status: 'rejected',
      validated_at: new Date().toISOString(),
      validated_by: session.user.id,
      validation_comment: comment,
    })
    .eq('id', leadId)

  if (error) return { success: false, error: 'Erreur lors du refus' }

  // Notifier l'auteur de la soumission
  if (lead.submitted_by) {
    const { createNotification } = await import('@/lib/email')
    const leadLabel = `${lead.contact_prenom || ''} ${lead.contact_nom}${lead.entreprise ? ` — ${lead.entreprise}` : ''}`.trim()
    await createNotification({
      organizationId: session.organization.id,
      userId: lead.submitted_by,
      titre: 'Lead refusé',
      message: `Ton lead "${leadLabel}" a été refusé : ${comment}`,
      type: 'lead',
      lienUrl: `/dashboard/leads?lead=${leadId}`,
      lienLabel: 'Voir le lead',
      entityType: 'lead',
      entityId: leadId,
    })
  }

  await logAudit({
    action: 'reject_lead',
    entity_type: 'lead',
    entity_id: leadId,
    details: { comment },
  })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

// ── Participants prévisionnels du lead ──
export async function getLeadParticipantsAction(leadId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { data } = await supabase
    .from('lead_participants')
    .select('*')
    .eq('lead_id', leadId)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: true })
  return { success: true, data: data || [] }
}

export async function addLeadParticipantAction(leadId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const nom = (formData.get('nom') as string || '').trim()
  if (!nom) return { success: false, error: 'Nom requis' }
  const { data, error } = await supabase
    .from('lead_participants')
    .insert({
      organization_id: session.organization.id,
      lead_id: leadId,
      civilite: (formData.get('civilite') as string) || null,
      prenom: (formData.get('prenom') as string) || null,
      nom,
      email: (formData.get('email') as string) || null,
      telephone: (formData.get('telephone') as string) || null,
      poste: (formData.get('poste') as string) || null,
      date_naissance: (formData.get('date_naissance') as string) || null,
      lieu_naissance: (formData.get('lieu_naissance') as string) || null,
      adresse: (formData.get('adresse') as string) || null,
      code_postal: (formData.get('code_postal') as string) || null,
      ville: (formData.get('ville') as string) || null,
      type_contrat: (formData.get('type_contrat') as string) || null,
      numero_securite_sociale: (formData.get('numero_securite_sociale') as string) || null,
      niveau_diplome: (formData.get('niveau_diplome') as string) || null,
    })
    .select()
    .single()
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/leads')
  return { success: true, data }
}

export async function updateLeadParticipantAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const nom = (formData.get('nom') as string || '').trim()
  if (!nom) return { success: false, error: 'Nom requis' }
  const { data, error } = await supabase
    .from('lead_participants')
    .update({
      civilite: (formData.get('civilite') as string) || null,
      prenom: (formData.get('prenom') as string) || null,
      nom,
      email: (formData.get('email') as string) || null,
      telephone: (formData.get('telephone') as string) || null,
      poste: (formData.get('poste') as string) || null,
      date_naissance: (formData.get('date_naissance') as string) || null,
      lieu_naissance: (formData.get('lieu_naissance') as string) || null,
      adresse: (formData.get('adresse') as string) || null,
      code_postal: (formData.get('code_postal') as string) || null,
      ville: (formData.get('ville') as string) || null,
      type_contrat: (formData.get('type_contrat') as string) || null,
      numero_securite_sociale: (formData.get('numero_securite_sociale') as string) || null,
      niveau_diplome: (formData.get('niveau_diplome') as string) || null,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
    .select()
    .single()
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/leads')
  return { success: true, data }
}

// Étape 1 de l'import en masse : l'IA lit le texte, rien n'est enregistré.
export async function extractParticipantsFromTextAction(rawText: string): Promise<ActionResult> {
  await getSession()
  const result = await extractParticipantsFromText(rawText)
  if (!result.success) return { success: false, error: result.error || 'Extraction impossible' }
  if (result.participants.length === 0) return { success: false, error: 'Aucun participant détecté dans ce texte' }
  return { success: true, data: result.participants }
}

// Étape 2 : enregistrement des lignes validées par l'utilisateur dans la prévisualisation.
export async function bulkCreateLeadParticipantsAction(
  leadId: string,
  participants: ExtractedParticipant[],
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const rows = (participants || [])
    .filter((p) => (p.nom || '').trim())
    .map((p) => ({
      organization_id: session.organization.id,
      lead_id: leadId,
      civilite: p.civilite || null,
      prenom: p.prenom || null,
      nom: (p.nom || '').trim(),
      email: p.email || null,
      telephone: p.telephone || null,
      poste: p.poste || null,
      date_naissance: p.date_naissance || null,
      lieu_naissance: p.lieu_naissance || null,
      adresse: p.adresse || null,
      code_postal: p.code_postal || null,
      ville: p.ville || null,
      type_contrat: p.type_contrat || null,
      numero_securite_sociale: p.numero_securite_sociale || null,
      niveau_diplome: p.niveau_diplome || null,
    }))

  if (rows.length === 0) return { success: false, error: 'Aucun participant à enregistrer' }

  const { data, error } = await supabase.from('lead_participants').insert(rows).select()
  if (error) return { success: false, error: "Erreur lors de l'enregistrement" }

  await logAudit({ action: 'import_participants', entity_type: 'lead', entity_id: leadId, details: { count: rows.length } })
  revalidatePath('/dashboard/leads')
  return { success: true, data }
}

export async function deleteLeadParticipantAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('lead_participants')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/leads')
  return { success: true }
}

// Confirme la date proposée, désigne le formateur et CRÉE la session de formation
export async function confirmLeadDateAction(leadId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const date = (formData.get('date') as string) || ''
  const formateurId = (formData.get('formateur_id') as string) || ''
  if (!date) return { success: false, error: 'Date requise' }
  if (!formateurId) return { success: false, error: 'Formateur requis pour créer la session' }

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!lead) return { success: false, error: 'Lead introuvable' }
  if (!lead.formation_id) return { success: false, error: 'Aucune formation liée au lead — modifiez le lead pour en choisir une.' }

  // Éviter les doublons si une session est déjà créée
  if (lead.session_id) return { success: false, error: 'Une session existe déjà pour ce lead' }

  const { data: formation } = await supabase
    .from('formations')
    .select('intitule, duree_jours')
    .eq('id', lead.formation_id)
    .single()
  const dureeJours = Number(formation?.duree_jours) || 1
  const dateFin = addDaysIso(date, Math.max(0, dureeJours - 1))

  const { count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)
  const ref = `SES-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { data: newSession, error: sErr } = await supabase
    .from('sessions')
    .insert({
      organization_id: session.organization.id,
      formation_id: lead.formation_id,
      formateur_id: formateurId,
      type_session: 'intra',
      modalite: 'presentiel',
      reference: ref,
      intitule: formation?.intitule || null,
      date_debut: date,
      date_fin: dateFin,
      places_min: 1,
      places_max: lead.nombre_stagiaires || null,
      status: 'planifiee',
      client_id: null,
      created_by: session.user.id,
      mission_status: 'pending',
      mission_proposed_at: new Date().toISOString(),
      mission_proposed_by: session.user.id,
    })
    .select()
    .single()
  if (sErr) {
    console.error('[confirmLeadDate] session', sErr)
    return { success: false, error: 'Erreur lors de la création de la session' }
  }

  await supabase
    .from('leads')
    .update({
      date_confirmee: date,
      formateur_id: formateurId,
      planification_status: 'date_confirmee',
      session_id: newSession.id,
    })
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)

  // Notifier le commercial en charge
  if (lead.assigned_to) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: session.organization.id,
      userId: lead.assigned_to,
      titre: 'Date de formation confirmée',
      message: `La date du ${formatFrDate(date)} est confirmée pour ${leadLabel(lead)}. La session a été créée.`,
      type: 'lead',
      lienUrl: `/dashboard/leads?lead=${leadId}`,
      lienLabel: 'Voir le lead',
      entityType: 'lead',
      entityId: leadId,
    })
  }

  await logAudit({ action: 'confirm_date', entity_type: 'lead', entity_id: leadId, details: { date, session_id: newSession.id } })
  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

// Propose une autre date que celle souhaitée (renvoie la balle au commercial)
export async function proposeLeadDateAction(leadId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const date = (formData.get('date') as string) || ''
  if (!date) return { success: false, error: 'Date requise' }

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!lead) return { success: false, error: 'Lead introuvable' }

  await supabase
    .from('leads')
    .update({ date_confirmee: date, planification_status: 'autre_date_proposee' })
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)

  if (lead.assigned_to && lead.assigned_to !== session.user.id) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: session.organization.id,
      userId: lead.assigned_to,
      titre: 'Autre date de formation proposée',
      message: `Une autre date est proposée pour ${leadLabel(lead)} : le ${formatFrDate(date)}.`,
      type: 'lead',
      lienUrl: `/dashboard/leads?lead=${leadId}`,
      lienLabel: 'Voir le lead',
      entityType: 'lead',
      entityId: leadId,
    })
  }

  await logAudit({ action: 'propose_date', entity_type: 'lead', entity_id: leadId, details: { date } })
  revalidatePath('/dashboard/leads')
  return { success: true }
}

// Option A : génère la convention depuis le lead.
// → convertit le lead en client, crée les apprenants (participants prévus) rattachés
//   au client, les inscrit dans la session, et crée la convention prête à envoyer.
export async function generateConventionFromLeadAction(leadId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!lead) return { success: false, error: 'Lead introuvable' }
  if (!lead.formation_id) return { success: false, error: 'Aucune formation liée au lead' }

  // 1. Convertir en client (réutilise la logique existante) ou récupérer le client déjà lié
  let clientId = lead.converted_client_id as string | null
  if (!clientId) {
    const conv = await convertLeadToClientAction(leadId)
    if (!conv.success) return { success: false, error: conv.error || 'Erreur conversion client' }
    clientId = (conv.data as any)?.client_id || null
  }
  if (!clientId) return { success: false, error: 'Client introuvable après conversion' }

  // 2. Participants prévus → apprenants rattachés au client
  const { data: participants } = await supabase
    .from('lead_participants')
    .select('*')
    .eq('lead_id', leadId)
    .eq('organization_id', session.organization.id)

  const apprenantIds: string[] = []
  for (const p of participants || []) {
    // Idempotence : ne pas recréer un apprenant déjà présent (même email chez ce client)
    if (p.email) {
      const { data: existing } = await supabase
        .from('apprenants')
        .select('id')
        .eq('organization_id', session.organization.id)
        .eq('client_id', clientId)
        .eq('email', p.email)
        .maybeSingle()
      if (existing) { apprenantIds.push(existing.id); continue }
    }
    const { data: appr } = await supabase
      .from('apprenants')
      .insert({
        organization_id: session.organization.id,
        client_id: clientId,
        civilite: p.civilite || null,
        prenom: p.prenom || p.nom,
        nom: p.nom,
        email: p.email || null,
        telephone: p.telephone || null,
        entreprise: lead.entreprise || null,
        poste: p.poste || null,
        // État civil complet : ces données sont exigées par les financeurs,
        // les perdre à la conversion obligeait à les ressaisir
        date_naissance: p.date_naissance || null,
        lieu_naissance: p.lieu_naissance || null,
        numero_securite_sociale: p.numero_securite_sociale || null,
        adresse: p.adresse || null,
        code_postal: p.code_postal || null,
        ville: p.ville || null,
        type_contrat: p.type_contrat || null,
      })
      .select('id')
      .single()
    if (appr) apprenantIds.push(appr.id)
  }

  // 3. Inscriptions dans la session (si une session a été créée à la confirmation)
  if (lead.session_id && apprenantIds.length > 0) {
    for (const aid of apprenantIds) {
      const { data: existingInsc } = await supabase
        .from('inscriptions')
        .select('id')
        .eq('session_id', lead.session_id)
        .eq('apprenant_id', aid)
        .maybeSingle()
      if (!existingInsc) {
        await supabase.from('inscriptions').insert({
          organization_id: session.organization.id,
          session_id: lead.session_id,
          apprenant_id: aid,
          status: 'inscrit',
        })
      }
    }
    // Rattacher la session au client désormais créé
    await supabase.from('sessions').update({ client_id: clientId }).eq('id', lead.session_id)
  }

  // 4. Créer la convention (prête à envoyer / signer)
  const { data: formation } = await supabase
    .from('formations')
    .select('intitule, duree_heures, tarif_intra_ht')
    .eq('id', lead.formation_id)
    .single()

  const { count } = await supabase
    .from('conventions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)
  const numero = `CONV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
  const montantHt = Number(formation?.tarif_intra_ht) || 0

  const { data: convention, error: cErr } = await supabase
    .from('conventions')
    .insert({
      organization_id: session.organization.id,
      numero,
      type: 'intra_entreprise',
      client_id: clientId,
      formation_id: lead.formation_id,
      session_id: lead.session_id || null,
      objet: formation?.intitule || null,
      nombre_stagiaires: lead.nombre_stagiaires || (apprenantIds.length || 1),
      duree_heures: formation?.duree_heures || null,
      dates_formation: lead.date_confirmee ? formatFrDate(lead.date_confirmee) : null,
      montant_ht: montantHt,
      // Organisme de formation exonéré de TVA (art. 261-4-4°a du CGI)
      taux_tva: 0,
      montant_ttc: montantHt,
      financeur_type: lead.financeur_type || null,
      status: 'brouillon',
      created_by: session.user.id,
    })
    .select()
    .single()
  if (cErr) {
    console.error('[generateConvention]', cErr)
    return { success: false, error: 'Client créé, mais erreur lors de la création de la convention' }
  }

  await supabase.from('leads').update({ planification_status: 'convention_generee' }).eq('id', leadId)

  // Notifier les managers
  const { createNotification } = await import('@/lib/email')
  const { data: managers } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', session.organization.id)
    .eq('status', 'active')
    .in('role', ['super_admin', 'gestionnaire'])
  for (const m of managers || []) {
    await createNotification({
      organizationId: session.organization.id,
      userId: m.id,
      titre: 'Convention générée',
      message: `Convention ${numero} créée pour ${leadLabel(lead)} (${apprenantIds.length} participant(s)).`,
      type: 'convention',
      lienUrl: '/dashboard/conventions',
      lienLabel: 'Voir la convention',
      entityType: 'convention',
      entityId: convention.id,
    })
  }

  await logAudit({ action: 'generate_convention', entity_type: 'lead', entity_id: leadId, details: { convention_id: convention.id, client_id: clientId, apprenants: apprenantIds.length } })
  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/conventions')
  revalidatePath('/dashboard/clients')
  revalidatePath('/dashboard/apprenants')
  return { success: true, data: { convention_id: convention.id, client_id: clientId } }
}

// ══════════════════════════════════════════════════════════
// FORMATIONS MULTIPLES PAR LEAD (une formation = une session + une convention)
// ══════════════════════════════════════════════════════════

export async function getLeadFormationsAction(leadId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { data } = await supabase
    .from('lead_formations')
    .select('*, formation:formations(intitule, reference, duree_jours, duree_heures, tarif_intra_ht), assignments:lead_formation_participants(lead_participant_id)')
    .eq('lead_id', leadId)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: true })
  return { success: true, data: data || [] }
}

export async function addLeadFormationAction(leadId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const formationId = (formData.get('formation_id') as string) || ''
  if (!formationId) return { success: false, error: 'Formation requise' }
  const { data, error } = await supabase
    .from('lead_formations')
    .insert({
      organization_id: session.organization.id,
      lead_id: leadId,
      formation_id: formationId,
      date_souhaitee: (formData.get('date_souhaitee') as string) || null,
      planification_status: 'a_planifier',
    })
    .select('*, formation:formations(intitule, reference, duree_jours, duree_heures, tarif_intra_ht), assignments:lead_formation_participants(lead_participant_id)')
    .single()
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/leads')
  return { success: true, data }
}

export async function deleteLeadFormationAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('lead_formations').delete().eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function setLeadFormationParticipantsAction(leadFormationId: string, participantIds: string[]): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  // Remplace les affectations
  await supabase.from('lead_formation_participants').delete().eq('lead_formation_id', leadFormationId).eq('organization_id', session.organization.id)
  if (participantIds.length > 0) {
    await supabase.from('lead_formation_participants').insert(
      participantIds.map((pid) => ({
        organization_id: session.organization.id,
        lead_formation_id: leadFormationId,
        lead_participant_id: pid,
      })),
    )
  }
  revalidatePath('/dashboard/leads')
  return { success: true }
}

// Confirme la date d'UNE formation → crée sa session
export async function confirmLeadFormationDateAction(leadFormationId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const date = (formData.get('date') as string) || ''
  const formateurId = (formData.get('formateur_id') as string) || ''
  if (!date) return { success: false, error: 'Date requise' }
  if (!formateurId) return { success: false, error: 'Formateur requis' }

  const { data: lf } = await supabase.from('lead_formations').select('*').eq('id', leadFormationId).eq('organization_id', session.organization.id).single()
  if (!lf) return { success: false, error: 'Formation introuvable' }
  if (!lf.formation_id) return { success: false, error: 'Aucune formation associée' }
  if (lf.session_id) return { success: false, error: 'Une session existe déjà pour cette formation' }

  const { data: lead } = await supabase.from('leads').select('*').eq('id', lf.lead_id).single()
  // Lieu de la session = adresse de la société (intra chez le client)
  const companyLieu = [lead?.adresse, [lead?.code_postal, lead?.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null

  const { data: formation } = await supabase.from('formations').select('intitule, duree_jours').eq('id', lf.formation_id).single()
  const dureeJours = Number(formation?.duree_jours) || 1
  const dateFin = addDaysIso(date, Math.max(0, dureeJours - 1))

  const { count } = await supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('organization_id', session.organization.id)
  const ref = `SES-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { data: newSession, error: sErr } = await supabase
    .from('sessions')
    .insert({
      organization_id: session.organization.id,
      formation_id: lf.formation_id,
      formateur_id: formateurId,
      type_session: 'intra',
      modalite: 'presentiel',
      reference: ref,
      intitule: formation?.intitule || null,
      date_debut: date,
      date_fin: dateFin,
      lieu: companyLieu,
      places_min: 1,
      places_max: lead?.nombre_stagiaires || null,
      status: 'planifiee',
      client_id: null,
      created_by: session.user.id,
      mission_status: 'pending',
      mission_proposed_at: new Date().toISOString(),
      mission_proposed_by: session.user.id,
    })
    .select()
    .single()
  if (sErr) { console.error('[confirmLeadFormationDate]', sErr); return { success: false, error: 'Erreur création session' } }

  await supabase.from('lead_formations').update({
    date_confirmee: date, formateur_id: formateurId, planification_status: 'date_confirmee', session_id: newSession.id,
  }).eq('id', leadFormationId)

  if (lead?.assigned_to) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: session.organization.id, userId: lead.assigned_to,
      titre: 'Date confirmée', message: `${formation?.intitule || 'Formation'} — session créée le ${formatFrDate(date)} pour ${leadLabel(lead)}.`,
      type: 'lead', lienUrl: `/dashboard/leads?lead=${lf.lead_id}`, lienLabel: 'Voir le lead', entityType: 'lead', entityId: lf.lead_id,
    })
  }
  await logAudit({ action: 'confirm_date', entity_type: 'lead_formation', entity_id: leadFormationId, details: { session_id: newSession.id } })
  revalidatePath('/dashboard/leads'); revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function proposeLeadFormationDateAction(leadFormationId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const date = (formData.get('date') as string) || ''
  if (!date) return { success: false, error: 'Date requise' }
  await supabase.from('lead_formations').update({ date_confirmee: date, planification_status: 'autre_date_proposee' }).eq('id', leadFormationId).eq('organization_id', session.organization.id)
  revalidatePath('/dashboard/leads')
  return { success: true }
}

// Génère la convention d'UNE formation (Option A) : convertit le lead en client,
// crée les apprenants des participants AFFECTÉS, les inscrit dans SA session, crée SA convention.
export async function generateConventionForFormationAction(leadFormationId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: lf } = await supabase.from('lead_formations').select('*').eq('id', leadFormationId).eq('organization_id', session.organization.id).single()
  if (!lf) return { success: false, error: 'Formation introuvable' }
  if (!lf.formation_id) return { success: false, error: 'Aucune formation associée' }
  if (lf.convention_id) return { success: false, error: 'Convention déjà générée pour cette formation' }

  const { data: lead } = await supabase.from('leads').select('*').eq('id', lf.lead_id).single()
  if (!lead) return { success: false, error: 'Lead introuvable' }

  // 1. Client (conversion une seule fois pour le lead)
  let clientId = lead.converted_client_id as string | null
  if (!clientId) {
    const conv = await convertLeadToClientAction(lf.lead_id)
    if (!conv.success) return { success: false, error: conv.error || 'Erreur conversion client' }
    clientId = (conv.data as any)?.client_id || null
  }
  if (!clientId) return { success: false, error: 'Client introuvable' }

  // 2. Participants AFFECTÉS à cette formation
  const { data: assignments } = await supabase.from('lead_formation_participants').select('lead_participant_id').eq('lead_formation_id', leadFormationId)
  const assignedIds = (assignments || []).map((a) => a.lead_participant_id)

  // Une convention sans stagiaire n'a aucune valeur : on bloque plutôt que de
  // générer un document vide et une session sans inscrit
  if (assignedIds.length === 0) {
    return {
      success: false,
      error: 'Aucun participant n\'est affecté à cette formation. Cochez les stagiaires concernés dans la liste des participants avant de générer la convention.',
    }
  }

  const { data: parts } = await supabase.from('lead_participants').select('*').in('id', assignedIds)
  const participants: any[] = parts || []

  const apprenantIds: string[] = []
  for (const p of participants) {
    if (p.email) {
      const { data: existing } = await supabase.from('apprenants').select('id').eq('organization_id', session.organization.id).eq('client_id', clientId).eq('email', p.email).maybeSingle()
      if (existing) { apprenantIds.push(existing.id); continue }
    }
    const { data: appr } = await supabase.from('apprenants').insert({
      organization_id: session.organization.id, client_id: clientId,
      civilite: p.civilite || null, prenom: p.prenom || p.nom, nom: p.nom,
      email: p.email || null, telephone: p.telephone || null, entreprise: lead.entreprise || null,
      poste: p.poste || null, date_naissance: p.date_naissance || null,
      // Même report d'état civil que dans la conversion globale du lead
      lieu_naissance: p.lieu_naissance || null,
      numero_securite_sociale: p.numero_securite_sociale || null,
      adresse: p.adresse || null, code_postal: p.code_postal || null, ville: p.ville || null,
      type_contrat: p.type_contrat || null,
    }).select('id').single()
    if (appr) apprenantIds.push(appr.id)
  }

  // 3. Inscriptions dans la session de CETTE formation
  if (lf.session_id) {
    for (const aid of apprenantIds) {
      const { data: ex } = await supabase.from('inscriptions').select('id').eq('session_id', lf.session_id).eq('apprenant_id', aid).maybeSingle()
      if (!ex) await supabase.from('inscriptions').insert({ organization_id: session.organization.id, session_id: lf.session_id, apprenant_id: aid, status: 'inscrit' })
    }
    // Le rattachement au client ne dépend pas des participants : la session est
    // créée depuis le lead avec client_id nul, c'est ici qu'elle le récupère
    await supabase.from('sessions').update({ client_id: clientId }).eq('id', lf.session_id)
  }

  // 4. Convention de CETTE formation
  const { data: formation } = await supabase.from('formations').select('intitule, duree_heures, tarif_intra_ht').eq('id', lf.formation_id).single()
  const { count } = await supabase.from('conventions').select('*', { count: 'exact', head: true }).eq('organization_id', session.organization.id)
  const numero = `CONV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
  const montantHt = Number(formation?.tarif_intra_ht) || 0

  const { data: convention, error: cErr } = await supabase.from('conventions').insert({
    organization_id: session.organization.id, numero, type: 'intra_entreprise',
    client_id: clientId, formation_id: lf.formation_id, session_id: lf.session_id || null,
    objet: formation?.intitule || null, nombre_stagiaires: apprenantIds.length || 1,
    duree_heures: formation?.duree_heures || null, dates_formation: lf.date_confirmee ? formatFrDate(lf.date_confirmee) : null,
    montant_ht: montantHt, taux_tva: 0, montant_ttc: montantHt, // OF exonéré de TVA (art. 261-4-4°a CGI)
    financeur_type: lead.financeur_type || null, status: 'brouillon', created_by: session.user.id,
  }).select().single()
  if (cErr) { console.error('[generateConventionForFormation]', cErr); return { success: false, error: 'Client créé, mais erreur convention' } }

  // 5. Dossier de formation (visible sur la fiche client) lié à la convention
  const { count: dosCount } = await supabase.from('dossiers_formation').select('*', { count: 'exact', head: true }).eq('organization_id', session.organization.id)
  const dosNumero = `DOS-${new Date().getFullYear()}-${String((dosCount || 0) + 1).padStart(3, '0')}`
  const { data: dossier } = await supabase.from('dossiers_formation').insert({
    organization_id: session.organization.id,
    numero: dosNumero,
    client_id: clientId,
    formation_id: lf.formation_id,
    session_id: lf.session_id || null,
    financeur_type: lead.financeur_type || null,
    montant_prise_en_charge: montantHt || null,
    notes: `Généré depuis le lead ${leadLabel(lead)} (convention ${numero})`,
    created_by: session.user.id,
  }).select('id').single()
  if (dossier) {
    await supabase.from('conventions').update({ dossier_id: dossier.id }).eq('id', convention.id)
  }

  await supabase.from('lead_formations').update({ convention_id: convention.id, planification_status: 'convention_generee' }).eq('id', leadFormationId)

  await logAudit({ action: 'generate_convention', entity_type: 'lead_formation', entity_id: leadFormationId, details: { convention_id: convention.id, client_id: clientId, apprenants: apprenantIds.length } })
  revalidatePath('/dashboard/leads'); revalidatePath('/dashboard/conventions'); revalidatePath('/dashboard/clients'); revalidatePath('/dashboard/apprenants'); revalidatePath('/dashboard/dossiers')
  return { success: true, data: { convention_id: convention.id, client_id: clientId } }
}

export async function bulkImportLeadsAction(leads: Array<{
  contact_nom: string; contact_prenom?: string; contact_email?: string
  contact_telephone?: string; entreprise?: string; source?: string
}>): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const toInsert = leads.map(l => ({
    organization_id: session.organization.id,
    contact_nom: l.contact_nom,
    contact_prenom: l.contact_prenom || null,
    contact_email: l.contact_email || null,
    contact_telephone: l.contact_telephone || null,
    entreprise: l.entreprise || null,
    source: (l.source || 'autre') as 'autre',
    status: 'nouveau' as const,
    assigned_to: session.user.id,
    score: 0,
    tags: [] as string[],
  }))

  const { data, error } = await supabase.from('leads').insert(toInsert).select()

  if (error) {
    return { success: false, error: 'Erreur lors de l\'import : ' + error.message }
  }

  await logAudit({
    action: 'bulk_import',
    entity_type: 'lead',
    entity_id: 'bulk',
    details: { count: toInsert.length },
  })

  revalidatePath('/dashboard/leads')
  return { success: true, data: { imported: data?.length || 0 } }
}
