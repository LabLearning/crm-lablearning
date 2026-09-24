'use client'

/**
 * Objectif du mois, bloc « La une » du tableau de bord : le mois suivant en
 * très gros, une jauge crantée (une case par établissement visé) qui se
 * remplit comme un liquide, le compte à rebours et le rythme à tenir.
 *
 * Toutes les données viennent du serveur (lib/objectif-mois.ts) : aucune date
 * n'est calculée dans le navigateur, donc pas d'écart d'hydratation. Les
 * animations sont en CSS pur (app/globals.css, section « objectif du mois ») :
 * le HTML serveur porte déjà l'état final.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { Target, Pencil, Check, X, Minus, Plus, Award, ArrowRight, ChevronDown } from '@/components/ui/icons'
import type { ObjectifMois } from '@/lib/objectif-mois'
import { setObjectifMoisAction } from './objectif-actions'

/** Largeur de chaque mois en em (Montserrat, tracking -0,045em), mesurée en 900 :
    valeurs prudentes pour le 800 réellement chargé. Le mot remplit la carte sans déborder. */
const LARGEUR_EM: Record<string, number> = {
  janvier: 3.67, 'février': 3.5, mars: 2.43, avril: 2.3, mai: 1.78, juin: 2.13,
  juillet: 3.06, 'août': 2.46, septembre: 5.55, octobre: 4.08, novembre: 5.23, 'décembre': 5.23,
}
const MAX_NOMS = 12
/** Fin de l'entrée : après la dernière animation (trait sous le mois : 1,9 s + 1,1 s). */
const INTRO_MS = 3400
/** Espace fine insécable avant « % ». */
const NNBSP = ' '

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un)
const virgule = (n: number) => n.toFixed(1).replace('.', ',')
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`)
const deMois = (m: string) => (/^[aeiouyàâéèêîôû]/i.test(m) ? `d’${m}` : `de ${m}`)
const pasDe = (max: number) => (max <= 10 ? 1 : max <= 30 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : max <= 300 ? 50 : 100)
const vars = (o: Record<string, string | number>) => o as CSSProperties
const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/60'
const BTN_ICONE = `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:h-9 sm:w-9 ${FOCUS}`

type Etat = 'vide' | 'en_cours' | 'atteint' | 'depasse'
type Stat = { v: string; l: string; c: string; live?: boolean }

export function ObjectifMoisUne({ data, peutModifier }: { data: ObjectifMois; peutModifier: boolean }) {
  const { toast } = useToast()
  const uid = useId().replace(/:/g, '')
  const declencheur = useRef<HTMLButtonElement>(null)

  const [intro, setIntro] = useState(true)            // animations d'entrée, une fois par affichage
  const [cible, setCible] = useState(data.objectif)
  const [saisi, setSaisi] = useState(data.objectifSaisi)
  const [edition, setEdition] = useState(false)
  const [brouillon, setBrouillon] = useState(String(data.objectif))
  const [erreur, setErreur] = useState<string | null>(null)
  const [annonce, setAnnonce] = useState('')
  const [flash, setFlash] = useState(0)
  const [ouvert, setOuvert] = useState(false)         // sommaire replié sur téléphone
  const [tout, setTout] = useState(false)

  useEffect(() => { const t = setTimeout(() => setIntro(false), INTRO_MS); return () => clearTimeout(t) }, [])
  // Revalidation serveur ou modification par un autre administrateur
  useEffect(() => { setCible(data.objectif); setSaisi(data.objectifSaisi) }, [data.objectif, data.objectifSaisi])

  // Aperçu en direct : pendant la saisie, toute valeur valide pilote le bloc
  const saisie = Number(brouillon)
  const saisieValide = /^\d{1,4}$/.test(brouillon.trim()) && saisie >= 1 && saisie <= 1000
  const objectif = edition && saisieValide ? saisie : cible

  const mois = data.nomMois.toLowerCase()                 // « octobre »
  const etabs = data.etablissements                       // triés du plus ancien calage au plus récent
  const realise = etabs.length
  const nouveaux = etabs.filter((e) => e.recent).length
  const max = Math.max(objectif, realise)
  const largeur = (realise / max) * 100
  const posObjectif = (objectif / max) * 100
  const pct = Math.round((realise / objectif) * 100)
  const restant = Math.max(0, objectif - realise)
  const etat: Etat = realise === 0 ? 'vide' : realise < objectif ? 'en_cours' : realise === objectif ? 'atteint' : 'depasse'
  const gagne = etat === 'atteint' || etat === 'depasse'
  const jours = Math.max(1, data.joursAvantDebut)
  const rythme = restant / jours

  // Graduation : 0 à gauche, max à droite ; en dépassement, l'objectif a son propre repère
  const pas = pasDe(max)
  const graduations: number[] = []
  for (let g = 0; g < max; g += pas) {
    if (g === 0 || (max - g >= pas / 2 && (etat !== 'depasse' || Math.abs(g - objectif) >= pas / 2))) graduations.push(g)
  }
  if (etat !== 'depasse' || (max - objectif) / max >= 0.08) graduations.push(max)

  const deck = ({
    vide: <>Aucun établissement calé pour l’instant. Objectif : <b>{objectif}</b> à former en {mois}.</>,
    en_cours: restant === 1
      ? <>Plus qu’<b>un établissement</b> à caler pour atteindre l’objectif.</>
      : restant <= 3
        ? <>Plus que <b>{restant} établissements</b> à caler pour atteindre l’objectif.</>
        : <>Encore <b>{restant} établissements</b> à caler pour atteindre l’objectif.</>,
    atteint: objectif === 1
      ? <>Objectif atteint : l’établissement visé est calé pour {mois}.</>
      : <>Objectif atteint : les <b>{objectif} établissements</b> sont calés pour {mois}.</>,
    depasse: <>Objectif dépassé : <b>{realise} établissements</b> calés, soit {realise - objectif} de plus que prévu.</>,
  } as Record<Etat, ReactNode>)[etat]

  const stats: Stat[] = [
    jours === 1
      ? { v: 'J-1', l: `demain, 1er ${mois}`, c: 'text-white' }
      : { v: `J-${jours}`, l: `avant le 1er ${mois}`, c: 'text-white' },
    {
      v: nouveaux > 0 ? `+${nouveaux}` : '0', l: pluriel(nouveaux, 'calé cette semaine', 'calés cette semaine'),
      c: nouveaux > 0 ? 'text-accent-300' : 'text-white/70', live: nouveaux > 0,
    },
    etat === 'depasse' ? { v: `+${realise - objectif}`, l: 'au-delà de l’objectif', c: 'text-accent-300' }
      : etat === 'atteint' ? { v: `100${NNBSP}%`, l: 'de l’objectif', c: 'text-accent-300' }
      : rythme >= 1 ? { v: virgule(rythme), l: 'à caler par jour', c: 'text-white' }
      : { v: String(restant), l: 'encore à caler', c: 'text-white' },
  ]

  const definition = `Établissement calé : au moins une session non annulée qui démarre en ${mois}, POEI comprises.`
  const compteurs = `${data.nbSessions} ${pluriel(data.nbSessions, 'session', 'sessions')} · ${data.nbStagiaires} ${pluriel(data.nbStagiaires, 'stagiaire inscrit', 'stagiaires inscrits')}`
  const valeurTexte = `${realise} ${pluriel(realise, 'établissement calé', 'établissements calés')} sur un objectif de ${objectif}, soit ${pct}${NNBSP}%`
  const visibles = tout ? etabs : etabs.slice(0, MAX_NOMS)

  function ouvrir() { setBrouillon(String(cible)); setErreur(null); setEdition(true) }
  function fermer() { setEdition(false); setErreur(null); requestAnimationFrame(() => declencheur.current?.focus()) }
  function ajuster(d: number) { setBrouillon(String(Math.min(1000, Math.max(1, (saisieValide ? saisie : cible) + d)))); setErreur(null) }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!saisieValide) { setErreur('Indiquez un nombre entier entre 1 et 1 000.'); return }
    const v = saisie
    if (v === cible && saisi) { fermer(); return }
    const avant = { cible, saisi }
    setCible(v); setSaisi(true); setFlash((n) => n + 1); fermer()          // optimiste
    const res = await setObjectifMoisAction(data.cle, v).catch(() => null)
    if (!res?.success) {
      setCible(avant.cible); setSaisi(avant.saisi)
      const msg = res?.error || 'L’objectif n’a pas pu être enregistré. Réessayez.'
      toast('error', msg)
      setAnnonce('')                                                        // vider d'abord : deux échecs identiques sont lus tous les deux
      setTimeout(() => setAnnonce(`${msg} Objectif maintenu à ${avant.cible}.`), 60)
      return
    }
    setAnnonce(`Objectif fixé à ${v} ${pluriel(v, 'établissement', 'établissements')}. ${realise} ${pluriel(realise, 'calé', 'calés')}, soit ${Math.round((realise / v) * 100)}${NNBSP}%.`)
    toast('success', `Objectif ${deMois(mois)} fixé à ${v} ${pluriel(v, 'établissement', 'établissements')}.`)
  }

  return (
    <section
      aria-labelledby={`${uid}-titre`}
      className={cn('ll-obj relative isolate overflow-hidden rounded-2xl text-white shadow-elevated', intro && 'is-intro')}
    >
      <div aria-hidden="true" className="ll-obj-fond pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden="true" className="ll-obj-grille pointer-events-none absolute inset-0 -z-10" />
      <p aria-live="polite" className="sr-only">{annonce}</p>

      {/* Bandeau de une */}
      <header className="relative flex items-center justify-between gap-3 px-5 pb-3.5 pt-4 sm:px-8 sm:pt-5">
        <span className="ll-kicker ll-kicker--light shrink-0">Objectif du mois</span>
        <span className="min-w-0 truncate font-mono text-2xs uppercase tracking-[0.18em] text-white/60">
          <span className="hidden sm:inline">Édition </span>{data.libelle}
        </span>
        <span aria-hidden="true" className="ll-obj-filet pointer-events-none absolute bottom-0 left-5 right-5 h-px bg-white/15 sm:left-8 sm:right-8" />
      </header>

      <div className="px-5 sm:px-8">
        {/* Héros : le mois en très gros, le score en face */}
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 pt-5 sm:pt-7">
          <div className="min-w-0 max-w-full">
            <h2 id={`${uid}-titre`} className="text-white">
              <span className="sr-only">Formations en {data.libelle}</span>
              <span aria-hidden="true" className="ll-obj-rise block font-heading text-sm font-semibold text-accent-300" style={{ animationDelay: '40ms' }}>
                Formations en
              </span>
              <span aria-hidden="true" className="relative mt-1 inline-block max-w-full">
                <span className="ll-obj-mois" style={vars({ '--em': LARGEUR_EM[mois] ?? 5.55 })}>
                  {Array.from(data.nomMois).map((lettre, i) => (
                    <span key={i} className="ll-obj-lettre" style={vars({ '--i': i })}>{lettre}</span>
                  ))}
                </span>
                {gagne && (
                  <svg className="ll-obj-trait pointer-events-none absolute -bottom-2 left-0 h-3 w-full" viewBox="0 0 300 12" preserveAspectRatio="none">
                    <path d="M3 8C80 2.5 190 2.5 297 6.5" pathLength={1} fill="none" stroke="#5CD9A0" strokeWidth={4} strokeLinecap="round" />
                  </svg>
                )}
              </span>
            </h2>
            <p
              className="ll-obj-rise mt-3 max-w-[42ch] font-heading text-lg font-semibold leading-snug text-white/85 sm:text-xl [&_b]:font-bold [&_b]:text-accent-300"
              style={vars({ '--i': 0 })}
            >
              {deck}
            </p>
          </div>

          <div className="flex items-end gap-3 sm:ml-auto sm:flex-col sm:items-end sm:gap-1.5 sm:text-right">
            <p className="flex shrink-0 items-baseline gap-1.5 leading-none">
              <span className="sr-only">{realise} sur {objectif}</span>
              <span
                aria-hidden="true"
                className="ll-obj-score ll-obj-compteur font-heading font-extrabold text-accent-400"
                style={vars({ '--ll-obj-n': realise, minWidth: `${String(realise).length}ch` })}
              />
              <span aria-hidden="true" className="font-heading text-2xl font-bold text-white/60 sm:text-4xl">/{objectif}</span>
            </p>
            <p className="min-w-0 pb-1 text-sm leading-snug text-white/70 sm:pb-0">
              {pluriel(realise, 'établissement calé', 'établissements calés')}
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> · </span>
              <span className="font-semibold text-white">
                <span aria-hidden="true" className="ll-obj-compteur" style={vars({ '--ll-obj-n': pct, minWidth: `${String(pct).length}ch` })} />
                <span className="sr-only">{pct}</span>{NNBSP}%
              </span>{' '}de l’objectif
            </p>
          </div>
        </div>

        {/* Jauge */}
        <div className="mt-6 sm:mt-8">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {gagne ? (
              <span className="ll-obj-tampon inline-flex items-center gap-1.5 rounded-lg bg-accent-400 px-2.5 py-1 text-xs font-bold text-brand-800">
                <Award className="h-3.5 w-3.5" /> {etat === 'atteint' ? 'Objectif atteint' : 'Objectif dépassé'}
              </span>
            ) : (
              <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Progression<span className="hidden sm:inline"> vers l’objectif</span>
              </span>
            )}

            {edition ? (
              <form
                noValidate
                onSubmit={enregistrer}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); fermer() } }}
                className="flex w-full items-center gap-1.5 sm:w-auto"
              >
                <label htmlFor={`${uid}-obj`} className="sr-only">Nombre d’établissements visés en {mois}</label>
                <button type="button" onClick={() => ajuster(-1)} aria-label="Retirer un établissement" className={BTN_ICONE}>
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  id={`${uid}-obj`}
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  step={1}
                  value={brouillon}
                  onChange={(e) => { setBrouillon(e.target.value); setErreur(null) }}
                  aria-invalid={!!erreur}
                  aria-describedby={erreur ? `${uid}-err` : undefined}
                  className="h-10 w-16 rounded-lg bg-white/10 text-center font-mono text-[16px] font-semibold tabular-nums text-white ring-1 ring-inset ring-white/20 focus:outline-none focus:ring-[3px] focus:ring-accent-400/60 sm:h-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button type="button" onClick={() => ajuster(1)} aria-label="Ajouter un établissement" className={BTN_ICONE}>
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent-400 px-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-accent-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/70 sm:ml-1.5 sm:h-9"
                >
                  <Check className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Enregistrer</span>
                </button>
                <button type="button" onClick={fermer} aria-label="Annuler la modification" className={BTN_ICONE}>
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : peutModifier ? (
              <button
                ref={declencheur}
                type="button"
                onClick={ouvrir}
                aria-label={`Objectif ${cible}${saisi ? '' : ' par défaut'}, modifier l’objectif ${deMois(mois)}`}
                className={cn('group -mr-2.5 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:min-h-[32px]', FOCUS)}
              >
                <Target className="h-4 w-4 text-accent-300" /> Objectif
                <span key={flash} onAnimationEnd={() => setFlash(0)} className={cn('rounded px-1 font-mono font-semibold tabular-nums text-white', flash > 0 && 'll-obj-flash')}>{cible}</span>
                {!saisi && <span className="text-2xs text-white/60">par défaut</span>}
                <Pencil className="h-3.5 w-3.5 text-white/60 transition-colors group-hover:text-accent-300" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm text-white/80">
                <Target className="h-4 w-4 text-accent-300" /> Objectif <span className="font-mono font-semibold tabular-nums text-white">{cible}</span>
              </span>
            )}
          </div>
          {erreur && <p id={`${uid}-err`} role="alert" className="-mt-1 mb-2 text-xs text-danger-100">{erreur}</p>}

          <div
            role="progressbar"
            aria-label={`Établissements calés en ${mois}`}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={realise}
            aria-valuetext={valeurTexte}
            className="ll-obj-jauge relative h-11 overflow-hidden rounded-[14px] bg-white/[0.07] sm:h-14"
          >
            {realise > 0 && (
              <div
                aria-hidden="true"
                className={cn('ll-obj-remplissage absolute inset-y-0 left-0 min-w-[14px]', gagne && 'is-full')}
                style={{ width: `${largeur}%` }}
              >
                {etat === 'depasse' && <div className="absolute inset-y-0 right-0 bg-white/25" style={{ left: `${posObjectif}%` }} />}
                {nouveaux > 0 && nouveaux < realise && (
                  <div
                    className="ll-obj-recent absolute inset-y-0 right-0 flex items-center justify-center pr-2"
                    style={{ left: `${(1 - nouveaux / realise) * 100}%` }}
                  >
                    {nouveaux / max >= 0.08 && (
                      <span className="whitespace-nowrap text-2xs font-extrabold text-brand-800">
                        +{nouveaux}{nouveaux / max >= 0.12 && <span className="hidden xl:inline"> cette semaine</span>}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {max <= 40 && Array.from({ length: max - 1 }, (_, k) => (
              <span key={k} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-brand-900/30" style={{ left: `${((k + 1) / max) * 100}%` }} />
            ))}
            {etat === 'depasse' && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${posObjectif}%` }} />
            )}
            {etat === 'vide' && (
              <span
                aria-hidden="true"
                className="ll-obj-appel pointer-events-none absolute inset-y-1.5 left-1 rounded-[10px] border border-accent-400/70"
                style={{ width: `max(6px, calc(${100 / max}% - 6px))` }}
              />
            )}
          </div>

          <div aria-hidden="true" className="relative mt-2 h-4 font-mono text-2xs tabular-nums text-white/60">
            {graduations.map((g) => {
              const bord = g === 0 ? 'left-0' : g === max ? 'right-0' : ''
              return (
                <span
                  key={g}
                  className={cn('absolute top-0', bord || 'hidden -translate-x-1/2 sm:block')}
                  style={bord ? undefined : { left: `${(g / max) * 100}%` }}
                >
                  {g}
                </span>
              )
            })}
            {etat === 'depasse' && (
              <span className="absolute top-0 -translate-x-1/2 font-semibold text-white" style={{ left: `${posObjectif}%` }}>{objectif}</span>
            )}
          </div>
        </div>

        {/* Chiffres clés et sommaire */}
        <div className="mt-6 border-t border-white/10 pb-5 sm:pb-6 xl:grid xl:grid-cols-12 xl:gap-x-8">
          <dl className="grid grid-cols-3 xl:col-span-5">
            {stats.map((s, i) => (
              <div
                key={i}
                className="ll-obj-rise flex min-w-0 flex-col gap-0.5 border-l border-white/10 px-3 py-4 first:border-l-0 first:pl-0 sm:px-5"
                style={vars({ '--i': i + 1 })}
              >
                <dt className="order-2 text-xs leading-snug text-white/65">{s.l}</dt>
                <dd className={cn('order-1 flex items-center gap-2 whitespace-nowrap font-heading text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl', s.c)}>
                  {s.v}
                  {s.live && (
                    <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" />
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-white/10 pt-3 sm:pt-4 xl:col-span-7 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-5">
            {realise === 0 ? (
              <div className="flex flex-col items-start gap-3 py-1">
                <p className="text-sm text-white/70">Les établissements apparaîtront ici dès qu’une session {deMois(mois)} sera programmée.</p>
                <Link
                  href="/dashboard/dossiers/nouveau"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-accent-400 px-4 text-sm font-semibold text-brand-800 transition-colors hover:bg-accent-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/70"
                >
                  <Plus className="h-4 w-4" /> Caler un premier établissement
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOuvert((o) => !o)}
                  aria-expanded={ouvert}
                  aria-controls={`${uid}-liste`}
                  className={cn('flex min-h-[44px] w-full items-center justify-between rounded-lg text-sm font-semibold text-white/85 sm:hidden', FOCUS)}
                >
                  {ouvert ? 'Masquer les établissements' : realise === 1 ? 'Voir l’établissement calé' : `Voir les ${realise} établissements calés`}
                  <ChevronDown className={cn('h-4 w-4 transition-transform duration-150', ouvert && 'rotate-180')} />
                </button>
                <div id={`${uid}-liste`} className={cn(ouvert ? 'block' : 'hidden', 'sm:block')}>
                  <p className="mb-3 hidden text-2xs font-semibold uppercase tracking-[0.14em] text-white/60 sm:block">Déjà calés</p>
                  <ol className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3 sm:gap-y-2.5">
                    {visibles.map((e, i) => (
                      <li key={e.id} className="ll-obj-item min-w-0" style={vars({ '--i': i % MAX_NOMS })}>
                        <Link
                          href={`/dashboard/clients/${e.id}`}
                          title={e.ville ? `${e.nom}, ${e.ville}` : e.nom}
                          className={cn('group flex min-h-[40px] items-center gap-2 rounded-md sm:min-h-[28px]', FOCUS)}
                        >
                          <span className="shrink-0 font-mono text-2xs tabular-nums text-accent-300/80">{String(i + 1).padStart(2, '0')}</span>
                          <span className="ll-underline min-w-0 truncate text-sm font-semibold text-white/90 group-hover:text-white group-hover:[background-size:100%_1px]">{e.nom}</span>
                          {e.poei && <span className="shrink-0 font-mono text-[10px] font-medium text-accent-300">POEI</span>}
                          {e.recent && (
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
                      className={cn('mt-2 min-h-[40px] rounded-md text-sm font-semibold text-accent-300 hover:text-accent-200 sm:min-h-0', FOCUS)}
                    >
                      {realise - MAX_NOMS === 1 ? 'Afficher le dernier établissement' : `Afficher les ${realise - MAX_NOMS} autres`}
                    </button>
                  )}
                  <p className="mt-3 text-2xs leading-relaxed text-white/60 sm:hidden">{definition} {compteurs}.</p>
                </div>
                <Link
                  href="/dashboard/dossiers/nouveau"
                  className={cn('mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 px-3 text-sm text-white/75 transition-colors hover:border-accent-400/70 hover:text-white sm:inline-flex sm:min-h-[34px] sm:w-auto sm:justify-start', FOCUS)}
                >
                  <Plus className="h-3.5 w-3.5" /> Caler le {ordinal(realise + 1)} établissement
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="hidden items-center justify-between gap-6 border-t border-white/10 bg-brand-800/40 px-8 py-3.5 text-xs text-white/60 sm:flex">
        <p className="min-w-0">{definition}</p>
        <div className="flex shrink-0 items-center gap-5">
          <span className="hidden font-mono tabular-nums lg:inline">{compteurs}</span>
          <Link href="/dashboard/sessions" className={cn('inline-flex items-center gap-1.5 rounded-md font-semibold text-accent-300 hover:text-accent-200', FOCUS)}>
            Voir les sessions <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </section>
  )
}
