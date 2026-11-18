import { dureeEnLettres, type Questionnaire } from '@/lib/poei-positionnement'

/**
 * Mail du questionnaire de positionnement, commun aux deux points d'envoi :
 * l'onglet Positionnement d'un projet POEI et le vivier de candidats. Le même
 * texte sert à l'aperçu et à l'envoi réel.
 */

export const SLUG_MAIL_POSITIONNEMENT = 'positionnement_poei'

export const lienPositionnement = (token: string) =>
  `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/positionnement/${token}`

/** Expéditeur et habillage de l'organisme */
export function enveloppePositionnement(org: any) {
  return {
    orgName: org?.name || 'Lab Learning',
    orgEmail: org?.email_contact || org?.email || '',
    orgLogoUrl: org?.logo_url || null,
    qualiopiCertified: org?.is_qualiopi !== false,
  }
}

/** Objet, texte et bouton du mail, pour le questionnaire du concept */
export function contenuMailPositionnement(q: Questionnaire, employeur: string | null, lien: string) {
  const nbQuestions = q.questions.length
  const duree = dureeEnLettres(q.dureeMinutes)
  return {
    subject: 'Votre questionnaire de positionnement avant la formation',
    docTitle: 'Questionnaire de positionnement',
    intro: `Avant votre entrée en formation${employeur ? ` chez ${employeur}` : ''}, merci de répondre à ce questionnaire. Il compte ${nbQuestions} questions et prend environ ${duree}. Il sert à adapter la formation à ce que vous savez déjà faire : répondez seul, sans chercher les réponses.`,
    metadata: [
      ['Questions', `${nbQuestions} questions à choix unique`],
      ['Durée', `Environ ${duree}`],
      ['À faire', 'Avant le premier jour de formation'],
    ] as Array<[string, string]>,
    ctaLabel: 'Répondre au questionnaire',
    ctaUrl: lien,
    footerNote: "Ce questionnaire n'est pas un examen : il n'y a aucune conséquence sur votre entrée en formation.",
    templateSlug: SLUG_MAIL_POSITIONNEMENT,
  }
}
