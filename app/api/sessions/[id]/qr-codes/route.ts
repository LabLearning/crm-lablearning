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

/** Noms, adresses et intitulés viennent d'autres saisies : rien n'entre brut dans la page. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
    if (session.user.role === 'formateur') {
      // Espace connecté du formateur (/mon-espace, sans token dans l'URL) :
      // mêmes droits que par son lien de portail, ses sessions seulement
      const { data: fiche } = await supabase
        .from('formateurs')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (!fiche) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      formateurId = fiche.id
    } else {
      // La planche donne l'accès permanent au portail de chaque stagiaire :
      // les autres comptes externes (apprenant, apporteur, franchise) n'y ont
      // pas droit, l'équipe garde la règle de la fiche session
      const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
      if (!checkDashboardAccess('/dashboard/sessions', session.user.role as any, session.permissions).allowed) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }
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

  const apprenants = ((inscriptions || []).map((i: any) => i.apprenant).filter(Boolean) as any[])
    .sort((x, y) => `${x.nom} ${x.prenom}`.localeCompare(`${y.nom} ${y.prenom}`, 'fr'))
  // ?vue=projection : un stagiaire par écran, pour le vidéoprojecteur (sinon la planche imprimable)
  const projection = new URL(req.url).searchParams.get('vue') === 'projection'
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
      await supabase.from('portal_access_tokens').insert({
        organization_id: sess.organization_id,
        type: 'apprenant',
        apprenant_id: a.id,
        email: a.email,
        token,
        is_active: true,
        expires_at: null,   // les liens de portail n'expirent pas
      })
    }

    const portalUrl = `${appUrl}/portail/${token}`
    // Plus fin pour la projection : le QR occupe une grande partie de l'écran
    const qrDataUrl = await QRCode.toDataURL(portalUrl, { width: projection ? 640 : 300, margin: 1 })
    items.push({ apprenant: a, url: portalUrl, qrDataUrl })
  }

  if (projection) return pageProjection(sess, items)

  // HTML imprimable (browser print to PDF)
  const formationName = (sess as any).formation?.intitule || 'Formation'
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>QR codes — ${esc(formationName)}</title>
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
<h1>${esc(formationName)}</h1>
<div class="subtitle">${esc(sess.reference || '')} — Du ${esc(new Date(sess.date_debut).toLocaleDateString('fr-FR'))} au ${esc(new Date(sess.date_fin).toLocaleDateString('fr-FR'))}</div>
<div class="no-print" style="margin-bottom:16px;font-size:12px;color:#888;">Imprimez cette page (Ctrl+P / Cmd+P) ou enregistrez en PDF pour distribuer aux apprenants.</div>
<div class="grid">
${items.map(it => `
  <div class="card">
    <div class="name">${esc(it.apprenant.prenom)} ${esc(it.apprenant.nom)}</div>
    ${it.apprenant.email ? `<div class="email">${esc(it.apprenant.email)}</div>` : ''}
    <img src="${esc(it.qrDataUrl)}" alt="QR code" width="200" height="200" />
    <div class="url">${esc(it.url)}</div>
  </div>
`).join('')}
</div>
</body></html>`

  return pageHtml(html)
}

/** La page porte des accès permanents aux portails : ni cache, ni référent transmis, ni script exécutable */
function pageHtml(html: string) {
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    },
  })
}

/**
 * Projection en salle : un stagiaire par écran, son nom en grand au-dessus de
 * son QR code, puis « Suivant ». Le formateur appelle chacun à son tour ; la vue
 * « Tous » montre la planche entière. Sans script (la page n'en exécute aucun) :
 * la navigation passe par des ancres (#s1, #s2…, #tous).
 */
function pageProjection(sess: any, items: Array<{ apprenant: any; url: string; qrDataUrl: string }>) {
  const formationName = sess.formation?.intitule || 'Formation'
  const n = items.length
  const diapos = items.map((it, i) => `
  <section class="diapo" id="s${i + 1}">
    <div class="haut"><span>${esc(formationName)}</span><span>Stagiaire ${i + 1} / ${n}</span></div>
    <div class="nom">${esc(it.apprenant.prenom || '')} ${esc(it.apprenant.nom || '')}</div>
    <img class="qr" src="${esc(it.qrDataUrl)}" alt="QR code de ${esc(it.apprenant.prenom || '')} ${esc(it.apprenant.nom || '')}" />
    <div class="consigne">Scannez votre QR code avec l’appareil photo de votre téléphone</div>
    <nav class="nav">
      ${i > 0 ? `<a href="#s${i}">← Précédent</a>` : '<span></span>'}
      <a class="secondaire" href="#tous">Tous les QR codes</a>
      ${i < n - 1 ? `<a href="#s${i + 2}">Suivant →</a>` : '<span></span>'}
    </nav>
  </section>`).join('')
  const planche = `
  <section class="diapo tous" id="tous">
    <div class="haut"><span>${esc(formationName)}</span><span>${n} stagiaire${n > 1 ? 's' : ''}</span></div>
    <div class="grille">
      ${items.map((it, i) => `<a class="carte" href="#s${i + 1}"><img src="${esc(it.qrDataUrl)}" alt="" /><span>${esc(it.apprenant.prenom || '')} ${esc((it.apprenant.nom || '').slice(0, 1))}.</span></a>`).join('')}
    </div>
    <nav class="nav"><span></span><a href="#s1">Un par un →</a><span></span></nav>
  </section>`
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Accès des stagiaires — ${esc(formationName)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #ffffff; color: #0f172a; font-family: Manrope, system-ui, -apple-system, sans-serif; }
  .diapo { display: none; height: 100vh; padding: 3vh 4vw; flex-direction: column; align-items: center; justify-content: space-between; gap: 2vh; }
  .diapo:target, .diapos:not(:has(.diapo:target)) .diapo:first-child { display: flex; }
  .haut { width: 100%; display: flex; justify-content: space-between; gap: 2vw; font-size: clamp(14px, 2.2vh, 22px); color: #64748b; }
  .nom { font-size: clamp(28px, 8vh, 96px); font-weight: 800; letter-spacing: -0.02em; text-align: center; line-height: 1.05; color: #205040; }
  .qr { height: min(56vh, 80vw); width: auto; image-rendering: pixelated; }
  .consigne { font-size: clamp(14px, 2.6vh, 26px); color: #334155; text-align: center; }
  .nav { width: 100%; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 2vw; }
  .nav a { justify-self: center; font-size: clamp(16px, 2.8vh, 28px); font-weight: 700; color: #ffffff; background: #205040; padding: 1.2vh 2.4vw; border-radius: 12px; text-decoration: none; }
  .nav a:first-child { justify-self: start; } .nav a:last-child { justify-self: end; }
  .nav a.secondaire { background: #ffffff; color: #205040; border: 2px solid #205040; }
  .nav a:focus-visible, .carte:focus-visible { outline: 4px solid #5CD9A0; outline-offset: 3px; }
  .tous { justify-content: flex-start; }
  .grille { flex: 1; width: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(22vh, 40vw), 1fr)); gap: 2vh 2vw; align-content: center; overflow: auto; }
  .carte { display: flex; flex-direction: column; align-items: center; gap: 0.6vh; text-decoration: none; color: #0f172a; font-weight: 700; font-size: clamp(12px, 2vh, 20px); }
  .carte img { width: 100%; max-width: 22vh; height: auto; image-rendering: pixelated; }
</style>
</head><body>
<main class="diapos">${diapos}${planche}
</main>
</body></html>`
  return pageHtml(html)
}
