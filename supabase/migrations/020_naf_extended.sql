-- ============================================================
-- 020 — Mapping NAF → OPCO étendu (~150 codes supplémentaires)
-- ============================================================
-- Pour les SIRETs absents du fichier officiel SIRET-OPCO (entreprises
-- sans IDCC déclaré, organismes de formation, auto-entrepreneurs...),
-- on étend le mapping NAF pour fallback fiable.
-- Source : sites officiels OPCO + arrêtés de rattachement.

-- ============================================================
-- AKTO : services à forte intensité de main d'œuvre
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('85.59A', 'Formation continue d''adultes'),
  ('85.59B', 'Autres enseignements'),
  ('85.60Z', 'Activités de soutien à l''enseignement'),
  ('82.99Z', 'Autres activités de soutien aux entreprises'),
  ('81.10Z', 'Activités combinées de soutien lié aux bâtiments'),
  ('81.29A', 'Désinfection, désinsectisation, dératisation'),
  ('81.29B', 'Autres activités de nettoyage n.c.a.'),
  ('82.20Z', 'Activités de centres d''appels'),
  ('81.30Z', 'Services d''aménagement paysager'),
  ('80.20Z', 'Activités liées aux systèmes de sécurité'),
  ('80.30Z', 'Activités d''enquête'),
  ('77.40Z', 'Location-bail de propriété intellectuelle'),
  ('92.00Z', 'Organisation de jeux de hasard et d''argent'),
  ('93.29Z', 'Autres activités récréatives et de loisirs')
) AS naf(code_naf, libelle)
WHERE opco.code = 'AKTO'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- OPCO EP : artisanat, libérales, services de proximité
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('96.01A', 'Blanchisserie-teinturerie de gros'),
  ('96.01B', 'Blanchisserie-teinturerie de détail'),
  ('96.03Z', 'Services funéraires'),
  ('96.04Z', 'Entretien corporel'),
  ('96.09Z', 'Autres services personnels n.c.a.'),
  ('45.20Z', 'Entretien et réparation de véhicules automobiles'),
  ('45.32Z', 'Commerce de détail d''équipements automobiles'),
  ('45.40Z', 'Commerce et réparation de motocycles'),
  ('43.21B', 'Travaux d''installation électrique sur la voie publique'),
  ('43.22B', 'Travaux d''installation d''équipements thermiques et de climatisation'),
  ('43.31Z', 'Travaux de plâtrerie'),
  ('43.32A', 'Travaux de menuiserie bois et PVC'),
  ('43.32B', 'Travaux de menuiserie métallique et serrurerie'),
  ('43.33Z', 'Travaux de revêtement des sols et des murs'),
  ('43.34Z', 'Travaux de peinture et vitrerie'),
  ('43.39Z', 'Autres travaux de finition'),
  ('43.91A', 'Travaux de charpente'),
  ('43.91B', 'Travaux de couverture'),
  ('43.99A', 'Travaux d''étanchéification'),
  ('43.99C', 'Travaux de maçonnerie générale'),
  ('86.22A', 'Activités de radiodiagnostic et de radiothérapie'),
  ('86.22B', 'Activités chirurgicales'),
  ('86.22C', 'Autres activités des médecins spécialistes'),
  ('86.90A', 'Ambulances'),
  ('86.90B', 'Laboratoires d''analyses médicales'),
  ('86.90C', 'Centres de collecte et banques d''organes'),
  ('86.90D', 'Activités des infirmiers et des sages-femmes'),
  ('86.90E', 'Activités des professionnels de la rééducation'),
  ('86.90F', 'Activités de santé humaine non classées ailleurs'),
  ('66.22Z', 'Activités des agents et courtiers d''assurances'),
  ('70.21Z', 'Conseil en relations publiques et communication'),
  ('74.30Z', 'Traduction et interprétation'),
  ('74.90A', 'Activité des économistes de la construction'),
  ('74.90B', 'Activités spécialisées, scientifiques et techniques diverses')
) AS naf(code_naf, libelle)
WHERE opco.code = 'OPCO_EP'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- OPCOMMERCE : commerce
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('47.11A', 'Commerce de détail de produits surgelés'),
  ('47.11B', 'Commerce d''alimentation générale'),
  ('47.11C', 'Supérettes'),
  ('47.11D', 'Supermarchés'),
  ('47.11E', 'Magasins multi-commerces'),
  ('47.11F', 'Hypermarchés'),
  ('47.19A', 'Grands magasins'),
  ('47.19B', 'Autres commerces de détail en magasin non spécialisé'),
  ('47.21Z', 'Commerce de détail de fruits et légumes'),
  ('47.25Z', 'Commerce de détail de boissons'),
  ('47.26Z', 'Commerce de détail de produits à base de tabac'),
  ('47.29Z', 'Autres commerces de détail alimentaires'),
  ('47.41Z', 'Commerce de détail d''ordinateurs'),
  ('47.42Z', 'Commerce de détail de matériels de télécommunication'),
  ('47.43Z', 'Commerce de détail de matériels audio et vidéo'),
  ('47.51Z', 'Commerce de détail de textiles'),
  ('47.52A', 'Commerce de détail de quincaillerie'),
  ('47.52B', 'Commerce de détail de bricolage'),
  ('47.53Z', 'Commerce de détail de tapis, moquettes'),
  ('47.54Z', 'Commerce de détail d''appareils électroménagers'),
  ('47.59A', 'Commerce de détail de meubles'),
  ('47.59B', 'Commerce de détail d''autres équipements du foyer'),
  ('47.61Z', 'Commerce de détail de livres'),
  ('47.62Z', 'Commerce de détail de journaux et papeterie'),
  ('47.63Z', 'Commerce de détail d''enregistrements musicaux'),
  ('47.64Z', 'Commerce de détail d''articles de sport'),
  ('47.65Z', 'Commerce de détail de jeux et jouets'),
  ('47.71Z', 'Commerce de détail d''habillement'),
  ('47.72A', 'Commerce de détail de la chaussure'),
  ('47.72B', 'Commerce de détail de maroquinerie'),
  ('47.73Z', 'Commerce de détail de produits pharmaceutiques'),
  ('47.74Z', 'Commerce de détail d''articles médicaux et orthopédiques'),
  ('47.75Z', 'Commerce de détail de parfumerie et de produits de beauté'),
  ('47.76Z', 'Commerce de détail de fleurs, plantes, graines'),
  ('47.77Z', 'Commerce de détail d''articles d''horlogerie et bijouterie'),
  ('47.78A', 'Commerce de détail d''optique'),
  ('47.78B', 'Commerces de détail de charbons'),
  ('47.78C', 'Autres commerces de détail spécialisés divers'),
  ('47.79Z', 'Commerce de détail de biens d''occasion en magasin'),
  ('47.81Z', 'Commerce de détail alimentaire sur éventaires'),
  ('47.82Z', 'Commerce de détail de textiles, habillement sur éventaires'),
  ('47.89Z', 'Autres commerces de détail sur éventaires'),
  ('47.91A', 'Vente à distance sur catalogue général'),
  ('47.91B', 'Vente à distance sur catalogue spécialisé'),
  ('47.99A', 'Vente à domicile'),
  ('47.99B', 'Vente par automates et autres commerces non magasin')
) AS naf(code_naf, libelle)
WHERE opco.code = 'OPCOMMERCE'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- ATLAS : conseil, banque, assurance, IT
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('64.19Z', 'Autres intermédiations monétaires'),
  ('64.20Z', 'Activités des sociétés holding'),
  ('64.30Z', 'Fonds de placement et entités financières similaires'),
  ('64.91Z', 'Crédit-bail'),
  ('64.92Z', 'Autre distribution de crédit'),
  ('64.99Z', 'Autres activités des services financiers'),
  ('65.11Z', 'Assurance vie'),
  ('65.12Z', 'Autres assurances'),
  ('65.20Z', 'Réassurance'),
  ('65.30Z', 'Caisses de retraite'),
  ('66.11Z', 'Administration de marchés financiers'),
  ('66.12Z', 'Courtage de valeurs mobilières et de marchandises'),
  ('66.19A', 'Supports juridiques de gestion de patrimoine mobilier'),
  ('66.19B', 'Autres activités auxiliaires de services financiers'),
  ('66.21Z', 'Évaluation des risques et dommages'),
  ('66.29Z', 'Autres activités auxiliaires d''assurance et de caisses de retraite'),
  ('66.30Z', 'Gestion de fonds'),
  ('69.20Z', 'Activités comptables'),
  ('70.10Z', 'Activités des sièges sociaux'),
  ('70.22Z', 'Conseil pour les affaires et autres conseils de gestion'),
  ('71.11Z', 'Activités d''architecture'),
  ('71.12A', 'Activité des géomètres'),
  ('71.12B', 'Ingénierie, études techniques'),
  ('71.20A', 'Contrôle technique automobile'),
  ('71.20B', 'Analyses, essais et inspections techniques'),
  ('72.11Z', 'Recherche-développement en biotechnologie'),
  ('72.19Z', 'Recherche-développement en autres sciences physiques et naturelles'),
  ('72.20Z', 'Recherche-développement en sciences humaines'),
  ('62.01Z', 'Programmation informatique'),
  ('62.02A', 'Conseil en systèmes et logiciels informatiques'),
  ('62.02B', 'Tierce maintenance de systèmes et applications informatiques'),
  ('62.03Z', 'Gestion d''installations informatiques'),
  ('62.09Z', 'Autres activités informatiques'),
  ('63.11Z', 'Traitement de données, hébergement, activités connexes'),
  ('63.12Z', 'Portails internet'),
  ('63.99Z', 'Autres services d''information')
) AS naf(code_naf, libelle)
WHERE opco.code = 'ATLAS'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- AFDAS : culture, médias, sport, loisirs, tourisme
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('58.11Z', 'Édition de livres'),
  ('58.13Z', 'Édition de journaux'),
  ('58.14Z', 'Édition de revues et périodiques'),
  ('58.19Z', 'Autres activités d''édition'),
  ('58.21Z', 'Édition de jeux électroniques'),
  ('58.29A', 'Édition de logiciels système et de réseau'),
  ('58.29B', 'Édition de logiciels outils de développement'),
  ('58.29C', 'Édition de logiciels applicatifs'),
  ('59.11A', 'Production de films et de programmes pour la télévision'),
  ('59.11B', 'Production de films institutionnels et publicitaires'),
  ('59.11C', 'Production de films pour le cinéma'),
  ('59.12Z', 'Postproduction de films'),
  ('59.13A', 'Distribution de films cinématographiques'),
  ('59.13B', 'Édition et distribution vidéo'),
  ('59.14Z', 'Projection de films cinématographiques'),
  ('59.20Z', 'Enregistrement sonore et édition musicale'),
  ('60.10Z', 'Édition et diffusion de programmes radio'),
  ('60.20A', 'Édition de chaînes généralistes'),
  ('60.20B', 'Édition de chaînes thématiques'),
  ('63.91Z', 'Activités des agences de presse'),
  ('73.11Z', 'Activités des agences de publicité'),
  ('74.20Z', 'Activités photographiques'),
  ('77.21Z', 'Location et location-bail d''articles de loisirs et de sport'),
  ('79.11Z', 'Activités des agences de voyage'),
  ('79.12Z', 'Activités des voyagistes'),
  ('79.90Z', 'Autres services de réservation'),
  ('90.01Z', 'Arts du spectacle vivant'),
  ('90.02Z', 'Activités de soutien au spectacle vivant'),
  ('90.03A', 'Création artistique relevant des arts plastiques'),
  ('90.03B', 'Autre création artistique'),
  ('90.04Z', 'Gestion de salles de spectacles'),
  ('91.01Z', 'Gestion des bibliothèques et des archives'),
  ('91.02Z', 'Gestion des musées'),
  ('91.03Z', 'Gestion des sites et monuments historiques'),
  ('91.04Z', 'Gestion des jardins botaniques et zoologiques'),
  ('93.11Z', 'Gestion d''installations sportives'),
  ('93.12Z', 'Activités de clubs de sports'),
  ('93.13Z', 'Activités des centres de culture physique'),
  ('93.19Z', 'Autres activités liées au sport'),
  ('93.21Z', 'Activités des parcs d''attractions et parcs à thèmes')
) AS naf(code_naf, libelle)
WHERE opco.code = 'AFDAS'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- OCAPIAT : agriculture, agro-alimentaire, pêche
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('01.11Z', 'Culture de céréales'),
  ('01.13Z', 'Culture de légumes, melons, racines et tubercules'),
  ('01.21Z', 'Culture de la vigne'),
  ('01.41Z', 'Élevage de vaches laitières'),
  ('01.42Z', 'Élevage d''autres bovins et de buffles'),
  ('01.46Z', 'Élevage de porcins'),
  ('01.47Z', 'Élevage de volailles'),
  ('01.50Z', 'Culture et élevage associés'),
  ('01.61Z', 'Activités de soutien aux cultures'),
  ('01.62Z', 'Activités de soutien à la production animale'),
  ('02.10Z', 'Sylviculture et autres activités forestières'),
  ('02.20Z', 'Exploitation forestière'),
  ('03.11Z', 'Pêche en mer'),
  ('03.12Z', 'Pêche en eau douce'),
  ('03.21Z', 'Aquaculture en mer'),
  ('10.20Z', 'Transformation et conservation de poisson'),
  ('10.31Z', 'Transformation et conservation de pommes de terre'),
  ('10.39A', 'Autre transformation et conservation de légumes'),
  ('10.51A', 'Fabrication de lait liquide et de produits frais'),
  ('10.51B', 'Fabrication de beurre'),
  ('10.51C', 'Fabrication de fromage'),
  ('10.61A', 'Meunerie'),
  ('10.81Z', 'Fabrication de sucre'),
  ('11.01Z', 'Production de boissons alcooliques distillées'),
  ('11.02A', 'Fabrication de vins effervescents'),
  ('11.02B', 'Vinification')
) AS naf(code_naf, libelle)
WHERE opco.code = 'OCAPIAT'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- OPCO 2I : industrie
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('24.10Z', 'Sidérurgie'),
  ('25.50A', 'Forge, estampage, matriçage'),
  ('25.50B', 'Découpage, emboutissage'),
  ('25.61Z', 'Traitement et revêtement des métaux'),
  ('25.62A', 'Décolletage'),
  ('25.62B', 'Mécanique industrielle'),
  ('25.71Z', 'Fabrication de coutellerie'),
  ('25.72Z', 'Fabrication de serrures et de ferrures'),
  ('25.73A', 'Fabrication de moules et modèles'),
  ('25.73B', 'Fabrication d''autres outillages'),
  ('25.91Z', 'Fabrication de fûts et emballages métalliques similaires'),
  ('25.93Z', 'Fabrication d''articles en fils métalliques'),
  ('25.94Z', 'Fabrication de vis et de boulons'),
  ('25.99A', 'Fabrication d''articles métalliques ménagers'),
  ('25.99B', 'Fabrication d''autres articles métalliques'),
  ('26.30Z', 'Fabrication d''équipements de communication'),
  ('27.11Z', 'Fabrication de moteurs, génératrices et transformateurs'),
  ('27.20Z', 'Fabrication de piles et d''accumulateurs électriques'),
  ('28.11Z', 'Fabrication de moteurs et turbines'),
  ('28.12Z', 'Fabrication d''équipements hydrauliques et pneumatiques'),
  ('28.99A', 'Fabrication de machines d''imprimerie'),
  ('28.99B', 'Fabrication d''autres machines spécialisées'),
  ('22.11Z', 'Fabrication et rechapage de pneumatiques'),
  ('22.19Z', 'Fabrication d''autres articles en caoutchouc'),
  ('22.21Z', 'Fabrication de plaques, feuilles, tubes en plastique'),
  ('22.22Z', 'Fabrication d''emballages en plastique'),
  ('22.23Z', 'Fabrication d''éléments en matières plastiques pour la construction'),
  ('22.29A', 'Fabrication de pièces techniques en plastique'),
  ('22.29B', 'Fabrication de produits divers en plastique'),
  ('13.10Z', 'Préparation de fibres textiles et filature'),
  ('13.20Z', 'Tissage'),
  ('13.30Z', 'Ennoblissement textile'),
  ('14.13Z', 'Fabrication de vêtements de dessus'),
  ('14.14Z', 'Fabrication de vêtements de dessous'),
  ('15.11Z', 'Apprêt et tannage des cuirs'),
  ('15.20Z', 'Fabrication de chaussures'),
  ('17.12Z', 'Fabrication de papier et de carton'),
  ('17.21A', 'Fabrication de carton ondulé'),
  ('31.01Z', 'Fabrication de meubles de bureau et de magasin'),
  ('31.02Z', 'Fabrication de meubles de cuisine'),
  ('31.09A', 'Fabrication de sièges d''ameublement d''intérieur'),
  ('31.09B', 'Fabrication d''autres meubles')
) AS naf(code_naf, libelle)
WHERE opco.code = 'OPCO_2I'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- CONSTRUCTYS : BTP
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('41.10A', 'Promotion immobilière de logements'),
  ('41.10B', 'Promotion immobilière de bureaux'),
  ('41.10C', 'Promotion immobilière d''autres bâtiments'),
  ('41.10D', 'Supports juridiques de programmes'),
  ('41.20A', 'Construction de maisons individuelles'),
  ('41.20B', 'Construction d''autres bâtiments'),
  ('42.11Z', 'Construction de routes et autoroutes'),
  ('42.12Z', 'Construction de voies ferrées'),
  ('42.13A', 'Construction d''ouvrages d''art'),
  ('42.13B', 'Construction et entretien de tunnels'),
  ('42.21Z', 'Construction de réseaux pour fluides'),
  ('42.22Z', 'Construction de réseaux électriques et de télécommunications'),
  ('42.91Z', 'Construction d''ouvrages maritimes et fluviaux'),
  ('42.99Z', 'Construction d''autres ouvrages de génie civil'),
  ('43.11Z', 'Travaux de démolition'),
  ('43.12A', 'Travaux de terrassement courants et travaux préparatoires'),
  ('43.12B', 'Travaux de terrassement spécialisés ou de grande masse'),
  ('43.13Z', 'Forages et sondages'),
  ('43.99B', 'Travaux de montage de structures métalliques'),
  ('43.99D', 'Autres travaux spécialisés de construction'),
  ('43.99E', 'Location avec opérateur de matériel de construction')
) AS naf(code_naf, libelle)
WHERE opco.code = 'CONSTRUCTYS'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- OPCO MOBILITES : transport, logistique
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('49.10Z', 'Transport ferroviaire interurbain de voyageurs'),
  ('49.20Z', 'Transports ferroviaires de fret'),
  ('49.31Z', 'Transports urbains et suburbains de voyageurs'),
  ('49.32Z', 'Transports de voyageurs par taxis'),
  ('49.39A', 'Transports routiers réguliers de voyageurs'),
  ('49.39B', 'Autres transports routiers de voyageurs'),
  ('49.39C', 'Téléphériques et remontées mécaniques'),
  ('49.41A', 'Transports routiers de fret interurbains'),
  ('49.41B', 'Transports routiers de fret de proximité'),
  ('49.41C', 'Location de camions avec chauffeur'),
  ('49.42Z', 'Services de déménagement'),
  ('49.50Z', 'Transports par conduites'),
  ('50.10Z', 'Transports maritimes de passagers'),
  ('50.20Z', 'Transports maritimes de fret'),
  ('50.30Z', 'Transports fluviaux de passagers'),
  ('50.40Z', 'Transports fluviaux de fret'),
  ('51.10Z', 'Transports aériens de passagers'),
  ('51.21Z', 'Transports aériens de fret'),
  ('52.10A', 'Entreposage et stockage frigorifique'),
  ('52.10B', 'Entreposage et stockage non frigorifique'),
  ('52.21Z', 'Services auxiliaires des transports terrestres'),
  ('52.22Z', 'Services auxiliaires des transports par eau'),
  ('52.23Z', 'Services auxiliaires des transports aériens'),
  ('52.24A', 'Manutention portuaire'),
  ('52.24B', 'Manutention non portuaire'),
  ('52.29A', 'Messagerie, fret express'),
  ('52.29B', 'Affrètement et organisation des transports'),
  ('53.10Z', 'Activités de poste'),
  ('53.20Z', 'Autres activités de poste et de courrier')
) AS naf(code_naf, libelle)
WHERE opco.code = 'OPCO_MOBILITES'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- OPCO SANTE : santé hospitalière privée, médico-social
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('86.10Z', 'Activités hospitalières'),
  ('87.10A', 'Hébergement médicalisé pour personnes âgées'),
  ('87.10B', 'Hébergement médicalisé pour enfants handicapés'),
  ('87.10C', 'Hébergement médicalisé pour adultes handicapés'),
  ('87.20A', 'Hébergement social pour handicapés mentaux'),
  ('87.20B', 'Hébergement social pour toxicomanes'),
  ('87.30A', 'Hébergement social pour personnes âgées'),
  ('87.30B', 'Hébergement social pour handicapés physiques'),
  ('87.90A', 'Hébergement social pour enfants en difficulté'),
  ('87.90B', 'Hébergement social pour adultes et familles en difficulté'),
  ('88.10A', 'Aide à domicile'),
  ('88.10B', 'Accueil de personnes âgées'),
  ('88.10C', 'Aide par le travail')
) AS naf(code_naf, libelle)
WHERE opco.code = 'OPCO_SANTE'
ON CONFLICT (opco_id, code_naf) DO NOTHING;

-- ============================================================
-- UNIFORMATION : économie sociale, animation, sport amateur
-- ============================================================
INSERT INTO opco_naf_codes (opco_id, code_naf, libelle)
SELECT id, naf.code_naf, naf.libelle FROM opco, (VALUES
  ('88.91A', 'Accueil de jeunes enfants'),
  ('88.91B', 'Accueil ou accompagnement sans hébergement d''enfants handicapés'),
  ('88.99A', 'Autre action sociale sans hébergement pour enfants'),
  ('88.99B', 'Action sociale sans hébergement n.c.a.'),
  ('94.11Z', 'Activités des organisations patronales et consulaires'),
  ('94.12Z', 'Activités des organisations professionnelles'),
  ('94.20Z', 'Activités des syndicats de salariés'),
  ('94.91Z', 'Activités des organisations religieuses'),
  ('94.92Z', 'Activités des organisations politiques'),
  ('94.99Z', 'Autres organisations fonctionnant par adhésion volontaire')
) AS naf(code_naf, libelle)
WHERE opco.code = 'UNIFORMATION'
ON CONFLICT (opco_id, code_naf) DO NOTHING;
