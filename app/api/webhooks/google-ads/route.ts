import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { organismeDeLaCle, traduireEnvoiGoogle } from '@/lib/prospects/google-ads'
import { recevoirProspect } from '@/lib/prospects/recevoir'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Webhook des formulaires pour prospects Google Ads. Public, sans session :
 * l'envoi est reconnu par la clé (google_key) collée dans Google Ads, comparée
 * à l'empreinte enregistrée. Un envoi d'essai (bouton « Envoyer des données de
 * test ») reste au journal, sans créer de lead.
 * Réponse 200 quand le prospect est enregistré ; 401 sur une clé inconnue,
 * essai compris (Google affiche l'échec : la clé collée n'est pas la bonne) ;
 * 500 ou 503 sur une erreur passagère, pour que Google renvoie (le journal
 * évite tout doublon).
 */
export async function POST(req: Request) {
  const brut = await req.text()
  if (brut.length > 100_000) return NextResponse.json({ message: 'Envoi trop volumineux' }, { status: 413 })
  let corps: any
  // Identifiants longs gardés en texte (un nombre JSON au-delà de 16 chiffres serait arrondi)
  try { corps = JSON.parse(brut.replace(/"(lead_id|form_id|campaign_id|adgroup_id|creative_id|asset_group_id)"\s*:\s*(\d{12,})/g, '"$1":"$2"')) } catch { return NextResponse.json({ message: 'Corps illisible' }, { status: 400 }) }

  const supabase = await createServiceRoleClient()
  let orgId: string | null
  try {
    orgId = await organismeDeLaCle(supabase, String(corps?.google_key || ''))
  } catch (e: any) {
    console.error('[google-ads] webhook', String(e?.message || e))
    return NextResponse.json({ message: 'Service momentanément indisponible' }, { status: 503 })
  }
  if (!orgId) {
    // Les refus restent dans les journaux de Vercel, pour comprendre un formulaire qui n'arrive pas
    console.warn('[google-ads] webhook : clé inconnue', corps?.is_test === true ? '(essai)' : '(prospect)', String(corps?.form_id || '').replace(/\D/g, '').slice(0, 20))
    return NextResponse.json({ message: 'Clé inconnue' }, { status: 401 })
  }

  const prospect = traduireEnvoiGoogle(corps)
  if (!prospect.externeId) return NextResponse.json({ message: 'lead_id manquant' }, { status: 400 })

  const r = await recevoirProspect(supabase, orgId, prospect)
  // Une autre livraison du même prospect est en cours : Google renverra, et la reprise viendra si elle a été coupée
  if (r.statut === 'en_cours') return NextResponse.json({ message: 'Réception en cours, renvoyez plus tard' }, { status: 503 })
  if (r.statut === 'erreur') {
    await supabase.from('canaux_prospects').update({
      derniere_erreur: (r.erreur || 'Réception impossible').slice(0, 500), derniere_erreur_at: new Date().toISOString(),
    }).eq('organization_id', orgId).eq('canal', 'google_ads')
    // Sans e-mail ni téléphone, renvoyer ne servirait à rien : reçu, et l'erreur reste au journal
    if (/Ni e-mail ni téléphone/.test(r.erreur || '')) return NextResponse.json({})
    return NextResponse.json({ message: 'Réception impossible pour le moment' }, { status: 500 })
  }
  // Réponse attendue par Google : 200 et un objet vide
  return NextResponse.json({})
}
