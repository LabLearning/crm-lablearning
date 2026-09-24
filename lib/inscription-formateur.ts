/**
 * Inscription des formateurs par un lien général (/devenir-formateur/<jeton>).
 * Listes et types partagés entre la page publique et le CRM : aucun import
 * serveur ici, le module est utilisé par des composants client.
 */

/** Domaines proposés, alignés sur le catalogue et la page « Devenez formateur » du site. */
export const DOMAINES_FORMATEUR = [
  'Hygiène alimentaire et HACCP',
  'Prévention des risques et sécurité au travail',
  'Secourisme (SST)',
  'Management et encadrement',
  'Gestion et rentabilité en restauration',
  'Relation client et vente',
  'Restauration rapide',
  'Cuisine',
  'Boucherie',
  'Boulangerie',
  'Pâtisserie',
  'Service en salle et bar',
  'Accompagnement POEI et insertion',
] as const

export const CERTIFICATIONS_FORMATEUR = [
  'Formateur SST (INRS)',
  'Formation HACCP (ROFHYA)',
  'Titre professionnel Formateur pour adultes',
  'Formateur PRAP (gestes et postures)',
  'Sécurité incendie',
  'CAP ou BP métier de bouche',
] as const

export const STATUTS_FORMATEUR: { value: string; label: string }[] = [
  { value: 'sous_traitance', label: 'Indépendant (auto-entrepreneur, EI, société)' },
  { value: 'prestataire', label: 'Via un organisme ou une société de portage' },
  { value: 'salarie', label: 'Salarié' },
]

export interface InscriptionFormateur {
  civilite: string
  prenom: string
  nom: string
  email: string
  telephone: string
  adresse: string
  code_postal: string
  ville: string
  type_contrat: string
  siret: string
  numero_da: string
  /** 20 = assujetti à la TVA, 0 = franchise en base */
  taux_tva: number | null
  domaines: string[]
  domaines_autres: string
  certifications: string[]
  certifications_autres: string
  diplomes: string
  experience: string
  zone_intervention: string
  disponibilites: string
  tarif_journalier: number | null
  tarif_horaire: number | null
  bio: string
  /** Chemin du CV déposé dans le stockage (bucket documents) */
  cv_path: string | null
  cv_nom: string | null
  consentement: boolean
}

/** Préfixe de stockage des CV déposés par le formulaire. */
export const PREFIXE_CV = 'formateurs-cv'
export const CV_TAILLE_MAX = 8 * 1024 * 1024
export const CV_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

/** « a, b ; c » → ['a', 'b', 'c'], sans doublon ni vide. */
export function listeLibre(s: string): string[] {
  return [...new Set(String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))]
}
