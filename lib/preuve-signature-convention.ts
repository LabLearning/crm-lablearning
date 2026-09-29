/**
 * Preuves de la signature électronique d'une convention.
 *
 * Tout ce qui sert ensuite au certificat de signature est capté ici, côté
 * serveur : l'adresse IP et le navigateur de la requête, le journal des
 * événements (lien ouvert, document consulté, signature, annulation) et
 * l'exemplaire PDF figé à l'instant de la signature, avec son empreinte
 * SHA-256.
 *
 * Chaque écriture tolère l'absence de la migration 161 : une preuve qui ne
 * peut pas être enregistrée ne bloque jamais la signature du client.
 */

import { createHash } from 'crypto'

export { texteConsentement } from './consentement-convention'

export type EvenementSignatureConvention = 'lien_ouvert' | 'document_consulte' | 'signature' | 'annulation'

export const sha256 = (contenu: Buffer | string) => createHash('sha256').update(contenu).digest('hex')

/** Adresse IP et navigateur de la requête en cours, lus dans les en-têtes. */
export async function origineRequete(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const { headers } = await import('next/headers')
    const h = headers()
    const ip = (h.get('x-forwarded-for') || '').split(',')[0]?.trim() || h.get('x-real-ip') || null
    const userAgent = (h.get('user-agent') || '').slice(0, 500) || null
    return { ip: ip ? ip.slice(0, 60) : null, userAgent }
  } catch {
    return { ip: null, userAgent: null }
  }
}

/**
 * Aperçus automatiques de liens (messageries, antivirus, moteurs) : ils ouvrent
 * la page sans personne derrière, ce n'est pas une preuve d'ouverture.
 */
export const estRobot = (ua: string | null | undefined) =>
  !ua || /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|skypeuri|headless|lighthouse|google-read-aloud|microsoft office|outlook|bingpreview|safelinks|proofpoint|mimecast|barracuda/i.test(ua)

/**
 * Compte du CRM connecté dans ce navigateur, s'il y en a un : une ouverture ou
 * une signature faite depuis un poste de l'équipe doit se lire comme telle.
 */
export async function compteCrmConnecte(supabase: any): Promise<string | null> {
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const anon = await createServerSupabaseClient()
    const { data: { user } } = await anon.auth.getUser()
    if (!user) return null
    const { data: u } = await supabase.from('users').select('first_name, last_name, email').eq('id', user.id).maybeSingle()
    return (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : null) || user.email || user.id
  } catch {
    return null
  }
}

/** Ajoute un événement au journal de signature de la convention. */
export async function journaliserEvenementConvention(
  supabase: any,
  e: {
    organizationId: string
    conventionId: string
    evenement: EvenementSignatureConvention
    ip?: string | null
    userAgent?: string | null
    details?: Record<string, unknown>
    /** Instant de l'acte, quand l'écriture arrive après coup (la signature, après le rendu de l'exemplaire) */
    survenuAt?: string
  },
) {
  const { error } = await supabase.from('convention_signature_evenements').insert({
    organization_id: e.organizationId,
    convention_id: e.conventionId,
    evenement: e.evenement,
    ...(e.survenuAt ? { survenu_at: e.survenuAt } : {}),
    ip_address: e.ip || null,
    user_agent: e.userAgent || null,
    details: e.details || null,
  })
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') console.error('[preuve convention]', error.message)
}

/**
 * Rend l'exemplaire signé de la convention, le range dans le bucket privé
 * documents et enregistre son empreinte. Un exemplaire déjà figé n'est jamais
 * remplacé : chaque signature a son propre fichier horodaté.
 */
export async function figerConventionSignee(supabase: any, conventionId: string): Promise<{
  buffer: Buffer
  sha256: string
  chemin: string | null
  loaded: { convention: any; org: any }
} | null> {
  const { loadConventionForPdf } = await import('@/lib/pdf/convention-data')
  const loaded = await loadConventionForPdf(supabase, conventionId)
  if (!loaded?.convention?.signature_client_signature_data) return null

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { ConventionPDF } = await import('@/lib/pdf/convention-pdf')
  const buffer = Buffer.from(await renderToBuffer(
    createElement(ConventionPDF, { convention: loaded.convention, org: loaded.org }) as any,
  ))
  const empreinte = sha256(buffer)

  const chemin = `${loaded.convention.organization_id}/conventions/${conventionId}/signee-${Date.now()}.pdf`
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(chemin, buffer, { contentType: 'application/pdf', upsert: false })
  if (upErr) {
    console.error('[convention figée]', upErr.message)
    return { buffer, sha256: empreinte, chemin: null, loaded }
  }

  const { error } = await supabase.from('conventions')
    .update({ signature_document_path: chemin, signature_document_sha256: empreinte })
    .eq('id', conventionId)
  if (error) console.error('[convention figée]', error.message)
  return { buffer, sha256: empreinte, chemin, loaded }
}
