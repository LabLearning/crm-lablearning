'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Modal, useToast } from '@/components/ui'
import { Target, Download, Send, Users, Check, Clock, RefreshCw, Copy } from '@/components/ui/icons'
import { PoeiSection } from './PoeiSection'
import { DOMAINES, QUESTIONS, SEUIL_REUSSITE, evaluerPositionnement, type Reponses } from '@/lib/poei-positionnement'
import { envoyerPositionnementAction, reinitialiserPositionnementAction } from '../positionnement-actions'

export interface PositionnementCandidat {
  candidatId: string
  nom: string
  email: string | null
  statut: 'absent' | 'envoye' | 'complete'
  lien: string | null
  reponses: Reponses | null
  note: number | null
  maitrise: number | null
  heures: number | null
  completeLe: string | null
}

interface Props {
  poeiId: string
  dureeParcours: number | null
  candidats: PositionnementCandidat[]
}

const fr = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : null)

/**
 * Positionnement à l'entrée : le candidat répond lui-même à vingt questions,
 * et l'écart au référentiel de compétences justifie le volume d'heures auprès
 * de France Travail.
 */
export function PoeiPositionnement({ poeiId, dureeParcours, candidats }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [envoiOuvert, setEnvoiOuvert] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [detail, setDetail] = useState<PositionnementCandidat | null>(null)

  const repondus = candidats.filter((c) => c.statut === 'complete')
  const enAttente = candidats.filter((c) => c.statut === 'envoye')
  const aEnvoyer = candidats.filter((c) => c.statut === 'absent')

  const synthese = useMemo(() => {
    if (!repondus.length) return null
    return {
      note: Math.round((repondus.reduce((t, c) => t + (c.note || 0), 0) / repondus.length) * 10) / 10,
      maitrise: Math.round((repondus.reduce((t, c) => t + (c.maitrise || 0), 0) / repondus.length) * 10) / 10,
      heures: Math.round((repondus.reduce((t, c) => t + (c.heures || 0), 0) / repondus.length) * 2) / 2,
    }
  }, [repondus])

  async function envoyer() {
    if (!selection.length) { toast('error', 'Sélectionnez au moins un candidat'); return }
    setEnvoi(true)
    const r = await envoyerPositionnementAction(poeiId, selection)
    setEnvoi(false)
    if (r.success) {
      const d = r.data as any
      toast('success', `Questionnaire envoyé à ${d.envoyes} candidat${d.envoyes > 1 ? 's' : ''}${d.ignores ? `, ${d.ignores} ignoré${d.ignores > 1 ? 's' : ''}` : ''}`)
      setEnvoiOuvert(false); setSelection([])
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  async function reinitialiser(c: PositionnementCandidat) {
    if (!confirm(`Effacer les réponses de ${c.nom} et lui renvoyer le questionnaire ?`)) return
    const r = await reinitialiserPositionnementAction(poeiId, c.candidatId)
    if (r.success) { toast('success', 'Questionnaire réinitialisé'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  function copier(lien: string) {
    navigator.clipboard?.writeText(lien)
    toast('success', 'Lien copié')
  }

  const resultat = detail?.reponses ? evaluerPositionnement(detail.reponses) : null

  return (
    <PoeiSection
      icone={Target}
      titre="Positionnement à l'entrée"
      sous={`${repondus.length}/${candidats.length} candidats ont répondu aux ${QUESTIONS.length} questions du référentiel`}
      actions={
        <>
          {repondus.length > 0 && (
            <a href={`/api/pdf/poei-positionnement/${poeiId}`} target="_blank" rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm">
              <Download className="h-4 w-4" /> Dossier France Travail
            </a>
          )}
          <Button size="sm" onClick={() => { setSelection([...aEnvoyer, ...enAttente].map((c) => c.candidatId)); setEnvoiOuvert(true) }}
            icon={<Send className="h-4 w-4" />}>
            Envoyer le questionnaire
          </Button>
        </>
      }
    >
      {synthese && (
        <div className="card p-4 mb-3 flex flex-wrap items-center gap-x-8 gap-y-3 bg-brand-50/30 border-brand-100">
          <div>
            <div className="text-xs text-surface-500">Note moyenne</div>
            <div className="text-xl font-heading font-bold text-surface-900 tabular-nums">{synthese.note}<span className="text-sm text-surface-400">/20</span></div>
          </div>
          <div>
            <div className="text-xs text-surface-500">Bonnes réponses en moyenne</div>
            <div className="text-xl font-heading font-bold text-surface-900 tabular-nums">{synthese.maitrise} %</div>
          </div>
          <div>
            <div className="text-xs text-surface-500">Heures justifiées en moyenne</div>
            <div className="text-xl font-heading font-bold text-brand-600 tabular-nums">
              {synthese.heures} h<span className="text-sm text-surface-400 font-semibold"> / {dureeParcours ?? 140} h</span>
            </div>
          </div>
          <p className="text-xs text-surface-500 max-w-xs">
            En dessous de {SEUIL_REUSSITE} % de bonnes réponses, le parcours complet est requis. Au-delà, seul l&apos;écart restant est à former.
          </p>
        </div>
      )}

      {candidats.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-500">
          <Users className="h-7 w-7 text-surface-300 mx-auto mb-2" />
          Ajoutez des candidats pour leur envoyer le questionnaire
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {candidats.map((c) => (
            <div key={c.candidatId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">{c.nom}</div>
                {/* Sur téléphone le résultat se replie : la date de réponse reste lisible */}
                <div className="text-xs text-surface-500 break-words sm:truncate">
                  {c.statut === 'complete'
                    ? `${c.note}/20 · ${c.maitrise} % de bonnes réponses · ${(c.maitrise ?? 0) < SEUIL_REUSSITE ? `parcours complet, ${c.heures} h` : `${c.heures} h justifiées`}${fr(c.completeLe) ? ` · le ${fr(c.completeLe)}` : ''}`
                    : c.statut === 'envoye'
                      ? `En attente de réponse${c.email ? ` · ${c.email}` : ' · pas d’email en fiche, transmettez le lien'}`
                      : 'Questionnaire pas encore envoyé'}
                </div>
              </div>
              {c.statut === 'complete' && c.maitrise != null && (
                <div className="hidden sm:block w-28 shrink-0">
                  <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-400"
                      style={{ width: `${Math.max(2, c.maitrise)}%` }} />
                  </div>
                </div>
              )}
              {/* Sur téléphone, badge et actions forment une rangée sous le nom */}
              <div className="flex items-center gap-1.5 shrink-0">
              <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md ${
                c.statut === 'complete' ? 'bg-emerald-50 text-emerald-700'
                  : c.statut === 'envoye' ? 'bg-amber-50 text-amber-700' : 'bg-surface-100 text-surface-500'}`}>
                {c.statut === 'complete' ? <Check className="h-3 w-3 inline -mt-0.5" /> : c.statut === 'envoye' ? <Clock className="h-3 w-3 inline -mt-0.5" /> : null}
                {' '}{c.statut === 'complete' ? 'Répondu' : c.statut === 'envoye' ? 'Envoyé' : 'À envoyer'}
              </span>
              {c.statut === 'envoye' && c.lien && (
                <button onClick={() => copier(c.lien!)} title="Copier le lien du candidat"
                  className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 shrink-0">
                  <Copy className="h-4 w-4" />
                </button>
              )}
              {c.statut === 'complete' && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setDetail(c)} className="ml-auto sm:ml-0">Voir</Button>
                  <a href={`/api/pdf/poei-positionnement/${poeiId}?candidat=${c.candidatId}`} target="_blank" rel="noreferrer"
                    title="Fiche de positionnement" className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 shrink-0">
                    <Download className="h-4 w-4" />
                  </a>
                  <button onClick={() => reinitialiser(c)} title="Effacer et renvoyer"
                    className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg text-surface-400 hover:text-danger-600 hover:bg-surface-100 shrink-0">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </>
              )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Envoi */}
      <Modal isOpen={envoiOuvert} onClose={() => setEnvoiOuvert(false)} size="md"
        title="Envoyer le questionnaire de positionnement"
        description="Chaque candidat reçoit un lien personnel, sans compte ni mot de passe. Un candidat qui a déjà répondu n'est pas relancé.">
        <div className="space-y-3">
          <div className="max-h-80 overflow-y-auto divide-y divide-surface-100 rounded-xl border border-surface-200">
            {candidats.map((c) => {
              const deja = c.statut === 'complete'
              const coche = selection.includes(c.candidatId)
              return (
                <label key={c.candidatId} className={`flex items-center gap-3 px-3.5 py-2.5 ${deja ? 'opacity-50' : 'cursor-pointer hover:bg-surface-50'}`}>
                  <input type="checkbox" disabled={deja} checked={coche} className="rounded border-surface-300"
                    onChange={(e) => setSelection((s) => e.target.checked ? [...s, c.candidatId] : s.filter((x) => x !== c.candidatId))} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-surface-900 truncate">{c.nom}</div>
                    <div className="text-xs text-surface-500 truncate">
                      {deja ? 'A déjà répondu' : c.email || 'Pas d’email en fiche, le lien sera à copier'}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
          <p className="text-xs text-surface-500">
            {selection.length} candidat{selection.length > 1 ? 's' : ''} sélectionné{selection.length > 1 ? 's' : ''}.
            Les candidats sans email apparaîtront dans la liste avec un lien à copier.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEnvoiOuvert(false)}>Annuler</Button>
            <Button onClick={envoyer} isLoading={envoi} icon={<Send className="h-4 w-4" />}>Envoyer</Button>
          </div>
        </div>
      </Modal>

      {/* Détail des réponses */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} size="lg"
        title={`Réponses, ${detail?.nom || ''}`}
        description={resultat ? `${resultat.justes}/${resultat.nbQuestions} bonnes réponses · ${resultat.note}/20 · ${resultat.heuresPreconisees} h justifiées sur ${resultat.heuresReferentiel} h` : ''}>
        {resultat && detail?.reponses && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {DOMAINES.map((d) => {
              const dom = resultat.domaines.find((x) => x.code === d.code)!
              return (
                <div key={d.code} className="rounded-xl border border-surface-200 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3.5 py-2.5 bg-surface-50 border-b border-surface-100">
                    <div className="text-sm font-semibold text-surface-900">{d.libelle}</div>
                    <div className="text-xs text-surface-600 tabular-nums shrink-0">
                      {dom.justes}/{dom.total} · {dom.heuresPreconisees} h sur {d.heures} h
                    </div>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {QUESTIONS.filter((q) => q.domaine === d.code).map((q) => {
                      const rep = detail.reponses![q.code]
                      const juste = rep != null && Number(rep) === q.correct
                      return (
                        <div key={q.code} className="px-3.5 py-2.5">
                          <div className="text-sm text-surface-800">{q.intitule}</div>
                          <div className={`text-xs mt-1 ${juste ? 'text-emerald-700' : 'text-danger-600'}`}>
                            {rep == null ? 'Sans réponse' : `${juste ? 'Juste' : 'Faux'}, a répondu « ${q.choix[Number(rep)]} »`}
                          </div>
                          {!juste && <div className="text-xs text-surface-500 mt-0.5">Attendu : « {q.choix[q.correct]} »</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </PoeiSection>
  )
}
