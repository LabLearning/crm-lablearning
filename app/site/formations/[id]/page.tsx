import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Monitor, Calendar, ArrowRight, ArrowLeft, CheckCircle2, Target, Users, ListChecks, ClipboardCheck, Accessibility, ShieldCheck, BookOpen, ListView, Bulb } from '../../icons'
import { getPublicFormation, getSessionsRealiseesParTitre, normTitre, getFormationsLiees } from '@/lib/public-site-data'
import { tarifsOpcoPourFormation } from '@/lib/opco-tarifs'
import { metierStyle } from '../../metier'
import { titreFormation } from '@/lib/utils'
import { photoFormation } from '@/lib/formations-photos'
import { structurerProgramme } from '@/lib/programme-structure'
import { ProgrammeStructure } from '@/components/formations/ProgrammeStructure'

export const dynamic = 'force-dynamic'

const MODALITE: Record<string, string> = { presentiel: 'Présentiel', distanciel: 'À distance', mixte: 'Mixte' }

export async function generateMetadata({ params }: { params: { id: string } }) {
  const f = await getPublicFormation(params.id)
  if (!f) return { title: 'Formation' }
  const description = (f.sous_titre
    || (f.objectifs[0] ? `Objectifs : ${f.objectifs.slice(0, 2).join(' · ')}` : null)
    || `Formation ${titreFormation(f.intitule)} : ${f.duree_heures || ''} h, financement OPCO, certifiée Qualiopi.`)
    .slice(0, 158)
  return {
    title: titreFormation(f.intitule).slice(0, 58),
    description,
    alternates: { canonical: `/formations/${f.id}` },
    openGraph: {
      title: titreFormation(f.intitule),
      description,
      url: `/site/formations/${f.id}`,
      type: 'website',
    },
  }
}

function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <p key={i} className="text-[#57534E] leading-relaxed whitespace-pre-line">{b}</p>
      ))}
    </div>
  )
}

export default async function SiteFormationDetail({ params }: { params: { id: string } }) {
  const f = await getPublicFormation(params.id)
  if (!f) notFound()
  const [sessionsParTitre, liees] = await Promise.all([
    getSessionsRealiseesParTitre(),
    getFormationsLiees(f.id, f.categorie),
  ])
  const sessionsRealisees = sessionsParTitre.get(normTitre(f.intitule)) || 0

  // Fil d'Ariane balisé : Accueil > Formations > fiche — résultats enrichis.
  const schemaBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.lab-learning.fr/' },
      { '@type': 'ListItem', position: 2, name: 'Formations', item: 'https://www.lab-learning.fr/formations' },
      { '@type': 'ListItem', position: 3, name: titreFormation(f.intitule) },
    ],
  }
  // Le tarif public est le barème de prise en charge de la branche : nos prix
  // sont calés sur les montants OPCO, pas sur un tarif catalogue.
  const tarifsOpco = tarifsOpcoPourFormation(f)

  // Balisage Course : le prix et la durée directement dans les résultats de
  // recherche — et les moteurs génératifs savent répondre « combien coûte la
  // formation HACCP chez Lab Learning ».
  const schemaCourse = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: f.intitule,
    description: f.sous_titre || (f.objectifs[0] ? f.objectifs.join('. ').slice(0, 300) : undefined),
    provider: { '@id': 'https://crm.lab-learning.fr/site#organization' },
    ...(f.tarif_inter_ht || f.tarif_intra_ht ? {
      offers: {
        '@type': 'Offer',
        price: String(f.tarif_inter_ht || f.tarif_intra_ht),
        priceCurrency: 'EUR',
        category: f.tarif_inter_ht ? 'Par stagiaire, HT' : 'Par groupe, HT',
      },
    } : {}),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: f.modalite === 'distanciel' ? 'online' : f.modalite === 'mixte' ? 'blended' : 'onsite',
      ...(f.duree_heures ? { courseWorkload: `PT${f.duree_heures}H` } : {}),
    },
  }

  const sections: { Icon: any; title: string; content: React.ReactNode }[] = []
  if (f.public_vise) sections.push({ Icon: Users, title: 'Public visé', content: <Prose text={f.public_vise} /> })
  if (f.prerequis) sections.push({ Icon: ListView, title: 'Prérequis', content: <Prose text={f.prerequis} /> })
  if (f.programme_detaille) {
    // Jours, modules, puces et ateliers mis en forme ; un texte libre garde son rendu simple
    const programme = structurerProgramme(f.programme_detaille)
    sections.push({ Icon: BookOpen, title: 'Programme', content: programme.length > 0 ? <ProgrammeStructure groupes={programme} ton="site" /> : <Prose text={f.programme_detaille} /> })
  }
  if (f.methodes_pedagogiques) sections.push({ Icon: Bulb, title: 'Méthodes pédagogiques', content: <Prose text={f.methodes_pedagogiques} /> })
  if (f.modalites_evaluation) sections.push({ Icon: ClipboardCheck, title: 'Modalités d’évaluation', content: <Prose text={f.modalites_evaluation} /> })
  if (f.modalites_admission || f.delai_acces) {
    sections.push({
      Icon: Calendar, title: 'Modalités et délai d’accès',
      content: (
        <div className="space-y-3">
          {f.modalites_admission && <Prose text={f.modalites_admission} />}
          {f.delai_acces && <p className="text-[#57534E] leading-relaxed">{f.delai_acces}</p>}
          <p className="text-[#57534E] leading-relaxed">
            Les dates de session sont planifiées avec votre établissement, en intra comme en inter :
            contactez-nous pour un calendrier adapté à votre activité.
          </p>
        </div>
      ),
    })
  }
  if (f.accessibilite_handicap) sections.push({ Icon: Accessibility, title: 'Accessibilité', content: <Prose text={f.accessibilite_handicap} /> })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaCourse) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaBreadcrumb) }} />
      <section className="relative overflow-hidden border-b border-[#205040]/10">
        <div className="absolute inset-0 -z-10 bg-[#205040]" />
        {/* La photo en fond opacité, comme avant — le hero reste sobre */}
        <img src={photoFormation(f.id) || metierStyle(f.intitule || f.categorie || '').img} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(115deg, #205040 0%, rgba(25,81,68,0.92) 45%, rgba(18,63,52,0.75) 100%)' }} />
        <div className="absolute inset-0 -z-10 opacity-[0.15]" style={{ background: 'radial-gradient(60% 80% at 80% 0%, #6366F1 0%, transparent 60%)' }} />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-10 md:pt-14 pb-12 md:pb-16 text-white">
          <Link href="/site/formations" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Toutes les formations
          </Link>
          {f.categorie && <div className="mt-6"><span className="ll-kicker ll-kicker--light">{f.categorie}</span></div>}
          <h1 className="mt-2 ll-display text-3xl md:text-[52px] leading-[1.02] text-balance text-white max-w-3xl">{titreFormation(f.intitule)}</h1>
          {f.sous_titre && <p className="mt-4 text-lg md:text-xl text-white/75 max-w-2xl">{f.sous_titre}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {f.duree_heures ? <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm"><Clock className="h-4 w-4" />{f.duree_heures} heures</span> : null}
            {f.duree_jours ? <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm"><Calendar className="h-4 w-4" />{f.duree_jours} jour{f.duree_jours > 1 ? 's' : ''}</span> : null}
            {f.modalite ? <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm"><Monitor className="h-4 w-4" />{MODALITE[f.modalite] || f.modalite}</span> : null}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm"><ShieldCheck className="h-4 w-4" />Certifié Qualiopi</span>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-5">
          {f.objectifs.length > 0 && (
            <section className="rounded-3xl bg-white ring-1 ring-black/5 p-6 md:p-8">
              <h2 className="flex items-center gap-3 font-heading font-bold text-xl text-[#14110F] tracking-heading mb-5">
                <span className="h-10 w-10 rounded-xl bg-[#205040]/8 flex items-center justify-center shrink-0"><Target className="h-5 w-5 text-[#205040]" /></span>
                Objectifs pédagogiques
              </h2>
              <ul className="space-y-2.5">
                {f.objectifs.map((o, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[#57534E]"><CheckCircle2 className="h-5 w-5 text-[#205040] shrink-0 mt-0.5" /><span>{o}</span></li>
                ))}
              </ul>
            </section>
          )}
          {f.competences_visees.length > 0 && (
            <section className="rounded-3xl bg-white ring-1 ring-black/5 p-6 md:p-8">
              <h2 className="flex items-center gap-3 font-heading font-bold text-xl text-[#14110F] tracking-heading mb-5">
                <span className="h-10 w-10 rounded-xl bg-[#205040]/8 flex items-center justify-center shrink-0"><ListChecks className="h-5 w-5 text-[#205040]" /></span>
                Compétences visées
              </h2>
              <div className="flex flex-wrap gap-2">
                {f.competences_visees.map((c, i) => (
                  <span key={i} className="rounded-full border border-[#205040]/15 bg-[#205040]/5 px-3.5 py-1.5 text-sm text-[#205040]">{c}</span>
                ))}
              </div>
            </section>
          )}
          {sections.map((s) => (
            <section key={s.title} className="rounded-3xl bg-white ring-1 ring-black/5 p-6 md:p-8">
              <h2 className="flex items-center gap-3 font-heading font-bold text-xl text-[#14110F] tracking-heading mb-5">
                <span className="h-10 w-10 rounded-xl bg-[#205040]/8 flex items-center justify-center shrink-0"><s.Icon className="h-5 w-5 text-[#205040]" /></span>
                {s.title}
              </h2>
              {s.content}
            </section>
          ))}
        </div>

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 rounded-3xl border border-[#205040]/10 bg-white p-6">
            <div className="font-heading font-bold text-[#14110F]">Intéressé par cette formation ?</div>
            <p className="mt-1.5 text-sm text-[#57534E]">On construit le programme et on vous accompagne dans le financement.</p>
            <div className="mt-4 space-y-2 text-sm">
              {f.duree_heures ? <div className="flex items-center justify-between"><span className="text-[#78716C]">Durée</span><span className="font-medium text-[#14110F]">{f.duree_heures} h{f.duree_jours ? ` · ${f.duree_jours} j` : ''}</span></div> : null}
              {f.modalite ? <div className="flex items-center justify-between"><span className="text-[#78716C]">Modalité</span><span className="font-medium text-[#14110F]">{MODALITE[f.modalite] || f.modalite}</span></div> : null}
              {/*
                Le tarif suit le barème de prise en charge OPCO de la branche ;
                un tarif saisi au catalogue prime, une formation hors branche
                reste sur devis.
              */}
              {f.tarif_intra_ht || f.tarif_inter_ht ? (
                <div className="flex items-center justify-between"><span className="text-[#78716C]">Tarif</span><span className="font-medium text-[#14110F] text-right">{f.tarif_intra_ht ? `${Number(f.tarif_intra_ht).toLocaleString('fr-FR')} € HT (intra)` : `${Number(f.tarif_inter_ht).toLocaleString('fr-FR')} € HT / pers.`}</span></div>
              ) : tarifsOpco.length > 0 ? (
                <div className="space-y-1.5">
                  {tarifsOpco.map((t) => (
                    <div key={t.branche} className="flex items-start justify-between gap-3">
                      <span className="text-[#78716C] shrink-0">{tarifsOpco.length > 1 ? t.branche : 'Tarif'}</span>
                      <span className="font-medium text-[#14110F] text-right">{t.montant}<br /><span className="text-[11px] font-normal text-[#78716C]">{t.detail}</span></span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between"><span className="text-[#78716C]">Tarif</span><span className="font-medium text-[#14110F]">Sur devis</span></div>
              )}
              <div className="flex items-center justify-between"><span className="text-[#78716C]">Financement</span><span className="font-medium text-[#14110F]">{tarifsOpco.length > 0 ? `Possible par ${[...new Set(tarifsOpco.map((t) => t.opco))].join(' / ')}, sous réserve d’accord` : 'Possible par votre OPCO, sous réserve d’accord'}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[#78716C] shrink-0">Dates</span><span className="font-medium text-[#14110F] text-right">Planifiées avec votre établissement</span></div>
              {f.delai_acces ? <div className="flex items-start justify-between gap-3"><span className="text-[#78716C] shrink-0">Délai d’accès</span><span className="font-medium text-[#14110F] text-right">{f.delai_acces}</span></div> : null}
            </div>
            <Link href="/site/contact" className="mt-5 flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[#205040] text-white text-sm font-semibold hover:bg-[#123f34] transition-colors">
              Demander cette formation <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </div>
      {(sessionsRealisees > 0 || f.nombre_apprenants_total || f.taux_satisfaction != null || f.taux_reussite != null) && (
        <div className="max-w-6xl mx-auto px-5 md:px-8 pb-4">
          <div className="rounded-2xl bg-[#205040]/5 border border-[#205040]/15 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#205040] mb-3">Indicateurs de résultats</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {sessionsRealisees > 0 ? (
                <div><div className="ll-display text-2xl text-[#14110F]">{sessionsRealisees}</div><div className="text-xs text-[#57534E] mt-0.5">sessions réalisées</div></div>
              ) : null}
              {f.nombre_apprenants_total ? (
                <div><div className="ll-display text-2xl text-[#14110F]">{f.nombre_apprenants_total}</div><div className="text-xs text-[#57534E] mt-0.5">stagiaires formés</div></div>
              ) : null}
              {f.taux_satisfaction != null ? (
                <div><div className="ll-display text-2xl text-[#14110F]">{(f.taux_satisfaction / 20).toFixed(1)}/5</div><div className="text-xs text-[#57534E] mt-0.5">satisfaction des stagiaires</div></div>
              ) : null}
              {f.taux_reussite != null ? (
                <div><div className="ll-display text-2xl text-[#14110F]">{f.taux_reussite}%</div><div className="text-xs text-[#57534E] mt-0.5">d’acquisition des compétences</div></div>
              ) : null}
            </div>
            <p className="mt-3 text-[10px] text-[#A8A29E]">
              Indicateurs calculés sur les sessions réalisées, mis à jour en continu (questionnaires de satisfaction
              et évaluations des acquis). Un taux n&apos;est publié qu&apos;à partir de cinq réponses.{' '}
              <Link href="/site/resultats" className="underline underline-offset-2 hover:text-[#205040]">Tous nos résultats</Link>
            </p>
          </div>
        </div>
      )}
      {f.date_derniere_maj && (
        <div className="max-w-6xl mx-auto px-5 md:px-8 pb-10">
          <p className="text-xs text-[#A8A29E]">
            {f.date_conception ? `Programme conçu le ${new Date(f.date_conception).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · ` : ''}
            mis à jour le {new Date(f.date_derniere_maj).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {f.version ? ` · version ${f.version}` : ''}.
          </p>
        </div>
      )}

      {/* Maillage interne : trois formations liées, photo + durée + note */}
      {liees.length >= 2 && (
        <section className="border-t border-[#205040]/10 bg-[#FAFAFA]">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-14">
            <h2 className="ll-display text-2xl md:text-3xl text-[#14110F] mb-8">À découvrir aussi</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {liees.map((l: any) => (
                <Link key={l.id} href={`/site/formations/${l.id}`}
                  className="group flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-lg hover:shadow-black/5 ll-lift">
                  {photoFormation(l.id) && (
                    <div className="relative h-36 overflow-hidden">
                      <img loading="lazy" src={photoFormation(l.id)!} alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                  )}
                  <div className="p-5 flex items-center justify-between gap-3 flex-1">
                    <div>
                      <div className="font-heading font-semibold text-sm text-[#14110F] leading-snug">{titreFormation(l.intitule)}</div>
                      <div className="text-xs text-[#78716C] mt-1">
                        {[l.duree_heures ? `${l.duree_heures} h` : null, l.taux_satisfaction != null ? `${(l.taux_satisfaction / 20).toFixed(1)}/5` : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className="shrink-0 h-9 w-9 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] group-hover:bg-[#205040] group-hover:text-white transition-colors">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
