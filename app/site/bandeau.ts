// Bandeau d'information du site public, affiché au-dessus du menu sur toutes
// les pages. Un seul message à la fois : le changer ici suffit.
//
// - `actif: false` le retire du site ;
// - changer `id` le fait réapparaître chez ceux qui avaient fermé le précédent ;
// - `jusquAu` (AAAA-MM-JJ, facultatif) le retire tout seul après cette date.

export interface Bandeau {
  id: string
  actif: boolean
  /** Petit mot en tête : « Nouveau », « Rappel »… */
  etiquette?: string
  texte: string
  /** Version courte pour les téléphones. */
  texteCourt?: string
  lien?: { href: string; libelle: string }
  jusquAu?: string
}

export const BANDEAU: Bandeau = {
  id: 'modeles-pms-2026-10',
  actif: true,
  etiquette: 'Nouveau',
  texte: 'Le plan de maîtrise sanitaire complet et onze fiches à imprimer, gratuits.',
  texteCourt: 'PMS complet et fiches gratuites à imprimer',
  lien: { href: '/modeles', libelle: 'Voir les modèles' },
}
