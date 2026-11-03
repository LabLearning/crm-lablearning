import { ChefHat, Beef, Wheat, Cake, Croissant, Coffee, Wine, Sandwich, Management, Hygiene, FirstAid, Formation, Warehouse } from './icons'

export interface MetierStyle {
  Icon: any
  from: string   // dégradé début
  to: string     // dégradé fin
  tint: string   // teinte de fond douce (card)
  ink: string    // couleur accent lisible
  img: string    // photo métier (public/site/metiers)
}

const IMG = (k: string) => `/site/metiers/${k}.webp`

/**
 * Identité visuelle par catégorie de formation : une icône, un dégradé et une
 * photo réelle, qui servent d'« image » sur les cards. Aucun emoji.
 * Couvre les thématiques réelles du catalogue (management, hygiène, secourisme,
 * restauration…) puis les métiers de bouche, avec un repli « formation ».
 */
export function metierStyle(nom: string): MetierStyle {
  const n = (nom || '').toLowerCase()

  // ── Thématiques transverses ──
  if (n.includes('intelligence artificielle') || n.includes(' ia ') || n.startsWith('ia ') || n.includes('digital') || n.includes('crm') || n.includes('lms'))
    return { Icon: Formation, from: '#4C1D95', to: '#7C3AED', tint: '#F5F3FF', ink: '#6D28D9', img: IMG('formation') }
  if (n.includes('commercial') || n.includes('vente') || n.includes('fidélisation') || n.includes('fidelisation') || n.includes('création d\'entreprise') || n.includes('creation d\'entreprise'))
    return { Icon: Management, from: '#1E3A8A', to: '#3B82F6', tint: '#EFF6FF', ink: '#1D4ED8', img: IMG('management') }
  if (n.includes('traçab') || n.includes('tracab') || n.includes('étiquet') || n.includes('etiquet') || n.includes('allerg'))
    return { Icon: Hygiene, from: '#0E7490', to: '#06B6D4', tint: '#ECFEFF', ink: '#0E7490', img: IMG('hygiene') }
  if (n.includes('managem') || n.includes('encadr') || n.includes('gestion') || n.includes('leader') || n.includes('rh') || n.includes('ressources humaines'))
    return { Icon: Management, from: '#312E81', to: '#4F46E5', tint: '#EEF2FF', ink: '#4338CA', img: IMG('management') }
  if (n.includes('hygièn') || n.includes('hygien') || n.includes('haccp') || n.includes('salubr') || n.includes('propreté') || n.includes('proprete') || n.includes('nettoyage'))
    return { Icon: Hygiene, from: '#0E7490', to: '#06B6D4', tint: '#ECFEFF', ink: '#0E7490', img: IMG('hygiene') }
  if (n.includes('secour') || n.includes('sst') || n.includes('sauveteur') || n.includes('incendie') || n.includes('sécurit') || n.includes('securit'))
    return { Icon: FirstAid, from: '#9F1239', to: '#E11D48', tint: '#FFF1F2', ink: '#BE123C', img: IMG('secourisme') }

  // ── Distribution alimentaire ──
  if (n.includes('grossiste') || n.includes('cash & carry') || n.includes('cash and carry'))
    return { Icon: Warehouse, from: '#1E293B', to: '#475569', tint: '#F1F5F9', ink: '#334155', img: IMG('grossiste') }

  // ── Métiers de bouche ──
  if (n.includes('bouch'))
    return { Icon: Beef, from: '#7F1D1D', to: '#B91C1C', tint: '#FEF2F2', ink: '#B91C1C', img: IMG('boucherie') }
  if (n.includes('boulanger') || n.includes('pain'))
    return { Icon: Wheat, from: '#92400E', to: '#D97706', tint: '#FFFBEB', ink: '#B45309', img: IMG('boulangerie') }
  if (n.includes('viennois') || n.includes('croissant'))
    return { Icon: Croissant, from: '#B45309', to: '#F59E0B', tint: '#FFFBEB', ink: '#B45309', img: IMG('boulangerie') }
  if (n.includes('patiss') || n.includes('pâtiss') || n.includes('dessert'))
    return { Icon: Cake, from: '#9D174D', to: '#DB2777', tint: '#FDF2F8', ink: '#BE185D', img: IMG('patisserie') }
  if (n.includes('rapid') || n.includes('snack') || n.includes('burger') || n.includes('fast'))
    return { Icon: Sandwich, from: '#9A3412', to: '#EA580C', tint: '#FFF7ED', ink: '#C2410C', img: IMG('rapide') }
  if (n.includes('hcr') || n.includes('hôtel') || n.includes('hotel') || n.includes('café') || n.includes('cafe') || n.includes('bar') || n.includes('service') || n.includes('salle'))
    return { Icon: Coffee, from: '#1E3A8A', to: '#4338CA', tint: '#EEF2FF', ink: '#4338CA', img: IMG('hcr') }
  if (n.includes('vin') || n.includes('sommel') || n.includes('boisson'))
    return { Icon: Wine, from: '#581C87', to: '#7C3AED', tint: '#FAF5FF', ink: '#7C3AED', img: IMG('hcr') }
  if (n.includes('cuisin') || n.includes('chef') || n.includes('restaur'))
    return { Icon: ChefHat, from: '#134E4A', to: '#0F766E', tint: '#F0FDFA', ink: '#0F766E', img: IMG('cuisine') }

  // ── Repli : formation générique ──
  return { Icon: Formation, from: '#205040', to: '#0F766E', tint: '#F0FDFA', ink: '#205040', img: IMG('formation') }
}
