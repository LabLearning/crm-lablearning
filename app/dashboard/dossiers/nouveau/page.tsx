import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NouveauDossierWizard } from './NouveauDossierWizard'

export const dynamic = 'force-dynamic'

/**
 * Nouveau dossier en un geste : client → apprenants → formation → la session
 * est créée avec ses inscriptions. Le circuit commercial direct — les leads
 * restent réservés aux demandes entrantes du site web.
 */
export default async function NouveauDossierPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [{ data: clients }, { data: formations }, { data: formateurs }] = await Promise.all([
    supabase.from('clients')
      .select('id, raison_sociale, nom_commercial, siret, ville')
      .eq('organization_id', orgId).eq('type', 'entreprise')
      .order('raison_sociale'),
    // Une POEI ne passe pas par un dossier OPCO : elle se crée dans le module POEI
    supabase.from('formations')
      .select('id, intitule, duree_heures, duree_jours')
      .eq('organization_id', orgId).eq('is_active', true).or('is_poei.is.null,is_poei.eq.false')
      .order('intitule'),
    supabase.from('formateurs')
      .select('id, prenom, nom')
      .eq('organization_id', orgId).eq('is_active', true)
      .order('nom'),
  ])

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <NouveauDossierWizard
        clients={(clients || []) as any[]}
        formations={(formations || []) as any[]}
        formateurs={(formateurs || []) as any[]}
      />
    </div>
  )
}
