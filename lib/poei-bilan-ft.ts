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
    repriseFin: saisie('repriseFin'),
    repriseFinDurable: saisie('repriseFinDurable'),
    repriseFinDate: dateFr(saisie('repriseFinDate')),
    // La date d'embauche prévue de la fiche candidat est bien une date prévisionnelle
    reprisePrevue: dateFr(saisie('reprisePrevue') || (abandon ? '' : c?.date_embauche_prevue)),
    avisStagiaire: saisie('avisStagiaire'),
    avisCentre: saisie('avisCentre') || avisCentreParDefaut(grille?.avis_final, grille?.motivation_avis),
  }
}
