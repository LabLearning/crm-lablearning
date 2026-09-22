import { createServiceRoleClient } from '@/lib/supabase/server'
import { FormateurSessionList } from '@/app/portail/[token]/FormateurSessionList'
import { sessionsFormateur } from '@/lib/formateur-sessions'

/** Liste des sessions pour le contenu pédagogique. Liens via `basePath`. */
export async function ContenuListView({ formateurId, basePath }: { formateurId: string; basePath: string }) {
  const supabase = await createServiceRoleClient()

  const sessions = await sessionsFormateur(
    supabase, formateurId,
    'id, reference, intitule, status, date_debut, date_fin, lieu, ville, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial, ville)',
  )

  return (
    <FormateurSessionList
      basePath={basePath}
      segment="contenu"
      title="Contenu pédagogique"
      subtitle="Choisissez une session pour consulter son déroulé, son matériel et ses supports."
      sessions={(sessions || []) as any[]}
      emptyLabel="Aucune session active"
    />
  )
}
