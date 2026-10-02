'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import { fusionnerAppreciations } from '@/lib/poei-bilan-ft'

export interface GrillePayload {
  poeiId: string
  apprenantId: string
  semaine: number | null          // null = évaluation finale
  items: Record<string, { n?: string; o?: string }>
  appreciations?: Record<string, string>
  points_forts?: string
  a_renforcer?: string
  recommandations?: string
  avis_final?: string
  motivation_avis?: string
  conclusion?: string
  duree_realisee?: string
  absences?: string
  statut: 'brouillon' | 'validee'
}

/**
 * Enregistre la grille d'évaluation d'un candidat POEI pour une semaine donnée.
 * Accessible au formateur (son propre suivi) et aux gestionnaires.
 */
export async function saveGrilleAction(p: GrillePayload): Promise<ActionResult> {
  const session = await getSession()
  if (session.user.role === 'apprenant') return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  // Le formateur connecté (si c'en est un) est tracé comme évaluateur
  let formateurId: string | null = null
  if (session.user.role === 'formateur') {
    const { data: f } = await supabase.from('formateurs').select('id').eq('user_id', session.user.id).eq('organization_id', session.organization.id).maybeSingle()
    formateurId = f?.id || null
  }

  const row: Record<string, unknown> = {
    organization_id: session.organization.id,
    poei_id: p.poeiId,
    apprenant_id: p.apprenantId,
    semaine: p.semaine,
    items: p.items || {},
    appreciations: p.appreciations || {},
    points_forts: p.points_forts || null,
    a_renforcer: p.a_renforcer || null,
    recommandations: p.recommandations || null,
    avis_final: p.avis_final || null,
    motivation_avis: p.motivation_avis || null,
    conclusion: p.conclusion || null,
    duree_realisee: p.duree_realisee || null,
    absences: p.absences || null,
    statut: p.statut,
    updated_at: new Date().toISOString(),
  }
  if (formateurId) row.formateur_id = formateurId

  // Upsert sur (poei, apprenant, semaine) — semaine NULL = évaluation finale
  let q = supabase.from('poei_grilles').select('id, appreciations')
    .eq('organization_id', session.organization.id)
    .eq('poei_id', p.poeiId)
    .eq('apprenant_id', p.apprenantId)
  q = p.semaine === null ? q.is('semaine', null) : q.eq('semaine', p.semaine)
  const { data: existing } = await q.maybeSingle()

  // La signature du stagiaire sur son bilan (et son avis, une fois signé) ne
  // dépend jamais de ce que renvoie le formulaire : on garde ce qui est en base.
  row.appreciations = fusionnerAppreciations((existing as any)?.appreciations, p.appreciations)

  let error: any = null
  if (existing?.id) {
    const r = await supabase.from('poei_grilles').update(row).eq('id', existing.id)
    error = r.error
  } else {
    const r = await supabase.from('poei_grilles').insert({ ...row, created_by: session.user.id })
    error = r.error
  }
  if (error) { console.error('[grille poei]', error); return { success: false, error: "Erreur lors de l'enregistrement" } }

  await logAudit({ action: 'save', entity_type: 'poei_grille', entity_id: p.apprenantId, details: { poei: p.poeiId, semaine: p.semaine, statut: p.statut } })
  revalidatePath(`/dashboard/poei/${p.poeiId}`)
  revalidatePath('/mon-espace/poei')
  return { success: true }
}

/**
 * Rédige EN UNE PASSE les cinq rubriques du bilan à partir des notes du
 * formateur et des constats réels de la grille. L'IA propose : le gestionnaire
 * ou le formateur relit et ajuste avant enregistrement.
 */
export async function detaillerBilanAction(params: {
  poeiId: string
  apprenantId: string
  items: Record<string, { n?: string; o?: string }>
  avisFinal?: string | null
  notes: Record<string, string>
}): Promise<ActionResult & { data?: Record<string, string> }> {
  const session = await getSession()
  if (session.user.role === 'apprenant') return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: appr } = await supabase
    .from('apprenants').select('prenom, nom')
    .eq('id', params.apprenantId).eq('organization_id', session.organization.id).maybeSingle()
  const { data: poei } = await supabase
    .from('poei').select('poste_vise, formation:formation_id(intitule)')
    .eq('id', params.poeiId).eq('organization_id', session.organization.id).maybeSingle()

  const { GRILLE_SECTIONS } = await import('@/lib/poei-grille')
  const NIVEAU: Record<string, string> = { A: 'Acquis', EC: 'En cours', NA: 'Non acquis' }
  const constats = GRILLE_SECTIONS.flatMap((sec) => sec.items)
    .map((it) => {
      const v = params.items?.[it.id]
      if (!v?.n) return null
      return { label: it.label, niveau: NIVEAU[v.n] || v.n, observation: v.o || undefined }
    })
    .filter(Boolean) as { label: string; niveau: string; observation?: string }[]

  if (constats.length === 0) {
    return { success: false, error: "Évaluez d'abord les compétences : l'IA s'appuie sur la grille." }
  }

  const { detaillerBilanPoei } = await import('@/lib/ai')
  const r = await detaillerBilanPoei({
    apprenant: `${appr?.prenom || ''} ${appr?.nom || ''}`.trim() || 'Le bénéficiaire',
    formation: (poei as any)?.formation?.intitule || null,
    posteVise: (poei as any)?.poste_vise || null,
    avisFinal: params.avisFinal || null,
    constats,
    notes: params.notes || {},
  })
  if (!r.success || !r.textes) return { success: false, error: r.error || 'Échec de la génération' }

  await logAudit({ action: 'ai_bilan', entity_type: 'poei_grille', entity_id: params.apprenantId })
  return { success: true, data: r.textes as any }
}
