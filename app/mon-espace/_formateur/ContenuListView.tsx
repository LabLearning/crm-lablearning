import { createServiceRoleClient } from '@/lib/supabase/server'
import { FormateurSessionList } from '@/app/portail/[token]/FormateurSessionList'

/** Liste des sessions pour le contenu pédagogique. Liens via `basePath`. */
export async function ContenuListView({ formateurId, basePath }: { formateurId: string; basePath: string }) {
  const supabase = await createServiceRoleClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, lieu, ville, formation:formation_id(intitule)')
    .eq('formateur_id', formateurId)
    .in('status', ['planifiee', 'confirmee', 'en_attente_signatures', 'validee', 'en_cours'])
    .order('date_debut', { ascending: true })

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
