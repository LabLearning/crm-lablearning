import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ApprenantsList } from './ApprenantsList'
import type { Apprenant, Inscription } from '@/lib/types/formation'

const PER_PAGE = 50

// Échappe les caractères réservés de la syntaxe .or() de PostgREST
function sanitizeSearch(q: string) {
  return q.replace(/[,()"]/g, ' ').trim()
}

export default async function ApprenantsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string }
}) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const q = sanitizeSearch(searchParams.q || '')
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let apprenantsQuery = supabase
    .from('apprenants')
    .select('*, client:clients(raison_sociale)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('nom', { ascending: true })
    .range(from, to)

  if (q) {
    apprenantsQuery = apprenantsQuery.or(
      `nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%,entreprise.ilike.%${q}%`
    )
  }

  const [{ data: apprenants, count }, { data: clients }, { data: sessions }] = await Promise.all([
    apprenantsQuery,
    supabase
      .from('clients')
      .select('id, raison_sociale')
      .eq('organization_id', orgId)
      .eq('type', 'entreprise')
      .order('raison_sociale'),
    // Sessions disponibles (à venir ou en cours) pour l'inscription
    supabase
      .from('sessions')
      .select('id, reference, date_debut, date_fin, formation:formation_id(intitule)')
      .eq('organization_id', orgId)
      .in('status', ['planifiee', 'confirmee', 'en_cours'])
      .order('date_debut', { ascending: true }),
  ])

  // Inscriptions uniquement pour les apprenants de la page affichée
  const apprenantIds = (apprenants || []).map((a) => a.id)
  let inscriptions: Inscription[] = []
  if (apprenantIds.length > 0) {
    const { data } = await supabase
      .from('inscriptions')
      .select('*, session:sessions(reference, date_debut, date_fin)')
      .in('apprenant_id', apprenantIds)
      .order('date_inscription', { ascending: false })
    inscriptions = (data || []) as Inscription[]
  }

  return (
    <div className="animate-fade-in">
      <ApprenantsList
        apprenants={(apprenants || []) as Apprenant[]}
        clients={(clients || []) as any[]}
        sessions={(sessions || []) as any[]}
        inscriptions={inscriptions}
        total={count || 0}
        page={page}
        perPage={PER_PAGE}
        initialSearch={searchParams.q || ''}
      />
    </div>
  )
}
