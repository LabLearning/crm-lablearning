import type { Guide } from './types'
import g0 from './contenu/formation-hygiene-alimentaire-restauration-rapide.json'
import g1 from './contenu/ouvrir-restaurant-rapide-formations-obligations.json'
import g2 from './contenu/financer-formation-restauration-rapide-opco.json'
import g3 from './contenu/document-unique-duerp-restaurant.json'
import g4 from './contenu/allergenes-restaurant-affichage-obligatoire.json'
import g5 from './contenu/controle-hygiene-restaurant-ddpp.json'

export type { Guide, Bloc, SectionGuide, CategorieGuide } from './types'

/** Tous les guides, brouillons compris, dans l'ordre de lecture conseillé. */
export const GUIDES: Guide[] = [g0, g1, g2, g3, g4, g5] as unknown as Guide[]

export const guidesPublies = () => GUIDES.filter((g) => g.publie)
export const guideParSlug = (slug: string) => GUIDES.find((g) => g.slug === slug) || null
