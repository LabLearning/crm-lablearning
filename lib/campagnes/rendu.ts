import { emailShell, ctaButton } from '@/lib/email'
import { personnaliser } from './regles'

/**
 * Mise en page d'un e-mail de campagne : le texte écrit à l'écran (paragraphes,
 * liens), un bouton facultatif, et en pied de message qui écrit, pourquoi, et
 * le lien pour ne plus rien recevoir. Aux couleurs de Lab Learning.
 */
const echapper = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Texte → HTML : paragraphes, retours à la ligne, adresses web cliquables, **gras**. */
export function texteVersHtml(texte: string): string {
  return String(texte || '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/).map((bloc) => {
    const html = echapper(bloc)
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#205040;font-weight:600;">$1</a>')
      .replace(/\n/g, '<br>')
    return `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.65;">${html}</p>`
  }).join('')
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
  const corps = personnaliser(c.contenu, personne)
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
