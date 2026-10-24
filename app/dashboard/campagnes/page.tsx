import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { peutGererCampagnes } from '@/lib/acces-reserves'
import { configCampagnes, manquesPourEnvoyer, URL_CRM } from '@/lib/campagnes/config'
import { CampagnesListe } from './CampagnesListe'

export const dynamic = 'force-dynamic'

/**
 * Campagnes marketing : e-mails et SMS aux prospects et aux clients
 * professionnels, envoyés par Brevo. Réservé aux responsables. Aucun secret
 * ne part au navigateur : seulement ce qui manque pour envoyer.
 */
export default async function CampagnesPage() {
  const session = await getSession()
  if (!peutGererCampagnes(session.user.role)) redirect('/dashboard')
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const oppositions = (canal: 'email' | 'sms') => supabase.from('oppositions_marketing')
    .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('canal', canal)
  const [campagnesRes, oppEmail, oppSms] = await Promise.all([
    supabase.from('campagnes').select('id, nom, canal, statut, objet, nb_destinataires, nb_envoyes, nb_echecs, nb_desinscrits, programmee_le, lancee_le, terminee_le, created_at, updated_at')
      .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(200),
    oppositions('email'),
    oppositions('sms'),
  ])
  // Avant la migration 168, les tables n'existent pas : on le dit
  const migrationManquante = !!campagnesRes.error
  const config = configCampagnes()

  return (
    <div className="animate-fade-in">
      <CampagnesListe
        campagnes={((campagnesRes.data || []) as any[])}
        migrationManquante={migrationManquante}
        manquesEmail={manquesPourEnvoyer('email', config)}
        manquesSms={manquesPourEnvoyer('sms', config)}
        webhookBranche={!!config.secretWebhook}
        urlWebhook={`${URL_CRM}/api/webhooks/brevo?cle=`}
        oppositions={{ email: oppEmail.count || 0, sms: oppSms.count || 0 }}
      />
    </div>
  )
}
