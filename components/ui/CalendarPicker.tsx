'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarPickerProps {
  /** Dates sélectionnées au format YYYY-MM-DD */
  selectedDates: string[]
  onToggle: (date: string) => void
  /** Date min (YYYY-MM-DD) en dessous de laquelle on ne peut pas sélectionner */
  minDate?: string
}

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CalendarPicker({ selectedDates, onToggle, minDate }: CalendarPickerProps) {
  // Le mois affiché (par défaut : mois de la 1re date sélectionnée ou aujourd'hui)
  const [viewMonth, setViewMonth] = useState(() => {
    const ref = selectedDates.length > 0 ? new Date(selectedDates.sort()[0]) : new Date()
    return new Date(ref.getFullYear(), ref.getMonth(), 1)
  })

  const today = useMemo(() => formatYMD(new Date()), [])
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  // Calcule les cellules de la grille (semaines de 7 jours, lundi en premier)
  const cells = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    // Lundi = 0, Dimanche = 6 (offset depuis getDay() où Dimanche = 0)
    const firstWeekday = (firstDay.getDay() + 6) % 7
    const totalCells = Math.ceil((firstWeekday + lastDay.getDate()) / 7) * 7
    const result: Array<{ date: string; day: number; inMonth: boolean }> = []
    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - firstWeekday
      const d = new Date(year, month, 1 + dayOffset)
      result.push({
        date: formatYMD(d),
        day: d.getDate(),
        inMonth: d.getMonth() === month,
      })
    }
    return result
  }, [viewMonth])

  function prev() { setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function next() { setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  return (
    <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100">
        <button type="button" onClick={prev} className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-50 hover:text-surface-800 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-surface-900">
          {MONTHS_FR[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </div>
        <button type="button" onClick={next} className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-50 hover:text-surface-800 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 px-2 pt-2 pb-1">
        {DAYS_FR.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-surface-400 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 px-2 pb-2 gap-0.5">
        {cells.map((c) => {
          const isSelected = selectedSet.has(c.date)
          const isToday = c.date === today
          const isPast = minDate && c.date < minDate
          return (
            <button
              key={c.date}
              type="button"
              disabled={!!isPast}
              onClick={() => onToggle(c.date)}
              className={`
                aspect-square text-sm font-medium rounded-lg transition-all
                ${!c.inMonth ? 'text-surface-300' : 'text-surface-800'}
                ${isSelected
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm ring-2 ring-brand-200'
                  : isToday
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100'
                  : 'hover:bg-surface-100'}
                ${isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {c.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
