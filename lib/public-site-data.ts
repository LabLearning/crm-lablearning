import { createServiceRoleClient } from '@/lib/supabase/server'

// Organisation Lab Learning (site vitrine mono-org pour l'instant).
const ORG = process.env.PUBLIC_SITE_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'

const norm = (s: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')

export interface PublicFormation {
  id: string
  intitule: string
  categorie: string | null
  duree_heures: number | null
  modalite: string | null
  objectifs: string[]
  /** Prix catalogue, calé sur la prise en charge OPCO de la branche. */
  tarif_inter_ht: number | null
  tarif_intra_ht: number | null
}

/**
 * Sessions réalisées par programme, agrégées par intitulé normalisé : les
 * sessions historiques pointent parfois vers des fiches doublons dépubliées,
 * le rapprochement par titre rattache leur volume à la fiche publiée.
 */
export async function getSessionsRealiseesParTitre(): Promise<Map<string, number>> {
  const supabase = await createServiceRoleClient()
  const out = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('sessions')
      .select('id, formation:formation_id(intitule)')
      .eq('organization_id', ORG).eq('status', 'terminee')
      .range(from, from + 999)
    for (const s of (data || []) as any[]) {
      const k = norm(s.formation?.intitule)
      if (k) out.set(k, (out.get(k) || 0) + 1)
    }
    if (!data || data.length < 1000) break
  }
  return out
}

export const normTitre = norm

export interface PublicSiteData {
  stats: { formations: number; apprenants: number; sessionsRealisees: number; entreprises: number }
  formations: PublicFormation[]
  categories: { nom: string; formations: PublicFormation[] }[]
  franchises: { nom: string; logo_url: string | null; secteur: string | null; nombre_etablissements: number | null }[]
}

/*
 * Les formations POEI (formations.is_poei) ne paraissent nulle part sur le
 * site public : Lab Learning ne met pas en avant la POEI, dispositif de
 * France Travail dont il n'est pas partenaire (courrier de France Travail
 * Auvergne-Rhône-Alpes du 30/09/2026). Filtre .not('is_poei', 'is', true)
 * sur chaque requête du catalogue, et au sitemap.
 */

/**
 * Données LIVE du CRM pour le site vitrine : catalogue de formations (dédoublonné
 * par intitulé), partenaires franchise, et compteurs temps réel. Chaque formation
 * créée dans le CRM apparaît automatiquement ici.
 */
export async function getPublicSiteData(): Promise<PublicSiteData> {
  const supabase = await createServiceRoleClient()

  const [formationsRes, franchisesRes, apprC, sessC, cliC, catalogueC, resPub] = await Promise.all([
    supabase.from('formations')
      .select('id, intitule, categorie, duree_heures, modalite, objectifs_pedagogiques, tarif_inter_ht, tarif_intra_ht')
      .eq('organization_id', ORG).eq('is_active', true).not('is_poei', 'is', true).order('intitule'),
    supabase.from('franchises')
      .select('nom, logo_url, secteur, nombre_etablissements')
      .eq('organization_id', ORG).eq('is_active', true).not('logo_url', 'is', null)
      .order('nombre_etablissements', { ascending: false, nullsFirst: false }),
    supabase.from('apprenants').select('id', { count: 'exact', head: true }).eq('organization_id', ORG),
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('organization_id', ORG).eq('status', 'terminee'),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', ORG).eq('type', 'entreprise'),
    // Le chiffre "programmes au catalogue" doit être celui du catalogue
    // effectivement publié sur le site, pas le total interne des fiches.
    supabase.from('formations').select('id', { count: 'exact', head: true })
      .eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true),
    // "Apprenants formés" et "sessions réalisées" s'alignent sur l'indicateur
    // publié (page Résultats) : mêmes chiffres partout sur le site, calés sur
    // la période auditée — le comptage live inclut des sessions tout juste
    // basculées « terminée » que l'indicateur n'a pas encore intégrées.
    supabase.from('indicateurs_resultats').select('nb_stagiaires, nb_sessions')
      .eq('organization_id', ORG).eq('publie', true).maybeSingle(),
  ])

  // Dédoublonnage par intitulé normalisé
  const seen = new Set<string>()
  const formations: PublicFormation[] = []
  for (const f of (formationsRes.data || []) as any[]) {
    const k = norm(f.intitule)
    if (!k || seen.has(k)) continue
    seen.add(k)
    formations.push({
      id: f.id, intitule: f.intitule, categorie: f.categorie || null,
      duree_heures: f.duree_heures || null, modalite: f.modalite || null,
      objectifs: Array.isArray(f.objectifs_pedagogiques) ? f.objectifs_pedagogiques.slice(0, 4) : [],
      tarif_inter_ht: f.tarif_inter_ht || null, tarif_intra_ht: f.tarif_intra_ht || null,
    })
  }

  // Regroupement par catégorie
  const catMap = new Map<string, PublicFormation[]>()
  for (const f of formations) {
    const c = f.categorie || 'Autres formations'
    if (!catMap.has(c)) catMap.set(c, [])
    catMap.get(c)!.push(f)
  }
  const categories = [...catMap.entries()]
    .map(([nom, fs]) => ({ nom, formations: fs }))
    .sort((a, b) => b.formations.length - a.formations.length)

  return {
    stats: {
      formations: catalogueC.count || formations.length,
      apprenants: (resPub as any)?.data?.nb_stagiaires || apprC.count || 0,
      sessionsRealisees: (resPub as any)?.data?.nb_sessions || sessC.count || 0,
      entreprises: cliC.count || 0,
    },
    formations,
    categories,
    franchises: (franchisesRes.data || []) as any[],
  }
}

import { buildBranches, BRANCHES_BASE, type BrancheFormationInput, type BrancheGroup } from '@/lib/branches'

export interface BrancheData {
  slug: string
  label: string
  tagline: string
  total: number
  groups: BrancheGroup<PublicFormation>[]
}

/**
 * Catalogue réparti par branche métier. Utilise les vrais champs
 * (branches/est_transverse/site_publie) dès que la migration 099 est appliquée,
 * sinon retombe sur le classifieur par mots-clés — le site marche dans les deux cas.
 */
export async function getBranchesData(): Promise<BrancheData[]> {
  const supabase = await createServiceRoleClient()
  const base = 'id, intitule, categorie, duree_heures, modalite, objectifs_pedagogiques, tarif_inter_ht, tarif_intra_ht'
  let rows: any[] | null = null
  // Tente les colonnes branche ; si absentes (avant migration), on refait sans.
  const withCols = await supabase.from('formations')
    .select(`${base}, branches, est_transverse, site_publie`)
    .eq('organization_id', ORG).eq('is_active', true).not('is_poei', 'is', true).order('intitule')
  if (withCols.error) {
    const basic = await supabase.from('formations')
      .select(base).eq('organization_id', ORG).eq('is_active', true).not('is_poei', 'is', true).order('intitule')
    rows = basic.data || []
  } else {
    rows = withCols.data || []
  }

  // Dédoublonnage par intitulé normalisé. Les fiches publiées passent en
  // premier : sinon un doublon dépublié du même intitulé peut « gagner » la
  // place et faire disparaître la fiche phare du catalogue.
  rows.sort((a: any, b: any) => Number(b.site_publie === true) - Number(a.site_publie === true))
  const seen = new Set<string>()
  const formations: (PublicFormation & BrancheFormationInput)[] = []
  for (const f of rows) {
    const k = norm(f.intitule)
    if (!k || seen.has(k)) continue
    seen.add(k)
    formations.push({
      id: f.id, intitule: f.intitule, categorie: f.categorie || null,
      duree_heures: f.duree_heures || null, modalite: f.modalite || null,
      objectifs: Array.isArray(f.objectifs_pedagogiques) ? f.objectifs_pedagogiques.slice(0, 4) : [],
      tarif_inter_ht: f.tarif_inter_ht || null, tarif_intra_ht: f.tarif_intra_ht || null,
      branches: f.branches, est_transverse: f.est_transverse, site_publie: f.site_publie,
    })
  }

  const map = buildBranches(formations)
  return BRANCHES_BASE.map((b) => {
    const groups = (map.get(b.slug) || []) as BrancheGroup<PublicFormation>[]
    return { slug: b.slug, label: b.label, tagline: b.tagline, total: groups.reduce((s, g) => s + g.formations.length, 0), groups }
  })
}

export interface PublicFormationDetail extends PublicFormation {
  sous_titre: string | null
  public_vise: string | null
  prerequis: string | null
  programme_detaille: string | null
  methodes_pedagogiques: string | null
  modalites_evaluation: string | null
  accessibilite_handicap: string | null
  competences_visees: string[]
  duree_jours: number | null
  /** Mentions exigées par l'indicateur 1 : tarif, admission, délai d'accès. */
  tarif_intra_ht: number | null
  tarif_inter_ht: number | null
  branches: string[]
  modalites_admission: string | null
  delai_acces: string | null
  date_derniere_maj: string | null
  version?: number | null
  date_conception?: string | null
  taux_satisfaction?: number | null
  taux_reussite?: number | null
  nombre_apprenants_total?: number | null
}

/** Détail public d'une formation (par id). */
export async function getPublicFormation(id: string): Promise<PublicFormationDetail | null> {
  const supabase = await createServiceRoleClient()
  const { data: f } = await supabase.from('formations')
    .select('id, intitule, sous_titre, categorie, duree_heures, duree_jours, modalite, objectifs_pedagogiques, competences_visees, public_vise, prerequis, programme_detaille, methodes_pedagogiques, modalites_evaluation, accessibilite_handicap, tarif_intra_ht, tarif_inter_ht, modalites_admission, date_derniere_maj, branches, version, historique_versions, taux_satisfaction, taux_reussite, nombre_apprenants_total')
    .eq('id', id).eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true).maybeSingle()
  if (!f) return null
  // Le délai d'accès est une politique de l'organisme, pas de la formation.
  const { data: org } = await supabase.from('organizations').select('delai_acces').eq('id', ORG).maybeSingle()
  return {
    id: (f as any).id, intitule: (f as any).intitule, sous_titre: (f as any).sous_titre || null,
    categorie: (f as any).categorie || null, duree_heures: (f as any).duree_heures || null,
    duree_jours: (f as any).duree_jours || null, modalite: (f as any).modalite || null,
    objectifs: Array.isArray((f as any).objectifs_pedagogiques) ? (f as any).objectifs_pedagogiques : [],
    competences_visees: Array.isArray((f as any).competences_visees) ? (f as any).competences_visees : [],
    public_vise: (f as any).public_vise || null, prerequis: (f as any).prerequis || null,
    programme_detaille: (f as any).programme_detaille || null,
    methodes_pedagogiques: (f as any).methodes_pedagogiques || null,
    modalites_evaluation: (f as any).modalites_evaluation || null,
    accessibilite_handicap: (f as any).accessibilite_handicap || null,
    tarif_intra_ht: (f as any).tarif_intra_ht || null,
    tarif_inter_ht: (f as any).tarif_inter_ht || null,
    branches: Array.isArray((f as any).branches) ? (f as any).branches : [],
    modalites_admission: (f as any).modalites_admission || null,
    delai_acces: (org as any)?.delai_acces || null,
    date_derniere_maj: (f as any).date_derniere_maj || null,
    version: (f as any).version || null,
    date_conception: (Array.isArray((f as any).historique_versions)
      ? (f as any).historique_versions.find((h: any) => h?.evenement === 'conception')?.date
      : null) || null,
    taux_satisfaction: (f as any).taux_satisfaction ?? null,
    taux_reussite: (f as any).taux_reussite ?? null,
    nombre_apprenants_total: (f as any).nombre_apprenants_total ?? null,
  }
}

/**
 * Témoignages clients LIVE : les appréciations d'entreprises du registre
 * Qualiopi (ind. 30) avec verbatim et bonne note — la preuve sociale du site
 * n'est jamais rédigée à la main, elle vient du terrain.
 */
export async function getPublicTemoignages(limit = 9): Promise<Array<{
  note: number; commentaire: string; nom: string; fonction: string | null; entreprise: string | null
}>> {
  try {
    const supabase = await createServiceRoleClient()
    const { data } = await supabase.from('appreciations_parties_prenantes')
      .select('note_globale, commentaire, repondant_nom, repondant_fonction, client:client_id(raison_sociale, nom_commercial)')
      .eq('organization_id', ORG).eq('type', 'entreprise')
      .not('commentaire', 'is', null).gte('note_globale', 4)
      .order('created_at', { ascending: false }).limit(limit)
    return (data || [])
      .filter((a: any) => (a.commentaire || '').trim().length > 15)
      .map((a: any) => ({
        note: a.note_globale,
        commentaire: a.commentaire.trim(),
        nom: a.repondant_nom || 'Client Lab Learning',
        fonction: (a.repondant_fonction || '').replace(' — recueilli par téléphone', '') || null,
        entreprise: a.client?.nom_commercial || a.client?.raison_sociale || null,
      }))
  } catch { return [] }
}

/**
 * Formations les plus suivies (fiches publiées) : photo, durée, tarif et
 * satisfaction — la vitrine « populaires » de l'accueil.
 */
export async function getFormationsPopulaires(limit = 3): Promise<any[]> {
  try {
    const supabase = await createServiceRoleClient()
    const { data } = await supabase.from('formations')
      .select('id, intitule, categorie, duree_heures, duree_jours, tarif_inter_ht, tarif_intra_ht, taux_satisfaction, nombre_apprenants_total')
      .eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true)
      .not('nombre_apprenants_total', 'is', null)
      .order('nombre_apprenants_total', { ascending: false }).limit(limit)
    return data || []
  } catch { return [] }
}

/**
 * Formations liées (même catégorie, fiche publiée) : le maillage interne des
 * fiches — trois suggestions en pied de page.
 */
export async function getFormationsLiees(excludeId: string, categorie: string | null, limit = 3): Promise<any[]> {
  try {
    const supabase = await createServiceRoleClient()
    let q = supabase.from('formations')
      .select('id, intitule, categorie, duree_heures, taux_satisfaction')
      .eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true)
      .neq('id', excludeId)
      .order('nombre_apprenants_total', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (categorie) q = q.eq('categorie', categorie)
    const { data } = await q
    if (data && data.length >= 2) return data
    // Pas assez dans la catégorie : on complète toutes catégories confondues
    const { data: autres } = await supabase.from('formations')
      .select('id, intitule, categorie, duree_heures, taux_satisfaction')
      .eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true)
      .neq('id', excludeId)
      .order('nombre_apprenants_total', { ascending: false, nullsFirst: false })
      .limit(limit)
    return autres || []
  } catch { return [] }
}

export async function getPublicResultats(): Promise<any | null> {
  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase.from('indicateurs_resultats').select('*').eq('organization_id', ORG).eq('publie', true).maybeSingle()
    if (error) return null
    return data || null
  } catch { return null }
}
