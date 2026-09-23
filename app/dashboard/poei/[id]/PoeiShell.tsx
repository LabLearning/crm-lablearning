'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LayoutGrid, Settings, Users, Target, CalendarRange, CalendarClock, ClipboardCheck, ReceiptEuro, Mails, FileStack, ShieldAlert, CheckSquare } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

type Onglet = 'pilotage' | 'documents' | 'incidents' | 'dossier' | 'candidats' | 'positionnement' | 'interventions' | 'planning' | 'emargement' | 'evaluations' | 'facturation' | 'mails'

const ONGLETS_VALIDES: Onglet[] = ['pilotage', 'documents', 'incidents', 'dossier', 'candidats', 'positionnement', 'interventions', 'planning', 'emargement', 'evaluations', 'facturation', 'mails']

/**
 * Fiche d'un dossier POEI organisée en parcours plutôt qu'en empilement.
 * Les blocs sont rendus côté serveur et passés en emplacements : la coquille
 * ne fait que choisir lequel afficher.
 *
 * L'onglet courant se lit dans l'URL (?onglet=candidats) : un lien partagé ou
 * un retour arrière rouvre la fiche au bon endroit.
 */
export function PoeiShell({
  nbCandidats, nbInterventions, nbMails, nbIncidents = 0, alertes,
  pilotage, documents, incidents, dossier, candidats, positionnement, interventions, planning, emargement, evaluations, facturation, mails,
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
  emargement: React.ReactNode
  evaluations: React.ReactNode
  facturation: React.ReactNode
  mails: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const depuisUrl = searchParams?.get('onglet') as Onglet | null
  const [onglet, setOnglet] = useState<Onglet>(depuisUrl && ONGLETS_VALIDES.includes(depuisUrl) ? depuisUrl : 'pilotage')
  const barre = useRef<HTMLDivElement>(null)

  function choisir(id: Onglet) {
    setOnglet(id)
    // On n'appelle pas le routeur : changer d'onglet ne doit pas recharger la page.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (id === 'pilotage') url.searchParams.delete('onglet')
      else url.searchParams.set('onglet', id)
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }

  // L'onglet actif reste visible dans la barre, même quand elle défile sur téléphone.
  useEffect(() => {
    const actif = barre.current?.querySelector<HTMLElement>('[data-actif="true"]')
    actif?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [onglet])

  const ONGLETS: { id: Onglet; label: string; icon: React.ElementType; n?: number }[] = [
    { id: 'pilotage', label: 'Pilotage', icon: LayoutGrid },
    { id: 'candidats', label: 'Candidats', icon: Users, n: nbCandidats },
    { id: 'positionnement', label: 'Positionnement', icon: Target },
    { id: 'interventions', label: 'Interventions', icon: CalendarRange, n: nbInterventions },
    { id: 'planning', label: 'Planning', icon: CalendarClock },
    { id: 'emargement', label: 'Émargement', icon: CheckSquare },
    { id: 'evaluations', label: 'Évaluations', icon: ClipboardCheck },
    { id: 'documents', label: 'Documents', icon: FileStack },
    { id: 'incidents', label: 'Incidents', icon: ShieldAlert, n: nbIncidents },
    { id: 'facturation', label: 'Facturation', icon: ReceiptEuro },
    { id: 'mails', label: 'Mails', icon: Mails, n: nbMails },
    { id: 'dossier', label: 'Paramètres', icon: Settings },
  ]

  const contenu: Record<Onglet, React.ReactNode> = {
    pilotage, documents, incidents, dossier, candidats, positionnement, interventions, planning, emargement, evaluations, facturation, mails,
  }

  return (
    <>
      {/* Sur téléphone la barre déborde du gabarit (marges négatives) pour que
          le dernier onglet visible soit coupé net : c'est l'indice qu'il en
          reste d'autres. Un dégradé à droite le confirme. */}
      <div className="relative mb-5 -mx-5 sm:mx-0">
        <div ref={barre} className="tabs-scroll border-b border-surface-200 px-5 sm:px-1 gap-0.5 sm:gap-1">
          {ONGLETS.map((o) => {
            const Icone = o.icon
            const alerte = alertes?.[o.id] || 0
            const actif = onglet === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => choisir(o.id)}
                data-actif={actif ? 'true' : undefined}
                aria-current={actif ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 px-3 sm:px-3.5 py-2.5 min-h-[44px] text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  actif
                    ? 'border-surface-900 text-surface-900'
                    : 'border-transparent text-surface-500 hover:text-surface-800',
                )}
              >
                <Icone className="h-4 w-4 shrink-0" />
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
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-surface-50 to-transparent lg:hidden" />
      </div>

      <div className="space-y-5">{contenu[onglet]}</div>
    </>
  )
}
