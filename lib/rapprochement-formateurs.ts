/**
 * Rapprochement des virements bancaires et des factures formateur : quelles
 * factures encore ouvertes dans le CRM ont en réalité été réglées en banque.
 *
 * Une facture n'est proposée « payée » que pour un virement du même formateur
 * et du même montant, au centime près. Ce qui désigne la facture, par ordre de
 * confiance :
 *  1. le virement cite le numéro du CRM (« FF-2026-012 ») ;
 *  2. il cite le numéro que le formateur a donné à sa facture ;
 *  3. il cite le client de la session ;
 *  4. rien ne la désigne, mais c'est la seule facture ouverte de ce montant.
 * Les cas 1 à 3 sont sûrs. Le cas 4, et tout virement libellé « avance » ou
 * « acompte », demandent une confirmation. Un virement qui désigne une facture
 * sans en avoir le montant est un acompte : il est montré, jamais soldé.
 *
 * `proposerRapprochements` est pur. `chargerRapprochements` lit la base et
 * s'appuie sur le relevé déjà chargé.
 */

import type { BanqueQonto } from '@/lib/qonto'
import { JOURS_RELEVE, constituerEquipe, jourParis, ventilerParPersonne, type LigneDetail } from '@/lib/tresorerie'

export type Motif = 'numero' | 'numero_formateur' | 'client' | 'montant'

export const MOTIF_LABEL: Record<Motif, string> = {
  numero: 'Le virement cite le numéro de la facture',
  numero_formateur: 'Le virement cite le numéro du formateur',
  client: 'Le virement cite le client, même montant',
  montant: 'Même montant, seule facture ouverte à ce prix',
}

export interface FactureOuverte {
  id: string
  numero: string
  referenceExterne: string | null
  formateurId: string
  formateurNom: string
  montantTtc: number
  status: string
  client: string | null
  clientVille: string | null
  /** Premier et dernier jour de la session rattachée. */
  debut: string | null
  fin: string | null
  /** Date d'émission de la facture. */
  date: string | null
}

export interface Proposition {
  facture: FactureOuverte
  virement: LigneDetail
  motif: Motif
  /** Faux : à confirmer à la main (libellé « avance », ou rien ne désigne la facture). */
  sur: boolean
}

export interface Acompte {
  formateurId: string
  virement: LigneDetail
  /** Factures que le virement désigne sans les solder ; vide quand il ne précise rien. */
  factures: string[]
}

export interface Rapprochements { propositions: Proposition[]; acomptes: Acompte[] }

const alnum = (s: unknown) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '')
const mots = (s: unknown) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
const egal = (a: number, b: number) => Math.abs(a - b) < 0.01
const jours = (de: string, a: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)

/** Mots qui ne distinguent pas un client d'un autre : abréviations d'enseigne, formes juridiques, mots de libellé. */
const BANALS = new Set(['CT', 'CTG', 'CS', 'GK', 'CHAMAS', 'TACOS', 'CHICKEN', 'STREET', 'NEW', 'SCHOOL', 'LE', 'LA', 'LES', 'DE', 'DU', 'DES', 'ET', 'AU', 'AUX',
  'SARL', 'SAS', 'SASU', 'EURL', 'EI', 'RESTAURANT', 'RESTAURATION', 'SNACK', 'FOOD', 'BURGER', 'PIZZA', 'GRILL', 'CAFE', 'BAR', 'SAINT', 'STE', 'ST'])
const AVANCE = /\b(AVANCE|ACOMPTE|ACOMPTES|AVANCES)\b/
const HORS_FACTURE = /\b(FRAIS|REMBOURSEMENT|REMBOURS|DEPLACEMENT|NOTE)\b/

/** Le libellé du virement cite-t-il le client de la facture (son nom ou sa ville) ? */
function citeLeClient(motsLibelle: Set<string>, f: FactureOuverte): boolean {
  const distinctifs = [...mots(f.client), ...mots(f.clientVille)].filter((m) => m.length >= 3 && !BANALS.has(m) && !/^\d+$/.test(m))
  return distinctifs.some((m) => motsLibelle.has(m))
}

/** Numéros du CRM cités dans un libellé : « FF-2026-012 », « FF 2026 12 » → « FF-2026-012 ». */
function numerosCrm(libelle: string): string[] {
  return [...libelle.toUpperCase().matchAll(/\bFF[\s\-_/]?(20\d{2})[\s\-_/]?(\d{1,4})\b/g)].map((r) => `FF-${r[1]}-${r[2].padStart(3, '0')}`)
}

/**
 * Propose les rapprochements formateur par formateur. Un virement ne sert
 * qu'une fois, une facture n'est proposée qu'une fois ; `dejaUtilises` porte
 * les mouvements qui ont déjà soldé une facture.
 */
export function proposerRapprochements(
  factures: FactureOuverte[],
  virementsParFormateur: Map<string, LigneDetail[]>,
  dejaUtilises: Set<string>,
): Rapprochements {
  const propositions: Proposition[] = []
  const acomptes: Acompte[] = []

  for (const [formateurId, tous] of virementsParFormateur) {
    const ouvertes = factures.filter((f) => f.formateurId === formateurId).sort((a, b) => String(a.debut || a.date || '').localeCompare(String(b.debut || b.date || '')))
    if (!ouvertes.length) continue
    const virements = tous.filter((v) => !dejaUtilises.has(v.id)).sort((a, b) => a.jour.localeCompare(b.jour))
    const prises = new Set<string>()
    const servis = new Set<string>()
    const libres = () => ouvertes.filter((f) => !prises.has(f.id))
    const proposer = (f: FactureOuverte, v: LigneDetail, motif: Motif, sur: boolean) => {
      propositions.push({ facture: f, virement: v, motif, sur: sur && !AVANCE.test(v.libelle.toUpperCase()) })
      prises.add(f.id)
      servis.add(v.id)
    }
    const acompte = (v: LigneDetail, cibles: FactureOuverte[]) => { acomptes.push({ formateurId, virement: v, factures: cibles.map((f) => f.numero) }); servis.add(v.id) }
    /** Solde `cibles` si le virement en a le montant : une seule facture, ou toutes ensemble. Sinon, acompte. */
    const solder = (v: LigneDetail, cibles: FactureOuverte[], motif: Motif) => {
      const exacte = cibles.find((f) => egal(f.montantTtc, v.montant))
      if (exacte) return proposer(exacte, v, motif, true)
      if (cibles.length > 1 && egal(cibles.reduce((s, f) => s + f.montantTtc, 0), v.montant)) { for (const f of cibles) proposer(f, v, motif, true); return }
      acompte(v, cibles)
    }

    // 1. Le numéro du CRM
    for (const v of virements) {
      const cibles = libres().filter((f) => numerosCrm(v.libelle).includes(f.numero.toUpperCase()))
      if (cibles.length) solder(v, cibles, 'numero')
    }
    // 2. Le numéro que le formateur a donné à sa facture (six caractères au moins : « 001 » ne désigne rien)
    for (const v of virements) {
      if (servis.has(v.id)) continue
      const texte = alnum(v.libelle)
      const cibles = libres().filter((f) => { const r = alnum(f.referenceExterne); return r.length >= 6 && texte.includes(r) })
      if (cibles.length) solder(v, cibles, 'numero_formateur')
    }
    // 3. Le client de la session, à trois mois près
    for (const v of virements) {
      if (servis.has(v.id)) continue
      const m = new Set(mots(v.libelle))
      const cibles = libres().filter((f) => citeLeClient(m, f) && (!f.debut || Math.abs(jours(f.debut, v.jour)) <= 92))
      if (cibles.length) solder(v, cibles, 'client')
    }
    // 4. Rien ne désigne la facture : même montant, virement postérieur au début de la session, une seule candidate
    for (const v of virements) {
      if (servis.has(v.id)) continue
      const libelle = v.libelle.toUpperCase()
      if (AVANCE.test(libelle)) { acompte(v, []); continue }
      if (HORS_FACTURE.test(libelle)) continue
      const cibles = libres().filter((f) => egal(f.montantTtc, v.montant) && !!f.debut && v.jour >= f.debut && jours(f.fin || f.debut, v.jour) <= 120)
      if (cibles.length === 1) proposer(cibles[0], v, 'montant', false)
    }
  }

  propositions.sort((a, b) => Number(b.sur) - Number(a.sur) || a.facture.formateurNom.localeCompare(b.facture.formateurNom) || a.virement.jour.localeCompare(b.virement.jour))
  return { propositions, acomptes }
}

/** Ce qui est écrit sur la facture quand un virement la solde ; l'identifiant entre crochets empêche de resservir le virement. */
export function referencePaiement(v: LigneDetail): string {
  const date = `${v.jour.slice(8, 10)}/${v.jour.slice(5, 7)}/${v.jour.slice(0, 4)}`
  return `Virement du ${date}${v.libelle ? ` · ${v.libelle}` : ''}${v.compte ? ` · compte ${v.compte}` : ''} [qonto:${v.id}]`.slice(0, 480)
}

/** La référence sans son identifiant technique, pour l'affichage. */
export const referenceLisible = (r: string | null | undefined) => String(r || '').replace(/\s*\[qonto:[^\]]+\]/g, '').trim()

const ROLES_INTERNES = ['super_admin', 'gestionnaire', 'commercial', 'directeur_commercial', 'comptable']

/** Lit les factures ouvertes et les virements par formateur, puis propose les rapprochements. */
export async function chargerRapprochements(supabase: any, organizationId: string, banque: BanqueQonto): Promise<Rapprochements> {
  const [utilisateurs, formateurs, factures] = await Promise.all([
    supabase.from('users').select('first_name, last_name').eq('organization_id', organizationId).in('role', ROLES_INTERNES),
    supabase.from('formateurs').select('id, prenom, nom').eq('organization_id', organizationId).limit(2000),
    supabase.from('factures_formateur')
      .select('id, numero, reference_externe, formateur_id, montant_ht, montant_ttc, status, date_emission, created_at, reference_paiement, formateur:formateur_id(prenom, nom), session:session_id(date_debut, date_fin, client:client_id(raison_sociale, nom_commercial, ville))')
      .eq('organization_id', organizationId).limit(5000),
  ])
  if (factures.error) throw factures.error
  const liste = (factures.data || []) as any[]

  const dejaUtilises = new Set<string>()
  for (const f of liste) for (const r of String(f.reference_paiement || '').matchAll(/\[qonto:([^\]]+)\]/g)) dejaUtilises.add(r[1])

  const ouvertes: FactureOuverte[] = liste.filter((f) => f.status === 'envoyee' || f.status === 'validee').map((f) => ({
    id: f.id,
    numero: f.numero || '',
    referenceExterne: f.reference_externe || null,
    formateurId: f.formateur_id,
    formateurNom: `${f.formateur?.prenom || ''} ${f.formateur?.nom || ''}`.trim(),
    montantTtc: Number(f.montant_ttc) || Number(f.montant_ht) || 0,
    status: f.status,
    client: f.session?.client?.nom_commercial || f.session?.client?.raison_sociale || null,
    clientVille: f.session?.client?.ville || null,
    debut: f.session?.date_debut ? String(f.session.date_debut).slice(0, 10) : null,
    fin: f.session?.date_fin ? String(f.session.date_fin).slice(0, 10) : null,
    date: f.date_emission || (f.created_at ? String(f.created_at).slice(0, 10) : null),
  }))

  const equipe = constituerEquipe(banque.membres, (utilisateurs.data || []) as any[])
  const ventilation = ventilerParPersonne(banque, equipe, (formateurs.data || []) as any[], JOURS_RELEVE - 1, jourParis(new Date()))
  const virements = new Map<string, LigneDetail[]>()
  for (const v of ventilation.formateurs) if (v.formateurId) virements.set(v.formateurId, v.lignes)

  return proposerRapprochements(ouvertes, virements, dejaUtilises)
}
