'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, Loader2, UserPlus, XCircle } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { Formateur } from '@/lib/types/formation'
import { traiterCandidatureFormateurAction } from './inscription-actions'

/**
 * Candidatures déposées sur le site (page Recrutement) : chaque candidat a une
 * fiche formateur inactive. La retenir l'active (elle reste « à vérifier » tant
 * que les pièces ne sont pas relues) ; l'écarter la sort de cette liste.
 */
export function CandidaturesFormateurs({ candidats, peutTraiter }: { candidats: Formateur[]; peutTraiter: boolean }) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()
  if (!candidats.length) return null

  const traiter = (f: Formateur, decision: 'retenir' | 'ecarter') => {
    const nom = `${f.prenom || ''} ${f.nom || ''}`.trim()
    if (decision === 'ecarter' && !confirm(`Écarter la candidature de ${nom} ?\n\nSa fiche reste dans le CRM, inactive. Aucun message ne lui est envoyé.`)) return
    start(async () => {
      const r = await traiterCandidatureFormateurAction(f.id, decision)
      if (r.success) { toast('success', decision === 'retenir' ? `${nom} rejoint vos formateurs` : `Candidature de ${nom} écartée`); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  return (
    <section className="card mb-5 p-4 sm:p-5" aria-labelledby="candidatures-titre">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <UserPlus className="h-5 w-5 text-brand-600" />
        </div>
        <div className="min-w-0">
          <h2 id="candidatures-titre" className="font-heading font-semibold text-surface-900">
            {candidats.length} candidature{candidats.length > 1 ? 's' : ''} à étudier
          </h2>
          <p className="mt-0.5 text-xs text-surface-500">Reçues par la page Recrutement du site. Tant qu&apos;elle n&apos;est pas retenue, une candidature n&apos;apparaît dans aucune affectation.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-surface-100">
        {candidats.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <Link href={`/dashboard/formateurs/${f.id}`} className="block truncate text-sm font-semibold text-surface-900 hover:text-brand-600">
                {f.prenom} {f.nom}
              </Link>
              <div className="truncate text-xs text-surface-500">
                {[(f.domaines_expertise || []).slice(0, 3).join(', '), (f as any).ville].filter(Boolean).join(' · ') || 'Domaines non renseignés'}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-surface-400">
                {(f as any).inscrit_via_formulaire_at && <span>Reçue le {formatDate((f as any).inscrit_via_formulaire_at)}</span>}
                <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{f.cv_url ? 'CV joint' : 'Sans CV'}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href={`/dashboard/formateurs/${f.id}`} className="btn-secondary inline-flex min-h-10 items-center !py-2 text-xs">Voir la fiche</Link>
              {peutTraiter && (
                <>
                  <button type="button" onClick={() => traiter(f, 'ecarter')} disabled={pending}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-surface-200 px-3 text-xs font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50">
                    <XCircle className="h-3.5 w-3.5" /> Écarter
                  </button>
                  <button type="button" onClick={() => traiter(f, 'retenir')} disabled={pending}
                    className="btn-primary inline-flex min-h-10 items-center gap-1.5 !py-2 text-xs">
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Retenir
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
