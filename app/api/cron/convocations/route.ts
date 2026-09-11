/**
 * Cron des convocations : chaque stagiaire d'une session qui démarre entre
 * aujourd'hui et J+3 reçoit sa convocation s'il ne l'a pas déjà (suivi par
 * stagiaire, voir lib/convocations.ts). Un stagiaire ajouté tardivement, ou
 * une session créée la veille, est donc rattrapé au passage suivant.
 * Le formateur reçoit sa fiche mission une seule fois par session.
 *
 *   GET /api/cron/convocations  (Authorization: Bearer CRON_SECRET)
 */
import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { envoyerConvocationsManquantes, JOURS_AVANT } from '@/lib/convocations'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized

  const apercu = new URL(req.url).searchParams.get('dry') === '1'
  const supabase = await createServiceRoleClient()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const aujourdhui = new Date()
  const limite = new Date(); limite.setDate(limite.getDate() + JOURS_AVANT)

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, organization_id, date_debut, convocations_sent_at, formation:formation_id(intitule), formateur:formateurs(user_id)')
    .gte('date_debut', iso(aujourdhui))
    .lte('date_debut', iso(limite))
    .not('status', 'in', '("annulee","terminee")')

  const { createNotification } = await import('@/lib/email')
  const total = { sessions: 0, emails: 0, referent: 0, whatsapp: 0, sansContact: [] as string[], apercu: [] as any[] }

  for (const sess of sessions || []) {
    const bilan = await envoyerConvocationsManquantes(supabase, sess.id, { apercu })
    total.sessions++
    if (apercu) {
      if (bilan.aEnvoyer?.length) total.apercu.push({ session: sess.id, date: sess.date_debut, formation: (sess as any).formation?.intitule, deja: bilan.dejaConvoques, a_envoyer: bilan.aEnvoyer, sans_contact: bilan.sansContact })
      continue
    }
    total.emails += bilan.emails
    total.referent += bilan.referent
    total.whatsapp += bilan.whatsapp
    if (bilan.sansContact.length) total.sansContact.push(`${sess.id}: ${bilan.sansContact.join(', ')}`)

    // Fiche mission du formateur : une seule fois par session
    if (!sess.convocations_sent_at) {
      const f: any = (sess as any).formateur
      if (f?.user_id) {
        const { count } = await supabase.from('inscriptions').select('id', { count: 'exact', head: true })
          .eq('session_id', sess.id).not('status', 'in', '("annule","abandonne")')
        await createNotification({
          organizationId: sess.organization_id,
          userId: f.user_id,
          titre: 'Fiche de mission, formation imminente',
          message: `Votre mission « ${(sess as any).formation?.intitule || 'Formation'} » démarre le ${new Date(sess.date_debut).toLocaleDateString('fr-FR')}. ${count || 0} stagiaire${(count || 0) > 1 ? 's' : ''} inscrit${(count || 0) > 1 ? 's' : ''}.`,
          type: 'session',
          lienUrl: `/mon-espace`,
          lienLabel: 'Voir la mission',
          entityType: 'session',
          entityId: sess.id,
        }).catch(() => {})
      }
      await supabase.from('sessions').update({ convocations_sent_at: new Date().toISOString() }).eq('id', sess.id)
    }
  }

  return NextResponse.json({ success: true, fenetre: `${iso(aujourdhui)} → ${iso(limite)}`, ...total })
}
