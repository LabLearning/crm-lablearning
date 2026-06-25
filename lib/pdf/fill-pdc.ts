import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Remplit le VRAI formulaire France Travail « Plan de développement de compétences »
// (PDF à plat sans champ) en superposant les valeurs aux coordonnées exactes
// relevées sur un exemplaire rempli. Page A4 595.32 × 841.92, origine bas-gauche.

const NAVY = rgb(0.106, 0.165, 0.42)
const H = 841.92
const PITCH = 11.4 // pas entre cases (chiffres)
// Les coordonnees relevees correspondent au bas de la boite englobante des
// glyphes (pdfminer) ; la vraie ligne de base est ~2pt plus haut.
const LIFT = 2.0

export interface PdcRow { date?: string; comp?: string; heures?: string; obj?: string }
export interface PdcData {
  employeur?: string; raison?: string; adresse?: string; cp?: string; ville?: string
  responsable?: string; telFixe?: string; telPort?: string; mail?: string
  poste?: string; debut?: string; fin?: string; hebdo?: string; total?: string; embauche?: string
  stagiaireCiv?: string; stagiaire?: string; tuteurCiv?: string; tuteur?: string; fonction?: string
  rows?: PdcRow[]
}

const san = (s: any) => String(s ?? '')
  .replace(/[→←↔]/g, '-')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/ /g, ' ').replace(/[–—]/g, '-')
  .replace(/[^\x00-\xFF]/g, '')
const digits = (s: any) => String(s ?? '').replace(/\D/g, '')

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
  // Retour à la ligne dans une largeur donnée
  const wrap = (text: string, maxW: number, size: number) => {
    const words = san(text).split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w
      if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w }
      else cur = test
    }
    if (cur) lines.push(cur)
    return lines
  }
  const para = (text: string, x: number, yTop: number, maxW: number, size = 7, lh = 8.6, maxLines = 6) => {
    const lines = wrap(text, maxW, size).slice(0, maxLines)
    lines.forEach((l, i) => page.drawText(l, { x, y: yTop + LIFT - i * lh, size, font, color: NAVY }))
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

  // Stagiaire / tuteur : coche (Mme x40 / M x68.3) + nom
  const check = (civ: string | undefined, y: number) => {
    const isMme = (civ || '').toLowerCase().startsWith('mme')
    page.drawText('X', { x: isMme ? 40 : 68.3, y: y + LIFT, size: 8.5, font: fontB, color: NAVY })
  }
  check(d.stagiaireCiv, 464.4); T(d.stagiaire, 257, 464.4)
  check(d.tuteurCiv, 415.9); T(d.tuteur, 257, 415.9)
  T(d.fonction, 78.5, 398.3)

  // ── Tableau (5 lignes) ──
  const compTop = [336, 272, 212, 153, 97]
  const dateY = [309.9, 250.1, 190.4, 131.0, 71.3]
  const heurY = [318.4, 259.8, 200.0, 140.6, 79.7]
  const rows = (d.rows || []).slice(0, 5)
  rows.forEach((r, i) => {
    boxed(r.date, 27.8, dateY[i], 8.5)
    para(r.comp || '', 125.3, compTop[i], 205, 7, 8.6, 6)
    T(r.heures, 332, heurY[i], 8)
    para(r.obj || '', 393.4, compTop[i] - 4, 168, 7, 8.6, 6)
  })

  return doc.save()
}
