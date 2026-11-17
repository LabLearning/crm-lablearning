import type { Questionnaire, Question } from './types'

/**
 * Questionnaire de positionnement « Équipier polyvalent, concepts tacos »
 * (Chamas Tacos, New School Tacos), 17/11/2026.
 *
 * Construit sur le référentiel des compétences de l'équipier polyvalent du
 * réseau Chamas Tacos : six domaines, quarante compétences, une question par
 * compétence. Le domaine Production porte sur les gestes d'un concept tacos
 * (galette, pliage, presse, gratinés) ; les autres domaines valent pour tout
 * restaurant rapide.
 *
 * Exigeant mais juste : chaque question porte sur une règle chiffrée, une
 * procédure précise ou un geste du métier. Un candidat sans formation ne doit
 * pas atteindre 80 % par bon sens ; un équipier formé et expérimenté doit
 * pouvoir le dépasser. Aucune question ne porte sur une recette interne qu'un
 * candidat extérieur ne pourrait pas connaître.
 *
 * Règles de rédaction : quatre choix de même forme et de longueur voisine,
 * bonnes réponses réparties dix fois sur chaque position, pas d'espace
 * insécable (glyphe absent de la police des PDF).
 */

const QUESTIONS: Question[] = [
  // ── A · Organisation de la prise de poste ──
  {
    code: "c01", domaine: "prise_poste", competence: "01 · Prise de poste et préparation de la journée",
    intitule: "Prise de poste : vous avez enfilé votre tenue et rejoignez la cuisine. Quel lavage des mains est conforme aux bonnes pratiques avant de manipuler des denrées ?",
    choix: [
      "Au lave-mains, savon liquide, friction de 30 secondes, rinçage, torchon individuel propre",
      "Au lave-mains, gel hydroalcoolique, friction de 30 secondes, puis essuie-mains jetable",
      "Au lave-mains, savon liquide, friction de 30 secondes, rinçage, essuie-mains jetable",
      "Au lave-mains, gel hydroalcoolique, friction de 30 secondes, puis torchon individuel propre",
    ],
    correct: 2,
    explication: "Avant de manipuler des denrées, on se lave les mains au lave-mains avec du savon liquide : friction d'au moins 30 secondes (paumes, dos des mains, entre les doigts, ongles, poignets), rinçage, puis séchage avec un essuie-mains jetable, à usage unique. Le gel hydroalcoolique n'enlève pas les souillures et ne remplace pas ce lavage ; un torchon, même individuel, se recontamine à chaque usage et recontamine les mains.",
    source: "Règlement (CE) 852/2004, annexe II, chapitre I, point 4 ; guide de bonnes pratiques d'hygiène « Restaurateur » ; Santé publique France, lavage des mains",
  },
  {
    code: "c02", domaine: "prise_poste", competence: "02 · Ouverture du restaurant",
    intitule: "À l'ouverture, le relevé de la chambre froide positive indique +7 °C. Elle contient des steaks hachés frais, des sauces maison et des crudités. Que faites-vous ?",
    choix: [
      "Vous mesurez les produits et transférez au congélateur ceux qui dépassent leur limite, pour les sauver",
      "Vous mesurez les produits et utilisez en priorité ce midi ceux qui dépassent leur limite",
      "Vous mesurez les produits et gardez tous ceux qui restent sous +8 °C, limite des chambres froides",
      "Vous mesurez les produits, isolez ceux hors limite et alertez le responsable",
    ],
    correct: 3,
    explication: "+8 °C n'est la limite que des autres denrées périssables : les viandes hachées se conservent à +2 °C au plus, les préparations culinaires élaborées à l'avance, comme les sauces maison, à +3 °C, et les autres denrées très périssables à +4 °C. Une enceinte à +7 °C est une non-conformité : on mesure les produits eux-mêmes, on isole ceux qui dépassent leur limite, on alerte le responsable, qui décide de leur sort, et on trace l'action corrective. Congeler ou servir en priorité des denrées sorties de leur température est exclu.",
    source: "Arrêté du 21 décembre 2009, annexe I ; plan de maîtrise sanitaire (actions correctives)",
  },

  // ── B · Hygiène, sécurité et gestion des produits ──
  {
    code: "c03", domaine: "hygiene_produits", competence: "03 · Hygiène personnelle et comportement sanitaire",
    intitule: "Vous vous faites une petite coupure au doigt en préparant les garnitures. Après les premiers soins, comment reprenez-vous la manipulation des denrées ?",
    choix: [
      "Pansement étanche de couleur vive, recouvert d'un gant à usage unique changé régulièrement",
      "Pansement couleur chair, plus discret, recouvert d'un gant à usage unique changé régulièrement",
      "Pansement couleur chair, plus discret, sans gant, avec un lavage des mains toutes les heures",
      "Pansement étanche de couleur vive, sans gant, avec un lavage des mains toutes les heures",
    ],
    correct: 0,
    explication: "Une plaie est un réservoir de staphylocoques : elle est couverte d'un pansement étanche, de couleur vive pour être repéré tout de suite s'il tombe dans une préparation, puis d'un gant à usage unique. Un pansement couleur chair passe inaperçu dans les aliments, et sans gant le pansement reste au contact des denrées : le lavage des mains ne protège pas la plaie.",
    source: "Règlement (CE) 852/2004, annexe II, chapitre VIII ; guide de bonnes pratiques d'hygiène « Restaurateur »",
  },
  {
    code: "c04", domaine: "hygiene_produits", competence: "04 · Maîtrise des règles HACCP et du PMS",
    intitule: "Vous venez de préparer 5 litres de sauce fromagère maison, cuite, à conserver au froid pour le lendemain. Que prévoit la règle du refroidissement rapide ?",
    choix: [
      "Passer de +63 °C à +3 °C en moins de quatre heures",
      "Passer de +63 °C à +10 °C en moins de quatre heures",
      "Passer de +63 °C à +3 °C en moins de deux heures",
      "Passer de +63 °C à +10 °C en moins de deux heures",
    ],
    correct: 3,
    explication: "La température des préparations cuites ne doit pas rester entre +63 °C et +10 °C plus de deux heures, plage où les micro-organismes se multiplient le plus vite. +3 °C n'est pas le seuil du refroidissement rapide : c'est la température de conservation à atteindre ensuite, au stockage en froid positif.",
    source: "Arrêté du 21 décembre 2009, annexe IV (règle de la restauration collective, reprise pour la restauration commerciale par le guide de bonnes pratiques d'hygiène « Restaurateur ») et annexe I (+3 °C, préparations culinaires élaborées à l'avance)",
  },
  {
    code: "c05", domaine: "hygiene_produits", competence: "05 · Prévention des risques professionnels",
    intitule: "Le bain d'huile d'une friteuse s'enflamme pendant le service. Vous avez déjà coupé le chauffage. Quel geste est adapté ?",
    choix: [
      "Couvrir avec la couverture anti-feu, puis la retirer dès que les flammes ont bien disparu",
      "Couvrir avec la couverture anti-feu, laissée en place jusqu'au refroidissement de l'huile",
      "Asperger le bain avec le pulvérisateur d'eau du poste, en restant à bonne distance du feu",
      "Jeter de la farine en quantité sur le bain, pour étouffer les flammes plus vite",
    ],
    correct: 1,
    explication: "Un feu d'huile se combat en supprimant l'oxygène : couvercle, couverture anti-feu ou extincteur dont la plaque porte la classe F (huiles et graisses de cuisson). La couverture reste en place jusqu'au refroidissement de l'huile : retirée trop tôt, elle laisse revenir l'air sur une huile encore assez chaude pour se rallumer. L'eau projetée sur l'huile en feu se vaporise d'un coup et projette une boule de feu ; la farine jetée en nuage peut s'enflammer à son tour et ne refroidit pas le bain.",
    source: "INRS, ED 933 (restauration rapide) et ED 6054 (extincteurs) ; norme NF EN 2 (classe F) ; norme NF EN 1869 (couvertures anti-feu)",
  },
  {
    code: "c06", domaine: "hygiene_produits", competence: "06 · Réception des marchandises",
    intitule: "À la livraison, la sonde glissée entre deux sachets de frites surgelées affiche -12 °C. Que faites-vous ?",
    choix: [
      "Vous refusez le lot et le notez : il dépasse la tolérance du transport, fixée à -15 °C",
      "Vous acceptez le lot : un surgelé reste conforme tant qu'il est dur au toucher",
      "Vous refusez le lot : un surgelé doit être livré à -25 °C ou plus froid",
      "Vous acceptez le lot et le rangez aussitôt au congélateur pour le ramener à -18 °C",
    ],
    correct: 0,
    explication: "Les surgelés se conservent à -18 °C ou plus froid ; pendant le transport, seules de brèves remontées de 3 °C au plus sont tolérées, soit -15 °C. À -12 °C, la chaîne du froid a été rompue : le lot est refusé, le motif noté sur le bon de livraison et le responsable prévenu. Un produit encore dur au toucher peut avoir commencé à décongeler, et le recongeler ne fait pas disparaître les micro-organismes qui se sont multipliés.",
    source: "Arrêté du 21 décembre 2009, annexe I (-18 °C) ; directive 89/108/CEE, article 5, et décret n° 64-949 du 9 septembre 1964 modifié (brèves remontées de 3 °C au plus pendant le transport)",
  },
  {
    code: "c07", domaine: "hygiene_produits", competence: "07 · Stockage et gestion des produits",
    intitule: "Vous rangez une livraison de steaks hachés frais réfrigérés. Quelle température maximale de conservation devez-vous respecter ?",
    choix: [
      "+8 °C",
      "+2 °C",
      "+4 °C",
      "+6 °C",
    ],
    correct: 1,
    explication: "Les viandes hachées se conservent à +2 °C au maximum. Le seuil de +4 °C s'applique notamment aux préparations de viandes, aux volailles et aux autres denrées très périssables ; +8 °C aux denrées simplement périssables.",
    source: "Arrêté du 21 décembre 2009, annexe I ; règlement (CE) 853/2004, annexe III, section V",
  },
  {
    code: "c08", domaine: "hygiene_produits", competence: "08 · Mise en place des postes de production",
    intitule: "Vous rangez le réfrigérateur de votre poste, de l'étagère du haut vers celle du bas. Quel ordre évite qu'un produit en contamine un autre ?",
    choix: [
      "Viandes crues, crudités lavées, sauces et fromage râpé",
      "Crudités lavées, viandes crues, sauces et fromage râpé",
      "Sauces et fromage râpé, crudités lavées, viandes crues",
      "Sauces et fromage râpé, viandes crues, crudités lavées",
    ],
    correct: 2,
    explication: "Les viandes crues se rangent tout en bas, pour que leur jus ne puisse jamais goutter sur un produit qui ne sera plus cuit ; les produits prêts à consommer, sauces, fromage râpé et crudités lavées, sont au-dessus. Ranger les crudités en bas, comme dans le bac à légumes d'un réfrigérateur domestique, les place sous la viande crue.",
    source: "Règlement (CE) 852/2004, annexe II, chapitre IX, point 3 ; guide de bonnes pratiques d'hygiène « Restaurateur » (marche en avant, séparation cru et prêt à consommer)",
  },

  // ── C · Production et standards du concept tacos ──
  {
    code: "c09", domaine: "production", competence: "09 · Maîtrise des fiches recettes et standards de l'enseigne",
    intitule: "Votre fiche technique prévoit 120 g de viande pour un tacos M, et une fois et demie cette quantité pour un L. Pour une commande de 2 M et 3 L, quelle quantité de viande préparez-vous ?",
    choix: [
      "600 g",
      "780 g",
      "900 g",
      "960 g",
    ],
    correct: 1,
    explication: "Un L reçoit 120 × 1,5 = 180 g. Deux M font 240 g et trois L 540 g, soit 780 g. 600 g revient à tout compter en M, 900 g à tout compter en L, 960 g à lire « une fois et demie » comme « le double ». Appliquer la fiche au gramme près garantit un produit identique d'un restaurant à l'autre et la maîtrise du coût matière. Les grammages de cette question sont fictifs.",
    source: "Fiche technique (exemple chiffré)",
  },
  {
    code: "c10", domaine: "production", competence: "10 · Préparation des sauces et garnitures",
    intitule: "Vous ouvrez le 10/03 un seau de sauce. Il porte une DLC au 12/03 et la mention « après ouverture, à conserver entre 0 et +4 °C et à consommer sous 5 jours ». Quelle date limite inscrivez-vous sur le bac ?",
    choix: [
      "Le 11/03",
      "Le 15/03",
      "Le 12/03",
      "Le 17/03",
    ],
    correct: 2,
    explication: "Après ouverture, la durée annoncée par le fabricant s'applique : cinq jours mènent au 15/03. Mais la date limite inscrite sur le bac ne peut jamais dépasser la date d'origine du produit : la DLC du 12/03 l'emporte. On étiquette donc le bac avec la date d'ouverture et la date limite du 12/03.",
    source: "Règlement (UE) 1169/2011, article 25, paragraphe 2 ; plan de maîtrise sanitaire (étiquetage interne et traçabilité)",
  },
  {
    code: "c11", domaine: "production", competence: "11 · Gestion des produits chauds",
    intitule: "Vous cuisez à la plancha un steak haché de bœuf destiné à un tacos. Quel contrôle garantit une cuisson à cœur conforme aux recommandations sanitaires ?",
    choix: [
      "Sonde à cœur : 63 °C, température réglementaire des plats chauds",
      "Surface bien colorée des deux côtés et jus clair à la pression",
      "Sonde au point le plus épais : 70 °C minimum à cœur",
      "Sonde à cœur : 55 °C, le centre peut rester rosé",
    ],
    correct: 2,
    explication: "L'ANSES recommande de cuire à cœur à 70 °C les viandes hachées pour les populations sensibles (jeunes enfants, personnes âgées) : les E. coli entérohémorragiques sont répartis dans toute la masse hachée et non en surface comme sur une pièce entière. Un restaurant ne connaissant pas ses clients retient ce repère. 63 °C est la température minimale de maintien au chaud, pas une température de cuisson. L'aspect extérieur et la couleur du jus ne garantissent rien : seule la sonde au point le plus épais fait foi.",
    source: "ANSES, « Que sont les E. coli entérohémorragiques (EHEC) et comment s'en prémunir ? » ; arrêté du 21 décembre 2009, annexe IV (+63 °C)",
  },
  {
    code: "c12", domaine: "production", competence: "12 · Utilisation de la friteuse",
    intitule: "Le testeur d'huile de la friteuse affiche 27 % de composés polaires en plein service. Que faites-vous ?",
    choix: [
      "Vous vidangez et remplacez le bain immédiatement, sans attendre la fin du service",
      "Vous filtrez le bain et le complétez d'huile neuve pour finir le service",
      "Vous baissez la friteuse à 160 °C et changez l'huile à la fermeture",
      "Vous poursuivez le service, l'huile n'est impropre qu'au-delà de 30 %",
    ],
    correct: 0,
    explication: "Le décret n° 2008-184 du 26 février 2008 (article 8) répute impropres à la consommation humaine les huiles dont la teneur en composés polaires dépasse 25 %. À 27 %, le bain est vidangé et remplacé sans attendre. Filtrer retire les particules, pas les composés polaires ; baisser la température n'y change rien ; couper une huile devenue impropre avec de l'huile neuve revient à continuer de l'utiliser. L'établissement s'expose à une sanction lors d'un contrôle.",
    source: "Décret n° 2008-184 du 26 février 2008, article 8",
  },
  {
    code: "c13", domaine: "production", competence: "13 · Assemblage d'un tacos ou produit snacking",
    intitule: "Ticket : « Tacos M poulet, SANS fromage, client allergique au lait ». Vous avez changé de gants, pris des ustensiles propres et vérifié la composition de chaque ingrédient. Quelle source de lait reste à maîtriser ?",
    choix: [
      "La galette de blé, dont la pâte contient toujours du lait écrémé",
      "Les plaques de la presse, où a fondu le fromage des tacos précédents",
      "La cuisson du poulet, qui fait apparaître du lactose dans la viande",
      "Le pliage de la galette, qui fait remonter son lactose dans la garniture",
    ],
    correct: 1,
    explication: "Le lait est l'un des 14 allergènes à déclaration obligatoire. Gants, ustensiles et composition des ingrédients maîtrisés, il reste le matériel partagé : les plaques de la presse gardent du fromage fondu des tacos précédents, qui passe sur la galette. On applique alors la procédure allergènes de l'enseigne (plaques nettoyées avant la cuisson ou autre moyen de cuisson), sinon le client est informé que le risque ne peut pas être exclu. Une galette de blé ne contient pas forcément de lait, et sa composition a été vérifiée ; le lactose ne se forme ni à la cuisson d'une viande ni au pliage.",
    source: "Règlement (UE) 1169/2011, annexe II ; décret n° 2015-447 du 17 avril 2015",
  },
  {
    code: "c14", domaine: "production", competence: "14 · Technique de pliage",
    intitule: "Au pliage, plusieurs galettes se fendent sur les bords alors que les grammages de la fiche sont respectés. Quelle action corrige le défaut ?",
    choix: [
      "Humidifier les bords à l'eau froide avant de plier, pour les coller",
      "Ajouter une couche de sauce sur les bords, pour souder les plis",
      "Serrer davantage les plis, pour comprimer la garniture au centre",
      "Tiédir brièvement la galette avant de la garnir, pour l'assouplir",
    ],
    correct: 3,
    explication: "Une galette de blé froide ou desséchée est cassante. Quelques secondes de chaleur, selon la procédure de l'enseigne (plancha, presse ou chauffe-galette), la rendent souple et elle se plie sans se fendre. L'eau et la sauce détrempent la pâte et empêchent la fermeture de tenir à la presse ; serrer davantage tend la galette et aggrave les déchirures.",
    source: "Gestes professionnels de production des concepts tacos (préparation de la galette avant pliage)",
  },
  {
    code: "c15", domaine: "production", competence: "15 · Utilisation de la presse",
    intitule: "Plusieurs tacos sortent de la presse pâles, et leur fermeture s'ouvre, alors que le temps de passage de la fiche est respecté. Que vérifiez-vous en premier ?",
    choix: [
      "La température réelle des plaques et le voyant de chauffe de la presse",
      "Le grammage de la garniture, un excès empêchant la galette de colorer",
      "La date des galettes, une galette de la veille ne dorant plus",
      "Le temps de passage, une cuisson trop longue faisant pâlir la galette",
    ],
    correct: 0,
    explication: "Le temps de passage de la fiche suppose des plaques à température. Une presse allumée trop tard, mal réglée ou défaillante ne colore pas le produit et ne soude pas la fermeture : on vérifie d'abord la température des plaques et le voyant de chauffe, et on signale une panne. Une garniture trop abondante gêne la fermeture sans empêcher la galette de dorer, une galette de la veille dore encore, et une cuisson trop longue colore davantage au lieu de pâlir.",
    source: "Procédure d'utilisation de la presse (temps de chauffe, temps de passage, contrôle de la coloration)",
  },
  {
    code: "c16", domaine: "production", competence: "16 · Gestion des gratinés et de la salamandre",
    intitule: "Vous passez sous la salamandre un tacos XL, nettement plus épais qu'un M, sans changer ni le gradin de la grille ni le temps de passage. À quoi devez-vous vous attendre ?",
    choix: [
      "Le fromage colore plus lentement : un produit plus épais absorbe davantage de chaleur",
      "Le fromage colore au même rythme : seul le temps de passage règle le gratinage",
      "Le fromage colore plus vite : le dessus est plus proche des résistances",
      "Le dessous du tacos brûle : la salamandre chauffe surtout par la grille du bas",
    ],
    correct: 2,
    explication: "La salamandre gratine par rayonnement, par le dessus : plus la surface du produit est proche des éléments chauffants, plus le fromage colore vite, jusqu'à brûler. Un produit plus épais rapproche sa surface des résistances : on descend la grille d'un gradin ou on raccourcit le passage. La salamandre ne chauffe pas par la grille du bas, et le temps de passage n'est pas le seul réglage.",
    source: "Procédure d'utilisation de la salamandre (réglage de la hauteur de grille, temps de passage)",
  },
  {
    code: "c17", domaine: "production", competence: "17 · Finalisation et contrôle qualité",
    intitule: "Au contrôle final, un tacos commandé « sans oignons » (préférence du client, pas une allergie) en contient. Le client attend depuis huit minutes. Que faites-vous ?",
    choix: [
      "Vous retirez les oignons à la pince, repassez le tacos en presse et prévenez le client",
      "Vous le servez en expliquant l'erreur au client et lui offrez une boisson en dédommagement",
      "Vous le faites refaire en priorité et prévenez le client du court délai supplémentaire",
      "Vous le servez sans commentaire : une mention « sans » n'engage que pour une allergie",
    ],
    correct: 2,
    explication: "Un produit qui ne correspond pas au ticket se refait avant la remise : c'est le rôle du contrôle final. Retirer les oignons laisse leur goût et des morceaux dans la garniture ; un geste commercial relève du manager et ne rend pas le produit conforme ; et une personnalisation demandée par le client est due, allergie ou non. Prévenir le client du délai évite qu'il attende sans savoir.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétence 17 (faire refaire un produit non conforme)",
  },
  {
    code: "c18", domaine: "production", competence: "18 · Emballage et préparation de la commande",
    intitule: "Commande à emporter : deux tacos, une grande frite, deux boissons froides et un dessert glacé. Comment préparez-vous la remise ?",
    choix: [
      "Tout dans un même sac, boissons calées au fond, puis tacos, frite et dessert glacé par-dessus",
      "Boissons et dessert glacé dans un sac à part, tacos et frite ensemble, frite placée au fond en premier",
      "Tacos, frite et boissons dans un même sac, le dessert glacé remis à part dans un petit sac",
      "Boissons et dessert glacé dans un sac à part, tacos et frite ensemble, frite ajoutée en dernier",
    ],
    correct: 3,
    explication: "On sépare le chaud du froid : le dessert fond et les boissons tiédissent au contact des produits chauds, et la condensation détrempe les emballages. Les boissons calées à part ne se renversent pas et n'écrasent rien. La frite, qui ramollit le plus vite, est ajoutée en dernier, sur le dessus : placée au fond, elle est écrasée par les tacos et ramollit dans leur vapeur.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétence 18 (préserver la température, éviter écrasement et renversement)",
  },
  {
    code: "c19", domaine: "production", competence: "19 · Lecture et gestion des tickets",
    intitule: "Un ticket comprend un tacos gratiné (assemblage 1 min, presse 3 min, salamandre 1 min) et une frite (cuisson 3 min, égouttage et salage 1 min). Quand lancez-vous la frite pour que tout soit prêt au même moment ?",
    choix: [
      "Dès l'arrivée du ticket, en même temps que l'assemblage du tacos",
      "Au moment où le tacos entre dans la presse",
      "À mi-temps de la presse, une minute et demie après son entrée",
      "Au moment où le tacos passe sous la salamandre",
    ],
    correct: 1,
    explication: "Le tacos demande 5 minutes (1 + 3 + 1) et la frite 4 minutes (3 + 1) : la frite part donc une minute après le ticket, quand le tacos entre dans la presse, et les deux sont prêts ensemble à la cinquième minute. Lancée dès le ticket, la frite attend et ramollit ; lancée plus tard, c'est le tacos qui refroidit et le client qui attend.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétence 19 (organiser plusieurs tickets, coordonner les postes)",
  },

  // ── D · Accueil, commande et expérience client ──
  {
    code: "c20", domaine: "accueil_client", competence: "20 · Accueil du client",
    intitule: "Un client demande si votre tacos contient de la moutarde. Que prévoit la réglementation française pour l'information sur les allergènes en restauration ?",
    choix: [
      "Une information écrite, sur le menu ou un document signalé au client, portant sur les 14 allergènes",
      "Une information orale, donnée par un équipier qui connaît les recettes, portant sur les 14 allergènes",
      "Une information écrite, sur le menu ou un document signalé au client, limitée aux 9 allergènes majeurs",
      "Une information orale, donnée par un équipier qui connaît les recettes, limitée aux 9 allergènes majeurs",
    ],
    correct: 0,
    explication: "Le règlement (UE) 1169/2011 (annexe II) liste 14 allergènes à déclaration obligatoire, dont la moutarde ; la liste de 9 allergènes majeurs est celle des États-Unis, qui ne comprend pas la moutarde. En France, le décret n° 2015-447 du 17 avril 2015 (articles R412-12 et suivants du Code de la consommation) impose en restauration une information écrite : sur le menu ou sur un document tenu à disposition, le client étant informé par affichage de son existence. Une réponse orale seule ne suffit pas.",
    source: "Règlement (UE) 1169/2011, annexe II ; décret n° 2015-447 du 17 avril 2015 ; Code de la consommation, art. R412-12 à R412-16 (repas sur place : art. R412-14)",
  },
  {
    code: "c21", domaine: "accueil_client", competence: "21 · Prise de commande",
    intitule: "Le menu (tacos, frite, boisson) coûte 11,90 € et le tacos seul 8,50 €. Le supplément gratiné coûte 1,00 € par tacos. Un client prend 2 menus et 1 tacos seul, les trois gratinés. Quel montant lui annoncez-vous ?",
    choix: [
      "33,30 €",
      "34,30 €",
      "35,30 €",
      "36,30 €",
    ],
    correct: 2,
    explication: "2 menus font 23,80 €, le tacos seul 8,50 €, soit 32,30 € ; les trois suppléments ajoutent 3,00 €, total 35,30 €. Annoncer le bon montant avant validation évite une annulation en caisse et un écart de caisse en fin de service. Les prix de cette question sont fictifs.",
    source: "Exemple chiffré (calcul d'une commande avec suppléments)",
  },
  {
    code: "c22", domaine: "accueil_client", competence: "22 · Maîtrise de la caisse",
    intitule: "Commande de 21,30 €. Le client règle avec deux titres-restaurant papier de 11,50 € chacun et vous demande sa monnaie. Quel montant lui rendez-vous ?",
    choix: [
      "1,70 €",
      "0,00 €",
      "9,80 €",
      "3,70 €",
    ],
    correct: 1,
    explication: "Les deux titres couvrent 23,00 € pour 21,30 € dus, mais un titre-restaurant papier ne donne pas lieu à rendu de monnaie : la Commission nationale des titres-restaurant rappelle que cette pratique n'est pas tolérée. Le surplus de 1,70 € est perdu ; pour l'éviter, on propose au client de régler les 9,80 € restants autrement qu'avec le second titre. Le plafond journalier de 25 € est respecté.",
    source: "CNTR, foire aux questions des commerçants (réponse ministérielle n° 21664 de 1985) ; Code du travail, art. R3262-10 (plafond de 25 €, décret n° 2022-1266 du 29 septembre 2022)",
  },
  {
    code: "c23", domaine: "accueil_client", competence: "23 · Bornes et outils numériques",
    intitule: "À la borne, un client a choisi « payer au comptoir » et se présente à la caisse avec son numéro de commande. Que faites-vous ?",
    choix: [
      "Vous rappelez sa commande par son numéro en caisse et l'encaissez, sans la ressaisir",
      "Vous ressaisissez sa commande en caisse à partir de son ticket, puis l'encaissez",
      "Vous encaissez à la main le montant inscrit sur son ticket, sans rappeler la commande",
      "Vous l'invitez à repasser à la borne et à choisir cette fois le paiement par carte",
    ],
    correct: 0,
    explication: "La commande existe déjà dans le système, en attente de paiement : on la rappelle par son numéro et on l'encaisse. La ressaisir crée un doublon (produit fabriqué deux fois, écart de caisse) ; encaisser un montant à la main laisse la commande impayée dans le système et fausse la caisse ; renvoyer le client à la borne lui fait perdre du temps pour rien.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétence 23 (identifier une commande issue d'une borne)",
  },
  {
    code: "c24", domaine: "accueil_client", competence: "24 · Service et remise de commande",
    intitule: "Un livreur demande « la commande de Karim ». Deux commandes passées sur la même plateforme au nom de Karim sont prêtes. Que lui demandez-vous avant de remettre la commande ?",
    choix: [
      "Le nom de famille du client, pour départager les deux Karim",
      "Le contenu de la commande, pour la reconnaître",
      "L'heure de la commande, pour remettre celle qui correspond",
      "Le code ou le numéro de commande affiché sur son application",
    ],
    correct: 3,
    explication: "Chaque commande de plateforme porte un numéro ou un code que le livreur affiche sur son application : c'est lui qui garantit de remettre la bonne commande au bon livreur. Le livreur ne connaît pas toujours le nom de famille ni le contenu, et deux commandes peuvent avoir été passées à quelques minutes d'intervalle ; une commande remise au mauvais livreur est perdue et remboursée.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétence 24 (remettre la bonne commande au bon client)",
  },
  {
    code: "c25", domaine: "accueil_client", competence: "25 · Travail en salle",
    intitule: "Un client mange sur place dans un restaurant rapide de 40 places assises. Depuis le 1er janvier 2023, comment ses boissons et son repas doivent-ils lui être servis ?",
    choix: [
      "Dans des emballages en carton recyclable, à trier ensuite en salle",
      "Dans de la vaisselle réemployable, verres et couverts compris",
      "Dans des emballages compostables, au choix de l'établissement",
      "Dans les emballages de vente à emporter, si le client les accepte",
    ],
    correct: 1,
    explication: "Depuis le 1er janvier 2023, les établissements de restauration, dont la restauration rapide, qui peuvent restaurer simultanément au moins vingt personnes servent les repas et boissons consommés sur place dans de la vaisselle et avec des couverts réemployables. Le carton recyclable ou compostable reste réservé à la vente à emporter.",
    source: "Code de l'environnement, art. L541-15-10, III (loi n° 2020-105 du 10 février 2020, art. 77) et art. D541-342 (décret n° 2020-1724 du 28 décembre 2020)",
  },
  {
    code: "c26", domaine: "accueil_client", competence: "26 · Gestion d'une réclamation simple",
    intitule: "Un client revient au comptoir : il a trouvé un petit morceau de plastique dur dans son tacos entamé. Le manager est en réserve. Que faites-vous du tacos ?",
    choix: [
      "Vous le gardez à part, emballé et identifié, pour le manager, et faites refaire un tacos",
      "Vous le jetez aussitôt pour que personne ne le manipule plus, puis faites refaire un tacos",
      "Vous le rendez au client avec le morceau de plastique, pour qu'il puisse porter plainte",
      "Vous retirez le morceau de plastique devant lui et lui proposez de finir son tacos",
    ],
    correct: 0,
    explication: "Un corps étranger est une non-conformité à traiter selon le plan de maîtrise sanitaire : le produit et le morceau sont conservés à part, emballés et identifiés, pour que le manager recherche l'origine (emballage, matériel, livraison) et vérifie les autres produits du même lot. Jeter le tacos détruit la preuve ; le rendre au client ou retirer le plastique devant lui ne règle rien. Le client est servi à nouveau et le manager prévenu tout de suite.",
    source: "Plan de maîtrise sanitaire (gestion des non-conformités et des réclamations) ; règlement (CE) 178/2002, articles 18 et 19 (traçabilité, retrait des denrées)",
  },

  // ── E · Service, polyvalence et tenue du restaurant ──
  {
    code: "c27", domaine: "service_tenue", competence: "27 · Travail en période de rush",
    intitule: "En plein rush, vous passez de la caisse, où vous avez rendu de la monnaie, au poste d'assemblage. Que faites-vous avant de toucher les aliments ?",
    choix: [
      "Vous enfilez une nouvelle paire de gants à usage unique, sans autre geste",
      "Vous gardez vos gants : ils ont touché la monnaie, pas les aliments",
      "Vous retirez vos gants, rincez vos mains à l'eau claire, puis enfilez des gants neufs",
      "Vous retirez vos gants, lavez vos mains au savon, puis enfilez des gants neufs",
    ],
    correct: 3,
    explication: "L'argent et les écrans de caisse sont très contaminés. Les gants ne remplacent pas le lavage des mains : enfiler des gants neufs sur des mains sales les contamine dès la pose, et un rinçage à l'eau claire n'enlève pas les germes. Au changement de tâche, on retire ses gants, on se lave les mains au savon puis on met des gants neufs, même en plein rush.",
    source: "Règlement (CE) 852/2004, annexe II, chapitre VIII ; guide de bonnes pratiques d'hygiène « Restaurateur »",
  },
  {
    code: "c28", domaine: "service_tenue", competence: "28 · Coordination avec les autres postes",
    intitule: "En plein service, il ne reste du poulet cuit que pour trois tacos et la prochaine cuisson sera prête dans 15 minutes. Que faites-vous ?",
    choix: [
      "Vous prévenez la caisse quand le bac sera vide, pour ne pas freiner les ventes en cours",
      "Vous prévenez les clients au passe, au fur et à mesure que leurs commandes poulet arrivent",
      "Vous prévenez tout de suite le responsable et la caisse, qui annoncent le délai aux clients",
      "Vous lancez deux cuissons à la fois pour rattraper le retard, sans changer les ventes",
    ],
    correct: 2,
    explication: "Une rupture annoncée tôt se gère ; découverte au passe, elle fait attendre des clients déjà encaissés. Prévenir tout de suite le responsable et la caisse leur permet d'annoncer le délai, de proposer une autre viande ou de suspendre la vente du poulet le temps de la cuisson. Prévenir les clients un par un au passe arrive trop tard, et doubler les cuissons ne raccourcit pas les 15 minutes.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétence 28 (coordination avec les autres postes)",
  },
  {
    code: "c29", domaine: "service_tenue", competence: "29 · Polyvalence et rotation des postes",
    intitule: "Vous reprenez la caisse d'un collègue en cours de journée. Que faites-vous avant votre premier encaissement ?",
    choix: [
      "Vous comptez la caisse avec votre collègue, puis encaissez sous sa session pour ne pas couper le service",
      "Vous ouvrez votre session, puis comptez seul la caisse quand votre collègue est parti en pause",
      "Vous ouvrez votre session et encaissez : un écart éventuel sera partagé entre vous deux à la fermeture",
      "Vous comptez la caisse avec votre collègue, ou prenez votre tiroir, puis ouvrez votre session",
    ],
    correct: 3,
    explication: "Chaque encaissement doit être rattaché à la personne qui l'a fait. Un comptage à deux à la passation, ou un tiroir propre à chacun, sépare les responsabilités en cas d'écart, puis on ouvre sa propre session. Encaisser sous la session d'un collègue, compter seul après son départ ou partager un écart à la fermeture rend tout écart inexplicable.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétences 22 et 28 (se connecter au système, transmettre lors d'un changement de poste)",
  },
  {
    code: "c30", domaine: "service_tenue", competence: "30 · Réassort en cours de service",
    intitule: "Mise en place le 16/09 : bac A de salade ouvert le 15/09 (DLC secondaire 17/09), bac B fermé avec DLC au 16/09. Lequel utilisez-vous en premier ?",
    choix: [
      "Indifférent : les deux bacs sont conformes le 16/09, vous prenez le plus accessible",
      "Le bac B, sa DLC du 16/09 est la plus proche : il doit être consommé aujourd'hui",
      "Le bac A, un produit entamé passe toujours avant un produit fermé",
      "Le bac A, vous jetez le bac B dont la DLC tombe le jour même",
    ],
    correct: 1,
    explication: "La rotation se fait sur la date limite la plus proche (premier périmé, premier sorti) : le bac B est consommable jusqu'au 16/09 inclus, le bac A jusqu'au 17/09. Un produit entamé ne passe pas automatiquement avant un produit fermé : c'est la date qui commande. Prendre « le plus accessible » ou jeter un produit encore conforme conduit à perdre le bac B, qui ne sera plus utilisable demain, alors que le bac A le sera encore.",
    source: "Plan de maîtrise sanitaire (rotation des stocks, premier périmé premier sorti)",
  },
  {
    code: "c31", domaine: "service_tenue", competence: "31 · Nettoyage en cours de production",
    intitule: "L'étiquette du désinfectant de votre poste indique « temps de contact : 5 minutes ». Que désigne cette mention ?",
    choix: [
      "Le délai maximal avant de rincer, pour ne pas abîmer la surface traitée",
      "La durée pendant laquelle la surface reste désinfectée après le passage",
      "La durée minimale pendant laquelle le produit doit agir pour être efficace",
      "Le délai avant de pouvoir toucher la surface traitée sans gants",
    ],
    correct: 2,
    explication: "Le temps de contact est la durée minimale pendant laquelle le désinfectant doit rester sur la surface pour détruire les micro-organismes, celle pour laquelle son efficacité a été testée. Essuyer ou rincer avant ce délai rend la désinfection inefficace. Une surface ne reste pas désinfectée après le passage : elle se recontamine à l'usage. Quand l'étiquette le prévoit, on rince ensuite à l'eau potable les surfaces en contact avec les aliments.",
    source: "Règlement (UE) 528/2012, article 69 (étiquetage des biocides) ; normes NF EN 1276 et NF EN 13697 (efficacité bactéricide, temps de contact) ; plan de nettoyage et de désinfection du PMS",
  },
  {
    code: "c32", domaine: "service_tenue", competence: "32 · Nettoyage et désinfection",
    intitule: "Vous traitez le plan de travail avec un détergent et un désinfectant vendus séparément, tous deux à rincer. Dans quel ordre procédez-vous ?",
    choix: [
      "Désinfectant, rinçage, détergent, rinçage",
      "Détergent et désinfectant mélangés, rinçage",
      "Désinfectant, temps de contact, détergent, séchage",
      "Détergent, rinçage, désinfectant, rinçage",
    ],
    correct: 3,
    explication: "Le détergent enlève les salissures et les graisses ; le rinçage évacue ses résidus, qui gêneraient l'action du désinfectant ; le désinfectant agit ensuite pendant son temps de contact sur une surface propre, puis on rince les surfaces au contact des aliments. Désinfecter une surface sale est inefficace. On ne mélange jamais deux produits : l'eau de Javel mélangée à un acide dégage du chlore, gaz toxique.",
    source: "Plan de nettoyage et de désinfection du PMS ; guide de bonnes pratiques d'hygiène « Restaurateur » ; INRS, fiche toxicologique FT 157 (eaux de Javel)",
  },
  {
    code: "c33", domaine: "service_tenue", competence: "33 · Gestion des déchets",
    intitule: "Depuis le 1er janvier 2024, que prévoit la réglementation pour les restes alimentaires et les épluchures produits par le restaurant ?",
    choix: [
      "Ils sont triés à part, pour être collectés puis compostés ou méthanisés",
      "Ils sont jetés avec les ordures ménagères, le tri ne visant que les emballages",
      "Ils sont triés à part seulement au-delà de 10 tonnes produites par an",
      "Ils sont broyés et évacués à l'évier, pour éviter de les stocker",
    ],
    correct: 0,
    explication: "Depuis le 1er janvier 2024, tous les producteurs de biodéchets, restaurants compris et sans seuil de quantité, les trient à la source pour qu'ils soient valorisés. Le seuil de 10 tonnes par an était celui de 2016, abaissé ensuite. Évacuer des déchets alimentaires broyés dans les canalisations est interdit.",
    source: "Code de l'environnement, art. L541-21-1 (en vigueur au 31 décembre 2023) ; loi n° 2020-105 du 10 février 2020 (AGEC) ; règlement (UE) n° 142/2011 et réponse ministérielle n° 3044, JO AN du 5 mars 2019 (broyeurs d'évier)",
  },
  {
    code: "c34", domaine: "service_tenue", competence: "34 · Maîtrise du gaspillage et des coûts",
    intitule: "La fiche technique prévoit 30 g de fromage par tacos. Vous en mettez 45 g, sur 200 tacos par semaine, et le fromage coûte 12 € le kilo. Quel surcoût cela représente-t-il chaque semaine ?",
    choix: [
      "3,60 €",
      "36,00 €",
      "72,00 €",
      "108,00 €",
    ],
    correct: 1,
    explication: "15 g de trop par tacos × 200 tacos = 3 kg de fromage, soit 3 × 12 € = 36 € par semaine, près de 1 900 € par an pour un seul ingrédient d'un seul restaurant. 72 € est le coût du fromage dosé selon la fiche, 108 € celui du fromage surdosé.",
    source: "Exemple chiffré (coût matière et surdosage)",
  },
  {
    code: "c35", domaine: "service_tenue", competence: "35 · Gestion des aléas",
    intitule: "En plein service, un collègue se brûle l'avant-bras contre la plaque de la presse. Quel est le premier geste ?",
    choix: [
      "Refroidir aussitôt sous l'eau courante tempérée, pendant au moins dix minutes",
      "Appliquer des glaçons directement sur la brûlure, quelques minutes",
      "Passer sous l'eau froide quelques secondes, puis appliquer un corps gras",
      "Couvrir aussitôt d'un pansement serré, pour isoler la brûlure de l'air",
    ],
    correct: 0,
    explication: "Une brûlure se refroidit le plus tôt possible sous l'eau courante tempérée, pendant au moins dix minutes : cela limite son extension et sa profondeur et calme la douleur. La glace appliquée directement aggrave les lésions ; un corps gras retient la chaleur ; un pansement serré comprime la zone et colle à la plaie. On prévient ensuite le responsable ou le sauveteur secouriste du travail, qui juge s'il faut un avis médical.",
    source: "Recommandations françaises de premiers secours (PSC 1, sauvetage secourisme du travail), conduite à tenir face à une brûlure thermique",
  },
  {
    code: "c36", domaine: "service_tenue", competence: "36 · Fermeture du restaurant",
    intitule: "À la fermeture, il reste deux kilos de viande hachée cuite d'avance, remise en température pour le service de midi et maintenue à 63 °C depuis. Que devez-vous en faire ?",
    choix: [
      "La congeler en portions pour un service ultérieur",
      "La conserver trois jours en chambre froide avec une étiquette datée",
      "L'éliminer en fin de service, sans la réutiliser",
      "La refroidir rapidement en cellule et la resservir le lendemain midi",
    ],
    correct: 2,
    explication: "Les denrées remises en température doivent être consommées le jour de leur première remise en température. Un second cycle de refroidissement, une conservation au froid ou une congélation sont donc exclus : les restes sont éliminés, même s'ils ont été maintenus à +63 °C ou plus.",
    source: "Arrêté du 21 décembre 2009, annexe IV (restauration collective), règle reprise par le guide de bonnes pratiques d'hygiène « Restaurateur »",
  },

  // ── F · Posture professionnelle et autonomie ──
  {
    code: "c37", domaine: "posture_autonomie", competence: "37 · Communication professionnelle",
    intitule: "À 14 h, la vitrine réfrigérée affichait +9 °C ; vous avez isolé les produits et elle est revenue à +3 °C. Comment transmettez-vous l'information à l'équipe du soir ?",
    choix: [
      "Par écrit dans le relevé du PMS, avec l'action menée, et en prévenant le responsable",
      "Par oral au collègue du soir, puis par un message sur le groupe de discussion de l'équipe",
      "Par écrit dans le relevé du PMS, en y portant seulement la valeur revenue à +3 °C",
      "Par écrit sur une note collée à la vitrine, et en prévenant le collègue du soir",
    ],
    correct: 0,
    explication: "Une non-conformité et l'action corrective menée s'enregistrent dans le support prévu par le plan de maîtrise sanitaire, consultable par toute l'équipe et par les services de contrôle ; le responsable, prévenu, décide de la suite (sort des produits, maintenance). Noter seulement la valeur revenue dans la norme efface l'incident ; une information orale, un message ou une note volante se perd et ne laisse aucune trace exploitable.",
    source: "Règlement (CE) 852/2004, article 5 (procédures fondées sur l'HACCP, documents et enregistrements) ; plan de maîtrise sanitaire",
  },
  {
    code: "c38", domaine: "posture_autonomie", competence: "38 · Posture professionnelle",
    intitule: "À 17 h, vous vous rendez compte que le relevé de température de 15 h n'a pas été fait. Que faites-vous ?",
    choix: [
      "Vous relevez la température et la notez dans la case de 15 h, la mesure étant réelle",
      "Vous laissez la case de 15 h vide et attendez le relevé suivant, prévu à 19 h",
      "Vous relevez la température, la notez à 17 h et barrez la case de 15 h sans commentaire",
      "Vous relevez la température, la notez à 17 h avec l'oubli et prévenez le responsable",
    ],
    correct: 3,
    explication: "Un enregistrement du PMS doit refléter ce qui a réellement été mesuré, à l'heure réelle : porter une mesure de 17 h dans la case de 15 h fausse le document, même si la valeur est vraie, ce qui peut être sanctionné lors d'un contrôle. On fait le relevé tout de suite, on l'inscrit à 17 h en mentionnant l'oubli, et on prévient le responsable, qui vérifie les produits concernés. Barrer sans explication ou attendre le relevé suivant masque l'erreur.",
    source: "Référentiel des compétences de l'équipier polyvalent, compétence 38 (ne pas masquer une erreur) ; plan de maîtrise sanitaire (enregistrements)",
  },
  {
    code: "c39", domaine: "posture_autonomie", competence: "39 · Acquisition de la rapidité professionnelle",
    intitule: "Pour gagner en rapidité sans vous blesser, où placez-vous les ingrédients que vous utilisez le plus souvent à l'assemblage ?",
    choix: [
      "Au-dessus du plan, sur l'étagère à hauteur d'épaules, pour libérer la surface de travail",
      "Devant vous, à portée d'avant-bras, entre la hauteur de la taille et celle de la poitrine",
      "Sur les côtés, à portée de bras tendu, pour les attraper sans quitter le plan des yeux",
      "Sous le plan de travail, dans les tiroirs réfrigérés, jusqu'au moment du geste",
    ],
    correct: 1,
    explication: "La zone de travail la plus rapide et la moins fatigante se trouve devant soi, coudes près du corps, entre la taille et la poitrine. Les gestes bras tendus, au-dessus des épaules ou penché vers le bas sont plus lents et, répétés des centaines de fois par service, causent des troubles musculosquelettiques.",
    source: "INRS, ED 950 (conception des lieux et des situations de travail) et ED 6466 (sandwicherie, postures contraignantes)",
  },
  {
    code: "c40", domaine: "posture_autonomie", competence: "40 · Passage de l'exécution accompagnée à l'autonomie",
    intitule: "Vous tenez votre poste en autonomie. Laquelle de ces situations doit remonter au responsable, plutôt que d'être réglée à votre niveau ?",
    choix: [
      "Une sauce renversée au sol, nettoyée aussitôt, un panneau « sol glissant » posé",
      "Un client agacé par l'attente, que vous calmez en lui annonçant le délai restant",
      "Une erreur de sauce repérée au contrôle final, le produit étant refait avant l'envoi",
      "Un collègue qui a eu des diarrhées cette nuit et reprend à l'assemblage",
    ],
    correct: 3,
    explication: "Le règlement interdit de manipuler des denrées à toute personne qui souffre de diarrhée ou peut être porteuse d'une maladie transmissible par les aliments, même si elle se sent mieux : c'est au responsable, prévenu immédiatement, de décider de son poste. Les trois autres situations sont des écarts simples, qu'un équipier autonome règle seul ; savoir faire la différence et alerter au bon moment, c'est ce qui définit l'autonomie.",
    source: "Règlement (CE) 852/2004, annexe II, chapitre VIII, point 2 ; référentiel des compétences de l'équipier polyvalent, compétence 40 et échelle de maîtrise (niveau 4)",
  },
]

export const QUESTIONNAIRE_TACOS: Questionnaire = {
  code: 'tacos',
  titre: 'Équipier polyvalent, concepts tacos',
  referentiel: "Référentiel des compétences de l'équipier polyvalent en restauration rapide (concepts tacos : Chamas Tacos, New School Tacos), six domaines et quarante compétences",
  dureeMinutes: 30,
  domaines: [
    {
      code: 'prise_poste',
      libelle: 'Organisation de la prise de poste',
      competences: '01 à 02',
      part: 0.1,
      objectif: "Préparer l'activité, sécuriser l'ouverture et rendre le poste immédiatement opérationnel.",
    },
    {
      code: 'hygiene_produits',
      libelle: 'Hygiène, sécurité et gestion des produits',
      competences: '03 à 08',
      part: 0.175,
      plancher: 14,
      plancherMotif: "module d'hygiène alimentaire suivi en entier",
      objectif: "Maîtriser les exigences sanitaires, la prévention des risques, la réception, le stockage et la mise en place.",
    },
    {
      code: 'production',
      libelle: 'Production et standards du concept',
      competences: '09 à 19',
      part: 0.25,
      objectif: "Produire de façon reproductible, sûre et conforme aux fiches recettes, dosages, finitions et contrôles qualité.",
    },
    {
      code: 'accueil_client',
      libelle: 'Accueil, commande et expérience client',
      competences: '20 à 26',
      part: 0.1,
      objectif: "Assurer l'accueil, la prise de commande, l'encaissement, l'usage des outils numériques et la remise au client.",
    },
    {
      code: 'service_tenue',
      libelle: 'Service, polyvalence et tenue du restaurant',
      competences: '27 à 36',
      part: 0.2,
      objectif: "Maintenir la cadence, coopérer entre postes, réassortir, nettoyer, gérer les aléas et assurer la fermeture.",
    },
    {
      code: 'posture_autonomie',
      libelle: 'Posture professionnelle et autonomie',
      competences: '37 à 40',
      part: 0.175,
      plancher: 7,
      plancherMotif: 'évaluation finale et bilan individuel suivis en entier',
      objectif: "Communiquer efficacement, adopter la posture attendue, gagner en rapidité et tenir progressivement un poste en autonomie.",
    },
  ],
  questions: QUESTIONS,
}
