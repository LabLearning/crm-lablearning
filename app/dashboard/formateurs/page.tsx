import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { FormateursList } from './FormateursList'
import type { Formateur } from '@/lib/types/formation'

export default async function FormateursPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: formateurs } = await supabase
    .from('formateurs')
    .select('*')
    .eq('organization_id', session.organization.id)
    .order('nom', { ascending: true })

  // Count sessions per formateur (1 seule requête batch au lieu de N)
  const sessionCounts: Record<string, number> = {}
  if (formateurs && formateurs.length > 0) {
    const { data: sessionRows } = await supabase
      .from('sessions')
      .select('formateur_id')
      .in('formateur_id', formateurs.map((f) => f.id))
    for (const row of sessionRows || []) {
      if (row.formateur_id) {
        sessionCounts[row.formateur_id] = (sessionCounts[row.formateur_id] || 0) + 1
      }
    }
  }

  // Lien général d'inscription (migration 160) ; absent tant qu'elle n'est pas appliquée
  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).maybeSingle()
  const lienInscription = {
    token: ((org as any)?.inscription_formateur_token as string | null) || null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr',
    peutRegenerer: session.user.role === 'super_admin',
    visible: ['super_admin', 'gestionnaire', 'commercial'].includes(session.user.role),
  }

  // Candidatures déposées sur le site : fiches créées par le formulaire de recrutement, encore inactives et à étudier
  const { data: depots } = await supabase.from('formateur_inscriptions').select('formateur_id')
    .eq('organization_id', session.organization.id).eq('payload->>origine', 'candidature').eq('resultat', 'cree').limit(1000)
  const deposees = new Set(((depots || []) as any[]).map((d) => d.formateur_id))
  const candidatIds = (formateurs || []).filter((f: any) => deposees.has(f.id) && !f.is_active && f.a_verifier).map((f: any) => f.id)

  return (
    <div className="animate-fade-in">
      <FormateursList
        formateurs={(formateurs || []) as Formateur[]}
        sessionCounts={sessionCounts}
        lienInscription={lienInscription}
        candidatIds={candidatIds}
        peutTraiterCandidatures={['super_admin', 'gestionnaire'].includes(session.user.role)}
      />
    </div>
  )
}
