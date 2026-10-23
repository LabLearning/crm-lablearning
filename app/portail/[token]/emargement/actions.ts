'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { refusSignature } from '@/lib/signature-image'

type Creneau = 'matin' | 'apres_midi' | 'journee'

const CRENEAUX: string[] = ['matin', 'apres_midi', 'journee']

/**
 * Le sessionId vient du client (URL ou props) : on ne s'y fie jamais sans
 * vérifier qu'il s'agit bien d'une session du formateur porteur du token.
 */
async function getOwnedSession(supabase: any, token: string, sessionId: string) {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') return null

  const { data: session } = await supabase
    .from('sessions')
    .select('id, formateur_id, organization_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.formateur_id !== context.formateur.id) return null
  return { session, context }
}

/**
 * La date et le créneau viennent du navigateur : la feuille visée doit être
 * une demi-journée réelle de la session, c'est-à-dire porter au moins une
 * ligne d'émargement (créées par ensureEmargements depuis le planning).
 * Sinon on fabriquerait des feuilles pour des créneaux qui n'ont pas eu lieu.
 */
async function creneauAuPlanning(supabase: any, sessionId: string, date: unknown, creneau: unknown): Promise<boolean> {
  if (typeof creneau !== 'string' || !CRENEAUX.includes(creneau)) return false
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const { count } = await supabase
    .from('emargements')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
  return (count || 0) > 0
}

/** Délai pendant lequel un fichier tout juste téléversé peut être rattaché à une feuille. */
const DELAI_RATTACHEMENT_SCAN_MS = 2 * 60 * 60 * 1000

/**
 * Le chemin du scan vient du navigateur. Il doit être celui d'un dépôt fait à
 * l'instant par /api/documents/upload dans l'organisation de la session
 * (« <organisation>/<horodatage>-<aléa>-<nom> », sans sous-dossier), ou le
 * scan déjà enregistré sur la feuille. Sinon un formateur ferait pointer sa
 * feuille vers n'importe quel fichier du bucket (convention signée, CV,
 * justificatif) et en obtiendrait l'adresse signée.
 */
function cheminScanAccepte(chemin: unknown, organizationId: string, dejaEnregistre?: string | null): boolean {
  if (typeof chemin !== 'string') return false
  if (dejaEnregistre && chemin === dejaEnregistre) return true
  const prefixe = `${organizationId}/`
  if (!chemin.startsWith(prefixe)) return false
  const m = /^(\d{13})-\d{1,7}-[\w.\-]{1,120}$/.exec(chemin.slice(prefixe.length))
  if (!m) return false
  const age = Date.now() - Number(m[1])
  return age > -5 * 60 * 1000 && age < DELAI_RATTACHEMENT_SCAN_MS
}

/** Remplacements archivés au plus par ligne : au-delà, l'équipe reprend la main (le journal ne grossit pas sans fin). */
const ARCHIVES_MAX_PAR_LIGNE = 10
const ACTIONS_ARCHIVE = ['signature_emargement_remplacee', 'signature_emargement_effacee'] as const

/**
 * Une signature recueillie est la preuve de présence du stagiaire : avant de
 * la remplacer ou de l'effacer, on en garde une copie dans le journal
 * (audit_logs). Les émargements ne passent pas par le journal d'activité
 * (migration 155) : sans cette ligne, la preuve d'origine disparaîtrait.
 * Renvoie le motif du refus si la copie n'est pas écrite : on ne touche alors à rien.
 */
async function conserverSignature(
  supabase: any,
  owned: { session: { id: string; organization_id: string }; context: { formateur: { id: string } } },
  em: any,
  action: (typeof ACTIONS_ARCHIVE)[number],
): Promise<string | null> {
  if (!em?.signature_data) return null
  const [{ count }, { data: fiche }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'session')
      .eq('entity_id', owned.session.id)
      .in('action', [...ACTIONS_ARCHIVE])
      .eq('details->>emargement_id', em.id),
    supabase
      .from('formateurs')
      .select('user_id')
      .eq('id', owned.context.formateur.id)
      .maybeSingle(),
  ])
  if ((count || 0) >= ARCHIVES_MAX_PAR_LIGNE) {
    return 'Cette signature a déjà été modifiée plusieurs fois : adressez-vous à l\'équipe'
  }
  // L'image de la signature va dans le stockage privé, pas dans le journal :
  // le journal d'activité ne recopie jamais une signature (migration 155) et
  // /dashboard/activite affiche le détail des lignes d'audit
  const brut = String(em.signature_data)
  const m = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,(.+)$/.exec(brut)
  const octets = m ? Buffer.from(m[2], 'base64') : Buffer.from(brut, 'utf8')
  const extension = m ? ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' } as Record<string, string>)[m[1]] : 'txt'
  const cheminArchive = `${owned.session.organization_id}/emargements/archives/${em.id}-${Date.now()}.${extension}`
  const { error: errDepot } = await supabase.storage.from('documents')
    .upload(cheminArchive, octets, { contentType: m ? m[1] : 'text/plain', upsert: false })
  if (errDepot) {
    console.error('[émargement] archive de la signature', errDepot.message)
    return 'La signature déjà posée n\'a pas pu être archivée : réessayez'
  }
  const { createHash } = await import('crypto')
  const { error } = await supabase.from('audit_logs').insert({
    organization_id: owned.session.organization_id,
    user_id: fiche?.user_id || null,
    action,
    entity_type: 'session',
    entity_id: owned.session.id,
    details: {
      emargement_id: em.id,
      apprenant_id: em.apprenant_id,
      date: em.date,
      creneau: em.creneau,
      formateur_id: owned.context.formateur.id,
      via: 'portail_formateur',
      ancienne_signature: {
        // Image archivée dans le bucket privé documents, avec son empreinte
        archive_path: cheminArchive,
        sha256: createHash('sha256').update(brut).digest('hex'),
        signed_at: em.signed_at ?? null,
        signed_via: em.signed_via ?? null,
        est_present: em.est_present ?? null,
        motif_absence: em.motif_absence ?? null,
      },
    },
  })
  if (error) {
    console.error('[émargement] copie de la signature', error.message)
    // Sans ligne au journal, l'image déposée ne serait reliée à rien
    await supabase.storage.from('documents').remove([cheminArchive])
    return 'La signature déjà posée n\'a pas pu être archivée : réessayez'
  }
  return null
}

function revalidateEmargement(token: string, sessionId?: string) {
  revalidatePath(`/portail/${token}/emargement`)
  // L'espace formateur connecté partage les mêmes vues : on rafraîchit aussi
  // ses routes pour que l'action se reflète immédiatement des deux côtés.
  revalidatePath('/mon-espace/emargement')
  if (sessionId) {
    revalidatePath(`/portail/${token}/emargement/${sessionId}`)
    revalidatePath(`/mon-espace/emargement/${sessionId}`)
    revalidatePath(`/dashboard/sessions/${sessionId}`)
  }
}

/**
 * Signature d'un apprenant sur le device du formateur.
 * → enregistre signature_data, est_present=true, signed_at, signed_via.
 * → bloqué si la feuille (session+date+creneau) est déjà validée par le formateur.
 * → une signature déjà posée (« Signer à nouveau ») est d'abord archivée.
 */
export async function signApprenantPresenceAction(
  token: string,
  emargementId: string,
  signatureBase64: string,
): Promise<{ success: boolean; error?: string }> {
  // Un cadre validé sans tracé n'est pas une signature : une image enregistrée
  // ici vaut « a signé, était présent »
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }

  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  // Récupérer l'émargement + check feuille verrouillée
  const { data: em } = await supabase
    .from('emargements')
    .select('id, session_id, apprenant_id, date, creneau, est_present, signature_data, signed_at, signed_via, motif_absence')
    .eq('id', emargementId)
    .single()

  if (!em) return { success: false, error: 'Émargement introuvable' }

  const owned = await getOwnedSession(supabase, token, em.session_id)
  if (!owned) return { success: false, error: 'Session non autorisée' }

  const { data: feuille } = await supabase
    .from('emargement_feuilles')
    .select('validated_at')
    .eq('session_id', em.session_id)
    .eq('date', em.date)
    .eq('creneau', em.creneau)
    .maybeSingle()

  if (feuille?.validated_at) {
    return { success: false, error: 'La feuille est déjà validée et verrouillée' }
  }

  const refusArchive = await conserverSignature(supabase, owned, em, 'signature_emargement_remplacee')
  if (refusArchive) return { success: false, error: refusArchive }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signature_data: signatureBase64,
      signed_at: new Date().toISOString(),
      signed_via: 'portail_formateur',
      motif_absence: null,
    })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, em.session_id)
  return { success: true }
}

/**
 * Marque un apprenant absent (avec motif optionnel).
 * → est_present=false, signature_data effacée (archivée au journal avant).
 */
export async function markAbsentAction(
  token: string,
  emargementId: string,
  motif: string | null,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const { data: em } = await supabase
    .from('emargements')
    .select('id, session_id, apprenant_id, date, creneau, est_present, signature_data, signed_at, signed_via, motif_absence')
    .eq('id', emargementId)
    .single()

  if (!em) return { success: false, error: 'Émargement introuvable' }

  const owned = await getOwnedSession(supabase, token, em.session_id)
  if (!owned) return { success: false, error: 'Session non autorisée' }

  const { data: feuille } = await supabase
    .from('emargement_feuilles')
    .select('validated_at')
    .eq('session_id', em.session_id)
    .eq('date', em.date)
    .eq('creneau', em.creneau)
    .maybeSingle()

  if (feuille?.validated_at) {
    return { success: false, error: 'La feuille est déjà validée et verrouillée' }
  }

  const refusArchive = await conserverSignature(supabase, owned, em, 'signature_emargement_effacee')
  if (refusArchive) return { success: false, error: refusArchive }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: false,
      signature_data: null,
      signed_at: null,
      motif_absence: (typeof motif === 'string' ? motif.trim() : '') || null,
    })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, em.session_id)
  return { success: true }
}

/**
 * Le formateur valide la feuille d'émargement complète :
 *   → signe la feuille (sa propre signature)
 *   → date validated_at = maintenant
 *   → la feuille devient non modifiable
 */
export async function validerFeuilleByFormateurAction(
  token: string,
  sessionId: string,
  date: string,
  creneau: 'matin' | 'apres_midi' | 'journee',
  signatureBase64: string,
): Promise<{ success: boolean; error?: string }> {
  // La feuille se verrouille sur la signature du formateur : pas de cadre vide
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }

  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  // Vérifier que la session appartient bien au formateur
  const { data: session } = await supabase
    .from('sessions')
    .select('id, formateur_id, organization_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.formateur_id !== context.formateur.id) {
    return { success: false, error: 'Session non autorisée' }
  }

  if (!(await creneauAuPlanning(supabase, sessionId, date, creneau))) {
    return { success: false, error: 'Ce créneau ne figure pas au planning de la session' }
  }

  // Upsert : create ou update si déjà existante
  const { data: existing } = await supabase
    .from('emargement_feuilles')
    .select('id, validated_at')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .maybeSingle()

  if (existing?.validated_at) {
    return { success: false, error: 'Cette feuille est déjà validée' }
  }

  const payload = {
    organization_id: session.organization_id,
    session_id: sessionId,
    date,
    creneau,
    formateur_id: context.formateur.id,
    formateur_signature_data: signatureBase64,
    mode: 'numerique',
    validated_at: new Date().toISOString(),
  }

  let error
  if (existing) {
    const res = await supabase
      .from('emargement_feuilles')
      .update(payload)
      .eq('id', existing.id)
    error = res.error
  } else {
    const res = await supabase
      .from('emargement_feuilles')
      .insert(payload)
    error = res.error
  }

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, sessionId)
  return { success: true }
}

/**
 * Choix (ou changement) du mode de signature d'une feuille.
 * La feuille est créée dès ce choix — jusqu'ici elle n'existait qu'à la
 * validation, il n'y avait donc nulle part où mémoriser le mode.
 */
/**
 * Mode d'émargement de TOUTE la session.
 *
 * Le papier ne se décide pas demi-journée par demi-journée : le formateur
 * imprime une feuille unique couvrant l'ensemble des dates, la fait signer
 * au fil des séances, puis la scanne une fois à la fin.
 */
export async function setSessionEmargementModeAction(
  token: string,
  sessionId: string,
  mode: 'numerique' | 'papier',
): Promise<{ success: boolean; error?: string }> {
  if (mode !== 'numerique' && mode !== 'papier') return { success: false, error: 'Mode inconnu' }
  const supabase = await createServiceRoleClient()
  const owned = await getOwnedSession(supabase, token, sessionId)
  if (!owned) return { success: false, error: 'Session non autorisée' }

  // Une feuille déjà validée fige le mode : on ne réécrit pas l'histoire
  const { count } = await supabase
    .from('emargement_feuilles')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .not('validated_at', 'is', null)
  if ((count || 0) > 0) {
    return { success: false, error: 'Des feuilles sont déjà validées : le mode ne peut plus changer' }
  }

  const { error } = await supabase
    .from('sessions')
    .update({ emargement_mode: mode })
    .eq('id', sessionId)
  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, sessionId)
  return { success: true }
}

/** Enregistre le scan de la feuille papier signée, pour toute la session */
export async function saveScanSessionAction(
  token: string,
  sessionId: string,
  storagePath: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceRoleClient()
  const owned = await getOwnedSession(supabase, token, sessionId)
  if (!owned) return { success: false, error: 'Session non autorisée' }
  if (!storagePath) return { success: false, error: 'Fichier manquant' }
  // Seul un fichier qu'on vient de téléverser pour cette organisation est accepté
  if (!cheminScanAccepte(storagePath, owned.session.organization_id)) {
    return { success: false, error: 'Fichier non reconnu : téléversez à nouveau la feuille' }
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      emargement_scan_path: storagePath,
      emargement_scan_uploaded_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, sessionId)
  return { success: true }
}

export async function setFeuilleModeAction(
  token: string,
  sessionId: string,
  date: string,
  creneau: Creneau,
  mode: 'numerique' | 'papier',
): Promise<{ success: boolean; error?: string }> {
  if (mode !== 'numerique' && mode !== 'papier') return { success: false, error: 'Mode inconnu' }
  const supabase = await createServiceRoleClient()
  const owned = await getOwnedSession(supabase, token, sessionId)
  if (!owned) return { success: false, error: 'Session non autorisée' }
  if (!(await creneauAuPlanning(supabase, sessionId, date, creneau))) {
    return { success: false, error: 'Ce créneau ne figure pas au planning de la session' }
  }

  const { data: existing } = await supabase
    .from('emargement_feuilles')
    .select('id, validated_at')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .maybeSingle()

  if (existing?.validated_at) {
    return { success: false, error: 'La feuille est validée : le mode ne peut plus changer' }
  }

  const error = existing
    ? (await supabase.from('emargement_feuilles').update({ mode }).eq('id', existing.id)).error
    : (
        await supabase.from('emargement_feuilles').insert({
          organization_id: owned.session.organization_id,
          session_id: sessionId,
          date,
          creneau,
          formateur_id: owned.context.formateur.id,
          mode,
        })
      ).error

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, sessionId)
  return { success: true }
}

/**
 * Pointage d'une présence sans signature à l'écran : la signature manuscrite
 * est sur la feuille papier, le formateur ne fait que la reporter.
 * Une signature numérique déjà recueillie reste en place (même règle que
 * « Tous présents ») : la présence est déjà prouvée.
 */
export async function markPresentPapierAction(
  token: string,
  emargementId: string,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const { data: em } = await supabase
    .from('emargements')
    .select('id, session_id, date, creneau, signature_data')
    .eq('id', emargementId)
    .single()

  if (!em) return { success: false, error: 'Émargement introuvable' }

  const owned = await getOwnedSession(supabase, token, em.session_id)
  if (!owned) return { success: false, error: 'Session non autorisée' }

  const { data: feuille } = await supabase
    .from('emargement_feuilles')
    .select('validated_at')
    .eq('session_id', em.session_id)
    .eq('date', em.date)
    .eq('creneau', em.creneau)
    .maybeSingle()

  if (feuille?.validated_at) {
    return { success: false, error: 'La feuille est déjà validée et verrouillée' }
  }

  // Déjà signé à l'écran : la signature ne se remplace pas par un pointage
  if (em.signature_data) return { success: true }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signature_data: null,
      // Pas d'horodatage : la signature a eu lieu en salle, sur papier, et
      // inscrire l'heure de la saisie ferait apparaître des signatures à la
      // minute près qui n'ont jamais eu lieu.
      signed_at: null,
      signed_via: 'feuille_papier',
      motif_absence: null,
    })
    .eq('id', emargementId)
    // Une signature arrivée entre-temps ne s'efface pas
    .is('signature_data', null)

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, em.session_id)
  return { success: true }
}

/**
 * Enregistre le chemin de stockage du scan de la feuille papier signée.
 * Le fichier a déjà été téléversé par /api/documents/upload.
 */
export async function saveScanFeuilleAction(
  token: string,
  sessionId: string,
  date: string,
  creneau: Creneau,
  storagePath: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceRoleClient()
  const owned = await getOwnedSession(supabase, token, sessionId)
  if (!owned) return { success: false, error: 'Session non autorisée' }
  if (!(await creneauAuPlanning(supabase, sessionId, date, creneau))) {
    return { success: false, error: 'Ce créneau ne figure pas au planning de la session' }
  }

  const { data: existing } = await supabase
    .from('emargement_feuilles')
    .select('id, validated_at, scan_storage_path')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .maybeSingle()

  // Feuille attestée : le scan qui fait foi ne se remplace ni ne s'efface
  if (existing?.validated_at) {
    return { success: false, error: 'La feuille est déjà validée et verrouillée' }
  }
  if (storagePath && !cheminScanAccepte(storagePath, owned.session.organization_id, existing?.scan_storage_path)) {
    return { success: false, error: 'Fichier non reconnu : téléversez à nouveau le scan' }
  }
  const chemin = storagePath || null

  const error = existing
    ? (
        await supabase
          .from('emargement_feuilles')
          .update({ scan_storage_path: chemin })
          .eq('id', existing.id)
      ).error
    : (
        await supabase.from('emargement_feuilles').insert({
          organization_id: owned.session.organization_id,
          session_id: sessionId,
          date,
          creneau,
          formateur_id: owned.context.formateur.id,
          mode: 'papier',
          scan_storage_path: chemin,
        })
      ).error

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, sessionId)
  return { success: true }
}

/**
 * Attestation d'une feuille papier : le formateur certifie de sa signature
 * que la feuille imprimée a bien été signée par les stagiaires présents.
 */
export async function attesterFeuillePapierAction(
  token: string,
  sessionId: string,
  date: string,
  creneau: Creneau,
  signatureBase64: string,
  scanStoragePath: string | null,
): Promise<{ success: boolean; error?: string }> {
  // Seul le scan est facultatif : l'attestation, elle, tient à la signature
  // du formateur, que l'écran demande toujours
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }

  const supabase = await createServiceRoleClient()
  const owned = await getOwnedSession(supabase, token, sessionId)
  if (!owned) return { success: false, error: 'Session non autorisée' }
  if (!(await creneauAuPlanning(supabase, sessionId, date, creneau))) {
    return { success: false, error: 'Ce créneau ne figure pas au planning de la session' }
  }

  const { data: existing } = await supabase
    .from('emargement_feuilles')
    .select('id, validated_at, scan_storage_path')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .maybeSingle()

  if (existing?.validated_at) {
    return { success: false, error: 'Cette feuille est déjà validée' }
  }
  // L'écran renvoie le scan déjà enregistré ; un autre chemin doit venir d'un dépôt récent
  if (scanStoragePath && !cheminScanAccepte(scanStoragePath, owned.session.organization_id, existing?.scan_storage_path)) {
    return { success: false, error: 'Fichier non reconnu : téléversez à nouveau le scan' }
  }

  const payload = {
    organization_id: owned.session.organization_id,
    session_id: sessionId,
    date,
    creneau,
    formateur_id: owned.context.formateur.id,
    formateur_signature_data: signatureBase64,
    mode: 'papier',
    scan_storage_path: scanStoragePath || existing?.scan_storage_path || null,
    validated_at: new Date().toISOString(),
  }

  const error = existing
    ? (await supabase.from('emargement_feuilles').update(payload).eq('id', existing.id)).error
    : (await supabase.from('emargement_feuilles').insert(payload)).error

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, sessionId)
  return { success: true }
}

/**
 * Marque tout un créneau présent d'un coup, sur la foi de la feuille papier.
 *
 * Le formateur a fait signer en salle ; lui demander de recocher chaque nom
 * dans le portail est une double saisie qu'il ne fera pas. C'est exactement
 * ce qui laisse les dossiers vides.
 *
 * Aucun horodatage n'est inscrit : trente signatures à la même minute se
 * verraient immédiatement. Le jour est porté par la colonne `date`, et le
 * scan de la feuille reste la pièce justificative.
 */
export async function markToutPresentPapierAction(
  token: string,
  sessionId: string,
  date: string,
  creneau: string,
): Promise<{ success: boolean; error?: string; marques?: number }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()
  const owned = await getOwnedSession(supabase, token, sessionId)
  if (!owned) return { success: false, error: 'Session non autorisée' }

  const { data: feuille } = await supabase
    .from('emargement_feuilles')
    .select('validated_at')
    .eq('session_id', sessionId).eq('date', date).eq('creneau', creneau)
    .maybeSingle()
  if (feuille?.validated_at) {
    return { success: false, error: 'La feuille est déjà validée et verrouillée' }
  }

  const { data, error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signed_via: 'feuille_papier',
      motif_absence: null,
    })
    .eq('session_id', sessionId).eq('date', date).eq('creneau', creneau)
    // Une signature numérique déjà recueillie ne se réécrit pas.
    .is('signature_data', null)
    .select('id')

  if (error) return { success: false, error: error.message }

  revalidateEmargement(token, sessionId)
  return { success: true, marques: (data || []).length }
}
