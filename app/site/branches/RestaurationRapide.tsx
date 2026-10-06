import Link from 'next/link'
import { ArrowRight, CalendarCheck, Users, Store, MapPin, DoorOpen, TrendingUp, Network } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { guideParSlug } from '@/lib/guides'
import type { ChiffresRestaurationRapide, VilleData } from '@/lib/site-villes'

/**
 * Contenu propre à la page « Formations restauration rapide » : nos chiffres,
 * ce que la réglementation impose, les étapes où nous intervenons, le
 * financement et les questions fréquentes.
 *
 * Chaque obligation citée ici est détaillée, avec ses sources officielles,
 * dans un guide (lib/guides) : le lien n'apparaît qu'une fois le guide publié.
 */

/** Questions fréquentes de la page, aussi balisées en FAQPage. */
export const FAQ_RAPIDE: { q: string; r: string }[] = [
  {
    q: 'Quelles formations sont obligatoires en restauration rapide ?',
    r: "Au moins une personne de l'établissement doit avoir suivi la formation à l'hygiène alimentaire, d'une durée minimale de 14 heures. Chaque salarié embauché doit recevoir une formation pratique à la sécurité de son poste, et toute personne qui manipule des aliments doit disposer d'instructions ou d'une formation en hygiène adaptées. Le permis d'exploitation n'est exigé que si de l'alcool est consommé sur place.",
  },
  {
    q: "Combien de personnes faut-il former à l'hygiène alimentaire ?",
    r: "Une seule personne de l'établissement doit avoir suivi la formation de 14 heures. Beaucoup de restaurants en forment deux ou trois pour rester en règle quand un salarié s'en va. Dans un réseau, chaque établissement doit avoir sa personne formée.",
  },
  {
    q: 'La formation a-t-elle lieu dans le restaurant ?',
    r: "Oui. Le formateur vient dans votre établissement et forme l'équipe sur son poste de travail, avec votre matériel et vos produits, sur des créneaux calés sur vos horaires d'exploitation.",
  },
  {
    q: 'Qui finance la formation en restauration rapide ?',
    r: "La branche de la restauration rapide relève de l'OPCO AKTO. Pour une entreprise de moins de 50 salariés, il peut prendre en charge la formation des salariés au titre du plan de développement des compétences. Nos tarifs sont calés sur ses barèmes et nous vous accompagnons dans votre demande de prise en charge.",
  },
  {
    q: 'Formez-vous les réseaux de franchise ?',
    r: "Oui. Nous formons des réseaux de restauration rapide établissement par établissement, partout en France, avec le même programme dans chaque point de vente et un suivi pour la tête de réseau.",
  },
  {
    q: 'Sous quel délai peut-on démarrer ?',
    r: "Après validation de votre devis et de la prise en charge, une session se planifie généralement sous 2 à 4 semaines, selon vos contraintes d'exploitation et le délai de réponse de votre financeur.",
  },
]

const OBLIGATIONS: { quoi: string; qui: string; texte: string; guide?: string }[] = [
  { quoi: 'Formation hygiène alimentaire', qui: 'Au moins une personne de l’établissement', texte: '14 heures au minimum, sans durée de validité', guide: 'formation-hygiene-alimentaire-restauration-rapide' },
  { quoi: 'Hygiène au poste', qui: 'Toute personne qui manipule des aliments', texte: 'Instructions ou formation adaptées au poste' },
  { quoi: 'Document unique (DUERP)', qui: 'Toute entreprise dès le premier salarié', texte: 'Mise à jour au moins annuelle à partir de 11 salariés', guide: 'document-unique-duerp-restaurant' },
  { quoi: 'Formation à la sécurité', qui: 'Chaque salarié embauché', texte: 'Formation pratique et appropriée à son poste' },
  { quoi: 'Information sur les allergènes', qui: 'Tout établissement', texte: '14 allergènes à signaler, par écrit', guide: 'allergenes-restaurant-affichage-obligatoire' },
  { quoi: 'Permis d’exploitation', qui: 'Seulement si de l’alcool est consommé sur place', texte: '20 heures de formation, valable 10 ans', guide: 'ouvrir-restaurant-rapide-formations-obligations' },
]

const ETAPES = [
  { Icon: DoorOpen, t: 'Avant l’ouverture', d: 'Hygiène alimentaire, sécurité, prise de poste : l’équipe arrive formée au premier service, dans un restaurant qu’elle connaît déjà.' },
  { Icon: TrendingUp, t: 'Pendant l’exploitation', d: 'Managers, nouveaux équipiers, remise à niveau en hygiène : des sessions courtes, calées entre deux services, financées au titre du plan de développement des compétences.' },
  { Icon: Network, t: 'En réseau', d: 'Le même programme dans chaque établissement, partout en France, et un suivi pour la tête de réseau et ses franchisés.' },
]

const ENSEIGNES = ['Chamas Tacos', 'New School Tacos', 'Chickeez', 'Dream’s Donuts', 'Kassia Food', 'Chicken Street', 'Croust Wok', 'Tasty Crousty', 'Crousty One', 'Big Smash', 'Shake Beef']

/** Nos chiffres en restauration rapide, juste sous l'en-tête de la page. */
export function IntroRapide({ chiffres }: { chiffres: ChiffresRestaurationRapide }) {
  const blocs = [
    { Icon: CalendarCheck, valeur: chiffres.sessions, libelle: 'sessions réalisées' },
    { Icon: Users, valeur: chiffres.stagiaires, libelle: 'stagiaires formés' },
    { Icon: Store, valeur: chiffres.etablissements, libelle: 'établissements accompagnés' },
    { Icon: MapPin, valeur: chiffres.villes, libelle: 'villes en France' },
  ]
  return (
    <section className="max-w-6xl mx-auto px-5 md:px-8 pt-12 md:pt-14">
      <p className="max-w-3xl text-lg md:text-xl leading-relaxed text-[#44403C]">
        Burgers, tacos, pizzas, poulet, kebab, snacking : nous formons les équipes de restauration rapide dans leur établissement, partout en France.
        Hygiène alimentaire, prévention des risques, management, prise de poste.
      </p>
      {chiffres.sessions > 0 && (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            {blocs.map((b, i) => (
              <Reveal key={b.libelle} delay={i * 60}>
                <div className="h-full rounded-2xl bg-white ring-1 ring-black/5 p-5">
                  <b.Icon className="h-5 w-5 text-[#205040]" />
                  <div className="mt-3 font-heading text-3xl md:text-4xl font-extrabold tabular-nums text-[#14110F]">{b.valeur.toLocaleString('fr-FR')}</div>
                  <div className="mt-1 text-sm text-[#57534E]">{b.libelle}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-3 text-sm text-[#78716C]">Nos sessions terminées pour des établissements de restauration rapide, mises à jour automatiquement.</p>
        </>
      )}
    </section>
  )
}

/** Le contenu de fond de la page, sous la liste des formations. */
export function ContenuRapide({ villes }: { villes: VilleData[] }) {
  return (
    <>
      <section className="bg-[#F6F4EF]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-16">
          <Kicker className="mb-4">Réglementation</Kicker>
          <h2 className="ll-display text-2xl md:text-3xl text-[#14110F] text-balance">Ce que la réglementation impose à un restaurant rapide</h2>
          <p className="mt-4 max-w-3xl text-[#57534E] leading-relaxed">
            Un restaurant rapide est soumis aux mêmes règles qu&apos;un restaurant traditionnel. Voici celles qui touchent à la formation et à l&apos;information de vos équipes et de vos clients.
          </p>
          <div className="mt-7 overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="bg-white text-[#14110F] border-b border-black/5">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-heading font-semibold">Obligation</th>
                  <th scope="col" className="px-5 py-3.5 font-heading font-semibold">Pour qui</th>
                  <th scope="col" className="px-5 py-3.5 font-heading font-semibold">En bref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 text-[#44403C]">
                {OBLIGATIONS.map((o) => {
                  const guide = o.guide ? guideParSlug(o.guide) : null
                  return (
                    <tr key={o.quoi}>
                      <th scope="row" className="px-5 py-3.5 align-top font-semibold text-[#14110F]">
                        {guide?.publie
                          ? <Link href={`/guides/${guide.slug}`} className="text-[#205040] underline decoration-[#205040]/30 underline-offset-2 hover:decoration-[#205040]">{o.quoi}</Link>
                          : o.quoi}
                      </th>
                      <td className="px-5 py-3.5 align-top">{o.qui}</td>
                      <td className="px-5 py-3.5 align-top">{o.texte}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-16">
        <Kicker className="mb-4">Notre méthode</Kicker>
        <h2 className="ll-display text-2xl md:text-3xl text-[#14110F] text-balance">Former votre équipe à chaque étape</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {ETAPES.map((e, i) => (
            <Reveal key={e.t} delay={i * 70}>
              <div className="h-full rounded-2xl bg-white ring-1 ring-black/5 p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#205040]/8 text-[#205040]"><e.Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-heading text-lg font-bold text-[#14110F]">{e.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#57534E]">{e.d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-[#205040] text-white p-6 md:p-7">
            <h3 className="font-heading text-lg font-bold">Un financement par votre OPCO</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-white/85">
              La branche de la restauration rapide relève de l&apos;OPCO AKTO. Pour une entreprise de moins de 50 salariés, il peut prendre en charge la formation de vos salariés.
              Nos tarifs sont calés sur ses barèmes et nous vous accompagnons dans votre demande de prise en charge.
            </p>
            <Link href="/financements" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:gap-2.5 transition-all">
              Voir les financements <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-6 md:p-7">
            <h3 className="font-heading text-lg font-bold text-[#14110F]">Ils forment leurs équipes avec nous</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {ENSEIGNES.map((n) => (
                <li key={n} className="rounded-full bg-[#F6F4EF] px-3 py-1.5 text-sm text-[#44403C]">{n}</li>
              ))}
            </ul>
            <Link href="/partenaires" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
              Nos clients et partenaires <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {villes.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 md:px-8 pb-14 md:pb-16">
          <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Nous formons près de chez vous</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {villes.slice(0, 8).map((v) => (
              <Link key={v.slug} href={`/formation-restauration-rapide/${v.slug}`} className="group rounded-2xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-4 ll-lift">
                <div className="font-heading font-semibold text-[#14110F] group-hover:text-[#205040] transition-colors">{v.nom}</div>
                <div className="mt-0.5 text-xs text-[#78716C]">{v.sessions} sessions réalisées</div>
              </Link>
            ))}
          </div>
          <Link href="/formation-restauration-rapide" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
            Toutes nos villes <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      <section className="max-w-3xl mx-auto px-5 md:px-8 pb-14 md:pb-16">
        <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Questions fréquentes</h2>
        <div className="mt-6 space-y-3">
          {FAQ_RAPIDE.map((f) => (
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
    </>
  )
}
