import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { assurerRecueils } from '@/lib/recueil-auto-serveur'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Recueils du besoin des sessions à venir (Vercel Cron, chaque heure) : créés
 * s'ils manquent (sessions venues de Dendreo ou créées autrement que par le
 * CRM), complétés s'ils sont incomplets, mis à jour pour les champs que le CRM
 * a écrits et que personne n'a modifiés (lib/recueil-auto-serveur).
 */
export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET
  if (!attendu || req.headers.get('authorization') !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const supabase = await createServiceRoleClient()
  const { data: orgs, error } = await supabase.from('organizations').select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const bilans: Record<string, unknown> = {}
  for (const o of (orgs || []) as any[]) {
    try { bilans[o.id] = await assurerRecueils(supabase, o.id) } catch (e: any) {
      console.error('[recueils auto]', o.id, e?.message || e)
      bilans[o.id] = { erreur: String(e?.message || e).slice(0, 300) }
    }
  }
  return NextResponse.json(bilans)
}
