/**
 * Cron : relance des factures impayées échues.
 * Pour chaque facture en retard (échéance dépassée, reste à payer > 0) non
 * relancée depuis 7 jours : passe le statut en 'en_retard', envoie une relance
 * au client (WhatsApp si opt-in) et notifie les gestionnaires.
 *
 * GET /api/cron/relances-factures?secret=...
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const RELANCE_INTERVAL_DAYS = 7

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  const ok = authHeader === `Bearer ${expected}` || secret === expected || secret === process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const today = new Date().toISOString().split('T')[0]
  const cutoff = new Date(Date.now() - RELANCE_INTERVAL_DAYS * 86400000).toISOString()

  // Factures échues, non soldées, non annulées/brouillon
  const { data: factures } = await supabase
    .from('factures')
    .select('id, organization_id, numero, montant_restant, montant_ttc, date_echeance, status, relance_count, derniere_relance_at, client:clients(raison_sociale, whatsapp, whatsapp_opt_in)')
    .in('status', ['emise', 'envoyee', 'payee_partiellement', 'en_retard'])
    .lt('date_echeance', today)
    .gt('montant_restant', 0)

  const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')
  const { createNotifications } = await import('@/lib/email')

  let relancees = 0
  let whatsappEnvoyes = 0

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

  return NextResponse.json({ date: today, factures_relancees: relancees, whatsapp_envoyes: whatsappEnvoyes })
}
