import type { Metadata } from 'next'
import Link from 'next/link'
import { Hygiene, FirstAid, ChefHat, Management, UserCheck, CheckCircle2, MapPin, Briefcase, GraduationCap, ArrowRight } from '../icons'
import { emettreHorodatage } from '@/lib/inscription-formateur-garde'
import { CandidatureForm } from './CandidatureForm'
import { CLE_GARDE_CANDIDATURE, POSTES_CANDIDATURE, EMAIL_RECRUTEMENT } from './candidature'

// La page émet un horodatage signé pour le formulaire : elle est rendue à chaque visite
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Devenez formateur en restauration',
  description:
    'Lab Learning recrute des formateurs indépendants : hygiène HACCP, sécurité au travail, métiers de bouche, management. Fiches de poste et candidature.',
  alternates: { canonical: '/recrutement' },
}

interface Poste {
  pdf: string
  icone: React.ComponentType<{ className?: string }>
  titre: string
  accroche: string
  missions: string[]
  profil: string[]
  zones: string
}

/** Les fiches de poste reflètent le vrai vivier : les mêmes familles que le
 *  catalogue. Le recrutement suit l'exigence Qualiopi (ind. 21/22) : CV,
 *  diplômes et références vérifiés à l'entrée, compétences réévaluées. */
const POSTES: Poste[] = [
  {
    icone: Hygiene,
    titre: 'Formateur·rice Hygiène alimentaire & HACCP',
    pdf: '/site/documents/fiches-poste/formateur-hygiene-alimentaire-haccp.pdf',
    accroche: "Vous formez les équipes de restaurants, boucheries et boulangeries aux bonnes pratiques d'hygiène, à la méthode HACCP et au plan de maîtrise sanitaire.",
    missions: [
      "Animer des sessions intra-entreprise d'1 à 3 jours (hygiène alimentaire, PMS, nettoyage-désinfection, traçabilité, allergènes)",
      'Adapter le contenu au terrain : restauration rapide, traditionnelle, métiers de bouche',
      "Évaluer les acquis (positionnement d'entrée, évaluation de sortie) et tenir l'émargement dans nos outils",
      'Remettre un rapport de fin de session',
    ],
    profil: [
      "3 ans d'expérience minimum en hygiène alimentaire ou en qualité agroalimentaire",
      'Formation HACCP attestée (ROFHYA apprécié) ; expérience de la formation pour adultes',
      "Aisance avec les publics de terrain, y compris en français langue seconde",
    ],
    zones: 'Interventions dans toute la France, fortes demandes en Occitanie, Île-de-France, Auvergne-Rhône-Alpes',
  },
  {
    icone: FirstAid,
    titre: 'Formateur·rice Prévention & Sécurité au travail',
    pdf: '/site/documents/fiches-poste/formateur-prevention-securite.pdf',
    accroche: 'Vous accompagnez les établissements sur le DUERP, les gestes et postures, le SST et la sécurité incendie.',
    missions: [
      "Animer les formations DUERP, prévention des risques professionnels, gestes & postures, SST, sécurité incendie",
      "Conduire l'analyse des risques avec le gérant et les équipes",
      'Évaluer les acquis et documenter la session dans nos outils',
    ],
    profil: [
      'Certification de formateur SST (INRS) ou équivalent pour les modules concernés, habilitations à jour',
      "Expérience en prévention des risques (IPRP, HSE, ergonomie…)",
      'Pédagogie active, cas concrets tirés du secteur CHR',
    ],
    zones: 'Interventions dans toute la France',
  },
  {
    icone: ChefHat,
    titre: 'Formateur·rice Métiers de bouche',
    pdf: '/site/documents/fiches-poste/formateur-metiers-de-bouche.pdf',
    accroche: 'Boucherie, boulangerie, pâtisserie, cuisine, barista : vous transmettez le geste professionnel en situation réelle, dans le laboratoire ou la cuisine du client.',
    missions: [
      'Animer des formations techniques en établissement (découpe, panification, pâtisserie, préparation culinaire, café)',
      "Positionner le niveau d'entrée de chaque stagiaire et mesurer la progression",
      'Conseiller le gérant sur les organisations de production',
    ],
    profil: [
      "5 ans d'expérience métier minimum (CAP/BP/BM ou expérience équivalente démontrée)",
      "Une expérience de transmission (tutorat, apprentissage, formation) est exigée",
      'Autonomie et adaptation aux contraintes de service',
    ],
    zones: 'Interventions dans toute la France, planification adaptée aux jours de fermeture des établissements',
  },
  {
    icone: Management,
    titre: 'Formateur·rice Management & Gestion en restauration',
    pdf: '/site/documents/fiches-poste/formateur-management-gestion.pdf',
    accroche: 'Vous formez gérants et responsables : management des équipes, rentabilité, coûts matières, relation client, développement commercial.',
    missions: [
      'Animer les formations management, gestion & rentabilité, relation client et développement commercial',
      "Travailler sur les chiffres réels de l'établissement (coûts matières, marges, plans d'action)",
      'Structurer un plan de progression avec le dirigeant',
    ],
    profil: [
      "Expérience de direction ou d'accompagnement d'établissements CHR",
      'Solides bases en gestion (P&L restauration) et en conduite du changement',
      'Posture de consultant-formateur, écoute et exigence',
    ],
    zones: 'Interventions dans toute la France',
  },
  {
    icone: UserCheck,
    titre: 'Formateur·rice-accompagnateur·rice prise de poste',
    pdf: '/site/documents/fiches-poste/formateur-accompagnateur-prise-de-poste.pdf',
    accroche: "Vous préparez des candidats à leur prise de poste d'équipier polyvalent en restauration rapide, en lien avec l'employeur.",
    missions: [
      "Animer des parcours de plusieurs semaines : hygiène, sécurité, gestes métier, posture professionnelle",
      "Évaluer chaque semaine la progression des candidats (grilles hebdomadaires) et conduire le bilan final avec le tuteur et l'employeur",
      "Coordonner avec le gestionnaire Lab Learning le suivi administratif du parcours",
    ],
    profil: [
      'Expérience en restauration rapide (management ou exploitation) ET en formation/insertion',
      'Rigueur documentaire : ces parcours exigent un suivi précis',
      'Goût pour les publics en insertion professionnelle',
    ],
    zones: 'Missions longues (4 à 6 semaines) sur site, France entière selon les ouvertures',
  },
]

/** Le parcours d'un candidat, de la candidature à la première mission. */
const ETAPES_RECRUTEMENT = [
  { t: 'Vous postulez', d: 'Trois courtes étapes, deux minutes. Votre CV peut suivre plus tard.' },
  { t: 'Nous étudions votre profil', d: 'Parcours, compétences, références : chaque candidature est lue, puis nous échangeons avec vous.' },
  { t: 'Vous animez vos premières sessions', d: 'Programmes et supports fournis. Vos premières interventions sont suivies et évaluées.' },
]

export default function RecrutementPage({ searchParams }: { searchParams: { poste?: string } }) {
  const posteInitial = POSTES_CANDIDATURE.some((p) => p.cle === searchParams?.poste) ? String(searchParams.poste) : null
  return (
    <>
      <section className="max-w-4xl mx-auto px-5 md:px-8 pt-16 md:pt-20 pb-4">
        <span className="ll-kicker">Recrutement</span>
        <h1 className="mt-4 ll-display ll-fluid-h1 text-[#14110F] text-balance">
          Devenez formateur Lab Learning
        </h1>
        <p className="mt-4 text-[#57534E] leading-relaxed max-w-2xl">
          Organisme de formation certifié Qualiopi, nous formons chaque année des centaines de
          professionnels de la restauration et des métiers de bouche, sur leur lieu de travail.
          Nous recherchons des formateurs indépendants exigeants, praticiens de leur métier,
          pour intervenir en sous-traitance dans toute la France.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#57534E]">
          <span className="inline-flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> Statut indépendant, contrat de prestation par session</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Interventions en entreprise, France entière</span>
          <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> Outils fournis : programmes, supports, émargement et évaluations en ligne</span>
        </div>
        <a href="#postuler" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#205040] px-6 text-sm font-semibold text-white hover:bg-[#1a4335] transition-colors">
          Postuler en 2 minutes <ArrowRight className="h-4 w-4" />
        </a>
      </section>

      <section className="max-w-4xl mx-auto px-5 md:px-8 py-10 space-y-6">
        {POSTES.map((p, i) => {
          const Icone = p.icone
          const cle = POSTES_CANDIDATURE[i]?.cle
          return (
            <article key={p.titre} className="rounded-2xl border border-[#E7E5E4] bg-white p-6 md:p-8">
              <div className="flex items-start gap-4">
                <span className="h-11 w-11 rounded-xl bg-[#205040]/10 text-[#205040] flex items-center justify-center shrink-0">
                  <Icone className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="ll-display text-lg md:text-xl text-[#14110F]">{p.titre}</h2>
                  <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{p.accroche}</p>
                </div>
              </div>
              <div className="mt-5 grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#205040] mb-2">Vos missions</div>
                  <ul className="space-y-1.5">
                    {p.missions.map((m) => (
                      <li key={m} className="flex gap-2 text-sm text-[#57534E]">
                        <CheckCircle2 className="h-4 w-4 text-[#205040] shrink-0 mt-0.5" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#205040] mb-2">Profil recherché</div>
                  <ul className="space-y-1.5">
                    {p.profil.map((m) => (
                      <li key={m} className="flex gap-2 text-sm text-[#57534E]">
                        <CheckCircle2 className="h-4 w-4 text-[#205040] shrink-0 mt-0.5" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-[#78716C]">{p.zones}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <a href={p.pdf} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] underline underline-offset-4 decoration-[#205040]/30 hover:decoration-[#205040]">
                    Fiche de poste (PDF)
                  </a>
                  <Link href={`/recrutement?poste=${cle}#postuler`} scroll={false}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#205040] px-5 text-sm font-semibold text-white hover:bg-[#1a4335] transition-colors">
                    Postuler à ce poste <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section id="postuler" className="scroll-mt-24 bg-[#F6F4EF]">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-14 md:py-16">
          <span className="ll-kicker">Candidature</span>
          <h2 className="mt-4 ll-display text-2xl md:text-3xl text-[#14110F] text-balance">Postulez en deux minutes</h2>
          <p className="mt-3 max-w-2xl text-[#57534E] leading-relaxed">
            Pas de lettre de motivation ni de compte à créer. Dites-nous qui vous êtes et ce que vous savez transmettre ; nous vous recontactons.
          </p>
          <ol className="mt-7 grid gap-3 md:grid-cols-3">
            {ETAPES_RECRUTEMENT.map((e, i) => (
              <li key={e.t} className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
                <div className="font-heading text-sm font-bold text-[#205040] tabular-nums">Étape {i + 1}</div>
                <div className="mt-1 font-heading font-semibold text-[#14110F]">{e.t}</div>
                <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{e.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <CandidatureForm key={posteInitial || 'spontanee'} jetonPage={emettreHorodatage(CLE_GARDE_CANDIDATURE)} posteInitial={posteInitial} />
          </div>
          <p className="mt-5 text-sm text-[#78716C] leading-relaxed">
            Conformément à notre démarche qualité (Qualiopi), chaque candidature fait l&apos;objet d&apos;une vérification des compétences :
            analyse du dossier, entretien, puis évaluation continue sur les premières sessions.
            Vous préférez écrire ? <a href={`mailto:${EMAIL_RECRUTEMENT}?subject=Candidature formateur`} className="font-semibold text-[#205040] underline underline-offset-2">{EMAIL_RECRUTEMENT}</a>
          </p>
        </div>
      </section>
    </>
  )
}
