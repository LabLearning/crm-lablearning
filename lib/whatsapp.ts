/**
 * Canal WhatsApp — Meta Cloud API (graph.facebook.com).
 *
 * Messages "business-initiated" (rappels J-2, convocations…) → templates
 * pré-approuvés obligatoires côté Meta Business Manager.
 *
 * Variables d'environnement à configurer (quand le compte Meta est prêt) :
 *   WHATSAPP_PHONE_NUMBER_ID   (ID du numéro Business dans Meta)
 *   WHATSAPP_ACCESS_TOKEN      (token permanent System User)
 *   WHATSAPP_API_VERSION       (optionnel, défaut v21.0)
 *
 * Tant que ces variables ne sont pas définies : mode DEV → log console + log
 * en base avec status 'dev', aucun appel réseau (rien ne casse les flux email).
 */

const GRAPH = 'https://graph.facebook.com'

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN)
}

/**
 * Normalise un numéro français/intl en E.164 sans le "+" (format Meta).
 * "06 12 34 56 78" → "33612345678" · "+33612..." → "33612..."
 * Retourne null si non exploitable.
 */
export function toE164(raw: string | null | undefined, defaultCountry = '33'): string | null {
  if (!raw) return null
  let s = raw.replace(/[^\d+]/g, '')
  if (s.startsWith('+')) return s.slice(1)
  if (s.startsWith('00')) return s.slice(2)
  if (s.startsWith('0')) return defaultCountry + s.slice(1) // 06... → 336...
  if (s.startsWith(defaultCountry)) return s
  return s || null
}

interface SendTemplateParams {
  organizationId: string
  to: string                         // numéro brut, sera normalisé
  toName?: string
  template: string                   // nom du template Meta
  languageCode?: string              // défaut 'fr'
  // Paramètres positionnels du corps ({{1}}, {{2}}…)
  bodyParams?: string[]
  // Paramètre du bouton URL dynamique (suffixe ajouté à l'URL, ex: token de signature)
  buttonUrlParam?: string
  // Document joint en en-tête (template avec header DOCUMENT, ex: livret d'accueil PDF)
  headerDocument?: { link: string; filename?: string }
  entityType?: string
  entityId?: string
}

/**
 * Envoie un template WhatsApp. Best-effort : ne jette jamais.
 * Journalise dans whatsapp_logs.
 */
export async function sendWhatsAppTemplate(params: SendTemplateParams): Promise<{ ok: boolean; status: string; error?: string }> {
  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceRoleClient()

  const number = toE164(params.to)
  const lang = params.languageCode || 'fr'

  const log = async (status: string, extra: { providerMessageId?: string; error?: string } = {}) => {
    try {
      await supabase.from('whatsapp_logs').insert({
        organization_id: params.organizationId,
        to_number: number || params.to || '',
        to_name: params.toName || null,
        template: params.template,
        variables: params.bodyParams ? { body: params.bodyParams } : null,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        status,
        provider_message_id: extra.providerMessageId || null,
        error: extra.error || null,
      })
    } catch (e) { console.error('[whatsapp log]', e) }
  }

  if (!number) {
    await log('skipped', { error: 'Numéro invalide' })
    return { ok: false, status: 'skipped', error: 'Numéro invalide' }
  }

  // Mode DEV : pas de credentials → on log et on n'appelle pas Meta
  if (!isWhatsAppConfigured()) {
    console.log(`[WhatsApp DEV] → ${number} | template "${params.template}" | params:`, params.bodyParams)
    await log('dev')
    return { ok: true, status: 'dev' }
  }

  const version = process.env.WHATSAPP_API_VERSION || 'v21.0'
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN

  const body: any = {
    messaging_product: 'whatsapp',
    to: number,
    type: 'template',
    template: {
      name: params.template,
      language: { code: lang },
    },
  }
  const components: any[] = []
  if (params.headerDocument?.link) {
    components.push({
      type: 'header',
      parameters: [{
        type: 'document',
        document: {
          link: params.headerDocument.link,
          ...(params.headerDocument.filename ? { filename: params.headerDocument.filename } : {}),
        },
      }],
    })
  }
  if (params.bodyParams && params.bodyParams.length > 0) {
    components.push({ type: 'body', parameters: params.bodyParams.map((t) => ({ type: 'text', text: t })) })
  }
  if (params.buttonUrlParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: params.buttonUrlParam }],
    })
  }
  if (components.length > 0) body.template.components = components

  try {
    const res = await fetch(`${GRAPH}/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = json?.error?.message || `HTTP ${res.status}`
      await log('failed', { error: err })
      return { ok: false, status: 'failed', error: err }
    }
    await log('sent', { providerMessageId: json?.messages?.[0]?.id })
    return { ok: true, status: 'sent' }
  } catch (e: any) {
    await log('failed', { error: e?.message || 'Erreur réseau' })
    return { ok: false, status: 'failed', error: e?.message }
  }
}
