'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Download, Loader2, Sparkles, Trash2, X } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { PoeiSection, PoeiDefilable } from './PoeiSection'
import { genererPlanningPoeiAction, majJourPlanningAction, effacerPlanningCandidatAction } from '../planning-actions'

export interface JourPlanningUI {
  id: string
  candidat_id: string
  date: string
  repos: boolean
  creneau1_debut: string | null
  creneau1_fin: string | null
  creneau2_debut: string | null
  creneau2_fin: string | null
  note: string | null
}

export interface CandidatPlanningUI { id: string; nom: string }

const JOURS = [
  { n: 1, court: 'Lun' }, { n: 2, court: 'Mar' }, { n: 3, court: 'Mer' }, { n: 4, court: 'Jeu' },
  { n: 5, court: 'Ven' }, { n: 6, court: 'Sam' }, { n: 0, court: 'Dim' },
]
const hm = (t?: string | null) => (t ? t.slice(0, 5) : '')
const minutes = (t?: string | null) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
const dureeJour = (j: JourPlanningUI) => (j.repos ? 0 :
  Math.max(0, minutes(j.creneau1_fin) - minutes(j.creneau1_debut)) +
  Math.max(0, minutes(j.creneau2_fin) - minutes(j.creneau2_debut)))
const heures = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h` }
const dow = (d: string) => new Date(d + 'T12:00:00Z').getUTCDay()

/** Regroupe des jours triés par semaine civile (lundi → dimanche). */
function parSemaine(jours: JourPlanningUI[]): JourPlanningUI[][] {
  const semaines: JourPlanningUI[][] = []
  let courante: JourPlanningUI[] = []
  for (const j of jours) {
    if (dow(j.date) === 1 && courante.length) { semaines.push(courante); courante = [] }
    courante.push(j)
  }
  if (courante.length) semaines.push(courante)
  return semaines
}

export function PoeiPlanning({
  poeiId, candidats, jours, defaults,
}: {
  poeiId: string
  candidats: CandidatPlanningUI[]
  jours: JourPlanningUI[]
  defaults: { dateDebut: string; dateFin: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [generateur, setGenerateur] = useState(false)
  const [dateDebut, setDateDebut] = useState(defaults.dateDebut)
  const [dateFin, setDateFin] = useState(defaults.dateFin)
  const [c1d, setC1d] = useState('11:00'); const [c1f, setC1f] = useState('14:30')
  const [c2d, setC2d] = useState('18:00'); const [c2f, setC2f] = useState('21:30')
  const [selection, setSelection] = useState<string[]>(candidats.map((c) => c.id))
  const [reposPar, setReposPar] = useState<Record<string, number[]>>(
    Object.fromEntries(candidats.map((c) => [c.id, [0, 1]])), // dimanche + lundi par défaut
  )
  const [actif, setActif] = useState<string | null>(candidats[0]?.id || null)
  const [edition, setEdition] = useState<JourPlanningUI | null>(null)

  const joursActif = useMemo(
    () => jours.filter((j) => j.candidat_id === actif).sort((a, b) => a.date.localeCompare(b.date)),
    [jours, actif],
  )
  const semaines = useMemo(() => parSemaine(joursActif), [joursActif])
  const totalMin = joursActif.reduce((s, j) => s + dureeJour(j), 0)
  const aDesJours = new Set(jours.map((j) => j.candidat_id))

  const toggleRepos = (candidatId: string, n: number) => {
    setReposPar((r) => {
      const cur = new Set(r[candidatId] || [])
      cur.has(n) ? cur.delete(n) : cur.add(n)
      return { ...r, [candidatId]: [...cur] }
    })
  }

  async function generer() {
    if (!selection.length) { toast('error', 'Sélectionnez au moins un candidat'); return }
    setBusy(true)
    const r = await genererPlanningPoeiAction({
      poeiId, dateDebut, dateFin,
      horaires: { c1d, c1f, c2d: c2d || null, c2f: c2f || null },
      candidats: selection.map((id) => ({ candidatId: id, joursRepos: reposPar[id] || [0, 1] })),
    })
    setBusy(false)
    if (r.success) { toast('success', 'Planning généré'); setGenerateur(false); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  async function sauverJour(patch: Partial<JourPlanningUI>) {
    if (!edition) return
    setBusy(true)
    const r = await majJourPlanningAction(edition.id, patch as any)
    setBusy(false)
    if (r.success) { setEdition(null); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  async function effacer(candidatId: string) {
    if (!confirm('Effacer tout le planning de ce candidat ?')) return
    setBusy(true)
    const r = await effacerPlanningCandidatAction(poeiId, candidatId)
    setBusy(false)
    if (r.success) { toast('success', 'Planning effacé'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  return (
    <PoeiSection
      icone={CalendarClock}
      titre="Planning de travail"
      sous="Le rythme en établissement une fois la théorie passée : services, jours de repos, ajustable jour par jour."
    >
      <div className="space-y-4">
        {/* Barre d'outils */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
          <button onClick={() => setGenerateur((v) => !v)} className="btn-primary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm w-full sm:w-auto">
            <Sparkles className="h-4 w-4" /> Générer un planning
          </button>
          {jours.length > 0 && (
            <a href={`/api/pdf/poei-plannings/${poeiId}`} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm w-full sm:w-auto">
              <Download className="h-4 w-4" /> Tous les PDF
            </a>
          )}
        </div>

        {/* Générateur */}
        {generateur && (
          <div className="card p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-surface-600">Du
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="input-base mt-1" />
              </label>
              <label className="text-xs text-surface-600">Au
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="input-base mt-1" />
              </label>
              <label className="text-xs text-surface-600">Service du midi
                <div className="flex items-center gap-1.5 mt-1">
                  <input type="time" value={c1d} onChange={(e) => setC1d(e.target.value)} className="input-base" />
                  <span className="text-surface-400">à</span>
                  <input type="time" value={c1f} onChange={(e) => setC1f(e.target.value)} className="input-base" />
                </div>
              </label>
              <label className="text-xs text-surface-600">Service du soir (optionnel)
                <div className="flex items-center gap-1.5 mt-1">
                  <input type="time" value={c2d} onChange={(e) => setC2d(e.target.value)} className="input-base" />
                  <span className="text-surface-400">à</span>
                  <input type="time" value={c2f} onChange={(e) => setC2f(e.target.value)} className="input-base" />
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-surface-700">Candidats et jours de repos hebdomadaires</div>
              {candidats.map((c) => {
                const coche = selection.includes(c.id)
                return (
                  <div key={c.id} className="flex items-center gap-x-3 gap-y-1.5 flex-wrap rounded-xl border border-surface-100 px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-sm text-surface-900 min-h-[40px] sm:min-h-0 min-w-0 sm:min-w-[180px] w-full sm:w-auto">
                      <input type="checkbox" checked={coche}
                        onChange={() => setSelection((s) => (coche ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
                      {c.nom}
                    </label>
                    <div className="flex gap-1">
                      {JOURS.map((j) => {
                        const repos = (reposPar[c.id] || []).includes(j.n)
                        return (
                          <button key={j.n} type="button" onClick={() => toggleRepos(c.id, j.n)} disabled={!coche}
                            className={cn(
                              'h-10 min-w-[2.5rem] sm:h-auto sm:min-w-0 px-2 sm:py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40',
                              repos ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
                            )}>
                            {j.court}
                          </button>
                        )
                      })}
                    </div>
                    <span className="text-[11px] text-surface-400">repos : jours verts</span>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button onClick={generer} disabled={busy} className="btn-primary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm disabled:opacity-50 w-full sm:w-auto">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer
              </button>
              <span className="text-xs text-surface-500">La période choisie remplace l&apos;existant pour les candidats cochés.</span>
            </div>
          </div>
        )}

        {/* Sélecteur de candidat + grille */}
        {candidats.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {candidats.map((c) => (
              <button key={c.id} onClick={() => setActif(c.id)}
                className={cn(
                  'px-3 py-2.5 sm:py-1.5 rounded-full text-sm font-medium transition-colors',
                  actif === c.id ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
                )}>
                {c.nom}{aDesJours.has(c.id) ? '' : ' ·  à générer'}
              </button>
            ))}
          </div>
        )}

        {actif && joursActif.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-surface-600">
                {joursActif.length} jours planifiés, {heures(totalMin)} au total
              </span>
              <a href={`/api/pdf/poei-plannings/${poeiId}?candidat=${actif}`}
                className="btn-secondary inline-flex items-center gap-1.5 !py-1 !px-2.5 text-xs !min-h-[40px] sm:!min-h-0">
                <Download className="h-3.5 w-3.5" /> PDF
              </a>
              <button onClick={() => effacer(actif)} disabled={busy}
                className="inline-flex items-center gap-1 text-xs text-danger-600 hover:underline disabled:opacity-50 min-h-[40px] sm:min-h-0 px-1">
                <Trash2 className="h-3.5 w-3.5" /> Effacer
              </button>
            </div>

            <PoeiDefilable className="rounded-xl">
              <div className="min-w-[720px] space-y-2">
                {semaines.map((sem, i) => {
                  const totalSem = sem.reduce((s, j) => s + dureeJour(j), 0)
                  const cases: (JourPlanningUI | null)[] = JOURS.map((jj) => sem.find((x) => dow(x.date) === jj.n) || null)
                  return (
                    <div key={i} className="card overflow-hidden">
                      <div className="px-3 py-1.5 flex items-center justify-between bg-surface-50 border-b border-surface-100">
                        <span className="text-xs font-semibold text-surface-700">
                          Semaine du {new Date(sem[0].date + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        </span>
                        <span className="text-xs text-surface-500 tabular-nums">{heures(totalSem)}</span>
                      </div>
                      <div className="grid grid-cols-7 divide-x divide-surface-100">
                        {cases.map((j, k) => (
                          <button key={k} disabled={!j} onClick={() => j && setEdition(j)}
                            className={cn(
                              'px-2 py-2 text-left min-h-[64px] transition-colors',
                              j ? 'hover:bg-brand-50/60 cursor-pointer' : 'bg-surface-50/50',
                              j?.repos && 'bg-brand-50/40',
                            )}>
                            {j && (
                              <>
                                <div className="text-[11px] text-surface-400">
                                  {JOURS[k].court} {new Date(j.date + 'T12:00:00Z').getUTCDate()}
                                </div>
                                {j.repos ? (
                                  <div className="mt-1 text-xs font-semibold text-brand-700">Repos</div>
                                ) : (
                                  <div className="mt-1 space-y-0.5">
                                    {j.creneau1_debut && <div className="text-[11px] text-surface-700 tabular-nums">{hm(j.creneau1_debut)}-{hm(j.creneau1_fin)}</div>}
                                    {j.creneau2_debut && <div className="text-[11px] text-surface-700 tabular-nums">{hm(j.creneau2_debut)}-{hm(j.creneau2_fin)}</div>}
                                  </div>
                                )}
                                {j.note && <div className="text-[11px] text-surface-400 truncate">{j.note}</div>}
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </PoeiDefilable>
          </div>
        ) : (
          <p className="text-sm text-surface-500">
            {candidats.length === 0
              ? 'Ajoutez des candidats au dossier pour générer leur planning.'
              : 'Aucun planning pour ce candidat : utilisez « Générer un planning » ci-dessus.'}
          </p>
        )}
      </div>

      {/* Éditeur d'un jour */}
      {edition && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setEdition(null)}>
          <div className="card w-full max-w-none sm:max-w-sm rounded-b-none sm:rounded-b-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-heading font-semibold text-surface-900">
                {new Date(edition.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <button onClick={() => setEdition(null)} aria-label="Fermer" className="h-10 w-10 -mr-2 inline-flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100"><X className="h-4 w-4" /></button>
            </div>
            <label className="flex items-center gap-2 text-sm text-surface-900">
              <input type="checkbox" checked={edition.repos}
                onChange={(e) => setEdition({ ...edition, repos: e.target.checked })} />
              Jour de repos
            </label>
            {!edition.repos && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-surface-500 w-10">Midi</span>
                  <input type="time" value={hm(edition.creneau1_debut)} onChange={(e) => setEdition({ ...edition, creneau1_debut: e.target.value || null })} className="input-base" />
                  <span className="text-surface-400">à</span>
                  <input type="time" value={hm(edition.creneau1_fin)} onChange={(e) => setEdition({ ...edition, creneau1_fin: e.target.value || null })} className="input-base" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-surface-500 w-10">Soir</span>
                  <input type="time" value={hm(edition.creneau2_debut)} onChange={(e) => setEdition({ ...edition, creneau2_debut: e.target.value || null })} className="input-base" />
                  <span className="text-surface-400">à</span>
                  <input type="time" value={hm(edition.creneau2_fin)} onChange={(e) => setEdition({ ...edition, creneau2_fin: e.target.value || null })} className="input-base" />
                </div>
              </div>
            )}
            <input type="text" placeholder="Note (optionnelle)" value={edition.note || ''}
              onChange={(e) => setEdition({ ...edition, note: e.target.value || null })} className="input-base w-full" />
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => setEdition(null)} className="btn-secondary !py-1.5 !px-3 text-sm">Annuler</button>
              <button disabled={busy}
                onClick={() => sauverJour({
                  repos: edition.repos,
                  creneau1_debut: edition.repos ? null : edition.creneau1_debut,
                  creneau1_fin: edition.repos ? null : edition.creneau1_fin,
                  creneau2_debut: edition.repos ? null : edition.creneau2_debut,
                  creneau2_fin: edition.repos ? null : edition.creneau2_fin,
                  note: edition.note,
                })}
                className="btn-primary !py-1.5 !px-3 text-sm disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PoeiSection>
  )
}
