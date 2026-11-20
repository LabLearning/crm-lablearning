import * as React from 'react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Document, View, Text, Image } from '@react-pdf/renderer'
import { LogoLabLearning } from './logo-lab-learning'
import type { NomIcone } from './modeles-icones'
import {
  Feuille, FeuilleLibre, Champs, Tableau, vides, Carte, Puce, Etape, Source, Pastille, Paragraphe, ins,
  Repere, TitreSection, ChampLigne, Bandeau, Icone,
  PIN, MENTHE_CLAIRE, TEINTE, BORD, ENCRE, GRIS, GRIS_FONCE, type Colonne,
} from './modeles-kit'
import { PagesNettoyage, ALLERGENES } from './modeles-pdf'
import { PagesLavageMains, PagesNuisibles } from './modeles-pms'

/**
 * Plan de maîtrise sanitaire d'une boucherie-charcuterie de détail (remise
 * directe, laboratoire de découpe, rayon charcuterie ou traiteur éventuel),
 * construit sur le kit des modèles du site (lib/pdf/modeles-kit) : mêmes
 * feuilles, mêmes composants, contenu propre à la boucherie. Demande de
 * Brahim du 20/11/2026.
 *
 * Les rappels réglementaires citent leur texte sur chaque page. Les
 * établissements peuvent arriver pré-remplis (pack hygiène d'une session).
 */

export interface EtablissementPms {
  raisonSociale?: string | null
  enseigne?: string | null
  adresse?: string | null
  siret?: string | null
  telephone?: string | null
  referent?: string | null
  responsable?: string | null
  qualite?: string | null
  misAJour?: string | null
  /** Formations déjà suivies, reportées dans le tableau de suivi (stagiaires de la session) */
  formations?: { nom: string; poste?: string | null; intitule: string; organisme: string; date: string; duree: string }[]
}

/** Adresse complète, sans répéter le code postal et la ville quand l'adresse les contient déjà. */
export function adresseComplete(adresse?: string | null, codePostal?: string | null, ville?: string | null): string | null {
  const a = String(adresse || '').trim()
  const cpVille = [codePostal, ville].filter(Boolean).join(' ')
  if (!a) return cpVille || null
  if (codePostal && a.includes(String(codePostal))) return a
  return [a, cpVille].filter(Boolean).join(', ')
}

/** Établissement de boucherie, charcuterie ou triperie : d'après son activité, son nom ou la formation suivie. */
export function estBoucherie(o: { secteur?: string | null; raisonSociale?: string | null; nomCommercial?: string | null; formation?: string | null }): boolean {
  const motif = /bouch|charcut|triper/i
  return [o.secteur, o.raisonSociale, o.nomCommercial].some((x) => motif.test(String(x || ''))) || /boucher/i.test(String(o.formation || ''))
}

type P = { pied?: string; e?: EtablissementPms }
const PIED = 'Plan de maîtrise sanitaire · boucherie-charcuterie'

/** Image du dossier public/pms/boucherie : fichier local au rendu serveur, sinon l'adresse publique. */
export function imagePms(nom: string): string {
  const local = join(process.cwd(), 'public', 'pms', 'boucherie', nom)
  if (existsSync(local)) return local
  return `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/pms/boucherie/${nom}`
}

// ─────────────────────────────────────────────────────────── Repères réglementaires (à tenir à jour)

/** Températures de conservation en remise directe : arrêté du 21 décembre 2009, annexe I. */
export const TEMPERATURES_BOUCHERIE: { valeur: string; sens: string; denrees: string; ton: 'bleu' | 'sarcelle' | 'pin' | 'ambre' | 'rouge'; icone: NomIcone }[] = [
  { valeur: '−18 °C', sens: 'Au plus', denrees: 'Surgelés, viandes hachées et préparations de viandes congelées', ton: 'bleu', icone: 'flocon' },
  { valeur: '−12 °C', sens: 'Au plus', denrees: 'Autres viandes congelées', ton: 'bleu', icone: 'flocon' },
  { valeur: '+2 °C', sens: 'Au plus', denrees: 'Viandes hachées', ton: 'sarcelle', icone: 'thermometreFroid' },
  { valeur: '+3 °C', sens: 'Au plus', denrees: 'Abats, plats cuisinés et préparations traiteur élaborées à l’avance', ton: 'sarcelle', icone: 'thermometreFroid' },
  { valeur: '+4 °C', sens: 'Au plus', denrees: 'Morceaux de découpe, préparations de viandes, volailles et lapins, charcuterie cuite', ton: 'pin', icone: 'frigo' },
  { valeur: '+7 °C', sens: 'Au plus', denrees: 'Carcasses entières et pièces de gros', ton: 'ambre', icone: 'steak' },
]

// ─────────────────────────────────────────────────────────── Pages propres au classeur

/** Les parties du classeur, dans l'ordre, avec leur nombre de pages : le sommaire en déduit les numéros. */
const PARTIES: { titre: string; detail: string; pages: number }[] = [
  { titre: 'Votre boucherie', detail: 'Engagement, informations, activités, plan du laboratoire', pages: 3 },
  { titre: 'Le PMS en bref', detail: 'Les trois piliers et ce que disent les textes', pages: 1 },
  { titre: 'L’équipe', detail: 'Tenue, sécurité au couteau, santé, formation, lavage des mains', pages: 3 },
  { titre: 'Locaux et matériel', detail: 'Entretien, eau, os et déchets de découpe', pages: 1 },
  { titre: 'Nettoyage et désinfection', detail: 'Plan, enregistrement de la semaine, méthode', pages: 3 },
  { titre: 'Lutte contre les nuisibles', detail: 'Plan et suivi des passages', pages: 2 },
  { titre: 'Réception des viandes', detail: 'Marques, étiquettes, températures, fiche de contrôle', pages: 2 },
  { titre: 'Températures', detail: 'Repères, relevé du mois', pages: 2 },
  { titre: 'Viande hachée', detail: 'À la demande ou à l’avance, fiche de hachage', pages: 2 },
  { titre: 'Préparations et charcuterie', detail: 'Additifs, cuisson, refroidissement, fiche de fabrication', pages: 2 },
  { titre: 'Sous-produits et matériels à risque', detail: 'Catégories, colonne vertébrale, registre des enlèvements', pages: 2 },
  { titre: 'Traçabilité et origine', detail: 'Mentions obligatoires, prix, fiche de suivi des lots', pages: 2 },
  { titre: 'Allergènes', detail: 'Préparations et charcuterie maison', pages: 1 },
  { titre: 'Non-conformités et alertes', detail: 'Retrait, rappel, fiche de non-conformité', pages: 2 },
  { titre: 'Méthode HACCP', detail: 'Les dangers étape par étape, de la carcasse à la vitrine', pages: 2 },
  { titre: 'Revue annuelle', detail: 'Les points à vérifier une fois par an', pages: 1 },
]
export const PAGES_PMS_BOUCHERIE = 1 + PARTIES.reduce((s, p) => s + p.pages, 0)

function PageCouverture({ e }: P) {
  const piliers: [NomIcone, string, string][] = [
    ['equipe', 'Les bonnes pratiques d’hygiène', 'L’équipe, le laboratoire, le nettoyage, les températures.'],
    ['cible', 'La méthode HACCP', 'De la carcasse à la vitrine : vos dangers et comment vous les maîtrisez.'],
    ['etiquette', 'La traçabilité et l’origine', 'D’où vient chaque viande, ce qu’affiche la vitrine, quoi faire en cas d’alerte.'],
  ]
  return (
    <FeuilleLibre pied={PIED}>
      <View style={{ flex: 1, flexDirection: 'row', marginBottom: 6 }}>
        <View style={{ flex: 1.2, paddingRight: 24, paddingTop: 8 }}>
          <LogoLabLearning hauteur={38} />
          <Text style={{ fontSize: 8, fontWeight: 700, color: PIN, letterSpacing: 1.6, marginTop: 36 }}>BOUCHERIE · CHARCUTERIE · TRAITEUR</Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 40, color: ENCRE, marginTop: 8 }}>Plan de maîtrise</Text>
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 40, color: PIN }}>sanitaire</Text>
          <Text style={{ fontSize: 12, lineHeight: 1.5, color: GRIS_FONCE, marginTop: 12, maxWidth: 360 }}>
            Le classeur d’hygiène de votre boucherie : vos règles, votre méthode, et toutes les feuilles de relevé, prêtes à imprimer.
          </Text>
          <View style={{ marginTop: 14 }}>
            {piliers.map(([icone, titre, texte]) => (
              <View key={titre} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                <Pastille nom={icone} taille={26} fond={PIN} couleur="#FFFFFF" rond={false} />
                <View style={{ flex: 1, paddingLeft: 9 }}>
                  <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 9.6, color: ENCRE }}>{titre}</Text>
                  <Text style={{ fontSize: 7.8, lineHeight: 1.35, color: GRIS_FONCE }}>{ins(texte)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Champs hauteur={34} marge={7} champs={[{ libelle: 'Établissement', valeur: e?.enseigne || e?.raisonSociale }]} />
            <Champs hauteur={30} marge={0} champs={[{ libelle: 'Référent hygiène', flex: 1.4, valeur: e?.referent }, { libelle: 'Mis à jour le', valeur: e?.misAJour }]} />
          </View>
        </View>
        <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: TEINTE }}>
          <Image src={imagePms('vitrine.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, backgroundColor: '#FFFFFF', borderRadius: 11, padding: 11 }}>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10.5, color: PIN }}>{PAGES_PMS_BOUCHERIE} pages</Text>
            <Text style={{ fontSize: 7.8, lineHeight: 1.4, color: GRIS_FONCE, marginTop: 2 }}>{ins('Dont les feuilles de relevé à imprimer autant de fois que nécessaire. Les affiches obligatoires de la boutique et du laboratoire sont fournies à part.')}</Text>
          </View>
        </View>
      </View>
    </FeuilleLibre>
  )
}

function PageEtablissement({ e }: P) {
  const activites = ['Boucherie (bœuf, veau, agneau, porc)', 'Volailles, lapins', 'Charcuterie crue (saucisses, farces)', 'Charcuterie cuite', 'Plats cuisinés, traiteur', 'Triperie, abats', 'Viande hachée', 'Vente à d’autres commerces']
  return (
    <Feuille icone="magasin" surTitre="Plan de maîtrise sanitaire · à compléter en premier" titre="Votre boucherie" sousTitre="Qui s’engage, et pour quel établissement : la première page que lit un inspecteur." pied={PIED}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Carte icone="signature" titre="Engagement du responsable" marge={0}>
            <ChampLigne libelle="Je soussigné(e)" hauteur={16} valeur={e?.responsable} />
            <ChampLigne libelle="En qualité de" hauteur={16} valeur={e?.qualite} />
            <View style={{ marginTop: 2, marginBottom: 10 }}>
              <Paragraphe>m’engage à appliquer ce plan de maîtrise sanitaire dans la boutique et le laboratoire, à le faire connaître à toute l’équipe et à le tenir à jour à chaque changement de fournisseur, de fabrication, de matériel ou d’organisation.</Paragraphe>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="Fait à" hauteur={16} /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Le" hauteur={16} /></View>
            </View>
            <Text style={{ fontSize: 5.6, fontWeight: 700, color: GRIS, letterSpacing: 0.7 }}>SIGNATURE</Text>
            <View style={{ height: 62, borderWidth: 0.8, borderColor: BORD, borderRadius: 7, marginTop: 4 }} />
          </Carte>
        </View>
        <View style={{ flex: 1.3 }}>
          <Carte icone="magasin" titre="L’établissement" marge={8}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="Raison sociale" valeur={e?.raisonSociale} /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Enseigne" valeur={e?.enseigne} /></View>
            </View>
            <ChampLigne libelle="Adresse" valeur={e?.adresse} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="SIRET" valeur={e?.siret} /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Téléphone" valeur={e?.telephone} /></View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="Effectif" /></View>
              <View style={{ flex: 1.4 }}><ChampLigne libelle="Référent hygiène (nom et fonction)" valeur={e?.referent} /></View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}><ChampLigne libelle="Déclaration à la DDPP (Cerfa 13984) faite le" marge={0} /></View>
              <View style={{ flex: 1 }}><ChampLigne libelle="Dérogation (Cerfa 13982) ou agrément n°" marge={0} /></View>
            </View>
          </Carte>
          <Carte icone="liste" titre="Vos activités" marge={0}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {activites.map((a) => (
                <View key={a} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <View style={{ width: 8.5, height: 8.5, borderWidth: 0.8, borderColor: GRIS, borderRadius: 2, marginRight: 6 }} />
                  <Text style={{ fontSize: 8, color: GRIS_FONCE }}>{ins(a)}</Text>
                </View>
              ))}
            </View>
          </Carte>
        </View>
      </View>
      <Bandeau haut={7}>Rangez derrière cette page la copie de votre déclaration à la DDPP, celle de votre déclaration de hachage à l’avance si vous en faites, la dérogation à l’agrément si vous vendez à d’autres commerces (80 km au plus, quantités plafonnées, jamais de viande hachée), l’autorisation de dévertébrer si vous en avez une, et les attestations de formation.</Bandeau>
    </Feuille>
  )
}

function PagePlan() {
  return (
    <Feuille icone="epingle" surTitre="Votre boucherie · à dessiner ou à coller" titre="Le plan du laboratoire et de la boutique" sousTitre="Les zones, et le trajet des viandes de la livraison à la vitrine : la marche en avant." pied={PIED}>
      <View style={{ flexDirection: 'row', flex: 1 }}>
        <View style={{ flex: 2.2, marginRight: 10, borderWidth: 0.8, borderColor: BORD, borderRadius: 9, borderStyle: 'dashed', marginBottom: 4 }} />
        <View style={{ flex: 1 }}>
          <Carte icone="repete" titre="La marche en avant" marge={8}>
            <Paragraphe>Les viandes avancent toujours du plus sale vers le plus propre, sans retour en arrière ni croisement avec les déchets.</Paragraphe>
            <View style={{ marginTop: 6 }}>
              {['Réception', 'Chambres froides', 'Découpe et désossage', 'Hachage, préparations', 'Cuisson (charcuterie)', 'Vitrine et vente'].map((z, i, t) => (
                <View key={z} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < t.length - 1 ? 3 : 0 }}>
                  <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: PIN, alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
                    <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 7.6, color: '#FFFFFF' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontSize: 8.4, color: GRIS_FONCE }}>{z}</Text>
                </View>
              ))}
            </View>
          </Carte>
          <Carte icone="alerte" titre="À faire figurer" fond={TEINTE} marge={0}>
            <Puce>Les chambres froides et leur contenu (carcasses, viandes découpées, préparations, produits cuits).</Puce>
            <Puce>Le lave-mains, les postes de découpe, le hachoir et le poussoir.</Puce>
            <Puce>Le circuit des os et déchets, et l’emplacement des conteneurs de sous-produits.</Puce>
            <Puce>Si le local est commun, les heures ou les zones qui séparent le cru et le cuit.</Puce>
          </Carte>
        </View>
      </View>
    </Feuille>
  )
}

function PageSommaire() {
  let page = 2
  const lignes = PARTIES.map((p, i) => { const debut = page; page += p.pages; return { ...p, n: i + 1, debut } })
  const moitie = Math.ceil(lignes.length / 2)
  return (
    <Feuille icone="liste" surTitre="Plan de maîtrise sanitaire · mode d’emploi" titre="Sommaire" sousTitre="Seize parties. Chacune commence par ce qu’il faut savoir, puis donne la feuille à remplir." pied={PIED}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1.8, flexDirection: 'row', marginRight: 12 }}>
          {[lignes.slice(0, moitie), lignes.slice(moitie)].map((groupe, g) => (
            <View key={g} style={{ flex: 1, marginLeft: g ? 10 : 0 }}>
              {groupe.map((l) => (
                <View key={l.n} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 0.8, borderColor: BORD, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 9, marginBottom: 5, minHeight: 42 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: MENTHE_CLAIRE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 9.4, color: PIN }}>{l.n}</Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 9 }}>
                    <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 9, color: ENCRE }}>{l.titre}</Text>
                    <Text style={{ fontSize: 7.2, lineHeight: 1.3, color: GRIS, marginTop: 1 }}>{l.detail}</Text>
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
            <Etape n={4}>Relisez le classeur une fois par an, et à chaque nouvelle fabrication, nouveau fournisseur ou nouveau matériel.</Etape>
          </Carte>
          <Carte icone="alerte" titre="À savoir" fond={TEINTE} marge={0}>
            <Paragraphe>Cette trame s’appuie sur les textes cités à chaque page et sur les pratiques du guide de bonnes pratiques d’hygiène de la boucherie. Elle n’a de valeur que si elle décrit votre boucherie : retirez ce qui ne vous concerne pas, ajoutez ce qui manque.</Paragraphe>
          </Carte>
        </View>
      </View>
    </Feuille>
  )
}

function PageEnBref() {
  const piliers: { icone: NomIcone; titre: string; accroche: string; points: string[] }[] = [
    { icone: 'equipe', titre: 'Les bonnes pratiques d’hygiène', accroche: 'Les règles de base, à respecter tous les jours.', points: ['Une équipe formée, propre et en tenue', 'Un laboratoire et du matériel entretenus', 'Le nettoyage et la désinfection', 'La lutte contre les nuisibles', 'Les températures maîtrisées', 'Le contrôle des viandes à réception'] },
    { icone: 'cible', titre: 'La méthode HACCP', accroche: 'L’analyse de vos propres dangers, de la carcasse à la vitrine.', points: ['Lister les dangers à chaque étape', 'Repérer les points où un contrôle est indispensable', 'Fixer une limite à ne pas dépasser', 'Surveiller, et corriger en cas d’écart', 'Vérifier que cela fonctionne', 'Garder la trace'] },
    { icone: 'etiquette', titre: 'La traçabilité et l’origine', accroche: 'Savoir d’où vient chaque viande, et le dire au client.', points: ['Documents d’accompagnement conservés', 'Lots suivis jusqu’à la vente', 'Origine affichée en vitrine', 'Produit signalé : retiré tout de suite', 'Autorités prévenues en cas de risque'] },
  ]
  return (
    <Feuille icone="classeur" surTitre="Plan de maîtrise sanitaire · l’essentiel" titre="Le PMS en bref" sousTitre="Tout ce que vous faites pour vendre des viandes sûres, et les preuves que vous le faites : trois piliers." pied={PIED}>
      <View style={{ flexDirection: 'row' }}>
        {piliers.map((p, i) => (
          <View key={p.titre} style={{ flex: 1, borderWidth: 0.8, borderColor: BORD, borderRadius: 11, padding: 12, marginRight: i < piliers.length - 1 ? 9 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pastille nom={p.icone} taille={34} fond={PIN} couleur="#FFFFFF" rond={false} />
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 24, color: '#C9D8D1' }}>{i + 1}</Text>
            </View>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 12, color: PIN, marginTop: 9 }}>{p.titre}</Text>
            <Text style={{ fontSize: 8.6, lineHeight: 1.4, color: GRIS, marginTop: 2, marginBottom: 7 }}>{ins(p.accroche)}</Text>
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
            <Paragraphe>Lors d’un contrôle, l’inspecteur regarde ce qui se fait au laboratoire, puis demande les enregistrements. Un relevé rempli chaque jour pèse plus qu’un classeur parfait jamais ouvert.</Paragraphe>
          </Carte>
        </View>
      </View>
      <TitreSection icone="equipe" titre="Qui fait quoi" note="Un nom par tâche : sans responsable désigné, un relevé finit par ne plus être fait." />
      <Champs hauteur={34} marge={0} champs={[{ libelle: 'Tient le classeur à jour' }, { libelle: 'Relève les températures' }, { libelle: 'Réceptionne les viandes' }, { libelle: 'Vérifie le nettoyage' }, { libelle: 'Forme les nouveaux' }]} />
    </Feuille>
  )
}

const PREMIER_JOUR: [NomIcone, string][] = [
  ['savon', 'Où et comment se laver les mains'],
  ['tablier', 'La tenue et le vestiaire'],
  ['couteau', 'Les couteaux, l’affûtage, les gants et le tablier de protection'],
  ['thermometre', 'Les températures à respecter, et où les noter'],
  ['seau', 'Le nettoyage de son poste et du matériel'],
  ['ble', 'Où est le tableau des allergènes, et quoi répondre à un client'],
  ['pansement', 'Quoi faire en cas de coupure ou de maladie'],
  ['megaphone', 'Qui prévenir en cas d’anomalie'],
]

function PageEquipe() {
  return (
    <Feuille icone="equipe" surTitre="L’équipe · vos règles" titre="Hygiène, tenue et santé de l’équipe" sousTitre="Les règles que chaque nouvel arrivant connaît le premier jour, au laboratoire comme en boutique." pied={PIED}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 168, marginRight: 10, borderRadius: 10, overflow: 'hidden', height: 262 }}>
          <Image src={imagePms('tenue.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </View>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Carte icone="tablier" titre="La tenue de travail" marge={0}>
            <ChampLigne libelle="Ce qui compose la tenue" />
            <ChampLigne libelle="Qui la lave, à quelle fréquence" marge={9} />
            <Puce>Veste ou blouse claire et propre, tablier, réservés au travail et changés aussi souvent que nécessaire.</Puce>
            <Puce>Les cheveux entièrement couverts : calot, charlotte ou filet.</Puce>
            <Puce>Ni bague, ni bracelet, ni montre ; ongles courts et sans vernis.</Puce>
            <Puce>Les vêtements de ville restent au vestiaire.</Puce>
          </Carte>
        </View>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Carte icone="couteau" titre="Au couteau, se protéger" marge={0}>
            <Puce>Gant de protection en cotte de mailles sur la main qui tient la viande, tablier de protection pour le désossage.</Puce>
            <Puce>Le gant de maille se lave et se désinfecte comme un ustensile, au moins chaque jour.</Puce>
            <Puce>Un couteau affûté coupe mieux et blesse moins : affûtage régulier, fusil propre.</Puce>
            <Puce>Couteaux rangés dans un support propre, jamais dans le tablier ni dans un bac à viande.</Puce>
          </Carte>
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="pansement" titre="L’état de santé" marge={8}>
            <Puce>Celui qui a des symptômes digestifs, une plaie infectée ou une infection de la peau le signale au responsable avant de prendre son poste.</Puce>
            <Puce>Il ne manipule pas les viandes tant que le risque existe.</Puce>
            <Puce>Une coupure simple est protégée par un pansement de couleur vive et un gant.</Puce>
            <Source>Règlement (CE) n° 852/2004, annexe II, chapitre VIII.</Source>
          </Carte>
          <Carte icone="croix" titre="Au laboratoire, jamais" fond={TEINTE} marge={0}>
            <Paragraphe>Fumer, vapoter, manger, mâcher un chewing-gum, poser son téléphone sur un plan de travail.</Paragraphe>
          </Carte>
        </View>
      </View>
      <TitreSection icone="liste" titre="Le premier jour d’un nouvel arrivant" note="Ce qu’il doit avoir vu avant de prendre un couteau ou de servir un client." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {PREMIER_JOUR.map(([icone, texte]) => (
          <View key={texte} style={{ width: '25%', padding: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 0.8, borderColor: BORD, borderRadius: 9, padding: 7, minHeight: 38 }}>
              <Pastille nom={icone} taille={20} />
              <Text style={{ flex: 1, fontSize: 7.8, lineHeight: 1.3, color: GRIS_FONCE, marginLeft: 7 }}>{ins(texte)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Feuille>
  )
}

/** Formation de l'équipe : ce qu'exigent les textes pour une boucherie, et le tableau de suivi. */
export const TEXTE_FORMATION = {
  obligation: 'Chaque personne qui manipule les viandes est encadrée et reçoit des instructions ou une formation à l’hygiène adaptées à son poste ; le responsable du plan de maîtrise sanitaire est formé à la méthode HACCP.',
  precision: 'La formation spécifique de 14 heures n’est obligatoire que pour la restauration commerciale : une boucherie n’y est pas soumise, sauf si elle est immatriculée en restauration.',
  source: 'Règlement (CE) n° 852/2004, annexe II, chapitres XI bis et XII. Code rural et de la pêche maritime, articles L233-4 et D233-11 (restauration commerciale).',
}

function PageFormations({ e }: P) {
  return (
    <Feuille icone="diplome" surTitre="L’équipe · à tenir à jour" titre="Formation de l’équipe à l’hygiène" sousTitre="Qui a été formé, à quoi, quand : une ligne par personne et par formation." pied={PIED}>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <View style={{ flex: 1.6, marginRight: 10 }}>
          <Carte icone="balance" titre="Ce que disent les textes" marge={0}>
            <Puce>{TEXTE_FORMATION.obligation}</Puce>
            <Puce>{TEXTE_FORMATION.precision}</Puce>
            <Source>{TEXTE_FORMATION.source}</Source>
          </Carte>
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="archive" titre="À ranger derrière cette page" fond={TEINTE} marge={0}>
            <Paragraphe>Les attestations de formation, et pour les nouveaux arrivants la date à laquelle les règles d’hygiène leur ont été expliquées.</Paragraphe>
          </Carte>
        </View>
      </View>
      <Tableau
        colonnes={[
          { titre: 'Nom et prénom', flex: 1.2, gras: true },
          { titre: 'Poste', flex: 0.9 },
          { titre: 'Formation suivie', flex: 1.4 },
          { titre: 'Organisme', flex: 1 },
          { titre: 'Date', largeur: 62, centre: true },
          { titre: 'Durée', largeur: 46, centre: true },
          { titre: 'Attestation rangée', largeur: 76, centre: true, choix: ['Oui', 'Non'] },
        ]}
        lignes={[
          ...(e?.formations || []).slice(0, 12).map((f) => [f.nom, f.poste || null, f.intitule, f.organisme, f.date, f.duree, null]),
          ...vides(Math.max(0, 12 - (e?.formations || []).length), 7),
        ]}
        hauteur={22}
        entete={22}
      />
    </Feuille>
  )
}

const EQUIPEMENTS = ['Chambres froides et vitrines', 'Hachoir et poussoir', 'Scie à os', 'Trancheuse, cutter, mélangeur', 'Machine sous vide', 'Balances (vérification périodique)', 'Thermomètres de contrôle']

function PageLocaux() {
  return (
    <Feuille icone="cle" surTitre="Locaux et matériel · à compléter" titre="Entretien, eau et sous-produits" sousTitre="Qui entretient quoi, d’où vient votre eau, et comment sortent les os et déchets de découpe." pied={PIED}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1.8, marginRight: 10 }}>
          <Tableau
            colonnes={[
              { titre: 'Équipement', flex: 1.3, gras: true },
              { titre: 'Entretien à faire', flex: 1.2 },
              { titre: 'Fréquence', largeur: 62 },
              { titre: 'Fait par', flex: 0.8 },
              { titre: 'Dernier passage', largeur: 58, centre: true },
              { titre: 'Prochain', largeur: 54, centre: true },
            ]}
            lignes={[...EQUIPEMENTS.map((x) => [x, null, null, null, null, null]), ...vides(6, 6)]}
            hauteur={25}
            entete={24}
          />
          <Bandeau>Gardez derrière cette page les notices, les contrats d’entretien et les bons d’intervention : frigoriste, affûteur, vérification des balances et des extincteurs.</Bandeau>
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="verre" titre="L’eau">
            <ChampLigne libelle="Origine (réseau public, autre)" />
            <ChampLigne libelle="Eau chaude au lave-mains et au stérilisateur" marge={8} />
            <Puce>Seule de l’eau potable sert au nettoyage du matériel et aux préparations.</Puce>
          </Carte>
          <Carte icone="os" titre="Os, graisses et déchets de découpe" marge={0}>
            <ChampLigne libelle="Collecteur des sous-produits animaux" />
            <ChampLigne libelle="Fréquence d’enlèvement" marge={8} />
            <Puce>Os, graisses et parures sont des sous-produits animaux : stockés à part, dans des conteneurs fermés et étiquetés, puis remis à un collecteur qui laisse un document à chaque enlèvement.</Puce>
            <Puce>Ils ne vont ni à la poubelle ordinaire ni à l’égout.</Puce>
            <Source>Règlement (CE) n° 1069/2009, articles 8 à 10, 21 et 22. Détail en partie 11.</Source>
          </Carte>
        </View>
      </View>
    </Feuille>
  )
}

/** Zones du plan de nettoyage d'une boucherie. */
export const ZONES_NETTOYAGE_BOUCHERIE: [string, string][] = [
  ['Billots et planches de découpe', 'Après chaque utilisation, raclage chaque jour'],
  ['Couteaux, fusils, gants de maille', 'Après chaque utilisation'],
  ['Hachoir (vis, grille, couteau) et poussoir', 'Après chaque utilisation, démonté'],
  ['Scie à os', 'Chaque jour, démontée'],
  ['Trancheuse, cutter, mélangeur', 'Après chaque utilisation'],
  ['Plans de travail du laboratoire', 'Après chaque usage, chaque jour'],
  ['Crochets, rails, bacs et plats', 'Chaque jour'],
  ['Vitrine réfrigérée', 'Chaque jour'],
  ['Chambres froides', 'Chaque semaine'],
  ['Balances et caisse', 'Chaque jour'],
  ['Lave-mains et stérilisateur à couteaux', 'Chaque jour'],
  ['Sols du laboratoire et de la boutique', 'Chaque jour'],
  ['Murs et portes du laboratoire', 'Chaque semaine'],
  ['Conteneurs à sous-produits et local à déchets', 'Après chaque enlèvement'],
  ['Sanitaires et vestiaires', 'Chaque jour'],
]

// ─────────────────────────────────────────────────────────── Réception et températures

function PagesReception({ pied = PIED }: P) {
  return (
    <>
      <Feuille icone="camion" surTitre="Réception des viandes · ce qu’il faut savoir" titre="Contrôler chaque livraison" sousTitre="Le contrôle se fait au déchargement, avant de signer le bon : ce qui est accepté devient votre responsabilité." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="steak" titre="Carcasses, quartiers et pièces" marge={8}>
              <Puce>La marque de salubrité ovale de l’abattoir figure sur la carcasse ou les quartiers ; la marque d’identification ovale « FR, numéro d’agrément, CE » sur les pièces et les colis.</Puce>
              <Puce>L’étiquette de la viande bovine donne le code de référence et les pays de naissance, d’élevage, d’abattage et de découpe. Une bande rouge signale une carcasse dont la colonne vertébrale doit être retirée (partie 11).</Puce>
              <Puce>La viande est ferme, d’odeur normale, sans souillure, sans trace de sang ni de moisissure ; le sous-vide n’est pas gonflé.</Puce>
            </Carte>
            <Carte icone="camion" titre="Le camion et le livreur" marge={0}>
              <Puce>Carcasses suspendues, sans contact avec le sol ; cartons et viandes nues séparés.</Puce>
              <Puce>Livreur en tenue propre ; caisse du camion propre et froide.</Puce>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="thermometre" titre="Mesurer la température" marge={8}>
              <Etape n={1}>Sonde désinfectée, piquée à cœur dans une pièce, ou entre deux sachets pour les produits conditionnés.</Etape>
              <Etape n={2}>Comparez à la limite du produit (partie 8) : au-delà, le produit est refusé.</Etape>
              <Etape n={3}>Notez la valeur lue sur la fiche, même quand tout est conforme.</Etape>
            </Carte>
            <Carte icone="croix" titre="Refuser ce qui n’est pas conforme" marge={0}>
              <Paragraphe>Viande trop chaude, sans estampille ni document, emballage abîmé, date dépassée, odeur anormale : refusez-la, notez le motif sur le bon de livraison et prévenez le fournisseur.</Paragraphe>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="horloge" titre="Ranger sans attendre" marge={8}>
              <Puce>Les viandes passent directement en chambre froide ; les surgelés d’abord.</Puce>
              <Puce>Carcasses et quartiers suspendus aux rails, sans contact entre eux ni avec les murs.</Puce>
              <Puce>Viandes nues séparées des cartons et des produits prêts à consommer.</Puce>
            </Carte>
            <Carte icone="archive" titre="À conserver" fond={TEINTE} marge={8}>
              <Paragraphe>Les bons de livraison, les documents d’accompagnement et les étiquettes des lots : ils servent à la traçabilité (partie 12).</Paragraphe>
            </Carte>
            <Source>Règlement (UE) 2019/627, article 48 et annexe II (marque de salubrité). Règlement (CE) n° 853/2004, annexe II, section I (marque d’identification). Règlement (CE) n° 1760/2000, article 13. Arrêté du 21 décembre 2009, annexe I.</Source>
          </View>
        </View>
      </Feuille>

      <Feuille icone="camion" surTitre="Réception des viandes · à chaque livraison" titre="Fiche de contrôle à réception" sousTitre="Une ligne par produit livré. Le contrôle se fait avant de signer le bon de livraison." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={[
            { titre: 'Date', largeur: 46 },
            { titre: 'Fournisseur', flex: 1 },
            { titre: 'Produit (espèce, morceau)', flex: 1.2 },
            { titre: 'N° de lot ou d’abattage', flex: 1 },
            { titre: 'Estampille ou marque', largeur: 60, centre: true, choix: ['Oui', 'Non'] },
            { titre: 'Température relevée', largeur: 56, centre: true },
            { titre: 'Aspect, odeur, emballage', largeur: 66, centre: true, choix: ['OK', 'Non'] },
            { titre: 'Accepté', largeur: 56, centre: true, choix: ['Oui', 'Non'] },
            { titre: 'Si refusé : motif et suite', flex: 1.1 },
            { titre: 'Visa', largeur: 40, centre: true },
          ]}
          lignes={vides(15, 10)}
          hauteur={22.4}
          entete={26}
        />
      </Feuille>
    </>
  )
}

function PagesTemperatures({ pied = PIED }: P) {
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
      <Feuille icone="thermometreFroid" surTitre="Températures · repères" titre="Les températures à respecter" sousTitre="Chaque viande a sa limite : une enceinte se règle sur le produit le plus fragile qu’elle contient." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          {TEMPERATURES_BOUCHERIE.map((r, i) => (
            <Repere key={r.valeur} valeur={r.valeur} sens={r.sens} texte={r.denrees} ton={r.ton} icone={r.icone} dernier={i === TEMPERATURES_BOUCHERIE.length - 1} hauteur={92} />
          ))}
        </View>
        <Source>Arrêté du 21 décembre 2009, annexe I (températures maximales en tout point du produit, en remise directe : stockage et vitrine). Produits à base de viande stables tranchés : +8 °C. Produits conditionnés : la température indiquée par le conditionneur s’applique.</Source>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <View style={{ width: 230, marginRight: 10, borderRadius: 10, overflow: 'hidden', height: 198 }}>
            <Image src={imagePms('chambre-froide.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="crayon" titre="Comment relever" marge={0}>
              <Etape n={1}>Relevez à heure fixe, à l’ouverture et à la fermeture, chaque chambre froide, vitrine et congélateur.</Etape>
              <Etape n={2}>Notez la température lue, jamais une valeur attendue.</Etape>
              <Etape n={3}>Contrôlez une fois par mois l’afficheur avec un thermomètre sonde vérifié.</Etape>
              <Etape n={4}>En vitrine, la viande hachée et les préparations restent dans la partie la plus froide.</Etape>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="alerte" titre="En cas d’écart" marge={0}>
              <Etape n={1}>Mesurez la température à cœur d’un produit avec la sonde.</Etape>
              <Etape n={2}>Produit encore sous sa limite : réglez l’enceinte, contrôlez à nouveau une heure plus tard.</Etape>
              <Etape n={3}>Produit au-dessus de sa limite : il est retiré de la vente, le responsable décide de son sort.</Etape>
              <Etape n={4}>Notez ce qui a été constaté et fait, puis signez.</Etape>
            </Carte>
          </View>
        </View>
      </Feuille>

      <Feuille icone="thermometre" surTitre="Températures · une feuille par mois" titre="Relevé des températures" sousTitre="Chambres froides, vitrines et congélateurs, à l’ouverture et à la fermeture." pied={pied}>
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
                  <Text style={{ fontSize: 5.6, fontWeight: 700, color: GRIS, letterSpacing: 0.7 }}>ENCEINTE {n}</Text>
                  <View style={{ height: 10, borderBottomWidth: 0.7, borderBottomColor: '#9AA6B2' }} />
                  <Text style={{ fontSize: 6.2, color: GRIS, marginTop: 3 }}>Limite : ............ °C</Text>
                </View>
              ),
            })),
            {
              colonnes: 1,
              contenu: (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 6.8, lineHeight: 1.4, color: GRIS_FONCE }}>
                    Nommez chaque enceinte : chambre froide carcasses, chambre froide découpe, vitrine, congélateur. Sa limite est celle du produit le plus fragile qu’elle contient (repères à la page précédente).
                  </Text>
                </View>
              ),
            },
            { colonnes: 1 },
          ]}
        />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Viande hachée

function PagesHachage({ pied = PIED }: P) {
  return (
    <>
      <Feuille icone="steak" surTitre="Viande hachée · les règles" titre="Hacher à la demande, ou à l’avance" sousTitre="La viande hachée est le produit le plus fragile de la boutique : ses règles sont les plus strictes." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="liste" titre="Ce qui peut être haché" marge={8}>
              <Paragraphe>Seulement du muscle squelettique et le gras qui y est attenant.</Paragraphe>
              <View style={{ marginTop: 5 }}>
                <Text style={{ fontSize: 8.4, fontWeight: 700, color: ENCRE, marginBottom: 3 }}>Jamais :</Text>
                <Puce>chutes de parage (sauf chutes de muscles entiers), viandes séparées mécaniquement ;</Puce>
                <Puce>viandes avec os ou peau, viandes de tête (sauf masséters) ;</Puce>
                <Puce>linea alba, carpe et tarse, raclage d’os, diaphragme non débarrassé de ses séreuses.</Puce>
              </View>
              <Source>Arrêté du 21 décembre 2009, annexe VII. Règlement (CE) n° 853/2004, annexe III, section V, chapitre II.</Source>
            </Carte>
            <Carte icone="info" titre="Au client" fond={TEINTE} marge={0}>
              <Paragraphe>Conseillez une cuisson à cœur du steak haché, en particulier pour les jeunes enfants et les personnes âgées.</Paragraphe>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="oeil" titre="À la demande : la règle" marge={0}>
              <Etape n={1}>La viande est hachée à la demande et à la vue du client, au moment de la vente.</Etape>
              <Etape n={2}>Le hachoir est propre, démonté et nettoyé après usage ; la viande reste au froid jusqu’au hachage.</Etape>
              <Etape n={3}>La viande hachée est remise aussitôt au client : elle ne se garde pas en vitrine.</Etape>
              <View style={{ marginTop: 4 }}>
                <Paragraphe>Bonne pratique du guide de la boucherie : une viande épluchée depuis un jour au plus, sans chutes ni jus, sans contact direct avec les mains.</Paragraphe>
              </View>
              <Source>Arrêté du 21 décembre 2009, annexe VII, point 2.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1.15 }}>
            <Carte icone="horloge" titre="À l’avance : une dérogation" marge={0}>
              <Paragraphe>Hacher à l’avance n’est permis qu’à cinq conditions, toutes réunies :</Paragraphe>
              <View style={{ marginTop: 4 }}>
                <Etape n={1}>Une déclaration faite à la DDPP.</Etape>
                <Etape n={2}>Des viandes à +7 °C au plus (abats +3 °C, volailles +4 °C), hachées dans les 6 jours suivant l’abattage (3 jours pour la volaille, 15 jours pour le bœuf désossé sous vide), conditionnées aussitôt et refroidies à +2 °C à cœur ou congelées à −18 °C, jamais recongelées.</Etape>
                <Etape n={3}>Une analyse microbiologique au moins chaque semaine.</Etape>
                <Etape n={4}>Jamais à partir de carcasses transportées avant d’avoir atteint leur température.</Etape>
                <Etape n={5}>Une conservation à +2 °C au plus, avec une date limite que vous fixez et justifiez.</Etape>
              </View>
              <Source>Règlement (CE) n° 853/2004, annexe III, section V. Règlement (CE) n° 2073/2005, annexe I. Instruction technique DGAL/SDSSA/2023-756. Vendre de la viande hachée à d’autres professionnels exige un agrément.</Source>
            </Carte>
          </View>
        </View>
      </Feuille>

      <Feuille icone="steak" surTitre="Viande hachée · à chaque hachage à l’avance" titre="Fiche de hachage à l’avance" sousTitre="Une ligne par lot haché à l’avance. Le hachage à la demande, devant le client, n’a pas besoin de fiche." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Déclaration à la DDPP du' }, { libelle: 'Mois' }]} />
        <Tableau
          colonnes={[
            { titre: 'Date et heure', largeur: 56 },
            { titre: 'Espèce et morceau', flex: 1.1 },
            { titre: 'Lot ou n° d’abattage', flex: 1 },
            { titre: 'Date d’abattage', largeur: 56, centre: true },
            { titre: 'T° viande avant hachage', largeur: 62, centre: true },
            { titre: 'Quantité', largeur: 50, centre: true },
            { titre: 'T° à cœur après refroidissement', largeur: 70, centre: true },
            { titre: 'Date limite fixée', largeur: 58, centre: true },
            { titre: 'Analyse de la semaine', largeur: 66, centre: true, choix: ['Faite', 'Non'] },
            { titre: 'Visa', largeur: 40, centre: true },
          ]}
          lignes={vides(15, 10)}
          hauteur={22.4}
          entete={30}
        />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Préparations et charcuterie

function PagesPreparations({ pied = PIED }: P) {
  return (
    <>
      <Feuille icone="saucisse" surTitre="Préparations et charcuterie · les règles" titre="Saucisses, farces, charcuterie et traiteur" sousTitre="Ce que vous fabriquez a une recette écrite, un lot, une durée de vie et une étiquette." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="saucisse" titre="Préparations de viandes" marge={8}>
              <Puce>Saucisses, merguez, farces, brochettes, viandes marinées : une recette écrite (ingrédients, additifs, allergènes) pour chacune.</Puce>
              <Puce>Chaque fabrication porte un numéro de lot qui renvoie aux viandes utilisées.</Puce>
              <Puce>Conservation à +4 °C au plus ; durée de vie fixée par écrit (repère du guide de la charcuterie : chair à saucisse, 5 jours en vrac).</Puce>
            </Carte>
            <Carte icone="alerte" titre="Les additifs" marge={0}>
              <Puce>Pas de nitrites dans les préparations de viandes fraîches, sauf rares exceptions listées.</Puce>
              <Puce>Pas de sulfites, sauf dans les « breakfast sausages » et la « burger meat » à 4 % de végétaux au moins.</Puce>
              <Puce>Merguez : seuls certains colorants sont permis (E100, E120, E150a à d, E160c, E162).</Puce>
              <Source>Règlement (CE) n° 1333/2008, annexe II, catégorie 08.2.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="flamme" titre="Charcuterie cuite et traiteur" marge={8}>
              <Etape n={1}>Cuisson à cœur selon la recette, contrôlée à la sonde : au moins +63 °C, sauf barème de cuisson basse température validé.</Etape>
              <Etape n={2}>Refroidissement rapide, de +63 °C à +10 °C en 2 heures au plus, en petites quantités ou en cellule.</Etape>
              <Etape n={3}>Conservation à +3 °C pour les plats traiteur, +4 °C pour la charcuterie cuite.</Etape>
              <Source>Guide de bonnes pratiques d’hygiène de la charcuterie artisanale (2016). Le refroidissement en 2 heures est une obligation de la restauration collective (arrêté du 21 décembre 2009, annexe IV) et un repère pour la boucherie.</Source>
            </Carte>
            <Carte icone="horloge" titre="Durées de vie" fond={TEINTE} marge={0}>
              <Paragraphe>Vous les fixez et les justifiez. Repères du guide de la charcuterie artisanale : jambon cuit 15 jours, produit tranché 1 jour.</Paragraphe>
            </Carte>
          </View>
          <View style={{ flex: 0.95 }}>
            <Carte icone="etiquette" titre="L’étiquetage" marge={8}>
              <Puce>Vendu sans emballage : la dénomination et les allergènes sur le produit ou à côté.</Puce>
              <Puce>Préemballé à l’avance : étiquetage complet (dénomination, ingrédients, allergènes, quantité, date, conservation, lot).</Puce>
              <Source>Règlement (UE) n° 1169/2011. Code de la consommation, article R412-13.</Source>
            </Carte>
            <Carte icone="loupe" titre="Les analyses" marge={0}>
              <Paragraphe>Des analyses microbiologiques vérifient votre maîtrise. Repère du guide de la charcuterie artisanale pour les préparations : une par mois sous 250 kg par semaine, une par semaine au-delà.</Paragraphe>
              <Source>Règlement (CE) n° 2073/2005, annexe I.</Source>
            </Carte>
          </View>
        </View>
      </Feuille>

      <Feuille icone="saucisse" surTitre="Préparations et charcuterie · à chaque fabrication" titre="Fiche de fabrication, de cuisson et de refroidissement" sousTitre="Une ligne par fabrication. Les colonnes de cuisson et de refroidissement concernent les produits cuits." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={[
            { titre: 'Date', largeur: 44 },
            { titre: 'Produit fabriqué', flex: 1.1 },
            { titre: 'N° de lot', largeur: 58 },
            { titre: 'Viandes utilisées (lots)', flex: 1.2 },
            { titre: 'Quantité', largeur: 48, centre: true },
            { titre: 'T° à cœur en fin de cuisson', largeur: 62, centre: true },
            { titre: 'Début refroid. heure et T°', largeur: 62, centre: true },
            { titre: 'Fin refroid. heure et T°', largeur: 62, centre: true },
            { titre: 'Date limite fixée', largeur: 54, centre: true },
            { titre: 'Visa', largeur: 38, centre: true },
          ]}
          lignes={vides(15, 10)}
          hauteur={22.4}
          entete={30}
        />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Sous-produits et matériels à risque

function PagesSousProduits({ pied = PIED }: P) {
  const categories: { cat: string; quoi: string; mention: string; ton: 'pin' | 'ambre' | 'rouge' }[] = [
    { cat: 'Catégorie 3', quoi: 'Os, graisses, suifs, parures, invendus retirés sans risque sanitaire, colonnes vertébrales des bovins français', mention: '« Non destiné à la consommation humaine »', ton: 'pin' },
    { cat: 'Catégorie 2', quoi: 'Produits devenus impropres : corps étranger, produit retiré pour un risque sanitaire', mention: 'Conteneur séparé, remis au collecteur', ton: 'ambre' },
    { cat: 'Catégorie 1', quoi: 'Matériels à risque spécifiés éventuels, et tout ce qui y a été mélangé', mention: '« Exclusivement pour élimination »', ton: 'rouge' },
  ]
  return (
    <>
      <Feuille icone="os" surTitre="Sous-produits et matériels à risque · les règles" titre="Os, déchets de découpe et colonne vertébrale" sousTitre="Ce qui ne se vend pas suit sa propre filière, documents à l’appui." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          {categories.map((c, i) => (
            <Repere key={c.cat} valeur={c.cat} sens="Sous-produits animaux" texte={`${c.quoi}. Étiquette : ${c.mention}.`} ton={c.ton} icone="os" dernier={i === categories.length - 1} hauteur={88} />
          ))}
        </View>
        <Source>Règlement (CE) n° 1069/2009, articles 8 à 10, 21 et 22. Règlement (UE) n° 142/2011, annexe VIII.</Source>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="poubelle" titre="Au quotidien" marge={0}>
              <Puce>Conteneurs fermés, étiquetés, réservés à chaque catégorie, stockés à l’écart des viandes, au froid si possible.</Puce>
              <Puce>Enlèvement sans retard par un collecteur, avec un document commercial à chaque passage : conservé 2 ans.</Puce>
              <Puce>Jamais à la poubelle ordinaire, jamais à l’égout.</Puce>
            </Carte>
          </View>
          <View style={{ flex: 1.3, marginRight: 10 }}>
            <Carte icone="bouclier" titre="La colonne vertébrale depuis 2022" marge={0}>
              <Paragraphe>La France est reconnue à risque d’ESB négligeable depuis août 2022. Pour les bovins nés, élevés et abattus en France, la colonne vertébrale n’est plus un matériel à risque : c’est un os de catégorie 3. Le crâne et la moelle épinière sont retirés à l’abattoir.</Paragraphe>
              <Source>Décision d’exécution (UE) 2022/1377. Règlement (CE) n° 999/2001, annexe V.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1.3 }}>
            <Carte icone="alerte" titre="Carcasse à bande rouge" marge={0}>
              <Paragraphe>Une bande rouge sur l’étiquette signale un bovin de plus de 30 mois venu d’un pays à risque : sa colonne doit être retirée. En boucherie, c’est permis seulement avec une autorisation du préfet (DDPP) : outils dédiés, bac étanche marqué « MRS » ou « Catégorie 1 », os colorés, outils désinfectés après chaque désossage, enlèvement par une entreprise agréée.</Paragraphe>
              <Source>Arrêté du 21 décembre 2009, annexe V. Documents conservés 3 ans ; ceux qui indiquent les carcasses à bande rouge, 1 an.</Source>
            </Carte>
          </View>
        </View>
      </Feuille>

      <Feuille icone="os" surTitre="Sous-produits · à chaque enlèvement" titre="Registre des enlèvements de sous-produits" sousTitre="Une ligne par enlèvement. Agrafez le document commercial du collecteur derrière la feuille." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Collecteur' }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={[
            { titre: 'Date', largeur: 54 },
            { titre: 'Catégorie', largeur: 120, centre: true, choix: ['C1', 'C2', 'C3'] },
            { titre: 'Nature (os, graisses, parures…)', flex: 1.3 },
            { titre: 'Poids ou volume', largeur: 68, centre: true },
            { titre: 'N° du document commercial', flex: 1 },
            { titre: 'Remarque', flex: 1 },
            { titre: 'Visa', largeur: 44, centre: true },
          ]}
          lignes={vides(11, 7)}
          hauteur={22}
          entete={22}
        />
        <TitreSection icone="alerte" titre="Carcasses à bande rouge" note="Seulement si vous recevez de telles carcasses et disposez de l’autorisation de les dévertébrer." />
        <Tableau
          colonnes={[
            { titre: 'Date de réception', largeur: 70 },
            { titre: 'Fournisseur', flex: 1 },
            { titre: 'N° de la carcasse ou du quartier', flex: 1.2 },
            { titre: 'Colonne retirée le', largeur: 76, centre: true },
            { titre: 'Poids des matériels à risque', largeur: 86, centre: true },
            { titre: 'Visa', largeur: 44, centre: true },
          ]}
          lignes={vides(3, 6)}
          hauteur={20}
          entete={20}
        />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Traçabilité et origine

function PagesOrigine({ pied = PIED }: P) {
  return (
    <>
      <Feuille icone="etiquette" surTitre="Traçabilité et origine · les règles" titre="D’où vient chaque viande, et ce qu’en sait le client" sousTitre="Ce que vous devez pouvoir retrouver, et ce que la vitrine doit afficher." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1.15, marginRight: 10 }}>
            <Carte icone="steak" titre="Viande bovine : obligatoire" marge={8}>
              <Puce>Le code de référence qui relie la viande à l’animal ou au lot.</Puce>
              <Puce>Les pays de naissance, d’élevage et d’abattage, et le pays de découpe ; « Origine : France » quand l’animal est né, élevé et abattu en France.</Puce>
              <Puce>En vitrine, ces pays sont affichés de façon visible, et les viandes d’origines différentes sont séparées.</Puce>
              <Puce>Les numéros d’agrément de l’abattoir et de l’atelier de découpe sont notés chaque jour et donnés au client qui les demande.</Puce>
              <Source>Règlement (CE) n° 1760/2000, article 13. Règlement (CE) n° 1825/2000, article 5 quater.</Source>
            </Carte>
            <Carte icone="steak" titre="Haché de bœuf" marge={0}>
              <Paragraphe>« Élaboré en » (pays), pays d’abattage, et « Origine » si elle diffère du pays d’élaboration.</Paragraphe>
              <Source>Règlement (CE) n° 1760/2000, article 14.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="etiquette" titre="Veau et jeune bovin" marge={8}>
              <Puce>« Veau » : animal de moins de 8 mois ; « jeune bovin » : de 8 mois à moins de 12 mois.</Puce>
              <Puce>L’âge à l’abattage est indiqué : « moins de 8 mois » ou « de 8 mois à moins de 12 mois ».</Puce>
              <Source>Règlement (UE) n° 1308/2013, annexe VII, partie I.</Source>
            </Carte>
            <Carte icone="volaille" titre="Porc, agneau, chevreau, volaille" marge={0}>
              <Puce>Préemballés : « Élevé en », « Abattu en » et le code du lot.</Puce>
              <Puce>Vendus sans emballage : aucune obligation européenne, mais l’affichage est recommandé et certaines DDPP le demandent.</Puce>
              <Source>Règlement d’exécution (UE) n° 1337/2013.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="balance" titre="Dénominations et prix" marge={8}>
              <Puce>Un tableau des prix au kilo de tous les morceaux vendus, exposé en permanence, dans l’ordre et sous les dénominations officielles, en caractères d’au moins 1,5 cm.</Puce>
              <Puce>Un écriteau à l’étal ; le poids et le prix total sur l’emballage ou le ticket.</Puce>
              <Source>Arrêté du 18 mars 1993 (annexes I à V).</Source>
            </Carte>
            <Carte icone="archive" titre="À conserver" fond={TEINTE} marge={0}>
              <Paragraphe>Factures, bons de livraison, étiquettes et documents d’accompagnement, et cette fiche : au moins 6 mois pour les viandes fraîches, selon les orientations européennes sur la traçabilité.</Paragraphe>
              <Source>Règlement (CE) n° 178/2002, article 18. Règlement d’exécution (UE) n° 931/2011.</Source>
            </Carte>
          </View>
        </View>
      </Feuille>

      <Feuille icone="etiquette" surTitre="Traçabilité et origine · à chaque lot mis en vente" titre="Fiche de suivi des lots en vente" sousTitre="Une ligne par lot ou par carcasse : elle relie l’étiquette du fournisseur à ce qu’affiche la vitrine." pied={pied}>
        <Champs champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mois' }, { libelle: 'Année' }]} />
        <Tableau
          colonnes={[
            { titre: 'Date d’entrée', largeur: 50 },
            { titre: 'Espèce, morceau', flex: 1 },
            { titre: 'Fournisseur', flex: 0.9 },
            { titre: 'Code de référence ou lot', flex: 1 },
            { titre: 'Né en', largeur: 50, centre: true },
            { titre: 'Élevé en', largeur: 50, centre: true },
            { titre: 'Abattu en (n° agrément)', largeur: 72, centre: true },
            { titre: 'Découpé en (n° agrément)', largeur: 72, centre: true },
            { titre: 'Fin de vente le', largeur: 54, centre: true },
            { titre: 'Visa', largeur: 38, centre: true },
          ]}
          lignes={vides(15, 10)}
          hauteur={22.4}
          entete={30}
        />
      </Feuille>
    </>
  )
}

// ─────────────────────────────────────────────────────────── Allergènes

const CACHES_BOUCHERIE: [string, string][] = [
  ['Mélanges d’épices et assaisonnements', 'céleri, moutarde, parfois gluten ou soja'],
  ['Chapelure, panure, liants des farces', 'gluten, œuf, lait'],
  ['Croûte des pâtés et pâtés en croûte', 'gluten, œuf, lait'],
  ['Marinades et sauces des brochettes', 'moutarde, soja, sésame, sulfites'],
  ['Plats cuisinés et sauces traiteur', 'lait, céleri, gluten, œuf'],
  ['Boyaux, crépine, gélatine achetés', 'selon la fiche du fournisseur'],
]

function PageAllergenes({ pied = PIED }: P) {
  const colonnes: Colonne[] = [
    { titre: 'Préparation, charcuterie, plat traiteur', flex: 1, gras: true },
    ...ALLERGENES.map((a) => ({ titre: a.court, largeur: 37, icone: a.icone, coche: true })),
  ]
  return (
    <Feuille icone="ble" surTitre="Allergènes · à remplir et à tenir à la disposition des clients" titre="Allergènes de vos préparations" sousTitre="Une ligne par produit fabriqué chez vous. Cochez chaque allergène qui entre dans sa recette." pied={pied}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 2.25, marginRight: 10 }}>
          <Champs marge={6} champs={[{ libelle: 'Établissement', flex: 2 }, { libelle: 'Mis à jour le' }, { libelle: 'Par' }]} />
          <Tableau colonnes={colonnes} lignes={vides(18, colonnes.length)} hauteur={19.4} entete={44} />
        </View>
        <View style={{ flex: 1 }}>
          <Carte icone="balance" titre="Ce que dit la règle" marge={8}>
            <Puce>Quatorze allergènes doivent être signalés dès qu’ils entrent dans une préparation.</Puce>
            <Puce>Pour les produits vendus sans emballage, l’information est donnée par écrit, sur le produit ou à proximité, de façon lisible : le client la consulte sans avoir à la demander.</Puce>
            <Puce>Les produits conditionnés à l’avance chez vous portent leurs allergènes sur l’étiquette.</Puce>
            <Source>Règlement (UE) n° 1169/2011, annexe II. Code de la consommation, articles R412-12 à R412-16.</Source>
          </Carte>
          <Carte icone="loupe" titre="Où ils se cachent en boucherie" marge={0}>
            {CACHES_BOUCHERIE.map(([ou, quoi]) => (
              <View key={ou} style={{ borderTopWidth: 0.5, borderTopColor: '#E1E6EB', paddingVertical: 3.5 }}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: ENCRE }}>{ins(ou)}</Text>
                <Text style={{ fontSize: 7.6, color: GRIS_FONCE }}>{ins(quoi)}</Text>
              </View>
            ))}
          </Carte>
        </View>
      </View>
    </Feuille>
  )
}

// ─────────────────────────────────────────────────────────── Non-conformités et alertes

function PagesNonConformites({ pied = PIED }: P) {
  return (
    <>
      <Feuille icone="megaphone" surTitre="Alertes · à connaître avant d’en avoir besoin" titre="En cas de problème : qui fait quoi" sousTitre="Un rappel de produit, une anomalie au laboratoire, des clients malades : trois situations, trois marches à suivre." pied={pied}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="megaphone" titre="Un fournisseur rappelle un lot" marge={0}>
              <Etape n={1}>Retrouvez le lot dans les chambres froides, la vitrine et les préparations qui en contiennent ; isolez-le et marquez-le « Ne pas vendre ».</Etape>
              <Etape n={2}>Vérifiez s’il a déjà été vendu, et sous quelle forme : viande découpée, hachée, préparation.</Etape>
              <Etape n={3}>Suivez la consigne du fournisseur : retour ou destruction ; affichez le rappel en boutique s’il le demande.</Etape>
              <Etape n={4}>Notez ce qui a été fait sur la fiche de non-conformité.</Etape>
              <Source>Les rappels de produits sont publiés sur rappel.conso.gouv.fr.</Source>
            </Carte>
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Carte icone="alerte" titre="Vous constatez une anomalie" marge={0}>
              <View style={{ marginBottom: 6 }}><Paragraphe>Panne de froid, viande à l’odeur anormale, corps étranger (esquille d’os, éclat de lame), date dépassée, erreur d’étiquetage ou d’allergène.</Paragraphe></View>
              <Etape n={1}>Écartez le produit : dans le doute, il ne se vend pas.</Etape>
              <Etape n={2}>Cherchez la cause : matériel, livraison, geste.</Etape>
              <Etape n={3}>Si un produit à risque a déjà été vendu, prévenez la DDPP et organisez son rappel.</Etape>
              <Etape n={4}>Notez-le : une anomalie traitée et notée montre que votre plan fonctionne.</Etape>
            </Carte>
          </View>
          <View style={{ flex: 1 }}>
            <Carte icone="secours" titre="Des clients se disent malades" marge={0}>
              <View style={{ marginBottom: 6 }}><Paragraphe>Deux personnes malades ou plus après avoir consommé un même produit : c’est une toxi-infection alimentaire collective.</Paragraphe></View>
              <Etape n={1}>Notez qui, quand, et ce qui a été acheté.</Etape>
              <Etape n={2}>Mettez de côté, au froid, ce qui reste du lot et ses étiquettes.</Etape>
              <Etape n={3}>Prévenez sans attendre la DDPP de votre département.</Etape>
              <Etape n={4}>Tenez vos relevés et votre traçabilité à sa disposition.</Etape>
            </Carte>
          </View>
        </View>
        <TitreSection icone="loupe" titre="Ce qu’on vous demandera" note="Quatre questions auxquelles votre traçabilité doit répondre en quelques minutes." />
        <View style={{ flexDirection: 'row' }}>
          {([['etiquette', 'Quelle viande, quel lot ?'], ['camion', 'Reçue quand, de quel fournisseur ?'], ['calendrier', 'Vendue quel jour, sous quelle forme ?'], ['boite', 'Qu’en reste-t-il, et où ?']] as [NomIcone, string][]).map(([icone, texte], i) => (
            <View key={texte} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 9, padding: 9, marginRight: i < 3 ? 7 : 0 }}>
              <Pastille nom={icone} taille={22} fond="#FFFFFF" />
              <Text style={{ flex: 1, fontSize: 8.8, fontWeight: 700, color: ENCRE, marginLeft: 8 }}>{ins(texte)}</Text>
            </View>
          ))}
        </View>
        <TitreSection icone="telephone" titre="Vos numéros utiles" note="À remplir aujourd’hui : le jour où il faut appeler, personne ne cherche." />
        <Champs hauteur={34} marge={5} champs={[{ libelle: 'DDPP du département (téléphone, e-mail)', flex: 1.3 }, { libelle: 'Fournisseur de viande principal' }, { libelle: 'Frigoriste' }, { libelle: 'Collecteur de sous-produits' }]} />
        <Source>Règlement (CE) n° 178/2002, articles 18 et 19 : l’exploitant retire les denrées qui présentent un risque, en informe les autorités et, si le produit a pu atteindre le consommateur, l’informe et le rappelle.</Source>
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

// ─────────────────────────────────────────────────────────── Méthode HACCP

const PRINCIPES: { titre: string; texte: string; exemple: string }[] = [
  { titre: 'Lister les dangers', texte: 'Microbes, corps étrangers, produits chimiques, allergènes : ce qui peut rendre une viande dangereuse, à chaque étape.', exemple: 'Les microbes se multiplient dans une viande hachée qui se réchauffe.' },
  { titre: 'Repérer les points critiques', texte: 'Les étapes où un contrôle est indispensable pour écarter le danger.', exemple: 'Le hachage et la conservation de la viande hachée.' },
  { titre: 'Fixer une limite', texte: 'La valeur qui sépare ce qui est acceptable de ce qui ne l’est pas.', exemple: '+2 °C au plus pour la viande hachée.' },
  { titre: 'Surveiller', texte: 'Qui contrôle, comment, à quelle fréquence.', exemple: 'Relevé de la vitrine à l’ouverture et à la fermeture.' },
  { titre: 'Corriger', texte: 'Ce qui se passe quand la limite est dépassée.', exemple: 'Viande hachée au-dessus de +2 °C : retirée de la vente.' },
  { titre: 'Vérifier', texte: 'S’assurer de temps en temps que le système fonctionne vraiment.', exemple: 'Afficheur contrôlé chaque mois avec une sonde, analyses de surfaces.' },
  { titre: 'Garder la trace', texte: 'Les relevés et les actions, conservés et datés.', exemple: 'Feuilles du mois rangées dans ce classeur.' },
]

const ETAPES_HACCP_BOUCHERIE: string[][] = [
  ['Réception', 'Viande trop chaude, sans estampille ni document, souillée', 'Contrôle à chaque livraison, avant de signer', 'Températures de la partie 8, estampille et document présents', 'Fiche de contrôle à réception', 'Lot refusé, refus noté sur le bon'],
  ['Stockage en chambre froide', 'Multiplication des microbes, contamination croisée', 'Carcasses suspendues, viandes nues séparées, portes fermées', '+7 °C carcasses et pièces de gros ; +4 °C morceaux de découpe, volailles, préparations ; +3 °C abats', 'Relevé matin et soir', 'Contrôle à cœur, transfert ou retrait'],
  ['Découpe, désossage', 'Contamination par les mains, le matériel ; esquilles d’os', 'Mains lavées, matériel propre, viande hors du froid le moins longtemps possible', 'Pas de stockage de viande au poste', 'Plan de nettoyage', 'Viande parée, poste nettoyé'],
  ['Carcasse à bande rouge', 'Colonne vertébrale à risque non retirée (bovin d’un pays à risque)', 'Dévertébration autorisée par le préfet, sinon carcasse refusée', 'Toute colonne retirée tracée au registre', 'Registre de la partie 11', 'Lot isolé, DDPP prévenue'],
  ['Hachage', 'Multiplication rapide des microbes dans la masse hachée', 'À la demande devant le client ; à l’avance seulement sous dérogation déclarée', 'Viande à +7 °C au plus avant hachage, haché à +2 °C au plus', 'Fiche de hachage (hachage à l’avance)', 'Viande hachée jetée'],
  ['Préparations de viandes', 'Contamination, erreur d’allergène ou d’additif', 'Recettes écrites, ingrédients tracés', '+4 °C au plus, durée de vie fixée par écrit', 'Fiche de fabrication', 'Lot retiré, étiquetage corrigé'],
  ['Cuisson de la charcuterie', 'Survie des microbes', 'Cuisson à cœur selon la recette', 'Température à cœur fixée par la recette', 'Sonde à chaque cuisson', 'Cuisson prolongée ou produit jeté'],
  ['Refroidissement', 'Multiplication des microbes', 'Petites quantités, cellule de refroidissement', 'De +63 °C à +10 °C en moins de 2 heures (référence)', 'Fiche de refroidissement', 'Produit jeté'],
  ['Exposition et vente', 'Rupture de température, erreur d’origine ou d’allergène', 'Vitrine réglée, origine et allergènes affichés', 'Températures de la partie 8', 'Relevé de la vitrine', 'Produit retiré, affichage corrigé'],
]

function PagesHaccp({ pied = PIED }: P) {
  return (
    <>
      <Feuille icone="cible" surTitre="Méthode HACCP · l’essentiel" titre="La méthode HACCP en sept principes" sousTitre="Une façon de raisonner : où sont les dangers, comment vous les tenez. L’exemple suivi : la viande hachée." pied={pied}>
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
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10.5, color: PIN }}>Dans une boucherie artisanale</Text>
              <Text style={{ fontSize: 9.2, lineHeight: 1.45, color: GRIS_FONCE, marginTop: 8 }}>Le règlement demande une analyse adaptée à votre taille. Le guide de bonnes pratiques d’hygiène de la boucherie permet de la simplifier : le tableau de la page suivante en reprend les étapes.</Text>
            </View>
          </View>
        </View>
        <Source>Règlement (CE) n° 852/2004, article 5 : les sept principes sur lesquels reposent les procédures de tout exploitant du secteur alimentaire.</Source>
      </Feuille>

      <Feuille icone="steak" surTitre="Méthode HACCP · à adapter à vos fabrications" titre="Analyse des dangers, de la carcasse à la vitrine" sousTitre="Les étapes d’une boucherie-charcuterie, avec le danger principal de chacune. Retirez ce qui ne vous concerne pas, complétez le reste." pied={pied}>
        <Tableau
          colonnes={[
            { titre: 'Étape', largeur: 84, gras: true },
            { titre: 'Danger principal', flex: 0.95 },
            { titre: 'Comment vous le maîtrisez', flex: 1.2 },
            { titre: 'Limite ou repère', flex: 1.15 },
            { titre: 'Surveillance et trace', flex: 0.85 },
            { titre: 'Si la limite est dépassée', flex: 0.85 },
          ]}
          lignes={[...ETAPES_HACCP_BOUCHERIE, ...vides(1, 6)]}
          hauteur={37}
          entete={22}
        />
      </Feuille>
    </>
  )
}

const POINTS_REVUE = [
  'Les informations de la boucherie et le nom du référent hygiène sont à jour.',
  'Chaque personne a reçu les consignes d’hygiène de son poste, et la date est notée.',
  'Le plan de nettoyage correspond aux produits et au matériel utilisés aujourd’hui.',
  'Les relevés de température sont remplis chaque jour, avec les températures réellement lues.',
  'Le thermomètre de contrôle fonctionne et a été vérifié.',
  'Les fiches de hachage et de fabrication sont tenues et les durées de vie respectées.',
  'Les documents d’enlèvement des sous-produits (et le registre des carcasses à bande rouge, le cas échéant) sont classés.',
  'L’origine des viandes affichée en vitrine correspond aux lots en vente.',
  'Le tableau des allergènes correspond aux recettes actuelles.',
  'Le contrat et les rapports de lutte contre les nuisibles sont classés.',
  'Les anomalies de l’année ont été traitées et notées.',
  'Les fabrications, le matériel ou les fournisseurs ont changé : le classeur a été repris.',
]

function PageRevue({ pied = PIED }: P) {
  return (
    <Feuille icone="repete" surTitre="Plan de maîtrise sanitaire · une fois par an" titre="Revue annuelle" sousTitre="Un classeur qui n’est jamais relu finit par décrire une autre boucherie. Reprenez ces points chaque année." pied={pied}>
      <Tableau
        colonnes={[
          { titre: 'Point à vérifier', flex: 2.2, gras: true },
          { titre: 'En ordre', largeur: 82, centre: true, choix: ['Oui', 'Non'] },
          { titre: 'Ce qu’il faut faire', flex: 1.4 },
          { titre: 'Qui', largeur: 70 },
          { titre: 'Pour le', largeur: 58, centre: true },
        ]}
        lignes={[...POINTS_REVUE.map((x) => [x, null, null, null, null]), ...vides(2, 5)]}
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

const enDocument = (titre: string, pages: React.ReactNode) => <Document title={titre} author="Lab Learning" subject="Plan de maîtrise sanitaire boucherie-charcuterie">{pages}</Document>

/** Le classeur complet, éventuellement pré-rempli pour un établissement. */
export function PmsBoucheriePDF({ e }: { e?: EtablissementPms }) {
  return enDocument('Plan de maîtrise sanitaire boucherie-charcuterie', (
    <>
      <PageCouverture e={e} />
      <PageEtablissement e={e} />
      <PagePlan />
      <PageSommaire />
      <PageEnBref />
      <PageEquipe />
      <PageFormations e={e} />
      <PagesLavageMains pied={PIED} />
      <PageLocaux />
      <PagesNettoyage pied={PIED} zones={ZONES_NETTOYAGE_BOUCHERIE} />
      <PagesNuisibles pied={PIED} />
      <PagesReception />
      <PagesTemperatures />
      <PagesHachage />
      <PagesPreparations />
      <PagesSousProduits />
      <PagesOrigine />
      <PageAllergenes />
      <PagesNonConformites />
      <PagesHaccp />
      <PageRevue />
    </>
  ))
}
