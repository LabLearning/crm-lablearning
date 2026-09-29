'use client'

import { bilanAudit, type AuditEtablissement } from '@/lib/audit-hygiene-synthese'

const jour = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

function Resume({ titre, a }: { titre: string; a: AuditEtablissement }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-100 bg-surface-50/60 px-3 py-2.5">
      <div className="w-16 text-center shrink-0">
        <div className="text-lg font-heading font-bold text-surface-900 tabular-nums">{a.score != null ? `${a.score} %` : '—'}</div>
        {a.mention && <div className="text-2xs text-surface-500">{a.mention}</div>}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-surface-900">{titre}{a.numRapport ? ` · ${a.numRapport}` : ''}</div>
        <div className="text-xs text-surface-500">{jour(a.date)}{a.auditeur ? ` · ${a.auditeur}` : ''}</div>
        <div className="text-xs text-surface-500">{bilanAudit(a)}</div>
      </div>
    </div>
  )
}

/** Audit hygiène de l'établissement (entrée, sortie), sous le compte rendu du formateur. */
export function AuditVue({ entree, sortie }: { entree: AuditEtablissement | null; sortie: AuditEtablissement | null }) {
  if (!entree && !sortie) return null
  const ref = sortie || entree!
  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div className="text-sm font-semibold text-surface-900">Audit hygiène de l&apos;établissement</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {entree ? <Resume titre="Audit d’entrée" a={entree} /> : <Manquant titre="Audit d’entrée" />}
        {sortie ? <Resume titre="Audit de sortie" a={sortie} /> : <Manquant titre="Audit de sortie" />}
      </div>
      {ref.ecarts.length > 0 && (
        <div className="rounded-xl border border-surface-100 divide-y divide-surface-100">
          {ref.ecarts.map((e, i) => (
            <div key={i} className="flex gap-3 px-3 py-2 text-sm">
              <div className="w-40 shrink-0">
                <div className="text-xs text-surface-700">{e.section} · {e.ref}</div>
                <span className={`inline-block mt-0.5 rounded-md border px-1.5 py-0.5 text-2xs font-semibold ${e.niveau === 'non_conforme' ? 'bg-danger-50 text-danger-700 border-danger-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                  {e.niveau === 'non_conforme' ? 'Non conforme' : 'Partiel'}
                </span>
              </div>
              <div className="text-surface-800">{e.observation || 'Sans observation'}</div>
            </div>
          ))}
        </div>
      )}
      {ref.documentsManquants.length > 0 && (
        <div className="text-sm">
          <span className="font-semibold text-surface-900">Documents obligatoires manquants : </span>
          <span className="text-surface-700">{ref.documentsManquants.join(', ')}.</span>
        </div>
      )}
    </div>
  )
}

function Manquant({ titre }: { titre: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-surface-200 px-3 py-2.5">
      <span className="text-sm text-surface-600">{titre}</span>
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-700">En cours d’importation</span>
    </div>
  )
}
