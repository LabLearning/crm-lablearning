'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { X, Loader2, CheckCircle2, PhoneCall, Recommencer, Envoyer, ArrowLeft } from './icons'
import { STARKK_SITE } from '@/lib/fonctionnalites'
import { CLE_COOKIES, EVT_COOKIES_CHOISIS } from './CookieBanner'
import { demanderRappelStarkkAction } from './starkk-rappel'

/**
 * Starkk sur le site public : une bulle en bas à droite, qui ouvre une
 * discussion avec l'assistant. Il renseigne les visiteurs à partir du contenu
 * du site (route /api/site/starkk) et propose d'être rappelé.
 *
 * La discussion est gardée dans l'onglet (sessionStorage) : elle suit le
 * visiteur d'une page à l'autre et disparaît à la fermeture de l'onglet.
 */

type Message = { role: 'user' | 'assistant'; content: string }
type DemandeRappel = { prenom: string; telephone: string; email: string; etablissement: string; message: string }
const MEMOIRE = 'll_starkk_site'
const APERCU = 'll_starkk_apercu'
const ACCROCHE_VUE = 'll_starkk_accroche'
const AVATAR = '/site/photos/starkk-160.webp'
const LONGUEUR_MAX = 600

const SUGGESTIONS = [
  'La formation hygiène est-elle obligatoire ?',
  'Qui finance la formation de mon équipe ?',
  'C’est quoi, un plan de maîtrise sanitaire ?',
  'Comment se passe une formation chez moi ?',
]

const identifiant = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16 >> Number(c) / 4)).toString(16)))

/** Gras et liens d'une ligne. Seuls les liens vers une page du site sont cliquables. */
function Ligne({ texte, fermer }: { texte: string; fermer: () => void }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g).filter(Boolean)
  return (
    <>
      {morceaux.map((m, i) => {
        if (m.startsWith('**') && m.endsWith('**')) return <strong key={i} className="font-semibold text-[#14110F]">{m.slice(2, -2)}</strong>
        const lien = m.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
        if (lien) {
          const [, libelle, href] = lien
          // Un chemin du site, jamais une adresse extérieure ni un schéma (javascript:, data:)
          if (/^\/(?![/\\])[\w\-./?=&#%]*$/.test(href)) {
            return <Link key={i} href={href} onClick={() => { if (window.innerWidth < 640) fermer() }} className="font-semibold text-[#205040] underline decoration-[#205040]/30 underline-offset-2 hover:decoration-[#205040]">{libelle}</Link>
          }
          return <span key={i}>{libelle}</span>
        }
        return <span key={i}>{m}</span>
      })}
    </>
  )
}

/** Rendu minimal d'une réponse : paragraphes et listes à puces. */
function Reponse({ texte, fermer }: { texte: string; fermer: () => void }) {
  const blocs: { liste: boolean; lignes: string[] }[] = []
  for (const brute of texte.split('\n')) {
    const l = brute.trim()
    if (!l) continue
    const puce = /^([-•*]|\d+[.)])\s+/.test(l)
    const contenu = l.replace(/^([-•*]|\d+[.)])\s+/, '').replace(/^#+\s*/, '')
    const dernier = blocs[blocs.length - 1]
    if (puce && dernier?.liste) dernier.lignes.push(contenu)
    else blocs.push({ liste: puce, lignes: [contenu] })
  }
  return (
    <div className="space-y-2">
      {blocs.map((b, i) => b.liste
        ? <ul key={i} className="space-y-1 pl-4 list-disc marker:text-[#205040]">{b.lignes.map((x, j) => <li key={j}><Ligne texte={x} fermer={fermer} /></li>)}</ul>
        : <p key={i}><Ligne texte={b.lignes[0]} fermer={fermer} /></p>)}
    </div>
  )
}

const champ = 'w-full min-h-11 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[15px] text-[#14110F] placeholder:text-[#A8A29E] focus:border-[#205040] focus:outline-none focus:ring-[3px] focus:ring-[#5CD9A0]/40'

export function StarkkBulle() {
  const pathname = usePathname() || '/'
  const [autorise, setAutorise] = useState(STARKK_SITE === 'tous')
  const [pret, setPret] = useState(false)
  const [cookiesRepondus, setCookiesRepondus] = useState(true)
  const [ouvert, setOuvert] = useState(false)
  const [accroche, setAccroche] = useState(false)
  const [vue, setVue] = useState<'discussion' | 'rappel' | 'rappel-fait'>('discussion')
  const [messages, setMessages] = useState<Message[]>([])
  const [discussion, setDiscussion] = useState('')
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const jeton = useRef<{ valeur: string; recu: number } | null>(null)
  const fil = useRef<HTMLDivElement>(null)
  const zone = useRef<HTMLTextAreaElement>(null)
  const [rappel, setRappel] = useState<DemandeRappel>({ prenom: '', telephone: '', email: '', etablissement: '', message: '' })
  const [pot, setPot] = useState('')
  const [envoiRappel, setEnvoiRappel] = useState(false)
  const [erreurRappel, setErreurRappel] = useState<string | null>(null)

  // Au chargement : mode aperçu (?starkk=1), discussion de l'onglet, réponse au bandeau cookies
  useEffect(() => {
    try {
      if (STARKK_SITE === 'apercu') {
        if (new URLSearchParams(window.location.search).get('starkk') === '1') window.sessionStorage.setItem(APERCU, '1')
        setAutorise(window.sessionStorage.getItem(APERCU) === '1')
      }
      const garde = JSON.parse(window.sessionStorage.getItem(MEMOIRE) || 'null')
      if (garde && typeof garde.discussion === 'string' && Array.isArray(garde.messages)) {
        setDiscussion(garde.discussion)
        setMessages(garde.messages.filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string').slice(-40))
      } else setDiscussion(identifiant())
      setCookiesRepondus(!!window.localStorage.getItem(CLE_COOKIES))
    } catch {
      setDiscussion(identifiant())
    }
    setPret(true)
    const repondu = () => setCookiesRepondus(true)
    window.addEventListener(EVT_COOKIES_CHOISIS, repondu)
    return () => window.removeEventListener(EVT_COOKIES_CHOISIS, repondu)
  }, [])

  // La discussion suit le visiteur d'une page à l'autre
  useEffect(() => {
    if (!pret || !discussion) return
    try { window.sessionStorage.setItem(MEMOIRE, JSON.stringify({ discussion, messages })) } catch { /* sans stockage, la discussion vit le temps de la page */ }
  }, [pret, discussion, messages])

  // Une petite phrase d'accroche, une seule fois par onglet, si la bulle n'a pas été ouverte
  useEffect(() => {
    if (!pret || !autorise || ouvert || messages.length) return
    let vu = false
    try { vu = window.sessionStorage.getItem(ACCROCHE_VUE) === '1' } catch { /* ignore */ }
    if (vu) return
    const t = window.setTimeout(() => {
      setAccroche(true)
      try { window.sessionStorage.setItem(ACCROCHE_VUE, '1') } catch { /* ignore */ }
    }, 9000)
    return () => window.clearTimeout(t)
  }, [pret, autorise, ouvert, messages.length])

  async function obtenirJeton(force = false): Promise<string | null> {
    // Un jeton vaut un jour : il est redemandé au bout de vingt heures
    if (!force && jeton.current && Date.now() - jeton.current.recu < 20 * 3600 * 1000) return jeton.current.valeur
    try {
      const r = await fetch('/api/site/starkk', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok || !j?.jeton) return null
      jeton.current = { valeur: j.jeton, recu: Date.now() }
      return j.jeton
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!ouvert) return
    setAccroche(false)
    obtenirJeton()
    const t = window.setTimeout(() => zone.current?.focus(), 150)
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    window.addEventListener('keydown', touche)
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', touche) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert])

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: 'smooth' })
  }, [messages, vue, enCours])

  async function envoyer(texte: string) {
    const question = texte.trim().slice(0, LONGUEUR_MAX)
    if (!question || enCours) return
    setErreur(null)
    setSaisie('')
    const historique: Message[] = [...messages, { role: 'user', content: question }]
    setMessages([...historique, { role: 'assistant', content: '' }])
    setEnCours(true)
    const echec = (message: string) => { setMessages(historique); setErreur(message) }
    try {
      let j = await obtenirJeton()
      // La page vient d'être ouverte : le serveur demande une seconde entre le jeton et le premier message
      if (jeton.current && Date.now() - jeton.current.recu < 1400) await new Promise((r) => setTimeout(r, 1400))
      const appeler = (valeur: string | null) => fetch('/api/site/starkk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historique.slice(-24), jeton: valeur, discussion, page: pathname }),
      })
      let r = await appeler(j)
      if (r.status === 403) { j = await obtenirJeton(true); await new Promise((x) => setTimeout(x, 1400)); r = await appeler(j) }
      if (!r.ok || !r.body) {
        const detail = await r.json().catch(() => null)
        return echec(detail?.error || 'Starkk ne répond pas pour le moment. Réessayez dans un instant.')
      }
      const lecteur = r.body.getReader()
      const decodeur = new TextDecoder()
      let recu = ''
      for (;;) {
        const { done, value } = await lecteur.read()
        if (done) break
        recu += decodeur.decode(value, { stream: true })
        const partiel = recu
        setMessages([...historique, { role: 'assistant', content: partiel }])
      }
      if (!recu.trim()) return echec('La réponse n’est pas arrivée. Réessayez.')
    } catch {
      echec('La connexion a été interrompue. Réessayez.')
    } finally {
      setEnCours(false)
      window.setTimeout(() => zone.current?.focus(), 50)
    }
  }

  function recommencer() {
    if (enCours) return
    setMessages([]); setErreur(null); setVue('discussion'); setDiscussion(identifiant())
  }

  async function envoyerRappel(e: React.FormEvent) {
    e.preventDefault()
    if (envoiRappel) return
    setErreurRappel(null)
    if (!rappel.prenom.trim()) return setErreurRappel('Indiquez votre prénom.')
    if (rappel.etablissement.trim().length < 2) return setErreurRappel('Indiquez le nom de votre établissement.')
    if (!rappel.telephone.trim() && !rappel.email.trim()) return setErreurRappel('Laissez un téléphone ou une adresse e-mail.')
    setEnvoiRappel(true)
    let r: { success: boolean; error?: string }
    try {
      const j = await obtenirJeton()
      r = await demanderRappelStarkkAction(rappel, { jeton: j || '', pot }, discussion)
    } catch {
      r = { success: false, error: 'La connexion a été interrompue. Réessayez.' }
    }
    setEnvoiRappel(false)
    if (!r.success) return setErreurRappel(r.error || 'L’envoi a échoué. Réessayez.')
    setVue('rappel-fait')
  }

  const majRappel = (champs: Partial<DemandeRappel>) => { setErreurRappel(null); setRappel((x) => ({ ...x, ...champs })) }

  if (!pret || !autorise) return null
  const fermer = () => setOuvert(false)

  // ── Bulle fermée ──
  if (!ouvert) {
    return (
      // Sur téléphone, le bandeau cookies occupe le bas de l'écran : la bulle attend la réponse du visiteur
      <div className={`fixed bottom-5 right-5 z-[60] flex items-end gap-3 ${cookiesRepondus ? '' : 'max-sm:hidden'}`}>
        {accroche && (
          <div className="ll-rise relative mb-1 max-w-[230px] rounded-2xl rounded-br-md bg-white px-4 py-3 text-sm leading-snug text-[#14110F] shadow-xl shadow-black/15 ring-1 ring-black/5">
            <button type="button" onClick={() => setAccroche(false)} aria-label="Masquer ce message" className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#78716C] shadow ring-1 ring-black/10 hover:text-[#14110F]">
              <X className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => setOuvert(true)} className="text-left">
              Une question sur vos formations ou sur l’hygiène ? Je vous réponds tout de suite.
            </button>
          </div>
        )}
        <button type="button" onClick={() => setOuvert(true)} aria-label="Poser une question à Starkk, l’assistant de Lab Learning"
          className="group relative h-16 w-16 shrink-0 rounded-full shadow-xl shadow-black/25 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5CD9A0]">
          <span className="ll-ligne-verte absolute -inset-[3px] rounded-full" aria-hidden="true" />
          <span className="absolute inset-0 overflow-hidden rounded-full bg-[#0C1210] ring-2 ring-[#0C1210]">
            <img src={AVATAR} alt="" width={160} height={160} className="h-full w-full object-cover" />
          </span>
          <span className="absolute -right-0.5 bottom-0.5 h-4 w-4 rounded-full bg-[#5CD9A0] ring-2 ring-white" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // ── Bulle ouverte ──
  return (
    <div role="dialog" aria-label="Discussion avec Starkk"
      className="fixed inset-x-0 bottom-0 z-[60] flex h-[86dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl shadow-black/30 ring-1 ring-black/10 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[620px] sm:max-h-[calc(100dvh-2.5rem)] sm:w-[400px] sm:rounded-3xl ll-rise">
      {/* En-tête */}
      <div className="relative flex items-center gap-3 bg-[#0C1210] px-4 py-3.5 text-white">
        {vue !== 'discussion' && (
          <button type="button" onClick={() => setVue('discussion')} aria-label="Revenir à la discussion" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="relative h-10 w-10 shrink-0">
          <img src={AVATAR} alt="" width={160} height={160} className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20" />
          <span className="absolute -right-0.5 bottom-0 h-3 w-3 rounded-full bg-[#5CD9A0] ring-2 ring-[#0C1210]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-heading text-sm font-bold">Starkk</div>
          <div className="text-xs text-white/55">Assistant IA de Lab Learning</div>
        </div>
        {vue === 'discussion' && messages.length > 0 && (
          <button type="button" onClick={recommencer} disabled={enCours} aria-label="Nouvelle discussion" title="Nouvelle discussion" className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40">
            <Recommencer className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={fermer} aria-label="Fermer la discussion" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {vue === 'discussion' && (
        <>
          <div ref={fil} className="flex-1 space-y-3 overflow-y-auto bg-[#FAFAFA] px-4 py-4">
            {/* Accueil */}
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-[15px] leading-relaxed text-[#44403C] ring-1 ring-black/5">
              Bonjour, je suis Starkk. Je réponds à vos questions sur nos formations, leur financement, l’hygiène alimentaire et la sécurité en restauration.
            </div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => envoyer(s)} className="rounded-full bg-white px-3.5 py-2 text-left text-sm font-medium text-[#205040] ring-1 ring-[#205040]/20 hover:bg-[#205040]/5 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => m.role === 'user' ? (
              <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#205040] px-4 py-2.5 text-[15px] leading-relaxed text-white">{m.content}</div>
            ) : (
              <div key={i} className="max-w-[92%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-[15px] leading-relaxed text-[#44403C] ring-1 ring-black/5">
                {m.content
                  ? <Reponse texte={m.content} fermer={fermer} />
                  : <span className="inline-flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-[#205040]" /><span className="ll-shimmer">Starkk réfléchit…</span></span>}
              </div>
            ))}
            {erreur && <p className="rounded-xl bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]" role="alert">{erreur}</p>}
          </div>

          <div className="border-t border-black/5 bg-white px-3 pb-3 pt-2.5">
            <form onSubmit={(e) => { e.preventDefault(); envoyer(saisie) }} className="flex items-end gap-2">
              <label htmlFor="starkk-question" className="sr-only">Votre question</label>
              <textarea id="starkk-question" ref={zone} rows={1} value={saisie} maxLength={LONGUEUR_MAX}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(saisie) } }}
                placeholder="Écrivez votre question"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-black/10 bg-[#FAFAFA] px-4 py-2.5 text-[15px] text-[#14110F] placeholder:text-[#A8A29E] focus:border-[#205040] focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-[#5CD9A0]/40" />
              <button type="submit" disabled={enCours || !saisie.trim()} aria-label="Envoyer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#205040] text-white hover:bg-[#1a4335] disabled:opacity-40 transition-colors">
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Envoyer className="h-4 w-4" />}
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <span className="text-[11px] leading-snug text-[#A8A29E]">Starkk est une IA : vérifiez les informations importantes.</span>
              <button type="button" onClick={() => { setVue('rappel'); setErreurRappel(null) }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#205040]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#205040] hover:bg-[#205040]/[0.12] transition-colors">
                <PhoneCall className="h-3.5 w-3.5" /> Être rappelé
              </button>
            </div>
          </div>
        </>
      )}

      {vue === 'rappel' && (
        <form onSubmit={envoyerRappel} noValidate className="flex flex-1 flex-col overflow-y-auto bg-[#FAFAFA] px-4 py-4">
          <div className="font-heading text-lg font-bold text-[#14110F]">Être rappelé</div>
          <p className="mt-1 text-sm leading-relaxed text-[#57534E]">Un conseiller vous rappelle pour parler de votre projet. Il verra les questions que vous avez posées ici.</p>
          {/* Champ piège : invisible, jamais rempli par un visiteur */}
          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            <label>Site web<input tabIndex={-1} autoComplete="off" value={pot} onChange={(e) => setPot(e.target.value)} /></label>
          </div>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="r-prenom" className="mb-1 block text-sm font-semibold text-[#14110F]">Prénom</label>
                <input id="r-prenom" className={champ} value={rappel.prenom} onChange={(e) => majRappel({ prenom: e.target.value })} autoComplete="given-name" maxLength={80} />
              </div>
              <div>
                <label htmlFor="r-tel" className="mb-1 block text-sm font-semibold text-[#14110F]">Téléphone</label>
                <input id="r-tel" type="tel" inputMode="tel" className={champ} value={rappel.telephone} onChange={(e) => majRappel({ telephone: e.target.value })} autoComplete="tel" maxLength={30} />
              </div>
            </div>
            <div>
              <label htmlFor="r-etab" className="mb-1 block text-sm font-semibold text-[#14110F]">Nom de votre établissement</label>
              <input id="r-etab" className={champ} value={rappel.etablissement} onChange={(e) => majRappel({ etablissement: e.target.value })} autoComplete="organization" maxLength={120} />
            </div>
            <div>
              <label htmlFor="r-mail" className="mb-1 block text-sm font-semibold text-[#14110F]">E-mail <span className="font-normal text-[#A8A29E]">(à défaut de téléphone)</span></label>
              <input id="r-mail" type="email" inputMode="email" className={champ} value={rappel.email} onChange={(e) => majRappel({ email: e.target.value })} autoComplete="email" maxLength={200} />
            </div>
            <div>
              <label htmlFor="r-msg" className="mb-1 block text-sm font-semibold text-[#14110F]">Un mot sur votre projet <span className="font-normal text-[#A8A29E]">(facultatif)</span></label>
              <textarea id="r-msg" rows={2} className={`${champ} resize-none`} value={rappel.message} onChange={(e) => majRappel({ message: e.target.value })} maxLength={500} />
            </div>
          </div>
          {erreurRappel && <p className="mt-3 rounded-xl bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]" role="alert">{erreurRappel}</p>}
          <button type="submit" disabled={envoiRappel} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#205040] px-6 text-sm font-semibold text-white hover:bg-[#1a4335] disabled:opacity-60 transition-colors">
            {envoiRappel ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />} Demander à être rappelé
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[#78716C]">
            Lab Learning enregistre ces coordonnées pour vous recontacter au sujet de la formation de votre équipe. Voir notre <Link href="/confidentialite" className="font-semibold text-[#205040] underline underline-offset-2">politique de confidentialité</Link>.
          </p>
        </form>
      )}

      {vue === 'rappel-fait' && (
        <div className="flex flex-1 flex-col items-center justify-center bg-[#FAFAFA] px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#205040]"><CheckCircle2 className="h-7 w-7 text-white" /></div>
          <div className="mt-4 font-heading text-xl font-bold text-[#14110F]">C’est noté</div>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#57534E]">Un conseiller Lab Learning vous recontacte rapidement. Vous pouvez continuer à poser vos questions à Starkk.</p>
          <button type="button" onClick={() => setVue('discussion')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#205040] px-5 text-sm font-semibold text-white hover:bg-[#1a4335] transition-colors">
            Revenir à la discussion
          </button>
        </div>
      )}
    </div>
  )
}
