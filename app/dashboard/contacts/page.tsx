import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ContactsList } from './ContactsList'
import type { Contact, Client } from '@/lib/types/crm'

export default async function ContactsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: contacts }, { data: clients }] = await Promise.all([
    supabase
      .from('contacts')
      .select('*, client:clients(raison_sociale, type)')
      .eq('organization_id', session.organization.id)
      .order('nom', { ascending: true }),
    supabase
      .from('clients')
      .select('id, raison_sociale, type')
      .eq('organization_id', session.organization.id)
      .order('raison_sociale', { ascending: true }),
  ])

  return (
    <div className="animate-fade-in">
      <ContactsList
        contacts={(contacts || []) as Contact[]}
        clients={(clients || []) as any[]}
      />
    </div>
  )
}
