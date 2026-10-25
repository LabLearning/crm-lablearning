import { emailShell, ctaButton } from '@/lib/email'
import { personnaliser } from './regles'

/**
 * Mise en page d'un e-mail de campagne : le texte écrit à l'écran, un bouton
 * facultatif, et en pied de message qui écrit, pourquoi, et le lien pour ne
 * plus rien recevoir. Aux couleurs de Lab Learning.
 *
 * Le texte accepte quelques blocs, un par ligne :
 * image, titres, chiffres clés, liste, étapes, encadré, alerte, séparateur
 * (lib/campagnes/aide-mise-en-page.ts, montrée à l'écran).
 * Tout ce qui est écrit est échappé avant la mise en page : seuls ces blocs,
 * le **gras** et les adresses web (devenues des liens) produisent du HTML.
 * HTML d'e-mail : tableaux et styles en ligne, lus par Outlook, Gmail et les
 * téléphones.
 */
const echapper = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const PINE = '#205040'
const ENCRE = '#14261F'
const TEXTE = '#3f3f46'
const TEINTE = '#EEF6F1'

/** Une ligne de texte : échappée, **gras**, adresses web cliquables */
function enLigne(texte: string): string {
  return echapper(texte)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, `<a href="$1" style="color:${PINE};font-weight:600;">$1</a>`)
}

type Bloc =
  | { type: 'p'; lignes: string[] }
  | { type: 'image'; alt: string; url: string }
  | { type: 'titre'; niveau: 1 | 2; texte: string }
  | { type: 'chiffres'; items: { valeur: string; libelle: string }[] }
  | { type: 'liste'; items: string[] }
  | { type: 'etapes'; items: string[] }
  | { type: 'encadre'; lignes: string[] }
  | { type: 'alerte'; lignes: string[] }
  | { type: 'separateur' }

const IMAGE = /^!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)\s*$/

/** Le texte de l'auteur, découpé en blocs (lignes consécutives d'un même genre regroupées) */
function decouper(texte: string): Bloc[] {
  const blocs: Bloc[] = []
  const dernier = () => blocs[blocs.length - 1]
  let paragraphe: string[] | null = null
  const fermer = () => { paragraphe = null }
  for (const brute of String(texte || '').replace(/\r\n?/g, '\n').split('\n')) {
    const ligne = brute.trim()
    if (!ligne) { fermer(); continue }
    const image = IMAGE.exec(ligne)
    let m: RegExpExecArray | null
    if (image) { fermer(); blocs.push({ type: 'image', alt: image[1], url: image[2] }); continue }
    if ((m = /^(#{1,2})\s+(.+)$/.exec(ligne))) { fermer(); blocs.push({ type: 'titre', niveau: m[1].length as 1 | 2, texte: m[2] }); continue }
    if (/^-{3,}$/.test(ligne)) { fermer(); blocs.push({ type: 'separateur' }); continue }
    if ((m = /^%%\s*(.+)$/.exec(ligne))) {
      fermer()
      const [valeur, ...reste] = m[1].split('|')
      const item = { valeur: valeur.trim(), libelle: reste.join('|').trim() }
      const d = dernier()
      // Trois chiffres au plus par rangée
      if (d?.type === 'chiffres' && d.items.length < 3) d.items.push(item); else blocs.push({ type: 'chiffres', items: [item] })
      continue
    }
    if ((m = /^[-•]\s+(.+)$/.exec(ligne))) {
      fermer()
      const d = dernier()
      if (d?.type === 'liste') d.items.push(m[1]); else blocs.push({ type: 'liste', items: [m[1]] })
      continue
    }
    if ((m = /^\d{1,2}[.)]\s+(.+)$/.exec(ligne))) {
      fermer()
      const d = dernier()
      if (d?.type === 'etapes') d.items.push(m[1]); else blocs.push({ type: 'etapes', items: [m[1]] })
      continue
    }
    if ((m = /^>\s?(.*)$/.exec(ligne))) {
      fermer()
      const d = dernier()
      if (d?.type === 'encadre') d.lignes.push(m[1]); else blocs.push({ type: 'encadre', lignes: [m[1]] })
      continue
    }
    if ((m = /^!\s+(.+)$/.exec(ligne))) {
      fermer()
      const d = dernier()
      if (d?.type === 'alerte') d.lignes.push(m[1]); else blocs.push({ type: 'alerte', lignes: [m[1]] })
      continue
    }
    if (paragraphe) { (paragraphe as string[]).push(ligne); continue }
    paragraphe = [ligne]
    blocs.push({ type: 'p', lignes: paragraphe })
  }
  return blocs
}

function blocVersHtml(b: Bloc): string {
  switch (b.type) {
    case 'p':
      return `<p style="margin:0 0 16px;color:${TEXTE};font-size:15px;line-height:1.65;">${b.lignes.map(enLigne).join('<br>')}</p>`
    case 'image':
      return `<img src="${echapper(b.url)}" alt="${echapper(b.alt)}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:0;outline:none;border-radius:10px;margin:0 0 24px;">`
    case 'titre':
      return b.niveau === 1
        ? `<h1 style="margin:0 0 14px;color:${ENCRE};font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.3px;">${enLigne(b.texte)}</h1>`
        : `<h2 style="margin:28px 0 12px;color:${PINE};font-size:17px;line-height:1.35;font-weight:700;">${enLigne(b.texte)}</h2>`
    case 'separateur':
      return `<hr style="border:0;border-top:1px solid #e4e4e7;margin:24px 0;">`
    case 'chiffres': {
      const largeur = Math.floor(100 / b.items.length)
      const taille = b.items.length === 3 ? 19 : 24
      // Un montant ne se coupe pas (« 9 000 € ») ; les mots, eux, passent à la ligne sur un téléphone
      const insecable = (v: string) => enLigne(v).replace(/(\d) (?=\d)/g, '$1&nbsp;').replace(/ (?=(€|%|h\b))/g, '&nbsp;')
      // Écart de 8 px entre les cases, aucun sur les bords (Outlook ne connaît ni marge négative ni calc)
      const cases = b.items.map((it, i) => `<td width="${largeur}%" valign="top" style="padding:0 ${i === b.items.length - 1 ? 0 : 4}px 0 ${i === 0 ? 0 : 4}px;">
        <div style="background-color:${TEINTE};border-radius:10px;padding:14px 12px;">
          <div style="color:${PINE};font-size:${taille}px;line-height:1.15;font-weight:800;letter-spacing:-0.3px;">${insecable(it.valeur)}</div>
          ${it.libelle ? `<div style="margin-top:6px;color:#52525b;font-size:12px;line-height:1.45;">${enLigne(it.libelle)}</div>` : ''}
        </div>
      </td>`).join('')
      // Colonnes égales, quelle que soit la longueur de chaque chiffre
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px;table-layout:fixed;"><tr>${cases}</tr></table>`
    }
    case 'liste':
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">${b.items.map((it) => `<tr>
        <td width="22" valign="top" style="padding:8px 0 0;"><div style="width:8px;height:8px;border-radius:4px;background-color:#5CD9A0;"></div></td>
        <td valign="top" style="padding:0 0 8px;color:${TEXTE};font-size:15px;line-height:1.6;">${enLigne(it)}</td>
      </tr>`).join('')}</table>`
    case 'etapes':
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">${b.items.map((it, i) => `<tr>
        <td width="40" valign="top" style="padding:0 0 12px;">
          <div style="width:28px;height:28px;border-radius:14px;background-color:${PINE};color:#ffffff;font-size:14px;font-weight:700;line-height:28px;text-align:center;">${i + 1}</div>
        </td>
        <td valign="top" style="padding:3px 0 12px;color:${TEXTE};font-size:15px;line-height:1.6;">${enLigne(it)}</td>
      </tr>`).join('')}</table>`
    case 'encadre':
      return `<div style="margin:0 0 20px;padding:16px 18px;background-color:${TEINTE};border-radius:10px;color:${ENCRE};font-size:15px;line-height:1.6;">${b.lignes.map(enLigne).join('<br>')}</div>`
    case 'alerte':
      return `<div style="margin:0 0 20px;padding:16px 18px;background-color:#FFF6E5;border-radius:10px;color:#7A4A00;font-size:15px;line-height:1.6;">${b.lignes.map(enLigne).join('<br>')}</div>`
  }
}

/** Texte → HTML d'e-mail, bloc par bloc (le texte libre reste en paragraphes, comme avant). */
export function texteVersHtml(texte: string): string {
  return decouper(texte).map(blocVersHtml).join('')
}

/** Version texte de l'e-mail (messageries sans HTML) : les blocs redeviennent des lignes lisibles */
export function texteVersBrut(texte: string): string {
  return decouper(texte).map((b) => {
    const net = (v: string) => v.replace(/\*\*([^*\n]+)\*\*/g, '$1')
    switch (b.type) {
      case 'p': return b.lignes.map(net).join('\n')
      case 'image': return ''
      case 'titre': return net(b.texte)
      case 'separateur': return ''
      case 'chiffres': return b.items.map((it) => (it.libelle ? `${net(it.valeur)} : ${net(it.libelle)}` : net(it.valeur))).join('\n')
      case 'liste': return b.items.map((it) => `- ${net(it)}`).join('\n')
      case 'etapes': return b.items.map((it, i) => `${i + 1}. ${net(it)}`).join('\n')
      case 'encadre': case 'alerte': return b.lignes.map(net).join('\n')
    }
  }).filter(Boolean).join('\n\n')
}

export interface ContenuEmail {
  objet: string
  contenu: string
  boutonLibelle?: string | null
  boutonUrl?: string | null
}

export function rendreEmailCampagne(c: ContenuEmail, personne: { prenom?: string | null; etablissement?: string | null }, liens: { desinscription: string }, org: {
  nom: string
  email?: string | null
  logoUrl?: string | null
  qualiopi?: boolean
}): { objet: string; html: string; texte: string } {
  const objet = personnaliser(c.objet, personne).replace(/[\r\n]+/g, ' ').trim()
  // Le texte de l'auteur est mis en page d'abord (ses adresses deviennent des liens), puis les valeurs du
  // destinataire y sont glissées échappées : jamais un lien venu d'un formulaire
  const corpsHtml = personnaliser(texteVersHtml(c.contenu), personne, echapper)
  const corps = personnaliser(texteVersBrut(c.contenu), personne)
  const bouton = c.boutonLibelle && c.boutonUrl && /^https:\/\//.test(c.boutonUrl) ? ctaButton(echapper(c.boutonUrl), echapper(c.boutonLibelle)) : ''
  const pied = `<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e4e4e7;color:#a1a1aa;font-size:12px;line-height:1.6;">
    Vous recevez ce message de ${echapper(org.nom)} au sujet de la formation des équipes de votre établissement.
    <a href="${echapper(liens.desinscription)}" style="color:#71717a;text-decoration:underline;">Ne plus recevoir nos e-mails</a>.
  </p>`
  const html = emailShell({
    body: `${corpsHtml}${bouton}${pied}`,
    orgName: echapper(org.nom),
    orgEmail: org.email || undefined,
    orgLogoUrl: org.logoUrl || undefined,
    qualiopiCertified: org.qualiopi !== false,
  })
  const texte = [
    corps.trim(),
    c.boutonLibelle && c.boutonUrl ? `${c.boutonLibelle} : ${c.boutonUrl}` : '',
    `Vous recevez ce message de ${org.nom} au sujet de la formation des équipes de votre établissement. Ne plus recevoir nos e-mails : ${liens.desinscription}`,
  ].filter(Boolean).join('\n\n')
  return { objet, html, texte }
}
