import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { MailingClient } from './MailingClient'

export default async function MailingPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // Fetch leads with email + clients with contacts (indépendants entre eux)
  const [{ data: leads }, { data: contacts }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, contact_nom, contact_prenom, contact_email, entreprise, status')
      .eq('organization_id', orgId)
      .not('contact_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('contacts')
      .select('id, nom, prenom, email, client:clients(raison_sociale)')
      .eq('organization_id', orgId)
      .not('email', 'is', null)
      .limit(500),
  ])

  const allContacts = [
    ...(leads || []).map((l: any) => ({
      id: l.id,
      nom: `${l.contact_nom || ''} ${l.contact_prenom || ''}`.trim(),
      email: l.contact_email,
      entreprise: l.entreprise || '',
      source: 'lead' as const,
      status: l.status,
    })),
    ...(contacts || []).map((c: any) => ({
      id: c.id,
      nom: `${c.nom || ''} ${c.prenom || ''}`.trim(),
      email: c.email,
      entreprise: c.client?.raison_sociale || '',
      source: 'client' as const,
      status: 'client',
    })),
  ].filter(c => c.email)

  return (
    <div className="animate-fade-in">
      <MailingClient contacts={allContacts} orgName={session.organization.name} userName={`${session.user.first_name} ${session.user.last_name}`} />
    </div>
  )
}
