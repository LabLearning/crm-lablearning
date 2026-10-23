'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { isPlaceholderEmail } from '@/lib/utils'

const CONTACT_TO = 'digital@lab-learning.fr'
const ORG = process.env.PUBLIC_SITE_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'

interface ContactResult { success: boolean; error?: string }

/**
 * Formulaire de contact public du site vitrine → email à Lab Learning.
 * Garde-fous : champ piège, longueurs bornées, et plafonds de messages par
 * heure et par jour (comptés sur le journal des mails) pour qu'un robot ne
 * noie pas la boîte de l'équipe.
 */
export async function sendContactMessageAction(formData: FormData): Promise<ContactResult> {
  // Champ invisible pour les humains : rempli = robot, on répond « envoyé » sans rien faire
  if (String(formData.get('site_web') || '').trim() !== '') return { success: true }

  // Le nom et le sujet tiennent sur une ligne : ils forment le sujet du mail
  const nom = String(formData.get('nom') || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const email = String(formData.get('email') || '').trim().slice(0, 200)
  const entreprise = String(formData.get('entreprise') || '').trim().slice(0, 160)
  const telephone = String(formData.get('telephone') || '').trim().slice(0, 30)
  const sujet = String(formData.get('sujet') || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  const message = String(formData.get('message') || '').trim()

  if (!nom || !email || !message) return { success: false, error: 'Nom, email et message sont requis.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || isPlaceholderEmail(email)) return { success: false, error: 'Adresse email invalide.' }
  if (message.length > 5000) return { success: false, error: 'Message trop long.' }

  // Plafonds pour tout le site : 15 messages par heure, 60 par jour (un compteur illisible ne bloque pas l'envoi)
  try {
    const supabase = await createServiceRoleClient()
    const recus = (depuis: number) => supabase.from('email_logs').select('id', { count: 'exact', head: true })
      .eq('organization_id', ORG).eq('entity_type', 'contact_site').gte('created_at', new Date(Date.now() - depuis).toISOString())
    const [parHeure, parJour] = await Promise.all([recus(3600000), recus(24 * 3600000)])
    if ((parHeure.count || 0) >= 15 || (parJour.count || 0) >= 60) {
      return { success: false, error: 'Beaucoup de messages nous parviennent en ce moment. Réessayez plus tard, ou écrivez-nous directement à contact@lab-learning.fr.' }
    }
  } catch (e) {
    console.error('[contact site] plafonds', e)
  }

  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
  const html = `
    <div style="font-family:sans-serif;color:#1c1917;line-height:1.6">
      <h2 style="color:#205040">Nouveau message du site Lab Learning</h2>
      <p><strong>Nom :</strong> ${esc(nom)}<br/>
      <strong>Email :</strong> ${esc(email)}<br/>
      ${entreprise ? `<strong>Entreprise :</strong> ${esc(entreprise)}<br/>` : ''}
      ${telephone ? `<strong>Téléphone :</strong> ${esc(telephone)}<br/>` : ''}
      ${sujet ? `<strong>Sujet :</strong> ${esc(sujet)}<br/>` : ''}</p>
      <p style="white-space:pre-wrap;padding:12px 16px;background:#f6f4ef;border-radius:12px">${esc(message)}</p>
    </div>`

  try {
    const { sendBrandedEmail } = await import('@/lib/email')
    const r = await sendBrandedEmail({
      to: CONTACT_TO,
      subject: `Site web · ${sujet || 'Nouveau message'} (${nom})`,
      html,
      orgName: 'Lab Learning',
      orgEmail: email, // reply-to = l'expéditeur, pour répondre directement
      organizationId: ORG,
      entityType: 'contact_site',
    })
    if (!r.success) return { success: false, error: r.error || "Envoi impossible pour le moment." }
    return { success: true }
  } catch (e: any) {
    console.error('[contact site]', e)
    return { success: false, error: "Une erreur est survenue. Réessayez ou écrivez-nous directement." }
  }
}
