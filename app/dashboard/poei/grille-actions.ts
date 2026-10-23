'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import type { ActionResult } from '@/lib/types'
import { fusionnerAppreciations } from '@/lib/poei-bilan-ft'

// L'équipe POEI : les rôles de canManage (./actions), avec l'accès au module
const EQUIPE_POEI = ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial']
// Plafond d'une grille reçue, en caractères JSON : très au-delà d'une grille réelle
const TAILLE_MAX_GRILLE = 500_000
// Rédactions par l'IA permises à un même compte sur une heure glissante
const REDACTIONS_IA_PAR_HEURE = 40

type Session = Awaited<ReturnType<typeof getSession>>

/**
 * Qui peut évaluer ce candidat : l'équipe POEI, ou le formateur qui intervient
 * sur ce dossier (même règle que les incidents). Tout autre compte est refusé,
 * et le stagiaire doit être un candidat du dossier. Ce module est embarqué
 * dans /mon-espace/poei, où le garde central du tableau de bord ne joue pas.
 *
 * Renvoie le formateur à tracer comme évaluateur (null pour l'équipe), ou
 * null quand l'accès est refusé.
 */
async function peutEvaluer(
  supabase: any, session: Session, poeiId: unknown, apprenantId: unknown,
): Promise<{ formateurId: string | null } | null> {
  if (typeof poeiId !== 'string' || !poeiId || typeof apprenantId !== 'string' || !apprenantId) return null
  const orgId = session.organization.id

  let formateurId: string | null = null
  if (session.user.role === 'formateur') {
    const { data: f } = await supabase.from('formateurs').select('id')
      .eq('user_id', session.user.id).eq('organization_id', orgId).maybeSingle()
    if (!f) return null
    const { data: itv } = await supabase.from('poei_interventions').select('id')
      .eq('poei_id', poeiId).eq('formateur_id', f.id).eq('organization_id', orgId).limit(1)
    if (!itv || itv.length === 0) return null
    formateurId = f.id
  } else if (!EQUIPE_POEI.includes(session.user.role)
    || !checkDashboardAccess('/dashboard/poei', session.user.role as any, session.permissions).allowed) {
    return null
  }

  const { data: candidat } = await supabase.from('poei_candidats').select('id')
    .eq('poei_id', poeiId).eq('organization_id', orgId).eq('apprenant_id', apprenantId).limit(1)
  if (!candidat || candidat.length === 0) return null
  return { formateurId }
}

const objet = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {})
const texte = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

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
 * Accessible au formateur qui intervient sur le dossier (son propre suivi) et
 * à l'équipe POEI.
 */
export async function saveGrilleAction(p: GrillePayload): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Un candidat du dossier, par l'équipe POEI ou par un formateur qui y
  // intervient ; le formateur connecté (si c'en est un) est tracé comme évaluateur
  const droit = await peutEvaluer(supabase, session, p?.poeiId, p?.apprenantId)
  if (!droit) return { success: false, error: 'Accès non autorisé' }
  const formateurId = droit.formateurId

  // Une grille par semaine (1 à 52) et une évaluation finale (semaine vide), au statut connu
  const semaine = p.semaine ?? null
  if (semaine !== null && !(Number.isInteger(semaine) && semaine >= 1 && semaine <= 52)) {
    return { success: false, error: 'Semaine invalide' }
  }
  if (p.statut !== 'brouillon' && p.statut !== 'validee') return { success: false, error: 'Statut invalide' }
  if (JSON.stringify(p).length > TAILLE_MAX_GRILLE) return { success: false, error: 'Grille trop volumineuse' }

  const row: Record<string, unknown> = {
    organization_id: session.organization.id,
    poei_id: p.poeiId,
    apprenant_id: p.apprenantId,
    semaine,
    items: objet(p.items),
    appreciations: objet(p.appreciations),
    points_forts: texte(p.points_forts),
    a_renforcer: texte(p.a_renforcer),
    recommandations: texte(p.recommandations),
    avis_final: texte(p.avis_final),
    motivation_avis: texte(p.motivation_avis),
    conclusion: texte(p.conclusion),
    duree_realisee: texte(p.duree_realisee),
    absences: texte(p.absences),
    statut: p.statut,
    updated_at: new Date().toISOString(),
  }
  if (formateurId) row.formateur_id = formateurId

  // Upsert sur (poei, apprenant, semaine) — semaine NULL = évaluation finale
  let q = supabase.from('poei_grilles').select('id, appreciations')
    .eq('organization_id', session.organization.id)
    .eq('poei_id', p.poeiId)
    .eq('apprenant_id', p.apprenantId)
  q = semaine === null ? q.is('semaine', null) : q.eq('semaine', semaine)
  const { data: existing } = await q.maybeSingle()

  // La signature du stagiaire sur son bilan (et son avis, une fois signé) ne
  // dépend jamais de ce que renvoie le formulaire : on garde ce qui est en base.
  row.appreciations = fusionnerAppreciations((existing as any)?.appreciations, objet(p.appreciations))

  let error: any = null
  if (existing?.id) {
    const r = await supabase.from('poei_grilles').update(row).eq('id', existing.id)
    error = r.error
  } else {
    const r = await supabase.from('poei_grilles').insert({ ...row, created_by: session.user.id })
    error = r.error
  }
  if (error) { console.error('[grille poei]', error); return { success: false, error: "Erreur lors de l'enregistrement" } }

  await logAudit({ action: 'save', entity_type: 'poei_grille', entity_id: p.apprenantId, details: { poei: p.poeiId, semaine, statut: p.statut } })
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
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // Même règle que la grille : l'équipe POEI, ou un formateur du dossier, sur un candidat du dossier
  if (!(await peutEvaluer(supabase, session, params?.poeiId, params?.apprenantId))) {
    return { success: false, error: 'Accès non autorisé' }
  }

  const [{ count: redactionsRecentes }, { data: appr }, { data: poei }] = await Promise.all([
    // Rédactions déjà lancées par ce compte sur l'heure écoulée. Le journal
    // note l'auteur réel (l'administrateur quand il emprunte un compte).
    supabase.from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', session.impersonatedBy?.id || session.user.id)
      .eq('action', 'ai_bilan')
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString()),
    supabase.from('apprenants').select('prenom, nom')
      .eq('id', params.apprenantId).eq('organization_id', orgId).maybeSingle(),
    supabase.from('poei').select('poste_vise, formation:formation_id(intitule)')
      .eq('id', params.poeiId).eq('organization_id', orgId).maybeSingle(),
  ])
  // Chaque rédaction est un appel payant : un même compte en lance un nombre borné par heure
  if ((redactionsRecentes || 0) >= REDACTIONS_IA_PAR_HEURE) {
    return { success: false, error: 'Vous avez demandé beaucoup de rédactions en une heure : réessayez un peu plus tard.' }
  }
  // Le dossier est établi par le contrôle de candidat ci-dessus ; le stagiaire doit exister ici
  if (!appr) return { success: false, error: 'Candidat introuvable' }

  // Textes envoyés à l'IA bornés : notes du formateur, observations et avis
  const coupe = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  const notes = Object.fromEntries(
    ['points_forts', 'a_renforcer', 'recommandations', 'motivation_avis', 'conclusion']
      .map((cle) => [cle, coupe(params.notes?.[cle], 2000)]),
  )

  const { GRILLE_SECTIONS } = await import('@/lib/poei-grille')
  const NIVEAU: Record<string, string> = { A: 'Acquis', EC: 'En cours', NA: 'Non acquis' }
  const constats = GRILLE_SECTIONS.flatMap((sec) => sec.items)
    .map((it) => {
      const v = params.items?.[it.id]
      if (!v?.n) return null
      return { label: it.label, niveau: NIVEAU[v.n] || coupe(v.n, 20), observation: coupe(v.o, 500) || undefined }
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
    avisFinal: coupe(params.avisFinal, 100) || null,
    constats,
    notes,
  })
  if (!r.success || !r.textes) return { success: false, error: r.error || 'Échec de la génération' }

  await logAudit({ action: 'ai_bilan', entity_type: 'poei_grille', entity_id: params.apprenantId })
  return { success: true, data: r.textes as any }
}
