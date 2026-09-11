'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { sendDocumentToApprenantAction, envoyerDocumentSessionAction } from './actions'

export type MailApprenantType = 'convocation' | 'attestation' | 'certificat' | 'hygiene' | 'supports'

/**
 * Envoie — ou prévisualise — un courriel de session à un apprenant.
 *
 * C'est le point d'entrée unique de la matrice de l'onglet Mails : une ligne
 * par type de courriel, une colonne par stagiaire, chaque case s'envoie après
 * aperçu. Les documents de clôture délèguent à l'action existante ; la
 * convocation, jusqu'ici réservée au cron J-3, devient envoyable à la main —
 * un stagiaire inscrit la veille ne peut pas attendre un cron déjà passé.
 */
export async function envoyerMailApprenantAction(
  sessionId: string,
  apprenantId: string,
  type: MailApprenantType,
  opts?: { preview?: boolean },
): Promise<ActionResult<{ html?: string; subject?: string; email?: string | null }>> {
  if (type === 'supports') return envoyerSupportsApprenant(sessionId, apprenantId, opts)
  if (type !== 'convocation') {
    return sendDocumentToApprenantAction(sessionId, apprenantId, type, opts)
  }

  const session = await getSession()
  if (session.user.role === 'formateur') {
    return { success: false, error: 'Action réservée aux gestionnaires' }
  }
  const supabase = await createServiceRoleClient()

  const [{ data: apprenant }, { data: sess }] = await Promise.all([
    supabase.from('apprenants').select('*').eq('id', apprenantId).maybeSingle(),
    supabase.from('sessions')
      .select('*, formateur:formateurs(prenom, nom, email, telephone)')
      .eq('id', sessionId).eq('organization_id', session.organization.id).maybeSingle(),
  ])
  if (!apprenant) return { success: false, error: 'Apprenant introuvable' }
  if ((apprenant as any).organization_id !== session.organization.id) {
    return { success: false, error: 'Apprenant hors organisation' }
  }
  if (!sess) return { success: false, error: 'Session introuvable' }

  const [{ data: formation }, { data: org }] = await Promise.all([
    supabase.from('formations').select('*').eq('id', (sess as any).formation_id).maybeSingle(),
    supabase.from('organizations').select('*').eq('id', session.organization.id).single(),
  ])

  // Mêmes textes que la convocation automatique du cron J-3 : le stagiaire ne
  // doit pas recevoir deux formes différentes selon qui a déclenché l'envoi.
  const formationNom = (formation as any)?.intitule || (sess as any).intitule || 'Formation'
  const fmtLong = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dateStr = new Date((sess as any).date_debut).toLocaleDateString('fr-FR')
  const dateDebutLong = fmtLong((sess as any).date_debut)
  const dateFinLong = fmtLong((sess as any).date_fin || (sess as any).date_debut)
  const lieuStr = (sess as any).lieu || 'le lieu indiqué dans votre convocation'
  const sujet = `Convocation — ${formationNom} (${dateStr})`
  const { blocDocumentsAccueil } = await import('@/lib/email')
  const intro = `Nous avons le plaisir de vous convoquer à la session de formation suivante. Vous trouverez votre convocation détaillée en pièce jointe.${blocDocumentsAccueil(org as any)}`
  const meta: Array<[string, string]> = [
    ['Formation', formationNom],
    ['Début', dateDebutLong],
    ['Fin', dateFinLong],
    ['Lieu', lieuStr],
  ]
  const destinataire = [
    (apprenant as any).civilite, (apprenant as any).prenom, (apprenant as any).nom,
  ].filter(Boolean).join(' ').trim() || 'Madame, Monsieur'

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    const html = buildDocumentEmailHtml({
      orgName: (org as any)?.name || 'Lab Learning',
      orgEmail: (org as any)?.email_contact || (org as any)?.email,
      orgLogoUrl: (org as any)?.logo_url,
      qualiopiCertified: (org as any)?.is_qualiopi !== false,
      recipientName: destinataire,
      docTitle: 'Convocation à votre formation',
      intro,
      metadata: meta,
      pdfFilename: `convocation-${(apprenant as any).nom || 'stagiaire'}.pdf`,
      footerNote: "Merci de vous présenter 15 minutes avant le début de la session avec une pièce d'identité.",
    })
    return { success: true, data: { html, subject: sujet, email: (apprenant as any).email } }
  }

  if (!(apprenant as any).email) return { success: false, error: "Cet apprenant n'a pas d'adresse email" }

  try {
    const { createElement } = await import('react')
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { ConvocationPDF } = await import('@/lib/pdf/convocation-pdf')
    const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
    const orgDoc = await withDocumentLogo(supabase, org)
    const buffer = await renderToBuffer(createElement(ConvocationPDF, {
      apprenant, session: sess, formation, org: orgDoc, formateur: (sess as any).formateur,
    }) as any)

    const { sendDocumentEmail } = await import('@/lib/email')
    const r = await sendDocumentEmail({
      to: (apprenant as any).email,
      orgName: (org as any)?.name || 'Lab Learning',
      orgEmail: (org as any)?.email_contact || (org as any)?.email,
      orgLogoUrl: (org as any)?.logo_url,
      qualiopiCertified: (org as any)?.is_qualiopi !== false,
      recipientName: destinataire,
      subject: sujet,
      docTitle: 'Convocation à votre formation',
      intro,
      metadata: meta,
      pdfBuffer: Buffer.from(buffer),
      pdfFilename: `convocation-${(apprenant as any).nom || 'stagiaire'}.pdf`,
      footerNote: "Merci de vous présenter 15 minutes avant le début de la session avec une pièce d'identité.",
      organizationId: session.organization.id,
      entityType: 'session',
      entityId: sessionId,
      triggeredBy: session.user.id,
    })
    if (!r.success) return { success: false, error: r.error || "L'envoi a échoué" }
  } catch (e) {
    console.error('[convocation apprenant]', e)
    return { success: false, error: 'Erreur de génération de la convocation' }
  }

  await logAudit({ action: 'send_convocation', entity_type: 'apprenant', entity_id: apprenantId })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { email: (apprenant as any).email } }
}

/**
 * Mise à disposition tracée des supports pédagogiques (indicateur 19) : le
 * stagiaire reçoit la liste des supports de sa session et le lien vers son
 * portail où ils se consultent. La trace de l'envoi EST la preuve de la mise
 * à disposition — c'est elle que l'auditeur demande sur les sessions passées.
 */
async function envoyerSupportsApprenant(
  sessionId: string,
  apprenantId: string,
  opts?: { preview?: boolean },
): Promise<ActionResult<{ html?: string; subject?: string; email?: string | null }>> {
  const session = await getSession()
  if (session.user.role === 'formateur') return { success: false, error: 'Action réservée aux gestionnaires' }
  const supabase = await createServiceRoleClient()

  const [{ data: apprenant }, { data: sess }] = await Promise.all([
    supabase.from('apprenants').select('*').eq('id', apprenantId).maybeSingle(),
    supabase.from('sessions').select('id, reference, intitule, date_debut, date_fin, formation:formation_id(intitule)')
      .eq('id', sessionId).eq('organization_id', session.organization.id).maybeSingle(),
  ])
  if (!apprenant || (apprenant as any).organization_id !== session.organization.id) {
    return { success: false, error: 'Apprenant introuvable' }
  }
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: supports } = await supabase.from('documents')
    .select('nom, file_name')
    .eq('session_id', sessionId)
    .eq('type', 'support_pedagogique')
  if (!supports?.length) return { success: false, error: 'Aucun support pédagogique déposé sur cette session' }

  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const formationNom = (sess as any).formation?.intitule || (sess as any).intitule || 'votre formation'
  const sujet = `Vos supports de formation — ${formationNom}`
  const intro = `Les supports pédagogiques de votre formation sont à votre disposition dans votre espace personnel. Ils restent consultables à tout moment — n'hésitez pas à y revenir pour ancrer les acquis.`
  const meta: Array<[string, string]> = [
    ['Formation', formationNom],
    ['Supports', supports.map((d: any) => d.nom || d.file_name).filter(Boolean).slice(0, 8).join(' · ')],
  ]
  const destinataire = `${(apprenant as any).prenom || ''} ${(apprenant as any).nom || ''}`.trim() || 'Madame, Monsieur'

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    const html = buildDocumentEmailHtml({
      orgName: (org as any)?.name || 'Lab Learning',
      orgEmail: (org as any)?.email_contact || (org as any)?.email,
      orgLogoUrl: (org as any)?.logo_url,
      qualiopiCertified: (org as any)?.is_qualiopi !== false,
      recipientName: destinataire,
      docTitle: 'Vos supports de formation',
      intro, metadata: meta,
      ctaLabel: 'Consulter mes supports',
      footerNote: 'Documents protégés par le droit d’auteur — usage strictement personnel.',
    })
    return { success: true, data: { html, subject: sujet, email: (apprenant as any).email } }
  }

  if (!(apprenant as any).email) return { success: false, error: "Cet apprenant n'a pas d'adresse email" }

  const { getOrCreateApprenantToken } = await import('@/lib/portal-token')
  const token = await getOrCreateApprenantToken(supabase, apprenantId, session.organization.id, (apprenant as any).email)
  const portalUrl = token ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/portail/${token}/documents` : undefined

  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    to: (apprenant as any).email,
    orgName: (org as any)?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || (org as any)?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: destinataire,
    subject: sujet,
    docTitle: 'Vos supports de formation',
    intro, metadata: meta,
    ctaLabel: portalUrl ? 'Consulter mes supports' : undefined,
    ctaUrl: portalUrl,
    footerNote: 'Documents protégés par le droit d’auteur — usage strictement personnel.',
    organizationId: session.organization.id,
    entityType: 'session',
    entityId: sessionId,
    triggeredBy: session.user.id,
  })
  if (!r.success) return { success: false, error: r.error || "L'envoi a échoué" }

  await logAudit({ action: 'send_supports', entity_type: 'apprenant', entity_id: apprenantId })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { email: (apprenant as any).email } }
}

/**
 * Le même envoi, pour tous les stagiaires de la session d'un coup.
 */
export async function envoyerMailATousAction(
  sessionId: string,
  type: MailApprenantType,
): Promise<ActionResult<{ envoyes: number; sansEmail: number; echecs: number }>> {
  if (type !== 'convocation' && type !== 'supports') return envoyerDocumentSessionAction(sessionId, type)

  const session = await getSession()
  if (session.user.role === 'formateur') {
    return { success: false, error: 'Action réservée aux gestionnaires' }
  }
  const supabase = await createServiceRoleClient()
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant_id, apprenant:apprenants(email)')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  const cibles = (inscriptions || []).filter((i: any) => i.apprenant_id)
  if (cibles.length === 0) return { success: false, error: 'Aucun stagiaire sur cette session' }

  let envoyes = 0
  let sansEmail = 0
  let echecs = 0
  for (const i of cibles as any[]) {
    if (!i.apprenant?.email) { sansEmail++; continue }
    const r = await envoyerMailApprenantAction(sessionId, i.apprenant_id, type)
    if (r.success) envoyes++
    else echecs++
  }
  return { success: true, data: { envoyes, sansEmail, echecs } }
}

/**
 * Envoie au référent de l'établissement les documents de TOUS les stagiaires,
 * en un seul courriel.
 *
 * Beaucoup de stagiaires n'ont pas d'adresse email : leur employeur, si. Le
 * référent reçoit un exemplaire par stagiaire et les remet en main propre —
 * c'est lui qui les côtoie chaque jour. Même résolution du destinataire que la
 * convocation : signataire, sinon contact principal, sinon premier contact
 * doté d'une adresse.
 */
export async function envoyerDocumentsAuReferentAction(
  sessionId: string,
  type: 'attestation' | 'certificat' | 'hygiene',
  opts?: { preview?: boolean },
): Promise<ActionResult<{ html?: string; subject?: string; email?: string | null }>> {
  const session = await getSession()
  if (session.user.role === 'formateur') {
    return { success: false, error: 'Action réservée aux gestionnaires' }
  }
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(*), formateur:formateurs(prenom, nom), client:client_id(id, raison_sociale, nom_commercial)')
    .eq('id', sessionId).eq('organization_id', session.organization.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }
  if (!(sess as any).client_id) return { success: false, error: 'Aucun établissement rattaché à la session' }

  const formation = (sess as any).formation
  if (type === 'hygiene') {
    const { estFormationHygiene } = await import('@/lib/formation-hygiene')
    if (!estFormationHygiene(formation)) {
      return { success: false, error: "Cette session ne porte pas sur l'hygiène alimentaire" }
    }
  }

  const { data: contacts } = await supabase
    .from('contacts').select('prenom, nom, email, est_signataire, est_principal')
    .eq('client_id', (sess as any).client_id)
  const list = (contacts || []) as any[]
  const ref = list.find((c) => c.est_signataire && c.email) || list.find((c) => c.est_principal && c.email) || list.find((c) => c.email)
  if (!ref?.email) return { success: false, error: "Le référent (contact de l'établissement) n'a pas d'email renseigné" }
  const referentNom = [ref.prenom, ref.nom].filter(Boolean).join(' ') || 'Madame, Monsieur'

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(*)')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')
  const inscrits = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)
    .sort((a: any, b: any) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))
  if (inscrits.length === 0) return { success: false, error: 'Aucun stagiaire sur cette session' }

  // L'assiduité de chaque stagiaire, comme sur les envois individuels.
  const { data: em } = await supabase.from('emargements')
    .select('apprenant_id, est_present').eq('session_id', sessionId)
  const dureePrevue = Number(formation?.duree_heures || 0)
  const assiduiteDe = (apprenantId: string) => {
    const lignes = (em || []).filter((e: any) => e.apprenant_id === apprenantId)
    if (lignes.length === 0) return { assiduite: undefined as number | undefined, heures: dureePrevue }
    const presents = lignes.filter((e: any) => e.est_present).length
    const pct = Math.round((presents / lignes.length) * 100)
    return { assiduite: pct, heures: Math.round(dureePrevue * pct) / 100 }
  }
  // Même règle que l'envoi automatique : aucune attestation d'hygiène à 0 heure
  const apprenants = type === 'hygiene' ? inscrits.filter((a: any) => assiduiteDe(a.id).heures > 0) : inscrits
  if (apprenants.length === 0) {
    return { success: false, error: "Aucun stagiaire n'a de présence relevée : les attestations d'hygiène attendent les émargements" }
  }

  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const formationNom = formation?.intitule || (sess as any).intitule || 'Formation'
  const clientNom = (sess as any).client?.nom_commercial || (sess as any).client?.raison_sociale || 'votre établissement'

  const LIBELLES = {
    attestation: { pluriel: 'attestations de fin de formation', titre: 'Attestations de fin de formation' },
    certificat: { pluriel: 'certificats de réalisation', titre: 'Certificats de réalisation' },
    hygiene: { pluriel: "attestations d'hygiène alimentaire", titre: "Attestations d'hygiène alimentaire" },
  }[type]

  const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  const emailParams = {
    orgName: (org as any)?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || (org as any)?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: referentNom,
    subject: `${LIBELLES.titre} — ${formationNom} (${apprenants.length} stagiaire${apprenants.length > 1 ? 's' : ''})`,
    docTitle: LIBELLES.titre,
    intro: `Veuillez trouver ci-joint les ${LIBELLES.pluriel} des ${apprenants.length} stagiaires de ${clientNom} pour la session « ${formationNom} ». Merci de remettre à chacun son exemplaire${type === 'hygiene' ? " : c'est ce document qui est présenté lors d'un contrôle sanitaire de l'établissement" : ''}.`,
    metadata: ([
      ['Formation', formationNom],
      ['Dates', `Du ${fmtFr((sess as any).date_debut)} au ${fmtFr((sess as any).date_fin || (sess as any).date_debut)}`],
      ['Établissement', clientNom],
      ['Stagiaires', apprenants.map((a: any) => `${a.prenom || ''} ${a.nom || ''}`.trim()).join(', ')],
    ]) as [string, string][],
    footerNote: `${apprenants.length} document(s) en pièce jointe — un par stagiaire.`,
  }

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { html: buildDocumentEmailHtml(emailParams), subject: emailParams.subject, email: ref.email } }
  }

  // ── Génération des documents ──
  const { createElement } = await import('react')
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const orgDoc = await withDocumentLogo(supabase, org)

  const attachments: { filename: string; content: Buffer }[] = []
  try {
    if (type === 'hygiene') {
      // Un seul PDF, une page par stagiaire : plus simple à imprimer d'un bloc.
      const { AttestationHygienePDF } = await import('@/lib/pdf/attestation-hygiene-pdf')
      const heuresParApprenant: Record<string, number> = {}
      for (const a of apprenants) heuresParApprenant[a.id] = assiduiteDe(a.id).heures
      const buffer = await renderToBuffer(createElement(AttestationHygienePDF, {
        apprenants, session: sess, formation, org: orgDoc, heuresParApprenant,
      }) as any)
      attachments.push({
        filename: `attestations-hygiene-${(sess as any).reference || 'session'}.pdf`,
        content: Buffer.from(buffer),
      })
    } else {
      const composant = type === 'attestation'
        ? (await import('@/lib/pdf/attestation-formation-pdf')).AttestationFormationPDF
        : (await import('@/lib/pdf/certificat-realisation-pdf')).CertificatRealisationPDF
      for (const a of apprenants) {
        const { assiduite, heures } = assiduiteDe(a.id)
        const buffer = await renderToBuffer(createElement(composant as any, {
          apprenant: a, session: sess, formation, org: orgDoc,
          assiduite, heuresPresence: heures,
        }) as any)
        attachments.push({
          filename: `${type}-${(a.nom || 'stagiaire')}-${(a.prenom || '')}.pdf`.replace(/\s+/g, '_'),
          content: Buffer.from(buffer),
        })
      }
    }
  } catch (e) {
    console.error('[docs referent]', e)
    return { success: false, error: 'Erreur de génération des documents' }
  }

  const [premiere, ...autres] = attachments
  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    ...emailParams,
    to: ref.email,
    pdfBuffer: premiere.content,
    pdfFilename: premiere.filename,
    extraAttachments: autres.map((x) => ({ filename: x.filename, content: x.content })),
    organizationId: session.organization.id,
    entityType: 'session',
    entityId: sessionId,
    triggeredBy: session.user.id,
  })
  if (!r.success) return { success: false, error: r.error || "L'envoi a échoué" }

  await logAudit({
    action: `send_${type}_referent`, entity_type: 'session', entity_id: sessionId,
    details: { referent: ref.email, documents: attachments.length },
  })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { email: ref.email } }
}

/**
 * Demande d'appréciation à l'entreprise cliente (indicateur 30) : le référent
 * reçoit le lien du formulaire public d'appréciation de la session. L'envoi se
 * trace ; la réponse s'enregistre dans le registre des appréciations.
 */
export async function envoyerDemandeAppreciationAction(
  sessionId: string,
  opts?: { preview?: boolean },
): Promise<ActionResult<{ html?: string; subject?: string; email?: string | null }>> {
  const session = await getSession()
  if (session.user.role === 'formateur') return { success: false, error: 'Action réservée aux gestionnaires' }
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase.from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, client_id, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)')
    .eq('id', sessionId).eq('organization_id', session.organization.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }
  if (!(sess as any).client_id) return { success: false, error: 'Aucun établissement rattaché à la session' }

  const { data: contacts } = await supabase.from('contacts')
    .select('prenom, nom, email, est_signataire, est_principal').eq('client_id', (sess as any).client_id)
  const ref = (contacts || []).find((c: any) => c.est_signataire && c.email)
    || (contacts || []).find((c: any) => c.est_principal && c.email)
    || (contacts || []).find((c: any) => c.email)
  if (!ref?.email) return { success: false, error: "Le référent de l'établissement n'a pas d'email renseigné" }

  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const formationNom = (sess as any).formation?.intitule || (sess as any).intitule || 'la formation'
  const clientNom = (sess as any).client?.nom_commercial || (sess as any).client?.raison_sociale || 'votre établissement'
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/appreciation/${sessionId}`
  const emailParams = {
    orgName: (org as any)?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || (org as any)?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: [ref.prenom, ref.nom].filter(Boolean).join(' ') || 'Madame, Monsieur',
    subject: `Votre appréciation — ${formationNom}`,
    docTitle: 'Votre avis compte',
    intro: `La formation « ${formationNom} » menée chez ${clientNom} est terminée. Deux minutes suffisent pour nous dire ce qui a bien fonctionné et ce que nous devons améliorer — votre appréciation nourrit directement notre démarche qualité.`,
    ctaLabel: 'Donner mon appréciation',
    ctaUrl: url,
    footerNote: 'Quatre questions, deux minutes — merci de votre retour.',
  }

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { html: buildDocumentEmailHtml(emailParams), subject: emailParams.subject, email: ref.email } }
  }

  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    ...emailParams,
    to: ref.email,
    organizationId: session.organization.id,
    entityType: 'session',
    entityId: sessionId,
    triggeredBy: session.user.id,
  })
  if (!r.success) return { success: false, error: r.error || "L'envoi a échoué" }

  await logAudit({ action: 'send_appreciation_entreprise', entity_type: 'session', entity_id: sessionId, details: { email: ref.email } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { email: ref.email } }
}
