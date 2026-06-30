import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanningCalendar } from './PlanningCalendar'
import { CalendarSync } from './CalendarSync'
import { getGoogleCalendarEvents } from '@/lib/google-calendar'

export default async function PlanningFormateurPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: formateur } = await supabase
    .from('formateurs')
    .select('id, email')
    .eq('user_id', session.user.id)
    .single()

  if (!formateur) redirect('/dashboard/formateur-home')

  // Disponibilités sur les 6 prochains mois
  const now = new Date()
  const sixMonths = new Date(now.getFullYear(), now.getMonth() + 6, 1)

  // Requêtes indépendantes en parallèle : dispos, sessions, fiche formateur (Google) + events Google
  const [
    { data: dispos },
    { data: sessions },
    { data: formateurFull },
    googleEvents,
  ] = await Promise.all([
    // Disponibilités sur les 6 prochains mois
    supabase
      .from('formateur_disponibilites')
      .select('id, date, type, creneau')
      .eq('formateur_id', formateur.id)
      .gte('date', now.toISOString().split('T')[0])
      .lte('date', sixMonths.toISOString().split('T')[0]),
    // Sessions planifiées
    supabase
      .from('sessions')
      .select('id, reference, date_debut, date_fin, lieu, status, formation:formation_id(intitule)')
      .eq('formateur_id', formateur.id)
      .not('status', 'eq', 'annulee')
      .gte('date_fin', now.toISOString().split('T')[0]),
    // Vérifier si Google est connecté
    supabase
      .from('formateurs')
      .select('google_calendar_connected')
      .eq('id', formateur.id)
      .single(),
    // Récupérer les événements Google Calendar (Google non connecté -> [])
    getGoogleCalendarEvents(formateur.id).catch(() => [] as any[]),
  ])

  const isGoogleConnected = googleEvents.length > 0 || false // sera mis à jour par la page

  // Générer le token de sync calendrier
  const calendarToken = Buffer.from((formateur.email || '') + formateur.id).toString('base64url').substring(0, 20)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const calendarUrl = `${appUrl}/api/calendar/${formateur.id}?token=${calendarToken}`

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Mon planning</h1>
          <p className="text-surface-500 mt-1 text-sm">Gérez vos disponibilités et consultez vos sessions</p>
        </div>
        <CalendarSync calendarUrl={calendarUrl} isGoogleConnected={formateurFull?.google_calendar_connected || false} />
      </div>
      <PlanningCalendar
        disponibilites={(dispos || []) as any[]}
        sessions={(sessions || []) as any[]}
        googleEvents={googleEvents as any[]}
        isGoogleConnected={formateurFull?.google_calendar_connected || false}
      />
    </div>
  )
}
