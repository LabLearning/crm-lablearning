'use client'

import { useState } from 'react'
import { LayoutGrid, Settings, Users, Target, CalendarRange, CalendarClock, ClipboardCheck, ReceiptEuro, Mails, FileStack, ShieldAlert } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

type Onglet = 'pilotage' | 'documents' | 'incidents' | 'dossier' | 'candidats' | 'positionnement' | 'interventions' | 'planning' | 'evaluations' | 'facturation' | 'mails'

/**
 * Fiche d'un dossier POEI organisée en parcours plutôt qu'en empilement.
 * Les blocs sont rendus côté serveur et passés en emplacements : la coquille
 * ne fait que choisir lequel afficher.
 */
export function PoeiShell({
  nbCandidats, nbInterventions, nbMails, nbIncidents = 0, alertes,
  pilotage, documents, incidents, dossier, candidats, positionnement, interventions, planning, evaluations, facturation, mails,
}: {
  nbCandidats: number
  nbInterventions: number
  nbMails: number
  nbIncidents?: number
  /** Nombre de points à compléter par onglet, affichés en pastille rouge. */
  alertes?: Partial<Record<Onglet, number>>
  pilotage: React.ReactNode
  documents: React.ReactNode
  incidents: React.ReactNode
  dossier: React.ReactNode
  candidats: React.ReactNode
  positionnement: React.ReactNode
  interventions: React.ReactNode
  planning: React.ReactNode
  evaluations: React.ReactNode
  facturation: React.ReactNode
  mails: React.ReactNode
}) {
  const [onglet, setOnglet] = useState<Onglet>('pilotage')

  const ONGLETS: { id: Onglet; label: string; icon: React.ElementType; n?: number }[] = [
    { id: 'pilotage', label: 'Pilotage', icon: LayoutGrid },
    { id: 'candidats', label: 'Candidats', icon: Users, n: nbCandidats },
    { id: 'positionnement', label: 'Positionnement', icon: Target },
    { id: 'interventions', label: 'Interventions', icon: CalendarRange, n: nbInterventions },
    { id: 'planning', label: 'Planning', icon: CalendarClock },
    { id: 'evaluations', label: 'Évaluations', icon: ClipboardCheck },
    { id: 'documents', label: 'Documents', icon: FileStack },
    { id: 'incidents', label: 'Incidents', icon: ShieldAlert, n: nbIncidents },
    { id: 'facturation', label: 'Facturation', icon: ReceiptEuro },
    { id: 'mails', label: 'Mails', icon: Mails, n: nbMails },
    { id: 'dossier', label: 'Paramètres', icon: Settings },
  ]

  const contenu: Record<Onglet, React.ReactNode> = {
    pilotage, documents, incidents, dossier, candidats, positionnement, interventions, planning, evaluations, facturation, mails,
  }

  return (
    <>
      <div className="border-b border-surface-200 mb-5 -mx-1 px-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {ONGLETS.map((o) => {
            const Icone = o.icon
            const alerte = alertes?.[o.id] || 0
            return (
              <button
                key={o.id}
                onClick={() => setOnglet(o.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  onglet === o.id
                    ? 'border-surface-900 text-surface-900'
                    : 'border-transparent text-surface-500 hover:text-surface-800',
                )}
              >
                <Icone className="h-4 w-4" />
                {o.label}
                {typeof o.n === 'number' && o.n > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-semibold">
                    {o.n}
                  </span>
                )}
                {alerte > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-danger-500" aria-label={`${alerte} point(s) à compléter`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-5">{contenu[onglet]}</div>
    </>
  )
}
