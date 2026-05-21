/**
 * Calcul des commissions franchise.
 *
 * Deux modes (configurés par franchise via apporteurs_affaires.commission_type) :
 *   - 'budget_debloque' : taux% × montant_prise_en_charge        (ex: 10%)
 *   - 'budget_net'      : taux% × (prise_en_charge - cout_formateur) (ex: 40%)
 */

export type CommissionType = 'budget_debloque' | 'budget_net'
export type CommissionStatus = 'a_venir' | 'validee' | 'payee' | 'annulee'

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeCommission(params: {
  type: CommissionType
  taux: number // pourcentage, ex: 10 ou 40
  montantPriseEnCharge: number
  coutFormateur: number
}): { montant: number; base: number } {
  const taux = Number(params.taux || 0)
  const pec = Number(params.montantPriseEnCharge || 0)
  const cf = Number(params.coutFormateur || 0)

  if (params.type === 'budget_net') {
    const base = Math.max(0, pec - cf)
    return { base, montant: round2(base * (taux / 100)) }
  }
  // budget_debloque (par défaut)
  return { base: pec, montant: round2(pec * (taux / 100)) }
}

export function commissionTypeLabel(type: CommissionType | string | null): string {
  if (type === 'budget_net') return '40% du budget net (après frais formateur)'
  return '10% du budget débloqué'
}

export function commissionStatusLabel(status: CommissionStatus | string | null): string {
  switch (status) {
    case 'validee': return 'Validée'
    case 'payee': return 'Payée'
    case 'annulee': return 'Annulée'
    default: return 'À venir'
  }
}

/**
 * Recalcule et persiste la commission d'un dossier.
 * - Détermine la franchise (dossier.franchise_id ou client.franchise_id).
 * - Récupère le coût formateur via la session liée (contrats_formateur.montant_ht).
 * - N'écrase PAS une commission déjà validée/payée (snapshot figé).
 *
 * @returns le montant calculé, ou null si pas de franchise rattachée.
 */
export async function recalcDossierCommission(
  supabase: any,
  dossierId: string,
  organizationId: string,
): Promise<{ montant: number; type: CommissionType; coutFormateur: number } | null> {
  const { data: dossier } = await supabase
    .from('dossiers_formation')
    .select('id, client_id, session_id, franchise_id, montant_prise_en_charge, commission_status')
    .eq('id', dossierId)
    .eq('organization_id', organizationId)
    .single()

  if (!dossier) return null

  // Ne pas toucher si commission figée (validée/payée)
  if (dossier.commission_status === 'validee' || dossier.commission_status === 'payee') {
    return null
  }

  // Déterminer la franchise : sur le dossier, sinon via le client
  let franchiseId: string | null = dossier.franchise_id
  if (!franchiseId && dossier.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('franchise_id')
      .eq('id', dossier.client_id)
      .single()
    franchiseId = client?.franchise_id || null
  }

  if (!franchiseId) {
    // Pas de franchise → on nettoie les champs commission
    await supabase
      .from('dossiers_formation')
      .update({
        franchise_id: null,
        commission_montant: null,
        commission_taux: null,
        commission_type: null,
      })
      .eq('id', dossierId)
    return null
  }

  // Config commission de la franchise
  const { data: franchise } = await supabase
    .from('franchises')
    .select('commission_type, taux_commission')
    .eq('id', franchiseId)
    .single()
  if (!franchise) return null

  const type: CommissionType = (franchise.commission_type as CommissionType) || 'budget_debloque'
  const taux = Number(franchise.taux_commission || (type === 'budget_net' ? 40 : 10))

  // Coût formateur via la session du dossier (somme des contrats signés/émis)
  let coutFormateur = 0
  if (dossier.session_id) {
    const { data: contrats } = await supabase
      .from('contrats_formateur')
      .select('montant_ht')
      .eq('session_id', dossier.session_id)
      .neq('status', 'annule')
    coutFormateur = (contrats || []).reduce((s: number, c: any) => s + Number(c.montant_ht || 0), 0)
  }

  const { montant } = computeCommission({
    type,
    taux,
    montantPriseEnCharge: Number(dossier.montant_prise_en_charge || 0),
    coutFormateur,
  })

  await supabase
    .from('dossiers_formation')
    .update({
      franchise_id: franchiseId,
      cout_formateur: coutFormateur,
      commission_type: type,
      commission_taux: taux,
      commission_montant: montant,
      commission_status: dossier.commission_status || 'a_venir',
      commission_calculee_at: new Date().toISOString(),
    })
    .eq('id', dossierId)

  return { montant, type, coutFormateur }
}
