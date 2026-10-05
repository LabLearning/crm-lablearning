import type { Guide } from './types'

export type { Guide, Bloc, SectionGuide, CategorieGuide } from './types'

/** Tous les guides, brouillons compris, du plus récent au plus ancien. */
export const GUIDES: Guide[] = ([] as Guide[]).sort((a, b) => b.publieLe.localeCompare(a.publieLe))

export const guidesPublies = () => GUIDES.filter((g) => g.publie)
export const guideParSlug = (slug: string) => GUIDES.find((g) => g.slug === slug) || null
