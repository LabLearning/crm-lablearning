/**
 * Rapports d'incident et d'abandon d'un dossier POEI, transmis à France
 * Travail (gabarits dans lib/pdf/rapport-france-travail-pdf.tsx).
 *
 * Ce module ne contient que des fonctions pures : il s'importe aussi bien de
 * l'écran (libellés, relecture avant envoi) que des routes PDF.
 *
 * Règle de fond : un rapport ne dit que ce qui est consigné dans le CRM. Il
 * sort d'un texte libre écrit par un formateur ou un gestionnaire, et part
 * chez un tiers : `mentionsSensibles` sert à le relire avant l'envoi.
 */

export const TYPES_INCIDENT: Array<{ value: string; label: string }> = [
  { value: 'comportement', label: 'Comportement' },
  { value: 'absence', label: 'Absence ou retard répété' },
  { value: 'accident', label: 'Accident' },
  { value: 'materiel', label: 'Matériel' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'hygiene', label: 'Hygiène' },
  { value: 'organisation', label: 'Organisation' },
  { value: 'autre', label: 'Autre' },
]

export const GRAVITES_INCIDENT: Array<{ value: string; label: string }> = [
  { value: 'mineur', label: 'Mineur' },
  { value: 'modere', label: 'Modéré' },
  { value: 'majeur', label: 'Majeur' },
  { value: 'critique', label: 'Critique' },
]

export const STATUTS_INCIDENT: Record<string, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours de traitement',
  resolu: 'Résolu',
  clos: 'Clos',
}

export const libelleTypeIncident = (type: string | null | undefined) =>
  TYPES_INCIDENT.find((t) => t.value === type)?.label || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Autre')

export const libelleGraviteIncident = (gravite: string | null | undefined) =>
  GRAVITES_INCIDENT.find((g) => g.value === gravite)?.label || 'Non précisée'

/**
 * Qui traite les incidents d'un dossier POEI : fait avancer le statut, corrige
 * le texte et en tire le rapport. Celui qui produit un rapport doit pouvoir
 * corriger ce que la relecture lui signale : les deux droits vont ensemble.
 */
export const ROLES_INCIDENTS_POEI: string[] = ['super_admin', 'gestionnaire', 'directeur_commercial']

/** Qui produit le rapport d'abandon : l'équipe qui gère les candidats, donc qui peut en corriger le motif. */
export const ROLES_RAPPORT_ABANDON: string[] = ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial']

/**
 * Référence du rapport : stable d'un téléchargement à l'autre (elle se déduit
 * de l'enregistrement), pour que France Travail et l'organisme parlent du même
 * document. « RI-2026-9F3A2C » pour un incident, « RA-… » pour un abandon.
 */
export function referenceRapport(prefixe: 'RI' | 'RA', id: string, date?: string | null): string {
  const annee = /^\d{4}/.test(String(date || '')) ? String(date).slice(0, 4) : String(new Date().getFullYear())
  return `${prefixe}-${annee}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

// ─── Relecture avant envoi ──────────────────────────────────────────────────

export type CategorieSensible = 'santé' | 'justice' | 'convictions' | 'vie privée'

export interface MentionSensible {
  /** Le mot tel qu'il est écrit dans le texte */
  terme: string
  categorie: CategorieSensible
}

/*
 * Les listes ci-dessous sont écrites sans accents ni majuscules, apostrophes
 * et traits d'union remplacés par une espace : c'est la forme dans laquelle le
 * texte est cherché (voir `miseANu`).
 *
 *   « depressi »      début de mot : dépression, dépressif, dépressive
 *   « avc$ »          mot entier : « AVC », pas « avciste »
 *   « garde a vue »   plusieurs mots : retours à la ligne, traits d'union et
 *                     espaces multiples entre eux sont tolérés
 *
 * Un mot du métier qui ressemble à un mot sensible (« religieuse » en
 * pâtisserie, « diagnostic de positionnement », « vente d'alcool ») ne doit pas
 * déclencher : trop d'alertes à tort, et plus personne ne les lit. Toute
 * retouche se vérifie sur un jeu de phrases, sensibles et anodines.
 */
const RADICAUX: Array<[CategorieSensible, string[]]> = [
  // « santé » seul n'y figure pas : « pour raisons de santé » est justement la formule à garder.
  ['santé', [
    // soins
    'medical', 'medicaux', 'medecin', 'medicament', 'docteur', 'hospitalis', 'hospitalier', 'hospitaliere', 'hopital',
    'hopitaux', 'urgences', 'clinique', 'chirurgi', 'infirmi', 'therap', 'kine$', 'kinesi', 'cardiolog', 'convalescen',
    'reeducation', 're education', 'sous traitement', 'traitement lourd', 'se soign', 'faire soigner', 'en soins$', 'soins palliatifs',
    'soins intensifs', 'patholog', 'diagnosti',
    // opérations : « opération » seul désignerait aussi bien une opération commerciale
    'opere$', 'operee$', 'operes$', 'operees$', 'operer$', 'operation chirurg', 'son operation$', 'une operation$',
    'operatoire',
    // maladies
    'maladie', 'malade', 'cancer', 'tumeur', 'chimio', 'diabet', 'epilep', 'asthm', 'allergi', 'endometriose',
    'migraine', 'vertige', 'vih$', 'sida$', 'seroposit', 'sero posit', 'cardiaque', 'infarctus', 'avc$', 'hernie', 'sciatique',
    'lombalgie', 'lumbago', 'tendinite', 'douleur', 'souffre de', 'souffre du', 'souffre d un', 'souffrant',
    'positif au covid', 'positive au covid', 'a le covid', 'eu le covid', 'attrape le covid', 'cas contact',
    // accidents : « blessant » et « a brûlé le plat » ne sont pas des blessures
    'blessure', 'blesse$', 'blessee$', 'blesses$', 'blessees$', 'blesser$', 'brulure', 's est brule', 's etre brule',
    's est coupe', 'suture', 'entaille', 'fracture', 'entorse', 'luxation',
    'fait un malaise', 'faire un malaise', 'eu un malaise', 'd un malaise', 'malaise vagal', 'malaise cardiaque',
    // grossesse
    'grossesse', 'enceinte', 'attend un enfant', 'attend un bebe', 'conge maternite', 'conge de maternite', 'accouch',
    'fausse couche', 'ivg$',
    // santé mentale
    'sante mentale', 'depressi', 'deprime', 'anxie', 'anxiolyt', 'angoiss', 'burn out', 'burnout', 'suicid',
    'antidepress', 'anti depress', 'somnifer', 'bipolaire', 'schizo', 'psy$', 'psychi', 'psycho', 'tdah$', 'autis', 'dyslexi',
    'dyspraxi', 'dyscalcul', 'troubles du comportement',
    // handicap
    'handicap', 'rqth$', 'mdph$', 'aah$', 'invalidite', 'inapt', 'sourd$', 'sourde$', 'malentendant', 'mal entendant', 'malvoyant', 'mal voyant', 'non voyant',
    'aveugle',
    // addictions : « droguerie » et « vente d'alcool » restent des mots du métier
    'addict', 'alcool', 'ebriete', 'ivre$', 'ivresse', 'avait bu$', 'avoir bu$', 'ayant bu$', 'a bu avant',
    'drogue$', 'drogues$', 'droguee$', 'droguees$', 'se drogu', 'stupefiant', 'cannabis', 'cocaine', 'toxico',
    'desintox', 'sevrage',
  ]],
  // « plainte », « juge », « condamné » et « judiciaire » seuls signaleraient « elle s'est plainte de… », « il juge
  // que… », « a condamné la porte » et « redressement judiciaire » : seules les tournures judiciaires sont cherchées.
  ['justice', [
    'casier judiciaire', 'extrait de casier', 'controle judiciaire', 'suivi judiciaire', 'antecedent judiciaire',
    'antecedents judiciaires', 'garde a vue', 'condamnation', 'condamne a', 'condamnee a', 'condamne pour',
    'condamnee pour', 'condamne par', 'condamnee par', 'ete condamne', 'deja condamne',
    'prison', 'emprisonn', 'incarcer', 'detention', 'detenu', 'tribunal', 'tribunaux', 'sursis', 'spip$',
    'bracelet electronique',
    'mis en examen', 'mise en examen', 'travaux d interet general', 'liberte conditionnelle', 'semi liberte',
    'porte plainte', 'porter plainte', 'portera plainte', 'depot de plainte', 'depose plainte', 'deposer plainte',
    'depose une plainte', 'deposer une plainte', 'plainte a ete depose', 'plainte contre', 'plainte depose',
    // « main courante » seul est aussi le registre d'un hôtel
    'main courante a ete depose', 'main courante depose', 'une main courante', 'depot de main courante',
    'gendarme', 'commissariat', 'police', 'policier', 'policiere', 'forces de l ordre', 'arrestation', 'perquisition',
    'interpellation', 'interpelle par', 'interpellee par', 'interpelle pour', 'interpellee pour',
    'par le juge$', 'devant le juge$', 'chez le juge$', 'du juge$', 'un juge$', 'juge d application', 'juge des enfants',
    'juge aux affaires', 'proces$',
  ]],
  // « religieuse » seul est aussi une pâtisserie, « le jeune » un stagiaire : le contexte est demandé.
  ['convictions', [
    'religion', 'religieux', 'pratique religieuse', 'fete religieuse', 'fetes religieuses', 'conviction religieuse',
    'convictions religieuses', 'raison religieuse', 'raisons religieuses', 'tenue religieuse', 'ramadan', 'careme',
    'prier', 'il jeune$', 'elle jeune$', 'jeuner$', 'jeunait$', 'periode de jeune$', 'l aid$', 'aid el', 'aid al',
    'mosquee', 'eglise', 'synagogue', 'messe$', 'shabbat', 'sabbat$', 'kippour', 'musulman', 'chretien', 'catholique',
    'juif$', 'juive$', 'juifs$', 'bouddhis', 'evangeli', 'temoin de jehovah', 'temoins de jehovah',
    'le voile$', 'son voile$', 'voilee$', 'son foulard$', 'le foulard$', 'foulard islamique', 'hijab', 'kippa',
    'niqab', 'burqa',
    'syndicat', 'syndical', 'syndicaux', 'syndique$', 'syndiquee$', 'cgt$', 'cfdt$', 'cftc$', 'greviste',
    'opinion politique', 'opinions politiques', 'convictions politiques', 'parti politique', 'militant',
    'orientation sexuelle', 'homosex', 'bisexuel', 'gay$', 'lesbien', 'transgenre', 'transidentit',
  ]],
  // Ce qui touche au foyer, au logement, au séjour : la cause la plus fréquente d'un abandon, et celle où
  // « pour raisons personnelles » suffit. Les difficultés de garde ou de transport, elles, se disent.
  ['vie privée', [
    'deces$', 'decede', 'deuil', 'obseques', 'enterrement', 'funerailles',
    'divorc', 'sa separation$', 'instance de separation', 'perdu la garde', 'droit de garde', 'mere celibataire',
    'pere celibataire', 'violences conjugales', 'violence conjugale', 'violences familiales', 'victime de violence',
    // « expulsé du cours » est un fait de formation, pas une affaire de logement
    'expulsion locative', 'expulsion de son logement', 'menace d expulsion', 'son expulsion$', 'expulse de son',
    'expulsee de son', 'sans domicile', 'sdf$', 'dort dans sa voiture', 'dort dans la rue',
    'a la rue$', 'hebergement d urgence',
    'titre de sejour', 'sans papiers', 'situation irreguliere', 'oqtf$', 'demandeur d asile', 'demandeuse d asile',
    'demande d asile', 'refugie',
    'ses origines', 'origine ethnique', 'couleur de peau',
    'surendettement', 'sur endettement', 'interdit bancaire', 'huissier',
  ]],
]

/*
 * Formules à laisser passer, retirées du texte avant la recherche.
 * D'une part les formules administratives, qui ne disent rien du détail :
 * « arrêt maladie » en dit autant que « pour raisons de santé », et France
 * Travail doit connaître les absences pour maladie. D'autre part le
 * vocabulaire du métier et de la vie d'une entreprise.
 */
const FORMULES_NEUTRES: string[] = [
  'arret maladie', 'arrets maladie', 'arret de travail', 'arrets de travail', 'conge maladie', 'conges maladie',
  'conge de maladie', 'conges de maladie', 'pour maladie$', 'rendez vous medical', 'rendez vous medicaux', 'rdv medical',
  'rdv medicaux',
  'raison medicale', 'raisons medicales', 'motif medical', 'motifs medicaux', 'certificat medical',
  'certificats medicaux', 'justificatif medical', 'visite medicale', 'visites medicales', 'medecine du travail',
  'diagnostic de positionnement', 'diagnostics de positionnement', 'diagnostic des besoins',
  'diagnostic de competences', 'diagnostic des competences', 'diagnostic prealable', 'diagnostic initial',
  'redressement judiciaire', 'liquidation judiciaire', 'mandataire judiciaire', 'administrateur judiciaire',
  'tribunal de commerce', 'tribunal des activites economiques', 'proces verbal', 'proces verbaux',
  'police d assurance', 'polices d assurance',
  'vente d alcool', 'vente de boissons alcoolisees', 'vente des boissons alcoolisees', 'service de boissons alcoolisees',
  'service des boissons alcoolisees', 'carte des boissons alcoolisees', 'boisson sans alcool', 'boissons sans alcool',
  'cocktail sans alcool', 'cocktails sans alcool', 'biere sans alcool', 'bieres sans alcool', 'et sans alcool',
  'ou sans alcool', 'alcool a bruler',
  'alcool menager', 'operation commerciale', 'operation promotionnelle', 'operation de communication',
  'une operation de nettoyage', 'harcelement psychologique', 'pression psychologique',
  // tournures de la formation, pas du logement ni de la santé
  'expulsion du cours', 'expulsion de la formation', 'expulsion de l atelier', 'expulsion de la salle',
  'expulsion du groupe', 'sourde oreille', 'sourd aux remarques', 'sourde aux remarques', 'sourd aux consignes',
  'sourde aux consignes',
  // l'enceinte d'un établissement, une enceinte de sonorisation
  'l enceinte', 'une enceinte', 'enceintes$', 'enceinte bluetooth', 'enceinte connectee',
  // l'enceinte froide des relevés de températures : « chaque enceinte », « enceinte réfrigérée », « porte d'enceinte »
  'chaque enceinte', 'cette enceinte', 'd enceinte', 'enceinte froide', 'enceinte refrigeree', 'enceinte frigorifique',
  'enceinte positive', 'enceinte negative',
]

const DIACRITIQUES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g')
// Apostrophes et traits d'union qui tiennent deux mots ensemble : « garde-à-vue », « l’hôpital »
const LIAISONS = new Set(["'", '-', ...[0x2019, 0x2018, 0x2bc, 0x2010, 0x2011, 0xb4, 0x60, 0x2032, 0x201b, 0xff07].map((code) => String.fromCharCode(code))])
// Caractères sans chasse qu'un copier-coller glisse dans les mots : trait d'union conditionnel, espaces sans chasse
const INVISIBLES = new RegExp(`[${String.fromCharCode(0xad)}${String.fromCharCode(0x200b)}-${String.fromCharCode(0x200d)}${String.fromCharCode(0x2060)}]`, 'g')
// Ligatures d'imprimerie d'un texte collé d'un PDF : elles redeviennent leurs lettres
const LIGATURES = new RegExp(`[${String.fromCharCode(0xfb00)}-${String.fromCharCode(0xfb06)}]`, 'g')

/**
 * Le texte sans accents ni majuscules, caractère pour caractère : la copie a
 * la longueur de l'original, une position trouvée dans l'une se lit dans
 * l'autre. Blancs, retours à la ligne, apostrophes et traits d'union
 * deviennent une espace ; un accent isolé, sans lettre à laquelle se fondre,
 * devient un point médian au lieu de faire perdre le fil.
 */
function miseANu(texte: string): string {
  let nu = ''
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    const code = texte.charCodeAt(i)
    if (LIAISONS.has(c) || /\s/.test(c)) { nu += ' '; continue }
    if (code < 128) { nu += c.toLowerCase(); continue }
    const base = c.normalize('NFD').replace(DIACRITIQUES, '').toLowerCase()
    nu += base.length >= 1 ? base[0] : '·'
  }
  return nu
}

type Motif = { regex: RegExp }
type MotifCategorie = Motif & { categorie: CategorieSensible }

function compiler(radical: string): RegExp {
  const entier = radical.endsWith('$')
  const mots = (entier ? radical.slice(0, -1) : radical).trim().split(/ +/)
  const corps = mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(' +')
  // Début de mot exigé (« opéré » oui, « coopéré » non) ; sans « $ », le mot se prolonge jusqu'à sa fin.
  return new RegExp(`(^|[^a-z0-9])(${corps}${entier ? '' : '[a-z0-9]*'})(?![a-z0-9])`, 'g')
}

// Formules dont seul le second groupe est retiré : le premier reste lisible pour les tournures sensibles
const NEUTRES_PARTIELLES: RegExp[] = [
  // « violences psychologiques » : seul l'adjectif est retiré, « victime de violences » reste lisible
  /((?:^|[^a-z0-9])violences? +)(psychologiques?)(?![a-z0-9])/g,
  // « Prière de contacter… », « Prière de bien vouloir… », « Prière d'en informer… » : la formule se reconnaît à
  // l'infinitif qui la suit ; « la prière de midi », « sa prière de 14 h » restent signalées
  /(^|[^a-z0-9])(priere +de? +(?:ne +(?:pas|plus|rien|jamais) +)?(?:bien +)?(?:(?:vous|nous|se|me|le|la|les|lui|leur|en|y|m|s|l) +){0,2}(?:[a-z]+(?:er|ir|dre|ire|vre)|[a-z]*(?:mettre|aitre|clure)|etre))(?![a-z0-9])/g,
  // « Enceinte 3 », « enceinte n° 2 » : une enceinte froide numérotée, sauf « enceinte 6 mois »
  /(^|[^a-z0-9])(enceinte +(?:n[^a-z0-9]*)?[0-9]+)(?! *(?:mois|semaines?)(?![a-z0-9]))(?![a-z0-9])/g,
]

let motifs: { neutres: Motif[]; sensibles: MotifCategorie[] } | null = null
function lesMotifs() {
  if (!motifs) {
    motifs = {
      neutres: [...FORMULES_NEUTRES.map((r) => ({ regex: compiler(r) })), ...NEUTRES_PARTIELLES.map((regex) => ({ regex }))],
      sensibles: RADICAUX.flatMap(([categorie, radicaux]) => radicaux.map((r) => ({ categorie, regex: compiler(r) }))),
    }
  }
  return motifs
}

/**
 * Mots d'un texte qui touchent à la santé, à la justice, aux convictions ou à
 * la vie privée de la personne : des informations que France Travail n'a pas à
 * recevoir dans un rapport. C'est une aide à la relecture, pas un filtre : la
 * liste peut signaler un mot anodin ou en manquer un, la relecture du texte
 * reste celle du gestionnaire.
 */
export function mentionsSensibles(...textes: Array<string | null | undefined>): MentionSensible[] {
  const { neutres, sensibles } = lesMotifs()
  const trouvees: MentionSensible[] = []
  const vus = new Set<string>()

  for (const brut of textes) {
    if (!brut) continue
    // Forme composée : chaque lettre accentuée tient en un caractère
    // Invisibles ôtés et ligatures défaites, puis forme composée ; un accent resté seul (doublé, sans lettre) est ôté
    const texte = brut.replace(INVISIBLES, '').replace(LIGATURES, (l) => l.normalize('NFKD')).normalize('NFC').replace(DIACRITIQUES, '')
    let nu = miseANu(texte)

    for (const { regex } of neutres) {
      nu = nu.replace(regex, (tout: string, avant: string, formule: string) => avant + '#'.repeat(formule.length))
    }

    const portees: Array<{ debut: number; fin: number; categorie: CategorieSensible }> = []
    for (const { regex, categorie } of sensibles) {
      for (const m of nu.matchAll(regex)) {
        const debut = (m.index ?? 0) + m[1].length
        portees.push({ debut, fin: debut + m[2].length, categorie })
      }
    }
    portees.sort((a, b) => a.debut - b.debut || b.fin - a.fin)

    const finPrecedente: Partial<Record<CategorieSensible, number>> = {}
    // Triées par début croissant puis fin décroissante : seule une portée déjà passée peut en contenir une autre
    let finAvant = -1 // plus grande fin parmi les portées qui commencent strictement avant
    let finVue = -1 // plus grande fin rencontrée
    let debutCourant = -1
    let finDuGroupe = -1 // fin de la plus longue portée qui commence au même endroit
    for (const p of portees) {
      if (p.debut !== debutCourant) { finAvant = finVue; debutCourant = p.debut; finDuGroupe = p.fin }
      if (p.fin > finVue) finVue = p.fin
      // Le plus long dit tout
      const contenue = finAvant >= p.fin || finDuGroupe > p.fin
      if (contenue) continue
      // « par le juge » et « juge d'application » se chevauchent : le premier suffit
      if ((finPrecedente[p.categorie] ?? -1) > p.debut) continue
      finPrecedente[p.categorie] = p.fin
      const terme = texte.slice(p.debut, p.fin).replace(/\s+/g, ' ')
      const cle = `${p.categorie}|${terme.toLowerCase()}`
      if (vus.has(cle)) continue
      vus.add(cle)
      trouvees.push({ terme, categorie: p.categorie })
    }
  }
  return trouvees
}
