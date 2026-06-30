import { cache } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'

export interface PortalApprenantContext {
  type: 'apprenant'
  apprenant: {
    id: string; prenom: string; nom: string; email: string | null
    entreprise: string | null; situation_handicap: boolean
  }
  organization: { id: string; name: string; logo_url: string | null; primary_color: string }
  token: string
}

export interface PortalFormateurContext {
  type: 'formateur'
  formateur: {
    id: string; prenom: string; nom: string; email: string | null
    domaines_expertise: string[]; type_contrat: string
  }
  organization: { id: string; name: string; logo_url: string | null; primary_color: string }
  token: string
}

export interface PortalClientContext {
  type: 'client'
  client: {
    id: string; raison_sociale: string | null; type: string
    email: string | null; telephone: string | null
  }
  contact: {
    id: string; prenom: string; nom: string; email: string | null
  } | null
  organization: { id: string; name: string; logo_url: string | null; primary_color: string }
  token: string
}

export interface PortalApporteurContext {
  type: 'apporteur'
  apporteur: {
    id: string; nom: string; prenom: string | null; email: string | null
    telephone: string | null; taux_commission: number | null
    mode_calcul: string | null; is_active: boolean
    categorie: string | null; nom_enseigne: string | null
    raison_sociale: string | null; nombre_points_vente: number | null
    secteur: string | null; zone_geographique: string | null
    objectif_annuel_ca: number | null; objectif_annuel_dossiers: number | null
  }
  organization: { id: string; name: string; logo_url: string | null; primary_color: string }
  token: string
}

export type PortalContext = PortalApprenantContext | PortalFormateurContext | PortalClientContext | PortalApporteurContext

export const getPortalContext = cache(async function getPortalContext(token: string): Promise<PortalContext | null> {
  const supabase = await createServiceRoleClient()

  const { data: tokenData } = await supabase
    .from('portal_access_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!tokenData) return null

  // Check expiration
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) return null

  // Maj last_used_at + fetch organization en parallèle (l'update ne bloque plus le rendu)
  const [, { data: org }] = await Promise.all([
    supabase
      .from('portal_access_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenData.id),
    supabase
      .from('organizations')
      .select('id, name, logo_url, primary_color')
      .eq('id', tokenData.organization_id)
      .single(),
  ])

  if (!org) return null

  if (tokenData.type === 'apprenant' && tokenData.apprenant_id) {
    const { data: apprenant } = await supabase
      .from('apprenants')
      .select('id, prenom, nom, email, entreprise, situation_handicap')
      .eq('id', tokenData.apprenant_id)
      .single()

    if (!apprenant) return null

    return { type: 'apprenant', apprenant, organization: org, token }
  }

  if (tokenData.type === 'formateur' && tokenData.formateur_id) {
    const { data: formateur } = await supabase
      .from('formateurs')
      .select('id, prenom, nom, email, domaines_expertise, type_contrat')
      .eq('id', tokenData.formateur_id)
      .single()

    if (!formateur) return null

    return { type: 'formateur', formateur, organization: org, token }
  }

  if (tokenData.type === 'client') {
    // Find client via contact email
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, prenom, nom, email, client_id')
      .eq('email', tokenData.email)
      .eq('organization_id', tokenData.organization_id)
      .single()

    if (contact && contact.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, raison_sociale, type, email, telephone')
        .eq('id', contact.client_id)
        .single()

      if (client) {
        return { type: 'client', client, contact: { id: contact.id, prenom: contact.prenom, nom: contact.nom, email: contact.email }, organization: org, token }
      }
    }

    // Fallback: find client directly by email
    const { data: clientDirect } = await supabase
      .from('clients')
      .select('id, raison_sociale, type, email, telephone')
      .eq('email', tokenData.email)
      .eq('organization_id', tokenData.organization_id)
      .single()

    if (clientDirect) {
      return { type: 'client', client: clientDirect, contact: null, organization: org, token }
    }

    return null
  }

  if (tokenData.type === 'apporteur') {
    const { data: apporteur } = await supabase
      .from('apporteurs_affaires')
      .select('id, nom, prenom, email, telephone, taux_commission, mode_calcul, is_active, categorie, nom_enseigne, raison_sociale, nombre_points_vente, secteur, zone_geographique, objectif_annuel_ca, objectif_annuel_dossiers')
      .eq('email', tokenData.email)
      .eq('organization_id', tokenData.organization_id)
      .single()

    if (apporteur) {
      return { type: 'apporteur', apporteur, organization: org, token }
    }

    return null
  }

  return null
})
