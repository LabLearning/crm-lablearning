import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { peutGererCampagnes } from '@/lib/acces-reserves'
import { configCampagnes, manquesPourEnvoyer } from '@/lib/campagnes/config'
import { CampagneEditeur } from './CampagneEditeur'

export const dynamic = 'force-dynamic'
// « Envoyer maintenant » calcule et fige l'audience (plusieurs milliers de lignes possibles)
export const maxDuration = 120

/** Une campagne : brouillon à écrire, ou suivi de l'envoi (compteurs, derniers échecs). */
export default async function CampagnePage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!peutGererCampagnes(session.user.role)) redirect('/dashboard')
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const { data: campagne } = await supabase.from('campagnes').select('*').eq('id', params.id).eq('organization_id', orgId).maybeSingle()
  if (!campagne) notFound()

  const compter = (statut: string) => supabase.from('campagne_envois').select('id', { count: 'exact', head: true }).eq('campagne_id', params.id).eq('statut', statut)
  const [{ data: franchises }, aEnvoyer, enCours, envoyes, echecs, exclus, { data: derniersEchecs }, { data: enAttente }] = await Promise.all([
    supabase.from('franchises').select('id, nom').eq('organization_id', orgId).order('nom'),
    compter('a_envoyer'), compter('en_cours'), compter('envoye'), compter('echec'), compter('exclu'),
    supabase.from('campagne_envois').select('nom, destination, erreur').eq('campagne_id', params.id).eq('statut', 'echec').order('envoye_le', { ascending: false }).limit(10),
    // Erreur de compte de Brevo (crédits, clé, quota) qui retient des envois « à envoyer »
    supabase.from('campagne_envois').select('erreur').eq('campagne_id', params.id).eq('statut', 'a_envoyer').not('erreur', 'is', null).limit(1),
  ])
  const config = configCampagnes()
  // Campagne arrêtée : ce qui attendait ne partira plus (compté avec les écartés) ; seuls les envois déjà en vol au
  // moment de l'arrêt peuvent encore partir (au-delà de 15 minutes, ils passent en échec, état inconnu)
  const active = (campagne as any).statut === 'programmee' || (campagne as any).statut === 'en_cours'

  return (
    <div className="animate-fade-in">
      <CampagneEditeur
        campagne={campagne as any}
        franchises={((franchises || []) as any[]).map((f) => ({ id: f.id, nom: f.nom }))}
        manques={manquesPourEnvoyer((campagne as any).canal, config)}
        numeroStop={config.numeroStop}
        expediteurSms={config.expediteurSms}
        expediteurEmail={config.expediteurEmail}
        envois={{
          aEnvoyer: (enCours.count || 0) + (active ? (aEnvoyer.count || 0) : 0),
          envoyes: envoyes.count || 0, echecs: echecs.count || 0,
          exclus: (exclus.count || 0) + (active ? 0 : (aEnvoyer.count || 0)),
        }}
        derniersEchecs={((derniersEchecs || []) as any[]).map((e) => ({ nom: e.nom, erreur: e.erreur }))}
        derniereErreur={((enAttente || []) as any[])[0]?.erreur || null}
        aMonMobile={!!(session.user as any).phone}
      />
    </div>
  )
}
