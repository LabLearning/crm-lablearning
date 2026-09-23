import Link from 'next/link'
import { CheckSquare, CheckCircle2, XCircle, Clock, AlertTriangle, Download, ExternalLink, CalendarDays } from '@/components/ui/icons'
import { formatDate } from '@/lib/utils'

export interface LigneEmargementCandidat {
  apprenantId: string
  nom: string
  /** Demi-journées signées. */
  signees: number
  /** Demi-journées déclarées absentes, avec leur motif. */
  absences: { date: string; creneau: string; motif: string }[]
  /** Demi-journées ni signées ni déclarées absentes. */
  aSigner: number
  /** Heures portées sur le certificat de réalisation. */
  heuresCertifiees: number
}

export interface SessionEmargement {
  id: string
  reference: string | null
  intitule: string | null
  date_debut: string | null
  date_fin: string | null
  /** Nom de l'intervention quand la session en est issue. */
  intervention?: string | null
  /** Demi-journées dont la feuille est validée par le formateur. */
  feuillesValidees: number
  feuillesTotal: number
}

const CRENEAU: Record<string, string> = { matin: 'matin', apres_midi: 'après-midi', journee: 'journée' }

/**
 * Émargement d'un parcours POEI : ce qui est signé, ce qui est déclaré absent,
 * et les heures qui en découlent sur les certificats. Les feuilles elles-mêmes
 * se gèrent sur la session, l'onglet renvoie au bon endroit.
 */
export function PoeiEmargement({ sessions, candidats, dureeParcours }: {
  sessions: SessionEmargement[]
  candidats: LigneEmargementCandidat[]
  dureeParcours: number | null
}) {
  const totalAbsences = candidats.reduce((n, c) => n + c.absences.length, 0)
  const totalASigner = candidats.reduce((n, c) => n + c.aSigner, 0)

  if (sessions.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center text-center py-12 px-8">
        <CheckSquare className="h-6 w-6 text-surface-400 mb-3" />
        <p className="text-sm text-surface-500">Aucune session rattachée à ce parcours</p>
        <p className="text-xs text-surface-400 mt-1">Créez la session du parcours ou une intervention pour ouvrir les feuilles d&apos;émargement.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Les feuilles, par session */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Feuilles d&apos;émargement</span>
        </div>
        <div className="divide-y divide-surface-100">
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-medium text-surface-900">{s.intervention || s.intitule || s.reference || 'Session'}</div>
                <div className="text-xs text-surface-500">
                  {[s.reference, s.date_debut ? `${formatDate(s.date_debut, { day: 'numeric', month: 'short' })}${s.date_fin && s.date_fin !== s.date_debut ? ` au ${formatDate(s.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="text-xs text-surface-500 tabular-nums">
                {s.feuillesValidees}/{s.feuillesTotal || '—'} demi-journée{s.feuillesTotal > 1 ? 's' : ''} validée{s.feuillesValidees > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/api/pdf/emargement/${s.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-brand-600">
                  <Download className="h-3.5 w-3.5" /> Feuille PDF
                </a>
                <Link href={`/dashboard/sessions/${s.id}?tab=presences`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
                  Gérer <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ce que chaque stagiaire a signé, et les heures qui en découlent */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Présence par stagiaire</span>
          </div>
          <span className="text-xs text-surface-400">
            {totalAbsences} absence{totalAbsences > 1 ? 's' : ''} déclarée{totalAbsences > 1 ? 's' : ''} · {totalASigner} demi-journée{totalASigner > 1 ? 's' : ''} à signer
          </span>
        </div>

        {candidats.length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-400">Aucun candidat inscrit</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {candidats.map((c) => (
              <div key={c.apprenantId} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex-1 min-w-[160px] text-sm font-medium text-surface-900">{c.nom}</div>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />{c.signees} signée{c.signees > 1 ? 's' : ''}
                  </span>
                  {c.absences.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                      <XCircle className="h-3.5 w-3.5" />{c.absences.length} absence{c.absences.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {c.aSigner > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <Clock className="h-3.5 w-3.5" />{c.aSigner} à signer
                    </span>
                  )}
                  <span className="text-sm font-semibold text-surface-900 tabular-nums">
                    {c.heuresCertifiees} h
                    <span className="text-xs font-normal text-surface-400"> certifiées</span>
                  </span>
                </div>
                {c.absences.length > 0 && (
                  <div className="mt-1.5 text-xs text-surface-500">
                    Absences : {c.absences.slice(0, 6).map((a) => `${formatDate(a.date, { day: 'numeric', month: 'short' })} ${CRENEAU[a.creneau] || a.creneau} (${a.motif})`).join(' · ')}
                    {c.absences.length > 6 ? ` … +${c.absences.length - 6}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-surface-500 inline-flex items-start gap-1.5 px-1">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-surface-400" />
        Le certificat de réalisation porte la durée du parcours{dureeParcours ? ` (${dureeParcours} h)` : ''}, diminuée des heures d&apos;absence déclarées.
        Une demi-journée simplement non signée ne retire aucune heure : elle reste à faire signer sur la feuille.
      </p>
    </div>
  )
}
