/**
 * Synchronisation AuditHygiène Pro → CRM.
 *
 * L'outil terrain (projet Supabase distinct) reste la source de vérité : on ne
 * lui écrit jamais rien. On recopie ici les établissements, les audits hygiène,
 * les DUERP et leur plan d'action, en rattachant chaque établissement à un
 * client du CRM. Le rapprochement automatique se fait sur le SIREN, puis sur
 * nom + ville ; un rapprochement validé à la main n'est jamais écrasé.
 */
import { createClient } from '@supabase/supabase-js'
import { fetchAllPaged } from '@/lib/supabase/fetch-all'

export interface ResumeSync {
  etablissements: number
  audits: number
  duerps: number
  actions: number
  rapproches_auto: number
  orphelins: number
  franchises_reconnues: number
}

export function auditHygieneClient() {
  const url = process.env.AUDITHYGIENE_SUPABASE_URL
  const key = process.env.AUDITHYGIENE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

const sourceAll = async (client: any, table: string, select = '*') => {
  let out: any[] = []
  let from = 0
  for (;;) {
    const { data, error } = await client.from(table).select(select).range(from, from + 999)
    if (error) throw new Error(`${table} : ${error.message}`)
    out = out.concat(data || [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  return out
}

// ── Rapprochement ───────────────────────────────────────────────────────────

export const normaliser = (s: unknown) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()

/** La ville de l'outil terrain contient parfois le code postal collé. */
export const villeSeule = (s: unknown) => normaliser(String(s || '').replace(/\b\d{5}\b/g, ''))

const siren = (s: unknown) => {
  const d = String(s || '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(0, 9) : ''
}

export interface ClientIndex {
  parSiren: Map<string, string>
  parNomVille: Map<string, string>
  parNom: Map<string, string | null>   // null = ambigu (plusieurs clients)
}

export function indexerClients(clients: any[]): ClientIndex {
  const parSiren = new Map<string, string>()
  const parNomVille = new Map<string, string>()
  const parNom = new Map<string, string | null>()
  for (const c of clients) {
    const s = siren(c.siret)
    if (s) parSiren.set(s, c.id)
    for (const nom of [c.raison_sociale, c.nom_commercial]) {
      if (!nom) continue
      parNomVille.set(`${normaliser(nom)}|${villeSeule(c.ville)}`, c.id)
      const k = normaliser(nom)
      parNom.set(k, parNom.has(k) && parNom.get(k) !== c.id ? null : c.id)
    }
  }
  return { parSiren, parNomVille, parNom }
}

export function rapprocher(
  etab: { nom?: string | null; ville?: string | null; siret?: string | null },
  idx: ClientIndex,
): { client_id: string | null; methode: string | null } {
  const s = siren(etab.siret)
  if (s && idx.parSiren.has(s)) return { client_id: idx.parSiren.get(s)!, methode: 'siren' }
  const kv = `${normaliser(etab.nom)}|${villeSeule(etab.ville)}`
  if (idx.parNomVille.has(kv)) return { client_id: idx.parNomVille.get(kv)!, methode: 'nom_ville' }
  const kn = normaliser(etab.nom)
  const unique = idx.parNom.get(kn)
  if (unique) return { client_id: unique, methode: 'nom' }
  return { client_id: null, methode: null }
}

/**
 * Franchise d'un établissement audité, déduite de son nom.
 * Beaucoup d'établissements audités appartiennent à un réseau connu sans être
 * clients en propre : les identifier en fait des prospects qualifiés.
 */
export function rapprocherFranchise(
  etab: { nom?: string | null },
  franchises: { id: string; nom: string }[],
): string | null {
  const nom = normaliser(etab.nom)
  if (!nom) return null
  const mots = nom.split(' ')
  let meilleur: { id: string; longueur: number } | null = null
  for (const f of franchises) {
    const fn = normaliser(f.nom)
    if (!fn) continue
    // Le nom du réseau apparaît dans celui de l'établissement, à l'orthographe
    // près : l'outil terrain est saisi au clavier sur le terrain
    // (« Chiken street », « Crous't wok »).
    const nbMotsFr = fn.split(' ').length
    // Comparaison sans espaces : « Crous't wok » saisi en trois morceaux doit
    // rejoindre « Croust Wok ».
    const colle = (x: string) => x.replace(/ /g, '')
    let trouve = nom.includes(fn) || colle(nom).includes(colle(fn)) || proche(colle(nom), colle(fn))
    for (let i = 0; !trouve && i + nbMotsFr <= mots.length; i++) {
      trouve = proche(mots.slice(i, i + nbMotsFr).join(' '), fn)
    }
    if (trouve && (!meilleur || fn.length > meilleur.longueur)) meilleur = { id: f.id, longueur: fn.length }
  }
  return meilleur?.id || null
}

/** Deux libellés à deux fautes de frappe près (et d'au moins 5 caractères). */
function proche(a: string, b: string) {
  if (a === b) return true
  if (Math.min(a.length, b.length) < 5) return false
  if (Math.abs(a.length - b.length) > 2) return false
  return distance(a, b) <= 2
}

function distance(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[b.length]
}

/**
 * Clients les plus proches d'un établissement orphelin.
 *
 * Un simple recouvrement de mots donne des suggestions fausses : dans un
 * portefeuille de restauration rapide, « tacos », « chicken », « street » ou
 * « food » ne distinguent rien. Chaque mot est donc pondéré par sa rareté dans
 * le portefeuille (IDF) : ce sont les mots rares qui identifient réellement un
 * établissement. Les mots qui ne sont que le nom de la ville sont ignorés.
 */
const MOTS_VIDES = new Set(['sas', 'sarl', 'sasu', 'eurl', 'snc', 'sa', 'ste', 'societe', 'restaurant', 'le', 'la', 'les', 'du', 'de', 'des'])

const motsDe = (s: unknown) =>
  normaliser(s).split(' ').filter((m) => m.length > 2 && !MOTS_VIDES.has(m))

let cacheIdf: { clients: any[]; idf: Map<string, number> } | null = null

function idfPortefeuille(clients: any[]) {
  if (cacheIdf && cacheIdf.clients === clients) return cacheIdf.idf
  const freq = new Map<string, number>()
  for (const c of clients) {
    for (const m of new Set([...motsDe(c.raison_sociale), ...motsDe(c.nom_commercial)])) {
      freq.set(m, (freq.get(m) || 0) + 1)
    }
  }
  const n = Math.max(1, clients.length)
  const idf = new Map<string, number>()
  for (const [m, f] of freq) idf.set(m, Math.log(n / f))
  cacheIdf = { clients, idf }
  return idf
}

export function suggestions(
  etab: { nom?: string | null; ville?: string | null },
  clients: any[],
  max = 5,
  seuil = 0.55,
) {
  const idf = idfPortefeuille(clients)
  const ville = villeSeule(etab.ville)
  const motsVille = new Set(ville.split(' '))
  // Un mot inconnu du portefeuille est très discriminant s'il correspond.
  const poids = (m: string) => idf.get(m) ?? Math.log(Math.max(1, clients.length))

  const mots = motsDe(etab.nom).filter((m) => !motsVille.has(m))
  if (mots.length === 0) return []
  const total = mots.reduce((s, m) => s + poids(m), 0)
  if (total === 0) return []

  // Un mot ne vaut d'être proposé que s'il est rare : présent chez 3 clients au
  // plus. « food », « tacos » ou « street » ne désignent personne.
  const seuilRare = Math.log(Math.max(2, clients.length) / 3)

  const notes = clients.map((c) => {
    const cmots = new Set([...motsDe(c.raison_sociale), ...motsDe(c.nom_commercial)])
    const communs = mots.filter((m) => cmots.has(m))
    const distinctif = communs.length >= 2 || communs.some((m) => poids(m) >= seuilRare)
    if (!distinctif) return { client: c, note: 0, base: 0, memeVille: false }

    const base = communs.reduce((s, m) => s + poids(m), 0) / total
    const memeVille = !!ville && villeSeule(c.ville) === ville
    // Ville différente et connue des deux côtés : indice contraire, pas neutre.
    const villeContraire = !!ville && !!villeSeule(c.ville) && !memeVille
    let note = memeVille ? base + 0.15 : villeContraire ? base * 0.6 : base
    return { client: c, note: Math.min(1, note), base, memeVille }
  })

  // Réseaux de franchise : « Chicken Street » ou « Chamas Tacos » désignent des
  // dizaines d'établissements. Quand plusieurs clients atteignent le meilleur
  // score sur le seul nom d'enseigne et qu'aucun n'est dans la bonne ville, ce
  // sont des pistes, pas des réponses — la note est abaissée pour le dire.
  const meilleure = Math.max(...notes.map((n) => n.base))
  const exAequo = notes.filter((n) => n.base >= meilleure - 0.001 && n.base > 0)
  const ambigu = exAequo.length > 1 && !exAequo.some((n) => n.memeVille)

  return notes
    .map((n) => (ambigu && n.base >= meilleure - 0.001 ? { ...n, note: n.note * 0.6 } : n))
    .filter((n) => n.note >= seuil)
    .sort((a, b) => b.note - a.note)
    .slice(0, max)
    .map(({ client, note }) => ({ client, note }))
}

// ── Synchronisation ─────────────────────────────────────────────────────────

export async function synchroniserAuditHygiene(
  crm: any,
  organizationId: string,
  userId?: string | null,
): Promise<{ success: boolean; error?: string; resume?: ResumeSync }> {
  const source = auditHygieneClient()
  if (!source) {
    return { success: false, error: "Accès AuditHygiène non configuré (AUDITHYGIENE_SUPABASE_URL / AUDITHYGIENE_SERVICE_KEY)" }
  }

  const { data: journal } = await crm
    .from('ah_syncs')
    .insert({ organization_id: organizationId, lance_par: userId || null })
    .select('id')
    .single()

  const finir = async (succes: boolean, resume: Partial<ResumeSync>, erreur?: string) => {
    if (journal?.id) {
      await crm.from('ah_syncs')
        .update({ termine_at: new Date().toISOString(), succes, erreur: erreur || null, resume })
        .eq('id', journal.id)
    }
  }

  try {
    const [etabs, audits, duerps, unites, risques, actions] = await Promise.all([
      sourceAll(source, 'etablissements'),
      sourceAll(source, 'audits', 'id, etablissement_id, formateur_nom, date_audit, heure_debut, heure_fin, type_audit, num_rapport, personnes_presentes, score_global, nb_conformes, nb_partiels, nb_non_conformes, mention, obs_bilan, obs_actions, obs_reco, obs_next, obs_delai, statut, email_envoye_at, created_at, updated_at, answers, checklist'),
      sourceAll(source, 'duerps', 'id, etablissement_id, formateur_nom, date_evaluation, effectif, num_document, statut, raison_sociale, enseigne, activite, dirigeant_signataire, preventeur, perimetre, version_int, email_envoye_at, created_at, updated_at'),
      sourceAll(source, 'duerp_unites_travail', 'id, duerp_id'),
      sourceAll(source, 'duerp_risques', 'id, unite_id, gravite, probabilite'),
      sourceAll(source, 'duerp_actions', 'id, duerp_id, description, responsable, echeance, statut, cout_estime, created_at'),
    ])

    // Clients du CRM pour le rapprochement
    const clients = await fetchAllPaged((from, to) =>
      crm.from('clients')
        .select('id, raison_sociale, nom_commercial, siret, ville')
        .eq('organization_id', organizationId)
        .range(from, to),
    )
    const idx = indexerClients(clients as any[])

    const { data: franchises } = await crm
      .from('franchises').select('id, nom').eq('organization_id', organizationId).eq('is_active', true)

    // La franchise du client rapproché fait foi : « Chamas Beziers »,
    // « Michel Tacos » ou « HA Tacos » ne portent pas le nom du réseau, mais
    // leur client CRM, lui, y est rattaché.
    const { data: clientsFranchise } = await crm
      .from('clients').select('id, franchise_id')
      .eq('organization_id', organizationId).not('franchise_id', 'is', null)
    const franchiseDuClient = new Map(
      ((clientsFranchise || []) as any[]).map((c) => [c.id, c.franchise_id as string]),
    )

    // Rapprochements déjà validés à la main : on ne les écrase jamais
    const { data: existants } = await crm
      .from('ah_etablissements')
      .select('source_id, client_id, match_methode, match_valide_at, ignore_rapprochement')
      .eq('organization_id', organizationId)
    const dejaLa = new Map((existants || []).map((e: any) => [e.source_id, e]))

    let rapprochesAuto = 0
    let franchisesReconnues = 0
    const lignesEtab = etabs.map((e) => {
      const anterieur: any = dejaLa.get(e.id)
      const manuel = anterieur?.match_valide_at || anterieur?.ignore_rapprochement
      const auto = manuel ? null : rapprocher(e, idx)
      if (auto?.client_id) rapprochesAuto++
      const clientId = manuel ? anterieur.client_id : auto!.client_id
      const franchiseId = (clientId ? franchiseDuClient.get(clientId) : null)
        || rapprocherFranchise(e, (franchises || []) as any[])
      if (franchiseId) franchisesReconnues++
      return {
        organization_id: organizationId,
        source_id: e.id,
        nom: e.nom || 'Sans nom',
        type_etab: e.type_etab || null,
        adresse: e.adresse || null,
        code_postal: e.code_postal || null,
        ville: e.ville || null,
        contact: e.contact || null,
        tel: e.tel || null,
        email: e.email || null,
        siret: e.siret || null,
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
        client_id: clientId,
        match_methode: manuel ? anterieur.match_methode : auto!.methode,
        franchise_id: franchiseId,
        source_created_at: e.created_at || null,
        synced_at: new Date().toISOString(),
      }
    })

    await upsertParLots(crm, 'ah_etablissements', lignesEtab)

    // source_id → id local
    const { data: locaux } = await crm
      .from('ah_etablissements').select('id, source_id, client_id').eq('organization_id', organizationId)
    const idLocal = new Map((locaux || []).map((r: any) => [r.source_id, r.id]))

    await upsertParLots(crm, 'ah_audits', audits.map((a) => ({
      organization_id: organizationId,
      source_id: a.id,
      etablissement_id: idLocal.get(a.etablissement_id) || null,
      num_rapport: a.num_rapport || null,
      date_audit: a.date_audit || null,
      heure_debut: a.heure_debut || null,
      heure_fin: a.heure_fin || null,
      type_audit: a.type_audit || null,
      formateur_nom: a.formateur_nom || null,
      score_global: a.score_global ?? null,
      mention: a.mention || null,
      nb_conformes: a.nb_conformes ?? null,
      nb_partiels: a.nb_partiels ?? null,
      nb_non_conformes: a.nb_non_conformes ?? null,
      personnes_presentes: typeof a.personnes_presentes === 'string' ? a.personnes_presentes : JSON.stringify(a.personnes_presentes ?? null),
      obs_bilan: a.obs_bilan || null,
      obs_actions: a.obs_actions || null,
      obs_reco: a.obs_reco || null,
      obs_next: a.obs_next || null,
      obs_delai: a.obs_delai || null,
      statut: a.statut || null,
      email_envoye_at: a.email_envoye_at || null,
      answers: a.answers ?? null,
      checklist: a.checklist ?? null,
      source_created_at: a.created_at || null,
      source_updated_at: a.updated_at || null,
      synced_at: new Date().toISOString(),
    })))

    // Compteurs DUERP
    const uniteDuerp = new Map(unites.map((u) => [u.id, u.duerp_id]))
    const nbUnites: Record<string, number> = {}
    for (const u of unites) nbUnites[u.duerp_id] = (nbUnites[u.duerp_id] || 0) + 1
    const nbRisques: Record<string, number> = {}
    const nbCritiques: Record<string, number> = {}
    for (const r of risques) {
      const d = uniteDuerp.get(r.unite_id)
      if (!d) continue
      nbRisques[d] = (nbRisques[d] || 0) + 1
      if ((Number(r.gravite) || 0) * (Number(r.probabilite) || 0) >= 9) nbCritiques[d] = (nbCritiques[d] || 0) + 1
    }
    const nbActions: Record<string, number> = {}
    for (const a of actions) nbActions[a.duerp_id] = (nbActions[a.duerp_id] || 0) + 1

    await upsertParLots(crm, 'ah_duerps', duerps.map((d) => ({
      organization_id: organizationId,
      source_id: d.id,
      etablissement_id: idLocal.get(d.etablissement_id) || null,
      num_document: d.num_document || null,
      date_evaluation: d.date_evaluation || null,
      formateur_nom: d.formateur_nom || null,
      effectif: d.effectif ?? null,
      statut: d.statut || null,
      raison_sociale: d.raison_sociale || null,
      enseigne: d.enseigne || null,
      activite: d.activite || null,
      dirigeant_signataire: d.dirigeant_signataire || null,
      preventeur: d.preventeur || null,
      perimetre: d.perimetre || null,
      version_int: d.version_int ?? null,
      nb_unites: nbUnites[d.id] || 0,
      nb_risques: nbRisques[d.id] || 0,
      nb_actions: nbActions[d.id] || 0,
      risques_critiques: nbCritiques[d.id] || 0,
      email_envoye_at: d.email_envoye_at || null,
      source_created_at: d.created_at || null,
      source_updated_at: d.updated_at || null,
      synced_at: new Date().toISOString(),
    })))

    const { data: duerpsLocaux } = await crm
      .from('ah_duerps').select('id, source_id').eq('organization_id', organizationId)
    const idDuerp = new Map((duerpsLocaux || []).map((r: any) => [r.source_id, r.id]))

    await upsertParLots(crm, 'ah_duerp_actions', actions.map((a) => ({
      organization_id: organizationId,
      source_id: a.id,
      duerp_id: idDuerp.get(a.duerp_id) || null,
      description: a.description || null,
      responsable: a.responsable || null,
      echeance: a.echeance || null,
      statut: a.statut || null,
      cout_estime: a.cout_estime ?? null,
      source_created_at: a.created_at || null,
      synced_at: new Date().toISOString(),
    })))

    // Ce qui a été supprimé côté outil terrain disparaît aussi du miroir
    // (l'outil est nettoyé régulièrement : doublons d'établissements, brouillons).
    await purger(crm, 'ah_audits', organizationId, audits.map((a) => a.id))
    await purger(crm, 'ah_duerp_actions', organizationId, actions.map((a) => a.id))
    await purger(crm, 'ah_duerps', organizationId, duerps.map((d) => d.id))
    await purger(crm, 'ah_etablissements', organizationId, etabs.map((e) => e.id))

    const orphelins = lignesEtab.filter((l) => !l.client_id).length
    const resume: ResumeSync = {
      etablissements: lignesEtab.length,
      audits: audits.length,
      duerps: duerps.length,
      actions: actions.length,
      rapproches_auto: rapprochesAuto,
      orphelins,
      franchises_reconnues: franchisesReconnues,
    }
    await finir(true, resume)
    return { success: true, resume }
  } catch (e: any) {
    const message = e?.message || 'Erreur inconnue'
    console.error('[sync audithygiene]', message)
    await finir(false, {}, message)
    return { success: false, error: message }
  }
}

/** Supprime du miroir les lignes dont la source n'existe plus. */
async function purger(crm: any, table: string, organizationId: string, sourceIds: string[]) {
  const { data: locales } = await crm.from(table).select('id, source_id').eq('organization_id', organizationId)
  const vivants = new Set(sourceIds)
  const aSupprimer = (locales || []).filter((r: any) => !vivants.has(r.source_id)).map((r: any) => r.id)
  for (let i = 0; i < aSupprimer.length; i += 500) {
    const { error } = await crm.from(table).delete().in('id', aSupprimer.slice(i, i + 500))
    if (error) throw new Error(`${table} (purge) : ${error.message}`)
  }
  return aSupprimer.length
}

async function upsertParLots(crm: any, table: string, lignes: any[], taille = 500) {
  for (let i = 0; i < lignes.length; i += taille) {
    const { error } = await crm.from(table)
      .upsert(lignes.slice(i, i + taille), { onConflict: 'organization_id,source_id' })
    if (error) throw new Error(`${table} : ${error.message}`)
  }
}
