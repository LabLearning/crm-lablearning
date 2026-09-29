'use client'

import { cn } from '@/lib/utils'
import {
  LIBELLES_ACQUIS, LIBELLES_OBJECTIF, libelleDemiJournee,
  type CompteRendu, type Acquis, type NiveauObjectif,
} from '@/lib/compte-rendu'

const TON_OBJECTIF: Record<NiveauObjectif, string> = {
  atteint: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  partiel: 'bg-amber-50 text-amber-700 border-amber-100',
  non_atteint: 'bg-danger-50 text-danger-700 border-danger-100',
}
const TON_ACQUIS: Record<Acquis, string> = {
  acquis: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  en_cours: 'bg-amber-50 text-amber-700 border-amber-100',
  non_acquis: 'bg-danger-50 text-danger-700 border-danger-100',
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-2xs font-semibold uppercase tracking-wider text-surface-400">{titre}</h3>
      {children}
    </section>
  )
}

function Ligne({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur || !valeur.trim()) return null
  return (
    <div className="text-sm">
      <span className="text-surface-500">{label} : </span>
      <span className="text-surface-800 whitespace-pre-line">{valeur}</span>
    </div>
  )
}

/** Compte rendu de formation, tel que le formateur l'a rédigé. */
export function CompteRenduVue({ cr }: { cr: CompteRendu }) {
  const objectifs = cr.objectifs.filter((o) => o.niveau)
  const atteints = objectifs.filter((o) => o.niveau === 'atteint').length
  const stagiaires = cr.stagiaires.filter((s) => s.acquis)
  const acquis = stagiaires.filter((s) => s.acquis === 'acquis').length

  return (
    <div className="space-y-5 pt-1">
      {/* L'essentiel en un coup d'œil */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ['Demi-journées décrites', `${cr.deroule.filter((d) => d.contenu.trim()).length} / ${cr.deroule.length}`],
          ['Objectifs atteints', objectifs.length ? `${atteints} / ${objectifs.length}` : 'Non renseigné'],
          ['Stagiaires ayant acquis', stagiaires.length ? `${acquis} / ${stagiaires.length}` : 'Non renseigné'],
          ['Participation', cr.groupe.participation || 'Non renseignée'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-surface-100 bg-surface-50/60 px-3 py-2.5">
            <div className="text-2xs text-surface-500">{l}</div>
            <div className="text-sm font-semibold text-surface-900 tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <Bloc titre="Déroulé de la formation">
        <ol className="space-y-2">
          {cr.deroule.map((d) => (
            <li key={`${d.date}-${d.creneau}`} className="rounded-xl border border-surface-100 p-3">
              <div className="text-xs font-semibold text-surface-700 first-letter:uppercase">{libelleDemiJournee(d)}</div>
              <div className={cn('text-sm mt-1 whitespace-pre-line', d.contenu.trim() ? 'text-surface-800' : 'text-surface-400 italic')}>
                {d.contenu.trim() || 'Non décrit'}
              </div>
              {d.methodes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {d.methodes.map((m) => <span key={m} className="rounded-full bg-surface-100 px-2 py-0.5 text-2xs text-surface-600">{m}</span>)}
                </div>
              )}
            </li>
          ))}
        </ol>
      </Bloc>

      {cr.objectifs.length > 0 && (
        <Bloc titre="Objectifs de la formation">
          <ul className="space-y-1.5">
            {cr.objectifs.map((o, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
                <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-2xs font-semibold', o.niveau ? TON_OBJECTIF[o.niveau] : 'bg-surface-50 text-surface-400 border-surface-100')}>
                  {o.niveau ? LIBELLES_OBJECTIF[o.niveau] : 'Non évalué'}
                </span>
                <span className="text-surface-800 flex-1 min-w-[200px]">
                  {o.objectif}
                  {o.commentaire && <span className="block text-xs text-surface-500">{o.commentaire}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Bloc titre="Le groupe">
          <Ligne label="Niveau à l’entrée" valeur={cr.groupe.niveau} />
          <Ligne label="Participation" valeur={cr.groupe.participation} />
          <Ligne label="Dynamique" valeur={cr.groupe.dynamique} />
          <Ligne label="Assiduité" valeur={cr.groupe.assiduite} />
        </Bloc>
        <Bloc titre="Conditions de réalisation">
          <Ligne label="Salle et équipements" valeur={cr.conditions.salle} />
          <Ligne label="Précisions" valeur={cr.conditions.commentaire} />
          <Ligne label="Difficultés ou incidents" valeur={cr.conditions.difficultes} />
        </Bloc>
      </div>

      <Bloc titre="Évaluation des acquis">
        <Ligne label="Modalités" valeur={cr.evaluation.modalites.join(', ')} />
        <Ligne label="Résultats d’ensemble" valeur={cr.evaluation.synthese} />
        {cr.stagiaires.length > 0 && (
          <div className="rounded-xl border border-surface-100 divide-y divide-surface-100">
            {cr.stagiaires.map((s) => (
              <div key={s.apprenant_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="text-sm text-surface-900 flex-1 min-w-[140px]">{s.nom}</span>
                <span className={cn('rounded-md border px-1.5 py-0.5 text-2xs font-semibold', s.acquis ? TON_ACQUIS[s.acquis] : 'bg-surface-50 text-surface-400 border-surface-100')}>
                  {s.acquis ? LIBELLES_ACQUIS[s.acquis] : 'Non évalué'}
                </span>
                {s.commentaire && <span className="basis-full text-xs text-surface-500">{s.commentaire}</span>}
              </div>
            ))}
          </div>
        )}
      </Bloc>

      <Bloc titre="Bilan et suites">
        <Ligne label="Points positifs" valeur={cr.bilan.points_positifs} />
        <Ligne label="Retours des stagiaires" valeur={cr.bilan.retours_stagiaires} />
        {cr.bilan.besoins_detectes.trim() && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm">
            <span className="font-semibold text-brand-800">Besoins détectés : </span>
            <span className="text-surface-800 whitespace-pre-line">{cr.bilan.besoins_detectes}</span>
          </div>
        )}
        <Ligne label="Recommandations" valeur={cr.bilan.recommandations} />
        <Ligne label="Commentaires" valeur={cr.bilan.commentaires} />
      </Bloc>
    </div>
  )
}
