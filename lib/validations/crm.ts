import { z } from 'zod'

// ---- Leads ----

export const createLeadSchema = z.object({
  type: z.enum(['entreprise', 'particulier']).optional().default('entreprise'),
  // Contact
  contact_civilite: z.string().optional(),
  contact_nom: z.string().min(2, 'Nom requis (min. 2 caractères)'),
  contact_prenom: z.string().optional(),
  contact_email: z.string().email('Email invalide').optional().or(z.literal('')),
  contact_telephone: z.string().optional(),
  contact_poste: z.string().optional(),
  contact_qualite: z.string().optional(),
  // Entreprise
  entreprise: z.string().optional(),
  siret: z.string().optional(),
  sigle: z.string().optional(),
  code_naf: z.string().optional(),
  secteur_activite: z.string().optional(),
  taille_entreprise: z.string().optional(),
  forme_juridique: z.string().optional(),
  date_creation_entreprise: z.string().optional().or(z.literal('')),
  effectif_libelle: z.string().optional(),
  tva_intra: z.string().optional(),
  est_qualiopi: z.coerce.boolean().optional(),
  est_organisme_formation: z.coerce.boolean().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  site_web: z.string().optional().or(z.literal('')),
  // Source
  source: z.enum([
    'site_web', 'apporteur_affaires', 'phoning', 'salon',
    'bouche_a_oreille', 'reseaux_sociaux', 'email_entrant',
    'partenaire', 'ancien_client', 'autre',
  ]).optional().default('autre'),
  // Financement / OPCO
  financeur_type: z.enum(['opco', 'entreprise', 'france_travail', 'cpf', 'fonds_propres', 'region', 'autre']).optional().or(z.literal('')),
  opco_id: z.string().uuid().optional().or(z.literal('')),
  opco_compte_status: z.enum(['aucun', 'courrier_envoye', 'en_attente_validation', 'actif', 'inactif']).optional().or(z.literal('')),
  code_idcc: z.string().optional(),
  convention_collective: z.string().optional(),
  numero_opco: z.string().optional(),
  // Recueil du besoin
  montant_estime: z.coerce.number().min(0).optional(),
  formation_souhaitee: z.string().optional(),
  nombre_stagiaires: z.coerce.number().int().min(1).optional(),
  date_souhaitee: z.string().optional(),
  commentaire: z.string().optional(),
  // Suivi
  apporteur_id: z.string().uuid().optional().or(z.literal('')),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
})

export const updateLeadStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'nouveau', 'contacte', 'qualification',
    'proposition_envoyee', 'negociation', 'gagne', 'perdu',
  ]),
  lost_reason: z.string().optional(),
})

// ---- Interactions ----

export const createInteractionSchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(['appel', 'email', 'rdv', 'note', 'relance', 'autre']),
  subject: z.string().optional(),
  content: z.string().min(1, 'Contenu requis'),
  duration_minutes: z.coerce.number().int().min(0).optional(),
})

// ---- Clients ----

export const createClientSchema = z.object({
  type: z.enum(['entreprise', 'particulier']),
  // Entreprise
  raison_sociale: z.string().optional(),
  siret: z.string().regex(/^\d{14}$/, 'SIRET: 14 chiffres').optional().or(z.literal('')),
  code_naf: z.string().optional(),
  secteur_activite: z.string().optional(),
  taille_entreprise: z.string().optional(),
  // Particulier
  civilite: z.string().optional(),
  nom: z.string().optional(),
  prenom: z.string().optional(),
  // Commun
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  telephone: z.string().optional(),
  whatsapp: z.string().optional(),
  whatsapp_opt_in: z.coerce.boolean().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  site_web: z.string().url('URL invalide').optional().or(z.literal('')),
  financeur_type: z.enum(['opco', 'entreprise', 'france_travail', 'cpf', 'fonds_propres', 'region', 'autre']).optional().or(z.literal('')),
  numero_opco: z.string().optional(),
  opco_id: z.string().uuid().optional().or(z.literal('')),
  opco_compte_status: z.enum(['aucun', 'courrier_envoye', 'en_attente_validation', 'actif', 'inactif']).optional().or(z.literal('')),
  code_idcc: z.string().optional(),
  convention_collective: z.string().optional(),
  sigle: z.string().optional(),
  forme_juridique: z.string().optional(),
  date_creation_entreprise: z.string().optional().or(z.literal('')),
  effectif_libelle: z.string().optional(),
  tva_intra: z.string().optional(),
  est_qualiopi: z.coerce.boolean().optional(),
  est_organisme_formation: z.coerce.boolean().optional(),
  // Dirigeant pour créer un contact lié automatiquement
  dirigeant_prenom: z.string().optional(),
  dirigeant_nom: z.string().optional(),
  dirigeant_qualite: z.string().optional(),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.type === 'entreprise' && !data.raison_sociale) {
    return false
  }
  if (data.type === 'particulier' && (!data.nom || !data.prenom)) {
    return false
  }
  return true
}, {
  message: 'Raison sociale requise pour entreprise, nom/prénom requis pour particulier',
})

// ---- Contacts ----

export const createContactSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal('')),
  civilite: z.string().optional(),
  prenom: z.string().min(2, 'Prénom requis'),
  nom: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  telephone: z.string().optional(),
  mobile: z.string().optional(),
  poste: z.string().optional(),
  service: z.string().optional(),
  est_principal: z.coerce.boolean().optional(),
  est_signataire: z.coerce.boolean().optional(),
  est_referent_formation: z.coerce.boolean().optional(),
  notes: z.string().optional(),
  whatsapp: z.string().optional(),
  whatsapp_opt_in: z.coerce.boolean().optional(),
})

// ---- Apporteurs ----

export const createApporteurSchema = z.object({
  type: z.enum(['entreprise', 'particulier']).default('entreprise'),
  raison_sociale: z.string().optional(),
  siret: z.string().optional(),
  nom: z.string().min(2, 'Nom requis'),
  prenom: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  taux_commission: z.coerce.number().min(0).max(100).default(10),
  commission_fixe: z.coerce.number().min(0).optional(),
  mode_calcul: z.enum(['pourcentage', 'fixe']).default('pourcentage'),
  conditions: z.string().optional(),
  date_debut_contrat: z.string().optional(),
  date_fin_contrat: z.string().optional(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type CreateClientInput = z.infer<typeof createClientSchema>
export type CreateContactInput = z.infer<typeof createContactSchema>
export type CreateApporteurInput = z.infer<typeof createApporteurSchema>
export type CreateInteractionInput = z.infer<typeof createInteractionSchema>
