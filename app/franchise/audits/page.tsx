import Link from 'next/link'
import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFranchiseAuditsListe, syntheseAuditsListe, type AuditDetail } from '@/lib/franchise-data'
import { ClipboardCheck, ShieldCheck, TrendingUp, Building2 } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

function couleurScore(score: number | null): string {
  if (score == null) return 'text-surface-400'
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-rose-600'
}

function styleMention(mention: string | null): string {
  if (!mention) return 'bg-surface-100 text-surface-600'
  if (/SATISFAISANT/i.test(mention)) return 'bg-emerald-50 text-emerald-700'
  if (/INSUFFISANT/i.test(mention)) return 'bg-rose-50 text-rose-700'
  return 'bg-amber-50 text-amber-700'
}

/**
 * Audits hygiène du réseau, alimentés par l'outil terrain.
 * La page lisait audits_etablissement, restée vide depuis sa création : les
 * audits réels vivent dans les tables ah_*.
 */
export default async function FranchiseAuditsPage() {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  const liste = await getFranchiseAuditsListe(supabase, franchise.id, orgId)
  const bilan = syntheseAuditsListe(liste)

  // Regroupement par fiche de l'outil et non par client : deux fiches pour un
  // même établissement ont chacune leur parcours, les mélanger donnerait des
  // évolutions qui ne veulent rien dire.
  const groupes = new Map<string, AuditDetail[]>()
  for (const a of liste) {
    if (!groupes.has(a.sourceId)) groupes.set(a.sourceId, [])
    groupes.get(a.sourceId)!.push(a)
  }
  const parEtablissement = [...groupes.values()].sort((a, b) => String(b[0].date).localeCompare(String(a[0].date)))

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Audits hygiène</h1>
        <p className="text-surface-500 text-sm mt-1">
          Chaque établissement est noté sur 100 lors d&apos;un premier passage, puis réaudité pour mesurer ce qui a changé.
        </p>
      </div>

      {liste.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <ClipboardCheck className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucun audit réalisé dans votre réseau pour le moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Repere value={String(bilan.nbAudits)} label="Audits réalisés" />
            <Repere value={String(bilan.nbEtablissements)} label="Établissements audités" />
            <Repere value={bilan.moyenneEntree != null ? `${bilan.moyenneEntree}` : '—'} label="Moyenne au premier passage" />
            <Repere value={bilan.moyenneSortie != null ? `${bilan.moyenneSortie}` : '—'} label="Moyenne après suivi" accent />
          </div>

          {bilan.progression != null && bilan.progression > 0 && (
            <div className="card p-4 flex items-center gap-3 bg-emerald-50/40 border-emerald-100">
              <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-sm">
                <span className="font-semibold text-surface-900">+{bilan.progression} points en moyenne</span>
                <span className="text-surface-500"> entre le premier audit et le dernier suivi, sur {bilan.nbSuivis} établissement{bilan.nbSuivis > 1 ? 's' : ''} réaudité{bilan.nbSuivis > 1 ? 's' : ''}, dont {bilan.nbEnHausse} en progression.</span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {parEtablissement.map((audits) => {
              const tete = audits[0]
              const premier = audits[audits.length - 1]
              const gain = tete.score != null && premier.score != null && audits.length > 1
                ? Math.round((tete.score - premier.score) * 10) / 10 : null
              return (
                <div key={tete.sourceId} className="card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-heading font-semibold text-surface-900 truncate">
                        {tete.clientId
                          ? <Link href={`/franchise/etablissements/${tete.clientId}`} className="hover:text-brand-600">{tete.etablissement}</Link>
                          : tete.etablissement}
                      </div>
                      <div className="text-xs text-surface-500">
                        {tete.ville || ''}{tete.ville ? ' · ' : ''}{audits.length} audit{audits.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    {gain != null && (
                      <span className={`text-sm font-semibold shrink-0 ${gain > 0 ? 'text-emerald-600' : 'text-surface-400'}`}>
                        {gain > 0 ? '+' : ''}{gain} pts
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-surface-100">
                    {audits.map((a) => (
                      <div key={a.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-surface-900">
                              {a.type || `Audit ${a.rang}`}
                              {a.evolution != null && (
                                <span className={`ml-2 text-xs font-semibold ${a.evolution > 0 ? 'text-emerald-600' : a.evolution < 0 ? 'text-rose-600' : 'text-surface-400'}`}>
                                  {a.evolution > 0 ? '+' : ''}{a.evolution} pts
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-surface-500">
                              {fmtDate(a.date)}
                              {a.rapport ? ` · ${a.rapport}` : ''}
                              {a.formateur ? ` · ${a.formateur}` : ''}
                            </div>
                          </div>
                          {a.mention && (
                            <span className={`text-[11px] font-semibold px-2 py-1 rounded-md shrink-0 ${styleMention(a.mention)}`}>
                              {a.mention}
                            </span>
                          )}
                          <div className={`text-lg font-heading font-bold tabular-nums shrink-0 w-20 text-right ${couleurScore(a.score)}`}>
                            {a.score != null ? `${a.score}/100` : '—'}
                          </div>
                        </div>

                        {(a.nbConformes != null || a.nbNonConformes != null) && (
                          <div className="flex flex-wrap gap-2 mt-2 ml-12 text-[11px] font-medium">
                            {a.nbConformes != null && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{a.nbConformes} conformes</span>}
                            {a.nbPartiels != null && a.nbPartiels > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{a.nbPartiels} partiels</span>}
                            {a.nbNonConformes != null && a.nbNonConformes > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">{a.nbNonConformes} non conformes</span>}
                          </div>
                        )}
                        {a.actions && (
                          <p className="text-xs text-surface-600 mt-2 ml-12 leading-relaxed">
                            <span className="font-semibold text-surface-800">Actions demandées : </span>{a.actions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Repere({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className={`text-2xl font-heading font-bold tabular-nums ${accent ? 'text-emerald-600' : 'text-surface-900'}`}>{value}</div>
      <div className="text-xs text-surface-500 mt-1">{label}</div>
    </div>
  )
}
