import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
// L'import enregistre les polices du design system (Montserrat, Manrope)
import { BRAND_GREEN, BRAND_ULTRA_LIGHT, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

/**
 * Modèles gratuits du site public : des documents à imprimer et à remplir par
 * le restaurateur (tableau des allergènes, relevé de températures, plan de
 * nettoyage, trame de document unique).
 *
 * Ils ne dépendent d'aucune donnée du CRM : le même fichier pour tous. Les
 * rappels réglementaires qu'ils portent sont ceux des guides du site
 * (lib/guides), vérifiés sur les textes officiels cités.
 */

const LIGNE = SURFACE_200
const page = { paddingTop: 28, paddingBottom: 38, paddingHorizontal: 30, fontFamily: 'Satoshi', fontSize: 8.5, color: SURFACE_900 } as const

function Entete({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: BRAND_GREEN, paddingBottom: 8, marginBottom: 10 }}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 17, color: SURFACE_900 }}>{titre}</Text>
        <Text style={{ fontSize: 8.5, color: SURFACE_500, marginTop: 2 }}>{sousTitre}</Text>
      </View>
      <View style={{ width: 170 }}>
        <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12, color: BRAND_GREEN, letterSpacing: 0.4, textAlign: 'right' }}>LAB LEARNING</Text>
        <Text style={{ fontSize: 6.5, color: SURFACE_500, textAlign: 'right' }}>Organisme de formation certifié Qualiopi</Text>
      </View>
    </View>
  )
}

function Pied({ nom }: { nom: string }) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 16, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: LIGNE, paddingTop: 5 }}>
      <Text style={{ fontSize: 6.5, color: SURFACE_500 }}>{nom} · modèle offert par Lab Learning · www.lab-learning.fr · à adapter à votre établissement</Text>
      <Text style={{ fontSize: 6.5, color: SURFACE_500 }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

/** Champs à remplir à la main, sur une ligne. */
function Champs({ champs }: { champs: { libelle: string; flex?: number }[] }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 10 }}>
      {champs.map((c, i) => (
        <View key={c.libelle} style={{ flex: c.flex || 1, flexDirection: 'row', alignItems: 'flex-end', marginRight: i < champs.length - 1 ? 14 : 0 }}>
          <Text style={{ fontSize: 8, fontWeight: 700, color: SURFACE_700 }}>{c.libelle} : </Text>
          <View style={{ flex: 1, borderBottomWidth: 0.7, borderBottomColor: SURFACE_400, height: 11 }} />
        </View>
      ))}
    </View>
  )
}

function Encadre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: BRAND_ULTRA_LIGHT, borderRadius: 5, padding: 9, marginBottom: 9 }} wrap={false}>
      <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 9, color: BRAND_GREEN, marginBottom: 3 }}>{titre}</Text>
      {children}
    </View>
  )
}

const Puce = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', marginBottom: 2.5 }}>
    <Text style={{ width: 9, color: BRAND_GREEN, fontWeight: 700 }}>•</Text>
    <Text style={{ flex: 1, fontSize: 8, lineHeight: 1.4 }}>{children}</Text>
  </View>
)

/** Tableau à colonnes de largeur fixe ou souple. Une cellule vide est une case à remplir. */
function Tableau({ colonnes, lignes, hauteur = 18, entete = 22, serre = false }: {
  colonnes: { titre: string; flex?: number; largeur?: number; centre?: boolean }[]
  lignes: (string | null)[][]
  hauteur?: number
  entete?: number
  /** Grille à beaucoup de lignes : marges intérieures réduites */
  serre?: boolean
}) {
  const cote = (c: { flex?: number; largeur?: number }) => (c.largeur ? { width: c.largeur } : { flex: c.flex || 1 })
  return (
    <View style={{ borderWidth: 0.7, borderColor: SURFACE_400, borderRadius: 3 }}>
      <View fixed style={{ flexDirection: 'row', backgroundColor: BRAND_GREEN, minHeight: entete }}>
        {colonnes.map((c, i) => (
          <View key={i} style={{ ...cote(c), justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 3, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: '#FFFFFF55' }}>
            <Text style={{ fontSize: 7, fontWeight: 700, color: '#FFFFFF', textAlign: c.centre ? 'center' : 'left', lineHeight: 1.25 }}>{c.titre}</Text>
          </View>
        ))}
      </View>
      {lignes.map((l, r) => (
        <View key={r} wrap={false} style={{ flexDirection: 'row', minHeight: hauteur, borderTopWidth: 0.5, borderTopColor: LIGNE, backgroundColor: r % 2 ? '#FAFBFC' : '#FFFFFF' }}>
          {colonnes.map((c, i) => (
            <View key={i} style={{ ...cote(c), justifyContent: 'center', paddingHorizontal: 3, paddingVertical: serre ? 0 : 2.5, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: LIGNE }}>
              {l[i] ? <Text style={{ fontSize: serre ? 7 : 7.5, lineHeight: serre ? 1.1 : 1.3, textAlign: c.centre ? 'center' : 'left', color: SURFACE_900 }}>{l[i]}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const vides = (n: number, colonnes: number) => Array.from({ length: n }, () => Array.from({ length: colonnes }, () => null as string | null))

// ─────────────────────────────────────────────────────────── 1. Allergènes

const ALLERGENES: { court: string; long: string; exemples: string }[] = [
  { court: 'Gluten', long: 'Céréales contenant du gluten', exemples: 'blé, seigle, orge, avoine, épeautre : pains, panures, pâtes, sauces liées à la farine' },
  { court: 'Crustacés', long: 'Crustacés', exemples: 'crevettes, crabe, langoustines, surimi qui en contient' },
  { court: 'Œufs', long: 'Œufs', exemples: 'mayonnaise, pâtes aux œufs, dorure des pains, certaines panures' },
  { court: 'Poissons', long: 'Poissons', exemples: 'thon, saumon, anchois des sauces et des pizzas' },
  { court: 'Arachides', long: 'Arachides', exemples: 'cacahuètes, huile d’arachide, sauces satay' },
  { court: 'Soja', long: 'Soja', exemples: 'sauce soja, lécithine, certaines charcuteries et steaks végétaux' },
  { court: 'Lait', long: 'Lait', exemples: 'fromages, crème, beurre, sauces blanches, glaces' },
  { court: 'Fruits à coque', long: 'Fruits à coque', exemples: 'amandes, noisettes, noix, noix de cajou, pistaches : desserts, pesto, pâtes à tartiner' },
  { court: 'Céleri', long: 'Céleri', exemples: 'bouillons, sauces, mélanges d’épices' },
  { court: 'Moutarde', long: 'Moutarde', exemples: 'sauces, vinaigrettes, marinades' },
  { court: 'Sésame', long: 'Graines de sésame', exemples: 'pains à burger, houmous, tahin, huiles' },
  { court: 'Sulfites', long: 'Anhydride sulfureux et sulfites', exemples: 'vins, fruits secs, cornichons, certaines préparations de pommes de terre' },
  { court: 'Lupin', long: 'Lupin', exemples: 'certaines farines, pains et pâtisseries' },
  { court: 'Mollusques', long: 'Mollusques', exemples: 'moules, calamars, poulpe, huîtres' },
]

export function TableauAllergenesPDF() {
  const colonnes = [{ titre: 'Plat, sandwich, sauce, dessert…', flex: 1 }, ...ALLERGENES.map((a) => ({ titre: a.court, largeur: 43, centre: true }))]
  return (
    <Document title="Tableau des allergènes" author="Lab Learning">
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Tableau des allergènes" sousTitre="À afficher ou à tenir à la disposition de vos clients. Cochez chaque allergène présent dans le plat." />
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mis à jour le' }, { libelle: 'Par' }]} />
        <Tableau colonnes={colonnes} lignes={vides(20, colonnes.length)} hauteur={20.5} entete={26} />
        <Pied nom="Tableau des allergènes" />
      </Page>
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Tableau des allergènes : mode d’emploi" sousTitre="Ce que dit la règle, comment remplir le tableau, et où chercher les allergènes cachés." />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Encadre titre="Ce que dit la règle">
              <Puce>Quatorze allergènes doivent être signalés dès qu’ils entrent dans la préparation d’un plat.</Puce>
              <Puce>Dans un lieu où l’on mange sur place, l’information est donnée par écrit, de façon lisible et visible : le client la consulte seul, sans avoir à la demander.</Puce>
              <Puce>Pour les produits vendus au comptoir sans emballage, elle figure sur le produit ou à proximité.</Puce>
              <Puce>Vos fournisseurs doivent joindre à chaque livraison un document indiquant les allergènes.</Puce>
              <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 3 }}>Règlement (UE) n° 1169/2011, annexe II. Code de la consommation, articles R412-12 à R412-16.</Text>
            </Encadre>
            <Encadre titre="Comment remplir le tableau">
              <Puce>Une ligne par plat tel qu’il est servi. Les sauces, les pains et les garnitures au choix ont chacun leur ligne.</Puce>
              <Puce>Partez des fiches de vos fournisseurs, pas de votre mémoire : c’est dans les produits transformés que se cachent les allergènes.</Puce>
              <Puce>Pensez à l’huile de friture partagée : un produit pané y laisse du gluten.</Puce>
              <Puce>Refaites le tableau à chaque changement de recette ou de fournisseur, et datez-le.</Puce>
              <Puce>Montrez-le à toute l’équipe : chacun doit savoir où il est et quoi répondre à un client allergique.</Puce>
            </Encadre>
          </View>
          <View style={{ flex: 1.15 }}>
            <Tableau
              colonnes={[{ titre: 'Allergène', largeur: 118 }, { titre: 'Où le trouve-t-on souvent ?', flex: 1 }]}
              lignes={ALLERGENES.map((a) => [a.long, a.exemples])}
              hauteur={20}
            />
          </View>
        </View>
        <Pied nom="Tableau des allergènes" />
      </Page>
    </Document>
  )
}

// ─────────────────────────────────────────────────────────── 2. Températures

export function ReleveTemperaturesPDF() {
  const enceintes = [1, 2, 3, 4]
  const colonnes = [
    { titre: 'Jour', largeur: 26, centre: true },
    ...enceintes.flatMap(() => [{ titre: 'Matin', largeur: 38, centre: true }, { titre: 'Soir', largeur: 38, centre: true }]),
    { titre: 'Écart constaté et action corrective', flex: 1 },
    { titre: 'Visa', largeur: 44, centre: true },
  ]
  const lignes = Array.from({ length: 31 }, (_, i) => [String(i + 1), ...Array.from({ length: colonnes.length - 1 }, () => null as string | null)])
  return (
    <Document title="Relevé des températures" author="Lab Learning">
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Relevé des températures" sousTitre="Une feuille par mois. Relevez chaque enceinte à l’ouverture et à la fermeture, et notez toute anomalie." />
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        {/* Nom et limite de chaque enceinte, alignés sur les colonnes du tableau */}
        <View style={{ flexDirection: 'row', marginBottom: 3 }}>
          <View style={{ width: 26 }} />
          {enceintes.map((n) => (
            <View key={n} style={{ width: 76, paddingHorizontal: 2 }}>
              <Text style={{ fontSize: 7, fontWeight: 700, color: SURFACE_700 }}>Enceinte {n} :</Text>
              <View style={{ borderBottomWidth: 0.7, borderBottomColor: SURFACE_400, height: 10 }} />
              <Text style={{ fontSize: 6.5, color: SURFACE_500, marginTop: 2 }}>Limite : ……… °C</Text>
            </View>
          ))}
          <View style={{ flex: 1, paddingLeft: 6, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 6.5, color: SURFACE_500 }}>Exemples d’enceintes : chambre froide positive, réfrigérateur de ligne, vitrine, congélateur.</Text>
          </View>
        </View>
        <Tableau colonnes={colonnes} lignes={lignes} hauteur={12.2} entete={15} serre />
        <Pied nom="Relevé des températures" />
      </Page>
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Relevé des températures : repères" sousTitre="Les températures maximales de conservation et la conduite à tenir en cas d’écart." />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Tableau
              colonnes={[{ titre: 'Denrée', flex: 1 }, { titre: 'Température maximale', largeur: 110, centre: true }]}
              lignes={[
                ['Viandes hachées', '+2 °C'],
                ['Produits de la pêche frais', '+2 °C'],
                ['Préparations culinaires élaborées à l’avance', '+3 °C'],
                ['Viandes, volailles, préparations de viandes', '+4 °C'],
                ['Denrées très périssables', '+4 °C'],
                ['Denrées périssables', '+8 °C'],
                ['Produits surgelés, glaces', '−18 °C'],
                ['Plats chauds (température minimale)', '+63 °C au moins'],
              ]}
              hauteur={19}
            />
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>
              Arrêté du 21 décembre 2009, annexe I (remise directe et restauration). Quand l’étiquette du fabricant indique une température plus basse, c’est elle qui s’applique.
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Encadre titre="Comment relever">
              <Puce>Relevez à heure fixe, à l’ouverture et à la fermeture, sur l’afficheur de l’enceinte ou avec un thermomètre de contrôle.</Puce>
              <Puce>Notez la température lue, jamais une valeur attendue : un relevé identique tous les jours ne prouve rien.</Puce>
              <Puce>Écrivez la limite de chaque enceinte en haut de la feuille : celle du produit le plus fragile qu’elle contient.</Puce>
            </Encadre>
            <Encadre titre="En cas d’écart">
              <Puce>Vérifiez d’abord la température à cœur d’un produit avec un thermomètre sonde.</Puce>
              <Puce>Écart court et produit encore à bonne température : réglez l’enceinte, contrôlez à nouveau une heure plus tard.</Puce>
              <Puce>Produit au-dessus de sa limite : il est retiré de la vente. Dans le doute, on jette.</Puce>
              <Puce>Notez dans la colonne de droite ce qui a été constaté et ce qui a été fait, puis signez.</Puce>
            </Encadre>
            <Encadre titre="À conserver">
              <Puce>Gardez ces feuilles : ce sont les premiers documents demandés lors d’un contrôle sanitaire.</Puce>
            </Encadre>
          </View>
        </View>
        <Pied nom="Relevé des températures" />
      </Page>
    </Document>
  )
}

// ─────────────────────────────────────────────────────────── 3. Nettoyage

const ZONES_NETTOYAGE: [string, string][] = [
  ['Plans de travail et tables de préparation', 'Après chaque service'],
  ['Planches, couteaux, ustensiles', 'Après chaque utilisation'],
  ['Plaque de cuisson, grill, toaster', 'Chaque jour'],
  ['Friteuse (cuve, paniers, abords)', 'Chaque jour, vidange selon l’huile'],
  ['Trancheuse, robot, mixeur', 'Après chaque utilisation'],
  ['Bacs et saladettes de ligne', 'Chaque jour'],
  ['Réfrigérateurs et chambre froide', 'Chaque semaine'],
  ['Congélateur', 'Chaque mois'],
  ['Lave-mains et distributeurs', 'Chaque jour'],
  ['Plonge et lave-vaisselle', 'Chaque jour'],
  ['Poignées, interrupteurs, écrans de caisse', 'Chaque jour'],
  ['Sols de la cuisine et de la réserve', 'Chaque jour'],
  ['Hotte et filtres', 'Chaque semaine'],
  ['Poubelles et local à déchets', 'Chaque jour'],
  ['Salle, tables, bornes de commande', 'Après chaque service'],
  ['Sanitaires et vestiaires', 'Chaque jour'],
]

export function PlanNettoyagePDF() {
  const jours = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
  return (
    <Document title="Plan de nettoyage et de désinfection" author="Lab Learning">
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Plan de nettoyage et de désinfection" sousTitre="Qui nettoie quoi, avec quel produit, à quelle fréquence. Complétez les produits d’après leur fiche technique." />
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mis à jour le' }, { libelle: 'Par' }]} />
        <Tableau
          colonnes={[
            { titre: 'Zone ou matériel', flex: 1.5 },
            { titre: 'Fréquence conseillée (à adapter)', flex: 1.1 },
            { titre: 'Produit', flex: 1 },
            { titre: 'Dosage et temps de contact', flex: 1 },
            { titre: 'Méthode (rinçage, séchage…)', flex: 1.2 },
            { titre: 'Qui', largeur: 70 },
          ]}
          lignes={[...ZONES_NETTOYAGE.map(([z, f]) => [z, f, null, null, null, null]), ...vides(3, 6)]}
          hauteur={20.5}
        />
        <Pied nom="Plan de nettoyage et de désinfection" />
      </Page>
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Enregistrement du nettoyage" sousTitre="Une feuille par semaine. Cochez ce qui a été fait, chaque jour, et faites viser en fin de semaine." />
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Semaine du' }, { libelle: 'au' }]} />
        <Tableau
          colonnes={[{ titre: 'Zone ou matériel', flex: 1 }, ...jours.map((j) => ({ titre: j, largeur: 46, centre: true })), { titre: 'Remarque', flex: 0.8 }]}
          lignes={[...ZONES_NETTOYAGE.map(([z]) => [z, ...jours.map(() => null), null]), ...vides(2, 9)]}
          hauteur={19.5}
        />
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <View style={{ flex: 1.4, marginRight: 12 }}>
            <Text style={{ fontSize: 7.5, color: SURFACE_700, lineHeight: 1.4 }}>
              Nettoyer enlève les salissures, désinfecter détruit les microbes : il faut les deux, dans cet ordre, en respectant le dosage et le temps de contact indiqués sur la fiche technique du produit.
              Une case n’est cochée que par la personne qui a fait le nettoyage.
            </Text>
          </View>
          <View style={{ flex: 1 }}><Champs champs={[{ libelle: 'Visa du responsable' }]} /></View>
        </View>
        <Pied nom="Plan de nettoyage et de désinfection" />
      </Page>
    </Document>
  )
}

// ─────────────────────────────────────────────────────────── 4. Document unique

const RISQUES: [string, string, string][] = [
  ['Cuisson', 'Brûlures : friteuse, plaques, grill, huile chaude, vapeur', 'Gants adaptés, paniers à manche long, consigne de vidange à froid, trousse de secours'],
  ['Préparation', 'Coupures : couteaux, trancheuse, ouverture des cartons', 'Couteaux rangés et affûtés, protège-lame, cutter de sécurité, gant anti-coupure'],
  ['Toute la cuisine', 'Glissades et chutes : sol gras ou mouillé, marches, encombrement', 'Chaussures antidérapantes, nettoyage immédiat, tapis, rangement des passages'],
  ['Réserve, livraisons', 'Port de charges : sacs, bidons d’huile, cartons de surgelés', 'Diable, stockage à hauteur, port à deux, formation aux gestes'],
  ['Ligne de préparation', 'Gestes répétitifs et postures debout prolongées', 'Rotation des postes, plans de travail à hauteur, pauses'],
  ['Cuisson, installations', 'Incendie et risque électrique : friteuse, hotte, prises', 'Extincteur et couverture anti-feu, nettoyage des filtres, vérification des installations, consignes affichées'],
  ['Plonge, nettoyage', 'Produits de nettoyage : projections, mélanges, inhalation', 'Fiches de sécurité, gants et lunettes, produits dans leur emballage, jamais de mélange'],
  ['Chambre froide', 'Froid et enfermement', 'Vêtement adapté, ouverture de l’intérieur vérifiée, durée limitée'],
  ['Caisse, salle', 'Incivilités et agressions, manipulation d’espèces', 'Consignes en cas d’agression, caisse limitée, jamais seul à la fermeture'],
  ['Tous les postes', 'Rythme soutenu, horaires décalés, fatigue', 'Plannings anticipés, effectif adapté aux pics, temps de repos respectés'],
  ['Livraison', 'Risque routier : deux-roues, trajets pressés', 'Équipement, entretien des véhicules, pas de prime à la vitesse'],
]

export function TrameDuerpPDF() {
  return (
    <Document title="Trame de document unique (DUERP)" author="Lab Learning">
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Document unique d’évaluation des risques" sousTitre="Trame pour un restaurant rapide. Les lignes sont des exemples : gardez ce qui vous concerne, complétez le reste." />
        <Champs champs={[{ libelle: 'Entreprise', flex: 2 }, { libelle: 'Établissement', flex: 1.5 }, { libelle: 'Effectif' }]} />
        <Champs champs={[{ libelle: 'Rédigé par', flex: 1.5 }, { libelle: 'Date de création' }, { libelle: 'Dernière mise à jour' }]} />
        <Tableau
          colonnes={[
            { titre: 'Unité de travail', largeur: 74 },
            { titre: 'Danger ou situation dangereuse', flex: 1.25 },
            { titre: 'G', largeur: 20, centre: true },
            { titre: 'F', largeur: 20, centre: true },
            { titre: 'Mesures existantes (exemples à adapter)', flex: 1.45 },
            { titre: 'Actions à prévoir', flex: 1 },
            { titre: 'Qui', largeur: 48 },
            { titre: 'Échéance', largeur: 48 },
          ]}
          lignes={[...RISQUES.map(([u, d, m]) => [u, d, null, null, m, null, null, null]), ...vides(2, 8)]}
          hauteur={26}
        />
        <Pied nom="Trame de document unique" />
      </Page>
      <Page size="A4" orientation="landscape" style={page}>
        <Entete titre="Document unique : méthode et rappels" sousTitre="Comment coter un risque, quand mettre à jour, et ce que dit le code du travail." />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Encadre titre="Coter chaque risque">
              <Puce>G, la gravité : 1 bénin, 2 arrêt de travail court, 3 arrêt long ou séquelles, 4 très grave.</Puce>
              <Puce>F, la fréquence d’exposition : 1 rare, 2 chaque mois, 3 chaque semaine, 4 chaque jour.</Puce>
              <Puce>Multipliez G par F : les risques les plus élevés passent en premier dans vos actions.</Puce>
            </Encadre>
            <Encadre titre="Faire participer l’équipe">
              <Puce>Regardez le travail tel qu’il se fait, pas tel qu’il est prévu : un coup de feu, une fermeture, une livraison.</Puce>
              <Puce>Demandez aux équipiers où ils se sont déjà fait peur : ce sont eux qui connaissent les situations dangereuses.</Puce>
              <Puce>Chaque action a un responsable et une échéance, sinon elle ne se fait pas.</Puce>
            </Encadre>
            <Tableau
              colonnes={[{ titre: 'Action de prévention', flex: 1.6 }, { titre: 'Responsable', flex: 0.8 }, { titre: 'Échéance', largeur: 60 }, { titre: 'Fait le', largeur: 60 }]}
              lignes={vides(6, 4)}
              hauteur={19}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Encadre titre="Ce que dit le code du travail">
              <Puce>Le document unique est obligatoire dans toute entreprise dès l’embauche du premier salarié.</Puce>
              <Puce>Il contient l’inventaire des risques et la liste des actions de prévention.</Puce>
              <Puce>Il est mis à jour quand les conditions de travail changent ou qu’une information nouvelle sur un risque est connue, et au moins une fois par an à partir de 11 salariés.</Puce>
              <Puce>Chaque version est conservée 40 ans et tenue à la disposition des salariés.</Puce>
              <Puce>Chaque salarié embauché reçoit une formation pratique à la sécurité de son poste.</Puce>
              <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 3 }}>Code du travail, articles L4121-1 à L4121-3, R4121-1 à R4121-4 et L4141-2.</Text>
            </Encadre>
            <Encadre titre="À retenir">
              <Puce>Cette trame est un point de départ. L’évaluation doit décrire les risques réels de votre établissement : agencement, matériel, organisation.</Puce>
              <Puce>Un nouvel appareil, un réagencement, l’ouverture de la livraison ou un accident du travail imposent de la reprendre.</Puce>
            </Encadre>
            <View style={{ marginTop: 6 }}><Champs champs={[{ libelle: 'Date' }, { libelle: 'Signature de l’employeur', flex: 1.6 }]} /></View>
          </View>
        </View>
        <Pied nom="Trame de document unique" />
      </Page>
    </Document>
  )
}
