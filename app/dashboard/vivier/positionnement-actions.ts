'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { peutGererVivier } from '@/lib/vivier-acces'
import type { ActionResult } from '@/lib/types'
import { buildDocumentEmailHtml, sendDocumentEmail } from '@/lib/email'
import {
  evaluerPositionnement, questionnaireDuPositionnement, questionnairePourParcours,
  type CodeQuestionnaire, type Questionnaire, type Reponses, type ResultatPositionnement,
} from '@/lib/poei-positionnement'
import { contenuMailPositionnement, enveloppePositionnement, lienPositionnement, SLUG_MAIL_POSITIONNEMENT } from '@/lib/positionnement-mail'

/**
 * Questionnaire de positionnement envoyé depuis le vivier de candidats
 * (demande de Brahim du 18/11/2026) : dès qu'un candidat est rattaché à un
 * projet POEI, avant même sa validation. Le projet fixe le questionnaire
 * (concept de l'enseigne) et la durée du parcours sur laquelle les heures se
 * répartissent. À la validation, le positionnement suit le candidat dans la
 * fiche du projet (validerCandidatVivierAction).
 */

const MIGRATION = 'Appliquez la migration 173_positionnement_vivier.sql pour envoyer le questionnaire depuis le vivier.'
const migrationAbsente = (e: any) =>
  !!e && (['42703', 'PGRST204', 'PGRST205', '42P01'].includes(String(e.code)) || /vivier_candidat_id/.test(String(e.message || '')))

const COLONNES = 'id, token, statut, poei_id, candidat_id, vivier_candidat_id, envoye_le, complete_le, reponses, resultats, note, maitrise_globale, heures_preconisees'

/** Résumé affiché sur la ligne du candidat */
export interface EtatPositionnementVivier {
  statut: 'envoye' | 'complete'
  envoyeLe: string | null
  completeLe: string | null
  justes: number | null
  total: number | null
  maitrise: number | null
  heures: number | null
}

/** Tout ce que montre le suivi d'un candidat : contexte, aperçu du mail, résultat, envois */
export interface DetailPositionnementVivier {
  migration: boolean
  /** Ce qui empêche l'envoi, en clair */
  blocage: string | null
  candidat: { nom: string; email: string | null }
  projet: { id: string; numero: string | null; employeur: string | null; duree: number | null } | null
  questionnaire: { code: CodeQuestionnaire; titre: string; nbQuestions: number; nbDomaines: number } | null
  positionnement: {
    statut: 'envoye' | 'complete'
    envoyeLe: string | null
    completeLe: string | null
    lien: string
    poeiId: string
    questionnaire: CodeQuestionnaire
    reponses: Reponses | null
    resultat: ResultatPositionnement | null
  } | null
  apercu: { to: string; subject: string; html: string } | null
  mails: { date: string; to: string; statut: string }[]
}

async function autorise() {
  const session = await getSession()
  if (!peutGererVivier(session.user.role)) return null
  return session
}

/** Candidat du vivier, son projet POEI et le questionnaire de son concept */
async function contexte(supabase: any, orgId: string, vivierId: string) {
  const { data: cand } = await supabase.from('candidats_vivier')
    .select('id, prenom, nom, email, poei_id, poei_prevision_id, apprenant_id')
    .eq('id', vivierId).eq('organization_id', orgId).maybeSingle()
  if (!cand) return null
  let poei: any = null
  if (cand.poei_id) {
    const { data } = await supabase.from('poei')
      .select('id, numero, duree_heures, formation:formations(intitule), client:client_id(raison_sociale, nom_commercial)')
      .eq('id', cand.poei_id).eq('organization_id', orgId).maybeSingle()
    poei = data
  }
  const employeur: string | null = poei ? (poei.client?.nom_commercial || poei.client?.raison_sociale || null) : null
  const q: Questionnaire | null = poei ? questionnairePourParcours({ formation: poei.formation?.intitule, entreprise: employeur }) : null
  const nom = `${cand.prenom || ''} ${cand.nom || ''}`.trim() || 'Candidat'
  const blocage = poei ? null
    : cand.poei_prevision_id
      ? "Le candidat est rattaché à un POEI « à planifier ». Le questionnaire part dès qu'il est rattaché au projet POEI, qui fixe l'enseigne et la durée du parcours."
      : "Rattachez d'abord le candidat à un projet POEI : le questionnaire dépend de l'enseigne et de la durée du parcours."
  return { cand, poei, employeur, q, nom, blocage }
}

/**
 * Positionnement du candidat : envoyé depuis le vivier, ou depuis la fiche du
 * projet s'il est déjà validé. Renvoie aussi son candidat de projet, s'il existe.
 */
async function existant(supabase: any, orgId: string, cand: any) {
  const { data: pos, error } = await supabase.from('poei_positionnements')
    .select(COLONNES).eq('organization_id', orgId).eq('vivier_candidat_id', cand.id).maybeSingle()
  if (error) return { pos: null, poeiCandidatId: null as string | null, error }
  let poeiCandidatId: string | null = null
  if (cand.apprenant_id && cand.poei_id) {
    const { data: pc } = await supabase.from('poei_candidats').select('id')
      .eq('poei_id', cand.poei_id).eq('apprenant_id', cand.apprenant_id).eq('organization_id', orgId).maybeSingle()
    poeiCandidatId = pc?.id || null
    if (!pos && poeiCandidatId) {
      const { data: p2 } = await supabase.from('poei_positionnements').select(COLONNES)
        .eq('organization_id', orgId).eq('candidat_id', poeiCandidatId).maybeSingle()
      if (p2) return { pos: p2, poeiCandidatId, error: null }
    }
  }
  return { pos, poeiCandidatId, error: null }
}

/** Pastilles de la liste : un résumé par candidat du vivier qui a reçu le questionnaire */
export async function etatsPositionnementsVivierAction(): Promise<ActionResult<{ migration: boolean; etats: Record<string, EtatPositionnementVivier> }>> {
  const session = await autorise()
  if (!session) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase.from('poei_positionnements')
    .select('vivier_candidat_id, statut, envoye_le, complete_le, maitrise_globale, heures_preconisees, justes:resultats->justes, total:resultats->nbQuestions')
    .eq('organization_id', session.organization.id)
    .not('vivier_candidat_id', 'is', null)
  if (error) {
    if (migrationAbsente(error)) return { success: true, data: { migration: false, etats: {} } }
    return { success: false, error: 'Lecture impossible' }
  }
  const etats: Record<string, EtatPositionnementVivier> = {}
  for (const p of (data || []) as any[]) {
    etats[p.vivier_candidat_id] = {
      statut: p.statut === 'complete' ? 'complete' : 'envoye',
      envoyeLe: p.envoye_le || null,
      completeLe: p.complete_le || null,
      justes: p.justes != null ? Number(p.justes) : null,
      total: p.total != null ? Number(p.total) : null,
      maitrise: p.maitrise_globale != null ? Number(p.maitrise_globale) : null,
      heures: p.heures_preconisees != null ? Number(p.heures_preconisees) : null,
    }
  }
  return { success: true, data: { migration: true, etats } }
}

/** Suivi d'un candidat : contexte, aperçu du mail avant envoi, résultat et envois passés. N'écrit rien. */
export async function detailPositionnementVivierAction(vivierId: string): Promise<ActionResult<DetailPositionnementVivier>> {
  const session = await autorise()
  if (!session) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()
  const ctx = await contexte(supabase, orgId, vivierId)
  if (!ctx) return { success: false, error: 'Candidat introuvable' }
  const { cand, poei, employeur, q, nom } = ctx

  const ex = await existant(supabase, orgId, cand)
  const migration = !(ex.error && migrationAbsente(ex.error))
  if (ex.error && migration) return { success: false, error: 'Lecture impossible' }
  const pos: any = ex.pos

  let positionnement: DetailPositionnementVivier['positionnement'] = null
  if (pos) {
    const qPos = questionnaireDuPositionnement(pos.resultats, pos.reponses, q || questionnairePourParcours({}))
    // Les résultats figés font foi ; recalcul seulement pour une ligne ancienne qui n'en aurait pas
    const resultat: ResultatPositionnement | null = pos.statut === 'complete'
      ? (pos.resultats?.domaines ? pos.resultats : evaluerPositionnement(pos.reponses || {}, qPos, poei?.duree_heures))
      : null
    positionnement = {
      statut: pos.statut === 'complete' ? 'complete' : 'envoye',
      envoyeLe: pos.envoye_le || null,
      completeLe: pos.complete_le || null,
      lien: lienPositionnement(pos.token),
      poeiId: pos.poei_id,
      questionnaire: qPos.code,
      reponses: pos.reponses || null,
      resultat,
    }
  }

  // Aperçu du mail tel qu'il partira : même gabarit, mêmes textes que l'envoi réel
  let apercu: DetailPositionnementVivier['apercu'] = null
  if (q && cand.email && pos?.statut !== 'complete') {
    const { data: org } = await supabase.from('organizations').select('*').eq('id', orgId).single()
    const lien = pos ? lienPositionnement(pos.token) : `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/positionnement/apercu/${q.code}`
    const contenu = contenuMailPositionnement(q, employeur, lien)
    apercu = {
      to: cand.email,
      subject: contenu.subject,
      html: buildDocumentEmailHtml({ ...enveloppePositionnement(org), recipientName: nom, ...contenu }),
    }
  }

  // Envois passés : depuis le vivier, et depuis la fiche du projet une fois validé
  const cibles = [`and(entity_type.eq.candidat_vivier,entity_id.eq.${cand.id})`]
  if (ex.poeiCandidatId) cibles.push(`and(entity_type.eq.poei_candidat,entity_id.eq.${ex.poeiCandidatId})`)
  const { data: logs } = await supabase.from('email_logs')
    .select('to_email, status, created_at, sent_at')
    .eq('organization_id', orgId).eq('template', SLUG_MAIL_POSITIONNEMENT)
    .or(cibles.join(','))
    .order('created_at', { ascending: false }).limit(20)

  return {
    success: true,
    data: {
      migration,
      blocage: !migration ? MIGRATION : ctx.blocage,
      candidat: { nom, email: cand.email || null },
      projet: poei ? { id: poei.id, numero: poei.numero || null, employeur, duree: poei.duree_heures != null ? Number(poei.duree_heures) : null } : null,
      questionnaire: q ? { code: q.code, titre: q.titre, nbQuestions: q.questions.length, nbDomaines: q.domaines.length } : null,
      positionnement,
      apercu,
      mails: ((logs || []) as any[]).map((l) => ({ date: l.sent_at || l.created_at, to: l.to_email, statut: l.status })),
    },
  }
}

/**
 * Envoie le questionnaire au candidat (ou le renvoie). Sans email en fiche,
 * crée seulement son lien personnel, à transmettre par SMS ou WhatsApp.
 * Un candidat qui a déjà répondu n'est jamais relancé : ses réponses restent.
 */
export async function envoyerPositionnementVivierAction(vivierId: string): Promise<ActionResult<{ lien: string; mail: boolean }>> {
  const session = await autorise()
  if (!session) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()
  const ctx = await contexte(supabase, orgId, vivierId)
  if (!ctx) return { success: false, error: 'Candidat introuvable' }
  const { cand, poei, employeur, q, nom } = ctx
  if (!poei || !q) return { success: false, error: ctx.blocage || 'Projet POEI introuvable' }

  const ex = await existant(supabase, orgId, cand)
  if (ex.error) return { success: false, error: migrationAbsente(ex.error) ? MIGRATION : 'Lecture impossible' }
  const pos: any = ex.pos
  if (pos?.statut === 'complete') return { success: false, error: 'Ce candidat a déjà répondu : ses réponses sont conservées.' }

  const maintenant = new Date().toISOString()
  let token: string
  if (pos) {
    const maj: Record<string, any> = { envoye_le: maintenant, vivier_candidat_id: cand.id }
    // Rattaché depuis à un autre projet, et pas encore validé : le questionnaire suit le projet
    if (!pos.candidat_id && pos.poei_id !== poei.id) maj.poei_id = poei.id
    if (!pos.candidat_id && ex.poeiCandidatId) maj.candidat_id = ex.poeiCandidatId
    const { error } = await supabase.from('poei_positionnements').update(maj).eq('id', pos.id).eq('organization_id', orgId)
    if (error) return { success: false, error: migrationAbsente(error) ? MIGRATION : 'Mise à jour impossible' }
    token = pos.token
  } else {
    const { data: cree, error } = await supabase.from('poei_positionnements').insert({
      organization_id: orgId, poei_id: poei.id, vivier_candidat_id: cand.id,
      candidat_id: ex.poeiCandidatId, statut: 'envoye', envoye_le: maintenant,
    }).select('token').single()
    if (error || !cree) {
      console.error('[positionnement vivier]', error)
      return { success: false, error: migrationAbsente(error) ? MIGRATION : 'Création du questionnaire impossible' }
    }
    token = cree.token
  }

  const lien = lienPositionnement(token)
  let mail = false
  if (cand.email) {
    const { data: org } = await supabase.from('organizations').select('*').eq('id', orgId).single()
    const r = await sendDocumentEmail({
      to: cand.email,
      ...enveloppePositionnement(org),
      recipientName: nom,
      ...contenuMailPositionnement(q, employeur, lien),
      organizationId: orgId,
      entityType: 'candidat_vivier',
      entityId: cand.id,
      triggeredBy: session.user.id,
    })
    if (!r.success) {
      revalidatePath('/dashboard/poei')
      return { success: false, error: `Le lien est créé mais le mail n'est pas parti (${r.error || 'erreur d’envoi'}). Copiez le lien pour le transmettre.` }
    }
    mail = true
  }

  await logAudit({ action: 'envoi_positionnement_vivier', entity_type: 'candidat_vivier', entity_id: cand.id, details: { poei_id: poei.id, mail } })
  revalidatePath('/dashboard/vivier')
  revalidatePath('/dashboard/poei')
  revalidatePath(`/dashboard/poei/${poei.id}`)
  return { success: true, data: { lien, mail } }
}

/**
 * Efface les réponses d'un candidat et lui renvoie un questionnaire neuf :
 * quand il a répondu à côté, ou qu'un autre a répondu à sa place.
 */
export async function reinitialiserPositionnementVivierAction(vivierId: string): Promise<ActionResult<{ lien: string; mail: boolean }>> {
  const session = await autorise()
  if (!session) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()
  const ctx = await contexte(supabase, orgId, vivierId)
  if (!ctx) return { success: false, error: 'Candidat introuvable' }
  const ex = await existant(supabase, orgId, ctx.cand)
  if (ex.error) return { success: false, error: migrationAbsente(ex.error) ? MIGRATION : 'Lecture impossible' }
  if (!ex.pos) return { success: false, error: 'Aucun questionnaire à effacer' }
  const { error } = await supabase.from('poei_positionnements').delete().eq('id', (ex.pos as any).id).eq('organization_id', orgId)
  if (error) return { success: false, error: 'Suppression impossible' }
  await logAudit({ action: 'reinitialisation_positionnement_vivier', entity_type: 'candidat_vivier', entity_id: ctx.cand.id, details: { poei_id: (ex.pos as any).poei_id } })
  return envoyerPositionnementVivierAction(vivierId)
}
