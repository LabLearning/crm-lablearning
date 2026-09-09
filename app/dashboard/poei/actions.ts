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
      // L'agence qui finance est declaree des la creation : c'est elle qui
      // sera facturee, la choisir plus tard exposait a facturer l'entreprise.
      agence_ft_id: str(formData, 'agence_ft_id'),
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
      agence_ft_id: str(formData, 'agence_ft_id'),
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
  const champsCandidat: Record<string, any> = {
    identifiant_ft: str(formData, "identifiant_ft"),
    poste_vise: str(formData, "poste_vise"),
    type_contrat: str(formData, "type_contrat"),
    date_embauche_prevue: str(formData, "date_embauche_prevue"),
    numero_convention: str(formData, "numero_convention"),
    entretien: str(formData, "entretien"),
    entretien_date: str(formData, "entretien_date"),
  }
  let { error } = await supabase.from("poei_candidats").update(champsCandidat)
    .eq('id', candidatId).eq('organization_id', session.organization.id)
  if (error && /entretien/.test(error.message)) {
    // Migration 137 pas encore appliquée : on sauve le reste sans bloquer.
    delete champsCandidat.entretien
    delete champsCandidat.entretien_date
    ;({ error } = await supabase.from("poei_candidats").update(champsCandidat)
      .eq('id', candidatId).eq('organization_id', session.organization.id))
  }
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

  // Contexte et textes partagés avec l'aperçu (lib/poei-emails) : ce qui est
  // prévisualisé est exactement ce qui part.
  const { contexteMailPoei, paramsAttestationEntree, enveloppeOrg, nomComplet } = await import('@/lib/poei-emails')
  const ctx = await contexteMailPoei(supabase, session.organization.id, poeiId)
  if (!ctx) return { success: false, error: 'Projet POEI introuvable' }
  const { p, formation, employeur, org, orgRaw } = ctx
  if (!formation) return { success: false, error: 'Aucune formation liée au projet' }

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
    if (!a.email) { skipped.push(nomComplet(a) || 'sans nom'); continue }

    const buffer = await renderToBuffer(createElement(AttestationEntreePDF, {
      apprenant: a, formation, org,
      dateDebut: p.date_debut, dateFin: p.date_fin, dureeHeures: p.duree_heures,
      lieu: null, formateurNom: null,
      poei: { identifiant_ft: c.identifiant_ft, poste_vise: c.poste_vise, employeur },
    }) as any)

    const { logSubject, ...params } = paramsAttestationEntree(ctx, a, custom)
    const result = await sendDocumentEmail({
      to: a.email,
      ...enveloppeOrg(org, orgRaw),
      ...params,
      pdfBuffer: Buffer.from(buffer),
    })

    await supabase.from('email_logs').insert({
      organization_id: session.organization.id,
      to_email: a.email,
      to_name: nomComplet(a) || null,
      subject: logSubject,
      template: 'attestation_entree',
      entity_type: 'poei',
      entity_id: poeiId,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : (result.error || null),
      sent_at: result.success ? new Date().toISOString() : null,
      triggered_by: session.user.id,
    })

    if (result.success) sent++
    else skipped.push(nomComplet(a))
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

  let created = 0, skipped = 0, updated = 0
  for (const c of candidats) {
    const marker = `[POEI:${poeiId}:${c.id}]`
    const nom = `${(c as any).apprenant?.prenom || ''} ${(c as any).apprenant?.nom || ''}`.trim() || 'Candidat'

    // Un devis existe déjà pour ce candidat : on le met à jour au prix courant
    // (le taux/durée du projet a pu changer) — sauf s'il est déjà accepté.
    const { data: existingDevis } = await supabase
      .from('devis').select('id, status')
      .eq('organization_id', orgId).ilike('notes_internes', `%${marker}%`).maybeSingle()
    if (existingDevis) {
      if (existingDevis.status === 'accepte') { skipped++; continue }
      await supabase.from('devis_lignes').delete().eq('devis_id', existingDevis.id)
      await supabase.from('devis_lignes').insert({
        devis_id: existingDevis.id,
        designation: `${formationNom} — ${nom}`,
        description: `Formation POEI : ${duree} h × ${taux.toLocaleString('fr-FR')} €/h`,
        quantite: duree, unite: 'heure', prix_unitaire_ht: taux, montant_ht: montantHt, position: 0,
      })
      await supabase.from('devis').update({
        montant_ht: montantHt, montant_tva: 0, montant_ttc: montantHt, remise_montant: 0,
      }).eq('id', existingDevis.id)
      updated++
      continue
    }

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

  await logAudit({ action: 'generate_devis_poei', entity_type: 'poei', entity_id: poeiId, details: { created, updated, skipped } })
  revalidatePath('/dashboard/devis')
  revalidatePath(`/dashboard/poei/${poeiId}`)
  if (created === 0 && updated === 0 && skipped > 0) return { success: true, data: { created, updated, skipped }, warning: 'Tous les devis sont déjà acceptés — aucun mis à jour.' }
  return { success: true, data: { created, updated, skipped } }
}

// ─── Agences France Travail (destinataire de facturation POEI) ────────────────

export async function listAgencesFtAction(): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { data } = await supabase.from('agences_france_travail')
    .select('*').eq('organization_id', session.organization.id).eq('is_active', true).order('nom')
  return { success: true, data: data || [] }
}

export async function createAgenceFtAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const nom = ((formData.get('nom') as string) || '').trim()
  if (!nom) return { success: false, error: 'Nom de l’agence requis' }
  const { data, error } = await supabase.from('agences_france_travail').insert({
    organization_id: session.organization.id,
    nom,
    adresse: (formData.get('adresse') as string) || null,
    code_postal: (formData.get('code_postal') as string) || null,
    ville: (formData.get('ville') as string) || null,
    siret: (formData.get('siret') as string) || null,
    tva_intra: (formData.get('tva_intra') as string) || null,
    email: (formData.get('email') as string) || null,
    telephone: (formData.get('telephone') as string) || null,
    created_by: session.user.id,
  }).select().single()
  if (error) return { success: false, error: 'Impossible de créer l’agence (migration 100 appliquée ?)' }
  return { success: true, data }
}

export async function setPoeiAgenceFtAction(poeiId: string, agenceId: string | null): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('poei')
    .update({ agence_ft_id: agenceId || null })
    .eq('id', poeiId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Impossible de rattacher l’agence' }
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true }
}

/**
 * Numéro d'engagement France Travail d'un CANDIDAT, reporté sur sa facture.
 * France Travail engage chaque candidat séparément.
 */
export async function setCandidatNumeroEngagementAction(candidatId: string, numero: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const valeur = numero.trim() || null

  const { data: cand, error } = await supabase.from('poei_candidats')
    .update({ numero_engagement: valeur })
    .eq('id', candidatId).eq('organization_id', session.organization.id)
    .select('id, poei_id').single()
  if (error || !cand) {
    console.error('[engagement candidat]', error)
    if ((error as any)?.code === '42703') return { success: false, error: 'Colonne absente : appliquer la migration 120' }
    return { success: false, error: "Impossible d'enregistrer le numéro d'engagement" }
  }

  // Report sur sa facture tant qu'elle n'est pas émise.
  const { data: fac } = await supabase.from('factures')
    .select('id, status')
    .eq('organization_id', session.organization.id)
    .ilike('notes_internes', `%[POEI-FACT:${cand.poei_id}:${candidatId}]%`)
    .maybeSingle()
  if (fac && (fac as any).status === 'brouillon') {
    await supabase.from('factures').update({ numero_engagement: valeur }).eq('id', (fac as any).id)
  }

  await logAudit({ action: 'update', entity_type: 'poei_candidat', entity_id: candidatId, details: { numero_engagement: valeur } })
  revalidatePath(`/dashboard/poei/${cand.poei_id}`)
  return { success: true }
}

/**
 * Génère une FACTURE par candidat d'un projet POEI dont la session est terminée.
 * Idempotent (marqueur dans notes_internes). TVA 0 (financeur France Travail).
 */
export async function generateFacturesPerCandidatPoeiAction(
  poeiId: string,
): Promise<ActionResult & { data?: { created: number; updated: number; skipped: number; supprimees?: number; orphelinesEmises?: number } }> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select('id, client_id, formation_id, session_id, duree_heures, montant_horaire, statut, formation:formations(intitule)')
    .eq('id', poeiId).eq('organization_id', orgId).single()
  if (!poei) return { success: false, error: 'Projet introuvable' }
  if (!poei.client_id) return { success: false, error: 'Aucune entreprise liée au projet' }
  if (!(Number(poei.montant_horaire) > 0) || !(Number(poei.duree_heures) > 0)) {
    return { success: false, error: 'Renseignez le taux horaire et la durée du projet avant de facturer' }
  }
  // La facturation intervient après réalisation : statut POEI terminé, session
  // terminée, ou date de fin passée (le statut de session peut être en retard).
  let finie = (poei as any).statut === 'terminee'
  if (!finie && poei.session_id) {
    const { data: se } = await supabase.from('sessions').select('status, date_fin').eq('id', poei.session_id).maybeSingle()
    finie = !!se && (se.status === 'terminee' || (!!se.date_fin && new Date(se.date_fin) < new Date()))
  }
  if (!finie) return { success: false, error: 'La formation doit être terminée pour générer les factures' }

  // Agence France Travail destinataire (lecture résiliente : colonne absente avant migration 100)
  let agenceFtId: string | null = null
  {
    const { data: pex } = await supabase.from('poei').select('agence_ft_id').eq('id', poeiId).maybeSingle()
    agenceFtId = (pex as any)?.agence_ft_id || null
  }
  // À défaut, l'unique agence active de l'organisation : une facture POEI est
  // adressée à France Travail, jamais à l'entreprise.
  if (!agenceFtId) {
    const { data: ags } = await supabase.from('agences_france_travail')
      .select('id').eq('organization_id', orgId).eq('is_active', true).limit(2)
    if ((ags || []).length === 1) agenceFtId = ags![0].id
  }

  // Lecture résiliente : les colonnes d'abandon n'existent qu'après la
  // migration 140 — sans elles, tout le monde est facturé plein temps.
  let candidats: any[] | null = null
  {
    const r = await supabase.from('poei_candidats')
      .select('id, numero_engagement, statut, heures_effectuees, date_abandon, apprenant:apprenants(nom, prenom)')
      .eq('poei_id', poeiId).order('created_at', { ascending: true })
    if (r.error) {
      const r2 = await supabase.from('poei_candidats')
        .select('id, numero_engagement, statut, apprenant:apprenants(nom, prenom)')
        .eq('poei_id', poeiId).order('created_at', { ascending: true })
      candidats = r2.data
    } else candidats = r.data
  }
  if (!candidats || candidats.length === 0) return { success: false, error: 'Aucun candidat à facturer' }

  const duree = Number(poei.duree_heures)
  const taux = Number(poei.montant_horaire)
  const formationNom = (poei as any).formation?.intitule || 'Formation POEI'
  const today = new Date().toISOString().slice(0, 10)
  const echeance = new Date(); echeance.setDate(echeance.getDate() + 60)

  // Heures facturables d'un candidat : le prorata du temps passé en cas
  // d'abandon (modèle France Travail), la durée du projet sinon.
  const heuresDe = (c: any) =>
    c.statut === 'abandonne' && c.heures_effectuees != null ? Number(c.heures_effectuees) : duree

  const applyLigneEtTotaux = async (factureId: string, nom: string, c: any) => {
    const heures = heuresDe(c)
    const montantHt = Math.round(heures * taux * 100) / 100
    const abandon = c.statut === 'abandonne' && c.heures_effectuees != null
    await supabase.from('facture_lignes').delete().eq('facture_id', factureId)
    // Présentation identique à la facture France Travail : une ligne au nom du
    // participant, le temps de présence en sous-titre, quantité 1 et le montant
    // total en prix unitaire (et non le taux horaire).
    await supabase.from('facture_lignes').insert({
      facture_id: factureId,
      designation: nom,
      description: `Temps de présence : ${heures.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}${abandon ? ` sur ${duree.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} prévues — abandon${c.date_abandon ? ` le ${new Date(c.date_abandon).toLocaleDateString('fr-FR')}` : ''}, facturation au prorata` : ''}`,
      quantite: 1, unite: 'forfait', prix_unitaire_ht: montantHt, montant_ht: montantHt, position: 0,
    })
    // TVA 0 → HT = TTC = restant
    await supabase.from('factures').update({
      montant_ht: montantHt, montant_tva: 0, montant_ttc: montantHt, remise_montant: 0, montant_restant: montantHt,
      ...(agenceFtId ? { agence_ft_id: agenceFtId } : {}),
    }).eq('id', factureId)
  }

  // Un candidat retiré du dossier ne doit pas laisser sa facture derrière lui.
  // Tant qu'elle est en brouillon on la supprime ; émise, on la laisse (elle a
  // une existence légale) et on le signale à l'appelant.
  let supprimees = 0, orphelinesEmises = 0
  {
    const vivants = new Set((candidats || []).map((c: any) => c.id))
    const { data: existantes } = await supabase.from('factures')
      .select('id, status, notes_internes')
      .eq('organization_id', orgId)
      .ilike('notes_internes', `%[POEI-FACT:${poeiId}:%`)
    for (const f of existantes || []) {
      const m = String((f as any).notes_internes).match(/\[POEI-FACT:[0-9a-f-]+:([0-9a-f-]+)\]/i)
      if (!m || vivants.has(m[1])) continue
      if ((f as any).status === 'brouillon') {
        await supabase.from('facture_lignes').delete().eq('facture_id', (f as any).id)
        await supabase.from('factures').delete().eq('id', (f as any).id)
        supprimees++
      } else orphelinesEmises++
    }
  }

  let created = 0, updated = 0, skipped = 0
  for (const c of candidats) {
    const nom = `${(c as any).apprenant?.prenom || ''} ${(c as any).apprenant?.nom || ''}`.trim() || 'Candidat'
    const marker = `[POEI-FACT:${poeiId}:${c.id}]`
    const { data: existing } = await supabase.from('factures')
      .select('id, status').eq('organization_id', orgId).ilike('notes_internes', `%${marker}%`).maybeSingle()
    if (existing) {
      // On ne retouche pas une facture déjà émise/envoyée/payée
      if (['emise', 'envoyee', 'payee_partiellement', 'payee'].includes(existing.status)) { skipped++; continue }
      await applyLigneEtTotaux(existing.id, nom, c)
      updated++
      continue
    }
    // Numéro laissé au trigger : une seule série FA-<année>-<4 chiffres>,
    // continue avec celle reprise de Dendreo (cf. migration 117).
    const { data: fac, error } = await supabase.from('factures').insert({
      organization_id: orgId, type: 'facture', client_id: poei.client_id,
      session_id: poei.session_id || null,
      objet: `Formation « ${formationNom} »`,
      status: 'brouillon', date_emission: today, date_echeance: echeance.toISOString().slice(0, 10),
      taux_tva: 0, financeur_type: 'france_travail',
      agence_ft_id: agenceFtId,
      subrogation: true,
      ...((c as any).numero_engagement ? { numero_engagement: (c as any).numero_engagement } : {}),
      conditions_paiement: 'à 60 jours à compter de la date de facture',
      notes_internes: `Facture POEI (candidat ${nom}). ${marker}`,
      created_by: session.user.id,
    }).select('id').single()
    if (error || !fac) continue
    await applyLigneEtTotaux(fac.id, nom, c)
    created++
  }

  await logAudit({ action: 'generate_factures_poei', entity_type: 'poei', entity_id: poeiId, details: { created, updated, skipped } })
  revalidatePath('/dashboard/factures')
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { created, updated, skipped, supprimees, orphelinesEmises } }
}

/**
 * Devis PRÉVISIONNEL d'un projet POEI, SANS candidat : sert à faire valider
 * le coût de la formation par France Travail AVANT le recrutement. 1 ligne
 * (formation × taux horaire × durée), TVA 0. Idempotent (un seul prévisionnel
 * par projet). `nbCandidats` (optionnel) permet un devis pour plusieurs places.
 */
export async function generateDevisPrevisionnelPoeiAction(
  poeiId: string,
  nbCandidats = 1,
): Promise<ActionResult & { data?: { devisId: string } }> {
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
    return { success: false, error: 'Renseignez le taux horaire et la durée du projet avant de générer le devis' }
  }

  const duree = Number(poei.duree_heures)
  const taux = Number(poei.montant_horaire)
  const places = Math.max(1, Number(nbCandidats) || 1)
  const montantUnitaire = Math.round(duree * taux * 100) / 100
  const montantHt = Math.round(montantUnitaire * places * 100) / 100
  const formationNom = (poei as any).formation?.intitule || 'Formation POEI'
  const today = new Date().toISOString().slice(0, 10)
  const validite = new Date(); validite.setDate(validite.getDate() + 30)

  const ligne = {
    designation: `${formationNom}${places > 1 ? ` — ${places} places` : ''}`,
    description: `Formation POEI : ${duree} h × ${taux.toLocaleString('fr-FR')} €/h${places > 1 ? ` × ${places} candidats` : ''}`,
    quantite: places > 1 ? places : duree,
    unite: places > 1 ? 'candidat' : 'heure',
    prix_unitaire_ht: places > 1 ? montantUnitaire : taux,
    montant_ht: montantHt, position: 0,
  }

  const marker = `[POEI:${poeiId}:previsionnel]`
  const { data: existing } = await supabase
    .from('devis').select('id, status').eq('organization_id', orgId).ilike('notes_internes', `%${marker}%`).maybeSingle()
  // Un prévisionnel existe déjà : on le remet au prix courant (sauf s'il est accepté)
  if (existing) {
    if (existing.status === 'accepte') return { success: true, data: { devisId: existing.id }, warning: 'Le devis prévisionnel est déjà accepté.' }
    await supabase.from('devis_lignes').delete().eq('devis_id', existing.id)
    await supabase.from('devis_lignes').insert({ devis_id: existing.id, ...ligne })
    await supabase.from('devis').update({
      objet: `POEI — Devis prévisionnel${places > 1 ? ` (${places} places)` : ''} — ${formationNom}`,
      montant_ht: montantHt, montant_tva: 0, montant_ttc: montantHt, remise_montant: 0,
    }).eq('id', existing.id)
    await logAudit({ action: 'update_devis_previsionnel_poei', entity_type: 'poei', entity_id: poeiId, details: { devisId: existing.id, places } })
    revalidatePath('/dashboard/devis')
    revalidatePath(`/dashboard/poei/${poeiId}`)
    return { success: true, data: { devisId: existing.id } }
  }

  const { data: devis, error } = await supabase
    .from('devis')
    .insert({
      organization_id: orgId, numero: '', client_id: poei.client_id, formation_id: poei.formation_id,
      objet: `POEI — Devis prévisionnel${places > 1 ? ` (${places} places)` : ''} — ${formationNom}`,
      // Émis directement (dossier destiné à France Travail), comme les devis POEI
      // par candidat : pas de statut brouillon.
      status: 'envoye', date_emission: today, date_validite: validite.toISOString().slice(0, 10),
      sent_at: new Date().toISOString(),
      taux_tva: 0, remise_pourcent: 0,
      notes_internes: `Devis prévisionnel POEI (sans candidat, validation France Travail). ${marker}`,
      created_by: session.user.id,
    })
    .select('id').single()
  if (error || !devis) return { success: false, error: 'Impossible de créer le devis' }

  await supabase.from('devis_lignes').insert({ devis_id: devis.id, ...ligne })
  await supabase.from('devis').update({
    montant_ht: montantHt, montant_tva: 0, montant_ttc: montantHt, remise_montant: 0,
  }).eq('id', devis.id)

  await logAudit({ action: 'generate_devis_previsionnel_poei', entity_type: 'poei', entity_id: poeiId, details: { devisId: devis.id, places } })
  revalidatePath('/dashboard/devis')
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { devisId: devis.id } }
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

  // Contexte, variables et textes partagés avec l'aperçu (lib/poei-emails).
  const { contexteMailPoei, paramsMessageLibre, enveloppeOrg, nomComplet } = await import('@/lib/poei-emails')
  const ctx = await contexteMailPoei(supabase, orgId, poeiId)
  if (!ctx) return { success: false, error: 'Projet POEI introuvable' }
  const { p, formation, employeur, org, orgRaw } = ctx
  const { sendDocumentEmail } = await import('@/lib/email')

  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('id, identifiant_ft, poste_vise, apprenant:apprenants(id, civilite, prenom, nom, email, entreprise, date_naissance)')
    .in('id', candidatIds)
    .eq('organization_id', orgId)

  let sent = 0
  const skipped: string[] = []
  for (const c of candidats || []) {
    const a: any = c.apprenant
    if (!a) { skipped.push('candidat sans fiche apprenant'); continue }
    if (!a.email) { skipped.push(nomComplet(a) || 'sans nom'); continue }

    const params = paramsMessageLibre(ctx, a, payload)

    // Pièce jointe optionnelle : attestation d'entrée du candidat
    let pdfBuffer: Buffer | undefined
    if (params.pdfFilename) {
      try {
        const { renderToBuffer } = await import('@react-pdf/renderer')
        const { createElement } = await import('react')
        const { AttestationEntreePDF } = await import('@/lib/pdf/attestation-entree-pdf')
        const buf = await renderToBuffer(createElement(AttestationEntreePDF, {
          apprenant: a, formation, org,
          dateDebut: p.date_debut, dateFin: p.date_fin, dureeHeures: p.duree_heures,
          lieu: null, formateurNom: null,
          poei: { identifiant_ft: c.identifiant_ft, poste_vise: c.poste_vise, employeur },
        }) as any)
        pdfBuffer = Buffer.from(buf)
      } catch (e) { console.error('[mail groupé — attestation]', e) }
    }

    const result = await sendDocumentEmail({
      to: a.email,
      ...enveloppeOrg(org, orgRaw),
      ...params,
      pdfFilename: pdfBuffer ? params.pdfFilename : undefined,
      pdfBuffer,
      extraAttachments: payload.attachments,
    })

    await supabase.from('email_logs').insert({
      organization_id: orgId,
      to_email: a.email,
      to_name: nomComplet(a) || null,
      subject: params.subject,
      template: 'poei_groupe',
      entity_type: 'poei',
      entity_id: poeiId,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : (result.error || null),
      sent_at: result.success ? new Date().toISOString() : null,
      triggered_by: session.user.id,
    })

    if (result.success) sent++
    else skipped.push(nomComplet(a))
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
    lieu: str(formData, 'lieu'), adresse: str(formData, 'adresse'),
    code_postal: str(formData, 'code_postal'), ville: str(formData, 'ville'),
    horaires: str(formData, 'horaires'),
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
    lieu: str(formData, 'lieu'), adresse: str(formData, 'adresse'),
    code_postal: str(formData, 'code_postal'), ville: str(formData, 'ville'),
    horaires: str(formData, 'horaires'),
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
      organizationId: session.organization.id,
      entityType: 'poei_intervention',
      entityId: interventionId,
      triggeredBy: session.user.id,
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
    } else if (token && existing?.status !== 'signe_formateur') {
      // Renvoi du lien : validité prolongée de 30 jours
      const expires = new Date(); expires.setDate(expires.getDate() + 30)
      await supabase.from('contrats_formateur')
        .update({ signature_token_expires_at: expires.toISOString() })
        .eq('id', existing.id)
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

/**
 * Déclare l'ABANDON d'un candidat POEI : statut, date, heures réellement
 * effectuées et motif — puis recalcule sa facture au prorata du temps passé
 * (modèle France Travail : on ne facture que les heures suivies). La facture
 * n'est retouchée que tant qu'elle est en brouillon ; émise, on signale qu'un
 * avoir ou une correction manuelle s'impose. Le questionnaire d'abandon
 * (PROC-12) est préparé pour l'apprenant dans la foulée.
 */
export async function declarerAbandonCandidatAction(
  candidatId: string,
  poeiId: string,
  formData: FormData,
): Promise<ActionResult & { warning?: string }> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const dateAbandon = String(formData.get('date_abandon') || '').trim() || new Date().toISOString().slice(0, 10)
  const heures = parseFloat(String(formData.get('heures_effectuees') || '').replace(',', '.'))
  const motif = String(formData.get('motif_abandon') || '').trim() || null
  if (!(heures >= 0)) return { success: false, error: 'Indiquez les heures réellement effectuées (0 accepté)' }

  const { data: cand } = await supabase.from('poei_candidats')
    .select('id, poei_id, apprenant_id, inscription_id, apprenant:apprenants(prenom, nom)')
    .eq('id', candidatId).eq('organization_id', orgId).maybeSingle()
  if (!cand || cand.poei_id !== poeiId) return { success: false, error: 'Candidat introuvable' }

  const { data: poei } = await supabase.from('poei')
    .select('id, session_id, duree_heures, montant_horaire')
    .eq('id', poeiId).eq('organization_id', orgId).maybeSingle()
  if (!poei) return { success: false, error: 'Projet introuvable' }
  const dureeProjet = Number(poei.duree_heures) || 0
  if (dureeProjet && heures > dureeProjet) {
    return { success: false, error: `Les heures effectuées (${heures}) dépassent la durée du projet (${dureeProjet} h)` }
  }

  // 1. Le candidat
  const { error: eCand } = await supabase.from('poei_candidats').update({
    statut: 'abandonne',
    date_abandon: dateAbandon,
    heures_effectuees: heures,
    motif_abandon: motif,
  }).eq('id', candidatId)
  if (eCand) {
    if ((eCand as any).code === '42703') return { success: false, error: 'Colonnes absentes : appliquer la migration 140_abandon_candidat_poei.sql' }
    return { success: false, error: eCand.message }
  }

  // 2. L'inscription liée suit le même statut
  if (cand.inscription_id) {
    await supabase.from('inscriptions').update({
      status: 'abandonne', date_annulation: dateAbandon, motif_annulation: motif || 'Abandon en cours de POEI',
    }).eq('id', cand.inscription_id)
  }

  // 3. La facture du candidat, au prorata
  let warning: string | undefined
  const taux = Number(poei.montant_horaire) || 0
  if (taux > 0) {
    const montantProrata = Math.round(heures * taux * 100) / 100
    const marker = `[POEI-FACT:${poeiId}:${candidatId}]`
    const { data: fac } = await supabase.from('factures')
      .select('id, status').eq('organization_id', orgId).ilike('notes_internes', `%${marker}%`).maybeSingle()
    if (fac) {
      if (fac.status === 'brouillon') {
        const nom = `${(cand as any).apprenant?.prenom || ''} ${(cand as any).apprenant?.nom || ''}`.trim() || 'Candidat'
        await supabase.from('facture_lignes').delete().eq('facture_id', fac.id)
        await supabase.from('facture_lignes').insert({
          facture_id: fac.id,
          designation: nom,
          description: `Temps de présence : ${heures.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}${dureeProjet ? ` sur ${dureeProjet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} prévues` : ''} — abandon le ${new Date(dateAbandon).toLocaleDateString('fr-FR')}, facturation au prorata`,
          quantite: 1, unite: 'forfait', prix_unitaire_ht: montantProrata, montant_ht: montantProrata, position: 0,
        })
        await supabase.from('factures').update({
          montant_ht: montantProrata, montant_tva: 0, montant_ttc: montantProrata, montant_restant: montantProrata,
        }).eq('id', fac.id)
      } else {
        warning = 'La facture de ce candidat est déjà émise : prévoir un avoir ou une correction manuelle.'
      }
    }
  }

  // 4. Le questionnaire d'abandon (PROC-12), préparé pour l'apprenant
  try {
    if (cand.apprenant_id && poei.session_id) {
      const { data: qcm } = await supabase.from('qcm')
        .select('id').eq('organization_id', orgId).eq('type', 'abandon').limit(1).maybeSingle()
      if (qcm) {
        let { data: jalon } = await supabase.from('qcm_sessions')
          .select('id').eq('session_id', poei.session_id).eq('qcm_id', qcm.id).limit(1).maybeSingle()
        if (!jalon) {
          const { data: cree } = await supabase.from('qcm_sessions')
            .insert({ organization_id: orgId, qcm_id: qcm.id, session_id: poei.session_id })
            .select('id').single()
          jalon = cree
        }
        if (jalon) {
          const { data: deja } = await supabase.from('qcm_reponses')
            .select('id').eq('qcm_session_id', jalon.id).eq('apprenant_id', cand.apprenant_id).limit(1).maybeSingle()
          if (!deja) {
            const { randomBytes } = await import('crypto')
            await supabase.from('qcm_reponses').insert({
              organization_id: orgId, qcm_id: qcm.id, qcm_session_id: jalon.id,
              session_id: poei.session_id, apprenant_id: cand.apprenant_id,
              token: randomBytes(24).toString('hex'), is_complete: false,
            })
          }
        }
      }
    }
  } catch { /* le questionnaire est un plus, pas un bloqueur */ }

  await logAudit({
    action: 'abandon_candidat_poei', entity_type: 'poei_candidat', entity_id: candidatId,
    details: { poei_id: poeiId, date_abandon: dateAbandon, heures_effectuees: heures, motif },
  })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  revalidatePath('/dashboard/factures')
  return { success: true, warning }
}
