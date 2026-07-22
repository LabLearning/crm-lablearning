import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SessionHeaderFormateur } from '../../SessionHeaderFormateur'
import { ContenuPedagogiqueFormateur } from '../../ContenuPedagogique'
import { getSessionSupports } from '@/lib/session-contenu'

export const dynamic = 'force-dynamic'

export default async function PortalContenuSessionPage({
  params,
}: {
  params: { token: string; sessionId: string }
}) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, reference, intitule, date_debut, date_fin, horaires, lieu, adresse, code_postal, ville, formateur_id, organization_id, deroule_pedagogique, materiel_necessaire, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale)',
    )
    .eq('id', params.sessionId)
    .maybeSingle()

  // Le sessionId vient de l'URL : il doit appartenir au formateur du token.
  if (!session || session.formateur_id !== context.formateur.id) redirect('/portail/expired')

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
        href={`/portail/${params.token}/contenu`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 active:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>

      <SessionHeaderFormateur
        session={session as any}
        formateurName={`${context.formateur.prenom} ${context.formateur.nom}`}
        stagiaires={stagiaires}
      />

      <ContenuPedagogiqueFormateur
        token={params.token}
        deroule={(session as any).deroule_pedagogique || null}
        materiel={(session as any).materiel_necessaire || null}
        supports={supports}
      />
    </div>
  )
}
