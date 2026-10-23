// Articles du blog du site public : plus courts et plus pratiques que les guides,
// un sujet par article. Comme les guides, ils vivent dans le code (un fichier JSON
// par article, dans lib/blog/contenu/) : aucune table, chaque texte passe par une
// relecture.
//
// Parution : un article paraît le jour de `publieLe` (heure de Paris), pas avant.
// Les articles écrits d'avance attendent leur date : le blog en publie un par
// semaine sans que personne n'ait à intervenir. Avant sa date, un article n'a
// ni page, ni place dans la liste, le plan du site ou les liens des autres articles.

import type { SectionGuide } from '@/lib/guides/types'

export type CategorieArticle =
  | 'Hygiène alimentaire'
  | 'Restauration rapide'
  | 'Métiers de bouche'
  | 'Financement'
  | 'Réglementation'
  | 'Sécurité au travail'
  | 'Équipe et management'
  | 'Formation'

export interface Article {
  slug: string
  /** Titre affiché (h1). */
  titre: string
  /** Titre de l'onglet et des résultats de recherche : 45 caractères au plus, « | Lab Learning » s'y ajoute. */
  titreCourt: string
  /** Description pour les moteurs : 158 caractères au plus. */
  description: string
  chapeau: string
  categorie: CategorieArticle
  /** Jour de parution, AAAA-MM-JJ : l'article paraît ce jour-là, heure de Paris. */
  publieLe: string
  /** Dernière mise à jour du texte, AAAA-MM-JJ. */
  majLe: string
  /** Temps de lecture, en minutes. */
  lecture: number
  image: string
  imageAlt: string
  aRetenir: string[]
  sections: SectionGuide[]
  faq: { q: string; r: string }[]
  /** Textes officiels sur lesquels l'article s'appuie. */
  sources: { libelle: string; url: string }[]
  /** Expression régulière (sans les barres) qui retrouve les formations liées par leur intitulé. */
  formations: string
  /** Guides liés (slugs de lib/guides). */
  guides: string[]
}
