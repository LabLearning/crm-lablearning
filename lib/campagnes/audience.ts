import { dateDemande, etapeDuLead, origineDuLead } from '@/lib/leads-entrants'
import { isPlaceholderEmail } from '@/lib/utils'
import { cleOpposition, oppositionsDuCanal, refusDesFormulaires, ETIQUETTE_SANS_ACTUALITES } from './oppositions'
import { cleEmail, numeroSmsFrance, type CanalCampagne } from './regles'
import {
  cleFormation, cleTexte, cleVille, departement, JOURS_CONSERVATION, libelleVille,
  type FiltresAudience, type PublicAudience, type TypePersonne,
} from './publics'

export { JOURS_CONSERVATION, nettoyerFiltres, departementsInconnus, departement } from './publics'
export type { FiltresAudience } from './publics'

/**
 * Audience d'une campagne : les publics choisis à l'écran (prospects, clients
 * indépendants ou franchisés, têtes de réseau, apporteurs d'affaires),
 * filtrés par lieu, secteur et formation, une fois chacun (même adresse ou
 * même mobile), sans les oppositions. Cadre : la prospection des
 * professionnels, donc jamais de particulier (type « particulier », lead sans
 * établissement, financement CPF ou France Travail). Et jamais au-delà de la
 * durée de conservation annoncée (3 ans) : un lead dont la dernière demande
 * est plus ancienne, ou un client sans relation depuis 3 ans, n'est pas écrit.
 * Les sessions de POEI ne comptent pas comme formation suivie : une POEI se
 * gère dans son module et n'est pas mise en avant.
 */

export interface Destinataire {
  personne_type: TypePersonne
  personne_id: string
  public: PublicAudience
  nom: string
  prenom: string | null
  etablissement: string | null
  /** E-mail en minuscules, ou mobile au format 336… */
  destination: string
}

export interface ResultatAudience {
  destinataires: Destinataire[]
  exclus: { sansCoordonnee: number; opposition: number; doublon: number; particulier: number; ancien: number }
  /** Destinataires par public */
  parPublic: Record<PublicAudience, number>
  /** Parmi les clients : établissements franchisés atteints */
  franchisesAtteints: number
}

/** Toutes les lignes, par lots de 1 000 ; une erreur de lecture arrête tout (jamais une audience incomplète en silence). */
async function lireTout<T = any>(build: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const lignes: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await build(de, de + 999)
    if (error) throw new Error(`Lecture de l’audience : ${error.message}`)
    lignes.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return lignes
}

/** Lecture par paquets d'identifiants (une adresse de requête reste courte), chaque paquet paginé */
async function lireParIds<T = any>(ids: string[], build: (paquet: string[], de: number, a: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const lignes: T[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const paquet = ids.slice(i, i + 150)
    lignes.push(...(await lireTout<T>((de, a) => build(paquet, de, a))))
  }
  return lignes
}

// ── Formations suivies par les clients ───────────────────────────────────

interface SessionSuivie { formations: string[]; date: string }
interface Relations {
  /** Sessions hors POEI et hors annulées de chaque client : la session elle-même ou l'inscription d'un de ses apprenants */
  suivis: Map<string, SessionSuivie[]>
  /** Clients en relation depuis 3 ans : une session non annulée (POEI comprise), par la session ou par un apprenant inscrit */
  recents: Set<string>
}

async function lireRelations(supabase: any, orgId: string, historique = true): Promise<Relations> {
  const rien = Promise.resolve([] as any[])
  const [sessions, formationsPoei, poeis, inscriptions, apprenants] = await Promise.all([
    lireTout<any>((de, a) => supabase.from('sessions').select('id, client_id, formation_id, status, date_debut, poei_intervention_id')
      .eq('organization_id', orgId).order('id').range(de, a)),
    historique ? lireTout<any>((de, a) => supabase.from('formations').select('id').eq('organization_id', orgId).eq('is_poei', true).order('id').range(de, a)) : rien,
    historique ? lireTout<any>((de, a) => supabase.from('poei').select('id, session_id').eq('organization_id', orgId).order('id').range(de, a)) : rien,
    lireTout<any>((de, a) => supabase.from('inscriptions').select('id, session_id, apprenant_id, status').eq('organization_id', orgId).order('id').range(de, a)),
    lireTout<any>((de, a) => supabase.from('apprenants').select('id, client_id').eq('organization_id', orgId).not('client_id', 'is', null).order('id').range(de, a)),
  ])
  const actives = sessions.filter((s) => s.status !== 'annulee')
  // Une session peut porter plusieurs formations (table sans organisme : lue pour nos sessions seulement)
  const autres = new Map<string, string[]>()
  const multiples = historique ? await lireParIds<any>(actives.map((s) => s.id), (paquet, de, a) => supabase.from('session_formations')
    .select('session_id, formation_id').in('session_id', paquet).order('session_id').order('formation_id').range(de, a)) : []
  for (const x of multiples) {
    const liste = autres.get(x.session_id)
    if (liste) liste.push(x.formation_id); else autres.set(x.session_id, [x.formation_id])
  }
  const poei = new Set(formationsPoei.map((f) => f.id))
  const chapeaux = new Set(poeis.map((p) => p.session_id).filter(Boolean))
  const estPoei = (s: any) => !!s.poei_intervention_id || chapeaux.has(s.id) || poei.has(s.formation_id)

  const clientsDeSession = new Map<string, Set<string>>()
  for (const s of actives) clientsDeSession.set(s.id, new Set(s.client_id ? [s.client_id] : []))
  // Sessions inter-entreprises : le client d'un apprenant inscrit compte aussi
  const clientDApprenant = new Map(apprenants.map((a) => [a.id, a.client_id as string]))
  for (const i of inscriptions) {
    if (i.status === 'annule') continue
    const client = clientDApprenant.get(i.apprenant_id)
    const set = clientsDeSession.get(i.session_id)
    if (client && set) set.add(client)
  }

  const limite = new Date(Date.now() - JOURS_CONSERVATION * 86400000).toISOString().slice(0, 10)
  const suivis = new Map<string, SessionSuivie[]>()
  const recents = new Set<string>()
  for (const s of actives) {
    const clients = clientsDeSession.get(s.id) || new Set<string>()
    const date = String(s.date_debut || '').slice(0, 10)
    if (date && date >= limite) clients.forEach((c) => recents.add(c))
    if (!historique || estPoei(s)) continue
    const formations = Array.from(new Set([s.formation_id, ...(autres.get(s.id) || [])].filter(Boolean)))
    for (const c of Array.from(clients)) {
      const liste = suivis.get(c)
      if (liste) liste.push({ formations, date }); else suivis.set(c, [{ formations, date }])
    }
  }
  return { suivis, recents }
}

const ilYA = (mois: number) => { const d = new Date(); d.setMonth(d.getMonth() - mois); return d.toISOString().slice(0, 10) }

/** Le client répond-il au filtre de formation (déjà formé sur la période, ou jamais formé) ? */
function formationOk(suivis: SessionSuivie[] | undefined, f: FiltresAudience['formations']): boolean {
  if (!f.ids.length) return true
  const choix = new Set(f.ids)
  const concernees = (suivis || []).filter((s) => s.formations.some((x) => choix.has(x)))
  // Jamais formé : aucune session, passée, en cours ou à venir
  if (f.mode === 'jamais') return concernees.length === 0
  if (!concernees.length) return false
  const dates = concernees.map((s) => s.date).filter(Boolean).sort()
  const derniere = dates[dates.length - 1]
  switch (f.periode) {
    case 'moins_6_mois': return dates.some((d) => d >= ilYA(6))
    case 'moins_1_an': return dates.some((d) => d >= ilYA(12))
    // Rien depuis : la dernière session (à venir comprise) est plus ancienne
    case 'plus_1_an': return !!derniere && derniere < ilYA(12)
    case 'plus_2_ans': return !!derniere && derniere < ilYA(24)
    default: return true
  }
}

// ── Calcul de l'audience ─────────────────────────────────────────────────

type Issue = 'retenu' | 'sans' | 'oppose' | 'doublon'

/** Colonnes d'un lead utiles à l'audience (origine, étape, date de la demande, lieu, secteur, formation, coordonnées) */
const COLONNES_LEADS = 'id, source, status, converted_client_id, created_at, derniere_demande_le, type, entreprise, financeur_type, tags, '
  + 'ville, code_postal, secteur_activite, formation_id, formation_souhaitee, contact_prenom, contact_nom, contact_email, contact_telephone'

export async function calculerAudience(supabase: any, orgId: string, canal: CanalCampagne, f: FiltresAudience): Promise<ResultatAudience> {
  const exclus = { sansCoordonnee: 0, opposition: 0, doublon: 0, particulier: 0, ancien: 0 }
  const parPublic: Record<PublicAudience, number> = { prospects: 0, clients: 0, reseaux: 0, apporteurs: 0 }
  let franchisesAtteints = 0
  const vus = new Set<string>()
  const destinataires: Destinataire[] = []
  // Oppositions, et case « Je ne souhaite pas recevoir les actualités » cochée par un lead (sous toutes ses fiches)
  const [opposes, refus] = await Promise.all([oppositionsDuCanal(supabase, orgId, canal), refusDesFormulaires(supabase, orgId, canal)])
  const oppositions = new Set([...opposes, ...refus])

  const coordonnee = (v: unknown): string | null => {
    if (canal === 'sms') return numeroSmsFrance(v as string)
    const e = cleEmail(v as string)
    return e && !isPlaceholderEmail(e) ? e : null
  }
  const parCanal = (email: unknown[], sms: unknown[]) => (canal === 'email' ? email : sms)
  /** Une personne : sa première coordonnée exploitable décide (opposée, elle n'est pas remplacée par une autre) */
  const essayer = (d: Omit<Destinataire, 'destination'>, coordonnees: unknown[]): Issue => {
    for (const v of coordonnees) {
      const destination = coordonnee(v)
      if (!destination) continue
      if (oppositions.has(cleOpposition(canal, destination) || '')) return 'oppose'
      if (vus.has(destination)) return 'doublon'
      vus.add(destination)
      destinataires.push({ ...d, destination })
      parPublic[d.public]++
      return 'retenu'
    }
    return 'sans'
  }
  /** Ce qu'on retient d'un groupe (établissement, réseau) : atteint, sinon la raison la plus parlante */
  const bilan = (issues: Issue[]): Issue => (issues.includes('retenu') ? 'retenu' : issues.includes('oppose') ? 'oppose' : issues.includes('doublon') ? 'doublon' : 'sans')
  const noter = (issue: Issue) => {
    if (issue === 'sans') exclus.sansCoordonnee++
    else if (issue === 'oppose') exclus.opposition++
    else if (issue === 'doublon') exclus.doublon++
  }

  const villes = new Set(f.villes)
  const departements = new Set(f.departements)
  const secteurs = new Set(f.secteurs)
  const lieuOk = (ville: unknown, cp: unknown) => (!villes.size && !departements.size)
    || villes.has(cleVille(ville)) || departements.has(departement(cp as string) || '')
  const secteurOk = (s: unknown) => !secteurs.size || secteurs.has(cleTexte(s))

  const filtreFormation = f.formations.ids.length > 0
  // Sessions des clients (relation de 3 ans, formations suivies), lues une seule fois : pour les clients, et pour
  // les prospects devenus clients ; l'historique des formations seulement quand un filtre de formation le demande
  let promesseRelations: Promise<Relations> | null = null
  const lireLesRelations = () => (promesseRelations ??= lireRelations(supabase, orgId, filtreFormation))

  // 1. Clients : chaque établissement, ses contacts d'abord, sa fiche ensuite (souvent le seul moyen de le joindre)
  if (f.clients.actif) {
    const [clients, contacts, relations] = await Promise.all([
      lireTout<any>((de, a) => supabase.from('clients')
        .select('id, type, raison_sociale, nom_commercial, email, telephone, ville, code_postal, secteur_activite, franchise_id, financeur_type, created_at')
        .eq('organization_id', orgId).order('id').range(de, a)),
      lireTout<any>((de, a) => supabase.from('contacts')
        .select('id, client_id, prenom, nom, email, mobile, telephone, est_principal, est_referent_formation, est_signataire')
        .eq('organization_id', orgId).not('client_id', 'is', null).order('id').range(de, a)),
      lireLesRelations(),
    ])
    const contactsDe = new Map<string, any[]>()
    for (const c of contacts) {
      const liste = contactsDe.get(c.client_id)
      if (liste) liste.push(c); else contactsDe.set(c.client_id, [c])
    }
    const limite = new Date(Date.now() - JOURS_CONSERVATION * 86400000).toISOString()
    const reseaux = new Set(f.clients.franchiseIds)
    // Le contact principal d'abord, puis le référent formation, puis le signataire
    const rang = (c: any) => (c.est_principal ? 0 : c.est_referent_formation ? 1 : c.est_signataire ? 2 : 3)
    for (const client of clients) {
      if (f.clients.perimetre === 'independants' && client.franchise_id) continue
      if (f.clients.perimetre === 'franchises' && (!client.franchise_id || (reseaux.size && !reseaux.has(client.franchise_id)))) continue
      if (!lieuOk(client.ville, client.code_postal) || !secteurOk(client.secteur_activite)) continue
      if (!formationOk(relations.suivis.get(client.id), f.formations)) continue
      // Un particulier n'est pas prospecté sans son accord : type « particulier », ou formation payée par son CPF
      // (« france_travail » sur une fiche client désigne l'employeur d'une POEI : une entreprise)
      if (client.type === 'particulier' || client.financeur_type === 'cpf') { exclus.particulier++; continue }
      // Client sans session ni création depuis 3 ans : au-delà de la durée de conservation annoncée
      if (!relations.recents.has(client.id) && !(client.created_at && client.created_at >= limite)) { exclus.ancien++; continue }
      const etablissement = client.nom_commercial || client.raison_sociale || null
      const personnes = [...(contactsDe.get(client.id) || [])].sort((x, y) => rang(x) - rang(y))
      const candidats = [
        ...personnes.map((c) => ({
          generique: false,
          d: { personne_type: 'contact' as const, personne_id: c.id, public: 'clients' as const, nom: [c.prenom, c.nom].filter(Boolean).join(' ') || etablissement || 'Contact', prenom: c.prenom || null, etablissement },
          coordonnees: parCanal([c.email], [c.mobile, c.telephone]),
        })),
        {
          generique: true,
          d: { personne_type: 'client' as const, personne_id: client.id, public: 'clients' as const, nom: etablissement || 'Client', prenom: null, etablissement },
          coordonnees: parCanal([client.email], [client.telephone]),
        },
      ]
      const issues: Issue[] = []
      for (const cand of candidats) {
        // La fiche du client (son adresse générale) ne sert que si aucun contact n'a été joint, déjà écrit ou opposé :
        // jamais en plus d'un contact, ni à la place d'une personne qui s'est opposée
        if (cand.generique && issues.some((i) => i !== 'sans')) continue
        const issue = essayer(cand.d, cand.coordonnees)
        issues.push(issue)
        // Un seul par établissement : le premier joint (ou déjà joint par une autre fiche) suffit
        if (f.clients.unParEtablissement && (issue === 'retenu' || issue === 'doublon')) break
      }
      const b = bilan(issues)
      if (b === 'retenu') { if (client.franchise_id) franchisesAtteints++ } else noter(b)
    }
  }

  // 2. Têtes de réseau : le référent de la franchise et les comptes actifs du portail franchise
  if (f.reseaux.actif) {
    const [franchises, comptes] = await Promise.all([
      lireTout<any>((de, a) => supabase.from('franchises').select('id, nom, contact_nom, contact_email, contact_telephone, is_active')
        .eq('organization_id', orgId).order('id').range(de, a)),
      lireTout<any>((de, a) => supabase.from('users').select('id, first_name, last_name, email, phone, franchise_id')
        .eq('organization_id', orgId).eq('role', 'franchise').eq('status', 'active').order('id').range(de, a)),
    ])
    const choisis = new Set(f.reseaux.franchiseIds)
    for (const fr of franchises) {
      if (fr.is_active === false || (choisis.size && !choisis.has(fr.id))) continue
      const issues: Issue[] = [essayer(
        { personne_type: 'franchise', personne_id: fr.id, public: 'reseaux', nom: fr.contact_nom || fr.nom, prenom: null, etablissement: fr.nom },
        parCanal([fr.contact_email], [fr.contact_telephone]),
      )]
      for (const u of comptes.filter((u) => u.franchise_id === fr.id)) {
        issues.push(essayer(
          { personne_type: 'utilisateur', personne_id: u.id, public: 'reseaux', nom: [u.first_name, u.last_name].filter(Boolean).join(' ') || fr.nom, prenom: u.first_name || null, etablissement: fr.nom },
          parCanal([u.email], [u.phone]),
        ))
      }
      const b = bilan(issues)
      if (b !== 'retenu') noter(b)
    }
  }

  // 3. Apporteurs d'affaires (jamais les anciennes fiches « partenaire », remplacées par les franchises)
  if (f.apporteurs.actif) {
    const apporteurs = await lireTout<any>((de, a) => supabase.from('apporteurs_affaires')
      .select('id, nom, prenom, nom_enseigne, raison_sociale, email, telephone, is_active, type, categorie')
      .eq('organization_id', orgId).order('id').range(de, a))
    for (const ap of apporteurs) {
      if (ap.is_active === false || ap.categorie === 'partenaire') continue
      if (ap.type === 'particulier') { exclus.particulier++; continue }
      const etablissement = ap.nom_enseigne || ap.raison_sociale || null
      const issue = essayer(
        { personne_type: 'apporteur', personne_id: ap.id, public: 'apporteurs', nom: [ap.prenom, ap.nom].filter(Boolean).join(' ') || etablissement || 'Apporteur', prenom: ap.prenom || null, etablissement },
        parCanal([ap.email], [ap.telephone]),
      )
      if (issue !== 'retenu') noter(issue)
    }
  }

  // 4. Prospects (après les clients : un lead devenu client est jugé avec son établissement)
  if (f.prospects.actif) {
    const p = f.prospects
    const depuis = Date.now() - Math.min(p.depuisJours || JOURS_CONSERVATION, JOURS_CONSERVATION) * 86400000
    const rien = Promise.resolve([] as any[])
    const [leads, demandes, choisies] = await Promise.all([
      lireTout<any>((de, a) => supabase.from('leads').select(COLONNES_LEADS).eq('organization_id', orgId).order('id').range(de, a)),
      filtreFormation
        ? lireTout<any>((de, a) => supabase.from('lead_formations').select('lead_id, formation_id').eq('organization_id', orgId).order('id').range(de, a))
        : rien,
      // Intitulés des formations choisies : une demande entrante ne porte souvent que le texte de la formation souhaitée
      filtreFormation
        ? lireParIds<any>(f.formations.ids, (paquet, de, a) => supabase.from('formations').select('id, intitule')
          .eq('organization_id', orgId).in('id', paquet).order('id').range(de, a))
        : rien,
    ])
    const demandees = new Map<string, Set<string>>()
    for (const d of demandes) {
      const ens = demandees.get(d.lead_id)
      if (ens) ens.add(d.formation_id); else demandees.set(d.lead_id, new Set([d.formation_id]))
    }
    const choix = new Set(f.formations.ids)
    const intitules = Array.from(new Set(choisies.map((fo) => cleFormation(fo.intitule)).filter(Boolean)))
    /** Le texte saisi par le prospect désigne-t-il l'une des formations choisies ? Mots entiers, chaque partie à part */
    const texteDemande = (texte: unknown) => String(texte || '').split(/[,;\n/|]+/).map(cleFormation).filter((t) => t.length >= 4)
      .some((t) => intitules.some((k) => ` ${k} `.includes(` ${t} `) || ` ${t} `.includes(` ${k} `)))
    // Prospects seuls, filtre de formation : les sessions de l'établissement d'un prospect devenu client comptent aussi
    const relations = filtreFormation && !f.clients.actif && leads.some((l) => l.converted_client_id) ? await lireLesRelations() : null
    for (const l of leads) {
      // Clients cochés : la passe des clients a tranché pour son établissement (écrit comme client, ou écarté par un filtre)
      if (l.converted_client_id && f.clients.actif) continue
      if (p.origines.length && !p.origines.includes(origineDuLead(l.source))) continue
      if (p.etapes.length && !p.etapes.includes(etapeDuLead(l))) continue
      if (Date.parse(dateDemande(l)) < depuis) continue
      if (!lieuOk(l.ville, l.code_postal) || !secteurOk(l.secteur_activite)) continue
      if (filtreFormation) {
        // Pour un prospect : la formation demandée (choisie dans le CRM, ou écrite dans sa demande)
        const voulues = new Set([...Array.from(demandees.get(l.id) || []), ...(l.formation_id ? [l.formation_id] : [])])
        const demande = Array.from(voulues).some((x) => choix.has(x)) || texteDemande(l.formation_souhaitee)
        const sessions = l.converted_client_id && relations ? relations.suivis.get(l.converted_client_id) : undefined
        const garde = f.formations.mode === 'jamais'
          ? !demande && formationOk(sessions, f.formations)
          : demande || (!!sessions && formationOk(sessions, f.formations))
        if (!garde) continue
      }
      // Un particulier n'est pas prospecté sans son accord : type « particulier », pas d'établissement, ou financement personnel
      if (l.type === 'particulier' || !String(l.entreprise || '').trim() || ['cpf', 'france_travail'].includes(l.financeur_type)) { exclus.particulier++; continue }
      // Case « Je ne souhaite pas recevoir les actualités » gardée aussi sur le lead
      if ((l.tags || []).includes(ETIQUETTE_SANS_ACTUALITES)) { exclus.opposition++; continue }
      const issue = essayer(
        { personne_type: 'lead', personne_id: l.id, public: 'prospects', nom: [l.contact_prenom, l.contact_nom].filter(Boolean).join(' ') || l.entreprise || 'Prospect', prenom: l.contact_prenom || null, etablissement: l.entreprise || null },
        parCanal([l.contact_email], [l.contact_telephone]),
      )
      if (issue !== 'retenu') noter(issue)
    }
  }

  return { destinataires, exclus, parPublic, franchisesAtteints }
}

// ── Choix proposés à l'écran ─────────────────────────────────────────────

export interface OptionsAudience {
  reseaux: { id: string; nom: string; etablissements: number; comptes: number }[]
  villes: { cle: string; libelle: string; nombre: number }[]
  departements: { code: string; nombre: number }[]
  secteurs: { cle: string; libelle: string; nombre: number }[]
  /** Une entrée par intitulé : les versions d'une même formation se rejoignent */
  formations: { cle: string; libelle: string; ids: string[]; clients: number }[]
}

/** Regroupe des valeurs saisies par clé ; la graphie la plus fréquente (en casse mixte de préférence) sert de libellé. */
function grouper(valeurs: unknown[], cle: (v: unknown) => string, mettreEnForme: (v: string) => string) {
  const groupes = new Map<string, { nombre: number; graphies: Map<string, number> }>()
  for (const v of valeurs) {
    const brut = String(v ?? '').replace(/\s+/g, ' ').trim()
    const k = cle(brut)
    if (!brut || !k) continue
    const g = groupes.get(k) || { nombre: 0, graphies: new Map<string, number>() }
    g.nombre++
    g.graphies.set(brut, (g.graphies.get(brut) || 0) + 1)
    groupes.set(k, g)
  }
  return Array.from(groupes.entries()).map(([k, g]) => {
    // Graphies de la plus fréquente à la plus rare, mises en forme (« BÉZIERS » devient « Béziers ») ; une graphie
    // accentuée l'emporte (« Béziers » plutôt que « Beziers »), sinon une graphie en casse mixte, sinon la plus fréquente
    const formes = Array.from(g.graphies.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => ({ brut: t, forme: mettreEnForme(t) }))
    const accentuee = formes.find((f) => /\p{M}/u.test(f.forme.normalize('NFD')))
    const mixte = formes.find((f) => f.brut !== f.brut.toUpperCase())
    return { cle: k, libelle: (accentuee || mixte || formes[0]).forme, nombre: g.nombre }
  }).sort((a, b) => b.nombre - a.nombre || a.libelle.localeCompare(b.libelle, 'fr'))
}

export async function optionsAudience(supabase: any, orgId: string): Promise<OptionsAudience> {
  const [franchises, clients, leads, formations, comptes, relations] = await Promise.all([
    lireTout<any>((de, a) => supabase.from('franchises').select('id, nom, is_active').eq('organization_id', orgId).order('id').range(de, a)),
    lireTout<any>((de, a) => supabase.from('clients').select('id, type, ville, code_postal, secteur_activite, franchise_id, financeur_type').eq('organization_id', orgId).order('id').range(de, a)),
    lireTout<any>((de, a) => supabase.from('leads').select('id, ville, code_postal, secteur_activite').eq('organization_id', orgId).order('id').range(de, a)),
    lireTout<any>((de, a) => supabase.from('formations').select('id, intitule, is_poei, is_active').eq('organization_id', orgId).order('id').range(de, a)),
    lireTout<any>((de, a) => supabase.from('users').select('id, franchise_id').eq('organization_id', orgId).eq('role', 'franchise').eq('status', 'active').order('id').range(de, a)),
    lireRelations(supabase, orgId),
  ])
  const pros = clients.filter((c) => c.type !== 'particulier' && c.financeur_type !== 'cpf')
  const lieux = [...pros, ...leads]

  const departements = new Map<string, number>()
  for (const x of lieux) { const d = departement(x.code_postal); if (d) departements.set(d, (departements.get(d) || 0) + 1) }

  const clientsParFormation = new Map<string, Set<string>>()
  for (const [client, sessions] of Array.from(relations.suivis.entries())) {
    for (const s of sessions) {
      for (const id of s.formations) {
        const ens = clientsParFormation.get(id)
        if (ens) ens.add(client); else clientsParFormation.set(id, new Set([client]))
      }
    }
  }
  const groupes = new Map<string, { libelles: Map<string, number>; ids: string[]; clients: Set<string>; active: boolean }>()
  for (const fo of formations) {
    if (fo.is_poei) continue
    const brut = String(fo.intitule || '').replace(/\s+/g, ' ').trim()
    const k = cleFormation(brut)
    if (!k) continue
    const g = groupes.get(k) || { libelles: new Map<string, number>(), ids: [], clients: new Set<string>(), active: false }
    const suivie = clientsParFormation.get(fo.id) || new Set<string>()
    g.ids.push(fo.id)
    g.libelles.set(brut, (g.libelles.get(brut) || 0) + suivie.size + 1)
    suivie.forEach((c) => g.clients.add(c))
    g.active = g.active || fo.is_active !== false
    groupes.set(k, g)
  }

  return {
    reseaux: franchises.filter((fr) => fr.is_active !== false).map((fr) => ({
      id: fr.id, nom: fr.nom,
      etablissements: clients.filter((c) => c.franchise_id === fr.id).length,
      comptes: comptes.filter((u) => u.franchise_id === fr.id).length,
    })).sort((a, b) => b.etablissements - a.etablissements || a.nom.localeCompare(b.nom, 'fr')),
    villes: grouper(lieux.map((x) => x.ville), cleVille, libelleVille),
    departements: Array.from(departements.entries()).map(([code, nombre]) => ({ code, nombre })).sort((a, b) => b.nombre - a.nombre || a.code.localeCompare(b.code)),
    secteurs: grouper(lieux.map((x) => x.secteur_activite), cleTexte, (v) => v),
    // Une formation retirée du catalogue reste proposée si des clients l'ont suivie
    formations: Array.from(groupes.entries()).filter(([, g]) => g.active || g.clients.size > 0).map(([k, g]) => ({
      cle: k,
      libelle: Array.from(g.libelles.entries()).sort((a, b) => b[1] - a[1])[0][0],
      ids: g.ids,
      clients: g.clients.size,
    })).sort((a, b) => b.clients - a.clients || a.libelle.localeCompare(b.libelle, 'fr')),
  }
}

/**
 * Libellés de l'audience d'une campagne partie ou programmée (elle ne se modifie
 * plus) : les réseaux et les formations choisis, sans relire toutes les fiches.
 * Les villes et les secteurs gardent leur clé mise en forme.
 */
export async function optionsFigees(supabase: any, orgId: string, f: FiltresAudience): Promise<OptionsAudience> {
  const reseauxChoisis = Array.from(new Set([...f.clients.franchiseIds, ...f.reseaux.franchiseIds]))
  const [franchises, formations] = await Promise.all([
    reseauxChoisis.length
      ? lireParIds<any>(reseauxChoisis, (paquet, de, a) => supabase.from('franchises').select('id, nom').eq('organization_id', orgId).in('id', paquet).order('id').range(de, a))
      : Promise.resolve([] as any[]),
    f.formations.ids.length
      ? lireParIds<any>(f.formations.ids, (paquet, de, a) => supabase.from('formations').select('id, intitule').eq('organization_id', orgId).in('id', paquet).order('id').range(de, a))
      : Promise.resolve([] as any[]),
  ])
  const groupes = new Map<string, { libelle: string; ids: string[] }>()
  for (const fo of formations) {
    const k = cleFormation(fo.intitule)
    const g = groupes.get(k) || { libelle: String(fo.intitule || '').trim(), ids: [] as string[] }
    g.ids.push(fo.id)
    groupes.set(k, g)
  }
  const enMots = (cle: string) => cle.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
  return {
    reseaux: franchises.map((fr) => ({ id: fr.id, nom: fr.nom, etablissements: 0, comptes: 0 })),
    villes: f.villes.map((cle) => ({ cle, libelle: enMots(cle), nombre: 0 })),
    departements: f.departements.map((code) => ({ code, nombre: 0 })),
    secteurs: f.secteurs.map((cle) => ({ cle, libelle: cle.charAt(0).toUpperCase() + cle.slice(1), nombre: 0 })),
    formations: Array.from(groupes.entries()).map(([cle, g]) => ({ cle, libelle: g.libelle, ids: g.ids, clients: 0 })),
  }
}
