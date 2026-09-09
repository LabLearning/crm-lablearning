import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

/**
 * Pack Hygiène : personnalisation du PMS (plan de maîtrise sanitaire) au
 * gabarit Lab Learning et assemblage du classeur à imprimer.
 *
 * Le PMS est un PDF de 46 pages A4 produit sous Illustrator, identique pour
 * toutes ses déclinaisons co-brandées (Lab Learning × logo de la franchise).
 * Seules quatre pages portent des champs à remplir ; on y écrit par-dessus,
 * aux coordonnées relevées sur le gabarit (origine haut-gauche, points).
 */

export const BUCKET_PACK_HYGIENE = 'documents'

export type PieceId = 'pms' | 'affichages' | 'livret' | 'reglement' | 'programme' | 'emargement' | 'attestations' | 'diplome'

/** Les pièces du pack, dans l'ordre du classeur. */
export const PIECES: { id: PieceId; titre: string; sousTitre: string; bloc: 'apporter' | 'remettre' }[] = [
  { id: 'pms', titre: 'Plan de maîtrise sanitaire', sousTitre: 'Personnalisé au nom de l’établissement, plan de formation du personnel pré-rempli', bloc: 'apporter' },
  { id: 'affichages', titre: 'Affichages obligatoires', sousTitre: 'Allergènes, lavage des mains, tenue en cuisine, origine des viandes', bloc: 'apporter' },
  { id: 'livret', titre: 'Livret d’accueil', sousTitre: 'Remis à chaque stagiaire (indicateur 9)', bloc: 'apporter' },
  { id: 'reglement', titre: 'Règlement intérieur', sousTitre: 'Applicable aux stagiaires pendant la formation', bloc: 'apporter' },
  { id: 'programme', titre: 'Programme de formation', sousTitre: 'Objectifs, contenu, modalités et évaluation', bloc: 'apporter' },
  { id: 'emargement', titre: 'Feuilles d’émargement', sousTitre: 'Vierges, à faire signer par demi-journée', bloc: 'apporter' },
  { id: 'attestations', titre: 'Attestations de formation à l’hygiène alimentaire', sousTitre: 'Une par stagiaire, à remettre en fin de formation', bloc: 'remettre' },
  { id: 'diplome', titre: 'Diplôme de l’établissement', sousTitre: 'À afficher dans l’établissement', bloc: 'remettre' },
]

export interface InfosPms {
  etablissement: string
  dateMaj: Date
  /** Responsable signataire de l'engagement (page 2) */
  responsableNom: string | null
  responsableQualite: string | null
  ville: string | null
  siret: string | null
  repasParJour: number | null
  referentHaccp: string | null
  exploitant: string | null
  adresse: string | null
  codePostalVille: string | null
  activite: string | null
  /** Page 9 : une ligne par personne formée */
  formes: { nom: string; fonction?: string | null }[]
  formationIntitule: string
  formationDates: string
  formationDuree: string
  organisme: string
}

const PINE = rgb(0x1c / 255, 0x4d / 255, 0x3f / 255)
const INK = rgb(0x1c / 255, 0x19 / 255, 0x17 / 255)
const H = 841.89

/** Écrit un texte en coordonnées « haut-gauche » (comme pdftotext -bbox). */
function ecrire(page: PDFPage, font: PDFFont, texte: string, x: number, yTop: number, taille: number, couleur = INK, largeurMax?: number) {
  let t = texte
  if (largeurMax) {
    while (t.length > 1 && font.widthOfTextAtSize(t, taille) > largeurMax) t = t.slice(0, -1)
    if (t !== texte) t = t.slice(0, -1) + '…'
  }
  page.drawText(t, { x, y: H - yTop, size: taille, font, color: couleur })
}

/** Découpe un texte en lignes tenant dans une largeur donnée. */
function lignes(font: PDFFont, texte: string, taille: number, largeur: number, max = 3): string[] {
  const mots = texte.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (const m of mots) {
    const essai = cur ? `${cur} ${m}` : m
    if (font.widthOfTextAtSize(essai, taille) <= largeur) cur = essai
    else { if (cur) out.push(cur); cur = m }
    if (out.length === max) break
  }
  if (cur && out.length < max) out.push(cur)
  return out
}

const frDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Remplace les caractères hors WinAnsi (Helvetica standard) pour éviter un plantage. */
const sain = (s: string | null | undefined) => (s || '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
  .replace(/[^\x20-\x7E -ÿŒœ€]/g, '')

/**
 * Remplit les pages 1, 2, 6 et 9 du PMS avec les données de l'établissement.
 * Les champs inconnus sont laissés vides (pointillés du gabarit) pour un
 * remplissage à la main.
 */
export async function personnaliserPms(gabarit: Uint8Array | ArrayBuffer, infos: InfosPms): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(gabarit)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pages = pdf.getPages()
  if (pages.length < 9) throw new Error('Gabarit PMS inattendu (moins de 9 pages)')

  // ── Page 1 : couverture ──
  const p1 = pages[0]
  ecrire(p1, gras, sain(infos.etablissement).toUpperCase(), 52, 600, 15, PINE, 480)
  ecrire(p1, gras, frDate(infos.dateMaj), 224, 663, 13, PINE)

  // ── Page 2 : engagement du responsable ──
  const p2 = pages[1]
  if (infos.responsableNom) ecrire(p2, font, sain(infos.responsableNom), 172, 188, 11, INK, 360)
  if (infos.responsableQualite) ecrire(p2, font, sain(infos.responsableQualite), 152, 216, 11, INK, 380)
  ecrire(p2, font, sain(infos.etablissement), 188, 244, 11, INK, 345)
  if (infos.ville) ecrire(p2, font, sain(infos.ville), 102, 394, 11, INK, 230)
  ecrire(p2, font, frDate(infos.dateMaj), 392, 394, 11, INK, 140)

  // ── Page 6 : informations sur l'établissement ──
  const p6 = pages[5]
  const xv = 292
  const lv = 235
  if (infos.siret) ecrire(p6, font, sain(infos.siret), xv, 188, 10.5, INK, lv)
  if (infos.repasParJour != null) ecrire(p6, font, String(infos.repasParJour), xv, 236, 10.5, INK, lv)
  if (infos.referentHaccp) lignes(font, sain(infos.referentHaccp), 10, lv, 2).forEach((l, i) => ecrire(p6, font, l, xv, 278 + i * 13, 10))
  if (infos.exploitant) ecrire(p6, font, sain(infos.exploitant), xv, 340, 10.5, INK, lv)
  if (infos.adresse) {
    const adr = [sain(infos.adresse), sain(infos.codePostalVille)].filter(Boolean)
    adr.forEach((l, i) => ecrire(p6, font, l, xv, 386 + i * 13, 10, INK, lv))
  }
  if (infos.activite) lignes(font, sain(infos.activite), 9.5, lv, 3).forEach((l, i) => ecrire(p6, font, l, xv, 440 + i * 12, 9.5))

  // ── Page 9 : plan de formation du personnel à l'hygiène alimentaire ──
  const p9 = pages[8]
  const yHaut = 224   // bas de l'en-tête du tableau
  const yBas = 574    // bas du tableau
  const nbLignes = 8
  const h = (yBas - yHaut) / nbLignes
  const cols = { nom: 71, intitule: 227, date: 329, orga: 443 }
  const larg = { nom: 148, intitule: 94, date: 106, orga: 88 }
  const t = 7.5
  infos.formes.slice(0, nbLignes).forEach((f, i) => {
    const y0 = yHaut + i * h + 6
    const bloc = (x: number, w: number, texte: string, police: PDFFont = font) =>
      lignes(police, sain(texte), t, w, 3).forEach((l, k) => ecrire(p9, police, l, x, y0 + t + k * (t + 2.5), t))
    bloc(cols.nom, larg.nom, f.fonction ? `${f.nom}, ${f.fonction}` : f.nom, gras)
    bloc(cols.intitule, larg.intitule, infos.formationIntitule)
    bloc(cols.date, larg.date, `${infos.formationDates} · ${infos.formationDuree}`)
    bloc(cols.orga, larg.orga, infos.organisme)
  })

  return pdf.save({ useObjectStreams: false })
}

export interface PieceClasseur {
  titre: string
  sousTitre?: string
  bytes: Uint8Array | ArrayBuffer
}

/**
 * Assemble le classeur : une couverture au nom de l'établissement avec le
 * sommaire, puis les pièces dans l'ordre, chacune précédée d'un intercalaire.
 */
export async function construireClasseur(opts: {
  titre: string
  etablissement: string
  sousTitre: string
  organisme: string
  pieces: PieceClasseur[]
}): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const gras = await out.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28
  const vert = PINE
  const gris = rgb(0.45, 0.43, 0.42)

  // Couverture + sommaire
  const cover = out.addPage([W, H])
  cover.drawRectangle({ x: 0, y: H - 200, width: W, height: 200, color: vert })
  cover.drawText(sain(opts.organisme).toUpperCase(), { x: 48, y: H - 60, size: 10, font: gras, color: rgb(0.7, 0.9, 0.8) })
  cover.drawText(sain(opts.titre), { x: 48, y: H - 110, size: 30, font: gras, color: rgb(1, 1, 1) })
  cover.drawText(sain(opts.etablissement), { x: 48, y: H - 150, size: 16, font: gras, color: rgb(1, 1, 1) })
  cover.drawText(sain(opts.sousTitre), { x: 48, y: H - 172, size: 11, font, color: rgb(0.85, 0.93, 0.9) })
  cover.drawText('SOMMAIRE', { x: 48, y: H - 250, size: 10, font: gras, color: gris })
  let y = H - 280
  let numero = 2
  const debuts: number[] = []
  for (const [i, p] of opts.pieces.entries()) {
    const nb = (await PDFDocument.load(p.bytes)).getPageCount()
    debuts.push(numero)
    cover.drawText(String(i + 1).padStart(2, '0'), { x: 48, y, size: 12, font: gras, color: vert })
    cover.drawText(sain(p.titre), { x: 80, y, size: 12, font: gras, color: INK })
    if (p.sousTitre) cover.drawText(sain(p.sousTitre), { x: 80, y: y - 14, size: 9, font, color: gris })
    cover.drawText(`p. ${numero}`, { x: W - 48 - font.widthOfTextAtSize(`p. ${numero}`, 10), y, size: 10, font, color: gris })
    numero += 1 + nb
    y -= p.sousTitre ? 40 : 28
  }
  cover.drawText(`Classeur généré le ${frDate(new Date())} par ${sain(opts.organisme)}.`, { x: 48, y: 48, size: 8, font, color: gris })

  // Intercalaires + pièces
  for (const [i, p] of opts.pieces.entries()) {
    const sep = out.addPage([W, H])
    sep.drawRectangle({ x: 0, y: 0, width: 18, height: H, color: vert })
    sep.drawText(String(i + 1).padStart(2, '0'), { x: 48, y: H / 2 + 40, size: 64, font: gras, color: vert })
    sep.drawText(sain(p.titre), { x: 48, y: H / 2, size: 22, font: gras, color: INK })
    if (p.sousTitre) sep.drawText(sain(p.sousTitre), { x: 48, y: H / 2 - 22, size: 11, font, color: gris })
    sep.drawText(sain(opts.etablissement), { x: 48, y: 48, size: 9, font, color: gris })
    const src = await PDFDocument.load(p.bytes)
    const copies = await out.copyPages(src, src.getPageIndices())
    for (const c of copies) out.addPage(c)
  }
  void debuts
  return out.save({ useObjectStreams: false })
}
