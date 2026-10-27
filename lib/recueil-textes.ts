/**
 * Phrases du recueil du besoin automatique (lib/recueil-auto.ts), écrites
 * comme des notes de chargée de formation après un échange avec le client.
 * Plusieurs façons de dire la même chose : le CRM en tire une par dossier
 * (toujours la même pour un dossier). Le fond reste celui de l'activité.
 *
 * Écrites le 27/10/2026 (trois voix : commerciale, chargée de formation,
 * formateur), relues pour chasser les tournures « IA » et les faits inventés.
 * Balises : {client} {qui} {besoin} {formation} {dates} {duree} {horaires}
 * {lieu} {modalite} {participants} {n} {prerequis} {nb_handicap} {objectifs}.
 * Règles pour en ajouter : aucun fait inventé (interlocuteur, échange,
 * contrôle, incident, chiffre), phrases courtes, apostrophe ’, pas de tiret
 * cadratin ; un besoin commence par un infinitif en minuscule (consonne).
 */
export type SujetRecueil =
  | 'nettoyage' | 'allergenes' | 'tracabilite' | 'pms' | 'hygiene' | 'duerp' | 'sst'
  | 'incendie' | 'gestes' | 'prevention' | 'gestion' | 'vente' | 'management' | 'metier'
  | 'ia' | 'outils' | 'administratif'

export const TEXTES = {
  contexte: [
    "Demande pour {qui} : {besoin}. Nous partons sur la formation « {formation} », {modalite}, {dates}.",
    "La formation « {formation} » aura lieu {dates} pour {qui}. Elle doit servir à {besoin}.",
    "Formation demandée par {qui}, qui souhaite {besoin}. Programme retenu : {formation}, {dates}.",
    "Nous intervenons {dates} pour {qui}, sur la formation « {formation} ». Le but pour eux : {besoin}.",
    "Session {dates} sur « {formation} », {modalite}, pour {qui}. L’établissement veut {besoin}.",
    "Le dossier concerne {qui}. Il s’agit de {besoin}, et la formation « {formation} » est prévue {dates}.",
  ],
  participants_avec: [
    "La liste des inscrits compte {participants}. Nous noterons l’ancienneté de chacun en début de formation.",
    "À ce jour, la formation concerne {participants}. Les profils seront complétés le premier jour, expérience et ancienneté comprises.",
    "Côté participants, nous avons {participants}. Pour l’ancienneté dans le poste, nous poserons la question à chacun.",
    "Formation suivie par {participants}. Chacun présentera son poste et son expérience en arrivant.",
    "Inscriptions reçues pour {participants}. Ancienneté et parcours : à voir avec chacun à l’ouverture.",
  ],
  // Un seul inscrit : « une personne (gérante) »
  participants_un: [
    "La formation concerne {participants}. Nous ferons le point sur son expérience dès le premier jour.",
    "Une seule inscription à ce jour : {participants}. Son ancienneté et son parcours seront vus en début de formation.",
    "Inscription reçue pour {participants}. Son expérience et son ancienneté seront notées à l’ouverture.",
  ],
  participants_sans: [
    "Pas encore d’inscrits. Nous attendons la liste des participants et leurs postes, que doit nous transmettre {client}.",
    "Personne n’est encore inscrit. Nous verrons avec {client} qui participe, et à quel poste.",
    "Inscriptions en attente chez {client}. Le profil du groupe sera complété dès que la liste arrivera.",
    "Aucun participant pour le moment. La composition du groupe reste à définir par {client}.",
    "Liste vide pour l’instant. Nous compléterons les postes et les profils quand {client} aura donné les noms.",
  ],
  niveau: [
    "Pour cette formation, {prerequis}. Nous ferons un tour de table au démarrage pour voir où chacun en est.",
    "Niveau d’entrée demandé : {prerequis}. Pour le reste, le formateur posera quelques questions au début, sans note ni pression.",
    "Le niveau de départ sera vu dès le début (programme : {prerequis}). Le formateur partira de ce qui est déjà acquis, sans dérouler un cours tout fait.",
    "Sur la fiche programme, {prerequis}. Dans les faits, nous verrons le niveau réel dès la première heure, avec un court questionnaire.",
    "Le formateur verra vite qui a déjà de la pratique et qui démarre, et réglera le rythme en conséquence. Pour rappel, {prerequis}.",
  ],
  objectifs_intro: [
    "Ce que les participants doivent savoir faire en sortant, d’après le programme :\n{objectifs}",
    "Objectifs retenus pour cette session :\n{objectifs}",
    "À la fin de la formation, nous visons ceci :\n{objectifs}",
    "Nous reprenons les objectifs du programme :\n{objectifs}",
    "Pour savoir si la formation a servi, nous vérifierons ces points en fin de parcours :\n{objectifs}",
  ],
  contraintes: [
    "Formation {lieu}, {dates}, sur {duree}. Horaires : {horaires}.",
    "Tout se passe {lieu}, {dates}, sur {duree} ({horaires}). Prévoir de libérer les participants pendant ces heures.",
    "Rendez-vous {dates}, {lieu}, pour {duree} de formation (horaires : {horaires}). Une feuille d’émargement sera à signer à chaque demi-journée.",
    "Côté organisation, la formation aura lieu {dates}, {lieu}, le tout sur {duree}. Pour les horaires, {horaires}. Les détails pratiques suivront avec la convocation.",
    "Sur {duree}, la formation se tient {lieu}, {dates}, horaires {horaires}. Une absence est à signaler dès que possible.",
  ],
  handicap_aucun: [
    "Rien de signalé à ce jour, ni handicap ni difficulté avec la langue. Si un besoin apparaît, notre référent handicap s’en occupe.",
    "Aucun besoin d’adaptation remonté pour l’instant. Un aménagement reste possible à tout moment, il suffit de prévenir notre référent handicap.",
    "Personne n’a signalé de situation de handicap ou de besoin particulier. Notre référent handicap reste disponible, avant comme pendant la formation.",
    "Pas de demande d’aménagement pour le moment. Le référent handicap peut être contacté par les participants comme par l’employeur, même une fois la formation commencée.",
    "A priori, rien à adapter : aucun handicap ni besoin lié à la langue n’a été signalé. Notre référent handicap prendra en charge toute demande, jusqu’au dernier jour.",
  ],
  handicap_signale: [
    "Situation de handicap signalée pour {nb_handicap}. Notre référent handicap prendra contact pour voir ce qu’il faut adapter.",
    "Le groupe compte {nb_handicap} en situation de handicap. Les aménagements seront préparés avec notre référent handicap, en toute discrétion.",
    "Sur la liste des inscrits, {nb_handicap} en situation de handicap. Notre référent handicap organise les aménagements avant le premier jour.",
    "Handicap déclaré : {nb_handicap}. Le référent handicap prendra contact en amont pour adapter ce qui doit l’être.",
    "Aménagement éventuel à voir pour {nb_handicap} en situation de handicap. Le référent handicap s’en charge, de façon confidentielle.",
  ],
  hy_process: [
    "Établissement concerné : {qui}. Nous suivrons le circuit des produits, du camion de livraison jusqu’à l’assiette ou au comptoir, sans oublier le nettoyage. Nous demanderons aussi à voir le PMS et les fiches d’enregistrement.",
    "Comme dans toute cuisine ou tout labo, il y a des points sensibles à chaque étape : réception, stockage, préparation, service, nettoyage. Le PMS de l’établissement servira de base aux exercices s’il nous est transmis.",
    "Chez {qui}, nous reprendrons chaque étape dans l’ordre, de l’arrivée des marchandises jusqu’à la plonge et au nettoyage. S’il y a eu des remarques lors d’un contrôle, nous partirons de là.",
    "Tout le circuit est concerné, des livraisons au nettoyage des surfaces, avec un œil sur les températures à chaque étape. Le formateur fera le point avec l’équipe sur le PMS et les enregistrements à tenir.",
    "Pour {qui}, la formation suivra les gestes de la cuisine ou du labo, du carton reçu au plan de travail désinfecté. Nous reprendrons avec l’équipe ce que demande le PMS, enregistrements compris.",
  ],
  mg_equipe: [
    "Nombre d’inscrits à ce jour : {n}. La taille des équipes encadrées sera la première question du tour de table.",
    "Les inscriptions en sont à {n} pour le moment. Dans les métiers de bouche, le turnover et les coups de feu font partie du travail de manager, et ce sera notre point de départ.",
    "Sur la liste, {n} pour l’instant. Nous travaillerons sur ce qui pèse dans le métier : recrutement, absences, tensions en plein service, motivation de l’équipe.",
    "Turnover, conflits, plannings, résultats : nous partirons des situations de chaque participant (effectif inscrit : {n}).",
    "Au démarrage, chaque participant dira combien de personnes il encadre et ce qui lui pose le plus de questions. Inscriptions enregistrées : {n}.",
  ],
  me_gestes: [
    "Gestes et techniques visés : ceux du programme « {formation} », travaillés au poste. Un premier exercice, dès le début, fera apparaître ce qui est déjà maîtrisé.",
    "Au démarrage de la formation « {formation} », le formateur regardera chacun travailler et corrigera au fur et à mesure. Ce premier passage donne le niveau de départ.",
    "Le programme « {formation} » donne la liste des techniques à travailler. Nous regarderons où en est chacun le premier jour, puis de nouveau à la fin.",
    "Avec « {formation} », l’essentiel se fait en pratique. Nous noterons ce que chacun maîtrise déjà pour ne pas perdre de temps dessus.",
    "Pour la formation « {formation} », chacun arrive avec ses habitudes de travail. Nous partirons de ces habitudes, en gardant ce qui marche.",
  ],
  attentes: {
    hygiene: [
      "Ce que veut {client} : {besoin}. Nous insisterons sur ce qui se refait chaque jour, les gestes comme les fiches à remplir.",
      "Pour {client}, la demande tient en une phrase : {besoin}. Les exemples seront pris dans leur activité, de la livraison jusqu’au client.",
      "Avec {client}, l’objectif est de {besoin}. Nous prendrons le temps sur les enregistrements, parce que sans eux rien ne prouve que le travail est bien fait.",
      "Il faut {besoin}, c’est la demande faite par {client}. Nous viserons des habitudes qui tiennent même en plein service.",
      "Sur ce dossier, {client} veut {besoin}. Une petite erreur d’hygiène suffit pour rendre un client malade, c’est ce que l’équipe doit garder en tête.",
    ],
    prevention: [
      "Nous travaillons avec {client}, qui veut {besoin}. Les exemples viendront de ce que l’équipe vit au travail.",
      "Chez {client}, il faut {besoin}. Nous chercherons des solutions qui tiennent aussi en plein rush.",
      "L’objectif fixé avec {client} est de {besoin}. La prévention concerne tout le monde, de l’apprenti au responsable.",
      "Dans ce dossier, {client} veut {besoin}. Pour rappel, la santé et la sécurité des salariés font partie des obligations de l’employeur.",
      "Ce que nous retenons pour {client} : {besoin}. Le formateur fera le point en fin de session sur les suites à donner dans l’établissement.",
    ],
    management: [
      "Pour {client}, le but est de {besoin}. Nous travaillerons sur leurs situations réelles, à partir de ce qu’ils racontent en début de formation.",
      "Avec cette formation, {client} cherche à {besoin}. Nous demanderons à chacun d’apporter ses questions du terrain, qui passeront en priorité.",
      "L’idée, pour {client} : {besoin}. Le formateur donnera des outils faciles à reprendre dès le lendemain.",
      "Chez {client}, ils veulent {besoin}. Le plus utile sera ce qu’ils pourront refaire seuls une fois la formation finie.",
      "Ce que veut {client}, c’est {besoin}. Le formateur adaptera les exemples à la taille et au rythme de l’établissement.",
    ],
    metier: [
      "Pour {client}, l’attente est simple : {besoin}. Surtout de la pratique, au poste, avec le formateur à côté pour corriger les gestes.",
      "Le but, pour {client}, est de {besoin}. Nous viserons la régularité, un résultat qui reste le même quel que soit celui qui est au poste.",
      "Objectif partagé avec {client} : {besoin}. L’équipe doit savoir refaire seule les gestes vus, une fois le formateur parti.",
      "La demande, chez {client}, c’est de {besoin}. Formation avec leurs produits et leur matériel quand c’est possible, pour rester au plus près du travail réel.",
      "Tenir le rythme sans perdre en qualité, voilà ce que nous travaillerons en priorité pour {client}, qui veut {besoin}.",
    ],
  },
  pv_risques: {
    duerp: [
      "Risques à passer en revue pour le document unique : coupures, brûlures, chutes sur sol mouillé, port de charges, produits de nettoyage, incendie. Nous noterons au passage les EPI portés à chaque poste.",
      "Nous partirons du document unique actuel s’il existe, sinon d’une feuille blanche. Chaque poste sera regardé, de la réception des livraisons jusqu’au ménage.",
      "Couteaux, chaleur, sols glissants, charges lourdes, produits chimiques : dans les métiers de bouche, ce sont les risques qui reviennent. Nous verrons lesquels concernent vraiment l’établissement.",
      "Le document unique est-il à jour ? Nous le verrons dès le démarrage, puis l’équipe listera avec nous les risques qu’elle rencontre.",
      "Chaque risque sera noté avec ses causes et les mesures déjà prises, comme le demande le document unique. Côté EPI, nous ferons la liste de ce qui est fourni et de ce qui pourrait manquer.",
    ],
    sst: [
      "En cuisine, au labo ou côté clients, un accident arrive vite : coupure, brûlure, chute ou malaise. La formation porte sur les bons gestes en attendant les secours.",
      "Lames, surfaces chaudes, sols glissants, charges lourdes : les risques du métier sont connus. Chaque participant devra savoir où se trouve la trousse de secours dans son établissement.",
      "Au programme, la conduite à tenir face à un accident : protéger, examiner, alerter, secourir. Les exemples seront pris dans la restauration et les métiers de bouche.",
      "Le sauveteur secouriste apprend aussi à repérer les situations dangereuses au poste et à les signaler. Équipements à connaître : la trousse de secours, et le défibrillateur s’il y en a un.",
      "Cas travaillés en formation : plaies, brûlures, chutes, malaises, étouffement. Mises en situation sur mannequin et sur des scènes proches de leur travail.",
    ],
    incendie: [
      "En cuisine comme au labo, un départ de feu peut venir d’une friteuse, d’une hotte encrassée, d’un four ou d’un appareil électrique. Nous verrons quel extincteur utiliser selon le feu, et comment couper le gaz et l’électricité.",
      "Risque incendie lié à la chaleur, à l’huile, au gaz et à l’électricité. Au programme : alarme, évacuation, point de rassemblement, extincteurs.",
      "Le risque est bien réel dans les métiers de bouche, avec des fours, de l’huile chaude, du gaz et beaucoup d’emballages. Chacun doit connaître les consignes de sécurité et le chemin d’évacuation.",
      "Équipements à connaître : extincteurs, couverture anti-feu, coupures de gaz et d’électricité, issues de secours. Le formateur fera manipuler un extincteur si c’est possible sur place.",
      "Feu d’huile, feu électrique : chaque feu a son extincteur, et une erreur peut aggraver les choses. Nous travaillerons aussi l’évacuation, avec le rôle de chacun le jour où il faut sortir.",
    ],
    gestes: [
      "Cartons à la réception, gestes répétés en préparation, longues heures debout, dos penché à la plonge : ce sont les causes classiques de TMS dans le métier. Nous partirons des postes décrits par l’équipe pour chercher des solutions simples.",
      "Les zones qui souffrent le plus dans les métiers de bouche sont le dos, les épaules, les poignets et les genoux. Matériel et aménagements à regarder : chariots, diables, tapis anti-fatigue, hauteur des plans de travail.",
      "Le risque vient des charges lourdes et des gestes répétés toute la journée, au poste comme à la réception des livraisons. Exercices pratiques sur la bonne façon de porter et de se baisser, avec le matériel de l’établissement quand c’est possible.",
      "Pas d’EPI miracle contre les TMS : ce sont surtout l’organisation du poste et les bons gestes qui comptent. Chaussures adaptées et aides à la manutention seront quand même passées en revue.",
      "Métier physique, avec beaucoup de port de charges et de station debout. Le but est que chacun garde les bonnes habitudes une fois rentré au poste.",
    ],
    general: [
      "Risques habituels du secteur : lames, chaleur, sols glissants, charges, produits d’entretien, feu. Les protections utilisées au poste seront passées en revue avec l’équipe.",
      "Dans les métiers de bouche, on se coupe, on se brûle, on glisse et on porte lourd. Nous verrons comment s’en protéger poste par poste, avec les équipements qui vont avec.",
      "Le document unique de l’établissement, s’il est à jour, servira de point de départ. Sinon, nous partirons des postes de l’équipe.",
      "Équipements à regarder : gants anti-coupure, chaussures antidérapantes, protections contre la chaleur, gants pour les produits d’entretien. Le formateur insistera sur les gestes qui évitent beaucoup d’accidents.",
      "Les risques changent d’un poste à l’autre, entre la préparation, la plonge, le service et les livraisons. Chacun repartira avec les règles de sécurité de son propre poste.",
    ],
  },
  besoins: {
    nettoyage: [
      "former l’équipe au nettoyage et à la désinfection",
      "donner à l’équipe les bons gestes de nettoyage et de désinfection",
      "travailler le plan de nettoyage et de désinfection avec l’équipe",
      "faire progresser l’équipe sur le nettoyage des locaux et du matériel",
      "maîtriser le nettoyage et la désinfection, du sol aux plans de travail",
    ],
    allergenes: [
      "former l’équipe à la gestion des allergènes",
      "donner à l’équipe les bons réflexes sur les allergènes, en cuisine comme face au client",
      "maîtriser les allergènes, de la préparation jusqu’à l’information du client",
      "faire le point avec l’équipe sur les allergènes et l’information des clients",
      "connaître les allergènes et savoir en parler aux clients",
    ],
    tracabilite: [
      "former l’équipe à la traçabilité des produits",
      "tenir la traçabilité des produits, de la livraison jusqu’à l’assiette ou au comptoir",
      "maîtriser la traçabilité et l’étiquetage des denrées",
      "savoir retrouver l’origine de chaque produit utilisé",
      "revoir avec l’équipe l’étiquetage et le suivi des produits",
    ],
    pms: [
      "former l’équipe au plan de maîtrise sanitaire et à la méthode HACCP",
      "faire vivre le plan de maîtrise sanitaire de l’établissement",
      "comprendre et appliquer le PMS, enregistrements compris",
      "mettre en pratique le PMS et la méthode HACCP avec l’équipe",
      "tenir le PMS à jour et le faire appliquer sur le terrain",
    ],
    hygiene: [
      "former l’équipe à l’hygiène alimentaire",
      "faire appliquer les règles d’hygiène alimentaire par toute l’équipe",
      "donner à l’équipe les bons réflexes d’hygiène",
      "travailler l’hygiène et la sécurité des aliments avec l’équipe",
      "maîtriser l’hygiène alimentaire au poste de travail",
    ],
    duerp: [
      "rédiger ou mettre à jour le document unique d’évaluation des risques",
      "disposer d’un document unique à jour, poste par poste",
      "savoir évaluer les risques du poste et les reporter dans le document unique",
      "se former à l’évaluation des risques et au document unique",
      "passer en revue les risques de l’établissement pour tenir à jour le document unique",
    ],
    sst: [
      "former des sauveteurs secouristes du travail dans l’équipe",
      "compter dans l’équipe des personnes capables de porter secours",
      "savoir porter les premiers secours en cas d’accident ou de malaise",
      "préparer des salariés à intervenir sur un accident du travail",
      "donner à des salariés les gestes de premiers secours",
    ],
    incendie: [
      "former l’équipe à la sécurité incendie et à l’évacuation",
      "savoir réagir face à un départ de feu",
      "préparer l’équipe à évacuer les lieux dans le calme",
      "connaître les bons gestes en cas d’incendie, de l’extincteur à l’évacuation",
      "maîtriser les consignes incendie et le maniement des extincteurs",
    ],
    gestes: [
      "former l’équipe aux gestes et postures",
      "prévenir les TMS liés au port de charges et aux gestes répétés",
      "savoir porter et se tenir au poste sans se faire mal",
      "préserver le dos et les articulations de l’équipe",
      "travailler les bonnes postures avec l’équipe, au poste comme pendant les livraisons",
    ],
    prevention: [
      "prévenir les risques professionnels dans l’équipe",
      "former l’équipe à la prévention des risques au travail",
      "faire baisser les risques d’accident au poste de travail",
      "donner à l’équipe les bons réflexes de sécurité au travail",
      "repérer les risques du poste et savoir s’en protéger",
    ],
    gestion: [
      "suivre les coûts et la rentabilité au jour le jour",
      "former les responsables à la gestion et à la rentabilité",
      "piloter les marges et les stocks",
      "maîtriser les chiffres de l’établissement, des achats à la marge",
      "comprendre où se fait la marge et où elle se perd",
    ],
    vente: [
      "soigner l’accueil des clients et développer les ventes",
      "former l’équipe à l’accueil et à la vente",
      "vendre plus et mieux accueillir les clients",
      "faire progresser l’équipe sur l’accueil et le conseil au client",
      "travailler l’accueil et la vente additionnelle avec l’équipe",
    ],
    management: [
      "former les responsables au management d’équipe",
      "manager l’équipe avec plus d’aisance",
      "faire progresser les responsables dans l’encadrement de l’équipe",
      "savoir animer une équipe et la recadrer quand il le faut",
      "donner aux managers des outils simples pour encadrer l’équipe",
    ],
    ia: [
      "découvrir ce que l’IA peut faire pour l’établissement",
      "prendre en main des outils d’IA utiles au travail",
      "gagner du temps sur les tâches de bureau grâce à l’IA",
      "savoir utiliser l’IA sans se tromper ni perdre de temps",
      "voir concrètement comment l’IA peut aider l’équipe",
    ],
    outils: [
      "prendre en main l’outil et s’en servir au quotidien",
      "gagner du temps grâce à l’outil",
      "savoir se servir des fonctions utiles au travail de tous les jours",
      "maîtriser l’outil, des bases jusqu’aux fonctions avancées",
      "rendre l’équipe autonome sur l’outil",
    ],
    administratif: [
      "mieux tenir le suivi administratif",
      "prendre en main les démarches administratives et de financement",
      "tenir les dossiers administratifs à jour",
      "savoir monter et suivre un dossier de financement",
      "gagner en méthode sur la partie administrative",
    ],
    metier: [
      "progresser sur les techniques du métier",
      "perfectionner les gestes du métier dans l’équipe",
      "maîtriser les gestes techniques du cœur de métier",
      "gagner en savoir-faire sur le métier",
      "former l’équipe aux techniques du métier",
    ],
  },
} as const satisfies {
  attentes: Record<'hygiene' | 'prevention' | 'management' | 'metier', readonly string[]>
  pv_risques: Record<'duerp' | 'sst' | 'incendie' | 'gestes' | 'general', readonly string[]>
  besoins: Record<SujetRecueil, readonly string[]>
  [champ: string]: unknown
}
