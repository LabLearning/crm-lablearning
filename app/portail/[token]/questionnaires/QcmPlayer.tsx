'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, ClipboardCheck } from '@/components/ui/icons'
import { submitQcmAction } from './actions'

interface QcmChoix {
  id: string
  texte: string
  est_correct: boolean
  position: number
}

interface QcmQuestion {
  id: string
  texte: string
  position: number
  points: number
  type: string
  explication: string | null
  choix: QcmChoix[]
}

interface QcmPlayerProps {
  token: string
  reponseId: string
  qcm: {
    titre: string
    type: string
    description: string | null
    score_min_reussite: number | null
    questions: QcmQuestion[]
  }
}

export default function QcmPlayer({ token, reponseId, qcm }: QcmPlayerProps) {
  const router = useRouter()
  const questions = [...qcm.questions].sort((a, b) => a.position - b.position)
  const total = questions.length

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // score null : rien à noter (satisfaction, texte libre) ; jamais affiché comme 0 %
  const [result, setResult] = useState<{ score: number | null; isReussi: boolean | null } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentQuestion = questions[currentIndex]
  const isLast = currentIndex === total - 1
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await submitQcmAction(token, reponseId, answers)
      if (res.success) {
        setResult({ score: res.score ?? null, isReussi: res.isReussi ?? null })
      } else {
        setSubmitError(res.error || 'Une erreur est survenue')
      }
    } catch {
      setSubmitError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Result screen
  if (result !== null) {
    const passed = result.isReussi
    return (
      <div className="card p-6 md:p-8 text-center animate-fade-in max-w-lg mx-auto">
        <div
          className={`mx-auto mb-5 w-24 h-24 rounded-full flex items-center justify-center text-2xl font-heading font-bold ${
            passed === true || result.score === null
              ? 'bg-success-100 text-success-700'
              : passed === false
              ? 'bg-danger-100 text-danger-700'
              : 'bg-surface-100 text-surface-700'
          }`}
        >
          {result.score === null ? <CheckCircle2 className="h-10 w-10" /> : `${result.score}%`}
        </div>

        <h2 className="text-xl font-heading font-bold text-surface-900 mb-2">{qcm.titre}</h2>

        {passed !== null && (
          <div className={`flex items-center justify-center gap-2 mb-3 text-base font-semibold ${passed ? 'text-success-600' : 'text-danger-600'}`}>
            {passed ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" />
            )}
            {passed ? 'Réussi' : 'Non réussi'}
          </div>
        )}

        {qcm.score_min_reussite !== null && (
          <p className="text-sm text-surface-500 mb-6">
            Minimum requis : {qcm.score_min_reussite}%
          </p>
        )}

        {passed === null && (
          <p className="text-sm text-surface-500 mb-6">{result.score === null ? 'Merci, vos réponses sont enregistrées.' : 'Questionnaire complété.'}</p>
        )}

        <button
          onClick={() => router.back()}
          className="btn-primary"
        >
          Retour aux questionnaires
        </button>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="card p-8 text-center text-surface-500 text-sm">
        Aucune question disponible.
      </div>
    )
  }

  const progressPct = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-5 w-5 text-brand-500 shrink-0" />
          <h2 className="text-lg font-heading font-bold text-surface-900">{qcm.titre}</h2>
        </div>
        {qcm.description && (
          <p className="text-sm text-surface-500">{qcm.description}</p>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-surface-500">
            Question {currentIndex + 1} / {total}
          </span>
          <span className="text-xs font-medium text-brand-600">{progressPct}%</span>
        </div>
        <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="card p-4 md:p-6">
        {(currentQuestion as any).section && (
          <p className="section-label mb-2">{(currentQuestion as any).section}</p>
        )}
        <p className="text-base font-semibold text-surface-900 mb-5 leading-relaxed">
          {currentQuestion.texte}
        </p>

        {/* Answer options */}
        {(currentQuestion.type === 'choix_unique' || currentQuestion.type === 'vrai_faux') && (
          <div className="space-y-2">
            {currentQuestion.type === 'vrai_faux' ? (
              // Vrai/Faux: use large buttons based on qcm_choix or fallback synthetic options
              <VraiFauxButtons
                question={currentQuestion}
                selected={currentAnswer}
                onSelect={(val) => setAnswer(currentQuestion.id, val)}
              />
            ) : (
              currentQuestion.choix.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAnswer(currentQuestion.id, c.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    currentAnswer === c.id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
                  }`}
                >
                  {c.texte}
                </button>
              ))
            )}
          </div>
        )}

        {currentQuestion.type === 'choix_multiple' && (
          <div className="space-y-2">
            {currentQuestion.choix.map((c) => {
              const selected = currentAnswer?.split(',').includes(c.id) ?? false
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    const current = currentAnswer ? currentAnswer.split(',').filter(Boolean) : []
                    const updated = selected
                      ? current.filter((id) => id !== c.id)
                      : [...current, c.id]
                    setAnswer(currentQuestion.id, updated.join(','))
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    selected
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
                  }`}
                >
                  {c.texte}
                </button>
              )
            })}
          </div>
        )}

        {currentQuestion.type === 'texte_libre' && (
          <textarea
            className="input-base w-full min-h-[100px] resize-y"
            placeholder="Votre réponse..."
            value={currentAnswer || ''}
            onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
          />
        )}

        {(currentQuestion.type === 'note_1_5' || currentQuestion.type === 'note_1_10' || currentQuestion.type === 'nps') && (
          <NoteButtons
            type={currentQuestion.type}
            selected={currentAnswer}
            onSelect={(val) => setAnswer(currentQuestion.id, val)}
          />
        )}
      </div>

      {/* Navigation */}
      {submitError && (
        <p className="text-sm text-danger-600 text-center">{submitError}</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </button>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Envoi en cours...</span>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Terminer
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function VraiFauxButtons({
  question,
  selected,
  onSelect,
}: {
  question: QcmQuestion
  selected: string | undefined
  onSelect: (val: string) => void
}) {
  // Use qcm_choix if available (they may be labelled "Vrai"/"Faux"),
  // otherwise fall back to synthetic options
  const choix = question.choix && question.choix.length > 0 ? question.choix : null

  if (choix) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {choix.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`py-4 rounded-xl border text-sm font-semibold transition-all ${
              selected === c.id
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
            }`}
          >
            {c.texte}
          </button>
        ))}
      </div>
    )
  }

  // Fallback synthetic
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['vrai', 'faux'] as const).map((val) => (
        <button
          key={val}
          onClick={() => onSelect(val)}
          className={`py-4 rounded-xl border text-sm font-semibold transition-all ${
            selected === val
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
          }`}
        >
          {val === 'vrai' ? 'Vrai' : 'Faux'}
        </button>
      ))}
    </div>
  )
}

function NoteButtons({
  type,
  selected,
  onSelect,
}: {
  type: string
  selected: string | undefined
  onSelect: (val: string) => void
}) {
  const max = type === 'note_1_5' ? 5 : type === 'nps' ? 10 : 10
  const min = type === 'nps' ? 0 : 1
  const values = Array.from({ length: max - min + 1 }, (_, i) => String(min + i))

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onSelect(v)}
          className={`w-10 h-10 rounded-xl border text-sm font-semibold transition-all ${
            selected === v
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-surface-200 bg-white text-surface-700 hover:border-brand-400 hover:bg-brand-50'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
