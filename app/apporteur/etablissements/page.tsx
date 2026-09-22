import { getApporteurSession } from '@/lib/apporteur-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { chargerCommissionsApporteur } from '@/lib/commission-apporteur'
import { Building2, MapPin, GraduationCap } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))

/** Les établissements apportés, avec leurs formations et la commission générée. */
export default async function ApporteurEtablissementsPage() {
  const { apporteur, organization } = await getApporteurSession()
  if (!apporteur) return null
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  const { data: etablissements } = await supabase
    .from('clients')
    .select('id, raison_sociale, nom_commercial, ville, code_postal, secteur_activite, created_at')
    .eq('apporteur_id', apporteur.id).eq('organization_id', orgId)
    .order('raison_sociale')
  const clientIds = (etablissements || []).map((c: any) => c.id)

  const [{ data: sessions }, lignes] = await Promise.all([
    clientIds.length
      ? supabase.from('sessions').select('id, client_id, status').eq('organization_id', orgId).in('client_id', clientIds).neq('status', 'annulee')
      : Promise.resolve({ data: [] as any[] }),
    chargerCommissionsApporteur(supabase, apporteur.id, orgId),
  ])

  const compte = (cid: string) => {
    const ss = ((sessions || []) as any[]).filter((s) => s.client_id === cid)
    const realisees = ss.filter((s) => s.status === 'terminee').length
    const commission = lignes.filter((l) => l.client_id === cid && l.status !== 'annulee').reduce((t, l) => t + Number(l.montant_commission || 0), 0)
    return { realisees, aVenir: ss.length - realisees, commission }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Établissements</h1>
        <p className="text-surface-500 text-sm mt-1">
          {(etablissements || []).length} établissement{(etablissements || []).length > 1 ? 's' : ''} apporté{(etablissements || []).length > 1 ? 's' : ''} à {organization.name}.
        </p>
      </div>

      {(etablissements || []).length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Building2 className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucun établissement ne vous est encore rattaché.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(etablissements || []).map((c: any) => {
            const n = compte(c.id)
            return (
              <div key={c.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-surface-900 truncate">{c.nom_commercial || c.raison_sociale}</div>
                    {(c.ville || c.secteur_activite) && (
                      <div className="text-xs text-surface-500 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />{[c.code_postal, c.ville].filter(Boolean).join(' ')}{c.secteur_activite ? ` · ${c.secteur_activite}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-surface-100 text-center">
                  <div>
                    <div className="text-base font-heading font-bold text-surface-900 tabular-nums">{n.realisees}</div>
                    <div className="text-[10px] text-surface-400 uppercase tracking-wider">Réalisées</div>
                  </div>
                  <div>
                    <div className="text-base font-heading font-bold text-surface-900 tabular-nums">{n.aVenir}</div>
                    <div className="text-[10px] text-surface-400 uppercase tracking-wider">À venir</div>
                  </div>
                  <div>
                    <div className="text-base font-heading font-bold text-brand-600 tabular-nums">{fmtEuro(n.commission)}</div>
                    <div className="text-[10px] text-surface-400 uppercase tracking-wider">Commission</div>
                  </div>
                </div>
                {n.realisees === 0 && n.aVenir === 0 && (
                  <div className="mt-3 text-xs text-surface-400 flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Aucune formation planifiée pour l&apos;instant</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
