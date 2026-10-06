import * as React from 'react'
import { Document, View, Text } from '@react-pdf/renderer'
import { SURFACE_400 } from './components'
import type { NomIcone } from './modeles-icones'
import {
  Feuille, FeuilleLibre, Champs, Tableau, vides, Carte, Puce, Etape, Source, CarteGuide, Pastille, Icone, Paragraphe, Gras, ins,
  PIN, MENTHE_CLAIRE, TEINTE, BORD, ENCRE, GRIS, GRIS_FONCE, type Colonne,
} from './modeles-kit'

/**
 * Modèles gratuits du site public : des documents à imprimer et à remplir par
 * le restaurateur (tableau des allergènes, relevé de températures, plan de
 * nettoyage, trame de document unique). Trois pages chacun : la feuille à
 * remplir, son mode d'emploi, une feuille complémentaire.
 *
 * Ils ne dépendent d'aucune donnée du CRM : le même fichier pour tous. Les
 * rappels réglementaires qu'ils portent sont ceux des guides du site
 * (lib/guides), vérifiés sur les textes officiels cités.
 */

const etiquette = { fontSize: 5.6, fontWeight: 700, color: GRIS, letterSpacing: 0.7 } as const

// ─────────────────────────────────────────────────────────── 1. Allergènes

const ALLERGENES: { court: string; long: string; exemples: string; icone: NomIcone }[] = [
  { court: 'Gluten', long: 'Céréales contenant du gluten', exemples: 'blé, seigle, orge, avoine, épeautre : pains, panures, pâtes, sauces liées à la farine', icone: 'ble' },
  { court: 'Crustacés', long: 'Crustacés', exemples: 'crevettes, crabe, langoustines, surimi qui en contient', icone: 'crevette' },
  { court: 'Œufs', long: 'Œufs', exemples: 'mayonnaise, pâtes aux œufs, dorure des pains, certaines panures', icone: 'oeuf' },
  { court: 'Poissons', long: 'Poissons', exemples: 'thon, saumon, anchois des sauces et des pizzas', icone: 'poisson' },
  { court: 'Arachides', long: 'Arachides', exemples: 'cacahuètes, huile d’arachide, sauces satay', icone: 'arachide' },
  { court: 'Soja', long: 'Soja', exemples: 'sauce soja, lécithine, certaines charcuteries et steaks végétaux', icone: 'feve' },
  { court: 'Lait', long: 'Lait', exemples: 'fromages, crème, beurre, sauces blanches, glaces', icone: 'lait' },
  { court: 'Fruits à coque', long: 'Fruits à coque', exemples: 'amandes, noisettes, noix, noix de cajou, pistaches : desserts, pesto, pâtes à tartiner', icone: 'noix' },
  { court: 'Céleri', long: 'Céleri', exemples: 'bouillons, sauces, mélanges d’épices', icone: 'feuille' },
  { court: 'Moutarde', long: 'Moutarde', exemples: 'sauces, vinaigrettes, marinades', icone: 'moutarde' },
  { court: 'Sésame', long: 'Graines de sésame', exemples: 'pains à burger, houmous, tahin, huiles', icone: 'sesame' },
  { court: 'Sulfites', long: 'Anhydride sulfureux et sulfites', exemples: 'vins, fruits secs, cornichons, certaines préparations de pommes de terre', icone: 'raisin' },
  { court: 'Lupin', long: 'Lupin', exemples: 'certaines farines, pains et pâtisseries', icone: 'fleur' },
  { court: 'Mollusques', long: 'Mollusques', exemples: 'moules, calamars, poulpe, huîtres', icone: 'coquillage' },
]

export function PagesAllergenes({ pied = 'Tableau des allergènes' }: { pied?: string }) {
  const colonnes: Colonne[] = [
    { titre: 'Plat, sandwich, sauce, dessert…', flex: 1, gras: true },
    ...ALLERGENES.map((a) => ({ titre: a.court, largeur: 43, icone: a.icone, coche: true })),
  ]
  const moitie = Math.ceil(ALLERGENES.length / 2)
  return (
    <>
      <Feuille icone="ble" surTitre="Hygiène alimentaire · à remplir et à afficher" titre="Tableau des allergènes" sousTitre="À afficher ou à tenir à la disposition de vos clients. Cochez chaque allergène présent dans le plat." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mis à jour le' }, { libelle: 'Par' }]} />
        <Tableau colonnes={colonnes} lignes={vides(18, colonnes.length)} hauteur={20.6} entete={46} />
      </Feuille>

      <Feuille icone="info" surTitre="Hygiène alimentaire · mode d’emploi" titre="Remplir le tableau des allergènes" sousTitre="Ce que dit la règle, comment remplir le tableau, et où chercher les allergènes cachés." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1.14, marginRight: 10 }}>
            <Carte icone="balance" titre="Ce que dit la règle">
              <Puce>Quatorze allergènes doivent être signalés dès qu’ils entrent dans la préparation d’un plat.</Puce>
              <Puce>Dans un lieu où l’on mange sur place, l’information est donnée par écrit, de façon lisible et visible : le client la consulte seul, sans avoir à la demander.</Puce>
              <Puce>Pour les produits vendus au comptoir sans emballage, elle figure sur le produit ou à proximité.</Puce>
              <Puce>Vos fournisseurs doivent joindre à chaque livraison un document indiquant les allergènes.</Puce>
              <Source>Règlement (UE) n° 1169/2011, annexe II. Code de la consommation, articles R412-12 à R412-16.</Source>
            </Carte>
            <Carte icone="crayon" titre="Comment remplir le tableau">
              <Etape n={1}>Une ligne par plat tel qu’il est servi. Les sauces, les pains et les garnitures au choix ont chacun leur ligne.</Etape>
              <Etape n={2}>Partez des fiches de vos fournisseurs, pas de votre mémoire : c’est dans les produits transformés que se cachent les allergènes.</Etape>
              <Etape n={3}>Pensez à l’huile de friture partagée : un produit pané y laisse du gluten.</Etape>
              <Etape n={4}>Refaites le tableau à chaque changement de recette ou de fournisseur, et datez-le.</Etape>
              <Etape n={5}>Montrez-le à toute l’équipe : chacun doit savoir où il est et quoi répondre à un client allergique.</Etape>
            </Carte>
            <CarteGuide serre titre="Le guide complet" texte="Les 14 allergènes, l’affichage attendu et les erreurs que relèvent les contrôles." chemin="/guides/allergenes-restaurant-affichage-obligatoire" />
          </View>
          <View style={{ flex: 1.2 }}>
            <Carte icone="loupe" titre="Où se cachent les allergènes" marge={0}>
              <View style={{ flexDirection: 'row' }}>
                {[ALLERGENES.slice(0, moitie), ALLERGENES.slice(moitie)].map((groupe, g) => (
                  <View key={g} style={{ flex: 1, marginLeft: g ? 10 : 0 }}>
                    {groupe.map((a) => (
                      <View key={a.long} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderTopWidth: 0.5, borderTopColor: '#E1E6EB', paddingVertical: 5 }}>
                        <Pastille nom={a.icone} taille={28} />
                        <View style={{ flex: 1, paddingLeft: 9 }}>
                          <Text style={{ fontSize: 9, fontWeight: 700, color: ENCRE }}>{a.long}</Text>
                          <Text style={{ fontSize: 8, lineHeight: 1.38, color: GRIS_FONCE, marginTop: 1 }}>{ins(a.exemples)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </Carte>
          </View>
        </View>
      </Feuille>

      {/* Affichette pour la salle : elle dit au client où consulter le tableau */}
      <FeuilleLibre pied="Affichette allergènes">
        <View style={{ flex: 1, borderWidth: 1.2, borderColor: PIN, borderRadius: 16, paddingVertical: 26, paddingHorizontal: 34, marginBottom: 6 }}>
          <Text style={{ fontSize: 8, fontWeight: 700, color: PIN, letterSpacing: 1.6 }}>INFORMATION ALLERGÈNES</Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 34, color: ENCRE, marginTop: 6 }}>Le tableau des allergènes</Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 34, color: PIN }}>est en libre consultation.</Text>
          <Text style={{ fontSize: 13, lineHeight: 1.45, color: GRIS_FONCE, marginTop: 10, maxWidth: 560 }}>
            Il indique, plat par plat, les allergènes présents dans nos recettes. Vous pouvez le consulter vous-même, à tout moment.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
            <View style={{ backgroundColor: PIN, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, height: 46, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 12, color: '#FFFFFF' }}>Où le trouver</Text>
            </View>
            <View style={{ flex: 1, height: 46, borderWidth: 1.2, borderColor: PIN, borderTopRightRadius: 10, borderBottomRightRadius: 10, borderLeftWidth: 0 }} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {ALLERGENES.map((a) => (
                <View key={a.long} style={{ width: '14.28%', alignItems: 'center', paddingVertical: 8 }}>
                  <Pastille nom={a.icone} taille={38} />
                  <Text style={{ fontSize: 8.6, fontWeight: 700, color: ENCRE, marginTop: 5, textAlign: 'center' }}>{a.court}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Pastille nom="alerte" taille={24} fond="#FFFFFF" />
            <Text style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: ENCRE, marginLeft: 10 }}>{ins('Vous êtes allergique ? Dites-le à notre équipe avant de commander.')}</Text>
          </View>
        </View>
      </FeuilleLibre>
    </>
  )
}

// ─────────────────────────────────────────────────────────── 2. Températures

const REPERES: { valeur: string; sens: string; denrees: string; couleur: string; fond: string; icone: NomIcone }[] = [
  { valeur: '−18 °C', sens: 'Au plus', denrees: 'Produits surgelés, glaces', couleur: '#1E5FA8', fond: '#E6F0FA', icone: 'flocon' },
  { valeur: '+2 °C', sens: 'Au plus', denrees: 'Viandes hachées, produits de la pêche frais', couleur: '#0F6E8C', fond: '#E2F2F7', icone: 'thermometreFroid' },
  { valeur: '+3 °C', sens: 'Au plus', denrees: 'Préparations culinaires élaborées à l’avance', couleur: '#0F7A6C', fond: '#E1F4F0', icone: 'thermometreFroid' },
  { valeur: '+4 °C', sens: 'Au plus', denrees: 'Viandes, volailles, préparations de viandes, denrées très périssables', couleur: PIN, fond: MENTHE_CLAIRE, icone: 'frigo' },
  { valeur: '+8 °C', sens: 'Au plus', denrees: 'Denrées périssables', couleur: '#8A6A00', fond: '#FBF2D2', icone: 'frigo' },
  { valeur: '+63 °C', sens: 'Au moins', denrees: 'Plats chauds, jusqu’au service', couleur: '#B4441B', fond: '#FCE8DE', icone: 'flamme' },
]

export function PagesTemperatures({ pied = 'Relevé des températures' }: { pied?: string }) {
  const enceintes = [1, 2, 3, 4]
  const colonnes: Colonne[] = [
    { titre: 'Jour', largeur: 28, centre: true, gras: true },
    ...enceintes.flatMap(() => [{ titre: 'Matin', largeur: 44, centre: true }, { titre: 'Soir', largeur: 44, centre: true }]),
    { titre: 'Écart constaté et action corrective', flex: 1 },
    { titre: 'Visa', largeur: 46, centre: true },
  ]
  const lignes = Array.from({ length: 31 }, (_, i) => [String(i + 1), ...Array.from({ length: colonnes.length - 1 }, () => null as string | null)])
  return (
    <>
      <Feuille icone="thermometre" surTitre="Hygiène alimentaire · une feuille par mois" titre="Relevé des températures" sousTitre="Relevez chaque enceinte à l’ouverture et à la fermeture, et notez toute anomalie." pied={pied}>
        <Champs hauteur={23} marge={7} champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={colonnes}
          lignes={lignes}
          hauteur={11.9}
          entete={14}
          serre
          groupes={[
            { colonnes: 1 },
            ...enceintes.map((n) => ({
              colonnes: 2,
              contenu: (
                <View>
                  <Text style={etiquette}>ENCEINTE {n}</Text>
                  <View style={{ height: 10, borderBottomWidth: 0.7, borderBottomColor: SURFACE_400 }} />
                  <Text style={{ fontSize: 6.2, color: GRIS, marginTop: 3 }}>Limite : ............ °C</Text>
                </View>
              ),
            })),
            {
              colonnes: 1,
              contenu: (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 6.8, lineHeight: 1.4, color: GRIS_FONCE }}>
                    Nommez chaque enceinte : chambre froide positive, réfrigérateur de ligne, vitrine, congélateur. Sa limite est celle du produit le plus fragile qu’elle contient (repères en page 2).
                  </Text>
                </View>
              ),
            },
            { colonnes: 1 },
          ]}
        />
      </Feuille>

      <Feuille icone="thermometreFroid" surTitre="Hygiène alimentaire · repères" titre="Les températures à respecter" sousTitre="Les températures de conservation, la bonne façon de relever et la conduite à tenir en cas d’écart." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          {REPERES.map((r, i) => (
            <View key={r.valeur} style={{ flex: 1, backgroundColor: r.fond, borderRadius: 11, padding: 10, marginRight: i < REPERES.length - 1 ? 7 : 0, minHeight: 98 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 6.4, fontWeight: 700, color: r.couleur, letterSpacing: 0.9 }}>{r.sens.toUpperCase()}</Text>
                <Icone nom={r.icone} taille={15} couleur={r.couleur} />
              </View>
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 22, color: r.couleur, marginTop: 4 }}>{r.valeur}</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.36, color: GRIS_FONCE, marginTop: 3 }}>{r.denrees}</Text>
            </View>
          ))}
        </View>
        <Source>
          Arrêté du 21 décembre 2009, annexe I (remise directe et restauration). Quand l’étiquette du fabricant indique une température plus basse, c’est elle qui s’applique.
        </Source>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <View style={{ flex: 1.05, marginRight: 10 }}>
            <Carte icone="crayon" titre="Comment relever" marge={0}>
              <Etape n={1}>Relevez à heure fixe, à l’ouverture et à la fermeture, sur l’afficheur de l’enceinte ou avec un thermomètre de contrôle.</Etape>
              <Etape n={2}>Notez la température lue, jamais une valeur attendue : un relevé identique tous les jours ne prouve rien.</Etape>
              <Etape n={3}>Écrivez la limite de chaque enceinte en haut de la feuille : celle du produit le plus fragile qu’elle contient.</Etape>
            </Carte>
          </View>
          <View style={{ flex: 1.3, marginRight: 10 }}>
            <Carte icone="alerte" titre="En cas d’écart" marge={0}>
              <Etape n={1}>Vérifiez d’abord la température à cœur d’un produit avec un thermomètre sonde.</Etape>
              <Etape n={2}>Écart court et produit encore à bonne température : réglez l’enceinte, contrôlez à nouveau une heure plus tard.</Etape>
              <Etape n={3}>Produit au-dessus de sa limite : il est retiré de la vente. Dans le doute, on jette.</Etape>
              <Etape n={4}>Notez dans la colonne de droite ce qui a été constaté et ce qui a été fait, puis signez.</Etape>
            </Carte>
          </View>
          <View style={{ flex: 0.95 }}>
            <Carte icone="archive" titre="À conserver" fond={TEINTE} marge={8}>
              <Paragraphe>Gardez ces feuilles : elles font partie des documents demandés lors d’un contrôle sanitaire.</Paragraphe>
            </Carte>
            <CarteGuide serre titre="Préparer un contrôle" texte="Ce que regarde l’inspecteur, les documents à tenir prêts." chemin="/guides/controle-hygiene-restaurant-ddpp" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
          <Pastille nom="frigo" taille={20} />
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: PIN, marginLeft: 7 }}>Vos enceintes</Text>
          <Text style={{ flex: 1, fontSize: 8.2, color: GRIS, marginLeft: 8 }}>{ins('Remplissez ce tableau une fois : il fixe la limite à reporter en haut de chaque feuille du mois.')}</Text>
        </View>
        <Tableau
          colonnes={[
            { titre: 'Enceinte', largeur: 70, gras: true },
            { titre: 'Nom et emplacement', flex: 1.2 },
            { titre: 'Ce qu’elle contient', flex: 1.6 },
            { titre: 'Produit le plus fragile', flex: 1.1 },
            { titre: 'Limite retenue', largeur: 76, centre: true },
            { titre: 'Relevé sur', largeur: 118, centre: true, choix: ['Afficheur', 'Thermomètre'] },
          ]}
          lignes={[1, 2, 3, 4].map((n) => [`Enceinte ${n}`, null, null, null, null, null])}
          hauteur={19.5}
          entete={19}
        />
      </Feuille>

      <Feuille icone="camion" surTitre="Hygiène alimentaire · à chaque livraison" titre="Contrôle à réception" sousTitre="Une ligne par produit frais ou surgelé livré. Le contrôle se fait avant de signer le bon de livraison." pied="Contrôle à réception">
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={[
            { titre: 'Date', largeur: 48 },
            { titre: 'Fournisseur', flex: 1 },
            { titre: 'Produit', flex: 1.2 },
            { titre: 'Température relevée', largeur: 58, centre: true },
            { titre: 'DLC ou DDM', largeur: 60, centre: true },
            { titre: 'Emballage intact', largeur: 66, centre: true, choix: ['Oui', 'Non'] },
            { titre: 'Produit accepté', largeur: 66, centre: true, choix: ['Oui', 'Non'] },
            { titre: 'Si refusé : motif et suite donnée', flex: 1.3 },
            { titre: 'Visa', largeur: 46, centre: true },
          ]}
          lignes={vides(15, 9)}
          hauteur={21.2}
          entete={24}
        />
        <View style={{ flexDirection: 'row', marginTop: 9 }}>
          {([
            ['thermometre', 'Mesurez avant de signer', 'Prenez la température entre deux colis, ou à cœur avec une sonde désinfectée. Les repères sont en page 2.'],
            ['croix', 'Refusez ce qui n’est pas conforme', 'Produit trop chaud, emballage abîmé ou date dépassée : refusez-le et notez le refus sur le bon de livraison.'],
            ['horloge', 'Rangez sans attendre', 'Les surgelés d’abord, puis le frais. Rien ne reste à température ambiante.'],
          ] as [NomIcone, string, string][]).map(([icone, titre, texte], i) => (
            <View key={titre} style={{ flex: 1, flexDirection: 'row', backgroundColor: TEINTE, borderRadius: 9, padding: 9, marginRight: i < 2 ? 8 : 0 }}>
              <Pastille nom={icone} taille={20} fond="#FFFFFF" />
              <View style={{ flex: 1, paddingLeft: 8 }}>
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 8.6, color: PIN }}>{titre}</Text>
                <Text style={{ fontSize: 7.8, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 2 }}>{ins(texte)}</Text>
              </View>
            </View>
          ))}
        </View>
      </Feuille>
    </>
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

const ETAPES_NETTOYAGE: { icone: NomIcone; titre: string; texte: string }[] = [
  { icone: 'poubelle', titre: 'Débarrasser', texte: 'Retirez les denrées, les déchets et les résidus visibles.' },
  { icone: 'brosse', titre: 'Laver', texte: 'Appliquez le détergent et frottez : le frottement décolle les graisses.' },
  { icone: 'goutte', titre: 'Rincer', texte: 'À l’eau claire, pour éliminer les salissures et le détergent.' },
  { icone: 'spray', titre: 'Désinfecter', texte: 'Appliquez le désinfectant au bon dosage et laissez agir le temps indiqué.' },
  { icone: 'gouttes', titre: 'Rincer', texte: 'Toute surface au contact des aliments, sauf produit prévu sans rinçage.' },
  { icone: 'vent', titre: 'Sécher', texte: 'À l’air libre ou au papier à usage unique, jamais au torchon.' },
]

export function PagesNettoyage({ pied = 'Plan de nettoyage et de désinfection' }: { pied?: string }) {
  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  return (
    <>
      <Feuille icone="seau" surTitre="Hygiène alimentaire · à compléter et à afficher" titre="Plan de nettoyage et de désinfection" sousTitre="Qui nettoie quoi, avec quel produit, à quelle fréquence. Complétez les produits d’après leur fiche technique." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mis à jour le' }, { libelle: 'Par' }]} />
        <Tableau
          colonnes={[
            { titre: 'Zone ou matériel', flex: 1.5, gras: true },
            { titre: 'Fréquence conseillée (à adapter)', flex: 1.1 },
            { titre: 'Produit', flex: 1 },
            { titre: 'Dosage et temps de contact', flex: 1 },
            { titre: 'Méthode (rinçage, séchage…)', flex: 1.2 },
            { titre: 'Qui', largeur: 74 },
          ]}
          lignes={[...ZONES_NETTOYAGE.map(([z, f]) => [z, f, null, null, null, null]), ...vides(3, 6)]}
          hauteur={20.2}
        />
      </Feuille>

      <Feuille icone="presse" surTitre="Hygiène alimentaire · une feuille par semaine" titre="Enregistrement du nettoyage" sousTitre="Cochez ce qui a été fait, chaque jour, et faites viser la feuille en fin de semaine." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Semaine du' }, { libelle: 'Au' }, { libelle: 'Visa du responsable', flex: 1.2 }]} />
        <Tableau
          colonnes={[{ titre: 'Zone ou matériel', flex: 1, gras: true }, ...jours.map((j) => ({ titre: j, largeur: 52, centre: true, coche: true })), { titre: 'Remarque', flex: 0.75 }]}
          lignes={[...ZONES_NETTOYAGE.map(([z]) => [z, ...jours.map(() => null), null]), ...vides(2, 9)]}
          hauteur={19.4}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 10, marginTop: 8 }}>
          <Pastille nom="info" taille={18} fond="#FFFFFF" />
          <Text style={{ flex: 1, fontSize: 7.6, lineHeight: 1.4, color: GRIS_FONCE, marginLeft: 8 }}>
            {ins('Une case n’est cochée que par la personne qui a fait le nettoyage. Une zone qui ne se nettoie pas ce jour-là reste vide : barrez-la d’un trait pour montrer qu’elle n’a pas été oubliée.')}
          </Text>
        </View>
      </Feuille>

      <Feuille icone="bulles" surTitre="Hygiène alimentaire · la méthode" titre="Nettoyer, puis désinfecter" sousTitre="Nettoyer enlève les salissures, désinfecter détruit les microbes : il faut les deux, dans cet ordre." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          {ETAPES_NETTOYAGE.map((e, i) => (
            <View key={i} style={{ flex: 1, borderWidth: 0.8, borderColor: BORD, borderRadius: 11, padding: 10, marginRight: i < ETAPES_NETTOYAGE.length - 1 ? 7 : 0, minHeight: 112 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pastille nom={e.icone} taille={30} />
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 22, color: '#C9D8D1' }}>{i + 1}</Text>
              </View>
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: PIN, marginTop: 8 }}>{e.titre}</Text>
              <Text style={{ fontSize: 8.3, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 3 }}>{ins(e.texte)}</Text>
            </View>
          ))}
        </View>
        <Source>Avec un produit détergent-désinfectant, le lavage et la désinfection se font en une seule application : respectez quand même le temps de contact.</Source>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <View style={{ flex: 1.12, marginRight: 10 }}>
            <Carte icone="cible" titre="Les quatre réglages d’un produit" marge={0}>
              <Puce><Gras>Le dosage : </Gras>celui de la fiche technique. Plus de produit ne nettoie pas mieux et laisse des résidus.</Puce>
              <Puce><Gras>La température de l’eau : </Gras>celle que la fiche indique. Certains produits perdent leur efficacité dans une eau trop chaude.</Puce>
              <Puce><Gras>Le temps de contact : </Gras>un désinfectant rincé trop tôt n’a pas eu le temps d’agir.</Puce>
              <Puce><Gras>Le frottement : </Gras>sans action mécanique, les graisses restent en place et protègent les microbes.</Puce>
            </Carte>
          </View>
          <View style={{ flex: 1.05, marginRight: 10 }}>
            <Carte icone="alerte" titre="Les erreurs qui reviennent" marge={0}>
              <Puce>Mélanger deux produits : c’est inefficace, et parfois dangereux.</Puce>
              <Puce>Désinfecter une surface encore sale : un désinfectant n’agit que sur une surface propre.</Puce>
              <Puce>Essuyer avec un torchon ou une éponge usagée, qui redéposent des microbes.</Puce>
              <Puce>Transvaser un produit dans un flacon sans étiquette.</Puce>
              <Puce>Oublier les points de contact : poignées, robinets, interrupteurs, écrans.</Puce>
            </Carte>
          </View>
          <View style={{ flex: 0.86 }}>
            <Carte icone="secours" titre="Sécurité de l’équipe" fond={TEINTE} marge={8}>
              <Paragraphe>Gardez la fiche de données de sécurité de chaque produit à portée de main, avec les gants et les lunettes qu’elle demande.</Paragraphe>
            </Carte>
            <CarteGuide serre titre="Préparer un contrôle" texte="Ce que regarde l’inspecteur, les documents à tenir prêts." chemin="/guides/controle-hygiene-restaurant-ddpp" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
          <Pastille nom="spray" taille={20} />
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: PIN, marginLeft: 7 }}>Vos produits</Text>
          <Text style={{ flex: 1, fontSize: 8.2, color: GRIS, marginLeft: 8 }}>{ins('Notez ici ce que dit la fiche technique de chaque produit : c’est la référence de toute l’équipe.')}</Text>
        </View>
        <Tableau
          colonnes={[
            { titre: 'Produit', flex: 1.3, gras: true },
            { titre: 'Sert à', largeur: 190, centre: true, choix: ['Laver', 'Désinfecter', 'Les deux'] },
            { titre: 'Dosage', flex: 0.8 },
            { titre: 'Temps de contact', flex: 0.8 },
            { titre: 'Rinçage', largeur: 82, centre: true, choix: ['Oui', 'Non'] },
            { titre: 'Utilisé pour', flex: 1.3 },
          ]}
          lignes={vides(4, 6)}
          hauteur={19.5}
          entete={19}
        />
      </Feuille>
    </>
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

/** Niveau de priorité d'un score gravité x fréquence : un repère proposé, pas une règle. */
const NIVEAUX = [
  { min: 9, libelle: '9 à 16', suite: 'à traiter en premier', couleur: '#9F2D17', fond: '#FBDCD4' },
  { min: 4, libelle: '4 à 8', suite: 'à planifier', couleur: '#7A5B00', fond: '#FBEFC6' },
  { min: 1, libelle: '1 à 3', suite: 'à surveiller', couleur: PIN, fond: MENTHE_CLAIRE },
]
const niveau = (score: number) => NIVEAUX.find((n) => score >= n.min) as (typeof NIVEAUX)[number]

function MatriceRisques() {
  const c = 36
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View>
        {[4, 3, 2, 1].map((g) => (
          <View key={g} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2.5 }}>
            <Text style={{ width: 24, fontSize: 7.8, fontWeight: 700, color: GRIS }}>G {g}</Text>
            {[1, 2, 3, 4].map((f) => {
              const n = niveau(g * f)
              return (
                <View key={f} style={{ width: c, height: 25, borderRadius: 6, backgroundColor: n.fond, alignItems: 'center', justifyContent: 'center', marginRight: 2.5 }}>
                  <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10, color: n.couleur }}>{g * f}</Text>
                </View>
              )
            })}
          </View>
        ))}
        <View style={{ flexDirection: 'row', marginLeft: 24 }}>
          {[1, 2, 3, 4].map((f) => <Text key={f} style={{ width: c + 2.5, fontSize: 7.8, fontWeight: 700, color: GRIS, textAlign: 'center' }}>F {f}</Text>)}
        </View>
      </View>
      <View style={{ flex: 1, paddingLeft: 16 }}>
        {NIVEAUX.map((n) => (
          <View key={n.libelle} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
            <View style={{ backgroundColor: n.fond, borderRadius: 6, paddingVertical: 3.5, width: 46, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: n.couleur }}>{n.libelle}</Text>
            </View>
            <Text style={{ fontSize: 8.9, color: GRIS_FONCE, marginLeft: 8 }}>{n.suite}</Text>
          </View>
        ))}
        <Text style={{ fontSize: 7, lineHeight: 1.4, color: GRIS, marginTop: 1 }}>{ins('Repère proposé pour classer vos priorités : adaptez-le si besoin.')}</Text>
      </View>
    </View>
  )
}

const Echelle = ({ titre, niveaux }: { titre: string; niveaux: string[] }) => (
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 8.9, fontWeight: 700, color: ENCRE, marginBottom: 4 }}>{titre}</Text>
    {niveaux.map((t, i) => (
      <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3.5 }}>
        <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: TEINTE, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
          <Text style={{ fontSize: 7.6, fontWeight: 700, color: PIN }}>{i + 1}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 8.9, color: GRIS_FONCE }}>{t}</Text>
      </View>
    ))}
  </View>
)

export function PagesDuerp({ pied = 'Trame de document unique' }: { pied?: string }) {
  return (
    <>
      <Feuille icone="bouclier" surTitre="Prévention des risques · trame à compléter" titre="Document unique d’évaluation des risques" sousTitre="Trame pour un restaurant rapide. Les lignes sont des exemples : gardez ce qui vous concerne, complétez le reste." pied={pied}>
        <Champs marge={6} hauteur={23} champs={[{ libelle: 'Entreprise', flex: 2 }, { libelle: 'Établissement', flex: 1.5 }, { libelle: 'Effectif', flex: 0.7 }, { libelle: 'Rédigé par', flex: 1.3 }, { libelle: 'Créé le', flex: 0.8 }, { libelle: 'Mis à jour le', flex: 0.8 }]} />
        <Tableau
          colonnes={[
            { titre: 'Unité de travail', largeur: 78, gras: true },
            { titre: 'Danger ou situation dangereuse', flex: 1.25 },
            { titre: 'G', largeur: 22, centre: true },
            { titre: 'F', largeur: 22, centre: true },
            { titre: 'G × F', largeur: 30, centre: true },
            { titre: 'Mesures existantes (exemples à adapter)', flex: 1.45 },
            { titre: 'Actions à prévoir', flex: 1 },
            { titre: 'Qui', largeur: 48 },
            { titre: 'Échéance', largeur: 48 },
          ]}
          lignes={[...RISQUES.map(([u, d, m]) => [u, d, null, null, null, m, null, null, null]), ...vides(2, 9)]}
          hauteur={30}
        />
      </Feuille>

      <Feuille icone="ampoule" surTitre="Prévention des risques · la méthode" titre="Évaluer les risques, pas à pas" sousTitre="Comment coter un risque, quand mettre à jour le document, et ce que dit le code du travail." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1.1, marginRight: 10 }}>
            <Carte icone="cible" titre="Coter chaque risque">
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Echelle titre="G, la gravité" niveaux={['Bénin', 'Arrêt de travail court', 'Arrêt long ou séquelles', 'Très grave']} />
                <View style={{ width: 10 }} />
                <Echelle titre="F, la fréquence d’exposition" niveaux={['Rare', 'Chaque mois', 'Chaque semaine', 'Chaque jour']} />
              </View>
              <View style={{ marginBottom: 9 }}><Paragraphe>Multipliez G par F : les risques au score le plus élevé passent en premier dans vos actions.</Paragraphe></View>
              <MatriceRisques />
            </Carte>
            <Carte icone="equipe" titre="Faire participer l’équipe" marge={0}>
              <Puce>Regardez le travail tel qu’il se fait, pas tel qu’il est prévu : un coup de feu, une fermeture, une livraison.</Puce>
              <Puce>Demandez aux équipiers où ils se sont déjà fait peur : ce sont eux qui connaissent les situations dangereuses.</Puce>
              <Puce>Chaque action a un responsable et une échéance, sinon elle ne se fait pas.</Puce>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="balance" titre="Ce que dit le code du travail">
              <Puce>Le document unique est obligatoire dans toute entreprise dès l’embauche du premier salarié.</Puce>
              <Puce>Il contient l’inventaire des risques et la liste des actions de prévention.</Puce>
              <Puce>Il est mis à jour quand les conditions de travail changent ou qu’une information nouvelle sur un risque est connue, et au moins une fois par an à partir de 11 salariés.</Puce>
              <Puce>Chaque version est conservée 40 ans et tenue à la disposition des salariés.</Puce>
              <Puce>Chaque salarié embauché reçoit une formation pratique à la sécurité de son poste.</Puce>
              <Source>Code du travail, articles L4121-1 à L4121-3, R4121-1 à R4121-4 et L4141-2.</Source>
            </Carte>
            <Carte icone="repete" titre="Quand le reprendre" fond={TEINTE}>
              <Paragraphe>Un nouvel appareil, un réagencement, l’ouverture de la livraison ou un accident du travail imposent de reprendre l’évaluation. Cette trame est un point de départ : elle doit décrire les risques réels de votre établissement.</Paragraphe>
            </Carte>
            <CarteGuide titre="Le guide complet" texte="Qui doit rédiger le document unique, ce qu’il contient, comment le tenir à jour." chemin="/guides/document-unique-duerp-restaurant" />
          </View>
        </View>
      </Feuille>

      <Feuille icone="tache" surTitre="Prévention des risques · à tenir à jour" titre="Plan d’actions de prévention" sousTitre="Reportez ici les actions décidées pour les risques au score le plus élevé, puis suivez leur réalisation." pied={pied}>
        <Tableau
          colonnes={[
            { titre: 'Risque visé', flex: 1.1, gras: true },
            { titre: 'Action de prévention', flex: 1.7 },
            { titre: 'Responsable', flex: 0.7 },
            { titre: 'Moyens nécessaires', flex: 0.9 },
            { titre: 'Échéance', largeur: 58, centre: true },
            { titre: 'Fait le', largeur: 58, centre: true },
            { titre: 'Fait', largeur: 34, centre: true, coche: true },
          ]}
          lignes={vides(15, 7)}
          hauteur={22.6}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}>
          <View style={{ flex: 1.3, marginRight: 10 }}>
            <Paragraphe>Ce plan se met à jour en même temps que le document unique. Datez et signez chaque nouvelle version, et conservez les précédentes.</Paragraphe>
          </View>
          <View style={{ flex: 1 }}>
            <Champs marge={0} hauteur={30} champs={[{ libelle: 'Date', flex: 0.6 }, { libelle: 'Signature de l’employeur', flex: 1.4 }]} />
          </View>
        </View>
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Documents

const enDocument = (titre: string, pages: React.ReactNode) => <Document title={titre} author="Lab Learning" subject="Modèle gratuit à imprimer">{pages}</Document>

export const TableauAllergenesPDF = () => enDocument('Tableau des allergènes', <PagesAllergenes />)
export const ReleveTemperaturesPDF = () => enDocument('Relevé des températures', <PagesTemperatures />)
export const PlanNettoyagePDF = () => enDocument('Plan de nettoyage et de désinfection', <PagesNettoyage />)
export const TrameDuerpPDF = () => enDocument('Trame de document unique (DUERP)', <PagesDuerp />)
