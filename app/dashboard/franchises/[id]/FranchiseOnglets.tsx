'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Banknote, Building2, KeyRound } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

type Onglet = 'commissions' | 'etablissements' | 'acces'
const ONGLETS_VALIDES: Onglet[] = ['commissions', 'etablissements', 'acces']

/**
 * Fiche franchise en trois onglets : l'argent (commissions, par étape), le
 * réseau (établissements, couverture, audits), les réglages (accès au portail,
 * logo, gabarits). Chaque information n'apparaît qu'à un seul endroit.
 */
export default function FranchiseOnglets({
  commissions, etablissements, acces, nbEtablissements, nbAVerser, nbAcces,
}: {
  commissions: React.ReactNode
  etablissements: React.ReactNode
  acces: React.ReactNode
  nbEtablissements: number
  /** Sessions dont la commission est validée, à verser */
  nbAVerser: number
  /** Comptes actifs ou invités sur le portail */
  nbAcces: number
}) {
  const searchParams = useSearchParams()
  const depuisUrl = searchParams?.get('onglet') as Onglet | null
  const ouvrable = (id: Onglet | null): id is Onglet => !!id && ONGLETS_VALIDES.includes(id)
  const [onglet, setOnglet] = useState<Onglet>(ouvrable(depuisUrl) ? depuisUrl : 'commissions')
  const barre = useRef<HTMLDivElement>(null)

  // Un lien vers ?onglet=… sur la même page ouvre l'onglet visé
  useEffect(() => { if (ouvrable(depuisUrl)) setOnglet(depuisUrl) }, [depuisUrl])

  function choisir(id: Onglet) {
    setOnglet(id)
    // Changer d'onglet ne recharge pas la page : seule l'adresse suit
    const url = new URL(window.location.href)
    if (id === 'commissions') url.searchParams.delete('onglet')
    else url.searchParams.set('onglet', id)
    url.hash = ''
    window.history.replaceState(window.history.state, '', url.toString())
  }

  useEffect(() => {
    barre.current?.querySelector<HTMLElement>('[data-actif="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [onglet])

  const ONGLETS: { id: Onglet; label: string; icon: React.ElementType; n?: number; ton?: 'brand' }[] = [
    { id: 'commissions', label: 'Commissions', icon: Banknote, n: nbAVerser, ton: 'brand' },
    { id: 'etablissements', label: 'Établissements', icon: Building2, n: nbEtablissements },
    { id: 'acces', label: 'Accès et documents', icon: KeyRound, n: nbAcces },
  ]
  const contenu: Record<Onglet, React.ReactNode> = { commissions, etablissements, acces }

  return (
    <>
      <div className="relative -mx-5 sm:mx-0">
        <div ref={barre} className="tabs-scroll border-b border-surface-200 px-5 sm:px-1 gap-0.5 sm:gap-1">
          {ONGLETS.map((o) => {
            const Icone = o.icon
            const actif = onglet === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => choisir(o.id)}
                data-actif={actif ? 'true' : undefined}
                aria-current={actif ? 'page' : undefined}
                className={cn(
                  'shrink-0 inline-flex items-center gap-2 px-3 sm:px-3.5 py-2.5 min-h-[44px] text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  actif ? 'border-surface-900 text-surface-900' : 'border-transparent text-surface-500 hover:text-surface-800',
                )}
              >
                <Icone className="h-4 w-4 shrink-0" />
                {o.label}
                {typeof o.n === 'number' && o.n > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums',
                    o.ton === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-600',
                  )}>
                    {o.n}
                  </span>
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
