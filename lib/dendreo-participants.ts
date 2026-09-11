/**
 * Participants Dendreo → stagiaires inscrits dans le CRM.
 *
 * La synchro quotidienne crée les fiches apprenants et les sessions, jamais
 * les inscriptions : un stagiaire ajouté dans Dendreo après la création de
 * l'action n'apparaissait sur aucune session (HA TACOS, août 2026). Une
 * action sans stagiaire ne peut ni émarger, ni être évaluée, ni être facturée
 * correctement — et pour l'auditeur, elle n'a tout simplement pas eu lieu.
 *
 * `laps.php?id_action_de_formation=` donne les participants avec leur identité
 * complète et leur présence.
 */
import { fetchAllPaged } from '@/lib/supabase/fetch-all'

/**
 * Recul du cron quotidien sur la date de fin des sessions. Au-delà, les ajouts
 * tardifs dans Dendreo sont surtout des régularisations d'actions déjà saisies
 * à la main dans le CRM : ils se traitent sur liste validée, pas en automatique.
 */
export const RECUL_JOURS_CRON = 14

/**
 * La synchro importe une action le matin qui suit sa création dans Dendreo.
 * Une session créée bien plus tard a été supprimée ou archivée dans le CRM,
 * puis recréée par la synchro. Trois jours tolèrent un passage du cron manqué.
 */
const ECART_RECREATION_JOURS = 3

export interface OptionsReconciliation {
  /** Sessions CRM visées ; sans liste, toutes les sessions Dendreo de l'organisation. */
  sessionIds?: string[]
  /** Date de fin minimale des sessions (AAAA-MM-JJ). */
  depuis?: string
  /** Calcule le bilan sans rien écrire. */
  apercu?: boolean
  /** Laisse à trancher les sessions créées dans le CRM bien après leur action Dendreo. */
  ecarterRecreees?: boolean
}

export interface LigneParticipant {
  session_id: string
  reference: string | null
  /** id_participant Dendreo */
  participant: string
  /** Nom de la fiche CRM concernée, à défaut celui de Dendreo */
  nom: string
  apprenant_id: string | null
  action: string
  detail?: string
}

export interface BilanReconciliation {
  apercu: boolean
  sessions_examinees: number
  sessions_traitees: number
  sessions_sans_participant: number
  apprenants_crees: number
  apprenants_relies_par_nom: number
  apprenants_rattaches_client: number
  inscriptions_creees: number
  deja_inscrits: number
  /** Ce qui a été écrit (ou le serait, en aperçu) */
  mouvements: LigneParticipant[]
  /** Laissé en l'état : une personne doit trancher */
  a_verifier: LigneParticipant[]
  sessions_ignorees: { session_id: string; reference: string | null; raison: string }[]
  erreurs: { session_id?: string; reference?: string | null; participant?: string; message: string }[]
}

interface Fiche { id: string; nom: string | null; prenom: string | null; client_id: string | null; dendreo_id: string | null }
interface SessionVisee {
  id: string; reference: string | null; dendreo_id: string; client_id: string | null; formation_id: string | null
  date_debut: string | null; date_fin: string | null; status: string; created_at: string
}
interface SessionVoisine { id: string; reference: string | null; dendreo_id: string | null; formation_id: string | null; date_debut: string; date_fin: string }

const COLS_FICHE = 'id, nom, prenom, client_id, dendreo_id'
const ANNULEES = ['annule', 'abandonne']
// Mêmes statuts que syncConventionAvenant : la liste des stagiaires y est contractuelle
const CONVENTIONS_ENGAGEES = ['envoyee', 'signee_client', 'signee_complete']
const TAILLE_LOT = 100

const propre = (v: any): string | null => {
  const s = String(v ?? '').trim()
  return s || null
}
const ident = (v: any): string | null => {
  const s = propre(v)
  return s && s !== '0' ? s : null
}
const jour = (v: any): string | null => {
  const s = String(v ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !s.startsWith('0000') ? s : null
}
const positif = (v: any): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}
// Même convention que la reprise initiale et le webhook
const statutInscription = (statutSession: string) =>
  statutSession === 'terminee' ? 'complete' : statutSession === 'en_cours' ? 'en_cours' : 'confirme'
// « NON » à 0 h : la présence n'a pas été relevée, le stagiaire n'est pas absent pour autant
const presenceRelevee = (lap: any) => String(lap?.presence).toUpperCase() === 'OUI' || positif(lap?.total_heures_presence) > 0
const presenceDendreo = (lap: any): string =>
  presenceRelevee(lap) ? `présence Dendreo ${positif(lap.total_heures_presence)} h (${positif(lap.presence_percent)} %)`
    : positif(lap?.total_heures_absence) > 0 ? `absent d'après Dendreo (${positif(lap.total_heures_absence)} h d'absence)`
      : 'aucune présence relevée dans Dendreo'

/**
 * Clé d'identité d'une personne : sans accents, casse ni ponctuation, mots
 * triés. « DUPONT Jean-Pierre » et « Jean Pierre Dupont » donnent la même clé :
 * les fiches saisies à la main inversent souvent nom et prénom.
 */
export function cleIdentite(prenom: unknown, nom: unknown): string {
  return `${prenom ?? ''} ${nom ?? ''}`
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')
}

/** Un mot seul (prénom sans nom, nom « — » de la reprise) n'identifie personne. */
export const cleExploitable = (cle: string) => cle.split(' ').length >= 2

/** Même personne quand tous les mots d'une clé sont dans l'autre : un second prénom d'un seul côté. */
function memePersonne(a: string, b: string): boolean {
  const [courte, longue] = a.split(' ').length <= b.split(' ').length ? [a, b] : [b, a]
  const mots = new Set(longue.split(' '))
  return courte.split(' ').every((m) => mots.has(m))
}

/**
 * fetchAllPaged s'arrête sans bruit sur une erreur, et postgrest-js rend une
 * coupure réseau comme une erreur : une lecture ratée passerait pour « aucune
 * ligne ». Ici, elle interrompt la réconciliation avant toute écriture.
 */
function toutLire<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  return fetchAllPaged<T>(async (from, to) => {
    const r = await build(from, to)
    if (r.error) throw new Error(`lecture Supabase : ${r.error.message || r.error}`)
    return r
  })
}

async function parLots<T>(ids: string[], lire: (lot: string[]) => Promise<T[]>): Promise<T[]> {
  const lots: string[][] = []
  for (let i = 0; i < ids.length; i += TAILLE_LOT) lots.push(ids.slice(i, i + TAILLE_LOT))
  return (await Promise.all(lots.map(lire))).flat()
}

async function enParallele<T>(liste: T[], n: number, traiter: (x: T) => Promise<void>) {
  let i = 0
  const tache = async () => { while (i < liste.length) await traiter(liste[i++]) }
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, tache))
}

type ReponseDendreo = { data: any } | { erreur: string; definitive: boolean }

async function lireDendreo(chemin: string): Promise<ReponseDendreo> {
  const base = process.env.DENDREO_API_BASE || `https://pro.dendreo.com/${process.env.DENDREO_SLUG || 'lab_learning'}/api`
  const key = process.env.DENDREO_API_KEY
  if (!key) throw new Error('Accès Dendreo non configuré')
  let erreur = ''
  for (let essai = 0; essai < 4; essai++) {
    try {
      const r = await fetch(`${base}/${chemin}`, {
        headers: { Authorization: `Token token="${key}"`, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (r.ok) return { data: await r.json() }
      // Action supprimée ou inconnue de Dendreo : inutile d'insister
      if (r.status < 500 && r.status !== 429) {
        const corps: any = await r.json().catch(() => null)
        const detail = Array.isArray(corps?.errors) ? corps.errors.join(' ; ') : ''
        return { erreur: detail || `Dendreo ${r.status}`, definitive: true }
      }
      erreur = `Dendreo ${r.status}`
    } catch (e: any) {
      erreur = e?.message || 'Dendreo injoignable'
    }
    await new Promise((ok) => setTimeout(ok, 1200))
  }
  return { erreur, definitive: false }
}

/**
 * Réconcilie les participants actifs de chaque action Dendreo avec les
 * inscrits de la session CRM correspondante.
 *
 * Pour chaque participant : sa fiche est retrouvée par identifiant Dendreo ;
 * à défaut, la fiche du même client au même nom sans identifiant Dendreo le
 * reçoit ; sinon elle est créée. Il est ensuite inscrit s'il ne l'est pas.
 * Rien n'est jamais retiré ni réactivé : une inscription existante, même
 * annulée, reste telle quelle.
 *
 * Laissé à trancher (`a_verifier`), sans rien écrire : une fiche liée qui
 * porte un autre nom que le participant, deux fiches pour la même personne,
 * plusieurs fiches homonymes, la même personne aux mêmes dates sur une autre
 * session de la même formation, une session recréée par la synchro. Ces
 * lignes reviennent à chaque passage tant que personne n'a tranché.
 *
 * Signalé après inscription : sur une session terminée, la grille
 * d'émargement à poser d'après la présence Dendreo, l'attestation d'hygiène
 * déjà partie sans le stagiaire ; sur une convention déjà envoyée ou signée,
 * l'avenant à établir.
 */
export async function reconcilierParticipantsDendreo(
  supabase: any,
  organizationId: string,
  opts: OptionsReconciliation = {},
): Promise<BilanReconciliation> {
  const apercu = !!opts.apercu
  const bilan: BilanReconciliation = {
    apercu, sessions_examinees: 0, sessions_traitees: 0, sessions_sans_participant: 0,
    apprenants_crees: 0, apprenants_relies_par_nom: 0, apprenants_rattaches_client: 0,
    inscriptions_creees: 0, deja_inscrits: 0,
    mouvements: [], a_verifier: [], sessions_ignorees: [], erreurs: [],
  }
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const terminee = (s: SessionVisee) => s.status === 'terminee' || (!!s.date_fin && s.date_fin < aujourdhui)

  const lireSessions = (lot?: string[]) => toutLire<SessionVisee>((from, to) => {
    let q = supabase.from('sessions')
      .select('id, reference, dendreo_id, client_id, formation_id, date_debut, date_fin, status, created_at')
      .eq('organization_id', organizationId)
      .not('dendreo_id', 'is', null)
      .neq('status', 'annulee')
    if (opts.depuis) q = q.gte('date_fin', opts.depuis)
    if (lot) q = q.in('id', lot)
    return q.order('id').range(from, to)
  })
  const lues = opts.sessionIds ? await parLots(opts.sessionIds, lireSessions) : await lireSessions()
  bilan.sessions_examinees = lues.length
  if (lues.length === 0) return bilan

  // Une seule clé Dendreo est branchée : la même action dans une autre
  // organisation y a été rangée (archive), et la synchro en a recréé ici une
  // copie vide. La remplir rouvrirait la session archivée.
  const ailleurs = await parLots([...new Set(lues.map((s) => String(s.dendreo_id)))], (lot) =>
    toutLire<{ dendreo_id: string; reference: string | null }>((from, to) => supabase.from('sessions')
      .select('id, dendreo_id, reference')
      .neq('organization_id', organizationId)
      .in('dendreo_id', lot)
      .order('id').range(from, to)))
  const archivees = new Map(ailleurs.map((a) => [String(a.dendreo_id), a.reference]))
  const sessions = lues.filter((s) => {
    if (!archivees.has(String(s.dendreo_id))) return true
    bilan.sessions_ignorees.push({
      session_id: s.id, reference: s.reference,
      raison: `action archivée dans une autre organisation (${archivees.get(String(s.dendreo_id)) || s.dendreo_id}) : copie recréée par la synchro, laissée vide`,
    })
    return false
  })

  const lapsParSession = new Map<string, any[]>()
  await enParallele(sessions, 4, async (s) => {
    const r = await lireDendreo(`laps.php?id_action_de_formation=${encodeURIComponent(s.dendreo_id)}`)
    if ('data' in r && Array.isArray(r.data)) {
      // Un participant retiré de l'action reste listé, avec un statut inactif
      lapsParSession.set(s.id, r.data.filter((l: any) => String(l.status) === '1' && ident(l.id_participant)))
    } else if ('data' in r || r.definitive) {
      bilan.sessions_ignorees.push({ session_id: s.id, reference: s.reference, raison: 'data' in r ? 'réponse Dendreo inattendue' : r.erreur })
    } else {
      bilan.erreurs.push({ session_id: s.id, reference: s.reference, message: r.erreur })
    }
  })
  bilan.sessions_sans_participant = sessions.filter((s) => lapsParSession.get(s.id)?.length === 0).length
  let traitables = sessions
    .filter((s) => (lapsParSession.get(s.id)?.length || 0) > 0)
    .sort((a, b) => String(a.date_debut).localeCompare(String(b.date_debut)))

  if (opts.ecarterRecreees && traitables.length > 0) {
    const creationDendreo = new Map<string, string>()
    await enParallele(traitables, 4, async (s) => {
      const r = await lireDendreo(`actions_de_formation.php?id_action_de_formation=${encodeURIComponent(s.dendreo_id)}`)
      const dateAdd = 'data' in r ? propre(r.data?.date_add) : null
      if (dateAdd) creationDendreo.set(s.id, dateAdd)
      else bilan.erreurs.push({ session_id: s.id, reference: s.reference, message: `création de l'action dans Dendreo : ${'erreur' in r ? r.erreur : 'date inconnue'}` })
    })
    traitables = traitables.filter((s) => {
      const dateAdd = creationDendreo.get(s.id)
      if (!dateAdd) return false
      const ecart = (Date.parse(s.created_at) - Date.parse(dateAdd.replace(' ', 'T'))) / 86400000
      if (!(ecart > ECART_RECREATION_JOURS)) return true
      const vus = new Set<string>()
      for (const lap of lapsParSession.get(s.id) || []) {
        const idp = String(lap.id_participant)
        if (vus.has(idp)) continue
        vus.add(idp)
        bilan.a_verifier.push({
          session_id: s.id, reference: s.reference, participant: idp,
          nom: [propre(lap.participant?.prenom), propre(lap.participant?.nom)].filter(Boolean).join(' ') || `participant ${idp}`,
          apprenant_id: null, action: 'session_recreee',
          detail: `session créée dans le CRM le ${String(s.created_at).slice(0, 10)}, ${Math.floor(ecart)} jours après l'action Dendreo (${dateAdd.slice(0, 10)}) : supprimée ou archivée puis recréée par la synchro ?`,
        })
      }
      return false
    })
  }
  if (traitables.length === 0) return bilan

  const tousLaps = traitables.flatMap((s) => lapsParSession.get(s.id) || [])
  const idsParticipants = [...new Set(tousLaps.map((l) => String(l.id_participant)))]
  const idsEntreprises = [...new Set(tousLaps.flatMap((l) => [ident(l.id_entreprise), ident(l.participant?.id_entreprise)]))]
    .filter((v): v is string => !!v)
  const avecDates = traitables.filter((s) => s.date_debut && s.date_fin)
  const debutMin = avecDates.reduce((m, s) => (s.date_debut! < m ? s.date_debut! : m), '9999-12-31')
  const finMax = avecDates.reduce((m, s) => (s.date_fin! > m ? s.date_fin! : m), '0000-01-01')

  const [fichesDendreo, clientsDendreo, voisines] = await Promise.all([
    parLots(idsParticipants, (lot) => toutLire<Fiche>((from, to) =>
      supabase.from('apprenants').select(COLS_FICHE).eq('organization_id', organizationId).in('dendreo_id', lot).order('id').range(from, to))),
    parLots(idsEntreprises, (lot) => toutLire<{ id: string; dendreo_id: string }>((from, to) =>
      supabase.from('clients').select('id, dendreo_id').eq('organization_id', organizationId).in('dendreo_id', lot).order('id').range(from, to))),
    // Sessions qui chevauchent les dates visées, pour repérer les sessions jumelles
    avecDates.length
      ? toutLire<SessionVoisine>((from, to) => supabase.from('sessions')
        .select('id, reference, dendreo_id, formation_id, date_debut, date_fin')
        .eq('organization_id', organizationId)
        .neq('status', 'annulee')
        .lte('date_debut', finMax)
        .gte('date_fin', debutMin)
        .order('id').range(from, to))
      : Promise.resolve([] as SessionVoisine[]),
  ])

  const clientParDendreo = new Map(clientsDendreo.map((c) => [String(c.dendreo_id), c.id]))
  const clientDuLap = (lap: any): string | null =>
    clientParDendreo.get(ident(lap.id_entreprise) || '') || clientParDendreo.get(ident(lap.participant?.id_entreprise) || '') || null
  const idsClients = [...new Set(traitables.flatMap((s) => [s.client_id, ...(lapsParSession.get(s.id) || []).map(clientDuLap)]))]
    .filter((v): v is string => !!v)
  const idsTraitables = traitables.map((s) => s.id)
  const idsSessions = [...new Set([...idsTraitables, ...voisines.map((v) => v.id)])]
  const idsTerminees = traitables.filter(terminee).map((s) => s.id)

  const [inscriptions, fichesClients, conventions, envoisHygiene] = await Promise.all([
    parLots(idsSessions, (lot) => toutLire<any>((from, to) => supabase.from('inscriptions')
      .select(`id, session_id, apprenant_id, status, apprenant:apprenants(${COLS_FICHE})`)
      .in('session_id', lot)
      .order('id').range(from, to))),
    parLots(idsClients, (lot) => toutLire<Fiche>((from, to) =>
      supabase.from('apprenants').select(COLS_FICHE).eq('organization_id', organizationId).in('client_id', lot).order('id').range(from, to))),
    parLots(idsTraitables, (lot) => toutLire<{ session_id: string; numero: string | null; status: string }>((from, to) =>
      supabase.from('conventions').select('id, session_id, numero, status').in('session_id', lot).in('status', CONVENTIONS_ENGAGEES).order('id').range(from, to))),
    // Même repérage que l'envoi automatique des attestations d'hygiène
    parLots(idsTerminees, (lot) => toutLire<{ entity_id: string }>((from, to) =>
      supabase.from('email_logs').select('id, entity_id')
        .eq('organization_id', organizationId).eq('entity_type', 'session').in('entity_id', lot)
        .ilike('subject', '%attestations d_hygiène%')
        .order('id').range(from, to))),
  ])
  const conventionsParSession = new Map<string, string[]>()
  for (const c of conventions) {
    conventionsParSession.set(c.session_id, [...(conventionsParSession.get(c.session_id) || []), `${c.numero || 'sans numéro'} (${c.status})`])
  }
  const hygieneEnvoyee = new Set(envoisHygiene.map((e) => String(e.entity_id)))

  // Une seule instance par fiche : un rapprochement fait sur une session vaut pour les suivantes
  const fiches = new Map<string, Fiche>()
  const parDendreo = new Map<string, Fiche>()
  const retenir = (f: Fiche): Fiche => {
    const connue = fiches.get(f.id)
    if (connue) return connue
    fiches.set(f.id, f)
    if (f.dendreo_id) parDendreo.set(String(f.dendreo_id), f)
    return f
  }
  fichesDendreo.forEach(retenir)
  const homonymesParClient = new Map<string, Fiche[]>()
  const indexer = (f: Fiche) => {
    const k = `${f.client_id}|${cleIdentite(f.prenom, f.nom)}`
    const liste = homonymesParClient.get(k) || []
    if (f.client_id && !liste.includes(f)) homonymesParClient.set(k, [...liste, f])
  }
  fichesClients.map(retenir).forEach(indexer)
  const inscrits = new Map<string, Map<string, string>>()
  for (const i of inscriptions) {
    if (i.apprenant) retenir(i.apprenant)
    if (!inscrits.has(i.session_id)) inscrits.set(i.session_id, new Map())
    inscrits.get(i.session_id)!.set(i.apprenant_id, i.status)
  }
  const nomFiche = (id: string | null): string | null => {
    const f = id ? fiches.get(id) : null
    return f ? [propre(f.prenom), propre(f.nom)].filter(Boolean).join(' ') || null : null
  }

  // Aux mêmes dates, deux sessions ne sont deux prestations que si leurs
  // formations, connues toutes les deux, diffèrent
  const memePrestation = (a: { formation_id: string | null }, b: { formation_id: string | null }) =>
    !a.formation_id || !b.formation_id || a.formation_id === b.formation_id

  const sessionJumelle = (s: SessionVisee, idp: string, ficheId: string | null, cle: string, client: string | null): string | null => {
    if (!s.date_debut || !s.date_fin) return null
    for (const v of voisines) {
      if (v.id === s.id || v.date_debut > s.date_fin || v.date_fin < s.date_debut) continue
      const ref = v.reference || v.id
      // Deux actions Dendreo qui listent le même participant : la première traitée ne prend pas les stagiaires de l'autre
      if (memePrestation(s, v) && (lapsParSession.get(v.id) || []).some((l) => String(l.id_participant) === idp)) {
        return `participant aussi sur l'action ${ref}, même formation aux mêmes dates`
      }
      for (const [apprenantId, statut] of inscrits.get(v.id) || []) {
        if (ANNULEES.includes(statut)) continue
        const f = fiches.get(apprenantId)
        const memeFiche = !!ficheId && apprenantId === ficheId
        const memeNom = !!f && cleExploitable(cle) && cleIdentite(f.prenom, f.nom) === cle
          && (!client || !f.client_id || f.client_id === client)
        if (!memeFiche && !memeNom) continue
        // Le même participant sur deux actions Dendreo de formations différentes : deux formations dans la journée
        if (memeFiche && v.dendreo_id && !memePrestation(s, v)) continue
        return `déjà inscrit aux mêmes dates sur ${ref}`
      }
    }
    return null
  }

  for (const s of traitables) {
    const dejaLa = inscrits.get(s.id) || new Map<string, string>()
    inscrits.set(s.id, dejaLa)
    const mouvementsAvant = bilan.mouvements.length
    const aInscrire: Record<string, any>[] = []
    const lignesInscription: LigneParticipant[] = []
    const lapDe = new Map<string, any>()
    const vus = new Set<string>()

    for (const lap of lapsParSession.get(s.id) || []) {
      const idp = String(lap.id_participant)
      if (vus.has(idp)) continue
      vus.add(idp)
      const p = lap.participant || {}
      let fiche = parDendreo.get(idp) || null
      const nomDendreo = [propre(p.prenom), propre(p.nom)].filter(Boolean).join(' ')
      const cleDendreo = nomDendreo ? cleIdentite(p.prenom, p.nom) : ''
      const cleFiche = fiche ? cleIdentite(fiche.prenom, fiche.nom) : ''
      const divergente = !!fiche && cleExploitable(cleFiche) && cleExploitable(cleDendreo) && !memePersonne(cleFiche, cleDendreo)
      // Les homonymes se cherchent au nom de la fiche qui serait inscrite
      const cle = cleExploitable(cleFiche) ? cleFiche : cleDendreo
      const clientLap = clientDuLap(lap)
      const client = clientLap || s.client_id || null
      const ligne = (action: string, apprenantId: string | null, detail?: string): LigneParticipant => ({
        session_id: s.id, reference: s.reference, participant: idp,
        nom: nomFiche(apprenantId) || nomDendreo || `participant ${idp}`,
        apprenant_id: apprenantId, action,
        ...(detail ? { detail } : {}),
      })

      const rattacher = async (f: Fiche) => {
        if (f.client_id || !client) return
        if (!apercu) {
          const { error } = await supabase.from('apprenants').update({ client_id: client }).eq('id', f.id).is('client_id', null)
          if (error) { bilan.erreurs.push({ session_id: s.id, reference: s.reference, participant: idp, message: `rattachement client : ${error.message}` }); return }
        }
        f.client_id = client
        indexer(f)
        bilan.apprenants_rattaches_client++
        bilan.mouvements.push(ligne('rattache_client', f.id))
      }

      const relier = async (f: Fiche): Promise<boolean> => {
        const maj: Record<string, string> = { dendreo_id: idp }
        if (!f.client_id && client) maj.client_id = client
        if (!apercu) {
          const { data, error } = await supabase.from('apprenants').update(maj).eq('id', f.id).is('dendreo_id', null).select('id')
          if (error || !data?.length) {
            bilan.erreurs.push({ session_id: s.id, reference: s.reference, participant: idp, message: `liaison par nom : ${error?.message || 'fiche déjà liée entre-temps'}` })
            return false
          }
        }
        f.dendreo_id = idp
        parDendreo.set(idp, f)
        bilan.apprenants_relies_par_nom++
        if (maj.client_id) {
          f.client_id = client
          indexer(f)
          bilan.apprenants_rattaches_client++
        }
        return true
      }

      // 1. Déjà inscrit sous sa fiche Dendreo
      if (fiche && dejaLa.has(fiche.id)) {
        bilan.deja_inscrits++
        const statut = dejaLa.get(fiche.id)!
        if (ANNULEES.includes(statut)) {
          bilan.a_verifier.push(ligne('inscription_annulee', fiche.id, `actif dans Dendreo, « ${statut} » dans le CRM : laissé tel quel`))
        }
        // Une fiche qui porte le nom d'un autre n'est pas la sienne : le client du participant ne s'y reporte pas
        if (!divergente) await rattacher(fiche)
        continue
      }

      // 2. Fiche liée à ce participant mais au nom d'une autre personne
      if (fiche && divergente) {
        bilan.a_verifier.push(ligne('identite_divergente', fiche.id, `fiche liée au participant Dendreo ${idp}, qui s'appelle « ${nomDendreo} » dans Dendreo : rien d'écrit`))
        continue
      }

      // 3. Déjà dans la session sous une autre fiche
      const homonymesSession = cleExploitable(cle)
        ? [...dejaLa.keys()].map((id) => fiches.get(id))
          .filter((f): f is Fiche => !!f && f.id !== fiche?.id && cleIdentite(f.prenom, f.nom) === cle)
        : []
      if (homonymesSession.length > 0) {
        const h = homonymesSession[0]
        if (fiche) {
          bilan.a_verifier.push(ligne('doublon_session', h.id, `déjà inscrit sous une autre fiche ; la fiche Dendreo ${fiche.id} fait doublon`))
        } else if (homonymesSession.length === 1 && !h.dendreo_id) {
          if (await relier(h)) bilan.mouvements.push(ligne('relie', h.id, 'déjà inscrit sous une fiche saisie à la main'))
        } else {
          // Participant en double côté Dendreo, dont la fiche a déjà été fusionnée : rien à faire
          bilan.deja_inscrits++
        }
        continue
      }

      // 4. À inscrire : sa fiche Dendreo, la fiche homonyme du client, ou une nouvelle
      const homonymesClient = cleExploitable(cle)
        ? [...new Set([clientLap, s.client_id].filter((c): c is string => !!c))]
          .flatMap((c) => homonymesParClient.get(`${c}|${cle}`) || [])
          .filter((f) => f.id !== fiche?.id)
        : []
      if (fiche && homonymesClient.length > 0) {
        bilan.a_verifier.push(ligne('doublon_fiche', fiche.id, `une autre fiche au même nom existe chez le client (${homonymesClient.map((f) => f.id).join(', ')}) : à fusionner, pas d'inscription d'ici là`))
        continue
      }
      if (!fiche && (homonymesClient.length > 1 || homonymesClient[0]?.dendreo_id)) {
        bilan.a_verifier.push(ligne('homonymes', homonymesClient.length === 1 ? homonymesClient[0].id : null,
          homonymesClient.length > 1
            ? `${homonymesClient.length} fiches homonymes chez le client`
            : `fiche homonyme chez le client liée à un autre participant Dendreo (${homonymesClient[0].dendreo_id})`))
        continue
      }
      const aRelier = !fiche ? homonymesClient[0] || null : null
      const jumelle = sessionJumelle(s, idp, (fiche || aRelier)?.id || null, cle, client)
      if (jumelle) {
        bilan.a_verifier.push(ligne('session_jumelle', (fiche || aRelier)?.id || null, jumelle))
        continue
      }

      let action = 'inscrit'
      if (aRelier) {
        if (!(await relier(aRelier))) continue
        fiche = aRelier
        action = 'relie_et_inscrit'
      } else if (!fiche) {
        if (!nomDendreo) {
          bilan.erreurs.push({ session_id: s.id, reference: s.reference, participant: idp, message: 'participant sans nom dans Dendreo' })
          continue
        }
        const nouvelle = {
          organization_id: organizationId, dendreo_id: idp, client_id: client,
          civilite: propre(p.civilite), nom: propre(p.nom) || '—', prenom: propre(p.prenom) || '',
          email: propre(p.email), telephone: propre(p.portable) || propre(p.telephone),
          date_naissance: jour(p.date_de_naissance), poste: propre(p.fonction),
          statut_bpf: propre(p.statut_bpf), notes: '[Dendreo]',
        }
        if (apercu) {
          fiche = retenir({ id: `apercu:${idp}`, nom: nouvelle.nom, prenom: nouvelle.prenom, client_id: client, dendreo_id: idp })
        } else {
          const { data, error } = await supabase.from('apprenants').insert(nouvelle).select(COLS_FICHE).single()
          if (error || !data) {
            bilan.erreurs.push({ session_id: s.id, reference: s.reference, participant: idp, message: `création de la fiche : ${error?.message || 'échec'}` })
            continue
          }
          fiche = retenir(data as Fiche)
        }
        indexer(fiche)
        bilan.apprenants_crees++
        action = 'cree_et_inscrit'
      } else {
        await rattacher(fiche)
      }

      const releve = presenceRelevee(lap)
      dejaLa.set(fiche.id, statutInscription(s.status))
      lapDe.set(fiche.id, lap)
      aInscrire.push({
        organization_id: organizationId,
        session_id: s.id,
        apprenant_id: fiche.id,
        status: statutInscription(s.status),
        date_inscription: jour(lap.date_add) || aujourdhui,
        heures_presence: releve ? positif(lap.total_heures_presence) : null,
        taux_assiduite: releve ? positif(lap.presence_percent) : null,
      })
      lignesInscription.push(ligne(action, fiche.id))
    }

    if (aInscrire.length > 0) {
      let creees = lignesInscription
      if (!apercu) {
        // Conflit sur (session, apprenant) ignoré : une inscription existante n'est jamais touchée
        const { data, error } = await supabase.from('inscriptions')
          .upsert(aInscrire, { onConflict: 'session_id,apprenant_id', ignoreDuplicates: true })
          .select('apprenant_id')
        if (error) {
          bilan.erreurs.push({ session_id: s.id, reference: s.reference, message: `inscriptions : ${error.message}` })
          creees = []
        } else {
          const ok = new Set((data || []).map((d: any) => d.apprenant_id))
          creees = lignesInscription.filter((l) => ok.has(l.apprenant_id))
        }
      }
      bilan.inscriptions_creees += creees.length
      bilan.mouvements.push(...creees)

      if (creees.length > 0) {
        if (terminee(s)) {
          // Posée après coup, la grille mettrait le stagiaire absent partout :
          // les attestations d'hygiène, qui la lisent, tomberaient à 0 h
          for (const l of creees) {
            bilan.a_verifier.push({ ...l, action: 'grille_a_poser', detail: `session terminée, ${presenceDendreo(lapDe.get(l.apprenant_id!))} : grille d'émargement à établir à la main` })
            if (hygieneEnvoyee.has(s.id)) {
              bilan.a_verifier.push({ ...l, action: 'attestation_hygiene_sans_stagiaire', detail: "attestations d'hygiène déjà envoyées au client sans ce stagiaire" })
            }
          }
        } else if (!apercu) {
          // Les questionnaires suivent par déclencheur (migration 125) et les
          // convocations par leur propre cron (7 h et 16 h), stagiaire par stagiaire
          try {
            const { ensureEmargements } = await import('@/lib/emargements')
            await ensureEmargements(supabase, s.id, organizationId)
          } catch (e) { console.error('[grille émargement]', e) }
        }
        // L'avenant réécrit la liste contractuelle et part au client : une
        // personne l'établit, pas l'automatisme
        const convs = conventionsParSession.get(s.id)
        if (convs) {
          for (const l of creees) {
            bilan.a_verifier.push({ ...l, action: 'avenant_a_etablir', detail: `convention ${convs.join(', ')} déjà envoyée ou signée : avenant à établir` })
          }
        }
      }
    }

    if (bilan.mouvements.length > mouvementsAvant) bilan.sessions_traitees++
  }

  return bilan
}
