'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createFormationSchema } from '@/lib/validations/formation'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

function splitLines(text: string | undefined): string[] {
  if (!text) return []
  // Retire une puce/tiret éventuel en début de ligne (les champs tableau restent propres)
  return text.split('\n').map((l) => l.replace(/^\s*[•\-*]\s*/, '').trim()).filter(Boolean)
}

export async function createFormationAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createFormationSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServiceRoleClient()

  // Auto-génération de la référence : max des suffixes existants de l'année + 1
  // (robuste aux suppressions — évite les doublons contrairement à un simple count)
  let ref = parsed.data.reference
  if (!ref) {
    const prefix = `FOR-${new Date().getFullYear()}-`
    const { data: existing } = await supabase
      .from('formations')
      .select('reference')
      .eq('organization_id', session.organization.id)
      .like('reference', `${prefix}%`)
    let maxNum = 0
    for (const row of existing || []) {
      const m = String(row.reference || '').match(/(\d+)$/)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    }
    ref = `${prefix}${String(maxNum + 1).padStart(3, '0')}`
  }

  const { data, error } = await supabase
    .from('formations')
    .insert({
      organization_id: session.organization.id,
      reference: ref,
      intitule: parsed.data.intitule,
      sous_titre: parsed.data.sous_titre || null,
      categorie: parsed.data.categorie || null,
      analyse_besoin: parsed.data.analyse_besoin || null,
      besoin_valide: parsed.data.besoin_valide === true,
      besoin_valide_par: parsed.data.besoin_valide === true ? session.user.id : null,
      besoin_valide_at: parsed.data.besoin_valide === true ? new Date().toISOString() : null,
      objectifs_pedagogiques: splitLines(parsed.data.objectifs_pedagogiques),
      prerequis: parsed.data.prerequis || null,
      public_vise: parsed.data.public_vise || null,
      programme_detaille: parsed.data.programme_detaille || null,
      competences_visees: splitLines(parsed.data.competences_visees),
      modalite: parsed.data.modalite,
      duree_heures: parsed.data.duree_heures,
      duree_jours: parsed.data.duree_jours || null,
      methodes_pedagogiques: parsed.data.methodes_pedagogiques || null,
      moyens_techniques: parsed.data.moyens_techniques || null,
      modalites_evaluation: parsed.data.modalites_evaluation || null,
      modalites_admission: parsed.data.modalites_admission || null,
      accessibilite_handicap: parsed.data.accessibilite_handicap || null,
      tarif_inter_ht: parsed.data.tarif_inter_ht || null,
      tarif_intra_ht: parsed.data.tarif_intra_ht || null,
      tarif_individuel_ht: parsed.data.tarif_individuel_ht || null,
      tva_applicable: parsed.data.tva_applicable ?? true,
      taux_tva: parsed.data.taux_tva || 20,
      est_certifiante: parsed.data.est_certifiante || false,
      code_rncp: parsed.data.code_rncp || null,
      code_rs: parsed.data.code_rs || null,
      certificateur: parsed.data.certificateur || null,
      is_published: parsed.data.is_published || false,
      is_poei: parsed.data.is_poei || false,
      branches: formData.getAll('branches').map(String).filter(Boolean),
      est_transverse: !!parsed.data.est_transverse,
      site_publie: !!parsed.data.site_publie,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('[Create Formation]', error)
    return { success: false, error: 'Erreur lors de la création' }
  }

  await logAudit({ action: 'create', entity_type: 'formation', entity_id: data.id })
  revalidatePath('/dashboard/formations')
  return { success: true, data }
}

export async function updateFormationAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createFormationSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServiceRoleClient()

  // Fetch current version for history
  const { data: current } = await supabase
    .from('formations')
    .select('version, historique_versions, programme_detaille')
    .eq('id', id)
    .single()

  const newVersion = (current?.version || 1) + 1
  const history = [...(current?.historique_versions || []), {
    version: current?.version || 1,
    date: new Date().toISOString(),
    modified_by: session.user.id,
  }]

  const { error } = await supabase
    .from('formations')
    .update({
      reference: parsed.data.reference || undefined,
      intitule: parsed.data.intitule,
      sous_titre: parsed.data.sous_titre || null,
      categorie: parsed.data.categorie || null,
      analyse_besoin: parsed.data.analyse_besoin || null,
      besoin_valide: parsed.data.besoin_valide === true,
      besoin_valide_par: parsed.data.besoin_valide === true ? session.user.id : null,
      besoin_valide_at: parsed.data.besoin_valide === true ? new Date().toISOString() : null,
      objectifs_pedagogiques: splitLines(parsed.data.objectifs_pedagogiques),
      prerequis: parsed.data.prerequis || null,
      public_vise: parsed.data.public_vise || null,
      programme_detaille: parsed.data.programme_detaille || null,
      competences_visees: splitLines(parsed.data.competences_visees),
      modalite: parsed.data.modalite,
      duree_heures: parsed.data.duree_heures,
      duree_jours: parsed.data.duree_jours || null,
      methodes_pedagogiques: parsed.data.methodes_pedagogiques || null,
      moyens_techniques: parsed.data.moyens_techniques || null,
      modalites_evaluation: parsed.data.modalites_evaluation || null,
      modalites_admission: parsed.data.modalites_admission || null,
      accessibilite_handicap: parsed.data.accessibilite_handicap || null,
      tarif_inter_ht: parsed.data.tarif_inter_ht || null,
      tarif_intra_ht: parsed.data.tarif_intra_ht || null,
      tarif_individuel_ht: parsed.data.tarif_individuel_ht || null,
      tva_applicable: parsed.data.tva_applicable ?? true,
      taux_tva: parsed.data.taux_tva || 20,
      est_certifiante: parsed.data.est_certifiante || false,
      code_rncp: parsed.data.code_rncp || null,
      code_rs: parsed.data.code_rs || null,
      certificateur: parsed.data.certificateur || null,
      is_published: parsed.data.is_published || false,
      is_poei: parsed.data.is_poei || false,
      branches: formData.getAll('branches').map(String).filter(Boolean),
      est_transverse: !!parsed.data.est_transverse,
      site_publie: !!parsed.data.site_publie,
      version: newVersion,
      date_derniere_maj: new Date().toISOString().split('T')[0],
      historique_versions: history,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'formation', entity_id: id, details: { version: newVersion } })
  revalidatePath('/dashboard/formations')
  return { success: true }
}

export async function toggleFormationAction(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('formations')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/formations')
  return { success: true }
}

/**
 * Supprime une formation. Ses conventions partent avec elle (clé en cascade),
 * et avec elles leurs avenants et leur journal de signature : une formation qui
 * porte une convention signée (statut signé, ou signature électronique
 * enregistrée) ne se supprime donc pas, elle se désactive. L'image de signature
 * n'est pas chargée, les conventions sont seulement comptées.
 */
export async function deleteFormationAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { count: signees, error: eSignees } = await supabase
    .from('conventions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)
    .eq('formation_id', id)
    .or('status.in.(signee_client,signee_complete),signature_client_signature_data.not.is.null')
  if (eSignees) return { success: false, error: 'Vérification des conventions de la formation impossible : réessayez dans un instant' }
  if (signees) {
    return {
      success: false,
      error: signees > 1
        ? `Suppression impossible : ${signees} conventions signées sont rattachées à cette formation. Elles seraient supprimées avec elle, signatures et journal de signature compris. Désactivez-la si elle ne doit plus être proposée.`
        : 'Suppression impossible : 1 convention signée est rattachée à cette formation. Elle serait supprimée avec elle, signature et journal de signature compris. Désactivez-la si elle ne doit plus être proposée.',
    }
  }

  const { error } = await supabase
    .from('formations')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (sessions liées)' }

  await logAudit({ action: 'delete', entity_type: 'formation', entity_id: id })
  revalidatePath('/dashboard/formations')
  return { success: true }
}
