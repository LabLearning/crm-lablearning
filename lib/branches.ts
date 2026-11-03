/**
 * Branches métier (secteur d'activité) — source de vérité partagée entre le CRM
 * (fiches formation / client / lead), le script de seed et le site vitrine.
 *
 * Une formation cible 0..n branches (`branches`), peut être « transverse »
 * (proposée à toutes : hygiène, sécurité, management), et être publiée ou non
 * sur le site (`site_publie`).
 */

export interface BrancheBase {
  slug: string
  label: string
  tagline: string
}

export const BRANCHES_BASE: BrancheBase[] = [
  { slug: 'restauration-rapide', label: 'Restauration rapide', tagline: 'Fast-food, tacos, pizza, burger, snacking' },
  { slug: 'restaurant-hcr', label: 'Restaurant & Hôtellerie', tagline: 'Restaurant, hôtel, café, bar · CHR' },
  { slug: 'boucherie-charcuterie', label: 'Boucherie – Charcuterie', tagline: 'Boucherie, charcuterie, préparation des viandes' },
  { slug: 'boulangerie-patisserie', label: 'Boulangerie – Pâtisserie', tagline: 'Boulangerie, pâtisserie, viennoiserie' },
  // Ajouté le 03/11/2026 (Khadispal) : les formations transverses (hygiène,
  // sécurité, chariots, management) y figurent d'office
  { slug: 'grossiste-alimentaire', label: 'Grossiste alimentaire', tagline: 'Grossiste, cash & carry, distribution alimentaire' },
]

export const BRANCHE_SLUGS = BRANCHES_BASE.map((b) => b.slug)
export const brancheLabel = (slug: string) => BRANCHES_BASE.find((b) => b.slug === slug)?.label || slug

// Formations internes / one-off / hors métiers de bouche : non publiées sur le site.
export const OFFSITE_RE = /textile|odoo|sellsy|\bexcel\b|microsoft|\bproject\b|smart concept|parcours individuel|tronc commun|assistant(e)? (de direction|maître|maitre)|prise en main.*(crm|lms)|optimisation des potentiels|molina|gravat/i

// Mots-clés secteur (rapide prioritaire sur restaurant générique).
const SECTOR_RE: Record<string, RegExp> = {
  'restauration-rapide': /rapide|fast[- ]?food|tacos|pizza|burger|snack|équipier|equipier|chickeez|chamas|kebab|\bnst\b|barista/i,
  'restaurant-hcr': /restaurant|restauration|h[oô]tel|caf[eé]|\bbar\b|serveu|\bsalle\b|moule|\bsauce|cuisine|culinaire|traiteur/i,
  'boucherie-charcuterie': /bouch|charcut|\bviande/i,
  'boulangerie-patisserie': /boulanger|\bpain\b|p[aâ]tiss|viennois|no[eë]l/i,
}

// Thèmes (sous-groupes sur une page branche) ; ordre = priorité de classement.
export const THEMES: { key: string; label: string; re: RegExp }[] = [
  { key: 'hygiene', label: 'Hygiène & sécurité alimentaire', re: /hygi[eè]ne|haccp|\bpms\b|sanitaire|tra[cç]abilit|[eé]tiquet|nettoyage|d[eé]sinfection|ma[iî]trise sanitaire|denr[eé]es/i },
  { key: 'prevention', label: 'Prévention & sécurité au travail', re: /duerp|document unique|incendie|\bsst\b|secouri|risques? professionnel|\btms\b|gestes et postures|chariot|conduite en s[eé]curit|s[eé]curit[eé] au travail/i },
  { key: 'management', label: 'Management, gestion & performance', re: /manage|leadership|gestion|rentabilit|accueil client|\bvente|fid[eé]lisation|communication|conflit|m[eé]diation|commercial|financement|posture professionnelle|intelligence artificielle|\bia\b/i },
  { key: 'metier', label: 'Cœur de métier', re: /.*/ },
]

export function themeOf(intitule: string): string {
  const n = intitule || ''
  for (const t of THEMES) if (t.re.test(n)) return t.key
  return 'metier'
}

export function sectorsOf(intitule: string): string[] {
  const n = intitule || ''
  const out: string[] = []
  if (SECTOR_RE['restauration-rapide'].test(n)) out.push('restauration-rapide')
  else if (SECTOR_RE['restaurant-hcr'].test(n)) out.push('restaurant-hcr')
  if (SECTOR_RE['boucherie-charcuterie'].test(n)) out.push('boucherie-charcuterie')
  if (SECTOR_RE['boulangerie-patisserie'].test(n)) out.push('boulangerie-patisserie')
  return out
}

/** Classe une formation : secteurs, transverse, publiée sur le site. */
export function classifyFormation(intitule: string): { branches: string[]; est_transverse: boolean; site_publie: boolean } {
  if (OFFSITE_RE.test(intitule)) return { branches: [], est_transverse: false, site_publie: false }
  const branches = sectorsOf(intitule)
  const theme = themeOf(intitule)
  const est_transverse = branches.length === 0 && theme !== 'metier'
  // cœur de métier sans secteur identifiable → non publié (rien d'incohérent)
  const site_publie = branches.length > 0 || est_transverse
  return { branches, est_transverse, site_publie }
}

export interface BrancheFormationInput {
  id: string
  intitule: string
  duree_heures: number | null
  modalite: string | null
  objectifs: string[]
  // Champs réels (quand la migration branches est appliquée) — sinon undefined
  branches?: string[] | null
  est_transverse?: boolean | null
  site_publie?: boolean | null
}

export interface BrancheGroup<T> { key: string; label: string; formations: T[] }

/**
 * Répartit les formations par branche. Utilise les champs réels
 * (`branches`/`est_transverse`/`site_publie`) s'ils sont présents, sinon retombe
 * sur le classifieur par mots-clés (avant migration). Groupe par thème.
 */
export function buildBranches<T extends BrancheFormationInput>(formations: T[]): Map<string, BrancheGroup<T>[]> {
  const hasRealData = formations.some((f) => f.branches !== undefined || f.est_transverse !== undefined || f.site_publie !== undefined)
  const perBranche = new Map<string, T[]>()
  for (const b of BRANCHES_BASE) perBranche.set(b.slug, [])

  for (const f of formations) {
    let branches: string[], transverse: boolean, publie: boolean
    if (hasRealData) {
      publie = f.site_publie !== false
      branches = Array.isArray(f.branches) ? f.branches : []
      transverse = !!f.est_transverse
    } else {
      const c = classifyFormation(f.intitule)
      publie = c.site_publie; branches = c.branches; transverse = c.est_transverse
    }
    if (!publie) continue
    if (transverse) { for (const b of BRANCHES_BASE) perBranche.get(b.slug)!.push(f) }
    else for (const s of branches) if (perBranche.has(s)) perBranche.get(s)!.push(f)
  }

  const result = new Map<string, BrancheGroup<T>[]>()
  for (const b of BRANCHES_BASE) {
    const fs = perBranche.get(b.slug)!
    const groups: BrancheGroup<T>[] = []
    for (const t of THEMES) {
      const inTheme = fs.filter((f) => themeOf(f.intitule) === t.key)
      if (inTheme.length) groups.push({ key: t.key, label: t.label, formations: inTheme })
    }
    groups.sort((a, z) => (a.key === 'metier' ? -1 : z.key === 'metier' ? 1 : 0))
    result.set(b.slug, groups)
  }
  return result
}
