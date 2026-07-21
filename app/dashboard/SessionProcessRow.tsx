import Link from 'next/link'
import { Building2, MapPin, UserX, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SessionProcess {
  id: string
  reference: string | null
  intitule: string
  clientNom: string | null
  formateurNom: string | null
  lieu: string | null
  dateDebut: string
  status: string
  /** Étapes du process */
  formateurCale: boolean      // formateur affecté ET mission acceptée
  contratSigne: boolean
  conventionSignee: boolean
  participants: number
  convocationsEnvoyees: boolean
}

const ETAPES: { key: keyof SessionProcess | 'participantsOk'; label: string; court: string }[] = [
  { key: 'formateurCale', label: 'Formateur calé', court: 'Formateur' },
  { key: 'contratSigne', label: 'Contrat signé', court: 'Contrat' },
  { key: 'participantsOk', label: 'Participants inscrits', court: 'Participants' },
  { key: 'conventionSignee', label: 'Convention signée', court: 'Convention' },
  { key: 'convocationsEnvoyees', label: 'Convocations envoyées', court: 'Convocations' },
]

function etapesFaites(s: SessionProcess): boolean[] {
  return [s.formateurCale, s.contratSigne, s.participants > 0, s.conventionSignee, s.convocationsEnvoyees]
}

/** Barre de progression du process d'une session : une pastille par étape */
export function SessionProgressBar({ session, compact }: { session: SessionProcess; compact?: boolean }) {
  const faites = etapesFaites(session)
  const nb = faites.filter(Boolean).length
  const total = faites.length

  return (
    <div className={cn('flex items-center gap-2', compact ? 'mt-1.5' : 'mt-2')}>
      <div className="flex-1 flex gap-1">
        {faites.map((ok, i) => (
          <span
            key={i}
            title={`${ETAPES[i].label} — ${ok ? 'fait' : 'à faire'}`}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              ok ? 'bg-emerald-500' : 'bg-surface-200',
            )}
          />
        ))}
      </div>
      <span className={cn(
        'text-[10px] font-semibold tabular-nums shrink-0',
        nb === total ? 'text-emerald-600' : nb === 0 ? 'text-surface-400' : 'text-amber-600',
      )}>
        {nb}/{total}
      </span>
    </div>
  )
}

/** Détail des étapes manquantes, en pastilles */
export function SessionEtapesManquantes({ session }: { session: SessionProcess }) {
  const faites = etapesFaites(session)
  const manquantes = ETAPES.filter((_, i) => !faites[i])
  if (manquantes.length === 0) {
    return <span className="text-[10px] font-medium text-emerald-600">Tout est prêt</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {manquantes.map((e) => (
        <span key={e.court} className="px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 text-[10px] font-medium">
          {e.court}
        </span>
      ))}
    </div>
  )
}

/** Ligne de session enrichie : formation, client, formateur + barre de process */
export function SessionProcessRow({ session, showDate }: { session: SessionProcess; showDate?: boolean }) {
  const daysUntil = Math.ceil((new Date(session.dateDebut).getTime() - Date.now()) / 86400000)
  return (
    <Link href={`/dashboard/sessions/${session.id}`} className="block px-4 py-3 hover:bg-surface-50 transition-colors">
      <div className="flex items-start gap-3">
        {showDate && (
          <div className="text-center shrink-0 w-12 pt-0.5">
            <div className="text-lg font-heading font-bold text-surface-900 leading-none">
              {new Date(session.dateDebut).getDate()}
            </div>
            <div className="text-[10px] text-surface-400 uppercase mt-0.5">
              {new Date(session.dateDebut).toLocaleDateString('fr-FR', { month: 'short' })}
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-surface-900 truncate">{session.intitule}</div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-surface-500">
            {session.clientNom && (
              <span className="flex items-center gap-1 min-w-0">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{session.clientNom}</span>
              </span>
            )}
            {session.formateurNom ? (
              <span className={cn('flex items-center gap-1', !session.formateurCale && 'text-amber-600')}>
                {session.formateurNom}
                {!session.formateurCale && <span title="Mission non acceptée par le formateur">(en attente)</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-danger-50 text-danger-700 text-[10px] font-semibold">
                <UserX className="h-3 w-3" /> Formateur non calé
              </span>
            )}
            {session.lieu && (
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{session.lieu}</span>
              </span>
            )}
          </div>

          <SessionProgressBar session={session} />
          <div className="mt-1.5 flex items-center gap-2">
            <SessionEtapesManquantes session={session} />
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className={cn(
            'text-[10px] font-semibold',
            daysUntil <= 3 ? 'text-danger-600' : daysUntil <= 7 ? 'text-amber-600' : 'text-surface-400',
          )}>
            {daysUntil > 0 ? `J-${daysUntil}` : daysUntil === 0 ? "Aujourd'hui" : 'En cours'}
          </span>
          {daysUntil <= 7 && daysUntil >= 0 && etapesFaites(session).some((x) => !x) && (
            <div className="mt-1" title="Session imminente avec des étapes manquantes">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 ml-auto" />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
