/**
 * Compte rendu de formation rédigé par le formateur (rapports_session).
 *
 * Structure partagée par le formulaire de l'espace formateur, l'action qui
 * l'enregistre, l'onglet Bilan de la session et le PDF. Module sans import
 * serveur : il est chargé côté navigateur.
 *
 * Le détail vit dans rapports_session.compte_rendu (migration 162) ; une
 * synthèse en texte est toujours recopiée dans les anciennes colonnes
 * (contenu_aborde, objectifs_atteints…), si bien que rien n'est perdu tant que
 * la migration n'est pas appliquée et que les anciens écrans restent justes.
 */

export type Creneau = 'matin' | 'apres_midi'
export type NiveauObjectif = 'atteint' | 'partiel' | 'non_atteint'
export type Acquis = 'acquis' | 'en_cours' | 'non_acquis'

export interface DemiJournee {
  date: string
  creneau: Creneau
  contenu: string
  methodes: string[]
  /** Absent : animée par l'auteur du compte rendu */
  statut?: 'autre_formateur' | 'non_realisee'
}

/** perso : objectif ajouté par le formateur (absent de la fiche formation) */
export interface ObjectifEvalue { objectif: string; niveau: NiveauObjectif | ''; commentaire: string; perso?: boolean }

/** retire : inscription annulée après avoir émargé, évaluation facultative */
export interface AcquisStagiaire { apprenant_id: string; nom: string; acquis: Acquis | ''; commentaire: string; retire?: boolean }

export interface CompteRendu {
  version: 1
  deroule: DemiJournee[]
  objectifs: ObjectifEvalue[]
  groupe: { niveau: string; participation: string; dynamique: string; assiduite: string }
  evaluation: { modalites: string[]; synthese: string }
  stagiaires: AcquisStagiaire[]
  conditions: { salle: string; commentaire: string; difficultes: string }
  bilan: { points_positifs: string; retours_stagiaires: string; besoins_detectes: string; recommandations: string; commentaires: string }
}

export const METHODES = [
  'Apports théoriques', 'Démonstration', 'Mise en pratique', 'Mise en situation',
  'Étude de cas', 'Travail en groupe', 'Quiz ou QCM', 'Visite ou audit terrain',
]

export const MODALITES_EVALUATION = [
  'QCM de sortie', 'Mise en situation pratique', 'Observation du formateur',
  'Étude de cas', 'Questions orales', 'Production réalisée',
]

export const NIVEAUX_GROUPE = ['Débutant', 'Intermédiaire', 'Confirmé', 'Hétérogène']
export const PARTICIPATIONS = ['Très active', 'Active', 'Moyenne', 'Faible']
export const SALLES = ['Adaptées', 'Partiellement adaptées', 'Inadaptées']

export const LIBELLES_CRENEAU: Record<Creneau, string> = { matin: 'Matin', apres_midi: 'Après-midi' }
export const LIBELLES_STATUT_DEMI_JOURNEE = { autre_formateur: 'Animée par un autre formateur', non_realisee: 'Pas de formation sur ce créneau' } as const

/** Ordre chronologique : le matin avant l'après-midi (l'ordre alphabétique les inverserait). */
export const ordreDemiJournee = (a: { date: string; creneau: string }, b: { date: string; creneau: string }) =>
  a.date.localeCompare(b.date) || (a.creneau === 'matin' ? 0 : 1) - (b.creneau === 'matin' ? 0 : 1)
export const LIBELLES_OBJECTIF: Record<NiveauObjectif, string> = { atteint: 'Atteint', partiel: 'Partiellement atteint', non_atteint: 'Non atteint' }
export const LIBELLES_ACQUIS: Record<Acquis, string> = { acquis: 'Acquis', en_cours: 'En cours d’acquisition', non_acquis: 'Non acquis' }

/** Objectifs de la fiche formation, qu'ils soient stockés en liste ou en texte. */
export function objectifsFormation(v: unknown): string[] {
  const brut = Array.isArray(v) ? v.map(String)
    : typeof v === 'string' ? v.split(/\r?\n|;/)
    : []
  return brut.map((o) => o.replace(/^[\s\-•*·\d.)]+/, '').trim()).filter((o) => o.length > 2)
}

/** Compte rendu vierge, prérempli avec les demi-journées, les objectifs et les stagiaires de la session. */
export function compteRenduVierge(p: {
  creneaux: { date: string; creneau: Creneau }[]
  objectifs: string[]
  stagiaires: { id: string; nom: string; retire?: boolean }[]
}): CompteRendu {
  return {
    version: 1,
    deroule: p.creneaux.map((c) => ({ ...c, contenu: '', methodes: [] })),
    objectifs: p.objectifs.map((objectif) => ({ objectif, niveau: '', commentaire: '' })),
    groupe: { niveau: '', participation: '', dynamique: '', assiduite: '' },
    evaluation: { modalites: [], synthese: '' },
    stagiaires: p.stagiaires.map((s) => ({ apprenant_id: s.id, nom: s.nom, acquis: '', commentaire: '', ...(s.retire ? { retire: true } : {}) })),
    conditions: { salle: '', commentaire: '', difficultes: '' },
    bilan: { points_positifs: '', retours_stagiaires: '', besoins_detectes: '', recommandations: '', commentaires: '' },
  }
}

/** Un compte rendu enregistré, complété champ par champ : un JSON partiel ou d'une autre version ne casse aucun écran. */
export function normaliserCompteRendu(v: unknown): CompteRendu | null {
  if (!v || typeof v !== 'object' || (v as any).version !== 1) return null
  const x = v as any
  const txt = (t: unknown) => (typeof t === 'string' ? t : '')
  const liste = (l: unknown) => (Array.isArray(l) ? l : [])
  return {
    version: 1,
    deroule: liste(x.deroule).filter((d: any) => d && typeof d.date === 'string').map((d: any): DemiJournee => ({
      date: d.date.slice(0, 10), creneau: d.creneau === 'apres_midi' ? 'apres_midi' : 'matin',
      contenu: txt(d.contenu), methodes: liste(d.methodes).filter((m: unknown) => typeof m === 'string'),
      ...(d.statut === 'autre_formateur' || d.statut === 'non_realisee' ? { statut: d.statut } : {}),
    })).sort(ordreDemiJournee),
    objectifs: liste(x.objectifs).filter((o: any) => o && typeof o.objectif === 'string').map((o: any) => ({
      objectif: o.objectif, niveau: ['atteint', 'partiel', 'non_atteint'].includes(o.niveau) ? o.niveau : '',
      commentaire: txt(o.commentaire), ...(o.perso ? { perso: true } : {}),
    })),
    groupe: { niveau: txt(x.groupe?.niveau), participation: txt(x.groupe?.participation), dynamique: txt(x.groupe?.dynamique), assiduite: txt(x.groupe?.assiduite) },
    evaluation: { modalites: liste(x.evaluation?.modalites).filter((m: unknown) => typeof m === 'string'), synthese: txt(x.evaluation?.synthese) },
    stagiaires: liste(x.stagiaires).filter((s: any) => s && typeof s.apprenant_id === 'string').map((s: any) => ({
      apprenant_id: s.apprenant_id, nom: txt(s.nom), acquis: ['acquis', 'en_cours', 'non_acquis'].includes(s.acquis) ? s.acquis : '',
      commentaire: txt(s.commentaire), ...(s.retire ? { retire: true } : {}),
    })),
    conditions: { salle: txt(x.conditions?.salle), commentaire: txt(x.conditions?.commentaire), difficultes: txt(x.conditions?.difficultes) },
    bilan: {
      points_positifs: txt(x.bilan?.points_positifs), retours_stagiaires: txt(x.bilan?.retours_stagiaires),
      besoins_detectes: txt(x.bilan?.besoins_detectes), recommandations: txt(x.bilan?.recommandations), commentaires: txt(x.bilan?.commentaires),
    },
  }
}

/**
 * Compte rendu détaillé d'une ligne rapports_session : la colonne dédiée, ou
 * son repli dans commentaires_apprenants tant que la migration 162 manque.
 */
export function compteRenduStocke(r: any): CompteRendu | null {
  return normaliserCompteRendu(r?.compte_rendu) || normaliserCompteRendu(r?.commentaires_apprenants?.compte_rendu)
}

/**
 * Reprend un compte rendu enregistré en l'alignant sur la session : les
 * demi-journées, objectifs et stagiaires de référence sont ceux d'aujourd'hui,
 * ce qui avait déjà été écrit pour eux est conservé. Une demi-journée hors de
 * la session n'est pas reprise ; un objectif ajouté par le formateur l'est.
 */
export function fusionnerCompteRendu(enregistre: Partial<CompteRendu> | null | undefined, vierge: CompteRendu): CompteRendu {
  const e = normaliserCompteRendu(enregistre ? { version: 1, ...enregistre } : null)
  if (!e) return vierge
  const cle = (d: { date: string; creneau: string }) => `${d.date}|${d.creneau}`
  const deroule = vierge.deroule.map((d) => e.deroule.find((x) => cle(x) === cle(d)) || d)
  const objectifs = vierge.objectifs.map((o) => e.objectifs.find((x) => x.objectif === o.objectif) || o)
  for (const x of e.objectifs) {
    if (objectifs.some((o) => o.objectif === x.objectif)) continue
    // Ajouté par le formateur, ou retiré de la fiche mais déjà évalué
    if (x.perso || x.niveau || x.commentaire.trim()) objectifs.push({ ...x, perso: true })
  }
  const stagiaires = vierge.stagiaires.map((s) => {
    const x = e.stagiaires.find((y) => y.apprenant_id === s.apprenant_id)
    return x ? { ...x, nom: s.nom, ...(s.retire ? { retire: true } : { retire: undefined }) } : s
  })
  return {
    version: 1,
    deroule, objectifs, stagiaires,
    groupe: e.groupe, evaluation: e.evaluation, conditions: e.conditions, bilan: e.bilan,
  }
}

/** Ce qui manque pour transmettre : le compte rendu doit décrire toute la session. */
export function manquesCompteRendu(cr: CompteRendu): string[] {
  const manques: string[] = []
  const animees = cr.deroule.filter((d) => !d.statut)
  const vides = animees.filter((d) => d.contenu.trim().length < 10)
  if (vides.length) manques.push(`le contenu de ${vides.length} demi-journée${vides.length > 1 ? 's' : ''}`)
  const sansMethode = animees.filter((d) => !d.methodes.length)
  if (sansMethode.length) manques.push(`les méthodes de ${sansMethode.length} demi-journée${sansMethode.length > 1 ? 's' : ''}`)
  const objectifs = cr.objectifs.filter((o) => !o.niveau)
  if (objectifs.length) manques.push(`l’atteinte de ${objectifs.length} objectif${objectifs.length > 1 ? 's' : ''}`)
  if (!cr.groupe.niveau) manques.push('le niveau du groupe')
  if (!cr.groupe.participation) manques.push('la participation')
  if (!cr.evaluation.modalites.length) manques.push('les modalités d’évaluation')
  const stagiaires = cr.stagiaires.filter((s) => !s.acquis && !s.retire)
  if (stagiaires.length) manques.push(`les acquis de ${stagiaires.length} stagiaire${stagiaires.length > 1 ? 's' : ''}`)
  if (!cr.conditions.salle) manques.push('les conditions matérielles')
  return manques
}

const jour = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
export const libelleDemiJournee = (d: { date: string; creneau: Creneau }) => `${jour(d.date)}, ${LIBELLES_CRENEAU[d.creneau].toLowerCase()}`

/** Synthèse en texte pour les anciennes colonnes du rapport. */
export function syntheseTexte(cr: CompteRendu) {
  const lignes = (l: (string | false | null | undefined)[]) => l.filter(Boolean).join('\n') || null
  return {
    contenu_aborde: lignes(cr.deroule.map((d) => d.statut
      ? `${libelleDemiJournee(d)} : ${LIBELLES_STATUT_DEMI_JOURNEE[d.statut].toLowerCase()}`
      : d.contenu.trim() && `${libelleDemiJournee(d)} : ${d.contenu.trim()}${d.methodes.length ? ` (${d.methodes.join(', ')})` : ''}`)),
    objectifs_atteints: lignes(cr.objectifs.filter((o) => o.niveau === 'atteint' || o.niveau === 'partiel')
      .map((o) => `${o.objectif}${o.niveau === 'partiel' ? ' (partiellement)' : ''}${o.commentaire ? ` : ${o.commentaire}` : ''}`)),
    objectifs_non_atteints: lignes(cr.objectifs.filter((o) => o.niveau === 'non_atteint')
      .map((o) => `${o.objectif}${o.commentaire ? ` : ${o.commentaire}` : ''}`)),
    difficultes_rencontrees: cr.conditions.difficultes.trim() || null,
    points_positifs: cr.bilan.points_positifs.trim() || null,
    recommandations: lignes([cr.bilan.recommandations.trim(), cr.bilan.besoins_detectes.trim() && `Besoins détectés : ${cr.bilan.besoins_detectes.trim()}`]),
    commentaires_generaux: lignes([
      cr.groupe.niveau && `Groupe : niveau ${cr.groupe.niveau.toLowerCase()}, participation ${cr.groupe.participation.toLowerCase()}.`,
      cr.groupe.dynamique.trim() && `Dynamique : ${cr.groupe.dynamique.trim()}`,
      cr.groupe.assiduite.trim() && `Assiduité : ${cr.groupe.assiduite.trim()}`,
      cr.evaluation.modalites.length > 0 && `Évaluation : ${cr.evaluation.modalites.join(', ')}.${cr.evaluation.synthese.trim() ? ` ${cr.evaluation.synthese.trim()}` : ''}`,
      cr.conditions.salle && `Salle et équipements : ${cr.conditions.salle.toLowerCase()}.${cr.conditions.commentaire.trim() ? ` ${cr.conditions.commentaire.trim()}` : ''}`,
      cr.bilan.retours_stagiaires.trim() && `Retours des stagiaires : ${cr.bilan.retours_stagiaires.trim()}`,
      cr.bilan.commentaires.trim(),
    ]),
    commentaires_apprenants: cr.stagiaires.map((s) => ({ apprenant_id: s.apprenant_id, nom: s.nom, acquis: s.acquis || null, commentaire: s.commentaire.trim() || null })),
  }
}
