import Link from 'next/link'
import { getFranchiseSession, franchiseDisplayName } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFranchiseStats } from '@/lib/franchise-data'
import { commissionTypeLabel } from '@/lib/commission'
import {
  Building2, GraduationCap, Users, UserCheck, Banknote,
  ClipboardCheck, Star, ArrowRight, Percent,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default async function FranchiseDashboard() {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  const stats = await getFranchiseStats(supabase, franchise.id, orgId)

  // Derniers audits
  const { data: audits } = await supabase
    .from('audits_etablissement')
    .select('id, date_audit, type_audit, note_globale, note_sur, client:clients(raison_sociale)')
    .eq('franchise_id', franchise.id)
    .eq('organization_id', orgId)
    .order('date_audit', { ascending: false })
    .limit(5)

  const auditsWithNote = (audits || []).filter((a) => a.note_globale != null)
  const avgAudit = auditsWithNote.length
    ? auditsWithNote.reduce((s, a) => s + (Number(a.note_globale) / a.note_sur) * 20, 0) / auditsWithNote.length
    : null


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Bonjour, {franchiseDisplayName(franchise)}
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          Vue d'ensemble de votre réseau formé par {organization.name}.
        </p>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Building2} tint="blue" value={String(stats.nbEtablissementsFormes)} label="Établissements formés"
          sub={`sur ${stats.nbEtablissements} rattachés`} />
        <Kpi icon={GraduationCap} tint="brand" value={String(stats.nbSessionsRealisees)} label="Formations réalisées"
          sub={`${stats.nbSessions} au total`} />
        <Kpi icon={Users} tint="violet" value={String(stats.nbParticipants)} label="Participants" />
        <Kpi icon={UserCheck} tint="emerald" value={stats.tauxPresence != null ? `${stats.tauxPresence}%` : '—'} label="Taux de présence"
          sub={`${stats.nbAbsences} absence${stats.nbAbsences > 1 ? 's' : ''}`} />
      </div>

      {/* Financier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-heading font-semibold text-surface-900">Vos commissions</h2>
            <span className="text-[11px] text-surface-400 inline-flex items-center gap-1 ml-auto">
              <Percent className="h-3 w-3" /> {franchise.taux_commission}% · {commissionTypeLabel(franchise.commission_type)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <CommBox label="À venir" value={fmtEuro(stats.commissionAVenir)} tone="surface" />
            <CommBox label="Validées" value={fmtEuro(stats.commissionValidee)} tone="blue" />
            <CommBox label="Payées" value={fmtEuro(stats.commissionPayee)} tone="emerald" />
          </div>
          <Link href="/franchise/financier"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            Détail dossier par dossier <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Total de vos commissions (hero) */}
        <div className="card p-5 bg-amber-50/30 ring-1 ring-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-heading font-semibold text-surface-900">Total de vos commissions</h2>
          </div>
          <div className="text-3xl font-heading font-bold text-amber-600 tabular-nums">{fmtEuro(stats.commissionTotale)}</div>
          <div className="text-xs text-surface-500 mt-2">
            Sur {stats.nbDossiers} dossier{stats.nbDossiers > 1 ? 's' : ''} de formation de votre réseau.
          </div>
        </div>
      </div>

      {/* Audits récents */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-heading font-semibold text-surface-900">Audits récents</h2>
          </div>
          <div className="flex items-center gap-3">
            {avgAudit != null && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                <Star className="h-4 w-4" /> {avgAudit.toFixed(1)}/20
              </span>
            )}
            <Link href="/franchise/audits" className="text-xs font-medium text-brand-600 hover:text-brand-700">Tout voir</Link>
          </div>
        </div>
        {(audits || []).length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-surface-400">Aucun audit pour le moment.</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {(audits || []).map((a) => {
              const pct = a.note_globale != null ? (Number(a.note_globale) / a.note_sur) * 100 : null
              const col = pct == null ? 'text-surface-400' : pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'
              return (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="h-4 w-4 text-surface-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{(a.client as any)?.raison_sociale || 'Établissement'}</div>
                    <div className="text-xs text-surface-500">{a.type_audit} · {new Date(a.date_audit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className={`text-sm font-heading font-bold tabular-nums shrink-0 ${col}`}>
                    {a.note_globale != null ? `${a.note_globale}/${a.note_sur}` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, tint, value, label, sub }: { icon: any; tint: string; value: string; label: string; sub?: string }) {
  const tints: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    brand: 'bg-brand-50 text-brand-600',
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="card p-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tints[tint]}`}>
        <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      </div>
      <div className="text-2xl font-heading font-bold text-surface-900 mt-3 tabular-nums">{value}</div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-surface-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function CommBox({ label, value, tone }: { label: string; value: string; tone: 'surface' | 'blue' | 'emerald' }) {
  const tones = {
    surface: 'text-surface-700',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
  }
  return (
    <div className="bg-surface-50 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">{label}</div>
      <div className={`text-lg font-heading font-bold mt-1 tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  )
}
