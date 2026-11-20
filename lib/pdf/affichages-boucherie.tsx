import * as React from 'react'
import { Document, View, Text, Image } from '@react-pdf/renderer'
import type { NomIcone } from './modeles-icones'
import { FeuilleLibre, Pastille, ins, Icone, PIN, MENTHE_CLAIRE, TEINTE, BORD, ENCRE, GRIS, GRIS_FONCE, TONS } from './modeles-kit'
import { ALLERGENES } from './modeles-pdf'
import { PagesLavageMains } from './modeles-pms'
import { imagePms, TEMPERATURES_BOUCHERIE } from './pms-boucherie'

/**
 * Affiches d'une boucherie-charcuterie : celles que la réglementation impose
 * (information du consommateur, information des salariés) et celles qui
 * rappellent les règles d'hygiène du laboratoire. Même gabarit que les
 * affichettes des modèles du site (lib/pdf/modeles-kit). Chaque affiche cite
 * son texte quand elle répond à une obligation.
 */

const PIED = 'Affiches boucherie-charcuterie'

/** Cadre commun d'une affiche : bordure pin, surtitre, titre sur deux tons, contenu. */
function Affiche({ surTitre, titre, accent, chapo, source, children }: {
  surTitre: string; titre: string; accent?: string; chapo?: string; source?: string; children: React.ReactNode
}) {
  return (
    <FeuilleLibre pied={PIED}>
      <View style={{ flex: 1, borderWidth: 1.2, borderColor: PIN, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 28, marginBottom: 6 }}>
        <Text style={{ fontSize: 8, fontWeight: 700, color: PIN, letterSpacing: 1.6 }}>{surTitre.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 4 }}>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 30, color: ENCRE }}>{accent ? `${titre} ` : titre}</Text>
          {accent ? <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 30, color: PIN }}>{accent}</Text> : null}
        </View>
        {chapo ? <Text style={{ fontSize: 11, lineHeight: 1.45, color: GRIS_FONCE, marginTop: 6, maxWidth: 640 }}>{ins(chapo)}</Text> : null}
        <View style={{ flex: 1, marginTop: 12 }}>{children}</View>
        {source ? <Text style={{ fontSize: 7, lineHeight: 1.4, color: GRIS, marginTop: 6 }}>{ins(source)}</Text> : null}
      </View>
    </FeuilleLibre>
  )
}

// ─────────────────────────────────────────────────────────── Hygiène du laboratoire

const TENUE: [NomIcone, string, string][] = [
  ['toque', 'Cheveux couverts', 'Calot, charlotte ou filet : tous les cheveux dessous.'],
  ['tablier', 'Tenue claire et propre', 'Veste et tablier réservés au travail, changés dès qu’ils sont sales.'],
  ['couteau', 'Gant et tablier de maille', 'Sur la main qui tient la viande et pour le désossage, lavés chaque jour.'],
  ['main', 'Mains nues et propres', 'Ni bague, ni bracelet, ni montre ; ongles courts, sans vernis.'],
  ['pansement', 'Coupure protégée', 'Pansement de couleur vive, puis un gant par-dessus.'],
  ['croix', 'Jamais au laboratoire', 'Fumer, vapoter, manger, téléphone posé sur le plan de travail.'],
]

function AfficheTenue() {
  return (
    <Affiche surTitre="Laboratoire · hygiène et sécurité" titre="Au laboratoire," accent="la bonne tenue." chapo="Avant de prendre un couteau : tenue complète, mains lavées, protections en place.">
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: 250, borderRadius: 12, overflow: 'hidden', marginRight: 16 }}>
          <Image src={imagePms('tenue.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start' }}>
          {TENUE.map(([icone, titre, texte]) => (
            <View key={titre} style={{ width: '50%', padding: 4 }}>
              <View style={{ backgroundColor: TEINTE, borderRadius: 12, padding: 12, minHeight: 100 }}>
                <Pastille nom={icone} taille={34} fond="#FFFFFF" />
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 12.5, color: ENCRE, marginTop: 8 }}>{titre}</Text>
                <Text style={{ fontSize: 9.4, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 3 }}>{ins(texte)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Affiche>
  )
}

function AfficheTemperatures() {
  return (
    <Affiche surTitre="Chambres froides et vitrines" titre="Les températures" accent="à ne jamais dépasser." chapo="Chaque viande a sa limite. Une enceinte se règle sur le produit le plus fragile qu’elle contient." source="Arrêté du 21 décembre 2009, annexe I. Quand l’étiquette du fabricant indique une température plus basse, c’est elle qui s’applique.">
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {TEMPERATURES_BOUCHERIE.map((t, i) => {
          const { couleur, fond } = TONS[t.ton]
          return (
            <View key={t.valeur} style={{ flex: 1, backgroundColor: fond, borderRadius: 14, padding: 14, marginRight: i < TEMPERATURES_BOUCHERIE.length - 1 ? 9 : 0, justifyContent: 'space-between' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: couleur, letterSpacing: 1 }}>{t.sens.toUpperCase()}</Text>
                  <Icone nom={t.icone} taille={22} couleur={couleur} />
                </View>
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 25, color: couleur, marginTop: 10 }}>{t.valeur}</Text>
              </View>
              <Text style={{ fontSize: 10.5, lineHeight: 1.38, fontWeight: 700, color: ENCRE }}>{ins(t.denrees)}</Text>
            </View>
          )
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginTop: 12 }}>
        <Pastille nom="thermometre" taille={24} fond="#FFFFFF" />
        <Text style={{ flex: 1, fontSize: 11, fontWeight: 700, color: ENCRE, marginLeft: 10 }}>{ins('Relevé matin et soir, sur la feuille du mois. Au-dessus de la limite : on mesure à cœur, et on prévient le responsable.')}</Text>
      </View>
    </Affiche>
  )
}

function AfficheAllergenes() {
  return (
    <Affiche surTitre="Information allergènes" titre="Les allergènes de chaque produit" accent="sont indiqués à côté." chapo="Saucisses, farces, charcuteries, plats traiteur : pour chaque produit fait maison, les allergènes qu’il contient figurent sur son étiquette ou sur l’écriteau placé à côté." source="Règlement (UE) n° 1169/2011, annexe II. Code de la consommation, article R412-13 (denrées non préemballées : information sur la denrée ou à proximité).">
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {ALLERGENES.map((a) => (
            <View key={a.long} style={{ width: '14.28%', alignItems: 'center', paddingVertical: 7 }}>
              <Pastille nom={a.icone} taille={36} />
              <Text style={{ fontSize: 8.4, fontWeight: 700, color: ENCRE, marginTop: 5, textAlign: 'center' }}>{a.court}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
        <Pastille nom="alerte" taille={24} fond="#FFFFFF" />
        <Text style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: ENCRE, marginLeft: 10 }}>{ins('Vous êtes allergique ? Dites-le avant que nous préparions votre commande.')}</Text>
      </View>
    </Affiche>
  )
}

// ─────────────────────────────────────────────────────────── Information des clients en vitrine

/** Tableau à remplir à la main, en gros : en-tête pin, lignes hautes. */
function GrilleVitrine({ colonnes, lignes = 6, hauteur = 34 }: { colonnes: { titre: string; flex?: number }[]; lignes?: number; hauteur?: number }) {
  return (
    <View style={{ borderWidth: 1, borderColor: PIN, borderRadius: 12, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: PIN }}>
        {colonnes.map((c, i) => (
          <View key={c.titre} style={{ flex: c.flex || 1, paddingVertical: 8, paddingHorizontal: 9, borderLeftWidth: i ? 0.6 : 0, borderLeftColor: '#3C6E5E' }}>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11.5, color: '#FFFFFF' }}>{c.titre}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: lignes }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', height: hauteur, borderTopWidth: r ? 0.6 : 0, borderTopColor: BORD, backgroundColor: r % 2 ? TEINTE : '#FFFFFF' }}>
          {colonnes.map((c, i) => <View key={c.titre} style={{ flex: c.flex || 1, borderLeftWidth: i ? 0.6 : 0, borderLeftColor: BORD }} />)}
        </View>
      ))}
    </View>
  )
}

function AfficheOrigineBovine() {
  return (
    <Affiche surTitre="Information des clients · affichage obligatoire" titre="Origine de notre" accent="viande bovine" chapo="Pour chaque viande en vente : les pays de naissance, d’élevage, d’abattage et de découpe. Quand l’animal est né, élevé et abattu en France, on peut écrire « Origine : France »." source="Règlement (CE) n° 1760/2000, article 13. Règlement (CE) n° 1825/2000, article 5 quater. Règlement (UE) n° 1308/2013, annexe VII, partie I (veau et jeune bovin).">
      <GrilleVitrine colonnes={[{ titre: 'Viande, lot', flex: 1.5 }, { titre: 'Né en' }, { titre: 'Élevé en' }, { titre: 'Abattu en' }, { titre: 'Découpé en' }]} lignes={6} hauteur={36} />
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginRight: 9 }}>
          <Pastille nom="etiquette" taille={24} fond="#FFFFFF" />
          <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, color: ENCRE, marginLeft: 9 }}>{ins('Veau : âge à l’abattage, moins de 8 mois. Jeune bovin : de 8 mois à moins de 12 mois.')}</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 }}>
          <Pastille nom="loupe" taille={24} fond="#FFFFFF" />
          <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, color: ENCRE, marginLeft: 9 }}>{ins('Les numéros d’agrément de l’abattoir et de l’atelier de découpe vous sont communiqués sur simple demande.')}</Text>
        </View>
      </View>
    </Affiche>
  )
}

function AfficheOrigineAutres() {
  return (
    <Affiche surTitre="Information des clients · recommandé" titre="Origine de nos" accent="autres viandes" chapo="Porc, agneau, chevreau, volaille, lapin : le pays où l’animal a été élevé et celui où il a été abattu." source="Obligatoire pour les viandes préemballées (règlement d’exécution (UE) n° 1337/2013) ; recommandé pour la vente au détail sans emballage, et demandé par certaines DDPP.">
      <GrilleVitrine colonnes={[{ titre: 'Viande', flex: 1.4 }, { titre: 'Espèce', flex: 0.9 }, { titre: 'Élevé en' }, { titre: 'Abattu en' }]} lignes={7} hauteur={36} />
    </Affiche>
  )
}

function AffichePrix() {
  return (
    <Affiche surTitre="Information des clients · affichage obligatoire" titre="Le tableau des prix" accent="au kilo." chapo="Exposé en permanence à la vue du public, il donne le prix au kilo de tous les morceaux vendus dans la boutique." source="Arrêté du 18 mars 1993 relatif à la publicité des prix des viandes de boucherie, articles 1 à 3 et annexes I (bœuf), II (veau), III (ovin), IV (porc), V (cheval), consultables sur Légifrance.">
      <View style={{ flexDirection: 'row' }}>
        {([['liste', 'Tous les morceaux vendus', 'Dans l’ordre et sous les dénominations des annexes de l’arrêté, espèce par espèce.'], ['balance', 'Des caractères d’au moins 1,5 cm', 'Chiffres et lettres : la hauteur ne descend jamais sous 1,5 centimètre.'], ['etiquette', 'Le mode de cuisson', 'Pour les morceaux de bœuf marqués d’un astérisque : à rôtir, à griller, à braiser, à bouillir…'], ['fichier', 'Le poids et le prix total', 'Sur l’emballage ou sur le ticket remis au client, en plus de l’écriteau à l’étal.']] as [NomIcone, string, string][]).map(([icone, titre, texte], i) => (
          <View key={titre} style={{ flex: 1, backgroundColor: TEINTE, borderRadius: 12, padding: 11, marginRight: i < 3 ? 8 : 0 }}>
            <Pastille nom={icone} taille={30} fond="#FFFFFF" />
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11.5, color: ENCRE, marginTop: 7 }}>{titre}</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 3 }}>{ins(texte)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 8, fontWeight: 700, color: GRIS, letterSpacing: 1.2, marginBottom: 4 }}>EXEMPLE DE LIGNE, EN TAILLE RÉELLE (1,5 CM)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: PIN, paddingVertical: 4 }}>
          <Text style={{ flex: 1, fontFamily: 'Montserrat', fontWeight: 700, fontSize: 64, color: ENCRE }}>Bavette</Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 64, color: PIN }}>00,00 €</Text>
        </View>
      </View>
    </Affiche>
  )
}

// ─────────────────────────────────────────────────────────── Information des salariés (Code du travail)

/** Case à compléter d'une affiche : titre, lignes à remplir, texte qui l'impose. */
function CaseAffiche({ icone, titre, lignes, texte, source, plein }: { icone: NomIcone; titre: string; lignes?: string[]; texte?: string; source: string; plein?: boolean }) {
  return (
    <View style={{ flex: 1, borderWidth: 0.9, borderColor: BORD, borderRadius: 12, padding: 11, backgroundColor: plein ? TEINTE : '#FFFFFF' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Pastille nom={icone} taille={24} fond={plein ? '#FFFFFF' : MENTHE_CLAIRE} />
        <Text style={{ flex: 1, fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: PIN, marginLeft: 7 }}>{ins(titre)}</Text>
      </View>
      {texte ? <Text style={{ fontSize: 8.6, lineHeight: 1.4, color: GRIS_FONCE, marginBottom: 4 }}>{ins(texte)}</Text> : null}
      {(lignes || []).map((l) => (
        <View key={l} style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 5.8, fontWeight: 700, color: GRIS, letterSpacing: 0.7 }}>{l.toUpperCase()}</Text>
          <View style={{ height: 13, borderBottomWidth: 0.7, borderBottomColor: '#9AA6B2' }} />
        </View>
      ))}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 6.4, color: GRIS, marginTop: 3 }}>{ins(source)}</Text>
      </View>
    </View>
  )
}

const Rangee = ({ children, bas = 9 }: { children: React.ReactNode; bas?: number }) => (
  <View style={{ flex: 1, flexDirection: 'row', marginBottom: bas, gap: 9 }}>{children}</View>
)

function AfficheContactsObligatoires() {
  return (
    <Affiche surTitre="Information des salariés · affichage obligatoire" titre="Numéros et adresses" accent="à connaître." chapo="À compléter et à afficher dans un endroit accessible à tous les salariés, par exemple le vestiaire ou la salle de pause.">
      <Rangee>
        <CaseAffiche icone="balance" titre="Inspection du travail" lignes={['Adresse', 'Téléphone', 'Nom de l’inspecteur compétent']} source="Code du travail, article D4711-1." />
        <CaseAffiche icone="secours" titre="Médecine du travail" lignes={['Service de prévention et de santé au travail', 'Adresse', 'Téléphone']} source="Code du travail, article D4711-1." />
        <CaseAffiche icone="telephone" titre="Secours d’urgence" plein texte="SAMU : 15 · Pompiers : 18 · Police : 17 · Urgence européenne : 112 · Appel par SMS (sourds et malentendants) : 114" lignes={['Centre antipoison de la région']} source="Code du travail, article D4711-1." />
      </Rangee>
      <Rangee bas={0}>
        <CaseAffiche icone="balance" titre="Discriminations et harcèlement" texte="Plateforme antidiscriminations du Défenseur des droits : 39 28, antidiscriminations.fr. Défenseur des droits : 09 69 39 00 00." lignes={['Référent harcèlement (à partir de 11 salariés)', 'Élus du CSE (à partir de 11 salariés)']} source="Code du travail, articles L1153-5, D1151-1 et L2314-29." />
        <CaseAffiche icone="classeur" titre="Convention collective" lignes={['Intitulé et numéro (IDCC)', 'Où la consulter dans l’entreprise']} source="Code du travail, article R2262-3." />
        <CaseAffiche icone="fichier" titre="Document unique d’évaluation des risques" lignes={['Où le consulter', 'Mis à jour le']} source="Code du travail, article R4121-4." />
      </Rangee>
    </Affiche>
  )
}

function AfficheOrganisationTravail() {
  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  return (
    <Affiche surTitre="Information des salariés · affichage obligatoire" titre="Horaires" accent="et congés." chapo="L’horaire collectif s’affiche dans chaque lieu de travail ; toute modification est affichée avant d’entrer en application.">
      <View style={{ flexDirection: 'row', marginBottom: 9 }}>
        {jours.map((j, i) => (
          <View key={j} style={{ flex: 1, borderWidth: 0.9, borderColor: BORD, borderRadius: 10, padding: 8, marginRight: i < jours.length - 1 ? 6 : 0, height: 128 }}>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10, color: PIN }}>{j}</Text>
            {['Matin, de … à …', 'Après-midi, de … à …', 'Repos'].map((l) => (
              <View key={l} style={{ marginTop: 7 }}>
                <Text style={{ fontSize: 5.8, fontWeight: 700, color: GRIS, letterSpacing: 0.6 }}>{l.toUpperCase()}</Text>
                <View style={{ height: 14, borderBottomWidth: 0.7, borderBottomColor: '#9AA6B2' }} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 6.4, color: GRIS, marginBottom: 8 }}>Code du travail, articles L3171-1 et D3171-2 à D3171-5 (horaire collectif) ; repos hebdomadaire donné un autre jour que le dimanche : article R3172-1.</Text>
      <Rangee bas={0}>
        <CaseAffiche icone="calendrier" titre="Congés payés" lignes={['Période de prise des congés', 'Ordre des départs communiqué le']} source="Code du travail, articles D3141-5 et D3141-6." />
        <CaseAffiche icone="horloge" titre="Repos hebdomadaire" lignes={['Jour de repos, s’il n’est pas le dimanche', 'Organisation par roulement, le cas échéant']} source="Code du travail, articles L3132-1 et R3172-1 à R3172-3." />
        <CaseAffiche icone="liste" titre="Règlement intérieur" texte="Obligatoire à partir de 50 salariés : il est affiché avec la date de son entrée en vigueur." lignes={['Où le consulter']} source="Code du travail, articles L1311-2 et R1321-1." />
      </Rangee>
    </Affiche>
  )
}

const DROITS: { icone: NomIcone; titre: string; texte: string; source: string }[] = [
  { icone: 'bouclier', titre: 'Harcèlement moral', texte: 'Aucun salarié ne doit subir des agissements répétés de harcèlement moral qui dégradent ses conditions de travail. Le harcèlement moral est puni de deux ans d’emprisonnement et de 30 000 € d’amende.', source: 'Code du travail, articles L1152-1 et L1152-4 ; Code pénal, article 222-33-2.' },
  { icone: 'bouclier', titre: 'Harcèlement sexuel', texte: 'Propos, comportements à connotation sexuelle ou sexiste répétés, ou pression grave en vue d’obtenir un acte sexuel : c’est interdit et puni de deux ans d’emprisonnement et de 30 000 € d’amende. Recours : conseil de prud’hommes (dans les cinq ans) et plainte pénale (dans les six ans).', source: 'Code du travail, articles L1153-1 et L1153-5 ; Code pénal, article 222-33.' },
  { icone: 'balance', titre: 'Discrimination', texte: 'Aucune personne ne peut être écartée d’un recrutement, sanctionnée ou licenciée en raison de son origine, son sexe, son âge, sa religion, son handicap, son orientation sexuelle ou de tout autre critère interdit. La discrimination est punie de trois ans d’emprisonnement et de 45 000 € d’amende.', source: 'Code du travail, articles L1132-1 et L1142-6 ; Code pénal, articles 225-1 à 225-4.' },
  { icone: 'equipe', titre: 'Égalité de rémunération', texte: 'Tout employeur assure, pour un même travail ou un travail de valeur égale, l’égalité de rémunération entre les femmes et les hommes.', source: 'Code du travail, articles L3221-1 à L3221-7 et R3221-2.' },
]

function AfficheDroits() {
  return (
    <Affiche surTitre="Information des salariés · par affichage ou tout autre moyen" titre="Vos droits" accent="au travail." chapo="Ces informations doivent être portées à la connaissance de chaque salarié. Les textes complets sont disponibles sur Légifrance.">
      <View style={{ flex: 1 }}>
        {[DROITS.slice(0, 2), DROITS.slice(2)].map((rangee, r) => (
          <View key={r} style={{ flex: 1, flexDirection: 'row', marginBottom: r ? 0 : 9, gap: 9 }}>
        {rangee.map((d) => (
            <View key={d.titre} style={{ flex: 1, borderWidth: 0.9, borderColor: BORD, borderRadius: 12, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Pastille nom={d.icone} taille={26} />
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 12, color: PIN, marginLeft: 8 }}>{d.titre}</Text>
              </View>
              <Text style={{ fontSize: 9, lineHeight: 1.42, color: GRIS_FONCE }}>{ins(d.texte)}</Text>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 6.4, color: GRIS, marginTop: 4 }}>{ins(d.source)}</Text>
              </View>
            </View>
        ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, marginTop: 6 }}>
        <Pastille nom="telephone" taille={22} fond="#FFFFFF" />
        <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, color: ENCRE, marginLeft: 10 }}>{ins('Victime ou témoin ? Parlez-en à votre responsable, au médecin du travail, à l’inspection du travail ou au Défenseur des droits (coordonnées sur l’affiche « Numéros et adresses »).')}</Text>
      </View>
    </Affiche>
  )
}

function AfficheTabac() {
  return (
    <Affiche surTitre="Signalisation obligatoire" titre="Interdiction de fumer" accent="et de vapoter." chapo="Dans tous les lieux fermés et couverts accueillant du public ou qui constituent des lieux de travail : boutique, laboratoire, réserve, vestiaires." source="Code de la santé publique, articles L3512-8, R3512-2 et R3512-7 (tabac) ; L3513-6, R3513-2 et R3513-3 (vapotage).">
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {([['Il est interdit de fumer', 'dans cet établissement.'], ['Il est interdit de vapoter', 'dans cet établissement.']] as [string, string][]).map(([haut, bas], i) => (
          <View key={haut} style={{ flex: 1, borderRadius: 16, backgroundColor: i ? TEINTE : '#FCE8DE', alignItems: 'center', justifyContent: 'center', marginRight: i ? 0 : 12, padding: 18 }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 9, borderColor: '#B4441B', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
              <Icone nom={i ? 'vent' : 'cigarette'} taille={56} couleur={ENCRE} />
              <View style={{ position: 'absolute', width: 124, height: 9, backgroundColor: '#B4441B', transform: 'rotate(-45deg)' }} />
            </View>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 20, color: ENCRE, marginTop: 16, textAlign: 'center' }}>{haut}</Text>
            <Text style={{ fontSize: 13, color: GRIS_FONCE, marginTop: 3, textAlign: 'center' }}>{bas}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, marginTop: 10 }}>
        <Pastille nom="alerte" taille={22} fond="#FFFFFF" />
        <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, color: ENCRE, marginLeft: 10 }}>{ins('Le non-respect de l’interdiction de fumer est puni de l’amende prévue pour les contraventions de la troisième classe ; celui de l’interdiction de vapoter, de la deuxième classe.')}</Text>
      </View>
    </Affiche>
  )
}

function AfficheIncendie() {
  return (
    <Affiche surTitre="Sécurité · consigne obligatoire" titre="En cas d’incendie" chapo="Consigne à compléter, à afficher dans chaque local et à présenter à chaque nouvel arrivant." source="Code du travail, articles R4227-37 à R4227-39 (consigne de sécurité incendie, exercices).">
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1.2, marginRight: 12 }}>
          {([['Donner l’alerte', 'Prévenir les personnes présentes et appeler les pompiers : 18 ou 112.'], ['Couper', 'L’alimentation électrique et le gaz si c’est sans danger, fermer les portes.'], ['Attaquer le feu', 'Seulement s’il est petit : extincteur adapté, couverture anti-feu sur un bac d’huile.'], ['Évacuer', 'Faire sortir tout le monde par l’issue la plus proche, sans revenir en arrière.'], ['Se rassembler', 'Au point de rassemblement, compter les présents, attendre les secours.']] as [string, string][]).map(([titre, texte], i) => (
            <View key={titre} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: i % 2 ? '#FFFFFF' : TEINTE, borderRadius: 10, padding: 9, marginBottom: 6 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#B4441B', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12, color: '#FFFFFF' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 12, color: ENCRE }}>{titre}</Text>
                <Text style={{ fontSize: 9, lineHeight: 1.35, color: GRIS_FONCE }}>{ins(texte)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 9 }}>
          <CaseAffiche icone="epingle" titre="Dans notre boucherie" lignes={['Point de rassemblement', 'Emplacement des extincteurs', 'Coupure générale électricité et gaz', 'Responsable de l’évacuation']} source="À compléter par l’exploitant." />
        </View>
      </View>
    </Affiche>
  )
}

// ─────────────────────────────────────────────────────────── Document

/** Les affiches de la boutique et du laboratoire, à imprimer en A4 paysage. */
export function AffichagesBoucheriePDF() {
  return (
    <Document title="Affiches boucherie-charcuterie" author="Lab Learning" subject="Affiches obligatoires et consignes d’hygiène">
      <AfficheOrigineBovine />
      <AfficheOrigineAutres />
      <AffichePrix />
      <AfficheAllergenes />
      <AfficheContactsObligatoires />
      <AfficheOrganisationTravail />
      <AfficheDroits />
      <AfficheTabac />
      <AfficheIncendie />
      <AfficheTenue />
      <PagesLavageMains pied={PIED} />
      <AfficheTemperatures />
    </Document>
  )
}
