// Guides du site public : des articles de fond, écrits une fois et tenus à jour.
//
// Les guides vivent dans le code (un fichier par guide, dans lib/guides/) :
// aucune table n'est nécessaire, et chaque modification passe par une relecture.
// Un guide `publie: false` est un brouillon : sa page existe pour être relue,
// mais elle est exclue des moteurs, de la liste, du plan du site et des menus.

export type Bloc =
  /** Paragraphe. Mise en forme légère : **gras** et [texte](lien). */
  | { type: 'p'; texte: string }
  | { type: 'liste'; items: string[]; ordonnee?: boolean }
  | { type: 'encadre'; titre: string; texte: string; ton?: 'info' | 'attention' }
  | { type: 'tableau'; entetes: string[]; lignes: string[][] }

export interface SectionGuide {
  /** Ancre de la section dans la page. */
  id: string
  titre: string
  blocs: Bloc[]
}

export type CategorieGuide = 'Hygiène alimentaire' | 'Sécurité au travail' | 'Financement' | 'Ouverture'

export interface Guide {
  slug: string
  /** Titre affiché (h1). */
  titre: string
  /** Titre de l'onglet et des résultats de recherche : 45 caractères au plus, « | Lab Learning » s'y ajoute. */
  titreCourt: string
  /** Description pour les moteurs : 158 caractères au plus. */
  description: string
  chapeau: string
  categorie: CategorieGuide
  publie: boolean
  /** Dates au format AAAA-MM-JJ. */
  publieLe: string
  majLe: string
  /** Temps de lecture, en minutes. */
  lecture: number
  image: string
  imageAlt: string
  aRetenir: string[]
  sections: SectionGuide[]
  faq: { q: string; r: string }[]
  /** Textes officiels sur lesquels le guide s'appuie. */
  sources: { libelle: string; url: string }[]
  /** Expression régulière (sans les barres) qui retrouve les formations liées par leur intitulé. */
  formations: string
}
