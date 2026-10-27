import { themeOf } from '@/lib/branches'

/**
 * Recueil du besoin rempli automatiquement (indicateur Qualiopi 4).
 *
 * Demande de Brahim (27/10/2026) : « en fonction de la formation chacun a un
 * besoin identique : celui qui veut faire une formation hygiène veut former
 * son équipe à l'hygiène ». Chaque réponse est rédigée à partir des faits du
 * dossier : le client (secteur, réseau, ville), la session (dates, horaires,
 * lieu, intra ou inter), les inscrits (nombre, postes, contrats, handicap
 * déclaré) et la formation (son analyse du besoin validée, ses objectifs, ses
 * prérequis). Rien n'est inventé : une information absente est dite « à
 * confirmer ». Aucun nom de participant dans la réponse sur le handicap (le
 * recueil peut être remis au commanditaire).
 *
 * Fonction pure : la lecture en base et l'enregistrement sont dans
 * lib/recueil-auto-serveur.ts.
 */

export interface FaitsRecueil {
  session: {
    reference?: string | null
    date_debut?: string | null
    date_fin?: string | null
    horaires_jours?: { date?: string; matin_debut?: string; matin_fin?: string; aprem_debut?: string; aprem_fin?: string }[] | null
    lieu?: string | null
    ville?: string | null
    modalite?: string | null
    type_session?: string | null
    places_max?: number | null
    intitule?: string | null
  }
  formation?: {
    intitule?: string | null
    analyse_besoin?: string | null
    objectifs_pedagogiques?: unknown
    public_vise?: string | null
    prerequis?: string | null
    duree_heures?: number | null
  } | null
  client?: {
    raison_sociale?: string | null
    nom_commercial?: string | null
    secteur_activite?: string | null
    ville?: string | null
    franchise?: string | null
  } | null
  /** Inscrits non annulés */
  inscrits: { poste?: string | null; type_contrat?: string | null; situation_handicap?: boolean | null }[]
}

export type ThemeRecueil = 'hygiene' | 'prevention' | 'management' | 'metier'

export const themeDuRecueil = (intitule: string | null | undefined): ThemeRecueil => {
  const t = themeOf(intitule || '')
  return (['hygiene', 'prevention', 'management', 'metier'].includes(t) ? t : 'metier') as ThemeRecueil
}

const net = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
const sansPoint = (v: string) => v.replace(/[\s.;:]+$/, '')
const dateFr = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}
const heure = (h?: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h || '')
  return m ? `${Number(m[1])} h ${m[2]}` : ''
}
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

/** Objectifs de la formation, une ligne chacun (liste ou texte libre) */
export function objectifsDe(brut: unknown): string[] {
  let o: unknown = brut
  if (typeof o === 'string') { try { o = JSON.parse(o) } catch { /* texte libre */ } }
  const lignes = Array.isArray(o) ? o.map(net) : String(o ?? '').split(/\n+/).map(net)
  return lignes.map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter((l) => l && !/^objectifs?\s*:?$/i.test(l))
}

/** Besoins types par sujet, quand la formation n'a pas d'analyse du besoin validée */
const BESOINS_PAR_SUJET: { re: RegExp; besoin: string }[] = [
  { re: /nettoyage|d[ée]sinfection/i, besoin: 'mettre en place un plan de nettoyage et de désinfection efficace et traçable' },
  { re: /allerg[eè]n/i, besoin: 'informer correctement les clients sur les allergènes et éviter les contaminations croisées' },
  { re: /tra[cç]abilit|[ée]tiquetage/i, besoin: 'maîtriser la traçabilité et l’étiquetage des denrées' },
  { re: /\bpms\b|plan de ma[iî]trise/i, besoin: 'mettre en œuvre et faire vivre le plan de maîtrise sanitaire de l’établissement' },
  { re: /hygi[eè]ne|haccp|alimentaire/i, besoin: 'former l’équipe aux bonnes pratiques d’hygiène alimentaire (HACCP) pour garantir la sécurité des aliments servis et la conformité au Paquet Hygiène' },
  { re: /duerp|document unique/i, besoin: 'évaluer les risques professionnels de l’établissement et tenir à jour le document unique' },
  { re: /\bsst\b|sauveteur|secouris/i, besoin: 'disposer de salariés capables de porter secours en cas d’accident' },
  { re: /incendie/i, besoin: 'savoir réagir face à un départ de feu et organiser l’évacuation' },
  { re: /gestes|postures|\btms\b/i, besoin: 'réduire les troubles musculosquelettiques liés au port de charges et aux postures de travail' },
  { re: /pr[ée]vention|risques|s[ée]curit/i, besoin: 'prévenir les risques professionnels de l’équipe et répondre aux obligations de l’employeur en santé et sécurité' },
  { re: /rentabilit|co[uû]ts|gestion/i, besoin: 'améliorer la gestion et la rentabilité de l’établissement' },
  { re: /accueil|vente|commercial/i, besoin: 'améliorer l’accueil des clients et développer les ventes' },
  { re: /manag|encadr|[ée]quipe/i, besoin: 'renforcer les compétences de management et d’organisation de l’équipe' },
]
const BESOIN_PAR_THEME: Record<ThemeRecueil, string> = {
  hygiene: 'former l’équipe aux bonnes pratiques d’hygiène alimentaire pour garantir la sécurité des aliments servis et la conformité réglementaire',
  prevention: 'prévenir les risques professionnels de l’équipe et répondre aux obligations de l’employeur en santé et sécurité',
  management: 'renforcer les compétences de management, d’organisation et de gestion de l’équipe',
  metier: 'développer la maîtrise des gestes et techniques du cœur de métier',
}

/**
 * Le besoin de la formation : la phrase « répond au besoin de … » de son
 * analyse validée, sinon le besoin type de son sujet, sinon celui de son thème.
 */
export function besoinDeLaFormation(intitule: string, analyse: string | null | undefined, theme: ThemeRecueil): string {
  const m = /r[ée]pond au besoin (?:de |d['’])\s*([^.]+)\./i.exec(net(analyse))
  if (m) return sansPoint(m[1])
  return BESOINS_PAR_SUJET.find((b) => b.re.test(intitule))?.besoin || BESOIN_PAR_THEME[theme]
}

/** « employé polyvalent (3), gérant (1) » : postes regroupés sans tenir compte de la casse ni des accents */
function postesDe(inscrits: FaitsRecueil['inscrits']): string {
  const groupes = new Map<string, { libelle: string; n: number }>()
  for (const i of inscrits) {
    const libelle = net(i.poste)
    if (!libelle) continue
    const cle = libelle.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    const g = groupes.get(cle)
    if (g) g.n++; else groupes.set(cle, { libelle: libelle.charAt(0).toLowerCase() + libelle.slice(1), n: 1 })
  }
  return Array.from(groupes.values()).sort((a, b) => b.n - a.n).map((g) => `${g.libelle} (${g.n})`).join(', ')
}

function contratsDe(inscrits: FaitsRecueil['inscrits']): string {
  const vus = new Map<string, string>()
  for (const i of inscrits) {
    const c = net(i.type_contrat)
    if (c) vus.set(c.toLowerCase(), c)
  }
  return Array.from(vus.values()).join(', ')
}

function datesDe(s: FaitsRecueil['session']): string {
  const debut = s.date_debut ? dateFr(s.date_debut) : ''
  const fin = s.date_fin ? dateFr(s.date_fin) : ''
  if (!debut) return 'dates à confirmer'
  return fin && fin !== debut ? `du ${debut} au ${fin}` : `le ${debut}`
}

function horairesDe(s: FaitsRecueil['session']): string {
  const j = (s.horaires_jours || []).find((x) => x && (x.matin_debut || x.aprem_debut))
  if (!j) return ''
  const matin = j.matin_debut && j.matin_fin ? `${heure(j.matin_debut)} à ${heure(j.matin_fin)}` : ''
  const aprem = j.aprem_debut && j.aprem_fin ? `${heure(j.aprem_debut)} à ${heure(j.aprem_fin)}` : ''
  return [matin, aprem].filter(Boolean).join(' et ')
}

/** Réponses automatiques, pour les questions connues du modèle (les autres restent vides). */
export function reponsesAutomatiques(f: FaitsRecueil, theme: ThemeRecueil, questions: string[]): Record<string, string> {
  const intitule = net(f.formation?.intitule || f.session.intitule) || 'la formation'
  const client = net(f.client?.nom_commercial || f.client?.raison_sociale) || 'le commanditaire'
  const secteur = net(f.client?.secteur_activite)
  const reseau = net(f.client?.franchise)
  const ville = net(f.session.ville || f.client?.ville)
  const n = f.inscrits.length
  const besoin = besoinDeLaFormation(intitule, f.formation?.analyse_besoin, theme)
  const objectifs = objectifsDe(f.formation?.objectifs_pedagogiques)
  const postes = postesDe(f.inscrits)
  const contrats = contratsDe(f.inscrits)
  const handicaps = f.inscrits.filter((i) => i.situation_handicap).length
  const intra = f.session.type_session === 'intra'
  const distanciel = /distan|visio|ligne/i.test(net(f.session.modalite))
  const horaires = horairesDe(f.session)
  const duree = Number(f.formation?.duree_heures) || null

  const description = [secteur ? secteur.charAt(0).toLowerCase() + secteur.slice(1) : '', reseau ? `établissement du réseau ${reseau}` : ''].filter(Boolean).join(', ')
  const r: Record<string, string> = {
    contexte: `${client}${description ? ` (${description})` : ''}${ville ? `, à ${ville}` : ''}. Besoin : ${besoin}. `
      + `Formation « ${intitule} »${f.session.reference ? `, session ${f.session.reference}` : ''}, ${datesDe(f.session)}`
      + `${intra ? ', en intra pour l’équipe de l’établissement' : f.session.type_session === 'inter' ? ', en inter-entreprises' : ''}.`,
    participants: n
      ? `${pluriel(n, 'participant inscrit', 'participants inscrits')}${postes ? `. Postes : ${postes}` : ''}${contrats ? `. Contrats : ${contrats}` : ''}.`
      : `Participants à confirmer par ${client}${f.session.places_max ? ` (jusqu’à ${f.session.places_max} places)` : ''}.`,
    niveau: `Prérequis : ${net(f.formation?.prerequis) ? sansPoint(net(f.formation?.prerequis)) : 'aucun prérequis'}. `
      + 'Le niveau initial de chaque participant est évalué au démarrage (positionnement), pour adapter les apports et les exercices.',
    objectifs: objectifs.length
      ? objectifs.slice(0, 6).join('\n')
      : `Être capable de mettre en pratique, au poste de travail, les acquis de la formation « ${intitule} ».`,
    contraintes: [
      `Dates : ${datesDe(f.session)}${duree ? ` (${duree} h)` : ''}.`,
      horaires ? `Horaires : ${horaires}.` : '',
      `Lieu : ${[net(f.session.lieu), ville].filter(Boolean).join(', ') || 'à confirmer'}.`,
      `Modalité : ${distanciel ? 'à distance' : 'présentiel'}${intra ? ', intra-entreprise' : f.session.type_session === 'inter' ? ', inter-entreprises' : ''}. Planning fixé avec ${client}.`,
    ].filter(Boolean).join(' '),
    handicap: handicaps
      ? `${handicaps > 1 ? `${handicaps} participants ont` : 'Un participant a'} signalé une situation de handicap : les adaptations (rythme, supports, modalités d’évaluation) sont étudiées avec le référent handicap de l’organisme (analyse PSH).`
      : 'Aucun besoin d’adaptation (handicap, langue ou autre) signalé à ce jour. Le référent handicap de l’organisme reste joignable avant et pendant la formation pour tout aménagement.',
    attentes: `Attente de ${client} : ${besoin}, avec une application directe au poste de travail. `
      + {
        hygiene: 'Points de vigilance : bonnes pratiques au quotidien, autocontrôles et traçabilité.',
        prevention: 'Points de vigilance : situations à risque propres à l’établissement et réflexes à acquérir.',
        management: 'Points de vigilance : situations concrètes vécues par les responsables, outils réutilisables dès le retour en poste.',
        metier: 'Points de vigilance : gestes pratiqués au quotidien et régularité de la production.',
      }[theme],
    hy_process: `${secteur ? `Établissement de ${secteur.charAt(0).toLowerCase()}${secteur.slice(1)}` : 'Établissement alimentaire'}${reseau ? ` du réseau ${reseau}, avec le plan de maîtrise sanitaire du réseau` : ''}. `
      + 'Process concernés : réception, stockage, préparation, service et nettoyage. Les écarts constatés (contrôles, autocontrôles) sont repris dans les exercices.',
    pv_risques: /duerp|document unique/i.test(intitule)
      ? 'Risques à évaluer pour le document unique : coupures, brûlures, chutes, port de charges, produits de nettoyage, risque incendie. Équipements et protections utilisés au poste passés en revue.'
      : /\bsst\b|sauveteur|secouris/i.test(intitule)
        ? 'Risques d’accident en cuisine et en salle (coupures, brûlures, chutes, malaises) : les gestes de premiers secours à maîtriser.'
        : /incendie/i.test(intitule)
          ? 'Risque incendie en cuisine (friteuses, hottes, gaz) : moyens d’extinction, alarme et évacuation de l’établissement.'
          : 'Risques du secteur : coupures, brûlures, chutes, port de charges, incendie. Équipements et protections utilisés au poste passés en revue.',
    mg_equipe: `${n ? `${pluriel(n, 'participant', 'participants')}${postes ? ` (${postes})` : ''}` : 'Responsables à confirmer'}. `
      + 'Enjeux : organisation du service, animation et motivation de l’équipe, intégration des nouveaux, suivi des indicateurs.',
    me_gestes: `Gestes et techniques visés : ${objectifs.length ? objectifs.slice(0, 3).map(sansPoint).join(' ; ') : `ceux du programme « ${intitule} »`}. `
      + 'Le niveau de maîtrise est mesuré au démarrage, puis en fin de formation.',
  }
  const reponses: Record<string, string> = {}
  for (const q of questions) if (r[q]) reponses[q] = r[q]
  return reponses
}

/** Clé où le recueil garde ce que le CRM a écrit lui-même (date, valeurs) : un texte JSON, comme les autres réponses */
export const CLE_AUTO = '_auto'

export interface TraceAuto { le: string; champs: Record<string, string> }

export function lireTraceAuto(reponses: Record<string, unknown> | null | undefined): TraceAuto | null {
  const brut = reponses?.[CLE_AUTO]
  if (typeof brut !== 'string') return null
  try {
    const t = JSON.parse(brut)
    return t && typeof t.le === 'string' && t.champs && typeof t.champs === 'object' ? t : null
  } catch { return null }
}

/**
 * Fusion avec un recueil existant : un champ vide reçoit la réponse
 * automatique ; un champ que le CRM avait écrit et que personne n'a modifié
 * suit les faits (inscrits, horaires…) ; un champ modifié à la main n'est
 * jamais touché. Renvoie les réponses fusionnées et ce qui a changé.
 */
export function fusionner(existantes: Record<string, string>, auto: Record<string, string>, aujourdhui: string): { reponses: Record<string, string>; modifies: string[] } {
  const trace = lireTraceAuto(existantes)
  const champs: Record<string, string> = { ...(trace?.champs || {}) }
  const reponses = { ...existantes }
  const modifies: string[] = []
  for (const [id, valeur] of Object.entries(auto)) {
    const actuel = String(existantes[id] ?? '').trim()
    const ecritParLeCrm = !!trace && trace.champs[id] !== undefined && actuel === String(trace.champs[id]).trim()
    if (!actuel || (ecritParLeCrm && actuel !== valeur.trim())) {
      reponses[id] = valeur
      champs[id] = valeur
      modifies.push(id)
    }
  }
  if (modifies.length) reponses[CLE_AUTO] = JSON.stringify({ le: trace?.le || aujourdhui, champs })
  return { reponses, modifies }
}
