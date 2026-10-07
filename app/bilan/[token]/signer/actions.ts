'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SIGNATURE_BILAN } from '@/lib/poei-bilan-ft'
import { signerBilan, signerCertificatSiBesoin } from '@/lib/poei-signature-documents'
import { signatureVide } from '@/lib/signature-image'
import { MESSAGE_SIGNATURE_VIDE } from '@/lib/signature-encre'

/**
 * Signature publique (par lien personnel) des documents de fin de POEI par le
 * stagiaire : son bilan de fin de formation et, s'il ne l'a pas encore signé,
 * son certificat de réalisation. L'horodatage enregistré est celui du moment
 * réel de la signature.
 */
export async function signerBilanAction(
  token: string,
  signatureBase64: string,
  nom: string,
  reponse: { note: string; avis: string },
): Promise<{ success: boolean; error?: string }> {
  if (!/^[0-9a-f]{64}$/.test(token || '')) return { success: false, error: 'Lien invalide' }
  if (!signatureBase64?.startsWith('data:image/png;base64,') || signatureBase64.length > 400_000) return { success: false, error: 'Signature invalide' }
  // Un cadre validé sans tracé n'est pas une signature
  if (signatureVide(signatureBase64)) return { success: false, error: MESSAGE_SIGNATURE_VIDE }
  if (!nom?.trim()) return { success: false, error: 'Nom requis' }

  const supabase = await createServiceRoleClient()
  const { data: grille } = await supabase.from('poei_grilles').select('id, organization_id, poei_id, apprenant_id, appreciations')
    .eq(`appreciations->>${SIGNATURE_BILAN.jeton}`, token).is('semaine', null).maybeSingle()
  if (!grille) {
    // Lien d'aperçu de l'équipe : on valide comme pour une vraie signature, sans rien écrire
    const { data: apercu } = await supabase.from('poei_grilles').select('id')
      .eq(`appreciations->>${SIGNATURE_BILAN.jetonApercu}`, token).is('semaine', null).maybeSingle()
    return apercu ? { success: true } : { success: false, error: 'Lien invalide' }
  }
  const g: any = grille
  const a: Record<string, any> = g.appreciations || {}
  if (a[SIGNATURE_BILAN.signeLe]) return { success: false, error: 'Ce bilan est déjà signé' }
  if (a[SIGNATURE_BILAN.expire] && new Date(a[SIGNATURE_BILAN.expire]) < new Date()) return { success: false, error: 'Ce lien a expiré' }

  const h = await headers()
  const trace = {
    data: signatureBase64, nom: nom.trim().slice(0, 120),
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || '', agent: (h.get('user-agent') || '').slice(0, 300),
  }
  if (!(await signerBilan(supabase, { grilleId: g.id, appreciations: a }, reponse, trace))) {
    return { success: false, error: "Ce bilan est déjà signé, ou l'enregistrement a échoué. Rechargez la page." }
  }
  // Une seule signature pour tous les documents : le certificat aussi, s'il attendait encore
  try { await signerCertificatSiBesoin(supabase, g.organization_id, g.poei_id, g.apprenant_id, trace) }
  catch (e) { console.error('[signature certificat depuis le bilan]', e) }
  return { success: true }
}
