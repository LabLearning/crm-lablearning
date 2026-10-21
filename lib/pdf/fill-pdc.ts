import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

// Remplit le VRAI formulaire France Travail « Plan de développement de compétences »
// (PDF à plat sans champ) en superposant les valeurs aux coordonnées exactes
// relevées sur un exemplaire rempli. Page A4 595.32 × 841.92, origine bas-gauche.
// Le tableau suit le plan de la POEI NSLENS rempli à la main (septembre 2026) :
// compétences en puces, heures en gras au centre, « Le stagiaire sera capable de : »
// puis les objectifs ; chaque case centrée dans sa ligne, la police ajustée à son contenu.

const NAVY = rgb(0.106, 0.165, 0.42)
const H = 841.92
const PITCH = 11.4 // pas entre cases (chiffres)
// Les coordonnees relevees correspondent au bas de la boite englobante des
// glyphes (pdfminer) ; la vraie ligne de base est ~2pt plus haut.
const LIFT = 2.0

export interface PdcRow {
  /** JJ/MM/AAAA */
  date?: string
  /** « 35 h », « 3 h 30 » */
  heures?: string
  competences: string[]
  objectifs: string[]
  /** Objectifs précédés de « Le stagiaire sera capable de : » */
  capableDe?: boolean
}
export interface PdcData {
  employeur?: string; raison?: string; adresse?: string; cp?: string; ville?: string
  responsable?: string; telFixe?: string; telPort?: string; mail?: string
  poste?: string; debut?: string; fin?: string; hebdo?: string; total?: string; embauche?: string
  /** Vide : aucune case cochée (civilité inconnue) */
  stagiaireCiv?: string; stagiaire?: string; tuteurCiv?: string; tuteur?: string; fonction?: string
  rows?: PdcRow[]
}

// Caractères que les polices standard (WinAnsi) savent écrire, en plus du Latin-1 imprimable
const WIN_ANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
// Caractères Windows-1252 mal décodés (U+0080 à U+009F) : leur sens d'origine
const CP1252: Record<string, string> = {
  '\u0080': '€', '\u0082': '‚', '\u0084': '„', '\u0085': '…', '\u008c': 'Œ', '\u0091': '‘', '\u0092': '’',
  '\u0093': '“', '\u0094': '”', '\u0095': '•', '\u0096': '–', '\u0097': '—', '\u0099': '™', '\u009c': 'œ',
}
// Signes absents de WinAnsi : un équivalent lisible plutôt qu'une disparition
const EQUIVALENTS: Record<string, string> = {
  '≤': '<=', '≥': '>=', '≈': 'env.', '−': '-', '→': '-', '←': '-', '↔': '-', '⇒': '-', '➔': '-', '►': '-', '▶': '-',
  '‐': '-', '‑': '-', '‒': '-', 'ʼ': '’', '′': '’', '″': '"', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', '✓': 'oui', '✔': 'oui',
}
const imprimable = (c: string) => {
  const n = c.charCodeAt(0)
  return (n >= 0x20 && n < 0x7f) || (n >= 0xa0 && n <= 0xff) || WIN_ANSI.includes(c)
}
const san = (s: any) => Array.from(String(s ?? '').normalize('NFC')
  .replace(/­/g, '')
  .replace(/[\u0080-\u009f]/g, (c) => CP1252[c] || '')
  .replace(/\s/g, ' '))
  .map((c) => EQUIVALENTS[c] ?? c)
  .join('')
  .split('').filter(imprimable).join('')
const digits = (s: any) => String(s ?? '').replace(/\D/g, '')

// ── Tableau : bordures relevées sur le formulaire vierge (points depuis le haut de la page) ──
const LIGNES = [[494.5, 554.25], [554.25, 613.75], [613.75, 673.5], [673.5, 733.25], [733.25, 792.75]]
/** Trait sous les heures de chaque ligne */
const TRAIT_HEURES = [532.25, 592, 651.75, 711.5, 771]
const COMP_X = 123
const OBJ_X = 391.5
const LARGEUR = 181.5
const HEURES_CENTRE = 348
const MARGE = 3
const PUCE = '• '
const TITRE_OBJECTIFS = 'Le stagiaire sera capable de :'

interface LigneTexte { texte: string; x: number; gras: boolean }
interface Mise { lignes: LigneTexte[]; taille: number; interligne: number }

/** Coupe un texte en lignes de `largeur` au plus ; un mot trop long se coupe après « / » ou « - », sinon au caractère. */
function decouper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const largeurDe = (t: string) => font.widthOfTextAtSize(t, taille)
  const morceaux: string[] = []
  for (const mot of san(texte).split(/\s+/).filter(Boolean)) {
    if (largeurDe(mot) <= largeur) { morceaux.push(mot); continue }
    let reste = mot
    while (largeurDe(reste) > largeur) {
      let n = reste.length - 1
      while (n > 1 && largeurDe(reste.slice(0, n)) > largeur) n--
      const coupure = Math.max(reste.lastIndexOf('/', n - 1), reste.lastIndexOf('-', n - 1))
      if (coupure > n / 2) n = coupure + 1
      morceaux.push(reste.slice(0, n))
      reste = reste.slice(n)
    }
    if (reste) morceaux.push(reste)
  }
  const lignes: string[] = []
  let cur = ''
  for (const m of morceaux) {
    const essai = cur ? `${cur} ${m}` : m
    if (largeurDe(essai) > largeur && cur) { lignes.push(cur); cur = m } else cur = essai
  }
  if (cur) lignes.push(cur)
  return lignes
}

/** Lignes d'une liste à puces (retrait sous la puce) ; `uneLigne` coupe chaque puce à une ligne, avec « … ». */
function poserListe(items: string[], titre: string | null, font: PDFFont, taille: number, uneLigne: boolean): LigneTexte[] {
  const retrait = font.widthOfTextAtSize(PUCE, taille)
  const largeurItem = LARGEUR - retrait
  const out: LigneTexte[] = []
  if (titre) out.push({ texte: titre, x: 0, gras: true })
  for (const item of items) {
    const lignes = decouper(item, font, taille, largeurItem)
    if (uneLigne && lignes.length > 1) {
      let l = lignes[0]
      while (l.includes(' ') && font.widthOfTextAtSize(`${l} …`, taille) > largeurItem) l = l.slice(0, l.lastIndexOf(' '))
      lignes.splice(0, lignes.length, `${l.replace(/[\s,;:]+$/, '')} …`)
    }
    lignes.forEach((l, i) => out.push({ texte: i === 0 ? `${PUCE}${l}` : l, x: i === 0 ? 0 : retrait, gras: false }))
  }
  return out
}

/**
 * Mise en page d'une liste dans une case : la plus grande taille (6,6 à 5,2 pt, au dixième)
 * qui tient, ou à défaut une ligne par puce à 5,4 pt ; au-delà, les puces du milieu cèdent la
 * place à « … » (la dernière, souvent l'évaluation finale, reste lisible).
 */
function miseEnPage(items: string[], titre: string | null, font: PDFFont, dispo: number, tailleMax = 66): Mise {
  for (let dixiemes = tailleMax; dixiemes >= 52; dixiemes -= 2) {
    const taille = dixiemes / 10
    const interligne = taille * (dixiemes >= 60 ? 1.18 : 1.12)
    const lignes = poserListe(items, titre, font, taille, false)
    if (lignes.length * interligne <= dispo + 0.01) return { lignes, taille, interligne }
  }
  const taille = 5.4
  const interligne = taille * 1.08
  let gardes = items.slice()
  let lignes = poserListe(gardes, titre, font, taille, true)
  while (lignes.length * interligne > dispo && gardes.length > 2) {
    gardes = [...gardes.slice(0, -2), gardes[gardes.length - 1]]
    const tete = poserListe(gardes.slice(0, -1), titre, font, taille, true)
    lignes = [...tete, { texte: `${PUCE}…`, x: 0, gras: false }, ...poserListe(gardes.slice(-1), null, font, taille, true)]
  }
  return { lignes, taille, interligne }
}

/** Écrit une mise en page dans une case, centrée verticalement dans sa ligne. */
function ecrire(page: PDFPage, font: PDFFont, fontB: PDFFont, ligne: number, x: number, mise: Mise) {
  if (!mise.lignes.length) return
  const [haut, bas] = LIGNES[ligne]
  const dispo = bas - haut - 2 * MARGE
  const hauteur = mise.lignes.length * mise.interligne
  // Première ligne de base : haut du bloc centré + hauteur des capitales
  let base = H - (haut + MARGE + Math.max(0, (dispo - hauteur) / 2) + mise.taille * 0.82)
  for (const l of mise.lignes) {
    page.drawText(l.texte, { x: x + l.x, y: base, size: mise.taille, font: l.gras ? fontB : font, color: NAVY })
    base -= mise.interligne
  }
}

export async function fillPdc(templateBytes: ArrayBuffer | Uint8Array, d: PdcData): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes)
  const page = doc.getPages()[0]
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold)

  const T = (txt: any, x: number, yTop: number, size = 9, bold = false) => {
    const v = san(txt)
    if (v) page.drawText(v, { x, y: yTop + LIFT, size, font: bold ? fontB : font, color: NAVY })
  }
  // Chiffres en cases (pas fixe)
  const boxed = (val: any, startX: number, y: number, size = 9.5) => {
    const ds = digits(val)
    for (let i = 0; i < ds.length; i++) page.drawText(ds[i], { x: startX + i * PITCH, y: y + LIFT, size, font, color: NAVY })
  }

  // ── Employeur ──
  T(d.employeur, 178, 722.6)
  T(d.raison, 161, 706.1)
  T(d.adresse, 72, 688.8)
  boxed(d.cp, 69.1, 671.6)
  T(d.ville, 135, 671.6)
  T(d.responsable, 135, 654.6)
  if (digits(d.telFixe)) boxed(d.telFixe, 97, 637.1)
  if (digits(d.telPort)) boxed(d.telPort, 379.7, 637.1)
  T(d.mail, 94, 620.4)

  // ── POEI ──
  T(d.poste, 112, 566.0)
  boxed(d.debut, 101.8, 549.6)
  boxed(d.fin, 265.6, 549.6)
  T(d.hebdo, 137.5, 531.9)
  T(d.total, 359.9, 531.9)
  boxed(d.embauche, 246.9, 515.4)

  // Stagiaire / tuteur : coche dans le rond Mme (20,3-31,7) ou M (66,4-77,8), puis le nom.
  // Civilité inconnue : aucune case cochée, plutôt qu'une civilité fausse.
  const check = (civ: string | undefined, y: number) => {
    const c = (civ || '').trim()
    if (!c) return
    const isMme = /^(mme|madame|mlle|mademoiselle)/i.test(c)
    page.drawText('X', { x: isMme ? 22.2 : 68.3, y: y + LIFT, size: 8.5, font: fontB, color: NAVY })
  }
  check(d.stagiaireCiv, 464.4); T(d.stagiaire, 257, 464.4)
  if (d.tuteur) { check(d.tuteurCiv, 415.9); T(d.tuteur, 257, 415.9) }
  T(d.fonction, 78.5, 398.3)

  // ── Tableau (5 lignes) ──
  const dateY = [309.9, 250.1, 190.4, 131.0, 71.3]
  const rows = (d.rows || []).slice(0, 5)
  rows.forEach((r, i) => {
    boxed(r.date, 27.8, dateY[i], 8.5)
    const [haut, bas] = LIGNES[i]
    const dispo = bas - haut - 2 * MARGE
    const titre = r.capableDe && (r.objectifs || []).length ? TITRE_OBJECTIFS : null
    // Les deux cases d'une ligne à la même taille : celle de la plus chargée
    let comp = miseEnPage(r.competences || [], null, font, dispo)
    let obj = miseEnPage(r.objectifs || [], titre, font, dispo)
    const taille = Math.min(comp.taille, obj.taille)
    if (comp.taille > taille) comp = miseEnPage(r.competences || [], null, font, dispo, Math.round(taille * 10))
    if (obj.taille > taille) obj = miseEnPage(r.objectifs || [], titre, font, dispo, Math.round(taille * 10))
    ecrire(page, font, fontB, i, COMP_X, comp)
    ecrire(page, font, fontB, i, OBJ_X, obj)
    const heures = san(r.heures)
    if (heures) {
      const t = 9.5
      page.drawText(heures, {
        x: HEURES_CENTRE - fontB.widthOfTextAtSize(heures, t) / 2,
        y: H - (TRAIT_HEURES[i] - 2.6), size: t, font: fontB, color: NAVY,
      })
    }
  })

  return doc.save()
}
