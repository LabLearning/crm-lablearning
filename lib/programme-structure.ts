/**
 * Découpage d'un programme détaillé saisi en texte : jours ou semaines,
 * modules et séquences horaires, objectif, puces, ateliers.
 *
 * Tous les affichages (PDF du programme, annexe des conventions, fiche du
 * catalogue, site) passent par ce découpage, pour qu'un même texte se lise
 * partout de la même façon. Un texte sans structure reconnue renvoie une liste
 * vide : chaque affichage garde alors son rendu simple.
 */

export interface LigneProgramme {
  type: 'puce' | 'activite'
  /** Pour une activité : « Atelier pratique », « Exercice d'application »… */
  label?: string
  texte: string
}
export interface BlocProgramme {
  /** Module ou séquence (« Accueil et évaluation initiale », « Bilan du jour 1 »…) */
  titre: string
  /** Durée ou horaire entre parenthèses en fin de titre : « 9h30-10h45 » */
  duree: string
  objectif: string
  lignes: LigneProgramme[]
}
export interface GroupeProgramme {
  /** Jour, semaine ou thème ; vide quand le programme n'en a pas */
  titre: string
  duree: string
  /** « Objectifs du jour : … » */
  objectif: string
  /** Lignes placées avant le premier module du jour */
  notes: string[]
  blocs: BlocProgramme[]
}

// Puces standard + puces de police Symbol/Wingdings collées depuis Word
// (zone Private Use U+F000–U+F0FF, ex. U+F0B7 qui s'affiche « · »).
const PUCES = '\\u2022\\u00b7\\u2219\\u25cf\\u25aa\\u25e6\\u2043\\u2013\\u2014\\uf000-\\uf0ff*\\-'
// Une seule classe répétée, sans quantificateurs imbriqués : une ligne de tirets
// (séparateur) ne doit pas faire exploser le temps de calcul.
const PUCE_EN_TETE = new RegExp(`^[\\s${PUCES}]*[${PUCES}]\\s*`)
const PUCES_PRIVEES = /[-]/g

const GROUPE = /^(semaine|jour|journ[ée]e|demi-journ[ée]e|th[èe]me|partie|chapitre|phase)\s+\d+\b/i
const MODULE = /^module\b/i
const OBJECTIF = /^objectifs?(?:\s+(?:du|de la|des|de l[’'])\s*[^:]{0,24})?\s*:\s*/i
const DUREE_SEULE = /^(?:dur[ée]e\s*:\s*)?(\d+\s*(?:h|heures?|min|minutes?)(?:\s*\d+)?(?:\s*(?:min|minutes?))?)\.?$/i
const ACTIVITE = /^(atelier pratique|ateliers pratiques|atelier|exercice d[’']application|exercice pratique|exercice|mise en situation|cas pratique|[ée]tude de cas|jeux? de r[ôo]le|travaux pratiques)\s*:\s*/i
// Durée ou horaire en fin de titre : « (9h00-9h30) », « (30 min) », « (7 heures) », « - 35 h », « – 7 heures »
const DUREE_PARENTHESES = /\s*\(([^()]*\d[^()]*(?:h|min|heures?|minutes?)[^()]*)\)\s*$/i
const DUREE_TIRET = /\s+[-–—]\s+(\d+\s*(?:h|heures?)(?:\s*\d+)?)\s*$/i

const scinderDuree = (ligne: string): { titre: string; duree: string } => {
  const m = ligne.match(DUREE_PARENTHESES) || ligne.match(DUREE_TIRET)
  return m ? { titre: ligne.slice(0, m.index).trim(), duree: m[1].trim() } : { titre: ligne.trim(), duree: '' }
}

export function structurerProgramme(texte: string | null | undefined): GroupeProgramme[] {
  const brut = String(texte || '').replace(/\r\n?/g, '\n')
  // Le HTML (imports Dendreo, éditeur riche) garde son rendu propre
  if (!brut.trim() || /<[a-z][^>]*>/i.test(brut)) return []

  const groupes: GroupeProgramme[] = []
  let groupe: GroupeProgramme | null = null
  let bloc: BlocProgramme | null = null
  let orphelines = 0
  const ouvrirGroupe = (titre: string, duree: string) => { groupe = { titre, duree, objectif: '', notes: [], blocs: [] }; groupes.push(groupe); bloc = null }
  const ouvrirBloc = (titre: string, duree: string) => {
    if (!groupe) ouvrirGroupe('', '')
    bloc = { titre, duree, objectif: '', lignes: [] }
    groupe!.blocs.push(bloc)
  }

  for (const ligneBrute of brut.split('\n')) {
    const ligne = ligneBrute.replace(PUCES_PRIVEES, '').replace(/[ \t]{2,}/g, ' ').trim()
    if (!ligne) continue
    const aPuce = PUCE_EN_TETE.test(ligne)
    const nu = ligne.replace(PUCE_EN_TETE, '').trim()
    if (!nu) continue
    const g = groupe as GroupeProgramme | null
    const b = bloc as BlocProgramme | null

    // Jour, semaine, thème… : « JOUR 1 – Titre (7 heures) », « Semaine 2 — Durée : 35 h »
    if (!aPuce && GROUPE.test(nu) && nu.length <= 160) {
      const parDuree = nu.split(/\s+[—–-]\s+Dur[ée]e\s*:\s*/i)
      if (parDuree.length > 1) ouvrirGroupe(parDuree[0].trim(), parDuree.slice(1).join(' ').trim())
      else { const t = scinderDuree(nu); ouvrirGroupe(t.titre, t.duree) }
      continue
    }
    // Module : même précédé d'une puce parasite (« • Module 4 – … »)
    if (MODULE.test(nu)) { const m = scinderDuree(nu); ouvrirBloc(m.titre, m.duree); continue }
    // Séquence sans le mot « Module » : une ligne sans puce qui finit par un horaire ou une
    // durée entre parenthèses — « Accueil et évaluation initiale (9h00-9h30) »
    if (!aPuce && DUREE_PARENTHESES.test(nu) && nu.length <= 160 && !OBJECTIF.test(nu)) {
      const t = scinderDuree(nu); ouvrirBloc(t.titre, t.duree); continue
    }
    // « Durée : 7 heures » ou « 35 heures » seul sur sa ligne : la durée du module ou du jour en cours
    const dureeSeule = nu.match(DUREE_SEULE)
    if (dureeSeule && (b ? !b.duree && !b.lignes.length : g && !g.duree)) {
      if (b) b.duree = dureeSeule[1].trim(); else g!.duree = dureeSeule[1].trim()
      continue
    }
    if (OBJECTIF.test(nu)) {
      const objectif = nu.replace(OBJECTIF, '').trim()
      if (b && !b.objectif && !b.lignes.length) { b.objectif = objectif; continue }
      if (!b && g && !g.objectif) { g.objectif = objectif; continue }
    }
    if (/^contenus?\s*:?\s*$/i.test(nu)) continue
    if (!b) {
      // Avant le premier module : note du jour ou de la semaine ; hors de tout jour, ligne orpheline
      if (g) g.notes.push(nu); else orphelines++
      continue
    }
    const activite = !aPuce ? nu.match(ACTIVITE) : null
    if (activite) b.lignes.push({ type: 'activite', label: activite[1].charAt(0).toUpperCase() + activite[1].slice(1), texte: nu.slice(activite[0].length).trim() })
    else b.lignes.push({ type: 'puce', texte: nu })
  }

  const blocs = groupes.flatMap((x) => x.blocs)
  const modules = blocs.filter((x) => MODULE.test(x.titre)).length
  // Structure fiable : des modules, ou des séquences horaires sans rien de perdu en tête de texte.
  // Sinon (texte libre, export Word aux puces inversées…) chaque affichage garde son rendu simple.
  if (!blocs.length || (modules === 0 && orphelines > 0)) return []
  return groupes.filter((x) => x.blocs.length > 0 || x.titre)
}
