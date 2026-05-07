/**
 * Vérification de la disponibilité d'un formateur sur une plage de dates.
 * Croise 2 sources :
 *   1. Sessions Lab Learning où il est déjà attribué (pas en statut annulée)
 *   2. Événements de son Google Calendar (s'il a connecté la synchro)
 */

import { createServiceRoleClient } from '@/lib/supabase/server'
import { getGoogleCalendarEvents } from '@/lib/google-calendar'

export interface DispoConflict {
  source: 'session' | 'google'
  date_debut: string  // YYYY-MM-DD
  date_fin: string    // YYYY-MM-DD
  title: string
  reference?: string  // Pour les sessions Lab Learning
}

export interface DispoResult {
  formateur_id: string
  date_debut: string
  date_fin: string
  is_available: boolean
  conflicts: DispoConflict[]
  google_calendar_connected: boolean
}

/** Deux plages de dates se chevauchent ? Comparaison inclusive */
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export async function checkFormateurDisponibilite(
  formateurId: string,
  dateDebut: string,
  dateFin: string,
  options?: { excludeSessionId?: string },
): Promise<DispoResult> {
  const supabase = await createServiceRoleClient()
  const conflicts: DispoConflict[] = []

  // ── 1. Sessions Lab Learning du formateur sur cette plage ──
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, status, formation:formations(intitule)')
    .eq('formateur_id', formateurId)
    .not('status', 'eq', 'annulee')
    .lte('date_debut', dateFin)
    .gte('date_fin', dateDebut)

  if (options?.excludeSessionId) sessionsQuery = sessionsQuery.neq('id', options.excludeSessionId)

  const { data: sessions } = await sessionsQuery
  for (const s of sessions || []) {
    conflicts.push({
      source: 'session',
      date_debut: s.date_debut,
      date_fin: s.date_fin,
      title: s.intitule || (s as any).formation?.intitule || 'Session',
      reference: s.reference || undefined,
    })
  }

  // ── 2. Événements Google Calendar du formateur ──
  const { data: formateur } = await supabase
    .from('formateurs')
    .select('google_calendar_connected')
    .eq('id', formateurId)
    .single()

  const googleConnected = !!formateur?.google_calendar_connected
  if (googleConnected) {
    const events = await getGoogleCalendarEvents(formateurId)
    for (const e of events) {
      if (rangesOverlap(dateDebut, dateFin, e.date_debut, e.date_fin)) {
        conflicts.push({
          source: 'google',
          date_debut: e.date_debut,
          date_fin: e.date_fin,
          title: e.title,
        })
      }
    }
  }

  return {
    formateur_id: formateurId,
    date_debut: dateDebut,
    date_fin: dateFin,
    is_available: conflicts.length === 0,
    conflicts,
    google_calendar_connected: googleConnected,
  }
}
