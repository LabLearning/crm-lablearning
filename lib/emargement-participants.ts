import { fetchAllPaged } from '@/lib/supabase/fetch-all'

/**
 * Liste des participants à faire figurer sur une feuille d'émargement.
 *
 * Règle : les inscrits actifs, PLUS toute personne qui a réellement émargé sur
 * la session même si son inscription a été annulée depuis. Un stagiaire qui a
 * signé était présent — le retirer de la feuille falsifierait la preuve de
 * présence (indicateur Qualiopi 12).
 */
export interface ParticipantFeuille {
  id: string
  prenom: string | null
  nom: string | null
  entreprise?: string | null
  retire?: boolean
}

export async function participantsFeuille(
  supabase: any,
  sessionId: string,
): Promise<ParticipantFeuille[]> {
  const [{ data: inscriptions }, signataires] = await Promise.all([
    supabase
      .from('inscriptions')
      .select('status, apprenant:apprenants(id, prenom, nom, entreprise)')
      .eq('session_id', sessionId),
    // Paginé : au-delà de 1000 signatures, un stagiaire retiré qui a signé
    // aurait pu manquer à la feuille
    fetchAllPaged((from, to) => supabase
      .from('emargements')
      .select('apprenant_id')
      .eq('session_id', sessionId)
      .not('signature_data', 'is', null)
      .order('id')
      .range(from, to)),
  ])

  const ontSigne = new Set((signataires || []).map((e: any) => e.apprenant_id))
  const out: ParticipantFeuille[] = []

  for (const i of inscriptions || []) {
    const a = (i as any).apprenant
    if (!a) continue
    const annule = ['annule', 'abandonne'].includes((i as any).status)
    if (annule && !ontSigne.has(a.id)) continue
    out.push({ ...a, retire: annule })
  }

  return out.sort((a, b) => `${a.nom || ''}`.localeCompare(`${b.nom || ''}`))
}
