import { createServiceRoleClient } from '@/lib/supabase/server'
import { FormateurSessionList } from '@/app/portail/[token]/FormateurSessionList'
import { sessionsFormateur } from '@/lib/formateur-sessions'

/** Liste des sessions pour les questionnaires. Liens via `basePath`. */
export async function QcmListView({ formateurId, basePath }: { formateurId: string; basePath: string }) {
  const supabase = await createServiceRoleClient()

  // Les sessions terminées restent listées : évaluation des acquis et
  // satisfaction à chaud se remplissent en fin de session, la satisfaction à
  // froid à J+30 / J+90.
  const sessions = await sessionsFormateur(
    supabase, formateurId,
    'id, reference, intitule, status, date_debut, date_fin, lieu, ville, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial, ville)',
  )

  return (
    <FormateurSessionList
      basePath={basePath}
      segment="qcm"
      title="Questionnaires"
      subtitle="Choisissez une session pour suivre le positionnement et projeter les QR codes des QCM."
      sessions={(sessions || []) as any[]}
      emptyLabel="Aucune session active"
    />
  )
}
