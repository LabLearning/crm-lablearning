'use client'

import { useState, useMemo } from 'react'
import {
  Users, Euro, Target, AlertTriangle, CheckCircle2, GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ManagerStats {
  leadsTotal: number
  leadsMois: number
  leadsParStatut: Record<string, { count: number; montant: number }>
  devisTotal: number
  devisAcceptes: number
  devisMontant: number
  facturesParStatut: Record<string, number>
  caFacture: number
  caPaye: number
  impayes: number
  sessionsParStatut: Record<string, number>
  dossiersParStatut: Record<string, number>
  apprenants: number
  reclamationsOuvertes: number
}

const PIPELINE_STATUTS = [
  { key: 'nouveau', label: 'Nouveau', color: '#6366F1' },
  { key: 'contacte', label: 'Contacté', color: '#0891B2' },
  { key: 'qualification', label: 'Qualifié', color: '#D97706' },
  { key: 'proposition', label: 'Proposition', color: '#7C3AED' },
  { key: 'negociation', label: 'Négo.', color: '#EA580C' },
  { key: 'gagne', label: 'Gagné', color: '#059669' },
  { key: 'perdu', label: 'Perdu', color: '#DC2626' },
]

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n))

export function ManagerClient({ stats }: { stats: ManagerStats }) {
  const [tab, setTab] = useState<'general' | 'pipeline' | 'finance' | 'formation'>('general')

  const sc = (key: string) => stats.sessionsParStatut[key] || 0
  const dc = (key: string) => stats.dossiersParStatut[key] || 0
  const fc = (key: string) => stats.facturesParStatut[key] || 0

  // ─── Calculs dérivés des agrégats (tout est pré-calculé côté SQL) ───
  const kpi = useMemo(() => {
    const ls = stats.leadsParStatut
    const gagnes = ls['gagne']?.count || 0
    const perdus = ls['perdu']?.count || 0
    const enCours = stats.leadsTotal - gagnes - perdus
    const tauxConversion = stats.leadsTotal > 0 ? Math.round((gagnes / stats.leadsTotal) * 100) : 0
    const ratioGP = (gagnes + perdus) > 0 ? (gagnes / (gagnes + perdus) * 100).toFixed(0) : '—'
    const montantPipeline = Object.entries(ls)
      .filter(([k]) => k !== 'gagne' && k !== 'perdu')
      .reduce((sum, [, v]) => sum + (Number(v.montant) || 0), 0)

    const tauxDevis = stats.devisTotal > 0 ? Math.round((stats.devisAcceptes / stats.devisTotal) * 100) : 0

    const sessionsEnCours = sc('en_cours')
    const sessionsAVenir = sc('planifiee') + sc('confirmee')
    const sessionsTerminees = sc('terminee')

    const dossiersTotal = Object.values(stats.dossiersParStatut).reduce((s, n) => s + n, 0)
    const dossiersEnCours = dossiersTotal - dc('cloture') - dc('facture')

    return {
      totalLeads: stats.leadsTotal, leadsThisMonth: stats.leadsMois,
      gagnes, perdus, enCours, tauxConversion, ratioGP, montantPipeline,
      totalDevis: stats.devisTotal, devisAcceptes: stats.devisAcceptes, tauxDevis, devisMontant: stats.devisMontant,
      caFacture: stats.caFacture, caPayé: stats.caPaye, impayés: stats.impayes,
      sessionsEnCours, sessionsAVenir, sessionsTerminees,
      apprenants: stats.apprenants, dossiersEnCours, reclamationsOuvertes: stats.reclamationsOuvertes,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats])

  // Pipeline distribution
  const pipeline = useMemo(() => {
    return PIPELINE_STATUTS.map(s => ({
      ...s,
      count: stats.leadsParStatut[s.key]?.count || 0,
      montant: Number(stats.leadsParStatut[s.key]?.montant) || 0,
    }))
  }, [stats])

  const maxPipeline = Math.max(...pipeline.map(p => p.count), 1)
  const totalFactures = Object.values(stats.facturesParStatut).reduce((s, n) => s + n, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Vue Manager</h1>
          <p className="text-surface-500 mt-1 text-sm">Tableau de bord analytique global</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-100 rounded-lg p-0.5 w-fit">
        {([
          { id: 'general', label: 'Vue générale' },
          { id: 'pipeline', label: 'Pipeline' },
          { id: 'finance', label: 'Finances' },
          { id: 'formation', label: 'Formations' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors', tab === t.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── VUE GÉNÉRALE ─── */}
      {tab === 'general' && (
        <div className="space-y-6">
          {/* KPIs row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Leads', value: kpi.totalLeads, sub: `+${kpi.leadsThisMonth} ce mois`, icon: Users, color: 'text-brand-600' },
              { label: 'En cours', value: kpi.enCours, sub: `${kpi.tauxConversion}% conversion`, icon: Target, color: 'text-warning-600' },
              { label: 'Gagnés', value: kpi.gagnes, sub: `Ratio: ${kpi.ratioGP}%`, icon: CheckCircle2, color: 'text-success-600' },
              { label: 'CA facturé', value: fmtK(kpi.caFacture) + ' €', sub: `${fmtK(kpi.caPayé)} € payé`, icon: Euro, color: 'text-surface-800' },
              { label: 'Sessions', value: kpi.sessionsAVenir + kpi.sessionsEnCours, sub: `${kpi.sessionsTerminees} terminées`, icon: GraduationCap, color: 'text-brand-600' },
              { label: 'Apprenants', value: kpi.apprenants, sub: `${kpi.dossiersEnCours} dossiers`, icon: Users, color: 'text-violet-600' },
            ].map(k => (
              <div key={k.label} className="card p-4 text-center">
                <k.icon className={cn('h-5 w-5 mx-auto mb-2', k.color)} />
                <div className="text-2xl font-heading font-bold text-surface-900">{k.value}</div>
                <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
                <div className="text-[10px] text-surface-500 mt-1">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Alertes */}
          {(kpi.impayés > 0 || kpi.reclamationsOuvertes > 0) && (
            <div className="card p-4 border-warning-200 border bg-warning-50/30">
              <div className="flex items-center gap-2 text-sm font-medium text-warning-800">
                <AlertTriangle className="h-4 w-4" />
                Alertes
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                {kpi.impayés > 0 && <span className="text-danger-600">{fmt(kpi.impayés)} € d'impayés</span>}
                {kpi.reclamationsOuvertes > 0 && <span className="text-warning-700">{kpi.reclamationsOuvertes} réclamation(s) ouverte(s)</span>}
              </div>
            </div>
          )}

          {/* Mini pipeline funnel */}
          <div className="card p-5">
            <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Funnel commercial</div>
            <div className="space-y-2">
              {pipeline.filter(p => p.count > 0).map(p => (
                <div key={p.key} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-surface-600 text-right shrink-0">{p.label}</div>
                  <div className="flex-1 h-7 bg-surface-100 rounded-lg overflow-hidden relative">
                    <div className="h-full rounded-lg transition-all duration-700" style={{ width: `${(p.count / maxPipeline) * 100}%`, backgroundColor: p.color }} />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-surface-800">
                      {p.count}
                    </span>
                  </div>
                  {p.montant > 0 && <div className="text-xs text-surface-400 w-20 text-right shrink-0">{fmtK(p.montant)} €</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── PIPELINE ─── */}
      {tab === 'pipeline' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total leads" value={kpi.totalLeads} />
            <StatBox label="Taux conversion" value={`${kpi.tauxConversion}%`} color={kpi.tauxConversion >= 20 ? 'success' : kpi.tauxConversion >= 10 ? 'warning' : 'danger'} />
            <StatBox label="Ratio G/P" value={`${kpi.ratioGP}%`} />
            <StatBox label="Pipeline" value={`${fmtK(kpi.montantPipeline)} €`} />
          </div>

          {/* Detailed pipeline */}
          <div className="card p-5">
            <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Pipeline détaillé</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {pipeline.map(p => (
                <div key={p.key} className="p-4 rounded-xl bg-surface-50 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: p.color }} />
                  <div className="text-3xl font-heading font-bold text-surface-900 mt-2">{p.count}</div>
                  <div className="text-xs text-surface-500 mt-1">{p.label}</div>
                  {p.montant > 0 && <div className="text-xs text-surface-400 mt-1">{fmt(p.montant)} €</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Devis conversion */}
          <div className="card p-5">
            <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Conversion devis</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-heading font-bold text-surface-900">{kpi.totalDevis}</div>
                <div className="text-xs text-surface-500">Devis envoyés</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-heading font-bold text-success-600">{kpi.devisAcceptes}</div>
                <div className="text-xs text-surface-500">Acceptés</div>
              </div>
              <div className="text-center">
                <div className={cn('text-3xl font-heading font-bold', kpi.tauxDevis >= 30 ? 'text-success-600' : kpi.tauxDevis >= 15 ? 'text-warning-600' : 'text-danger-600')}>
                  {kpi.tauxDevis}%
                </div>
                <div className="text-xs text-surface-500">Taux de conversion</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── FINANCES ─── */}
      {tab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="CA facturé" value={`${fmtK(kpi.caFacture)} €`} />
            <StatBox label="Payé" value={`${fmtK(kpi.caPayé)} €`} color="success" />
            <StatBox label="Impayés" value={`${fmtK(kpi.impayés)} €`} color={kpi.impayés > 0 ? 'danger' : 'success'} />
            <StatBox label="Devis total" value={`${fmtK(kpi.devisMontant)} €`} />
          </div>

          <div className="card p-5">
            <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Répartition factures</div>
            <div className="space-y-2">
              {[
                { label: 'Brouillons', count: fc('brouillon'), color: '#94A3B8' },
                { label: 'Envoyées', count: fc('envoyee'), color: '#6366F1' },
                { label: 'Payées', count: fc('payee'), color: '#10B981' },
                { label: 'En retard', count: fc('en_retard'), color: '#EF4444' },
                { label: 'Relancées', count: fc('relancee'), color: '#F59E0B' },
              ].filter(s => s.count > 0).map(s => {
                const max = Math.max(totalFactures, 1)
                return (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-surface-600 text-right">{s.label}</div>
                    <div className="flex-1 h-6 bg-surface-100 rounded overflow-hidden relative">
                      <div className="h-full rounded transition-all duration-500" style={{ width: `${(s.count / max) * 100}%`, backgroundColor: s.color }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold text-surface-700">{s.count}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── FORMATIONS ─── */}
      {tab === 'formation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Apprenants" value={kpi.apprenants} />
            <StatBox label="Sessions actives" value={kpi.sessionsEnCours + kpi.sessionsAVenir} />
            <StatBox label="Sessions terminées" value={kpi.sessionsTerminees} />
            <StatBox label="Dossiers en cours" value={kpi.dossiersEnCours} />
          </div>

          <div className="card p-5">
            <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Statut sessions</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Planifiées', count: sc('planifiee'), color: 'bg-blue-50 text-blue-700' },
                { label: 'Confirmées', count: sc('confirmee'), color: 'bg-violet-50 text-violet-700' },
                { label: 'En cours', count: sc('en_cours'), color: 'bg-amber-50 text-amber-700' },
                { label: 'Terminées', count: sc('terminee'), color: 'bg-emerald-50 text-emerald-700' },
              ].map(s => (
                <div key={s.label} className={cn('p-4 rounded-xl text-center', s.color)}>
                  <div className="text-2xl font-heading font-bold">{s.count}</div>
                  <div className="text-xs mt-1 opacity-70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Statut dossiers</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'En création', count: dc('en_creation') },
                { label: 'Devis envoyé', count: dc('devis_envoye') },
                { label: 'Convention signée', count: dc('convention_signee') },
                { label: 'En cours', count: dc('en_cours') },
                { label: 'Réalisé', count: dc('realise') },
                { label: 'Clôturé', count: dc('cloture') },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between p-3 rounded-xl bg-surface-50">
                  <span className="text-sm text-surface-600">{s.label}</span>
                  <span className="text-lg font-heading font-bold text-surface-900">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: 'success' | 'danger' | 'warning' }) {
  const c = color === 'success' ? 'text-success-600' : color === 'danger' ? 'text-danger-600' : color === 'warning' ? 'text-warning-600' : 'text-surface-900'
  return (
    <div className="card p-4 text-center">
      <div className={cn('text-2xl font-heading font-bold', c)}>{value}</div>
      <div className="text-[11px] text-surface-400 mt-1">{label}</div>
    </div>
  )
}
