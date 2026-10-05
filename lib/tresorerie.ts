/**
 * Trésorerie : ce que la banque dit (relevé Qonto) et ce que le CRM attend
 * (factures à encaisser, formateurs et commissions à payer).
 *
 * Les calculs sur le relevé sont purs : ils reçoivent le relevé et la date du
 * jour, et ne lisent ni horloge ni base. Seul `chargerEngagements` interroge
 * Supabase. Rien n'est stocké : tout est recalculé à l'affichage.
 *
 * Un virement entre deux comptes de la société n'est ni une recette ni une
 * dépense : il est écarté des entrées et des sorties, mais compte dans la
 * courbe du solde (il s'y annule de lui-même).
 */

import { fetchAllPaged } from '@/lib/supabase/fetch-all'
import type { BanqueQonto, MouvementQonto } from '@/lib/qonto'

/** Les soldes et les mouvements bancaires ne sont montrés qu'à la direction et à la comptabilité. */
export const ROLES_TRESORERIE: string[] = ['super_admin', 'comptable']

export function peutVoirTresorerie(role: string | null | undefined): boolean {
  return !!role && ROLES_TRESORERIE.includes(role)
}

/** Le relevé est toujours lu sur un peu plus de six mois (26 semaines entières) : la période choisie ne fait que le découper. */
export const JOURS_RELEVE = 190

/** `semaines` : nombre de lignes du pilotage, semaine en cours comprise. */
export const PERIODES = [
  { jours: 30, label: '30 jours', semaines: 5 },
  { jours: 90, label: '90 jours', semaines: 13 },
  { jours: 180, label: '6 mois', semaines: 26 },
] as const

const arrondi = (n: number) => Math.round(n * 100) / 100

/** 12345.6 → « 12 346 € » ; avec décimales : « 12 345,60 € ». Même rendu serveur et navigateur (pas d'Intl). */
export function montantFr(n: number, decimales = 0): string {
  const [entier, dec] = Math.abs(n).toFixed(decimales).split('.')
  return `${n < 0 ? '−' : ''}${entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')}${dec ? `,${dec}` : ''}\u00a0€`
}
const cle = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/** Date d'un instant à Paris, « AAAA-MM-JJ ». */
export function jourParis(iso: string | Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

const plusJours = (jour: string, n: number) => {
  const d = new Date(`${jour}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const lundiDe = (jour: string) => {
  const d = new Date(`${jour}T12:00:00Z`)
  return plusJours(jour, -((d.getUTCDay() + 6) % 7))
}

// ─── Relevé bancaire ────────────────────────────────────────────────────────

export interface LigneTiers { nom: string; montant: number; nb: number }
export interface PointSolde { jour: string; solde: number }

export interface SyntheseBanque {
  /** Somme des soldes de tous les comptes. */
  total: number
  /** Idem, paiements par carte en attente déduits. */
  disponible: number
  /** Entrées et sorties de la période, hors virements entre comptes de la société. */
  entrees: number
  sorties: number
  nbEntrees: number
  nbSorties: number
  /** Solde total à la clôture de chaque jour de la période, du plus ancien au plus récent. */
  courbe: PointSolde[]
  /** D'où vient l'argent, par contrepartie, du plus gros au plus petit. */
  origines: LigneTiers[]
  /** Où il part, par contrepartie. */
  destinations: LigneTiers[]
}

function parTiers(mouvements: MouvementQonto[], nomDe: (m: MouvementQonto) => string): LigneTiers[] {
  const groupes = new Map<string, LigneTiers>()
  for (const m of mouvements) {
    const nom = nomDe(m)
    const k = cle(nom)
    const g = groupes.get(k)
    if (g) { g.montant += m.montant; g.nb++ } else groupes.set(k, { nom, montant: m.montant, nb: 1 })
  }
  return [...groupes.values()].map((g) => ({ ...g, montant: arrondi(g.montant) })).sort((a, b) => b.montant - a.montant)
}

type Date_ = { m: MouvementQonto; jour: string }
const signe = (m: MouvementQonto) => (m.sens === 'credit' ? m.montant : -m.montant)

/**
 * Solde total à la clôture de chaque jour, de `premier` à `aujourdhui` : on part
 * du solde du jour et on défait les mouvements un à un en remontant le temps.
 * `dates` : tous les mouvements du relevé, du plus récent au plus ancien.
 */
function cloturesParJour(dates: Date_[], total: number, premier: string, aujourdhui: string): PointSolde[] {
  const points: PointSolde[] = []
  let solde = total
  let i = 0
  for (let jour = aujourdhui; jour >= premier; jour = plusJours(jour, -1)) {
    while (i < dates.length && dates[i].jour > jour) { solde -= signe(dates[i].m); i++ }
    points.push({ jour, solde: arrondi(solde) })
  }
  return points.reverse()
}

/** Synthèse du relevé sur les `jours` derniers jours (aujourd'hui compris). */
export function synthetiserBanque(banque: BanqueQonto, jours: number, aujourdhui: string): SyntheseBanque {
  const premier = plusJours(aujourdhui, -(jours - 1))
  const dates = banque.mouvements.map((m) => ({ m, jour: jourParis(m.date) }))
  const externes = dates.filter((x) => x.jour >= premier && x.jour <= aujourdhui && !x.m.interne).map((x) => x.m)
  const credits = externes.filter((m) => m.sens === 'credit')
  const debits = externes.filter((m) => m.sens === 'debit')
  const total = arrondi(banque.comptes.reduce((s, c) => s + c.solde, 0))

  return {
    total,
    disponible: arrondi(banque.comptes.reduce((s, c) => s + c.soldeAutorise, 0)),
    entrees: arrondi(credits.reduce((s, m) => s + m.montant, 0)),
    sorties: arrondi(debits.reduce((s, m) => s + m.montant, 0)),
    nbEntrees: credits.length,
    nbSorties: debits.length,
    courbe: cloturesParJour(dates, total, premier, aujourdhui),
    origines: parTiers(credits, (m) => m.tiers),
    destinations: parTiers(debits, (m) => m.tiers),
  }
}

// ─── Pilotage semaine par semaine ───────────────────────────────────────────

export interface SemainePilotage {
  lundi: string
  /** Dernier jour compté : le dimanche, ou aujourd'hui pour la semaine en cours. */
  fin: string
  enCours: boolean
  /** Solde total à la clôture de la veille du lundi. */
  soldeDebut: number
  entrees: number
  sorties: number
  /** Marge de trésorerie : entrées moins sorties. */
  marge: number
  /** Solde total à la clôture du dernier jour compté. */
  soldeFin: number
  nbEntrees: number
  nbSorties: number
  /** Net des virements entre comptes de la société : nul, sauf si les deux jambes d'un virement tombent sur deux semaines. */
  interne: number
  principalesEntrees: LigneTiers[]
  principalesSorties: LigneTiers[]
  /** Sorties par compte bancaire d'où elles partent. */
  sortiesParCompte: LigneTiers[]
}

export interface Pilotage {
  /** De la plus récente à la plus ancienne. */
  semaines: SemainePilotage[]
  total: { entrees: number; sorties: number; marge: number }
  /** Moyenne par semaine sur les dernières semaines entières (quatre au plus) ; absent sans semaine entière. */
  rythme: { nbSemaines: number; entrees: number; sorties: number; marge: number } | null
  /** Jours de sorties que couvre le solde du jour, au rythme ci-dessus. */
  joursCouverts: number | null
}

/**
 * Ce qui entre, ce qui sort et ce qu'il reste, semaine civile par semaine
 * civile (du lundi au dimanche, heure de Paris), semaine en cours comprise.
 * Les virements entre comptes de la société ne comptent ni en entrée ni en
 * sortie ; les soldes, eux, sont ceux de la banque, tous comptes confondus.
 */
export function piloterParSemaine(banque: BanqueQonto, nbSemaines: number, aujourdhui: string): Pilotage {
  const dates = banque.mouvements.map((m) => ({ m, jour: jourParis(m.date) }))
  const total = arrondi(banque.comptes.reduce((s, c) => s + c.solde, 0))
  const nomCompte = new Map(banque.comptes.map((c) => [c.id, c.nom]))
  const lundiCourant = lundiDe(aujourdhui)
  // Une semaine n'est gardée que si le relevé la couvre en entier
  const lundis = Array.from({ length: nbSemaines }, (_, i) => plusJours(lundiCourant, -7 * i)).filter((l) => l > banque.depuis)
  if (!lundis.length) return { semaines: [], total: { entrees: 0, sorties: 0, marge: 0 }, rythme: null, joursCouverts: null }
  const clotures = new Map(cloturesParJour(dates, total, plusJours(lundis[lundis.length - 1], -1), aujourdhui).map((p) => [p.jour, p.solde]))

  const semaines: SemainePilotage[] = lundis.map((lundi) => {
    const dimanche = plusJours(lundi, 6)
    const fin = dimanche < aujourdhui ? dimanche : aujourdhui
    const siens = dates.filter((x) => x.jour >= lundi && x.jour <= fin).map((x) => x.m)
    const credits = siens.filter((m) => !m.interne && m.sens === 'credit')
    const debits = siens.filter((m) => !m.interne && m.sens === 'debit')
    const entrees = arrondi(credits.reduce((s, m) => s + m.montant, 0))
    const sorties = arrondi(debits.reduce((s, m) => s + m.montant, 0))
    return {
      lundi,
      fin,
      enCours: lundi === lundiCourant,
      soldeDebut: clotures.get(plusJours(lundi, -1)) ?? 0,
      entrees,
      sorties,
      marge: arrondi(entrees - sorties),
      soldeFin: clotures.get(fin) ?? 0,
      nbEntrees: credits.length,
      nbSorties: debits.length,
      interne: arrondi(siens.filter((m) => m.interne).reduce((s, m) => s + signe(m), 0)),
      principalesEntrees: parTiers(credits, (m) => m.tiers).slice(0, 5),
      principalesSorties: parTiers(debits, (m) => m.tiers).slice(0, 8),
      sortiesParCompte: parTiers(debits, (m) => nomCompte.get(m.compteId) || 'Autre compte'),
    }
  })

  const somme = (f: (s: SemainePilotage) => number, liste = semaines) => arrondi(liste.reduce((t, s) => t + f(s), 0))
  const entieres = semaines.filter((s) => !s.enCours).slice(0, 4)
  const rythme = entieres.length ? {
    nbSemaines: entieres.length,
    entrees: arrondi(somme((s) => s.entrees, entieres) / entieres.length),
    sorties: arrondi(somme((s) => s.sorties, entieres) / entieres.length),
    marge: arrondi(somme((s) => s.marge, entieres) / entieres.length),
  } : null

  return {
    semaines,
    total: { entrees: somme((s) => s.entrees), sorties: somme((s) => s.sorties), marge: somme((s) => s.marge) },
    rythme,
    joursCouverts: rythme && rythme.sorties > 0 ? Math.floor(total / (rythme.sorties / 7)) : null,
  }
}

// ─── Rapprochement ──────────────────────────────────────────────────────────

/** Numéros de facture cités dans un texte de virement : « FA-2026-0108 », « FA 2026 108 »… → « FA-2026-0108 ». */
export function numerosFactureCites(texte: string): string[] {
  const trouves = new Set<string>()
  for (const r of texte.matchAll(/\b(FA|AV)[\s\-_/]?(20\d{2})[\s\-_/]?(\d{1,5})\b/gi)) {
    trouves.add(`${r[1].toUpperCase()}-${r[2]}-${r[3].padStart(4, '0')}`)
  }
  return [...trouves]
}

export interface FactureCitee { id: string; numero: string; status: string; montant: number; reste: number }
export interface VirementRapproche {
  mouvement: MouvementQonto
  factures: FactureCitee[]
  /** Numéros cités par le virement mais inconnus du CRM. */
  inconnus: string[]
  /** Une facture citée n'est pas soldée dans le CRM alors que l'argent est arrivé. */
  aPointer: boolean
}

/** Virements reçus qui citent un numéro de facture, rapprochés des factures du CRM. */
export function rapprocher(mouvements: MouvementQonto[], factures: FactureCitee[]): VirementRapproche[] {
  const parNumero = new Map(factures.map((f) => [f.numero.toUpperCase(), f]))
  const out: VirementRapproche[] = []
  for (const m of mouvements) {
    if (m.sens !== 'credit' || m.interne) continue
    const cites = numerosFactureCites(`${m.reference} ${m.libelle}`)
    if (!cites.length) continue
    const connues = cites.map((n) => parNumero.get(n)).filter((f): f is FactureCitee => !!f)
    out.push({
      mouvement: m,
      factures: connues,
      inconnus: cites.filter((n) => !parNumero.has(n)),
      aPointer: connues.some((f) => f.status !== 'payee' && f.status !== 'annulee'),
    })
  }
  return out
}

// ─── Engagements connus du CRM ──────────────────────────────────────────────

export interface LigneFinanceur { nom: string; nb: number; montant: number; plusAncienne: string | null }
export interface TrancheRetard { label: string; nb: number; montant: number }
export interface Lot { nb: number; total: number }

export interface Engagements {
  aEncaisser: {
    total: number
    nb: number
    /** Dont échéance dépassée. */
    enRetard: Lot
    parFinanceur: LigneFinanceur[]
    tranches: TrancheRetard[]
    /** Factures émises sans aucun montant : elles ne comptent pas. */
    sansMontant: number
  }
  /** Date du dernier paiement saisi dans le CRM. */
  dernierPaiement: string | null
  aPayer: {
    total: number
    /** Factures de formateurs reçues, pas encore payées : à valider, puis validées. */
    formateursAValider: Lot
    formateursValidees: Lot
    formateurs: { id: string; nom: string; numero: string; montant: number; date: string | null; status: string }[]
    franchisesValidees: Lot
    apporteursValidees: Lot
    /** Commissions calculées mais pas encore dues (session à venir, apporteur en attente). */
    commissionsAVenir: Lot
  }
}

const lot = (lignes: any[], montant: (x: any) => number): Lot => ({ nb: lignes.length, total: arrondi(lignes.reduce((s, x) => s + montant(x), 0)) })

function nomFinanceur(f: any): string {
  const brut = String(f.financeur_nom || f.client?.nom_commercial || f.client?.raison_sociale || '').replace(/\s+/g, ' ').trim()
  if (!brut) return 'Sans financeur'
  const k = cle(brut)
  // Les antennes d'un même financeur paient sur le même circuit : une seule ligne
  if (k.startsWith('AKTO')) return 'AKTO'
  if (k.startsWith('FRANCE TRAVAIL')) return 'France Travail'
  if (k.startsWith('OPCOMMERCE')) return 'Opcommerce'
  if (k.startsWith('OPCO EP')) return 'OPCO EP'
  return brut
}

/** Reste dû d'une facture : la colonne tenue par la base, à défaut TTC moins payé. */
export function resteDu(f: any): number {
  const restant = f.montant_restant
  if (restant !== null && restant !== undefined) return Math.max(0, Number(restant) || 0)
  return Math.max(0, (Number(f.montant_ttc) || 0) - (Number(f.montant_paye) || 0))
}

/** Factures citées par des virements, pour le rapprochement. */
export async function chargerFacturesCitees(supabase: any, organizationId: string, numeros: string[]): Promise<FactureCitee[]> {
  if (!numeros.length) return []
  const { data, error } = await supabase.from('factures')
    .select('id, numero, status, montant_ttc, montant_paye, montant_restant')
    .eq('organization_id', organizationId).in('numero', numeros.slice(0, 300))
  if (error) throw error
  return ((data || []) as any[]).map((f) => ({ id: f.id, numero: f.numero, status: f.status, montant: Number(f.montant_ttc) || 0, reste: resteDu(f) }))
}

/** Ce que le CRM attend en entrée et en sortie d'argent, au jour donné (« AAAA-MM-JJ »). */
export async function chargerEngagements(supabase: any, organizationId: string, aujourdhui: string): Promise<Engagements> {
  const [factures, dernier, ff, cs, ca] = await Promise.all([
    fetchAllPaged<any>((from, to) => supabase.from('factures')
      .select('id, numero, status, montant_ttc, montant_paye, montant_restant, date_echeance, financeur_nom, client:client_id(raison_sociale, nom_commercial)')
      .eq('organization_id', organizationId).not('status', 'in', '("payee","brouillon","annulee")').range(from, to)),
    supabase.from('paiements').select('date_paiement').eq('organization_id', organizationId).eq('status', 'valide')
      .order('date_paiement', { ascending: false }).limit(1),
    supabase.from('factures_formateur')
      .select('id, numero, status, montant_ttc, date_emission, submitted_at, formateur:formateur_id(prenom, nom)')
      .eq('organization_id', organizationId).in('status', ['envoyee', 'validee']).order('date_emission', { ascending: true }).limit(1000),
    fetchAllPaged<any>((from, to) => supabase.from('commissions_sessions')
      .select('status, commission_montant').eq('organization_id', organizationId).in('status', ['validee', 'a_venir']).range(from, to)),
    fetchAllPaged<any>((from, to) => supabase.from('commissions')
      .select('status, montant_commission').eq('organization_id', organizationId).in('status', ['validee', 'en_attente']).range(from, to)),
  ])
  if (dernier.error) throw dernier.error
  if (ff.error) throw ff.error

  // ── À encaisser ──
  const ouvertes = factures.map((f) => ({ ...f, reste: resteDu(f) })).filter((f) => f.reste > 0)
  const retard = (f: any) => (f.date_echeance && f.date_echeance < aujourdhui
    ? Math.round((Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${f.date_echeance}T00:00:00Z`)) / 86_400_000) : 0)
  const BORNES: [string, (j: number) => boolean][] = [
    ['Pas encore échues', (j) => j <= 0],
    ['1 à 30 jours de retard', (j) => j >= 1 && j <= 30],
    ['31 à 60 jours', (j) => j >= 31 && j <= 60],
    ['61 à 90 jours', (j) => j >= 61 && j <= 90],
    ['Plus de 90 jours', (j) => j > 90],
  ]
  const financeurs = new Map<string, LigneFinanceur>()
  for (const f of ouvertes) {
    const nom = nomFinanceur(f)
    const g = financeurs.get(nom) || { nom, nb: 0, montant: 0, plusAncienne: null }
    g.nb++
    g.montant += f.reste
    if (f.date_echeance && (!g.plusAncienne || f.date_echeance < g.plusAncienne)) g.plusAncienne = f.date_echeance
    financeurs.set(nom, g)
  }

  // ── À payer ──
  const formateurs = ((ff.data || []) as any[]).map((f) => ({
    id: f.id,
    nom: [f.formateur?.prenom, f.formateur?.nom].filter(Boolean).join(' ') || 'Formateur',
    numero: f.numero || '',
    montant: Number(f.montant_ttc) || 0,
    date: f.date_emission || (f.submitted_at ? String(f.submitted_at).slice(0, 10) : null),
    status: f.status as string,
  }))
  const formateursAValider = lot(formateurs.filter((f) => f.status === 'envoyee'), (f) => f.montant)
  const formateursValidees = lot(formateurs.filter((f) => f.status === 'validee'), (f) => f.montant)
  const franchisesValidees = lot(cs.filter((c) => c.status === 'validee'), (c) => Number(c.commission_montant) || 0)
  const apporteursValidees = lot(ca.filter((c) => c.status === 'validee'), (c) => Number(c.montant_commission) || 0)
  const aVenirFranchise = lot(cs.filter((c) => c.status === 'a_venir'), (c) => Number(c.commission_montant) || 0)
  const aVenirApporteur = lot(ca.filter((c) => c.status === 'en_attente'), (c) => Number(c.montant_commission) || 0)

  return {
    aEncaisser: {
      total: arrondi(ouvertes.reduce((s, f) => s + f.reste, 0)),
      nb: ouvertes.length,
      enRetard: lot(ouvertes.filter((f) => retard(f) > 0), (f) => f.reste),
      parFinanceur: [...financeurs.values()].map((g) => ({ ...g, montant: arrondi(g.montant) })).sort((a, b) => b.montant - a.montant),
      tranches: BORNES.map(([label, dans]) => ({ label, ...lot(ouvertes.filter((f) => dans(retard(f))), (f) => f.reste) }))
        .map(({ label, nb, total }) => ({ label, nb, montant: total })),
      sansMontant: factures.filter((f) => !Number(f.montant_ttc)).length,
    },
    dernierPaiement: dernier.data?.[0]?.date_paiement ? String(dernier.data[0].date_paiement).slice(0, 10) : null,
    aPayer: {
      total: arrondi(formateursAValider.total + formateursValidees.total + franchisesValidees.total + apporteursValidees.total),
      formateursAValider,
      formateursValidees,
      formateurs,
      franchisesValidees,
      apporteursValidees,
      commissionsAVenir: { nb: aVenirFranchise.nb + aVenirApporteur.nb, total: arrondi(aVenirFranchise.total + aVenirApporteur.total) },
    },
  }
}

/**
 * Encaissements reçus en banque après le dernier paiement saisi dans le CRM :
 * l'écart à pointer. `depuis` est ce dernier paiement, ou le début du relevé
 * quand il remonte moins loin.
 */
export function encaissementsNonSaisis(banque: BanqueQonto, dernierPaiement: string | null): { depuis: string; total: number; nb: number; principaux: LigneTiers[] } | null {
  if (!dernierPaiement) return null
  const depuis = dernierPaiement > banque.depuis ? dernierPaiement : banque.depuis
  const recus = banque.mouvements.filter((m) => m.sens === 'credit' && !m.interne && jourParis(m.date) > depuis)
  if (!recus.length) return null
  return { depuis, total: arrondi(recus.reduce((s, m) => s + m.montant, 0)), nb: recus.length, principaux: parTiers(recus, (m) => m.tiers).slice(0, 3) }
}
