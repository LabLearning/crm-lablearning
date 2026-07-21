export type Creneau = 'matin' | 'apres_midi' | 'journee'

export function creneauLabel(c: string) {
  if (c === 'matin') return 'Matin'
  if (c === 'apres_midi') return 'Après-midi'
  return 'Journée'
}

export function formatFullDate(dateStr: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(dateStr))
}

export function formatShortDate(dateStr: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(dateStr))
}

export function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0]
}

const CRENEAU_ORDER: Record<string, number> = { matin: 0, journee: 1, apres_midi: 2 }

export function sortCreneaux(list: string[]) {
  return [...list].sort((a, b) => (CRENEAU_ORDER[a] ?? 9) - (CRENEAU_ORDER[b] ?? 9))
}
