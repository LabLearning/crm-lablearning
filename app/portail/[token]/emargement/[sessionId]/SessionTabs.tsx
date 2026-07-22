'use client'

import { useState } from 'react'
import { ClipboardCheck, BookOpen, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'emargement' | 'contenu' | 'questionnaires'

/**
 * Onglets de la page de session côté formateur : émargement, contenu
 * pédagogique et questionnaires étaient auparavant empilés sur une seule page.
 * Les sections sont rendues côté serveur et passées en slots.
 */
export function SessionTabs({
  emargement,
  contenu,
  questionnaires,
}: {
  emargement: React.ReactNode
  contenu: React.ReactNode
  questionnaires: React.ReactNode
}) {
  const [tab, setTab] = useState<TabId>('emargement')

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'emargement', label: 'Émargement', icon: ClipboardCheck },
    { id: 'contenu', label: 'Contenu pédagogique', icon: BookOpen },
    { id: 'questionnaires', label: 'Questionnaires', icon: ListChecks },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-surface-200 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium transition-all relative -mb-px border-b-2 whitespace-nowrap',
                active ? 'text-surface-900 border-surface-900' : 'text-surface-500 border-transparent hover:text-surface-700',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        {tab === 'emargement' && emargement}
        {tab === 'contenu' && contenu}
        {tab === 'questionnaires' && questionnaires}
      </div>
    </div>
  )
}
