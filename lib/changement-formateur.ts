import { cancelContratOnFormateurChange } from '@/lib/contrat-formateur'

/**
 * Ce qui suit un changement de formateur sur une session, quel que soit
 * l'écran d'où il part (onglet Formateur de la session, « Modifier la session ») :
 *  - les contrats en cours sont annulés et leur lien de signature meurt : le
 *    nouveau formateur ne doit jamais se voir proposer celui de son
 *    prédécesseur. Un contrat signé reste archivé tel quel, seul son statut change ;
 *  - les tâches de fin de session encore ouvertes passent au nouveau formateur :
 *    elles ne se cochent que par le formateur qu'elles désignent, et le
 *    déblocage de sa facturation en dépend. Les tâches faites restent à leur auteur.
 *
 * La session elle-même (formateur, statut de mission) est mise à jour par l'appelant.
 */
export async function suitesChangementFormateur(
  supabase: any,
  p: { sessionId: string; organizationId: string; ancienFormateurId: string | null; nouveauFormateurId: string | null },
): Promise<{ contratsAnnules: { id: string; numero: string | null; signe: boolean }[] }> {
  const contratsAnnules = await cancelContratOnFormateurChange(supabase, p.sessionId, p.ancienFormateurId)

  if (p.nouveauFormateurId) {
    const { error } = await supabase
      .from('taches_formateur')
      .update({ formateur_id: p.nouveauFormateurId })
      .eq('session_id', p.sessionId)
      .eq('organization_id', p.organizationId)
      .eq('complete', false)
    if (error) console.error('[changement de formateur — tâches]', error.message)
  }

  return { contratsAnnules }
}
