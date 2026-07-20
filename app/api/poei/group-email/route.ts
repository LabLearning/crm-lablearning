import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendGroupEmailToCandidatsAction } from '@/app/dashboard/poei/actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_TOTAL = 20 * 1024 * 1024 // 20 Mo de pièces jointes au total

// Envoi du mail groupé POEI avec pièces jointes (multipart — les Server
// Actions sont limitées à 1 Mo, d'où cette route dédiée).
export async function POST(request: Request) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const form = await request.formData()
  const poeiId = form.get('poeiId') as string
  const subject = (form.get('subject') as string) || ''
  const message = (form.get('message') as string) || ''
  const joindreAttestation = form.get('joindreAttestation') === 'true'
  let candidatIds: string[] = []
  try { candidatIds = JSON.parse((form.get('candidatIds') as string) || '[]') } catch { /* liste vide */ }

  if (!poeiId) return NextResponse.json({ error: 'Projet manquant' }, { status: 400 })
  if (candidatIds.length === 0) return NextResponse.json({ error: 'Aucun destinataire' }, { status: 400 })

  // Pièces jointes communes
  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  let total = 0
  const attachments = []
  for (const f of files) {
    total += f.size
    if (total > MAX_TOTAL) return NextResponse.json({ error: 'Pièces jointes trop volumineuses (max 20 Mo au total)' }, { status: 400 })
    attachments.push({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
      contentType: f.type || 'application/octet-stream',
    })
  }

  const result = await sendGroupEmailToCandidatsAction(poeiId, candidatIds, {
    subject, message, joindreAttestation, attachments,
  })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result.data || {})
}
