import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ORG = process.env.DENDREO_DEFAULT_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const WEBHOOK_KEY = process.env.DENDREO_WEBHOOK_KEY || ''

// Vérifie la clé webhook : transmise soit en query (?token=...), soit dans un
// en-tête. On enregistre l'URL côté Dendreo avec ?token=DENDREO_WEBHOOK_KEY.
function isAuthorized(req: Request): boolean {
  if (!WEBHOOK_KEY) return false
  const url = new URL(req.url)
  const q = url.searchParams.get('token') || url.searchParams.get('key')
  const h = req.headers.get('x-dendreo-token') || req.headers.get('x-webhook-token')
  return q === WEBHOOK_KEY || h === WEBHOOK_KEY
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: any = null
  try { payload = await req.json() } catch { payload = await req.text().catch(() => null) }

  // Format Dendreo : { event: "<resource>.<verbe>", timestamp, "<resource>": {objet} }
  const p = payload && typeof payload === 'object' ? payload : {}
  const eventType: string | null = p.event || p.type || p.action || p.evenement || null
  const resource: string | null = eventType ? eventType.split('.')[0] : (p.resource || null)
  const obj = resource && p[resource] && typeof p[resource] === 'object' ? p[resource] : null
  const resourceId = obj
    ? (obj.id ?? obj[`id_${resource}`] ?? Object.entries(obj).find(([k]) => /^id_/.test(k) && !/^id_(add|edit|delete)$/.test(k))?.[1] ?? null)
    : (p.id ?? p.resource_id ?? null)

  try {
    const supabase = await createServiceRoleClient()
    await supabase.from('dendreo_webhook_events').insert({
      organization_id: ORG,
      event_type: eventType ? String(eventType) : null,
      resource: resource ? String(resource) : null,
      resource_id: resourceId != null ? String(resourceId) : null,
      payload: payload ?? null,
      status: 'received',
    })
  } catch (e) {
    console.error('[dendreo webhook] log error', e)
    // On répond 200 quand même pour éviter que Dendreo ne rejoue en boucle
  }

  // TODO (sync) : router selon event_type/resource vers un handler qui met à
  // jour l'entité CRM correspondante par dendreo_id (cf. migration/dendreo-sync.mjs).
  return NextResponse.json({ ok: true })
}

// Ping de vérification (Dendreo / test manuel)
export async function GET(req: Request) {
  return NextResponse.json({ ok: true, authorized: isAuthorized(req) })
}
