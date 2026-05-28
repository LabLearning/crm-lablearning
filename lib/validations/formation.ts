import { z } from 'zod'

export const createFormationSchema = z.object({
  reference: z.string().optional(),
  intitule: z.string().min(3, 'Intitulé requis (min. 3 caractères)'),
  sous_titre: z.string().optional(),
  categorie: z.string().optional(),
  objectifs_pedagogiques: z.string().optional(), // Sera splitté par ligne
  prerequis: z.string().optional(),
  public_vise: z.string().optional(),
  programme_detaille: z.string().optional(),
  competences_visees: z.string().optional(),
  modalite: z.enum(['presentiel', 'distanciel', 'mixte']),
  duree_heures: z.coerce.number().min(0.5, 'Durée min. 0.5h'),
  duree_jours: z.coerce.number().min(0).optional(),
  methodes_pedagogiques: z.string().optional(),
  moyens_techniques: z.string().optional(),
  modalites_evaluation: z.string().optional(),
  accessibilite_handicap: z.string().optional(),
  tarif_inter_ht: z.coerce.number().min(0).optional(),
  tarif_intra_ht: z.coerce.number().min(0).optional(),
  tarif_individuel_ht: z.coerce.number().min(0).optional(),
  tva_applicable: z.coerce.boolean().optional(),
  taux_tva: z.coerce.number().min(0).max(100).optional(),
  est_certifiante: z.coerce.boolean().optional(),
  code_rncp: z.string().optional(),
  code_rs: z.string().optional(),
  certificateur: z.string().optional(),
  is_published: z.coerce.boolean().optional(),
})

export const createSessionSchema = z.object({
  formation_id: z.string().uuid('Formation requise'),
  formation_ids: z.string().optional(),  // CSV des UUID (multi-formations)
  type_session: z.enum(['inter', 'intra']).optional().default('inter'),
  modalite: z.enum(['presentiel', 'distanciel', 'mixte']).optional().default('presentiel'),
  client_id: z.string().uuid().optional().or(z.literal('')),
  reference: z.string().optional(),
  intitule: z.string().optional(),
  date_debut: z.string().min(1, 'Date de début requise'),
  date_fin: z.string().min(1, 'Date de fin requise'),
  horaires: z.string().optional(),
  horaires_jours: z.string().optional(),  // JSON stringifié de l'array HoraireJour
  lieu: z.string().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  lien_visio: z.string().url('URL invalide').optional().or(z.literal('')),
  places_min: z.coerce.number().int().min(1).default(1),
  places_max: z.coerce.number().int().min(1).default(12),
  formateur_id: z.string().uuid().optional().or(z.literal('')),
  apprenant_ids: z.string().optional(),  // CSV des apprenants à inscrire
  status: z.enum(['planifiee', 'confirmee', 'en_cours', 'terminee', 'annulee']).optional(),
  cout_formateur: z.coerce.number().min(0).optional(),
  cout_salle: z.coerce.number().min(0).optional(),
  cout_materiel: z.coerce.number().min(0).optional(),
  notes_internes: z.string().optional(),
  notes_logistiques: z.string().optional(),
}).refine((data) => {
  if (data.date_debut && data.date_fin) {
    return new Date(data.date_fin) >= new Date(data.date_debut)
  }
  return true
}, { message: 'La date de fin doit être postérieure à la date de début', path: ['date_fin'] })

export const createFormateurSchema = z.object({
  civilite: z.string().optional(),
  prenom: z.string().min(2, 'Prénom requis'),
  nom: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  telephone: z.string().optional(),
  whatsapp: z.string().optional(),
  whatsapp_opt_in: z.coerce.boolean().optional(),
  qualifications: z.string().optional(),
  domaines_expertise: z.string().optional(), // Sera splitté
  certifications: z.string().optional(),
  type_contrat: z.enum(['salarie', 'prestataire', 'benevole']).default('prestataire'),
  siret: z.string().optional(),
  tarif_journalier: z.coerce.number().min(0).optional(),
  tarif_horaire: z.coerce.number().min(0).optional(),
})

export const createApprenantSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal('')),
  civilite: z.string().optional(),
  prenom: z.string().min(2, 'Prénom requis'),
  nom: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  telephone: z.string().optional(),
  date_naissance: z.string().optional(),
  entreprise: z.string().optional(),
  poste: z.string().optional(),
  situation_handicap: z.coerce.boolean().optional(),
  type_handicap: z.string().optional(),
  besoins_adaptation: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateFormationInput = z.infer<typeof createFormationSchema>
export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type CreateFormateurInput = z.infer<typeof createFormateurSchema>
export type CreateApprenantInput = z.infer<typeof createApprenantSchema>
