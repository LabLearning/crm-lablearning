import Link from 'next/link'
import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFranchiseAudits, syntheseAudits } from '@/lib/franchise-data'
import { Building2, MapPin, GraduationCap, ChevronRight, ShieldCheck } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

export default async function FranchiseEtablissementsPage() {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  const { data: etablissements } = await supabase
    .from('clients')
    .select('id, raison_sociale, ville, code_postal, secteur_activite')
    .eq('franchise_id', franchise.id)
    .eq('organization_id', orgId)
    .order('raison_sociale')

  const clientIds = (etablissements || []).map((c) => c.id)

  // Sessions par établissement : la session est l'unité réelle de la
  // formation (les dossiers ne sont plus alimentés). Réalisée = terminée.
  const { data: sessions } = clientIds.length
    ? await supabase
        .from('sessions')
        .select('id, client_id, status')
        .eq('organization_id', orgId)
        .in('client_id', clientIds)
        .neq('status', 'annulee')
    : { data: [] as any[] }

  // Audits hygiène du réseau, remontés de l'outil terrain
  const audits = await getFranchiseAudits(supabase, franchise.id, orgId)
  const bilan = syntheseAudits(audits)

  const countFor = (cid: string) => {
    const ss = (sessions || []).filter((s: any) => s.client_id === cid)
    const realises = ss.filter((s: any) => s.status === 'terminee').length
    const enCours = ss.length - realises
    return { total: ss.length, realises, enCours }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Mes établissements</h1>
        <p className="text-surface-500 text-sm mt-1">
          {(etablissements || []).length} établissement{(etablissements || []).length > 1 ? 's' : ''} de votre réseau.
        </p>
      </div>

      {bilan.nbAudits > 0 && (
        <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-heading font-semibold text-surface-900">Audits hygiène</div>
              <div className="text-xs text-surface-500">
                {bilan.nbAudits} audit{bilan.nbAudits > 1 ? 's' : ''} sur {bilan.nbEtablissements} établissement{bilan.nbEtablissements > 1 ? 's' : ''}
              </div>
            </div>
          </div>
          {bilan.moyenneEntree != null && bilan.moyenneSortie != null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-surface-400 tabular-nums">{bilan.moyenneEntree}</span>
              <span className="text-surface-300">→</span>
              <span className="font-heading font-bold text-surface-900 tabular-nums">{bilan.moyenneSortie}</span>
              <span className="text-xs text-surface-500">sur 100, du premier passage au suivi</span>
            </div>
          )}
          {bilan.progression != null && bilan.progression > 0 && (
            <span className="text-sm font-semibold text-emerald-600">+{bilan.progression} points en moyenne</span>
          )}
        </div>
      )}

      {(etablissements || []).length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Building2 className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucun établissement rattaché pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(etablissements || []).map((c) => {
            const cnt = countFor(c.id)
            return (
              <Link key={c.id} href={`/franchise/etablissements/${c.id}`} className="card p-4 hover:border-brand-300 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-semibold text-surface-900 truncate">{c.raison_sociale}</h3>
                    {(c.code_postal || c.ville) && (
                      <div className="text-xs text-surface-500 mt-0.5 inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {[c.code_postal, c.ville].filter(Boolean).join(' ')}
                      </div>
                    )}
                    {c.secteur_activite && <div className="text-xs text-surface-400 mt-0.5">{c.secteur_activite}</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-300 group-hover:text-brand-500 transition-colors shrink-0" />
                </div>
                <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-surface-600">
                    <GraduationCap className="h-3.5 w-3.5 text-surface-400" />
                    <strong className="text-surface-900">{cnt.realises}</strong> formation{cnt.realises > 1 ? 's' : ''} réalisée{cnt.realises > 1 ? 's' : ''}
                  </span>
                  {cnt.enCours > 0 && (
                    <span className="text-surface-400">{cnt.enCours} en cours</span>
                  )}
                  {(() => {
                    const a = audits.get(c.id)
                    if (!a?.entree?.score) return null
                    return (
                      <span className="inline-flex items-center gap-1.5 ml-auto text-surface-600" title="Score d'audit hygiène, entrée puis suivi">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        {a.sortie?.score != null
                          ? <><span className="text-surface-400 tabular-nums">{a.entree.score}</span><span className="text-surface-300">→</span><strong className="text-surface-900 tabular-nums">{a.sortie.score}</strong></>
                          : <strong className="text-surface-900 tabular-nums">{a.entree.score}</strong>}
                        <span className="text-surface-400">/100</span>
                      </span>
                    )
                  })()}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
