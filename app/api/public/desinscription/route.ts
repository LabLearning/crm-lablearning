import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { lienDesinscription, lireJetonDesinscription } from '@/lib/campagnes/desinscription'
import { desinscrireParLien } from '@/lib/campagnes/oppositions'

export const dynamic = 'force-dynamic'

/**
 * Désabonnement en un clic (RFC 8058) : la messagerie du destinataire (Gmail,
 * Outlook…) appelle cette adresse en POST, depuis l'en-tête List-Unsubscribe
 * des e-mails de campagne. Le jeton signé dit qui. Une ouverture simple (GET)
 * renvoie vers la page de désinscription du site, qui demande une confirmation.
 */
export async function POST(req: Request) {
  const cible = lireJetonDesinscription(new URL(req.url).searchParams.get('j'))
  if (!cible) return new NextResponse('Lien invalide', { status: 400 })
  try {
    const supabase = await createServiceRoleClient()
    await desinscrireParLien(supabase, cible, 'Désabonnement en un clic (messagerie)')
  } catch (e: any) {
    console.error('[désinscription] un clic', e?.message || e)
    return new NextResponse('Désinscription indisponible pour le moment', { status: 503 })
  }
  return new NextResponse('Vous ne recevrez plus nos e-mails.', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export async function GET(req: Request) {
  const jeton = new URL(req.url).searchParams.get('j') || ''
  if (!lireJetonDesinscription(jeton)) return new NextResponse('Lien invalide', { status: 400 })
  return NextResponse.redirect(lienDesinscription(jeton), 303)
}
