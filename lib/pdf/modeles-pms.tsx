import * as React from 'react'
import { Document, View, Text } from '@react-pdf/renderer'
import { LogoLabLearning } from './logo-lab-learning'
import type { NomIcone } from './modeles-icones'
import {
  Feuille, FeuilleLibre, Champs, Tableau, vides, Carte, Puce, Etape, Source, CarteGuide, Pastille, Paragraphe, ins,
  Repere, TitreSection, ChampLigne, Bandeau,
  PIN, MENTHE_CLAIRE, TEINTE, BORD, ENCRE, GRIS, GRIS_FONCE, type Colonne,
} from './modeles-kit'
import { PagesAllergenes, PagesNettoyage, PagesTemperatures } from './modeles-pdf'

/**
 * Le plan de maîtrise sanitaire (PMS) et ses fiches, pour la restauration
 * rapide. Chaque fiche existe seule (modèle gratuit du site) et dans le
 * classeur complet, qui les assemble derrière les pages de présentation.
 *
 * Les rappels réglementaires sont ceux des textes cités sur chaque page :
 * règlements (CE) n° 852/2004 et n° 178/2002, arrêté du 21 décembre 2009,
 * décret n° 2008-184 (huiles de friture), décret n° 2011-731 (formation).
 * Les durées de refroidissement et de remise en température viennent de
 * l'annexe IV de l'arrêté, qui vise la restauration collective : elles sont
 * présentées comme une référence, pas comme une obligation de la restauration
 * commerciale.
 */

const GUIDE_PMS = '/guides/plan-de-maitrise-sanitaire-pms-restaurant'
type P = { pied?: string }

// ─────────────────────────────────────────────────────────── Formations de l'équipe

export function PagesFormations({ pied = 'Suivi des formations de l’équipe' }: P) {
  return (
    <>
      <Feuille icone="diplome" surTitre="L’équipe · à tenir à jour" titre="Suivi des formations de l’équipe" sousTitre="Une ligne par personne. Notez chaque formation et chaque consigne transmise, avec sa date." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mis à jour le' }, { libelle: 'Par' }]} />
        <Tableau
          colonnes={[
            { titre: 'Nom et prénom', flex: 1.3, gras: true },
            { titre: 'Poste', flex: 0.9 },
            { titre: 'Arrivée le', largeur: 56, centre: true },
            { titre: 'Hygiène alimentaire, 14 h (date, organisme)', flex: 1.2 },
            { titre: 'Consignes d’hygiène au poste (date, par qui)', flex: 1.1 },
            { titre: 'Sécurité au poste (date)', largeur: 76, centre: true },
            { titre: 'Autres formations', flex: 1 },
            { titre: 'Attestation classée', largeur: 62, centre: true, coche: true },
          ]}
          lignes={vides(14, 8)}
          hauteur={23.4}
          entete={26}
        />
        <Bandeau>Classez derrière cette feuille la copie des attestations. Une seule personne formée à l’hygiène alimentaire suffit à la règle, mais si elle quitte l’établissement, celui-ci n’est plus en règle : formez-en deux.</Bandeau>
      </Feuille>

      <Feuille icone="balance" surTitre="L’équipe · ce que disent les règles" titre="Qui doit être formé, et à quoi" sousTitre="Trois obligations distinctes : une personne formée à l’hygiène, des consignes pour toute l’équipe, la sécurité au poste." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="diplome" titre="Hygiène alimentaire : une personne formée" marge={0}>
              <Puce>Tout restaurant commercial, vente à emporter comprise, compte dans son effectif au moins une personne formée à l’hygiène alimentaire.</Puce>
              <Puce>La formation dure 14 heures au minimum, auprès d’un organisme enregistré à la DRAAF.</Puce>
              <Puce>En sont dispensés : celui qui justifie de trois ans d’activité comme gestionnaire ou exploitant dans le secteur alimentaire, et le titulaire d’un diplôme de la cuisine ou de la restauration.</Puce>
              <Puce>L’attestation n’a pas de date de fin de validité.</Puce>
              <Source>Décret n° 2011-731 du 24 juin 2011.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="equipe" titre="Toute l’équipe : des consignes au poste">
              <Puce>Toute personne qui manipule des aliments est encadrée et reçoit des instructions ou une formation en hygiène adaptées à son poste.</Puce>
              <Puce>Vous pouvez l’organiser vous-même : lavage des mains, températures, nettoyage, allergènes.</Puce>
              <Puce>Notez la date et le nom de celui qui a transmis les consignes : c’est votre preuve.</Puce>
              <Source>Règlement (CE) n° 852/2004, annexe II, chapitre XII.</Source>
            </Carte>
            <Carte icone="bouclier" titre="Sécurité : dès l’embauche" marge={0}>
              <Puce>Chaque salarié embauché reçoit une formation pratique à la sécurité de son poste : brûlures, coupures, glissades, produits de nettoyage.</Puce>
              <Source>Code du travail, article L4141-2.</Source>
            </Carte>
          </View>
          <View style={{ flex: 0.9 }}>
            <Carte icone="toque" titre="Former sur place" fond={TEINTE} marge={8}>
              <Paragraphe>Lab Learning forme vos équipes dans votre établissement, sur votre matériel : hygiène alimentaire, allergènes, prévention des risques.</Paragraphe>
              <Text style={{ fontSize: 8.6, fontWeight: 700, color: PIN, marginTop: 6 }}>lab-learning.fr · 04 51 330 330</Text>
            </Carte>
            <CarteGuide serre titre="Le guide complet" texte="Qui doit suivre la formation hygiène, et qui en est dispensé." chemin="/guides/formation-hygiene-alimentaire-restauration-rapide" />
          </View>
        </View>
        <TitreSection icone="calendrier" titre="Formations à prévoir" note="Ce que vous planifiez cette année : nouvel arrivant, second référent hygiène, mise à jour." />
        <Tableau
          colonnes={[
            { titre: 'Pour qui', flex: 1.2, gras: true },
            { titre: 'Formation', flex: 1.5 },
            { titre: 'Quand', largeur: 80 },
            { titre: 'Organisme', flex: 1 },
            { titre: 'Financement demandé', largeur: 110, centre: true, choix: ['Oui', 'Non'] },
            { titre: 'Faite', largeur: 44, centre: true, coche: true },
          ]}
          lignes={vides(5, 6)}
          hauteur={20.5}
          entete={19}
        />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Lavage des mains

const GESTES_MAINS: { icone: NomIcone; titre: string; texte: string }[] = [
  { icone: 'goutte', titre: 'Je mouille', texte: 'mes mains et mes poignets.' },
  { icone: 'savon', titre: 'Je savonne', texte: 'avec le savon du distributeur.' },
  { icone: 'main', titre: 'Je frotte', texte: 'paumes, dos des mains, entre les doigts, ongles, pouces, poignets.' },
  { icone: 'gouttes', titre: 'Je rince', texte: 'abondamment, à l’eau claire.' },
  { icone: 'papier', titre: 'Je sèche', texte: 'avec un papier à usage unique.' },
  { icone: 'evier', titre: 'Je ferme', texte: 'le robinet avec le papier, puis je le jette.' },
]
const MOMENTS_MAINS: [NomIcone, string][] = [
  ['horloge', 'En prenant mon poste et à chaque reprise'],
  ['evier', 'Après les toilettes'],
  ['pansement', 'Après m’être mouché, avoir toussé ou touché mon visage'],
  ['poubelle', 'Après les poubelles, les cartons, la viande crue, les œufs'],
  ['coche', 'Avant de toucher un produit prêt à servir'],
]

export function PagesLavageMains({ pied = 'Affichette lavage des mains' }: P) {
  return (
    <FeuilleLibre pied={pied}>
      <View style={{ flex: 1, borderWidth: 1.2, borderColor: PIN, borderRadius: 16, paddingVertical: 22, paddingHorizontal: 30, marginBottom: 6 }}>
        <Text style={{ fontSize: 8, fontWeight: 700, color: PIN, letterSpacing: 1.6 }}>HYGIÈNE DES MAINS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 34, color: ENCRE }}>Je me lave les mains, </Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 34, color: PIN }}>30 secondes.</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          {GESTES_MAINS.map((g, i) => (
            <View key={g.titre} style={{ flex: 1, backgroundColor: TEINTE, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10, marginRight: i < GESTES_MAINS.length - 1 ? 8 : 0, alignItems: 'center', minHeight: 214 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: PIN, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: '#FFFFFF' }}>{i + 1}</Text>
              </View>
              <View style={{ marginTop: 14 }}><Pastille nom={g.icone} taille={64} fond="#FFFFFF" /></View>
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14.5, color: ENCRE, marginTop: 13, textAlign: 'center' }}>{g.titre}</Text>
              <Text style={{ fontSize: 10, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 5, textAlign: 'center' }}>{g.texte}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14, color: PIN, marginBottom: 8 }}>{ins('Quand ?')}</Text>
          <View style={{ flexDirection: 'row' }}>
            {MOMENTS_MAINS.map(([icone, texte], i) => (
              <View key={texte} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 0.8, borderColor: BORD, borderRadius: 10, padding: 8, marginRight: i < MOMENTS_MAINS.length - 1 ? 7 : 0 }}>
                <Pastille nom={icone} taille={24} />
                <Text style={{ flex: 1, fontSize: 8.8, fontWeight: 700, lineHeight: 1.3, color: ENCRE, marginLeft: 7 }}>{texte}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </FeuilleLibre>
  )
}

// ─────────────────────────────────────────────────────────── Nuisibles

const NUISIBLES: [string, string, string][] = [
  ['Rongeurs : souris, rats', 'Portes fermées, bas de portes et passages de câbles bouchés. Denrées surélevées, en contenants fermés. Poubelles fermées et sorties chaque jour.', 'Prévenir le responsable et appeler le prestataire. Jeter les denrées touchées. Nettoyer et désinfecter la zone.'],
  ['Insectes rampants : blattes, fourmis', 'Nettoyage sous et derrière les appareils. Cartons retirés dès la livraison. Siphons, plinthes et fissures entretenus.', 'Prévenir le responsable. Faire traiter par un professionnel. Nettoyer et désinfecter les surfaces.'],
  ['Insectes volants : mouches, moucherons, guêpes', 'Moustiquaires aux ouvertures. Appareil anti-insectes placé loin des plans de travail. Fruits, sucres et déchets à l’abri.', 'Chercher la source : déchets, siphon, fruits. Nettoyer, vider l’appareil anti-insectes.'],
  ['Oiseaux', 'Portes et fenêtres fermées ou protégées. Terrasse et local à déchets tenus propres.', 'Faire sortir l’animal. Nettoyer et désinfecter les surfaces souillées.'],
]

export function PagesNuisibles({ pied = 'Plan de lutte contre les nuisibles' }: P) {
  return (
    <>
      <Feuille icone="insecte" surTitre="Locaux · à compléter" titre="Plan de lutte contre les nuisibles" sousTitre="Ce qui empêche les nuisibles d’entrer, comment vous surveillez, et quoi faire s’il y en a." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 1.5 }, { libelle: 'Prestataire et téléphone', flex: 1.6 }, { libelle: 'Fréquence des passages' }, { libelle: 'Mis à jour le', flex: 0.8 }]} />
        <Tableau
          colonnes={[
            { titre: 'Nuisible', largeur: 104, gras: true },
            { titre: 'Mesures préventives (exemples à adapter)', flex: 1.5 },
            { titre: 'Pièges et appâts : emplacements', flex: 1 },
            { titre: 'Surveillance : qui, quand', flex: 0.8 },
            { titre: 'En cas de présence', flex: 1.3 },
          ]}
          lignes={[...NUISIBLES.map(([n, p, c]) => [n, p, null, null, c]), ...vides(1, 5)]}
          hauteur={58}
        />
        <View style={{ flexDirection: 'row', marginTop: 9 }}>
          <View style={{ flex: 1, backgroundColor: TEINTE, borderRadius: 9, padding: 9, marginRight: 8 }}>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 8.8, color: PIN, marginBottom: 2 }}>À joindre à ce plan</Text>
            <Text style={{ fontSize: 7.8, lineHeight: 1.4, color: GRIS_FONCE }}>Le plan du local avec l’emplacement numéroté des pièges, le contrat du prestataire et ses rapports de passage, les fiches des produits utilisés.</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: TEINTE, borderRadius: 9, padding: 9 }}>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 8.8, color: PIN, marginBottom: 2 }}>Les signes à repérer</Text>
            <Text style={{ fontSize: 7.8, lineHeight: 1.4, color: GRIS_FONCE }}>Crottes, emballages rongés, traces grasses le long des murs, insectes vivants ou morts, odeur inhabituelle.</Text>
          </View>
        </View>
        <Source>Règlement (CE) n° 852/2004, annexe II, chapitre IX : des méthodes adéquates doivent être mises au point pour lutter contre les organismes nuisibles.</Source>
      </Feuille>

      <Feuille icone="loupe" surTitre="Locaux · une feuille par an" titre="Suivi des passages et des constats" sousTitre="Chaque passage du prestataire et chaque tour de contrôle interne, avec ce qui a été vu et ce qui a été fait." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Année' }, { libelle: 'Prestataire', flex: 1.4 }]} />
        <Tableau
          colonnes={[
            { titre: 'Date', largeur: 52 },
            { titre: 'Contrôle fait par', flex: 0.9 },
            { titre: 'Zones contrôlées', flex: 1.2 },
            { titre: 'Constat', largeur: 172, centre: true, choix: ['Rien', 'Traces', 'Présence'] },
            { titre: 'Action menée', flex: 1.5 },
            { titre: 'Visa', largeur: 46, centre: true },
          ]}
          lignes={vides(16, 6)}
          hauteur={21.6}
        />
        <Bandeau icone="alerte">Une trace ou une présence se traite tout de suite : appelez le prestataire, écartez les denrées touchées, et notez ce qui a été fait.</Bandeau>
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Refroidissement et remise en température

const colonnesSuivi = (fin: string): Colonne[] => [
  { titre: 'Date', largeur: 48 },
  { titre: 'Produit', flex: 1.4, gras: true },
  { titre: 'Quantité', largeur: 58, centre: true },
  { titre: 'Heure de début', largeur: 54, centre: true },
  { titre: 'Température de début', largeur: 62, centre: true },
  { titre: 'Heure de fin', largeur: 54, centre: true },
  { titre: fin, largeur: 62, centre: true },
  { titre: 'Durée', largeur: 46, centre: true },
  { titre: 'Dans les temps', largeur: 74, centre: true, choix: ['Oui', 'Non'] },
  { titre: 'Si hors délai : ce qui a été fait', flex: 1.2 },
  { titre: 'Visa', largeur: 42, centre: true },
]

export function PagesRefroidissement({ pied = 'Refroidissement et remise en température' }: P) {
  return (
    <>
      <Feuille icone="sablier" surTitre="Températures · à chaque préparation" titre="Refroidissement et remise en température" sousTitre="Une ligne par préparation refroidie pour être servie plus tard, et par préparation réchauffée." pied={pied}>
        <Champs hauteur={23} marge={2} champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        <TitreSection icone="flocon" titre="Refroidissement rapide" note="De +63 °C à +10 °C en moins de 2 heures, puis stockage à +3 °C au plus." haut={7} />
        <Tableau colonnes={colonnesSuivi('Température de fin')} lignes={vides(8, 11)} hauteur={18.6} entete={24} />
        <TitreSection icone="flamme" titre="Remise en température" note="De +10 °C à +63 °C au moins, en moins d’1 heure, juste avant le service." haut={9} />
        <Tableau colonnes={colonnesSuivi('Température de fin')} lignes={vides(8, 11)} hauteur={18.6} entete={24} />
      </Feuille>

      <Feuille icone="thermometre" surTitre="Températures · repères" titre="Refroidir vite, réchauffer vite" sousTitre="Entre +10 °C et +63 °C, les microbes se multiplient : une préparation doit traverser cette zone le plus vite possible." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <Repere valeur="2 heures" sens="Au plus" texte="pour passer de +63 °C à +10 °C à cœur" ton="bleu" icone="sablier" />
          <Repere valeur="+3 °C" sens="Au plus" texte="pour conserver une préparation refroidie" ton="sarcelle" icone="thermometreFroid" />
          <Repere valeur="1 heure" sens="Au plus" texte="pour remonter de +10 °C à la température de service" ton="ambre" icone="sablier" />
          <Repere valeur="+63 °C" sens="Au moins" texte="pour maintenir au chaud jusqu’au service" ton="rouge" icone="flamme" dernier />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="flocon" titre="Refroidir vite" marge={0}>
              <Etape n={1}>Répartissez la préparation en petites quantités, dans des bacs peu profonds.</Etape>
              <Etape n={2}>Utilisez une cellule de refroidissement ou, à défaut, un bain d’eau glacée que vous renouvelez.</Etape>
              <Etape n={3}>Ne mettez jamais un grand volume chaud au réfrigérateur : il réchauffe tout ce qui s’y trouve.</Etape>
              <Etape n={4}>Notez l’heure et la température au début et à la fin.</Etape>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="flamme" titre="Réchauffer vite">
              <Etape n={1}>Réchauffez juste avant le service, en petites quantités.</Etape>
              <Etape n={2}>Contrôlez la température à cœur avec une sonde propre.</Etape>
              <Etape n={3}>Ce qui a été réchauffé et n’a pas été servi dans la journée est jeté.</Etape>
            </Carte>
            <Carte icone="alerte" titre="Hors délai" fond={TEINTE} marge={0}>
              <Paragraphe>Une préparation restée trop longtemps entre +10 °C et +63 °C est jetée. Notez la cause : quantité trop grande, matériel, oubli.</Paragraphe>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="balance" titre="D’où viennent ces valeurs" marge={8}>
              <Paragraphe>L’arrêté du 21 décembre 2009 les impose à la restauration collective (annexe IV). En restauration commerciale, elles servent de référence : appliquez-les dès que vous refroidissez une préparation pour la servir plus tard.</Paragraphe>
              <View style={{ marginTop: 5 }}><Paragraphe>Même annexe : sans étude de durée de vie, une préparation refroidie se consomme au plus tard le troisième jour après sa fabrication.</Paragraphe></View>
            </Carte>
            <CarteGuide serre titre="Comprendre le PMS" texte="À quoi sert le plan de maîtrise sanitaire, et ce qu’il contient." chemin={GUIDE_PMS} />
          </View>
        </View>
        <TitreSection icone="crayon" titre="Chez vous" note="Votre façon de faire, écrite une fois : c’est elle que l’équipe applique." />
        <Champs hauteur={34} marge={0} champs={[{ libelle: 'Préparations que nous refroidissons', flex: 1.5 }, { libelle: 'Matériel utilisé (cellule, bain glacé)', flex: 1.2 }, { libelle: 'Durée de conservation retenue' }, { libelle: 'Qui contrôle' }]} />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Huiles de friture

export function PagesHuiles({ pied = 'Suivi des huiles de friture' }: P) {
  return (
    <>
      <Feuille icone="friteuse" surTitre="Friture · une feuille par mois" titre="Suivi des huiles de friture" sousTitre="Chaque contrôle de l’huile, friteuse par friteuse, et chaque changement de bain." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Huile utilisée', flex: 1.3 }]} />
        <Tableau
          colonnes={[
            { titre: 'Date', largeur: 48 },
            { titre: 'Friteuse', largeur: 56, centre: true },
            { titre: 'Température réglée', largeur: 62, centre: true },
            { titre: 'Aspect de l’huile', largeur: 196, centre: true, choix: ['Claire', 'Foncée', 'Fume ou mousse'] },
            { titre: 'Composés polaires (%)', largeur: 66, centre: true },
            { titre: 'Décision', largeur: 176, centre: true, choix: ['Garder', 'Filtrer', 'Changer'] },
            { titre: 'Remarque', flex: 1 },
            { titre: 'Visa', largeur: 44, centre: true },
          ]}
          lignes={vides(16, 8)}
          hauteur={21}
          entete={24}
        />
        <Bandeau icone="alerte">Au-delà de 25 % de composés polaires, l’huile est changée. Notez chaque changement de bain : c’est la preuve que vous surveillez vos huiles.</Bandeau>
      </Feuille>

      <Feuille icone="goutte" surTitre="Friture · repères" titre="Une huile saine, plus longtemps" sousTitre="Quand changer l’huile, comment la mesurer, et les gestes qui la font durer." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <Repere valeur="25 %" sens="Au plus" texte="de composés polaires : au-delà, l’huile est impropre à la consommation" ton="rouge" icone="alerte" hauteur={104} />
          <Repere valeur="180 °C" sens="Au plus" texte="pour la température de la friteuse" ton="ambre" icone="flamme" hauteur={104} />
          <View style={{ flex: 2.1 }}>
            <Carte icone="oeil" titre="Les signes d’une huile à changer" marge={0}>
              <Puce>Elle fume à la température de cuisson, ou elle mousse quand vous plongez les frites.</Puce>
              <Puce>Elle a foncé, s’est épaissie, ou dégage une odeur âcre.</Puce>
              <Puce>Le testeur indique plus de 25 % de composés polaires.</Puce>
            </Carte>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View style={{ flex: 1.15, marginRight: 10 }}>
            <Carte icone="coche" titre="Faire durer une huile" marge={0}>
              <Puce>Ne dépassez pas 180 °C, et baissez la friteuse entre deux services.</Puce>
              <Puce>Égouttez les aliments : l’eau dégrade l’huile.</Puce>
              <Puce>Salez et assaisonnez loin du bain, jamais au-dessus.</Puce>
              <Puce>Évitez de frire des aliments différents dans le même bain.</Puce>
              <Puce>Choisissez une huile stable à la chaleur, filtrez-la et complétez le niveau.</Puce>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="thermometre" titre="Mesurer">
              <Puce>Le testeur électronique donne le taux de composés polaires en quelques secondes, dans l’huile chaude.</Puce>
              <Puce>Notez la valeur sur la feuille de suivi, même quand elle est bonne.</Puce>
            </Carte>
            <Carte icone="ble" titre="Pensez aux allergènes" fond={TEINTE} marge={0}>
              <Paragraphe>Un produit pané laisse du gluten dans le bain : tout ce qui y est frit ensuite en contient.</Paragraphe>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="recyclage" titre="L’huile usagée" marge={8}>
              <Puce>C’est un déchet : ni à la poubelle, ni à l’évier.</Puce>
              <Puce>Stockez-la dans un fût fermé et faites-la enlever par un collecteur.</Puce>
              <Puce>Gardez les bons d’enlèvement.</Puce>
            </Carte>
            <CarteGuide serre titre="Comprendre le PMS" texte="À quoi sert le plan de maîtrise sanitaire, et ce qu’il contient." chemin={GUIDE_PMS} />
          </View>
        </View>
        <Source>Décret n° 2008-184 du 26 février 2008, article 8 : les huiles dont la teneur en composés polaires dépasse 25 % sont réputées impropres à la consommation humaine. Conseils d’usage : fiche « Les huiles de friture » des services de l’État.</Source>
        <TitreSection icone="crayon" titre="Chez vous" note="Votre façon de faire, écrite une fois : c’est elle que l’équipe applique." />
        <Champs hauteur={34} marge={0} champs={[{ libelle: 'Nous testons l’huile (fréquence)' }, { libelle: 'Nous la filtrons (fréquence)' }, { libelle: 'Nous changeons le bain quand', flex: 1.3 }, { libelle: 'Collecteur des huiles usagées', flex: 1.2 }]} />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Traçabilité et étiquetage

export function PagesTracabilite({ pied = 'Traçabilité et étiquetage' }: P) {
  return (
    <>
      <Feuille icone="etiquette" surTitre="Traçabilité · une feuille par mois" titre="Fiche de traçabilité" sousTitre="Les produits sensibles que vous recevez et que vous entamez : d’où ils viennent, leur lot, leurs dates." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={[
            { titre: 'Reçu le', largeur: 50 },
            { titre: 'Produit', flex: 1.3, gras: true },
            { titre: 'Fournisseur', flex: 1 },
            { titre: 'Numéro de lot', flex: 0.8 },
            { titre: 'DLC ou DDM', largeur: 62, centre: true },
            { titre: 'Ouvert ou préparé le', largeur: 70, centre: true },
            { titre: 'À utiliser jusqu’au', largeur: 70, centre: true },
            { titre: 'Étiquette gardée', largeur: 60, centre: true, coche: true },
            { titre: 'Visa', largeur: 42, centre: true },
          ]}
          lignes={vides(16, 9)}
          hauteur={21}
          entete={24}
        />
        <Bandeau>Vous pouvez remplacer cette feuille par les étiquettes elles-mêmes, classées par jour, ou par leur photo : l’essentiel est de retrouver le fournisseur, le lot et la date d’un produit.</Bandeau>
      </Feuille>

      <Feuille icone="loupe" surTitre="Traçabilité · repères" titre="Savoir d’où vient chaque produit" sousTitre="Ce qu’il faut garder, comment étiqueter ce qui est entamé, et la différence entre les deux dates." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="camion" titre="Garder la trace de ce qui entre">
              <Puce>Conservez les bons de livraison : ils disent qui vous a livré quoi, et quand.</Puce>
              <Puce>Gardez l’étiquette, ou sa photo, tant que le produit est en stock et quelques jours après.</Puce>
              <Puce>Le code-barres ne suffit pas : il ne contient ni le numéro de lot ni la date.</Puce>
            </Carte>
            <Carte icone="balance" titre="Ce que dit le texte" fond={TEINTE} marge={0}>
              <Paragraphe>Vous devez pouvoir dire qui vous a fourni chaque denrée et, si vous livrez d’autres professionnels, à qui vous l’avez fournie.</Paragraphe>
              <Source>Règlement (CE) n° 178/2002, article 18.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="etiquette" titre="Étiqueter ce qui est entamé">
              <Puce>Tout produit sorti de son emballage et toute préparation maison porte une étiquette : nom, date d’ouverture ou de fabrication, date limite d’utilisation.</Puce>
              <Puce>Après ouverture, suivez la durée indiquée par le fabricant.</Puce>
              <Puce>Pour vos préparations, fixez une durée et tenez-vous-y. En restauration collective, la règle est de trois jours après la fabrication, faute d’étude : c’est un bon repère.</Puce>
              <Puce>Un contenant sans étiquette ne se devine pas : il est jeté.</Puce>
            </Carte>
            <Carte icone="flocon" titre="Décongélation" fond={TEINTE} marge={0}>
              <Paragraphe>Au réfrigérateur, jamais à température ambiante. Un produit décongelé n’est pas recongelé.</Paragraphe>
            </Carte>
          </View>
          <View style={{ flex: 0.95 }}>
            <View style={{ backgroundColor: '#FCE8DE', borderRadius: 11, padding: 11, marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, color: '#B4441B' }}>DLC</Text>
              <Text style={{ fontSize: 8.6, fontWeight: 700, color: ENCRE, marginTop: 1 }}>Date limite de consommation</Text>
              <Text style={{ fontSize: 8.2, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 3 }}>{ins('« À consommer jusqu’au ». Impérative : passé cette date, le produit est retiré.')}</Text>
            </View>
            <View style={{ backgroundColor: '#FBF2D2', borderRadius: 11, padding: 11, marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, color: '#8A6A00' }}>DDM</Text>
              <Text style={{ fontSize: 8.6, fontWeight: 700, color: ENCRE, marginTop: 1 }}>Date de durabilité minimale</Text>
              <Text style={{ fontSize: 8.2, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 3 }}>{ins('« À consommer de préférence avant ». Le produit peut perdre en qualité, sans présenter de risque.')}</Text>
            </View>
            <CarteGuide serre titre="Comprendre le PMS" texte="À quoi sert le plan de maîtrise sanitaire, et ce qu’il contient." chemin={GUIDE_PMS} />
          </View>
        </View>
        <TitreSection icone="crayon" titre="Chez vous" note="Votre façon de faire, écrite une fois : c’est elle que l’équipe applique." />
        <Champs hauteur={34} marge={0} champs={[{ libelle: 'Où sont classés les bons de livraison', flex: 1.2 }, { libelle: 'Étiquettes : classeur ou photo' }, { libelle: 'Durée de vie de nos préparations maison', flex: 1.2 }, { libelle: 'Qui contrôle les dates, et quand' }]} />
      </Feuille>

      {/* Planche d'étiquettes à découper */}
      <Feuille icone="etiquette" surTitre="Traçabilité · à imprimer et à découper" titre="Étiquettes des produits entamés" sousTitre="Une étiquette sur chaque bac, chaque flacon de sauce, chaque produit sorti de son emballage." pied={pied}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 15 }, (_, i) => (
            <View key={i} style={{ width: '20%', padding: 3 }}>
              <View style={{ borderWidth: 0.9, borderColor: '#9AA6B2', borderStyle: 'dashed', borderRadius: 7, paddingVertical: 8, paddingHorizontal: 9, height: 136 }}>
                <ChampLigne libelle="Produit" hauteur={15} marge={8} />
                <ChampLigne libelle="Ouvert ou préparé le" hauteur={15} marge={8} />
                <ChampLigne libelle="À utiliser jusqu’au" hauteur={15} marge={8} />
                <ChampLigne libelle="Par" hauteur={13} marge={0} />
              </View>
            </View>
          ))}
        </View>
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Non-conformités et alertes

export function PagesNonConformites({ pied = 'Non-conformités et alertes' }: P) {
  return (
    <>
      <Feuille icone="megaphone" surTitre="Alertes · à connaître avant d’en avoir besoin" titre="En cas de problème : qui fait quoi" sousTitre="Un rappel de produit, une anomalie en cuisine, des clients malades : trois situations, trois marches à suivre." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="megaphone" titre="Un fournisseur rappelle un produit" marge={0}>
              <Etape n={1}>Retrouvez le produit et son lot dans toutes vos réserves, isolez-le et marquez-le « Ne pas utiliser ».</Etape>
              <Etape n={2}>Vérifiez s’il a déjà été utilisé ou servi.</Etape>
              <Etape n={3}>Suivez la consigne du fournisseur : retour ou destruction.</Etape>
              <Etape n={4}>Notez ce qui a été fait sur la fiche de non-conformité.</Etape>
              <Source>Les rappels de produits sont publiés sur rappel.conso.gouv.fr.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="alerte" titre="Vous constatez une anomalie" marge={0}>
              <View style={{ marginBottom: 6 }}><Paragraphe>Panne de froid, date dépassée, corps étranger, erreur d’allergène.</Paragraphe></View>
              <Etape n={1}>Écartez le produit : dans le doute, il est jeté.</Etape>
              <Etape n={2}>Cherchez la cause : matériel, livraison, geste.</Etape>
              <Etape n={3}>Corrigez, puis vérifiez que cela ne se reproduit pas.</Etape>
              <Etape n={4}>Notez-le : une anomalie traitée et notée montre que votre plan fonctionne.</Etape>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="secours" titre="Des clients se disent malades" marge={0}>
              <View style={{ marginBottom: 6 }}><Paragraphe>Deux personnes malades ou plus après un même repas : c’est une toxi-infection alimentaire collective.</Paragraphe></View>
              <Etape n={1}>Notez qui, quand, et ce qui a été consommé.</Etape>
              <Etape n={2}>Mettez de côté, au froid, les produits et les étiquettes concernés.</Etape>
              <Etape n={3}>Prévenez sans attendre la DDPP de votre département.</Etape>
              <Etape n={4}>Tenez vos relevés et votre traçabilité à sa disposition.</Etape>
            </Carte>
          </View>
        </View>
        <TitreSection icone="loupe" titre="Ce qu’on vous demandera" note="Quatre questions auxquelles votre traçabilité doit répondre en quelques minutes." />
        <View style={{ flexDirection: 'row' }}>
          {([['etiquette', 'Quel produit, quel lot ?'], ['camion', 'Reçu quand, de quel fournisseur ?'], ['calendrier', 'Servi quel jour, à quel service ?'], ['boite', 'Qu’en reste-t-il, et où ?']] as [NomIcone, string][]).map(([icone, texte], i) => (
            <View key={texte} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 9, padding: 9, marginRight: i < 3 ? 7 : 0 }}>
              <Pastille nom={icone} taille={22} fond="#FFFFFF" />
              <Text style={{ flex: 1, fontSize: 8.8, fontWeight: 700, color: ENCRE, marginLeft: 8 }}>{ins(texte)}</Text>
            </View>
          ))}
        </View>
        <TitreSection icone="telephone" titre="Vos numéros utiles" note="À remplir aujourd’hui : le jour où il faut appeler, personne ne cherche." />
        <Champs hauteur={34} marge={5} champs={[{ libelle: 'DDPP du département (téléphone, e-mail)', flex: 1.3 }, { libelle: 'Fournisseur principal' }, { libelle: 'Frigoriste' }, { libelle: 'Prestataire nuisibles' }]} />
        <Source>Règlement (CE) n° 178/2002, articles 18 et 19 : l’exploitant retire les denrées qui présentent un risque et en informe les autorités.</Source>
      </Feuille>

      <Feuille icone="fichier" surTitre="Alertes · à remplir à chaque anomalie" titre="Fiche de non-conformité" sousTitre="Ce qui a été constaté, ce qui a été fait tout de suite, et ce qui change pour que cela ne se reproduise pas." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={[
            { titre: 'Date', largeur: 50 },
            { titre: 'Ce qui a été constaté', flex: 1.5 },
            { titre: 'Produit et lot concernés', flex: 1 },
            { titre: 'Cause', flex: 1 },
            { titre: 'Action immédiate', flex: 1.2 },
            { titre: 'Pour que cela ne se reproduise pas', flex: 1.2 },
            { titre: 'Par', largeur: 56 },
            { titre: 'Clos le', largeur: 52, centre: true },
          ]}
          lignes={vides(10, 8)}
          hauteur={37}
          entete={24}
        />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Pages propres au classeur

/** Les parties du classeur, dans l'ordre, avec leur nombre de pages : le sommaire en déduit les numéros. */
const PARTIES: { titre: string; detail: string; pages: number }[] = [
  { titre: 'Votre établissement', detail: 'Engagement du responsable, informations, mode d’emploi du classeur', pages: 2 },
  { titre: 'Le PMS en bref', detail: 'Les trois piliers et ce que disent les textes', pages: 1 },
  { titre: 'L’équipe', detail: 'Tenue, lavage des mains, état de santé, suivi des formations', pages: 4 },
  { titre: 'Locaux et matériel', detail: 'Entretien des équipements, eau, déchets', pages: 1 },
  { titre: 'Nettoyage et désinfection', detail: 'Plan, enregistrement de la semaine, méthode', pages: 3 },
  { titre: 'Lutte contre les nuisibles', detail: 'Plan et suivi des passages', pages: 2 },
  { titre: 'Températures', detail: 'Relevé du mois, repères, contrôle à réception', pages: 3 },
  { titre: 'Refroidissement et remise en température', detail: 'Fiche de suivi et repères', pages: 2 },
  { titre: 'Huiles de friture', detail: 'Fiche de suivi et repères', pages: 2 },
  { titre: 'Traçabilité et étiquetage', detail: 'Fiche du mois, repères, étiquettes à découper', pages: 3 },
  { titre: 'Allergènes', detail: 'Tableau, mode d’emploi, affichette pour la salle', pages: 3 },
  { titre: 'Non-conformités et alertes', detail: 'Marches à suivre et fiche de non-conformité', pages: 2 },
  { titre: 'Méthode HACCP', detail: 'Les sept principes et l’analyse des dangers par étape', pages: 2 },
  { titre: 'Revue annuelle', detail: 'Les points à vérifier une fois par an', pages: 1 },
]
/** Nombre de pages du classeur : couverture, sommaire inclus dans la première partie. */
export const PAGES_PMS = 1 + PARTIES.reduce((s, p) => s + p.pages, 0)

const PIED_PMS = 'Plan de maîtrise sanitaire'

function PageCouverture() {
  const piliers: [NomIcone, string, string][] = [
    ['equipe', 'Les bonnes pratiques d’hygiène', 'L’équipe, les locaux, le nettoyage, les températures.'],
    ['cible', 'La méthode HACCP', 'Vos dangers, étape par étape, et comment vous les maîtrisez.'],
    ['etiquette', 'La traçabilité et les alertes', 'D’où vient chaque produit, quoi faire en cas de problème.'],
  ]
  return (
    <FeuilleLibre pied={PIED_PMS}>
      <View style={{ flex: 1, flexDirection: 'row', marginBottom: 6 }}>
        <View style={{ flex: 1.25, paddingRight: 26, paddingTop: 8 }}>
          <LogoLabLearning hauteur={38} />
          <Text style={{ fontSize: 8, fontWeight: 700, color: PIN, letterSpacing: 1.6, marginTop: 44 }}>RESTAURATION RAPIDE · TRAME À COMPLÉTER</Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 44, color: ENCRE, marginTop: 8 }}>Plan de maîtrise</Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 44, color: PIN }}>sanitaire</Text>
          <Text style={{ fontSize: 12.5, lineHeight: 1.5, color: GRIS_FONCE, marginTop: 14, maxWidth: 380 }}>
            Le classeur d’hygiène de votre établissement : vos règles, votre méthode, et toutes les feuilles de relevé, prêtes à imprimer.
          </Text>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Champs hauteur={38} marge={7} champs={[{ libelle: 'Établissement' }]} />
            <Champs hauteur={32} marge={0} champs={[{ libelle: 'Référent hygiène', flex: 1.4 }, { libelle: 'Mis à jour le' }]} />
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: TEINTE, borderRadius: 18, padding: 22, justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 12, color: PIN, marginBottom: 14 }}>Dans ce classeur</Text>
          {piliers.map(([icone, titre, texte], i) => (
            <View key={titre} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 13, marginBottom: i < piliers.length - 1 ? 9 : 0 }}>
              <Pastille nom={icone} taille={40} fond={PIN} couleur="#FFFFFF" rond={false} />
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11.5, color: ENCRE }}>{titre}</Text>
                <Text style={{ fontSize: 8.8, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 2 }}>{texte}</Text>
              </View>
            </View>
          ))}
          <Text style={{ fontSize: 8.4, lineHeight: 1.45, color: GRIS, marginTop: 14 }}>{PAGES_PMS} pages, dont les feuilles de relevé à imprimer autant de fois que nécessaire.</Text>
        </View>
      </View>
    </FeuilleLibre>
  )
}

function PageEtablissement() {
  return (
    <Feuille icone="magasin" surTitre="Plan de maîtrise sanitaire · à compléter en premier" titre="Votre établissement" sousTitre="Qui s’engage, et pour quel établissement : la première page que lit un inspecteur." pied={PIED_PMS}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Carte icone="signature" titre="Engagement du responsable" marge={0}>
            <ChampLigne libelle="Je soussigné(e)" hauteur={16} />
            <ChampLigne libelle="En qualité de" hauteur={16} />
            <View style={{ marginTop: 2, marginBottom: 10 }}>
              <Paragraphe>m’engage à appliquer ce plan de maîtrise sanitaire dans l’établissement, à le faire connaître à toute l’équipe et à le tenir à jour à chaque changement de carte, de matériel, de fournisseur ou d’organisation.</Paragraphe>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="Fait à" hauteur={16} /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Le" hauteur={16} /></View>
            </View>
            <Text style={{ fontSize: 5.6, fontWeight: 700, color: GRIS, letterSpacing: 0.7 }}>SIGNATURE</Text>
            <View style={{ height: 70, borderWidth: 0.8, borderColor: BORD, borderRadius: 7, marginTop: 4 }} />
          </Carte>
        </View>
        <View style={{ flex: 1.25 }}>
          <Carte icone="magasin" titre="L’établissement" marge={8}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="Raison sociale" /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Enseigne" /></View>
            </View>
            <ChampLigne libelle="Adresse" />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="SIRET" /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Téléphone" /></View>
            </View>
            <ChampLigne libelle="Activité (sur place, à emporter, livraison)" />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="Repas servis par jour" /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Effectif" /></View>
            </View>
            <ChampLigne libelle="Référent hygiène (nom et fonction)" />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1.3, marginRight: 10 }}><ChampLigne libelle="Personne formée à l’hygiène alimentaire" marge={0} /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Déclaration à la DDPP faite le" marge={0} /></View>
            </View>
          </Carte>
          <Bandeau haut={0}>Rangez derrière cette page la copie de votre déclaration à la DDPP et les attestations de formation.</Bandeau>
        </View>
      </View>
      <TitreSection icone="epingle" titre="Le plan de la cuisine" note="À dessiner ou à coller : zones froides, cuisson, plonge, réserve, déchets, et le trajet des produits de la livraison au client." />
      <View style={{ flex: 1, borderWidth: 0.8, borderColor: BORD, borderRadius: 9, borderStyle: 'dashed', marginBottom: 4 }} />
    </Feuille>
  )
}

function PageSommaire() {
  let page = 2
  const lignes = PARTIES.map((p, i) => { const debut = page; page += p.pages; return { ...p, n: i + 1, debut } })
  const moitie = Math.ceil(lignes.length / 2)
  return (
    <Feuille icone="liste" surTitre="Plan de maîtrise sanitaire · mode d’emploi" titre="Sommaire" sousTitre="Quatorze parties. Chacune commence par ce qu’il faut savoir, puis donne la feuille à remplir." pied={PIED_PMS}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1.7, flexDirection: 'row', marginRight: 12 }}>
          {[lignes.slice(0, moitie), lignes.slice(moitie)].map((groupe, g) => (
            <View key={g} style={{ flex: 1, marginLeft: g ? 10 : 0 }}>
              {groupe.map((l) => (
                <View key={l.n} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 0.8, borderColor: BORD, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9, marginBottom: 6, minHeight: 48 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: MENTHE_CLAIRE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10, color: PIN }}>{l.n}</Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 9 }}>
                    <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 9.4, color: ENCRE }}>{l.titre}</Text>
                    <Text style={{ fontSize: 7.4, lineHeight: 1.35, color: GRIS, marginTop: 1 }}>{l.detail}</Text>
                  </View>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: PIN }}>p. {l.debut}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="crayon" titre="Comment utiliser ce classeur">
            <Etape n={1}>Complétez les pages de présentation et les plans avec ce qui se fait réellement chez vous.</Etape>
            <Etape n={2}>Imprimez les feuilles de relevé autant de fois que nécessaire : une par mois ou par semaine.</Etape>
            <Etape n={3}>Rangez les feuilles remplies derrière chaque partie, et gardez au moins les douze derniers mois.</Etape>
            <Etape n={4}>Relisez le classeur une fois par an, et à chaque changement de carte, de matériel ou d’équipe.</Etape>
          </Carte>
          <Carte icone="alerte" titre="À savoir" fond={TEINTE} marge={8}>
            <Paragraphe>Cette trame est un point de départ. Un plan de maîtrise sanitaire n’a de valeur que s’il décrit votre établissement : retirez ce qui ne vous concerne pas, ajoutez ce qui manque. Elle ne remplace pas la formation à l’hygiène alimentaire.</Paragraphe>
          </Carte>
          <CarteGuide serre titre="Comprendre le PMS" texte="À quoi il sert, ce qu’il contient, ce qu’en attend un contrôle." chemin={GUIDE_PMS} />
        </View>
      </View>
    </Feuille>
  )
}

function PageEnBref() {
  const piliers: { icone: NomIcone; titre: string; accroche: string; points: string[] }[] = [
    { icone: 'equipe', titre: 'Les bonnes pratiques d’hygiène', accroche: 'Les règles de base, à respecter tous les jours.', points: ['Une équipe formée, propre et en tenue', 'Des locaux et du matériel entretenus', 'Le nettoyage et la désinfection', 'La lutte contre les nuisibles', 'Les températures maîtrisées', 'Le contrôle à réception, l’eau, les déchets'] },
    { icone: 'cible', titre: 'La méthode HACCP', accroche: 'L’analyse de vos propres dangers, étape par étape.', points: ['Lister les dangers', 'Repérer les points où un contrôle est indispensable', 'Fixer une limite à ne pas dépasser', 'Surveiller, et corriger en cas d’écart', 'Vérifier que cela fonctionne', 'Garder la trace'] },
    { icone: 'etiquette', titre: 'La traçabilité et les alertes', accroche: 'Savoir d’où vient un produit, et quoi faire s’il pose problème.', points: ['Bons de livraison et étiquettes conservés', 'Produits entamés étiquetés', 'Produit signalé : retiré tout de suite', 'Anomalies notées et corrigées', 'Autorités prévenues en cas de risque'] },
  ]
  return (
    <Feuille icone="classeur" surTitre="Plan de maîtrise sanitaire · l’essentiel" titre="Le PMS en bref" sousTitre="Tout ce que vous faites pour servir des aliments sûrs, et les preuves que vous le faites : trois piliers." pied={PIED_PMS}>
      <View style={{ flexDirection: 'row' }}>
        {piliers.map((p, i) => (
          <View key={p.titre} style={{ flex: 1, borderWidth: 0.8, borderColor: BORD, borderRadius: 11, padding: 12, marginRight: i < piliers.length - 1 ? 9 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pastille nom={p.icone} taille={34} fond={PIN} couleur="#FFFFFF" rond={false} />
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 24, color: '#C9D8D1' }}>{i + 1}</Text>
            </View>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 12, color: PIN, marginTop: 9 }}>{p.titre}</Text>
            <Text style={{ fontSize: 8.6, lineHeight: 1.4, color: GRIS, marginTop: 2, marginBottom: 7 }}>{p.accroche}</Text>
            {p.points.map((x) => <Puce key={x}>{x}</Puce>)}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <View style={{ flex: 1.5, marginRight: 9 }}>
          <Carte icone="balance" titre="Ce que disent les textes" marge={0}>
            <Puce>Tout exploitant applique les règles générales d’hygiène et met en place des procédures fondées sur les principes HACCP, adaptées à la taille de son établissement.</Puce>
            <Puce>Il assure la traçabilité de ses denrées et retire celles qui présentent un risque.</Puce>
            <Puce>En France, l’ensemble de ces mesures et de leurs preuves forme le plan de maîtrise sanitaire.</Puce>
            <Source>Règlement (CE) n° 852/2004, articles 4 et 5. Règlement (CE) n° 178/2002, articles 18 et 19.</Source>
          </Carte>
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="oeil" titre="Les preuves comptent" fond={TEINTE} marge={0}>
            <Paragraphe>Lors d’un contrôle, l’inspecteur regarde ce qui se fait en cuisine, puis demande les enregistrements. Un relevé rempli chaque jour pèse plus qu’un classeur parfait jamais ouvert.</Paragraphe>
          </Carte>
        </View>
      </View>
      <TitreSection icone="equipe" titre="Qui fait quoi" note="Un nom par tâche : sans responsable désigné, un relevé finit par ne plus être fait." />
      <Champs hauteur={34} marge={0} champs={[{ libelle: 'Tient le classeur à jour' }, { libelle: 'Relève les températures' }, { libelle: 'Contrôle les livraisons' }, { libelle: 'Vérifie le nettoyage' }, { libelle: 'Forme les nouveaux' }]} />
    </Feuille>
  )
}

const PREMIER_JOUR: [NomIcone, string][] = [
  ['savon', 'Où et comment se laver les mains'],
  ['tshirt', 'La tenue et le vestiaire'],
  ['thermometre', 'Les températures à respecter, et où les noter'],
  ['seau', 'Le nettoyage de son poste'],
  ['ble', 'Où est le tableau des allergènes, et quoi répondre à un client'],
  ['pansement', 'Quoi faire en cas de blessure ou de maladie'],
  ['spray', 'Où sont les produits et leurs fiches de sécurité'],
  ['megaphone', 'Qui prévenir en cas d’anomalie'],
]

function PageEquipe() {
  return (
    <Feuille icone="equipe" surTitre="L’équipe · vos règles" titre="Hygiène, tenue et santé de l’équipe" sousTitre="Les règles que chaque équipier connaît le premier jour. Complétez la tenue, gardez le reste ou adaptez-le." pied={PIED_PMS}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Carte icone="tshirt" titre="La tenue de travail" marge={0}>
            <ChampLigne libelle="Ce qui compose la tenue" />
            <ChampLigne libelle="Où elle se range" />
            <ChampLigne libelle="Qui la lave, à quelle fréquence" marge={9} />
            <Puce>Une tenue propre, réservée au travail, changée aussi souvent que nécessaire.</Puce>
            <Puce>Les cheveux couverts : casquette, charlotte ou filet.</Puce>
            <Puce>Ni bague, ni bracelet, ni montre aux mains et aux poignets.</Puce>
            <Puce>Des ongles courts, propres et sans vernis.</Puce>
            <Puce>Les vêtements de ville et les effets personnels restent au vestiaire.</Puce>
          </Carte>
        </View>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Carte icone="savon" titre="Le lavage des mains" marge={0}>
            <Text style={{ fontSize: 8.6, fontWeight: 700, color: ENCRE, marginBottom: 4 }}>{ins('Quand ?')}</Text>
            <Puce>À la prise de poste et à chaque reprise.</Puce>
            <Puce>Après les toilettes.</Puce>
            <Puce>Après s’être mouché, avoir toussé ou touché son visage.</Puce>
            <Puce>Après les poubelles, les cartons, la viande crue, les œufs.</Puce>
            <Puce>Avant de toucher un produit prêt à servir.</Puce>
            <Text style={{ fontSize: 8.6, fontWeight: 700, color: ENCRE, marginTop: 5, marginBottom: 4 }}>{ins('Comment ?')}</Text>
            <Puce>Au savon, 30 secondes, jusqu’aux poignets.</Puce>
            <Puce>Séchage au papier à usage unique.</Puce>
            <Puce>Les gants ne remplacent pas le lavage : ils se changent aussi souvent qu’on se laverait les mains.</Puce>
          </Carte>
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="pansement" titre="L’état de santé" marge={8}>
            <Puce>Celui qui a des symptômes digestifs, une plaie infectée ou une infection de la peau le signale au responsable avant de prendre son poste.</Puce>
            <Puce>Il ne manipule pas les aliments tant que le risque existe.</Puce>
            <Puce>Une plaie simple est protégée par un pansement et un gant.</Puce>
            <Source>Règlement (CE) n° 852/2004, annexe II, chapitre VIII.</Source>
          </Carte>
          <Carte icone="croix" titre="En cuisine, jamais" fond={TEINTE} marge={0}>
            <Paragraphe>Fumer, vapoter, manger, mâcher un chewing-gum, poser son téléphone sur un plan de travail.</Paragraphe>
          </Carte>
        </View>
      </View>
      <TitreSection icone="liste" titre="Le premier jour d’un équipier" note="Ce que chaque nouvel arrivant doit avoir vu avant son premier service." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {PREMIER_JOUR.map(([icone, texte]) => (
          <View key={texte} style={{ width: '25%', padding: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 0.8, borderColor: BORD, borderRadius: 9, padding: 8, minHeight: 44 }}>
              <Pastille nom={icone} taille={22} />
              <Text style={{ flex: 1, fontSize: 8.2, lineHeight: 1.35, color: GRIS_FONCE, marginLeft: 8 }}>{ins(texte)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Feuille>
  )
}

const EQUIPEMENTS = ['Chambre froide et réfrigérateurs', 'Congélateur', 'Friteuse', 'Hotte et extraction', 'Lave-vaisselle', 'Thermomètres de contrôle']

function PageLocaux() {
  return (
    <Feuille icone="cle" surTitre="Locaux et matériel · à compléter" titre="Entretien, eau et déchets" sousTitre="Qui entretient quoi, d’où vient votre eau, et comment sortent vos déchets." pied={PIED_PMS}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1.9, marginRight: 10 }}>
          <Tableau
            colonnes={[
              { titre: 'Équipement', flex: 1.3, gras: true },
              { titre: 'Entretien à faire', flex: 1.2 },
              { titre: 'Fréquence', largeur: 62 },
              { titre: 'Fait par', flex: 0.8 },
              { titre: 'Dernier passage', largeur: 58, centre: true },
              { titre: 'Prochain', largeur: 54, centre: true },
            ]}
            lignes={[...EQUIPEMENTS.map((e) => [e, null, null, null, null, null]), ...vides(7, 6)]}
            hauteur={26}
            entete={24}
          />
          <Bandeau>Gardez derrière cette page les notices, les contrats d’entretien et les bons d’intervention : frigoriste, nettoyage de la hotte, vérification des extincteurs.</Bandeau>
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="verre" titre="L’eau">
            <ChampLigne libelle="Origine (réseau public, autre)" />
            <ChampLigne libelle="Adoucisseur, filtre : entretien" />
            <ChampLigne libelle="Machine à glaçons : nettoyage" marge={8} />
            <Puce>Seule de l’eau potable sert à la préparation, au lavage et aux glaçons.</Puce>
          </Carte>
          <Carte icone="poubelle" titre="Les déchets" marge={0}>
            <ChampLigne libelle="Sortie des poubelles : fréquence" />
            <ChampLigne libelle="Collecteur des huiles usagées" />
            <ChampLigne libelle="Biodéchets : mode de collecte" marge={8} />
            <Puce>Les déchets quittent la cuisine dès que possible, dans des poubelles fermées.</Puce>
            <Puce>Le local à déchets est nettoyé et tenu à l’abri des nuisibles.</Puce>
            <Source>Règlement (CE) n° 852/2004, annexe II, chapitres VI et VII.</Source>
          </Carte>
        </View>
      </View>
    </Feuille>
  )
}

const PRINCIPES: { titre: string; texte: string; exemple: string }[] = [
  { titre: 'Lister les dangers', texte: 'Microbes, corps étrangers, produits chimiques, allergènes : ce qui peut rendre un aliment dangereux, à chaque étape.', exemple: 'Les microbes se multiplient dans une viande mal conservée.' },
  { titre: 'Repérer les points critiques', texte: 'Les étapes où un contrôle est indispensable pour écarter le danger.', exemple: 'Le stockage en chambre froide.' },
  { titre: 'Fixer une limite', texte: 'La valeur qui sépare ce qui est acceptable de ce qui ne l’est pas.', exemple: '+4 °C au plus, +2 °C pour la viande hachée.' },
  { titre: 'Surveiller', texte: 'Qui contrôle, comment, à quelle fréquence.', exemple: 'Relevé à l’ouverture et à la fermeture.' },
  { titre: 'Corriger', texte: 'Ce qui se passe quand la limite est dépassée.', exemple: 'Contrôle à cœur, transfert ou retrait des produits.' },
  { titre: 'Vérifier', texte: 'S’assurer, de temps en temps, que le système fonctionne.', exemple: 'Relecture des relevés chaque semaine, contrôle du thermomètre.' },
  { titre: 'Garder la trace', texte: 'Les documents qui prouvent que c’est fait.', exemple: 'La feuille de relevé du mois.' },
]

const ETAPES_HACCP: string[][] = [
  ['Réception', 'Produit trop chaud, emballage abîmé, date dépassée', 'Contrôle à chaque livraison', 'Températures des repères, emballage intact, date valide', 'Fiche de contrôle à réception', 'Produit refusé, refus noté sur le bon'],
  ['Stockage au froid', 'Multiplication des microbes', 'Enceintes réglées, portes fermées, pas de surcharge', '+4 °C au plus, +2 °C pour viandes hachées et poissons, −18 °C pour les surgelés', 'Relevé matin et soir', 'Contrôle à cœur, transfert ou retrait'],
  ['Décongélation', 'Multiplication en surface', 'Décongélation au réfrigérateur', 'Jamais à température ambiante', 'Étiquette datée', 'Produit jeté en cas de doute'],
  ['Préparation', 'Contamination croisée, allergènes', 'Mains lavées, ustensiles séparés cru et cuit, plans nettoyés entre deux tâches', 'Rien ne reste hors du froid plus que le temps de la préparation', 'Plan de nettoyage, tableau des allergènes', 'Produit écarté, poste nettoyé'],
  ['Cuisson', 'Survie des microbes', 'Cuisson à cœur, surtout viandes hachées et volailles', 'Température à cœur fixée par vos fiches recettes', 'Sonde sur un produit par service', 'Cuisson prolongée ou produit jeté'],
  ['Friture', 'Huile dégradée', 'Température limitée, huile filtrée et testée', '180 °C au plus, 25 % de composés polaires au plus', 'Fiche de suivi des huiles', 'Huile changée'],
  ['Maintien au chaud', 'Multiplication des microbes', 'Bain-marie ou armoire chaude réglés', '+63 °C au moins', 'Contrôle à chaque service', 'Produit jeté'],
  ['Refroidissement', 'Multiplication des microbes', 'Petites quantités, cellule ou bain glacé', 'De +63 °C à +10 °C en moins de 2 heures', 'Fiche de refroidissement', 'Produit jeté'],
  ['Service, livraison', 'Rupture de température, erreur d’allergène', 'Commandes préparées à la demande, sacs isothermes propres', 'Chaud à +63 °C au moins, froid à sa température jusqu’au départ', 'Tableau des allergènes à jour', 'Commande refaite'],
]

function PagesHaccp() {
  return (
    <>
      <Feuille icone="cible" surTitre="Méthode HACCP · l’essentiel" titre="La méthode HACCP en sept principes" sousTitre="Une façon de raisonner : où sont les dangers, comment vous les tenez. Un exemple suit chaque principe : la conservation de la viande." pied={PIED_PMS}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {PRINCIPES.map((p, i) => (
            <View key={p.titre} style={{ width: '25%', padding: 3.5 }}>
              <View style={{ borderWidth: 0.8, borderColor: BORD, borderRadius: 11, padding: 12, height: 196 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: PIN, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10.5, color: '#FFFFFF' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11.5, color: PIN, marginLeft: 8 }}>{p.titre}</Text>
                </View>
                <Text style={{ fontSize: 9.2, lineHeight: 1.45, color: GRIS_FONCE, marginTop: 9 }}>{ins(p.texte)}</Text>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <View style={{ backgroundColor: TEINTE, borderRadius: 7, paddingVertical: 5, paddingHorizontal: 7 }}>
                    <Text style={{ fontSize: 5.6, fontWeight: 700, color: GRIS, letterSpacing: 0.7 }}>EXEMPLE</Text>
                    <Text style={{ fontSize: 8.6, lineHeight: 1.38, color: ENCRE, marginTop: 2 }}>{ins(p.exemple)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
          <View style={{ width: '25%', padding: 3.5 }}>
            <View style={{ backgroundColor: TEINTE, borderRadius: 11, padding: 12, height: 196 }}>
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10.5, color: PIN }}>Dans un petit établissement</Text>
              <Text style={{ fontSize: 9.2, lineHeight: 1.45, color: GRIS_FONCE, marginTop: 8 }}>Le règlement demande une analyse adaptée à votre taille. S’appuyer sur un guide de bonnes pratiques d’hygiène de votre métier permet de la simplifier : c’est ce que fait le tableau de la page suivante.</Text>
            </View>
          </View>
        </View>
        <Source>Règlement (CE) n° 852/2004, article 5 : les sept principes sur lesquels reposent les procédures de tout exploitant du secteur alimentaire.</Source>
      </Feuille>

      <Feuille icone="marmite" surTitre="Méthode HACCP · à adapter à votre carte" titre="Analyse des dangers, étape par étape" sousTitre="Les étapes d’un restaurant rapide, avec le danger principal de chacune. Retirez ce qui ne vous concerne pas, complétez le reste." pied={PIED_PMS}>
        <Tableau
          colonnes={[
            { titre: 'Étape', largeur: 78, gras: true },
            { titre: 'Danger principal', flex: 0.95 },
            { titre: 'Comment vous le maîtrisez', flex: 1.2 },
            { titre: 'Limite ou repère', flex: 1.15 },
            { titre: 'Surveillance et trace', flex: 0.9 },
            { titre: 'Si la limite est dépassée', flex: 0.9 },
          ]}
          lignes={[...ETAPES_HACCP, ...vides(2, 6)]}
          hauteur={36}
          entete={22}
        />
      </Feuille>
    </>
  )
}

const POINTS_REVUE = [
  'Les informations de l’établissement et le nom du référent hygiène sont à jour.',
  'Une personne formée à l’hygiène alimentaire fait toujours partie de l’effectif.',
  'Chaque équipier a reçu les consignes d’hygiène de son poste, et la date est notée.',
  'Le plan de nettoyage correspond aux produits et au matériel utilisés aujourd’hui.',
  'Les relevés de température sont remplis chaque jour, avec les températures réellement lues.',
  'Le thermomètre de contrôle fonctionne et a été vérifié.',
  'Le tableau des allergènes correspond à la carte actuelle.',
  'Le contrat et les rapports de lutte contre les nuisibles sont classés.',
  'Les bons de livraison et les étiquettes sont conservés.',
  'Les huiles de friture sont contrôlées et les changements notés.',
  'Les anomalies de l’année ont été traitées et notées.',
  'La carte, le matériel ou les fournisseurs ont changé : le classeur a été repris.',
]

function PageRevue() {
  return (
    <Feuille icone="repete" surTitre="Plan de maîtrise sanitaire · une fois par an" titre="Revue annuelle" sousTitre="Un classeur qui n’est jamais relu finit par décrire un autre établissement. Reprenez ces points chaque année." pied={PIED_PMS}>
      <Tableau
        colonnes={[
          { titre: 'Point à vérifier', flex: 2.2, gras: true },
          { titre: 'En ordre', largeur: 82, centre: true, choix: ['Oui', 'Non'] },
          { titre: 'Ce qu’il faut faire', flex: 1.4 },
          { titre: 'Qui', largeur: 70 },
          { titre: 'Pour le', largeur: 58, centre: true },
        ]}
        lignes={[...POINTS_REVUE.map((p) => [p, null, null, null, null]), ...vides(2, 5)]}
        hauteur={27}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}>
        <View style={{ flex: 1.2, marginRight: 10 }}>
          <Paragraphe>Datez et signez cette revue, puis rangez-la dans le classeur : elle prouve que votre plan est tenu à jour.</Paragraphe>
        </View>
        <View style={{ flex: 1 }}>
          <Champs marge={0} hauteur={30} champs={[{ libelle: 'Date', flex: 0.6 }, { libelle: 'Signature du responsable', flex: 1.4 }]} />
        </View>
      </View>
    </Feuille>
  )
}

// ─────────────────────────────────────────────────────────── Documents

const enDocument = (titre: string, pages: React.ReactNode) => <Document title={titre} author="Lab Learning" subject="Modèle gratuit à imprimer">{pages}</Document>

export const SuiviFormationsPDF = () => enDocument('Suivi des formations de l’équipe', <PagesFormations />)
export const AfficheLavageMainsPDF = () => enDocument('Affichette lavage des mains', <PagesLavageMains />)
export const PlanNuisiblesPDF = () => enDocument('Plan de lutte contre les nuisibles', <PagesNuisibles />)
export const RefroidissementPDF = () => enDocument('Refroidissement et remise en température', <PagesRefroidissement />)
export const SuiviHuilesPDF = () => enDocument('Suivi des huiles de friture', <PagesHuiles />)
export const TracabilitePDF = () => enDocument('Traçabilité et étiquetage', <PagesTracabilite />)
export const NonConformitesPDF = () => enDocument('Non-conformités et alertes', <PagesNonConformites />)

/** Le classeur complet : pages de présentation, puis chaque partie avec ses feuilles. */
export function PmsCompletPDF() {
  return enDocument('Plan de maîtrise sanitaire (PMS)', (
    <>
      <PageCouverture />
      <PageEtablissement />
      <PageSommaire />
      <PageEnBref />
      <PageEquipe />
      <PagesFormations pied={PIED_PMS} />
      <PagesLavageMains pied={PIED_PMS} />
      <PageLocaux />
      <PagesNettoyage pied={PIED_PMS} />
      <PagesNuisibles pied={PIED_PMS} />
      <PagesTemperatures pied={PIED_PMS} />
      <PagesRefroidissement pied={PIED_PMS} />
      <PagesHuiles pied={PIED_PMS} />
      <PagesTracabilite pied={PIED_PMS} />
      <PagesAllergenes pied={PIED_PMS} />
      <PagesNonConformites pied={PIED_PMS} />
      <PagesHaccp />
      <PageRevue />
    </>
  ))
}
