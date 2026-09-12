import { z } from 'zod'
import { CATEGORIES_FRAIS_VALEURS, round2 } from '@/lib/rentabilite'

const vide = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
// « 1 234,50 » accepté : espaces (y compris insécables) et symbole retirés, virgule convertie en point
const montantSaisi = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.') : v

export const fraisSchema = z.object({
  categorie: z.enum(CATEGORIES_FRAIS_VALEURS, { errorMap: () => ({ message: 'Choisissez une catégorie' }) }),
  libelle: z.string({ required_error: 'Précisez le frais' }).trim().min(1, 'Précisez le frais').max(120, '120 caractères au maximum'),
  montant: z.preprocess(
    montantSaisi,
    z.coerce.number({ invalid_type_error: 'Montant invalide' })
      .positive('Le montant doit être supérieur à 0')
      .max(100000, 'Montant trop élevé')
      .transform(round2)
      .refine((n) => n > 0, 'Le montant doit être supérieur à 0'),
  ),
  date_frais: z.preprocess(vide, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').optional()),
  formateur_id: z.preprocess(vide, z.string().uuid('Formateur invalide').optional()),
  notes: z.preprocess(vide, z.string().max(500, '500 caractères au maximum').optional()),
})

export type FraisSaisi = z.infer<typeof fraisSchema>
