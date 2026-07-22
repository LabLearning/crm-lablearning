/**
 * Cron : relance des factures impayées échues.
 * Pour chaque facture en retard (échéance dépassée, reste à payer > 0) non
 * relancée depuis 7 jours : passe le statut en 'en_retard', envoie une relance
 * au client (WhatsApp si opt-in) et notifie les gestionnaires.
 *
 * GET /api/cron/relances-factures?secret=...
 */
import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const RELANCE_INTERVAL_DAYS = 7

export async function GET(req: Request) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized

  const supabase = await createServiceRoleClient()
  const today = new Date().toISOString().split('T')[0]
  const cutoff = new Date(Date.now() - RELANCE_INTERVAL_DAYS * 86400000).toISOString()

  // Factures échues, non soldées, non annulées/brouillon
  const { data: factures } = await supabase
    .from('factures')
    .select('id, organization_id, numero, montant_restant, montant_ttc, date_echeance, status, relance_count, derniere_relance_at, client:clients(raison_sociale, email, whatsapp, whatsapp_opt_in)')
    .in('status', ['emise', 'envoyee', 'payee_partiellement', 'en_retard'])
    .lt('date_echeance', today)
    .gt('montant_restant', 0)

  const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')
  const { createNotifications, sendDocumentEmail } = await import('@/lib/email')

  // Cache org par organization_id pour éviter re-fetch
  const orgCache: Record<string, any> = {}
  const getOrg = async (id: string) => {
    if (orgCache[id]) return orgCache[id]
    const { data } = await supabase.from('organizations').select('*').eq('id', id).single()
    orgCache[id] = data
    return data
  }

  let relancees = 0
  let whatsappEnvoyes = 0
  let emailsEnvoyes = 0

  for (const f of factures || []) {
    // Throttle : pas relancée depuis RELANCE_INTERVAL_DAYS
    if (f.derniere_relance_at && f.derniere_relance_at > cutoff) continue

    const montant = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(f.montant_restant || 0))
    const echeance = new Date(f.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const cli = (f as any).client

    // WhatsApp au client (si opt-in)
    if (cli?.whatsapp_opt_in && cli?.whatsapp) {
      const r = await sendWhatsAppTemplate({
        organizationId: f.organization_id,
        to: cli.whatsapp,
        toName: cli.raison_sociale || '',
        template: 'relance_facture',
        languageCode: 'fr',
        bodyParams: [f.numero || '', montant, echeance],
        entityType: 'facture',
        entityId: f.id,
      })
      if (r.ok) whatsappEnvoyes++
    }

    // Email relance avec facture PDF jointe au client
    if (cli?.email) {
      try {
        const org = await getOrg(f.organization_id)
        const { data: factureFull } = await supabase
          .from('factures')
          .select('*, client:clients(*), formation:formations(intitule), lignes:facture_lignes(*), paiements(*)')
          .eq('id', f.id).single()
        if (factureFull) {
          const { renderToBuffer } = await import('@react-pdf/renderer')
          const { createElement } = await import('react')
          const { FacturePDF } = await import('@/lib/pdf/facture-pdf')
          const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
          const orgDoc = await withDocumentLogo(supabase, org)
          const buffer = await renderToBuffer(createElement(FacturePDF, { facture: factureFull as any, org: orgDoc }) as any)
          const relanceNum = (f.relance_count || 0) + 1
          await sendDocumentEmail({
            to: cli.email,
            orgName: org?.name || 'Lab Learning',
            orgEmail: (org as any)?.email_contact || org?.email,
            orgLogoUrl: (org as any)?.logo_url,
            qualiopiCertified: (org as any)?.is_qualiopi !== false,
            recipientName: cli.raison_sociale || 'Madame, Monsieur',
            subject: `Relance — Facture ${f.numero} échue (${montant})`,
            docTitle: `Relance n°${relanceNum} — Facture ${f.numero}`,
            intro: `Sauf erreur de notre part, votre facture est arrivée à échéance et reste impayée à ce jour. Vous trouverez ci-joint la facture concernée.`,
            metadata: [
              ['Montant dû', montant],
              ['Échéance dépassée le', echeance],
              ['Référence', f.numero || ''],
            ],
            pdfBuffer: Buffer.from(buffer),
            pdfFilename: `facture-${f.numero}.pdf`,
            footerNote: 'Merci de procéder au règlement dans les meilleurs délais. Si vous avez déjà réglé, ignorez ce message.',
          })
          emailsEnvoyes++
        }
      } catch (e) { console.error('[email relance]', e) }
    }

    // Maj facture : statut en_retard + suivi relance
    await supabase
      .from('factures')
      .update({
        status: 'en_retard',
        relance_count: (f.relance_count || 0) + 1,
        derniere_relance_at: new Date().toISOString(),
      })
      .eq('id', f.id)

    // Notifier les gestionnaires
    const { data: admins } = await supabase
      .from('users').select('id')
      .eq('organization_id', f.organization_id)
      .in('role', ['super_admin', 'gestionnaire', 'comptable'])
      .eq('status', 'active')
    if (admins && admins.length > 0) {
      await createNotifications(admins.map((u: any) => ({
        organizationId: f.organization_id,
        userId: u.id,
        titre: 'Facture en retard',
        message: `Facture ${f.numero} (${cli?.raison_sociale || 'client'}) : ${montant} échue le ${echeance}.`,
        type: 'warning',
        lienUrl: '/dashboard/factures',
        lienLabel: 'Voir la facture',
        entityType: 'facture',
        entityId: f.id,
      })))
    }

    relancees++
  }

  return NextResponse.json({ date: today, factures_relancees: relancees, whatsapp_envoyes: whatsappEnvoyes, emails_envoyes: emailsEnvoyes })
}
