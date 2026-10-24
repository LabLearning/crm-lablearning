import type { LeadStatus } from '@/lib/types/crm'
import { canalPublicitaire } from '@/lib/prospects/attribution'

/**
 * Page Leads : les leads sont des demandes entrantes, du site ou des
 * publicités (Meta, Google Ads). Les leads d'autres origines (pipeline
 * commercial d'avant août 2026) restent consultables sous « Anciens ».
 * Module partagé entre le serveur et l'écran : rien qui touche à la base.
 */

export type OrigineLead = 'site' | 'meta' | 'google_ads' | 'apporteur' | 'ancien'

export const ORIGINES: { id: OrigineLead; label: string; court: string }[] = [
  { id: 'site', label: 'Site web', court: 'Site' },
  { id: 'meta', label: 'Meta (Facebook, Instagram)', court: 'Meta' },
  { id: 'google_ads', label: 'Google Ads', court: 'Google' },
  // Le portail des apporteurs dépose encore des leads : ils sont suivis comme les autres demandes
  { id: 'apporteur', label: 'Apporteur d’affaires', court: 'Apporteurs' },
  { id: 'ancien', label: 'Anciens leads', court: 'Anciens' },
]

export function origineDuLead(source: string | null | undefined): OrigineLead {
  if (source === 'site_web') return 'site'
  if (source === 'meta_ads') return 'meta'
  if (source === 'google_ads') return 'google_ads'
  if (source === 'apporteur_affaires') return 'apporteur'
  return 'ancien'
}

/**
 * Demande entrante : venue du site, d'une publicité ou d'un apporteur, ou
 * ancien lead qui a refait une demande par l'un de ces canaux.
 */
export function estEntrant(lead: { source?: string | null; derniere_demande_le?: string | null }): boolean {
  return origineDuLead(lead.source) !== 'ancien' || !!lead.derniere_demande_le
}

/** Date de la dernière demande (tri, « reçu il y a ») : la nouvelle demande d'un lead connu le remet en tête. */
export function dateDemande(lead: { created_at: string; derniere_demande_le?: string | null }): string {
  const d = lead.derniere_demande_le
  return d && Date.parse(d) > Date.parse(lead.created_at) ? d : lead.created_at
}

/** Le prospect a refait une demande après la première (plus d'une minute après). */
export function aRefaitUneDemande(lead: { created_at: string; derniere_demande_le?: string | null }): boolean {
  const d = lead.derniere_demande_le
  return !!d && Date.parse(d) - Date.parse(lead.created_at) > 60000
}

/** Un lead « Site web » venu d'une publicité : « Meta » ou « Google Ads », sinon null. */
export function publiciteDuLead(lead: { source?: string | null; attribution?: any; tags?: string[] | null }): 'meta' | 'google_ads' | null {
  if (lead.source !== 'site_web') return null
  const viaAttribution = canalPublicitaire(lead.attribution || null)
  if (viaAttribution) return viaAttribution
  const tags = lead.tags || []
  if (tags.includes('via-meta')) return 'meta'
  if (tags.includes('via-google-ads')) return 'google_ads'
  return null
}

/** Étapes du suivi d'une demande entrante : cinq, au lieu des sept colonnes de l'ancien pipeline. */
export type EtapeLead = 'a_traiter' | 'contacte' | 'qualifie' | 'gagne' | 'perdu'

export const ETAPES: { id: EtapeLead; label: string; aide: string }[] = [
  { id: 'a_traiter', label: 'À traiter', aide: 'Personne ne l’a encore joint' },
  { id: 'contacte', label: 'Contacté', aide: 'Premier échange fait' },
  { id: 'qualifie', label: 'Qualifié', aide: 'Besoin identifié, proposition en cours' },
  { id: 'gagne', label: 'Gagné', aide: 'Dossier créé ou devenu client' },
  { id: 'perdu', label: 'Perdu', aide: 'Sans suite' },
]

export function etapeDuLead(lead: { status: LeadStatus | string; converted_client_id?: string | null }): EtapeLead {
  // « Perdu » choisi à l'écran prime, même sur un lead relié à un client
  if (lead.status === 'perdu') return 'perdu'
  if (lead.converted_client_id || lead.status === 'gagne') return 'gagne'
  if (lead.status === 'nouveau') return 'a_traiter'
  if (lead.status === 'contacte') return 'contacte'
  // qualification, proposition_envoyee, negociation : l'ancien pipeline les distinguait
  return 'qualifie'
}

/** Statut enregistré pour une étape choisie à l'écran. */
export const STATUT_DE_L_ETAPE: Record<EtapeLead, LeadStatus> = {
  a_traiter: 'nouveau',
  contacte: 'contacte',
  qualifie: 'qualification',
  gagne: 'gagne',
  perdu: 'perdu',
}

export const MOTIFS_PERTE = [
  'Injoignable',
  'Pas intéressé',
  'Pas de financement possible',
  'Déjà formé ailleurs',
  'Hors cible',
  'Doublon',
] as const

/** Numéro pour un lien WhatsApp (wa.me) : 06… → 336… ; null si inexploitable. */
export function numeroWhatsapp(tel: string | null | undefined): string | null {
  let chiffres = String(tel || '').replace(/\D/g, '')
  if (!chiffres) return null
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2)
  if (chiffres.length === 10 && chiffres.startsWith('0')) chiffres = `33${chiffres.slice(1)}`
  return chiffres.length >= 11 && chiffres.length <= 15 ? chiffres : null
}

/** Délai lisible : « 12 min », « 2 h 15 », « 3 j ». */
export function dureeLisible(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 48) {
    const reste = minutes % 60
    return reste ? `${heures} h ${String(reste).padStart(2, '0')}` : `${heures} h`
  }
  return `${Math.round(heures / 24)} j`
}
