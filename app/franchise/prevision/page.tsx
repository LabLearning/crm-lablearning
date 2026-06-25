import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFranchiseStats } from '@/lib/franchise-data'
import { ProgressRing } from '@/components/ui'
import { Building2, Banknote, Target, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default async function FranchisePrevisionPage() {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const stats = await getFranchiseStats(supabase, franchise.id, organization.id)

  const totalDeclares = Number(franchise.nombre_etablissements || 0)
  const formes = stats.nbEtablissementsFormes
  const restants = Math.max(0, totalDeclares - formes)
  const pctForme = totalDeclares > 0 ? Math.round((formes / totalDeclares) * 100) : null

  // Moyennes par établissement formé (commission)
  const commMoyenne = formes > 0 ? stats.commissionTotale / formes : 0
  const taux = Number(franchise.taux_commission || 10)

  // Potentiel sur les établissements restants
  const commPotentielle = restants * commMoyenne
  const commActuelle = stats.commissionTotale

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Prévision</h1>
        <p className="text-surface-500 text-sm mt-1">Couverture de votre réseau et potentiel restant à former.</p>
      </div>

      {totalDeclares === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Target className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Le nombre total d'établissements du réseau n'a pas encore été renseigné.</p>
          <p className="text-xs text-surface-400 mt-1">Votre interlocuteur Lab Learning le configurera prochainement.</p>
        </div>
      ) : (
        <>
          {/* Couverture */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ProgressRing value={pctForme || 0} size={150} stroke={14} color="#6366F1" sublabel="formé" />
              <div className="flex-1 w-full">
                <div className="text-sm font-heading font-semibold text-surface-900 mb-3">Couverture du réseau</div>
                <div className="space-y-3">
                  <Bar label="Établissements formés" value={formes} total={totalDeclares} color="bg-brand-500" />
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <Mini label="Total réseau" value={String(totalDeclares)} dot="bg-surface-300" />
                    <Mini label="Formés" value={String(formes)} dot="bg-brand-500" />
                    <Mini label="À former" value={String(restants)} dot="bg-amber-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Potentiel */}
          <div>
            <div className="text-sm font-heading font-semibold text-surface-900 mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" /> Potentiel restant ({restants} établissement{restants > 1 ? 's' : ''} à former)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PotCard icon={Building2} tint="blue" label="Établissements à former" value={String(restants)} sub={`sur ${totalDeclares} au total`} />
              <PotCard icon={Banknote} tint="amber" label="Commission potentielle" value={fmtEuro(commPotentielle)} sub={`~${fmtEuro(commMoyenne)} / établissement`} highlight />
            </div>
          </div>

          {/* Projection commission */}
          <div className="card p-5">
            <div className="text-sm font-heading font-semibold text-surface-900 mb-4">Projection de vos commissions</div>
            <div className="space-y-3">
              <ProjBar label="Acquise / en cours (réseau formé)" value={commActuelle} max={commActuelle + commPotentielle} color="bg-emerald-500" />
              <ProjBar label="Potentielle (réseau à former)" value={commPotentielle} max={commActuelle + commPotentielle} color="bg-amber-400" />
              <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
                <span className="text-sm font-medium text-surface-700">Potentiel total du réseau</span>
                <span className="text-lg font-heading font-bold text-surface-900 tabular-nums">{fmtEuro(commActuelle + commPotentielle)}</span>
              </div>
            </div>
            <p className="text-[11px] text-surface-400 mt-3">
              Estimation basée sur la moyenne par établissement déjà formé. Donnée indicative.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-surface-600">{label}</span>
        <span className="font-semibold text-surface-900 tabular-nums">{value} / {total}</span>
      </div>
      <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ProjBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-surface-600">{label}</span>
        <span className="font-semibold text-surface-900 tabular-nums">{fmt(value)}</span>
      </div>
      <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Mini({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="bg-surface-50 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">{label}</span>
      </div>
      <div className="text-lg font-heading font-bold text-surface-900 mt-1 tabular-nums">{value}</div>
    </div>
  )
}

function PotCard({ icon: Icon, tint, label, value, sub, highlight }: { icon: any; tint: string; label: string; value: string; sub: string; highlight?: boolean }) {
  const tints: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className={`card p-4 ${highlight ? 'ring-1 ring-amber-200 bg-amber-50/20' : ''}`}>
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tints[tint]}`}><Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></div>
      <div className={`text-xl font-heading font-bold mt-3 tabular-nums ${highlight ? 'text-amber-600' : 'text-surface-900'}`}>{value}</div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
      <div className="text-[11px] text-surface-400 mt-1">{sub}</div>
    </div>
  )
}
