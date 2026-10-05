import Link from 'next/link'
import { ArrowRight, Hygiene, FirstAid, Management, Bulb, CheckCircle2 } from '../icons'
import { getBranchesData } from '@/lib/public-site-data'
import { BRANCHES } from '../branches'
import { MetierVisual } from '../MetierVisual'
import { Reveal } from '../Reveal'
import { Kicker } from '../Kicker'
import { altFormation } from '../alt'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Formations restauration rapide et CHR',
  description:
    'Catalogue Lab Learning : hygiène alimentaire HACCP, sécurité, management et métiers de bouche. Formations en établissement, partout en France, éligibles OPCO.',
  alternates: { canonical: '/formations' },
}

/**
 * La page présente L'OFFRE, pas le catalogue : ce que Lab Learning fait le
 * plus (hygiène alimentaire et prévention des risques, déclinées par
 * secteur), puis le management et l'IA. Le détail complet
 * reste accessible par métier.
 */
const SECTEURS = [
  { slug: 'restauration-rapide', label: 'Restauration rapide' },
  { slug: 'restaurant-hcr', label: 'Restaurant · HCR' },
  { slug: 'boucherie-charcuterie', label: 'Boucherie' },
  { slug: 'boulangerie-patisserie', label: 'Boulangerie · Pâtisserie' },
]

const PHARES = [
  {
    Icon: Hygiene,
    photo: '/site/formations/8ecde6a5-2c18-4986-a4f9-8284f0a8ed04.webp',
    titre: 'Hygiène alimentaire & HACCP',
    texte:
      "Notre cœur d'activité : bonnes pratiques d'hygiène, méthode HACCP, plan de maîtrise sanitaire, nettoyage-désinfection, traçabilité et étiquetage, sur votre lieu de travail, avec vos équipes, adapté à votre production.",
    points: ['Formation en établissement, sans fermer', 'Attestation d’hygiène conforme à l’arrêté du 12/02/2024', 'Déclinée par secteur d’activité'],
    secteurs: true,
    accent: '#205040',
  },
  {
    Icon: FirstAid,
    photo: '/site/formations/a2ebdd72-170c-4baa-b7a0-e7d8e5f7418d.webp',
    titre: 'Prévention des risques professionnels',
    texte:
      "DUERP, gestes & postures, sauveteur secouriste du travail, sécurité incendie : la sécurité de vos équipes, traitée avec le même sérieux que celle de vos clients, déclinée selon les risques réels de votre secteur.",
    points: ['Document unique construit avec vous', 'Formations SST et incendie certifiées', 'Déclinée par secteur d’activité'],
    secteurs: true,
    accent: '#B45309',
  },
  {
    Icon: Management,
    photo: '/site/formations/c9320e26-90c7-4e89-8654-651690927de3.webp',
    titre: 'Management & gestion en restauration',
    texte:
      "Rentabilité, coûts matières, management d'équipe, relation client, développement commercial : des formations pour gérants et responsables, travaillées sur les chiffres réels de votre établissement.",
    points: ['Sur vos propres chiffres', 'Plans d’action concrets et mesurables'],
    lien: { href: '/branches/restaurant-hcr', label: 'Voir les formations gestion' },
    accent: '#1D4ED8',
  },
  {
    Icon: Bulb,
    photo: '/site/formations/5facf6ca-108c-45a6-8809-bb5276169ec7.webp',
    titre: 'Intelligence artificielle au quotidien',
    texte:
      "Découvrir et utiliser l'IA dans votre commerce : gagner du temps sur les tâches administratives, la communication, les réseaux sociaux et la relation client, sans jargon, avec des cas concrets de votre métier.",
    points: ['Initiation accessible à tous', 'Cas pratiques de votre établissement'],
    lien: { href: '/contact', label: 'En parler avec nous' },
    accent: '#6D28D9',
  },
]

export default async function SiteFormations() {
  const data = await getBranchesData()
  const bySlug = new Map(data.map((d) => [d.slug, d]))

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-12">
          <Kicker className="mb-5">Nos formations</Kicker>
          <h1 className="ll-display ll-fluid-hero text-[#14110F] text-balance">
            Ce qu&apos;on fait <span className="text-[#205040]">le mieux</span>
          </h1>
          <p className="mt-7 text-lg md:text-xl text-[#57534E] leading-relaxed max-w-2xl">
            Hygiène alimentaire, prévention des risques, montée en compétences des équipes :
            des formations en établissement, adaptées à votre secteur, financées par votre OPCO.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-6 space-y-5">
        {PHARES.map((p, i) => (
          <Reveal key={p.titre} delay={(i % 2) * 80}>
            <article className="group rounded-3xl bg-white ring-1 ring-black/5 hover:ring-black/10 ll-lift overflow-hidden">
              {/* En-tête photo façon tuiles métier de l'accueil : image + teinte
                  de la formation + scrim, titre posé sur la photo. */}
              <div className="relative h-48 md:h-56 overflow-hidden">
                <img loading="lazy" src={(p as any).photo} alt={altFormation(p.titre)}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(155deg, ${p.accent}99 0%, ${p.accent}26 55%, transparent 100%)` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-0 p-5 md:p-7 flex flex-col justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/25 self-start">
                    <p.Icon className="h-5 w-5 text-white" />
                  </span>
                  <h2 className="ll-display text-2xl md:text-3xl text-white drop-shadow-md text-balance">{p.titre}</h2>
                </div>
              </div>
              <div className="p-6 md:p-8 md:pt-6">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-[#57534E] leading-relaxed max-w-3xl">{p.texte}</p>
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-1.5 text-sm text-[#44403C]">
                        <span className="shrink-0 inline-flex" style={{ color: p.accent }}>
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                  {p.secteurs ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {SECTEURS.map((s) => (
                        <Link key={s.slug} href={`/branches/${s.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-[#FAFAF9] px-4 py-2 text-sm font-medium text-[#44403C] hover:border-[#205040]/40 hover:text-[#205040] transition-colors">
                          {s.label}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ))}
                    </div>
                  ) : p.lien ? (
                    <Link href={p.lien.href}
                      className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: p.accent }}>
                      {p.lien.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 py-14">
        <div className="mb-7">
          <Kicker className="mb-3">Par métier</Kicker>
          <h2 className="ll-display ll-fluid-h1 text-[#14110F]">Explorer selon votre activité</h2>
          <p className="mt-3 text-[#57534E] max-w-xl">
            Chaque secteur a sa page : les formations faites pour vous et le financement auquel vous avez droit.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {BRANCHES.map((b, i) => {
            const d = bySlug.get(b.slug)
            return (
              <Reveal key={b.slug} delay={(i % 2) * 90}>
                <Link href={`/branches/${b.slug}`} className="group block rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-lg ll-lift">
                  <MetierVisual nom={b.label} label={b.label} height="h-52 md:h-60" />
                  <div className="p-5 md:p-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-[#57534E]">{b.tagline}</div>
                      {d && <div className="text-xs text-[#A8A29E] mt-1">{d.total} formation{d.total > 1 ? 's' : ''} pour ce métier</div>}
                    </div>
                    <span className="shrink-0 h-10 w-10 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] group-hover:bg-[#205040] group-hover:text-white transition-colors">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-[#78716C]">
          Vous ne trouvez pas votre secteur ? <Link href="/contact" className="font-semibold text-[#205040] hover:underline">Parlons-en</Link> : on construit du sur-mesure.
        </p>
      </section>
    </>
  )
}
