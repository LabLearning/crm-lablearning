'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import { SIGNATURE_BILAN } from '@/lib/poei-bilan-ft'

const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
const VALIDITE_JOURS = 60
const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Fait signer au stagiaire son bilan de fin de formation (pièce France
 * Travail jointe à la facture sur Chorus Pro) : il le relit, y donne son avis
 * et le signe depuis un lien personnel. `preview` renvoie le mail sans
 * l'envoyer ; `lienSeul` renvoie le lien à transmettre (stagiaire sans email).
 */
export async function demanderSignatureBilanAction(
  poeiId: string,
  apprenantId: string,
  opts?: { preview?: boolean; lienSeul?: boolean; apercuPage?: boolean },
): Promise<ActionResult & { data?: { email?: string; html?: string; subject?: string; url?: string } }> {
  const session = await getSession()
  if (['apprenant', 'formateur', 'apporteur_affaires', 'franchise'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [{ data: grille }, { data: appr }, { data: poei }, { data: org }] = await Promise.all([
    supabase.from('poei_grilles').select('id, appreciations')
      .eq('organization_id', orgId).eq('poei_id', poeiId).eq('apprenant_id', apprenantId).is('semaine', null).maybeSingle(),
    supabase.from('apprenants').select('id, prenom, nom, email').eq('id', apprenantId).eq('organization_id', orgId).maybeSingle(),
    supabase.from('poei').select('id, numero, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)')
      .eq('id', poeiId).eq('organization_id', orgId).maybeSingle(),
    supabase.from('organizations').select('*').eq('id', orgId).single(),
  ])
  if (!poei || !appr) return { success: false, error: 'Candidat introuvable' }
  if (!grille) return { success: false, error: "Le bilan final n'est pas encore rempli" }
  const a: Record<string, any> = (grille as any).appreciations || {}

  // Lien d'aperçu : la page du stagiaire, pour l'équipe, sans rien enregistrer
  if (opts?.apercuPage) {
    const jetonApercu: string = a[SIGNATURE_BILAN.jetonApercu] || randomBytes(32).toString('hex')
    if (!a[SIGNATURE_BILAN.jetonApercu]) {
      const { error } = await supabase.from('poei_grilles')
        .update({ appreciations: { ...a, [SIGNATURE_BILAN.jetonApercu]: jetonApercu } }).eq('id', (grille as any).id)
      if (error) return { success: false, error: "Erreur lors de la préparation de l'aperçu" }
    }
    return { success: true, data: { url: `${APP()}/bilan/${jetonApercu}/signer` } }
  }

  if (a[SIGNATURE_BILAN.signeLe]) return { success: false, error: 'Ce bilan est déjà signé' }

  // Un seul lien par bilan, prolongé à chaque demande
  const jeton: string = a[SIGNATURE_BILAN.jeton] || randomBytes(32).toString('hex')
  const url = `${APP()}/bilan/${jeton}/signer`
  const enregistrerJeton = async (envoye: boolean) => {
    const { error } = await supabase.from('poei_grilles').update({
      appreciations: {
        ...a,
        [SIGNATURE_BILAN.jeton]: jeton,
        [SIGNATURE_BILAN.expire]: new Date(Date.now() + VALIDITE_JOURS * 86400000).toISOString(),
        ...(envoye ? { [SIGNATURE_BILAN.envoyeLe]: new Date().toISOString() } : {}),
      },
    }).eq('id', (grille as any).id)
    return !error
  }

  if (opts?.lienSeul) {
    if (!(await enregistrerJeton(false))) return { success: false, error: 'Erreur lors de la préparation du lien' }
    await logAudit({ action: 'lien_signature_bilan', entity_type: 'poei', entity_id: poeiId, details: { apprenant: apprenantId } })
    return { success: true, data: { url } }
  }

  if (!appr.email) return { success: false, error: "Ce candidat n'a pas d'adresse email" }
  const formation = (poei as any).formation?.intitule || 'votre formation'
  const clientNom = (poei as any).client?.nom_commercial || (poei as any).client?.raison_sociale || ''
  const emailParams = {
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || org?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: echapper([appr.prenom, appr.nom].filter(Boolean).join(' ') || 'Madame, Monsieur'),
    subject: 'Votre bilan de fin de formation à signer',
    docTitle: 'Votre bilan de fin de formation',
    intro: `Votre formation « ${echapper(formation)} »${clientNom ? ` chez ${echapper(clientNom)}` : ''} est terminée. Merci de donner votre avis sur la formation et de signer votre bilan de fin de formation, établi avec votre formateur. Cela prend une minute, depuis votre téléphone.`,
    ctaLabel: 'Donner mon avis et signer',
    ctaUrl: url,
    footerNote: `Lien personnel, à ne pas transmettre. Valable ${VALIDITE_JOURS} jours.`,
  }

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { email: appr.email, html: buildDocumentEmailHtml(emailParams), subject: emailParams.subject } }
  }

  if (!(await enregistrerJeton(true))) return { success: false, error: 'Erreur lors de la préparation du lien' }
  try {
    const { sendDocumentEmail } = await import('@/lib/email')
    const r = await sendDocumentEmail({
      ...emailParams,
      to: appr.email,
      organizationId: orgId, entityType: 'poei', entityId: poeiId, triggeredBy: session.user.id,
    })
    if (!r.success) return { success: false, error: r.error || "L'envoi de l'email a échoué" }
  } catch (e) {
    console.error('[email signature bilan]', e)
    return { success: false, error: "L'envoi de l'email a échoué" }
  }
  await logAudit({ action: 'send_signature_bilan', entity_type: 'poei', entity_id: poeiId, details: { apprenant: apprenantId, email: appr.email } })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { email: appr.email } }
}

/**
 * Envoie le lien de signature à tous les stagiaires de la POEI dont le bilan
 * final est rempli et pas encore signé. Ceux sans email sont comptés à part :
 * leur lien se copie depuis leur ligne.
 */
export async function demanderSignaturesBilansAction(
  poeiId: string,
): Promise<ActionResult & { data?: { envoyes: number; sansEmail: number; echecs: number } }> {
  const session = await getSession()
  if (['apprenant', 'formateur', 'apporteur_affaires', 'franchise'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()
  const { data: grilles } = await supabase.from('poei_grilles').select('apprenant_id, appreciations')
    .eq('organization_id', session.organization.id).eq('poei_id', poeiId).is('semaine', null)
  const aSigner = ((grilles || []) as any[]).filter((g) => g.apprenant_id && !g.appreciations?.[SIGNATURE_BILAN.signeLe])
  if (!aSigner.length) return { success: false, error: 'Aucun bilan final à faire signer' }

  let envoyes = 0, sansEmail = 0, echecs = 0
  for (const g of aSigner) {
    const r = await demanderSignatureBilanAction(poeiId, g.apprenant_id)
    if (r.success) envoyes++
    else if ((r.error || '').includes("pas d'adresse email")) sansEmail++
    else echecs++
  }
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { envoyes, sansEmail, echecs } }
}
