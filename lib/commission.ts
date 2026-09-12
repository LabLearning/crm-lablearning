/**
 * Calcul des commissions franchise.
 *
 * Deux modes (configurés par franchise via apporteurs_affaires.commission_type) :
 *   - 'budget_debloque' : taux% × montant_prise_en_charge        (ex: 10%)
 *   - 'budget_net'      : taux% × (prise_en_charge - cout_formateur) (ex: 40%)
 *
 * Le montant obtenu est un montant TTC : c'est ce que la franchise facture,
 * elle n'ajoute pas de TVA par-dessus.
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

/**
 * Les montants de commission sont des montants TTC : la franchise les facture
 * tels quels, sans ajouter de TVA par-dessus.
 */
export function commissionTypeLabel(type: CommissionType | string | null): string {
  if (type === 'budget_net') return '40% TTC du budget net (après frais formateur)'
  return '10% TTC du budget débloqué'
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
  opts?: { force?: boolean },
): Promise<{ montant: number; type: CommissionType; coutFormateur: number } | null> {
  const { data: dossier } = await supabase
    .from('dossiers_formation')
    .select('id, client_id, session_id, franchise_id, montant_prise_en_charge, commission_status, cout_formateur_manuel')
    .eq('id', dossierId)
    .eq('organization_id', organizationId)
    .single()

  if (!dossier) return null

  // Ne pas toucher si commission figée (validée/payée) — sauf recalcul forcé
  // (ex : correction manuelle des frais formateur après validation).
  if (!opts?.force && (dossier.commission_status === 'validee' || dossier.commission_status === 'payee')) {
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
  let nbJours = 1
  if (dossier.session_id) {
    const { data: contrats } = await supabase
      .from('contrats_formateur')
      .select('montant_ht')
      .eq('session_id', dossier.session_id)
      .neq('status', 'annule')
    coutFormateur = (contrats || []).reduce((s: number, c: any) => s + Number(c.montant_ht || 0), 0)

    // Nombre de jours de la session (pour le tarif journalier manuel)
    const { data: sess } = await supabase
      .from('sessions')
      .select('horaires_jours, formation:formation_id(duree_jours)')
      .eq('id', dossier.session_id)
      .maybeSingle()
    const nbHoraires = Array.isArray(sess?.horaires_jours) ? sess.horaires_jours.length : 0
    nbJours = Math.max(1, nbHoraires || Number((sess?.formation as any)?.duree_jours) || 1)
  }
  // Aucun contrat formateur → tarif JOURNALIER saisi × nombre de jours
  if (coutFormateur <= 0 && dossier.cout_formateur_manuel != null) {
    coutFormateur = (Number(dossier.cout_formateur_manuel) || 0) * nbJours
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

// ─── Commission PAR SESSION (modèle courant) ────────────────────────────────
//
// La session est l'unité réelle de l'activité (imports Dendreo, POEI,
// sessions directes). Une ligne `commissions_sessions` par session d'un
// établissement rattaché à une franchise ; même règle de calcul que les
// dossiers, base = prise en charge OPCO de la session, à défaut son prix HT.

export interface SessionCommissionResult {
  montant: number
  base: number
  baseSource: 'opco' | 'prix_ht' | 'factures' | 'poei' | 'aucune'
  coutFormateur: number
  type: CommissionType
  status: CommissionStatus
}

/** Ligne `commissions_sessions` déjà enregistrée, telle que relue. */
export interface CommissionSessionExistante {
  status: CommissionStatus | string | null
  commission_montant: number | string | null
  base_montant: number | string | null
  base_source: string | null
  cout_formateur: number | string | null
  cout_formateur_manuel?: number | string | null
  commission_type: string | null
}

/** Tout ce que le calcul d'une commission de session doit connaître, déjà lu. */
export interface EntreeCommissionSession {
  franchiseId: string | null
  franchise: { commission_type: string | null; taux_commission: number | string | null } | null
  estPoei: boolean
  nbInscritsActifs: number
  sessionAnnulee: boolean
  montantFinanceOpco: number | null
  prixHt: number | null
  /** Σ montant_ht des factures de la session (session_id), hors brouillons et annulées, toutes origines */
  totalFacturesSession: number
  /** Σ montant_ht des contrats formateur non annulés de la session */
  coutContratsHt: number
  coutFormateurManuelJour: number | null
  /** max(1, jours planifiés || durée catalogue || 1) */
  nbJours: number
  coutFormateurSession: number | null
  existante: CommissionSessionExistante | null
}

export type MotifSansCommission = 'sans_franchise' | 'poei' | 'sans_inscrit' | 'franchise_introuvable'

export type ResultatCommissionSession =
  | { kind: 'aucune'; motif: MotifSansCommission; figee: SessionCommissionResult | null }
  | { kind: 'calculee'; fige: boolean; resultat: SessionCommissionResult; taux: number }

const estFigee = (e: CommissionSessionExistante | null) =>
  !!e && (e.status === 'validee' || e.status === 'payee')

function snapshotCommission(e: CommissionSessionExistante): SessionCommissionResult {
  return {
    montant: Number(e.commission_montant || 0), base: Number(e.base_montant || 0),
    baseSource: (e.base_source as SessionCommissionResult['baseSource']) || 'aucune',
    coutFormateur: Number(e.cout_formateur || 0),
    type: (e.commission_type as CommissionType) || 'budget_debloque',
    status: e.status as CommissionStatus,
  }
}

/**
 * Calcul pur de la commission franchise d'une session (aucune lecture, aucune
 * écriture). Même règle que recalcSessionCommission, qui lui délègue : la
 * marge d'une session affiche ainsi exactement ce que la franchise touchera.
 */
export function calculerCommissionSession(e: EntreeCommissionSession & { force?: boolean }): ResultatCommissionSession {
  const figee = estFigee(e.existante) ? snapshotCommission(e.existante!) : null

  if (!e.franchiseId) return { kind: 'aucune', motif: 'sans_franchise', figee }
  // Les POEI sont HORS commission franchise pour l'instant (décision Brahim,
  // 08/09/2026 : leur économie demande un calcul spécifique, à traiter à part).
  if (e.estPoei) return { kind: 'aucune', motif: 'poei', figee }
  // Une session sans aucun inscrit (résidu d'import, doublon) n'est pas une
  // formation délivrée : pas de ligne de commission.
  if (!e.nbInscritsActifs) return { kind: 'aucune', motif: 'sans_inscrit', figee }
  if (figee && !e.force) {
    const type: CommissionType = (e.franchise?.commission_type as CommissionType) || figee.type
    return { kind: 'calculee', fige: true, resultat: figee, taux: Number(e.franchise?.taux_commission || (type === 'budget_net' ? 40 : 10)) }
  }
  if (!e.franchise) return { kind: 'aucune', motif: 'franchise_introuvable', figee }

  const type: CommissionType = (e.franchise.commission_type as CommissionType) || 'budget_debloque'
  const taux = Number(e.franchise.taux_commission || (type === 'budget_net' ? 40 : 10))

  // Base : prise en charge OPCO de la session, sinon prix HT, sinon ce qui a
  // été facturé pour la session (factures rattachées, hors brouillons et annulées).
  const opco = Number(e.montantFinanceOpco || 0)
  const prix = Number(e.prixHt || 0)
  let base = opco > 0 ? opco : prix
  let baseSource: SessionCommissionResult['baseSource'] = opco > 0 ? 'opco' : prix > 0 ? 'prix_ht' : 'aucune'
  if (base <= 0) {
    const facture = Number(e.totalFacturesSession || 0)
    if (facture > 0) { base = facture; baseSource = 'factures' }
  }
  // Coût formateur de la session : contrats, sinon tarif journalier saisi × jours, sinon champ session
  let coutFormateur = Number(e.coutContratsHt || 0)
  if (coutFormateur <= 0 && e.coutFormateurManuelJour != null) {
    coutFormateur = (Number(e.coutFormateurManuelJour) || 0) * Math.max(1, e.nbJours || 1)
  }
  if (coutFormateur <= 0) coutFormateur = Number(e.coutFormateurSession || 0)

  const { montant } = computeCommission({ type, taux, montantPriseEnCharge: base, coutFormateur })
  const exStatus = e.existante?.status
  const status: CommissionStatus = e.sessionAnnulee
    ? 'annulee'
    : (exStatus && exStatus !== 'annulee' ? exStatus as CommissionStatus : 'a_venir')

  return { kind: 'calculee', fige: false, resultat: { montant, base, baseSource, coutFormateur, type, status }, taux }
}

/**
 * Recalcule et persiste la commission d'une session.
 * - Franchise déduite de l'établissement (clients.franchise_id) : sans
 *   franchise, la ligne éventuelle est supprimée.
 * - Coût formateur : contrats formateur de la session, sinon tarif journalier
 *   saisi × nombre de jours, sinon le champ cout_formateur de la session.
 * - N'écrase PAS une commission validée/payée (snapshot figé), sauf force.
 * - Une session annulée garde sa ligne au statut 'annulee' (hors totaux).
 */
export async function recalcSessionCommission(
  supabase: any,
  sessionId: string,
  organizationId: string,
  opts?: { force?: boolean },
): Promise<SessionCommissionResult | null> {
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, client_id, status, prix_ht, montant_finance_opco, cout_formateur, horaires_jours, poei_intervention_id, formation:formation_id(duree_jours), client:client_id(franchise_id)')
    .eq('id', sessionId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!sess) return null

  const franchiseId: string | null = (sess.client as any)?.franchise_id || null
  const [{ data: existante }, { data: poei }, { count: nbInscrits }, franchiseRes, { data: factures }, { data: contrats }] = await Promise.all([
    supabase.from('commissions_sessions')
      .select('id, status, cout_formateur_manuel, commission_montant, base_montant, base_source, cout_formateur, commission_type')
      .eq('session_id', sessionId).maybeSingle(),
    supabase.from('poei').select('id').eq('session_id', sessionId).maybeSingle(),
    supabase.from('inscriptions').select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")'),
    franchiseId
      ? supabase.from('franchises').select('commission_type, taux_commission').eq('id', franchiseId).single()
      : Promise.resolve({ data: null }),
    supabase.from('factures').select('montant_ht, status').eq('session_id', sessionId)
      .not('status', 'in', '("brouillon","annulee")'),
    supabase.from('contrats_formateur').select('montant_ht').eq('session_id', sessionId).neq('status', 'annule'),
  ])
  const retirer = async () => {
    if (existante && !['validee', 'payee'].includes(existante.status)) {
      await supabase.from('commissions_sessions').delete().eq('id', existante.id)
    }
    return null
  }

  const nbHoraires = Array.isArray(sess.horaires_jours) ? sess.horaires_jours.length : 0
  const r = calculerCommissionSession({
    franchiseId,
    franchise: (franchiseRes as any)?.data || null,
    estPoei: !!poei || !!sess.poei_intervention_id,
    nbInscritsActifs: nbInscrits || 0,
    sessionAnnulee: sess.status === 'annulee',
    montantFinanceOpco: sess.montant_finance_opco,
    prixHt: sess.prix_ht,
    totalFacturesSession: (factures || []).reduce((s: number, f: any) => s + Number(f.montant_ht || 0), 0),
    coutContratsHt: (contrats || []).reduce((s: number, c: any) => s + Number(c.montant_ht || 0), 0),
    coutFormateurManuelJour: existante?.cout_formateur_manuel ?? null,
    nbJours: Math.max(1, nbHoraires || Number((sess.formation as any)?.duree_jours) || 1),
    coutFormateurSession: sess.cout_formateur,
    existante: existante || null,
    force: opts?.force,
  })

  if (r.kind === 'aucune') {
    if (r.motif === 'franchise_introuvable') return null
    return retirer()
  }
  if (r.fige) return r.resultat

  const { montant, base, baseSource, coutFormateur, type, status } = r.resultat
  await supabase.from('commissions_sessions').upsert({
    organization_id: organizationId,
    franchise_id: franchiseId,
    session_id: sessionId,
    client_id: sess.client_id,
    base_montant: base,
    base_source: baseSource,
    cout_formateur: coutFormateur,
    commission_type: type,
    commission_taux: r.taux,
    commission_montant: montant,
    status,
    calculee_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'session_id' })

  return r.resultat
}

/**
 * Aligne les lignes de commission d'une franchise sur ses sessions : une
 * ligne par session de ses établissements (créée ou recalculée si non figée).
 * @returns le nombre de sessions traitées.
 */
export async function syncFranchiseCommissions(supabase: any, franchiseId: string, organizationId: string): Promise<number> {
  const { data: clients } = await supabase
    .from('clients').select('id').eq('franchise_id', franchiseId).eq('organization_id', organizationId)
  const clientIds = (clients || []).map((c: any) => c.id)
  if (!clientIds.length) return 0
  const sessions: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('sessions').select('id')
      .eq('organization_id', organizationId).in('client_id', clientIds).range(from, from + 999)
    if (!data?.length) break
    sessions.push(...data)
    if (data.length < 1000) break
  }
  for (const s of sessions) await recalcSessionCommission(supabase, s.id, organizationId)
  return sessions.length
}
