/**
 * Cron J-3 : envoie convocations apprenants + fiche mission formateur
 * pour toutes les sessions qui démarrent dans 3 jours et n'ont pas
 * encore reçu de convocations.
 *
 * Appel externe (cron Vercel ou manuel) :
 *   GET /api/cron/convocations?secret=...
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Auth : Vercel Cron envoie Authorization: Bearer <CRON_SECRET>
  // Aussi accepté : ?secret=... pour test manuel
  const authHeader = req.headers.get('authorization')
  const { searchParams } = new URL(req.url)
  const querySecret = searchParams.get('secret')
  const expected = process.env.CRON_SECRET

  const headerOk = authHeader === `Bearer ${expected}`
  const queryOk = querySecret === expected || querySecret === process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!headerOk && !queryOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  // Date cible : J+3 (sessions qui démarrent dans 3 jours)
  const target = new Date()
  target.setDate(target.getDate() + 3)
  const targetDate = target.toISOString().split('T')[0]

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, organization_id, reference, date_debut, date_fin, lieu, horaires,
      formateur_id,
      formation:formation_id(intitule),
      formateur:formateurs(prenom, nom, email, user_id)
    `)
    .eq('date_debut', targetDate)
    .is('convocations_sent_at', null)
    .neq('status', 'annulee')
    .neq('status', 'terminee')

  const { createNotification, sendDocumentEmail } = await import('@/lib/email')
  const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { ConvocationPDF } = await import('@/lib/pdf/convocation-pdf')

  let processed = 0
  let totalApprenants = 0
  let totalWhatsApp = 0
  let totalEmails = 0

  // Cache des org pour éviter de re-fetcher à chaque apprenant
  const orgCache: Record<string, any> = {}
  const getOrg = async (id: string) => {
    if (orgCache[id]) return orgCache[id]
    const { data } = await supabase.from('organizations').select('*').eq('id', id).single()
    orgCache[id] = data
    return data
  }

  const fmtDateLong = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  for (const sess of sessions || []) {
    const { data: inscriptions } = await supabase
      .from('inscriptions')
      .select('apprenant:apprenants(id, civilite, prenom, nom, email, user_id, whatsapp, whatsapp_opt_in)')
      .eq('session_id', sess.id)
      .not('status', 'in', '("annule","abandonne")')

    const formationNom = (sess as any).formation?.intitule || 'Formation'
    const dateStr = new Date(sess.date_debut).toLocaleDateString('fr-FR')
    const dateDebutLong = fmtDateLong(sess.date_debut)
    const dateFinLong = fmtDateLong(sess.date_fin || sess.date_debut)
    const lieuStr = sess.lieu || 'le lieu indiqué dans votre convocation'

    // Notifier chaque apprenant qui a un user_id
    for (const ins of inscriptions || []) {
      const a = (ins as any).apprenant
      if (a?.user_id) {
        await createNotification({
          organizationId: sess.organization_id,
          userId: a.user_id,
          titre: 'Convocation à votre formation',
          message: `Votre formation "${formationNom}" commence le ${dateStr} ${sess.lieu ? `à ${sess.lieu}` : ''}.`,
          type: 'session',
          lienUrl: `/mon-espace`,
          lienLabel: 'Voir ma formation',
          entityType: 'session',
          entityId: sess.id,
        })
        totalApprenants++
      }

      // WhatsApp (si opt-in + numéro) — template "convocation_j3" (5 variables)
      if (a?.whatsapp_opt_in && a?.whatsapp) {
        const nomComplet = [a.civilite, a.nom].filter(Boolean).join(' ').trim()
          || `${a.prenom || ''} ${a.nom || ''}`.trim()
          || 'Madame, Monsieur'
        const r = await sendWhatsAppTemplate({
          organizationId: sess.organization_id,
          to: a.whatsapp,
          toName: `${a.prenom || ''} ${a.nom || ''}`.trim(),
          template: 'convocation_j3',
          languageCode: 'fr',
          bodyParams: [
            nomComplet,        // {{1}} civilité + nom
            formationNom,      // {{2}} formation
            dateDebutLong,     // {{3}} date de début
            dateFinLong,       // {{4}} date de fin
            lieuStr,           // {{5}} adresse / lieu
          ],
          entityType: 'session',
          entityId: sess.id,
        })
        if (r.ok) totalWhatsApp++
      }

      // Email convocation (PDF joint, brandé)
      if (a?.email) {
        try {
          const org = await getOrg(sess.organization_id)
          const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
          const orgDoc = await withDocumentLogo(supabase, org)
          const formation = await supabase.from('formations').select('*').eq('id', (sess as any).formation_id).single()
          const buffer = await renderToBuffer(createElement(ConvocationPDF, {
            apprenant: a,
            session: sess,
            formation: formation.data,
            org: orgDoc,
            formateur: (sess as any).formateur,
          }) as any)
          await sendDocumentEmail({
            to: a.email,
            orgName: org?.name || 'Lab Learning',
            orgEmail: org?.email_contact || org?.email,
            orgLogoUrl: org?.logo_url,
            qualiopiCertified: org?.is_qualiopi !== false,
            recipientName: [a.civilite, a.prenom, a.nom].filter(Boolean).join(' ').trim() || 'Madame, Monsieur',
            subject: `Convocation — ${formationNom} (${dateStr})`,
            docTitle: 'Convocation à votre formation',
            intro: `Nous avons le plaisir de vous convoquer à la session de formation suivante. Vous trouverez votre convocation détaillée en pièce jointe.`,
            metadata: [
              ['Formation', formationNom],
              ['Début', dateDebutLong],
              ['Fin', dateFinLong],
              ['Lieu', lieuStr],
            ],
            pdfBuffer: Buffer.from(buffer),
            pdfFilename: `convocation-${a.nom || 'stagiaire'}.pdf`,
            footerNote: 'Merci de vous présenter 15 minutes avant le début de la session avec une pièce d\'identité.',
          })
          totalEmails++
        } catch (e) { console.error('[email convoc]', e) }
      }
    }

    // Notifier le formateur (fiche mission récap)
    const formateur = (sess as any).formateur
    if (formateur?.user_id) {
      const nbParticipants = (inscriptions || []).length
      await createNotification({
        organizationId: sess.organization_id,
        userId: formateur.user_id,
        titre: 'Fiche de mission — formation à J-3',
        message: `Votre mission "${(sess as any).formation?.intitule}" démarre le ${new Date(sess.date_debut).toLocaleDateString('fr-FR')}. ${nbParticipants} apprenant${nbParticipants > 1 ? 's' : ''} inscrit${nbParticipants > 1 ? 's' : ''}.`,
        type: 'session',
        lienUrl: `/dashboard/sessions/${sess.id}`,
        lienLabel: 'Voir la fiche',
        entityType: 'session',
        entityId: sess.id,
      })
    }

    await supabase
      .from('sessions')
      .update({ convocations_sent_at: new Date().toISOString() })
      .eq('id', sess.id)

    processed++
  }

  return NextResponse.json({
    targetDate,
    sessions_processed: processed,
    apprenants_notifies: totalApprenants,
    whatsapp_envoyes: totalWhatsApp,
    emails_envoyes: totalEmails,
  })
}
