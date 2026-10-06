import * as React from 'react'
import { Page, View, Text, Svg, Path, Circle, Rect } from '@react-pdf/renderer'
import QRCode from 'qrcode'
// L'import enregistre les polices du design system (Montserrat, Manrope)
import { BRAND_GREEN, BRAND_ULTRA_LIGHT, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'
import { LogoLabLearning } from './logo-lab-learning'
import { ICONES, type Forme, type NomIcone } from './modeles-icones'

/**
 * Briques de mise en page des modèles gratuits du site (lib/pdf/modeles-pdf) :
 * des feuilles A4 paysage à imprimer et à remplir à la main. Fonds clairs et
 * peu d'aplats, pour rester lisibles sur une imprimante de bureau.
 */

export const PIN = BRAND_GREEN
export const MENTHE = '#5CD9A0'
export const MENTHE_CLAIRE = '#DDF5E9'
export const TEINTE = BRAND_ULTRA_LIGHT
export const BORD = '#CFD8DF'
export const LIGNE = SURFACE_200
export const ENCRE = SURFACE_900
export const GRIS = SURFACE_500
export const GRIS_FONCE = SURFACE_700

const MARGE = 28

const INSECABLE = String.fromCharCode(160)
/** Espace insécable avant « : », « ; », « ? » et « ! » : la ponctuation ne passe jamais seule à la ligne. */
export const ins = (t: string) => t.replace(/ ([:;?!])/g, `${INSECABLE}$1`)
const insEnfants = (enfants: React.ReactNode): React.ReactNode => React.Children.map(enfants, (e) => (typeof e === 'string' ? ins(e) : e))

/** Mots en gras au fil d'un texte. */
export const Gras = ({ children }: { children: React.ReactNode }) => <Text style={{ fontWeight: 700, color: ENCRE }}>{insEnfants(children)}</Text>
const page = { paddingTop: 24, paddingBottom: 40, paddingHorizontal: MARGE, fontFamily: 'Manrope', fontSize: 8.5, color: ENCRE } as const

// ─────────────────────────────────────────────────────────── Pictogrammes

export function Icone({ nom, taille = 12, couleur = PIN, trait = 1.6 }: { nom: NomIcone; taille?: number; couleur?: string; trait?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      {(ICONES[nom] as Forme[]).map((f, i) => f.c
        ? <Circle key={i} cx={f.c[0]} cy={f.c[1]} r={f.c[2]} stroke={couleur} strokeWidth={trait} fill="none" />
        : f.plein
          ? <Path key={i} d={f.d as string} fill={couleur} fillRule={f.regle} />
          : <Path key={i} d={f.d as string} stroke={couleur} strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    </Svg>
  )
}

/** Un pictogramme dans sa pastille. `rond: false` donne une tuile aux coins arrondis. */
export function Pastille({ nom, taille = 18, fond = MENTHE_CLAIRE, couleur = PIN, rond = true }: { nom: NomIcone; taille?: number; fond?: string; couleur?: string; rond?: boolean }) {
  return (
    <View style={{ width: taille, height: taille, borderRadius: rond ? taille / 2 : taille * 0.27, backgroundColor: fond, alignItems: 'center', justifyContent: 'center' }}>
      <Icone nom={nom} taille={taille * 0.6} couleur={couleur} />
    </View>
  )
}

/** Code QR vectoriel : il reste net à l'impression, quelle que soit sa taille. */
export function CodeQr({ url, taille = 60 }: { url: string; taille?: number }) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const n = modules.size
  let d = ''
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.data[y * n + x]) d += `M${x} ${y}h1v1h-1z`
  return (
    <Svg width={taille} height={taille} viewBox={`-2 -2 ${n + 4} ${n + 4}`}>
      <Rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#FFFFFF" />
      <Path d={d} fill={ENCRE} />
    </Svg>
  )
}

// ─────────────────────────────────────────────────────────── Page

function Entete({ icone, surTitre, titre, sousTitre }: { icone: NomIcone; surTitre: string; titre: string; sousTitre: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 11, paddingVertical: 10, paddingLeft: 11, paddingRight: 14, marginBottom: 9 }}>
      <Pastille nom={icone} taille={38} fond={PIN} couleur="#FFFFFF" rond={false} />
      <View style={{ flex: 1, paddingLeft: 11, paddingRight: 16 }}>
        <Text style={{ fontSize: 6.2, fontWeight: 700, color: PIN, letterSpacing: 1.1, marginBottom: 2 }}>{surTitre.toUpperCase()}</Text>
        <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: ENCRE }}>{titre}</Text>
        <Text style={{ fontSize: 8.3, color: GRIS, marginTop: 2 }}>{ins(sousTitre)}</Text>
      </View>
      <LogoLabLearning hauteur={27} />
    </View>
  )
}

function Pied({ nom }: { nom: string }) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 13, left: MARGE, right: MARGE, flexDirection: 'row', alignItems: 'center', borderTopWidth: 0.6, borderTopColor: LIGNE, paddingTop: 6 }}>
      <LogoLabLearning hauteur={13} />
      <Text style={{ flex: 1, fontSize: 6.3, color: GRIS, marginLeft: 9 }}>
        {nom} · modèle offert par Lab Learning, organisme de formation certifié Qualiopi au titre des actions de formation · www.lab-learning.fr · à adapter à votre établissement
      </Text>
      <View style={{ backgroundColor: TEINTE, borderRadius: 7, paddingVertical: 2.5, paddingHorizontal: 7 }}>
        <Text style={{ fontSize: 6.5, fontWeight: 700, color: PIN }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </View>
  )
}

/** Une feuille du modèle : en-tête au logo, contenu, pied de page. */
export function Feuille({ icone, surTitre, titre, sousTitre, pied, children }: {
  icone: NomIcone; surTitre: string; titre: string; sousTitre: string; pied: string; children: React.ReactNode
}) {
  return (
    <Page size="A4" orientation="landscape" style={page}>
      <Entete icone={icone} surTitre={surTitre} titre={titre} sousTitre={sousTitre} />
      {children}
      <Pied nom={pied} />
    </Page>
  )
}

/** Une feuille sans en-tête (affichette), avec le même pied de page. */
export function FeuilleLibre({ pied, children }: { pied: string; children: React.ReactNode }) {
  return (
    <Page size="A4" orientation="landscape" style={page}>
      {children}
      <Pied nom={pied} />
    </Page>
  )
}

// ─────────────────────────────────────────────────────────── Champs à remplir

/** Cases à remplir à la main, sur une ligne : le libellé est en haut de la case. */
export function Champs({ champs, hauteur = 25, marge = 8 }: { champs: { libelle: string; flex?: number; largeur?: number }[]; hauteur?: number; marge?: number }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: marge }}>
      {champs.map((c, i) => (
        <View key={c.libelle} style={{ ...(c.largeur ? { width: c.largeur } : { flex: c.flex || 1 }), height: hauteur, borderWidth: 0.8, borderColor: BORD, borderRadius: 6, paddingHorizontal: 7, paddingTop: 3.5, marginRight: i < champs.length - 1 ? 7 : 0, backgroundColor: '#FFFFFF' }}>
          <Text style={{ fontSize: 5.6, fontWeight: 700, color: GRIS, letterSpacing: 0.7 }}>{c.libelle.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  )
}

/** Petite case à cocher. */
export const Case = ({ taille = 9 }: { taille?: number }) => (
  <View style={{ width: taille, height: taille, borderWidth: 0.8, borderColor: SURFACE_400, borderRadius: 2.2, backgroundColor: '#FFFFFF' }} />
)

// ─────────────────────────────────────────────────────────── Tableau

export type Colonne = {
  titre: string
  flex?: number
  largeur?: number
  centre?: boolean
  /** Pictogramme au-dessus du titre (en-tête haut). */
  icone?: NomIcone
  /** Une cellule vide affiche une case à cocher. */
  coche?: boolean
  /** Une cellule vide affiche ces choix, chacun avec sa case (Oui / Non). */
  choix?: string[]
  /** Texte de la colonne en gras. */
  gras?: boolean
}

/** Tableau aux coins arrondis. Une cellule vide est une case à remplir. */
export function Tableau({ colonnes, lignes, hauteur = 18, entete = 22, serre = false, groupes }: {
  colonnes: Colonne[]
  lignes: (string | null)[][]
  hauteur?: number
  entete?: number
  /** Grille à beaucoup de lignes : marges intérieures réduites */
  serre?: boolean
  /** Ligne claire au-dessus de l'en-tête, à remplir : une cellule couvre `colonnes` colonnes. */
  groupes?: { colonnes: number; contenu?: React.ReactNode }[]
}) {
  const cote = (c: { flex?: number; largeur?: number }) => (c.largeur ? { width: c.largeur } : { flex: c.flex || 1 })
  const coteGroupe = (debut: number, n: number) => {
    const cs = colonnes.slice(debut, debut + n)
    const largeur = cs.reduce((s, c) => s + (c.largeur || 0), 0)
    const flex = cs.reduce((s, c) => s + (c.largeur ? 0 : c.flex || 1), 0)
    return flex ? { flex, ...(largeur ? { flexBasis: largeur } : {}) } : { width: largeur }
  }
  let curseur = 0
  return (
    <View style={{ borderWidth: 0.8, borderColor: BORD, borderRadius: 8, overflow: 'hidden' }}>
      {groupes && (
        <View style={{ flexDirection: 'row', backgroundColor: TEINTE }}>
          {groupes.map((g, i) => {
            const style = coteGroupe(curseur, g.colonnes)
            curseur += g.colonnes
            return <View key={i} style={{ ...style, borderLeftWidth: i ? 0.6 : 0, borderLeftColor: BORD, paddingHorizontal: 5, paddingVertical: 4 }}>{g.contenu}</View>
          })}
        </View>
      )}
      <View style={{ flexDirection: 'row', backgroundColor: PIN, minHeight: entete }}>
        {colonnes.map((c, i) => (
          <View key={i} style={{ ...cote(c), justifyContent: 'center', alignItems: c.icone || c.centre ? 'center' : 'flex-start', paddingHorizontal: c.icone ? 1 : 5, paddingVertical: 3, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: '#3F6E5E' }}>
            {c.icone && <View style={{ marginBottom: 3 }}><Pastille nom={c.icone} taille={20} fond="#FFFFFF" /></View>}
            <Text style={{ fontSize: c.icone ? 6.3 : 7, fontWeight: 700, color: '#FFFFFF', textAlign: c.icone || c.centre ? 'center' : 'left', lineHeight: 1.2 }}>{c.titre}</Text>
          </View>
        ))}
      </View>
      {lignes.map((l, r) => (
        <View key={r} wrap={false} style={{ flexDirection: 'row', minHeight: hauteur, borderTopWidth: r ? 0.5 : 0, borderTopColor: LIGNE, backgroundColor: r % 2 ? '#F8FAFB' : '#FFFFFF' }}>
          {colonnes.map((c, i) => (
            <View key={i} style={{ ...cote(c), justifyContent: 'center', alignItems: c.centre || c.coche || c.choix ? 'center' : 'flex-start', paddingHorizontal: serre ? 3 : 5, paddingVertical: serre ? 0 : 2.5, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: LIGNE }}>
              {l[i]
                ? <Text style={{ fontSize: serre ? 7 : 7.5, lineHeight: serre ? 1.1 : 1.3, fontWeight: c.gras ? 700 : 400, textAlign: c.centre ? 'center' : 'left', color: c.gras ? ENCRE : GRIS_FONCE }}>{ins(l[i] as string)}</Text>
                : c.coche ? <Case />
                  : c.choix ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {c.choix.map((x, k) => (
                        <View key={x} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: k ? 6 : 0 }}>
                          <Case taille={8} />
                          <Text style={{ fontSize: 6.3, color: GRIS, marginLeft: 2.5 }}>{x}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

export const vides = (n: number, colonnes: number) => Array.from({ length: n }, () => Array.from({ length: colonnes }, () => null as string | null))

// ─────────────────────────────────────────────────────────── Cartes et listes

/** Carte d'explication : pictogramme, titre, contenu. `fond` : carte teintée, sans bordure. */
export function Carte({ icone, titre, children, fond, marge = 9 }: { icone?: NomIcone; titre?: string; children: React.ReactNode; fond?: string; marge?: number }) {
  return (
    <View wrap={false} style={{ borderRadius: 10, padding: 11, marginBottom: marge, ...(fond ? { backgroundColor: fond } : { borderWidth: 0.8, borderColor: BORD, backgroundColor: '#FFFFFF' }) }}>
      {titre && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
          {icone && <View style={{ marginRight: 7 }}><Pastille nom={icone} taille={20} fond={fond ? '#FFFFFF' : MENTHE_CLAIRE} /></View>}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: PIN }}>{ins(titre)}</Text>
        </View>
      )}
      {children}
    </View>
  )
}

/** Texte courant d'une page d'explication. */
export const texte = { fontSize: 8.9, lineHeight: 1.45, color: GRIS_FONCE } as const

export const Paragraphe = ({ children }: { children: React.ReactNode }) => <Text style={texte}>{insEnfants(children)}</Text>

export const Puce = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', marginBottom: 3.6 }}>
    <View style={{ width: 3.8, height: 3.8, borderRadius: 1.9, backgroundColor: MENTHE, marginTop: 4.2, marginRight: 7 }} />
    <Text style={{ flex: 1, ...texte }}>{insEnfants(children)}</Text>
  </View>
)

/** Étape numérotée d'une marche à suivre. */
export const Etape = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', marginBottom: 4.6 }}>
    <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: PIN, alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
      <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 7.8, color: '#FFFFFF' }}>{n}</Text>
    </View>
    <Text style={{ flex: 1, ...texte }}>{insEnfants(children)}</Text>
  </View>
)

export const Source = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: 7, lineHeight: 1.4, color: GRIS, marginTop: 4 }}>{insEnfants(children)}</Text>
)

/** Renvoi vers le guide du site, avec son code QR. */
export function CarteGuide({ titre, texte: corps, chemin, serre = false }: { titre: string; texte: string; chemin: string; serre?: boolean }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 10, padding: serre ? 8 : 10 }}>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 6, padding: 3 }}>
        <CodeQr url={`https://www.lab-learning.fr${chemin}`} taille={serre ? 46 : 60} />
      </View>
      <View style={{ flex: 1, paddingLeft: 11 }}>
        <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: PIN, marginBottom: 2 }}>{titre}</Text>
        <Text style={{ fontSize: 8.6, lineHeight: 1.42, color: GRIS_FONCE }}>{ins(corps)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Icone nom="scan" taille={9} />
          <Text style={{ fontSize: 7.4, fontWeight: 700, color: PIN, marginLeft: 4 }}>Scannez, ou lab-learning.fr/guides</Text>
        </View>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────────────────── Repères et titres

/** Couleurs des repères chiffrés : du froid au chaud. */
export const TONS = {
  bleu: { couleur: '#1E5FA8', fond: '#E6F0FA' },
  sarcelle: { couleur: '#0F7A6C', fond: '#E1F4F0' },
  pin: { couleur: PIN, fond: MENTHE_CLAIRE },
  ambre: { couleur: '#8A6A00', fond: '#FBF2D2' },
  rouge: { couleur: '#B4441B', fond: '#FCE8DE' },
} as const

/** Repère chiffré : une valeur en grand, ce qu'elle veut dire en dessous. */
export function Repere({ valeur, sens, texte: corps, ton = 'pin', icone, dernier = false, hauteur = 98 }: {
  valeur: string; sens: string; texte: string; ton?: keyof typeof TONS; icone?: NomIcone; dernier?: boolean; hauteur?: number
}) {
  const { couleur, fond } = TONS[ton]
  return (
    <View style={{ flex: 1, backgroundColor: fond, borderRadius: 11, padding: 10, marginRight: dernier ? 0 : 7, minHeight: hauteur }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 6.4, fontWeight: 700, color: couleur, letterSpacing: 0.9 }}>{sens.toUpperCase()}</Text>
        {icone && <Icone nom={icone} taille={15} couleur={couleur} />}
      </View>
      <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 22, color: couleur, marginTop: 4 }}>{valeur}</Text>
      <Text style={{ fontSize: 8, lineHeight: 1.36, color: GRIS_FONCE, marginTop: 3 }}>{ins(corps)}</Text>
    </View>
  )
}

/** Titre d'une partie de page, avec son pictogramme et une précision à droite. */
export function TitreSection({ icone, titre, note, haut = 10 }: { icone: NomIcone; titre: string; note?: string; haut?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: haut, marginBottom: 6 }}>
      <Pastille nom={icone} taille={20} />
      <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 11, color: PIN, marginLeft: 7 }}>{titre}</Text>
      {note && <Text style={{ flex: 1, fontSize: 8.2, color: GRIS, marginLeft: 8 }}>{ins(note)}</Text>}
    </View>
  )
}

export const etiquette = { fontSize: 5.6, fontWeight: 700, color: GRIS, letterSpacing: 0.7 } as const

/** Une ligne à remplir à la main, sous son libellé. */
export const ChampLigne = ({ libelle, hauteur = 13, marge = 7 }: { libelle: string; hauteur?: number; marge?: number }) => (
  <View style={{ marginBottom: marge }}>
    <Text style={etiquette}>{libelle.toUpperCase()}</Text>
    <View style={{ height: hauteur, borderBottomWidth: 0.7, borderBottomColor: SURFACE_400 }} />
  </View>
)

/** Bandeau teinté d'une ligne ou deux, avec son pictogramme. */
export function Bandeau({ icone = 'info', children, haut = 8 }: { icone?: NomIcone; children: React.ReactNode; haut?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: TEINTE, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 10, marginTop: haut }}>
      <Pastille nom={icone} taille={18} fond="#FFFFFF" />
      <Text style={{ flex: 1, fontSize: 7.8, lineHeight: 1.4, color: GRIS_FONCE, marginLeft: 8 }}>{insEnfants(children)}</Text>
    </View>
  )
}
