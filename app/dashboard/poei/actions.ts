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
  const montantTotal = (dureeHeures != null && montantHoraire != null)
    ? Math.round(dureeHeures * montantHoraire * 100) / 100
    : null

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
      montant_total: montantTotal,
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
  const montantTotal = (dureeHeures != null && montantHoraire != null)
    ? Math.round(dureeHeures * montantHoraire * 100) / 100 : null
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
      montant_total: montantTotal,
      numero_dossier_ft: str(formData, 'numero_dossier_ft'),
      notes: str(formData, 'notes'),
    })
    .eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

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
      identifiant_ft: str(formData, 'identifiant_ft'),
      poste_vise: str(formData, 'poste_vise'),
      type_contrat: str(formData, 'type_contrat'),
      date_embauche_prevue: str(formData, 'date_embauche_prevue'),
      statut: 'inscrit',
    })
  if (error) return { success: false, error: 'Erreur lors de l\'ajout du candidat' }

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

  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true }
}
