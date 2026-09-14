import type { CommissionStatus } from '@/lib/commission'

/**
 * Agrégations de données pour le portail franchise, assises sur les SESSIONS
 * des établissements rattachés (l'unité réelle de l'activité), et sur les
 * commissions par session (commissions_sessions).
 * Tout est scopé par franchise_id + organization_id.
 */

export interface FranchiseStats {
  nbEtablissements: number
  nbEtablissementsFormes: number
  /** Conservé pour compatibilité : = nombre de sessions. */
  nbDossiers: number
  nbSessions: number
  nbSessionsRealisees: number
  nbParticipants: number
  nbPresences: number
  nbAbsences: number
  tauxPresence: number | null
  /** Prise en charge des sessions réalisées (base de calcul des commissions). */
  caGenere: number
  priseEnChargeTotal: number
  commissionAVenir: number
  commissionValidee: number
  commissionPayee: number
  commissionTotale: number
  /** Sessions sans montant renseigné (ni prise en charge OPCO ni prix HT). */
  nbSessionsSansMontant: number
}

async function tout<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999)
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function getFranchiseStats(
  supabase: any,
  franchiseId: string,
  orgId: string,
): Promise<FranchiseStats> {
  // Établissements rattachés
  const { data: clients } = await supabase
    .from('clients').select('id').eq('franchise_id', franchiseId).eq('organization_id', orgId)
  const clientIds = (clients || []).map((c: any) => c.id)

  // Ce qui compte = les sessions qui portent une ligne de commission : les
  // résidus d'import sans inscrit et les sessions d'intervention POEI (versant
  // coût d'un parcours) en sont exclus par le calcul.
  const { data: lignesCommission } = await supabase
    .from('commissions_sessions')
    .select('session_id, client_id, base_montant, commission_montant, status, session:session_id(status)')
    .eq('organization_id', orgId).eq('franchise_id', franchiseId).neq('status', 'annulee')
  const sessions = ((lignesCommission || []) as any[])
    .map((l) => ({ id: l.session_id, client_id: l.client_id, status: (Array.isArray(l.session) ? l.session[0] : l.session)?.status, base: Number(l.base_montant || 0), commission: Number(l.commission_montant || 0), statut_commission: l.status }))
    .filter((s) => s.status !== 'annulee')
  const sessionIds = sessions.map((s: any) => s.id)
  const realisees = sessions.filter((s: any) => s.status === 'terminee')
  const etablissementsFormes = new Set(sessions.map((s: any) => s.client_id).filter(Boolean))
  const baseDe = (s: any) => Number(s.base || 0)

  // Participants (inscriptions)
  let nbParticipants = 0
  if (sessionIds.length) {
    const { count } = await supabase
      .from('inscriptions').select('id', { count: 'exact', head: true })
      .in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")')
    nbParticipants = count || 0
  }

  // Présences / absences (émargements)
  let nbPresences = 0
  let nbAbsences = 0
  if (sessionIds.length) {
    const [{ count: pres }, { count: abs }] = await Promise.all([
      supabase.from('emargements').select('id', { count: 'exact', head: true }).in('session_id', sessionIds).eq('est_present', true),
      supabase.from('emargements').select('id', { count: 'exact', head: true }).in('session_id', sessionIds).eq('est_present', false),
    ])
    nbPresences = pres || 0
    nbAbsences = abs || 0
  }
  const totalEmargements = nbPresences + nbAbsences
  const tauxPresence = totalEmargements > 0 ? Math.round((nbPresences / totalEmargements) * 100) : null

  const somme = (filtre: (s: any) => boolean) => sessions.filter(filtre).reduce((t: number, s: any) => t + s.commission, 0)

  return {
    nbEtablissements: clientIds.length,
    nbEtablissementsFormes: etablissementsFormes.size,
    nbDossiers: sessions.length,
    nbSessions: sessions.length,
    nbSessionsRealisees: realisees.length,
    nbParticipants,
    nbPresences,
    nbAbsences,
    tauxPresence,
    caGenere: realisees.reduce((t: number, s: any) => t + baseDe(s), 0),
    priseEnChargeTotal: sessions.reduce((t: number, s: any) => t + baseDe(s), 0),
    commissionAVenir: somme((s) => s.statut_commission === 'a_venir'),
    commissionValidee: somme((s) => s.statut_commission === 'validee'),
    commissionPayee: somme((s) => s.statut_commission === 'payee'),
    commissionTotale: somme(() => true),
    nbSessionsSansMontant: sessions.filter((s: any) => baseDe(s) <= 0).length,
  }
}

export interface LigneCommissionSession {
  id: string
  session_id: string
  status: string
  base_montant: number
  base_source: string
  cout_formateur: number
  cout_formateur_manuel: number | null
  commission_montant: number
  commission_taux: number
  commission_type: string
  payee_at: string | null
  client: { id: string; raison_sociale: string; ville: string | null } | null
  session: {
    id: string; reference: string | null; intitule: string | null
    date_debut: string | null; date_fin: string | null; status: string
    formation: { intitule: string } | null
  } | null
}

/** Les lignes de commission d'une franchise, session par session, les plus récentes d'abord. */
export async function getFranchiseCommissionLines(supabase: any, franchiseId: string, orgId: string): Promise<LigneCommissionSession[]> {
  const { data } = await supabase
    .from('commissions_sessions')
    .select(`
      id, session_id, status, base_montant, base_source, cout_formateur, cout_formateur_manuel,
      commission_montant, commission_taux, commission_type, payee_at,
      client:client_id(id, raison_sociale, ville),
      session:session_id(id, reference, intitule, date_debut, date_fin, status, formation:formation_id(intitule))
    `)
    .eq('organization_id', orgId).eq('franchise_id', franchiseId)
  const lignes = ((data || []) as any[]).map((l) => ({
    ...l,
    client: Array.isArray(l.client) ? l.client[0] || null : l.client,
    session: Array.isArray(l.session) ? l.session[0] || null : l.session,
  }))
  return lignes.sort((a, b) => String(b.session?.date_debut || '').localeCompare(String(a.session?.date_debut || '')))
}

// ─── Lecture par phase : où en est chaque établissement du réseau ────────────

export type PhaseFranchise =
  | 'regle' | 'attente' | 'encours' | 'sans_montant' | 'poei' | 'avant_partenariat' | 'jamais'

export interface EtablissementPhase {
  id: string
  raison_sociale: string
  ville: string | null
  code_postal: string | null
  nbSessions: number
  nbParticipants: number
  premiere: string | null
  derniere: string | null
  base: number
  commission: number
  due: number
  aVenir: number
  nbSansMontant: number
  nbPoei: number
  /** Sessions antérieures au partenariat, hors commission. */
  nbAvantPartenariat: number
  /** Établissement explicitement sorti de l'accord de commission. */
  horsPartenariat: boolean
  phase: PhaseFranchise
}

export interface GroupePhase {
  phase: PhaseFranchise
  etablissements: EtablissementPhase[]
  base: number
  due: number
  aVenir: number
  nbSessions: number
  nbParticipants: number
}

/** Ordre d'affichage : ce qu'on doit, puis ce qui vient, puis le reste. */
export const ORDRE_PHASES: PhaseFranchise[] = [
  'regle', 'attente', 'encours', 'sans_montant', 'poei', 'avant_partenariat', 'jamais',
]

export const LIBELLES_PHASES: Record<PhaseFranchise, { titre: string; texte: string }> = {
  regle: {
    titre: 'Réglés, commission due',
    texte: "Dossiers terminés et encaissés, commission validée : c'est ce qui est dû à la franchise aujourd'hui.",
  },
  attente: {
    titre: 'Terminés, en attente de règlement',
    texte: "Formations délivrées dont le règlement n'est pas encore constaté. La commission bascule en « due » dès l'encaissement.",
  },
  encours: {
    titre: 'En cours ou programmés',
    texte: 'Sessions qui se déroulent en ce moment ou déjà calées dans l’agenda.',
  },
  sans_montant: {
    titre: 'Terminés, montant à saisir',
    texte: "Formations délivrées sans prise en charge ni prix renseigné : leur commission ne peut pas être calculée.",
  },
  poei: {
    titre: 'Parcours POEI',
    texte: 'Les POEI sont hors commission franchise : leur économie demande un calcul distinct.',
  },
  avant_partenariat: {
    titre: 'Formés avant le partenariat',
    texte: "Formations délivrées avant la date de début du partenariat : elles n'ouvrent droit à aucune commission.",
  },
  jamais: {
    titre: 'Rattachés, jamais formés',
    texte: "Établissements du réseau qui n'ont encore suivi aucune formation.",
  },
}

/**
 * Chaque établissement d'une franchise avec l'avancement de ses dossiers.
 * S'appuie sur les sessions réelles (et pas seulement sur celles qui portent
 * une commission) pour que les POEI, les sessions sans montant et les
 * formations antérieures au partenariat restent visibles.
 */
export async function getFranchiseParcours(
  supabase: any,
  franchiseId: string,
  orgId: string,
  debutPartenariat?: string | null,
): Promise<GroupePhase[]> {
  // select('*') : franchise_hors_partenariat n'existe qu'après la migration 150
  const { data: clients } = await supabase
    .from('clients').select('*')
    .eq('franchise_id', franchiseId).eq('organization_id', orgId).order('raison_sociale')
  const liste = (clients || []) as any[]
  if (!liste.length) return []
  const ids = liste.map((c) => c.id)

  // Sessions par paquets : une liste d'UUID trop longue dépasse la taille d'URL admise
  const sessions: any[] = []
  for (let i = 0; i < ids.length; i += 30) {
    const { data } = await supabase
      .from('sessions').select('id, client_id, status, date_debut, poei_intervention_id')
      .eq('organization_id', orgId).in('client_id', ids.slice(i, i + 30))
    sessions.push(...((data || []) as any[]))
  }
  const sessionIds = sessions.map((s) => s.id)

  const [{ data: poeiRows }, { data: lignes }] = await Promise.all([
    supabase.from('poei').select('session_id').eq('organization_id', orgId),
    supabase.from('commissions_sessions')
      .select('session_id, base_montant, commission_montant, status')
      .eq('organization_id', orgId).eq('franchise_id', franchiseId).neq('status', 'annulee'),
  ])
  const poeiSet = new Set(((poeiRows || []) as any[]).map((p) => p.session_id))
  const parSession = new Map(((lignes || []) as any[]).map((l) => [l.session_id, l]))

  // Stagiaires réellement inscrits, session par session
  const inscritsParSession = new Map<string, number>()
  for (let i = 0; i < sessionIds.length; i += 100) {
    const { data } = await supabase.from('inscriptions').select('session_id')
      .in('session_id', sessionIds.slice(i, i + 100)).not('status', 'in', '("annule","abandonne")')
    for (const r of (data || []) as any[]) {
      inscritsParSession.set(r.session_id, (inscritsParSession.get(r.session_id) || 0) + 1)
    }
  }

  const etabs: EtablissementPhase[] = liste.map((c) => {
    const ss = sessions
      .filter((s) => s.client_id === c.id)
      .map((s) => {
        const l = parSession.get(s.id)
        return {
          date: s.date_debut as string | null,
          statut: s.status as string,
          poei: !!s.poei_intervention_id || poeiSet.has(s.id),
          base: Number(l?.base_montant || 0),
          commission: Number(l?.commission_montant || 0),
          statutCommission: (l?.status as string) || 'aucune',
          inscrits: inscritsParSession.get(s.id) || 0,
        }
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    // Un établissement peut avoir des sessions des deux côtés de la date de
    // partenariat (CB5 chez Chamas) : la phase se lit sur ce qui ouvre droit à
    // commission, les sessions antérieures se comptent à part.
    const horsPerimetre = !!c.franchise_hors_partenariat
    const avant = horsPerimetre
      ? ss.slice()
      : debutPartenariat ? ss.filter((s) => s.date && s.date < debutPartenariat) : []
    const eligibles = ss.filter((s) => !s.poei && !avant.includes(s))
    const due = ss.filter((s) => ['validee', 'payee'].includes(s.statutCommission)).reduce((t, s) => t + s.commission, 0)
    const aVenir = ss.filter((s) => s.statutCommission === 'a_venir').reduce((t, s) => t + s.commission, 0)

    let phase: PhaseFranchise
    if (!ss.length) phase = horsPerimetre ? 'avant_partenariat' : 'jamais'
    else if (!eligibles.length) phase = avant.length ? 'avant_partenariat' : 'poei'
    else if (due > 0) phase = 'regle'
    else if (eligibles.some((s) => s.statut === 'en_cours' || s.statut === 'planifiee' || s.statut === 'confirmee')) phase = 'encours'
    else if (aVenir > 0) phase = 'attente'
    else phase = 'sans_montant'

    return {
      id: c.id, raison_sociale: c.raison_sociale, ville: c.ville, code_postal: c.code_postal,
      nbSessions: ss.length,
      nbParticipants: ss.reduce((t, s) => t + s.inscrits, 0),
      premiere: ss[0]?.date || null,
      derniere: ss[ss.length - 1]?.date || null,
      base: ss.reduce((t, s) => t + s.base, 0),
      commission: ss.reduce((t, s) => t + s.commission, 0),
      due, aVenir,
      nbSansMontant: eligibles.filter((s) => s.base === 0).length,
      nbPoei: ss.filter((s) => s.poei).length,
      nbAvantPartenariat: avant.length,
      horsPartenariat: horsPerimetre,
      phase,
    }
  })

  return ORDRE_PHASES.map((phase) => {
    const l = etabs
      .filter((e) => e.phase === phase)
      .sort((a, b) => b.commission - a.commission || b.nbSessions - a.nbSessions || a.raison_sociale.localeCompare(b.raison_sociale))
    return {
      phase, etablissements: l,
      base: l.reduce((t, e) => t + e.base, 0),
      due: l.reduce((t, e) => t + e.due, 0),
      aVenir: l.reduce((t, e) => t + e.aVenir, 0),
      nbSessions: l.reduce((t, e) => t + e.nbSessions, 0),
      nbParticipants: l.reduce((t, e) => t + e.nbParticipants, 0),
    }
  }).filter((g) => g.etablissements.length > 0)
}

// ─── Formations du réseau, vues côté franchise ──────────────────────────────

export type EtatFormation = 'a_venir' | 'en_cours' | 'terminee'

export interface FormationFranchise {
  id: string
  reference: string | null
  titre: string
  clientId: string | null
  client: string | null
  ville: string | null
  dateDebut: string | null
  dateFin: string | null
  nbParticipants: number
  /** null quand la session ne relève pas de l'accord (POEI, hors partenariat). */
  commission: number | null
  statutCommission: CommissionStatus | null
  base: number
  poei: boolean
  horsPartenariat: boolean
  etat: EtatFormation
}

export interface GroupeFormations {
  etat: EtatFormation
  formations: FormationFranchise[]
  nbParticipants: number
  commission: number
}

export const ORDRE_ETATS: EtatFormation[] = ['en_cours', 'a_venir', 'terminee']

export const LIBELLES_ETATS: Record<EtatFormation, { titre: string; texte: string }> = {
  en_cours: { titre: 'En cours', texte: 'Formations qui se déroulent en ce moment dans votre réseau.' },
  a_venir: { titre: 'À venir', texte: 'Formations programmées, pas encore démarrées.' },
  terminee: { titre: 'Terminées', texte: 'Formations délivrées. Leur commission suit le règlement du dossier.' },
}

const ETAT_DE: Record<string, EtatFormation> = {
  terminee: 'terminee',
  en_cours: 'en_cours',
  planifiee: 'a_venir',
  confirmee: 'a_venir',
  brouillon: 'a_venir',
}

/**
 * Les formations du réseau, groupées par état, avec l'état de leur commission.
 * Destiné au portail franchise : une seule lecture pour savoir ce qui est
 * délivré, ce qui arrive, et ce que chaque dossier rapporte.
 */
export async function getFranchiseFormations(
  supabase: any,
  franchiseId: string,
  orgId: string,
  debutPartenariat?: string | null,
): Promise<GroupeFormations[]> {
  const { data: clients } = await supabase
    .from('clients').select('*')
    .eq('franchise_id', franchiseId).eq('organization_id', orgId)
  const liste = (clients || []) as any[]
  if (!liste.length) return []
  const parClient = new Map(liste.map((c) => [c.id, c]))
  const ids = liste.map((c) => c.id)

  const sessions: any[] = []
  for (let i = 0; i < ids.length; i += 30) {
    const { data } = await supabase
      .from('sessions')
      .select('id, reference, intitule, client_id, status, date_debut, date_fin, poei_intervention_id, formation:formation_id(intitule)')
      .eq('organization_id', orgId).in('client_id', ids.slice(i, i + 30)).neq('status', 'annulee')
    sessions.push(...((data || []) as any[]))
  }
  if (!sessions.length) return []

  const [{ data: poeiRows }, { data: lignes }] = await Promise.all([
    supabase.from('poei').select('session_id').eq('organization_id', orgId),
    supabase.from('commissions_sessions')
      .select('session_id, base_montant, commission_montant, status')
      .eq('organization_id', orgId).eq('franchise_id', franchiseId).neq('status', 'annulee'),
  ])
  const poeiSet = new Set(((poeiRows || []) as any[]).map((p) => p.session_id))
  const parSession = new Map(((lignes || []) as any[]).map((l) => [l.session_id, l]))

  const inscrits = new Map<string, number>()
  const sessionIds = sessions.map((s) => s.id)
  for (let i = 0; i < sessionIds.length; i += 100) {
    const { data } = await supabase.from('inscriptions').select('session_id')
      .in('session_id', sessionIds.slice(i, i + 100)).not('status', 'in', '("annule","abandonne")')
    for (const r of (data || []) as any[]) inscrits.set(r.session_id, (inscrits.get(r.session_id) || 0) + 1)
  }

  const formations: FormationFranchise[] = sessions.map((s) => {
    const c = parClient.get(s.client_id)
    const l = parSession.get(s.id)
    const formation = Array.isArray(s.formation) ? s.formation[0] : s.formation
    const horsPartenariat = !!c?.franchise_hors_partenariat
      || !!(debutPartenariat && s.date_debut && s.date_debut < debutPartenariat)
    return {
      id: s.id,
      reference: s.reference,
      titre: formation?.intitule || s.intitule || 'Formation',
      clientId: s.client_id || null,
      client: c?.raison_sociale || null,
      ville: c?.ville || null,
      dateDebut: s.date_debut,
      dateFin: s.date_fin,
      nbParticipants: inscrits.get(s.id) || 0,
      commission: l ? Number(l.commission_montant || 0) : null,
      statutCommission: (l?.status as CommissionStatus) || null,
      base: Number(l?.base_montant || 0),
      poei: !!s.poei_intervention_id || poeiSet.has(s.id),
      horsPartenariat,
      etat: ETAT_DE[s.status as string] || 'a_venir',
    }
  })

  return ORDRE_ETATS.map((etat) => {
    const l = formations
      .filter((f) => f.etat === etat)
      // À venir : la prochaine d'abord. Terminées et en cours : la plus récente d'abord.
      .sort((a, b) => etat === 'a_venir'
        ? String(a.dateDebut).localeCompare(String(b.dateDebut))
        : String(b.dateDebut).localeCompare(String(a.dateDebut)))
    return {
      etat, formations: l,
      nbParticipants: l.reduce((t, f) => t + f.nbParticipants, 0),
      commission: l.reduce((t, f) => t + (f.commission || 0), 0),
    }
  }).filter((g) => g.formations.length > 0)
}
