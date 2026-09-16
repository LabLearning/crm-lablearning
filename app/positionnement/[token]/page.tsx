import { createServiceRoleClient } from '@/lib/supabase/server'
import { QUESTIONS } from '@/lib/poei-positionnement'
import { PositionnementClient, PositionnementCadre } from './PositionnementClient'

export const dynamic = 'force-dynamic'

/**
 * Questionnaire de positionnement, répondu par le candidat lui-même.
 * Accès par lien personnel : ni compte ni mot de passe, le candidat répond
 * depuis son téléphone avant d'entrer en formation.
 */
export default async function PositionnementPage({ params }: { params: { token: string } }) {
  const supabase = await createServiceRoleClient()
  const { data: pos } = await supabase
    .from('poei_positionnements')
    .select('id, statut, note, organization_id, candidat:candidat_id(apprenant:apprenants(prenom, nom)), poei:poei_id(numero, date_debut, client:client_id(raison_sociale, nom_commercial))')
    .eq('token', params.token).maybeSingle()

  if (!pos) {
    return (
      <PositionnementCadre>
        <h1 className="text-xl font-heading font-bold text-surface-900">Lien introuvable</h1>
        <p className="text-sm text-surface-600 mt-2">
          Ce questionnaire n&apos;existe pas ou a été retiré. Rapprochez-vous de votre organisme de formation.
        </p>
      </PositionnementCadre>
    )
  }

  const { data: org } = await supabase.from('organizations')
    .select('name, logo_url').eq('id', (pos as any).organization_id).maybeSingle()
  const appr: any = (pos as any).candidat?.apprenant
  const poei: any = (pos as any).poei
  const employeur = poei?.client?.nom_commercial || poei?.client?.raison_sociale || null

  if (pos.statut === 'complete') {
    return (
      <PositionnementCadre logo={org?.logo_url}>
        <h1 className="text-xl font-heading font-bold text-surface-900">Questionnaire déjà rendu</h1>
        <p className="text-sm text-surface-600 mt-2">
          Merci, vos réponses ont bien été enregistrées. Votre formateur les reprendra avec vous au démarrage
          de la formation.
        </p>
      </PositionnementCadre>
    )
  }

  return (
    <PositionnementClient
      token={params.token}
      prenom={appr?.prenom || null}
      employeur={employeur}
      orgNom={org?.name || 'Lab Learning'}
      orgLogo={org?.logo_url || null}
      nbQuestions={QUESTIONS.length}
    />
  )
}
