'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

function canManage(role: string) {
  return ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial'].includes(role)
}

function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string) || ''
  return v.trim() || null
}
function num(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string) || ''
  if (!v.trim()) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}


// Recalcule le montant total du projet : taux horaire × durée (h) × nombre de candidats
async function recalcPoeiTotal(supabase: any, orgId: string, poeiId: string) {
  const { data: p } = await supabase.from("poei").select("duree_heures, montant_horaire").eq("id", poeiId).eq("organization_id", orgId).single()
  if (!p) return
  const { count } = await supabase.from("poei_candidats").select("*", { count: "exact", head: true }).eq("poei_id", poeiId).eq("organization_id", orgId)
  const total = (p.duree_heures != null && p.montant_horaire != null && (count || 0) > 0)
    ? Math.round(Number(p.duree_heures) * Number(p.montant_horaire) * (count || 0) * 100) / 100
    : null
  await supabase.from("poei").update({ montant_total: total }).eq("id", poeiId)
}

// ─── Projet POEI ──────────────────────────────────────────────────────────────

export async function createPoeiAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const client_id = str(formData, 'client_id')
  const formation_id = str(formData, 'formation_id')
  const date_debut = str(formData, 'date_debut')
  const date_fin = str(formData, 'date_fin')
  if (!client_id) return { success: false, errors: { client_id: ['Entreprise requise'] } }
  if (!formation_id) return { success: false, errors: { formation_id: ['Formation requise'] } }

  const supabase = await createServiceRoleClient()

  const { count } = await supabase
    .from('poei')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)
  const numero = `POEI-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  // Formation (pour intitulé session + durée par défaut)
  const { data: formation } = await supabase
    .from('formations')
    .select('intitule, duree_heures')
    .eq('id', formation_id)
    .single()

  const dureeHeures = num(formData, 'duree_heures') ?? (formation?.duree_heures ?? null)

  // Crée la session du projet (si dates fournies)
  let session_id: string | null = null
  if (date_debut && date_fin) {
    const { data: sess } = await supabase
      .from('sessions')
      .insert({
        organization_id: session.organization.id,
        formation_id,
        client_id,
        intitule: formation?.intitule || 'Session POEI',
        date_debut,
        date_fin,
        status: 'planifiee',
        type_session: 'intra',
        modalite: 'presentiel',
      })
      .select('id')
      .single()
    session_id = sess?.id || null
  }

  const montantHoraire = num(formData, 'montant_horaire')
  const montantTotal = null // calculé automatiquement : taux × heures × nb candidats

  const { data, error } = await supabase
    .from('poei')
    .insert({
      organization_id: session.organization.id,
      numero,
      client_id,
      formation_id,
      session_id,
      duree_heures: dureeHeures,
      date_debut,
      date_fin,
      montant_horaire: montantHoraire,
      numero_dossier_ft: str(formData, 'numero_dossier_ft'),
      statut: str(formData, 'statut') || 'montage',
      notes: str(formData, 'notes'),
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création du projet' }

  await logAudit({ action: 'create', entity_type: 'poei', entity_id: data.id })
  revalidatePath('/dashboard/poei')
  return { success: true, data }
}

export async function updatePoeiStatutAction(id: string, statut: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const supabase = await createServiceRoleClient()
  const updateData: Record<string, unknown> = { statut }
  if (statut === 'depose') updateData.date_depot_ft = new Date().toISOString().slice(0, 10)
  if (statut === 'accorde') updateData.date_accord_ft = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('poei').update(updateData)
    .eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'update_status', entity_type: 'poei', entity_id: id, details: { statut } })
  revalidatePath('/dashboard/poei')
  revalidatePath(`/dashboard/poei/${id}`)
  return { success: true }
}

export async function updatePoeiAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const supabase = await createServiceRoleClient()

  const dureeHeures = num(formData, 'duree_heures')
  const montantHoraire = num(formData, 'montant_horaire')
    const date_debut = str(formData, 'date_debut')
  const date_fin = str(formData, 'date_fin')

  const { data: poei } = await supabase
    .from('poei').select('session_id').eq('id', id).eq('organization_id', session.organization.id).single()

  const { error } = await supabase
    .from('poei')
    .update({
      client_id: str(formData, 'client_id'),
      formation_id: str(formData, 'formation_id'),
      duree_heures: dureeHeures,
      date_debut, date_fin,
      montant_horaire: montantHoraire,
      // montant_total est recalculé juste après (taux × heures × nb candidats)
      numero_dossier_ft: str(formData, "numero_dossier_ft"),
      date_depot_ft: str(formData, "date_depot_ft"),
      date_accord_ft: str(formData, "date_accord_ft"),
      date_mise_en_paiement: str(formData, "date_mise_en_paiement"),
      date_paiement: str(formData, "date_paiement"),
      montant_paye: num(formData, "montant_paye"),
      notes: str(formData, "notes"),
    })
    .eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  // Total = taux × heures × nb candidats (recalculé)
  await recalcPoeiTotal(supabase, session.organization.id, id)

  // Répercute les dates sur la session liée
  if (poei?.session_id && date_debut && date_fin) {
    await supabase.from('sessions').update({ date_debut, date_fin }).eq('id', poei.session_id)
  }

  await logAudit({ action: 'update', entity_type: 'poei', entity_id: id })
  revalidatePath(`/dashboard/poei/${id}`)
  revalidatePath('/dashboard/poei')
  return { success: true }
}

export async function deletePoeiAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('poei').delete().eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'delete', entity_type: 'poei', entity_id: id })
  revalidatePath('/dashboard/poei')
  return { success: true }
}

// ─── Candidats du projet ──────────────────────────────────────────────────────

export async function addPoeiCandidatAction(poeiId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: poei } = await supabase
    .from('poei')
    .select('id, session_id, client_id, client:clients(raison_sociale)')
    .eq('id', poeiId).eq('organization_id', orgId).single()
  if (!poei) return { success: false, error: 'Projet introuvable' }

  let apprenant_id = str(formData, 'apprenant_id')

  // Candidat existant ou nouveau
  if (!apprenant_id) {
    const nom = str(formData, 'nom')
    if (!nom) return { success: false, errors: { nom: ['Nom requis'] } }
    const { data: app, error: appErr } = await supabase
      .from('apprenants')
      .insert({
        organization_id: orgId,
        nom,
        prenom: str(formData, 'prenom') || '',
        email: str(formData, 'email'),
        telephone: str(formData, 'telephone'),
        client_id: poei.client_id,
        entreprise: (poei as any).client?.raison_sociale || null,
      })
      .select('id').single()
    if (appErr || !app) return { success: false, error: 'Erreur création apprenant' }
    apprenant_id = app.id
  }

  // Inscription à la session du projet (pour émargement / évaluations)
  let inscription_id: string | null = null
  if (poei.session_id) {
    const { data: existing } = await supabase
      .from('inscriptions').select('id')
      .eq('session_id', poei.session_id).eq('apprenant_id', apprenant_id).maybeSingle()
    if (existing) {
      inscription_id = existing.id
    } else {
      const { data: ins } = await supabase
        .from('inscriptions')
        .insert({ organization_id: orgId, session_id: poei.session_id, apprenant_id, status: 'inscrit', financeur_type: 'france_travail' })
        .select('id').single()
      inscription_id = ins?.id || null
    }
  }

  const { error } = await supabase
    .from('poei_candidats')
    .insert({
      organization_id: orgId,
      poei_id: poeiId,
      apprenant_id,
      inscription_id,
      identifiant_ft: str(formData, "identifiant_ft"),
      poste_vise: str(formData, "poste_vise"),
      type_contrat: str(formData, "type_contrat"),
      date_embauche_prevue: str(formData, "date_embauche_prevue"),
      numero_convention: str(formData, "numero_convention"),
      statut: "inscrit",
    })
  if (error) return { success: false, error: 'Erreur lors de l\'ajout du candidat' }

  await recalcPoeiTotal(supabase, orgId, poeiId)

  // Un candidat ajouté en cours de parcours doit apparaître sur les feuilles
  // d'émargement de toutes les interventions
  try {
    const { syncCandidatsSurInterventions } = await import('@/lib/poei-session')
    await syncCandidatsSurInterventions(supabase, poeiId, orgId)
  } catch (e) { console.error('[sync candidats interventions]', e) }

  await logAudit({ action: 'add_candidat', entity_type: 'poei', entity_id: poeiId })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true }
}

export async function updateCandidatStatutAction(candidatId: string, poeiId: string, statut: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('poei_candidats').update({ statut })
    .eq('id', candidatId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true }
}

// Modifie les infos d'un candidat : identité (fiche apprenant) + champs POEI
export async function updatePoeiCandidatAction(candidatId: string, poeiId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: cand } = await supabase
    .from('poei_candidats').select('apprenant_id')
    .eq('id', candidatId).eq('organization_id', session.organization.id).single()
  if (!cand) return { success: false, error: 'Candidat introuvable' }

  // Fiche apprenant (identité / contact)
  if (cand.apprenant_id) {
    const nom = str(formData, 'nom')
    if (!nom) return { success: false, error: 'Nom requis' }
    const { error: aErr } = await supabase.from('apprenants').update({
      prenom: str(formData, 'prenom') || nom,
      nom,
      email: str(formData, 'email'),
      telephone: str(formData, 'telephone'),
      date_naissance: str(formData, 'date_naissance'),
    }).eq('id', cand.apprenant_id).eq('organization_id', session.organization.id)
    if (aErr) return { success: false, error: 'Erreur mise à jour apprenant' }
  }

  // Champs POEI du candidat
  const { error } = await supabase.from("poei_candidats").update({
    identifiant_ft: str(formData, "identifiant_ft"),
    poste_vise: str(formData, "poste_vise"),
    type_contrat: str(formData, "type_contrat"),
    date_embauche_prevue: str(formData, "date_embauche_prevue"),
    numero_convention: str(formData, "numero_convention"),
  }).eq('id', candidatId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur mise à jour candidat' }

  await logAudit({ action: 'update', entity_type: 'poei_candidat', entity_id: candidatId })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true }
}

// Envoie l'attestation d'entrée en formation par email aux candidats sélectionnés
// (individuel = un seul id, groupé = tous). Chaque candidat reçoit SA propre attestation.
export async function sendAttestationsEntreeAction(
  poeiId: string,
  candidatIds: string[],
  custom?: { subject?: string; message?: string },
): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: p } = await supabase.from('poei').select('*').eq('id', poeiId).eq('organization_id', session.organization.id).single()
  if (!p) return { success: false, error: 'Projet POEI introuvable' }

  const { data: formation } = p.formation_id
    ? await supabase.from('formations').select('*').eq('id', p.formation_id).single()
    : { data: null } as any
  if (!formation) return { success: false, error: 'Aucune formation liée au projet' }

  let employeur: string | null = null
  if (p.client_id) {
    const { data: cl } = await supabase.from('clients').select('raison_sociale').eq('id', p.client_id).single()
    employeur = cl?.raison_sociale || null
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { AttestationEntreePDF } = await import('@/lib/pdf/attestation-entree-pdf')
  const { sendDocumentEmail } = await import('@/lib/email')

  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('id, identifiant_ft, poste_vise, apprenant:apprenants(id, civilite, prenom, nom, email, entreprise, date_naissance)')
    .in('id', candidatIds)
    .eq('organization_id', session.organization.id)

  let sent = 0
  const skipped: string[] = []
  for (const c of candidats || []) {
    const a: any = c.apprenant
    if (!a) { skipped.push('candidat sans fiche apprenant'); continue }
    if (!a.email) { skipped.push(`${a.prenom || ''} ${a.nom || ''}`.trim() || 'sans nom'); continue }

    const buffer = await renderToBuffer(createElement(AttestationEntreePDF, {
      apprenant: a, formation, org,
      dateDebut: p.date_debut, dateFin: p.date_fin, dureeHeures: p.duree_heures,
      lieu: null, formateurNom: null,
      poei: { identifiant_ft: c.identifiant_ft || p.candidat_identifiant_ft, poste_vise: c.poste_vise || p.poste_vise, employeur },
    }) as any)

    const result = await sendDocumentEmail({
      to: a.email,
      orgName: org?.name || 'Lab Learning',
      orgEmail: (org as any)?.email_contact || org?.email,
      orgLogoUrl: (orgRaw as any)?.logo_url,  // logo clair : en-tête email sur fond vert
      qualiopiCertified: (org as any)?.is_qualiopi !== false,
      recipientName: `${a.prenom || ''} ${a.nom || ''}`.trim(),
      subject: custom?.subject?.trim() || `Votre attestation d'entrée en formation — ${formation.intitule}`,
      docTitle: "Attestation d'entrée en formation",
      intro: custom?.message?.trim() || `Vous trouverez ci-joint votre attestation d'entrée en formation « ${formation.intitule} », à transmettre à France Travail si nécessaire.`,
      metadata: [
        ['Formation', formation.intitule],
        ['Dates', p.date_debut ? `Du ${new Date(p.date_debut).toLocaleDateString('fr-FR')} au ${new Date(p.date_fin || p.date_debut).toLocaleDateString('fr-FR')}` : '—'],
      ],
      pdfBuffer: Buffer.from(buffer),
      pdfFilename: `attestation-entree-${a.nom || 'candidat'}.pdf`,
    })

    await supabase.from('email_logs').insert({
      organization_id: session.organization.id,
      to_email: a.email,
      to_name: `${a.prenom || ''} ${a.nom || ''}`.trim() || null,
      subject: custom?.subject?.trim() || `Attestation d'entrée — ${formation.intitule}`,
      template: 'attestation_entree',
      entity_type: 'poei',
      entity_id: poeiId,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : (result.error || null),
      sent_at: result.success ? new Date().toISOString() : null,
      triggered_by: session.user.id,
    })

    if (result.success) sent++
    else skipped.push(`${a.prenom || ''} ${a.nom || ''}`.trim())
  }

  await logAudit({ action: 'send_attestations_entree', entity_type: 'poei', entity_id: poeiId, details: { sent, skipped: skipped.length } })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { sent, skipped } }
}

export async function removePoeiCandidatAction(candidatId: string, poeiId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const supabase = await createServiceRoleClient()
  const { data: cand } = await supabase
    .from('poei_candidats').select('inscription_id')
    .eq('id', candidatId).eq('organization_id', session.organization.id).single()

  // Retire l'inscription liée (on conserve la fiche apprenant)
  if (cand?.inscription_id) {
    await supabase.from('inscriptions').delete().eq('id', cand.inscription_id)
  }
  const { error } = await supabase
    .from('poei_candidats').delete().eq('id', candidatId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }

  // Total = taux × heures × nb candidats (recalculé après retrait)
  await recalcPoeiTotal(supabase, session.organization.id, poeiId)

  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true }
}

/**
 * Génère un devis par candidat du projet POEI.
 * Chaque devis = 1 ligne (formation × taux horaire × durée), TVA 0
 * (organisme exonéré). Idempotent : un candidat déjà couvert par un devis
 * POEI (marqueur dans notes_internes) est ignoré.
 */
export async function generateDevisPerCandidatAction(poeiId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select('id, client_id, formation_id, duree_heures, montant_horaire, formation:formations(intitule)')
    .eq('id', poeiId).eq('organization_id', orgId).single()
  if (!poei) return { success: false, error: 'Projet introuvable' }
  if (!poei.client_id) return { success: false, error: 'Aucune entreprise liée au projet' }
  if (!(Number(poei.montant_horaire) > 0) || !(Number(poei.duree_heures) > 0)) {
    return { success: false, error: 'Renseignez le taux horaire et la durée du projet avant de générer les devis' }
  }

  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('id, apprenant:apprenants(nom, prenom)')
    .eq('poei_id', poeiId)
    .order('created_at', { ascending: true })
  if (!candidats || candidats.length === 0) return { success: false, error: 'Aucun candidat à facturer' }

  const duree = Number(poei.duree_heures)
  const taux = Number(poei.montant_horaire)
  const montantHt = Math.round(duree * taux * 100) / 100
  const formationNom = (poei as any).formation?.intitule || 'Formation POEI'
  const today = new Date().toISOString().slice(0, 10)
  const validite = new Date(); validite.setDate(validite.getDate() + 30)

  let created = 0, skipped = 0
  for (const c of candidats) {
    const marker = `[POEI:${poeiId}:${c.id}]`
    const { count: exists } = await supabase
      .from('devis').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).ilike('notes_internes', `%${marker}%`)
    if (exists && exists > 0) { skipped++; continue }

    const nom = `${(c as any).apprenant?.prenom || ''} ${(c as any).apprenant?.nom || ''}`.trim() || 'Candidat'
    const { data: devis, error } = await supabase
      .from('devis')
      .insert({
        organization_id: orgId, numero: '', client_id: poei.client_id, formation_id: poei.formation_id,
        objet: `POEI — ${nom} — ${formationNom}`,
        // Devis POEI : émis directement (dossier envoyé à France Travail), pas de brouillon
        status: 'envoye', date_emission: today, date_validite: validite.toISOString().slice(0, 10),
        sent_at: new Date().toISOString(),
        taux_tva: 0, remise_pourcent: 0,
        notes_internes: `Devis POEI (candidat ${nom}). ${marker}`,
        created_by: session.user.id,
      })
      .select('id').single()
    if (error || !devis) continue

    await supabase.from('devis_lignes').insert({
      devis_id: devis.id,
      designation: `${formationNom} — ${nom}`,
      description: `Formation POEI : ${duree} h × ${taux.toLocaleString('fr-FR')} €/h`,
      quantite: duree, unite: 'heure', prix_unitaire_ht: taux, montant_ht: montantHt, position: 0,
    })
    // Totaux (TVA 0 → TTC = HT)
    await supabase.from('devis').update({
      montant_ht: montantHt, montant_tva: 0, montant_ttc: montantHt, remise_montant: 0,
    }).eq('id', devis.id)
    created++
  }

  await logAudit({ action: 'generate_devis_poei', entity_type: 'poei', entity_id: poeiId, details: { created, skipped } })
  revalidatePath('/dashboard/devis')
  revalidatePath(`/dashboard/poei/${poeiId}`)
  if (created === 0 && skipped > 0) return { success: true, data: { created, skipped }, warning: 'Tous les candidats ont déjà un devis.' }
  return { success: true, data: { created, skipped } }
}

/**
 * Email groupé personnalisé aux candidats d'un projet POEI.
 * Le message accepte des variables remplacées pour chaque destinataire :
 * {prenom} {nom} {formation} {entreprise} {dates}
 * Option : joindre l'attestation d'entrée de chaque candidat.
 */
export async function sendGroupEmailToCandidatsAction(
  poeiId: string,
  candidatIds: string[],
  payload: {
    subject: string
    message: string
    joindreAttestation?: boolean
    /** Pièces jointes communes à tous les destinataires */
    attachments?: { filename: string; content: Buffer | Uint8Array; contentType?: string }[]
  },
): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!payload.subject?.trim()) return { success: false, error: 'Objet requis' }
  if (!payload.message?.trim()) return { success: false, error: 'Message requis' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const { data: p } = await supabase.from('poei').select('*').eq('id', poeiId).eq('organization_id', orgId).single()
  if (!p) return { success: false, error: 'Projet POEI introuvable' }

  const { data: formation } = p.formation_id
    ? await supabase.from('formations').select('*').eq('id', p.formation_id).single()
    : { data: null } as any

  let employeur: string | null = null
  if (p.client_id) {
    const { data: cl } = await supabase.from('clients').select('raison_sociale').eq('id', p.client_id).single()
    employeur = cl?.raison_sociale || null
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)
  const { sendDocumentEmail } = await import('@/lib/email')

  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('id, identifiant_ft, poste_vise, apprenant:apprenants(id, civilite, prenom, nom, email, entreprise, date_naissance)')
    .in('id', candidatIds)
    .eq('organization_id', orgId)

  const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : ''
  const datesStr = p.date_debut ? `du ${fmtFr(p.date_debut)} au ${fmtFr(p.date_fin || p.date_debut)}` : ''

  // Lieu : repris de la session liée au projet
  let lieuStr = ''
  if (p.session_id) {
    const { data: sess } = await supabase.from('sessions').select('lieu, adresse, code_postal, ville').eq('id', p.session_id).single()
    lieuStr = [sess?.lieu, sess?.adresse, [sess?.code_postal, sess?.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  }

  // Texte saisi → HTML email : paragraphes (ligne vide), retours à la ligne,
  // **gras**. Sans ça, tout le message arriverait en un seul bloc.
  const toHtml = (txt: string) => {
    const escaped = txt
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#18181b;">$1</strong>')
    return escaped
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean)
      .map((para) => `<p style="margin:0 0 14px;color:#71717a;font-size:15px;line-height:1.7;">${para.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }

  let sent = 0
  const skipped: string[] = []
  for (const c of candidats || []) {
    const a: any = c.apprenant
    const nomComplet = `${a?.prenom || ''} ${a?.nom || ''}`.trim()
    if (!a) { skipped.push('candidat sans fiche apprenant'); continue }
    if (!a.email) { skipped.push(nomComplet || 'sans nom'); continue }

    // Personnalisation par destinataire
    const fill = (s: string) => s
      .replace(/\{prenom\}/gi, a.prenom || '')
      .replace(/\{nom\}/gi, a.nom || '')
      .replace(/\{formation\}/gi, formation?.intitule || '')
      .replace(/\{entreprise\}/gi, employeur || '')
      .replace(/\{dates\}/gi, datesStr)
      .replace(/\{lieu\}/gi, lieuStr)
      .replace(/\{duree_heures\}/gi, p.duree_heures != null ? String(p.duree_heures) : '')
      .replace(/\{date_debut\}/gi, fmtFr(p.date_debut))
      .replace(/\{date_fin\}/gi, fmtFr(p.date_fin))

    // Pièce jointe optionnelle : attestation d'entrée du candidat
    let pdfBuffer: Buffer | undefined
    let pdfFilename: string | undefined
    if (payload.joindreAttestation && formation) {
      try {
        const { renderToBuffer } = await import('@react-pdf/renderer')
        const { createElement } = await import('react')
        const { AttestationEntreePDF } = await import('@/lib/pdf/attestation-entree-pdf')
        const buf = await renderToBuffer(createElement(AttestationEntreePDF, {
          apprenant: a, formation, org,
          dateDebut: p.date_debut, dateFin: p.date_fin, dureeHeures: p.duree_heures,
          lieu: null, formateurNom: null,
          poei: { identifiant_ft: c.identifiant_ft || p.candidat_identifiant_ft, poste_vise: c.poste_vise || p.poste_vise, employeur },
        }) as any)
        pdfBuffer = Buffer.from(buf)
        pdfFilename = `attestation-entree-${a.nom || 'candidat'}.pdf`
      } catch (e) { console.error('[mail groupé — attestation]', e) }
    }

    const result = await sendDocumentEmail({
      to: a.email,
      orgName: org?.name || 'Lab Learning',
      orgEmail: (org as any)?.email_contact || org?.email,
      orgLogoUrl: (orgRaw as any)?.logo_url,  // logo clair : en-tête email sur fond vert
      qualiopiCertified: (org as any)?.is_qualiopi !== false,
      recipientName: nomComplet,
      subject: fill(payload.subject),
      docTitle: fill(payload.subject),
      intro: toHtml(fill(payload.message)),
      metadata: formation ? [
        ['Formation', formation.intitule],
        ...(datesStr ? [['Dates', datesStr] as [string, string]] : []),
      ] : [],
      pdfBuffer, pdfFilename,
      extraAttachments: payload.attachments,
    })

    await supabase.from('email_logs').insert({
      organization_id: orgId,
      to_email: a.email,
      to_name: nomComplet || null,
      subject: fill(payload.subject),
      template: 'poei_groupe',
      entity_type: 'poei',
      entity_id: poeiId,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : (result.error || null),
      sent_at: result.success ? new Date().toISOString() : null,
      triggered_by: session.user.id,
    })

    if (result.success) sent++
    else skipped.push(nomComplet)
  }

  await logAudit({ action: 'send_group_email_poei', entity_type: 'poei', entity_id: poeiId, details: { sent, skipped: skipped.length } })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { sent, skipped } }
}

// ─── Modèles d'emails POEI (réutilisables sur chaque projet) ───────────────

export async function getPoeiEmailTemplatesAction(): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { data } = await supabase
    .from('email_templates')
    .select('id, slug, nom, sujet, corps_texte')
    .eq('organization_id', session.organization.id)
    .like('slug', 'poei_%')
    .eq('is_active', true)
    .order('nom')
  return { success: true, data: data || [] }
}

export async function savePoeiEmailTemplateAction(
  nom: string, sujet: string, corps: string, slug?: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!nom.trim() || !sujet.trim() || !corps.trim()) return { success: false, error: 'Nom, objet et message requis' }
  const supabase = await createServiceRoleClient()

  const finalSlug = slug || `poei_${nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)}`
  const { error } = await supabase
    .from('email_templates')
    .upsert({
      organization_id: session.organization.id,
      slug: finalSlug, nom: nom.trim(), sujet: sujet.trim(), corps_texte: corps,
      corps_html: '', description: 'Modèle POEI', is_active: true, is_system: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,slug' })
  if (error) return { success: false, error: 'Erreur lors de l\'enregistrement du modèle' }

  revalidatePath('/dashboard/poei')
  return { success: true, data: { slug: finalSlug } }
}

// ─── Interventions formateurs sur un POEI ─────────────────────────────────
// Un POEI peut être assuré par plusieurs formateurs, chacun sur une période
// et un volume d'heures. Circuit : proposition → acceptation → contrat.

export async function addPoeiInterventionAction(poeiId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const libelle = str(formData, 'libelle')
  const formateur_id = str(formData, 'formateur_id')
  if (!libelle) return { success: false, errors: { libelle: ['Intitulé requis'] } }

  const { count } = await supabase.from('poei_interventions')
    .select('*', { count: 'exact', head: true }).eq('poei_id', poeiId)

  const nbHeures = num(formData, 'nb_heures')
  const tarifJour = num(formData, 'tarif_journalier')
  const montant = num(formData, 'montant_ht')

  const { data, error } = await supabase.from('poei_interventions').insert({
    organization_id: orgId, poei_id: poeiId, formateur_id,
    libelle, date_debut: str(formData, 'date_debut'), date_fin: str(formData, 'date_fin'),
    nb_heures: nbHeures, tarif_journalier: tarifJour, montant_ht: montant,
    mission_status: formateur_id ? 'pending' : 'not_required',
    mission_proposed_at: formateur_id ? new Date().toISOString() : null,
    mission_proposed_by: formateur_id ? session.user.id : null,
    ordre: count || 0,
    notes: str(formData, 'notes'),
    created_by: session.user.id,
  }).select('id').single()
  if (error || !data) return { success: false, error: "Erreur lors de l'ajout de l'intervention" }

  // Session de l'intervention : sans elle, le formateur n'a ni émargement,
  // ni questionnaire, ni accès à ses stagiaires
  try {
    const { syncInterventionSession } = await import('@/lib/poei-session')
    await syncInterventionSession(supabase, data.id, session.user.id)
  } catch (e) { console.error('[session intervention]', e) }

  // Notifie le formateur (notif in-app + email) comme pour une session
  if (formateur_id) {
    try { await notifyFormateurIntervention(supabase, session, data.id) }
    catch (e) { console.error('[notif intervention]', e) }
  }

  await logAudit({ action: 'add_intervention', entity_type: 'poei', entity_id: poeiId })
  revalidatePath('/dashboard/sessions')
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data }
}

export async function updatePoeiInterventionAction(id: string, poeiId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: before } = await supabase.from('poei_interventions')
    .select('formateur_id').eq('id', id).eq('organization_id', session.organization.id).single()

  const formateur_id = str(formData, 'formateur_id')
  const changedFormateur = !!formateur_id && formateur_id !== before?.formateur_id

  const { error } = await supabase.from('poei_interventions').update({
    formateur_id,
    libelle: str(formData, 'libelle'),
    date_debut: str(formData, 'date_debut'), date_fin: str(formData, 'date_fin'),
    nb_heures: num(formData, 'nb_heures'),
    tarif_journalier: num(formData, 'tarif_journalier'),
    montant_ht: num(formData, 'montant_ht'),
    notes: str(formData, 'notes'),
    // Nouveau formateur → nouvelle proposition de mission
    ...(changedFormateur ? {
      mission_status: 'pending',
      mission_proposed_at: new Date().toISOString(),
      mission_proposed_by: session.user.id,
      mission_responded_at: null,
    } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  // Répercute dates, lieu, formateur et rémunération sur la session
  try {
    const { syncInterventionSession } = await import('@/lib/poei-session')
    await syncInterventionSession(supabase, id, session.user.id)
  } catch (e) { console.error('[session intervention]', e) }

  if (changedFormateur) {
    try { await notifyFormateurIntervention(supabase, session, id) }
    catch (e) { console.error('[notif intervention]', e) }
  }

  revalidatePath(`/dashboard/poei/${poeiId}`)
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function removePoeiInterventionAction(id: string, poeiId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  // La session de l'intervention est supprimée en cascade : on refuse tant
  // qu'elle porte des émargements signés, qui sont des pièces justificatives
  const { data: sess } = await supabase
    .from('sessions').select('id').eq('poei_intervention_id', id).maybeSingle()
  if (sess) {
    const { count } = await supabase
      .from('emargements')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sess.id)
      .not('signature_data', 'is', null)
    if ((count || 0) > 0) {
      return {
        success: false,
        error: `Cette intervention porte ${count} émargement(s) signé(s) : elle ne peut pas être supprimée. Retirez le formateur si la mission est annulée.`,
      }
    }
  }

  const { error } = await supabase.from('poei_interventions')
    .delete().eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la suppression' }
  revalidatePath(`/dashboard/poei/${poeiId}`)
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

/** Notif + email de proposition de mission au formateur d'une intervention */
async function notifyFormateurIntervention(supabase: any, session: any, interventionId: string) {
  const { data: iv } = await supabase
    .from('poei_interventions')
    .select('*, formateur:formateurs(user_id, prenom, nom, email), poei:poei(numero, client:clients(raison_sociale), formation:formations(intitule))')
    .eq('id', interventionId).single()
  if (!iv?.formateur) return

  const f: any = iv.formateur
  const p: any = iv.poei
  const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : ''
  const periode = iv.date_debut ? `du ${fmtFr(iv.date_debut)} au ${fmtFr(iv.date_fin || iv.date_debut)}` : ''
  const contexte = `${p?.formation?.intitule || 'POEI'}${p?.client?.raison_sociale ? ` — ${p.client.raison_sociale}` : ''}`

  const { createNotification, sendDocumentEmail } = await import('@/lib/email')

  if (f.user_id) {
    await createNotification({
      organizationId: session.organization.id,
      userId: f.user_id,
      titre: 'Nouvelle mission POEI proposée',
      message: `${iv.libelle} (${contexte}) ${periode}. Acceptez ou refusez depuis votre espace.`,
      type: 'session',
      lienUrl: '/mon-espace',
      lienLabel: 'Voir la mission',
      entityType: 'poei_intervention',
      entityId: interventionId,
    })
  }

  if (f.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
    const { data: org } = await supabase.from('organizations')
      .select('name, email, email_contact, logo_url, is_qualiopi').eq('id', session.organization.id).single()
    await sendDocumentEmail({
      to: f.email,
      orgName: org?.name || 'Lab Learning',
      orgEmail: org?.email_contact || org?.email,
      orgLogoUrl: org?.logo_url,
      qualiopiCertified: org?.is_qualiopi !== false,
      recipientName: f.prenom || 'Bonjour',
      subject: `Nouvelle mission POEI — ${iv.libelle}`,
      docTitle: 'Proposition de mission POEI',
      intro: `Une intervention vous est proposée sur le parcours POEI ${contexte}. Connectez-vous à votre espace pour l'accepter ou la refuser.`,
      metadata: [
        ['Intervention', iv.libelle],
        ...(periode ? [['Période', periode] as [string, string]] : []),
        ...(iv.nb_heures ? [['Volume', `${iv.nb_heures} h`] as [string, string]] : []),
        ...(iv.montant_ht ? [['Rémunération', `${Number(iv.montant_ht).toLocaleString('fr-FR')} €`] as [string, string]] : []),
      ],
      ctaLabel: 'Voir la mission dans mon espace',
      ctaUrl: `${appUrl}/mon-espace`,
      footerNote: 'Merci de répondre rapidement afin de confirmer le planning du parcours.',
    })
  }
}

/** Le formateur accepte son intervention POEI → son contrat de prestation est généré */
export async function acceptPoeiInterventionAction(interventionId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: iv } = await supabase
    .from('poei_interventions')
    .select('*, poei:poei(id, numero, organization_id, formation:formations(intitule, duree_jours), client:clients(raison_sociale))')
    .eq('id', interventionId).single()
  if (!iv) return { success: false, error: 'Intervention introuvable' }

  const { data: formateur } = await supabase
    .from('formateurs').select('id, prenom, nom, email, tarif_journalier')
    .eq('user_id', session.user.id).single()
  if (!formateur || formateur.id !== iv.formateur_id) {
    return { success: false, error: "Cette mission ne vous est pas adressée" }
  }
  if (iv.mission_status !== 'pending') return { success: false, error: "Cette mission n'est plus en attente" }

  await supabase.from('poei_interventions').update({
    mission_status: 'accepted', mission_responded_at: new Date().toISOString(),
  }).eq('id', interventionId)

  // La session de l'intervention suit l'état de la mission : c'est elle qui
  // ouvre au formateur l'émargement et l'accès à ses stagiaires
  try {
    const { syncInterventionSession } = await import('@/lib/poei-session')
    await syncInterventionSession(supabase, interventionId)
  } catch (e) { console.error('[session intervention]', e) }

  // Contrat de prestation propre à l'intervention
  let contratSignUrl: string | null = null
  try {
    const orgId = iv.organization_id
    const { data: existing } = await supabase
      .from('contrats_formateur').select('id, signature_token, status')
      .eq('poei_intervention_id', interventionId).maybeSingle()

    let token = existing?.signature_token
    if (!existing) {
      const { count } = await supabase.from('contrats_formateur')
        .select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
      const numero = `CT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
      const { randomBytes, createHash } = await import('crypto')
      token = createHash('sha256').update(randomBytes(32)).digest('hex')
      const expires = new Date(); expires.setDate(expires.getDate() + 30)
      await supabase.from('contrats_formateur').insert({
        organization_id: orgId,
        poei_intervention_id: interventionId,
        formateur_id: formateur.id,
        numero, status: 'envoye',
        tarif_journalier: iv.tarif_journalier ?? formateur.tarif_journalier ?? null,
        nombre_jours: null,
        montant_ht: iv.montant_ht ?? null,
        signature_token: token,
        signature_token_expires_at: expires.toISOString(),
        sent_at: new Date().toISOString(),
        created_by: iv.mission_proposed_by || session.user.id,
      })
    }
    if (token && existing?.status !== 'signe_formateur') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
      contratSignUrl = `${appUrl}/contrat-formateur/${token}/signer`
    }
  } catch (e) { console.error('[accept intervention — contrat]', e) }

  // Notifie le gestionnaire qui a proposé
  if (iv.mission_proposed_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: iv.organization_id,
      userId: iv.mission_proposed_by,
      titre: 'Mission POEI acceptée',
      message: `${formateur.prenom} ${formateur.nom} a accepté « ${iv.libelle} » (${(iv as any).poei?.numero || 'POEI'}).`,
      type: 'session',
      lienUrl: `/dashboard/poei/${iv.poei_id}`,
      lienLabel: 'Voir le projet',
      entityType: 'poei',
      entityId: iv.poei_id,
    })
  }

  await logAudit({ action: 'accept_poei_intervention', entity_type: 'poei', entity_id: iv.poei_id })
  revalidatePath('/mon-espace')
  revalidatePath(`/dashboard/poei/${iv.poei_id}`)
  return { success: true, data: { contratSignUrl } }
}

/** Le formateur refuse son intervention POEI */
export async function refusePoeiInterventionAction(interventionId: string, motif: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: iv } = await supabase.from('poei_interventions')
    .select('id, poei_id, organization_id, formateur_id, libelle, mission_status, mission_proposed_by')
    .eq('id', interventionId).single()
  if (!iv) return { success: false, error: 'Intervention introuvable' }

  const { data: formateur } = await supabase
    .from('formateurs').select('id, prenom, nom').eq('user_id', session.user.id).single()
  if (!formateur || formateur.id !== iv.formateur_id) {
    return { success: false, error: "Cette mission ne vous est pas adressée" }
  }
  if (iv.mission_status !== 'pending') return { success: false, error: "Cette mission n'est plus en attente" }

  await supabase.from('poei_interventions').update({
    mission_status: 'refused', mission_responded_at: new Date().toISOString(),
    mission_response_comment: motif || null,
  }).eq('id', interventionId)

  try {
    const { syncInterventionSession } = await import('@/lib/poei-session')
    await syncInterventionSession(supabase, interventionId)
  } catch (e) { console.error('[session intervention]', e) }

  if (iv.mission_proposed_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: iv.organization_id,
      userId: iv.mission_proposed_by,
      titre: 'Mission POEI refusée',
      message: `${formateur.prenom} ${formateur.nom} a refusé « ${iv.libelle} ». Motif : ${motif || 'non précisé'}. Affectez un autre formateur.`,
      type: 'session',
      lienUrl: `/dashboard/poei/${iv.poei_id}`,
      lienLabel: 'Voir le projet',
      entityType: 'poei',
      entityId: iv.poei_id,
    })
  }

  await logAudit({ action: 'refuse_poei_intervention', entity_type: 'poei', entity_id: iv.poei_id })
  revalidatePath('/mon-espace')
  revalidatePath(`/dashboard/poei/${iv.poei_id}`)
  return { success: true }
}
