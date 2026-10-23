'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { getPortalContext } from '@/lib/portal-auth'
import type { ActionResult } from '@/lib/types'
import { FACTURE_MODELES } from '@/lib/pdf/facture-modeles'

const DOSSIERS_BUCKET = 'dossiers'
const MODELE_VALUES = FACTURE_MODELES.map((m) => m.value) as string[]

async function resolveFormateur(token: string | null) {
  const supabase = await createServiceRoleClient()
  if (token) {
    const ctx = await getPortalContext(token)
    if (ctx && ctx.type === 'formateur') {
      return { supabase, formateurId: ctx.formateur.id as string, orgId: ctx.organization.id as string }
    }
  }
  try {
    const session = await getSession()
    if (session.user.role !== 'formateur') return null
    const { data: f } = await supabase.from('formateurs').select('id').eq('user_id', session.user.id).single()
    if (!f) return null
    return { supabase, formateurId: f.id as string, orgId: session.organization.id as string }
  } catch {
    return null
  }
}

/**
 * Le formateur dépose sa facture de prestation (montant + PDF optionnel) et
 * l'envoie à l'organisme. Créée directement en statut « envoyée ».
 */
export async function submitFactureFormateurAction(formData: FormData): Promise<ActionResult> {
  const token = (formData.get('token') as string) || null
  const ctx = await resolveFormateur(token)
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { supabase, formateurId, orgId } = ctx

  const montantHt = Number(((formData.get('montant_ht') as string) || '').replace(',', '.'))
  if (!Number.isFinite(montantHt) || montantHt <= 0) return { success: false, error: 'Montant HT invalide' }
  const tauxTva = Number(((formData.get('taux_tva') as string) || '0').replace(',', '.')) || 0
  const montantTva = Math.round(montantHt * (tauxTva / 100) * 100) / 100
  const montantTtc = Math.round((montantHt + montantTva) * 100) / 100
  const sessionId = (formData.get('session_id') as string) || null
  const objet = ((formData.get('objet') as string) || '').trim() || null
  const referenceExterne = ((formData.get('reference_externe') as string) || '').trim() || null

  // Une facture rattachée à une session compte aussitôt comme coût formateur de
  // cette session (rentabilité, commission franchise) : seulement les siennes,
  // comme le propose l'écran Facturation
  if (sessionId) {
    const { data: sienne } = await supabase.from('sessions').select('id')
      .eq('id', sessionId).eq('formateur_id', formateurId).eq('organization_id', orgId).maybeSingle()
    if (!sienne) return { success: false, error: 'Cette session ne vous est pas confiée : facture non envoyée' }
  }

  // Fichier (PDF de la facture du formateur) — optionnel
  let fichierUrl: string | null = null
  let fichierNom: string | null = null
  const file = formData.get('file')
  if (file && typeof file !== 'string' && (file as File).size > 0) {
    const f = file as File
    if (f.size > 15 * 1024 * 1024) return { success: false, error: 'Fichier trop volumineux (max 15 Mo)' }
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `factures-formateur/${formateurId}/${Date.now()}-${safe}`
    const buf = Buffer.from(await f.arrayBuffer())
    const { error: upErr } = await supabase.storage.from(DOSSIERS_BUCKET).upload(path, buf, { contentType: f.type || 'application/pdf', upsert: false })
    if (upErr) return { success: false, error: 'Échec du téléversement du fichier' }
    fichierUrl = path
    fichierNom = f.name
  }

  // Numéro interne de suivi (le formateur garde sa propre numérotation via reference_externe)
  const { count } = await supabase.from('factures_formateur').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
  const numero = `FF-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { error } = await supabase.from('factures_formateur').insert({
    organization_id: orgId,
    formateur_id: formateurId,
    numero,
    reference_externe: referenceExterne,
    session_id: sessionId,
    montant_ht: montantHt,
    taux_tva: tauxTva,
    montant_tva: montantTva,
    montant_ttc: montantTtc,
    objet,
    fichier_url: fichierUrl,
    fichier_nom: fichierNom,
    status: 'envoyee',
    submitted_at: new Date().toISOString(),
  })
  if (error) return { success: false, error: "Erreur lors de l'envoi de la facture" }

  revalidatePath('/mon-espace/facturation')
  if (token) revalidatePath(`/portail/${token}/facturation`)
  return { success: true }
}

/** Le formateur choisit le style (modèle) de ses factures de prestation. */
export async function updateFactureModeleAction(modele: string, token: string | null): Promise<ActionResult> {
  const ctx = await resolveFormateur(token)
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  if (!MODELE_VALUES.includes(modele)) return { success: false, error: 'Modèle invalide' }
  const { error } = await ctx.supabase.from('formateurs').update({ facture_modele: modele }).eq('id', ctx.formateurId)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour du modèle' }
  revalidatePath('/mon-espace/facturation')
  if (token) revalidatePath(`/portail/${token}/facturation`)
  return { success: true }
}

export async function deleteFactureFormateurAction(id: string, token: string | null): Promise<ActionResult> {
  const ctx = await resolveFormateur(token)
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { supabase, formateurId } = ctx

  const { data: fac } = await supabase
    .from('factures_formateur').select('id, formateur_id, status, fichier_url').eq('id', id).maybeSingle()
  if (!fac || fac.formateur_id !== formateurId) return { success: false, error: 'Facture introuvable' }
  if (['validee', 'payee'].includes(fac.status)) return { success: false, error: 'Une facture validée ou payée ne peut être supprimée' }

  await supabase.from('factures_formateur').delete().eq('id', id)
  if (fac.fichier_url && !/^https?:\/\//.test(fac.fichier_url)) {
    await supabase.storage.from(DOSSIERS_BUCKET).remove([fac.fichier_url])
  }
  revalidatePath('/mon-espace/facturation')
  if (token) revalidatePath(`/portail/${token}/facturation`)
  return { success: true }
}
