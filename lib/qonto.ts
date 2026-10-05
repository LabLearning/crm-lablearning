// Client de l'API Qonto — https://thirdparty.qonto.com/v2
// Auth : header Authorization: {identifiant}:{clé secrète} (clé API de l'organisation,
// dans Qonto : Paramètres > Intégrations et partenariats > Clé API).
// Lecture seule : ce module n'appelle que des GET (organisation, comptes, mouvements).
// L'identifiant et la clé viennent de l'environnement, jamais du code ni de la base.

import { unstable_cache } from 'next/cache'

const BASE = (process.env.QONTO_API_BASE || 'https://thirdparty.qonto.com/v2').replace(/\/$/, '')
const LOGIN = process.env.QONTO_LOGIN || ''
const SECRET = process.env.QONTO_SECRET_KEY || ''

/** Étiquette du cache : « Actualiser » la purge (revalidateTag). */
export const TAG_QONTO = 'qonto'
/** Durée de vie du relevé en cache, en secondes. */
const FRAICHEUR = 300
const PAR_PAGE = 100
/** Garde-fou : au-delà, le relevé est signalé comme incomplet. */
const PAGES_MAX = 40

export interface CompteQonto {
  id: string
  nom: string
  iban: string
  /** Solde comptable (opérations réglées). */
  solde: number
  /** Solde disponible : solde moins les paiements par carte en attente. */
  soldeAutorise: number
  principal: boolean
}

export interface MouvementQonto {
  id: string
  compteId: string
  /** Date de règlement, ISO. */
  date: string
  /** Toujours positif : le sens dit s'il entre ou sort. */
  montant: number
  sens: 'credit' | 'debit'
  libelle: string
  /** Contrepartie lisible (nom nettoyé par Qonto, à défaut le libellé). */
  tiers: string
  reference: string
  /** Catégorie de trésorerie posée dans Qonto, si elle existe. */
  categorie: string | null
  /** card, transfer, income, direct_debit, qonto_fee… */
  type: string
  /** Mouvement entre deux comptes de la société : ni une recette ni une dépense. */
  interne: boolean
}

export interface BanqueQonto {
  raisonSociale: string
  /** SIREN de la société titulaire (9 chiffres) : le relevé n'est montré qu'à l'organisme du même SIREN. */
  siren: string | null
  comptes: CompteQonto[]
  /** Mouvements réglés depuis `depuis`, du plus récent au plus ancien, tous comptes confondus. */
  mouvements: MouvementQonto[]
  /** Premier jour couvert, « AAAA-MM-JJ ». */
  depuis: string
  /** Instant de la lecture chez Qonto, ISO. */
  luLe: string
  /** Un compte a plus de mouvements que le garde-fou : les plus anciens manquent. */
  tronque: boolean
}

export class ErreurQonto extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function qontoConfigure(): boolean {
  return !!LOGIN && !!SECRET
}

/** Message affichable à partir d'une erreur de lecture. */
export function messageErreurQonto(e: unknown): string {
  if (e instanceof ErreurQonto) {
    if (e.status === 401 || e.status === 403) return 'Qonto a refusé la clé API. Vérifiez l’identifiant et la clé secrète enregistrés.'
    if (e.status === 429) return 'Qonto limite temporairement les lectures. Réessayez dans une minute.'
    return `Qonto a répondu par une erreur (${e.status}). Réessayez dans un instant.`
  }
  return 'Qonto est injoignable pour le moment. Réessayez dans un instant.'
}

async function appel<T = any>(chemin: string, params: Record<string, string | number | string[]> = {}): Promise<T> {
  const url = new URL(BASE + chemin)
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) for (const x of v) url.searchParams.append(`${k}[]`, x)
    else url.searchParams.set(k, String(v))
  }
  // Qonto limite le débit : une réponse 429 se retente après une courte pause, deux fois au plus
  for (let essai = 0; ; essai++) {
    const r = await fetch(url, {
      headers: { Authorization: `${LOGIN}:${SECRET}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (r.ok) return r.json()
    if (r.status === 429 && essai < 2) { await new Promise((ok) => setTimeout(ok, 1200 * (essai + 1))); continue }
    // Le corps d'une erreur n'est jamais remonté : il peut contenir des données bancaires
    throw new ErreurQonto(r.status, `Qonto ${chemin} → ${r.status}`)
  }
}

const nombre = (v: unknown) => Number(v) || 0
const sansEspace = (s: unknown) => String(s || '').replace(/\s/g, '').toUpperCase()

/** IBAN de la contrepartie, rangé par Qonto dans un sous-objet au nom du type d'opération (income, transfer, direct_debit…). */
function ibanContrepartie(t: any): string {
  for (const v of Object.values(t)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && (v as any).counterparty_account_number) {
      return sansEspace((v as any).counterparty_account_number)
    }
  }
  return ''
}

/** Convertit un mouvement de l'API ; exporté pour les tests. */
export function versMouvement(t: any, ibansSociete: Set<string>): MouvementQonto {
  const libelle = String(t.label || '').trim()
  return {
    id: String(t.id || t.transaction_id),
    compteId: String(t.bank_account_id || ''),
    date: String(t.settled_at || t.emitted_at || ''),
    montant: Math.abs(nombre(t.amount)),
    sens: t.side === 'credit' ? 'credit' : 'debit',
    libelle,
    tiers: String(t.clean_counterparty_name || libelle || 'Sans libellé').trim(),
    reference: String(t.reference || '').trim(),
    categorie: t.cashflow_category?.name ? String(t.cashflow_category.name) : null,
    type: String(t.operation_type || ''),
    interne: ibansSociete.has(ibanContrepartie(t)),
  }
}

async function lireComptes(organisation: any): Promise<any[]> {
  // /bank_accounts est la liste à jour ; l'organisation porte la même liste sur les anciennes versions de l'API
  try {
    const r = await appel('/bank_accounts', { per_page: 100 })
    if (Array.isArray(r?.bank_accounts) && r.bank_accounts.length) return r.bank_accounts
  } catch (e) {
    if (e instanceof ErreurQonto && (e.status === 401 || e.status === 403 || e.status === 429)) throw e
  }
  return Array.isArray(organisation?.bank_accounts) ? organisation.bank_accounts : []
}

async function lireMouvements(compte: any, depuisIso: string): Promise<{ lignes: any[]; tronque: boolean }> {
  const cible: Record<string, string> = compte.id ? { bank_account_id: String(compte.id) } : { iban: String(compte.iban) }
  const page = (n: number) => appel('/transactions', {
    ...cible, status: ['completed'], settled_at_from: depuisIso, sort_by: 'settled_at:desc', per_page: PAR_PAGE, page: n,
  })
  const premiere = await page(1)
  const lignes: any[] = [...(premiere.transactions || [])]
  const total = Math.max(1, Number(premiere.meta?.total_pages) || 1)
  const dernieres = Math.min(total, PAGES_MAX)
  // Les pages suivantes partent par paquets de 5 : assez vite, sans se faire limiter
  for (let n = 2; n <= dernieres; n += 5) {
    const lot = await Promise.all(Array.from({ length: Math.min(5, dernieres - n + 1) }, (_, i) => page(n + i)))
    for (const p of lot) lignes.push(...(p.transactions || []))
  }
  return { lignes, tronque: total > PAGES_MAX }
}

async function lire(jours: number): Promise<BanqueQonto> {
  const debut = new Date(Date.now() - jours * 86_400_000)
  const depuis = debut.toISOString().slice(0, 10)
  const organisation = (await appel('/organization')).organization || {}
  const bruts = await lireComptes(organisation)
  const actifs = bruts.filter((c) => !c.status || c.status === 'active')
  const ibansSociete = new Set(bruts.map((c) => sansEspace(c.iban)).filter(Boolean))

  const parCompte = await Promise.all(actifs.map((c) => lireMouvements(c, `${depuis}T00:00:00.000Z`)))
  const vus = new Set<string>()
  const mouvements = parCompte
    .flatMap((r, i) => r.lignes.map((t) => versMouvement({ ...t, bank_account_id: t.bank_account_id || actifs[i].id || actifs[i].iban }, ibansSociete)))
    // Une page qui se décale pendant la lecture peut rendre deux fois la même ligne
    .filter((m) => (m.date && !vus.has(m.id) ? (vus.add(m.id), true) : false))
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    raisonSociale: String(organisation.legal_name || organisation.name || ''),
    siren: /^\d{9}/.test(sansEspace(organisation.legal_number)) ? sansEspace(organisation.legal_number).slice(0, 9) : null,
    comptes: actifs
      .map((c) => ({
        id: String(c.id || c.iban),
        nom: String(c.name || 'Compte').trim(),
        iban: sansEspace(c.iban),
        solde: nombre(c.balance),
        soldeAutorise: nombre(c.authorized_balance ?? c.balance),
        principal: !!c.main,
      }))
      .sort((a, b) => Number(b.principal) - Number(a.principal) || b.solde - a.solde),
    mouvements,
    depuis,
    luLe: new Date().toISOString(),
    tronque: parCompte.some((r) => r.tronque),
  }
}

/** Lecture directe, sans cache : réservée aux scripts et aux tests. */
export const lireReleveQonto = lire

/**
 * Relevé Qonto des `jours` derniers jours : comptes, soldes et mouvements réglés.
 * Gardé cinq minutes en cache pour ne pas relire la banque à chaque affichage.
 */
export function lireBanqueQonto(jours: number): Promise<BanqueQonto> {
  if (!qontoConfigure()) throw new Error('Qonto non configuré')
  return unstable_cache(() => lire(jours), ['qonto-banque', LOGIN, String(jours)], { revalidate: FRAICHEUR, tags: [TAG_QONTO] })()
}
