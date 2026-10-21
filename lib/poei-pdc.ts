/**
 * Plan de développement de compétences (formulaire France Travail de la POEI) :
 * ce que le CRM y écrit, tiré du programme de la formation, du client et de son
 * contact. Modèle : le plan de la POEI NSLENS rempli à la main en septembre
 * 2026, que Brahim a demandé de reproduire le 21/10/2026.
 * - une ligne du tableau par semaine du programme (ou par jour pour un parcours
 *   court) : la date de son premier jour, ses heures, ses modules à gauche,
 *   l'objectif de chaque module à droite (« Le stagiaire sera capable de : ») ;
 * - la journée d'évaluation finale a sa propre ligne quand le tableau a la place ;
 * - au-delà de cinq lignes, les dernières se regroupent sur la cinquième ;
 * - un candidat entré après le groupe ne reçoit que la partie du programme qu'il suit.
 */

export interface LignePdc {
  /** Premier jour de la ligne (AAAA-MM-JJ), ou null si les dates de la POEI manquent */
  date: string | null
  heures: number | null
  competences: string[]
  objectifs: string[]
  /** Objectifs des modules, lus derrière « Le stagiaire sera capable de : » ; sinon le thème de la période */
  capableDe: boolean
}

/** Un jour du planning réel du candidat, avec ses heures */
export interface JourPlanning { date: string; heures: number }

/** Ce qui empêche le plan d'être juste, ou ce qu'il faut savoir en le relisant */
export interface AlertePdc { code: 'programme_court' | 'sans_programme' | 'date_hors_periode' | 'planning_incomplet'; message: string }

interface ModuleProgramme { titre: string; heures: number | null; objectif: string | null; puces: string[] }
interface PeriodeProgramme { titre: string; heures: number | null; objectif: string | null; modules: ModuleProgramme[]; puces: string[] }

const PUCE = /^[\u2022\u00b7\u2219\u25cf\u25aa\u25e6\u2043\u2013\u2014*\-]+\s*/
const PERIODE = /^(semaines?|jours?|journ[ée]es?)\s+\d+\b/i
const PLUSIEURS_SEMAINES = /^semaines\s+\d+\s*(?:à|a|-|–|et)\s*\d+/i
const MODULE = /^(module\s*\d+|m\d+\s*[|:–—-])/i
const LIBELLE_OBJECTIF = /^(objectifs?(?:\s+(?:op[ée]rationnels?|p[ée]dagogiques?|du module|de la semaine|du jour))?|comp[ée]tences?\s+vis[ée]es?)\s*:\s*/i
const LIBELLE_CONTENU = /^contenus?\s*:?\s*$/i
// Rubriques dont les puces ne sont pas des compétences (méthodes, évaluation…)
const LIBELLE_ECARTE = /^(modalit[ée]s?\s+p[ée]dagogiques?|m[ée]thodes?\s+p[ée]dagogiques?|moyens?\s+(?:p[ée]dagogiques?|techniques?)|[ée]valuation(?:\s+int[ée]gr[ée]e)?(?:\s*\/\s*preuves?)?|application\s+p[ée]dagogique|organisation\s+p[ée]dagogique|supports?(?:\s+p[ée]dagogiques?)?|outils?)\s*(?::|$)/i
// « Durée : 7 h » ou « 35 heures » seul sur sa ligne : la durée du module ou de la période en cours
const DUREE_SEULE = /^(?:dur[ée]e(?:\s+totale)?\s*:\s*)?(\d+(?:[.,]\d+)?\s*h(?:eures?)?(?:\s*\d{1,2})?)\s*\.?$/i
const EVALUATION_FINALE = /[ée]valuation|validation|bilan/i
const HEURES_JOUR = 7
const HEURES_SEMAINE = 35

/** « 35 h », « 3h30 », « 3 h 30 », « 35 heures », « 10h30 » → heures décimales */
function enHeures(texte: string): number | null {
  const m = texte.match(/(\d+(?:[.,]\d+)?)\s*h(?:eures?)?\s*(\d{1,2})?/i)
  if (!m) return null
  const h = Number(m[1].replace(',', '.')) + (m[2] ? Number(m[2]) / 60 : 0)
  return Number.isFinite(h) && h > 0 ? h : null
}

/** Sépare la durée écrite en fin de titre : « (35 heures) », « - 35 h », « — Durée : 7 h », « (3h30) » */
function scinderDuree(ligne: string): { titre: string; heures: number | null } {
  const sansFormateur = ligne.replace(/\s*[·|]\s*formateurs?\s*(?:\(s\))?\s*:.*$/i, '').trim()
  const m = sansFormateur.match(/\s*[(\[]\s*([^()\[\]]*\d[^()\[\]]*h[^()\[\]]*)[)\]]\s*$/i)
    || sansFormateur.match(/\s+[-–—]\s+(?:dur[ée]e\s*:\s*)?(\d+(?:[.,]\d+)?\s*h(?:eures?)?(?:\s*\d{1,2})?)\s*$/i)
  if (!m) return { titre: sansFormateur, heures: null }
  return { titre: sansFormateur.slice(0, m.index).trim(), heures: enHeures(m[1]) }
}

/** Un titre saisi tout en capitales se lit en minuscules, initiale conservée. */
function casse(texte: string): string {
  const t = texte.trim()
  if (t.length > 3 && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t)) return t.charAt(0) + t.slice(1).toLowerCase()
  return t
}

const sansPoint = (t: string) => t.trim().replace(/[\s.;:]+$/, '')
const initiale = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

/**
 * Raccourcit une phrase trop longue à une articulation, la plus tardive sous la
 * limite pour garder le plus de texte : d'abord deux-points, point-virgule, tiret
 * ou parenthèse (même un peu au-delà de la limite), puis une virgule qui n'ouvre
 * pas une énumération, puis avant une seconde action (« … du restaurant et
 * appliquer les bons réflexes »). Sinon la phrase reste entière : la case
 * réduit sa police.
 */
function couper(texte: string, max: number, min = 20): string {
  const t = sansPoint(texte)
  if (t.length <= max) return t
  const dernier = (re: RegExp, limite: number, accepte: (i: number) => boolean = () => true) => {
    let trouve = -1
    let m: RegExpExecArray | null
    while ((m = re.exec(t))) {
      if (m.index > limite) break
      if (m.index >= min && accepte(m.index)) trouve = m.index
    }
    return trouve
  }
  let i = dernier(/\s:\s|\s;\s|\s[–—]\s|\s\(/g, Math.round(max * 1.4))
  // « production, pliage, presse, sortie, salle et caisse » : une virgule précédée ou suivie
  // d'une autre de près est dans une énumération, on n'y coupe pas
  if (i < 0) i = dernier(/,\s/g, max, (j) => !/^,\s[^,]{1,24},/.test(t.slice(j)) && !/,[^,]{1,24}$/.test(t.slice(0, j)))
  if (i < 0) i = dernier(/\set\s(?=[a-zàâçéèêëîïôûùüÿœ]+(?:er|ir|re)\s)/g, max)
  return i < 0 ? t : sansPoint(t.slice(0, i))
}

/** Objectif d'un module, tel qu'il se lit derrière « Le stagiaire sera capable de : » */
export function objectifCourt(texte: string | null | undefined, max = 70): string | null {
  const t = String(texte || '').replace(LIBELLE_OBJECTIF, '')
    // « …rapide.Contenu : » : la rubrique suivante collée à l'objectif lors de la saisie
    .replace(/[.\s]*contenus?\s*:?\s*$/i, '').trim()
  if (!t) return null
  return initiale(couper(t.replace(/^(être capable de|savoir)\s+/i, ''), max, max < 70 ? 15 : 25))
}

/** Lecture du programme saisi en texte (ou en Markdown) : périodes, modules, durées, objectifs, puces. */
export function periodesProgramme(texte: string | null | undefined): PeriodeProgramme[] {
  const brut = String(texte || '').replace(/\r\n?/g, '\n')
  if (!brut.trim() || /<[a-z][^>]*>/i.test(brut)) return []
  const periodes: PeriodeProgramme[] = []
  let periode: PeriodeProgramme | null = null
  let module: ModuleProgramme | null = null
  let attenteObjectif = false
  let ecarte = false
  const ouvrirPeriode = (titre: string, heures: number | null) => {
    periode = { titre: casse(titre), heures, objectif: null, modules: [], puces: [] }
    periodes.push(periode); module = null; attenteObjectif = false; ecarte = false
  }

  for (const ligneBrute of brut.split('\n')) {
    const ligne = ligneBrute
      .replace(/[\uf000-\uf0ff]/g, '')
      // Markdown : titres « ### », gras « ** » et « __ »
      .replace(/^\s*#{1,6}\s+/, '').replace(/\*\*|__/g, '')
      .replace(/[ \t\u00a0]{2,}/g, ' ').trim()
    if (!ligne) continue
    const aPuce = PUCE.test(ligne)
    const nu = ligne.replace(PUCE, '').trim()
    if (!nu) continue

    if (!aPuce && PERIODE.test(nu) && nu.length <= 160) {
      const parDuree = nu.split(/\s+[—–-]\s+Dur[ée]e\s*:\s*/i)
      if (parDuree.length > 1) ouvrirPeriode(parDuree[0], enHeures(parDuree.slice(1).join(' ')))
      else { const s = scinderDuree(nu); ouvrirPeriode(s.titre, s.heures) }
      continue
    }
    if (MODULE.test(nu) && nu.length <= 200) {
      if (!periode) ouvrirPeriode('', null)
      const s = scinderDuree(nu)
      const titre = casse(s.titre.replace(/^(module\s*\d+|m\d+)\s*[|·:–—.\-]?\s*/i, ''))
      module = { titre, heures: s.heures, objectif: null, puces: [] }
      periode!.modules.push(module)
      attenteObjectif = true; ecarte = false
      continue
    }
    const m = module as ModuleProgramme | null
    const p = periode as PeriodeProgramme | null
    const dureeSeule = !aPuce ? nu.match(DUREE_SEULE) : null
    if (dureeSeule) {
      if (m && !m.heures) m.heures = enHeures(dureeSeule[1])
      else if (!m && p && !p.heures) p.heures = enHeures(dureeSeule[1])
      continue
    }
    if (LIBELLE_OBJECTIF.test(nu)) {
      const objectif = nu.replace(LIBELLE_OBJECTIF, '').trim()
      if (m && !m.objectif) m.objectif = objectif
      else if (!m && p && !p.objectif) p.objectif = objectif
      attenteObjectif = false; ecarte = false
      continue
    }
    if (LIBELLE_CONTENU.test(nu)) { attenteObjectif = false; ecarte = false; continue }
    if (!aPuce && LIBELLE_ECARTE.test(nu)) { attenteObjectif = false; ecarte = true; continue }

    // Programme sans « Objectif : » : la phrase sans puce qui suit le titre du module est son objectif
    if (attenteObjectif && m && !aPuce && !m.objectif) { m.objectif = nu; attenteObjectif = false; continue }
    attenteObjectif = false
    if (!aPuce || ecarte) continue
    if (m) m.puces.push(nu)
    else if (p) p.puces.push(nu)
  }
  return periodes.filter((p) => p.modules.length || p.puces.length || p.objectif)
}

/** Heures écrites comme sur le modèle : « 35 h », « 3 h 30 ». */
export function heuresLisibles(h: number | null | undefined): string {
  if (!h || !Number.isFinite(h) || h <= 0) return ''
  const minutes = Math.round(h * 60)
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  return reste ? `${heures} h ${String(reste).padStart(2, '0')}` : `${heures} h`
}

// ── Calendrier ──

/** Dimanche de Pâques (algorithme de Meeus) */
function paques(annee: number): Date {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(annee, mois - 1, jour, 12))
}
const feries = new Map<number, Set<string>>()
/** Jour férié en France métropolitaine */
function estFerie(d: Date): boolean {
  const annee = d.getUTCFullYear()
  if (!feries.has(annee)) {
    const p = paques(annee)
    const decale = (n: number) => { const x = new Date(p); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(5, 10) }
    feries.set(annee, new Set(['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25', decale(1), decale(39), decale(50)]))
  }
  return feries.get(annee)!.has(d.toISOString().slice(5, 10))
}
const ouvre = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !estFerie(d)
const jourUTC = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)

/** Jours ouvrés (hors fériés) de `debut` inclus à `fin` exclu */
export function joursOuvresEntre(debut: string, fin: string): number {
  const d = jourUTC(debut)
  const f = jourUTC(fin)
  let n = 0
  while (d < f) { if (ouvre(d)) n++; d.setUTCDate(d.getUTCDate() + 1) }
  return n
}

/**
 * Jour où commence une ligne, à `heure` heures du début du candidat : celui du
 * planning réel s'il existe ; sinon la date de début pour la première ligne (jamais
 * réécrite), puis une semaine du calendrier par semaine d'heures et des jours
 * ouvrés (hors fériés) pour le reste.
 */
function jourDeLigne(debut: string | null, heure: number, planning: JourPlanning[], heuresSemaine: number): string | null {
  if (planning.length) {
    let cumul = 0
    for (const j of planning) {
      if (heure < cumul + j.heures - 0.01) return j.date
      cumul += j.heures
    }
    return planning[planning.length - 1].date
  }
  if (!debut) return null
  if (heure <= 0.01) return debut.slice(0, 10)
  const d = jourUTC(debut)
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor((heure + 0.01) / heuresSemaine))
  let reste = Math.floor(((heure + 0.01) % heuresSemaine) / HEURES_JOUR)
  while (reste > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (ouvre(d)) reste--
  }
  return d.toISOString().slice(0, 10)
}

/** Jour de l'évaluation finale : le dernier jour du planning, sinon le dernier jour ouvré de la période */
function dernierJour(fin: string | null, planning: JourPlanning[]): string | null {
  if (planning.length) return planning[planning.length - 1].date
  if (!fin) return null
  const d = jourUTC(fin)
  for (let i = 0; i < 7 && !ouvre(d); i++) d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ── Lignes du tableau ──

interface Bloc {
  titre: string
  heures: number | null
  /** null : période sans modules (journées décrites en puces) */
  modules: ModuleProgramme[] | null
  puces: string[]
  objectif: string | null
  evaluationFinale?: boolean
  /** Périodes regroupées sur la cinquième ligne */
  regroupes?: Bloc[]
}

/** Thème d'une période, sans « Semaine 2 - » ni « Semaines 2 à 4 - » */
const theme = (titre: string) => initiale(titre.replace(/^(semaines?|jours?|journ[ée]es?)\s+\d+(?:\s*(?:à|a|-|–|et)\s*\d+)?\s*[:–—-]?\s*/i, '').trim())

const heuresModules = (ms: ModuleProgramme[]) => ms.reduce((s, m) => s + (m.heures || 0), 0)

/** Des modules répartis en semaines selon l'heure où chacun commence */
function enSemaines(titre: string, modules: ModuleProgramme[], heuresSemaine: number): Bloc[] {
  const semaines: Bloc[] = []
  let cumul = 0
  for (const m of modules) {
    const n = Math.floor((cumul + 0.01) / heuresSemaine)
    ;(semaines[n] ||= { titre, heures: 0, modules: [], puces: [], objectif: null }).modules!.push(m)
    semaines[n].heures = (semaines[n].heures || 0) + (m.heures || 0)
    cumul += m.heures || 0
  }
  return semaines.filter(Boolean)
}

/**
 * Lignes du tableau (cinq au plus). `heuresDejaFaites` : heures du programme que le
 * groupe a suivies avant l'entrée du candidat ; `totalHeures` : celles du candidat.
 */
export function lignesPlanDeveloppement(
  programme: string | null | undefined,
  opts: {
    debut: string | null
    fin?: string | null
    totalHeures?: number | null
    heuresDejaFaites?: number
    planning?: JourPlanning[]
    heuresSemaine?: number | null
    objectifsFormation?: string[]
  },
): { lignes: LignePdc[]; alertes: AlertePdc[] } {
  const alertes: AlertePdc[] = []
  const heuresSemaine = opts.heuresSemaine && opts.heuresSemaine >= 7 && opts.heuresSemaine <= 48 ? opts.heuresSemaine : HEURES_SEMAINE
  const total = opts.totalHeures && opts.totalHeures > 0 ? opts.totalHeures : null
  let planning = (opts.planning || []).filter((j) => j.date && j.heures > 0).sort((a, b) => a.date.localeCompare(b.date))
  // Un planning qui ne couvre pas les heures du candidat ne date pas les lignes : le calendrier le remplace
  const heuresPlanning = planning.reduce((s, j) => s + j.heures, 0)
  if (planning.length && total && heuresPlanning < total - 0.5) {
    alertes.push({ code: 'planning_incomplet', message: `Le planning du candidat ne compte que ${heuresLisibles(heuresPlanning)} dans sa période, pour ${heuresLisibles(total)} : les dates du tableau suivent le calendrier.` })
    planning = []
  }
  const deja = opts.heuresDejaFaites && opts.heuresDejaFaites > 0 ? opts.heuresDejaFaites : 0

  // 1. Périodes du programme ; une période de plusieurs semaines est redécoupée en semaines
  let blocs: Bloc[] = []
  for (const p of periodesProgramme(programme)) {
    const heures = p.heures || heuresModules(p.modules) || null
    const longue = p.modules.length >= 2 && (PLUSIEURS_SEMAINES.test(p.titre) || !p.titre || (heures || 0) > heuresSemaine * 1.2)
    if (longue && p.modules.every((m) => m.heures)) blocs.push(...enSemaines(p.titre, p.modules, heuresSemaine))
    else blocs.push({ titre: p.titre, heures, modules: p.modules.length ? p.modules : null, puces: p.puces, objectif: p.objectif })
  }

  if (!blocs.length) {
    alertes.push({ code: 'sans_programme', message: 'Programme de la formation sans semaines ni modules reconnus : le tableau reprend ses objectifs.' })
    const objectifs = (opts.objectifsFormation || []).map((x) => initiale(couper(x, 72))).filter(Boolean)
    if (!objectifs.length && !total) return { lignes: [], alertes }
    blocs = [{ titre: '', heures: total, modules: null, puces: objectifs, objectif: null }]
  }

  // 2. La part du programme que suit le candidat : après les heures déjà faites, jusqu'à sa durée
  const toutesConnues = blocs.every((b) => b.heures && (!b.modules || b.modules.every((m) => m.heures)))
  const duProgramme = blocs.reduce((s, b) => s + (b.heures || 0), 0)
  if (toutesConnues && (deja || (total && duProgramme > total + 0.5))) {
    const debutFenetre = deja
    const finFenetre = total ? deja + total : Infinity
    let cumul = 0
    const gardes: Bloc[] = []
    for (const b of blocs) {
      if (b.modules) {
        const modules: ModuleProgramme[] = []
        for (const m of b.modules) {
          const recouvre = Math.min(cumul + m.heures!, finFenetre) - Math.max(cumul, debutFenetre)
          if (recouvre > 0.01) modules.push(recouvre < m.heures! - 0.01 ? { ...m, heures: recouvre } : m)
          cumul += m.heures!
        }
        if (modules.length) gardes.push({ ...b, modules, heures: heuresModules(modules) })
      } else {
        const recouvre = Math.min(cumul + b.heures!, finFenetre) - Math.max(cumul, debutFenetre)
        if (recouvre > 0.01) gardes.push({ ...b, heures: recouvre })
        cumul += b.heures!
      }
    }
    blocs = gardes
  }
  const couvert = blocs.reduce((s, b) => s + (b.heures || 0), 0)
  if (total && toutesConnues && couvert < total - 0.5) {
    alertes.push({
      code: 'programme_court',
      message: `Le programme de la formation rattachée couvre ${heuresLisibles(couvert + deja)}${deja ? ` (dont ${heuresLisibles(deja)} avant l'entrée du candidat)` : ''}, alors que le plan doit en décrire ${heuresLisibles(total)} : rattachez à la POEI la formation de la bonne durée.`,
    })
  }
  if (!blocs.length) return { lignes: [], alertes }

  // 3. La journée d'évaluation finale (un module d'une journée au plus) a sa ligne quand le
  //    tableau a la place (modèle NSLENS : 28 h + 7 h)
  const dernier = blocs[blocs.length - 1]
  const evaluation = dernier.modules?.[dernier.modules.length - 1]
  if (blocs.length < 5 && dernier.modules && dernier.modules.length >= 2 && evaluation && EVALUATION_FINALE.test(evaluation.titre)
    && evaluation.heures && evaluation.heures <= HEURES_JOUR && dernier.heures && dernier.heures > evaluation.heures) {
    const avant = dernier.modules.slice(0, -1)
    blocs[blocs.length - 1] = { ...dernier, modules: avant, heures: heuresModules(avant) }
    blocs.push({ titre: evaluation.titre, heures: evaluation.heures, modules: [evaluation], puces: [], objectif: null, evaluationFinale: true })
  }

  // 4. Plus de cinq lignes : les dernières se regroupent sur la cinquième
  if (blocs.length > 5) {
    const reste = blocs.slice(4)
    blocs = [...blocs.slice(0, 4), {
      titre: reste.map((b) => theme(b.titre)).filter(Boolean).join(' ; '),
      heures: reste.every((b) => b.heures) ? reste.reduce((s, b) => s + (b.heures || 0), 0) : null,
      modules: reste.flatMap((b) => b.modules || []),
      puces: reste.flatMap((b) => b.puces),
      objectif: null,
      regroupes: reste,
    }]
  }

  // 5. Contenu et date de chaque ligne
  let cumul = 0
  let heuresConnues = true
  const lignes = blocs.map((b, i): LignePdc => {
    const competencesDe = (x: Bloc): string[] => x.evaluationFinale && x.modules?.[0]?.puces.length
      ? x.modules[0].puces.slice(0, 5).map((p) => initiale(couper(p, 66)))
      : x.modules ? x.modules.map((m) => sansPoint(m.titre)) : x.puces.map((p) => initiale(couper(p, 66)))
    const objectifsDe = (x: Bloc): string[] => (x.modules
      ? x.modules.map((m) => objectifCourt(m.objectif))
      : [objectifCourt(x.objectif)]).filter((o): o is string => !!o)

    let competences: string[]
    let objectifs: string[]
    if (b.regroupes) {
      // Ligne regroupée : trop de modules pour la case, chaque période se résume à son thème,
      // ses objectifs au premier et au dernier (celui de l'évaluation finale reste lisible)
      const toutes = b.regroupes.flatMap(competencesDe)
      competences = toutes.length <= 8 ? toutes : b.regroupes.map((x) => theme(x.titre)).filter(Boolean)
      objectifs = Array.from(new Set(b.regroupes.flatMap((x) => {
        const os = objectifsDe(x)
        return os.length > 2 ? [os[0], os[os.length - 1]] : os
      })))
    } else {
      competences = competencesDe(b)
      objectifs = Array.from(new Set(objectifsDe(b)))
    }
    // Plus de cinq objectifs : chacun réduit à sa première action, pour tenir dans la case
    if (objectifs.length > 5) objectifs = objectifs.map((o) => objectifCourt(o, 50) || o)
    // Sans objectif écrit dans le programme, la case reprend le thème de la période
    const capableDe = objectifs.length > 0
    if (!capableDe) objectifs = [theme(b.titre)].filter(Boolean)

    const heure = heuresConnues ? cumul : i * heuresSemaine
    // Évaluation finale : avec un planning, le jour où tombent ses heures ; sinon le dernier jour ouvré
    const date = b.evaluationFinale && !planning.length && opts.fin
      ? dernierJour(opts.fin, planning)
      : jourDeLigne(opts.debut, heure, planning, heuresSemaine)
    if (b.heures) cumul += b.heures
    else heuresConnues = false
    return { date, heures: b.heures, competences, objectifs, capableDe }
  })

  // Une date de ligne hors de la période du candidat : à vérifier avant d'envoyer
  const debut = opts.debut?.slice(0, 10)
  const fin = opts.fin?.slice(0, 10)
  for (const l of lignes) {
    if (l.date && ((debut && l.date < debut) || (fin && l.date > fin))) {
      alertes.push({ code: 'date_hors_periode', message: `La ligne datée du ${l.date} tombe hors de la période du candidat (${debut || '?'} → ${fin || '?'}).` })
      break
    }
  }
  return { lignes, alertes }
}

// ── Employeur, responsable et tuteur : le contact du client ──

export interface ContactPdc {
  civilite?: string | null; prenom?: string | null; nom?: string | null; poste?: string | null
  email?: string | null; telephone?: string | null; mobile?: string | null
  est_signataire?: boolean | null; est_principal?: boolean | null; est_referent_formation?: boolean | null
}

/** Prénom saisi tout en capitales : initiales seulement (« HANI » → « Hani ») */
const prenomLisible = (p: string) => (p && p === p.toUpperCase()
  ? p.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase())
  : p)

/** « HAVETZ Jonathan », comme sur le formulaire */
export function nomPrenom(c: { nom?: string | null; prenom?: string | null } | null | undefined): string {
  if (!c) return ''
  return [String(c.nom || '').trim().toUpperCase(), prenomLisible(String(c.prenom || '').trim())].filter(Boolean).join(' ')
}

/** Numéro français à dix chiffres (« +33 6 84 32 45 88 » → « 0684324588 »), vide sinon */
export function telephoneNational(v: string | null | undefined): string {
  let d = String(v || '').replace(/\D/g, '')
  if (d.startsWith('0033')) d = `0${d.slice(4)}`
  else if (d.startsWith('33') && d.length === 11) d = `0${d.slice(2)}`
  return /^0\d{9}$/.test(d) ? d : ''
}
const estMobile = (n: string) => /^0[67]/.test(n)

/**
 * Employeur et responsable : le signataire du client, sinon son contact principal,
 * sinon le premier contact créé. Tuteur : le référent formation s'il y en a un,
 * sinon ce même contact. Les contacts arrivent triés (signataire, principal, création).
 */
export function partiesPdc(client: any, contacts: ContactPdc[]) {
  const liste = contacts || []
  const employeur = liste.find((c) => c.est_signataire) || liste.find((c) => c.est_principal) || liste[0] || null
  const tuteur = liste.find((c) => c.est_referent_formation) || employeur
  const numeros = [employeur?.mobile, employeur?.telephone, client?.whatsapp, client?.telephone].map(telephoneNational).filter(Boolean)
  return {
    employeur: nomPrenom(employeur) || nomPrenom(client),
    responsable: nomPrenom(employeur) || nomPrenom(client),
    telPort: numeros.find(estMobile) || '',
    telFixe: numeros.find((n) => !estMobile(n)) || '',
    mail: String(employeur?.email || client?.email || '').trim(),
    tuteur: nomPrenom(tuteur),
    tuteurCiv: tuteur ? String(tuteur.civilite || '').trim() : '',
    fonction: String(tuteur?.poste || '').trim(),
  }
}

/** Civilité du stagiaire : celle de la fiche, sinon déduite du sexe ; vide si inconnue (aucune case cochée) */
export function civiliteStagiaire(app: { civilite?: string | null; sexe?: string | null }): string {
  const c = String(app?.civilite || '').trim()
  if (c) return c
  return app?.sexe === 'F' ? 'Mme' : app?.sexe === 'H' ? 'M' : ''
}

/** Métier lisible : l'intitulé sans l'enseigne ni la variante de durée (« … - Enseigne Chamas Tacos (105) ») */
export function metierLisible(v: string | null | undefined): string {
  return String(v || '').split(/\s[-–—]\s|\s\(/)[0].trim()
}

// ── Données du formulaire pour un candidat ──

/** JJ/MM/AAAA d'une date AAAA-MM-JJ, sans passer par le fuseau du serveur */
function jjmmaaaa(d: string | null | undefined): string {
  const [a, m, j] = String(d || '').slice(0, 10).split('-')
  return a && m && j ? `${j}/${m}/${a}` : ''
}

/** Liste d'objectifs saisie en texte (une ligne chacun, ou « ., » entre deux) */
function enListe(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean)
  return String(v || '').split(/\r?\n|(?<=\.)\s*,\s*(?=\p{Lu})/u).map((x) => x.replace(/^[\s•·\-–]+/, '').trim()).filter(Boolean)
}

/** Heures d'un jour du planning : la somme de ses deux créneaux */
function heuresDuJour(j: any): number {
  const duree = (a?: string | null, b?: string | null) => {
    if (!a || !b) return 0
    const [ha, ma] = String(a).split(':').map(Number)
    const [hb, mb] = String(b).split(':').map(Number)
    const min = (hb * 60 + mb) - (ha * 60 + ma)
    return min > 0 ? min / 60 : 0
  }
  return duree(j.creneau1_debut, j.creneau1_fin) + duree(j.creneau2_debut, j.creneau2_fin)
}

/** Une lecture de la base a échoué : le plan n'est pas produit plutôt que produit à moitié */
export class LecturePdcImpossible extends Error {}

/**
 * Tout ce que le formulaire France Travail porte pour un candidat POEI de
 * l'organisation (null si le candidat n'en est pas), le nom du fichier et les
 * alertes de cohérence.
 */
export async function donneesPlanDeveloppement(supabase: any, organizationId: string, candidatId: string) {
  const lu = <T,>(r: { data: T; error: any }, quoi: string): T => {
    if (r.error) throw new LecturePdcImpossible(`${quoi} : ${r.error.message || r.error}`)
    return r.data
  }
  const candidat: any = lu(await supabase
    .from('poei_candidats')
    .select('*, apprenant:apprenants(civilite, sexe, nom, prenom), poei:poei_id(*)')
    .eq('id', candidatId)
    .eq('organization_id', organizationId)
    .maybeSingle(), 'candidat')
  if (!candidat) return null
  const poei: any = candidat.poei?.organization_id === organizationId ? candidat.poei : null

  const vide = { data: null, error: null }
  const [client, contacts, formation, session, planning] = await Promise.all([
    poei?.client_id ? supabase.from('clients').select('*').eq('id', poei.client_id).eq('organization_id', organizationId).maybeSingle() : vide,
    poei?.client_id
      ? supabase.from('contacts').select('civilite, prenom, nom, poste, email, telephone, mobile, est_signataire, est_principal, est_referent_formation')
          .eq('client_id', poei.client_id).eq('organization_id', organizationId)
          .order('est_signataire', { ascending: false, nullsFirst: false }).order('est_principal', { ascending: false, nullsFirst: false }).order('created_at')
      : { data: [], error: null },
    poei?.formation_id ? supabase.from('formations').select('intitule, programme_detaille, duree_heures, objectifs_pedagogiques').eq('id', poei.formation_id).eq('organization_id', organizationId).maybeSingle() : vide,
    poei?.session_id ? supabase.from('sessions').select('date_debut, date_fin, horaires_jours').eq('id', poei.session_id).eq('organization_id', organizationId).maybeSingle() : vide,
    supabase.from('poei_plannings').select('date, repos, creneau1_debut, creneau1_fin, creneau2_debut, creneau2_fin')
      .eq('candidat_id', candidat.id).eq('organization_id', organizationId).order('date'),
  ])
  const cli: any = lu(client, 'client') || {}
  const f: any = lu(formation, 'formation') || {}
  const sess: any = lu(session, 'session') || {}
  const app: any = candidat.apprenant || {}
  const parties = partiesPdc(cli, lu(contacts, 'contacts') || [])

  // Dates du candidat, sinon de la POEI, sinon de sa session
  const debut: string | null = candidat.date_debut || poei?.date_debut || sess.date_debut || null
  const fin: string | null = candidat.date_fin || poei?.date_fin || sess.date_fin || null
  const positif = (v: unknown) => (Number(v) > 0 ? Number(v) : null)
  const duProjet = positif(poei?.duree_heures) || positif(f.duree_heures)
  // Entré après le groupe : le programme reprend où en est le groupe (durées des deux, sinon jours ouvrés manqués)
  const entreeDecalee = !!(candidat.date_debut && poei?.date_debut && String(candidat.date_debut) > String(poei.date_debut))
  const heuresDejaFaites = !entreeDecalee ? 0
    : positif(candidat.duree_heures) && duProjet && (!candidat.date_fin || !poei?.date_fin || candidat.date_fin === poei.date_fin)
      ? Math.max(0, duProjet - positif(candidat.duree_heures)!)
      : joursOuvresEntre(String(poei.date_debut), String(candidat.date_debut)) * HEURES_JOUR
  const total: number | null = positif(candidat.duree_heures) || (duProjet ? Math.max(0, duProjet - heuresDejaFaites) || null : null)
  // Durée hebdomadaire : les heures réparties sur les semaines de la période (35 heures pour un temps plein)
  const semaines = debut && fin ? Math.max(1, Math.round((Date.parse(fin) - Date.parse(debut) + 86_400_000) / (7 * 86_400_000))) : null
  const hebdo = total && semaines ? Math.round(total / semaines) : null
  // Planning réel du candidat (jours travaillés et leurs heures), sinon celui de la session
  // (bornés à la période du candidat : un planning saisi au-delà de sa fin ne compte pas)
  const dansPeriode = (d: string) => (!debut || d >= debut.slice(0, 10)) && (!fin || d <= fin.slice(0, 10))
  const jours: JourPlanning[] = ((lu(planning, 'planning') || []) as any[])
    .filter((j: any) => !j.repos).map((j: any) => ({ date: String(j.date).slice(0, 10), heures: heuresDuJour(j) }))
    .filter((j: JourPlanning) => j.heures > 0 && dansPeriode(j.date))
  const joursSession: JourPlanning[] = (Array.isArray(sess.horaires_jours) ? sess.horaires_jours : [])
    .map((j: any) => ({ date: String(j?.date || '').slice(0, 10), heures: HEURES_JOUR }))
    .filter((j: JourPlanning) => j.date && dansPeriode(j.date))

  const { lignes, alertes } = lignesPlanDeveloppement(f.programme_detaille, {
    debut, fin, totalHeures: total, heuresDejaFaites,
    planning: jours.length ? jours : joursSession,
    heuresSemaine: hebdo, objectifsFormation: enListe(f.objectifs_pedagogiques),
  })
  // Le métier : celui du candidat, sinon de la POEI ou de la formation, sans l'enseigne ni la variante de durée
  const poste = String(candidat.poste_vise || '').trim() || metierLisible(poei?.poste_vise) || metierLisible(f.intitule)
  const commercial = cli.nom_commercial && String(cli.nom_commercial).toLowerCase() !== String(cli.raison_sociale || '').toLowerCase() ? cli.nom_commercial : null
  // Nom de fichier en caractères simples (un en-tête HTTP n'accepte pas « ’ » ni « ğ »)
  const simple = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  const nomFichier = `${simple(String(app.prenom || ''))}_${simple(String(app.nom || '')) || 'candidat'}`

  return {
    fichier: `plan-developpement-competences-${nomFichier}.pdf`,
    lignes,
    alertes,
    data: {
      employeur: parties.employeur,
      raison: [cli.raison_sociale, commercial].filter(Boolean).join(' - '),
      adresse: cli.adresse || '',
      cp: cli.code_postal || '', ville: cli.ville || '',
      responsable: parties.responsable,
      telFixe: parties.telFixe, telPort: parties.telPort,
      mail: parties.mail,
      poste,
      debut: jjmmaaaa(debut),
      fin: jjmmaaaa(fin),
      hebdo: hebdo && hebdo >= 1 && hebdo <= 48 ? `${hebdo} heures` : '',
      total: total ? (Number.isInteger(total) ? `${total} heures` : heuresLisibles(total)) : '',
      // Celle du candidat, sinon celle réglée dans les paramètres de la POEI
      embauche: jjmmaaaa(candidat.date_embauche_prevue || poei?.date_embauche_prevue),
      stagiaireCiv: civiliteStagiaire(app), stagiaire: nomPrenom(app),
      tuteurCiv: parties.tuteurCiv, tuteur: parties.tuteur, fonction: parties.fonction,
      rows: lignes.map((l) => ({
        date: jjmmaaaa(l.date), heures: heuresLisibles(l.heures),
        competences: l.competences, objectifs: l.objectifs, capableDe: l.capableDe,
      })),
    },
  }
}
