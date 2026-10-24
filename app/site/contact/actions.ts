'use server'

import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isPlaceholderEmail } from '@/lib/utils'
import { ageHorodatage, empreinteSecrete } from '@/lib/inscription-formateur-garde'
import { CLE_GARDE_CONTACT, ORG_SITE_CONTACT } from './garde'

const CONTACT_TO = 'digital@lab-learning.fr'
const ORG = ORG_SITE_CONTACT

interface ContactResult { success: boolean; error?: string }

/**
 * Formulaire de contact public du site vitrine → email à Lab Learning, et lead
 * « Site web » dans le CRM.
 * Garde-fous, comme les modèles gratuits et Starkk : champ piège, page servie
 * par nous depuis plus de 3 secondes (horodatage signé), longueurs bornées.
 * Puis l'envoi est noté AVANT d'être traité (table envois_formulaires_site,
 * migration 167) : le jeton de la page ne sert qu'une fois, et les plafonds
 * (15 par heure, 60 par jour, 5 par heure et par adresse IP) se comptent sur
 * ces lignes, si bien que des envois simultanés ne passent pas tous. Avant la
 * migration, les plafonds se comptent sur le journal des mails.
 */
export async function sendContactMessageAction(formData: FormData): Promise<ContactResult> {
  // Champ invisible pour les humains : rempli = robot, on répond « envoyé » sans rien faire
  if (String(formData.get('site_web') || '').trim() !== '') return { success: true }
  const age = ageHorodatage(CLE_GARDE_CONTACT, formData.get('jeton'))
  if (age === null) return { success: false, error: 'Page expirée : rechargez-la puis renvoyez votre message.' }
  if (age < 3000) return { success: false, error: 'Merci de relire votre message avant de l’envoyer.' }

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

  const TROP = 'Beaucoup de messages nous parviennent en ce moment. Réessayez plus tard, ou écrivez-nous directement à contact@lab-learning.fr.'
  const empreinte = (v: string) => createHash('sha256').update(`contact-site:${v}`).digest('hex')
  const ip = (headers().get('x-forwarded-for') || '').split(',')[0].trim()
  // L'envoi est noté d'abord : la ligne réservée compte dans les plafonds avant tout traitement
  let reservation: string | null = null
  try {
    const supabase = await createServiceRoleClient()
    const { data: ligne, error: eRes } = await supabase.from('envois_formulaires_site').insert({
      organization_id: ORG,
      formulaire: 'contact',
      empreinte_jeton: empreinte(String(formData.get('jeton'))),
      empreinte_ip: ip ? empreinteSecrete('contact-site', ip) : null,
    }).select('id').single()
    if (eRes?.code === '23505') return { success: false, error: 'Ce message est déjà parti. Pour en écrire un autre, rechargez la page.' }
    if (!eRes && ligne) {
      reservation = ligne.id
      const compter = (depuisMs: number) => supabase.from('envois_formulaires_site').select('id', { count: 'exact', head: true })
        .eq('organization_id', ORG).eq('formulaire', 'contact').gte('cree_le', new Date(Date.now() - depuisMs).toISOString())
      const [parHeure, parJour, parIp] = await Promise.all([
        compter(3600000), compter(24 * 3600000),
        ip ? compter(3600000).eq('empreinte_ip', empreinteSecrete('contact-site', ip)) : Promise.resolve({ count: 0 }),
      ])
      // Un envoi refusé rend sa ligne : il ne compte pas, et un robot ne peut pas fermer le formulaire à tout le monde
      // en multipliant les refus
      if ((parHeure.count || 0) > 15 || (parJour.count || 0) > 60 || (parIp.count || 0) > 5) {
        await supabase.from('envois_formulaires_site').delete().eq('id', ligne.id)
        return { success: false, error: TROP }
      }
      // Au-delà de 48 h, les lignes ne servent plus aux plafonds
      await supabase.from('envois_formulaires_site').delete().eq('formulaire', 'contact').lt('cree_le', new Date(Date.now() - 48 * 3600000).toISOString())
    }
  } catch (e) {
    console.error('[contact site] réservation', e)
  }
  // Avant la migration 167 (table absente) : plafonds comptés sur le journal des mails (un compteur illisible ne bloque pas l'envoi)
  if (!reservation) {
    try {
      const supabase = await createServiceRoleClient()
      const recus = (depuis: number) => supabase.from('email_logs').select('id', { count: 'exact', head: true })
        .eq('organization_id', ORG).eq('entity_type', 'contact_site').gte('created_at', new Date(Date.now() - depuis).toISOString())
      const [parHeure, parJour] = await Promise.all([recus(3600000), recus(24 * 3600000)])
      if ((parHeure.count || 0) >= 15 || (parJour.count || 0) >= 60) return { success: false, error: TROP }
    } catch (e) {
      console.error('[contact site] plafonds', e)
    }
  }
  // Rien n'est parti (ni lead ni e-mail) : la réservation est rendue, le visiteur peut renvoyer sans recharger
  const rendre = async () => {
    if (!reservation) return
    try { const supabase = await createServiceRoleClient(); await supabase.from('envois_formulaires_site').delete().eq('id', reservation) } catch { /* sans gravité */ }
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

  // La demande devient un lead « Site web » (ou complète le lead, ou prévient
  // l'équipe pour un client connu) : elle figure dans la page Leads même si
  // l'e-mail ne part pas. Avant la migration 167, seul l'e-mail part.
  // Case « Je ne souhaite pas recevoir les actualités » : aucune campagne vers ces coordonnées (migration 168)
  if (String(formData.get('sans_actualites') || '') === 'oui') {
    try {
      const { noterRefusDuFormulaire } = await import('@/lib/campagnes/oppositions')
      await noterRefusDuFormulaire(await createServiceRoleClient(), ORG, { email, telephone }, 'page Contact')
    } catch (e) {
      console.error('[contact site] refus des actualités', e)
    }
  }

  let enregistree = false
  // Le lead de la demande : l'e-mail à l'équipe lui est rattaché (effacé avec lui s'il est supprimé)
  let leadId: string | null = null
  try {
    const supabase = await createServiceRoleClient()
    const { recevoirProspect } = await import('@/lib/prospects/recevoir')
    const { nettoyerAttributionSite, canalPublicitaire } = await import('@/lib/prospects/attribution')
    let attribution = null
    try { attribution = nettoyerAttributionSite(JSON.parse(String(formData.get('attribution') || 'null'))) } catch { attribution = null }
    const viaPub = canalPublicitaire(attribution)
    const r = await recevoirProspect(supabase, ORG, {
      canal: 'site',
      identite: { nomComplet: nom, email, telephone, entreprise },
      reponses: [
        ...(sujet ? [{ question: 'Sujet', reponse: sujet }] : []),
        { question: 'Message', reponse: message.slice(0, 1000) },
      ],
      attribution,
      evenement: `Message envoyé depuis la page Contact du site${sujet ? ` : « ${sujet} »` : ''}.`,
      etiquettes: ['contact', ...(viaPub ? [viaPub === 'meta' ? 'via-meta' : 'via-google-ads'] : []),
        // Case « Je ne souhaite pas recevoir les actualités » : gardée aussi sur le lead
        ...(String(formData.get('sans_actualites') || '') === 'oui' ? ['sans-actualites'] : [])],
    })
    enregistree = r.statut !== 'erreur'
    leadId = r.leadId
  } catch (e) {
    console.error('[contact site] lead', e)
  }

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
      ...(leadId ? { entityId: leadId } : {}),
    })
    if (!r.success && !enregistree) { await rendre(); return { success: false, error: r.error || "Envoi impossible pour le moment." } }
    return { success: true }
  } catch (e: any) {
    console.error('[contact site]', e)
    if (enregistree) return { success: true }
    await rendre()
    return { success: false, error: "Une erreur est survenue. Réessayez ou écrivez-nous directement." }
  }
}
