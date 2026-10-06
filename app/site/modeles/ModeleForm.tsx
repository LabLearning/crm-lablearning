'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, Loader2 } from '../icons'
import { EFFECTIFS, type DemandeModele } from '@/lib/modeles'
import { demanderModeleAction } from './actions'

const champ = 'w-full min-h-12 rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] text-[#14110F] placeholder:text-[#A8A29E] focus:border-[#205040] focus:outline-none focus:ring-[3px] focus:ring-[#5CD9A0]/40'
const etiquette = 'block text-sm font-semibold text-[#14110F] mb-1.5'
const facultatif = <span className="font-normal text-[#A8A29E]">(facultatif)</span>

/** Coordonnées gardées sur l'appareil du visiteur : demander un second modèle ne redemande pas tout. */
const MEMOIRE = 'll_modele_contact'
const VIDE: DemandeModele = { prenom: '', nom: '', email: '', etablissement: '', telephone: '', effectif: '' }

/**
 * Demande d'un modèle gratuit : quelques coordonnées, puis le PDF tout de
 * suite et par e-mail. La demande arrive dans le CRM comme un lead « Site web ».
 */
export function ModeleForm({ slug, jetonPage }: { slug: string; jetonPage: string }) {
  const [f, setF] = useState<DemandeModele>(VIDE)
  const [pot, setPot] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [recu, setRecu] = useState<{ url: string; fichier: string; envoye: boolean } | null>(null)
  const haut = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const garde = JSON.parse(window.localStorage.getItem(MEMOIRE) || 'null')
      if (garde && typeof garde === 'object') setF((x) => ({ ...x, ...Object.fromEntries(Object.keys(VIDE).map((k) => [k, typeof garde[k] === 'string' ? garde[k] : ''])) }))
    } catch { /* stockage indisponible : le formulaire reste vide */ }
  }, [])

  // Corriger un champ efface le message d'erreur : il ne concerne plus ce qui est à l'écran
  const maj = (cle: keyof DemandeModele, valeur: string) => { setErreur(null); setF((x) => ({ ...x, [cle]: valeur })) }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (envoi) return
    if (!f.prenom.trim()) return setErreur('Indiquez votre prénom.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return setErreur('Indiquez une adresse e-mail valide : le modèle y est envoyé.')
    if (f.etablissement.trim().length < 2) return setErreur('Indiquez le nom de votre établissement.')
    setEnvoi(true)
    setErreur(null)
    let r
    try {
      r = await demanderModeleAction(slug, f, { jeton: jetonPage, pot })
    } catch {
      r = { success: false, error: 'La connexion a été interrompue. Réessayez.' }
    }
    setEnvoi(false)
    if (!r.success || !r.data) return setErreur(r.error || 'L’envoi a échoué. Réessayez dans un instant.')
    try { window.localStorage.setItem(MEMOIRE, JSON.stringify(f)) } catch { /* sans stockage, rien à garder */ }
    setRecu(r.data)
    haut.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Le fichier est servi en pièce jointe : la page reste affichée pendant qu'il se télécharge
    if (r.data.url.startsWith('/api/')) window.location.assign(r.data.url)
  }

  if (recu) {
    return (
      <div ref={haut} className="scroll-mt-28 rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#205040]">
          <CheckCircle2 className="h-7 w-7 text-white" />
        </div>
        <h2 className="mt-4 font-heading text-2xl font-bold text-[#14110F]">Votre modèle est prêt</h2>
        <p className="mx-auto mt-2 max-w-sm text-[#57534E] leading-relaxed">
          {recu.envoye
            ? <>Le téléchargement a commencé. Nous vous l&apos;avons aussi envoyé à <span className="font-semibold text-[#14110F] break-all">{f.email.trim()}</span>.</>
            : <>Le téléchargement a commencé. L&apos;e-mail n&apos;a pas pu partir : gardez bien le fichier.</>}
        </p>
        <a href={recu.url} download={recu.fichier}
          className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#205040] px-6 text-sm font-semibold text-white hover:bg-[#1a4335] transition-colors">
          <Download className="h-4 w-4" /> Télécharger le modèle
        </a>
        <p className="mt-3 text-xs text-[#78716C]">Rien ne se passe ? Ce bouton relance le téléchargement.</p>
      </div>
    )
  }

  return (
    <form onSubmit={envoyer} noValidate className="rounded-3xl bg-white ring-1 ring-black/5 p-5 sm:p-7">
      <h2 className="font-heading text-xl font-bold text-[#14110F]">Recevoir le modèle</h2>
      <p className="mt-1 text-sm text-[#57534E]">Gratuit. Vous le téléchargez tout de suite et nous vous l&apos;envoyons par e-mail.</p>

      {/* Champ piège : invisible, jamais rempli par un visiteur */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>Site web<input tabIndex={-1} autoComplete="off" value={pot} onChange={(e) => setPot(e.target.value)} /></label>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="m-prenom" className={etiquette}>Prénom</label>
          <input id="m-prenom" className={champ} value={f.prenom} onChange={(e) => maj('prenom', e.target.value)} autoComplete="given-name" maxLength={80} required />
        </div>
        <div>
          <label htmlFor="m-nom" className={etiquette}>Nom {facultatif}</label>
          <input id="m-nom" className={champ} value={f.nom} onChange={(e) => maj('nom', e.target.value)} autoComplete="family-name" maxLength={80} />
        </div>
        <div className="col-span-2">
          <label htmlFor="m-email" className={etiquette}>E-mail</label>
          <input id="m-email" type="email" inputMode="email" className={champ} value={f.email} onChange={(e) => maj('email', e.target.value)} autoComplete="email" maxLength={200} placeholder="vous@votre-restaurant.fr" required />
        </div>
        <div className="col-span-2">
          <label htmlFor="m-etab" className={etiquette}>Nom de votre établissement</label>
          <input id="m-etab" className={champ} value={f.etablissement} onChange={(e) => maj('etablissement', e.target.value)} autoComplete="organization" maxLength={120} required />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="m-tel" className={etiquette}>Téléphone {facultatif}</label>
          <input id="m-tel" type="tel" inputMode="tel" className={champ} value={f.telephone} onChange={(e) => maj('telephone', e.target.value)} autoComplete="tel" maxLength={30} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="m-effectif" className={etiquette}>Effectif {facultatif}</label>
          <select id="m-effectif" className={champ} value={f.effectif} onChange={(e) => maj('effectif', e.target.value)}>
            <option value="">Choisir</option>
            {EFFECTIFS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>

      {erreur && <p className="mt-5 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]" role="alert">{erreur}</p>}

      <button type="submit" disabled={envoi} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#205040] px-6 text-sm font-semibold text-white hover:bg-[#1a4335] disabled:opacity-60 transition-colors">
        {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {envoi ? 'Préparation du modèle…' : 'Recevoir le modèle'}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-[#78716C]">
        Lab Learning enregistre ces coordonnées pour vous envoyer le modèle et pourra vous recontacter au sujet de la formation de votre équipe. Vous pouvez demander leur suppression à tout moment. Voir notre <a href="/confidentialite" target="_blank" className="font-semibold text-[#205040] underline underline-offset-2">politique de confidentialité</a>.
      </p>
    </form>
  )
}
