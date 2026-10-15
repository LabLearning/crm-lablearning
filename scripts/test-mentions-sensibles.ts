/**
 * Jeu de phrases du repérage des mots sensibles (lib/rapport-france-travail,
 * `mentionsSensibles`), relu avant l'envoi d'un rapport à France Travail.
 * Phrases inventées, aucune donnée réelle, aucune lecture en base.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/test-mentions-sensibles.ts
 *
 * À rejouer après toute retouche des listes : une phrase sensible qui passe
 * ou un mot du métier signalé à tort s'ajoute ici avant d'être corrigé.
 */
import { mentionsSensibles, type CategorieSensible } from '../lib/rapport-france-travail'

const NBSP = String.fromCharCode(0xa0)
const COMBINANT = String.fromCharCode(0x303)
const TRAIT_CONDITIONNEL = String.fromCharCode(0xad)
const SANS_CHASSE = String.fromCharCode(0x200b)
const LIGATURE_FI = String.fromCharCode(0xfb01)
const APOSTROPHE_AIGUE = String.fromCharCode(0xb4)

// Chaque phrase doit être signalée dans sa catégorie
const SENSIBLES: Record<CategorieSensible, string[]> = {
  'santé': [
    "Le stagiaire s'est fait opérer du genou et ne peut plus rester debout.",
    'Elle a été opérée en urgence la semaine dernière.',
    'Une opération est prévue le 12.',
    'Il est sous antidépresseurs depuis un mois.',
    'Tentative de suicide signalée par sa compagne.',
    "Il fait des crises d'angoisse en cuisine.",
    'Suivi psy deux fois par semaine, il doit partir à 15 h.',
    'Elle est en congé maternité à partir du 12.',
    'Elle attend un enfant, le port de charges lui est interdit.',
    "Il s'est blessé à la main avec la trancheuse.",
    'Stagiaire blessée au poignet, elle a quitté le poste.',
    "Brûlure au second degré à l'avant-bras.",
    "Il s'est coupé profondément le doigt, points de suture.",
    'Hernie discale, il ne porte plus de charges.',
    'Déclaré inapte au poste.',
    'Reconnu travailleur handicapé, dossier MDPH en cours.',
    'Il est bipolaire et a arrêté de se soigner.',
    'Elle suit une chimiothérapie.',
    'Il a fait un AVC pendant le week-end.',
    'Elle est en soins pour un problème cardiaque.',
    "Stagiaire dyslexique, n'arrive pas à suivre les supports écrits.",
    "Il est sourd d'une oreille.",
    'Elle a une sciatique à répétition.',
    'Il est séropositif.',
    'Il sort de cure de désintoxication.',
    "Arrivé en état d'ébriété à 8 h.",
    'Il sentait le cannabis, yeux rouges.',
    "Il est toxicomane d'après l'employeur.",
    'Il avait bu avant de venir.',
    'Kiné trois fois par semaine sur ses heures de formation.',
    'Suivie dans deux hôpitaux différents.',
    "Séjour en clinique jusqu'au 20.",
    "Il souffre du dos depuis l'accident.",
    'Elle est en dépression.',
    'Il déprime depuis la rentrée.',
    'TDAH diagnostiqué.',
    'Elle a fait une IVG la semaine passée.',
    'Mi-temps thérapeutique demandé.',
    'Certificat du docteur Martin fourni.',
    'Il a fait un malaise en cuisine.',
    'Arrêt maladie pour dépression.',
    'Elle a eu le covid et reste fatiguée.',
    'Hospitalisé aux urgences mardi.',
    'Elle se drogue selon ses collègues.',
    'Il sent l’alcool le matin.',
    'Enceinte de six mois.',
    'Elle a fait une fausse couche.',
    'Il prend des médicaments qui le font somnoler.',
    'Crises d’épilepsie à deux reprises.',
    'Il a consommé des boissons alcoolisées avant de prendre son poste.',
    'Il ne tient pas une matinée sans alcool.',
    'Il est sous anti-dépresseurs depuis un mois.',
    'Elle est mal-voyante.',
    'Il est séro-positif.',
    'Elle suit une ré-éducation du genou.',
    'Enceinte 6 mois, elle ne peut plus rester debout.',
    'Absent pour maladie cardiaque.',
  ],
  justice: [
    'Il a été arrêté par la police mardi soir.',
    "Convoqué par le juge d'application des peines.",
    'Les gendarmes sont venus le chercher sur le lieu de formation.',
    'Une plainte a été déposée contre lui par un collègue.',
    'Une main courante a été déposée.',
    'Il est en détention provisoire.',
    'Il a un sursis probatoire et pointe au SPIP.',
    "Il doit faire ses travaux d'intérêt général.",
    'Son procès a lieu le 14.',
    'Placé en garde-à-vue 24 h.',
    "L'employeur portera plainte pour vol.",
    'Interpellé pour conduite sans permis.',
    'Il a un casier judiciaire.',
    'Il a porté plainte au commissariat.',
    'Il sort de prison.',
    'Condamné à six mois avec sursis.',
    'Il porte un bracelet électronique.',
    'Convocation au tribunal le 3.',
    'Sous contrôle judiciaire.',
    'Audience devant le juge aux affaires familiales.',
  ],
  convictions: [
    'Refuse de goûter les plats, il est musulman.',
    "Elle porte le voile et refuse de l'enlever en cuisine.",
    "Il jeûne et n'a plus de force l'après-midi.",
    "Absent pour l'Aïd.",
    'Il va à la mosquée le vendredi.',
    'Délégué CGT dans son ancienne entreprise.',
    'Il est homosexuel et se dit harcelé par le groupe.',
    'Elle est témoin de Jéhovah.',
    'Il fait shabbat et ne vient pas le samedi.',
    'Pendant le ramadan il part plus tôt.',
    'Il demande une pause pour faire sa prière.',
    'Adhérent à un syndicat.',
    'Absence pour une fête religieuse.',
    'Il ne travaille pas pour des raisons de religion.',
    "Il quitte son poste à 13 h pour la prière de l'après-midi.",
    "Il s'absente chaque jour pour la prière de midi.",
    'Elle a demandé un local pour sa prière de 14 h.',
    "Ses délégués syndicaux l'ont accompagné.",
    'Il respecte le sabbat.',
  ],
  'vie privée': [
    'Sa mère est décédée, il a dû rentrer pour les obsèques.',
    "Deuil dans la famille, elle n'a plus la tête à la formation.",
    'En instance de divorce, il a perdu la garde de ses enfants.',
    'Victime de violences conjugales, elle a été relogée.',
    'Il dort dans sa voiture depuis son expulsion.',
    'Elle est mère célibataire, sans solution le soir.',
    "Il n'a plus de titre de séjour valable.",
    "Demandeur d'asile, récépissé expiré.",
    'Remarques sur ses origines.',
    'Il déprime depuis sa séparation.',
    'Victime de violences psychologiques de son conjoint.',
    'Dossier de sur-endettement déposé.',
  ],
}

// Écritures inhabituelles d'un mot sensible : toutes doivent être signalées
const FORMES: string[] = [
  'HOSPITALISÉ EN URGENCE POUR UNE DÉPRESSION',
  'hospitalise pour depression',
  'Elle s’est fait opérer ; l’hôpital l’a gardée.',
  'placé en garde à\nvue',
  `placé en garde${NBSP}à${NBSP}vue`,
  'placé en garde  à vue',
  'il a porté\nplainte',
  'fausse\ncouche',
  'fausse-couche',
  `burn${NBSP}out`,
  'burn-out',
  // Accent posé à part (forme décomposée), comme dans un texte collé d'un PDF
  'Il est hospitalise'.replace('se', `se${String.fromCharCode(0x301)}`),
  // Caractère sans forme composée : il ne doit pas faire sauter le reste du texte
  `x${COMBINANT} note : il est hospitalisé pour une dépression`,
  'ALCOOLISÉ',
  'Il est MALADE.',
  // Collé d'un PDF ou d'une page : trait d'union conditionnel, caractère sans chasse, ligature, apostrophe de rechange
  `Il est hospi${TRAIT_CONDITIONNEL}talisé depuis lundi.`,
  `Il est hospi${SANS_CHASSE}talisé depuis lundi.`,
  `Suivi par une in${LIGATURE_FI}rmière à domicile.`,
  `Absent pour l${APOSTROPHE_AIGUE}Aïd.`,
]

// Mots du métier et formules générales : aucun signalement attendu
const ANODINES: string[] = [
  'A laissé son couteau dans le casier du vestiaire.',
  'Vol signalé dans les casiers du vestiaire.',
  "L'employeur est en redressement judiciaire, le poste est supprimé.",
  "Liquidation judiciaire de l'entreprise d'accueil, prononcée par le tribunal de commerce.",
  'Le diagnostic de positionnement montre un niveau insuffisant.',
  "Module sur la vente d'alcool et le permis d'exploitation.",
  'Service de boissons alcoolisées et sans alcool au bar.',
  'A raté sa religieuse au chocolat et a quitté le laboratoire.',
  'Traitement du dossier en cours.',
  'Mauvais traitement des denrées, rupture de la chaîne du froid.',
  "Un malaise s'est installé dans le groupe.",
  "Elle s'est plainte du rythme de la formation.",
  "Harcèlement psychologique de la part d'un autre stagiaire.",
  "Prière de contacter l'employeur avant toute décision.",
  "Les allergènes n'étaient pas affichés.",
  "Rappel des règles d'hygiène et du lavage des mains.",
  'Il a quitté la formation pour raisons de santé.',
  'Départ pour raisons médicales.',
  'En arrêt maladie du 3 au 10, justificatif fourni.',
  'Arrêt de travail transmis, absence justifiée.',
  'Raisons personnelles.',
  'Pour raisons familiales.',
  'A trouvé un emploi en CDI ailleurs.',
  'Retards répétés, trois absences injustifiées.',
  "Le syndic de l'immeuble a coupé l'eau, session annulée.",
  "Visite médicale d'embauche programmée par l'employeur.",
  'Intervention en urgence du technicien sur la chambre froide.',
  'Il a condamné la porte de la réserve.',
  "Opération commerciale chez l'employeur, stagiaire réquisitionné.",
  "Formation aux gestes de premiers secours, trousse d'infirmerie vérifiée.",
  'Comportement agressif envers le formateur, insultes.',
  "Depuis le covid l'établissement tourne en effectif réduit.",
  "Droguerie voisine fermée, produits d'entretien manquants.",
  "Départ à la demande de l'employeur, période d'essai rompue.",
  'Préparation opérationnelle à l’emploi individuelle.',
  'Bonne coopération avec le reste du groupe.',
  'Le jeune stagiaire manque de ponctualité.',
  'Il juge le rythme trop soutenu.',
  'Propos blessants envers une collègue.',
  'Il a brûlé le plat et quitté la cuisine.',
  'Porte un bracelet et une montre en cuisine malgré les rappels.',
  'Erreurs répétées dans la main courante de la réception.',
  "Sens de l'hospitalité et de l'accueil insuffisant.",
  'Expulsé du cours après une altercation.',
  "Procès-verbal de l'entretien transmis à l'employeur.",
  'Problème de garde de ses enfants le mercredi.',
  'Difficultés de transport, pas de véhicule.',
  "A déménagé à plus d'une heure du lieu de formation.",
  "Découpe de l'avocat et dressage de l'assiette non maîtrisés.",
  'Travaille sans conviction, manque de motivation.',
  'Rupture de la période de mise en situation en entreprise.',
  'Tenue non conforme : pas de charlotte ni de chaussures de sécurité.',
  'Absent à cause de la grève des transports.',
  'A cassé une enceinte de la salle par maladresse.',
  "Bagarre dans l'enceinte de l'établissement.",
  'Refus de suivre les consignes du tuteur, départ sans prévenir.',
  'Prière de bien vouloir transmettre le justificatif.',
  'Prière de fournir le justificatif sous 48 h.',
  "Prière d'informer la direction de toute absence.",
  "Prière d'apporter sa tenue complète lundi.",
  'Carte des boissons sans alcool à revoir.',
  'Violences psychologiques entre deux stagiaires du groupe.',
  'Il porte un jugement de valeur sur le travail du groupe.',
  'Il manque du jugement nécessaire pour tenir le poste.',
  'Elle souhaite prendre une année sabbatique.',
  "Après son expulsion du cours, il n'est pas revenu.",
  "Enceinte 3 à +9 °C à l'ouverture, denrées jetées.",
  'Température de chaque enceinte non relevée ce matin.',
  "Porte d'enceinte froide restée ouverte toute la nuit.",
  'Absence pour maladie du 3 au 10, justificatif fourni.',
  'En congé de maladie.',
  'Il fait la sourde oreille aux consignes du formateur.',
  'Il y a eu un malentendu avec le tuteur.',
  `Certi${LIGATURE_FI}cat médical fourni.`,
  "L'établissement d'accueil a fermé, plus de poste à pourvoir.",
  'Niveau de français insuffisant pour suivre les modules.',
  'Incident sans suite, rappel du règlement intérieur.',
]

let echecs = 0
const note = (cond: boolean, nom: string, info?: unknown) => {
  if (!cond) { echecs++; console.log('ÉCHEC', nom, info === undefined ? '' : JSON.stringify(info)) }
}

function main() {
  let total = 0
  for (const [categorie, phrases] of Object.entries(SENSIBLES) as Array<[CategorieSensible, string[]]>) {
    for (const p of phrases) {
      total++
      const m = mentionsSensibles(p)
      note(m.some((x) => x.categorie === categorie), `[${categorie}] non signalée : ${p}`, m)
    }
  }
  for (const p of FORMES) {
    total++
    note(mentionsSensibles(p).length > 0, `forme non reconnue : ${JSON.stringify(p)}`)
  }
  for (const p of ANODINES) {
    total++
    const m = mentionsSensibles(p)
    note(m.length === 0, `signalée à tort : ${p}`, m)
  }

  // Le mot rendu est celui du texte, tel qu'il est écrit
  const rendu = mentionsSensibles('Placé en garde-à-vue puis HOSPITALISÉ.').map((m) => m.terme)
  total++
  note(rendu.includes('garde-à-vue') && rendu.includes('HOSPITALISÉ'), 'le mot rendu est celui du texte', rendu)
  // Le plus long dit tout, et un même mot ne revient pas deux fois
  const longs = mentionsSensibles('Mi-temps thérapeutique, puis thérapeutique encore', 'thérapeutique').map((m) => m.terme)
  total++
  note(longs.length === 1, 'un même mot signalé une seule fois', longs)
  // Plusieurs textes, dont des vides
  total++
  note(mentionsSensibles(null, undefined, '', 'il est hospitalisé').length === 1, 'textes vides ignorés')
  // Longueur conservée : un texte de 20 000 caractères ne doit ni planter ni ralentir
  const debut = Date.now()
  const long = 'Retards répétés et absences injustifiées, rappel du règlement. '.repeat(320)
  total++
  note(mentionsSensibles(long).length === 0 && Date.now() - debut < 1500, 'texte long traité sans lenteur', Date.now() - debut)

  console.log(echecs ? `\n${echecs} échec(s) sur ${total} vérifications` : `Tous les tests passent (${total} vérifications)`)
  process.exit(echecs ? 1 : 0)
}
main()
