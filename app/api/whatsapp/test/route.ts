/**
 * Endpoint de diagnostic WhatsApp.
 * Vérifie que la config (env Vercel) est bien prise en compte par l'app
 * et envoie un message de test via la couche CRM (lib/whatsapp).
 *
 * GET /api/whatsapp/test?secret=...&to=33XXXXXXXXX[&template=hello_world&lang=en_US]
 *   - secret = CRON_SECRET ou SUPABASE_SERVICE_ROLE_KEY
 *   - to     = numéro destinataire (test recipient validé côté Meta)
 *
 * Réponse : { configured, status, ... }
 *   status 'sent'  → tout fonctionne (env OK)
 *   status 'dev'   → env non détectée (redeploy nécessaire)
 *   status 'failed'→ erreur Meta (détail dans error)
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendWhatsAppTemplate, isWhatsAppConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  const ok = secret === expected || secret === process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const to = searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'paramètre "to" requis' }, { status: 400 })

  const template = searchParams.get('template') || 'hello_world'
  const lang = searchParams.get('lang') || 'en_US'

  const supabase = await createServiceRoleClient()
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single()

  const result = await sendWhatsAppTemplate({
    organizationId: org?.id || '00000000-0000-0000-0000-000000000000',
    to,
    template,
    languageCode: lang,
    entityType: 'test',
  })

  return NextResponse.json({
    configured: isWhatsAppConfigured(),
    phone_number_id_present: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    token_present: !!process.env.WHATSAPP_ACCESS_TOKEN,
    ...result,
  })
}
