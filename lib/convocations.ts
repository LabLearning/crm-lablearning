/**
 * Convocations des stagiaires, suivies PAR STAGIAIRE.
 *
 * L'ancien cron marquait la session « convoquée » dès son premier passage à
 * J-3 : un stagiaire inscrit ensuite (ou une session créée la veille) ne
 * recevait jamais rien. Désormais, un stagiaire est convoqué quand
 * l'historique des mails (email_logs) le prouve :
 *   - avec email : un mail de convocation à son adresse pour cette session ;
 *   - sans email : un mail « convocation de vos salariés » au référent de
 *     l'établissement envoyé APRÈS son inscription (il y figure).
 * La fonction est idempotente : elle n'envoie que ce qui manque.
 */

export const TEMPLATE_CONVOCATION = 'convocation'
export const TEMPLATE_CONVOCATION_REFERENT = 'convocation_referent'
/** Fenêtre d'envoi : du jour même à J+3. */
export const JOURS_AVANT = 3

const iso = (d: Date) => d.toISOString().slice(0, 10)
const fmtLong = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export interface BilanConvocations {
  emails: number
  referent: number
  whatsapp: number
  dejaConvoques: number
  sansContact: string[]
  /** Mode aperçu : ce qui partirait, sans rien envoyer */
  aEnvoyer?: string[]
}

/** La session démarre-t-elle dans la fenêtre d'envoi (aujourd'hui → J+3) ? */
export function dansFenetre(dateDebut: string | null | undefined, maintenant = new Date()): boolean {
  if (!dateDebut) return false
  const j0 = iso(maintenant)
  const fin = new Date(maintenant); fin.setDate(fin.getDate() + JOURS_AVANT)
  const d = String(dateDebut).slice(0, 10)
  return d >= j0 && d <= iso(fin)
}

/**
 * Envoie la convocation à chaque stagiaire actif de la session qui ne l'a pas
 * encore reçue. `triggeredBy` : utilisateur à l'origine (null = automatique).
 */
export async function envoyerConvocationsManquantes(
  supabase: any,
  sessionId: string,
  opts: { triggeredBy?: string | null; apercu?: boolean } = {},
): Promise<BilanConvocations> {
  const bilan: BilanConvocations = { emails: 0, referent: 0, whatsapp: 0, dejaConvoques: 0, sansContact: [], aEnvoyer: opts.apercu ? [] : undefined }

  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id, reference, date_debut, date_fin, lieu, horaires, horaires_jours, formation_id, client_id, status, poei_intervention_id, formation:formation_id(*), formateur:formateurs(prenom, nom, email, user_id)')
    .eq('id', sessionId).maybeSingle()
  if (!sess || ['annulee', 'terminee'].includes(sess.status)) return bilan

  // Les POEI ont leur propre circuit (attestation d'entrée avec lieu, horaires
  // et planning, envoyée depuis l'onglet Mails de la POEI) : pas de
  // convocation standard en doublon.
  if ((sess as any).poei_intervention_id) return bilan
  const { data: poei } = await supabase.from('poei').select('id').eq('session_id', sessionId).maybeSingle()
  if (poei) return bilan

  const [{ data: inscriptions }, { data: logs }] = await Promise.all([
    supabase.from('inscriptions')
      .select('created_at, apprenant:apprenants(id, civilite, prenom, nom, email, user_id, whatsapp, whatsapp_opt_in)')
      .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")'),
    supabase.from('email_logs')
      .select('to_email, template, subject, status, created_at')
      .eq('entity_id', sessionId).neq('status', 'failed'),
  ])
  const estConvoc = (l: any) => l.template === TEMPLATE_CONVOCATION || /^convocation\b/i.test(l.subject || '')
  const estReferent = (l: any) => l.template === TEMPLATE_CONVOCATION_REFERENT || /^convocation de vos salari/i.test(l.subject || '')
  const recus = new Set((logs || []).filter(estConvoc).map((l: any) => String(l.to_email || '').toLowerCase()))
  const envoisReferent = (logs || []).filter(estReferent).map((l: any) => l.created_at as string)

  const { data: org } = await supabase.from('organizations').select('*').eq('id', sess.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const orgDoc = await withDocumentLogo(supabase, org)
  const { sendDocumentEmail, createNotification, blocDocumentsAccueil } = await import('@/lib/email')
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { ConvocationPDF } = await import('@/lib/pdf/convocation-pdf')

  const formation: any = (sess as any).formation
  const formationNom = formation?.intitule || 'Formation'
  const dateStr = new Date(sess.date_debut).toLocaleDateString('fr-FR')
  const debut = fmtLong(sess.date_debut)
  const fin = fmtLong(sess.date_fin || sess.date_debut)
  const lieu = sess.lieu || 'le lieu indiqué dans votre convocation'
  const commun = {
    orgName: org?.name || 'Lab Learning',
    orgEmail: org?.email_contact || org?.email,
    orgLogoUrl: org?.logo_url,
    qualiopiCertified: org?.is_qualiopi !== false,
    organizationId: sess.organization_id,
    entityType: 'session',
    entityId: sess.id,
    triggeredBy: opts.triggeredBy || undefined,
  }

  const sansEmail: any[] = []
  for (const ins of inscriptions || []) {
    const a: any = (ins as any).apprenant
    if (!a) continue
    if (!a.email) {
      // Couvert si un mail au référent est parti après son inscription
      if (envoisReferent.some((t: string) => t >= (ins as any).created_at)) bilan.dejaConvoques++
      else sansEmail.push(a)
      continue
    }
    if (recus.has(String(a.email).toLowerCase())) { bilan.dejaConvoques++; continue }
    if (opts.apercu) { bilan.aEnvoyer!.push(`${a.prenom || ''} ${a.nom || ''} <${a.email}>`.trim()); continue }

    try {
      const buffer = await renderToBuffer(createElement(ConvocationPDF, {
        apprenant: a, session: sess, formation, org: orgDoc, formateur: (sess as any).formateur,
      }) as any)
      const r = await sendDocumentEmail({
        ...commun,
        to: a.email,
        recipientName: [a.civilite, a.prenom, a.nom].filter(Boolean).join(' ').trim() || 'Madame, Monsieur',
        subject: `Convocation — ${formationNom} (${dateStr})`,
        docTitle: 'Convocation à votre formation',
        intro: `Nous avons le plaisir de vous convoquer à la session de formation suivante. Vous trouverez votre convocation détaillée en pièce jointe.${blocDocumentsAccueil(org as any)}`,
        metadata: [['Formation', formationNom], ['Début', debut], ['Fin', fin], ['Lieu', lieu]],
        pdfBuffer: Buffer.from(buffer),
        pdfFilename: `convocation-${a.nom || 'stagiaire'}.pdf`,
        footerNote: 'Merci de vous présenter 15 minutes avant le début de la session avec une pièce d’identité.',
        templateSlug: TEMPLATE_CONVOCATION,
      } as any)
      if (r.success) {
        bilan.emails++
        recus.add(String(a.email).toLowerCase())
      }
    } catch (e) { console.error('[convocation stagiaire]', e) }

    if (a.user_id) {
      await createNotification({
        organizationId: sess.organization_id, userId: a.user_id,
        titre: 'Convocation à votre formation',
        message: `Votre formation « ${formationNom} » commence le ${dateStr}${sess.lieu ? ` à ${sess.lieu}` : ''}.`,
        type: 'session', lienUrl: '/mon-espace', lienLabel: 'Voir ma formation', entityType: 'session', entityId: sess.id,
      }).catch(() => {})
    }
    if (a.whatsapp_opt_in && a.whatsapp) {
      try {
        const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')
        const r = await sendWhatsAppTemplate({
          organizationId: sess.organization_id, to: a.whatsapp, toName: `${a.prenom || ''} ${a.nom || ''}`.trim(),
          template: 'convocation_j3', languageCode: 'fr',
          bodyParams: [[a.civilite, a.nom].filter(Boolean).join(' ').trim() || 'Madame, Monsieur', formationNom, debut, fin, lieu],
          entityType: 'session', entityId: sess.id,
        })
        if (r.ok) bilan.whatsapp++
      } catch { /* WhatsApp facultatif */ }
    }
  }

  // Stagiaires sans email : un seul mail au référent de l'établissement
  if (sansEmail.length && opts.apercu) {
    bilan.aEnvoyer!.push(`référent de l'établissement pour : ${sansEmail.map((a) => [a.prenom, a.nom].filter(Boolean).join(' ')).join(', ')}`)
  } else if (sansEmail.length) {
    const noms = sansEmail.map((a) => [a.prenom, a.nom].filter(Boolean).join(' '))
    let contact: any = null
    if (sess.client_id) {
      const { loadSignataireContact } = await import('@/lib/pdf/convention-data')
      contact = await loadSignataireContact(supabase, sess.client_id, null).catch(() => null)
      if (!contact?.email) {
        const { data: c } = await supabase.from('contacts').select('prenom, nom, email')
          .eq('client_id', sess.client_id).not('email', 'is', null).order('created_at').limit(1).maybeSingle()
        contact = c
      }
      if (!contact?.email) {
        const { data: cli } = await supabase.from('clients').select('email, raison_sociale, nom_commercial').eq('id', sess.client_id).maybeSingle()
        if (cli?.email) contact = { email: cli.email, prenom: null, nom: cli.nom_commercial || cli.raison_sociale }
      }
    }
    if (contact?.email) {
      const r = await sendDocumentEmail({
        ...commun,
        to: contact.email,
        recipientName: [contact.prenom, contact.nom].filter(Boolean).join(' ') || 'Madame, Monsieur',
        subject: `Convocation de vos salariés — ${formationNom} (${dateStr})`,
        docTitle: 'Convocation à transmettre à vos salariés',
        intro: `Certains de vos salariés inscrits à la session n’ont pas d’adresse email individuelle : nous vous transmettons leur convocation, à leur remettre. Stagiaires concernés : <strong>${noms.join(', ')}</strong>.${blocDocumentsAccueil(org as any)}`,
        metadata: [
          ['Formation', formationNom],
          ['Début', new Date(sess.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
          ['Lieu', sess.lieu || 'votre établissement'],
        ],
        templateSlug: TEMPLATE_CONVOCATION_REFERENT,
      } as any)
      if (r.success) bilan.referent += sansEmail.length
    } else {
      bilan.sansContact.push(...noms)
    }
  }

  return bilan
}

/**
 * À appeler après une inscription : si la session démarre dans les 3 jours,
 * la convocation part tout de suite (sinon le cron s'en charge à J-3).
 * Ne lève jamais : un échec d'envoi ne doit pas bloquer l'inscription.
 */
export async function convoquerSiImminente(supabase: any, sessionId: string, triggeredBy?: string | null): Promise<void> {
  try {
    const { data: s } = await supabase.from('sessions').select('date_debut').eq('id', sessionId).maybeSingle()
    if (!dansFenetre(s?.date_debut)) return
    await envoyerConvocationsManquantes(supabase, sessionId, { triggeredBy })
  } catch (e) { console.error('[convocation immédiate]', e) }
}
