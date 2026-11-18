import { createServiceRoleClient } from '@/lib/supabase/server'
import { questionnairePourParcours, versionPublique } from '@/lib/poei-positionnement'
import { resolveEmailLogoUrl } from '@/lib/pdf/org-logo'
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
    // « * » plutôt qu'une liste : vivier_candidat_id n'existe qu'après la migration 173
    .select('*, candidat:candidat_id(apprenant:apprenants(prenom, nom)), poei:poei_id(numero, date_debut, formation:formations(intitule), client:client_id(raison_sociale, nom_commercial))')
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
    .select('id, name, logo_url').eq('id', (pos as any).organization_id).maybeSingle()
  // Écrans sur fond pine : version blanche du logo
  const logo = await resolveEmailLogoUrl(supabase, org)
  const appr: any = (pos as any).candidat?.apprenant
  // Envoyé depuis le vivier, avant la validation : le prénom vient de la fiche du vivier
  let prenom: string | null = appr?.prenom || null
  if (!prenom && (pos as any).vivier_candidat_id) {
    const { data: v } = await supabase.from('candidats_vivier').select('prenom')
      .eq('id', (pos as any).vivier_candidat_id).eq('organization_id', (pos as any).organization_id).maybeSingle()
    prenom = v?.prenom || null
  }
  const poei: any = (pos as any).poei
  const employeur = poei?.client?.nom_commercial || poei?.client?.raison_sociale || null

  if (pos.statut === 'complete') {
    return (
      <PositionnementCadre logo={logo}>
        <h1 className="text-xl font-heading font-bold text-surface-900">Questionnaire déjà rendu</h1>
        <p className="text-sm text-surface-600 mt-2">
          Merci, vos réponses ont bien été enregistrées. Votre formateur les reprendra avec vous au démarrage
          de la formation.
        </p>
      </PositionnementCadre>
    )
  }

  // Le questionnaire du concept (tacos ou générique), sans les bonnes réponses :
  // elles ne quittent jamais le serveur
  const q = questionnairePourParcours({ formation: poei?.formation?.intitule, entreprise: employeur })
  const { questions, domaines } = versionPublique(q)

  return (
    <PositionnementClient
      token={params.token}
      prenom={prenom}
      employeur={employeur}
      orgNom={org?.name || 'Lab Learning'}
      orgLogo={logo}
      questions={questions}
      domaines={domaines}
      dureeMinutes={q.dureeMinutes}
    />
  )
}
