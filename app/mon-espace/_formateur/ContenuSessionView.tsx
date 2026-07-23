import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SessionHeaderFormateur } from '@/app/portail/[token]/SessionHeaderFormateur'
import { ContenuPedagogiqueFormateur } from '@/app/portail/[token]/ContenuPedagogique'
import { getSessionSupports } from '@/lib/session-contenu'

/**
 * Détail du contenu pédagogique d'une session, partagé espace connecté /
 * portail. Ownership vérifiée sur le formateur, jamais sur l'URL. Le `token`
 * reste transmis pour les téléchargements de supports.
 */
export async function ContenuSessionView({
  formateurId,
  formateurName,
  token,
  basePath,
  sessionId,
  deniedRedirect,
}: {
  formateurId: string
  formateurName: string
  token: string
  basePath: string
  sessionId: string
  deniedRedirect: string
}) {
  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, reference, intitule, date_debut, date_fin, horaires, lieu, adresse, code_postal, ville, formateur_id, organization_id, deroule_pedagogique, materiel_necessaire, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale)',
    )
    .eq('id', sessionId)
    .maybeSingle()

  // Le sessionId vient de l'URL : il doit appartenir au formateur.
  if (!session || session.formateur_id !== formateurId) redirect(deniedRedirect)

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(id, prenom, nom)')
    .eq('session_id', session.id)
    .not('status', 'in', '("annule","abandonne")')

  const stagiaires = (inscriptions || [])
    .map((i: any) => i.apprenant)
    .filter(Boolean)
    .sort((a: any, b: any) => `${a.nom}`.localeCompare(`${b.nom}`))

  const supportsBySession = await getSessionSupports(supabase, [session.id], 'formateur')
  const supports = supportsBySession[session.id] || []

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`${basePath}/contenu`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 active:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>

      <SessionHeaderFormateur
        session={session as any}
        formateurName={formateurName}
        stagiaires={stagiaires}
      />

      <ContenuPedagogiqueFormateur
        token={token}
        deroule={(session as any).deroule_pedagogique || null}
        materiel={(session as any).materiel_necessaire || null}
        supports={supports}
      />
    </div>
  )
}
