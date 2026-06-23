import type { BadgeVariant } from '@/lib/types'

export type PoeiStatus =
  | 'prospect' | 'candidature' | 'montage' | 'depose' | 'accorde'
  | 'en_formation' | 'terminee' | 'embauche' | 'refuse' | 'abandonne'

export type TypeContrat = 'cdi' | 'cdd' | 'contrat_pro' | 'interim' | 'autre'

export interface Poei {
  id: string
  organization_id: string
  numero: string | null
  candidat_civilite: string | null
  candidat_nom: string
  candidat_prenom: string | null
  candidat_email: string | null
  candidat_telephone: string | null
  candidat_identifiant_ft: string | null
  apprenant_id: string | null
  client_id: string | null
  poste_vise: string | null
  type_contrat: TypeContrat | null
  date_embauche_prevue: string | null
  tuteur_nom: string | null
  formation_id: string | null
  session_id: string | null
  duree_heures: number | null
  date_debut: string | null
  date_fin: string | null
  montant_horaire: number | null
  montant_total: number | null
  numero_dossier_ft: string | null
  date_depot_ft: string | null
  date_accord_ft: string | null
  statut: PoeiStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // jointures
  client?: { raison_sociale: string | null } | null
  formation?: { intitule: string | null } | null
  session?: { id?: string; reference: string | null; date_debut: string | null; date_fin: string | null } | null
  candidats?: PoeiCandidat[]
  candidats_count?: number
}

export interface PoeiCandidat {
  id: string
  organization_id: string
  poei_id: string
  apprenant_id: string | null
  inscription_id: string | null
  identifiant_ft: string | null
  poste_vise: string | null
  type_contrat: TypeContrat | null
  date_embauche_prevue: string | null
  statut: string  // inscrit | en_formation | embauche | abandonne
  created_at: string
  apprenant?: { nom: string | null; prenom: string | null; email: string | null; telephone: string | null } | null
}

export const CANDIDAT_STATUT_LABELS: Record<string, string> = {
  inscrit: 'Inscrit',
  en_formation: 'En formation',
  embauche: 'Embauché',
  abandonne: 'Abandonné',
}

export const POEI_STATUS_LABELS: Record<PoeiStatus, string> = {
  prospect: 'Prospect',
  candidature: 'Candidature',
  montage: 'Montage dossier',
  depose: 'Déposé France Travail',
  accorde: 'Accord France Travail',
  en_formation: 'En formation',
  terminee: 'Formation terminée',
  embauche: 'Embauché',
  refuse: 'Refusé',
  abandonne: 'Abandonné',
}

export const POEI_STATUS_COLORS: Record<PoeiStatus, BadgeVariant> = {
  prospect: 'default',
  candidature: 'info',
  montage: 'info',
  depose: 'warning',
  accorde: 'success',
  en_formation: 'info',
  terminee: 'success',
  embauche: 'success',
  refuse: 'danger',
  abandonne: 'danger',
}

// Ordre du pipeline (chemin nominal jusqu'à l'embauche)
export const POEI_WORKFLOW: PoeiStatus[] = [
  'prospect', 'candidature', 'montage', 'depose', 'accorde',
  'en_formation', 'terminee', 'embauche',
]

export const TYPE_CONTRAT_LABELS: Record<TypeContrat, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  contrat_pro: 'Contrat de professionnalisation',
  interim: 'Intérim',
  autre: 'Autre',
}
