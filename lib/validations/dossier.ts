import { z } from 'zod'

export const createDevisSchema = z.object({
  client_id: z.string().uuid('Client requis'),
  contact_id: z.string().uuid().optional().or(z.literal('')),
  formation_id: z.string().uuid().optional().or(z.literal('')),
  objet: z.string().min(3, 'Objet requis'),
  date_validite: z.string().min(1, 'Date de validité requise'),
  remise_pourcent: z.coerce.number().min(0).max(100).default(0),
  conditions_particulieres: z.string().optional(),
  notes_internes: z.string().optional(),
})

export const devisLigneSchema = z.object({
  designation: z.string().min(1, 'Désignation requise'),
  description: z.string().optional(),
  quantite: z.coerce.number().min(0.01, 'Quantité > 0'),
  unite: z.string().default('forfait'),
  prix_unitaire_ht: z.coerce.number().min(0, 'Prix >= 0'),
})

export const createDossierSchema = z.object({
  client_id: z.string().uuid('Client requis'),
  contact_id: z.string().uuid().optional().or(z.literal('')),
  formation_id: z.string().uuid().optional().or(z.literal('')),
  session_id: z.string().uuid().optional().or(z.literal('')),
  financeur_type: z.string().optional().or(z.literal('')),
  financeur_nom: z.string().optional(),
  numero_prise_en_charge: z.string().optional(),
  montant_prise_en_charge: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
})

export const createConventionSchema = z.object({
  client_id: z.string().uuid('Client requis'),
  formation_id: z.string().uuid('Formation requise'),
  session_id: z.string().uuid().optional().or(z.literal('')),
  devis_id: z.string().uuid().optional().or(z.literal('')),
  dossier_id: z.string().uuid().optional().or(z.literal('')),
  type: z.enum(['inter_entreprise', 'intra_entreprise', 'individuelle']),
  objet: z.string().optional(),
  nombre_stagiaires: z.coerce.number().int().min(1).default(1),
  duree_heures: z.coerce.number().min(0).optional(),
  lieu: z.string().optional(),
  dates_formation: z.string().optional(),
  montant_ht: z.coerce.number().min(0),
  taux_tva: z.coerce.number().min(0).max(100).default(0),
  financeur_type: z.string().optional().or(z.literal('')),
  financeur_nom: z.string().optional(),
})

export type CreateDevisInput = z.infer<typeof createDevisSchema>
export type DevisLigneInput = z.infer<typeof devisLigneSchema>
export type CreateDossierInput = z.infer<typeof createDossierSchema>
export type CreateConventionInput = z.infer<typeof createConventionSchema>
