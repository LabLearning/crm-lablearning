import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { DocumentsList } from './DocumentsList'
import type { Document } from '@/lib/types/document'

export default async function DocumentsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [
    { data: documents },
    { data: formateurs },
    { data: apprenants },
    { data: contacts },
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('*, client:clients(raison_sociale), signatures(*)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('formateurs')
      .select('id, prenom, nom, email')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .not('email', 'is', null)
      .order('nom'),
    supabase
      .from('apprenants')
      .select('id, prenom, nom, email')
      .eq('organization_id', orgId)
      .not('email', 'is', null)
      .order('nom'),
    supabase
      .from('contacts')
      .select('id, prenom, nom, email, client:clients(raison_sociale)')
      .eq('organization_id', orgId)
      .not('email', 'is', null)
      .order('nom'),
  ])

  return (
    <div className="animate-fade-in">
      <DocumentsList
        documents={(documents || []) as Document[]}
        formateurs={(formateurs || []) as any[]}
        apprenants={(apprenants || []) as any[]}
        contacts={(contacts || []) as any[]}
      />
    </div>
  )
}
