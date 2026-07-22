'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { CreneauPanel, CreneauStatus, type EmargementRow, type FeuilleRow } from '../CreneauPanel'
import { creneauLabel, formatFullDate } from '../helpers'

export interface DayRow {
  date: string
  creneaux: {
    creneau: string
    emargements: EmargementRow[]
    feuille: FeuilleRow | null
    scanUrl?: string | null
  }[]
}

interface Props {
  token: string
  sessionId: string
  days: DayRow[]
  today: string
  /** Mode choisi pour toute la session : le créneau ne le redemande plus */
  modeSession: 'numerique' | 'papier'
}

function DayBlock({
  token,
  sessionId,
  day,
  isToday,
  defaultOpen,
  modeSession,
}: {
  token: string
  sessionId: string
  day: DayRow
  isToday: boolean
  defaultOpen: boolean
  modeSession: 'numerique' | 'papier'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)

  const validated = day.creneaux.filter((c) => c.feuille?.validated_at).length
  const complete = validated === day.creneaux.length

  return (
    <div className={`card overflow-hidden ${isToday ? 'ring-2 ring-emerald-200' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left active:bg-surface-50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarDays className={`h-4 w-4 shrink-0 ${isToday ? 'text-emerald-600' : 'text-surface-400'}`} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-surface-900 capitalize truncate">
              {formatFullDate(day.date)}
            </div>
            <div className="text-[11px] text-surface-500 mt-0.5">
              {isToday && <span className="text-emerald-600 font-semibold">Aujourd&apos;hui · </span>}
              {validated}/{day.creneaux.length} feuille{day.creneaux.length > 1 ? 's' : ''} validée
              {validated > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {complete && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          {open ? (
            <ChevronUp className="h-4 w-4 text-surface-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-surface-100">
          {day.creneaux.map((c) => (
            <div key={c.creneau} className="border-b border-surface-100 last:border-0">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-semibold text-surface-800">{creneauLabel(c.creneau)}</span>
                <CreneauStatus emargements={c.emargements} feuille={c.feuille} />
              </div>
              <CreneauPanel
                token={token}
                sessionId={sessionId}
                date={day.date}
                creneau={c.creneau}
                emargements={c.emargements}
                feuille={c.feuille}
                scanUrl={c.scanUrl}
                modeSession={modeSession}
                onChange={() => router.refresh()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SessionDays({ token, sessionId, days, today, modeSession }: Props) {
  const hasToday = days.some((d) => d.date === today)

  if (days.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-surface-500">
        <CalendarDays className="h-8 w-8 mx-auto mb-3 text-surface-300" />
        Aucune feuille d&apos;émargement pour cette session.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <DayBlock
          key={day.date}
          token={token}
          sessionId={sessionId}
          day={day}
          isToday={day.date === today}
          modeSession={modeSession}
          // Sans séance du jour, on ouvre la première journée non terminée :
          // le formateur tombe directement sur ce qu'il lui reste à faire.
          defaultOpen={
            day.date === today ||
            (!hasToday && day.date === (days.find((d) => d.creneaux.some((c) => !c.feuille?.validated_at))?.date))
          }
        />
      ))}
    </div>
  )
}
