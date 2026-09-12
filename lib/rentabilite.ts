/**
 * Rentabilité par session : calcul pur, sans requête ni React.
 *
 * L'onglet Facturation d'une session et la page Rentabilité appellent les
 * mêmes fonctions (calculerRentabilite, calculerToutes) sur des données
 * chargées d'un bloc par lib/rentabilite-data.ts. Rien n'est stocké : la
 * marge est recalculée à chaque affichage.
 *
 * Un montant inconnu vaut null, jamais 0 : la marge passe alors « À
 * compléter » avec la liste de ce qui manque.
 */
import { calculerCommissionSession, commissionTypeLabel } from '@/lib/commission'

// ─── Constantes ─────────────────────────────────────────────────────────────

export const ROLES_MARGE = ['super_admin', 'gestionnaire', 'comptable'] as const

export function peutVoirMarge(role: string | null | undefined): boolean {
  return !!role && (ROLES_MARGE as readonly string[]).includes(role)
}

/** Sous 30 % du CA, la marge ne couvre plus les charges non affectées (administration, commercial, Qualiopi, outils). */
export const SEUIL_MARGE_FAIBLE = 0.30

export const STATUTS_FACTURE_EMISE = ['emise', 'envoyee', 'payee_partiellement', 'payee', 'en_retard'] as const

export const CATEGORIES_FRAIS_VALEURS = [
  'deplacement', 'hebergement', 'repas', 'salle', 'materiel', 'supports', 'sous_traitance', 'autre',
] as const
export type CategorieFrais = (typeof CATEGORIES_FRAIS_VALEURS)[number]

export const CATEGORIES_FRAIS = [
  { valeur: 'deplacement', label: 'Déplacement', icone: 'Route' },
  { valeur: 'hebergement', label: 'Hébergement', icone: 'Home' },
  { valeur: 'repas', label: 'Repas', icone: 'Utensils' },
  { valeur: 'salle', label: 'Salle', icone: 'Building2' },
  { valeur: 'materiel', label: 'Matériel', icone: 'Wrench' },
  { valeur: 'supports', label: 'Supports pédagogiques', icone: 'BookOpen' },
  { valeur: 'sous_traitance', label: 'Sous-traitance', icone: 'Briefcase' },
  { valeur: 'autre', label: 'Autre', icone: 'Tag' },
] as const

export function libelleCategorieFrais(v: string | null | undefined): string {
  return CATEGORIES_FRAIS.find((c) => c.valeur === v)?.label || 'Autre'
}

export const MESSAGE_MIGRATION_FRAIS = 'Appliquez la migration 149 pour saisir les frais annexes.'
export const MESSAGE_TVA_FORMATEUR = 'TVA des formateurs non paramétrée : 0 % retenu.'

// ─── Formatage ──────────────────────────────────────────────────────────────

export const round2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export function euro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return 'Non renseigné'
  const v = Math.abs(Number(n)) < 0.005 ? 0 : Number(n)
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function pourcent(t: number | null | undefined): string {
  if (t == null || !Number.isFinite(t)) return 'Non calculable'
  return (t * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'
}

function dateFr(iso: string | null | undefined): string {
  if (!iso) return ''
  const [a, m, j] = String(iso).slice(0, 10).split('-')
  return a && m && j ? `${j}/${m}/${a}` : String(iso)
}

// ─── Types de sortie ────────────────────────────────────────────────────────

export type Qualite = 'facture' | 'contractualise' | 'saisi' | 'prevu' | 'estime' | 'inconnu' | 'fige' | 'a_venir'

export const QUALITE_LABELS: Record<Qualite, string> = {
  facture: 'Facturé',
  contractualise: 'Contractualisé',
  saisi: 'Saisi',
  prevu: 'Prévu',
  estime: 'Estimé',
  inconnu: 'Non renseigné',
  fige: 'Figée',
  a_venir: 'À venir',
}

export type FamilleLigne = 'recette' | 'formateur' | 'frais' | 'commission_franchise' | 'commission_apporteur'

export interface LigneRentab {
  cle: string
  famille: FamilleLigne
  libelle: string
  detail?: string
  montant: number | null
  qualite: Qualite
  /** Libellé de la puce quand il précise la qualité (« Facture reçue », « Payée »…) */
  qualiteLabel?: string
  sessionId?: string
  lien?: { href: string; label: string }
  liens?: { href: string; label: string }[]
  fraisId?: string
  justificatif?: boolean
  /** Affichée pour information, hors sous-total (brouillon, facture incluse dans Dendreo…) */
  horsTotal?: boolean
  /** Ligne de mention, sans montant (« Établissement sans franchise ») */
  info?: boolean
  /** 'i:<intervention>' ou 's:<session>' pour un coût formateur */
  ancre?: string
}

export interface Alerte { code: string; niveau: 'critique' | 'attention' | 'info'; message: string }

export type StatutMarge = 'rentable' | 'marge_faible' | 'deficitaire' | 'incomplete' | 'sans_objet'
export type QualiteMarge = 'realisee' | 'previsionnelle' | 'estimee'
export type BadgeUnite = 'intra' | 'inter' | 'poei' | 'agefice' | 'dendreo'

export const STATUT_LABELS: Record<StatutMarge, string> = {
  rentable: 'Rentable',
  marge_faible: 'Marge faible',
  deficitaire: 'Déficitaire',
  incomplete: 'À compléter',
  sans_objet: 'Sans objet',
}

export const QUALITE_MARGE_LABELS: Record<QualiteMarge, string> = {
  realisee: 'Réalisée',
  previsionnelle: 'Prévisionnelle',
  estimee: 'Estimée',
}

export interface Rentabilite {
  uniteId: string
  type: 'session' | 'poei'
  sessionIds: string[]
  porteuseIds: string[]
  poeiIds: string[]
  titre: string
  reference: string | null
  client: string | null
  date: string | null
  statutsSession: string[]
  badges: BadgeUnite[]
  recette: {
    facture: number
    brouillons: number
    base: number | null
    baseSource: string
    prevu: number | null
    aFacturer: number
    encaisse: number
    encaisseDendreoJustifie: number
    encaissementNonSuivi: number
    resteDu: number
    indicationCatalogue: number | null
  }
  couts: {
    formateur: number
    formateurInconnu: boolean
    frais: number
    fraisDisponibles: boolean
    commissionFranchise: number | null
    commissionApporteur: number | null
    total: number
  }
  marge: number | null
  margePartielle: number
  taux: number | null
  qualiteMarge: QualiteMarge
  statut: StatutMarge
  lignes: LigneRentab[]
  alertes: Alerte[]
  manques: string[]
}

/** Frais tel qu'envoyé au navigateur (sans le chemin de stockage). */
export interface FraisVue {
  id: string
  session_id: string
  categorie: string
  libelle: string
  montant: number
  date_frais: string | null
  formateur_id: string | null
  justificatif_nom: string | null
  aJustificatif: boolean
  notes: string | null
}

/** Props sérialisables de l'onglet Facturation (aucune Map). */
export interface VueRentabiliteSession {
  role: 'unite' | 'intervention'
  rentabilite: Rentabilite
  parcours?: { poeiIds: string[]; numeros: string[]; porteuseHref: string }
  /** Vue intervention : ancres ('s:…', 'i:…') des coûts formateur propres à la session */
  ancres?: string[]
  sessionsFrais: { id: string; libelle: string }[]
  formateursFrais: { id: string; nom: string }[]
  fraisParSession: Record<string, FraisVue[]>
  fraisDisponibles: boolean
  peutRecalculerCommission: boolean
}

// ─── Types d'entrée (lignes lues en base) ───────────────────────────────────

type Num = number | string | null

export interface SessionRentab {
  id: string
  reference: string | null
  intitule: string | null
  status: string | null
  type_session: string | null
  date_debut: string | null
  date_fin: string | null
  client_id: string | null
  formateur_id: string | null
  poei_intervention_id: string | null
  dendreo_id: string | number | null
  prix_ht: Num
  montant_finance_opco: Num
  deja_facture_ailleurs: Num
  numero_dossier_opco: string | null
  cout_formateur: Num
  cout_salle: Num
  cout_materiel: Num
  horaires_jours: any[] | null
  formation: { intitule: string | null; duree_jours: Num; is_poei: boolean | null; tarif_inter_ht: Num; tarif_intra_ht: Num } | null
  client: { id: string; raison_sociale: string | null; nom_commercial: string | null; franchise_id: string | null; financeur_type: string | null } | null
}

export interface PoeiRentab { id: string; numero: string | null; session_id: string | null; client_id: string | null; date_debut: string | null; montant_total: Num; statut: string | null }
export interface InterventionRentab { id: string; poei_id: string; formateur_id: string | null; libelle: string | null; montant_ht: Num; date_debut: string | null }
export interface FactureRentab {
  id: string; numero: string | null; status: string | null
  montant_ht: Num; montant_ttc: Num; montant_paye: Num
  session_id: string | null; client_id: string | null
  financeur_nom: string | null; financeur_type: string | null
  dendreo_id: string | number | null; notes_internes: string | null
  numero_prise_en_charge: string | null; date_emission: string | null
}
export interface LigneFactureRentab { id?: string; facture_id: string; session_id: string | null; montant_ht: Num }
export interface ContratRentab { id: string; numero: string | null; session_id: string | null; poei_intervention_id: string | null; formateur_id: string | null; status: string | null; montant_ht: Num }
export interface FactureFormateurRentab { id: string; numero: string | null; session_id: string | null; formateur_id: string | null; status: string | null; montant_ttc: Num; fichier_url: string | null }
export interface CommissionSessionRentab {
  session_id: string; franchise_id: string | null; status: string | null
  commission_montant: Num; base_montant: Num; base_source: string | null
  cout_formateur: Num; cout_formateur_manuel: Num; commission_type: string | null; calculee_at: string | null
}
export interface FraisRentab {
  id: string; session_id: string; categorie: string; libelle: string; montant: Num
  date_frais: string | null; formateur_id: string | null
  justificatif_path: string | null; justificatif_nom: string | null; notes: string | null
}
export interface ConventionRentab { id: string; numero: string | null; session_id: string | null; client_id: string | null; status: string | null; montant_ht: Num; montant_ttc?: Num }
export interface DossierAgeficeRentab { id: string; session_id: string | null; statut: string | null; cout_pedagogique: Num; montant_accorde: Num; montant_demande: Num; facture_id: string | null }
export interface InscriptionRentab { session_id: string; status: string | null; client_id: string | null }
export interface FormateurRentab { id: string; prenom: string | null; nom: string | null; tarif_journalier: Num; type_contrat: string | null; taux_tva?: Num }
export interface FranchiseRentab { id: string; nom: string | null; commission_type: string | null; taux_commission: Num }
export interface ApporteurRentab {
  id: string; nom: string | null; prenom: string | null; raison_sociale: string | null
  mode_calcul: string | null; taux_commission: Num; commission_fixe: Num
  is_active: boolean | null; date_debut_contrat: string | null; date_fin_contrat: string | null
}
export interface ClientRentab { id: string; raison_sociale: string | null; nom_commercial: string | null; apporteur_id?: string | null }
/** Autre session de l'organisation, pour les alertes de doublon (A3) et de combo (A19). */
export interface SessionVoisine {
  id: string; reference: string | null; client_id: string | null; date_debut: string | null
  numero_dossier_opco: string | null; prix_ht: Num; montant_finance_opco: Num; deja_facture_ailleurs: Num; status: string | null
}

export interface DonneesBrutes {
  sessions: SessionRentab[]
  poei: PoeiRentab[]
  interventions: InterventionRentab[]
  factures: FactureRentab[]
  lignes: LigneFactureRentab[]
  contrats: ContratRentab[]
  facturesFormateur: FactureFormateurRentab[]
  commissionsSessions: CommissionSessionRentab[]
  frais: FraisRentab[]
  conventions: ConventionRentab[]
  dossiersAgefice: DossierAgeficeRentab[]
  inscriptions: InscriptionRentab[]
  formateurs: FormateurRentab[]
  franchises: FranchiseRentab[]
  apporteurs: ApporteurRentab[]
  clients: ClientRentab[]
  fraisDisponibles: boolean
  tvaFormateurDisponible: boolean
  /** Onglet : sessions de l'org au même numéro de dossier OPCO. Synthèse : absent, on lit `sessions`. */
  sessionsMemeDossier?: SessionVoisine[]
  /** Onglet : sessions du même client au même jour. Synthèse : absent, on lit `sessions`. */
  sessionsMemeJour?: SessionVoisine[]
  /** fichier_url d'une facture formateur → URL signée */
  urlsFacturesFormateur?: Record<string, string>
}

export interface PartFacture { facture: FactureRentab; montant: number; sessionId: string | null; poeiId: string | null }

interface Index {
  sessionParId: Map<string, SessionRentab>
  poeiParId: Map<string, PoeiRentab>
  interventionParId: Map<string, InterventionRentab>
  sessionsParIntervention: Map<string, SessionRentab[]>
  contratsParSession: Map<string, ContratRentab[]>
  contratsParIntervention: Map<string, ContratRentab[]>
  ffParSession: Map<string, FactureFormateurRentab[]>
  commissionParSession: Map<string, CommissionSessionRentab>
  fraisParSession: Map<string, FraisRentab[]>
  conventionsParSession: Map<string, ConventionRentab[]>
  ageficeParSession: Map<string, DossierAgeficeRentab[]>
  inscriptionsParSession: Map<string, InscriptionRentab[]>
  facturesParSessionDirect: Map<string, FactureRentab[]>
  formateurParId: Map<string, FormateurRentab>
  franchiseParId: Map<string, FranchiseRentab>
  apporteurParId: Map<string, ApporteurRentab>
  clientParId: Map<string, ClientRentab>
  voisinsParDossier: Map<string, SessionVoisine[]>
  voisinsParJour: Map<string, SessionVoisine[]>
  parts: { parSession: Map<string, PartFacture[]>; parPoei: Map<string, PartFacture[]> }
}

export interface DonneesRentabilite extends DonneesBrutes { idx: Index }

export interface Unite {
  id: string
  type: 'session' | 'poei'
  sessionIds: string[]
  porteuseIds: string[]
  poeiIds: string[]
  interventionIds: string[]
  date: string | null
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

const n = (v: Num | undefined): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
/** Montant strictement positif, sinon inconnu (un montant ≤ 0 est traité comme inconnu). */
const positif = (v: Num | undefined): number | null => {
  const x = n(v)
  return x > 0 ? x : null
}
const TOLERANCE = 1 // comparaisons d'alertes à 1 € près

function grouper<T>(arr: T[], cle: (x: T) => string | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of arr) {
    const k = cle(x)
    if (!k) continue
    const l = m.get(k)
    if (l) l.push(x); else m.set(k, [x])
  }
  return m
}

const uniques = <T>(arr: T[]): T[] => Array.from(new Set(arr))

export const normaliserDossier = (x: string | null | undefined): string =>
  String(x || '').replace(/\s+/g, '').toUpperCase()

export const estReconstituee = (f: FactureRentab): boolean =>
  String(f.notes_internes || '').trimStart().startsWith('Facture reconstituée depuis')

export const estDendreo = (f: FactureRentab): boolean => f.dendreo_id != null && String(f.dendreo_id) !== ''

export function marqueurPoei(f: FactureRentab): string | null {
  const m = String(f.notes_internes || '').match(/\[POEI-FACT:([0-9a-f-]+):/i)
  return m ? m[1] : null
}

const STATUT_FACTURE_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', emise: 'Émise', envoyee: 'Envoyée', payee_partiellement: 'Payée en partie',
  payee: 'Payée', en_retard: 'En retard', annulee: 'Annulée',
}

const nomFormateur = (f: FormateurRentab | undefined | null): string | null =>
  f ? [f.prenom, f.nom].filter(Boolean).join(' ').trim() || null : null

const nomApporteur = (a: ApporteurRentab): string =>
  a.raison_sociale || [a.prenom, a.nom].filter(Boolean).join(' ') || 'Apporteur'

const libelleClient = (c: { raison_sociale: string | null; nom_commercial: string | null } | null | undefined): string | null =>
  c ? (c.nom_commercial || c.raison_sociale || null) : null

const refSession = (s: { reference: string | null; date_debut: string | null }): string =>
  s.reference || (s.date_debut ? `session du ${dateFr(s.date_debut)}` : 'session sans référence')

/** Jours planifiés, sinon durée catalogue ; inconnu sinon (pas de défaut à 1 jour). */
export function nbJoursSession(s: SessionRentab): number | null {
  const h = Array.isArray(s.horaires_jours) ? s.horaires_jours.length : 0
  if (h > 0) return h
  const dj = n(s.formation?.duree_jours)
  return dj > 0 ? dj : null
}

const inscritsActifs = (d: DonneesRentabilite, sid: string): InscriptionRentab[] =>
  (d.idx.inscriptionsParSession.get(sid) || []).filter((i) => !['annule', 'abandonne'].includes(String(i.status)))

// ─── Index ──────────────────────────────────────────────────────────────────

/**
 * Attribution des factures aux sessions et aux parcours POEI.
 * Une facture ventilée par lignes (facture_lignes.session_id) va à chaque
 * session pour sa ligne, le reste à factures.session_id. Une facture France
 * Travail (marqueur POEI) va toujours à son parcours.
 */
export function attribuerFactures(b: DonneesBrutes): Index['parts'] {
  const parSession = new Map<string, PartFacture[]>()
  const parPoei = new Map<string, PartFacture[]>()
  const push = (m: Map<string, PartFacture[]>, k: string, p: PartFacture) => {
    const l = m.get(k); if (l) l.push(p); else m.set(k, [p])
  }
  const lignesParFacture = grouper(b.lignes.filter((l) => l.session_id), (l) => l.facture_id)
  const vues = new Set<string>()
  for (const f of b.factures) {
    if (vues.has(f.id)) continue
    vues.add(f.id)
    const total = round2(n(f.montant_ht))
    const poeiId = marqueurPoei(f)
    if (poeiId) {
      push(parPoei, poeiId, { facture: f, montant: total, sessionId: f.session_id, poeiId })
      continue
    }
    const lignes = lignesParFacture.get(f.id) || []
    if (lignes.length) {
      let somme = 0
      for (const l of lignes) {
        const m = round2(n(l.montant_ht))
        somme += m
        push(parSession, l.session_id!, { facture: f, montant: m, sessionId: l.session_id, poeiId: null })
      }
      const reste = round2(total - somme)
      if (reste > 0.005 && f.session_id) push(parSession, f.session_id, { facture: f, montant: reste, sessionId: f.session_id, poeiId: null })
      continue
    }
    if (f.session_id) push(parSession, f.session_id, { facture: f, montant: total, sessionId: f.session_id, poeiId: null })
  }
  return { parSession, parPoei }
}

export function indexerDonnees(b: DonneesBrutes): DonneesRentabilite {
  const dedup = <T extends { id: string }>(arr: T[]) => Array.from(new Map(arr.map((x) => [x.id, x])).values())
  const factures = dedup(b.factures)
  const contrats = dedup(b.contrats)
  const lignes = Array.from(new Map(b.lignes.map((l, i) => [l.id || `${l.facture_id}:${l.session_id}:${i}`, l])).values())
  const brut: DonneesBrutes = { ...b, factures, contrats, lignes }
  const voisinsDossier = b.sessionsMemeDossier ?? b.sessions
  const voisinsJour = b.sessionsMemeJour ?? b.sessions
  const idx: Index = {
    sessionParId: new Map(b.sessions.map((s) => [s.id, s])),
    poeiParId: new Map(b.poei.map((p) => [p.id, p])),
    interventionParId: new Map(b.interventions.map((i) => [i.id, i])),
    sessionsParIntervention: grouper(b.sessions, (s) => s.poei_intervention_id),
    contratsParSession: grouper(contrats, (c) => c.session_id),
    contratsParIntervention: grouper(contrats, (c) => c.poei_intervention_id),
    ffParSession: grouper(b.facturesFormateur, (f) => f.session_id),
    commissionParSession: new Map(b.commissionsSessions.map((c) => [c.session_id, c])),
    fraisParSession: grouper(b.frais, (f) => f.session_id),
    conventionsParSession: grouper(b.conventions, (c) => c.session_id),
    ageficeParSession: grouper(b.dossiersAgefice, (a) => a.session_id),
    inscriptionsParSession: grouper(b.inscriptions, (i) => i.session_id),
    facturesParSessionDirect: grouper(factures, (f) => f.session_id),
    formateurParId: new Map(b.formateurs.map((f) => [f.id, f])),
    franchiseParId: new Map(b.franchises.map((f) => [f.id, f])),
    apporteurParId: new Map(b.apporteurs.map((a) => [a.id, a])),
    clientParId: new Map(b.clients.map((c) => [c.id, c])),
    voisinsParDossier: grouper(voisinsDossier, (s) => normaliserDossier(s.numero_dossier_opco) || null),
    voisinsParJour: grouper(voisinsJour, (s) => (s.client_id && s.date_debut ? `${s.client_id}|${s.date_debut}` : null)),
    parts: attribuerFactures(brut),
  }
  return { ...brut, idx }
}

// ─── Unités ─────────────────────────────────────────────────────────────────

/**
 * Composantes connexes du graphe POEI → session porteuse, POEI → interventions,
 * intervention → sessions d'intervention. Deux POEI qui partagent une session
 * forment une seule unité : chaque session n'est comptée qu'une fois.
 */
export function composantesPoei(
  poei: { id: string; session_id: string | null }[],
  interventions: { id: string; poei_id: string }[],
  liens: { id: string; poei_intervention_id: string | null }[],
): { racine: (noeud: string) => string | null; composantes: Map<string, string[]> } {
  const parent = new Map<string, string>()
  const add = (x: string) => { if (!parent.has(x)) parent.set(x, x) }
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    let c = x
    while (parent.get(c) !== r) { const s = parent.get(c)!; parent.set(c, r); c = s }
    return r
  }
  const union = (a: string, b: string) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }

  const poeiIds = new Set(poei.map((p) => p.id))
  for (const p of poei) {
    add('p:' + p.id)
    if (p.session_id) union('p:' + p.id, 's:' + p.session_id)
  }
  const interIds = new Set<string>()
  for (const i of interventions) {
    if (!poeiIds.has(i.poei_id)) continue
    interIds.add(i.id)
    union('p:' + i.poei_id, 'i:' + i.id)
  }
  for (const s of liens) {
    if (s.poei_intervention_id && interIds.has(s.poei_intervention_id)) union('i:' + s.poei_intervention_id, 's:' + s.id)
  }
  const composantes = new Map<string, string[]>()
  for (const k of Array.from(parent.keys())) {
    const r = find(k)
    const l = composantes.get(r)
    if (l) l.push(k); else composantes.set(r, [k])
  }
  return { racine: (noeud) => (parent.has(noeud) ? find(noeud) : null), composantes }
}

export function construireUnites(d: DonneesRentabilite): Unite[] {
  const { composantes } = composantesPoei(d.poei, d.interventions, d.sessions)
  const unites: Unite[] = []
  const dansPoei = new Set<string>()
  for (const noeuds of Array.from(composantes.values())) {
    const poeiIds = noeuds.filter((x) => x.startsWith('p:')).map((x) => x.slice(2))
    if (!poeiIds.length) continue
    const sessionIds = noeuds.filter((x) => x.startsWith('s:')).map((x) => x.slice(2)).filter((id) => d.idx.sessionParId.has(id))
    const interventionIds = noeuds.filter((x) => x.startsWith('i:')).map((x) => x.slice(2))
    sessionIds.forEach((id) => dansPoei.add(id))
    const poeis = poeiIds.map((id) => d.idx.poeiParId.get(id)!).sort((a, b) => String(a.numero || '').localeCompare(String(b.numero || '')))
    const sessions = sessionIds.map((id) => d.idx.sessionParId.get(id)!).sort((a, b) => String(a.date_debut || '').localeCompare(String(b.date_debut || '')))
    const porteuseIds = uniques(poeis.map((p) => p.session_id).filter((id): id is string => !!id && sessionIds.includes(id)))
    const dates = [...sessions.map((s) => s.date_debut), ...poeis.map((p) => p.date_debut)].filter((x): x is string => !!x).sort()
    unites.push({
      id: 'poei:' + poeis.map((p) => p.id).join('+'),
      type: 'poei',
      sessionIds: sessions.map((s) => s.id),
      porteuseIds,
      poeiIds: poeis.map((p) => p.id),
      interventionIds,
      date: dates[0] || null,
    })
  }
  for (const s of d.sessions) {
    if (dansPoei.has(s.id)) continue
    unites.push({ id: 'session:' + s.id, type: 'session', sessionIds: [s.id], porteuseIds: [], poeiIds: [], interventionIds: [], date: s.date_debut })
  }
  return unites
}

// ─── Contexte d'une unité ───────────────────────────────────────────────────

interface Ctx {
  u: Unite
  d: DonneesRentabilite
  sessions: SessionRentab[]
  poei: PoeiRentab[]
  interventions: InterventionRentab[]
  alertes: Alerte[]
  manques: string[]
}

function contexte(u: Unite, d: DonneesRentabilite): Ctx {
  return {
    u, d,
    sessions: u.sessionIds.map((id) => d.idx.sessionParId.get(id)).filter((s): s is SessionRentab => !!s),
    poei: u.poeiIds.map((id) => d.idx.poeiParId.get(id)).filter((p): p is PoeiRentab => !!p),
    interventions: u.interventionIds.map((id) => d.idx.interventionParId.get(id)).filter((i): i is InterventionRentab => !!i),
    alertes: [],
    manques: [],
  }
}

function alerter(ctx: { alertes: Alerte[] }, code: string, niveau: Alerte['niveau'], message: string) {
  if (!ctx.alertes.some((a) => a.code === code && a.message === message)) ctx.alertes.push({ code, niveau, message })
}
function manque(ctx: { manques: string[] }, texte: string) {
  if (!ctx.manques.includes(texte)) ctx.manques.push(texte)
}

// ─── 2.1 Recettes ───────────────────────────────────────────────────────────

const BASE_SOURCE_LABELS: Record<string, string> = {
  poei_factures: 'factures France Travail du parcours',
  poei_montant: 'montant du parcours',
  agefice: 'coût pédagogique AGEFICE',
  prix_ht: 'prix de la session',
  financement: 'prise en charge OPCO',
  conventions: 'conventions',
  brouillons: 'factures en brouillon',
  aucune: 'aucune',
}

export function libelleBaseSource(source: string): string {
  return BASE_SOURCE_LABELS[source] || source
}

export interface ResultatRecettes {
  recette: Rentabilite['recette']
  lignes: LigneRentab[]
  alertes: Alerte[]
  manques: string[]
  incomplete: boolean
  estAgefice: boolean
}

export function recettesUnite(u: Unite, d: DonneesRentabilite): ResultatRecettes {
  const ctx = contexte(u, d)
  const EMIS = new Set<string>(STATUTS_FACTURE_EMISE)
  const lignes: LigneRentab[] = []
  const multi = ctx.sessions.length > 1
  let facture = 0
  let brouillons = 0
  let nbBrouillons = 0
  let encaisseCrm = 0
  let retenuCrm = 0
  let encaisseDendreoJustifie = 0
  let encaissementNonSuivi = 0

  const ligneFacture = (p: PartFacture, qualite: Qualite, qualiteLabel: string, detailSup: string | null, horsTotal: boolean, sid: string | null) => {
    const f = p.facture
    lignes.push({
      cle: `f:${f.id}:${sid || p.poeiId || ''}`,
      famille: 'recette',
      libelle: `Facture ${f.numero || 'sans numéro'}`,
      detail: [f.financeur_nom, detailSup, f.date_emission ? `du ${dateFr(f.date_emission)}` : null, multi && sid ? refSession(d.idx.sessionParId.get(sid)!) : null]
        .filter(Boolean).join(' · ') || undefined,
      montant: p.montant,
      qualite,
      qualiteLabel,
      sessionId: sid || undefined,
      lien: { href: `/api/pdf/facture/${f.id}`, label: `Ouvrir la facture ${f.numero || ''}`.trim() },
      horsTotal: horsTotal || undefined,
    })
  }
  const ratio = (p: PartFacture) => {
    const ht = n(p.facture.montant_ht)
    return ht > 0 ? p.montant / ht : 0
  }

  // Sessions : part Dendreo, puis factures du CRM
  for (const s of ctx.sessions) {
    const D = round2(n(s.deja_facture_ailleurs))
    let justif = 0
    const crmEnPlus: string[] = []
    if (D > 0) {
      facture += D
      lignes.push({
        cle: `dendreo:${s.id}`,
        famille: 'recette',
        libelle: 'Facturé dans Dendreo',
        detail: [s.dendreo_id != null ? `Repris de Dendreo (action ${s.dendreo_id})` : 'Repris de Dendreo', multi ? refSession(s) : null].filter(Boolean).join(' · '),
        montant: D,
        qualite: 'facture',
        sessionId: s.id,
      })
    }
    const dossierSession = normaliserDossier(s.numero_dossier_opco)
    for (const p of d.idx.parts.parSession.get(s.id) || []) {
      const f = p.facture
      if (f.status === 'annulee') continue
      const dossierFacture = normaliserDossier(f.numero_prise_en_charge)
      if (dossierSession && dossierFacture && dossierFacture !== dossierSession) {
        alerter(ctx, 'A2', 'attention', `La facture ${f.numero || 'sans numéro'} porte le dossier ${f.numero_prise_en_charge}, la session le dossier ${s.numero_dossier_opco} : elle est peut-être rattachée à la mauvaise session.`)
      }
      if (D > 0 && (estDendreo(f) || estReconstituee(f))) {
        // Déjà contenue dans le montant Dendreo : elle justifie l'encaissement, sans s'ajouter au facturé
        justif += n(f.montant_paye) * ratio(p)
        ligneFacture(p, 'facture', 'Incluse', 'déjà comprise dans le montant Dendreo', true, s.id)
        continue
      }
      if (EMIS.has(String(f.status))) {
        facture += p.montant
        retenuCrm += p.montant
        encaisseCrm += n(f.montant_paye) * ratio(p)
        if (D > 0) crmEnPlus.push(f.numero || 'sans numéro')
        ligneFacture(p, 'facture', STATUT_FACTURE_LABELS[String(f.status)] || 'Émise', null, false, s.id)
      } else if (f.status === 'brouillon') {
        brouillons += p.montant
        nbBrouillons++
        ligneFacture(p, 'prevu', 'Brouillon', 'non comptée tant qu\'elle n\'est pas émise', true, s.id)
      }
    }
    if (D > 0) {
      const j = Math.min(D, round2(justif))
      encaisseDendreoJustifie += j
      encaissementNonSuivi += round2(D - j)
    }
    if (crmEnPlus.length) {
      alerter(ctx, 'A1', 'critique', `Facture(s) ${crmEnPlus.join(', ')} en plus des ${euro(D)} déjà facturés dans Dendreo : vérifiez qu'il ne s'agit pas d'un doublon.`)
    }
  }

  // Parcours POEI : factures France Travail (marqueur), jamais Dendreo
  let facturesPoeiNonAnnulees = 0
  let facturesPoeiBrouillon = 0
  for (const P of ctx.poei) {
    for (const p of d.idx.parts.parPoei.get(P.id) || []) {
      const f = p.facture
      if (f.status === 'annulee') continue
      facturesPoeiNonAnnulees++
      if (EMIS.has(String(f.status))) {
        facture += p.montant
        retenuCrm += p.montant
        encaisseCrm += n(f.montant_paye) * ratio(p)
        ligneFacture(p, 'facture', STATUT_FACTURE_LABELS[String(f.status)] || 'Émise', P.numero, false, null)
      } else if (f.status === 'brouillon') {
        brouillons += p.montant
        nbBrouillons++
        facturesPoeiBrouillon++
        ligneFacture(p, 'prevu', 'Brouillon', P.numero, true, null)
      }
    }
  }

  facture = round2(facture)
  brouillons = round2(brouillons)
  encaisseCrm = round2(encaisseCrm)

  // Base attendue : première source non nulle
  let base: number | null = null
  let baseSource = 'aucune'
  let baseDetail: string | null = null
  let incomplete = false
  const baseLiens: { href: string; label: string }[] = []

  if (u.type === 'poei') {
    let somme = 0
    const sources: string[] = []
    for (const P of ctx.poei) {
      const sf = round2((d.idx.parts.parPoei.get(P.id) || []).filter((p) => p.facture.status !== 'annulee').reduce((a, p) => a + p.montant, 0))
      baseLiens.push({ href: `/dashboard/poei/${P.id}`, label: `Parcours ${P.numero || ''}`.trim() })
      if (sf > 0) { somme += sf; sources.push('poei_factures') }
      else if (positif(P.montant_total)) { somme += n(P.montant_total); sources.push('poei_montant') }
      else manque(ctx, `Montant du parcours ${P.numero || ''}`.trim())
    }
    if (somme > 0) {
      base = round2(somme)
      baseSource = sources.includes('poei_factures') ? 'poei_factures' : 'poei_montant'
      if (sources.length < ctx.poei.length) incomplete = true
    }
  }

  const dossiersAgefice = ctx.sessions.flatMap((s) => d.idx.ageficeParSession.get(s.id) || []).filter((a) => a.statut !== 'refuse')
  const estAgefice = dossiersAgefice.length > 0
  if (base == null && estAgefice) {
    const somme = round2(dossiersAgefice.reduce((a, x) => {
      const v = x.cout_pedagogique != null ? x.cout_pedagogique : x.montant_accorde != null ? x.montant_accorde : x.montant_demande
      return a + n(v)
    }, 0))
    if (somme > 0) {
      base = somme
      baseSource = 'agefice'
      baseDetail = `${dossiersAgefice.length} dossier${dossiersAgefice.length > 1 ? 's' : ''} AGEFICE`
      baseLiens.push({ href: '/dashboard/agefice', label: 'Dossiers AGEFICE' })
    }
  }

  if (base == null) {
    let somme = 0
    const sources = new Set<string>()
    const detail: string[] = []
    for (const s of ctx.sessions) {
      const pec = positif(s.montant_finance_opco)
      const prix = positif(s.prix_ht)
      const conventions = (d.idx.conventionsParSession.get(s.id) || [])
        .filter((c) => !['brouillon', 'annulee'].includes(String(c.status)))
      const montantConv = (c: ConventionRentab) => n(c.montant_ht != null ? c.montant_ht : c.montant_ttc)
      if (pec || prix) {
        const principal = Math.max(pec || 0, prix || 0)
        somme += principal
        sources.add((pec || 0) >= (prix || 0) ? 'financement' : 'prix_ht')
        // Inter : le prix de la session vaut pour son entreprise, les conventions des autres s'ajoutent
        const autres = s.client_id ? conventions.filter((c) => c.client_id && c.client_id !== s.client_id) : []
        const sa = round2(autres.reduce((a, c) => a + montantConv(c), 0))
        if (sa > 0) {
          somme += sa
          detail.push(`dont ${euro(sa)} de conventions d'autres entreprises`)
          autres.forEach((c) => baseLiens.push({ href: `/dashboard/conventions/${c.id}`, label: `Convention ${c.numero || ''}`.trim() }))
        }
      } else {
        const sc = round2(conventions.reduce((a, c) => a + montantConv(c), 0))
        if (sc > 0) {
          somme += sc
          sources.add('conventions')
          conventions.forEach((c) => baseLiens.push({ href: `/dashboard/conventions/${c.id}`, label: `Convention ${c.numero || ''}`.trim() }))
        }
      }
    }
    if (somme > 0) {
      base = round2(somme)
      baseSource = sources.has('financement') ? 'financement' : sources.has('prix_ht') ? 'prix_ht' : 'conventions'
      baseDetail = detail.join(' · ') || null
    } else if (brouillons > 0) {
      base = brouillons
      baseSource = 'brouillons'
    }
  }

  const prevu: number | null = base != null ? round2(Math.max(facture, base)) : facture > 0 ? facture : null
  const aFacturer = prevu != null ? round2(Math.max(0, prevu - facture)) : 0

  // Indication catalogue : jamais comptée, seulement quand rien n'est connu
  let indicationCatalogue: number | null = null
  const principale = ctx.sessions.find((s) => ctx.u.porteuseIds.includes(s.id)) || ctx.sessions[0]
  if (prevu == null && principale) {
    const intra = principale.type_session === 'intra'
    const tIntra = positif(principale.formation?.tarif_intra_ht)
    const tInter = positif(principale.formation?.tarif_inter_ht)
    const nb = inscritsActifs(d, principale.id).length
    if (intra && tIntra) indicationCatalogue = tIntra
    else if (tInter && nb > 0) indicationCatalogue = round2(tInter * nb)
  }

  // Lignes de synthèse
  if (base != null) {
    lignes.push({
      cle: 'base',
      famille: 'recette',
      libelle: 'Montant attendu',
      detail: [libelleBaseSource(baseSource).replace(/^./, (c) => c.toUpperCase()), baseDetail].filter(Boolean).join(' · '),
      montant: base,
      qualite: baseSource === 'brouillons' ? 'prevu' : ['prix_ht', 'financement'].includes(baseSource) ? 'saisi' : 'contractualise',
      qualiteLabel: 'Référence',
      horsTotal: true,
      lien: baseLiens[0],
      liens: baseLiens.length > 1 ? baseLiens : undefined,
    })
  }
  if (prevu != null && aFacturer > 0.005) {
    lignes.push({ cle: 'a_facturer', famille: 'recette', libelle: 'Reste à facturer', detail: `Écart entre le montant attendu et le facturé`, montant: aFacturer, qualite: 'prevu' })
  }
  if (prevu == null) {
    const lienRenseigner = u.type === 'poei' && ctx.poei[0]
      ? { href: `/dashboard/poei/${ctx.poei[0].id}`, label: 'Renseigner le montant du parcours' }
      : principale ? { href: `/dashboard/sessions/${principale.id}?tab=session`, label: 'Renseigner le prix' } : undefined
    lignes.push({
      cle: 'ca_inconnu',
      famille: 'recette',
      libelle: 'CA non renseigné',
      detail: indicationCatalogue != null
        ? `À titre indicatif, le tarif catalogue donnerait environ ${euro(indicationCatalogue)} (non retenu)`
        : 'Aucun prix, aucune prise en charge ni facture',
      montant: null,
      qualite: 'inconnu',
      lien: lienRenseigner,
    })
    manque(ctx, 'Chiffre d\'affaires')
  }

  // Alertes de facturation
  for (const s of ctx.sessions) {
    const pec = positif(s.montant_finance_opco)
    const prix = positif(s.prix_ht)
    if (u.type === 'session' && prix && pec && prix > pec + TOLERANCE && prevu != null && facture < prevu - TOLERANCE) {
      alerter(ctx, 'A4', 'info', `Reste à charge entreprise de ${euro(round2(prix - pec))} : aucune facture ne le couvre encore.`)
    }
    if (prix) {
      for (const c of d.idx.conventionsParSession.get(s.id) || []) {
        if (!String(c.status || '').startsWith('signee')) continue
        if (s.client_id && c.client_id && c.client_id !== s.client_id) continue
        const mc = n(c.montant_ht != null ? c.montant_ht : c.montant_ttc)
        if (mc > 0 && Math.abs(mc - prix) > TOLERANCE) {
          alerter(ctx, 'A7', 'attention', `Convention ${c.numero || ''} signée à ${euro(mc)}, prix de la session ${euro(prix)} : le prix de la session est retenu.`)
        }
      }
    }
    // A3 : même accord OPCO sur une autre session
    const dossier = normaliserDossier(s.numero_dossier_opco)
    if (dossier) {
      const autres = (d.idx.voisinsParDossier.get(dossier) || [])
        .filter((v) => v.id !== s.id && !u.sessionIds.includes(v.id) && v.status !== 'annulee')
      if (autres.length) {
        alerter(ctx, 'A3', 'attention', `Le dossier OPCO ${s.numero_dossier_opco} figure aussi sur ${autres.map(refSession).join(', ')} : risque de facturer deux fois le même accord.`)
      }
    }
    // A19 : combo du même jour, dont une seule porte le financement
    if (u.type === 'session' && s.client_id && s.date_debut) {
      const aBase = (x: { prix_ht: Num; montant_finance_opco: Num; deja_facture_ailleurs: Num }) =>
        n(x.prix_ht) > 0 || n(x.montant_finance_opco) > 0 || n(x.deja_facture_ailleurs) > 0
      const autres = (d.idx.voisinsParJour.get(`${s.client_id}|${s.date_debut}`) || [])
        .filter((v) => v.id !== s.id && v.status !== 'annulee' && aBase(v) !== aBase(s))
      if (autres.length) {
        alerter(ctx, 'A19', 'info', `Session du même jour pour ${libelleClient(s.client) || 'ce client'} (${autres.map(refSession).join(', ')}) : le financement peut être porté par une seule des deux, lisez leurs marges ensemble.`)
      }
    }
  }
  const toutesTerminees = ctx.sessions.length > 0 && ctx.sessions.every((s) => s.status === 'terminee')
  if (toutesTerminees && facture > 0 && base != null && base > facture + TOLERANCE && baseSource !== 'brouillons') {
    alerter(ctx, 'A5', 'attention', `Facturé ${euro(facture)} pour ${euro(base)} attendus : ${euro(round2(base - facture))} restent à facturer ou ont été refusés.`)
  }
  const a24 = u.type === 'poei' && facturesPoeiNonAnnulees > 0 && facturesPoeiBrouillon === facturesPoeiNonAnnulees
  if (a24) {
    alerter(ctx, 'A24', 'info', 'Factures France Travail en brouillon : recette prévisionnelle, au montant du parcours.')
  } else if (brouillons > 0) {
    alerter(ctx, 'A6', 'info', `${nbBrouillons} facture${nbBrouillons > 1 ? 's' : ''} en brouillon (${euro(brouillons)}) : ${nbBrouillons > 1 ? 'elles ne comptent' : 'elle ne compte'} pas dans le facturé tant qu'${nbBrouillons > 1 ? 'elles ne sont pas émises' : 'elle n\'est pas émise'}.`)
  }
  if (encaissementNonSuivi > 0.5) {
    alerter(ctx, 'A18', 'info', `Encaissement des ${euro(round2(encaissementNonSuivi))} facturés dans Dendreo non suivi dans le CRM.`)
  }
  if (baseSource === 'agefice' && base != null && facture > base + TOLERANCE) {
    alerter(ctx, 'A23', 'attention', `Facturé ${euro(facture)} pour ${euro(base)} de coût pédagogique AGEFICE : vérifiez qu'une facture n'a pas été générée deux fois.`)
  }

  const encaisse = round2(encaisseCrm + encaisseDendreoJustifie)
  return {
    recette: {
      facture,
      brouillons,
      base,
      baseSource,
      prevu,
      aFacturer,
      encaisse,
      encaisseDendreoJustifie: round2(encaisseDendreoJustifie),
      encaissementNonSuivi: round2(encaissementNonSuivi),
      resteDu: round2(Math.max(0, retenuCrm - encaisseCrm)),
      indicationCatalogue,
    },
    lignes,
    alertes: ctx.alertes,
    manques: ctx.manques,
    incomplete,
    estAgefice,
  }
}

// ─── 2.2 Coût formateur ─────────────────────────────────────────────────────

export interface PosteFormateur {
  cle: string
  ancre: string
  formateurId: string | null
  montant: number | null
  qualite: Qualite
  ligne: LigneRentab
}

const CONTRAT_SIGNE = ['signe_formateur', 'signe_complete']
const CONTRAT_STATUT_LABELS: Record<string, string> = {
  brouillon: 'brouillon', envoye: 'envoyé', signe_formateur: 'signé', signe_complete: 'signé', annule: 'annulé',
}

export function postesFormateur(u: Unite, d: DonneesRentabilite): { postes: PosteFormateur[]; alertes: Alerte[]; manques: string[] } {
  const ctx = contexte(u, d)
  const estPoei = u.type === 'poei'
  const interIds = new Set(ctx.interventions.map((i) => i.id))
  const sessionIds = new Set(u.sessionIds)
  const ancreDeSession = (s: SessionRentab) =>
    s.poei_intervention_id && interIds.has(s.poei_intervention_id) ? 'i:' + s.poei_intervention_id : 's:' + s.id

  interface Brouillon {
    ancre: string
    formateurId: string | null
    contrats: ContratRentab[]
    factures: FactureFormateurRentab[]
  }
  const postes = new Map<string, Brouillon>()
  const poste = (ancre: string, formateurId: string | null): Brouillon => {
    const cle = `${ancre}|${formateurId || ''}`
    let p = postes.get(cle)
    if (!p) { p = { ancre, formateurId, contrats: [], factures: [] }; postes.set(cle, p) }
    return p
  }

  // Contrats non annulés, par session ou par intervention de l'unité
  const contrats = new Map<string, ContratRentab>()
  for (const s of ctx.sessions) for (const c of d.idx.contratsParSession.get(s.id) || []) contrats.set(c.id, c)
  for (const i of ctx.interventions) for (const c of d.idx.contratsParIntervention.get(i.id) || []) contrats.set(c.id, c)
  for (const c of Array.from(contrats.values())) {
    if (c.status === 'annule') continue
    let ancre: string
    if (c.poei_intervention_id && interIds.has(c.poei_intervention_id)) ancre = 'i:' + c.poei_intervention_id
    else if (c.session_id && sessionIds.has(c.session_id)) ancre = ancreDeSession(d.idx.sessionParId.get(c.session_id)!)
    else continue
    poste(ancre, c.formateur_id).contrats.push(c)
  }
  // Factures formateur reçues
  for (const s of ctx.sessions) {
    for (const f of d.idx.ffParSession.get(s.id) || []) {
      if (['brouillon', 'rejetee'].includes(String(f.status))) continue
      poste(ancreDeSession(s), f.formateur_id).factures.push(f)
    }
  }
  // Formateur principal de chaque session, formateur de chaque intervention
  for (const s of ctx.sessions) if (s.formateur_id) poste(ancreDeSession(s), s.formateur_id)
  for (const i of ctx.interventions) if (i.formateur_id) poste('i:' + i.id, i.formateur_id)
  // Rémunération saisie sans formateur désigné : le coût existe quand même
  const ancresOccupees = () => new Set(Array.from(postes.values()).map((p) => p.ancre))
  for (const s of ctx.sessions) {
    if (!s.formateur_id && positif(s.cout_formateur) && !ancresOccupees().has(ancreDeSession(s))) poste(ancreDeSession(s), null)
  }
  for (const i of ctx.interventions) {
    if (!i.formateur_id && positif(i.montant_ht) && !ancresOccupees().has('i:' + i.id)) poste('i:' + i.id, null)
  }

  const nbParAncre = new Map<string, number>()
  for (const p of Array.from(postes.values())) nbParAncre.set(p.ancre, (nbParAncre.get(p.ancre) || 0) + 1)

  const resultat: PosteFormateur[] = []
  for (const [cle, p] of Array.from(postes.entries())) {
    const formateur = p.formateurId ? d.idx.formateurParId.get(p.formateurId) : undefined
    const nom = nomFormateur(formateur) || 'Formateur non renseigné'
    const tvaPct = d.tvaFormateurDisponible ? n(formateur?.taux_tva) : 0
    const tva = tvaPct / 100
    const intervention = p.ancre.startsWith('i:') ? d.idx.interventionParId.get(p.ancre.slice(2)) : undefined
    const sessionsAncre = p.ancre.startsWith('s:')
      ? [d.idx.sessionParId.get(p.ancre.slice(2))!].filter(Boolean)
      : ctx.sessions.filter((s) => s.poei_intervention_id === p.ancre.slice(2))
    const sessionLien = sessionsAncre[0]
    const liens: { href: string; label: string }[] = []
    let montant: number | null = null
    let qualite: Qualite = 'inconnu'
    let qualiteLabel: string | undefined
    let source = 'Coût non renseigné'

    // 1. Factures reçues et contrat
    const sigmaF = round2(p.factures.reduce((a, f) => a + n(f.montant_ttc), 0))
    const avecMontant = p.contrats.filter((c) => n(c.montant_ht) > 0)
    for (const c of p.contrats.filter((c) => !(n(c.montant_ht) > 0))) {
      alerter(ctx, 'A9', 'attention', `Le contrat ${c.numero || 'sans numéro'} n'a pas de montant.`)
    }
    const montantsDistincts = uniques(avecMontant.map((c) => round2(n(c.montant_ht))))
    let contratRetenu: ContratRentab | null = null
    let C = 0
    if (montantsDistincts.length) {
      const max = Math.max(...montantsDistincts)
      const candidats = avecMontant.filter((c) => round2(n(c.montant_ht)) === max)
      contratRetenu = candidats.find((c) => CONTRAT_SIGNE.includes(String(c.status))) || candidats[0]
      C = round2(max * (1 + tva))
      if (montantsDistincts.length > 1) {
        alerter(ctx, 'A8', 'attention', `Plusieurs contrats actifs pour ${nom} (${avecMontant.map((c) => `${c.numero || 'sans numéro'} : ${euro(n(c.montant_ht))}`).join(', ')}) : le plus élevé est retenu.`)
      }
    }
    p.factures.forEach((f) => liens.push({ href: (f.fichier_url && d.urlsFacturesFormateur?.[f.fichier_url]) || `/api/pdf/facture-formateur/${f.id}`, label: `Facture ${f.numero || ''}`.trim() }))
    if (contratRetenu && contratRetenu.formateur_id) {
      liens.push({ href: `/api/pdf/contrat-formateur/${contratRetenu.formateur_id}?contrat=${contratRetenu.id}`, label: `Contrat ${contratRetenu.numero || ''}`.trim() })
    }

    if (sigmaF > 0 || C > 0) {
      montant = round2(Math.max(sigmaF, C))
      const morceaux: string[] = []
      if (sigmaF > 0) morceaux.push(`Facture ${p.factures.map((f) => f.numero || 'sans numéro').join(', ')}`)
      if (contratRetenu) morceaux.push(`${sigmaF > 0 ? 'contrat' : 'Contrat'} ${contratRetenu.numero || ''} (${CONTRAT_STATUT_LABELS[String(contratRetenu.status)] || contratRetenu.status})`.replace(/\s+/g, ' '))
      source = morceaux.join(' · ')
      if (sigmaF >= C && sigmaF > 0) {
        qualite = 'facture'
        const payee = p.factures.some((f) => f.status === 'payee')
        const validee = p.factures.some((f) => f.status === 'validee')
        qualiteLabel = payee ? 'Facture payée' : validee ? 'Facture validée' : 'Facture reçue'
      } else if (contratRetenu && CONTRAT_SIGNE.includes(String(contratRetenu.status))) {
        qualite = 'contractualise'
      } else {
        qualite = 'prevu'
      }
      if (sigmaF > 0 && C > 0 && Math.abs(sigmaF - C) > TOLERANCE) {
        alerter(ctx, 'A11', 'info', `Facturé par le formateur : ${euro(sigmaF)}, contrat : ${euro(C)}. Le plus élevé est retenu.`)
      }
      if (contratRetenu) {
        for (const s of sessionsAncre) {
          const cf = positif(s.cout_formateur)
          if (cf && (s.formateur_id === p.formateurId || !s.formateur_id) && Math.abs(cf - n(contratRetenu.montant_ht)) > TOLERANCE) {
            alerter(ctx, 'A10', 'info', `Contrat ${contratRetenu.numero || ''} : ${euro(n(contratRetenu.montant_ht))}, rémunération saisie : ${euro(cf)}. Le contrat est retenu.`)
          }
        }
      }
    } else {
      // 2. Rémunération saisie sur la session
      const seulSurAncre = (nbParAncre.get(p.ancre) || 0) === 1
      const saisies = sessionsAncre.filter((s) => positif(s.cout_formateur) && (s.formateur_id === p.formateurId || (!s.formateur_id && (seulSurAncre || !p.formateurId))))
      const cf = round2(saisies.reduce((a, s) => a + n(s.cout_formateur), 0))
      if (cf > 0) {
        montant = round2(cf * (1 + tva))
        qualite = 'saisi'
        source = 'Rémunération saisie sur la session'
      } else if (intervention && positif(intervention.montant_ht)) {
        // 3. Rémunération prévue de l'intervention POEI
        montant = round2(n(intervention.montant_ht) * (1 + tva))
        qualite = 'prevu'
        source = 'Rémunération prévue de l\'intervention'
      } else if (!estPoei && p.ancre.startsWith('s:') && sessionsAncre[0]) {
        const s = sessionsAncre[0]
        const jours = nbJoursSession(s)
        const principal = s.formateur_id === p.formateurId || !s.formateur_id
        const manuel = positif(d.idx.commissionParSession.get(s.id)?.cout_formateur_manuel)
        const fiche = positif(formateur?.tarif_journalier)
        if (jours && principal && manuel) {
          // 4. Tarif journalier saisi sur la fiche franchise
          montant = round2(manuel * jours * (1 + tva))
          qualite = 'estime'
          source = `Tarif journalier saisi (fiche franchise) × ${jours} j`
        } else if (jours && fiche) {
          // 5. Tarif de la fiche formateur
          montant = round2(fiche * jours * (1 + tva))
          qualite = 'estime'
          source = `Tarif de la fiche formateur × ${jours} j`
        }
      }
    }

    if (montant == null) {
      manque(ctx, `Coût formateur de ${nom}`)
      const href = sessionLien ? `/dashboard/sessions/${sessionLien.id}?tab=session`
        : intervention ? `/dashboard/poei/${intervention.poei_id}` : undefined
      if (href) liens.unshift({ href, label: 'Renseigner la rémunération' })
    }
    if (estPoei && intervention && sessionLien) {
      liens.push({ href: `/dashboard/sessions/${sessionLien.id}?tab=facturation`, label: 'Session de l\'intervention' })
    }
    if (formateur?.type_contrat === 'salarie') {
      alerter(ctx, 'A12', 'info', `${nom} est déclaré salarié : le coût retenu est le montant de sa prestation, pas un salaire chargé.`)
    }

    const ligne: LigneRentab = {
      cle: `fmt:${cle}`,
      famille: 'formateur',
      libelle: nom,
      detail: [
        intervention ? (intervention.libelle || 'Intervention') : (estPoei && sessionLien ? refSession(sessionLien) : null),
        source,
        tvaPct > 0 && montant != null && !(qualite === 'facture') ? `TVA ${tvaPct.toLocaleString('fr-FR')} % incluse` : null,
      ].filter(Boolean).join(' · '),
      montant,
      qualite,
      qualiteLabel,
      sessionId: sessionLien?.id,
      ancre: p.ancre,
      lien: liens[0],
      liens: liens.length > 1 ? liens : undefined,
    }
    resultat.push({ cle, ancre: p.ancre, formateurId: p.formateurId, montant, qualite, ligne })
  }

  // Ordre stable : interventions dans l'ordre du parcours, puis sessions
  const ordre = (x: PosteFormateur) => {
    if (x.ancre.startsWith('i:')) return String(d.idx.interventionParId.get(x.ancre.slice(2))?.date_debut || '') + x.ancre
    return String(d.idx.sessionParId.get(x.ancre.slice(2))?.date_debut || '') + x.ancre
  }
  resultat.sort((a, b) => ordre(a).localeCompare(ordre(b)))
  return { postes: resultat, alertes: ctx.alertes, manques: ctx.manques }
}

// ─── 2.3 Frais annexes ──────────────────────────────────────────────────────

export function fraisUnite(u: Unite, d: DonneesRentabilite): { total: number; lignes: LigneRentab[] } {
  const ctx = contexte(u, d)
  const multi = ctx.sessions.length > 1
  const lignes: LigneRentab[] = []
  for (const s of ctx.sessions) {
    for (const f of d.idx.fraisParSession.get(s.id) || []) {
      lignes.push({
        cle: `frais:${f.id}`,
        famille: 'frais',
        libelle: f.libelle,
        detail: [
          libelleCategorieFrais(f.categorie),
          f.date_frais ? dateFr(f.date_frais) : null,
          f.formateur_id ? nomFormateur(d.idx.formateurParId.get(f.formateur_id)) : null,
          multi ? refSession(s) : null,
        ].filter(Boolean).join(' · '),
        montant: round2(n(f.montant)),
        qualite: 'saisi',
        qualiteLabel: 'Payé',
        sessionId: s.id,
        fraisId: f.id,
        justificatif: !!f.justificatif_path,
      })
    }
    // Champs de l'ancienne fiche session : la migration 149 les reprend puis les vide
    if (positif(s.cout_salle)) {
      lignes.push({ cle: `salle:${s.id}`, famille: 'frais', libelle: 'Salle (saisie sur la fiche session)', detail: multi ? refSession(s) : undefined, montant: round2(n(s.cout_salle)), qualite: 'saisi', sessionId: s.id })
    }
    if (positif(s.cout_materiel)) {
      lignes.push({ cle: `materiel:${s.id}`, famille: 'frais', libelle: 'Matériel (saisie sur la fiche session)', detail: multi ? refSession(s) : undefined, montant: round2(n(s.cout_materiel)), qualite: 'saisi', sessionId: s.id })
    }
  }
  return { total: round2(lignes.reduce((a, l) => a + (l.montant || 0), 0)), lignes }
}

// ─── 2.4 Commission franchise ───────────────────────────────────────────────

export interface ResultatCommissionFranchise {
  montant: number | null
  /** 'fige' (validée/payée), 'a_venir', 'absente' (pas de franchise, POEI, sans inscrit, annulée), 'inconnu' */
  etat: 'fige' | 'a_venir' | 'absente' | 'inconnu'
  lignes: LigneRentab[]
  alertes: Alerte[]
  manques: string[]
  ecartStocke: boolean
}

const MOTIFS_SANS_COMMISSION: Record<string, string> = {
  sans_franchise: 'Établissement sans franchise',
  poei: 'Session POEI : hors commission franchise',
  sans_inscrit: 'Aucun inscrit',
  franchise_introuvable: 'Franchise introuvable',
}

export function commissionFranchiseUnite(u: Unite, d: DonneesRentabilite): ResultatCommissionFranchise {
  const ctx = contexte(u, d)
  const lignes: LigneRentab[] = []
  const etats: ResultatCommissionFranchise['etat'][] = []
  let somme = 0
  let ecartStocke = false

  for (const s of ctx.sessions) {
    const existante = d.idx.commissionParSession.get(s.id) || null
    const franchiseId = s.client?.franchise_id || null
    const franchise = franchiseId ? d.idx.franchiseParId.get(franchiseId) || null : null
    const nbInscrits = inscritsActifs(d, s.id).length
    const jours = Math.max(1, (Array.isArray(s.horaires_jours) ? s.horaires_jours.length : 0) || n(s.formation?.duree_jours) || 1)
    const r = calculerCommissionSession({
      franchiseId,
      franchise,
      estPoei: u.type === 'poei' || !!s.poei_intervention_id || d.poei.some((p) => p.session_id === s.id),
      nbInscritsActifs: nbInscrits,
      sessionAnnulee: s.status === 'annulee',
      montantFinanceOpco: s.montant_finance_opco == null ? null : n(s.montant_finance_opco),
      prixHt: s.prix_ht == null ? null : n(s.prix_ht),
      totalFacturesSession: (d.idx.facturesParSessionDirect.get(s.id) || [])
        .filter((f) => !['brouillon', 'annulee'].includes(String(f.status)))
        .reduce((a, f) => a + n(f.montant_ht), 0),
      coutContratsHt: (d.idx.contratsParSession.get(s.id) || [])
        .filter((c) => c.status !== 'annule')
        .reduce((a, c) => a + n(c.montant_ht), 0),
      coutFormateurManuelJour: existante?.cout_formateur_manuel == null ? null : n(existante.cout_formateur_manuel),
      nbJours: jours,
      coutFormateurSession: s.cout_formateur == null ? null : n(s.cout_formateur),
      existante,
    })
    const nomFr = franchise?.nom || 'franchise'
    const lienFr = franchiseId ? { href: `/dashboard/franchises/${franchiseId}`, label: `Fiche ${nomFr}` } : undefined
    const suffixe = ctx.sessions.length > 1 ? ` · ${refSession(s)}` : ''

    // Une commission validée ou payée compte telle quelle, même si la session n'y est plus éligible
    const compterFigee = (snap: { montant: number; base: number; type: string; status: string }, motif: string | null) => {
      somme += snap.montant
      etats.push('fige')
      lignes.push({
        cle: `cf:${s.id}`,
        famille: 'commission_franchise',
        libelle: `Commission ${nomFr}`,
        detail: `${commissionTypeLabel(snap.type)} · base ${euro(snap.base)}${suffixe}`,
        montant: snap.montant,
        qualite: 'fige',
        qualiteLabel: snap.status === 'payee' ? 'Payée' : 'Validée',
        sessionId: s.id,
        lien: lienFr,
      })
      if (motif) {
        alerter(ctx, 'A15', 'attention', `Commission ${snap.status === 'payee' ? 'payée' : 'validée'} de ${euro(snap.montant)} alors que la session n'y est plus éligible (${motif.toLowerCase()}).`)
      }
    }

    if (r.kind === 'aucune') {
      if (r.figee) { compterFigee(r.figee, MOTIFS_SANS_COMMISSION[r.motif]); continue }
      etats.push('absente')
      // Un parcours POEI n'affiche qu'une mention, posée plus bas
      if (u.type === 'poei') continue
      lignes.push({ cle: `cf:${s.id}`, famille: 'commission_franchise', libelle: MOTIFS_SANS_COMMISSION[r.motif], montant: 0, qualite: 'saisi', info: true, sessionId: s.id, lien: r.motif === 'franchise_introuvable' ? undefined : lienFr })
      continue
    }
    if (r.fige) { compterFigee(r.resultat, null); continue }

    const res = r.resultat
    if (s.status === 'annulee' || existante?.status === 'annulee') {
      etats.push('absente')
      lignes.push({ cle: `cf:${s.id}`, famille: 'commission_franchise', libelle: `Commission ${nomFr}`, detail: `Annulée${suffixe}`, montant: 0, qualite: 'fige', qualiteLabel: 'Annulée', sessionId: s.id, lien: lienFr })
      continue
    }
    if (res.baseSource === 'aucune') {
      etats.push('inconnu')
      manque(ctx, 'Base de la commission franchise')
      lignes.push({ cle: `cf:${s.id}`, famille: 'commission_franchise', libelle: `Commission ${nomFr}`, detail: `Base à renseigner : ni prise en charge, ni prix, ni facture${suffixe}`, montant: null, qualite: 'inconnu', sessionId: s.id, lien: { href: `/dashboard/sessions/${s.id}?tab=session`, label: 'Renseigner le prix' } })
      continue
    }
    somme += res.montant
    etats.push('a_venir')
    lignes.push({
      cle: `cf:${s.id}`,
      famille: 'commission_franchise',
      libelle: `Commission ${nomFr}`,
      detail: `${commissionTypeLabel(res.type)} · base ${euro(res.base)}${res.type === 'budget_net' ? ` moins ${euro(res.coutFormateur)} de coût formateur` : ''}${suffixe}`,
      montant: res.montant,
      qualite: 'a_venir',
      sessionId: s.id,
      lien: lienFr,
    })
    if (res.type === 'budget_net' && res.coutFormateur <= 0) {
      alerter(ctx, 'A13', 'attention', 'Commission calculée sans coût formateur : elle baissera quand le coût sera saisi.')
    }
    if (!existante) {
      ecartStocke = true
      alerter(ctx, 'A14', 'info', `La fiche franchise n'affiche pas encore cette commission : le montant à jour est ${euro(res.montant)}.`)
    } else if (Math.abs(n(existante.commission_montant) - res.montant) > 0.01) {
      ecartStocke = true
      alerter(ctx, 'A14', 'info', `La fiche franchise affiche ${euro(n(existante.commission_montant))}${existante.calculee_at ? ` (calcul du ${dateFr(existante.calculee_at)})` : ''}, le montant à jour est ${euro(res.montant)}.`)
    }
    const clientsInscrits = uniques(inscritsActifs(d, s.id).map((i) => i.client_id).filter(Boolean))
    if (clientsInscrits.length >= 2) {
      alerter(ctx, 'A16', 'info', 'Session inter : la commission franchise porte sur toute la session.')
    }
  }

  if (u.type === 'poei') {
    lignes.push({ cle: 'cf:poei', famille: 'commission_franchise', libelle: MOTIFS_SANS_COMMISSION.poei, montant: 0, qualite: 'saisi', info: true })
  }
  const etat: ResultatCommissionFranchise['etat'] = etats.includes('inconnu') ? 'inconnu'
    : etats.includes('a_venir') ? 'a_venir' : etats.includes('fige') ? 'fige' : 'absente'
  return { montant: etat === 'inconnu' ? null : round2(somme), etat, lignes, alertes: ctx.alertes, manques: ctx.manques, ecartStocke }
}

// ─── 2.5 Commission apporteur ───────────────────────────────────────────────

export interface ResultatCommissionApporteur {
  montant: number | null
  existe: boolean
  lignes: LigneRentab[]
  alertes: Alerte[]
  manques: string[]
}

export function commissionApporteurUnite(u: Unite, d: DonneesRentabilite, prevu: number | null): ResultatCommissionApporteur {
  const ctx = contexte(u, d)
  const lignes: LigneRentab[] = []
  const clientId = u.type === 'poei'
    ? (ctx.poei.map((p) => p.client_id).find(Boolean) || ctx.sessions.map((s) => s.client_id).find(Boolean) || null)
    : ctx.sessions[0]?.client_id || null
  const apporteurId = clientId ? d.idx.clientParId.get(clientId)?.apporteur_id || null : null
  const apporteur = apporteurId ? d.idx.apporteurParId.get(apporteurId) : undefined
  if (!apporteur) {
    lignes.push({ cle: 'ca:aucun', famille: 'commission_apporteur', libelle: 'Aucun apporteur rattaché à l\'établissement', montant: 0, qualite: 'saisi', info: true })
    return { montant: 0, existe: false, lignes, alertes: ctx.alertes, manques: ctx.manques }
  }

  const lien = { href: `/dashboard/apporteurs/${apporteur.id}`, label: `Fiche ${nomApporteur(apporteur)}` }
  const date = u.date
  const dansContrat = apporteur.is_active !== false
    && (!apporteur.date_debut_contrat || !date || date >= apporteur.date_debut_contrat)
    && (!apporteur.date_fin_contrat || !date || date <= apporteur.date_fin_contrat)
  const franchiseId = ctx.sessions.map((s) => s.client?.franchise_id).find(Boolean)
  if (franchiseId) {
    alerter(ctx, 'A17', 'attention', 'Établissement rattaché à une franchise et à un apporteur : les deux commissions sont comptées.')
  }
  if (!dansContrat) {
    lignes.push({ cle: 'ca:hors', famille: 'commission_apporteur', libelle: `Commission ${nomApporteur(apporteur)}`, detail: 'Contrat inactif à cette date', montant: 0, qualite: 'saisi', lien })
    return { montant: 0, existe: true, lignes, alertes: ctx.alertes, manques: ctx.manques }
  }

  let montant: number | null = null
  let detail: string
  if (apporteur.mode_calcul === 'fixe') {
    const fixe = positif(apporteur.commission_fixe)
    montant = fixe != null ? round2(fixe) : null
    detail = fixe != null ? 'Montant fixe par session' : 'Montant à renseigner sur la fiche apporteur'
  } else {
    // Un taux vide n'est pas un taux de 0 % : sans lui, la commission reste inconnue.
    const taux = positif(apporteur.taux_commission)
    montant = taux != null && prevu != null ? round2((taux / 100) * prevu) : null
    detail = taux == null
      ? 'Taux à renseigner sur la fiche apporteur'
      : prevu != null ? `${taux.toLocaleString('fr-FR')} % du chiffre d'affaires retenu` : `${taux.toLocaleString('fr-FR')} % d'un chiffre d'affaires encore inconnu`
  }
  if (montant == null) manque(ctx, 'Montant de la commission apporteur')
  lignes.push({
    cle: 'ca:' + apporteur.id,
    famille: 'commission_apporteur',
    libelle: `Commission ${nomApporteur(apporteur)}`,
    detail: `${detail} · TVA éventuelle de l'apporteur non incluse`,
    montant,
    qualite: montant == null ? 'inconnu' : 'estime',
    lien,
  })
  return { montant, existe: true, lignes, alertes: ctx.alertes, manques: ctx.manques }
}

// ─── 2.6 Marge ──────────────────────────────────────────────────────────────

export function statutMarge(p: { sansObjet: boolean; complet: boolean; marge: number | null; prevu: number | null }): StatutMarge {
  if (p.sansObjet) return 'sans_objet'
  if (!p.complet || p.marge == null || p.prevu == null || p.prevu <= 0) return 'incomplete'
  if (p.marge < -0.005) return 'deficitaire'
  // Comparaison au dixième de point, sur des montants arrondis au centime
  const taux = Math.round((round2(p.marge) / round2(p.prevu)) * 1000) / 1000
  return taux < SEUIL_MARGE_FAIBLE ? 'marge_faible' : 'rentable'
}

export function calculerRentabilite(u: Unite, d: DonneesRentabilite): Rentabilite {
  const ctx = contexte(u, d)
  const rec = recettesUnite(u, d)
  const form = postesFormateur(u, d)
  const frais = fraisUnite(u, d)
  const cf = commissionFranchiseUnite(u, d)
  const ca = commissionApporteurUnite(u, d, rec.recette.prevu)

  const principale = ctx.sessions.find((s) => u.porteuseIds.includes(s.id)) || ctx.sessions[0]
  const toutesAnnulees = ctx.sessions.length > 0 && ctx.sessions.every((s) => s.status === 'annulee')
  const aucunInscrit = ctx.sessions.every((s) => inscritsActifs(d, s.id).length === 0)
  // Un coût estimé d'après le tarif de la fiche n'est pas un coût engagé
  const coutsEngages = form.postes.filter((p) => p.montant != null && p.qualite !== 'estime').reduce((a, p) => a + (p.montant || 0), 0)
    + frais.total + (cf.montant || 0) + (ca.montant || 0)
  const sansObjet = (toutesAnnulees || aucunInscrit) && rec.recette.facture <= 0 && rec.recette.base == null && coutsEngages <= 0

  const postes = [...form.postes]
  if (!postes.length && !sansObjet) {
    const lien = principale
      ? { href: `/dashboard/sessions/${principale.id}?tab=session`, label: 'Affecter un formateur' }
      : ctx.poei[0] ? { href: `/dashboard/poei/${ctx.poei[0].id}`, label: 'Affecter un formateur' } : undefined
    postes.push({
      cle: 'aucun', ancre: principale ? 's:' + principale.id : '', formateurId: null, montant: null, qualite: 'inconnu',
      ligne: { cle: 'fmt:aucun', famille: 'formateur', libelle: 'Aucun formateur affecté', montant: null, qualite: 'inconnu', lien, sessionId: principale?.id },
    })
    manque(ctx, 'Formateur à affecter')
  }

  const coutFormateur = round2(postes.reduce((a, p) => a + (p.montant || 0), 0))
  const formateurInconnu = postes.some((p) => p.montant == null)
  const total = round2(coutFormateur + frais.total + (cf.montant || 0) + (ca.montant || 0))
  const prevu = rec.recette.prevu
  const complet = prevu != null && !formateurInconnu && cf.montant != null && ca.montant != null && !rec.incomplete
  const marge = complet ? round2(prevu! - total) : null
  const margePartielle = round2((prevu ?? rec.recette.facture) - total)
  const taux = marge != null && prevu != null && prevu > 0 ? round2(marge) / round2(prevu) : null
  const statut = statutMarge({ sansObjet, complet, marge, prevu })

  const toutesTerminees = ctx.sessions.length > 0 && ctx.sessions.every((s) => s.status === 'terminee')
  const postesSolides = postes.every((p) => ['facture', 'contractualise', 'saisi'].includes(p.qualite))
  const qualiteMarge: QualiteMarge =
    toutesTerminees && rec.recette.aFacturer < 0.005 && postesSolides && (cf.etat === 'fige' || cf.etat === 'absente') && !ca.existe
      ? 'realisee'
      : postes.some((p) => p.qualite === 'estime') || (ca.existe && (ca.montant || 0) > 0) ? 'estimee' : 'previsionnelle'

  // Alertes transverses
  const alertes: Alerte[] = []
  for (const a of [...rec.alertes, ...form.alertes, ...cf.alertes, ...ca.alertes]) {
    if (!alertes.some((x) => x.code === a.code && x.message === a.message)) alertes.push(a)
  }
  if (u.type === 'session' && principale?.formation?.is_poei) {
    alerter({ alertes }, 'A20', 'info', 'Formation POEI sans parcours rattaché : marge calculée comme une session classique.')
  }
  if (!d.fraisDisponibles) alerter({ alertes }, 'A21', 'info', MESSAGE_MIGRATION_FRAIS)
  if (!d.tvaFormateurDisponible) alerter({ alertes }, 'A22', 'info', MESSAGE_TVA_FORMATEUR)
  if (toutesAnnulees && total > 0) {
    alerter({ alertes }, 'A25', 'info', 'Session annulée : les coûts saisis restent à la charge de l\'organisme.')
  }
  const rang = { critique: 0, attention: 1, info: 2 }
  alertes.sort((a, b) => rang[a.niveau] - rang[b.niveau])

  const manques = uniques([...rec.manques, ...form.manques, ...ctx.manques, ...cf.manques, ...ca.manques])

  // Identité de l'unité
  const numeros = ctx.poei.map((p) => p.numero).filter((x): x is string => !!x)
  const clientPoei = u.type === 'poei'
    ? libelleClient(d.idx.clientParId.get(ctx.poei.map((p) => p.client_id).find(Boolean) || '') || principale?.client)
    : null
  const badges: BadgeUnite[] = []
  if (u.type === 'poei') badges.push('poei')
  else if (principale?.type_session === 'intra') badges.push('intra')
  else if (principale?.type_session === 'inter') badges.push('inter')
  if (rec.estAgefice || ctx.sessions.some((s) => s.client?.financeur_type === 'agefice')) badges.push('agefice')
  if (ctx.sessions.some((s) => s.dendreo_id != null && String(s.dendreo_id) !== '')) badges.push('dendreo')

  return {
    uniteId: u.id,
    type: u.type,
    sessionIds: u.sessionIds,
    porteuseIds: u.porteuseIds,
    poeiIds: u.poeiIds,
    titre: u.type === 'poei'
      ? `Parcours ${numeros.join(' + ') || 'POEI'}`
      : principale?.intitule || principale?.formation?.intitule || 'Session',
    reference: u.type === 'poei' ? (numeros.join(' + ') || null) : principale?.reference || null,
    client: u.type === 'poei' ? clientPoei : libelleClient(principale?.client),
    date: u.date,
    statutsSession: uniques(ctx.sessions.map((s) => String(s.status || ''))).filter(Boolean),
    badges,
    recette: rec.recette,
    couts: {
      formateur: coutFormateur,
      formateurInconnu,
      frais: frais.total,
      fraisDisponibles: d.fraisDisponibles,
      commissionFranchise: cf.montant,
      commissionApporteur: ca.montant,
      total,
    },
    marge,
    margePartielle,
    taux,
    qualiteMarge,
    statut,
    lignes: [...rec.lignes, ...postes.map((p) => p.ligne), ...frais.lignes, ...cf.lignes, ...ca.lignes],
    alertes,
    manques,
  }
}

/** Toutes les unités dont la date tombe dans la période (bornes incluses, AAAA-MM-JJ). */
export function calculerToutes(d: DonneesRentabilite, periode: { du: string; au: string }): Rentabilite[] {
  return construireUnites(d)
    .filter((u) => !!u.date && u.date.slice(0, 10) >= periode.du && u.date.slice(0, 10) <= periode.au)
    .map((u) => calculerRentabilite(u, d))
}
