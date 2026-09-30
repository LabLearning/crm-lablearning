import { Mail, PhoneCall, ShieldCheck, Banknote, Clock } from '../icons'
import { ContactForm } from './ContactForm'
import { Kicker } from '../Kicker'

export const metadata = {
  title: 'Contact',
  description:
    'Contactez Lab Learning pour former vos équipes : étude de votre besoin, accompagnement au financement OPCO, réponse sous 24 à 48 h ouvrées.',
  alternates: { canonical: '/contact' },
}

export default function SiteContact() {
  return (
    <section className="relative overflow-hidden max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-20">
      <div className="absolute inset-0 -z-10 ll-grid-faint" />
      <Kicker className="mb-5">Contact</Kicker>
      <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance max-w-3xl">Parlons de votre projet de formation</h1>
      <p className="mt-5 text-lg md:text-xl text-[#57534E] max-w-2xl">
        Un besoin précis, une équipe à former, un financement à monter ? Écrivez-nous : nous revenons vers vous rapidement.
      </p>

      <div className="mt-12 grid lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3">
          <div className="rounded-3xl border border-[#205040]/10 bg-white p-6 md:p-8">
            <ContactForm />
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <a href="mailto:contact@lab-learning.fr" className="flex items-start gap-3 rounded-2xl border border-[#205040]/10 bg-white p-5 hover:border-[#205040]/30 transition-colors">
            <span className="h-10 w-10 rounded-xl bg-[#205040]/8 flex items-center justify-center shrink-0"><Mail className="h-5 w-5 text-[#205040]" /></span>
            <span><span className="block font-heading font-semibold text-[#14110F]">Email</span><span className="text-sm text-[#57534E]">contact@lab-learning.fr</span></span>
          </a>
          <a href="tel:+33451330330" className="flex items-start gap-3 rounded-2xl border border-[#205040]/10 bg-white p-5 hover:border-[#205040]/30 transition-colors">
            <span className="h-10 w-10 rounded-xl bg-[#205040]/8 flex items-center justify-center shrink-0"><PhoneCall className="h-5 w-5 text-[#205040]" /></span>
            <span><span className="block font-heading font-semibold text-[#14110F]">Téléphone</span><span className="text-sm text-[#57534E]">04 51 330 330</span></span>
          </a>
          {[
            { Icon: ShieldCheck, t: 'Certifié Qualiopi', d: 'Actions de formation conformes aux exigences qualité.' },
            { Icon: Banknote, t: 'Financements', d: 'OPCO, AGEFICE, CPF, plan de développement des compétences.' },
            { Icon: Clock, t: 'Réactivité', d: 'Réponse sous 24 à 48 h ouvrées, sessions planifiées rapidement.' },
          ].map((x) => (
            <div key={x.t} className="flex items-start gap-3 rounded-2xl border border-[#205040]/10 bg-white p-5">
              <span className="h-10 w-10 rounded-xl bg-[#205040]/8 flex items-center justify-center shrink-0"><x.Icon className="h-5 w-5 text-[#205040]" /></span>
              <span><span className="block font-heading font-semibold text-[#14110F]">{x.t}</span><span className="text-sm text-[#57534E]">{x.d}</span></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
