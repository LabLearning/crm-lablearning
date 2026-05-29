/**
 * Cron J-1 : envoie le livret d'accueil de l'organisme aux apprenants
 * des sessions qui démarrent demain et n'ont pas encore reçu le livret.
 *
 * Le livret est un PDF fixe déposé dans les paramètres de l'organisme
 * (organizations.livret_accueil_url). Il est joint directement au message
 * WhatsApp (header DOCUMENT) et lié dans la notification interne.
 *
 * Appel externe (cron Vercel ou manuel) :
 *   GET /api/cron/livret-accueil?secret=...
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const { searchParams } = new URL(req.url)
  const querySecret = searchParams.get('secret')
  const expected = process.env.CRON_SECRET

  const headerOk = authHeader === `Bearer ${expected}`
  const queryOk = querySecret === expected || querySecret === process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!headerOk && !queryOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  // Date cible : J+1 (sessions qui démarrent demain)
  const target = new Date()
  target.setDate(target.getDate() + 1)
  const targetDate = target.toISOString().split('T')[0]

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, organization_id, date_debut,
      formation:formation_id(intitule)
    `)
    .eq('date_debut', targetDate)
    .is('livret_sent_at', null)
    .neq('status', 'annulee')
    .neq('status', 'terminee')

  const { createNotification } = await import('@/lib/email')
  const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')

  // Cache des livrets par organisation (URL + nom de l'OF)
  const orgCache: Record<string, { livretUrl: string | null; filename: string | null; name: string } | undefined> = {}
  const getOrg = async (orgId: string) => {
    if (orgCache[orgId] !== undefined) return orgCache[orgId]
    const { data } = await supabase
      .from('organizations')
      .select('name, livret_accueil_url, livret_accueil_filename')
      .eq('id', orgId)
      .single()
    const val = data
      ? { livretUrl: data.livret_accueil_url || null, filename: data.livret_accueil_filename || null, name: data.name || 'votre organisme' }
      : { livretUrl: null, filename: null, name: 'votre organisme' }
    orgCache[orgId] = val
    return val
  }

  const fmtDateLong = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  let processed = 0
  let totalApprenants = 0
  let totalWhatsApp = 0
  let skippedNoLivret = 0

  for (const sess of sessions || []) {
    const org = await getOrg(sess.organization_id)
    // Pas de livret configuré → on ne marque pas la session (renvoi possible une fois uploadé)
    if (!org?.livretUrl) { skippedNoLivret++; continue }

    const { data: inscriptions } = await supabase
      .from('inscriptions')
      .select('apprenant:apprenants(id, civilite, prenom, nom, email, user_id, whatsapp, whatsapp_opt_in)')
      .eq('session_id', sess.id)
      .not('status', 'in', '("annule","abandonne")')

    const formationNom = (sess as any).formation?.intitule || 'votre formation'
    const dateDebutLong = fmtDateLong(sess.date_debut)
    const livretFilename = org.filename || "livret-accueil.pdf"

    for (const ins of inscriptions || []) {
      const a = (ins as any).apprenant

      // Notification interne (si compte apprenant)
      if (a?.user_id) {
        await createNotification({
          organizationId: sess.organization_id,
          userId: a.user_id,
          titre: "Votre livret d'accueil",
          message: `En vue de votre formation "${formationNom}" qui débute le ${dateDebutLong}, voici le livret d'accueil de ${org.name}.`,
          type: 'document',
          lienUrl: org.livretUrl,
          lienLabel: 'Ouvrir le livret',
          entityType: 'session',
          entityId: sess.id,
        })
        totalApprenants++
      }

      // WhatsApp (si opt-in + numéro) — template "livret_accueil" + PDF en pièce jointe
      if (a?.whatsapp_opt_in && a?.whatsapp) {
        const nomComplet = [a.civilite, a.nom].filter(Boolean).join(' ').trim()
          || `${a.prenom || ''} ${a.nom || ''}`.trim()
          || 'Madame, Monsieur'
        const r = await sendWhatsAppTemplate({
          organizationId: sess.organization_id,
          to: a.whatsapp,
          toName: `${a.prenom || ''} ${a.nom || ''}`.trim(),
          template: 'livret_accueil',
          languageCode: 'fr',
          headerDocument: { link: org.livretUrl, filename: livretFilename },
          bodyParams: [
            nomComplet,     // {{1}} civilité + nom
            formationNom,   // {{2}} formation
            dateDebutLong,  // {{3}} date de début
          ],
          entityType: 'session',
          entityId: sess.id,
        })
        if (r.ok) totalWhatsApp++
      }
    }

    await supabase
      .from('sessions')
      .update({ livret_sent_at: new Date().toISOString() })
      .eq('id', sess.id)

    processed++
  }

  return NextResponse.json({
    targetDate,
    sessions_processed: processed,
    sessions_sans_livret: skippedNoLivret,
    apprenants_notifies: totalApprenants,
    whatsapp_envoyes: totalWhatsApp,
  })
}
