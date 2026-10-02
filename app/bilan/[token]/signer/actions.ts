'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { CHAMPS_BILAN_FT, SIGNATURE_BILAN } from '@/lib/poei-bilan-ft'

/**
 * Signature publique (par lien personnel) du bilan de fin de formation par le
 * stagiaire. L'horodatage enregistré est celui du moment réel de la signature.
 */
export async function signerBilanAction(
  token: string,
  signatureBase64: string,
  nom: string,
  avis: string,
): Promise<{ success: boolean; error?: string }> {
  if (!/^[0-9a-f]{64}$/.test(token || '')) return { success: false, error: 'Lien invalide' }
  if (!signatureBase64?.startsWith('data:image/png;base64,') || signatureBase64.length > 400_000) return { success: false, error: 'Signature invalide' }
  if (!nom?.trim()) return { success: false, error: 'Nom requis' }

  const supabase = await createServiceRoleClient()
  const { data: grille } = await supabase.from('poei_grilles').select('id, appreciations')
    .eq(`appreciations->>${SIGNATURE_BILAN.jeton}`, token).is('semaine', null).maybeSingle()
  if (!grille) return { success: false, error: 'Lien invalide' }
  const a: Record<string, any> = (grille as any).appreciations || {}
  if (a[SIGNATURE_BILAN.signeLe]) return { success: false, error: 'Ce bilan est déjà signé' }
  if (a[SIGNATURE_BILAN.expire] && new Date(a[SIGNATURE_BILAN.expire]) < new Date()) return { success: false, error: 'Ce lien a expiré' }

  const h = await headers()
  const { data: maj, error } = await supabase.from('poei_grilles').update({
    appreciations: {
      ...a,
      [CHAMPS_BILAN_FT.avisStagiaire]: String(avis || '').trim().slice(0, 1500),
      [SIGNATURE_BILAN.data]: signatureBase64,
      [SIGNATURE_BILAN.nom]: nom.trim().slice(0, 120),
      [SIGNATURE_BILAN.signeLe]: new Date().toISOString(),
      [SIGNATURE_BILAN.ip]: h.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      [SIGNATURE_BILAN.agent]: (h.get('user-agent') || '').slice(0, 300),
    },
  }).eq('id', (grille as any).id).is(`appreciations->>${SIGNATURE_BILAN.signeLe}`, null).select('id')

  if (error) { console.error('[signature bilan]', error); return { success: false, error: "Erreur lors de l'enregistrement" } }
  if (!maj?.length) return { success: false, error: 'Ce bilan est déjà signé' }
  return { success: true }
}
