import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import NotificationsClient from './NotificationsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications — CRM Lab Learning' }

export default async function NotificationsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return <NotificationsClient initial={(notifs || []) as any[]} userId={session.user.id} />
}
