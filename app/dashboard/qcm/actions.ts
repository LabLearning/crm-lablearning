'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createQCMSchema, createQuestionSchema } from '@/lib/validations/evaluation'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createQCMAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createQCMSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('qcm')
    .insert({
      organization_id: session.organization.id,
      titre: parsed.data.titre,
      description: parsed.data.description || null,
      type: parsed.data.type,
      formation_id: parsed.data.formation_id || null,
      duree_minutes: parsed.data.duree_minutes || null,
      score_min_reussite: parsed.data.score_min_reussite || null,
      questions_aleatoires: parsed.data.questions_aleatoires || false,
      afficher_resultats: parsed.data.afficher_resultats ?? true,
      is_template: parsed.data.is_template || false,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'qcm', entity_id: data.id })
  revalidatePath('/dashboard/qcm')
  return { success: true, data }
}

export async function updateQCMAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createQCMSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('qcm')
    .update({
      titre: parsed.data.titre,
      description: parsed.data.description || null,
      type: parsed.data.type,
      formation_id: parsed.data.formation_id || null,
      duree_minutes: parsed.data.duree_minutes || null,
      score_min_reussite: parsed.data.score_min_reussite || null,
      questions_aleatoires: parsed.data.questions_aleatoires || false,
      afficher_resultats: parsed.data.afficher_resultats ?? true,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/qcm')
  return { success: true }
}

export async function updateQCMStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('qcm')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/qcm')
  return { success: true }
}

/** Le QCM parent doit appartenir à l'organisation de l'utilisateur */
async function assertQcmOwned(supabase: any, qcmId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase.from('qcm').select('id').eq('id', qcmId).eq('organization_id', orgId).maybeSingle()
  return !!data
}
/** Remonte du choix ou de la question jusqu'à l'organisation propriétaire */
async function qcmIdOfQuestion(supabase: any, questionId: string): Promise<string | null> {
  const { data } = await supabase.from('qcm_questions').select('qcm_id').eq('id', questionId).maybeSingle()
  return data?.qcm_id || null
}

export async function addQuestionAction(formData: FormData): Promise<ActionResult> {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createQuestionSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  // Sans auth, un anonyme pouvait modifier le contenu de n'importe quel QCM
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  if (!await assertQcmOwned(supabase, parsed.data.qcm_id, session.organization.id)) {
    return { success: false, error: 'QCM introuvable' }
  }

  // Get position
  const { data: existing } = await supabase
    .from('qcm_questions')
    .select('position')
    .eq('qcm_id', parsed.data.qcm_id)
    .order('position', { ascending: false })
    .limit(1)

  const { data, error } = await supabase
    .from('qcm_questions')
    .insert({
      qcm_id: parsed.data.qcm_id,
      texte: parsed.data.texte,
      type: parsed.data.type,
      explication: parsed.data.explication || null,
      points: parsed.data.points,
      is_required: parsed.data.is_required,
      section: parsed.data.section || null,
      position: (existing?.[0]?.position ?? -1) + 1,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur' }

  // Auto-create choices for vrai_faux
  if (parsed.data.type === 'vrai_faux') {
    await supabase.from('qcm_choix').insert([
      { question_id: data.id, texte: 'Vrai', est_correct: true, position: 0 },
      { question_id: data.id, texte: 'Faux', est_correct: false, position: 1 },
    ])
  }

  revalidatePath('/dashboard/qcm')
  return { success: true, data }
}

export async function addChoixAction(questionId: string, texte: string, estCorrect: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const qcmId = await qcmIdOfQuestion(supabase, questionId)
  if (!qcmId || !await assertQcmOwned(supabase, qcmId, session.organization.id)) {
    return { success: false, error: 'Question introuvable' }
  }

  const { data: existing } = await supabase
    .from('qcm_choix')
    .select('position')
    .eq('question_id', questionId)
    .order('position', { ascending: false })
    .limit(1)

  const { error } = await supabase.from('qcm_choix').insert({
    question_id: questionId,
    texte,
    est_correct: estCorrect,
    position: (existing?.[0]?.position ?? -1) + 1,
  })

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/qcm')
  return { success: true }
}

export async function removeQuestionAction(questionId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const qcmId = await qcmIdOfQuestion(supabase, questionId)
  if (!qcmId || !await assertQcmOwned(supabase, qcmId, session.organization.id)) {
    return { success: false, error: 'Question introuvable' }
  }
  const { error } = await supabase.from('qcm_questions').delete().eq('id', questionId)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/qcm')
  return { success: true }
}

export async function removeChoixAction(choixId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { data: choix } = await supabase.from('qcm_choix').select('question_id').eq('id', choixId).maybeSingle()
  const qcmId = choix ? await qcmIdOfQuestion(supabase, choix.question_id) : null
  if (!qcmId || !await assertQcmOwned(supabase, qcmId, session.organization.id)) {
    return { success: false, error: 'Choix introuvable' }
  }
  const { error } = await supabase.from('qcm_choix').delete().eq('id', choixId)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/qcm')
  return { success: true }
}

export async function deleteQCMAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('qcm')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (réponses existantes)' }

  await logAudit({ action: 'delete', entity_type: 'qcm', entity_id: id })
  revalidatePath('/dashboard/qcm')
  return { success: true }
}

export async function duplicateQCMAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: source } = await supabase
    .from('qcm')
    .select('*, questions:qcm_questions(*, choix:qcm_choix(*))')
    .eq('id', id)
    .single()

  if (!source) return { success: false, error: 'QCM introuvable' }

  const { data: newQcm, error } = await supabase
    .from('qcm')
    .insert({
      organization_id: session.organization.id,
      titre: `${source.titre} (copie)`,
      description: source.description,
      type: source.type,
      formation_id: source.formation_id,
      duree_minutes: source.duree_minutes,
      score_min_reussite: source.score_min_reussite,
      questions_aleatoires: source.questions_aleatoires,
      afficher_resultats: source.afficher_resultats,
      status: 'brouillon',
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error || !newQcm) return { success: false, error: 'Erreur' }

  // Duplicate questions & choices
  for (const q of source.questions || []) {
    const { data: newQ } = await supabase
      .from('qcm_questions')
      .insert({
        qcm_id: newQcm.id,
        texte: q.texte,
        type: q.type,
        explication: q.explication,
        points: q.points,
        is_required: q.is_required,
        position: q.position,
        section: q.section,
      })
      .select()
      .single()

    if (newQ && q.choix) {
      for (const c of q.choix) {
        await supabase.from('qcm_choix').insert({
          question_id: newQ.id,
          texte: c.texte,
          est_correct: c.est_correct,
          position: c.position,
        })
      }
    }
  }

  revalidatePath('/dashboard/qcm')
  return { success: true, data: newQcm }
}
