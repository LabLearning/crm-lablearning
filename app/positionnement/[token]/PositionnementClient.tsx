'use client'

import { useEffect, useRef, useState } from 'react'
import { DOMAINES, QUESTIONS, type Reponses } from '@/lib/poei-positionnement'
import { repondrePositionnementAction } from './actions'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Clock,
  Flame,
  HelpCircle,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  ShoppingCart,
  Target,
  Users,
} from '@/components/ui/icons'

/**
 * Questionnaire de positionnement POEI, côté candidat.
 *
 * Parcours en cinq chapitres (un par domaine du référentiel) : un écran
 * d'accueil plein écran qui annonce les chapitres, une question à la fois,
 * un interstitiel à l'entrée des chapitres 2 à 5 (le premier est déjà présenté
 * par l'accueil), puis un écran de fin qui confirme l'enregistrement.
 * Aucune note n'est montrée au candidat : ce n'est pas un examen.
 */

interface Props {
  token: string
  prenom: string | null
  employeur: string | null
  orgNom: string
  orgLogo: string | null
  nbQuestions: number
}

type Etape = 'accueil' | 'chapitre' | 'question' | 'envoi' | 'fin'
type Direction = 'avant' | 'arriere'

const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F']

/** Délai entre le tap sur une réponse et le passage à la question suivante. */
const DELAI_SELECTION_MS = 260

type Icone = typeof Target

const ICONES_DOMAINES: Record<string, Icone> = {
  hygiene: ShieldCheck,
  production: ChefHat,
  service: ShoppingCart,
  securite: Flame,
  posture: Users,
}

function iconeDomaine(code: string | undefined): Icone {
  return (code && ICONES_DOMAINES[code]) || Target
}

/* ── Classes partagées (tokens du design system, pas d'hex) ──────────────── */

const FOCUS = 'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/60'

/** Bouton principal menthe sur fond pine. */
const BTN_MINT = [
  'inline-flex min-h-[3.5rem] items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5',
  'bg-accent-400 text-brand-800 font-heading text-[1.0625rem] font-bold tracking-tight',
  'shadow-[0_18px_40px_-18px_rgba(92,217,160,0.9)]',
  'transition-[transform,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none',
  'hover:bg-accent-300 active:scale-[0.985]',
  FOCUS,
  'focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600',
  'disabled:pointer-events-none disabled:opacity-50',
].join(' ')

/** Bouton secondaire translucide sur fond pine. */
const BTN_GHOST = [
  'inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl px-5 py-3',
  'border border-white/[0.18] bg-white/[0.08] text-[15px] font-semibold text-white',
  'transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none',
  'hover:bg-white/[0.14] active:scale-[0.985]',
  FOCUS,
  'disabled:pointer-events-none disabled:opacity-50',
].join(' ')

/** Lien discret sur fond pine. */
const LIEN = `inline-flex items-center gap-1 rounded-lg px-1 py-0.5 font-medium text-white/80 hover:text-white ${FOCUS}`

/* ────────────────────────────────────────────────────────────────────────── */

export function PositionnementClient({ token, prenom, employeur, orgNom, orgLogo, nbQuestions }: Props) {
  const [etape, setEtape] = useState<Etape>('accueil')
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<Direction>('avant')
  const [reponses, setReponses] = useState<Reponses>({})
  const [selection, setSelection] = useState<number | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titreRef = useRef<HTMLHeadingElement>(null)
  /** Réglage « réduire les animations » du téléphone : ni délai de sélection, ni défilement animé. */
  const mouvementReduitRef = useRef(false)

  const total = nbQuestions || QUESTIONS.length
  const q = QUESTIONS[index]
  const numDomaine = Math.max(0, DOMAINES.findIndex((d) => d.code === q?.domaine))
  const domaine = DOMAINES[numDomaine]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const maj = () => { mouvementReduitRef.current = media.matches }
    maj()
    media.addEventListener?.('change', maj)
    return () => {
      media.removeEventListener?.('change', maj)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // À chaque changement d'écran : haut de page, et focus sur l'intitulé de la
  // question pour que les lecteurs d'écran annoncent la nouvelle question.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: mouvementReduitRef.current ? 'auto' : 'smooth' })
    if (etape === 'question') titreRef.current?.focus({ preventScroll: true })
  }, [etape, index])

  async function envoyer(dernieres: Reponses) {
    setEtape('envoi')
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await repondrePositionnementAction(token, dernieres)
      if (r.success) {
        setEtape('fin')
      } else {
        setErreur(r.error || 'Envoi impossible, réessayez.')
      }
    } catch {
      setErreur('La connexion a été interrompue. Vérifiez votre réseau puis réessayez.')
    } finally {
      setEnvoi(false)
    }
  }

  /** L'accueil présente déjà le chapitre 1 : on arrive directement sur la première question. */
  function commencer() {
    setDirection('avant')
    setIndex(0)
    setSelection(null)
    setEtape('question')
  }

  function entrerDansChapitre() {
    setDirection('avant')
    setSelection(null)
    setEtape('question')
  }

  function choisir(choix: number) {
    if (!q || envoi || selection !== null) return
    const suite: Reponses = { ...reponses, [q.code]: choix }
    setReponses(suite)

    const avancer = () => {
      timerRef.current = null
      setSelection(null)
      const prochain = index + 1
      if (prochain < QUESTIONS.length) {
        setDirection('avant')
        setIndex(prochain)
        const prochaine = QUESTIONS[prochain]
        setEtape(prochaine && prochaine.domaine !== q.domaine ? 'chapitre' : 'question')
      } else {
        void envoyer(suite)
      }
    }

    if (mouvementReduitRef.current) {
      avancer()
      return
    }
    setSelection(choix)
    timerRef.current = setTimeout(avancer, DELAI_SELECTION_MS)
  }

  function precedente() {
    if (envoi) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setSelection(null)
    setErreur(null)
    setDirection('arriere')
    if (etape === 'chapitre' || etape === 'envoi') {
      // Depuis un interstitiel ou l'écran d'envoi, on revient sur la dernière question vue.
      setIndex(etape === 'envoi' ? QUESTIONS.length - 1 : Math.max(0, index - 1))
      setEtape('question')
      return
    }
    if (index > 0) setIndex(index - 1)
  }

  /* ── Écran de fin ─────────────────────────────────────────────────────── */
  if (etape === 'fin') {
    return (
      <Fond>
        <Styles />
        <Entete orgNom={orgNom} logo={orgLogo} />
        <main className="flex-1 flex flex-col justify-center py-8">
          <svg viewBox="0 0 112 112" className="mx-auto h-28 w-28" aria-hidden="true">
            <circle cx="56" cy="56" r="50" fill="none" strokeWidth="4" className="stroke-white/15" />
            <circle
              cx="56" cy="56" r="50" fill="none" strokeWidth="4" strokeLinecap="round" transform="rotate(-90 56 56)"
              className="pos-trace-cercle stroke-accent-400"
            />
            <circle cx="56" cy="56" r="38" className="pos-disque fill-accent-400" />
            <path
              d="M38 57 L50 69 L75 43" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              className="pos-trace-coche stroke-brand-800"
            />
          </svg>
          <h1 className="pos-in-up pos-delay-3 pos-equilibre motion-reduce:animate-none mt-8 break-words text-center font-heading text-[2rem] font-extrabold leading-[1.1] tracking-heading text-white sm:text-4xl">
            Merci{prenom ? ` ${prenom}` : ''}, c&apos;est enregistré.
          </h1>
          <p className="pos-in-up pos-delay-4 motion-reduce:animate-none mx-auto mt-4 max-w-sm text-center text-[15px] leading-relaxed text-brand-100">
            Vos réponses servent à construire votre formation autour de ce qu&apos;il vous reste à apprendre. Votre
            formateur les reprendra avec vous dès le premier jour.
          </p>
          <div className="pos-in-up pos-delay-5 motion-reduce:animate-none mx-auto mt-8 w-full max-w-sm rounded-2xl border border-white/[0.15] bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-300">Et maintenant</p>
            <p className="mt-1.5 break-words text-sm leading-relaxed text-white/90">
              Rien d&apos;autre à faire de votre côté{employeur ? ` avant votre entrée chez ${employeur}` : ''}. Vous pouvez fermer cette page.
            </p>
          </div>
        </main>
        <PiedDePage orgNom={orgNom} />
      </Fond>
    )
  }

  /* ── Écran d'accueil ──────────────────────────────────────────────────── */
  if (etape === 'accueil') {
    return (
      <Fond>
        <Styles />
        <Entete orgNom={orgNom} logo={orgLogo} />
        <main className="flex-1 flex flex-col justify-center py-6">
          <p className="pos-in-up motion-reduce:animate-none text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-300">
            Questionnaire de positionnement
          </p>
          <h1 className="pos-in-up pos-delay-1 motion-reduce:animate-none mt-3 font-heading font-extrabold text-white">
            {prenom ? (
              <>
                <span className="block text-[1.375rem] font-semibold leading-tight tracking-heading text-white/60 sm:text-2xl">
                  Bonjour,
                </span>
                <span className="pos-prenom pos-equilibre mt-1 block leading-[1.02] tracking-display">{prenom}</span>
              </>
            ) : (
              <span className="pos-prenom block leading-[1.02] tracking-display">Bonjour.</span>
            )}
          </h1>
          <p className="pos-in-up pos-delay-2 motion-reduce:animate-none mt-4 max-w-md break-words text-[17px] leading-relaxed text-brand-100">
            {total} questions, dix minutes, pour construire votre formation
            {employeur ? ` chez ${employeur}` : ''} autour de ce qu&apos;il vous reste à apprendre.
          </p>

          <ul className="pos-in-up pos-delay-3 motion-reduce:animate-none mt-7 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Repere icone={ListChecks} titre={`${total} questions`} detail="Une seule réponse à chaque fois" />
            <Repere icone={Clock} titre="Dix minutes" detail="Sur votre téléphone, où vous voulez" />
            <Repere icone={HelpCircle} titre="Pas un examen" detail="Aucune conséquence sur votre entrée" />
          </ul>

          <div className="pos-in-up pos-delay-4 motion-reduce:animate-none mt-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-300">Cinq chapitres</p>
            <ol className="mt-3 flex items-center gap-1.5 sm:gap-2">
              {DOMAINES.map((d, i) => {
                const I = iconeDomaine(d.code)
                return (
                  <li key={d.code} className="flex flex-1 items-center gap-1.5 sm:gap-2">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.15] bg-white/10 text-accent-300"
                      aria-label={`Chapitre ${i + 1} : ${d.libelle}`}
                    >
                      <I size={22} />
                    </span>
                    {i < DOMAINES.length - 1 && <span className="h-px flex-1 bg-white/[0.15]" aria-hidden="true" />}
                  </li>
                )
              })}
            </ol>
          </div>
        </main>

        <div className="pos-in-up pos-delay-5 motion-reduce:animate-none pos-safe-b pt-4">
          <button
            type="button"
            onClick={commencer}
            className={`${BTN_MINT} pos-lueur w-full [--pos-lueur-teinte:theme(colors.accent.400/55%)]`}
          >
            Commencer
            <ArrowRight size={20} strokeWidth={2} />
          </button>
          <div className="mt-4 flex gap-3 rounded-2xl border border-white/[0.15] bg-white/10 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-400/[0.15] text-accent-300" aria-hidden="true">
              <Lightbulb size={18} />
            </span>
            <p className="text-[13px] leading-relaxed text-brand-100">
              <span className="font-semibold text-white">Répondez seul et sans chercher.</span> Une réponse sincère, même
              fausse, vaut mieux qu&apos;une bonne réponse trouvée en ligne : elle nous dit sur quoi passer du temps avec vous.
            </p>
          </div>
        </div>
      </Fond>
    )
  }

  /* ── Interstitiel de chapitre (chapitres 2 à 5) ───────────────────────── */
  if (etape === 'chapitre' && domaine) {
    const I = iconeDomaine(domaine.code)
    const nbDansChapitre = QUESTIONS.filter((x) => x.domaine === domaine.code).length
    return (
      <Fond teinte="brand-500">
        <Styles />
        <Entete orgNom={orgNom} logo={orgLogo} />
        <div className="pt-2">
          <Progression index={index} sombre />
        </div>
        {/* Tout l'écran est un seul bouton : un tap n'importe où fait entrer dans le chapitre. */}
        <button
          type="button"
          onClick={entrerDansChapitre}
          className={`${FOCUS} -mx-2 flex w-[calc(100%+1rem)] flex-1 flex-col justify-center rounded-2xl px-2 py-8 text-left focus-visible:ring-inset`}
        >
          <span className="pos-pop motion-reduce:animate-none flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.4rem] bg-accent-400 text-brand-800 shadow-[0_18px_40px_-16px_rgba(92,217,160,0.7)]">
            <I size={36} strokeWidth={1.75} />
          </span>
          <span className="pos-in-up motion-reduce:animate-none mt-7 block text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-300">
            Chapitre {numDomaine + 1} sur {DOMAINES.length}
            <span className="mx-2 text-white/40">·</span>
            {nbDansChapitre} question{nbDansChapitre > 1 ? 's' : ''}
          </span>
          <span className="pos-in-up pos-delay-1 pos-equilibre motion-reduce:animate-none mt-3 block break-words font-heading text-[2.1rem] font-extrabold leading-[1.08] tracking-heading text-white sm:text-5xl">
            {domaine.libelle}
          </span>
          <span className="pos-in-up pos-delay-2 motion-reduce:animate-none mt-4 block max-w-md text-[16px] leading-relaxed text-brand-100">
            {domaine.objectif}
          </span>
          <span className="pos-in-up pos-delay-3 motion-reduce:animate-none mt-8 block w-full">
            <span className={`${BTN_MINT} w-full`}>
              Continuer
              <ArrowRight size={20} strokeWidth={2} />
            </span>
            <span className="mt-4 block text-center text-[13px] text-brand-200">Touchez l&apos;écran pour continuer</span>
          </span>
        </button>
        <div className="pos-safe-b flex justify-center pt-2 text-[13px]">
          <button type="button" onClick={precedente} className={LIEN}>
            <ArrowLeft size={16} />
            Question précédente
          </button>
        </div>
      </Fond>
    )
  }

  /* ── Envoi et erreur ──────────────────────────────────────────────────── */
  if (etape === 'envoi') {
    return (
      <Fond>
        <Styles />
        <Entete orgNom={orgNom} logo={orgLogo} />
        <div className="pt-2">
          <Progression index={QUESTIONS.length} sombre />
        </div>
        <main className="flex-1 flex flex-col justify-center py-8">
          {erreur ? (
            <div className="pos-in-up motion-reduce:animate-none">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/[0.15]">
                <HelpCircle size={32} />
              </div>
              <h1 className="pos-equilibre mt-6 font-heading text-[1.9rem] font-extrabold leading-[1.1] tracking-heading text-white sm:text-4xl">
                Vos réponses n&apos;ont pas pu être envoyées.
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-brand-100" role="alert">{erreur}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-brand-200">
                Rien n&apos;est perdu : vos réponses sont toujours sur cette page.
              </p>
            </div>
          ) : (
            <div className="pos-in motion-reduce:animate-none flex flex-col items-start" role="status" aria-live="polite">
              <span
                className="h-12 w-12 animate-spin motion-reduce:animate-none rounded-full border-[3px] border-white/20 border-t-accent-400"
                aria-hidden="true"
              />
              <h1 className="pos-equilibre mt-6 font-heading text-[1.9rem] font-extrabold leading-[1.1] tracking-heading text-white sm:text-4xl">
                Enregistrement de vos {total} réponses
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-brand-100">Un instant, c&apos;est presque terminé.</p>
            </div>
          )}
        </main>
        {erreur && (
          <div className="pos-safe-b pt-4 space-y-3">
            <button type="button" onClick={() => envoyer(reponses)} disabled={envoi} className={`${BTN_MINT} w-full`}>
              Réessayer
              <ArrowRight size={20} strokeWidth={2} />
            </button>
            <button type="button" onClick={precedente} disabled={envoi} className={`${BTN_GHOST} w-full`}>
              <ArrowLeft size={18} />
              Revoir la dernière question
            </button>
          </div>
        )}
      </Fond>
    )
  }

  /* ── Une question ─────────────────────────────────────────────────────── */
  if (!q || !domaine) return null

  const I = iconeDomaine(domaine.code)
  const preselection = reponses[q.code]
  const premiere = index === 0
  const derniere = index === QUESTIONS.length - 1

  return (
    <div className="pos-screen min-h-screen bg-surface-50 text-surface-900">
      <Styles />
      <header className="sticky top-0 z-10 border-b border-surface-200/70 bg-surface-50/90 backdrop-blur-md">
        <div className="mx-auto w-full max-w-lg px-4 pt-3 pb-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={precedente}
              disabled={envoi || premiere}
              aria-label="Revenir à la question précédente"
              className={[
                FOCUS,
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-600 shadow-xs',
                'transition-[color,border-color,opacity] duration-200 hover:border-surface-300 hover:text-surface-900 disabled:pointer-events-none',
                premiere ? 'opacity-0 pointer-events-none' : '',
              ].join(' ')}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-surface-900">
                <span className="text-brand-500">Chapitre {numDomaine + 1}</span>
                <span className="mx-1.5 text-surface-300">·</span>
                {domaine.libelle}
              </p>
              <p className="text-[12px] tabular-nums text-surface-500">
                Question {index + 1} sur {total}
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500" aria-hidden="true">
              <I size={20} />
            </span>
          </div>
          <div className="mt-3">
            <Progression index={index} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-6 sm:px-6 sm:pt-8">
        <div
          key={`${index}-${direction}`}
          className={`${direction === 'avant' ? 'pos-enter-right' : 'pos-enter-left'} motion-reduce:animate-none`}
        >
          {(premiere || derniere) && (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">
              {premiere ? 'Première question' : 'Dernière question'}
            </p>
          )}
          <h2
            ref={titreRef}
            tabIndex={-1}
            className="pos-equilibre break-words font-heading text-[1.45rem] font-bold leading-[1.25] tracking-heading text-surface-900 outline-none sm:text-[1.7rem]"
          >
            <span className="sr-only">Question {index + 1} sur {total}. </span>
            {q.intitule}
          </h2>

          <div
            className="mt-6 space-y-3 [--pos-survol-bord:theme(colors.brand.300)] [--pos-survol-fond:theme(colors.brand.50/40%)] [--pos-survol-lettre:theme(colors.brand.100)] [--pos-survol-encre:theme(colors.brand.600)]"
            role="group"
            aria-label="Réponses possibles"
          >
            {q.choix.map((c, i) => {
              const choisi = selection === i
              const preselectionne = selection === null && preselection === i
              const actif = choisi || preselectionne
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => choisir(i)}
                  disabled={envoi || (selection !== null && !choisi)}
                  aria-pressed={actif}
                  className={[
                    'pos-pilule flex w-full items-center gap-3.5 rounded-2xl border bg-white px-3.5 py-3.5 text-left transition-all duration-200 ease-out',
                    'min-h-[3.75rem] disabled:pointer-events-none',
                    FOCUS,
                    actif
                      ? 'border-brand-500 bg-brand-50/70 shadow-[0_10px_30px_-14px_rgba(32,80,64,0.45)]'
                      : 'border-surface-200 shadow-xs active:scale-[0.985]',
                    selection !== null && !choisi ? 'opacity-50' : '',
                    choisi ? 'pos-choisi' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'pos-lettre flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-[15px] font-bold transition-colors duration-200',
                      actif ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {choisi ? <Check size={18} strokeWidth={2.5} /> : LETTRES[i] ?? i + 1}
                  </span>
                  <span className={`min-w-0 flex-1 break-words text-[15px] leading-snug ${actif ? 'font-semibold text-brand-700' : 'text-surface-800'}`}>{c}</span>
                </button>
              )
            })}
          </div>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-surface-400">
            {preselection !== null && preselection !== undefined && selection === null
              ? 'Votre réponse est conservée. Touchez une autre pilule pour la changer.'
              : 'Une seule réponse. En cas de doute, choisissez ce que vous feriez vraiment.'}
          </p>
        </div>
      </main>

      <footer className="pos-safe-b mx-auto w-full max-w-lg px-4 pt-8 text-center text-[11px] text-surface-400 sm:px-6">
        {orgNom}
      </footer>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Habillage plein écran réutilisé par la page serveur pour « Lien introuvable »
 * et « Questionnaire déjà rendu » : fond pine, logo, carte blanche centrée.
 */
export function PositionnementCadre({ children, logo }: { children: React.ReactNode; logo?: string | null }) {
  return (
    <Fond>
      <Styles />
      <Entete orgNom="" logo={logo ?? null} />
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="pos-in-up motion-reduce:animate-none card w-full max-w-md p-6 text-center shadow-[0_24px_60px_-24px_rgba(12,33,27,0.6)] sm:p-8">
          {children}
        </div>
      </main>
      <PiedDePage orgNom="" />
    </Fond>
  )
}

/* ── Briques ──────────────────────────────────────────────────────────────── */

function Fond({ children, teinte = 'brand-600' }: { children: React.ReactNode; teinte?: 'brand-500' | 'brand-600' }) {
  return (
    <div className={`pos-screen pos-fond relative min-h-screen overflow-hidden text-white ${teinte === 'brand-500' ? 'bg-brand-500' : 'bg-brand-600'}`}>
      <div
        className="pos-halo pointer-events-none absolute inset-0 [--pos-halo-fort:theme(colors.accent.400/28%)] [--pos-halo-doux:theme(colors.accent.400/12%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 pt-5 sm:px-6 sm:pt-8" style={{ minHeight: '100dvh' }}>
        {children}
      </div>
    </div>
  )
}

function Entete({ orgNom, logo }: { orgNom: string; logo: string | null }) {
  if (!logo && !orgNom) return null
  return (
    <div className="flex items-center justify-between">
      {logo ? (
        <span className="inline-flex items-center rounded-xl bg-white px-2.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(12,33,27,0.8)]">
          <img src={logo} alt={orgNom || 'Organisme de formation'} className="h-6 w-auto max-w-[9rem] object-contain" />
        </span>
      ) : (
        <span className="font-heading text-[15px] font-bold tracking-heading text-white">{orgNom}</span>
      )}
      <span className="rounded-full border border-white/[0.15] bg-white/10 px-2.5 py-1 text-[11px] font-medium text-brand-100">
        Positionnement
      </span>
    </div>
  )
}

function PiedDePage({ orgNom }: { orgNom: string }) {
  return (
    <p className="pos-safe-b pt-4 text-center text-[11px] text-brand-200/80">
      {orgNom ? `${orgNom} · ` : ''}Vos réponses restent entre vous et votre formateur.
    </p>
  )
}

function Repere({ icone: I, titre, detail }: { icone: Icone; titre: string; detail: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/[0.15] bg-white/10 px-3.5 py-3 sm:flex-col sm:items-start sm:gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-400/[0.15] text-accent-300">
        <I size={20} />
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-[15px] font-bold leading-tight text-white">{titre}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-brand-200">{detail}</span>
      </span>
    </li>
  )
}

/**
 * Barre de progression segmentée : un tronçon par chapitre, le tronçon courant
 * se remplit question par question.
 */
function Progression({ index, sombre = false }: { index: number; sombre?: boolean }) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={Math.min(index, QUESTIONS.length)} aria-label="Avancement du questionnaire">
      {DOMAINES.map((d) => {
        const dansChapitre = QUESTIONS.filter((x) => x.domaine === d.code).length
        const passees = QUESTIONS.slice(0, index).filter((x) => x.domaine === d.code).length
        const ratio = dansChapitre ? passees / dansChapitre : 0
        const courant = ratio > 0 && ratio < 1
        return (
          <div key={d.code} className={`h-1.5 flex-1 overflow-hidden rounded-full ${sombre ? 'bg-white/15' : 'bg-surface-200'}`}>
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${sombre ? 'bg-accent-400' : courant ? 'bg-accent-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

/**
 * Keyframes et utilitaires impossibles en Tailwind pur, préfixés « pos- ».
 * Les couleurs viennent de variables CSS posées en classes Tailwind sur les
 * éléments concernés (propriétés arbitraires Tailwind lisant theme()) : aucun hex ici.
 */
function Styles() {
  // En enfant texte, React échappe les guillemets et apostrophes du CSS côté
  // serveur, que le navigateur ne décode pas dans un <style> : sélecteurs
  // cassés et erreur d'hydratation. Le CSS est donc injecté tel quel.
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />
}

const CSS = `
      .pos-screen { min-height: 100dvh; }
      .pos-safe-b { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)); }
      .pos-halo {
        background:
          radial-gradient(60% 45% at 85% -5%, var(--pos-halo-fort), transparent 70%),
          radial-gradient(50% 40% at -10% 100%, var(--pos-halo-doux), transparent 70%);
      }
      .pos-fond { -webkit-tap-highlight-color: transparent; }
      .pos-equilibre { text-wrap: balance; }
      .pos-prenom { font-size: clamp(2rem, 11vw, 3.25rem); overflow-wrap: anywhere; }

      /* Survol des pilules réservé aux vrais pointeurs : sur iOS, un tap laisse
         sinon l'état survolé collé à la pilule suivante. */
      @media (hover: hover) {
        .pos-pilule:not(:disabled):not([aria-pressed="true"]):hover {
          border-color: var(--pos-survol-bord);
          background-color: var(--pos-survol-fond);
        }
        .pos-pilule:not(:disabled):not([aria-pressed="true"]):hover .pos-lettre {
          background-color: var(--pos-survol-lettre);
          color: var(--pos-survol-encre);
        }
      }

      @keyframes posIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes posInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes posEnterRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes posEnterLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes posPop { 0% { opacity: 0; transform: scale(.6); } 60% { opacity: 1; transform: scale(1.06); } 100% { transform: scale(1); } }
      @keyframes posChoisi { 0% { transform: scale(1); } 40% { transform: scale(1.02); } 100% { transform: scale(1); } }

      /* Lueur menthe du bouton Commencer : deux pulsations, par-dessus l'ombre Tailwind du bouton. */
      @keyframes posLueur {
        0%, 100% { box-shadow: var(--tw-shadow, 0 0 transparent), 0 0 0 0 var(--pos-lueur-teinte); }
        50% { box-shadow: var(--tw-shadow, 0 0 transparent), 0 0 0 10px transparent; }
      }

      /* Coche de l'écran de fin : le cercle se trace, le disque menthe surgit, le trait se dessine. */
      @keyframes posTracer { to { stroke-dashoffset: 0; } }
      @keyframes posDisque { to { transform: scale(1); } }

      .pos-in { animation: posIn .4s cubic-bezier(.16, 1, .3, 1) both; }
      .pos-in-up { animation: posInUp .55s cubic-bezier(.16, 1, .3, 1) both; }
      .pos-enter-right { animation: posEnterRight .38s cubic-bezier(.16, 1, .3, 1) both; }
      .pos-enter-left { animation: posEnterLeft .38s cubic-bezier(.16, 1, .3, 1) both; }
      .pos-pop { animation: posPop .6s cubic-bezier(.16, 1, .3, 1) both; }
      .pos-choisi { animation: posChoisi .26s ease-out; }
      .pos-lueur { animation: posLueur 2.4s ease-out .9s 2; }
      .pos-trace-cercle { stroke-dasharray: 314.16; stroke-dashoffset: 314.16; animation: posTracer .7s cubic-bezier(.16, 1, .3, 1) forwards; }
      .pos-disque { transform-origin: 56px 56px; transform: scale(0); animation: posDisque .45s cubic-bezier(.34, 1.56, .64, 1) .45s forwards; }
      .pos-trace-coche { stroke-dasharray: 60; stroke-dashoffset: 60; animation: posTracer .4s cubic-bezier(.16, 1, .3, 1) .7s forwards; }
      .pos-delay-1 { animation-delay: .06s; }
      .pos-delay-2 { animation-delay: .12s; }
      .pos-delay-3 { animation-delay: .18s; }
      .pos-delay-4 { animation-delay: .24s; }
      .pos-delay-5 { animation-delay: .3s; }

      @media (prefers-reduced-motion: reduce) {
        .pos-in, .pos-in-up, .pos-enter-right, .pos-enter-left, .pos-pop, .pos-choisi, .pos-lueur { animation: none !important; }
        .pos-trace-cercle, .pos-disque, .pos-trace-coche { animation-duration: .01ms !important; animation-delay: 0ms !important; }
      }
`
