import Link from 'next/link'
import { ArrowRight } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'

export const metadata = {
  title: 'Questions fréquentes',
  description: 'Financement OPCO, formations en établissement, délais, Qualiopi, accessibilité : les réponses aux questions les plus posées.',
  alternates: { canonical: '/faq' },
}

/**
 * FAQ : les vraies questions posées par les prospects, avec balisage
 * FAQPage — chaque réponse est éligible aux résultats enrichis Google.
 */
const FAQ: { q: string; r: string }[] = [
  {
    q: 'Combien coûte une formation, et qui la finance ?',
    r: "Dans la plupart des cas, la formation est prise en charge en tout ou partie par votre OPCO (AKTO, OPCO EP, OPCOmmerce selon votre branche) au titre du plan de développement des compétences. Nos tarifs sont calés sur les barèmes de prise en charge de votre branche : concrètement, le reste à charge est souvent nul ou très faible. On vous accompagne dans votre demande de prise en charge, de A à Z.",
  },
  {
    q: "La formation a-t-elle lieu dans mon établissement ?",
    r: "Oui, c'est notre spécialité. Le formateur vient dans votre établissement et forme vos équipes sur leur poste de travail, avec votre matériel et vos produits. Pas de déplacement, pas de fermeture : les sessions sont calées sur vos horaires d'exploitation.",
  },
  {
    q: 'Sous quel délai peut-on démarrer une formation ?',
    r: "Après validation de votre devis et de la prise en charge, une session se planifie généralement sous 2 à 4 semaines, selon vos contraintes d'exploitation et le délai de réponse de votre financeur.",
  },
  {
    q: 'Êtes-vous certifiés Qualiopi ?',
    r: "Oui. Lab Learning est certifié Qualiopi au titre des actions de formation (certificat CERT_S1024_0345_1, délivré par CEVA SOLUTION, valable jusqu'au 04/11/2027). Cette certification est la condition pour que vos formations soient finançables par les OPCO. Nous sommes également inscrits sur la liste DRAAF pour la formation hygiène alimentaire (HACCP).",
  },
  {
    q: "L'attestation d'hygiène alimentaire est-elle officielle ?",
    r: "Oui : notre formation Hygiène alimentaire est conforme à l'arrêté du 12 février 2024 et délivre l'attestation réglementaire exigée pour les établissements de restauration commerciale. Chaque stagiaire reçoit son attestation individuelle en fin de formation.",
  },
  {
    q: 'Formez-vous des équipes non francophones ?',
    r: "Oui. Nos formateurs adaptent la pédagogie aux équipes multilingues : démonstrations au poste, supports visuels, et supports traduits lorsque c'est nécessaire (nous avons par exemple des supports d'hygiène et de prévention en bengali). Parlez-nous de votre équipe, on adapte.",
  },
  {
    q: 'Comment se passe la formation pour une personne en situation de handicap ?',
    r: "Chaque situation est étudiée en amont avec notre référent handicap : adaptation des supports, du rythme ou du poste de travail, et mobilisation de notre réseau de partenaires spécialisés (Agefiph, Cap emploi…). Signalez la situation lors du recueil du besoin, tout est anticipé avant l'entrée en formation.",
  },
  {
    q: 'Que se passe-t-il après la formation ?',
    r: "Chaque stagiaire est évalué (positionnement à l'entrée, évaluation des acquis en sortie) et reçoit son attestation de fin de formation. Vous recevez les certificats de réalisation pour votre dossier. Trois mois après, nous mesurons ce qui est réellement appliqué en poste, et nos formations peuvent se prolonger en e-learning avec notre plateforme Learnexa.",
  },
]

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
        <div className="max-w-3xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-10">
          <Kicker className="mb-5">FAQ</Kicker>
          <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance">Les questions qu&apos;on nous pose <span className="text-[#205040]">tout le temps</span></h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed">
            Financement, délais, déroulement : tout ce qu&apos;il faut savoir avant de lancer une formation.
            Il manque la vôtre ? <Link href="/site/contact" className="font-semibold text-[#205040] hover:underline">Posez-la nous directement</Link>.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 md:px-8 pb-16 space-y-3">
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
      </section>

      <section className="max-w-3xl mx-auto px-5 md:px-8 pb-20 text-center">
        <p className="text-[#57534E]">
          Une question sur votre situation précise ?{' '}
          <Link href="/site/contact" className="inline-flex items-center gap-1.5 font-semibold text-[#205040] hover:gap-2.5 transition-all">
            Contactez-nous <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </section>
    </>
  )
}
