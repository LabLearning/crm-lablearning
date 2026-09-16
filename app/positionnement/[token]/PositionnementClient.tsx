'use client'

import { useState } from 'react'
import { DOMAINES, QUESTIONS, type Reponses } from '@/lib/poei-positionnement'
import { repondrePositionnementAction } from './actions'

interface Props {
  token: string
  prenom: string | null
  employeur: string | null
  orgNom: string
  orgLogo: string | null
  nbQuestions: number
}

/**
 * Le candidat répond depuis son téléphone : une question à la fois, une barre
 * de progression, et rien d'autre à l'écran. Un questionnaire qu'on abandonne
 * en route ne sert à personne.
 */
export function PositionnementClient({ token, prenom, employeur, orgNom, orgLogo, nbQuestions }: Props) {
  const [demarre, setDemarre] = useState(false)
  const [index, setIndex] = useState(0)
  const [reponses, setReponses] = useState<Reponses>({})
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fini, setFini] = useState<{ note: number; justes: number; total: number } | null>(null)

  const q = QUESTIONS[index]
  const domaine = DOMAINES.find((d) => d.code === q?.domaine)
  const repondues = Object.keys(reponses).length
  const progression = Math.round((index / nbQuestions) * 100)

  async function envoyer(dernieres: Reponses) {
    setEnvoi(true); setErreur(null)
    const r = await repondrePositionnementAction(token, dernieres)
    setEnvoi(false)
    if (r.success && r.data) setFini(r.data)
    else setErreur(r.error || 'Envoi impossible, réessayez')
  }

  function choisir(choix: number) {
    const suite = { ...reponses, [q.code]: choix }
    setReponses(suite)
    if (index + 1 < QUESTIONS.length) setIndex(index + 1)
    else envoyer(suite)
  }

  if (fini) {
    return (
      <Ecran logo={orgLogo}>
        {/* Pas de note affichée au candidat : c'est un positionnement, pas un
            examen, et la note sert au dossier de financement. */}
        <div className="text-center">
          <div className="text-3xl font-heading font-black text-brand-600 tabular-nums">{fini.total}<span className="text-xl text-surface-400"> réponses</span></div>
          <h1 className="text-xl font-heading font-bold text-surface-900 mt-3">Merci, c&apos;est enregistré</h1>
          <p className="text-sm text-surface-600 mt-2 leading-relaxed">
            Ce questionnaire n&apos;est pas un examen : il sert à construire votre formation autour de ce qu&apos;il
            vous reste à apprendre. Votre formateur le reprendra avec vous au démarrage.
          </p>
          <p className="text-xs text-surface-400 mt-4">Vous pouvez fermer cette page.</p>
        </div>
      </Ecran>
    )
  }

  if (!demarre) {
    return (
      <Ecran logo={orgLogo}>
        <h1 className="text-2xl font-heading font-bold text-surface-900">
          Bonjour{prenom ? ` ${prenom}` : ''}
        </h1>
        <p className="text-sm text-surface-600 mt-3 leading-relaxed">
          Avant votre entrée en formation{employeur ? ` chez ${employeur}` : ''}, {orgNom} vous propose un court
          questionnaire de positionnement.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-surface-700">
          <li className="flex gap-2"><span className="text-brand-600">•</span> {nbQuestions} questions, une seule réponse par question</li>
          <li className="flex gap-2"><span className="text-brand-600">•</span> Moins de dix minutes</li>
          <li className="flex gap-2"><span className="text-brand-600">•</span> Aucune conséquence sur votre entrée en formation</li>
        </ul>
        <p className="text-sm text-surface-600 mt-4 leading-relaxed">
          Répondez seul et sans chercher : un résultat honnête permet de passer plus de temps sur ce que vous
          ne connaissez pas encore, et moins sur ce que vous maîtrisez déjà.
        </p>
        <button onClick={() => setDemarre(true)} className="btn-primary w-full mt-6 justify-center">
          Commencer
        </button>
      </Ecran>
    )
  }

  return (
    <Ecran logo={orgLogo}>
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-surface-500 mb-2">
          <span>{domaine?.libelle}</span>
          <span className="tabular-nums">Question {index + 1} sur {nbQuestions}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.max(3, progression)}%` }} />
        </div>
      </div>

      <h2 className="text-lg font-heading font-bold text-surface-900 leading-snug">{q.intitule}</h2>

      <div className="mt-4 space-y-2">
        {q.choix.map((c, i) => (
          <button
            key={i}
            onClick={() => choisir(i)}
            disabled={envoi}
            className="w-full text-left rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-800 hover:border-brand-400 hover:bg-brand-50/40 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>

      {index > 0 && (
        <button onClick={() => setIndex(index - 1)} disabled={envoi}
          className="mt-5 text-xs font-medium text-surface-400 hover:text-surface-600">
          Revenir à la question précédente
        </button>
      )}
      {envoi && <p className="mt-4 text-sm text-surface-500">Enregistrement de vos réponses…</p>}
      {erreur && (
        <div className="mt-4">
          <p className="text-sm text-danger-600">{erreur}</p>
          <button onClick={() => envoyer(reponses)} className="btn-primary mt-2 text-sm">Réessayer</button>
        </div>
      )}
      <p className="mt-6 text-[11px] text-surface-400 text-center tabular-nums">{repondues} réponse{repondues > 1 ? 's' : ''} enregistrée{repondues > 1 ? 's' : ''}</p>
    </Ecran>
  )
}

function Ecran({ children, logo }: { children: React.ReactNode; logo?: string | null }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4 py-8">
      <div className="card p-6 sm:p-7 max-w-lg w-full">
        {logo && <img src={logo} alt="" className="h-8 mb-5 object-contain" />}
        {children}
      </div>
    </div>
  )
}
