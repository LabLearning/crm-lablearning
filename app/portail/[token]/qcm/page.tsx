import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormateurSessionList } from '../FormateurSessionList'

export const dynamic = 'force-dynamic'

export default async function PortalQcmPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, lieu, ville, formation:formation_id(intitule)')
    .eq('formateur_id', context.formateur.id)
    .in('status', ['planifiee', 'confirmee', 'en_attente_signatures', 'validee', 'en_cours'])
    .order('date_debut', { ascending: true })

  return (
    <FormateurSessionList
      token={params.token}
      segment="qcm"
      title="Questionnaires"
      subtitle="Choisissez une session pour suivre le positionnement et projeter les QR codes des QCM."
      sessions={(sessions || []) as any[]}
      emptyLabel="Aucune session active"
    />
  )
}
