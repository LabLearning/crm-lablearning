import { createServiceRoleClient } from '@/lib/supabase/server'
import { schemaCrm, type TableCrm } from './schema'
import { estMasquee, nettoyer, nettoyerValeur } from './securite'

/**
 * Lecture générique du CRM pour le connecteur Claude : toute table accessible,
 * toujours bornée à l'organisation de la clé (table lue ET fiches liées),
 * colonnes secrètes jamais lues. Lecture seule : rien ici n'écrit en base.
 */

export class ErreurLecture extends Error {}

const IDENT = /^[a-z_][a-z0-9_]*$/
const OPERATEURS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'est_vide', 'non_vide'] as const
const TYPES_NUMERIQUES = new Set(['integer', 'bigint', 'smallint', 'numeric', 'number', 'real', 'double precision'])
const TYPES_ORDONNES = new Set([...Array.from(TYPES_NUMERIQUES), 'date', 'timestamp with time zone', 'timestamp without time zone', 'time without time zone'])
const LIMITE_MAX = 200
/** Lecture d'une colonne jsonb (photos, réponses complètes) : quelques lignes à la fois */
const LIMITE_LOURDE = 10
const DECALAGE_MAX = 10_000
const LIGNES_MAX_AGREGAT = 20_000
const TYPES_LOURDS = new Set(['jsonb', 'json'])

/** Message d'erreur sans rien recopier de la saisie (nom borné, caractères de contrôle retirés) */
const court = (v: unknown) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 64)

export async function tablePour(nom: unknown): Promise<TableCrm> {
  const t = (await schemaCrm()).get(String(nom || ''))
  if (!t) throw new ErreurLecture(`Table inconnue ou non accessible : ${court(nom) || '(vide)'}. L'outil « tables » donne la liste.`)
  return t
}

const lisibles = (t: TableCrm) => new Set(t.colonnes.map((c) => c.nom))
/** Colonnes sur lesquelles on peut filtrer par valeur, trier et calculer : jamais une colonne masquée */
const filtrables = (t: TableCrm) => new Set(t.colonnes.map((c) => c.nom).filter((c) => !estMasquee(c)))
const typeDe = (t: TableCrm, col: string) => t.colonnes.find((c) => c.nom === col)?.type || ''

/** Échec PostgREST : le détail reste dans les journaux du serveur, Claude reçoit un message neutre */
function echec(quoi: string, error: any): never {
  console.error('[connecteur claude]', quoi, error?.code, error?.message)
  throw new ErreurLecture(`${quoi} impossible${error?.code ? ` (code ${court(error.code)})` : ''}. Vérifie les noms de colonnes avec l'outil « tables ».`)
}

/** Découpe une liste de colonnes au premier niveau (virgules hors parenthèses) */
function decouper(liste: string): string[] {
  const parties: string[] = []
  let niveau = 0
  let courant = ''
  for (const ch of liste) {
    if (ch === '(') niveau++
    if (ch === ')') niveau--
    if (niveau < 0) throw new ErreurLecture('Parenthèses mal fermées dans « colonnes »')
    if (ch === ',' && niveau === 0) { parties.push(courant.trim()); courant = '' } else courant += ch
  }
  if (niveau !== 0) throw new ErreurLecture('Parenthèses mal fermées dans « colonnes »')
  if (courant.trim()) parties.push(courant.trim())
  return parties.filter(Boolean)
}

type Liee = { alias: string; cible: TableCrm }

/** Colonnes lues par défaut : toutes les lisibles sauf les jsonb, qui peuvent peser des mégaoctets */
const parDefaut = (t: TableCrm) => t.colonnes.filter((c) => !TYPES_LOURDS.has(c.type)).map((c) => c.nom)
const lourdes = (t: TableCrm) => t.colonnes.filter((c) => TYPES_LOURDS.has(c.type)).map((c) => c.nom)

/**
 * Colonnes demandées : des colonnes simples, ou une fiche liée par l'une des
 * clés étrangères de la table, « alias:colonne_id(col1, col2) » (un seul
 * niveau, de la ligne vers sa fiche). Vide ou « * » : toutes les colonnes
 * lisibles sauf les jsonb (listées dans « omises », à demander par leur nom),
 * jamais les secrètes. La fiche liée est bornée elle aussi à l'organisation
 * (filtre posé par bornerLiees).
 */
export async function construireSelect(t: TableCrm, demande?: unknown): Promise<{ select: string; liees: Liee[]; omises: string[]; lourd: boolean }> {
  const schema = await schemaCrm()
  const ok = lisibles(t)
  const brut = String(demande ?? '').trim()
  if (!brut || brut === '*') return { select: parDefaut(t).join(','), liees: [], omises: lourdes(t), lourd: false }
  if (brut.length > 2000) throw new ErreurLecture('Liste de colonnes trop longue')

  const out: string[] = []
  const liees: Liee[] = []
  let lourd = false
  for (const partie of decouper(brut)) {
    const lien = /^(?:([a-z_][a-z0-9_]*)\s*:\s*)?([a-z_][a-z0-9_]*)\s*\(([^()]*)\)$/.exec(partie)
    if (lien) {
      const [, nomAlias, fk, interieur] = lien
      const col = t.colonnes.find((c) => c.nom === fk)
      if (!col?.cible) throw new ErreurLecture(`« ${court(fk)} » n'est pas une clé étrangère de ${t.nom}`)
      const cible = schema.get(col.cible)
      if (!cible) throw new ErreurLecture(`La table liée ${col.cible} n'est pas accessible`)
      // Une table rattachée par son parent ne se lit qu'en table principale (sa portée y est appliquée)
      if (cible.portee.type === 'enfant') throw new ErreurLecture(`${col.cible} se lit directement avec « lire », pas en fiche liée`)
      const okCible = lisibles(cible)
      const demandees = interieur.trim() === '' || interieur.trim() === '*'
        ? parDefaut(cible)
        : interieur.split(',').map((s) => s.trim()).filter(Boolean)
      for (const c of demandees) {
        if (!IDENT.test(c) || !okCible.has(c)) throw new ErreurLecture(`Colonne inconnue ou non accessible : ${col.cible}.${court(c)}`)
        if (TYPES_LOURDS.has(typeDe(cible, c))) lourd = true
      }
      // La colonne qui sert à borner la fiche liée doit être lue
      const borne = cible.portee.type === 'organisation' ? 'organization_id' : cible.portee.type === 'organisme' ? 'id' : null
      if (borne && !demandees.includes(borne)) demandees.push(borne)
      const alias = nomAlias || fk.replace(/_id$/, '')
      if (alias === 'portee_org' || liees.some((l) => l.alias === alias) || ok.has(alias)) throw new ErreurLecture(`Alias déjà utilisé : ${alias}`)
      liees.push({ alias, cible })
      out.push(`${alias}:${col.cible}!${fk}(${demandees.join(',')})`)
      continue
    }
    if (!IDENT.test(partie) || !ok.has(partie)) throw new ErreurLecture(`Colonne inconnue ou non accessible : ${t.nom}.${court(partie)}`)
    if (TYPES_LOURDS.has(typeDe(t, partie))) lourd = true
    out.push(partie)
  }
  return { select: out.join(','), liees, omises: [], lourd }
}

/**
 * Borne chaque fiche liée à l'organisation : sans jointure interne, PostgREST
 * rend la fiche à null quand elle appartient à un autre organisme, et garde
 * la ligne principale.
 */
function bornerLiees(q: any, liees: Liee[], orgId: string): any {
  for (const l of liees) {
    if (l.cible.portee.type === 'organisation') q = q.eq(`${l.alias}.organization_id`, orgId)
    else if (l.cible.portee.type === 'organisme') q = q.eq(`${l.alias}.id`, orgId)
  }
  return q
}

/** Ajoute la jointure qui rattache une table enfant à son organisation */
function avecPortee(t: TableCrm, select: string): string {
  if (t.portee.type !== 'enfant') return select
  let interieur = 'organization_id'
  for (let i = t.portee.chemin.length - 1; i >= 0; i--) {
    const m = t.portee.chemin[i]
    interieur = `${i === 0 ? 'portee_org:' : ''}${m.table}!${m.fk}!inner(${interieur})`
  }
  return `${select},${interieur}`
}

function appliquerPortee(q: any, t: TableCrm, orgId: string): any {
  switch (t.portee.type) {
    case 'organisation': return q.eq('organization_id', orgId)
    case 'organisme': return q.eq('id', orgId)
    case 'enfant': return q.eq(['portee_org', ...t.portee.chemin.slice(1).map((m) => m.table), 'organization_id'].join('.'), orgId)
    default: return q
  }
}

const sansPortee = (lignes: any[]) => lignes.map(({ portee_org: _p, ...l }) => l)

function appliquerFiltres(q: any, t: TableCrm, filtres: unknown): any {
  if (filtres == null) return q
  if (!Array.isArray(filtres)) throw new ErreurLecture('« filtres » doit être une liste')
  if (filtres.length > 20) throw new ErreurLecture('20 filtres au plus')
  const ok = lisibles(t)
  const parValeur = filtrables(t)
  for (const f of filtres as any[]) {
    const col = String(f?.colonne || '')
    const op = String(f?.op || 'eq')
    // Pas de filtre sur une colonne secrète : il servirait à deviner sa valeur
    if (!ok.has(col)) throw new ErreurLecture(`Filtre sur une colonne inconnue ou non accessible : ${t.nom}.${court(col)}`)
    if (!(OPERATEURS as readonly string[]).includes(op)) throw new ErreurLecture(`Opérateur inconnu : ${court(op)} (permis : ${OPERATEURS.join(', ')})`)
    if (op === 'est_vide') { q = q.is(col, null); continue }
    if (op === 'non_vide') { q = q.not(col, 'is', null); continue }
    // Colonne masquée : seulement vide ou renseignée, sinon on reconstituerait sa valeur en comptant
    if (!parValeur.has(col)) throw new ErreurLecture(`${col} est masquée : seuls les filtres est_vide et non_vide sont permis`)
    const v = f?.valeur
    if (op === 'in') {
      if (!Array.isArray(v) || !v.length || v.length > 500 || v.some((x) => x !== null && typeof x === 'object')) throw new ErreurLecture('« in » attend une liste de 1 à 500 valeurs simples')
      q = q.in(col, v)
      continue
    }
    if (v === undefined || (v !== null && typeof v === 'object')) throw new ErreurLecture(`Valeur simple attendue pour ${col}`)
    if (v === null) { q = op === 'neq' ? q.not(col, 'is', null) : q.is(col, null); continue }
    // Référentiel volumineux : un début de SIRET devient une plage sur la clé primaire (l'index sert, like non)
    if ((op === 'like' || op === 'ilike') && t.portee.type === 'referentiel' && t.portee.filtreObligatoire && col === 'siret') {
      const debut = /^(\d{9,14})%?$/.exec(String(v))
      if (!debut) throw new ErreurLecture('Sur siret_opco, « like » n’accepte qu’un début de SIRET d’au moins 9 chiffres, par exemple "123456789%"')
      q = q.gte('siret', debut[1].padEnd(14, '0')).lte('siret', debut[1].padEnd(14, '9'))
      continue
    }
    q = q[op](col, op === 'like' || op === 'ilike' ? String(v) : v)
  }
  return q
}

function appliquerOrdre(q: any, t: TableCrm, ordre: unknown): any {
  const ok = filtrables(t)
  const liste = ordre == null ? [] : Array.isArray(ordre) ? ordre : [ordre]
  if (liste.length > 5) throw new ErreurLecture('5 critères de tri au plus')
  for (const o of liste as any[]) {
    const col = String(o?.colonne || '')
    if (!ok.has(col)) throw new ErreurLecture(`Tri impossible sur ${t.nom}.${court(col)} (colonne inconnue, secrète ou masquée)`)
    q = q.order(col, { ascending: o?.croissant !== false, nullsFirst: false })
  }
  // Ordre total : une pagination ne saute ni ne répète aucune ligne
  if (lisibles(t).has('id')) q = q.order('id')
  return q
}

/**
 * Référentiel volumineux (siret_opco, 3,4 millions de lignes) : un filtre
 * qui cible vraiment, égalité ou liste sur siret, ou début de SIRET d'au
 * moins 9 chiffres (le SIREN).
 */
function verifierFiltreObligatoire(t: TableCrm, filtres: unknown) {
  if (t.portee.type !== 'referentiel' || !t.portee.filtreObligatoire) return
  const cible = Array.isArray(filtres) && (filtres as any[]).some((f) => {
    if (f?.colonne !== 'siret') return false
    if (f.op === 'eq' && f.valeur != null && String(f.valeur).trim()) return true
    if (f.op === 'in' && Array.isArray(f.valeur) && f.valeur.length) return true
    return (f.op === 'like' || f.op === 'ilike') && /^\d{9,}/.test(String(f.valeur ?? ''))
  })
  if (!cible) throw new ErreurLecture(`La table ${t.nom} est très volumineuse : filtre sur siret (égalité, liste, ou début d'au moins 9 chiffres comme "123456789%").`)
}

/** Liste des tables, ou le détail des colonnes d'une table */
export async function decrireTables(args: any) {
  const schema = await schemaCrm()
  if (args?.table) {
    const t = await tablePour(args.table)
    return {
      table: t.nom,
      portee: t.portee.type,
      colonnes: t.colonnes.map((c) => ({
        colonne: c.nom,
        type: c.type,
        ...(c.cible ? { lien_vers: c.cible } : {}),
        ...(estMasquee(c.nom) ? { masquee: true } : {}),
      })),
    }
  }
  const tables = Array.from(schema.values()).sort((a, b) => a.nom.localeCompare(b.nom))
  return {
    nombre: tables.length,
    tables: tables.map((t) => ({ table: t.nom, portee: t.portee.type, colonnes: t.colonnes.length })),
    a_savoir: 'Toutes les lectures sont bornées à ton organisme. Les jetons d’accès, clés, mots de passe, images de signature et adresses IP ne sont jamais transmis ; le numéro de sécurité sociale et les IBAN sont masqués (ni filtre de valeur, ni tri, ni calcul dessus).',
  }
}

export async function lire(args: any, orgId: string, base: string) {
  const t = await tablePour(args?.table)
  verifierFiltreObligatoire(t, args?.filtres)
  const { select, liees, omises, lourd } = await construireSelect(t, args?.colonnes)
  const limite = Math.min(Math.max(Math.trunc(Number(args?.limite)) || 50, 1), lourd ? LIMITE_LOURDE : LIMITE_MAX)
  const decalage = Math.max(Math.trunc(Number(args?.decalage)) || 0, 0)
  if (decalage > DECALAGE_MAX) throw new ErreurLecture(`Décalage limité à ${DECALAGE_MAX} : affine plutôt les filtres (par date, par statut…)`)
  const supabase = await createServiceRoleClient()
  let q = supabase.from(t.nom).select(avecPortee(t, select), { count: 'exact' })
  q = appliquerPortee(q, t, orgId)
  q = bornerLiees(q, liees, orgId)
  q = appliquerFiltres(q, t, args?.filtres)
  q = appliquerOrdre(q, t, args?.ordre)
  const { data, error, count } = await q.range(decalage, decalage + limite - 1)
  if (error) echec('Lecture', error)
  const lignes = nettoyer(sansPortee((data || []) as any[]), base)
  return {
    table: t.nom,
    total: count ?? null,
    decalage,
    nombre: lignes.length,
    suite: count != null ? decalage + lignes.length < count : null,
    ...(omises.length ? {
      colonnes_omises: omises,
      a_savoir: `Colonnes jsonb non lues par défaut (souvent volumineuses) : demande-les par leur nom dans « colonnes », ${LIMITE_LOURDE} lignes au plus par appel.`,
    } : {}),
    lignes,
  }
}

export async function compter(args: any, orgId: string) {
  const t = await tablePour(args?.table)
  verifierFiltreObligatoire(t, args?.filtres)
  const premiere = lisibles(t).has('id') ? 'id' : t.colonnes[0]?.nom
  if (!premiere) throw new ErreurLecture(`Aucune colonne lisible dans ${t.nom}`)
  const supabase = await createServiceRoleClient()
  let q = supabase.from(t.nom).select(avecPortee(t, premiere), { count: 'exact', head: true })
  q = appliquerPortee(q, t, orgId)
  q = appliquerFiltres(q, t, args?.filtres)
  const { count, error } = await q
  if (error) echec('Comptage', error)
  return { table: t.nom, total: count ?? 0 }
}

/**
 * Somme, moyenne, minimum, maximum ou nombre de lignes, éventuellement par
 * groupe (une colonne, ou une date ramenée au jour, au mois ou à l'année).
 * Calculé sur 50 000 lignes au plus, en le disant quand la limite est atteinte.
 */
export async function agreger(args: any, orgId: string, base?: string) {
  const t = await tablePour(args?.table)
  verifierFiltreObligatoire(t, args?.filtres)
  const ok = filtrables(t)
  const operation = String(args?.operation || 'compte')
  if (!['compte', 'somme', 'moyenne', 'min', 'max'].includes(operation)) throw new ErreurLecture('Opération : compte, somme, moyenne, min ou max')
  // La colonne n'est lue que pour un calcul ; elle est toujours vérifiée
  const colonne = operation === 'compte' ? null : String(args?.colonne || '')
  if (colonne !== null) {
    if (!IDENT.test(colonne) || !ok.has(colonne)) throw new ErreurLecture(`Colonne à calculer inconnue, secrète ou masquée : ${court(colonne) || '(vide)'}`)
    const type = typeDe(t, colonne)
    if ((operation === 'somme' || operation === 'moyenne') && !TYPES_NUMERIQUES.has(type)) throw new ErreurLecture(`${colonne} n'est pas numérique (${type})`)
    if ((operation === 'min' || operation === 'max') && !TYPES_ORDONNES.has(type)) throw new ErreurLecture(`min et max portent sur un nombre ou une date (${colonne} : ${type})`)
  }
  const groupe = args?.grouper_par ? String(args.grouper_par) : null
  if (groupe !== null && (!IDENT.test(groupe) || !ok.has(groupe) || TYPES_LOURDS.has(typeDe(t, groupe)))) {
    throw new ErreurLecture(`Regroupement impossible sur ${court(groupe)} (colonne inconnue, secrète, masquée ou jsonb)`)
  }
  const pas = args?.regrouper_date ? String(args.regrouper_date) : null
  const coupe = pas === 'jour' ? 10 : pas === 'mois' ? 7 : pas === 'annee' ? 4 : null
  if (pas && !coupe) throw new ErreurLecture('regrouper_date : jour, mois ou annee')

  const colonnesLues = Array.from(new Set([colonne, groupe, lisibles(t).has('id') ? 'id' : null].filter(Boolean))) as string[]
  if (!colonnesLues.length) colonnesLues.push(t.colonnes[0].nom)
  const supabase = await createServiceRoleClient()
  const lignes: any[] = []
  let tronque = false
  // Pagination par clé (id croissant) : chaque page coûte autant que la première, au lieu d'un décalage qui s'allonge
  const parCle = lisibles(t).has('id')
  let dernier: string | null = null
  for (let page = 0; ; page++) {
    let q = supabase.from(t.nom).select(avecPortee(t, colonnesLues.join(',')))
    q = appliquerPortee(q, t, orgId)
    q = appliquerFiltres(q, t, args?.filtres)
    if (parCle) {
      q = q.order('id')
      if (dernier) q = q.gt('id', dernier)
      q = q.limit(1000)
    } else q = q.range(page * 1000, page * 1000 + 999)
    const { data, error } = await q
    if (error) echec('Calcul', error)
    const lot = (data || []) as any[]
    lignes.push(...lot)
    if (lot.length < 1000) break
    if (parCle) dernier = lot[lot.length - 1].id
    if (lignes.length >= LIGNES_MAX_AGREGAT) { tronque = true; break }
  }

  type Acc = { nombre: number; somme: number; min: number | string | null; max: number | string | null; valeurs: number }
  const numerique = !!colonne && TYPES_NUMERIQUES.has(typeDe(t, colonne))
  const groupes = new Map<string, Acc>()
  for (const l of lignes) {
    let cle = groupe ? (l[groupe] == null ? '(vide)' : String(l[groupe])) : 'total'
    if (groupe && coupe && cle !== '(vide)') cle = cle.slice(0, coupe)
    const acc = groupes.get(cle) || { nombre: 0, somme: 0, min: null, max: null, valeurs: 0 }
    acc.nombre++
    const brut = colonne ? l[colonne] : null
    if (brut != null && numerique) {
      const n = Number(brut)
      if (Number.isFinite(n)) {
        acc.somme += n
        acc.valeurs++
        acc.min = acc.min == null || n < (acc.min as number) ? n : acc.min
        acc.max = acc.max == null || n > (acc.max as number) ? n : acc.max
      }
    } else if (brut != null) {
      // Dates : minimum et maximum dans l'ordre ISO
      const s = String(brut)
      acc.min = acc.min == null || s < String(acc.min) ? s : acc.min
      acc.max = acc.max == null || s > String(acc.max) ? s : acc.max
    }
    groupes.set(cle, acc)
  }
  const arrondi = (n: number) => Math.round(n * 100) / 100
  const valeur = (a: Acc) => operation === 'compte' ? a.nombre
    : operation === 'somme' ? arrondi(a.somme)
      : operation === 'moyenne' ? (a.valeurs ? arrondi(a.somme / a.valeurs) : null)
        : operation === 'min' ? a.min : a.max
  // Valeurs de groupe et extrêmes passent par le même nettoyage que les lignes
  const propre = (col: string | null, v: any) => (col && typeof v === 'string' ? nettoyerValeur(col, v, base) : v)

  const entete = { table: t.nom, operation, colonne, lignes_lues: lignes.length, tronque }
  if (!groupe) return { ...entete, resultat: lignes.length ? propre(colonne, valeur(groupes.get('total')!)) : (operation === 'compte' ? 0 : null) }
  const liste = Array.from(groupes.entries()).map(([v, a]) => ({ valeur: propre(groupe, v), resultat: propre(colonne, valeur(a)), lignes: a.nombre }))
  // Par date : dans l'ordre du calendrier ; sinon du plus grand au plus petit
  liste.sort((a, b) => coupe ? String(a.valeur).localeCompare(String(b.valeur)) : (Number(b.resultat) || 0) - (Number(a.resultat) || 0))
  return { ...entete, grouper_par: groupe, regrouper_date: pas, groupes: liste.slice(0, 300), groupes_total: liste.length }
}
