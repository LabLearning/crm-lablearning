import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractFormationFromPdf } from '@/lib/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Reçoit un PDF de programme (multipart) et renvoie les champs formation extraits par l'IA
export async function POST(request: Request) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Le fichier doit être un PDF' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'PDF trop volumineux (max 15 Mo)' }, { status: 400 })

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const result = await extractFormationFromPdf(base64)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ formation: result.formation })
}
