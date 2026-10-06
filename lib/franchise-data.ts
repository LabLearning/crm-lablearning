import type { CommissionStatus } from '@/lib/commission'
import { estFormationHygiene } from '@/lib/formation-hygiene'
import { coutFormateurDeSession, type SourceCoutFormateur } from '@/lib/commission'

/**
 * Agrégations de données pour le portail franchise, assises sur les SESSIONS
 * des établissements rattachés (l'unité réelle de l'activité), et sur les
 * commissions par session (commissions_sessions).
 * Tout est scopé par franchise_id + organization_id.
 *
 * Règle : rien de ce qui touche aux apporteurs d'affaires (clients.apporteur_id,
 * table commissions, apporteurs_affaires) ne sort vers le portail franchise.
 * Les établissements sont renvoyés champ par champ, jamais tels quels.
 */

/** Date du jour à Paris, « AAAA-MM-JJ ». */
export const aujourdhuiParis = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())

/**
 * État d'une session lu uniquement dans ses dates de formation, jamais dans
 * son statut (qui n'est pas tenu au jour le jour : « validée » à la
 * signature, « confirmée »…). Avant la date de début : à venir ; entre le
 * début et la fin : en cours ; après la fin : terminée. Les sessions annulées
 * sont écartées en amont.
 */
export function etatSession(
  s: { date_debut?: string | null; date_fin?: string | null },
  aujourdhui = aujourdhuiParis(),
): 'a_venir' | 'en_cours' | 'terminee' {
  const debut = s.date_debut ? String(s.date_debut).slice(0, 10) : null
  const fin = s.date_fin ? String(s.date_fin).slice(0, 10) : debut
  if (!debut || debut > aujourdhui) return 'a_venir'
  if (fin && fin < aujourdhui) return 'terminee'
  return 'en_cours'
}

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
    .select('session_id, client_id, base_montant, commission_montant, status, session:session_id(status, date_debut, date_fin)')
    .eq('organization_id', orgId).eq('franchise_id', franchiseId).neq('status', 'annulee')
  const sessions = ((lignesCommission || []) as any[])
    .map((l) => { const se = Array.isArray(l.session) ? l.session[0] : l.session; return { id: l.session_id, client_id: l.client_id, status: se?.status, date_debut: se?.date_debut, date_fin: se?.date_fin, base: Number(l.base_montant || 0), commission: Number(l.commission_montant || 0), statut_commission: l.status } })
    .filter((s) => s.status !== 'annulee')
  const sessionIds = sessions.map((s: any) => s.id)
  const realisees = sessions.filter((s: any) => etatSession(s) === 'terminee')
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
  /** D'où vient le coût formateur (renseigné seulement à la demande, pour la fiche franchise de l'administration). */
  cout_source?: SourceCoutLigne
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

/** Source du coût d'une ligne : celle du calcul, « parcours » pour une POEI, « figé » pour une ligne validée ou payée. */
export type SourceCoutLigne = SourceCoutFormateur | 'parcours' | 'fige'

/**
 * Les lignes de commission d'une franchise, session par session, les plus récentes d'abord.
 * `avecSources` relit ce qui a servi à trouver le coût formateur de chaque session
 * (contrat, facture, rémunération de la session, fiche du formateur) pour le dire à l'écran.
 */
export async function getFranchiseCommissionLines(supabase: any, franchiseId: string, orgId: string, opts?: { avecSources?: boolean }): Promise<LigneCommissionSession[]> {
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
  if (opts?.avecSources && lignes.length) {
    const ids = lignes.map((l) => l.session_id)
    const paquets = <T,>(l: T[], n = 100) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n))
    const lire = (table: string, colonnes: string, filtre: (q: any) => any = (q) => q) =>
      Promise.all(paquets(ids).map((p) => filtre(supabase.from(table).select(colonnes).in(table === 'sessions' ? 'id' : 'session_id', p)).then((r: any) => r.data || []))).then((r) => r.flat())
    const [sessions, contrats, facturesFormateur] = await Promise.all([
      lire('sessions', 'id, cout_formateur, formateur_id, horaires_jours, formation:formation_id(duree_jours)'),
      lire('contrats_formateur', 'session_id, montant_ht', (q) => q.neq('status', 'annule')),
      lire('factures_formateur', 'session_id, montant_ht'),
    ])
    const formateurIds = Array.from(new Set((sessions as any[]).map((s) => s.formateur_id).filter(Boolean)))
    const formateurs = formateurIds.length
      ? (await Promise.all(paquets(formateurIds).map((p) => supabase.from('formateurs').select('id, tarif_journalier').eq('organization_id', orgId).in('id', p).then((r: any) => r.data || [])))).flat()
      : []
    const sessionDe = new Map((sessions as any[]).map((s) => [s.id, s]))
    const tarifDe = new Map((formateurs as any[]).map((f) => [f.id, f.tarif_journalier]))
    const somme = (l: any[], id: string) => l.filter((x) => x.session_id === id).reduce((t, x) => t + Number(x.montant_ht || 0), 0)
    for (const l of lignes) {
      if (['validee', 'payee'].includes(String(l.status))) { l.cout_source = 'fige'; continue }
      if (l.base_source === 'poei') { l.cout_source = Number(l.cout_formateur) > 0 ? 'parcours' : 'aucune'; continue }
      const s = sessionDe.get(l.session_id)
      const nbHoraires = Array.isArray(s?.horaires_jours) ? s.horaires_jours.length : 0
      l.cout_source = coutFormateurDeSession({
        coutContratsHt: somme(contrats as any[], l.session_id),
        coutFacturesFormateurHt: somme(facturesFormateur as any[], l.session_id),
        coutFormateurSession: s?.cout_formateur ?? null,
        coutFormateurManuelJour: l.cout_formateur_manuel ?? null,
        tarifJournalierFormateur: s?.formateur_id ? tarifDe.get(s.formateur_id) ?? null : null,
        nbJours: Math.max(1, nbHoraires || Number(s?.formation?.duree_jours) || 1),
      }).source
    }
  }
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
    texte: 'Parcours POEI en préparation : la commission se calcule dès que le montant du parcours et ses candidats sont connus.',
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
      .from('sessions').select('id, client_id, status, date_debut, date_fin, poei_intervention_id')
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

  const aujourdhui = aujourdhuiParis()
  const etabs: EtablissementPhase[] = liste.map((c) => {
    const ss = sessions
      .filter((s) => s.client_id === c.id)
      .map((s) => {
        const l = parSession.get(s.id)
        return {
          date: s.date_debut as string | null,
          statut: s.status as string,
          etat: s.status === 'annulee' ? 'annulee' : etatSession(s, aujourdhui),
          poei: !!s.poei_intervention_id || poeiSet.has(s.id),
          // La session qui porte la commission d'un parcours POEI compte comme une formation
          porteCommission: !!l,
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
    const eligibles = ss.filter((s) => (!s.poei || s.porteCommission) && !avant.includes(s))
    const due = ss.filter((s) => ['validee', 'payee'].includes(s.statutCommission)).reduce((t, s) => t + s.commission, 0)
    const aVenir = ss.filter((s) => s.statutCommission === 'a_venir').reduce((t, s) => t + s.commission, 0)

    let phase: PhaseFranchise
    if (!ss.length) phase = horsPerimetre ? 'avant_partenariat' : 'jamais'
    else if (!eligibles.length) phase = avant.length ? 'avant_partenariat' : 'poei'
    else if (due > 0) phase = 'regle'
    // En cours ou programmée, au sens des dates (le statut n'est pas tenu au jour le jour)
    else if (eligibles.some((s) => s.etat === 'en_cours' || s.etat === 'a_venir')) phase = 'encours'
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
      nbPoei: ss.filter((s) => s.poei && !s.porteCommission).length,
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
  /** Formation d'hygiène alimentaire (session d'hygiène ou parcours POEI). */
  estHygiene: boolean
  /** Lien des attestations d'hygiène, une fois la formation terminée ; null si
   *  elles n'existent pas encore dans le CRM (formation venue de Dendreo). */
  hygiene: string | null
  /** Comptes rendus transmis par les formateurs. */
  comptesRendus: { sessionId: string; formateur: string }[]
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
      .select('id, reference, intitule, client_id, status, date_debut, date_fin, poei_intervention_id, dendreo_id, formation:formation_id(intitule, categorie)')
      .eq('organization_id', orgId).in('client_id', ids.slice(i, i + 30)).neq('status', 'annulee')
    sessions.push(...((data || []) as any[]))
  }
  if (!sessions.length) return []

  const ivIds = sessions.map((s) => s.poei_intervention_id).filter(Boolean)
  const [{ data: poeiRows }, { data: lignes }, { data: interventions }] = await Promise.all([
    supabase.from('poei').select('id, session_id').eq('organization_id', orgId),
    supabase.from('commissions_sessions')
      .select('session_id, base_montant, commission_montant, status')
      .eq('organization_id', orgId).eq('franchise_id', franchiseId).neq('status', 'annulee'),
    ivIds.length
      ? supabase.from('poei_interventions').select('id, poei_id').in('id', ivIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const poeiSet = new Set(((poeiRows || []) as any[]).map((p) => p.session_id))
  // Parcours POEI de chaque session : la session chapeau et les interventions
  const poeiDe = new Map<string, string>()
  for (const p of (poeiRows || []) as any[]) if (p.session_id) poeiDe.set(p.session_id, p.id)
  const poeiDeIv = new Map(((interventions || []) as any[]).map((i) => [i.id, i.poei_id]))
  for (const s of sessions) if (s.poei_intervention_id && poeiDeIv.get(s.poei_intervention_id)) poeiDe.set(s.id, poeiDeIv.get(s.poei_intervention_id))
  const parSession = new Map(((lignes || []) as any[]).map((l) => [l.session_id, l]))

  const inscrits = new Map<string, number>()
  const rapportsDe = new Map<string, { sessionId: string; formateur: string }[]>()
  const sessionIds = sessions.map((s) => s.id)
  await Promise.all(Array.from({ length: Math.ceil(sessionIds.length / 100) }, async (_, k) => {
    const tranche = sessionIds.slice(k * 100, k * 100 + 100)
    const [{ data }, { data: rapports }] = await Promise.all([
      supabase.from('inscriptions').select('session_id')
        .in('session_id', tranche).not('status', 'in', '("annule","abandonne")'),
      supabase.from('rapports_session').select('session_id, formateur:formateur_id(prenom, nom)')
        .in('session_id', tranche).in('status', ['soumis', 'valide']),
    ])
    for (const r of (data || []) as any[]) inscrits.set(r.session_id, (inscrits.get(r.session_id) || 0) + 1)
    for (const r of (rapports || []) as any[]) {
      const f = Array.isArray(r.formateur) ? r.formateur[0] : r.formateur
      rapportsDe.set(r.session_id, [...(rapportsDe.get(r.session_id) || []), {
        sessionId: r.session_id,
        formateur: f ? `${f.prenom || ''} ${f.nom || ''}`.trim() || 'Formateur' : 'Formateur',
      }])
    }
  }))
  // Toutes les sessions d'un parcours POEI, pour réunir ses comptes rendus sur sa ligne
  const sessionsDuParcours = new Map<string, any[]>()
  for (const s of sessions) {
    const p = poeiDe.get(s.id)
    if (p) sessionsDuParcours.set(p, [...(sessionsDuParcours.get(p) || []), s])
  }
  const estDendreo = (s: any) => !!s.dendreo_id || /^ADF_/i.test(String(s.reference || ''))

  const aujourdhui = aujourdhuiParis()
  // Un parcours POEI = une ligne : les modules qui ne portent pas sa commission
  // (portée par la session chapeau, sinon la première intervention) sont masqués
  const formations: FormationFranchise[] = sessions.filter((s) => !(s.poei_intervention_id && !parSession.has(s.id))).map((s) => {
    const c = parClient.get(s.client_id)
    const l = parSession.get(s.id)
    const formation = Array.isArray(s.formation) ? s.formation[0] : s.formation
    const estPoei = !!s.poei_intervention_id || poeiSet.has(s.id)
    const horsPartenariat = !!c?.franchise_hors_partenariat
      || !!(debutPartenariat && s.date_debut && s.date_debut < debutPartenariat)
    const etat = etatSession(s, aujourdhui)
    // Documents de fin de formation : un parcours POEI les réunit sur toutes ses sessions
    const parcours = poeiDe.get(s.id) || null
    const groupe = parcours ? sessionsDuParcours.get(parcours) || [s] : [s]
    const estHygiene = !!parcours || estFormationHygiene(formation)
    const avecStagiaires = groupe.some((x) => (inscrits.get(x.id) || 0) > 0)
    // Formation venue de Dendreo : ses attestations y ont été produites, elles sont importées à part
    const hygiene = etat !== 'terminee' || !estHygiene || !avecStagiaires || groupe.some(estDendreo) ? null
      : parcours ? `/api/pdf/attestation-hygiene?poei=${parcours}` : `/api/pdf/attestation-hygiene?session=${s.id}`
    return {
      id: s.id,
      reference: s.reference,
      titre: `${estPoei ? 'POEI · ' : ''}${formation?.intitule || s.intitule || 'Formation'}`,
      clientId: s.client_id || null,
      client: c?.raison_sociale || null,
      ville: c?.ville || null,
      dateDebut: s.date_debut,
      dateFin: s.date_fin,
      nbParticipants: inscrits.get(s.id) || 0,
      commission: l ? Number(l.commission_montant || 0) : null,
      statutCommission: (l?.status as CommissionStatus) || null,
      base: Number(l?.base_montant || 0),
      poei: estPoei,
      horsPartenariat,
      etat,
      estHygiene,
      hygiene,
      comptesRendus: groupe.flatMap((x) => rapportsDe.get(x.id) || []),
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

// ─── Audits hygiène du réseau ───────────────────────────────────────────────

export interface AuditEtablissement {
  date: string | null
  score: number | null
  mention: string | null
  type: string | null
  rapport: string | null
}

export interface AuditsClient {
  nb: number
  /** Premier passage : la photo de départ. */
  entree: AuditEtablissement | null
  /** Dernier audit de suivi ou de sortie, quand il existe. */
  sortie: AuditEtablissement | null
  /** Points gagnés entre l'entrée et la sortie. */
  gain: number | null
  /** Tous les audits, du plus récent au plus ancien. */
  historique: AuditEtablissement[]
}

const estSuivi = (type: string | null) => /suivi|sortie/i.test(String(type || ''))

/**
 * Les audits hygiène des établissements d'une franchise, indexés par client.
 *
 * L'outil terrain (AuditHygiène) alimente les tables ah_* ; le rapprochement
 * avec le CRM se fait par ah_etablissements.client_id. Un établissement audité
 * mais pas encore rapproché n'apparaît donc pas ici : c'est voulu, on ne
 * devine pas un rattachement.
 */
export async function getFranchiseAudits(
  supabase: any,
  franchiseId: string,
  orgId: string,
): Promise<Map<string, AuditsClient>> {
  const parClient = new Map<string, AuditsClient>()

  const { data: etabs, error } = await supabase
    .from('ah_etablissements').select('id, client_id')
    .eq('organization_id', orgId).eq('franchise_id', franchiseId).not('client_id', 'is', null)
  // Tables ah_* absentes (outil non branché) : la franchise s'affiche sans audits
  if (error || !etabs?.length) return parClient

  // Le rapprochement de l'outil peut pointer vers un client qui n'est plus (ou
  // pas encore) rattaché au réseau : on ne compte que les établissements
  // réellement dans la franchise, sinon la synthèse annonce des scores qui
  // n'apparaissent nulle part dans la liste.
  const { data: clients } = await supabase
    .from('clients').select('id').eq('organization_id', orgId).eq('franchise_id', franchiseId)
  const duReseau = new Set((clients || []).map((c: any) => c.id))

  const parEtab = new Map<string, string>()
  for (const e of etabs as any[]) if (duReseau.has(e.client_id)) parEtab.set(e.id, e.client_id)
  if (!parEtab.size) return parClient

  const ids = [...parEtab.keys()]
  const audits: any[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const { data } = await supabase.from('ah_audits')
      .select('etablissement_id, num_rapport, date_audit, type_audit, score_global, mention')
      .in('etablissement_id', ids.slice(i, i + 50))
    audits.push(...((data || []) as any[]))
  }

  const brut = new Map<string, any[]>()
  for (const a of audits) {
    // Un score à zéro est un rapport ouvert mais pas rempli : il fausserait la progression
    if (a.score_global == null || Number(a.score_global) === 0) continue
    const clientId = parEtab.get(a.etablissement_id)
    if (!clientId) continue
    if (!brut.has(clientId)) brut.set(clientId, [])
    brut.get(clientId)!.push(a)
  }

  for (const [clientId, liste] of brut) {
    const tri = liste
      .map((a) => ({
        date: a.date_audit as string | null,
        score: a.score_global == null ? null : Number(a.score_global),
        mention: a.mention as string | null,
        type: a.type_audit as string | null,
        rapport: a.num_rapport as string | null,
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))

    const entree = tri.find((a) => /premier/i.test(String(a.type))) || tri[0] || null
    const apres = tri.filter((a) => estSuivi(a.type) && String(a.date) > String(entree?.date))
    const sortie = apres[apres.length - 1] || null
    const gain = entree?.score != null && sortie?.score != null ? Math.round((sortie.score - entree.score) * 10) / 10 : null

    parClient.set(clientId, { nb: tri.length, entree, sortie, gain, historique: tri.slice().reverse() })
  }
  return parClient
}

/**
 * Synthèse à partir de la liste complète : compte aussi les établissements
 * audités que l'outil n'a pas encore rapprochés d'un client du CRM, qui
 * apparaissent bien dans la liste.
 */
export function syntheseAuditsListe(liste: AuditDetail[]): {
  nbEtablissements: number; nbAudits: number
  moyenneEntree: number | null; moyenneSortie: number | null; progression: number | null
  nbSuivis: number; nbEnHausse: number
} {
  const parSite = new Map<string, AuditDetail[]>()
  for (const a of liste) {
    if (!parSite.has(a.sourceId)) parSite.set(a.sourceId, [])
    parSite.get(a.sourceId)!.push(a)
  }
  const paires: { entree: number; sortie: number }[] = []
  for (const audits of parSite.values()) {
    const tri = audits.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const entree = tri.find((a) => /premier/i.test(String(a.type))) || tri[0]
    const apres = tri.filter((a) => estSuivi(a.type) && String(a.date) > String(entree?.date))
    const sortie = apres[apres.length - 1]
    if (entree?.score != null && sortie?.score != null) paires.push({ entree: entree.score, sortie: sortie.score })
  }
  const moy = (l: number[]) => (l.length ? Math.round((l.reduce((t, n) => t + n, 0) / l.length) * 10) / 10 : null)
  // Deux fiches de l'outil peuvent viser le même établissement : on compte des
  // établissements, pas des fiches.
  const distincts = new Set(liste.map((a) => a.clientId || a.sourceId))
  return {
    nbEtablissements: distincts.size,
    nbAudits: liste.length,
    moyenneEntree: moy(paires.map((p) => p.entree)),
    moyenneSortie: moy(paires.map((p) => p.sortie)),
    progression: paires.length ? moy(paires.map((p) => p.sortie - p.entree)) : null,
    nbSuivis: paires.length,
    nbEnHausse: paires.filter((p) => p.sortie > p.entree).length,
  }
}

/** Synthèse réseau : moyennes d'entrée et de sortie, progression. */
export function syntheseAudits(audits: Map<string, AuditsClient>): {
  nbEtablissements: number; nbAudits: number
  moyenneEntree: number | null; moyenneSortie: number | null; progression: number | null
  nbSuivis: number; nbEnHausse: number
} {
  const tous = [...audits.values()]
  const suivis = tous.filter((a) => a.entree?.score != null && a.sortie?.score != null)
  const moy = (l: number[]) => (l.length ? Math.round((l.reduce((t, n) => t + n, 0) / l.length) * 10) / 10 : null)
  return {
    nbEtablissements: tous.length,
    nbAudits: tous.reduce((t, a) => t + a.nb, 0),
    moyenneEntree: moy(suivis.map((a) => a.entree!.score!)),
    moyenneSortie: moy(suivis.map((a) => a.sortie!.score!)),
    progression: suivis.length ? moy(suivis.map((a) => a.sortie!.score! - a.entree!.score!)) : null,
    nbSuivis: suivis.length,
    nbEnHausse: suivis.filter((a) => (a.gain || 0) > 0).length,
  }
}

export interface AuditDetail extends AuditEtablissement {
  id: string
  /** Fiche de l'outil terrain : un même client peut en avoir deux. */
  sourceId: string
  clientId: string | null
  etablissement: string
  ville: string | null
  formateur: string | null
  nbConformes: number | null
  nbPartiels: number | null
  nbNonConformes: number | null
  bilan: string | null
  actions: string | null
  recommandations: string | null
  /** Position dans le parcours de l'établissement : 1 = premier passage. */
  rang: number
  /** Points gagnés depuis le passage précédent du même établissement. */
  evolution: number | null
}

/**
 * Tous les audits hygiène d'une franchise, du plus récent au plus ancien,
 * avec l'établissement et l'évolution depuis le passage précédent.
 */
export async function getFranchiseAuditsListe(
  supabase: any,
  franchiseId: string,
  orgId: string,
): Promise<AuditDetail[]> {
  const { data: etabs, error } = await supabase
    .from('ah_etablissements').select('id, nom, ville, client_id')
    .eq('organization_id', orgId).eq('franchise_id', franchiseId)
  if (error || !etabs?.length) return []

  const { data: clients } = await supabase
    .from('clients').select('id, raison_sociale, ville').eq('organization_id', orgId).eq('franchise_id', franchiseId)
  const parClient = new Map((clients || []).map((c: any) => [c.id, c]))

  const ids = (etabs as any[]).map((e) => e.id)
  const brut: any[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const { data } = await supabase.from('ah_audits')
      .select('id, etablissement_id, num_rapport, date_audit, type_audit, formateur_nom, score_global, mention, nb_conformes, nb_partiels, nb_non_conformes, obs_bilan, obs_actions, obs_reco')
      .in('etablissement_id', ids.slice(i, i + 50))
    brut.push(...((data || []) as any[]))
  }

  const infoEtab = new Map((etabs as any[]).map((e) => [e.id, e]))
  // Rang et évolution se lisent établissement par établissement, du plus ancien au plus récent
  const parEtab = new Map<string, any[]>()
  for (const a of brut) {
    if (a.score_global == null || Number(a.score_global) === 0) continue
    if (!parEtab.has(a.etablissement_id)) parEtab.set(a.etablissement_id, [])
    parEtab.get(a.etablissement_id)!.push(a)
  }

  const liste: AuditDetail[] = []
  for (const [etabId, audits] of parEtab) {
    const e = infoEtab.get(etabId)
    const c: any = e?.client_id ? parClient.get(e.client_id) : null
    const tri = audits.sort((a, b) => String(a.date_audit).localeCompare(String(b.date_audit)))
    tri.forEach((a, i) => {
      const precedent = i > 0 ? Number(tri[i - 1].score_global) : null
      liste.push({
        id: a.id,
        sourceId: etabId,
        clientId: e?.client_id || null,
        etablissement: c?.raison_sociale || e?.nom || 'Établissement',
        ville: c?.ville || e?.ville || null,
        date: a.date_audit, score: a.score_global == null ? null : Number(a.score_global),
        mention: a.mention, type: a.type_audit, rapport: a.num_rapport,
        formateur: a.formateur_nom || null,
        nbConformes: a.nb_conformes ?? null,
        nbPartiels: a.nb_partiels ?? null,
        nbNonConformes: a.nb_non_conformes ?? null,
        bilan: a.obs_bilan || null,
        actions: a.obs_actions || null,
        recommandations: a.obs_reco || null,
        rang: i + 1,
        evolution: precedent == null ? null : Math.round((Number(a.score_global) - precedent) * 10) / 10,
      })
    })
  }
  return liste.sort((a, b) => String(b.date).localeCompare(String(a.date)))
}
