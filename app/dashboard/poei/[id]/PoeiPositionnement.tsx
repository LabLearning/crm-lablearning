'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Modal, Input, useToast } from '@/components/ui'
import { Target, Download, Pencil, Users, TrendingUp } from '@/components/ui/icons'
import { PoeiSection } from './PoeiSection'
import {
  DOMAINES, QUESTIONS, NIVEAUX, evaluerPositionnement, syntheseFranceTravail,
  type NiveauReponse, type Reponses,
} from '@/lib/poei-positionnement'
import { enregistrerPositionnementAction } from '../positionnement-actions'

export interface PositionnementCandidat {
  candidatId: string
  nom: string
  reponses: Reponses | null
  maitrise: number | null
  heures: number | null
  realiseLe: string | null
  commentaire: string | null
}

interface Props {
  poeiId: string
  dureeParcours: number | null
  candidats: PositionnementCandidat[]
}

const fr = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : null)

/**
 * Positionnement d'entrée : ce que chaque candidat sait déjà faire, et le
 * volume d'heures que l'écart au référentiel justifie auprès de France Travail.
 */
export function PoeiPositionnement({ poeiId, dureeParcours, candidats }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [edite, setEdite] = useState<PositionnementCandidat | null>(null)
  const [reponses, setReponses] = useState<Reponses>({})
  const [commentaire, setCommentaire] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [enregistre, setEnregistre] = useState(false)

  const faits = candidats.filter((c) => c.maitrise != null)
  const synthese = useMemo(() => {
    if (!faits.length) return null
    const m = faits.reduce((t, c) => t + (c.maitrise || 0), 0) / faits.length
    const h = faits.reduce((t, c) => t + (c.heures || 0), 0) / faits.length
    return { maitrise: Math.round(m * 10) / 10, heures: Math.round(h * 2) / 2 }
  }, [faits])

  // Aperçu en direct pendant la saisie : le formateur voit l'effet de chaque réponse
  const apercu = useMemo(() => evaluerPositionnement(reponses), [reponses])

  function ouvrir(c: PositionnementCandidat) {
    setEdite(c)
    setReponses(c.reponses || {})
    setCommentaire(c.commentaire || '')
    setDate(c.realiseLe || new Date().toISOString().slice(0, 10))
  }

  async function enregistrer() {
    if (!edite) return
    setEnregistre(true)
    const fd = new FormData()
    for (const [k, v] of Object.entries(reponses)) if (v != null) fd.append(k, String(v))
    fd.append('commentaire', commentaire)
    fd.append('realise_le', date)
    const r = await enregistrerPositionnementAction(poeiId, edite.candidatId, fd)
    setEnregistre(false)
    if (r.success) {
      toast('success', `Positionnement enregistré — ${(r.data as any).heures} h justifiées`)
      setEdite(null)
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  return (
    <PoeiSection
      icone={Target}
      titre="Positionnement à l'entrée"
      sous={`${faits.length}/${candidats.length} candidats positionnés sur les ${QUESTIONS.length} situations du référentiel`}
      actions={
        faits.length > 0 ? (
          <a href={`/api/pdf/poei-positionnement/${poeiId}`} target="_blank" rel="noreferrer"
            className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm">
            <Download className="h-4 w-4" /> Dossier France Travail
          </a>
        ) : null
      }
    >
      {synthese && (
        <div className="card p-4 mb-3 flex flex-wrap items-center gap-x-8 gap-y-3 bg-brand-50/30 border-brand-100">
          <div>
            <div className="text-xs text-surface-500">Niveau moyen à l&apos;entrée</div>
            <div className="text-xl font-heading font-bold text-surface-900 tabular-nums">{synthese.maitrise} %</div>
          </div>
          <div>
            <div className="text-xs text-surface-500">Heures justifiées en moyenne</div>
            <div className="text-xl font-heading font-bold text-brand-600 tabular-nums">
              {synthese.heures} h<span className="text-sm text-surface-400 font-semibold"> / {dureeParcours ?? 140} h</span>
            </div>
          </div>
          <p className="text-xs text-surface-500 max-w-md">
            L&apos;écart entre le niveau constaté et le référentiel de compétences justifie le volume du parcours.
          </p>
        </div>
      )}

      {candidats.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-500">
          <Users className="h-7 w-7 text-surface-300 mx-auto mb-2" />
          Ajoutez des candidats pour les positionner
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {candidats.map((c) => (
            <div key={c.candidatId} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">{c.nom}</div>
                <div className="text-xs text-surface-500">
                  {c.maitrise != null
                    ? `${c.maitrise} % du référentiel · ${c.heures} h justifiées${fr(c.realiseLe) ? ` · le ${fr(c.realiseLe)}` : ''}`
                    : 'Pas encore positionné'}
                </div>
              </div>
              {c.maitrise != null && (
                <div className="hidden sm:block w-32 shrink-0">
                  <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-400"
                      style={{ width: `${Math.max(2, c.maitrise)}%` }} />
                  </div>
                </div>
              )}
              {c.maitrise != null && (
                <a href={`/api/pdf/poei-positionnement/${poeiId}?candidat=${c.candidatId}`} target="_blank" rel="noreferrer"
                  title="Fiche de positionnement du candidat"
                  className="p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 shrink-0">
                  <Download className="h-4 w-4" />
                </a>
              )}
              <Button size="sm" variant="secondary" onClick={() => ouvrir(c)} icon={<Pencil className="h-3.5 w-3.5" />}>
                {c.maitrise != null ? 'Revoir' : 'Positionner'}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!edite} onClose={() => setEdite(null)} size="lg"
        title={`Positionnement — ${edite?.nom || ''}`}
        description="Situez le candidat sur chaque situation de travail. Les heures se déduisent de l'écart au référentiel.">
        {edite && (
          <div className="space-y-4">
            {/* Ce que donne la saisie, en direct */}
            <div className="card p-3.5 bg-surface-50/70 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-600" />
                <span className="text-sm font-semibold text-surface-900">{apercu.maitriseGlobale} %</span>
                <span className="text-xs text-surface-500">{apercu.niveauLibelle}</span>
              </div>
              <div className="text-sm">
                <span className="font-heading font-bold text-brand-600 tabular-nums">{apercu.heuresPreconisees} h</span>
                <span className="text-xs text-surface-500"> justifiées sur {apercu.heuresReferentiel} h</span>
              </div>
              <div className="text-xs text-surface-400 tabular-nums">
                {apercu.nbReponses}/{apercu.nbQuestions} situations renseignées
              </div>
            </div>

            <div className="max-h-[52vh] overflow-y-auto space-y-4 pr-1">
              {DOMAINES.map((d) => {
                const dom = apercu.domaines.find((x) => x.code === d.code)!
                return (
                  <div key={d.code} className="rounded-xl border border-surface-200 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-surface-50 border-b border-surface-100">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-surface-900">{d.libelle}</div>
                        <div className="text-[11px] text-surface-500 truncate">{d.objectif}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-surface-900 tabular-nums">{dom.maitrise} %</div>
                        <div className="text-[11px] text-surface-500 tabular-nums">{dom.heuresPreconisees} h / {d.heures} h</div>
                      </div>
                    </div>
                    <div className="divide-y divide-surface-100">
                      {QUESTIONS.filter((q) => q.domaine === d.code).map((q) => (
                        <div key={q.code} className="px-3.5 py-2.5">
                          <div className="text-sm text-surface-800">{q.intitule}</div>
                          {q.repere && <div className="text-[11px] text-surface-400 mt-0.5">{q.repere}</div>}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {NIVEAUX.map((n) => {
                              const actif = reponses[q.code] === n.valeur
                              return (
                                <button
                                  key={n.valeur} type="button" title={n.detail}
                                  onClick={() => setReponses((r) => ({ ...r, [q.code]: n.valeur as NiveauReponse }))}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                                    actif
                                      ? 'bg-brand-600 border-brand-600 text-white'
                                      : 'bg-white border-surface-200 text-surface-600 hover:border-brand-300'}`}
                                >
                                  {n.libelle}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Observations du positionnement</label>
                <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2}
                  className="input-base resize-none"
                  placeholder="Expérience antérieure, contraintes, points d'attention relevés pendant l'entretien" />
              </div>
              <Input id="realise_le" type="date" label="Réalisé le" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <p className="text-xs text-surface-500">{syntheseFranceTravail(apercu)}</p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEdite(null)}>Annuler</Button>
              <Button onClick={enregistrer} isLoading={enregistre} icon={<Target className="h-4 w-4" />}>Enregistrer</Button>
            </div>
          </div>
        )}
      </Modal>
    </PoeiSection>
  )
}
