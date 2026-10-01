import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import type { CRMModule, Permission } from '@/lib/types'
import { CHAMPS_APPRENANT_MODIFIABLES, CHAMPS_CLIENT_MODIFIABLES, NOMS_ACTIONS, destinataireFactureSession, refusMetier } from '@/lib/assistant/actions-outils'

/**
 * Sécurité des actions de Starkk : une action ne s'exécute que si le serveur
 * l'a lui-même proposée à CET utilisateur, si son rôle l'y autorise, si ce
 * qu'elle touche appartient à son organisation, et une seule fois.
 *
 * Avant : la route de confirmation exécutait le type et les paramètres
 * renvoyés par le navigateur, et ne contrôlait que l'appartenance à l'équipe.
 * Désormais le navigateur ne renvoie qu'un jeton signé qui fige l'action, ses
 * paramètres, l'utilisateur, l'organisation et une date d'expiration : il ne
 * peut ni changer une cible, ni rejouer une action déjà confirmée.
 *
 * Les paramètres du modèle sont normalisés par un schéma strict avant d'être
 * signés, et la carte de confirmation est calculée à partir de ces mêmes
 * valeurs : ce que l'utilisateur lit est exactement ce qui sera exécuté.
 */

// ---- Permission propre à chaque action ----

type Droit = 'create' | 'update'

interface RegleAction {
  /** Module et droit requis, alignés sur la page où l'interface fait la même opération (lib/dashboard-guard.ts). */
  droits: [CRMModule, Droit][]
  /** Liste de rôles quand la fonction équivalente de l'interface en impose une. */
  roles?: string[]
}

// Liste codée en dur dans les fonctions de facturation OPCO et de convocation
// (facture-opco-actions.ts, sendConvocationToReferentAction).
const ROLES_ADMINISTRATIFS = ['super_admin', 'gestionnaire', 'directeur_commercial']

/** Une action absente de ce tableau est refusée à tous. */
const REGLES_ACTIONS: Record<string, RegleAction> = {
  action_envoyer_convocation: { droits: [['sessions', 'update']], roles: ROLES_ADMINISTRATIFS },
  // Peut créer la convention avant de l'envoyer
  action_envoyer_convention: { droits: [['conventions', 'create'], ['conventions', 'update']] },
  action_relancer_facture: { droits: [['factures', 'update']] },
  action_envoyer_lien_emargement: { droits: [['sessions', 'update']] },
  action_marquer_paiement: { droits: [['paiements', 'create'], ['factures', 'update']] },
  action_modifier_client: { droits: [['clients', 'update']] },
  action_modifier_apprenant: { droits: [['apprenants', 'update']] },
  action_creer_client: { droits: [['clients', 'create']] },
  action_creer_apprenant: { droits: [['apprenants', 'create']] },
  action_inscrire_apprenant: { droits: [['sessions', 'update']] },
  // Pointage réservé à l'administration dans la fiche session (canEmarge)
  action_poser_presence: { droits: [['sessions', 'update']], roles: ['super_admin', 'gestionnaire'] },
  action_changer_statut_session: { droits: [['sessions', 'update']] },
  action_envoyer_attestations_hygiene: { droits: [['sessions', 'update']] },
  action_maj_reglement_agefice: { droits: [['conventions', 'update']] },
  action_creer_session: { droits: [['sessions', 'create']] },
  action_creer_devis: { droits: [['devis', 'create']] },
  // Même écriture que enregistrerFinancementOpcoAction, réservée à ces rôles dans l'interface
  action_enregistrer_accord_pec: { droits: [['sessions', 'update']], roles: ROLES_ADMINISTRATIFS },
  action_generer_facture_opco: { droits: [['factures', 'create']], roles: ROLES_ADMINISTRATIFS },
  action_proposer_mission_formateur: { droits: [['sessions', 'update']] },
  action_envoyer_contrat_formateur: { droits: [['sessions', 'update']] },
  action_envoyer_pack_hygiene: { droits: [['sessions', 'update']] },
  action_relancer_signatures: { droits: [['conventions', 'update']] },
  action_creer_dossier_agefice: { droits: [['conventions', 'create']] },
}

/**
 * Titre de la carte, fixé par le serveur selon le type d'action : deux actions
 * différentes ne peuvent pas se présenter pareil, quel que soit le libellé
 * écrit par le modèle (qui n'est plus qu'une note sous ce titre).
 */
export const TITRES_ACTIONS: Record<string, string> = {
  action_envoyer_convocation: 'Envoi de la convocation au référent du client',
  action_envoyer_convention: 'Envoi de la convention en signature électronique',
  action_relancer_facture: 'Relance par email d’une facture impayée',
  action_envoyer_lien_emargement: 'Envoi du lien personnel de signature des émargements',
  action_marquer_paiement: 'Enregistrement d’un paiement reçu',
  action_modifier_client: 'Modification de la fiche client',
  action_modifier_apprenant: 'Modification de la fiche stagiaire',
  action_creer_client: 'Création d’une fiche client',
  action_creer_apprenant: 'Création d’une fiche stagiaire',
  action_inscrire_apprenant: 'Inscription du stagiaire à la session (convoqué si la session est proche)',
  action_poser_presence: 'Pointage de présence sur la feuille d’émargement',
  action_changer_statut_session: 'Changement de statut de la session',
  action_envoyer_attestations_hygiene: 'Envoi au client des attestations d’hygiène',
  action_maj_reglement_agefice: 'Enregistrement du règlement d’un dossier AGEFICE',
  action_creer_session: 'Création d’une session (mission au formateur, convocations si la date est proche)',
  action_creer_devis: 'Création d’un devis',
  action_enregistrer_accord_pec: 'Enregistrement de l’accord de prise en charge OPCO',
  action_generer_facture_opco: 'Création de la facture de la session',
  action_proposer_mission_formateur: 'Attribution de la session au formateur et proposition de mission',
  action_envoyer_contrat_formateur: 'Envoi du contrat au formateur pour signature',
  action_envoyer_pack_hygiene: 'Envoi du pack hygiène au formateur',
  action_relancer_signatures: 'Relance des conventions en attente de signature',
  action_creer_dossier_agefice: 'Création d’un dossier AGEFICE pour le prochain dirigeant inscrit',
}

/** Rôles qui ont accès à tout l'administratif (même règle que lib/dashboard-guard.ts). */
const ROLES_TOUT_ACCES = ['super_admin', 'gestionnaire']

export function actionAutorisee(type: string, role: string, permissions: Permission[]): boolean {
  if (!NOMS_ACTIONS.has(type)) return false
  const regle = REGLES_ACTIONS[type]
  if (!regle) return false
  if (regle.roles && !regle.roles.includes(role)) return false
  if (ROLES_TOUT_ACCES.includes(role)) return true
  return regle.droits.every(([module, droit]) => hasPermission(permissions, module, droit))
}

// ---- Permission de lecture des outils ----

export function peutLire(module: CRMModule, role: string, permissions: Permission[]): boolean {
  return ROLES_TOUT_ACCES.includes(role) || hasPermission(permissions, module, 'read')
}

/** Module dont chaque outil de lecture expose les données (mêmes droits que les pages du dashboard). */
const MODULES_OUTILS: Record<string, CRMModule> = {
  detail_session: 'sessions', lister_sessions: 'sessions', emargements_session: 'sessions',
  detail_client: 'clients', detail_apprenant: 'apprenants', detail_formation: 'formations',
  indicateurs: 'reporting', analyse_financiere: 'factures',
  etat_agefice: 'conventions', signatures_en_attente: 'signatures',
}
/** Rubriques de la recherche et module de chacune. */
export const MODULES_RECHERCHE: Record<string, CRMModule> = {
  clients: 'clients', apprenants: 'apprenants', formateurs: 'formateurs',
  factures: 'factures', conventions: 'conventions', sessions: 'sessions',
}

export function outilAutorise(nom: string, role: string, permissions: Permission[]): boolean {
  if (nom === 'rechercher') return Object.values(MODULES_RECHERCHE).some((m) => peutLire(m, role, permissions))
  const module = MODULES_OUTILS[nom]
  return module ? peutLire(module, role, permissions) : false
}

// ---- Jeton signé ----

export interface Proposition {
  id: string
  type: string
  params: Record<string, any>
  org: string
  user: string
  exp: number
}

const VALIDITE_MS = 24 * 3600 * 1000
const PREFIXE = 'starkk-proposition.v1.'
const secret = () => process.env.STARKK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const signer = (charge: string) => createHmac('sha256', secret()).update(PREFIXE + charge).digest('base64url')

/** Fige une proposition du modèle : renvoie son identifiant et le jeton à confirmer. */
export function signerProposition(p: { type: string; params: Record<string, any>; org: string; user: string }): { id: string; jeton: string } {
  if (!secret()) throw new Error('Secret de signature des propositions absent')
  const id = randomUUID()
  const contenu: Proposition = { id, type: p.type, params: p.params, org: p.org, user: p.user, exp: Date.now() + VALIDITE_MS }
  const charge = Buffer.from(JSON.stringify(contenu), 'utf8').toString('base64url')
  return { id, jeton: `${charge}.${signer(charge)}` }
}

export type Verification =
  | { ok: true; proposition: Proposition }
  | { ok: false; statut: number; message: string }

export function verifierProposition(jeton: unknown, attendu: { orgId: string; userId: string }): Verification {
  const invalide: Verification = { ok: false, statut: 400, message: 'Proposition invalide : redemandez-la à Starkk.' }
  if (typeof jeton !== 'string' || jeton.length > 50_000 || !secret()) return invalide
  const morceaux = jeton.split('.')
  if (morceaux.length !== 2 || !morceaux[0] || !morceaux[1]) return invalide
  const [charge, recue] = morceaux
  const a = Buffer.from(signer(charge))
  const b = Buffer.from(recue)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return invalide

  let p: any
  try { p = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8')) } catch { return invalide }
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.type !== 'string'
    || typeof p.exp !== 'number' || !p.params || typeof p.params !== 'object' || Array.isArray(p.params)) return invalide
  if (p.org !== attendu.orgId || p.user !== attendu.userId) {
    return { ok: false, statut: 403, message: 'Cette proposition a été faite pour un autre compte.' }
  }
  if (p.exp < Date.now()) {
    return { ok: false, statut: 410, message: 'Proposition expirée (plus de 24 h) : redemandez-la à Starkk.' }
  }
  return { ok: true, proposition: p as Proposition }
}

// ---- Mise en forme ----

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const dateFr = (d: string | null) => {
  if (!d) return ''
  const date = new Date(String(d).slice(0, 10) + 'T12:00:00')
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
const euros = (n: unknown) => {
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : ''
}
const nomComplet = (r: any) => [r?.prenom, r?.nom].filter(Boolean).join(' ')
const nomClient = (c: any) => c?.nom_commercial || c?.raison_sociale || nomComplet(c) || ''
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const STATUTS: Record<string, string> = {
  planifiee: 'planifiée', confirmee: 'confirmée', en_cours: 'en cours', terminee: 'terminée', annulee: 'annulée',
}
const NOMS_CHAMPS: Record<string, string> = {
  email: 'email', telephone: 'téléphone', adresse: 'adresse', code_postal: 'code postal', ville: 'ville', financeur_type: 'financeur',
}

// ---- Schéma strict des paramètres de chaque action ----

type Spec =
  | { t: 'uuid'; requis?: boolean }
  | { t: 'uuids'; requis?: boolean }
  | { t: 'texte'; max: number; requis?: boolean; label?: string }
  | { t: 'email'; requis?: boolean; label?: string }
  | { t: 'enum'; valeurs: string[]; requis?: boolean; label?: string; noms?: Record<string, string> }
  | { t: 'nombre'; positif?: boolean; requis?: boolean; label?: string; euros?: boolean }
  | { t: 'booleen'; requis?: boolean; label?: string; vrai: string; faux: string; seulementVrai?: boolean }
  | { t: 'date'; requis?: boolean; label?: string }
  | { t: 'champs'; autorises: string[]; requis?: boolean; label: string }

const MODES_PAIEMENT = ['virement', 'cheque', 'cb', 'especes']
const FINANCEURS = ['entreprise', 'opco', 'agefice', 'france_travail']

/**
 * Paramètres admis pour chaque action (les autres sont écartés) et libellé
 * sous lequel la carte affiche ceux qui changent l'effet de l'action.
 */
const SCHEMAS: Record<string, Record<string, Spec>> = {
  action_envoyer_convocation: { session_id: { t: 'uuid', requis: true } },
  action_envoyer_convention: { session_id: { t: 'uuid', requis: true }, client_id: { t: 'uuid' } },
  action_relancer_facture: { facture_id: { t: 'uuid', requis: true } },
  action_envoyer_lien_emargement: { session_id: { t: 'uuid', requis: true }, apprenant_id: { t: 'uuid', requis: true } },
  action_marquer_paiement: {
    facture_id: { t: 'uuid', requis: true },
    montant: { t: 'nombre', positif: true, label: 'Montant encaissé', euros: true },
    mode: { t: 'enum', valeurs: MODES_PAIEMENT, requis: true, label: 'Mode' },
    reference: { t: 'texte', max: 120, label: 'Référence' },
    date_paiement: { t: 'date', label: 'Date du paiement' },
  },
  action_modifier_client: {
    client_id: { t: 'uuid', requis: true },
    champs: { t: 'champs', autorises: CHAMPS_CLIENT_MODIFIABLES, requis: true, label: 'Modifications' },
  },
  action_modifier_apprenant: {
    apprenant_id: { t: 'uuid', requis: true },
    champs: { t: 'champs', autorises: CHAMPS_APPRENANT_MODIFIABLES, requis: true, label: 'Modifications' },
  },
  action_creer_client: {
    raison_sociale: { t: 'texte', max: 200, requis: true, label: 'Raison sociale' },
    type: { t: 'enum', valeurs: ['entreprise', 'particulier'], label: 'Type' },
    email: { t: 'email', label: 'Email' },
    telephone: { t: 'texte', max: 30, label: 'Téléphone' },
    ville: { t: 'texte', max: 100, label: 'Ville' },
    financeur_type: { t: 'enum', valeurs: FINANCEURS, label: 'Financeur' },
  },
  action_creer_apprenant: {
    client_id: { t: 'uuid', requis: true },
    prenom: { t: 'texte', max: 80, requis: true, label: 'Prénom' },
    nom: { t: 'texte', max: 80, requis: true, label: 'Nom' },
    email: { t: 'email', label: 'Email' },
    telephone: { t: 'texte', max: 30, label: 'Téléphone' },
  },
  action_inscrire_apprenant: { session_id: { t: 'uuid', requis: true }, apprenant_id: { t: 'uuid', requis: true } },
  action_poser_presence: {
    session_id: { t: 'uuid', requis: true },
    apprenant_id: { t: 'uuid', requis: true },
    present: { t: 'booleen', requis: true, label: 'Pointage', vrai: 'présent', faux: 'absent' },
    motif: { t: 'texte', max: 200, label: 'Motif' },
    date: { t: 'date', label: 'Date' },
  },
  action_changer_statut_session: {
    session_id: { t: 'uuid', requis: true },
    statut: { t: 'enum', valeurs: ['planifiee', 'confirmee', 'en_cours', 'terminee', 'annulee'], requis: true, label: 'Nouveau statut', noms: STATUTS },
  },
  action_envoyer_attestations_hygiene: { session_id: { t: 'uuid', requis: true } },
  action_maj_reglement_agefice: {
    dossier_id: { t: 'uuid', requis: true },
    mode: { t: 'enum', valeurs: ['virement', 'cheque'], requis: true, label: 'Mode' },
    reference: { t: 'texte', max: 120, label: 'Référence' },
    date: { t: 'date', label: 'Date du règlement' },
  },
  action_creer_session: {
    formation_id: { t: 'uuid', requis: true },
    client_id: { t: 'uuid' },
    date_debut: { t: 'date', requis: true, label: 'Début' },
    date_fin: { t: 'date', label: 'Fin' },
    type_session: { t: 'enum', valeurs: ['intra', 'inter'], label: 'Type' },
    modalite: { t: 'enum', valeurs: ['presentiel', 'distanciel', 'mixte'], label: 'Modalité' },
    lieu: { t: 'texte', max: 200, label: 'Lieu' },
    horaires: { t: 'texte', max: 120, label: 'Horaires' },
    formateur_id: { t: 'uuid' },
    apprenant_ids: { t: 'uuids' },
    prix_ht: { t: 'nombre', label: 'Prix HT', euros: true },
  },
  action_creer_devis: {
    client_id: { t: 'uuid', requis: true },
    formation_id: { t: 'uuid' },
    objet: { t: 'texte', max: 200, requis: true, label: 'Objet' },
    designation: { t: 'texte', max: 300, label: 'Désignation' },
    quantite: { t: 'nombre', positif: true, label: 'Quantité' },
    prix_unitaire_ht: { t: 'nombre', requis: true, label: 'Prix unitaire HT', euros: true },
    date_validite: { t: 'date', label: 'Valable jusqu’au' },
  },
  action_enregistrer_accord_pec: {
    session_id: { t: 'uuid', requis: true },
    montant_finance: { t: 'nombre', positif: true, requis: true, label: 'Montant pris en charge', euros: true },
    numero_dossier: { t: 'texte', max: 60, label: 'N° de dossier' },
  },
  action_generer_facture_opco: {
    session_id: { t: 'uuid', requis: true },
    montant_ht: { t: 'nombre', positif: true, label: 'Montant HT facturé', euros: true },
    forcer: { t: 'booleen', label: 'Forcer malgré une facturation Dendreo', vrai: 'oui', faux: 'non', seulementVrai: true },
  },
  action_proposer_mission_formateur: { session_id: { t: 'uuid', requis: true }, formateur_id: { t: 'uuid', requis: true } },
  action_envoyer_contrat_formateur: { session_id: { t: 'uuid', requis: true } },
  action_envoyer_pack_hygiene: { session_id: { t: 'uuid', requis: true } },
  // convention_ids est toujours recalculé par le serveur (figerParams)
  action_relancer_signatures: { session_id: { t: 'uuid' }, convention_ids: { t: 'uuids' } },
  action_creer_dossier_agefice: { session_id: { t: 'uuid', requis: true } },
}

type Normalisation = { ok: true; params: Record<string, any> } | { ok: false; message: string }

/**
 * Normalise les paramètres du modèle : types et valeurs permises vérifiés,
 * clés inconnues écartées. Une valeur douteuse (forcer: "false", statut en
 * tableau, champ non modifiable) fait refuser la proposition plutôt que
 * d'être interprétée.
 */
export function normaliserParams(type: string, brut: Record<string, any>): Normalisation {
  const schema = SCHEMAS[type]
  if (!schema) return { ok: false, message: 'Action inconnue.' }
  const params: Record<string, any> = {}
  const invalide = (cle: string, precision = '') => ({ ok: false as const, message: `Paramètre ${cle} invalide${precision}.` })

  for (const [cle, spec] of Object.entries(schema)) {
    const v = brut?.[cle]
    if (v === undefined || v === null || v === '') {
      if (spec.requis) return { ok: false, message: `Paramètre ${cle} manquant.` }
      continue
    }
    switch (spec.t) {
      case 'uuid':
        if (typeof v !== 'string' || !UUID.test(v)) return invalide(cle)
        params[cle] = v.toLowerCase()
        break
      case 'uuids': {
        if (!Array.isArray(v) || v.length > 50 || v.some((x) => typeof x !== 'string' || !UUID.test(x))) return invalide(cle)
        const ids = Array.from(new Set(v.map((x: string) => x.toLowerCase())))
        if (ids.length) params[cle] = ids
        else if (spec.requis) return { ok: false, message: `Paramètre ${cle} manquant.` }
        break
      }
      case 'texte': {
        if (typeof v !== 'string') return invalide(cle)
        const s = v.trim()
        if (!s) { if (spec.requis) return { ok: false, message: `Paramètre ${cle} manquant.` }; break }
        if (s.length > spec.max) return invalide(cle, ` (${spec.max} caractères au plus)`)
        params[cle] = s
        break
      }
      case 'email':
        if (typeof v !== 'string' || !EMAIL.test(v.trim())) return invalide(cle, ' (adresse email attendue)')
        params[cle] = v.trim().toLowerCase()
        break
      case 'enum':
        if (typeof v !== 'string' || !spec.valeurs.includes(v)) return invalide(cle, ` (valeurs permises : ${spec.valeurs.join(', ')})`)
        params[cle] = v
        break
      case 'nombre': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.trim().replace(',', '.')) : NaN
        if (!Number.isFinite(n) || n < 0 || (spec.positif && n <= 0)) return invalide(cle, spec.positif ? ' (nombre positif attendu)' : ' (nombre attendu)')
        params[cle] = Math.round(n * 100) / 100
        break
      }
      case 'booleen':
        if (v === true || v === 'true') params[cle] = true
        else if (v === false || v === 'false') params[cle] = false
        else return invalide(cle, ' (true ou false attendu)')
        break
      case 'date':
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v + 'T12:00:00').getTime())) return invalide(cle, ' (format AAAA-MM-JJ)')
        params[cle] = v
        break
      case 'champs': {
        if (typeof v !== 'object' || Array.isArray(v)) return invalide(cle)
        const champs: Record<string, string> = {}
        for (const [k, val] of Object.entries(v)) {
          if (!spec.autorises.includes(k)) return { ok: false, message: `Champ non modifiable par Starkk : ${k} (permis : ${spec.autorises.join(', ')}).` }
          if (typeof val !== 'string') return invalide(`${cle}.${k}`)
          const s = val.trim()
          if (s.length > 200) return invalide(`${cle}.${k}`, ' (200 caractères au plus)')
          if (k === 'email' && s && !EMAIL.test(s)) return invalide(`${cle}.email`, ' (adresse email attendue)')
          if (k === 'financeur_type' && !FINANCEURS.includes(s)) return invalide(`${cle}.financeur_type`, ` (valeurs permises : ${FINANCEURS.join(', ')})`)
          champs[k] = s
        }
        if (Object.keys(champs).length) params[cle] = champs
        else if (spec.requis) return { ok: false, message: `Paramètre ${cle} manquant.` }
        break
      }
    }
  }
  if (typeof brut?.libelle === 'string' && brut.libelle.trim()) params.libelle = brut.libelle.trim().slice(0, 300)
  return { ok: true, params }
}

/** Lignes de la carte pour les paramètres qui changent l'effet de l'action, dans l'ordre du schéma. */
export function detailsAffiches(type: string, params: Record<string, any>): string[] {
  const schema = SCHEMAS[type] || {}
  const lignes: string[] = []
  for (const [cle, spec] of Object.entries(schema)) {
    const v = params[cle]
    if (v === undefined || !('label' in spec) || !spec.label) continue
    if (spec.t === 'nombre') lignes.push(`${spec.label} : ${spec.euros ? euros(v) : Number(v).toLocaleString('fr-FR')}`)
    else if (spec.t === 'enum') lignes.push(`${spec.label} : ${spec.noms?.[v] || String(v).replace(/_/g, ' ')}`)
    else if (spec.t === 'booleen') { if (!spec.seulementVrai || v) lignes.push(`${spec.label} : ${v ? spec.vrai : spec.faux}`) }
    else if (spec.t === 'date') lignes.push(`${spec.label} : ${dateFr(v) || v}`)
    else if (spec.t === 'champs') lignes.push(`${spec.label} : ${Object.entries(v).map(([k, val]) => `${NOMS_CHAMPS[k] || k} → ${val || '(vide)'}`).join(' · ')}`)
    else lignes.push(`${spec.label} : ${v}`)
  }
  if (type === 'action_poser_presence' && !params.date) {
    lignes.push(params.present ? 'Créneaux : tous ceux non signés, jusqu’à aujourd’hui' : 'Créneaux : tous ceux non signés')
  }
  if (type === 'action_generer_facture_opco') {
    if (params.destinataire_nom) lignes.push(`Adressée à : ${params.destinataire_nom}`)
    if (params.montant_reference != null && params.montant_reference !== params.montant_ht) {
      lignes.push(`Montant de l’accord ou prix de la session : ${euros(params.montant_reference)}`)
    }
  }
  return lignes
}

/**
 * Fige à la proposition ce que l'exécution aurait sinon décidé plus tard,
 * pour que la carte le montre : les conventions à relancer, le montant d'un
 * paiement « du reste dû ».
 */
export async function figerParams(type: string, params: Record<string, any>, orgId: string): Promise<{ ok: true; params: Record<string, any> } | { ok: false; statut: number; message: string }> {
  const supabase = await createServiceRoleClient()
  if (type === 'action_relancer_signatures') {
    let q = supabase.from('conventions').select('id')
      .eq('organization_id', orgId).not('sent_at', 'is', null).is('signature_client_date', null)
      .not('status', 'in', '("annulee","brouillon","signee_client","signee_complete")').order('sent_at').limit(10)
    if (params.session_id) q = q.eq('session_id', params.session_id)
    const { data, error } = await q
    if (error) return { ok: false, statut: 503, message: 'Vérification impossible pour le moment, réessayez.' }
    if (!data?.length) return { ok: false, statut: 422, message: 'Aucune convention en attente de signature.' }
    return { ok: true, params: { ...params, convention_ids: data.map((c: any) => c.id) } }
  }
  if (type === 'action_generer_facture_opco') {
    // Montant et destinataire figés : ceux que la carte annonce sont ceux facturés
    let dest
    try { dest = await destinataireFactureSession(params.session_id, orgId) } catch { return { ok: false, statut: 503, message: 'Vérification impossible pour le moment, réessayez.' } }
    if (!dest) return { ok: false, statut: 422, message: 'Aucun client ni OPCO rattaché à la session : impossible de savoir à qui adresser la facture.' }
    const reference = Math.round(dest.montant * 100) / 100
    const montant = params.montant_ht ?? reference
    if (!(montant > 0)) return { ok: false, statut: 422, message: 'Montant à facturer inconnu : enregistrez l’accord de prise en charge ou le prix de la session.' }
    return { ok: true, params: { ...params, montant_ht: montant, montant_reference: reference, destinataire: dest.cle, destinataire_nom: dest.nom } }
  }
  if (type === 'action_marquer_paiement' && params.montant === undefined) {
    const { data: f, error } = await supabase.from('factures').select('montant_ttc, montant_restant')
      .eq('id', params.facture_id).eq('organization_id', orgId).maybeSingle()
    if (error) return { ok: false, statut: 503, message: 'Vérification impossible pour le moment, réessayez.' }
    if (!f) return { ok: false, statut: 404, message: 'Facture introuvable dans votre organisation.' }
    const restant = Math.round(Number(f.montant_restant ?? f.montant_ttc ?? 0) * 100) / 100
    return { ok: true, params: { ...params, montant: restant } }
  }
  return { ok: true, params }
}

// ---- Périmètre : tout ce que l'action touche appartient à l'organisation ----

interface Cible {
  table: string
  colonnes: string
  libelle: (r: any) => string
  /** Pour une liste d'identifiants : phrase qui la résume. */
  liste?: (noms: string[]) => string
}

const enListe = (mot: string, max: number) => (noms: string[]) =>
  `${pluriel(noms.length, mot)} : ${noms.slice(0, max).join(', ')}${noms.length > max ? ` et ${pluriel(noms.length - max, 'autre')}` : ''}`

/** Paramètres qui désignent une entité : table à contrôler et libellé lisible de la cible. */
const CIBLES: Record<string, Cible> = {
  session_id: {
    table: 'sessions', colonnes: 'id, intitule, reference, date_debut',
    libelle: (r) => `Session ${r.intitule || r.reference || ''}${r.date_debut ? ` du ${dateFr(r.date_debut)}` : ''}`.trim(),
  },
  client_id: {
    table: 'clients', colonnes: 'id, raison_sociale, nom_commercial, prenom, nom',
    libelle: (r) => `Client ${r.raison_sociale || r.nom_commercial || nomComplet(r)}`.trim(),
  },
  facture_id: {
    table: 'factures', colonnes: 'id, numero, montant_ttc, montant_restant',
    libelle: (r) => `Facture ${r.numero || 'sans numéro'}${r.montant_restant != null ? ` (reste dû ${euros(r.montant_restant)})` : ''}`,
  },
  apprenant_id: { table: 'apprenants', colonnes: 'id, prenom, nom', libelle: (r) => `Stagiaire ${nomComplet(r)}` },
  // Tous les noms : ce sont les personnes inscrites et convoquées
  apprenant_ids: { table: 'apprenants', colonnes: 'id, prenom, nom', libelle: (r) => nomComplet(r), liste: enListe('stagiaire', 50) },
  formateur_id: { table: 'formateurs', colonnes: 'id, prenom, nom', libelle: (r) => `Formateur ${nomComplet(r)}` },
  formation_id: { table: 'formations', colonnes: 'id, intitule, reference', libelle: (r) => `Formation ${r.intitule || r.reference || ''}`.trim() },
  dossier_id: { table: 'dossiers_agefice', colonnes: 'id, numero_dossier', libelle: (r) => `Dossier AGEFICE ${r.numero_dossier || ''}`.trim() },
  convention_ids: {
    table: 'conventions', colonnes: 'id, numero, client:client_id(raison_sociale, nom_commercial, prenom, nom)',
    libelle: (r) => `${r.numero || 'sans numéro'}${nomClient(r.client) ? ` (${nomClient(r.client)})` : ''}`,
    liste: enListe('convention', 10),
  },
}

export type Perimetre = { ok: true; cibles: string[] } | { ok: false; message: string; technique?: boolean }

/**
 * Vérifie que chaque entité désignée par les paramètres existe dans
 * l'organisation, et renvoie leurs libellés pour la carte de confirmation :
 * ils viennent de la base, pas du texte du modèle, donc un libellé trompeur ne
 * peut pas masquer la vraie cible.
 */
export async function verifierPerimetre(params: Record<string, any>, orgId: string): Promise<Perimetre> {
  const supabase = await createServiceRoleClient()
  const cibles: string[] = []
  const technique = { ok: false as const, technique: true, message: 'Vérification impossible pour le moment, réessayez.' }

  for (const [cle, cible] of Object.entries(CIBLES)) {
    const valeur = params[cle]
    if (valeur === undefined || valeur === null || valeur === '') continue

    if (cle.endsWith('_ids')) {
      if (!Array.isArray(valeur)) return { ok: false, message: `Paramètre ${cle} invalide.` }
      const ids = Array.from(new Set(valeur.map(String)))
      if (!ids.length) continue
      if (ids.length > 50 || ids.some((id) => !UUID.test(id))) return { ok: false, message: `Paramètre ${cle} invalide.` }
      const { data, error } = await supabase.from(cible.table).select(cible.colonnes).in('id', ids).eq('organization_id', orgId)
      if (error) return technique
      if ((data || []).length !== ids.length) return { ok: false, message: 'Un des éléments visés est introuvable dans votre organisation.' }
      const noms = (data as any[]).map(cible.libelle)
      cibles.push(cible.liste ? cible.liste(noms) : noms.join(', '))
      continue
    }

    const id = String(valeur)
    if (!UUID.test(id)) return { ok: false, message: `Paramètre ${cle} invalide.` }
    const { data, error } = await supabase.from(cible.table).select(cible.colonnes).eq('id', id).eq('organization_id', orgId).maybeSingle()
    if (error) return technique
    if (!data) return { ok: false, message: 'Élément introuvable dans votre organisation.' }
    cibles.push(cible.libelle(data))
  }
  return { ok: true, cibles }
}

/**
 * Un commercial ne voit et ne modifie que les clients qu'il suit : assignés à
 * lui, ou issus d'un lead qui lui est assigné. Même règle que la fiche client
 * (app/dashboard/clients/[id]/page.tsx). Lève une erreur si la base ne répond pas.
 */
export async function clientDansPortefeuille(clientId: string, orgId: string, userId: string): Promise<boolean> {
  const supabase = await createServiceRoleClient()
  const { data: c, error } = await supabase.from('clients').select('assigned_to')
    .eq('id', clientId).eq('organization_id', orgId).maybeSingle()
  if (error) throw error
  if (!c) return false
  if (c.assigned_to === userId) return true
  const { count, error: e2 } = await supabase.from('leads').select('id', { count: 'exact', head: true })
    .eq('converted_client_id', clientId).eq('assigned_to', userId).eq('organization_id', orgId)
  if (e2) throw e2
  return !!count
}

/** Actions qui agissent sur la fiche client elle-même : soumises au portefeuille du commercial. */
const ACTIONS_FICHE_CLIENT = ['action_modifier_client']

export type Controle = { ok: true; cibles: string[] } | { ok: false; statut: number; message: string }

/**
 * Contrôles d'une action aux paramètres déjà normalisés, à la proposition
 * comme à la confirmation : permission du rôle, périmètre de l'organisation,
 * portefeuille du commercial, règles métier (transitions, reste dû…).
 * Statuts : 403 droits, 404 cible, 422 règle métier, 503 base indisponible.
 */
export async function controlerAction(args: {
  type: string
  params: Record<string, any>
  orgId: string
  user: { id: string; role: string }
  permissions: Permission[]
}): Promise<Controle> {
  if (!actionAutorisee(args.type, args.user.role, args.permissions)) {
    return { ok: false, statut: 403, message: 'Votre rôle ne permet pas cette action.' }
  }
  const perimetre = await verifierPerimetre(args.params, args.orgId)
  if (!perimetre.ok) return { ok: false, statut: perimetre.technique ? 503 : 404, message: perimetre.message }
  try {
    if (args.user.role === 'commercial' && ACTIONS_FICHE_CLIENT.includes(args.type)) {
      const clientId = String(args.params.client_id || '')
      if (!clientId || !(await clientDansPortefeuille(clientId, args.orgId, args.user.id))) {
        return { ok: false, statut: 403, message: 'Ce client n’est pas dans votre portefeuille.' }
      }
    }
    const refus = await refusMetier(args.type, args.params, args.orgId)
    if (refus) return { ok: false, statut: 422, message: refus }
  } catch (e) {
    console.error('[assistant] contrôle impossible', e)
    return { ok: false, statut: 503, message: 'Vérification impossible pour le moment, réessayez.' }
  }
  return { ok: true, cibles: [...perimetre.cibles, ...detailsAffiches(args.type, args.params)] }
}

/**
 * Proposition du modèle : normalisée, complétée (figerParams) puis contrôlée.
 * Les paramètres renvoyés sont ceux à signer ; les cibles, ce que la carte affiche.
 */
export async function preparerProposition(args: {
  type: string
  brut: Record<string, any>
  orgId: string
  user: { id: string; role: string }
  permissions: Permission[]
}): Promise<{ ok: true; params: Record<string, any>; cibles: string[] } | { ok: false; statut: number; message: string }> {
  if (!actionAutorisee(args.type, args.user.role, args.permissions)) {
    return { ok: false, statut: 403, message: 'Votre rôle ne permet pas cette action.' }
  }
  const normalise = normaliserParams(args.type, args.brut)
  if (!normalise.ok) return { ok: false, statut: 400, message: normalise.message }
  const fige = await figerParams(args.type, normalise.params, args.orgId)
  if (!fige.ok) return fige
  const controle = await controlerAction({ ...args, params: fige.params })
  if (!controle.ok) return controle
  return { ok: true, params: fige.params, cibles: controle.cibles }
}

// ---- Exécution unique ----

/**
 * Réserve l'exécution d'une proposition : la ligne d'audit porte l'identifiant
 * de la proposition comme clé primaire, donc une seconde confirmation (double
 * clic, rejeu du jeton) échoue sur la contrainte d'unicité au lieu d'exécuter
 * l'action deux fois. Une proposition se consomme à la première tentative,
 * réussie ou non : en cas d'échec, on la redemande à Starkk.
 */
export async function reserverExecution(args: {
  proposition: Proposition
  acteurId: string
  /** Nom du compte emprunté en « se connecter en tant que » */
  auNomDe?: string
}): Promise<'ok' | 'deja' | 'erreur'> {
  const { proposition: p } = args
  const supabase = await createServiceRoleClient()
  const entite = [p.params.session_id, p.params.facture_id, p.params.client_id, p.params.apprenant_id, p.params.dossier_id]
    .map((v) => (v == null ? '' : String(v)))
    .find((v) => UUID.test(v))
  const { error } = await supabase.from('audit_logs').insert({
    id: p.id,
    organization_id: p.org,
    user_id: args.acteurId,
    action: 'assistant_action',
    entity_type: 'assistant',
    entity_id: entite || null,
    details: { type: p.type, params: p.params, statut: 'en_cours', ...(args.auNomDe ? { au_nom_de: args.auNomDe } : {}) },
  })
  if (!error) return 'ok'
  if (error.code === '23505') return 'deja'
  console.error('[assistant] réservation impossible', error)
  return 'erreur'
}

/** Résultat déjà consigné d'une proposition (seconde confirmation, nouvel essai après coupure). */
export async function lireResultat(id: string, orgId: string): Promise<{ statut: string; success?: boolean; message?: string } | null> {
  const supabase = await createServiceRoleClient()
  const { data } = await supabase.from('audit_logs').select('details')
    .eq('id', id).eq('organization_id', orgId).eq('action', 'assistant_action').maybeSingle()
  const d: any = data?.details
  return d ? { statut: String(d.statut || ''), success: d.success, message: d.message } : null
}

/** Masque le jeton d'un lien de portail (il donne accès à l'espace d'un stagiaire et n'expire pas). */
export const masquerLiensPortail = (texte: string) => String(texte || '').replace(/(\/portail\/)[^/\s)"']+/g, '$1[lien masqué]')

/** Inscrit le résultat sur la ligne d'audit réservée (ne bloque jamais la réponse). */
export async function consignerResultat(args: {
  proposition: Proposition
  auNomDe?: string
  resultat: { success: boolean; message: string }
}): Promise<void> {
  const { proposition: p, resultat } = args
  try {
    const supabase = await createServiceRoleClient()
    await supabase.from('audit_logs').update({
      details: {
        type: p.type,
        params: p.params,
        statut: resultat.success ? 'executee' : 'echec',
        success: resultat.success,
        message: masquerLiensPortail(resultat.message),
        ...(args.auNomDe ? { au_nom_de: args.auNomDe } : {}),
      },
    }).eq('id', p.id)
  } catch (e) {
    console.error('[assistant] audit du résultat impossible', e)
  }
}
