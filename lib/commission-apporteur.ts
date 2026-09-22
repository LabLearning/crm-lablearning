/**
 * Commissions d'apporteur d'affaires, session par session.
 *
 * Un apporteur touche une commission sur chaque formation réalisée chez un
 * établissement qu'il a apporté (clients.apporteur_id), pendant la durée de
 * son contrat. La base retenue suit la même priorité que pour les
 * franchises : montant financé par l'OPCO, sinon prix HT de la session,
 * sinon total HT facturé. Le montant vient du mode de calcul de
 * l'apporteur : pourcentage de la base, ou montant fixe par session.
 *
 * États : en_attente (session terminée, client pas encore encaissé),
 * validee (à verser : toutes les factures de la session sont payées),
 * payee (versée), annulee. Une ligne validée, payée ou annulée est figée :
 * un recalcul ne la réécrit jamais.
 *
 * Ce module n'importe rien de côté serveur : il est partagé avec les
 * composants client (libellés, totaux). Les notifications vivent dans
 * lib/apporteur-notify.ts.
 */

export type StatutCommissionApporteur = 'en_attente' | 'validee' | 'payee' | 'annulee'

export const LIBELLES_STATUT_COMMISSION: Record<StatutCommissionApporteur, string> = {
  en_attente: 'En attente d’encaissement',
  validee: 'À verser',
  payee: 'Versée',
  annulee: 'Annulée',
}

export interface ApporteurCommissionnable {
  id: string
  organization_id?: string
  nom?: string | null
  prenom?: string | null
  raison_sociale?: string | null
  nom_enseigne?: string | null
  is_active?: boolean | null
  taux_commission?: number | string | null
  commission_fixe?: number | string | null
  mode_calcul?: string | null
  date_debut_contrat?: string | null
  date_fin_contrat?: string | null
}

export interface SessionCommissionnable {
  id: string
  client_id: string | null
  reference?: string | null
  intitule?: string | null
  status?: string | null
  date_debut?: string | null
  date_fin?: string | null
  prix_ht?: number | string | null
  montant_finance_opco?: number | string | null
  formation?: { intitule?: string | null; is_poei?: boolean | null } | null
  client?: { raison_sociale?: string | null; nom_commercial?: string | null } | null
}

export interface FactureSession { session_id: string | null; montant_ht: number | string | null; status: string | null }

/** Ligne de la table commissions, avec la session et l'établissement joints. */
export interface CommissionApporteurLigne {
  id: string
  apporteur_id: string
  session_id: string | null
  client_id: string | null
  lead_id: string | null
  poei_id?: string | null
  libelle: string | null
  date_session: string | null
  origine: string | null
  montant_base: number | string | null
  taux_applique: number | string | null
  montant_commission: number | string | null
  mode_calcul: string | null
  status: string
  date_validation: string | null
  date_paiement: string | null
  reference_paiement: string | null
  notes: string | null
  created_at: string
  session?: {
    id: string; reference: string | null; intitule: string | null; date_debut: string | null; date_fin: string | null; status: string | null
    formation?: { intitule: string | null } | null
  } | null
  client?: { id: string; raison_sociale: string | null; nom_commercial: string | null; ville: string | null } | null
  lead?: { entreprise: string | null; contact_nom: string | null } | null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const positif = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Nom affiché d'un apporteur : enseigne, raison sociale, sinon la personne. */
export function nomApporteur(a: ApporteurCommissionnable): string {
  return a.nom_enseigne || a.raison_sociale || `${a.prenom || ''} ${a.nom || ''}`.trim() || 'Apporteur'
}

/** Phrase qui résume la règle de commission d'un apporteur. */
export function descriptionCommission(a: ApporteurCommissionnable): string {
  if (a.mode_calcul === 'fixe') {
    const fixe = positif(a.commission_fixe)
    return fixe != null ? `${fixe.toLocaleString('fr-FR')} € par formation réalisée` : 'Montant fixe à renseigner'
  }
  const taux = positif(a.taux_commission)
  return taux != null ? `${taux.toLocaleString('fr-FR')} % du montant HT de chaque formation réalisée` : 'Taux à renseigner'
}

/** Titre d'une ligne : la formation et l'établissement, ou le libellé enregistré. */
export function libelleLigne(l: CommissionApporteurLigne): { titre: string; sousTitre: string } {
  const formation = l.session?.formation?.intitule || l.session?.intitule || null
  const etab = l.client?.nom_commercial || l.client?.raison_sociale || l.lead?.entreprise || null
  if (formation) return { titre: formation, sousTitre: [etab, l.session?.reference].filter(Boolean).join(' · ') }
  if (l.libelle) {
    const [t, ...reste] = l.libelle.split(' · ')
    return { titre: t, sousTitre: reste.join(' · ') || etab || '' }
  }
  return { titre: etab || 'Commission', sousTitre: l.lead?.contact_nom || '' }
}

/** Base de calcul d'une session : OPCO, sinon prix HT, sinon factures HT. */
export function baseCommission(s: SessionCommissionnable, factures: FactureSession[]): { base: number | null; source: string } {
  const opco = positif(s.montant_finance_opco)
  if (opco) return { base: opco, source: 'montant financé par l’OPCO' }
  const prix = positif(s.prix_ht)
  if (prix) return { base: prix, source: 'prix HT de la session' }
  const fact = factures.filter((f) => f.session_id === s.id && f.status !== 'annulee').reduce((t, f) => t + Number(f.montant_ht || 0), 0)
  if (fact > 0) return { base: round2(fact), source: 'total HT facturé' }
  return { base: null, source: 'aucun montant connu' }
}

/** L'apporteur est-il sous contrat à cette date ? */
export function sousContrat(a: ApporteurCommissionnable, date: string | null | undefined): boolean {
  if (a.is_active === false) return false
  if (!date) return true
  if (a.date_debut_contrat && date < a.date_debut_contrat) return false
  if (a.date_fin_contrat && date > a.date_fin_contrat) return false
  return true
}

/** Montant de la commission selon le mode de l'apporteur. */
export function montantCommission(a: ApporteurCommissionnable, base: number | null): { montant: number | null; taux: number | null; detail: string } {
  if (a.mode_calcul === 'fixe') {
    const fixe = positif(a.commission_fixe)
    return { montant: fixe != null ? round2(fixe) : null, taux: null, detail: fixe != null ? 'montant fixe par session' : 'montant fixe à renseigner' }
  }
  const taux = positif(a.taux_commission)
  if (taux == null) return { montant: null, taux: null, detail: 'taux à renseigner' }
  if (base == null) return { montant: null, taux, detail: `${taux} % d’une base inconnue` }
  return { montant: round2((taux / 100) * base), taux, detail: `${taux} % de la base` }
}

export interface LigneCommissionCalculee {
  session_id: string
  client_id: string | null
  libelle: string
  date_session: string | null
  montant_base: number
  taux_applique: number | null
  montant_commission: number
  mode_calcul: string
  encaisse: boolean
  source: string
}

export interface ResultatSync {
  apporteurs: number
  lignes: LigneCommissionCalculee[]
  creees: number
  misesAJour: number
  validees: number
  supprimees: number
  sansMontant: string[]
}

/**
 * Recalcule et enregistre les commissions d'un apporteur (ou de tous).
 *
 * Lit les clients rattachés, leurs sessions terminées (hors parcours POEI,
 * facturés à France Travail), les factures de ces sessions, puis écrit une
 * ligne par session : nouvelle ou en attente, jamais une ligne validée,
 * payée ou annulée. Une session déjà encaissée passe d'elle-même « à
 * verser ». Les lignes en attente dont la session n'est plus commissionnable
 * (client réaffecté, contrat terminé) sont retirées. En mode essai, rien
 * n'est écrit.
 */
export async function syncCommissionsApporteur(
  supabase: any,
  orgId: string,
  options: { apporteurId?: string | null; essai?: boolean } = {},
): Promise<ResultatSync> {
  let q = supabase.from('apporteurs_affaires').select('*').eq('organization_id', orgId)
  if (options.apporteurId) q = q.eq('id', options.apporteurId)
  const { data: apporteurs } = await q
  const resultat: ResultatSync = { apporteurs: 0, lignes: [], creees: 0, misesAJour: 0, validees: 0, supprimees: 0, sansMontant: [] }

  for (const a of (apporteurs || []) as ApporteurCommissionnable[]) {
    resultat.apporteurs++
    const traitees = await traiterApporteur(supabase, orgId, a, resultat, !!options.essai)
    if (options.essai) continue
    // Lignes en attente devenues orphelines : session hors périmètre désormais
    const { data: orphelines } = await supabase.from('commissions').select('id, session_id')
      .eq('apporteur_id', a.id).eq('organization_id', orgId).eq('status', 'en_attente').not('session_id', 'is', null)
    const aSupprimer = ((orphelines || []) as any[]).filter((o) => !traitees.has(o.session_id)).map((o) => o.id)
    if (aSupprimer.length) {
      const { error } = await supabase.from('commissions').delete().in('id', aSupprimer)
      if (!error) resultat.supprimees += aSupprimer.length
    }
  }
  return resultat
}

async function traiterApporteur(supabase: any, orgId: string, a: ApporteurCommissionnable, resultat: ResultatSync, essai: boolean): Promise<Set<string>> {
  const traitees = new Set<string>()
  const { data: clients } = await supabase.from('clients').select('id').eq('organization_id', orgId).eq('apporteur_id', a.id)
  const clientIds = (clients || []).map((c: any) => c.id)
  if (!clientIds.length) return traitees

  // Sessions terminées des établissements apportés (hors parcours POEI)
  const { data: sessions } = await supabase.from('sessions')
    .select('id, client_id, reference, intitule, status, date_debut, date_fin, prix_ht, montant_finance_opco, formation:formation_id(intitule, is_poei), client:client_id(raison_sociale, nom_commercial)')
    .eq('organization_id', orgId).in('client_id', clientIds).eq('status', 'terminee')
  const liste = ((sessions || []) as SessionCommissionnable[]).filter((s) => !s.formation?.is_poei)
  if (!liste.length) return traitees
  const ids = liste.map((s) => s.id)
  const [{ data: poeiLies }, { data: factures }, { data: existantes }] = await Promise.all([
    supabase.from('poei').select('session_id').in('session_id', ids),
    supabase.from('factures').select('session_id, montant_ht, status').in('session_id', ids),
    supabase.from('commissions').select('id, session_id, status, montant_commission').eq('apporteur_id', a.id).in('session_id', ids),
  ])
  const sessionsPoei = new Set(((poeiLies || []) as any[]).map((p) => p.session_id))
  const parSession = new Map(((existantes || []) as any[]).map((e) => [e.session_id, e]))
  const toutesFactures = (factures || []) as FactureSession[]

  for (const s of liste) {
    if (sessionsPoei.has(s.id)) continue
    if (!sousContrat(a, s.date_debut)) continue
    const { base, source } = baseCommission(s, toutesFactures)
    const { montant, taux, detail } = montantCommission(a, base)
    const libelle = `${s.formation?.intitule || s.intitule || s.reference || 'Formation'} · ${s.client?.nom_commercial || s.client?.raison_sociale || 'établissement'}`
    if (montant == null || base == null) { resultat.sansMontant.push(`${libelle} (${base == null ? source : detail})`); continue }
    traitees.add(s.id)
    const facts = toutesFactures.filter((f) => f.session_id === s.id && f.status !== 'annulee')
    const encaisse = facts.length > 0 && facts.every((f) => f.status === 'payee')
    const ligne: LigneCommissionCalculee = {
      session_id: s.id, client_id: s.client_id, libelle, date_session: s.date_debut || null,
      montant_base: base, taux_applique: taux, montant_commission: montant, mode_calcul: a.mode_calcul === 'fixe' ? 'fixe' : 'pourcentage', encaisse, source,
    }
    resultat.lignes.push(ligne)
    if (essai) continue

    const existante = parSession.get(s.id)
    if (!existante) {
      const { error } = await supabase.from('commissions').insert({
        organization_id: orgId, apporteur_id: a.id, session_id: s.id, client_id: s.client_id, origine: 'session',
        libelle, date_session: ligne.date_session, montant_base: base, taux_applique: taux, montant_commission: montant,
        mode_calcul: ligne.mode_calcul, status: encaisse ? 'validee' : 'en_attente', date_validation: encaisse ? new Date().toISOString() : null,
      })
      if (!error) { resultat.creees++; if (encaisse) resultat.validees++ }
    } else if (existante.status === 'en_attente') {
      // Ligne encore vivante : elle suit le dernier calcul et l'encaissement
      const patch: Record<string, unknown> = { libelle, date_session: ligne.date_session, montant_base: base, taux_applique: taux, montant_commission: montant, mode_calcul: ligne.mode_calcul, client_id: s.client_id }
      if (encaisse) { patch.status = 'validee'; patch.date_validation = new Date().toISOString(); resultat.validees++ }
      const { error } = await supabase.from('commissions').update(patch).eq('id', existante.id)
      if (!error) resultat.misesAJour++
    }
    // validee / payee / annulee : figées
  }
  // Une ligne figée reste rattachée même si la session sort du périmètre
  for (const e of parSession.values()) if (e.status !== 'en_attente') traitees.add(e.session_id)
  return traitees
}

/** Lignes d'un apporteur, session et établissement joints, les plus récentes d'abord. */
export async function chargerCommissionsApporteur(supabase: any, apporteurId: string, orgId: string): Promise<CommissionApporteurLigne[]> {
  const { data } = await supabase.from('commissions')
    .select('*, session:session_id(id, reference, intitule, date_debut, date_fin, status, formation:formation_id(intitule)), client:client_id(id, raison_sociale, nom_commercial, ville), lead:lead_id(entreprise, contact_nom)')
    .eq('apporteur_id', apporteurId).eq('organization_id', orgId)
    .order('date_session', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  return (data || []) as CommissionApporteurLigne[]
}

/** Totaux par état, pour les fiches et le portail. */
export function totauxCommissions(lignes: Array<{ status: string; montant_commission: number | string | null }>) {
  const t = { en_attente: 0, validee: 0, payee: 0, annulee: 0, nb: { en_attente: 0, validee: 0, payee: 0, annulee: 0 } }
  for (const l of lignes) {
    const s = (l.status as StatutCommissionApporteur) in t.nb ? (l.status as StatutCommissionApporteur) : 'en_attente'
    t[s] += Number(l.montant_commission || 0)
    t.nb[s]++
  }
  return t
}
