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

// Statuts du vivier (const locale : un fichier 'use server' n'exporte que des fonctions async)
const VIVIER_STATUTS = ['nouveau', 'qualifie', 'presente', 'retenu', 'valide', 'refuse', 'vivier'] as const

// Cible de rattachement : "poei:<id>" (projet créé) ou "prev:<id>" (à planifier)
function parseTarget(v: string | null): { poei_id: string | null; poei_prevision_id: string | null } {
  if (v && v.startsWith('poei:')) return { poei_id: v.slice(5), poei_prevision_id: null }
  if (v && v.startsWith('prev:')) return { poei_id: null, poei_prevision_id: v.slice(5) }
  return { poei_id: null, poei_prevision_id: null }
}

// Champs identité + sourcing repris du FormData (création / mise à jour)
function candidatFields(fd: FormData) {
  return {
    civilite: str(fd, 'civilite'),
    prenom: str(fd, 'prenom') || '',
    nom: str(fd, 'nom') || '',
    sexe: str(fd, 'sexe'),
    email: str(fd, 'email'),
    telephone: str(fd, 'telephone'),
    date_naissance: str(fd, 'date_naissance'),
    lieu_naissance: str(fd, 'lieu_naissance'),
    numero_securite_sociale: str(fd, 'numero_securite_sociale'),
    adresse: str(fd, 'adresse'),
    code_postal: str(fd, 'code_postal'),
    ville: str(fd, 'ville'),
    type_contrat: str(fd, 'type_contrat'),
    source: str(fd, 'source'),
    disponibilite: str(fd, 'disponibilite'),
    permis: fd.get('permis') === 'true',
    notes: str(fd, 'notes'),
    client_id: str(fd, 'client_id'),
    ...parseTarget(str(fd, 'poei_target')),
    poste_vise: str(fd, 'poste_vise'),
    identifiant_ft: str(fd, 'identifiant_ft'),
  }
}

export async function createCandidatVivierAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const f = candidatFields(formData)
  if (!f.nom || !f.prenom) return { success: false, errors: { nom: ['Nom et prénom requis'] } }

  const { data, error } = await supabase
    .from('candidats_vivier')
    .insert({
      organization_id: session.organization.id,
      ...f,
      statut: str(formData, 'statut') || 'nouveau',
      created_by: session.user.id,
    })
    .select('id').single()
  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'candidat_vivier', entity_id: data.id })
  revalidatePath('/dashboard/vivier')
  return { success: true, data }
}

export async function updateCandidatVivierAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const f = candidatFields(formData)
  if (!f.nom || !f.prenom) return { success: false, errors: { nom: ['Nom et prénom requis'] } }

  const { error } = await supabase
    .from('candidats_vivier')
    .update({ ...f, statut: str(formData, 'statut') || undefined, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'candidat_vivier', entity_id: id })
  revalidatePath('/dashboard/vivier')
  return { success: true }
}

export async function updateCandidatVivierStatutAction(id: string, statut: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!VIVIER_STATUTS.includes(statut as any)) return { success: false, error: 'Statut invalide' }
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('candidats_vivier')
    .update({ statut, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/vivier')
  return { success: true }
}

export async function assignCandidatToPoeiAction(id: string, target: string | null): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { poei_id, poei_prevision_id } = parseTarget(target)
  // La cible doit appartenir à l'organisation
  if (poei_id) {
    const { data } = await supabase.from('poei').select('id').eq('id', poei_id).eq('organization_id', orgId).maybeSingle()
    if (!data) return { success: false, error: 'Projet POEI introuvable' }
  }
  if (poei_prevision_id) {
    const { data } = await supabase.from('poei_previsions').select('id').eq('id', poei_prevision_id).eq('organization_id', orgId).maybeSingle()
    if (!data) return { success: false, error: 'Prévision introuvable' }
  }

  const { error } = await supabase
    .from('candidats_vivier')
    .update({ poei_id, poei_prevision_id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/vivier')
  revalidatePath('/dashboard/poei')
  return { success: true }
}

export async function deleteCandidatVivierAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('candidats_vivier')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la suppression' }
  revalidatePath('/dashboard/vivier')
  return { success: true }
}

/**
 * Valide un candidat du vivier : crée l'apprenant, l'inscrit au projet POEI
 * rattaché (poei_candidat + inscription si session), et bascule le candidat en
 * statut « validé ». Nécessite un projet POEI cible.
 */
export async function validerCandidatVivierAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const { data: cand } = await supabase
    .from('candidats_vivier').select('*').eq('id', id).eq('organization_id', orgId).single()
  if (!cand) return { success: false, error: 'Candidat introuvable' }
  if (cand.apprenant_id) return { success: false, error: 'Candidat déjà validé' }
  if (!cand.poei_id) {
    return {
      success: false,
      error: cand.poei_prevision_id
        ? 'Ce POEI est encore « à planifier ». Transformez d\'abord la prévision en projet POEI, puis validez le candidat.'
        : 'Rattachez d\'abord le candidat à un projet POEI.',
    }
  }

  const { data: poei } = await supabase
    .from('poei').select('id, session_id, client_id, duree_heures, montant_horaire, client:clients(raison_sociale)')
    .eq('id', cand.poei_id).eq('organization_id', orgId).single()
  if (!poei) return { success: false, error: 'Projet POEI introuvable' }

  // 1) Créer l'apprenant à partir de l'identité du candidat
  const { data: app, error: appErr } = await supabase
    .from('apprenants')
    .insert({
      organization_id: orgId,
      civilite: cand.civilite, prenom: cand.prenom, nom: cand.nom, sexe: cand.sexe,
      email: cand.email, telephone: cand.telephone,
      date_naissance: cand.date_naissance, lieu_naissance: cand.lieu_naissance,
      numero_securite_sociale: cand.numero_securite_sociale,
      adresse: cand.adresse, code_postal: cand.code_postal, ville: cand.ville,
      type_contrat: cand.type_contrat,
      client_id: cand.client_id || poei.client_id,
      entreprise: (poei as any).client?.raison_sociale || null,
    })
    .select('id').single()
  if (appErr || !app) return { success: false, error: 'Erreur création apprenant' }

  // 2) Inscription à la session du projet (émargement / évaluations)
  let inscription_id: string | null = null
  if (poei.session_id) {
    const { data: ins } = await supabase
      .from('inscriptions')
      .insert({ organization_id: orgId, session_id: poei.session_id, apprenant_id: app.id, status: 'inscrit', financeur_type: 'france_travail' })
      .select('id').single()
    inscription_id = ins?.id || null
  }

  // 3) Candidat du projet POEI
  await supabase.from('poei_candidats').insert({
    organization_id: orgId,
    poei_id: poei.id,
    apprenant_id: app.id,
    inscription_id,
    identifiant_ft: cand.identifiant_ft,
    poste_vise: cand.poste_vise,
    type_contrat: cand.type_contrat,
    statut: 'inscrit',
  })

  // 4) Recalcul du montant du projet (taux × heures × nb candidats)
  const { count } = await supabase
    .from('poei_candidats').select('*', { count: 'exact', head: true }).eq('poei_id', poei.id)
  if (poei.duree_heures != null && poei.montant_horaire != null) {
    const total = Math.round(Number(poei.duree_heures) * Number(poei.montant_horaire) * (count || 0) * 100) / 100
    await supabase.from('poei').update({ montant_total: total }).eq('id', poei.id)
  }

  // 5) Émargement des interventions à jour
  try {
    const { syncCandidatsSurInterventions } = await import('@/lib/poei-session')
    await syncCandidatsSurInterventions(supabase, poei.id, orgId)
  } catch (e) { console.error('[sync candidats interventions]', e) }

  // 6) Le candidat sort du vivier (validé)
  await supabase
    .from('candidats_vivier')
    .update({ statut: 'valide', apprenant_id: app.id, valide_at: new Date().toISOString() })
    .eq('id', id)

  await logAudit({ action: 'valider_candidat_vivier', entity_type: 'candidat_vivier', entity_id: id, details: { poei_id: poei.id, apprenant_id: app.id } })
  revalidatePath('/dashboard/vivier')
  revalidatePath(`/dashboard/poei/${poei.id}`)
  return { success: true, data: { apprenantId: app.id, poeiId: poei.id } }
}

// Pastilles d'évaluation recruteur
const EVALUATIONS = ['top', 'bon', 'moyen', 'a_tester', 'a_ecarter'] as const

/** Définit / retire la pastille d'évaluation d'un candidat. */
export async function updateCandidatEvaluationAction(id: string, evaluation: string | null): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (evaluation && !EVALUATIONS.includes(evaluation as any)) return { success: false, error: 'Évaluation invalide' }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('candidats_vivier')
    .update({ evaluation: evaluation || null, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/vivier')
  return { success: true }
}

/** Téléverse le CV d'un candidat (bucket privé documents). */
export async function uploadCandidatCvAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const id = str(formData, 'id')
  if (!id) return { success: false, error: 'Candidat manquant' }
  const { data: cand } = await supabase.from('candidats_vivier').select('id, cv_url').eq('id', id).eq('organization_id', session.organization.id).maybeSingle()
  if (!cand) return { success: false, error: 'Candidat introuvable' }

  const file = formData.get('file')
  if (!file || typeof file === 'string' || (file as File).size === 0) return { success: false, error: 'Fichier manquant' }
  const f = file as File
  if (f.size > 15 * 1024 * 1024) return { success: false, error: 'Fichier trop volumineux (max 15 Mo)' }
  const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `vivier-cv/${session.organization.id}/${id}/${Date.now()}-${safe}`
  const buffer = Buffer.from(await f.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('documents').upload(path, buffer, { contentType: f.type || 'application/pdf', upsert: false })
  if (upErr) return { success: false, error: 'Échec du téléversement' }

  // Remplace l'ancien CV si présent
  if (cand.cv_url && !/^https?:\/\//.test(cand.cv_url)) await supabase.storage.from('documents').remove([cand.cv_url])

  const { error } = await supabase.from('candidats_vivier')
    .update({ cv_url: path, cv_nom: f.name, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur enregistrement' }
  revalidatePath('/dashboard/vivier')
  return { success: true }
}

/** Supprime le CV d'un candidat. */
export async function deleteCandidatCvAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data: cand } = await supabase.from('candidats_vivier').select('cv_url').eq('id', id).eq('organization_id', session.organization.id).maybeSingle()
  if (!cand) return { success: false, error: 'Candidat introuvable' }
  await supabase.from('candidats_vivier').update({ cv_url: null, cv_nom: null }).eq('id', id).eq('organization_id', session.organization.id)
  if (cand.cv_url && !/^https?:\/\//.test(cand.cv_url)) await supabase.storage.from('documents').remove([cand.cv_url])
  revalidatePath('/dashboard/vivier')
  return { success: true }
}

/**
 * Enregistre l'entretien de présélection téléphonique d'un candidat
 * (lib/entretien-candidat.ts, migration 171) : rôles du vivier, candidat de
 * l'organisation, contenu remis en forme avant d'être stocké.
 */
export async function enregistrerEntretienCandidatAction(id: string, entretien: unknown): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const { nettoyerEntretien, totalEntretien } = await import('@/lib/entretien-candidat')
  const propre = nettoyerEntretien(entretien)
  if (!propre.recruteur.trim()) propre.recruteur = `${session.user.first_name || ''} ${session.user.last_name || ''}`.trim()

  const supabase = await createServiceRoleClient()
  const maintenant = new Date().toISOString()
  const { data, error } = await supabase
    .from('candidats_vivier')
    .update({ entretien: propre, entretien_le: maintenant, updated_at: maintenant })
    .eq('id', id).eq('organization_id', session.organization.id)
    .select('id')
  if (error) {
    if ((error as any).code === '42703') return { success: false, error: 'Colonne absente : appliquer la migration 171_vivier_entretien.sql' }
    return { success: false, error: 'Enregistrement impossible' }
  }
  if (!data?.length) return { success: false, error: 'Candidat introuvable' }

  const { total, notes } = totalEntretien(propre)
  await logAudit({ action: 'entretien_candidat_vivier', entity_type: 'candidat_vivier', entity_id: id, details: { decision: propre.decision, total, criteres_notes: notes } })
  revalidatePath('/dashboard/vivier')
  revalidatePath('/dashboard/poei')
  return { success: true }
}
