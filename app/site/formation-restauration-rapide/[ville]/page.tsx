import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Banknote, MapPin, Users, Store, CalendarCheck } from '../../icons'
import { Reveal } from '../../Reveal'
import { Kicker } from '../../Kicker'
import { titreFormation } from '@/lib/utils'
import { aVille, getVille, getVilles } from '@/lib/site-villes'
import { lienWhatsapp } from '../../whatsapp'
import { jsonLd } from '../../jsonld'

export const dynamic = 'force-dynamic'

const BASE = 'https://www.lab-learning.fr'

export async function generateMetadata({ params }: { params: { ville: string } }) {
  const v = await getVille(params.ville)
  if (!v) return { title: 'Formation restauration rapide' }
  const titre = `Formation restauration rapide ${aVille(v.nom)}`
  const description = `Hygiène alimentaire, prévention des risques, management : nos formations en restauration rapide ${aVille(v.nom)}. ${v.sessions} sessions réalisées. Qualiopi, éligible OPCO.`
  return {
    // Au-delà de 45 caractères, le suffixe « | Lab Learning » ferait couper le titre par les moteurs
    title: titre.length <= 45 ? titre : { absolute: titre },
    description: description.length <= 158 ? description : `Nos formations en restauration rapide ${aVille(v.nom)} : hygiène alimentaire, prévention des risques, management. Qualiopi, éligible OPCO.`,
    alternates: { canonical: `/formation-restauration-rapide/${v.slug}` },
  }
}

export default async function SiteVille({ params }: { params: { ville: string } }) {
  const [v, toutes] = await Promise.all([getVille(params.ville), getVilles()])
  if (!v) notFound()

  const ou = aVille(v.nom)
  const voisines = toutes.filter((x) => x.slug !== v.slug && x.departement === v.departement)
  const autres = toutes.filter((x) => x.slug !== v.slug && x.departement !== v.departement).slice(0, 8 - Math.min(voisines.length, 4))
  const proches = [...voisines.slice(0, 4), ...autres]

  const faq = [
    {
      q: `Le formateur se déplace-t-il ${ou} ?`,
      r: `Oui. Nos formations se déroulent dans votre établissement, ${ou} comme partout en France : le formateur forme votre équipe sur son poste de travail, avec votre matériel et vos produits, sur des créneaux calés sur vos horaires d'exploitation.`,
    },
    {
      q: 'La formation est-elle prise en charge ?',
      r: "Dans la plupart des cas, la formation est prise en charge en tout ou partie par votre OPCO au titre du plan de développement des compétences. Nos tarifs sont calés sur les barèmes de votre branche et nous vous accompagnons dans votre demande de prise en charge.",
    },
    {
      q: 'Sous quel délai peut-on démarrer ?',
      r: "Après validation de votre devis et de la prise en charge, une session se planifie généralement sous 2 à 4 semaines, selon vos contraintes d'exploitation et le délai de réponse de votre financeur.",
    },
  ]

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Formation restauration rapide par ville', item: `${BASE}/formation-restauration-rapide` },
        { '@type': 'ListItem', position: 3, name: v.nom },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `Formation restauration rapide ${ou}`,
      serviceType: 'Formation professionnelle en restauration rapide',
      provider: { '@id': `${BASE}/#organization` },
      areaServed: { '@type': 'City', name: v.nom },
      url: `${BASE}/formation-restauration-rapide/${v.slug}`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
    },
  ]

  const chiffres = [
    { Icon: CalendarCheck, valeur: v.sessions, libelle: `session${v.sessions > 1 ? 's' : ''} réalisée${v.sessions > 1 ? 's' : ''} ${ou}` },
    { Icon: Users, valeur: v.stagiaires, libelle: `stagiaire${v.stagiaires > 1 ? 's' : ''} formé${v.stagiaires > 1 ? 's' : ''}` },
    { Icon: Store, valeur: v.etablissements, libelle: `établissement${v.etablissements > 1 ? 's' : ''} accompagné${v.etablissements > 1 ? 's' : ''}` },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />

      <section className="relative overflow-hidden border-b border-[#205040]/10">
        <img src="/site/metiers/rapide.webp" alt={`Formation restauration rapide ${ou}`} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(120deg, #9A3412E6 0%, #EA580CB3 55%, rgba(0,0,0,0.55) 100%)' }} />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-10 md:pt-14 pb-14 md:pb-20 text-white">
          <Link href="/formation-restauration-rapide" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Toutes nos villes
          </Link>
          <div className="mt-6"><span className="ll-kicker ll-kicker--light">Formation en établissement</span></div>
          <h1 className="mt-2 ll-display ll-fluid-hero text-balance text-white">Formation restauration rapide {ou}</h1>
          <p className="mt-4 text-lg md:text-xl text-white/85 max-w-2xl">
            Hygiène alimentaire, prévention des risques, management : nous formons les équipes de restauration rapide {ou}, directement dans leur établissement.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur-sm"><MapPin className="h-4 w-4" />{v.nomDepartement ? `${v.nomDepartement} (${v.departement})` : v.nom}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur-sm"><ShieldCheck className="h-4 w-4" />Certifié Qualiopi</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur-sm"><Banknote className="h-4 w-4" />Éligible OPCO</span>
          </div>
        </div>
      </section>

      {/* Nos chiffres dans cette ville, tirés des sessions réalisées */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-14">
        <Kicker className="mb-4">Sur le terrain</Kicker>
        <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Ce que nous avons déjà fait {ou}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {chiffres.map((c, i) => (
            <Reveal key={c.libelle} delay={i * 70}>
              <div className="h-full rounded-2xl bg-white ring-1 ring-black/5 p-5">
                <c.Icon className="h-5 w-5 text-[#205040]" />
                <div className="mt-3 font-heading text-4xl font-extrabold tabular-nums text-[#14110F]">{c.valeur.toLocaleString('fr-FR')}</div>
                <div className="mt-1 text-sm text-[#57534E]">{c.libelle}</div>
              </div>
            </Reveal>
          ))}
        </div>
        {v.depuis && (
          <p className="mt-4 text-sm text-[#78716C]">
            Chiffres issus de nos sessions réalisées {ou} depuis {v.depuis}, mis à jour automatiquement.
          </p>
        )}
      </section>

      {v.formations.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 md:px-8 pb-12 md:pb-14">
          <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Les formations les plus suivies {ou}</h2>
          <ul className="mt-6 divide-y divide-[#205040]/10 rounded-2xl bg-white ring-1 ring-black/5">
            {v.formations.map((f) => {
              const contenu = (
                <>
                  <span className="flex-1 min-w-0 font-heading font-semibold text-[#14110F]">{titreFormation(f.intitule)}</span>
                  <span className="shrink-0 text-sm tabular-nums text-[#78716C]">{f.sessions} session{f.sessions > 1 ? 's' : ''}</span>
                  {f.id && <ArrowRight className="h-4 w-4 shrink-0 text-[#205040]" />}
                </>
              )
              return (
                <li key={f.intitule}>
                  {f.id
                    ? <Link href={`/formations/${f.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-[#205040]/[0.03] transition-colors">{contenu}</Link>
                    : <div className="flex items-center gap-4 px-5 py-4">{contenu}</div>}
                </li>
              )
            })}
          </ul>
          <p className="mt-4 text-sm text-[#57534E]">
            D&apos;autres besoins ? <Link href="/branches/restauration-rapide" className="font-semibold text-[#205040] hover:underline">Voir toutes nos formations restauration rapide</Link>.
          </p>
        </section>
      )}

      <section className="bg-[#F6F4EF]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-14">
          <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Comment se passe une formation {ou}</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { t: 'On part de votre besoin', d: 'Un échange pour comprendre votre établissement, votre équipe et vos obligations. Le programme est ajusté à votre activité.' },
              { t: 'On vous accompagne pour le financement', d: 'Nous préparons avec vous la demande de prise en charge auprès de votre OPCO. Nos tarifs sont calés sur ses barèmes.' },
              { t: 'Le formateur vient chez vous', d: `La formation a lieu dans votre établissement ${ou}, sur vos horaires, avec votre matériel. Chaque stagiaire reçoit son attestation.` },
            ].map((e, i) => (
              <li key={e.t} className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
                <div className="font-heading text-sm font-bold text-[#205040] tabular-nums">Étape {i + 1}</div>
                <div className="mt-1.5 font-heading font-semibold text-[#14110F]">{e.t}</div>
                <p className="mt-2 text-sm text-[#57534E] leading-relaxed">{e.d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-[#57534E]">
            Tout sur la prise en charge : <Link href="/financements" className="font-semibold text-[#205040] hover:underline">les financements de votre formation</Link>.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-14">
        <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Questions fréquentes</h2>
        <div className="mt-6 space-y-3">
          {faq.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-white ring-1 ring-black/5 open:ring-[#205040]/20">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4">
                <span className="font-heading font-semibold text-[#14110F]">{f.q}</span>
                <span className="shrink-0 h-8 w-8 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] transition-transform group-open:rotate-90"><ArrowRight className="h-4 w-4" /></span>
              </summary>
              <div className="px-5 pb-5 -mt-1 text-[15px] text-[#57534E] leading-relaxed">{f.r}</div>
            </details>
          ))}
        </div>
      </section>

      {proches.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 md:px-8 pb-12 md:pb-14">
          <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Nous formons aussi près de chez vous</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {proches.map((x) => (
              <Link key={x.slug} href={`/formation-restauration-rapide/${x.slug}`} className="group rounded-2xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-4 ll-lift">
                <div className="font-heading font-semibold text-[#14110F] group-hover:text-[#205040] transition-colors">{x.nom}</div>
                <div className="mt-0.5 text-xs text-[#78716C]">{x.nomDepartement ? `${x.nomDepartement} · ` : ''}{x.sessions} sessions réalisées</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20">
        <div className="rounded-3xl bg-[#205040] text-white p-7 md:p-10">
          <h2 className="ll-display text-2xl md:text-3xl text-white">Former votre équipe {ou}</h2>
          <p className="mt-3 text-white/85 max-w-2xl">Dites-nous combien de personnes sont à former et sur quoi : nous revenons vers vous avec un programme et un calendrier.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#205040] hover:bg-white/90 transition-colors">
              Demander un devis <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={lienWhatsapp(`Bonjour, je souhaite former mon équipe ${ou}.`)} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full ring-1 ring-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Nous écrire sur WhatsApp
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            {['Formation dans votre établissement', 'Certifié Qualiopi', 'Accompagnement à la prise en charge'].map((x) => (
              <li key={x} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{x}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
