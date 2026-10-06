import Link from 'next/link'
import { ArrowRight } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { FAQ } from './donnees'

export const metadata = {
  title: 'FAQ formation, OPCO et Qualiopi',
  description: 'Financement OPCO, formations en établissement, délais, Qualiopi, accessibilité : les réponses aux questions les plus posées.',
  alternates: { canonical: '/faq' },
}

/**
 * FAQ : les vraies questions posées par les prospects, avec balisage
 * FAQPage — chaque réponse est éligible aux résultats enrichis Google.
 */

export default function SiteFaq() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.r },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-12">
          <Kicker className="mb-5">FAQ</Kicker>
          <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance max-w-4xl">Les questions qu&apos;on nous pose <span className="text-[#205040]">tout le temps</span></h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed max-w-2xl">
            Financement, délais, déroulement : tout ce qu&apos;il faut savoir avant de lancer une formation.
            Il manque la vôtre ? <Link href="/contact" className="font-semibold text-[#205040] hover:underline">Posez-la nous directement</Link>.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16 md:pb-20 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
        <div className="min-w-0 space-y-3">
        {FAQ.map((f, i) => (
          <Reveal key={i} delay={(i % 3) * 60}>
            <details className="group rounded-2xl bg-white ring-1 ring-black/5 open:ring-[#205040]/20 transition-shadow open:shadow-lg open:shadow-black/5">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 md:px-6 py-4.5 py-5">
                <span className="font-heading font-semibold text-[#14110F]">{f.q}</span>
                <span className="shrink-0 h-8 w-8 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] transition-transform group-open:rotate-90">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </summary>
              <div className="px-5 md:px-6 pb-5 -mt-1 text-[15px] text-[#57534E] leading-relaxed">{f.r}</div>
            </details>
          </Reveal>
        ))}
        </div>
        <aside>
          <div className="lg:sticky lg:top-28 rounded-3xl bg-[#205040] p-6 md:p-7 text-white">
            <div className="font-heading text-lg font-bold">Une question sur votre situation précise ?</div>
            <p className="mt-2 text-[15px] text-white/85 leading-relaxed">Décrivez-nous votre établissement : nous vous répondons sur le financement, les délais et l&apos;organisation.</p>
            <Link href="/contact" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#205040] hover:bg-white/90 transition-colors">
              Contactez-nous <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>
    </>
  )
}
