/**
 * Génère un PDF avec les QR codes de tous les apprenants d'une session.
 * Chaque QR pointe vers le portail apprenant avec un token unique
 * (créé à la volée si l'apprenant n'en a pas).
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'crypto'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceRoleClient()

  // Deux accès : l'admin connecté, ou le formateur via son token de portail
  // (c'est lui qui projette les QR en salle). Dans les deux cas, la session doit
  // relever de l'organisation / du formateur concerné.
  const portalToken = new URL(req.url).searchParams.get('token')
  let orgId: string | null = null
  let formateurId: string | null = null
  if (portalToken) {
    const { getPortalContext } = await import('@/lib/portal-auth')
    const context = await getPortalContext(portalToken)
    if (!context || context.type !== 'formateur') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    orgId = context.organization.id
    formateurId = context.formateur.id
  } else {
    const { getSession } = await import('@/lib/auth')
    const session = await getSession()
    orgId = session.organization.id
  }

  let query = supabase
    .from('sessions')
    .select('id, organization_id, reference, date_debut, date_fin, formateur_id, formation:formation_id(intitule)')
    .eq('id', params.id)
    .eq('organization_id', orgId)
  const { data: sess } = await query.single()
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  // Le formateur ne peut projeter que les QR de SES sessions
  if (formateurId && sess.formateur_id !== formateurId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(id, prenom, nom, email)')
    .eq('session_id', params.id)
    .not('status', 'in', '("annule","abandonne")')

  const apprenants = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  // Pour chaque apprenant : récupère ou crée un token portail
  const items: Array<{ apprenant: any; url: string; qrDataUrl: string }> = []

  for (const a of apprenants) {
    let { data: tokenRow } = await supabase
      .from('portal_access_tokens')
      .select('token')
      .eq('type', 'apprenant')
      .eq('apprenant_id', a.id)
      .eq('organization_id', sess.organization_id)
      .eq('is_active', true)
      .maybeSingle()

    let token = tokenRow?.token
    if (!token) {
      token = createHash('sha256').update(randomBytes(32)).digest('hex')
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 2)
      await supabase.from('portal_access_tokens').insert({
        organization_id: sess.organization_id,
        type: 'apprenant',
        apprenant_id: a.id,
        email: a.email,
        token,
        is_active: true,
        expires_at: expiresAt.toISOString(),
      })
    }

    const portalUrl = `${appUrl}/portail/${token}`
    const qrDataUrl = await QRCode.toDataURL(portalUrl, { width: 300, margin: 1 })
    items.push({ apprenant: a, url: portalUrl, qrDataUrl })
  }

  // HTML imprimable (browser print to PDF)
  const formationName = (sess as any).formation?.intitule || 'Formation'
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>QR codes — ${formationName}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px 0; }
  .subtitle { font-size: 12px; color: #666; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
  .card img { display: block; margin: 8px auto; }
  .name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
  .email { font-size: 11px; color: #888; margin-bottom: 8px; }
  .url { font-size: 9px; color: #aaa; word-break: break-all; margin-top: 8px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head><body>
<h1>${formationName}</h1>
<div class="subtitle">${sess.reference || ''} — Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin).toLocaleDateString('fr-FR')}</div>
<div class="no-print" style="margin-bottom:16px;font-size:12px;color:#888;">Imprimez cette page (Ctrl+P / Cmd+P) ou enregistrez en PDF pour distribuer aux apprenants.</div>
<div class="grid">
${items.map(it => `
  <div class="card">
    <div class="name">${it.apprenant.prenom} ${it.apprenant.nom}</div>
    ${it.apprenant.email ? `<div class="email">${it.apprenant.email}</div>` : ''}
    <img src="${it.qrDataUrl}" alt="QR code" width="200" height="200" />
    <div class="url">${it.url}</div>
  </div>
`).join('')}
</div>
</body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
