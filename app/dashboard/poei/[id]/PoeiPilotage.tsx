'use client'

import Link from 'next/link'
import { CheckCircle2, AlertCircle, MinusCircle, FileText, ExternalLink, LayoutGrid } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { PoeiSection, PoeiVide, PoeiDefilable } from './PoeiSection'

/**
 * Cockpit du dossier POEI : une ligne par candidat, une colonne par jalon de
 * son parcours. Ces informations vivaient dans quatre blocs différents —
 * candidats, évaluations, facturation, mails, ce qui obligeait à recouper à la
 * main pour répondre à « qui n'a pas encore signé son certificat ? ».
 */

export type Etat = 'ok' | 'partiel' | 'manque' | 'na'

interface Cellule {
  etat: Etat
  texte: string
  href?: string
}

export interface LigneCandidat {
  id: string
  nom: string
  apprenantId: string | null
  references: Cellule
  attestation: Cellule
  planCharge: Cellule
  evaluations: Cellule
  certificat: Cellule
  facture: Cellule
}

const COLONNES: { cle: keyof LigneCandidat; label: string }[] = [
  { cle: 'references', label: 'Références FT' },
  { cle: 'attestation', label: "Attestation d'entrée" },
  { cle: 'planCharge', label: 'Plan de charge' },
  { cle: 'evaluations', label: 'Évaluations' },
  { cle: 'certificat', label: 'Certificat' },
  { cle: 'facture', label: 'Facture' },
]

const ICONE: Record<Etat, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-success-500" />,
  partiel: <AlertCircle className="h-4 w-4 text-warning-500" />,
  manque: <AlertCircle className="h-4 w-4 text-danger-500" />,
  na: <MinusCircle className="h-4 w-4 text-surface-300" />,
}

const COULEUR: Record<Etat, string> = {
  ok: 'text-surface-700',
  partiel: 'text-warning-700',
  manque: 'text-danger-700',
  na: 'text-surface-400',
}

export function PoeiPilotage({ lignes }: { lignes: LigneCandidat[] }) {
  if (lignes.length === 0) {
    return <PoeiVide icone={FileText} texte="Aucun candidat sur ce dossier, ajoutez-les depuis l'onglet Candidats." />
  }

  // Compteur par jalon : c'est la ligne qui dit où en est le dossier.
  const avancement = COLONNES.map((c) => ({
    label: c.label,
    faits: lignes.filter((l) => (l[c.cle] as Cellule).etat === 'ok').length,
    total: lignes.filter((l) => (l[c.cle] as Cellule).etat !== 'na').length,
  }))

  return (
    <PoeiSection
      icone={LayoutGrid}
      titre="Pilotage du dossier"
      sous="Où en est chaque candidat, jalon par jalon."
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {avancement.map((a) => {
          const complet = a.total > 0 && a.faits === a.total
          return (
            <div key={a.label} className={cn('card p-3.5', !complet && a.total > 0 && 'border-danger-200')}>
              <div className="text-[11px] text-surface-500 truncate">{a.label}</div>
              <div className={cn('text-lg font-heading font-bold', complet ? 'text-success-600' : 'text-danger-600')}>
                {a.faits}/{a.total}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        <PoeiDefilable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50/60">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider sticky left-0 bg-surface-50/60">
                  Candidat
                </th>
                {COLONNES.map((c) => (
                  <th key={c.cle as string} className="text-left px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {lignes.map((l) => {
                const manques = COLONNES.filter((c) => (l[c.cle] as Cellule).etat === 'manque').length
                return (
                  <tr key={l.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        {manques > 0 && <span className="h-1.5 w-1.5 rounded-full bg-danger-500 shrink-0" />}
                        {l.apprenantId ? (
                          <Link href={`/dashboard/apprenants/${l.apprenantId}`} className="font-medium text-surface-900 hover:text-brand-600 hover:underline whitespace-nowrap inline-flex items-center min-h-[40px] sm:min-h-0">
                            {l.nom}
                          </Link>
                        ) : (
                          <span className="font-medium text-surface-900 whitespace-nowrap">{l.nom}</span>
                        )}
                      </div>
                    </td>
                    {COLONNES.map((c) => {
                      const cel = l[c.cle] as Cellule
                      return (
                        <td key={c.cle as string} className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {ICONE[cel.etat]}
                            {cel.href ? (
                              <a href={cel.href} target="_blank" rel="noreferrer"
                                className={cn('text-xs hover:underline inline-flex items-center gap-1 min-h-[40px] sm:min-h-0', COULEUR[cel.etat])}>
                                {cel.texte}<ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className={cn('text-xs', COULEUR[cel.etat])}>{cel.texte}</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </PoeiDefilable>
      </div>
    </PoeiSection>
  )
}
