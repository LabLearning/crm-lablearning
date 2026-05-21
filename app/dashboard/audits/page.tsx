import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import AuditsClient from './AuditsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Audits — CRM Lab Learning' }

export default async function AuditsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const isAdmin = session.user.role === 'super_admin' || session.user.role === 'gestionnaire'

  const [auditsRes, clientsRes, keysRes] = await Promise.all([
    supabase
      .from('audits_etablissement')
      .select(`
        id, date_audit, type_audit, note_globale, note_sur, points_forts,
        points_amelioration, bilan, commentaires, fichier_url, created_at,
        client:clients(id, raison_sociale, ville),
        franchise:apporteurs_affaires(id, nom_enseigne, raison_sociale),
        auteur:users(first_name, last_name)
      `)
      .eq('organization_id', orgId)
      .order('date_audit', { ascending: false })
      .limit(300),
    supabase
      .from('clients')
      .select('id, raison_sociale, franchise_id')
      .eq('organization_id', orgId)
      .order('raison_sociale'),
    isAdmin
      ? supabase
          .from('api_keys')
          .select('id, name, key_prefix, scopes, last_used_at, request_count, is_active, created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  return (
    <AuditsClient
      audits={(auditsRes.data || []) as any[]}
      clients={(clientsRes.data || []) as any[]}
      apiKeys={(keysRes.data || []) as any[]}
      isAdmin={isAdmin}
      ingestUrl={`${appUrl}/api/audits/ingest`}
    />
  )
}
