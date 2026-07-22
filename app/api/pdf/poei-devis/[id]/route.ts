import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { zipSync, strToU8 } from 'fflate'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { DevisPDF } from '@/lib/pdf/devis-pdf'
import type { Devis } from '@/lib/types/dossier'

// Nettoie un nom pour en faire un nom de fichier sûr
function safeName(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-') || 'candidat'
}

// Télécharge tous les devis d'un projet POEI dans un ZIP (1 PDF par candidat)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()

  // Projet + numéro pour nommer le zip
  // Contrôle d'org : le projet POEI doit appartenir à l'organisation de l'appelant
  // (les devis liés sont ensuite filtrés sur poei.organization_id).
  const { data: poei } = await supabase
    .from('poei')
    .select('id, numero, organization_id, client:clients(raison_sociale)')
    .eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
  if (!poei) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  // Tous les devis POEI de ce projet (marqueur dans notes_internes)
  const { data: devisList } = await supabase
    .from('devis')
    .select(`*, client:clients(raison_sociale, nom, prenom, type, email, adresse, code_postal, ville, siret, tva_intra),
      contact:contacts(prenom, nom, email), formation:formations(intitule, reference), lignes:devis_lignes(*)`)
    .eq('organization_id', poei.organization_id)
    .ilike('notes_internes', `%[POEI:${params.id}:%`)
    .order('numero')
  if (!devisList || devisList.length === 0) {
    return NextResponse.json({ error: 'Aucun devis à télécharger. Générez d\'abord les devis.' }, { status: 404 })
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', poei.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Extrait le nom du candidat depuis l'objet "POEI — <nom> — <formation>"
  const candidatFromObjet = (objet: string | null) => {
    const m = (objet || '').match(/POEI\s*[—-]\s*(.+?)\s*[—-]/)
    return m ? m[1].trim() : ''
  }

  const files: Record<string, Uint8Array> = {}
  const usedNames = new Set<string>()
  for (const devis of devisList) {
    const candidat = candidatFromObjet((devis as any).objet)
    const buffer = await renderToBuffer(createElement(DevisPDF, { devis: devis as Devis, org }) as any)
    // Nom de fichier : "Devis - NOM CANDIDAT - DEV-XXXX.pdf"
    let base = `Devis - ${safeName(candidat)} - ${devis.numero}`
    let name = `${base}.pdf`
    let n = 2
    while (usedNames.has(name)) { name = `${base}-${n++}.pdf` }
    usedNames.add(name)
    files[name] = new Uint8Array(buffer)
  }

  const zipped = zipSync(files, { level: 0 }) // PDF déjà compressés → store
  const zipName = `Devis POEI - ${safeName((poei as any).client?.raison_sociale || poei.numero || 'projet')}.zip`

  return new NextResponse(new Uint8Array(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
