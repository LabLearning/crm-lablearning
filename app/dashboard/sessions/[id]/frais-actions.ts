'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { peutVoirMarge, MESSAGE_MIGRATION_FRAIS } from '@/lib/rentabilite'
import { fraisSchema } from '@/lib/validations/frais'
import type { ActionResult } from '@/lib/types'

// Vercel refuse toute requête au-delà de 4,5 Mo, formulaire compris : la
// limite annoncée reste en deçà, sinon l'envoi échoue sans message utile.
const TAILLE_MAX = 4 * 1024 * 1024
const TYPES_ACCEPTES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const BUCKET = 'documents'

const tableAbsente = (e: any) => ['PGRST205', '42P01'].includes(String(e?.code))

async function contexte() {
  const session = await getSession()
  if (!peutVoirMarge(session.user.role)) return null
  const supabase = await createServiceRoleClient()
  return { session, supabase, orgId: session.organization.id }
}

function lireSaisie(formData: FormData) {
  const raw: Record<string, unknown> = {}
  for (const cle of ['categorie', 'libelle', 'montant', 'date_frais', 'formateur_id', 'notes']) {
    const v = formData.get(cle)
    if (typeof v === 'string') raw[cle] = v
  }
  return fraisSchema.safeParse(raw)
}

function fichierJoint(formData: FormData): File | null {
  const f = formData.get('justificatif')
  return f && typeof f === 'object' && 'size' in f && (f as File).size > 0 ? (f as File) : null
}

function verifierFichier(f: File): string | null {
  if (f.size > TAILLE_MAX) return 'Justificatif trop lourd (4 Mo maximum)'
  if (!TYPES_ACCEPTES[f.type]) return 'Justificatif au format PDF, JPG, PNG ou WebP uniquement'
  return null
}

async function deposer(supabase: any, orgId: string, sessionId: string, f: File): Promise<{ chemin: string } | { erreur: string }> {
  const chemin = `${orgId}/sessions/${sessionId}/frais/${Date.now()}.${TYPES_ACCEPTES[f.type]}`
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, Buffer.from(await f.arrayBuffer()), {
    contentType: f.type,
    upsert: false,
  })
  if (error) {
    console.error('[frais justificatif]', error.message)
    return { erreur: 'Dépôt du justificatif impossible' }
  }
  return { chemin }
}

async function formateurDeLOrg(supabase: any, orgId: string, formateurId: string | undefined): Promise<boolean> {
  if (!formateurId) return true
  const { data } = await supabase.from('formateurs').select('id').eq('id', formateurId).eq('organization_id', orgId).maybeSingle()
  return !!data
}

function revalider() {
  // Couvre la session du frais et la porteuse d'un parcours POEI
  revalidatePath('/dashboard/sessions/[id]', 'page')
  revalidatePath('/dashboard/rentabilite')
}

/** Ajoute un frais annexe à une session, avec son justificatif éventuel. */
export async function ajouterFraisAction(sessionId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { session, supabase, orgId } = ctx

  const { data: sess } = await supabase.from('sessions').select('id').eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const parsed = lireSaisie(formData)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  if (!(await formateurDeLOrg(supabase, orgId, parsed.data.formateur_id))) return { success: false, errors: { formateur_id: ['Formateur introuvable'] } }

  // Table absente : on le dit avant de déposer le moindre fichier
  // Lecture réelle plutôt que HEAD : sur une table absente, une requête sans
  // corps revient en 204 sans erreur, la migration manquante passerait inaperçue.
  const sonde = await supabase.from('session_frais').select('id').eq('organization_id', orgId).limit(1)
  if (sonde.error) {
    if (tableAbsente(sonde.error)) return { success: false, error: MESSAGE_MIGRATION_FRAIS }
    console.error('[frais ajout]', sonde.error)
    return { success: false, error: 'Enregistrement impossible' }
  }

  const fichier = fichierJoint(formData)
  let chemin: string | null = null
  if (fichier) {
    const erreur = verifierFichier(fichier)
    if (erreur) return { success: false, errors: { justificatif: [erreur] } }
    const depot = await deposer(supabase, orgId, sessionId, fichier)
    if ('erreur' in depot) return { success: false, error: depot.erreur }
    chemin = depot.chemin
  }

  const { data, error } = await supabase.from('session_frais').insert({
    organization_id: orgId,
    session_id: sessionId,
    categorie: parsed.data.categorie,
    libelle: parsed.data.libelle,
    montant: parsed.data.montant,
    date_frais: parsed.data.date_frais || null,
    formateur_id: parsed.data.formateur_id || null,
    notes: parsed.data.notes || null,
    justificatif_path: chemin,
    justificatif_nom: fichier ? fichier.name.slice(0, 200) : null,
    created_by: session.user.id,
  }).select('id').single()

  if (error || !data) {
    // Le fichier est déjà déposé : on le retire pour ne pas laisser d'orphelin.
    if (chemin) await supabase.storage.from(BUCKET).remove([chemin])
    if (tableAbsente(error)) return { success: false, error: MESSAGE_MIGRATION_FRAIS }
    console.error('[frais ajout]', error)
    return { success: false, error: 'Enregistrement impossible' }
  }

  await logAudit({ action: 'create', entity_type: 'session_frais', entity_id: data.id, details: { session_id: sessionId, categorie: parsed.data.categorie, montant: parsed.data.montant } })
  revalider()
  return { success: true, data: { id: data.id } }
}

/** Modifie un frais ; un nouveau justificatif remplace l'ancien, `retirer_justificatif=1` le supprime. */
export async function modifierFraisAction(fraisId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { supabase, orgId } = ctx

  const { data: frais, error: eLecture } = await supabase.from('session_frais')
    .select('id, session_id, justificatif_path').eq('id', fraisId).eq('organization_id', orgId).maybeSingle()
  if (eLecture && tableAbsente(eLecture)) return { success: false, error: MESSAGE_MIGRATION_FRAIS }
  if (!frais) return { success: false, error: 'Frais introuvable' }

  const parsed = lireSaisie(formData)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  if (!(await formateurDeLOrg(supabase, orgId, parsed.data.formateur_id))) return { success: false, errors: { formateur_id: ['Formateur introuvable'] } }

  const fichier = fichierJoint(formData)
  const retirer = formData.get('retirer_justificatif') === '1'
  const patch: Record<string, unknown> = {
    categorie: parsed.data.categorie,
    libelle: parsed.data.libelle,
    montant: parsed.data.montant,
    date_frais: parsed.data.date_frais || null,
    formateur_id: parsed.data.formateur_id || null,
    notes: parsed.data.notes || null,
  }
  let nouveauChemin: string | null = null
  if (fichier) {
    const erreur = verifierFichier(fichier)
    if (erreur) return { success: false, errors: { justificatif: [erreur] } }
    const depot = await deposer(supabase, orgId, frais.session_id, fichier)
    if ('erreur' in depot) return { success: false, error: depot.erreur }
    nouveauChemin = depot.chemin
    patch.justificatif_path = nouveauChemin
    patch.justificatif_nom = fichier.name.slice(0, 200)
  } else if (retirer) {
    patch.justificatif_path = null
    patch.justificatif_nom = null
  }

  const { error } = await supabase.from('session_frais').update(patch).eq('id', fraisId).eq('organization_id', orgId)
  if (error) {
    if (nouveauChemin) await supabase.storage.from(BUCKET).remove([nouveauChemin])
    console.error('[frais modification]', error)
    return { success: false, error: 'Enregistrement impossible' }
  }
  // L'ancien fichier ne part qu'une fois la ligne à jour
  if ((nouveauChemin || retirer) && frais.justificatif_path) {
    await supabase.storage.from(BUCKET).remove([frais.justificatif_path])
  }

  await logAudit({ action: 'update', entity_type: 'session_frais', entity_id: fraisId, details: { session_id: frais.session_id, categorie: parsed.data.categorie, montant: parsed.data.montant } })
  revalider()
  return { success: true }
}

/** Supprime un frais et son justificatif. */
export async function supprimerFraisAction(fraisId: string): Promise<ActionResult> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { supabase, orgId } = ctx

  const { data: frais, error: eLecture } = await supabase.from('session_frais')
    .select('id, session_id, categorie, montant, justificatif_path').eq('id', fraisId).eq('organization_id', orgId).maybeSingle()
  if (eLecture && tableAbsente(eLecture)) return { success: false, error: MESSAGE_MIGRATION_FRAIS }
  if (!frais) return { success: false, error: 'Frais introuvable' }

  const { error } = await supabase.from('session_frais').delete().eq('id', fraisId).eq('organization_id', orgId)
  if (error) {
    console.error('[frais suppression]', error)
    return { success: false, error: 'Suppression impossible' }
  }
  if (frais.justificatif_path) await supabase.storage.from(BUCKET).remove([frais.justificatif_path])

  await logAudit({ action: 'delete', entity_type: 'session_frais', entity_id: fraisId, details: { session_id: frais.session_id, categorie: frais.categorie, montant: Number(frais.montant) } })
  revalider()
  return { success: true }
}

/** Lien temporaire (1 h) vers le justificatif d'un frais. */
export async function lienJustificatifFraisAction(fraisId: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { supabase, orgId } = ctx

  const { data: frais, error } = await supabase.from('session_frais')
    .select('justificatif_path').eq('id', fraisId).eq('organization_id', orgId).maybeSingle()
  if (error && tableAbsente(error)) return { success: false, error: MESSAGE_MIGRATION_FRAIS }
  if (!frais?.justificatif_path) return { success: false, error: 'Aucun justificatif pour ce frais' }

  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(frais.justificatif_path, 3600)
  if (!data?.signedUrl) return { success: false, error: 'Lien indisponible' }
  return { success: true, data: { url: data.signedUrl } }
}
