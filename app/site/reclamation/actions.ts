'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const ORIGINES = ['apprenant', 'entreprise', 'financeur', 'autre']

/** Le gabarit des mails n'échappe pas le HTML : toute valeur saisie publiquement passe par ici. */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const jokers = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * Dépôt public d'une réclamation — sans compte, depuis le site.
 *
 * L'indicateur 31 du RNQ exige que les parties prenantes puissent exprimer une
 * réclamation ; un registre que seul l'administrateur peut alimenter n'y
 * répond pas. La réclamation entre dans le même registre que celles saisies en
 * interne : accusé de réception au plaignant, alerte à l'organisme, et le
 * traitement suit le circuit habituel.
 *
 * L'accusé part vers une adresse que rien ne vérifie : champ piège, limites
 * par adresse et pour tout le site, valeurs saisies échappées et sans lien web,
 * pour qu'il ne serve ni au hameçonnage ni à l'envoi en nombre sous notre nom.
 */
export async function deposerReclamationPubliqueAction(formData: FormData): Promise<ActionResult<{ numero?: string }>> {
  // Champ invisible pour les humains : rempli = robot, on accepte sans écrire.
  if (String(formData.get('entreprise_site') || '').trim() !== '') {
    return { success: true, data: {} }
  }

  // Le nom et l'objet tiennent sur une ligne : ils sont repris dans l'accusé et dans le sujet de l'alerte
  const nom = String(formData.get('nom') || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const email = String(formData.get('email') || '').trim().slice(0, 200)
  const telephone = String(formData.get('telephone') || '').trim().slice(0, 30)
  const origineSaisie = String(formData.get('origine') || 'autre')
  const origine = ORIGINES.includes(origineSaisie) ? origineSaisie : 'autre'
  const objet = String(formData.get('objet') || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  const description = String(formData.get('description') || '').trim().slice(0, 5000)

  if (!nom || !email || !objet || !description) {
    return { success: false, error: 'Merci de renseigner votre nom, votre email, l’objet et le détail de votre réclamation.' }
  }
  // « * » et « % » servent de jokers dans les recherches : refusés, ils ne figurent dans aucune adresse réelle
  if (!/^[^\s@*%]+@[^\s@*%]+\.[^\s@*%]{2,}$/.test(email)) {
    return { success: false, error: 'Adresse email invalide.' }
  }
  // Un lien repris dans l'accusé deviendrait cliquable dans un mail envoyé depuis notre domaine
  if (/https?:|www\./i.test(`${nom} ${objet}`)) {
    return { success: false, error: 'Le nom et l’objet ne peuvent pas contenir d’adresse web. Indiquez-la plutôt dans le détail de votre réclamation.' }
  }

  const supabase = await createServiceRoleClient()

  // Limites des dépôts par ce formulaire (l'équipe renseigne created_by, le portail apprenant_id) : 3 par adresse sur 24 h, 10 par heure pour tout le site
  const depots = () => supabase.from('reclamations').select('id', { count: 'exact', head: true })
    .eq('organization_id', ORG).is('created_by', null).is('apprenant_id', null)
  const [parAdresse, auTotal] = await Promise.all([
    depots().ilike('emetteur_email', jokers(email)).gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString()),
    depots().gte('created_at', new Date(Date.now() - 3600000).toISOString()),
  ])
  if ((parAdresse.count || 0) >= 3) {
    return { success: false, error: 'Plusieurs réclamations ont déjà été déposées avec cette adresse aujourd’hui. Pour compléter la vôtre, écrivez-nous à contact@lab-learning.fr.' }
  }
  if ((auTotal.count || 0) >= 10) {
    return { success: false, error: 'Beaucoup de réclamations nous parviennent en ce moment. Réessayez dans une heure, ou écrivez-nous directement à contact@lab-learning.fr.' }
  }

  const { data, error } = await supabase
    .from('reclamations')
    .insert({
      organization_id: ORG,
      numero: '',
      objet,
      description,
      origine,
      priorite: 'moyenne',
      emetteur_nom: nom,
      emetteur_email: email,
      emetteur_telephone: telephone || null,
    })
    .select('id, numero')
    .single()

  if (error) {
    console.error('[reclamation publique]', error)
    return { success: false, error: 'Une erreur est survenue. Vous pouvez nous écrire directement à contact@lab-learning.fr.' }
  }

  const { data: org } = await supabase.from('organizations').select('*').eq('id', ORG).single()

  // Accusé de réception au plaignant — tracé dans email_logs.
  try {
    const { sendDocumentEmail } = await import('@/lib/email')
    await sendDocumentEmail({
      to: email,
      orgName: org?.name || 'Lab Learning',
      orgEmail: (org as any)?.email_contact || org?.email,
      orgLogoUrl: (org as any)?.logo_url,
      qualiopiCertified: (org as any)?.is_qualiopi !== false,
      recipientName: esc(nom),
      subject: `Accusé de réception de votre réclamation ${data.numero || ''}`,
      docTitle: 'Nous avons bien reçu votre réclamation',
      intro: `Nous accusons réception de votre réclamation et vous remercions de nous avoir fait part de votre retour. Conformément à notre engagement qualité, nous allons l'analyser et vous tenir informé(e) des suites données.`,
      metadata: [
        ['Référence', data.numero || ''],
        ['Objet', esc(objet)],
        ['Date de réception', new Date().toLocaleDateString('fr-FR')],
      ],
      footerNote: 'Vous serez recontacté(e) dans les meilleurs délais. Pour toute question, vous pouvez répondre directement à cet email.',
      organizationId: ORG,
      entityType: 'reclamation',
      entityId: (data as any).id,
    })
  } catch (e) { console.error('[accusé réclamation publique]', e) }

  // Alerte interne : une réclamation qui dort n'est pas traitée.
  try {
    const { sendDocumentEmail } = await import('@/lib/email')
    const destination = (org as any)?.email_contact || org?.email
    if (destination) {
      await sendDocumentEmail({
        to: destination,
        orgName: org?.name || 'Lab Learning',
        orgEmail: (org as any)?.email_contact || org?.email,
        orgLogoUrl: (org as any)?.logo_url,
        qualiopiCertified: (org as any)?.is_qualiopi !== false,
        recipientName: 'Équipe qualité',
        subject: `Nouvelle réclamation ${data.numero || ''} : ${objet.slice(0, 60)}`,
        docTitle: 'Une réclamation vient d’être déposée sur le site',
        intro: esc(description.slice(0, 600)),
        metadata: [
          ['Référence', data.numero || ''],
          ['Émetteur', esc(`${nom} · ${email}${telephone ? ` · ${telephone}` : ''}`)],
          ['Qualité', origine],
        ],
        ctaLabel: 'Ouvrir le registre des réclamations',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/dashboard/reclamations`,
        organizationId: ORG,
        entityType: 'reclamation',
        entityId: (data as any).id,
      })
    }
  } catch (e) { console.error('[alerte réclamation publique]', e) }

  return { success: true, data: { numero: data.numero || undefined } }
}
