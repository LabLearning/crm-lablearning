import type { Questionnaire, Question } from './types'

/**
 * Questionnaire générique « Équipier polyvalent en restauration rapide »
 * (première version, 16/09/2026) : cinq domaines, vingt questions.
 *
 * Il reste servi aux parcours qui n'ont pas encore leur propre banque
 * (Chickeez, Dreams Donuts…) et sert à relire les positionnements déjà
 * rendus avec lui. Ne pas modifier les codes, les textes ni les bonnes
 * réponses : des réponses enregistrées y renvoient.
 *
 * Niveau volontairement exigeant : chaque question porte sur une règle
 * chiffrée ou une procédure précise du métier (arrêté du 21 décembre 2009,
 * règlement (UE) 1169/2011, Code du travail, Code monétaire et financier,
 * repères DGCCRF et INRS). Chaque réponse a été contre-vérifiée sur les
 * textes avant d'entrer ici.
 */

const QUESTIONS: Question[] = [
  // ── Hygiène alimentaire et HACCP ──
  {
    code: 'hyg1', domaine: 'hygiene',
    intitule: 'Vous rangez une livraison de steaks hachés frais réfrigérés en chambre froide. Quelle température maximale de conservation devez-vous respecter ?',
    choix: [
      '+8 °C',
      '+2 °C',
      '+4 °C',
      '+6 °C',
    ],
    correct: 1,
    explication: 'Les viandes hachées se conservent à +2 °C au maximum (arrêté du 21 décembre 2009, annexe I, et règlement (CE) 853/2004, annexe III, section V). Le seuil de +4 °C s\'applique notamment aux préparations de viandes, aux volailles et aux autres denrées très périssables ; +8 °C aux denrées simplement périssables.',
  },
  {
    code: 'hyg2', domaine: 'hygiene',
    intitule: 'Vous venez de cuire 10 litres de sauce bolognaise à conserver au froid. Que prévoit la règle du refroidissement rapide ?',
    choix: [
      'Passer de +63 °C à +3 °C en moins de quatre heures',
      'Passer de +63 °C à +10 °C en moins de quatre heures',
      'Passer de +63 °C à +3 °C en moins de deux heures',
      'Passer de +63 °C à +10 °C en moins de deux heures',
    ],
    correct: 3,
    explication: 'L\'arrêté du 21 décembre 2009 (annexe IV) impose que la température des préparations culinaires ne reste pas entre +63 °C et +10 °C pendant plus de deux heures, afin de limiter la multiplication microbienne dans cette plage. La valeur +3 °C n\'est pas le seuil du refroidissement rapide : c\'est la température de conservation à atteindre ensuite, lors du stockage au froid positif.',
  },
  {
    code: 'hyg3', domaine: 'hygiene',
    intitule: 'Un client demande si votre tacos contient de la moutarde. Que prévoit la réglementation française pour l\'information sur les allergènes en restauration ?',
    choix: [
      'Une information écrite (menu ou document consultable, signalé au client) sur les 14 allergènes',
      'Une réponse orale sur les 14 allergènes suffit, dès lors que l\'équipier connaît les recettes',
      'Un affichage écrit limité aux allergènes majeurs : gluten, arachide, lait, œuf, fruits à coque',
      'Aucune obligation en salle : l\'information incombe au fournisseur des denrées préemballées',
    ],
    correct: 0,
    explication: 'Le règlement (UE) 1169/2011 (annexe II) liste 14 allergènes à déclaration obligatoire, dont la moutarde. En France, le décret n° 2015-447 du 17 avril 2015 (art. R.412-12 et suivants du Code de la consommation) impose en restauration une information écrite : sur le menu ou sur un document tenu à disposition, le client étant informé par affichage de son existence. Une réponse orale seule ne suffit pas.',
  },
  {
    code: 'hyg4', domaine: 'hygiene',
    intitule: 'À la fermeture, il reste deux kilos de chili remis en température pour le service de midi et maintenu à 63 °C depuis. Que devez-vous en faire ?',
    choix: [
      'Le congeler en portions pour un service ultérieur',
      'Le conserver trois jours en chambre froide avec une étiquette datée',
      'L\'éliminer en fin de service, sans le réutiliser',
      'Le refroidir rapidement en cellule et le resservir le lendemain midi',
    ],
    correct: 2,
    explication: 'L\'arrêté du 21 décembre 2009 (annexe IV) impose que les denrées remises en température soient consommées le jour de leur première remise en température. Un second cycle de refroidissement, une conservation au froid ou une congélation sont donc exclus : les restes sont éliminés, même s\'ils ont été maintenus à plus de 63 °C.',
  },
  // ── Production et assemblage ──
  {
    code: 'pro1', domaine: 'production',
    intitule: 'Vous cuisez au gril un steak haché surgelé de 45 g. Quel contrôle garantit une cuisson à cœur conforme aux recommandations sanitaires avant sa mise en holding ?',
    choix: [
      'Sonde à cœur : 63 °C, température réglementaire des plats chauds',
      'Surface bien colorée des deux côtés et jus clair à la pression',
      'Sonde au point le plus épais : 70 °C minimum à cœur',
      'Sonde à cœur : 55 °C, le centre peut rester rosé',
    ],
    correct: 2,
    explication: 'L\'ANSES recommande une cuisson à cœur des viandes hachées à 70 °C : les E. coli entérohémorragiques sont répartis dans toute la masse hachée et non en surface comme sur une pièce entière, d\'où l\'interdiction du rosé. 63 °C est la température minimale de maintien en liaison chaude, pas une température de cuisson. L\'aspect extérieur et la couleur du jus ne garantissent rien : seule la sonde au point le plus épais fait foi.',
  },
  {
    code: 'pro2', domaine: 'production',
    intitule: 'Le testeur d\'huile de la friteuse affiche 27 % de composés polaires en plein service. Que faites-vous ?',
    choix: [
      'Vous vidangez et remplacez le bain immédiatement, sans le filtrer ni le compléter',
      'Vous filtrez le bain et le complétez d\'huile neuve pour finir le service',
      'Vous baissez la friteuse à 160 °C et changez l\'huile à la fermeture',
      'Vous poursuivez le service, l\'huile n\'est impropre qu\'au-delà de 30 %',
    ],
    correct: 0,
    explication: 'Le décret n° 2008-184 du 26 février 2008 fixe la limite à 25 % de composés polaires : au-delà, l\'huile est impropre à la consommation et doit être remplacée immédiatement, sans filtration ni ajout d\'huile neuve. Baisser la température ou compléter le bain ne ramène pas la teneur sous le seuil et expose l\'établissement à une sanction DGCCRF.',
  },
  {
    code: 'pro3', domaine: 'production',
    intitule: 'Au contrôle, le bac gastro de poulet cuit tenu sur le bain-marie affiche 58 °C à cœur. Que faites-vous ?',
    choix: [
      'Vous montez le thermostat du bain-marie, laissez le bac remonter seul en une heure et notez la valeur finale',
      'Rien, 58 °C respecte le minimum réglementaire de 55 °C pour les plats chauds, vous notez simplement le relevé',
      'Vous placez le bac au froid positif pour le resservir au service suivant',
      'Vous retirez le bac, réchauffez le poulet à plus de 63 °C à cœur et notez l\'écart',
    ],
    correct: 3,
    explication: 'L\'arrêté du 21 décembre 2009 impose un maintien des plats chauds à +63 °C minimum ; un produit passé sous ce seuil doit être ramené rapidement au-dessus de 63 °C à cœur sur un appareil de cuisson, le bain-marie seul étant trop lent. L\'écart est consigné dans les relevés du plan de maîtrise sanitaire.',
  },
  {
    code: 'pro4', domaine: 'production',
    intitule: 'Mise en place le 16/09 : bac A de salade ouvert le 15/09 (DLC secondaire 17/09), bac B fermé avec DLC au 16/09. Lequel utilisez-vous en premier ?',
    choix: [
      'Indifférent : les deux bacs sont conformes le 16/09, vous prenez le plus accessible',
      'Le bac B, sa DLC du 16/09 est la plus proche : il doit être consommé aujourd\'hui',
      'Le bac A, un produit entamé passe toujours avant un produit fermé',
      'Le bac A, vous jetez le bac B dont la DLC tombe le jour même',
    ],
    correct: 1,
    explication: 'La rotation se fait sur la date limite la plus proche (premier périmé, premier sorti) : le bac B est consommable jusqu\'au 16/09 inclus, le bac A jusqu\'au 17/09. Un produit entamé ne passe pas automatiquement avant un produit fermé : c\'est la date qui commande. Prendre « le plus accessible » ou jeter un produit encore conforme conduit à perdre le bac B, qui ne sera plus utilisable demain, alors que le bac A le sera encore.',
  },
  // ── Service, encaissement et relation client ──
  {
    code: 'ser1', domaine: 'service',
    intitule: 'Un client règle au comptoir un menu famille de 32 € consommé sur place et ne demande rien. Que prévoit la réglementation pour la note ?',
    choix: [
      'Le ticket n\'est obligatoire qu\'à partir de 50 € TTC',
      'Le ticket n\'est obligatoire que pour un paiement en espèces',
      'Aucune impression depuis le 1er août 2023, sauf si le client la demande',
      'La note doit lui être remise d\'office : la prestation atteint 25 € TTC',
    ],
    correct: 3,
    explication: 'L\'arrêté n° 83-50/A du 3 octobre 1983 impose la remise d\'une note, avant paiement, pour toute prestation de service d\'au moins 25 € TTC ; en dessous, elle n\'est remise que sur demande. La fin de l\'impression systématique des tickets de caisse (loi AGEC, décret n° 2022-1565, 1er août 2023) ne concerne pas cette note : la DGCCRF confirme que restaurants et hôtels continuent de la remettre d\'office.',
    source: 'Arrêté n° 83-50/A du 3 octobre 1983 ; décret n° 2022-1565 du 14 décembre 2022 ; fiche pratique DGCCRF sur la note en restauration',
  },
  {
    code: 'ser2', domaine: 'service',
    intitule: 'Commande de 21,30 €. Le client règle avec deux titres-restaurant papier de 11,50 € chacun et vous demande sa monnaie. Quel montant lui rendez-vous ?',
    choix: [
      '1,70 €',
      '0,00 €',
      '9,80 €',
      '3,70 €',
    ],
    correct: 1,
    explication: 'Les deux titres couvrent 23,00 € pour 21,30 € dus, mais un titre-restaurant ne donne jamais lieu à un rendu de monnaie : le surplus de 1,70 € n\'est pas restitué. Les conditions d\'usage de la Commission nationale des titres-restaurant (CNTR) interdisent ce rendu, le plafond journalier de 25 € restant par ailleurs respecté.',
    source: 'Conditions d\'usage des titres-restaurant, Commission nationale des titres-restaurant (CNTR) ; décret n° 2022-1266 relatif au plafond journalier de 25 €',
  },
  {
    code: 'ser3', domaine: 'service',
    intitule: 'Un client veut régler 9,80 € uniquement en pièces de 10 et 20 centimes. Au-delà de quel nombre de pièces la réglementation vous autorise-t-elle à refuser ?',
    choix: [
      'Plus de 20 pièces',
      'Plus de 30 pièces',
      'Plus de 50 pièces',
      'Plus de 100 pièces',
    ],
    correct: 2,
    explication: 'Nul n\'est tenu d\'accepter plus de cinquante pièces lors d\'un seul paiement. En dessous de ce seuil, refuser des espèces en cours légal est une contravention de 2e classe.',
    source: 'Règlement (CE) n° 974/98, art. 11 ; art. R112-2 Code monétaire et financier ; art. R642-3 Code pénal',
  },
  {
    code: 'ser4', domaine: 'service',
    intitule: 'Un client ayant payé par carte hier revient aujourd\'hui pour être remboursé ; la télécollecte a eu lieu cette nuit. Quelle opération effectuez-vous ?',
    choix: [
      'Un crédit du montant sur la carte du client',
      'Un remboursement en espèces depuis la caisse',
      'Une vente saisie avec un montant négatif',
      'Une annulation de la transaction de la veille',
    ],
    correct: 0,
    explication: 'Après la télécollecte, la transaction n\'est plus dans le lot en mémoire du TPE : l\'annulation est impossible, le terminal n\'accepte aucun montant négatif et un paiement carte ne se rembourse pas en espèces. Le remboursement passe par l\'opération Crédit du TPE, qui recrédite la carte ayant servi au paiement, conformément à la règle du remboursement sur le moyen de paiement d\'origine.',
    source: 'Procédure monétique des terminaux de paiement (GIE Cartes Bancaires ; guides constructeurs Ingenico/Verifone)',
  },
  // ── Sécurité au travail et prévention des risques ──
  {
    code: 'sec1', domaine: 'securite',
    intitule: 'Un apprenti de 17 ans pesant 60 kg, sans dérogation médicale pour ces travaux, travaille en réserve. Quelle charge maximale peut-il manutentionner ?',
    choix: [
      '12 kg',
      '15 kg',
      '20 kg',
      '10 kg',
    ],
    correct: 0,
    explication: 'L\'article D4153-39 du Code du travail limite les manutentions manuelles des moins de 18 ans à 20 % de leur poids, soit 12 kg pour 60 kg, sauf dérogation permanente de l\'article R4153-52 lorsque l\'aptitude médicale à ces travaux a été constatée. Les anciens plafonds de 10 kg (filles) et 20 kg (garçons) de 16 à 17 ans ont été abrogés en 2013, et le seuil de 15 kg de la norme NF X35-109 reprise par l\'INRS ne vise que les adultes.',
    source: 'Code du travail, articles D4153-39 et R4153-52 ; INRS, Jeunes travailleurs / Réglementation ; norme NF X35-109',
  },
  {
    code: 'sec2', domaine: 'securite',
    intitule: 'Vous vous coupez à la trancheuse un lundi matin. Dans quel délai votre employeur doit-il déclarer l\'accident du travail à la CPAM ?',
    choix: [
      'Dans les 8 jours',
      'Dans les 24 heures',
      'Dans les 48 heures',
      'Dans les 72 heures',
    ],
    correct: 2,
    explication: 'L\'article R441-3 du Code de la sécurité sociale impose à l\'employeur de déclarer l\'accident à la caisse primaire dans les 48 heures, dimanches et jours fériés non compris. Le salarié, lui, doit informer l\'employeur dans la journée ou au plus tard sous 24 heures, sauf force majeure (article R441-2).',
    source: 'Code de la sécurité sociale, articles R441-2 et R441-3',
  },
  {
    code: 'sec3', domaine: 'securite',
    intitule: 'Coupure de courant la nuit, congélateur à moitié plein resté fermé : selon le repère DGCCRF, les denrées restent congelées environ combien de temps ?',
    choix: [
      'Environ 12 heures',
      'Environ 24 heures',
      'Environ 48 heures',
      'Environ 4 heures',
    ],
    correct: 1,
    explication: 'La fiche DGCCRF publiée sur economie.gouv.fr indique qu\'un congélateur fermé garde les denrées congelées environ 48 heures s\'il est plein et 24 heures s\'il est à moitié plein, contre environ 4 heures pour un réfrigérateur. En établissement, on contrôle ensuite la température des produits et on trace l\'incident dans le PMS ; toute denrée décongelée est jetée, jamais recongelée.',
    source: 'economie.gouv.fr (DGCCRF), Coupure d\'électricité : que faire des aliments du réfrigérateur et du congélateur ? ; ANSES',
  },
  {
    code: 'sec4', domaine: 'securite',
    intitule: 'En nettoyant les sanitaires, un équipier mélange par erreur de l\'eau de Javel et un détartrant acide. Quel gaz toxique se dégage ?',
    choix: [
      'De l\'ammoniac gazeux',
      'Du monoxyde de carbone',
      'Du dioxyde de soufre',
      'Du dichlore gazeux',
    ],
    correct: 3,
    explication: 'L\'hypochlorite de sodium de l\'eau de Javel réagit avec un acide (détartrant, vinaigre) en libérant du dichlore, gaz irritant pouvant provoquer un oedème pulmonaire (INRS, fiche toxicologique FT 51). Mélangée à l\'ammoniaque, elle produit des chloramines tout aussi dangereuses ; on ne mélange donc jamais deux produits d\'entretien.',
    source: 'INRS, fiche toxicologique FT 51 (Chlore) ; étiquetage CLP de l\'eau de Javel (hypochlorite de sodium)',
  },
  // ── Travail en équipe et posture professionnelle ──
  {
    code: 'pos1', domaine: 'posture',
    intitule: 'Après plusieurs retards non prévenus, votre responsable évoque une sanction. Laquelle est interdite par le Code du travail ?',
    choix: [
      'Une retenue sur salaire correspondant exactement au temps non travaillé',
      'Une mise à pied disciplinaire de deux jours prévue au règlement intérieur',
      'Une retenue de 20 € par retard, en plus du temps non travaillé',
      'Un avertissement écrit versé à votre dossier',
    ],
    correct: 2,
    explication: 'L\'article L1331-2 du Code du travail interdit les amendes et toute sanction pécuniaire, une clause contraire étant réputée non écrite. La retenue proportionnelle au temps non travaillé n\'est pas une sanction, et l\'avertissement ou la mise à pied restent possibles dans le respect du règlement intérieur.',
    source: 'Code du travail, art. L1331-1 et L1331-2 ; règlement intérieur de l\'établissement',
  },
  {
    code: 'pos2', domaine: 'posture',
    intitule: 'À partir de quelle durée de travail quotidien la pause de 20 minutes consécutives devient-elle obligatoire pour un équipier ?',
    choix: [
      'Dès 8 heures de travail',
      'Dès 4 heures de travail',
      'Dès 5 heures de travail',
      'Dès 6 heures de travail',
    ],
    correct: 3,
    explication: 'L\'article L3121-16 du Code du travail impose 20 minutes consécutives de pause dès que le temps de travail quotidien atteint 6 heures. En dessous de ce seuil, aucune pause n\'est due légalement, sauf accord plus favorable.',
    source: 'Code du travail, art. L3121-16',
  },
  {
    code: 'pos3', domaine: 'posture',
    intitule: 'La tenue est imposée et vous devez l\'enfiler au vestiaire du restaurant. Que prévoit le Code du travail pour ce temps d\'habillage, à défaut d\'accord ?',
    choix: [
      'Il est payé comme du temps de travail effectif',
      'Il est compensé par du repos ou une prime',
      'Il n\'ouvre droit à aucune compensation',
      'Il est déduit de la pause de 20 minutes',
    ],
    correct: 1,
    explication: 'L\'article L3121-3 prévoit que l\'habillage imposé et réalisé sur le lieu de travail ouvre droit à des contreparties, sous forme de repos ou financières. Ce temps n\'est assimilé à du travail effectif que si un accord collectif ou le contrat de travail le prévoit expressément.',
    source: 'Code du travail, art. L3121-3',
  },
  {
    code: 'pos4', domaine: 'posture',
    intitule: 'Un client demande la copie des données que le programme de fidélité détient sur lui. Sauf prolongation, sous quel délai le restaurant doit-il lui répondre ?',
    choix: [
      'Sous 1 mois',
      'Sous 2 mois',
      'Sous 8 jours',
      'Sous 15 jours',
    ],
    correct: 0,
    explication: 'L\'article 12, paragraphe 3, du RGPD impose de répondre à une demande d\'accès dans un délai d\'un mois, prolongeable de deux mois seulement pour les demandes complexes ou nombreuses, à condition d\'en informer la personne dans le mois initial. En restaurant, l\'équipier ne communique aucune donnée lui-même et transmet la demande au manager, qui la traite dans ce délai.',
    source: 'RGPD, art. 12 (§3) et 15 ; CNIL, fiche « Le droit d\'accès »',
  },
]

export const QUESTIONNAIRE_GENERIQUE: Questionnaire = {
  code: 'generique',
  titre: 'Équipier polyvalent en restauration rapide',
  referentiel: 'Compétences de l\'équipier polyvalent en restauration rapide, en cinq domaines',
  dureeMinutes: 10,
  domaines: [
    {
      code: 'hygiene',
      libelle: 'Hygiène alimentaire et HACCP',
      part: 0.25,
      plancher: 14,
      plancherMotif: 'module d\'hygiène alimentaire suivi en entier',
      objectif: "Appliquer le plan de maîtrise sanitaire : températures, DLC, marche en avant, traçabilité, nettoyage et désinfection.",
    },
    {
      code: 'production',
      libelle: 'Production et assemblage',
      part: 0.25,
      objectif: "Préparer, cuire et assembler les produits selon les fiches techniques, tenir les cadences et maîtriser les cuissons.",
    },
    {
      code: 'service',
      libelle: 'Service, encaissement et relation client',
      part: 0.2,
      objectif: "Accueillir, prendre une commande, encaisser, gérer une réclamation et tenir le rythme au comptoir comme au drive.",
    },
    {
      code: 'securite',
      libelle: 'Sécurité au travail et prévention des risques',
      part: 0.15,
      objectif: "Travailler sans se blesser ni blesser autrui : gestes et postures, équipements chauds et tranchants, conduite à tenir en cas d'incident.",
    },
    {
      code: 'posture',
      libelle: 'Travail en équipe et posture professionnelle',
      part: 0.15,
      objectif: "Tenir un poste dans un collectif : communication en service, ponctualité, transmission des consignes, tenue et présentation.",
    },
  ],
  questions: QUESTIONS,
}
