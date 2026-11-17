import { redirect } from 'next/navigation'
import { getOptionalSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { QUESTIONNAIRES, versionPublique, type CodeQuestionnaire } from '@/lib/poei-positionnement'
import { resolveEmailLogoUrl } from '@/lib/pdf/org-logo'
import { PositionnementClient } from '../../[token]/PositionnementClient'

export const dynamic = 'force-dynamic'

/** Rôles qui envoient le questionnaire (app/dashboard/poei/positionnement-actions.ts) */
const ROLES_APERCU = ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial', 'formateur']

/**
 * Aperçu du questionnaire de positionnement, tel que le voit le candidat :
 * même écran, mêmes questions, sans bonne réponse transmise et sans rien
 * enregistrer à la fin. Réservé à l'équipe connectée.
 */
export default async function ApercuPositionnement({ params }: { params: { concept: string } }) {
  const user = await getOptionalSession()
  if (!user) redirect('/login')
  if (!ROLES_APERCU.includes(user.role)) redirect('/dashboard')

  const q = QUESTIONNAIRES[params.concept as CodeQuestionnaire]
  if (!q) redirect('/dashboard/poei')

  const supabase = await createServiceRoleClient()
  const { data: org } = await supabase.from('organizations')
    .select('id, name, logo_url').eq('id', user.organization_id).maybeSingle()
  // Écrans sur fond pine : version blanche du logo
  const logo = await resolveEmailLogoUrl(supabase, org)
  const { questions, domaines } = versionPublique(q)

  return (
    <PositionnementClient
      token=""
      prenom={user.first_name || null}
      employeur={null}
      orgNom={org?.name || 'Lab Learning'}
      orgLogo={logo}
      questions={questions}
      domaines={domaines}
      dureeMinutes={q.dureeMinutes}
      apercu
    />
  )
}
