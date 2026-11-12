import { TABLES_EXCLUES, estSecrete } from './securite'

/**
 * Tables et colonnes du CRM lues dans la description OpenAPI de PostgREST
 * (clé de service) : le connecteur suit les migrations sans liste à tenir.
 * Une table nouvelle à organization_id devient lisible d'elle-même ; une table
 * sans organization_id n'est lisible que si elle est rattachée ici. Gardé en
 * mémoire 15 minutes par instance.
 */

export type Colonne = { nom: string; type: string; cible?: string }

export type Portee =
  | { type: 'organisation' }
  /** La fiche de l'organisme : sa seule ligne */
  | { type: 'organisme' }
  | { type: 'referentiel'; filtreObligatoire?: boolean }
  /** Remonte par clés étrangères jusqu'à une table à organization_id */
  | { type: 'enfant'; chemin: { table: string; fk: string }[] }

export type TableCrm = { nom: string; colonnes: Colonne[]; portee: Portee }

/** Données publiques ou de plateforme, sans organisation */
const REFERENTIELS: Record<string, { filtreObligatoire?: boolean }> = {
  opco: {},
  opco_idcc_codes: {},
  opco_naf_codes: {},
  // 3,4 millions de lignes : jamais de lecture sans filtre
  siret_opco: { filtreObligatoire: true },
  sante_plateforme: {},
  incidents_plateforme: {},
}

/** Tables sans organization_id, rattachées à leur parent */
const ENFANTS: Record<string, { table: string; fk: string }[]> = {
  facture_lignes: [{ table: 'factures', fk: 'facture_id' }],
  devis_lignes: [{ table: 'devis', fk: 'devis_id' }],
  dossier_checklist: [{ table: 'dossiers_formation', fk: 'dossier_id' }],
  dossier_timeline: [{ table: 'dossiers_formation', fk: 'dossier_id' }],
  crm_taches_commentaires: [{ table: 'crm_taches', fk: 'tache_id' }],
  formation_formateurs: [{ table: 'formations', fk: 'formation_id' }],
  qcm_questions: [{ table: 'qcm', fk: 'qcm_id' }],
  qcm_choix: [{ table: 'qcm_questions', fk: 'question_id' }, { table: 'qcm', fk: 'qcm_id' }],
  qcm_reponses_detail: [{ table: 'qcm_reponses', fk: 'reponse_id' }],
  session_formations: [{ table: 'sessions', fk: 'session_id' }],
}

const DUREE_CACHE = 15 * 60_000

async function chargerSchema(): Promise<Map<string, TableCrm>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !cle) throw new Error('Configuration Supabase absente')
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, Accept: 'application/openapi+json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`Description de la base illisible (${r.status})`)
  const defs: Record<string, any> = (await r.json())?.definitions || {}

  // Toutes les colonnes (secrètes comprises) servent à vérifier les rattachements
  const brutes = new Map<string, Colonne[]>()
  for (const [nom, def] of Object.entries(defs)) {
    const props: Record<string, any> = def?.properties || {}
    brutes.set(nom, Object.entries(props).map(([c, p]) => ({
      nom: c,
      type: String(p?.format || p?.type || 'inconnu'),
      cible: /<fk table='([^']+)'/.exec(String(p?.description || ''))?.[1],
    })))
  }

  const tables = new Map<string, TableCrm>()
  for (const [nom, colonnes] of Array.from(brutes)) {
    if (TABLES_EXCLUES.has(nom)) continue
    const noms = new Set(colonnes.map((c) => c.nom))
    let portee: Portee | null = null
    if (nom === 'organizations') portee = { type: 'organisme' }
    else if (noms.has('organization_id')) portee = { type: 'organisation' }
    else if (REFERENTIELS[nom]) portee = { type: 'referentiel', ...REFERENTIELS[nom] }
    else if (ENFANTS[nom] && cheminValide(nom, ENFANTS[nom], brutes)) portee = { type: 'enfant', chemin: ENFANTS[nom] }
    // Une table sans rattachement connu reste fermée
    if (!portee) continue
    tables.set(nom, { nom, colonnes: colonnes.filter((c) => !estSecrete(c.nom)), portee })
  }
  return tables
}

/** Chaque maillon doit être une vraie clé étrangère, et le dernier parent porter organization_id */
function cheminValide(depart: string, chemin: { table: string; fk: string }[], brutes: Map<string, Colonne[]>): boolean {
  let courante = depart
  for (const maillon of chemin) {
    const col = (brutes.get(courante) || []).find((c) => c.nom === maillon.fk)
    if (!col || col.cible !== maillon.table) return false
    courante = maillon.table
  }
  return (brutes.get(courante) || []).some((c) => c.nom === 'organization_id')
}

let cache: { le: number; tables: Promise<Map<string, TableCrm>> } | null = null

export function schemaCrm(): Promise<Map<string, TableCrm>> {
  if (!cache || Date.now() - cache.le > DUREE_CACHE) {
    const tables = chargerSchema()
    cache = { le: Date.now(), tables }
    // Un échec ne reste pas en cache : la requête suivante réessaie
    tables.catch(() => { cache = null })
  }
  return cache.tables
}
