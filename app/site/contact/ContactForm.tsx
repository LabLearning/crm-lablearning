'use client'

import { useState, useTransition } from 'react'
import { Send, Loader2, CheckCircle2 } from '../icons'
import { sendContactMessageAction } from './actions'
import { lireAttribution } from '../attribution'

/** jetonPage : horodatage signé émis par la page (garde anti-robots, voir ./garde) */
export function ContactForm({ jetonPage }: { jetonPage: string }) {
  const [pending, start] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    // La publicité qui a amené le visiteur, s'il en vient une (voir ../attribution)
    const attribution = lireAttribution()
    if (attribution) fd.set('attribution', JSON.stringify(attribution))
    start(async () => {
      const r = await sendContactMessageAction(fd)
      if (r.success) setSent(true)
      else setError(r.error || 'Erreur')
    })
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#205040]/20 bg-[#205040]/5 p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-[#205040] mx-auto flex items-center justify-center mb-3">
          <CheckCircle2 className="h-6 w-6 text-white" />
        </div>
        <div className="font-heading font-semibold text-lg text-[#14110F]">Message envoyé</div>
        <p className="text-sm text-[#57534E] mt-1">Merci ! Notre équipe vous répond sous 24 à 48 h ouvrées.</p>
      </div>
    )
  }

  const input = 'w-full rounded-xl border border-[#205040]/15 bg-white px-4 py-2.5 text-sm text-[#14110F] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#205040]/50 focus:ring-2 focus:ring-[#205040]/10'

  return (
    <form onSubmit={submit} className="relative space-y-4">
      <input type="hidden" name="jeton" value={jetonPage} />
      {/* Champ piège : invisible pour un visiteur, rempli par les robots */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>Site web<input name="site_web" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="block text-xs font-semibold text-[#57534E] mb-1.5">Nom *</label><input name="nom" required className={input} placeholder="Votre nom" /></div>
        <div><label className="block text-xs font-semibold text-[#57534E] mb-1.5">Email *</label><input name="email" type="email" required className={input} placeholder="vous@entreprise.fr" /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="block text-xs font-semibold text-[#57534E] mb-1.5">Entreprise</label><input name="entreprise" className={input} placeholder="Votre établissement" /></div>
        <div><label className="block text-xs font-semibold text-[#57534E] mb-1.5">Téléphone</label><input name="telephone" className={input} placeholder="06 …" /></div>
      </div>
      <div><label className="block text-xs font-semibold text-[#57534E] mb-1.5">Sujet</label><input name="sujet" className={input} placeholder="Ex : formation hygiène pour mon équipe" /></div>
      <div><label className="block text-xs font-semibold text-[#57534E] mb-1.5">Message *</label><textarea name="message" required rows={5} className={input + ' resize-none'} placeholder="Décrivez votre besoin…" /></div>

      <label className="flex items-start gap-2.5 text-sm text-[#57534E]">
        <input type="checkbox" name="sans_actualites" value="oui" className="mt-0.5 h-4 w-4 shrink-0 accent-[#205040]" />
        Je ne souhaite pas recevoir les actualités et offres de Lab Learning
      </label>

      {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-xl px-4 py-2.5">{error}</div>}

      <button type="submit" disabled={pending}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#205040] text-white text-sm font-semibold hover:bg-[#123f34] disabled:opacity-60 transition-colors">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer le message
      </button>

      <p className="text-xs leading-relaxed text-[#78716C]">
        Lab Learning enregistre ces informations pour répondre à votre demande et vous recontacter au sujet de la formation de votre équipe. Vous pourrez aussi recevoir nos actualités et offres (formations, financements) : vous pouvez vous y opposer ici ou depuis chaque message. Vous pouvez demander leur suppression à tout moment. Voir notre <a href="/confidentialite" target="_blank" className="font-semibold text-[#205040] underline underline-offset-2">politique de confidentialité</a>.
      </p>
    </form>
  )
}
