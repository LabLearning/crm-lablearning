'use client'

/**
 * Objectif du mois, bloc « La une » du tableau de bord : le mois suivant en
 * titre (les autres mois de l'année sur la bande de l'en-tête) et deux jauges
 * côte à côte qui se remplissent comme un liquide.
 *  - Établissements calés : jauge crantée, une case par établissement visé.
 *  - Chiffre d'affaires HT calé : jauge continue, un repère par palier rond.
 * Les calages de la semaine sont hachurés ; sous chaque jauge, le reste à
 * caler et le rythme quotidien. Chaque objectif se modifie sur place.
 *
 * Toutes les données viennent du serveur (lib/objectif-mois.ts) : aucune date
 * n'est calculée dans le navigateur, donc pas d'écart d'hydratation. Les
 * animations sont en CSS pur (app/globals.css, section « objectif du mois ») :
 * le HTML serveur porte déjà l'état final.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { cn, villeLisible } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { Pencil, Check, X, Minus, Plus, Award, ArrowRight, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from '@/components/ui/icons'
import type { MoisCalendrier, ObjectifMois } from '@/lib/objectif-mois'
import { chargerObjectifsMoisAction, setObjectifMoisAction, setObjectifCaMoisAction } from './objectif-actions'

const MAX_NOMS = 12
/** Fin de l'entrée : après la dernière animation (trait sous le mois : 1,9 s + 1,1 s). */
const INTRO_MS = 3400
/** Espace fine insécable : séparateur de milliers, avant « % » et « € ». */
const NNBSP = '\u202F'

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un)
const virgule = (n: number) => n.toFixed(1).replace('.', ',')
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`)
const deMois = (m: string) => (/^[aeiouyàâéèêîôû]/i.test(m) ? `d’${m}` : `de ${m}`)
/** 9925 → « 9 925 » : même rendu serveur et navigateur (pas d'Intl, dont l'espace varie selon le moteur). */
const milliers = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)
const euros = (n: number) => `${milliers(n)}${NNBSP}€`
const vars = (o: Record<string, string | number>) => o as CSSProperties
const pasDe = (max: number) => (max <= 10 ? 1 : max <= 30 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : max <= 300 ? 50 : 100)
/** Palier « rond » des repères de CA, au plus 8 intervalles : 60 000 € → tous les 10 000 €. */
function pasRond(max: number) {
  const brut = max / 8
  const p = 10 ** Math.floor(Math.log10(Math.max(1, brut)))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= brut) ?? p * 10
}
/** Graduations de 0 à max ; en dépassement, l'objectif a son propre repère et ses voisins trop proches s'effacent
    (écartMin : distance minimale, en fraction de la jauge, entre l'étiquette de l'objectif et celle de fin). */
function graduer(max: number, objectif: number, pas: number, depasse: boolean, ecartMin = 0.08) {
  const g: number[] = []
  for (let v = 0; v < max; v += pas) {
    if (v === 0 || (max - v >= pas / 2 && (!depasse || Math.abs(v - objectif) >= pas / 2))) g.push(v)
  }
  if (!depasse || (max - objectif) / max >= ecartMin) g.push(max)
  return g
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/60'
const BTN_ICONE = `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:h-9 sm:w-9 ${FOCUS}`
/** Une colonne de jauge : dès lg, sous-grille de 6 rangées partagées avec sa voisine. */
const COLONNE = 'min-w-0 lg:row-span-6 lg:grid lg:grid-cols-1 lg:grid-rows-subgrid lg:items-start'

type Etat = 'vide' | 'en_cours' | 'atteint' | 'depasse'
const etatDe = (v: number, objectif: number): Etat =>
  v <= 0 ? 'vide' : v < objectif ? 'en_cours' : v === objectif ? 'atteint' : 'depasse'

// ── Réglage d'un objectif sur place (crayon → champ → enregistrement optimiste) ──

type Envoi = {
  action: (v: number) => Promise<{ success: boolean; error?: string } | null | undefined>
  invalide: string
  reussi: (v: number) => void
  echoue: (message: string, avant: number) => void
}

function useReglage(valeur: number, saisiServeur: boolean, o: {
  min: number; max: number; pas: number
  lire: (s: string) => number | null
  ecrire: (n: number) => string
}) {
  const declencheur = useRef<HTMLButtonElement>(null)
  const [cible, setCible] = useState(valeur)
  const [saisi, setSaisi] = useState(saisiServeur)
  const [edition, setEdition] = useState(false)
  const [brouillon, setBrouillon] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)
  // Revalidation serveur ou modification par un autre administrateur
  useEffect(() => { setCible(valeur); setSaisi(saisiServeur) }, [valeur, saisiServeur])

  const lu = o.lire(brouillon)
  const valeurLue = lu !== null && lu >= o.min && lu <= o.max ? lu : null
  // Aperçu en direct : pendant la saisie, toute valeur valide pilote la jauge
  const apercu = edition && valeurLue !== null ? valeurLue : cible

  const fermer = () => { setEdition(false); setErreur(null); requestAnimationFrame(() => declencheur.current?.focus()) }

  return {
    declencheur, cible, saisi, edition, brouillon, erreur, flash, apercu, fermer,
    ouvrir: () => { setBrouillon(o.ecrire(cible)); setErreur(null); setEdition(true) },
    changer: (s: string) => { setBrouillon(s); setErreur(null) },
    ajuster: (sens: 1 | -1) => {
      const base = valeurLue ?? cible
      const v = sens > 0 ? Math.floor(base / o.pas) * o.pas + o.pas : Math.ceil(base / o.pas) * o.pas - o.pas
      setBrouillon(o.ecrire(Math.min(o.max, Math.max(o.min, v))))
      setErreur(null)
    },
    finFlash: () => setFlash(0),
    soumettre: async (e: FormEvent, envoi: Envoi) => {
      e.preventDefault()
      if (valeurLue === null) { setErreur(envoi.invalide); return }
      const v = valeurLue
      if (v === cible && saisi) { fermer(); return }
      const avant = { cible, saisi }
      setCible(v); setSaisi(true); setFlash((n) => n + 1); fermer()          // optimiste
      const res = await envoi.action(v).catch(() => null)
      if (!res?.success) {
        setCible(avant.cible); setSaisi(avant.saisi)
        envoi.echoue(res?.error || 'L’objectif n’a pas pu être enregistré. Réessayez.', avant.cible)
        return
      }
      envoi.reussi(v)
    },
  }
}
type Reglage = ReturnType<typeof useReglage>

function Editeur({ r, id, peutModifier, affiche, aria, champ, unite, largeur, moins, plus, onSubmit, className }: {
  r: Reglage; id: string; peutModifier: boolean
  /** Valeur affichée : « 25 », « 60 000 € HT ». */
  affiche: string
  /** Nom accessible du crayon. */
  aria: string
  /** Libellé du champ (lecteurs d'écran). */
  champ: string
  unite?: string
  largeur: string
  moins: string
  plus: string
  onSubmit: (e: FormEvent) => void
  className?: string
}) {
  if (r.edition) {
    return (
      <form
        noValidate
        onSubmit={onSubmit}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); r.fermer() } }}
        className="flex items-center gap-1.5 self-center"
      >
        <label htmlFor={id} className="sr-only">{champ}</label>
        <button type="button" onClick={() => r.ajuster(-1)} aria-label={moins} className={BTN_ICONE}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="relative">
          <input
            id={id}
            autoFocus
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={false}
            value={r.brouillon}
            onChange={(e) => r.changer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); r.ajuster(e.key === 'ArrowUp' ? 1 : -1) }
            }}
            aria-invalid={!!r.erreur}
            aria-describedby={r.erreur ? `${id}-err` : undefined}
            className={cn(
              'h-10 rounded-lg bg-white/10 text-center font-mono text-[16px] font-semibold tabular-nums text-white ring-1 ring-inset ring-white/20 focus:outline-none focus:ring-[3px] focus:ring-accent-400/60 sm:h-9',
              unite && 'pl-2 pr-6',
              largeur,
            )}
          />
          {unite && <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-white/55">{unite}</span>}
        </span>
        <button type="button" onClick={() => r.ajuster(1)} aria-label={plus} className={BTN_ICONE}>
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent-400 px-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-accent-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/70 sm:ml-0.5 sm:h-9"
        >
          <Check className="h-4 w-4" /><span className="sr-only 2xl:not-sr-only">Enregistrer</span>
        </button>
        <button type="button" onClick={r.fermer} aria-label="Annuler la modification" className={BTN_ICONE}>
          <X className="h-4 w-4" />
        </button>
      </form>
    )
  }

  const valeur = (
    <span key={r.flash} onAnimationEnd={r.finFlash} className={cn('whitespace-nowrap rounded px-0.5 tabular-nums', r.flash > 0 && 'll-obj-flash')}>
      {affiche}
    </span>
  )
  const defaut = !r.saisi && <span className="whitespace-nowrap font-sans text-2xs font-medium text-white/50">par défaut</span>
  if (!peutModifier) return <span className={cn('inline-flex items-baseline gap-1.5', className)}>{valeur}{defaut}</span>
  return (
    <button
      ref={r.declencheur}
      type="button"
      onClick={r.ouvrir}
      aria-label={aria}
      className={cn('group -mx-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-1 transition-colors hover:bg-white/10 hover:text-white sm:min-h-[34px]', FOCUS, className)}
    >
      {valeur}
      {defaut}
      <Pencil className="h-3.5 w-3.5 shrink-0 text-white/45 transition-colors group-hover:text-accent-300" />
    </button>
  )
}

// ── Pièces des jauges ──

function Tube(p: {
  label: string
  max: number
  now: number
  texte: string
  /** Part remplie de la jauge, 0 à 1. */
  part: number
  /** Part POEI, en fraction du remplissage (à droite de la part OPCO). */
  poei: number
  /** Parts hachurées (calées cette semaine), en fraction du remplissage : au bout de la zone OPCO, au bout de la zone POEI. */
  recentOpco: number
  recentPoei: number
  /** Repère de l'objectif quand il est dépassé, 0 à 1. */
  objectif: number | null
  plein: boolean
  /** Première case à remplir quand la jauge est vide, 0 à 1. */
  appel: number | null
  /** Crans ou repères, 0 à 1. */
  reperes: number[]
}) {
  return (
    <div
      role="progressbar"
      aria-label={p.label}
      aria-valuemin={0}
      aria-valuemax={p.max}
      aria-valuenow={p.now}
      aria-valuetext={p.texte}
      className="ll-obj-jauge relative h-7 overflow-hidden rounded-[10px] bg-white/[0.07] sm:h-8"
    >
      {p.part > 0 && (
        <div
          aria-hidden="true"
          className={cn('ll-obj-remplissage absolute inset-y-0 left-0 min-w-[12px]', p.plein && 'is-full')}
          style={{ width: `${p.part * 100}%` }}
        >
          {p.poei > 0 && <div className="ll-obj-poei absolute inset-y-0 right-0" style={{ left: `${(1 - p.poei) * 100}%` }} />}
          {p.objectif !== null && <div className="absolute inset-y-0 right-0 bg-white/25" style={{ left: `${(p.objectif / p.part) * 100}%` }} />}
          {p.recentOpco > 0 && <div className="ll-obj-recent absolute inset-y-0" style={{ left: `${(1 - p.poei - p.recentOpco) * 100}%`, width: `${p.recentOpco * 100}%` }} />}
          {p.recentPoei > 0 && <div className="ll-obj-recent absolute inset-y-0 right-0" style={{ left: `${(1 - p.recentPoei) * 100}%` }} />}
        </div>
      )}
      {p.reperes.map((x) => (
        <span key={x} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-brand-900/35" style={{ left: `${x * 100}%` }} />
      ))}
      {p.objectif !== null && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${p.objectif * 100}%` }} />
      )}
      {p.appel !== null && (
        <span
          aria-hidden="true"
          className="ll-obj-appel pointer-events-none absolute inset-y-1 left-1 rounded-[7px] border border-accent-400/70"
          style={{ width: `max(6px, calc(${p.appel * 100}% - 6px))` }}
        />
      )}
    </div>
  )
}

function Echelle({ max, marques, objectif, format }: { max: number; marques: number[]; objectif: number | null; format: (n: number) => string }) {
  return (
    <div aria-hidden="true" className="relative mt-1.5 hidden h-3 font-mono text-[10px] leading-3 tabular-nums text-white/45 sm:block">
      {marques.map((g) => {
        const bord = g === 0 ? 'left-0' : g === max ? 'right-0' : ''
        return (
          <span key={g} className={cn('absolute top-0 whitespace-nowrap', bord || '-translate-x-1/2')} style={bord ? undefined : { left: `${(g / max) * 100}%` }}>
            {format(g)}
          </span>
        )
      })}
      {objectif !== null && (
        <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-semibold text-white" style={{ left: `${(objectif / max) * 100}%` }}>{format(objectif)}</span>
      )}
    </div>
  )
}

/** Légende hachurée : la part calée depuis lundi. */
function Semaine({ valeur, children }: { valeur: number; children: ReactNode }) {
  return valeur > 0 ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-accent-300">
      <span aria-hidden="true" className="ll-obj-hachure h-2.5 w-2.5 shrink-0 rounded-[3px]" />
      {children}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-white/50">
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-inset ring-white/25" />
      Aucun calage cette semaine
    </span>
  )
}

/** Légende sous la jauge : ce qui vient des sessions OPCO et ce qui vient des POEI. */
function Repartition({ opco, poei }: { opco: string; poei: string }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-accent-400" />
        OPCO <b className="font-semibold tabular-nums text-white">{opco}</b>
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span aria-hidden="true" className="ll-obj-pastille-poei h-2.5 w-2.5 shrink-0 rounded-[3px]" />
        POEI <b className="font-semibold tabular-nums text-white">{poei}</b>
      </span>
    </p>
  )
}

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="ll-obj-tampon inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-accent-400 px-2 py-0.5 text-2xs font-bold text-brand-800">
      <Award className="h-3 w-3" /> {children}
    </span>
  )
}

// ── Bloc ──

/**
 * Le mois suivant s'affiche d'abord ; la bande de l'en-tête mène à chaque mois
 * de l'année, et le bouton « Année » à leur cumul. Le mois en cours et le
 * suivant arrivent avec la page, les autres sont chargés au premier clic puis
 * gardés.
 */
export function ObjectifMoisUne({ mois, calendrier, peutModifier }: { mois: ObjectifMois[]; calendrier: MoisCalendrier[]; peutModifier: boolean }) {
  const { toast } = useToast()
  const uid = useId().replace(/:/g, '')
  const bande = useRef<HTMLDivElement>(null)
  const demande = useRef<string | null>(null)
  const [charges, setCharges] = useState<Record<string, ObjectifMois>>({})
  const [cle, setCle] = useState(() => (mois.find((m) => !m.enCours && !m.passe) ?? mois[mois.length - 1]).cle)
  const [attente, setAttente] = useState<string | null>(null)       // clé d'un mois, ou « annee »
  const [vue, setVue] = useState<'mois' | 'annee'>('mois')
  // Les mois venus avec la page restent la référence : ils sont relus à chaque revalidation
  const dispo = (c: string): ObjectifMois | undefined => mois.find((m) => m.cle === c) ?? charges[c]
  const data = dispo(cle) ?? mois[mois.length - 1]
  // L'année du mois en cours : janvier de l'année suivante, proposé en décembre, n'en fait pas partie
  const annee = (calendrier.find((m) => m.enCours)?.cle ?? data.cle).slice(0, 4)
  const clesAnnee = calendrier.filter((m) => m.cle.startsWith(annee)).map((m) => m.cle)
  const moisAnnee = clesAnnee.map(dispo).filter((m): m is ObjectifMois => !!m)
  const annuelle = vue === 'annee' && moisAnnee.length === clesAnnee.length

  // Petits écrans : la bande défile, le mois visé reste au milieu
  const centrer = (c: string, doux: boolean) => {
    const b = bande.current
    const el = b?.querySelector<HTMLElement>(`[data-mois="${c}"]`)
    if (b && el) b.scrollTo({ left: el.offsetLeft - (b.clientWidth - el.offsetWidth) / 2, behavior: doux ? 'smooth' : 'auto' })
  }
  useEffect(() => { centrer(cle, false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Charge les mois qui manquent ; faux si la demande a échoué ou a été remplacée par une autre. */
  const charger = async (jeton: string, cles: string[]) => {
    demande.current = jeton
    const manquants = cles.filter((c) => !dispo(c))
    if (!manquants.length) { setAttente(null); return true }
    setAttente(jeton)
    const res = await chargerObjectifsMoisAction(manquants).catch(() => null)
    if (demande.current !== jeton) return false           // une autre vue a été demandée entre-temps
    setAttente(null)
    if (!res?.success || !res.data) { toast('error', res?.error || 'Ces chiffres n’ont pas pu être chargés. Réessayez.'); return false }
    const recus = res.data
    setCharges((p) => ({ ...p, ...Object.fromEntries(recus.map((m) => [m.cle, m])) }))
    return true
  }

  const choisir = async (c: string) => {
    if (c === data.cle && vue === 'mois' && !attente) return
    centrer(c, true)
    if (await charger(c, [c])) { setCle(c); setVue('mois') }
  }

  const voirAnnee = async () => {
    if (annuelle && !attente) return
    if (await charger('annee', clesAnnee)) setVue('annee')
  }

  return (
    <section
      aria-labelledby={`${uid}-titre`}
      aria-busy={attente ? true : undefined}
      className="ll-obj relative isolate overflow-hidden rounded-2xl text-white shadow-elevated"
    >
      <div aria-hidden="true" className="ll-obj-fond pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden="true" className="ll-obj-grille pointer-events-none absolute inset-0 -z-10" />

      {/* Le choix du mois : hors du bloc remonté, la bande garde son défilement et son focus */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-6 sm:pt-5">
        <p aria-hidden="true" className="ll-kicker ll-kicker--light whitespace-nowrap">{annuelle ? 'Objectif de l’année' : 'Objectif du mois'}</p>
        {calendrier.length > 1 && (
          <div className="flex max-w-full items-center gap-2">
            <button
              type="button"
              aria-pressed={annuelle}
              aria-busy={attente === 'annee' ? true : undefined}
              onClick={voirAnnee}
              className={cn(
                'h-10 shrink-0 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-white/10 transition-colors sm:h-9',
                FOCUS,
                annuelle ? 'bg-white/20 text-white' : 'bg-white/[0.07] text-white/70 hover:text-white',
                attente === 'annee' && 'animate-pulse text-white',
              )}
            >
              Année<span className="sr-only"> {annee}, cumul des douze mois</span>
            </button>
            <div
              ref={bande}
              role="group"
              aria-label="Mois affiché"
              className="ll-obj-bande relative flex min-w-0 gap-0.5 overflow-x-auto rounded-lg bg-white/[0.07] p-0.5 ring-1 ring-inset ring-white/10"
            >
              {calendrier.map((c) => {
                const actif = !annuelle && c.cle === data.cle
                return (
                  <button
                    key={c.cle}
                    data-mois={c.cle}
                    type="button"
                    aria-pressed={actif}
                    aria-busy={c.cle === attente ? true : undefined}
                    onClick={() => choisir(c.cle)}
                    className={cn(
                      'relative h-9 shrink-0 rounded-md px-2.5 text-xs font-semibold transition-colors sm:h-8',
                      FOCUS,
                      actif ? 'bg-white/15 text-white shadow-sm' : 'text-white/60 hover:text-white',
                      c.cle === attente && 'animate-pulse text-white',
                    )}
                  >
                    <span aria-hidden="true">{c.court}</span>
                    <span className="sr-only">{c.nomMois}{c.enCours ? ', mois en cours' : ''}</span>
                    {c.enCours && <span aria-hidden="true" className="absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Une clé par vue : les réglages repartent de zéro et les jauges se remplissent à nouveau */}
      {annuelle ? (
        <Annee key="annee" uid={uid} annee={annee} mois={moisAnnee} onMois={choisir} />
      ) : (
        <Une
          key={data.cle}
          uid={uid}
          data={data}
          peutModifier={peutModifier}
          onObjectif={(patch) => setCharges((p) => (p[data.cle] ? { ...p, [data.cle]: { ...p[data.cle], ...patch } } : p))}
        />
      )}
    </section>
  )
}

function Une({ uid, data, peutModifier, onObjectif }: {
  uid: string
  data: ObjectifMois
  peutModifier: boolean
  /** Un objectif vient d'être enregistré : le mois gardé en mémoire le reprend. */
  onObjectif: (patch: Partial<ObjectifMois>) => void
}) {
  const { toast } = useToast()

  const [intro, setIntro] = useState(true)            // animations d'entrée, une fois par affichage
  const [annonce, setAnnonce] = useState('')
  const [voirEtabs, setVoirEtabs] = useState(false)   // sommaire replié à toutes les largeurs
  const [tout, setTout] = useState(false)
  const [voirSansMontant, setVoirSansMontant] = useState(false)

  useEffect(() => { const t = setTimeout(() => setIntro(false), INTRO_MS); return () => clearTimeout(t) }, [])

  // Vider d'abord : deux messages identiques de suite sont lus tous les deux
  const annoncer = (msg: string) => { setAnnonce(''); setTimeout(() => setAnnonce(msg), 60) }

  const mois = data.nomMois.toLowerCase()                 // « octobre »
  // Jours pour caler : jusqu'au 1er du mois visé, ou jusqu'à la fin du mois quand il est en cours
  const jours = Math.max(1, data.enCours ? data.joursRestants : data.joursAvantDebut)

  // ── Établissements ──
  const regE = useReglage(data.objectif, data.objectifSaisi, {
    min: 1, max: 1000, pas: 1,
    lire: (s) => (/^\d{1,4}$/.test(s.trim()) ? Number(s.trim()) : null),
    ecrire: String,
  })
  const etabs = data.etablissements                       // triés du plus ancien calage au plus récent
  const realise = etabs.length
  // Mois terminé : plus de « cette semaine », plus de rythme, plus d'invitation à caler
  const passe = data.passe
  const nouveaux = passe ? 0 : etabs.filter((e) => e.recent).length
  const objectif = regE.apercu
  const etatE = etatDe(realise, objectif)
  const maxE = Math.max(objectif, realise)
  const pctE = Math.round((realise / objectif) * 100)
  const restantE = Math.max(0, objectif - realise)
  const rythmeE = restantE / jours
  const poeiE = etabs.filter((e) => e.poei).length
  const nouveauxPoei = passe ? 0 : etabs.filter((e) => e.recent && e.poei).length
  const opcoE = realise - poeiE
  const texteE = `${realise} ${pluriel(realise, 'établissement calé', 'établissements calés')} sur un objectif de ${objectif}, soit ${pctE}${NNBSP}% : ${opcoE} en OPCO, ${poeiE} en POEI`
    + (nouveaux > 0 ? `, dont ${nouveaux} cette semaine` : '')

  // ── Chiffre d'affaires ──
  const regC = useReglage(data.objectifCa, data.objectifCaSaisi, {
    min: 1, max: 10_000_000, pas: 1000,
    lire: (s) => { const t = s.replace(/[\s.€]/g, ''); return /^\d{1,8}$/.test(t) ? Number(t) : null },
    ecrire: milliers,
  })
  const ca = data.caCale
  const caSemaine = passe ? 0 : Math.min(data.caCetteSemaine, ca)
  const objectifCa = regC.apercu
  const etatC: Etat = ca <= 0 ? 'vide' : ca < objectifCa ? 'en_cours' : ca === objectifCa ? 'atteint' : 'depasse'
  const maxC = Math.max(objectifCa, ca)
  const pctC = Math.round((ca / objectifCa) * 100)
  const restantC = Math.max(0, objectifCa - ca)
  const rythmeC = Math.round(restantC / jours)
  const sansMontant = data.sessionsSansMontant
  const nbSans = sansMontant.length
  const avertissement = nbSans === 1 ? '1 session sans montant n’est pas comptée' : `${nbSans} sessions sans montant ne sont pas comptées`
  const caPoei = Math.min(data.caPoei, ca)
  const caOpco = ca - caPoei
  const caSemainePoei = Math.min(data.caCetteSemainePoei ?? 0, caSemaine, caPoei)
  const texteC = `${euros(ca)} HT calés sur un objectif de ${euros(objectifCa)}, soit ${pctC}${NNBSP}% : ${euros(caOpco)} en OPCO, ${euros(caPoei)} en POEI`
    + (caSemaine > 0 ? `, dont ${euros(caSemaine)} cette semaine` : '')
    + (nbSans > 0 ? `. ${avertissement}.` : '')
  const pasC = pasRond(maxC)
  // Compteur animé du CA : un compteur CSS par tranche de trois chiffres
  const groupesCa = ca >= 1_000_000 ? 3 : ca >= 1000 ? 2 : 1

  const lesDeux = (etatE === 'atteint' || etatE === 'depasse') && (etatC === 'atteint' || etatC === 'depasse')
  const definition = `Établissement calé : une session OPCO qui démarre en ${mois}, ou un parcours POEI qui se termine en ${mois}.`
  const parcours = `${data.nbParcoursPoei} POEI`
  const compteurs = `${data.nbSessions} ${pluriel(data.nbSessions, 'session', 'sessions')} · ${parcours} · ${data.nbStagiaires} ${pluriel(data.nbStagiaires, 'stagiaire inscrit', 'stagiaires inscrits')}`
  const compteursCourts = `${data.nbSessions} ${pluriel(data.nbSessions, 'session', 'sessions')} · ${parcours} · ${data.nbStagiaires} ${pluriel(data.nbStagiaires, 'stagiaire', 'stagiaires')}`
  const visibles = tout ? etabs : etabs.slice(0, MAX_NOMS)
  // Deux établissements du même nom (franchise) : la ville les distingue
  const homonymes = new Set(etabs.map((e) => e.nom.toLowerCase()).filter((n, i, t) => t.indexOf(n) !== i))
  const nomAffiche = (e: { nom: string; ville: string | null }) => (homonymes.has(e.nom.toLowerCase()) && e.ville ? `${e.nom} · ${villeLisible(e.ville)}` : e.nom)

  const envoiE: Envoi = {
    action: (v) => setObjectifMoisAction(data.cle, v),
    invalide: `Indiquez un nombre entier entre 1 et 1${NNBSP}000.`,
    reussi: (v) => {
      onObjectif({ objectif: v, objectifSaisi: true })
      annoncer(`Objectif fixé à ${v} ${pluriel(v, 'établissement', 'établissements')}. ${realise} ${pluriel(realise, 'calé', 'calés')}, soit ${Math.round((realise / v) * 100)}${NNBSP}%.`)
      toast('success', `Objectif ${deMois(mois)} fixé à ${v} ${pluriel(v, 'établissement', 'établissements')}.`)
    },
    echoue: (msg, avant) => { toast('error', msg); annoncer(`${msg} Objectif maintenu à ${avant}.`) },
  }
  const envoiC: Envoi = {
    action: (v) => setObjectifCaMoisAction(data.cle, v),
    invalide: `Indiquez un montant en euros, entre 1${NNBSP}€ et 10${NNBSP}000${NNBSP}000${NNBSP}€.`,
    reussi: (v) => {
      onObjectif({ objectifCa: v, objectifCaSaisi: true })
      annoncer(`Objectif de chiffre d’affaires fixé à ${euros(v)} HT. ${euros(ca)} calés, soit ${Math.round((ca / v) * 100)}${NNBSP}%.`)
      toast('success', `Objectif de chiffre d’affaires ${deMois(mois)} fixé à ${euros(v)} HT.`)
    },
    echoue: (msg, avant) => { toast('error', msg); annoncer(`${msg} Objectif maintenu à ${euros(avant)}.`) },
  }

  const titreJauge = 'font-heading text-sm font-semibold text-white/85'
  const objectifTexte = 'font-heading text-sm font-bold text-white/75 sm:text-xl'
  const ligneRythme = 'll-obj-rise mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs'
  const pied = 'mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-1'
  const deplier = cn('-ml-1 flex min-h-[40px] items-center gap-1.5 rounded-md px-1 text-left text-xs font-semibold transition-colors sm:min-h-[34px]', FOCUS)

  return (
    <div className={cn(intro && 'is-intro')}>
      <p aria-live="polite" className="sr-only">{annonce}</p>

      {/* En-tête : le mois visé, le compte à rebours */}
      <header className="px-4 sm:px-6">
        <div className="mt-1.5 flex items-end justify-between gap-4">
          <h2 id={`${uid}-titre`} className="min-w-0 text-white">
            <span className="sr-only">Objectif du mois : formations en {data.libelle}{data.enCours ? ', mois en cours' : passe ? ', mois terminé' : ''}</span>
            <span aria-hidden="true" className="flex items-baseline gap-2.5">
              <span className="relative inline-block">
                <span className="ll-obj-mois">
                  {Array.from(data.nomMois).map((lettre, i) => (
                    <span key={i} className="ll-obj-lettre" style={vars({ '--i': i })}>{lettre}</span>
                  ))}
                </span>
                {lesDeux && (
                  <svg className="ll-obj-trait pointer-events-none absolute -bottom-1.5 left-0 h-2.5 w-full" viewBox="0 0 300 12" preserveAspectRatio="none">
                    <path d="M3 8C80 2.5 190 2.5 297 6.5" pathLength={1} fill="none" stroke="#5CD9A0" strokeWidth={4} strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span className="ll-obj-rise hidden font-mono text-sm tabular-nums text-white/45 sm:inline" style={vars({ '--i': 0 })}>{data.annee}</span>
            </span>
          </h2>
          <p className="ll-obj-rise shrink-0 pb-0.5 text-right" style={vars({ '--i': 0 })}>
            <span className="block font-heading text-2xl font-extrabold leading-none tracking-tight tabular-nums text-white sm:text-3xl sm:leading-none">
              {passe ? 'Terminé' : `J-${jours}`}
            </span>
            <span className="mt-1 block text-xs text-white/60">
              {passe ? `depuis le ${Number(data.fin.slice(8))} ${mois}`
                : data.enCours
                  ? (jours === 1 ? `dernier jour ${deMois(mois)}` : `avant la fin ${deMois(mois)}`)
                  : (jours === 1 ? `demain, 1er ${mois}` : `avant le 1er ${mois}`)}
            </span>
          </p>
        </div>
      </header>

      {/* Deux colonnes aux mêmes rangées (sous-grille) : les jauges restent alignées même si une ligne passe à la ligne */}
      <div className="mt-4 grid px-4 sm:px-6 lg:grid-cols-2">
        {/* ── Établissements calés ── */}
        <div className={cn(COLONNE, 'pb-2 sm:pb-4 lg:border-r lg:border-white/10 lg:pb-5 lg:pr-6')}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={titreJauge}>Établissements calés</h3>
            <p className="font-heading text-sm font-bold tabular-nums text-accent-300">
              <span aria-hidden="true" className="ll-obj-compteur" style={vars({ '--ll-obj-n': pctE, minWidth: `${String(pctE).length}ch` })} />
              <span className="sr-only">{pctE}</span>{NNBSP}%<span className="sr-only"> de l’objectif</span>
            </p>
          </div>
          <div className="mt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
              <span className="sr-only">{realise} {pluriel(realise, 'établissement calé', 'établissements calés')} sur</span>
              <span
                aria-hidden="true"
                className="ll-obj-score ll-obj-compteur font-heading font-extrabold text-accent-400"
                style={vars({ '--ll-obj-n': realise, minWidth: `${String(realise).length}ch` })}
              />
              <span aria-hidden="true" className={cn(objectifTexte, 'text-white/45')}>/</span>
              <Editeur
                r={regE}
                id={`${uid}-obj`}
                peutModifier={peutModifier}
                affiche={String(regE.cible)}
                aria={`Objectif ${regE.cible} ${pluriel(regE.cible, 'établissement', 'établissements')}${regE.saisi ? '' : ' par défaut'}, modifier l’objectif ${deMois(mois)}`}
                champ={`Nombre d’établissements visés en ${mois}`}
                largeur="w-16"
                moins="Retirer un établissement"
                plus="Ajouter un établissement"
                onSubmit={(e) => regE.soumettre(e, envoiE)}
                className={objectifTexte}
              />
            </div>
            {regE.erreur && <p id={`${uid}-obj-err`} role="alert" className="mt-1 text-xs text-danger-100">{regE.erreur}</p>}
          </div>

          <div className="mt-2 sm:mt-2.5">
            <Tube
              label={`Établissements calés en ${mois}`}
              max={maxE}
              now={realise}
              texte={texteE}
              part={realise / maxE}
              poei={realise > 0 ? poeiE / realise : 0}
              recentOpco={realise > 0 ? (nouveaux - nouveauxPoei) / realise : 0}
              recentPoei={realise > 0 ? nouveauxPoei / realise : 0}
              objectif={etatE === 'depasse' ? objectif / maxE : null}
              plein={etatE === 'atteint' || etatE === 'depasse'}
              appel={etatE === 'vide' && !passe ? 1 / maxE : null}
              reperes={maxE <= 40 ? Array.from({ length: maxE - 1 }, (_, k) => (k + 1) / maxE) : []}
            />
            <Echelle max={maxE} marques={graduer(maxE, objectif, pasDe(maxE), etatE === 'depasse')} objectif={etatE === 'depasse' ? objectif : null} format={String} />
            <Repartition opco={String(opcoE)} poei={String(poeiE)} />
          </div>

          <div className={ligneRythme} style={vars({ '--i': 1 })}>
            {passe ? <span aria-hidden="true" /> : <Semaine valeur={nouveaux}>+{nouveaux} cette semaine</Semaine>}
            {etatE === 'atteint' ? <Etiquette>Objectif atteint</Etiquette>
              : etatE === 'depasse' ? <Etiquette>Objectif dépassé de {realise - objectif}</Etiquette>
              : passe ? (
                <span className="text-white/70">
                  Il a manqué <b className="font-semibold text-white">{restantE}</b> {pluriel(restantE, 'établissement', 'établissements')}
                </span>
              ) : (
                <span className="text-white/70">
                  Encore <b className="font-semibold text-white">{restantE}</b> à caler
                  {rythmeE >= 1 && <> · <b className="font-semibold text-white">{virgule(rythmeE)}</b> par jour</>}
                </span>
              )}
          </div>

          <div className={pied}>
            {realise === 0 && passe ? (
              <p className="flex min-h-[40px] items-center text-xs text-white/55 sm:min-h-[34px]">Aucun établissement calé ce mois-là.</p>
            ) : realise === 0 ? (
              <Link href="/dashboard/dossiers/nouveau" className={cn(deplier, 'text-accent-300 hover:text-accent-200')}>
                <Plus className="h-3.5 w-3.5" /> Caler un premier établissement
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setVoirEtabs((o) => !o)}
                  aria-expanded={voirEtabs}
                  aria-controls={`${uid}-liste`}
                  className={cn(deplier, 'text-white/80 hover:text-white')}
                >
                  {voirEtabs ? 'Masquer les établissements' : realise === 1 ? 'Voir l’établissement calé' : `Voir les ${realise} établissements calés`}
                  <ChevronDown className={cn('h-4 w-4 transition-transform duration-150', voirEtabs && 'rotate-180')} />
                </button>
                {!passe && (
                  <Link
                    href="/dashboard/dossiers/nouveau"
                    className={cn('hidden min-h-[34px] items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-accent-300 transition-colors hover:text-accent-200 sm:inline-flex', FOCUS)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Caler le {ordinal(realise + 1)}<span className="sr-only"> établissement</span>
                  </Link>
                )}
              </>
            )}
          </div>
          {realise > 0 && (
            <div id={`${uid}-liste`} hidden={!voirEtabs} className="pt-1.5">
              <ol className="grid grid-cols-2 gap-x-4 sm:gap-y-1">
                {visibles.map((e, i) => (
                  <li key={e.id} className="ll-obj-item min-w-0" style={vars({ '--i': i % MAX_NOMS })}>
                    <Link
                      href={`/dashboard/clients/${e.id}`}
                      title={e.ville ? `${e.nom}, ${e.ville}` : e.nom}
                      className={cn('group flex min-h-[40px] items-center gap-2 rounded-md sm:min-h-[28px]', FOCUS)}
                    >
                      <span className="shrink-0 font-mono text-2xs tabular-nums text-accent-300/80">{String(i + 1).padStart(2, '0')}</span>
                      <span className="ll-underline min-w-0 truncate text-sm font-semibold text-white/90 group-hover:text-white group-hover:[background-size:100%_1px]">{nomAffiche(e)}</span>
                      {e.poei && <span className="shrink-0 font-mono text-[10px] font-medium text-accent-300">POEI</span>}
                      {e.recent && !passe && (
                        <>
                          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
                          <span className="sr-only">, calé cette semaine</span>
                        </>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
              {!tout && realise > MAX_NOMS && (
                <button
                  type="button"
                  onClick={() => setTout(true)}
                  className={cn('mt-1 min-h-[40px] rounded-md text-sm font-semibold text-accent-300 hover:text-accent-200 sm:min-h-[28px]', FOCUS)}
                >
                  {realise - MAX_NOMS === 1 ? 'Afficher le dernier établissement' : `Afficher les ${realise - MAX_NOMS} autres`}
                </button>
              )}
              {!passe && (
                <Link
                  href="/dashboard/dossiers/nouveau"
                  className={cn('mt-1 flex min-h-[40px] items-center gap-2 rounded-md text-sm font-semibold text-accent-300 hover:text-accent-200 sm:hidden', FOCUS)}
                >
                  <Plus className="h-3.5 w-3.5" /> Caler le {ordinal(realise + 1)} établissement
                </Link>
              )}
              <p className="mt-1 text-2xs leading-relaxed text-white/55 md:hidden">{definition}</p>
            </div>
          )}
        </div>

        {/* ── Chiffre d'affaires calé ── */}
        <div className={cn(COLONNE, 'border-t border-white/10 pb-2 pt-3 sm:pb-4 sm:pt-4 lg:border-t-0 lg:pb-5 lg:pl-6 lg:pt-0')}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={titreJauge}>Chiffre d’affaires calé</h3>
            <p className="font-heading text-sm font-bold tabular-nums text-accent-300">
              <span aria-hidden="true" className="ll-obj-compteur" style={vars({ '--ll-obj-n': pctC, minWidth: `${String(pctC).length}ch` })} />
              <span className="sr-only">{pctC}</span>{NNBSP}%<span className="sr-only"> de l’objectif</span>
            </p>
          </div>
          <div className="mt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span className="sr-only">{euros(ca)} HT calés sur</span>
              <span aria-hidden="true" className="ll-obj-score whitespace-nowrap font-heading font-extrabold tabular-nums text-accent-400">
                <span
                  className="ll-obj-euros"
                  data-g={groupesCa}
                  style={vars({ '--ll-obj-m': Math.floor(ca / 1_000_000), '--ll-obj-k': Math.floor(ca / 1000) % 1000, '--ll-obj-u': ca % 1000 })}
                >
                  <span>{milliers(ca)}</span>
                </span>{NNBSP}€
              </span>
              <span aria-hidden="true" className="text-sm text-white/55">sur</span>
              <Editeur
                r={regC}
                id={`${uid}-ca`}
                peutModifier={peutModifier}
                affiche={`${euros(regC.cible)} HT`}
                aria={`Objectif de chiffre d’affaires ${euros(regC.cible)} HT${regC.saisi ? '' : ' par défaut'}, modifier l’objectif ${deMois(mois)}`}
                champ={`Chiffre d’affaires HT visé en ${mois}, en euros`}
                unite="€"
                largeur="w-[7.5rem]"
                moins={`Retirer 1${NNBSP}000${NNBSP}€`}
                plus={`Ajouter 1${NNBSP}000${NNBSP}€`}
                onSubmit={(e) => regC.soumettre(e, envoiC)}
                className={objectifTexte}
              />
            </div>
            {regC.erreur && <p id={`${uid}-ca-err`} role="alert" className="mt-1 text-xs text-danger-100">{regC.erreur}</p>}
          </div>

          <div className="mt-2 sm:mt-2.5">
            <Tube
              label={`Chiffre d’affaires HT calé en ${mois}`}
              max={maxC}
              now={ca}
              texte={texteC}
              part={ca / maxC}
              poei={ca > 0 ? caPoei / ca : 0}
              recentOpco={ca > 0 ? (caSemaine - caSemainePoei) / ca : 0}
              recentPoei={ca > 0 ? caSemainePoei / ca : 0}
              objectif={etatC === 'depasse' ? objectifCa / maxC : null}
              plein={etatC === 'atteint' || etatC === 'depasse'}
              appel={etatC === 'vide' && !passe ? Math.min(pasC, maxC) / maxC : null}
              reperes={Array.from({ length: Math.ceil(maxC / pasC) }, (_, k) => ((k + 1) * pasC) / maxC)
                .filter((x) => x < 0.995 && (etatC !== 'depasse' || Math.abs(x - objectifCa / maxC) > 0.01))}
            />
            <Echelle
              max={maxC}
              marques={graduer(maxC, objectifCa, maxC / pasC > 4 ? pasC * 2 : pasC, etatC === 'depasse', 0.18)}
              objectif={etatC === 'depasse' ? objectifCa : null}
              format={milliers}
            />
            <Repartition opco={euros(caOpco)} poei={euros(caPoei)} />
          </div>

          <div className={ligneRythme} style={vars({ '--i': 2 })}>
            {passe ? <span aria-hidden="true" /> : <Semaine valeur={caSemaine}>+{euros(caSemaine)} cette semaine</Semaine>}
            {etatC === 'atteint' ? <Etiquette>Objectif atteint</Etiquette>
              : etatC === 'depasse' ? <Etiquette>Objectif dépassé de {euros(ca - objectifCa)}</Etiquette>
              : passe ? (
                <span className="text-white/70">
                  Il a manqué <b className="whitespace-nowrap font-semibold text-white">{euros(restantC)}</b>
                </span>
              ) : (
                <span className="text-white/70">
                  Encore <b className="whitespace-nowrap font-semibold text-white">{euros(restantC)}</b> à caler
                  {rythmeC >= 1 && <> · <b className="whitespace-nowrap font-semibold text-white">{euros(rythmeC)}</b> par jour</>}
                </span>
              )}
          </div>

          <div className={pied}>
            {nbSans > 0 ? (
              <button
                type="button"
                onClick={() => setVoirSansMontant((o) => !o)}
                aria-expanded={voirSansMontant}
                aria-controls={`${uid}-sans`}
                className={cn(deplier, 'font-medium text-warning-100/90 hover:text-white')}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-500" />
                {avertissement}
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-150', voirSansMontant && 'rotate-180')} />
              </button>
            ) : (
              <p className="flex min-h-[40px] items-center gap-1.5 text-xs text-white/55 sm:min-h-[34px]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-300" /> Toutes les sessions du mois ont un montant.
              </p>
            )}
          </div>
          {nbSans > 0 && (
            <div id={`${uid}-sans`} hidden={!voirSansMontant} className="pt-1">
              <p className="text-2xs leading-relaxed text-white/55">
                Montant retenu : pour une session, le financement OPCO, sinon le prix HT, sinon les factures HT ; pour un parcours POEI, son montant total, sinon le taux horaire × la durée × les candidats. Renseignez-en un pour qu’il compte.
              </p>
              <ul className="mt-1">
                {sansMontant.map((s, i) => (
                  <li key={s.id} className="ll-obj-item min-w-0" style={vars({ '--i': i % MAX_NOMS })}>
                    <Link
                      href={s.href}
                      className={cn('group flex min-h-[40px] items-center gap-1.5 rounded-md sm:min-h-[28px]', FOCUS)}
                    >
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-warning-500" />
                      <span className="ll-underline min-w-0 truncate text-sm font-semibold text-white/90 group-hover:text-white group-hover:[background-size:100%_1px]">{s.libelle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Pied : la règle de calcul, une ligne */}
      <footer className="flex items-center justify-between gap-4 border-t border-white/10 bg-brand-800/40 px-4 text-2xs text-white/55 sm:px-6 sm:text-xs">
        <p className="hidden min-w-0 truncate md:block" title={definition}>{definition}</p>
        <p className="min-w-0 truncate font-mono tabular-nums md:hidden">{compteursCourts}</p>
        <div className="flex shrink-0 items-center gap-5">
          <span className="hidden font-mono tabular-nums xl:inline">{compteurs}</span>
          <Link
            href="/dashboard/sessions"
            className={cn('inline-flex min-h-[40px] items-center gap-1.5 rounded-md font-semibold text-accent-300 hover:text-accent-200', FOCUS)}
          >
            Voir les sessions <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  )
}

// ── Vue annuelle ──

/** 73 215 → « 73k » : étiquette au-dessus d'une barre de chiffre d'affaires. */
const kiloEuros = (n: number) => (n <= 0 ? '0' : n < 1000 ? '<1k' : `${Math.round(n / 1000)}k`)
const somme = (t: ObjectifMois[], f: (m: ObjectifMois) => number) => t.reduce((s, m) => s + f(m), 0)
const MOIS_COURTS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

/** Une barre par mois face à son objectif (trait blanc) ; la part POEI en menthe pâle. Un clic ouvre le mois. */
function Barres({ mois, valeur, objectif, poei, etiquette, lire, onMois }: {
  mois: ObjectifMois[]
  valeur: (m: ObjectifMois) => number
  objectif: (m: ObjectifMois) => number
  poei: (m: ObjectifMois) => number
  /** Texte court au-dessus de la barre. */
  etiquette: (n: number) => string
  /** Texte complet pour les lecteurs d'écran et l'infobulle. */
  lire: (n: number) => string
  onMois: (cle: string) => void
}) {
  const max = Math.max(1, ...mois.map((m) => Math.max(valeur(m), objectif(m))))
  return (
    <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
      {mois.map((m, i) => {
        const v = valeur(m)
        const o = objectif(m)
        const p = Math.min(poei(m), v)
        const texte = `${m.nomMois} : ${lire(v)} sur un objectif de ${lire(o)}`
        return (
          <button
            key={m.cle}
            type="button"
            onClick={() => onMois(m.cle)}
            aria-label={`${texte}. Ouvrir ${m.nomMois.toLowerCase()}.`}
            title={texte}
            className={cn('group flex min-w-0 flex-col items-center rounded-md pb-0.5 pt-1', FOCUS)}
          >
            <span aria-hidden="true" className={cn('font-mono text-[10px] leading-3 tabular-nums', v > 0 && v >= o ? 'font-semibold text-accent-300' : 'text-white/55')}>
              {etiquette(v)}
            </span>
            <span aria-hidden="true" className="relative mt-1 block h-24 w-full overflow-hidden rounded-[5px] bg-white/[0.07] transition-colors group-hover:bg-white/[0.13] sm:h-28">
              {v > 0 && (
                <span className="ll-obj-barre absolute inset-x-0 bottom-0 min-h-[3px] bg-accent-400" style={vars({ height: `${(v / max) * 100}%`, '--i': i })}>
                  {p > 0 && <span className="ll-obj-pastille-poei absolute inset-x-0 top-0" style={{ height: `${(p / v) * 100}%` }} />}
                </span>
              )}
              <span className="absolute inset-x-0 h-0.5 bg-white/80" style={{ bottom: `max(0px, calc(${(o / max) * 100}% - 2px))` }} />
            </span>
            <span aria-hidden="true" className={cn('mt-1 text-[10px] leading-3', m.enCours ? 'font-bold text-white' : 'font-medium text-white/55')}>
              <span className="sm:hidden">{m.nomMois.charAt(0)}</span>
              <span className="hidden sm:inline">{MOIS_COURTS[Number(m.cle.slice(5)) - 1]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** L'année en un regard : cumul des douze mois et une barre par mois. Rien ne s'y modifie, les objectifs se règlent mois par mois. */
function Annee({ uid, annee, mois, onMois }: { uid: string; annee: string; mois: ObjectifMois[]; onMois: (cle: string) => void }) {
  const [intro, setIntro] = useState(true)
  useEffect(() => { const t = setTimeout(() => setIntro(false), INTRO_MS); return () => clearTimeout(t) }, [])

  const clos = mois.filter((m) => m.passe)
  const enCours = mois.find((m) => m.enCours)
  // Jours jusqu'au 31 décembre : ce qu'il reste du mois en cours, plus les mois suivants
  const jours = enCours ? enCours.joursRestants + somme(mois.filter((m) => m.cle > enCours.cle), (m) => Number(m.fin.slice(8))) : 0

  const totalE = somme(mois, (m) => m.etablissements.length)
  const objE = somme(mois, (m) => m.objectif)
  const poeiE = somme(mois, (m) => m.nbPoei)
  const pctE = objE > 0 ? Math.round((totalE / objE) * 100) : 0
  const distincts = new Set(mois.flatMap((m) => m.etablissements.map((e) => e.id))).size
  const atteintsE = clos.filter((m) => m.etablissements.length >= m.objectif).length

  const ca = somme(mois, (m) => m.caCale)
  const objC = somme(mois, (m) => m.objectifCa)
  const caPoei = Math.min(somme(mois, (m) => m.caPoei), ca)
  const pctC = objC > 0 ? Math.round((ca / objC) * 100) : 0
  const atteintsC = clos.filter((m) => m.caCale >= m.objectifCa).length
  const nbSans = somme(mois, (m) => m.sessionsSansMontant.length)
  const groupesCa = ca >= 1_000_000 ? 3 : ca >= 1000 ? 2 : 1

  const nbSessions = somme(mois, (m) => m.nbSessions)
  const nbParcours = somme(mois, (m) => m.nbParcoursPoei)
  const lesDeux = totalE >= objE && ca >= objC && objE > 0 && objC > 0

  const titreJauge = 'font-heading text-sm font-semibold text-white/85'
  const objectifTexte = 'font-heading text-sm font-bold text-white/75 sm:text-xl'
  const ligne = 'll-obj-rise mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs'
  const pied = 'mt-3 flex min-h-[40px] items-center gap-1.5 border-t border-white/10 pt-1 text-xs text-white/55 sm:min-h-[34px]'
  const moisAtteints = (n: number) => (clos.length > 0
    ? <span className="text-white/70">Objectif atteint <b className="font-semibold text-white">{n}</b> mois sur {clos.length}</span>
    : <span aria-hidden="true" />)

  return (
    <div className={cn(intro && 'is-intro')}>
      <header className="px-4 sm:px-6">
        <div className="mt-1.5 flex items-end justify-between gap-4">
          <h2 id={`${uid}-titre`} className="min-w-0 text-white">
            <span className="sr-only">Objectif de l’année {annee} : cumul des douze mois</span>
            <span aria-hidden="true" className="relative inline-block">
              <span className="ll-obj-mois">
                {Array.from(annee).map((c, i) => (
                  <span key={i} className="ll-obj-lettre" style={vars({ '--i': i })}>{c}</span>
                ))}
              </span>
              {lesDeux && (
                <svg className="ll-obj-trait pointer-events-none absolute -bottom-1.5 left-0 h-2.5 w-full" viewBox="0 0 300 12" preserveAspectRatio="none">
                  <path d="M3 8C80 2.5 190 2.5 297 6.5" pathLength={1} fill="none" stroke="#5CD9A0" strokeWidth={4} strokeLinecap="round" />
                </svg>
              )}
            </span>
          </h2>
          {enCours && (
            <p className="ll-obj-rise shrink-0 pb-0.5 text-right" style={vars({ '--i': 0 })}>
              <span className="block font-heading text-2xl font-extrabold leading-none tracking-tight tabular-nums text-white sm:text-3xl sm:leading-none">J-{jours}</span>
              <span className="mt-1 block text-xs text-white/60">avant la fin de l’année</span>
            </p>
          )}
        </div>
      </header>

      <div className="mt-4 grid px-4 sm:px-6 lg:grid-cols-2">
        {/* ── Établissements calés, cumul des mois ── */}
        <div className={cn(COLONNE, 'pb-2 sm:pb-4 lg:border-r lg:border-white/10 lg:pb-5 lg:pr-6')}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={titreJauge}>Établissements calés <span className="font-sans text-xs font-medium text-white/50">cumul des mois</span></h3>
            <p className="font-heading text-sm font-bold tabular-nums text-accent-300">
              <span aria-hidden="true" className="ll-obj-compteur" style={vars({ '--ll-obj-n': pctE, minWidth: `${String(pctE).length}ch` })} />
              <span className="sr-only">{pctE}</span>{NNBSP}%<span className="sr-only"> de l’objectif cumulé</span>
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1 gap-y-1">
            <span className="sr-only">{totalE} sur</span>
            <span aria-hidden="true" className="ll-obj-score ll-obj-compteur font-heading font-extrabold text-accent-400" style={vars({ '--ll-obj-n': totalE, minWidth: `${String(totalE).length}ch` })} />
            <span aria-hidden="true" className={cn(objectifTexte, 'text-white/45')}>/</span>
            <span className={cn(objectifTexte, 'tabular-nums')}>{objE}</span>
          </div>
          <div className="mt-2 sm:mt-2.5">
            <Barres
              mois={mois}
              valeur={(m) => m.etablissements.length}
              objectif={(m) => m.objectif}
              poei={(m) => m.nbPoei}
              etiquette={String}
              lire={(n) => `${n} ${pluriel(n, 'établissement', 'établissements')}`}
              onMois={onMois}
            />
            <Repartition opco={String(totalE - poeiE)} poei={String(poeiE)} />
          </div>
          <div className={ligne} style={vars({ '--i': 1 })}>
            {moisAtteints(atteintsE)}
            {totalE >= objE && objE > 0
              ? <Etiquette>{totalE === objE ? 'Objectif annuel atteint' : `Objectif annuel dépassé de ${totalE - objE}`}</Etiquette>
              : <span className="text-white/70">Encore <b className="font-semibold text-white">{objE - totalE}</b> sur l’année</span>}
          </div>
          <p className={pied}>
            <span><b className="font-semibold tabular-nums text-white/80">{distincts}</b> {pluriel(distincts, 'établissement différent', 'établissements différents')} : chacun compte une fois par mois où il est calé.</span>
          </p>
        </div>

        {/* ── Chiffre d'affaires calé, cumul des mois ── */}
        <div className={cn(COLONNE, 'border-t border-white/10 pb-2 pt-3 sm:pb-4 sm:pt-4 lg:border-t-0 lg:pb-5 lg:pl-6 lg:pt-0')}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={titreJauge}>Chiffre d’affaires calé <span className="font-sans text-xs font-medium text-white/50">cumul des mois</span></h3>
            <p className="font-heading text-sm font-bold tabular-nums text-accent-300">
              <span aria-hidden="true" className="ll-obj-compteur" style={vars({ '--ll-obj-n': pctC, minWidth: `${String(pctC).length}ch` })} />
              <span className="sr-only">{pctC}</span>{NNBSP}%<span className="sr-only"> de l’objectif cumulé</span>
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <span className="sr-only">{euros(ca)} HT calés sur</span>
            <span aria-hidden="true" className="ll-obj-score whitespace-nowrap font-heading font-extrabold tabular-nums text-accent-400">
              <span
                className="ll-obj-euros"
                data-g={groupesCa}
                style={vars({ '--ll-obj-m': Math.floor(ca / 1_000_000), '--ll-obj-k': Math.floor(ca / 1000) % 1000, '--ll-obj-u': ca % 1000 })}
              >
                <span>{milliers(ca)}</span>
              </span>{NNBSP}€
            </span>
            <span aria-hidden="true" className="text-sm text-white/55">sur</span>
            <span className={cn(objectifTexte, 'whitespace-nowrap tabular-nums')}>{euros(objC)} HT</span>
          </div>
          <div className="mt-2 sm:mt-2.5">
            <Barres
              mois={mois}
              valeur={(m) => m.caCale}
              objectif={(m) => m.objectifCa}
              poei={(m) => m.caPoei}
              etiquette={kiloEuros}
              lire={(n) => `${euros(n)} HT`}
              onMois={onMois}
            />
            <Repartition opco={euros(ca - caPoei)} poei={euros(caPoei)} />
          </div>
          <div className={ligne} style={vars({ '--i': 2 })}>
            {moisAtteints(atteintsC)}
            {ca >= objC && objC > 0
              ? <Etiquette>{ca === objC ? 'Objectif annuel atteint' : `Objectif annuel dépassé de ${euros(ca - objC)}`}</Etiquette>
              : <span className="text-white/70">Encore <b className="whitespace-nowrap font-semibold text-white">{euros(objC - ca)}</b> sur l’année</span>}
          </div>
          <p className={pied}>
            {nbSans > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-500" />
                <span className="text-warning-100/90">{nbSans === 1 ? '1 session sans montant n’est pas comptée' : `${nbSans} sessions sans montant ne sont pas comptées`} : le détail est dans chaque mois.</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-300" /> Toutes les sessions de l’année ont un montant.
              </>
            )}
          </p>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-white/10 bg-brand-800/40 px-4 text-2xs text-white/55 sm:px-6 sm:text-xs">
        <p className="hidden min-w-0 truncate md:block">Cumul des douze mois. Le trait blanc est l’objectif du mois ; une barre ouvre son mois.</p>
        <p className="min-w-0 truncate font-mono tabular-nums md:hidden">{nbSessions} sessions · {nbParcours} POEI</p>
        <div className="flex shrink-0 items-center gap-5">
          <span className="hidden font-mono tabular-nums xl:inline">{nbSessions} {pluriel(nbSessions, 'session', 'sessions')} · {nbParcours} POEI</span>
          <Link
            href="/dashboard/sessions"
            className={cn('inline-flex min-h-[40px] items-center gap-1.5 rounded-md font-semibold text-accent-300 hover:text-accent-200', FOCUS)}
          >
            Voir les sessions <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
