/**
 * Bilan de fin de formation France Travail, demandé à l'appui de la facture
 * sur Chorus Pro. Mêmes rubriques, dans le même ordre, que le formulaire de
 * France Travail ; il est imprimé à la suite de notre bilan final de POEI.
 *
 * Tout ce que le CRM connaît est repris tel quel (heures et dates : celles du
 * certificat de réalisation). Ce qu'il ne connaît pas (niveau de qualification,
 * reprise d'emploi constatée, avis du stagiaire) se saisit dans le bilan final
 * du candidat ; à défaut la case reste vide, à compléter à la main : rien
 * n'est déduit ni supposé.
 */

/** Réponses saisies, rangées avec les appréciations de la grille finale (clés préfixées « ft_ »). */
export const CHAMPS_BILAN_FT = {
  referent: 'ft_referent',
  niveau: 'ft_niveau',
  repriseCours: 'ft_reprise_cours',
  repriseCoursDurable: 'ft_reprise_cours_durable',
  repriseCoursDate: 'ft_reprise_cours_date',
  repriseFin: 'ft_reprise_fin',
  repriseFinDurable: 'ft_reprise_fin_durable',
  repriseFinDate: 'ft_reprise_fin_date',
  reprisePrevue: 'ft_reprise_prevue',
  avisStagiaire: 'ft_avis_stagiaire',
  avisCentre: 'ft_avis_centre',
} as const

export interface BilanFt {
  organisme: string
  referent: string
  intitule: string
  nom: string
  prenom: string
  identifiant: string
  debutPrevue: string
  debutReelle: string
  finPrevue: string
  finReelle: string
  heuresPrevues: string
  heuresReelles: string
  metier: string
  niveau: string
  certifiante: string
  acheve: string
  motifSortie: string
  dernierJour: string
  repriseCours: string
  repriseCoursDurable: string
  repriseCoursDate: string
  repriseFin: string
  repriseFinDurable: string
  repriseFinDate: string
  reprisePrevue: string
  avisStagiaire: string
  avisCentre: string
}

const dateFr = (d?: string | null) => {
  if (!d) return ''
  const date = new Date(String(d).slice(0, 10) + 'T12:00:00')
  return isNaN(date.getTime()) ? String(d) : date.toLocaleDateString('fr-FR')
}
const heures = (n?: number | null) =>
  n != null && n > 0 ? `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h` : ''
const texte = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Lendemain d'une date AAAA-MM-JJ. */
const lendemain = (d?: string | null): string | null => {
  if (!d) return null
  const date = new Date(String(d).slice(0, 10) + 'T12:00:00')
  if (isNaN(date.getTime())) return null
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Date d'embauche d'un candidat : celle de sa fiche, sinon le lendemain de la
 * fin de sa POEI (l'embauche suit la formation).
 */
export function dateEmbauche(candidat: any, poei: any): string | null {
  return candidat?.date_embauche_prevue || lendemain(candidat?.date_fin || poei?.date_fin) || null
}

/** Un CDI est un contrat durable ; pour un CDD la durée n'est pas connue du CRM. */
const contratDurable = (type?: string | null): string => (/cdi/i.test(String(type || '')) ? 'Oui' : '')

/** Avis du centre repris par défaut : l'avis final du formateur et sa motivation. */
export function avisCentreParDefaut(avisFinal?: string | null, motivation?: string | null): string {
  const avis = texte(avisFinal)
  const avisLisible = avis ? avis.charAt(0) + avis.slice(1).toLowerCase() : ''
  return [avisLisible, texte(motivation)].filter(Boolean).join('. ')
}

export function construireBilanFt(src: {
  org: any
  poei: any
  formation?: any
  candidat?: any
  apprenant?: any
  /** Formateur référent de la grille finale */
  formateurNom?: string | null
  /** Heures du certificat de réalisation */
  heuresReelles?: number | null
  heuresPrevues?: number | null
  /** Grille finale : appréciations (réponses « ft_ »), avis final, motivation */
  grille?: any
  /** Date du jour (AAAA-MM-JJ), pour savoir si le parcours est terminé */
  aujourdhui: string
}): BilanFt {
  const { org, poei, candidat: c, apprenant, grille } = src
  const formation = src.formation || poei?.formation || {}
  const saisie = (cle: keyof typeof CHAMPS_BILAN_FT) => texte(grille?.appreciations?.[CHAMPS_BILAN_FT[cle]])

  const abandon = c?.statut === 'abandonne'
  // L'embauche n'est portée au bilan que si le candidat est à l'état « Embauché »
  const embauche = c?.statut === 'embauche'
  const nonRetenu = c?.statut === 'non_retenu'
  const debut = c?.date_debut || poei?.date_debut || null
  const finPrevue = c?.date_fin || poei?.date_fin || null
  const finReelle = abandon ? (c?.date_abandon || null) : finPrevue
  const termine = !!finReelle && String(finReelle).slice(0, 10) <= src.aujourdhui

  return {
    organisme: texte(org?.legal_name) || texte(org?.name),
    referent: saisie('referent') || texte(src.formateurNom)
      || [org?.representant_legal_prenom, org?.representant_legal_nom].filter(Boolean).join(' '),
    intitule: texte(formation?.intitule),
    nom: String(apprenant?.nom || '').toUpperCase(),
    prenom: texte(apprenant?.prenom),
    identifiant: texte(c?.identifiant_ft),
    debutPrevue: dateFr(debut),
    debutReelle: dateFr(debut),
    finPrevue: dateFr(finPrevue),
    finReelle: termine || abandon ? dateFr(finReelle) : '',
    heuresPrevues: heures(src.heuresPrevues),
    heuresReelles: termine || abandon ? heures(src.heuresReelles) : '',
    metier: texte(c?.poste_vise) || texte(poei?.poste_vise) || texte(formation?.intitule),
    niveau: saisie('niveau'),
    certifiante: formation?.est_certifiante === true ? 'Oui' : formation?.est_certifiante === false ? 'Non' : '',
    acheve: abandon ? 'Non' : termine ? 'Oui' : '',
    motifSortie: abandon ? texte(c?.motif_abandon) : '',
    dernierJour: termine || abandon ? dateFr(finReelle) : '',
    repriseCours: saisie('repriseCours'),
    repriseCoursDurable: saisie('repriseCoursDurable'),
    repriseCoursDate: dateFr(saisie('repriseCoursDate')),
    repriseFin: saisie('repriseFin') || (embauche ? 'Oui' : nonRetenu ? 'Non' : ''),
    repriseFinDurable: saisie('repriseFinDurable') || (embauche ? contratDurable(c?.type_contrat) : ''),
    repriseFinDate: dateFr(saisie('repriseFinDate') || (embauche ? dateEmbauche(c, poei) : '')),
    // Tant que l'embauche n'est pas constatée, la date de la fiche candidat est prévisionnelle
    reprisePrevue: dateFr(saisie('reprisePrevue') || (abandon || embauche || nonRetenu ? '' : c?.date_embauche_prevue)),
    avisStagiaire: saisie('avisStagiaire'),
    avisCentre: saisie('avisCentre') || avisCentreParDefaut(grille?.avis_final, grille?.motivation_avis),
  }
}

// ── Signature du bilan par le stagiaire ──
//
// Le stagiaire signe CE bilan, par un lien personnel, après l'avoir relu et y
// avoir donné son avis. La signature de son certificat de réalisation n'y est
// jamais reportée : elle a été donnée pour un autre document.
// Tout est rangé avec le bilan (clés « ft_sig_ »), écrit par le serveur seul.

export const SIGNATURE_BILAN = {
  jeton: 'ft_sig_jeton',
  expire: 'ft_sig_expire',
  envoyeLe: 'ft_sig_envoye_le',
  data: 'ft_sig_data',
  nom: 'ft_sig_nom',
  /** Horodatage réel de la signature */
  signeLe: 'ft_sig_le',
  ip: 'ft_sig_ip',
  agent: 'ft_sig_agent',
} as const

const PREFIXE_SIGNATURE = 'ft_sig_'

/** Signature du stagiaire sur son bilan, si elle a été donnée. */
export function signatureBilan(appreciations: Record<string, any> | null | undefined): { data: string; nom: string; date: string } | null {
  const a = appreciations || {}
  const data = texte(a[SIGNATURE_BILAN.data]), date = texte(a[SIGNATURE_BILAN.signeLe])
  return data && date ? { data, nom: texte(a[SIGNATURE_BILAN.nom]), date } : null
}

/**
 * Appréciations à enregistrer quand un formulaire sauvegarde la grille : les
 * clés de signature viennent toujours de la base, jamais du formulaire, et
 * l'avis du stagiaire ne change plus une fois le bilan signé.
 */
export function fusionnerAppreciations(
  existantes: Record<string, any> | null | undefined,
  recues: Record<string, any> | null | undefined,
): Record<string, any> {
  const base = existantes || {}
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(recues || {})) if (!k.startsWith(PREFIXE_SIGNATURE)) out[k] = v
  for (const [k, v] of Object.entries(base)) if (k.startsWith(PREFIXE_SIGNATURE)) out[k] = v
  if (texte(base[SIGNATURE_BILAN.signeLe])) out[CHAMPS_BILAN_FT.avisStagiaire] = base[CHAMPS_BILAN_FT.avisStagiaire] ?? ''
  return out
}

/** Appréciations envoyées au navigateur : sans le tracé, le jeton ni les traces techniques. */
export function appreciationsPourClient(appreciations: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = { ...(appreciations || {}) }
  for (const k of [SIGNATURE_BILAN.data, SIGNATURE_BILAN.jeton, SIGNATURE_BILAN.ip, SIGNATURE_BILAN.agent]) delete out[k]
  return out
}

/** Les rubriques du bilan, dans l'ordre du formulaire, pour la page de signature. */
export function lignesBilanFt(b: BilanFt): { libelle: string; valeur: string }[] {
  return [
    { libelle: 'Organisme de formation', valeur: b.organisme },
    { libelle: 'Référent de l’organisme', valeur: b.referent },
    { libelle: 'Formation', valeur: b.intitule },
    { libelle: 'Demandeur d’emploi', valeur: `${b.prenom} ${b.nom}`.trim() },
    { libelle: 'N° identifiant France Travail', valeur: b.identifiant },
    { libelle: 'Début de la formation (prévu / réel)', valeur: [b.debutPrevue, b.debutReelle].filter(Boolean).join(' / ') },
    { libelle: 'Fin de la formation (prévue / réelle)', valeur: [b.finPrevue, b.finReelle].filter(Boolean).join(' / ') },
    { libelle: 'Heures de formation (prévues / réelles)', valeur: [b.heuresPrevues, b.heuresReelles].filter(Boolean).join(' / ') },
    { libelle: 'Métier visé', valeur: b.metier },
    { libelle: 'Niveau de qualification atteint', valeur: b.niveau },
    { libelle: 'Formation certifiante', valeur: b.certifiante },
    { libelle: 'A achevé la formation', valeur: b.acheve },
    { libelle: 'Motif de sortie anticipée', valeur: b.motifSortie },
    { libelle: 'Dernier jour de formation', valeur: b.dernierJour },
    { libelle: 'Reprise d’emploi en cours de formation', valeur: [b.repriseCours, b.repriseCoursDurable && `contrat durable : ${b.repriseCoursDurable}`, b.repriseCoursDate].filter(Boolean).join(' · ') },
    { libelle: 'Reprise d’emploi dès la fin de formation', valeur: [b.repriseFin, b.repriseFinDurable && `contrat durable : ${b.repriseFinDurable}`, b.repriseFinDate].filter(Boolean).join(' · ') },
    { libelle: 'Reprise d’emploi prévue le', valeur: b.reprisePrevue },
    { libelle: 'Avis du centre de formation', valeur: b.avisCentre },
  ].filter((l) => l.valeur)
}
