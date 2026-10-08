import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { ConventionPDF } from '@/lib/pdf/convention-pdf'
import { loadConventionForPdf } from '@/lib/pdf/convention-data'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServiceRoleClient()

  // Exemplaire signé archivé (?exemplaire=signe) : le fichier figé à l'instant
  // de la signature, servi tel quel, sans être régénéré. C'est le seul PDF dont
  // l'empreinte est celle du certificat de signature. Réservé aux comptes du
  // tableau de bord : le lien du signataire n'y donne jamais accès, et cette
  // consultation interne n'est pas une preuve de lecture.
  if (req.nextUrl.searchParams.get('exemplaire') === 'signe') {
    const auth = await requireApiUser()
    if ('error' in auth) return auth.error
    const { data: c } = await supabase.from('conventions')
      .select('id, numero, signature_document_path')
      .eq('id', params.id).eq('organization_id', auth.user.organizationId).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Convention introuvable' }, { status: 404 })
    const chemin = String(c.signature_document_path || '')
    if (!chemin) {
      return NextResponse.json({
        error: 'Aucun exemplaire signé n’est archivé pour cette convention : l’archivage se fait à la signature électronique, et les signatures les plus anciennes n’en ont pas.',
      }, { status: 404 })
    }
    // Un exemplaire figé est toujours rangé dans le dossier de sa convention :
    // un chemin qui en sortirait n'est pas le sien et n'est pas servi
    let fichier: Blob | null = null
    if (chemin.startsWith(`${auth.user.organizationId}/conventions/${c.id}/`)) {
      const { data, error } = await supabase.storage.from('documents').download(chemin)
      if (error) console.error('[exemplaire signé]', error.message)
      fichier = data
    }
    if (!fichier) {
      return NextResponse.json({ error: 'L’exemplaire signé archivé de cette convention est introuvable dans le stockage.' }, { status: 404 })
    }
    return new NextResponse(new Uint8Array(await fichier.arrayBuffer()), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="convention-${c.numero || c.id}-exemplaire-signe.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }

  // Le signataire lit la convention complète depuis sa page de signature :
  // son lien personnel lui en donne l'accès, et chaque lecture est une preuve
  const token = req.nextUrl.searchParams.get('token')
  let orgId: string
  if (token) {
    const { data: c } = await supabase.from('conventions')
      .select('id, organization_id, signature_token, signature_token_expires_at')
      .eq('id', params.id).eq('signature_token', token).maybeSingle()
    if (!c || (c.signature_token_expires_at && new Date(c.signature_token_expires_at) < new Date())) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 401 })
    }
    orgId = c.organization_id
  } else {
    const auth = await requireApiUser()
    if ('error' in auth) return auth.error
    orgId = auth.user.organizationId
  }

  const loaded = await loadConventionForPdf(supabase, params.id)

  // Contrôle d'org : la convention doit appartenir à l'organisation de l'appelant
  // (loadConventionForPdf ne filtre pas par org, on vérifie ici).
  if (!loaded || loaded.convention.organization_id !== orgId) {
    return NextResponse.json({ error: 'Convention introuvable' }, { status: 404 })
  }

  const { convention, org } = loaded

  // ── Contrôle de complétude : blocage si mention obligatoire manquante ──
  const { checkConventionCompleteness } = await import('@/lib/convention-checklist')
  const check = await checkConventionCompleteness(supabase, params.id)
  if (check && !check.ok && token) {
    // Le signataire n'a pas à lire la liste interne des champs manquants
    return new NextResponse(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Document indisponible</title></head>
      <body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:60px auto;padding:0 20px;color:#1C1917">
      <h1 style="font-size:20px">Document momentanément indisponible</h1>
      <p style="color:#57534E;font-size:14px;line-height:1.6">La convention complète est en cours de mise à jour par l’organisme de formation. Réessayez un peu plus tard ou contactez-le.</p>
      </body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
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

  // Preuve de lecture, une fois le document réellement remis au signataire
  if (token) {
    const { origineRequete, journaliserEvenementConvention, estRobot, compteCrmConnecte } = await import('@/lib/preuve-signature-convention')
    const origine = await origineRequete()
    if (!estRobot(origine.userAgent)) {
      const compte = await compteCrmConnecte(supabase)
      await journaliserEvenementConvention(supabase, {
        organizationId: orgId, conventionId: params.id, evenement: 'document_consulte',
        ip: origine.ip, userAgent: origine.userAgent, details: compte ? { compte_crm: compte } : undefined,
      })
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      // Depuis la page de signature, le PDF s'ouvre dans le navigateur
      'Content-Disposition': `${token ? 'inline' : 'attachment'}; filename="convention-${convention.numero}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
