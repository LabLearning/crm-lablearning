/**
 * Chargement groupé des données de rentabilité (serveur uniquement).
 *
 * Le nombre de requêtes ne dépend pas du nombre de sessions : les listes
 * d'ids partent par paquets de 150 (limite de longueur d'URL), chaque paquet
 * paginé par fetchAllPaged. Aucune requête par session, aucune écriture.
 */
import { fetchAllPaged } from '@/lib/supabase/fetch-all'
import {
  calculerRentabilite, calculerToutes, composantesPoei, construireUnites, indexerDonnees, peutVoirMarge,
  type ApporteurRentab, type ClientRentab, type CommissionSessionRentab, type ContratRentab, type ConventionRentab,
  type DonneesBrutes, type DonneesRentabilite, type DossierAgeficeRentab, type FactureFormateurRentab,
  type FactureRentab, type FormateurRentab, type FraisRentab, type FraisVue, type FranchiseRentab,
  type InscriptionRentab, type InterventionRentab, type LigneFactureRentab, type PoeiRentab, type Rentabilite,
  type SessionRentab, type SessionVoisine, type VueRentabiliteSession,
} from '@/lib/rentabilite'

const PAQUET = 150
const TABLE_ABSENTE = ['PGRST205', '42P01']
const COLONNE_ABSENTE = '42703'
export const MESSAGE_RENTABILITE_INDISPONIBLE = 'Le calcul de la rentabilité est momentanément indisponible.'

const SEL_SESSION = 'id, reference, intitule, status, type_session, date_debut, date_fin, client_id, formateur_id, poei_intervention_id, dendreo_id, prix_ht, montant_finance_opco, deja_facture_ailleurs, numero_dossier_opco, cout_formateur, cout_salle, cout_materiel, horaires_jours, formation:formation_id(intitule, duree_jours, is_poei, tarif_inter_ht, tarif_intra_ht), client:client_id(id, raison_sociale, nom_commercial, franchise_id, financeur_type)'
const SEL_VOISINE = 'id, reference, client_id, date_debut, numero_dossier_opco, prix_ht, montant_finance_opco, deja_facture_ailleurs, status'
const SEL_FACTURE = 'id, numero, status, montant_ht, montant_ttc, montant_paye, session_id, client_id, financeur_nom, financeur_type, dendreo_id, notes_internes, numero_prise_en_charge, date_emission'

type Cible = { sessionIds: string[] } | { du: string; au: string }
type Reponse<T> = PromiseLike<{ data: T[] | null; error: any }>

interface Lecteur {
  requetes: number
  /** Lit toutes les pages ; une erreur remonte (jamais de données partielles silencieuses). */
  tout<T>(build: (from: number, to: number) => Reponse<T>): Promise<T[]>
  /** Même lecture, découpée en paquets d'ids lus en parallèle. */
  parIds<T>(ids: (string | null | undefined)[], build: (paquet: string[], from: number, to: number) => Reponse<T>): Promise<T[]>
}

function lecteur(): Lecteur {
  const l: Lecteur = {
    requetes: 0,
    tout<T>(build: (from: number, to: number) => Reponse<T>) {
      return fetchAllPaged<T>((from, to) => {
        l.requetes++
        return Promise.resolve(build(from, to)).then((r) => {
          if (r.error) throw r.error
          return r
        })
      })
    },
    async parIds<T>(ids: (string | null | undefined)[], build: (paquet: string[], from: number, to: number) => Reponse<T>) {
      const liste = Array.from(new Set(ids.filter((x): x is string => !!x)))
      if (!liste.length) return []
      const paquets: string[][] = []
      for (let i = 0; i < liste.length; i += PAQUET) paquets.push(liste.slice(i, i + PAQUET))
      const res = await Promise.all(paquets.map((p) => l.tout<T>((from, to) => build(p, from, to))))
      return res.flat()
    },
  }
  return l
}

/** Lecture d'une table ou colonne qui peut ne pas encore exister (migration non appliquée). */
async function tolerant<T>(p: Promise<T[]>, codes: string[]): Promise<{ rows: T[]; absent: boolean }> {
  try {
    return { rows: await p, absent: false }
  } catch (e: any) {
    if (codes.includes(String(e?.code))) return { rows: [], absent: true }
    throw e
  }
}

const unique = (arr: (string | null | undefined)[]) => Array.from(new Set(arr.filter((x): x is string => !!x)))

export async function chargerDonneesRentabilite(
  supabase: any,
  orgId: string,
  cible: Cible,
  opts: { onglet?: boolean } = {},
): Promise<{ donnees: DonneesRentabilite; requetes: number }> {
  const L = lecteur()
  const selSessions = (build: (q: any) => any) => (from: number, to: number) =>
    build(supabase.from('sessions').select(SEL_SESSION).eq('organization_id', orgId)).order('id').range(from, to)

  // ── Étape 1 : sessions ciblées, parcours POEI et graphe des interventions ──
  const [sessionsCible, poei, interventions, liensInterventions] = await Promise.all([
    'sessionIds' in cible
      ? L.parIds<SessionRentab>(cible.sessionIds, (p, from, to) => selSessions((q) => q.in('id', p))(from, to))
      : L.tout<SessionRentab>(selSessions((q) => q.gte('date_debut', cible.du).lte('date_debut', cible.au))),
    L.tout<PoeiRentab>((from, to) => supabase.from('poei')
      .select('id, numero, session_id, client_id, date_debut, montant_total, statut')
      .eq('organization_id', orgId).order('id').range(from, to)),
    L.tout<InterventionRentab>((from, to) => supabase.from('poei_interventions')
      .select('id, poei_id, formateur_id, libelle, montant_ht, date_debut')
      .eq('organization_id', orgId).order('id').range(from, to)),
    L.tout<{ id: string; poei_intervention_id: string | null }>((from, to) => supabase.from('sessions')
      .select('id, poei_intervention_id').eq('organization_id', orgId)
      .not('poei_intervention_id', 'is', null).order('id').range(from, to)),
  ])

  // ── Étape 1 bis : sessions manquantes des parcours POEI touchés ──
  const { racine, composantes } = composantesPoei(poei, interventions, liensInterventions)
  const touchees = new Set<string>()
  for (const s of sessionsCible) { const r = racine('s:' + s.id); if (r) touchees.add(r) }
  if ('du' in cible) {
    for (const p of poei) {
      if (p.date_debut && p.date_debut >= cible.du && p.date_debut <= cible.au) { const r = racine('p:' + p.id); if (r) touchees.add(r) }
    }
  }
  const dejaLues = new Set(sessionsCible.map((s) => s.id))
  const aLire: string[] = []
  const interventionsTouchees = new Set<string>()
  for (const r of Array.from(touchees)) {
    for (const noeud of composantes.get(r) || []) {
      if (noeud.startsWith('s:') && !dejaLues.has(noeud.slice(2))) aLire.push(noeud.slice(2))
      if (noeud.startsWith('i:')) interventionsTouchees.add(noeud.slice(2))
    }
  }
  const complements = await L.parIds<SessionRentab>(aLire, (p, from, to) => selSessions((q) => q.in('id', p))(from, to))
  const sessions = [...sessionsCible, ...complements]
  const ids = sessions.map((s) => s.id)
  const interIds = Array.from(interventionsTouchees)

  // ── Étape 2 : tout ce qui se rattache aux sessions du périmètre ──
  const [
    facturesSessions, facturesPoei, lignesSessions, contratsSessions, contratsInterventions,
    facturesFormateur, commissionsSessions, fraisRes, conventions, ageficeRes, inscriptionsBrutes,
  ] = await Promise.all([
    L.parIds<FactureRentab>(ids, (p, from, to) => supabase.from('factures').select(SEL_FACTURE)
      .eq('organization_id', orgId).in('session_id', p).order('id').range(from, to)),
    L.tout<FactureRentab>((from, to) => supabase.from('factures').select(SEL_FACTURE)
      .eq('organization_id', orgId).ilike('notes_internes', '%[POEI-FACT:%').order('id').range(from, to)),
    // facture_lignes n'a pas d'organization_id : le filtre passe par les sessions de l'org
    L.parIds<LigneFactureRentab>(ids, (p, from, to) => supabase.from('facture_lignes')
      .select('id, facture_id, session_id, montant_ht').in('session_id', p).order('id').range(from, to)),
    L.parIds<ContratRentab>(ids, (p, from, to) => supabase.from('contrats_formateur')
      .select('id, numero, session_id, poei_intervention_id, formateur_id, status, montant_ht')
      .eq('organization_id', orgId).in('session_id', p).neq('status', 'annule').order('id').range(from, to)),
    L.parIds<ContratRentab>(interIds, (p, from, to) => supabase.from('contrats_formateur')
      .select('id, numero, session_id, poei_intervention_id, formateur_id, status, montant_ht')
      .eq('organization_id', orgId).in('poei_intervention_id', p).neq('status', 'annule').order('id').range(from, to)),
    L.parIds<FactureFormateurRentab>(ids, (p, from, to) => supabase.from('factures_formateur')
      .select('id, numero, session_id, formateur_id, status, montant_ttc, fichier_url')
      .eq('organization_id', orgId).in('session_id', p).order('id').range(from, to)),
    L.parIds<CommissionSessionRentab>(ids, (p, from, to) => supabase.from('commissions_sessions')
      .select('session_id, franchise_id, status, commission_montant, base_montant, base_source, cout_formateur, cout_formateur_manuel, commission_type, calculee_at')
      .eq('organization_id', orgId).in('session_id', p).order('id').range(from, to)),
    tolerant(L.parIds<FraisRentab>(ids, (p, from, to) => supabase.from('session_frais')
      .select('id, session_id, categorie, libelle, montant, date_frais, formateur_id, justificatif_path, justificatif_nom, notes')
      .eq('organization_id', orgId).in('session_id', p).order('created_at').order('id').range(from, to)), TABLE_ABSENTE),
    L.parIds<ConventionRentab>(ids, (p, from, to) => supabase.from('conventions')
      .select('id, numero, session_id, client_id, status, montant_ht, montant_ttc')
      .eq('organization_id', orgId).in('session_id', p).order('id').range(from, to)),
    tolerant(L.parIds<DossierAgeficeRentab>(ids, (p, from, to) => supabase.from('dossiers_agefice')
      .select('id, session_id, statut, cout_pedagogique, montant_accorde, montant_demande, facture_id')
      .eq('organization_id', orgId).in('session_id', p).order('id').range(from, to)), TABLE_ABSENTE),
    L.parIds<any>(ids, (p, from, to) => supabase.from('inscriptions')
      .select('session_id, status, apprenant:apprenant_id(client_id)')
      .eq('organization_id', orgId).in('session_id', p).order('id').range(from, to)),
  ])

  // ── Étape 2 bis : factures ventilées par lignes (dans les deux sens) ──
  const facturesConnues = new Map<string, FactureRentab>()
  for (const f of [...facturesSessions, ...facturesPoei]) facturesConnues.set(f.id, f)
  const manquantes = unique(lignesSessions.map((l) => l.facture_id)).filter((id) => !facturesConnues.has(id))
  const [facturesLignes, lignesFactures] = await Promise.all([
    L.parIds<FactureRentab>(manquantes, (p, from, to) => supabase.from('factures').select(SEL_FACTURE)
      .eq('organization_id', orgId).in('id', p).order('id').range(from, to)),
    // Lignes des factures chargées vers d'autres sessions : sans elles, le reste serait mal attribué
    L.parIds<LigneFactureRentab>(Array.from(facturesConnues.keys()), (p, from, to) => supabase.from('facture_lignes')
      .select('id, facture_id, session_id, montant_ht').in('facture_id', p).not('session_id', 'is', null).order('id').range(from, to)),
  ])
  for (const f of facturesLignes) facturesConnues.set(f.id, f)

  const contrats = [...contratsSessions, ...contratsInterventions]
  const frais = fraisRes.rows
  const inscriptions: InscriptionRentab[] = inscriptionsBrutes.map((i: any) => ({
    session_id: i.session_id, status: i.status, client_id: i.apprenant?.client_id || null,
  }))
  const poeiTouches = poei.filter((p) => { const r = racine('p:' + p.id); return !!r && touchees.has(r) })

  // ── Étape 3 : fiches formateurs, franchises, établissements et apporteurs ──
  const formateurIds = unique([
    ...sessions.map((s) => s.formateur_id),
    ...contrats.map((c) => c.formateur_id),
    ...facturesFormateur.map((f) => f.formateur_id),
    ...interventions.filter((i) => interventionsTouchees.has(i.id)).map((i) => i.formateur_id),
    ...frais.map((f) => f.formateur_id),
  ])
  const clientIds = unique([...sessions.map((s) => s.client_id), ...poeiTouches.map((p) => p.client_id)])
  const lireFormateurs = (colonnes: string) => L.parIds<FormateurRentab>(formateurIds, (p, from, to) => supabase.from('formateurs')
    .select(colonnes).eq('organization_id', orgId).in('id', p).order('id').range(from, to))
  const lireClients = (colonnes: string) => L.parIds<ClientRentab>(clientIds, (p, from, to) => supabase.from('clients')
    .select(colonnes).eq('organization_id', orgId).in('id', p).order('id').range(from, to))

  const unite = 'sessionIds' in cible ? sessions : []
  const dossiers = unique(unite.map((s) => s.numero_dossier_opco))
  const principale = 'sessionIds' in cible ? sessionsCible[0] : undefined
  const pathsFactures = unique(facturesFormateur.map((f) => f.fichier_url)).filter((u) => !/^https?:\/\//.test(u))

  const [formateursRes, franchises, clientsRes, voisinsDossier, voisinsJour, urlsSignees] = await Promise.all([
    tolerant(lireFormateurs('id, prenom, nom, tarif_journalier, type_contrat, taux_tva'), [COLONNE_ABSENTE]),
    L.tout<FranchiseRentab>((from, to) => supabase.from('franchises')
      .select('id, nom, commission_type, taux_commission').eq('organization_id', orgId).order('id').range(from, to)),
    tolerant(lireClients('id, raison_sociale, nom_commercial, apporteur_id'), [COLONNE_ABSENTE]),
    // Onglet : même accord OPCO ailleurs (comparaison sans espaces ni casse, faite en mémoire)
    opts.onglet && dossiers.length
      ? L.tout<SessionVoisine>((from, to) => supabase.from('sessions').select(SEL_VOISINE)
          .eq('organization_id', orgId).not('numero_dossier_opco', 'is', null).order('id').range(from, to))
      : Promise.resolve(undefined),
    // Onglet : autre session du même client le même jour
    opts.onglet && principale?.client_id && principale.date_debut && !principale.poei_intervention_id
      ? L.tout<SessionVoisine>((from, to) => supabase.from('sessions').select(SEL_VOISINE)
          .eq('organization_id', orgId).eq('client_id', principale.client_id).eq('date_debut', principale.date_debut)
          .order('id').range(from, to))
      : Promise.resolve(undefined),
    opts.onglet && pathsFactures.length
      ? (L.requetes++, supabase.storage.from('dossiers').createSignedUrls(pathsFactures, 3600))
      : Promise.resolve({ data: [] }),
  ])

  const formateurs = formateursRes.absent
    ? await lireFormateurs('id, prenom, nom, tarif_journalier, type_contrat')
    : formateursRes.rows
  const clients = clientsRes.absent ? await lireClients('id, raison_sociale, nom_commercial') : clientsRes.rows
  const apporteurIds = unique(clients.map((c) => c.apporteur_id))
  const apporteurs = await L.parIds<ApporteurRentab>(apporteurIds, (p, from, to) => supabase.from('apporteurs_affaires')
    .select('id, nom, prenom, raison_sociale, mode_calcul, taux_commission, commission_fixe, is_active, date_debut_contrat, date_fin_contrat')
    .eq('organization_id', orgId).in('id', p).order('id').range(from, to))

  const urlsFacturesFormateur: Record<string, string> = {}
  ;((urlsSignees as any)?.data || []).forEach((s: any, i: number) => {
    if (s?.signedUrl && !s.error) urlsFacturesFormateur[pathsFactures[i]] = s.signedUrl
  })
  for (const f of facturesFormateur) if (f.fichier_url && /^https?:\/\//.test(f.fichier_url)) urlsFacturesFormateur[f.fichier_url] = f.fichier_url

  const brut: DonneesBrutes = {
    sessions,
    poei,
    interventions,
    factures: Array.from(facturesConnues.values()),
    lignes: [...lignesSessions, ...lignesFactures],
    contrats,
    facturesFormateur,
    commissionsSessions,
    frais,
    conventions,
    dossiersAgefice: ageficeRes.rows,
    inscriptions,
    formateurs,
    franchises,
    apporteurs,
    clients,
    fraisDisponibles: !fraisRes.absent,
    tvaFormateurDisponible: !formateursRes.absent,
    sessionsMemeDossier: opts.onglet ? (voisinsDossier || []) : undefined,
    sessionsMemeJour: opts.onglet ? (voisinsJour || []) : undefined,
    urlsFacturesFormateur,
  }
  if (process.env.NODE_ENV === 'development') {
    console.info(`[rentabilite] ${sessions.length} sessions, ${L.requetes} requêtes`)
  }
  return { donnees: indexerDonnees(brut), requetes: L.requetes }
}

const refLibelle = (s: SessionRentab) =>
  [s.reference || 'Session', s.date_debut ? new Date(s.date_debut + 'T00:00:00').toLocaleDateString('fr-FR') : null].filter(Boolean).join(' · ')

/**
 * Rentabilité vue depuis l'onglet Facturation d'une session.
 * null si le rôle ne voit pas la marge ; { erreur } si le calcul échoue : la
 * fiche session, elle, s'affiche toujours.
 */
export async function rentabiliteSession(
  supabase: any,
  orgId: string,
  sessionId: string,
  role: string,
): Promise<VueRentabiliteSession | { erreur: string } | null> {
  if (!peutVoirMarge(role)) return null
  try {
    const { donnees: d } = await chargerDonneesRentabilite(supabase, orgId, { sessionIds: [sessionId] }, { onglet: true })
    const u = construireUnites(d).find((x) => x.sessionIds.includes(sessionId))
    if (!u) return { erreur: MESSAGE_RENTABILITE_INDISPONIBLE }
    const rentabilite = calculerRentabilite(u, d)

    const roleVue: VueRentabiliteSession['role'] = u.type === 'poei' && !u.porteuseIds.includes(sessionId) ? 'intervention' : 'unite'
    const numeros = u.poeiIds.map((id) => d.idx.poeiParId.get(id)?.numero).filter((x): x is string => !!x)
    const parcours = u.type === 'poei'
      ? {
          poeiIds: u.poeiIds,
          numeros,
          porteuseHref: u.porteuseIds[0]
            ? `/dashboard/sessions/${u.porteuseIds[0]}?tab=facturation`
            : `/dashboard/poei/${u.poeiIds[0]}`,
        }
      : undefined

    const sessionsUnite = u.sessionIds.map((id) => d.idx.sessionParId.get(id)).filter((s): s is SessionRentab => !!s)
    const fraisParSession: Record<string, FraisVue[]> = {}
    for (const s of sessionsUnite) {
      fraisParSession[s.id] = (d.idx.fraisParSession.get(s.id) || []).map((f) => ({
        id: f.id,
        session_id: f.session_id,
        categorie: f.categorie,
        libelle: f.libelle,
        montant: Number(f.montant) || 0,
        date_frais: f.date_frais,
        formateur_id: f.formateur_id,
        justificatif_nom: f.justificatif_nom,
        aJustificatif: !!f.justificatif_path,
        notes: f.notes,
      }))
    }
    const idsFormateurs = unique([
      ...sessionsUnite.map((s) => s.formateur_id),
      ...d.contrats.filter((c) => c.session_id && u.sessionIds.includes(c.session_id)).map((c) => c.formateur_id),
      ...u.interventionIds.map((id) => d.idx.interventionParId.get(id)?.formateur_id),
      ...d.frais.map((f) => f.formateur_id),
    ])
    const formateursFrais = idsFormateurs
      .map((id) => d.idx.formateurParId.get(id))
      .filter((f): f is FormateurRentab => !!f)
      .map((f) => ({ id: f.id, nom: [f.prenom, f.nom].filter(Boolean).join(' ') || 'Formateur' }))

    const courante = d.idx.sessionParId.get(sessionId)
    return {
      role: roleVue,
      rentabilite,
      parcours,
      ancres: roleVue === 'intervention' && courante
        ? ['s:' + courante.id, ...(courante.poei_intervention_id ? ['i:' + courante.poei_intervention_id] : [])]
        : undefined,
      sessionsFrais: sessionsUnite.map((s) => ({ id: s.id, libelle: refLibelle(s) })),
      formateursFrais,
      fraisParSession,
      fraisDisponibles: d.fraisDisponibles,
      peutRecalculerCommission: ['super_admin', 'gestionnaire'].includes(role),
    }
  } catch (e) {
    console.error('[rentabilite]', e)
    return { erreur: MESSAGE_RENTABILITE_INDISPONIBLE }
  }
}

/** Synthèse d'une période : une ligne par unité (session ou parcours POEI), sans le détail des lignes. */
export async function rentabilitePeriode(
  supabase: any,
  orgId: string,
  du: string,
  au: string,
): Promise<{ lignes: Rentabilite[]; meta: { du: string; au: string; fraisDisponibles: boolean; tvaFormateurDisponible: boolean; requetes: number; erreur?: string } }> {
  try {
    const { donnees: d, requetes } = await chargerDonneesRentabilite(supabase, orgId, { du, au })
    const lignes = calculerToutes(d, { du, au }).map((r) => ({ ...r, lignes: [] }))
    return { lignes, meta: { du, au, fraisDisponibles: d.fraisDisponibles, tvaFormateurDisponible: d.tvaFormateurDisponible, requetes } }
  } catch (e) {
    console.error('[rentabilite]', e)
    return { lignes: [], meta: { du, au, fraisDisponibles: true, tvaFormateurDisponible: true, requetes: 0, erreur: MESSAGE_RENTABILITE_INDISPONIBLE } }
  }
}
