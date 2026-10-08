'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { refusSignature } from '@/lib/signature-image'

/**
 * Signature publique (par token) du certificat de réalisation par le candidat.
 * L'horodatage réel est conservé pour la traçabilité ; la date PORTÉE sur le
 * certificat reste le dernier jour de la POEI.
 */
export async function signCertificatAction(
  token: string,
  signatureBase64: string,
  nom: string,
  /** Présent quand la page a montré au stagiaire son bilan de fin de formation : il le signe du même geste */
  bilan?: { note: string; avis: string },
): Promise<{ success: boolean; error?: string }> {
  // Un cadre validé sans tracé, ou une image qui ne se lit pas, n'est pas une signature
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }
  if (!nom?.trim()) return { success: false, error: 'Nom requis' }

  const supabase = await createServiceRoleClient()
  const { data: sig } = await supabase
    .from('certificat_signatures')
    .select('id, signed_at, token_expires_at, date_signature, poei_id, organization_id, apprenant_id, role')
    .eq('token', token)
    .maybeSingle()

  if (!sig) return { success: false, error: 'Lien invalide' }
  if (sig.signed_at) return { success: false, error: 'Ce certificat est déjà signé' }
  if (sig.token_expires_at && new Date(sig.token_expires_at) < new Date()) {
    return { success: false, error: 'Ce lien a expiré' }
  }

  // Filet : si la date affichée n'a pas été fixée, on la reprend de la POEI
  let dateSignature = sig.date_signature
  if (!dateSignature && sig.poei_id) {
    const { data: p } = await supabase.from('poei').select('date_fin, date_debut').eq('id', sig.poei_id).maybeSingle()
    dateSignature = p?.date_fin || p?.date_debut || null
  }

  const h = await headers()
  const { error } = await supabase
    .from('certificat_signatures')
    .update({
      signed_at: new Date().toISOString(),
      date_signature: dateSignature,
      signature_data: signatureBase64,
      signataire_nom: nom.trim(),
      ip_address: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: h.get('user-agent') || null,
    })
    .eq('id', sig.id)

  if (error) { console.error('[sign certificat]', error); return { success: false, error: 'Erreur lors de l\'enregistrement' } }

  // Une seule signature pour tous les documents de fin de POEI : si le bilan a
  // été montré sur la page, il est signé en même temps que le certificat.
  if (bilan && (sig as any).role !== 'employeur' && sig.poei_id && (sig as any).apprenant_id) {
    try {
      const { bilanPourSignature, signerBilan } = await import('@/lib/poei-signature-documents')
      const b = await bilanPourSignature(supabase, (sig as any).organization_id, sig.poei_id, (sig as any).apprenant_id)
      if (b && !b.dejaSigne) {
        await signerBilan(supabase, b, { note: bilan.note, avis: bilan.avis }, {
          data: signatureBase64, nom: nom.trim(),
          ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || '', agent: (h.get('user-agent') || '').slice(0, 300),
        })
      }
    } catch (e) { console.error('[signature bilan depuis le certificat]', e) }
  }
  return { success: true }
}
