import Link from 'next/link'
import { Building2, BadgeEuro, Clock, CalendarClock, FileQuestion, GraduationCap, History, Store } from '@/components/ui/icons'
import { LIBELLES_PHASES, type GroupePhase, type PhaseFranchise } from '@/lib/franchise-data'
import { UnlinkButton } from './LinkEtablissementClient'
import { HorsPartenariatToggle } from './HorsPartenariatToggle'

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0)
const euroCourt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
function mois(iso: string | null): string {
  if (!iso) return '—'
  const [a, m] = iso.split('-')
  return `${MOIS[Number(m) - 1]} ${a}`
}
function periode(debut: string | null, fin: string | null): string {
  const a = mois(debut), b = mois(fin)
  return a === b ? a : `${a} → ${b}`
}

const ICONES: Record<PhaseFranchise, typeof Building2> = {
  regle: BadgeEuro,
  attente: Clock,
  encours: CalendarClock,
  sans_montant: FileQuestion,
  poei: GraduationCap,
  avant_partenariat: History,
  jamais: Store,
}

/**
 * Le réseau vu par l'avancement de ses dossiers : ce qui est dû, ce qui vient,
 * ce qui bloque. Remplace la liste plate des établissements, qui ne disait pas
 * où en était chacun.
 */
export default function FranchisePhases({ groupes }: { groupes: GroupePhase[] }) {
  if (!groupes.length) {
    return (
      <div className="card p-6 text-center text-sm text-surface-400">
        Aucun établissement rattaché. Utilisez « Rattacher un établissement » ci-dessus.
      </div>
    )
  }
  const total = groupes.reduce((t, g) => t + g.etablissements.length, 0)

  return (
    <div className="space-y-4">
      <div className="text-sm font-heading font-semibold text-surface-900">
        Où en est le réseau ({total} établissement{total > 1 ? 's' : ''})
      </div>

      {groupes.map((g) => {
        const { titre, texte } = LIBELLES_PHASES[g.phase]
        const Icone = ICONES[g.phase]
        return (
          <div key={g.phase} className="card overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-4 pt-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                  <Icone className="h-4 w-4 text-surface-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-heading font-semibold text-surface-900">{titre}</div>
                  <div className="text-xs text-surface-400 tabular-nums mt-0.5">
                    {g.etablissements.length} établissement{g.etablissements.length > 1 ? 's' : ''}
                    {g.nbSessions > 0 && ` · ${g.nbSessions} session${g.nbSessions > 1 ? 's' : ''}`}
                    {g.nbParticipants > 0 && ` · ${g.nbParticipants} stagiaire${g.nbParticipants > 1 ? 's' : ''}`}
                    {g.base > 0 && ` · ${euroCourt(g.base)} de budget`}
                  </div>
                </div>
              </div>
              {(g.due > 0 || g.aVenir > 0) && (
                <div className="text-right shrink-0">
                  <div className={`text-lg font-heading font-bold tabular-nums ${g.due > 0 ? 'text-brand-600' : 'text-surface-500'}`}>
                    {euro(g.due > 0 ? g.due : g.aVenir)}
                  </div>
                  <div className="text-[11px] text-surface-400">{g.due > 0 ? 'à payer' : 'à venir'}</div>
                </div>
              )}
            </div>
            <p className="text-xs text-surface-500 px-4 pt-2 pb-3 max-w-3xl">{texte}</p>

            <div className="border-t border-surface-100 divide-y divide-surface-100">
              {g.etablissements.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/60 transition-colors">
                  <Link href={`/dashboard/clients/${e.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-surface-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">{e.raison_sociale}</div>
                      <div className="text-xs text-surface-500 truncate">
                        {[e.code_postal, e.ville].filter(Boolean).join(' ')}
                        {e.nbSessions > 0 && ` · ${e.nbSessions} session${e.nbSessions > 1 ? 's' : ''} · ${periode(e.premiere, e.derniere)}`}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {e.nbSansMontant > 0 && (
                          <Puce ton="warn">{e.nbSansMontant} session{e.nbSansMontant > 1 ? 's' : ''} sans montant</Puce>
                        )}
                        {e.nbPoei > 0 && <Puce ton="info">{e.nbPoei} POEI hors commission</Puce>}
                        {e.nbAvantPartenariat > 0 && g.phase !== 'avant_partenariat' && (
                          <Puce ton="neutre">{e.nbAvantPartenariat} session{e.nbAvantPartenariat > 1 ? 's' : ''} avant le partenariat</Puce>
                        )}
                        {e.horsPartenariat && <Puce ton="neutre">Sorti de l&apos;accord</Puce>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <div className="text-xs text-surface-500 tabular-nums">{e.base > 0 ? euroCourt(e.base) : '—'}</div>
                      <div className={`text-sm font-semibold tabular-nums ${e.due > 0 ? 'text-brand-600' : 'text-surface-400'}`}>
                        {e.commission > 0 ? euro(e.commission) : '—'}
                      </div>
                    </div>
                  </Link>
                  <HorsPartenariatToggle clientId={e.id} hors={e.horsPartenariat} />
                  <UnlinkButton clientId={e.id} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Puce({ ton, children }: { ton: 'warn' | 'info' | 'neutre'; children: React.ReactNode }) {
  const cls = ton === 'warn'
    ? 'bg-amber-50 text-amber-700'
    : ton === 'info'
      ? 'bg-sky-50 text-sky-700'
      : 'bg-surface-100 text-surface-500'
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{children}</span>
}
