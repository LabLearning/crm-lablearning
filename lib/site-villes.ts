// Pages « formation restauration rapide à <ville> » du site public.
//
// Une ville n'a sa page que si nous y avons réellement formé : au moins
// SEUIL_SESSIONS sessions terminées dans au moins SEUIL_ETABLISSEMENTS
// établissements. Tout ce qu'affiche la page (sessions, stagiaires,
// établissements, formations suivies) vient du CRM ; aucune page n'est créée
// pour une ville où nous n'avons pas travaillé, et aucun client n'est nommé.
//
// Les parcours POEI n'entrent dans aucun décompte : ils ne paraissent nulle
// part sur le site (voir lib/public-site-data.ts).

import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchAllPaged } from '@/lib/supabase/fetch-all'

const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const SEUIL_SESSIONS = 5
const SEUIL_ETABLISSEMENTS = 2

export interface VilleFormation { id: string | null; intitule: string; sessions: number }

export interface VilleData {
  slug: string
  nom: string
  departement: string
  nomDepartement: string | null
  sessions: number
  stagiaires: number
  etablissements: number
  depuis: number | null
  formations: VilleFormation[]
}

const sansAccent = (v: unknown) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Clé d'une ville : sans accent, sans tiret, sans « cedex » ni arrondissement. */
function cleVille(v: unknown): string {
  return sansAccent(v).replace(/[-'’]/g, ' ').replace(/\s+cedex.*$/, '').replace(/\s+\d+\s*(er|e|eme)?$/, '').replace(/\s+/g, ' ').trim()
}

/** Graphies exactes des villes que la mise en forme automatique écrirait mal. */
const GRAPHIES: Record<string, string> = {
  sete: 'Sète', nimes: 'Nîmes', beziers: 'Béziers', echirolles: 'Échirolles', venissieux: 'Vénissieux',
  'saint etienne': 'Saint-Étienne', orleans: 'Orléans', besancon: 'Besançon', 'ille sur tet': 'Ille-sur-Têt',
  chateauroux: 'Châteauroux', frejus: 'Fréjus', ales: 'Alès', 'saint denis': 'Saint-Denis', pezenas: 'Pézenas',
  meze: 'Mèze', 'clermont l herault': 'Clermont-l’Hérault', 'aix en provence': 'Aix-en-Provence',
}
const PETITS_MOTS = new Set(['en', 'sur', 'sous', 'de', 'du', 'des', 'le', 'la', 'les', 'les', 'aux', 'et', 'd', 'l'])

/** « le grau du roi » → « Le Grau-du-Roi ». L'article de tête reste séparé par une espace. */
export function nomVille(cle: string): string {
  if (GRAPHIES[cle]) return GRAPHIES[cle]
  const mots = cle.split(' ').filter(Boolean)
  const article = ['le', 'la', 'les'].includes(mots[0]) && mots.length > 1 ? mots.shift()! : null
  const corps = mots.map((m, i) => (i > 0 && PETITS_MOTS.has(m) ? m : m.charAt(0).toUpperCase() + m.slice(1))).join('-')
  return article ? `${article.charAt(0).toUpperCase()}${article.slice(1)} ${corps}` : corps
}

/** « à Lyon », « au Havre », « aux Lilas ». */
export function aVille(nom: string): string {
  if (/^Le\s/.test(nom)) return `au ${nom.slice(3)}`
  if (/^Les\s/.test(nom)) return `aux ${nom.slice(4)}`
  return `à ${nom}`
}

const DEPARTEMENTS: Record<string, string> = {
  '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège',
  '10': 'Aube', '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal', '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze',
  '21': 'Côte-d’Or', '22': 'Côtes-d’Armor', '23': 'Creuse', '24': 'Dordogne', '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère',
  '30': 'Gard', '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde', '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura',
  '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique', '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire',
  '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord',
  '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône',
  '70': 'Haute-Saône', '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres',
  '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse', '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne',
  '90': 'Territoire de Belfort', '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': 'Val-d’Oise',
}

const normTitre = (s: unknown) => sansAccent(s).replace(/\s+/g, ' ').trim()

export interface ChiffresRestaurationRapide { sessions: number; stagiaires: number; etablissements: number; villes: number }

/** Un établissement de restauration rapide : classé ainsi dans le CRM, ou code NAF 56.10C. */
const estRestaurationRapide = (client: any) =>
  client?.branche === 'restauration-rapide' || String(client?.code_naf || '').replace(/\./g, '').toUpperCase() === '5610C'

async function calculer(): Promise<{ villes: VilleData[]; rapide: ChiffresRestaurationRapide }> {
  const supabase = await createServiceRoleClient()
  const [sessions, inscriptions, { data: fiches }] = await Promise.all([
    fetchAllPaged<any>((from, to) => supabase.from('sessions')
      .select('id, ville, code_postal, date_debut, client_id, poei_intervention_id, client:client_id(ville, code_postal, code_naf, branche), formation:formation_id(intitule, is_poei)')
      .eq('organization_id', ORG).eq('status', 'terminee').order('id').range(from, to)),
    fetchAllPaged<any>((from, to) => supabase.from('inscriptions')
      .select('session_id, apprenant_id, status').eq('organization_id', ORG).order('id').range(from, to)),
    supabase.from('formations').select('id, intitule')
      .eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true).limit(500),
  ])

  const ficheParTitre = new Map<string, string>()
  for (const f of (fiches || []) as any[]) if (!ficheParTitre.has(normTitre(f.intitule))) ficheParTitre.set(normTitre(f.intitule), f.id)

  const inscritsParSession = new Map<string, string[]>()
  for (const i of inscriptions) {
    if (['annule', 'abandonne'].includes(String(i.status))) continue
    if (!inscritsParSession.has(i.session_id)) inscritsParSession.set(i.session_id, [])
    inscritsParSession.get(i.session_id)!.push(i.apprenant_id)
  }

  const villes = new Map<string, { sessions: number; stagiaires: Set<string>; etablissements: Set<string>; deps: Map<string, number>; annees: number[]; formations: Map<string, { intitule: string; sessions: number }> }>()
  const rapide = { sessions: 0, stagiaires: new Set<string>(), etablissements: new Set<string>(), villes: new Set<string>() }
  for (const s of sessions) {
    if (s.poei_intervention_id || s.formation?.is_poei) continue
    const inscrits = inscritsParSession.get(s.id) || []
    if (!inscrits.length) continue
    const cle = cleVille(s.ville || s.client?.ville)
    if (estRestaurationRapide(s.client)) {
      rapide.sessions++
      for (const a of inscrits) rapide.stagiaires.add(a)
      if (s.client_id) rapide.etablissements.add(s.client_id)
      if (cle) rapide.villes.add(cle)
    }
    if (!cle) continue
    if (!villes.has(cle)) villes.set(cle, { sessions: 0, stagiaires: new Set(), etablissements: new Set(), deps: new Map(), annees: [], formations: new Map() })
    const v = villes.get(cle)!
    v.sessions++
    for (const a of inscrits) v.stagiaires.add(a)
    if (s.client_id) v.etablissements.add(s.client_id)
    const dep = String(s.code_postal || s.client?.code_postal || '').trim().slice(0, 2)
    if (/^\d{2}$/.test(dep)) v.deps.set(dep, (v.deps.get(dep) || 0) + 1)
    if (s.date_debut) v.annees.push(Number(String(s.date_debut).slice(0, 4)))
    const titre = String(s.formation?.intitule || '').trim()
    if (titre) {
      const k = normTitre(titre)
      const f = v.formations.get(k) || { intitule: titre, sessions: 0 }
      f.sessions++
      v.formations.set(k, f)
    }
  }

  const out: VilleData[] = []
  for (const [cle, v] of villes) {
    if (v.sessions < SEUIL_SESSIONS || v.etablissements.size < SEUIL_ETABLISSEMENTS) continue
    const departement = [...v.deps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    out.push({
      slug: cle.replace(/\s+/g, '-'),
      nom: nomVille(cle),
      departement,
      nomDepartement: DEPARTEMENTS[departement] || null,
      sessions: v.sessions,
      stagiaires: v.stagiaires.size,
      etablissements: v.etablissements.size,
      depuis: v.annees.length ? Math.min(...v.annees) : null,
      formations: [...v.formations.entries()]
        .sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 6)
        .map(([k, f]) => ({ id: ficheParTitre.get(k) || null, intitule: f.intitule, sessions: f.sessions })),
    })
  }
  return {
    villes: out.sort((a, b) => b.sessions - a.sessions),
    rapide: { sessions: rapide.sessions, stagiaires: rapide.stagiaires.size, etablissements: rapide.etablissements.size, villes: rapide.villes.size },
  }
}

// Recalculé toutes les six heures
const calculEnCache = unstable_cache(calculer, ['site-villes-v2'], { revalidate: 6 * 3600, tags: ['site-villes'] })

/** Les villes qui ont leur page, de la plus formée à la moins formée. */
export const getVilles = async (): Promise<VilleData[]> => (await calculEnCache()).villes

/** Ce que nous avons réalisé pour des établissements de restauration rapide, France entière. */
export const getChiffresRestaurationRapide = async (): Promise<ChiffresRestaurationRapide> => (await calculEnCache()).rapide

export async function getVille(slug: string): Promise<VilleData | null> {
  return (await getVilles()).find((v) => v.slug === slug) || null
}
