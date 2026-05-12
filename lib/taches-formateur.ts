/**
 * Helpers pour la check-list tâches formateur.
 */

export interface DefaultTache {
  type: string
  libelle: string
  description?: string
  bloque_facturation: boolean
}

/** Liste par défaut des tâches créées à la confirmation d'une session */
export const DEFAULT_TACHES: DefaultTache[] = [
  { type: 'feuille_emargement', libelle: 'Feuilles d\'émargement', description: 'Faire signer chaque demi-journée + uploader si papier', bloque_facturation: true },
  { type: 'compte_rendu', libelle: 'Compte-rendu de formation', description: 'Bilan pédagogique de la session', bloque_facturation: true },
  { type: 'satisfaction_chaud', libelle: 'Questionnaire satisfaction à chaud', description: 'À faire remplir par les apprenants en fin de formation', bloque_facturation: true },
  { type: 'plan_action', libelle: 'Plan d\'action', description: 'Engagement post-formation des apprenants', bloque_facturation: true },
  { type: 'avis_google', libelle: 'Avis client Google', description: 'Demander un avis Google au client', bloque_facturation: true },
  // Hygiène HACCP : à activer manuellement si formation hygiène (auto-détection plus tard via formation.categorie)
  { type: 'audit_entree', libelle: 'Audit hygiène entrée', description: 'Audit avant la formation (formations HACCP)', bloque_facturation: false },
  { type: 'audit_sortie', libelle: 'Audit hygiène sortie', description: 'Audit après la formation (formations HACCP)', bloque_facturation: false },
  { type: 'satisfaction_froid', libelle: 'Questionnaire satisfaction à froid', description: '3 mois après la formation (ne bloque PAS la facturation)', bloque_facturation: false },
]

/**
 * Crée les tâches par défaut pour une session si elles n'existent pas déjà.
 * À appeler à la confirmation de la session.
 */
export async function seedTachesFormateur(
  supabase: any,
  sessionId: string,
  formateurId: string,
  organizationId: string,
) {
  const { count: existing } = await supabase
    .from('taches_formateur').select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
  if (existing && existing > 0) return  // Déjà seedées

  const rows = DEFAULT_TACHES.map((t, i) => ({
    organization_id: organizationId,
    session_id: sessionId,
    formateur_id: formateurId,
    type: t.type,
    libelle: t.libelle,
    description: t.description || null,
    bloque_facturation: t.bloque_facturation,
    ordre: i,
  }))

  await supabase.from('taches_formateur').insert(rows)
}

/**
 * Vérifie si toutes les tâches BLOQUANTES sont validées.
 * Si oui → débloque la facturation formateur (contrats_formateur).
 */
export async function maybeDebloquerFacturation(
  supabase: any,
  sessionId: string,
  organizationId: string,
) {
  const { data: taches } = await supabase
    .from('taches_formateur')
    .select('complete, bloque_facturation')
    .eq('session_id', sessionId)
    .eq('bloque_facturation', true)

  const allComplete = (taches || []).length > 0 && (taches || []).every((t: any) => t.complete)
  if (!allComplete) return false

  // Update contrat formateur
  const { error } = await supabase
    .from('contrats_formateur')
    .update({
      facturation_status: 'debloquee',
      facturation_debloquee_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('organization_id', organizationId)
    .eq('facturation_status', 'non_facturee')  // Évite d'écraser un statut plus avancé

  return !error
}
