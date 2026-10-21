import { NextRequest, NextResponse } from 'next/server'
import { zipSync, strToU8 } from 'fflate'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { fillPdc } from '@/lib/pdf/fill-pdc'
import { donneesPlanDeveloppement, LecturePdcImpossible } from '@/lib/poei-pdc'

export const dynamic = 'force-dynamic'
// Un plan par candidat : jusqu'à une vingtaine de rendus
export const maxDuration = 60

/** Nom de fichier en caractères simples : sans accents ni signes refusés par les archives et les en-têtes */
const simple = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9 ._-]+/g, '-').replace(/\s+/g, ' ').replace(/^[\s.-]+|[\s.-]+$/g, '') || 'document'
const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/**
 * Tous les plans de développement de compétences d'une POEI (`id` = POEI) dans
 * une seule archive, un PDF par candidat, chacun rempli comme le plan seul
 * (/api/pdf/pdc/[candidat]). Un plan qui ne peut pas être produit est nommé
 * dans « A lire.txt » avec sa raison.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const supabase = await createServiceRoleClient()
  const orgId = auth.user.organizationId
  // Les plans portent les coordonnées de l'employeur et des stagiaires : droits du module POEI
  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', orgId).eq('role', auth.user.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/poei', auth.user.role as any, (permissions || []) as any).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const [{ data: poei }, { data: candidats, error }] = await Promise.all([
    supabase.from('poei').select('id, numero, client:client_id(raison_sociale, nom_commercial)')
      .eq('id', params.id).eq('organization_id', orgId).maybeSingle(),
    supabase.from('poei_candidats').select('id, apprenant:apprenants(prenom, nom)')
      .eq('poei_id', params.id).eq('organization_id', orgId),
  ])
  if (!poei) return NextResponse.json({ error: 'Projet POEI introuvable' }, { status: 404 })
  if (error) return NextResponse.json({ error: 'Lecture des candidats impossible, réessayez dans un instant.' }, { status: 503 })
  if (!candidats?.length) return NextResponse.json({ error: 'Aucun candidat dans cette POEI' }, { status: 404 })

  const modeleRes = await fetch(new URL('/templates/pdc-france-travail.pdf', req.url)).catch(() => null)
  if (!modeleRes?.ok) return NextResponse.json({ error: 'Formulaire France Travail introuvable' }, { status: 500 })
  const modele = new Uint8Array(await modeleRes.arrayBuffer())

  const files: Record<string, Uint8Array> = {}
  const nonProduits: string[] = []
  const noms = new Set<string>()
  try {
    // Quatre candidats à la fois : rapide sans saturer la base
    for (let i = 0; i < candidats.length; i += 4) {
      await Promise.all(candidats.slice(i, i + 4).map(async (c: any) => {
        const qui = `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || c.id.slice(0, 8)
        const pdc = await donneesPlanDeveloppement(supabase, orgId, c.id)
        if (!pdc) { nonProduits.push(`${qui} : candidat introuvable`); return }
        const court = pdc.alertes.find((a) => a.code === 'programme_court')
        if (court) { nonProduits.push(`${qui} : ${court.message}`); return }
        let nom = `PDC - ${simple(qui)}`
        for (let n = 2; noms.has(nom); n++) nom = `PDC - ${simple(qui)} (${n})`
        noms.add(nom)
        files[`${nom}.pdf`] = await fillPdc(modele, pdc.data)
      }))
    }
  } catch (e) {
    if (e instanceof LecturePdcImpossible) {
      console.error('[plans de développement]', e.message)
      return NextResponse.json({ error: 'Lecture des données impossible : l’archive n’a pas été produite. Réessayez dans un instant.' }, { status: 503 })
    }
    throw e
  }

  if (!Object.keys(files).length) {
    return new NextResponse(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Plans de développement non produits</title></head>
      <body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:600px;margin:60px auto;padding:0 20px;color:#1C1917">
      <h1 style="font-size:20px">Aucun plan de développement n’a pu être produit</h1>
      <ul style="color:#57534E;font-size:14px;line-height:1.6">${nonProduits.map((x) => `<li>${echapper(x)}</li>`).join('')}</ul>
      <p style="color:#57534E;font-size:14px;line-height:1.6">Corrigez la fiche POEI, puis relancez le téléchargement.</p>
      </body></html>`,
      { status: 422, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
  if (nonProduits.length) {
    files['A lire.txt'] = strToU8(`Plans de développement non produits (${nonProduits.length}) :\r\n\r\n${nonProduits.map((x) => `- ${x}`).join('\r\n')}\r\n`)
  }

  const client = (poei as any).client?.nom_commercial || (poei as any).client?.raison_sociale || ''
  const zipName = `${simple(`Plans de developpement - ${(poei as any).numero || params.id.slice(0, 8)}${client ? ` - ${client}` : ''}`)}.zip`
  const zipped = zipSync(files, { level: 0 })
  return new NextResponse(new Uint8Array(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
