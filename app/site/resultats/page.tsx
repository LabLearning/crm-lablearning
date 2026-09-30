import Link from 'next/link'
import { ArrowRight, ShieldCheck } from '../icons'
import { getPublicResultats, getSessionsRealiseesParTitre, normTitre } from '@/lib/public-site-data'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { titreFormation } from '@/lib/utils'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Nos résultats',
  description:
    'Nos indicateurs de résultats publiés : satisfaction, réussite et assiduité des stagiaires, formation par formation. La transparence exigée par Qualiopi.',
  alternates: { canonical: '/resultats' },
}

export default async function SiteResultats() {
  const r = await getPublicResultats()

  // Indicateurs par formation : calculés depuis les sessions réalisées
  // (jamais saisis à la main) — seules les fiches avec assez de réponses
  // affichent un taux.
  const supabase = await createServiceRoleClient()
  const [{ data: parFormation }, sessionsParTitre] = await Promise.all([
    supabase
      .from('formations')
      .select('id, intitule, duree_heures, nombre_apprenants_total, taux_satisfaction, taux_reussite')
      .eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true)
      .not('nombre_apprenants_total', 'is', null)
      .gt('nombre_apprenants_total', 0)
      .order('nombre_apprenants_total', { ascending: false }),
    getSessionsRealiseesParTitre(),
  ])

  const stats = r ? [
    { key: 'satisfaction', label: 'Taux de satisfaction', value: r.taux_satisfaction },
    { key: 'reussite', label: 'Taux de réussite', value: r.taux_reussite },
    { key: 'assiduite', label: "Taux d'assiduité", value: r.taux_assiduite },
    { key: 'insertion', label: "Taux d'insertion / retour à l'emploi", value: r.taux_insertion },
  ].filter((s) => s.value != null) : []

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-12">
          <Kicker className="mb-5"><ShieldCheck className="h-4 w-4" /> Nos résultats</Kicker>
          <h1 className="ll-display ll-fluid-hero text-[#14110F] text-balance">
            Des résultats <span className="text-[#205040]">transparents</span>.
          </h1>
          <p className="mt-7 text-lg md:text-xl text-[#57534E] leading-relaxed max-w-2xl">
            Organisme de formation certifié Qualiopi, nous publions nos indicateurs de résultats
            {r?.periode ? <> (période <strong>{r.periode}</strong>)</> : null}.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20">
        {stats.length === 0 ? (
          <div className="rounded-2xl border border-[#205040]/10 bg-white p-10 text-center text-[#78716C]">
            Nos indicateurs de résultats seront publiés ici prochainement.
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s, i) => (
                <Reveal key={s.key} delay={(i % 4) * 80}>
                  <div className="rounded-3xl bg-white ring-1 ring-black/5 p-7 text-center">
                    <div className="ll-display text-5xl text-[#205040]">{Number(s.value)}%</div>
                    <div className="mt-3 text-sm text-[#57534E]">{s.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>

            {(r.nb_stagiaires || r.nb_sessions) && (
              <div className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-2 text-sm text-[#78716C]">
                {r.nb_stagiaires ? <span><strong className="text-[#14110F]">{r.nb_stagiaires}</strong> stagiaires formés</span> : null}
                {r.nb_sessions ? <span><strong className="text-[#14110F]">{r.nb_sessions}</strong> sessions réalisées</span> : null}
              </div>
            )}

            {r.commentaire && <p className="mt-8 text-center text-xs text-[#A8A29E] max-w-2xl mx-auto">{r.commentaire}</p>}
          </>
        )}

        {(parFormation || []).length > 0 && (
          <div className="mt-16">
            <h2 className="ll-display text-2xl md:text-3xl text-[#14110F] text-balance">Résultats par formation</h2>
            <p className="mt-3 text-[#57534E] max-w-2xl">
              Indicateurs calculés sur les sessions réalisées : stagiaires formés, satisfaction à chaud et taux
              d&apos;acquisition des compétences (évaluation de sortie). Un taux n&apos;est publié qu&apos;à partir de cinq réponses.
            </p>
            <div className="mt-7 overflow-x-auto rounded-2xl ring-1 ring-black/5 bg-white">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-[#E7E5E4] text-left">
                    <th className="px-5 py-3.5 text-xs font-semibold text-[#78716C] uppercase tracking-wider">Formation</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-[#78716C] uppercase tracking-wider text-right">Sessions réalisées</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-[#78716C] uppercase tracking-wider text-right">Stagiaires formés</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-[#78716C] uppercase tracking-wider text-right">Satisfaction</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-[#78716C] uppercase tracking-wider text-right">Acquisition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4]">
                  {(parFormation || []).map((f: any) => (
                    <tr key={f.id} className="hover:bg-[#FAFAF9] transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/site/formations/${f.id}`} className="text-[#14110F] hover:text-[#205040] transition-colors">
                          {titreFormation(f.intitule)}
                        </Link>
                        {f.duree_heures ? <span className="block text-xs text-[#A8A29E] mt-0.5">{f.duree_heures} heures</span> : null}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#14110F]">{sessionsParTitre.get(normTitre(f.intitule)) || '·'}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#14110F] font-semibold">{f.nombre_apprenants_total}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#205040] font-semibold">{f.taux_satisfaction != null ? `${f.taux_satisfaction} %` : '·'}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#205040] font-semibold">{f.taux_reussite != null ? `${f.taux_reussite} %` : '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-14 rounded-[28px] bg-[#205040] text-white px-6 md:px-14 py-12 md:flex items-center justify-between gap-8">
          <div>
            <h2 className="ll-display text-2xl md:text-3xl text-balance text-white">Envie de former vos équipes ?</h2>
            <p className="mt-3 text-white/70 max-w-xl">Parlons de votre projet : on construit le parcours et on vous accompagne dans le financement.</p>
          </div>
          <Link href="/site/contact" className="mt-6 md:mt-0 shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#205040] text-sm font-semibold hover:bg-[#F6F4EF] transition-colors">
            Nous contacter <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
