'use client'

/**
 * Champs d'adresse à saisie assistée : on tape une adresse, elle se retrouve
 * et remplit le code postal et la ville ; on tape un code postal, la ville se
 * remplit seule.
 *
 * Trois champs, qui s'emploient exactement comme <Input> (mêmes props : label,
 * name, value / onChange ou defaultValue, error, hint, disabled…) :
 *
 *   <AdresseGroupe>
 *     <AdresseInput id="adresse" name="adresse" label="Adresse" defaultValue={x.adresse} />
 *     <div className="grid grid-cols-2 gap-4">
 *       <CodePostalInput id="code_postal" name="code_postal" label="Code postal" defaultValue={x.code_postal} />
 *       <VilleInput id="ville" name="ville" label="Ville" defaultValue={x.ville} />
 *     </div>
 *   </AdresseGroupe>
 *
 * <AdresseGroupe> ne rend aucune balise : il relie seulement les champs qu'il
 * contient, où qu'ils soient dans la mise en page. Un formulaire qui porte
 * plusieurs adresses (une par participant, par exemple) met un groupe par
 * adresse.
 *
 * Comment un champ remplit son voisin : il écrit dans l'input du voisin comme
 * le ferait une frappe, puis émet l'événement de saisie. Le formulaire n'a
 * donc rien à savoir : un champ contrôlé reçoit son onChange habituel, un
 * champ non contrôlé garde sa valeur pour l'envoi.
 *
 * Règles de comportement :
 *   - la suggestion aide, elle ne bloque jamais : tout reste saisissable à la
 *     main, service en panne compris ;
 *   - rien ne se remplit à l'ouverture d'une fiche, seulement quand
 *     l'utilisateur tape ou choisit ;
 *   - un code postal à une seule commune remplit la ville ; à plusieurs
 *     communes, la liste est proposée et rien n'est choisi à la place de
 *     l'utilisateur ;
 *   - une ville déjà cohérente avec le code postal n'est pas réécrite.
 *
 * Champ d'adresse seul (formulaire sans code postal ni ville) : l'adresse
 * choisie s'écrit sur une ligne, « 6 bis Boulevard Berthelot, 34000 Montpellier ».
 * Pour un lieu en texte libre (« Dans les locaux du client »), ajouter
 * `discret` : la liste n'apparaît que s'il y a une adresse à proposer.
 *
 * Ville seule (lieu de naissance, ville d'un prospect) : <VilleInput autonome />
 * propose les communes par leur nom et ne touche à aucun autre champ.
 */

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { Loader2, MapPin } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import {
  LONGUEUR_MIN_ADRESSE,
  LONGUEUR_MIN_VILLE,
  adresseSurUneLigne,
  cleTexte,
  cleVille,
  communesDuCodePostal,
  estCodePostal,
  memeVille,
  nettoyerCodePostal,
  rechercherAdresses,
  rechercherCommunes,
  ressembleAUneAdresse,
  voieAvecNumeroSaisi,
  type AdresseSuggestion,
  type CommuneSuggestion,
} from '@/lib/adresse'

type Role = 'adresse' | 'code_postal' | 'ville'

interface Groupe {
  champs: React.MutableRefObject<Partial<Record<Role, HTMLInputElement | null>>>
  /** Vrai pendant qu'un champ écrit dans un autre : ce n'est pas une frappe, aucune recherche ne doit partir. */
  ecritureEnCours: React.MutableRefObject<boolean>
  onChoisir: (s: AdresseSuggestion) => void
}

const ContexteGroupe = createContext<Groupe | null>(null)

/** Relie les champs d'une même adresse. Ne rend aucune balise. */
export function AdresseGroupe({
  children,
  onChoisir,
}: {
  children: React.ReactNode
  /** Appelé quand une adresse est choisie dans la liste (coordonnées, département…). */
  onChoisir?: (s: AdresseSuggestion) => void
}) {
  const champs = useRef<Partial<Record<Role, HTMLInputElement | null>>>({})
  const ecritureEnCours = useRef(false)
  const rappel = useRef(onChoisir)
  rappel.current = onChoisir
  const groupe = useMemo<Groupe>(
    () => ({ champs, ecritureEnCours, onChoisir: (s) => rappel.current?.(s) }),
    [],
  )
  return <ContexteGroupe.Provider value={groupe}>{children}</ContexteGroupe.Provider>
}

/**
 * Le groupe englobant, ou un groupe réduit au champ lui-même s'il est employé
 * seul. `autonome` : le champ ignore le groupe qui l'entoure (une ville de
 * naissance placée dans le même formulaire qu'une adresse n'en est pas la ville).
 */
function useGroupe(autonome = false): Groupe {
  const parent = useContext(ContexteGroupe)
  const champs = useRef<Partial<Record<Role, HTMLInputElement | null>>>({})
  const ecritureEnCours = useRef(false)
  const seul = useMemo<Groupe>(() => ({ champs, ecritureEnCours, onChoisir: () => {} }), [])
  return autonome ? seul : parent ?? seul
}

/** Écrit dans un champ comme le ferait une frappe : React et le formulaire voient un changement ordinaire. */
function ecrireDans(el: HTMLInputElement | null | undefined, valeur: string, groupe: Groupe): boolean {
  if (!el || el.disabled || el.readOnly) return false
  if (el.value === valeur) return true
  const poser = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  if (!poser) return false
  groupe.ecritureEnCours.current = true
  try {
    poser.call(el, valeur)
    // Chaque écriture est appliquée avant la suivante. Un formulaire qui tient
    // ses champs dans un seul objet d'état, mis à jour par
    // setForm({ ...form, ville }), verrait sinon l'adresse, le code postal et
    // la ville calculés tous trois sur le même objet : il n'en garderait qu'un.
    flushSync(() => {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } finally {
    groupe.ecritureEnCours.current = false
  }
  return true
}

// ─── Liste de suggestions ───────────────────────────────────────────────────

interface Element<T> {
  cle: string
  titre: string
  detail?: string
  donnee: T
}

interface EtatListe<T> {
  ouvert: boolean
  elements: Array<Element<T>>
  actif: number
  entete: string | null
  /** Ligne d'information quand il n'y a rien à proposer */
  message: string | null
  aDroite: boolean
}

const LISTE_FERMEE: EtatListe<any> = { ouvert: false, elements: [], actif: -1, entete: null, message: null, aDroite: false }
const LARGEUR_MIN_LISTE = 256 // 16rem, voir min-w-[16rem]

/**
 * La liste fait au moins 16rem : sous un champ étroit (code postal), elle
 * déborde à droite. Si elle sortait de la zone visible (bord d'une modale, de
 * l'écran), on l'ancre à droite du champ.
 */
function alignerADroite(el: HTMLInputElement): boolean {
  const r = el.getBoundingClientRect()
  const largeur = Math.max(r.width, LARGEUR_MIN_LISTE)
  let gauche = 0
  let droite = window.innerWidth
  for (let p = el.parentElement; p; p = p.parentElement) {
    const style = window.getComputedStyle(p)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      const zone = p.getBoundingClientRect()
      gauche = Math.max(gauche, zone.left)
      droite = Math.min(droite, zone.right)
    }
  }
  return r.left + largeur > droite - 8 && r.right - largeur >= gauche + 8
}

function useListe<T>(champ: React.RefObject<HTMLInputElement | null>) {
  const [etat, setEtat] = useState<EtatListe<T>>(LISTE_FERMEE)
  const [chargement, setChargement] = useState(false)

  const fermer = useCallback(() => setEtat((e) => (e.ouvert ? LISTE_FERMEE : e)), [])

  const montrer = useCallback(
    (elements: Array<Element<T>>, options: { entete?: string; vide?: string } = {}) => {
      // Une réponse qui arrive après que l'utilisateur a quitté le champ ne
      // doit rien ouvrir : la liste resterait posée sur les champs suivants,
      // sans rien pour la refermer.
      if (champ.current && document.activeElement !== champ.current) {
        setEtat(LISTE_FERMEE)
        return
      }
      if (!elements.length && !options.vide) {
        setEtat(LISTE_FERMEE)
        return
      }
      setEtat({
        ouvert: true,
        elements,
        actif: -1,
        entete: elements.length ? options.entete ?? null : null,
        message: elements.length ? null : options.vide ?? null,
        aDroite: champ.current ? alignerADroite(champ.current) : false,
      })
    },
    [champ],
  )

  const activer = useCallback((actif: number | ((i: number) => number)) => {
    setEtat((e) => ({ ...e, actif: typeof actif === 'function' ? actif(e.actif) : actif }))
  }, [])

  return { ...etat, chargement, setChargement, fermer, montrer, activer }
}

/** Une recherche à la fois : la suivante annule la précédente, et une réponse tardive est ignorée. */
function useRecherche() {
  const etat = useRef<{ numero: number; controle: AbortController | null; minuterie: ReturnType<typeof setTimeout> | null }>({
    numero: 0,
    controle: null,
    minuterie: null,
  })

  const annuler = useCallback(() => {
    const e = etat.current
    e.numero++
    if (e.minuterie) clearTimeout(e.minuterie)
    e.controle?.abort()
    e.minuterie = null
    e.controle = null
  }, [])

  /** Lance `travail` après `delai` ms. `encoreValable()` devient faux dès qu'une autre recherche a pris la place. */
  const lancer = useCallback(
    (delai: number, travail: (signal: AbortSignal, encoreValable: () => boolean) => Promise<void>) => {
      annuler()
      const e = etat.current
      const numero = e.numero
      const partir = () => {
        e.minuterie = null
        const controle = new AbortController()
        e.controle = controle
        void travail(controle.signal, () => e.numero === numero)
      }
      if (delai > 0) e.minuterie = setTimeout(partir, delai)
      else partir()
    },
    [annuler],
  )

  useEffect(() => annuler, [annuler])
  return { lancer, annuler }
}

const DELAI_FRAPPE = 180

/**
 * Remplissage automatique du navigateur. Ces champs reçoivent le plus souvent
 * l'adresse de quelqu'un d'autre (un client, un stagiaire) : la liste des
 * adresses enregistrées dans le navigateur n'a rien à y faire et recouvrirait
 * nos suggestions. « off » suffit à Safari et Firefox ; Chrome et Edge
 * l'ignorent pour les adresses mais respectent une valeur qu'ils ne
 * connaissent pas. Un formulaire où le visiteur saisit SA propre adresse passe
 * son autoComplete (street-address, postal-code, address-level2), qui prime.
 */
function useAutoCompleteParDefaut(): string {
  const [valeur, setValeur] = useState('off')
  useEffect(() => {
    if (/Chrom(e|ium)\//.test(navigator.userAgent)) setValeur('saisie-assistee')
  }, [])
  return valeur
}

// ─── Champ commun ───────────────────────────────────────────────────────────

interface ChampAdresseProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  /** Classes de l'enveloppe du champ (place dans une grille, largeur). L'input lui-même reçoit `className`. */
  conteneurClassName?: string
  /** Ne pas appliquer .input-base : pour un formulaire qui a son propre style de champ (site public). */
  sansStyle?: boolean
}

interface ChampBaseProps<T> extends ChampAdresseProps {
  role_: Role
  groupe: Groupe
  champ: React.MutableRefObject<HTMLInputElement | null>
  liste: ReturnType<typeof useListe<T>>
  onChoix: (donnee: T) => void
  /** Mention sous la liste (source des données) */
  pied?: string
  avecRepere?: boolean
  /**
   * Abandonne la recherche en attente quand l'utilisateur quitte le champ ou
   * tape Échap. Le code postal ne le passe pas : sa réponse doit aboutir après
   * le départ du champ, c'est elle qui remplit la ville.
   */
  onAbandon?: () => void
}

function ChampBaseInterne<T>(
  {
    role_,
    groupe,
    champ,
    liste,
    onChoix,
    pied,
    avecRepere,
    onAbandon,
    label,
    error,
    hint,
    id,
    className,
    conteneurClassName,
    sansStyle,
    onKeyDown,
    onBlur,
    autoComplete,
    ...props
  }: ChampBaseProps<T>,
  ref: React.ForwardedRef<HTMLInputElement>,
) {
  const idListe = `${useId()}-suggestions`
  const autoCompleteParDefaut = useAutoCompleteParDefaut()
  const { ouvert, elements, actif, entete, message, aDroite, chargement, fermer, activer } = liste

  const poser = useCallback(
    (el: HTMLInputElement | null) => {
      const precedent = champ.current
      champ.current = el
      if (el) groupe.champs.current[role_] = el
      else if (groupe.champs.current[role_] === precedent) delete groupe.champs.current[role_]
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [champ, groupe, role_, ref],
  )

  // L'option active reste visible quand on parcourt la liste au clavier ;
  // à l'ouverture, la liste entière est amenée dans la zone visible (bas d'une modale).
  useEffect(() => {
    if (!ouvert) return
    const cible = actif >= 0 ? document.getElementById(`${idListe}-${actif}`) : document.getElementById(idListe)
    cible?.scrollIntoView({ block: 'nearest' })
  }, [ouvert, actif, idListe, elements])

  function surTouche(e: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    // Échap ou Tab pendant qu'une recherche est en route : elle ne rouvrira pas la liste
    if (e.key === 'Escape' || e.key === 'Tab') onAbandon?.()
    if (!ouvert) return
    if (e.key === 'Escape') {
      // La liste se ferme, pas la modale qui contient le formulaire. La modale
      // écoute Échap sur `document`, là même où React pose ses propres écoutes
      // (la racine de l'App Router est le document) : arrêter la propagation
      // ne suffit pas, il faut aussi retenir les écoutes voisines.
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      fermer()
      return
    }
    if (e.key === 'Tab') {
      fermer()
      return
    }
    const n = elements.length
    if (!n) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activer((i) => (i + 1) % n)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activer((i) => (i <= 0 ? n - 1 : i - 1))
    } else if (e.key === 'Enter') {
      // Sans option mise en évidence, Entrée garde son rôle dans le formulaire
      if (actif >= 0 && elements[actif]) {
        e.preventDefault()
        onChoix(elements[actif].donnee)
      } else {
        fermer()
      }
    }
  }

  return (
    <div className={cn('space-y-1.5', conteneurClassName)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-surface-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={poser}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={ouvert}
          aria-controls={ouvert ? idListe : undefined}
          aria-activedescendant={ouvert && actif >= 0 ? `${idListe}-${actif}` : undefined}
          autoComplete={autoComplete ?? autoCompleteParDefaut}
          spellCheck={false}
          className={cn(
            !sansStyle && 'input-base',
            error && 'border-danger-500 focus:ring-danger-500/20 focus:border-danger-500',
            className,
          )}
          {...props}
          onKeyDown={surTouche}
          onBlur={(e) => {
            onAbandon?.()
            fermer()
            onBlur?.(e)
          }}
        />
        {chargement && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-surface-400" />
        )}
        {ouvert && (
          <div
            id={idListe}
            role="listbox"
            aria-label={entete || 'Suggestions'}
            // Le clic sur une suggestion ne doit pas retirer le curseur du champ
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              'absolute top-full z-50 mt-1 w-full min-w-[16rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-surface-200 bg-white text-left shadow-lg',
              aDroite ? 'right-0' : 'left-0',
            )}
          >
            {entete && (
              <div className="border-b border-surface-100 px-3.5 py-2 text-xs font-medium text-surface-500">{entete}</div>
            )}
            {message && <div className="px-3.5 py-2.5 text-sm text-surface-500">{message}</div>}
            {elements.length > 0 && (
              <div className="max-h-64 overflow-y-auto overscroll-contain">
                {elements.map((el, i) => (
                  <div
                    key={el.cle}
                    id={`${idListe}-${i}`}
                    role="option"
                    aria-selected={i === actif}
                    // Pas onMouseEnter : une liste qui apparaît sous un pointeur immobile
                    // activerait une option toute seule, et Entrée la choisirait.
                    onMouseMove={(e) => { if ((e.movementX !== 0 || e.movementY !== 0) && i !== actif) activer(i) }}
                    onClick={() => onChoix(el.donnee)}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
                      i === actif ? 'bg-surface-100' : 'hover:bg-surface-50',
                    )}
                  >
                    {avecRepere && <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-surface-900">{el.titre}</span>
                      {el.detail && <span className="block truncate text-xs text-surface-500">{el.detail}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {pied && elements.length > 0 && (
              <div className="border-t border-surface-100 px-3.5 py-1.5 text-[11px] text-surface-400">{pied}</div>
            )}
          </div>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {ouvert && elements.length > 0
            ? `${elements.length} suggestion${elements.length > 1 ? 's' : ''}, flèches haut et bas pour choisir`
            : ''}
        </span>
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
    </div>
  )
}

const ChampBase = forwardRef(ChampBaseInterne) as <T>(
  props: ChampBaseProps<T> & { ref?: React.ForwardedRef<HTMLInputElement> },
) => React.ReactElement

// ─── Les trois champs ───────────────────────────────────────────────────────

function detailCommune(c: CommuneSuggestion): string {
  const codes = c.codes_postaux
  const libelleCodes = codes.length > 3 ? `${codes[0]} à ${codes[codes.length - 1]}` : codes.join(', ')
  return [libelleCodes, c.departement].filter(Boolean).join(' · ')
}

function elementsCommunes(communes: CommuneSuggestion[], codePostal?: string): Array<Element<CommuneSuggestion>> {
  return communes.map((c) => ({
    cle: c.code_insee || c.nom,
    titre: c.nom,
    detail: codePostal ? [codePostal, c.departement].filter(Boolean).join(' · ') : detailCommune(c),
    donnee: c,
  }))
}

export interface AdresseInputProps extends ChampAdresseProps {
  /** Appelé quand une adresse est choisie dans la liste. */
  onChoisir?: (s: AdresseSuggestion) => void
  /**
   * Ce qui s'écrit dans ce champ : « voie » (la rue seule, le code postal et la
   * ville allant dans leurs champs) ou « ligne » (l'adresse entière). Par
   * défaut : « voie » si le groupe contient un champ code postal, sinon « ligne ».
   */
  format?: 'voie' | 'ligne'
  /** Champ de lieu en texte libre : ne rien afficher quand aucune adresse ne correspond. */
  discret?: boolean
}

/** Champ adresse : propose les adresses correspondant à la saisie, et remplit code postal et ville. */
export const AdresseInput = forwardRef<HTMLInputElement, AdresseInputProps>(function AdresseInput(
  { onChoisir, format, discret, onChange, ...props },
  ref,
) {
  const groupe = useGroupe()
  const champ = useRef<HTMLInputElement | null>(null)
  const liste = useListe<AdresseSuggestion>(champ)
  const { lancer, annuler } = useRecherche()
  const abandonner = () => { annuler(); liste.setChargement(false) }

  function surSaisie(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e)
    // Écriture d'un champ voisin ou remplissage du navigateur : pas une recherche
    if (groupe.ecritureEnCours.current || document.activeElement !== e.target) return
    const texte = e.target.value.trim()
    // Lieu en texte libre : « Dans les locaux du client » ferait remonter une
    // « Impasse des Locaux ». On ne cherche que ce qui ressemble à une adresse.
    if (texte.length < LONGUEUR_MIN_ADRESSE || (discret && !ressembleAUneAdresse(texte))) {
      abandonner()
      liste.fermer()
      return
    }
    lancer(DELAI_FRAPPE, async (signal, encoreValable) => {
      liste.setChargement(true)
      try {
        const trouvees = await rechercherAdresses(texte, {
          codePostal: groupe.champs.current.code_postal?.value,
          signal,
        })
        if (!encoreValable()) return
        liste.montrer(
          trouvees.map((s) => ({
            cle: s.id,
            titre: s.adresse,
            detail: [`${s.code_postal} ${s.ville}`, s.departement].filter(Boolean).join(' · '),
            donnee: s,
          })),
          discret ? {} : { vide: 'Aucune adresse trouvée. Poursuivez la saisie.' },
        )
      } catch (erreur) {
        if (!encoreValable() || (erreur as any)?.name === 'AbortError') return
        liste.montrer([], discret ? {} : { vide: 'Suggestions indisponibles pour le moment. Saisissez l’adresse à la main.' })
      } finally {
        if (encoreValable()) liste.setChargement(false)
      }
    })
  }

  function choisir(s: AdresseSuggestion) {
    annuler()
    liste.setChargement(false)
    liste.fermer()
    const { code_postal: champCp, ville: champVille } = groupe.champs.current
    const mode = format ?? (champCp ? 'voie' : 'ligne')
    // La Base Adresse Nationale ne connaît pas tous les numéros : la voie choisie garde celui qui a été tapé
    const voie = s.type === 'numero' ? s.adresse : voieAvecNumeroSaisi(champ.current?.value || '', s.adresse)
    ecrireDans(champ.current, mode === 'ligne' ? adresseSurUneLigne({ ...s, adresse: voie }) : voie, groupe)
    ecrireDans(champCp, s.code_postal, groupe)
    // Sans champ code postal, la ligne d'adresse le porte déjà : la ville seule suffit dans son champ
    ecrireDans(champVille, s.ville, groupe)
    onChoisir?.(s)
    groupe.onChoisir(s)
  }

  return (
    <ChampBase<AdresseSuggestion>
      {...props}
      ref={ref}
      role_="adresse"
      groupe={groupe}
      champ={champ}
      liste={liste}
      onChoix={choisir}
      onChange={surSaisie}
      onAbandon={abandonner}
      avecRepere
      pied="Base Adresse Nationale"
    />
  )
})

export interface CodePostalInputProps extends ChampAdresseProps {
  /** Appelé quand le code postal désigne une commune (seule commune du code, ou commune choisie dans la liste). */
  onCommune?: (c: CommuneSuggestion) => void
}

/** Champ code postal : remplit la ville dès que le code est complet, ou propose les communes s'il y en a plusieurs. */
export const CodePostalInput = forwardRef<HTMLInputElement, CodePostalInputProps>(function CodePostalInput(
  { onCommune, onChange, ...props },
  ref,
) {
  const groupe = useGroupe()
  const champ = useRef<HTMLInputElement | null>(null)
  const liste = useListe<CommuneSuggestion>(champ)
  const { lancer, annuler } = useRecherche()

  function surSaisie(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e)
    const cp = nettoyerCodePostal(e.target.value)
    // Code écrit par un champ voisin (adresse ou commune choisie) : il arrive
    // avec sa ville, la recherche lancée pour l'ancien code n'a plus lieu d'être
    if (groupe.ecritureEnCours.current || !estCodePostal(cp)) {
      annuler()
      liste.setChargement(false)
      liste.fermer()
      return
    }
    const champVille = groupe.champs.current.ville
    // Sans champ ville ni rappel, il n'y a rien à remplir
    if (!champVille && !onCommune) return
    const villeAuDepart = champVille?.value ?? ''
    lancer(0, async (signal, encoreValable) => {
      liste.setChargement(true)
      try {
        const communes = await communesDuCodePostal(cp, signal)
        if (!encoreValable() || nettoyerCodePostal(champ.current?.value) !== cp) return
        const aLeCurseur = document.activeElement === champ.current
        if (!communes.length) {
          // CEDEX, code étranger ou faute de frappe : on le dit, on ne bloque rien
          if (aLeCurseur) liste.montrer([], { vide: 'Aucune commune connue pour ce code postal.' })
          return
        }
        const dejaCoherente = communes.find((c) => memeVille(c.nom, champVille?.value))
        if (dejaCoherente) {
          liste.fermer()
          onCommune?.(dejaCoherente)
          return
        }
        if (communes.length === 1) {
          liste.fermer()
          // La ville a été retouchée pendant la recherche : la frappe prime, et
          // le champ ville propose de lui-même les communes de ce code.
          if (champVille && champVille.value !== villeAuDepart) return
          ecrireDans(champVille, communes[0].nom, groupe)
          // Le curseur y est déjà (Tab aussitôt le code tapé) : le nom posé est
          // sélectionné, une frappe le remplace au lieu de s'y ajouter.
          if (champVille && document.activeElement === champVille) champVille.select()
          onCommune?.(communes[0])
          return
        }
        // Plusieurs communes : à l'utilisateur de choisir, jamais à sa place
        if (aLeCurseur) liste.montrer(elementsCommunes(communes), { entete: `Plusieurs communes portent le code ${cp}` })
      } catch (erreur) {
        if (!encoreValable() || (erreur as any)?.name === 'AbortError') return
        liste.fermer()
      } finally {
        if (encoreValable()) liste.setChargement(false)
      }
    })
  }

  function choisir(c: CommuneSuggestion) {
    annuler()
    liste.setChargement(false)
    liste.fermer()
    ecrireDans(groupe.champs.current.ville, c.nom, groupe)
    onCommune?.(c)
  }

  return (
    <ChampBase<CommuneSuggestion>
      {...props}
      ref={ref}
      role_="code_postal"
      groupe={groupe}
      champ={champ}
      liste={liste}
      onChoix={choisir}
      onChange={surSaisie}
    />
  )
})

export interface VilleInputProps extends ChampAdresseProps {
  /** Appelé quand une commune est choisie dans la liste. */
  onCommune?: (c: CommuneSuggestion) => void
  /** Ville qui n'appartient à aucune adresse (lieu de naissance…) : aucun lien avec les champs voisins. */
  autonome?: boolean
}

/** Champ ville : propose les communes du code postal saisi, ou celles dont le nom correspond, et remplit le code postal quand il est unique. */
export const VilleInput = forwardRef<HTMLInputElement, VilleInputProps>(function VilleInput(
  { onCommune, autonome, onChange, onFocus, ...props },
  ref,
) {
  const groupe = useGroupe(autonome)
  const champ = useRef<HTMLInputElement | null>(null)
  const liste = useListe<CommuneSuggestion>(champ)
  const { lancer, annuler } = useRecherche()
  const abandonner = () => { annuler(); liste.setChargement(false) }

  const codePostalVoisin = () => {
    const cp = nettoyerCodePostal(groupe.champs.current.code_postal?.value)
    return estCodePostal(cp) ? cp : null
  }

  /** Propose les communes du code postal voisin, filtrées par ce qui est déjà tapé ; sinon cherche par le nom. */
  function proposer(texte: string, delai: number) {
    const cp = codePostalVoisin()
    // Deux lectures de la saisie : telle quelle (« st » commence Strasbourg) et « st » lu « saint »
    const saisi = cleTexte(texte)
    const saisiVille = cleVille(texte)
    if (!cp && texte.trim().length < LONGUEUR_MIN_VILLE) {
      annuler()
      liste.setChargement(false)
      liste.fermer()
      return
    }
    lancer(delai, async (signal, encoreValable) => {
      liste.setChargement(true)
      try {
        if (cp) {
          const duCode = await communesDuCodePostal(cp, signal)
          if (!encoreValable()) return
          const correspondantes = saisi
            ? duCode.filter((c) => cleTexte(c.nom).includes(saisi) || (!!saisiVille && cleVille(c.nom).includes(saisiVille)))
            : duCode
          // Ville déjà écrite en entier et cohérente : plus rien à proposer
          if (correspondantes.length === 1 && memeVille(correspondantes[0].nom, texte)) {
            liste.fermer()
            return
          }
          if (correspondantes.length) {
            liste.montrer(elementsCommunes(correspondantes, cp), { entete: `Communes du ${cp}` })
            return
          }
        }
        if (texte.trim().length < LONGUEUR_MIN_VILLE) {
          liste.fermer()
          return
        }
        const parNom = await rechercherCommunes(texte, signal)
        if (!encoreValable()) return
        liste.montrer(elementsCommunes(parNom))
      } catch (erreur) {
        if (!encoreValable() || (erreur as any)?.name === 'AbortError') return
        liste.fermer()
      } finally {
        if (encoreValable()) liste.setChargement(false)
      }
    })
  }

  function surSaisie(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e)
    if (groupe.ecritureEnCours.current || document.activeElement !== e.target) return
    proposer(e.target.value, DELAI_FRAPPE)
  }

  function surFocus(e: React.FocusEvent<HTMLInputElement>) {
    onFocus?.(e)
    // Ville encore vide alors que le code postal est connu : on montre ses communes
    if (!e.target.value.trim() && codePostalVoisin() && !e.target.readOnly) proposer('', 0)
  }

  function choisir(c: CommuneSuggestion) {
    annuler()
    liste.setChargement(false)
    liste.fermer()
    ecrireDans(champ.current, c.nom, groupe)
    onCommune?.(c)
    // Le code postal suit quand la commune n'en a qu'un et que celui du
    // formulaire est vide, ou bien celui d'une autre commune. Un CEDEX ou un
    // code étranger ne désigne aucune commune : il reste en place.
    const champCp = groupe.champs.current.code_postal
    const actuel = nettoyerCodePostal(champCp?.value)
    if (!champCp || c.codes_postaux.length !== 1 || c.codes_postaux.includes(actuel)) return
    if (actuel === '') {
      ecrireDans(champCp, c.codes_postaux[0], groupe)
      return
    }
    if (!estCodePostal(actuel)) return
    communesDuCodePostal(actuel)
      .then((communes) => {
        if (communes.length && nettoyerCodePostal(champCp.value) === actuel && memeVille(champ.current?.value, c.nom)) {
          ecrireDans(champCp, c.codes_postaux[0], groupe)
        }
      })
      .catch(() => {})
  }

  return (
    <ChampBase<CommuneSuggestion>
      {...props}
      ref={ref}
      role_="ville"
      groupe={groupe}
      champ={champ}
      liste={liste}
      onChoix={choisir}
      onChange={surSaisie}
      onFocus={surFocus}
      onAbandon={abandonner}
    />
  )
})
