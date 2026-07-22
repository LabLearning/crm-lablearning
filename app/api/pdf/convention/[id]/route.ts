import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { ConventionPDF } from '@/lib/pdf/convention-pdf'
import { loadConventionForPdf } from '@/lib/pdf/convention-data'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  const loaded = await loadConventionForPdf(supabase, params.id)

  // Contrôle d'org : la convention doit appartenir à l'organisation de l'appelant
  // (loadConventionForPdf ne filtre pas par org, on vérifie ici).
  if (!loaded || loaded.convention.organization_id !== auth.user.organizationId) {
    return NextResponse.json({ error: 'Convention introuvable' }, { status: 404 })
  }

  const { convention, org } = loaded

  // ── Contrôle de complétude : blocage si mention obligatoire manquante ──
  const { checkConventionCompleteness } = await import('@/lib/convention-checklist')
  const check = await checkConventionCompleteness(supabase, params.id)
  if (check && !check.ok) {
    const items = check.blocking
      .map((i) => `<li><strong>${i.section}</strong> — ${i.label}</li>`)
      .join('')
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Convention incomplète</title>
      <style>body{font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#1C1917}
      h1{font-size:20px}p{color:#57534E;font-size:14px;line-height:1.6}ul{font-size:14px;line-height:1.9;color:#44403C}
      .badge{display:inline-block;background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600;margin-bottom:16px}</style>
      </head><body>
      <div class="badge">Convention incomplète</div>
      <h1>Impossible de générer la convention ${convention.numero || ''}</h1>
      <p>Pour éviter les rejets OPCO et les non-conformités Qualiopi, la convention ne peut pas être générée tant que les mentions obligatoires suivantes ne sont pas complétées :</p>
      <ul>${items}</ul>
      <p>Complétez ces informations (fiche formation, session, client ou paramètres de l'organisation) puis relancez la génération.</p>
      </body></html>`
    return new NextResponse(html, { status: 422, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const buffer = await renderToBuffer(
    createElement(ConventionPDF, { convention, org }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="convention-${convention.numero}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
