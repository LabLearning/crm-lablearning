'use client'

import {
  Euro, TrendingUp, CreditCard, AlertTriangle, Users, Calendar,
  GraduationCap, Star, ShieldCheck, MessageSquareWarning,
  Clock, FileText, Receipt, UserPlus, Building2,
  CheckCircle2, BarChart3, Target,
} from '@/components/ui/icons'
import { Badge, EuroTile } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import type { DashboardData } from './data'

interface ReportingDashboardProps {
  data: DashboardData
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  update_status: 'Changement de statut',
  convert: 'Conversion',
  inscription: 'Inscription',
  invite: 'Invitation',
  update_role: 'Modification de rôle',
  evaluate: 'Évaluation',
  create_avoir: 'Avoir créé',
}

const ENTITY_LABELS: Record<string, string> = {
  lead: 'Lead',
  client: 'Client',
  contact: 'Contact',
  formation: 'Formation',
  session: 'Session',
  devis: 'Devis',
  convention: 'Convention',
  facture: 'Facture',
  paiement: 'Paiement',
  apprenant: 'Apprenant',
  formateur: 'Formateur',
  qcm: 'QCM',
  reclamation: 'Réclamation',
  dossier: 'Dossier',
  user: 'Utilisateur',
  qualiopi_indicateur: 'Indicateur Qualiopi',
  organization: 'Organisation',
}

/** Tuile : deux par ligne sur mobile (icône masquée, valeur en text-xl insécable), identique au stat-card au-delà. */
function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ComponentType<{ className?: string }>
  label: string; value: React.ReactNode; sub?: React.ReactNode; color: string; bg: string
}) {
  return (
    <div className="card p-4 sm:p-5 flex items-start gap-4">
      <div className={`stat-icon hidden sm:flex ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-surface-500 leading-none">{label}</p>
        <p className={`text-xl sm:text-2xl font-heading font-bold tracking-tight tabular-nums whitespace-nowrap mt-1 sm:mt-0.5 ${color === 'text-surface-800' ? 'text-surface-900' : color}`}>{value}</p>
        {sub && <p className="stat-sub">{sub}</p>}
      </div>
    </div>
  )
}

function MiniBar({ data, maxHeight = 48, compact = false }: { data: { label: string; value: number }[]; maxHeight?: number; compact?: boolean }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  // Sur mobile les libellés ne tiennent pas tous : on n'affiche qu'un mois sur deux
  // (dans une carte compacte de 230 px, six libellés ne tiennent à aucune largeur)
  const clairsemer = data.length > 6 || compact
  const masque = compact ? 'invisible' : 'invisible sm:visible'
  return (
    <div className="flex items-end gap-1 sm:gap-1.5 h-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
          <div
            className="w-full bg-surface-900 rounded-sm min-h-[2px] transition-all duration-500 ease-out hover:bg-brand-500"
            style={{ height: `${Math.max((d.value / max) * maxHeight, 2)}px` }}
            title={`${d.label}: ${d.value.toLocaleString('fr-FR')} €`}
          />
          <span className={`text-[11px] text-surface-400 whitespace-nowrap w-full text-center ${clairsemer && i % 2 === 1 ? masque : ''}`}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function ReportingDashboard({ data }: ReportingDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Tableau de bord</h1>
          <p className="text-surface-500 mt-1 text-sm">Vue d'ensemble de l'activité de votre organisme</p>
        </div>
      </div>

      {/* Financial KPIs */}
      <div>
        <div className="section-label mb-3">Finances</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Euro} label="CA Réalisé" value={<EuroTile value={data.ca_realise} />} sub={<>Dont <EuroTile value={data.ca_mois} /> ce mois</>} color="text-surface-800" bg="bg-surface-100" />
          <StatCard icon={CreditCard} label="Encaissé" value={<EuroTile value={data.encaisse} />} color="text-success-600" bg="bg-success-50" />
          <StatCard icon={Clock} label="Impayés" value={<EuroTile value={data.impaye} />} sub={`${data.factures_en_retard} facture${data.factures_en_retard > 1 ? 's' : ''} en retard`} color="text-danger-600" bg="bg-danger-50" />
          <StatCard icon={TrendingUp} label="Prévisionnel" value={<EuroTile value={data.ca_previsionnel} />} sub="CA + devis en cours" color="text-brand-600" bg="bg-brand-50" />
        </div>
      </div>

      {/* CA Chart */}
      <div className="card p-4 sm:p-6 max-w-full overflow-hidden">
        <h3 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Chiffre d'affaires mensuel</h3>
        <div className="h-32">
          <MiniBar
            data={data.ca_mensuel.map((m) => ({ label: m.mois, value: m.montant }))}
            maxHeight={96}
          />
        </div>
      </div>

      {/* Commercial + Formation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div>
          <div className="section-label mb-3">Commercial</div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={UserPlus} label="Leads" value={data.leads_total} sub={<>Valeur : <EuroTile value={data.leads_valeur} /></>} color="text-brand-600" bg="bg-brand-50" />
            <StatCard icon={Target} label="Taux transfo." value={`${data.taux_transformation}%`} color="text-success-600" bg="bg-success-50" />
            <StatCard icon={FileText} label="Devis en attente" value={data.devis_en_attente} sub={<EuroTile value={data.devis_valeur} />} color="text-warning-600" bg="bg-warning-50" />
            <div className="card p-4">
              <div className="text-xs text-surface-500 mb-2">Pipeline leads</div>
              <div className="space-y-1.5">
                {Object.entries(data.leads_par_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <span className="text-surface-600 capitalize">{status.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-surface-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Formations */}
        <div>
          <div className="section-label mb-3">Formations</div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Calendar} label="Sessions en cours" value={data.sessions_en_cours} sub={`${data.sessions_a_venir} à venir`} color="text-brand-600" bg="bg-brand-50" />
            <StatCard icon={GraduationCap} label="Apprenants formés" value={data.apprenants_formes} sub={`${data.apprenants_en_cours} en cours`} color="text-purple-600" bg="bg-purple-50" />
            <StatCard icon={CheckCircle2} label="Sessions terminées" value={data.sessions_terminees} color="text-surface-600" bg="bg-surface-100" />
            <div className="card p-4">
              <div className="text-xs text-surface-500 mb-2">Inscriptions mensuelles</div>
              <div className="h-16">
                <MiniBar
                  data={data.inscriptions_mensuelles.slice(-6).map((m) => ({ label: m.mois, value: m.count }))}
                  maxHeight={48}
                  compact
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality */}
      <div>
        <div className="section-label mb-3">Qualité & Conformité</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Star} label="Satisfaction" value={`${data.taux_satisfaction}%`} color="text-warning-600" bg="bg-warning-50" />
          <StatCard icon={BarChart3} label="Taux de réussite" value={`${data.taux_reussite}%`} color="text-success-600" bg="bg-success-50" />
          <StatCard icon={ShieldCheck} label="Conformité Qualiopi" value={`${data.conformite_qualiopi}%`} color="text-brand-600" bg="bg-brand-50" />
          <StatCard icon={MessageSquareWarning} label="Réclamations ouvertes" value={data.reclamations_ouvertes} color="text-danger-600" bg="bg-danger-50" />
        </div>
      </div>

      {/* Alerts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Alertes</h3>
          <div className="space-y-2">
            {data.factures_en_retard > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-danger-50 border border-danger-200">
                <Receipt className="h-4 w-4 text-danger-600 shrink-0" />
                <span className="text-sm text-danger-700">{data.factures_en_retard} facture{data.factures_en_retard > 1 ? 's' : ''} en retard de paiement</span>
              </div>
            )}
            {data.reclamations_ouvertes > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-warning-50 border border-warning-200">
                <MessageSquareWarning className="h-4 w-4 text-warning-600 shrink-0" />
                <span className="text-sm text-warning-700">{data.reclamations_ouvertes} réclamation{data.reclamations_ouvertes > 1 ? 's' : ''} en cours de traitement</span>
              </div>
            )}
            {data.habilitations_a_renouveler > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-50 border border-brand-200">
                <AlertTriangle className="h-4 w-4 text-brand-600 shrink-0" />
                <span className="text-sm text-brand-700">{data.habilitations_a_renouveler} habilitation{data.habilitations_a_renouveler > 1 ? 's' : ''} formateur à renouveler</span>
              </div>
            )}
            {data.factures_en_retard === 0 && data.reclamations_ouvertes === 0 && data.habilitations_a_renouveler === 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-success-50">
                <CheckCircle2 className="h-4 w-4 text-success-600 shrink-0" />
                <span className="text-sm text-success-700">Aucune alerte en cours</span>
              </div>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Activité récente</h3>
          {data.activite_recente.length > 0 ? (
            <div className="space-y-3">
              {data.activite_recente.map((event, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="shrink-0 mt-1 h-2 w-2 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-surface-700">
                      <span className="font-medium">{event.user_name}</span>
                      {' — '}
                      <span>{ACTION_LABELS[event.action] || event.action}</span>
                      {' '}
                      <span className="text-surface-500">{ENTITY_LABELS[event.entity_type] || event.entity_type}</span>
                    </div>
                    <div className="text-2xs text-surface-400">{formatDateTime(event.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-surface-400">Aucune activité récente</div>
          )}
        </div>
      </div>
    </div>
  )
}
