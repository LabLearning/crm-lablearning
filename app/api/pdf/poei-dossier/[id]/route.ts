import { NextRequest, NextResponse } from 'next/server'
import { zipSync, unzipSync } from 'fflate'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { GET as devisZipGET } from '../../poei-devis/[id]/route'
import { GET as grillesZipGET } from '../../poei-grilles/[id]/route'
import { GET as certificatsZipGET } from '../../poei-certificats/[id]/route'
import { GET as facturesZipGET } from '../../poei-factures/[id]/route'
import { GET as pdcGET } from '../../pdc/[id]/route'
import { GET as attestationEntreeGET } from '../../attestation-entree/[id]/route'
import { GET as mandatGET } from '../../mandat-poei/[id]/route'
import { GET as planningsGET } from '../../poei-plannings/[id]/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const safeName = (s: string) => (s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'document'

/** Nom de fichier annoncé par une sous-route (Content-Disposition). */
function nomAnnonce(res: Response, repli: string): string {
  const cd = res.headers.get('content-disposition') || ''
  const m = cd.match(/filename="([^"]+)"/)
  return safeName(m ? m[1] : repli)
}

/**
 * Le dossier POEI complet en un seul ZIP, un répertoire par famille de
 * documents. Chaque famille est produite par sa route existante (réutilisée
 * telle quelle) : ce qui revient en ZIP est déplié dans son répertoire, ce
 * qui revient en PDF y est posé tel quel. Une famille vide est simplement
 * absente de l'archive.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const supabase = await createServiceRoleClient()
  const orgId = auth.user.organizationId
  // Le dossier porte les coordonnées des candidats et de l'employeur : droits du module POEI
  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', orgId).eq('role', auth.user.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/poei', auth.user.role as any, (permissions || []) as any).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const { data: poei } = await supabase
    .from('poei')
    .select('id, numero, client:client_id(raison_sociale, nom_commercial)')
    .eq('id', params.id).eq('organization_id', orgId).single()
  if (!poei) return NextResponse.json({ error: 'Projet POEI introuvable' }, { status: 404 })

  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('id, apprenant_id, apprenant:apprenants(prenom, nom)')
    .eq('poei_id', params.id)

  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  const poser = (dossier: string, nom: string, data: Uint8Array) => {
    const base = nom.replace(/\.pdf$/i, '')
    let chemin = `${dossier}/${base}.pdf`
    let n = 2
    while (used.has(chemin)) chemin = `${dossier}/${base} (${n++}).pdf`
    used.add(chemin)
    files[chemin] = data
  }

  /** Appelle un handler de route ; range le résultat (PDF ou ZIP déplié) dans son répertoire. */
  const collecter = async (
    dossier: string,
    handler: (req: any, ctx: { params: { id: string } }) => Promise<Response>,
    id: string,
    repli: string,
    query = '',
  ) => {
    try {
      // Même origine que l'appel entrant : certaines sous-routes résolvent des
      // URL absolues depuis req.url (ex. le gabarit PDF du plan de compétences).
      const res = await handler(new NextRequest(`${req.nextUrl.origin}/api${query}`), { params: { id } })
      if (!res.ok) return
      const type = res.headers.get('content-type') || ''
      const data = new Uint8Array(await res.arrayBuffer())
      if (type.includes('zip')) {
        const entries = unzipSync(data)
        for (const [nom, contenu] of Object.entries(entries)) poser(dossier, nom, contenu)
      } else if (type.includes('pdf')) {
        poser(dossier, nomAnnonce(res, repli), data)
      }
    } catch { /* famille indisponible : on continue sans elle */ }
  }

  const nomCandidat = (c: any) => safeName(`${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`) || c.id.slice(0, 8)

  // Les familles à un document par candidat (routes individuelles)
  const parCandidat: Promise<void>[] = []
  for (const c of candidats || []) {
    parCandidat.push(collecter('2 - Plans de developpement des competences', pdcGET as any, c.id, `PDC - ${nomCandidat(c)}.pdf`))
    if (c.apprenant_id) {
      parCandidat.push(collecter(
        "3 - Attestations d'entree", attestationEntreeGET as any, c.apprenant_id,
        `Attestation entree - ${nomCandidat(c)}.pdf`, `?poei=${params.id}&candidat=${c.id}`,
      ))
    }
  }

  // Les familles groupées (routes ZIP existantes) + le mandat
  await Promise.all([
    collecter('1 - Devis', devisZipGET as any, params.id, 'Devis.pdf'),
    ...parCandidat,
    collecter("4 - Grilles d'evaluation", grillesZipGET as any, params.id, 'Evaluations.pdf'),
    collecter('5 - Certificats de realisation', certificatsZipGET as any, params.id, 'Certificats.pdf'),
    collecter('6 - Factures', facturesZipGET as any, params.id, 'Factures.pdf'),
    collecter('7 - Mandat', mandatGET as any, params.id, 'Mandat POEI.pdf'),
    collecter('8 - Plannings de travail', planningsGET as any, params.id, 'Planning.pdf'),
  ])

  if (Object.keys(files).length === 0) {
    return NextResponse.json({ error: 'Aucun document disponible pour ce dossier' }, { status: 404 })
  }

  const zipped = zipSync(files, { level: 0 })
  const client = (poei as any).client?.nom_commercial || (poei as any).client?.raison_sociale || ''
  const zipName = safeName(`Dossier POEI - ${(poei as any).numero || params.id.slice(0, 8)}${client ? ` - ${client}` : ''}`) + '.zip'
  return new NextResponse(new Uint8Array(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
