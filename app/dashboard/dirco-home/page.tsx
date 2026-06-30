import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  Euro, TrendingUp, Users, Target, UserPlus, ChevronRight,
  Building2, Clock, CheckCircle2, BarChart3, Briefcase,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', contacte: 'Contacté', qualification: 'Qualifié',
  proposition_envoyee: 'Proposition', negociation: 'Négociation',
  gagne: 'Gagné', perdu: 'Perdu',
}
const STATUS_COLORS: Record<string, string> = {
  nouveau: 'bg-brand-100 text-brand-700', contacte: 'bg-cyan-100 text-cyan-700',
  qualification: 'bg-amber-100 text-amber-700', proposition_envoyee: 'bg-purple-100 text-purple-700',
  negociation: 'bg-orange-100 text-orange-700', gagne: 'bg-emerald-100 text-emerald-700',
  perdu: 'bg-red-100 text-red-700',
}

export default async function DircoHomePage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [
    // Tous les leads de l'organisation
    { data: leads },
    // Commerciaux de l'équipe
    { data: commerciaux },
    // Apporteurs d'affaires
    { data: apporteurs },
    // Devis en attente
    { data: devis },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id, contact_nom, contact_prenom, entreprise, status, montant_estime, source, created_at, assigned_to, assigned_user:users!leads_assigned_to_fkey(first_name, last_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .in('role', ['commercial', 'directeur_commercial']),
    supabase
      .from('apporteurs_affaires')
      .select('id, nom, prenom, email, taux_commission, is_active')
      .eq('organization_id', orgId)
      .eq('is_active', true),
    supabase
      .from('devis')
      .select('id, numero, status, montant_ht, client:clients(raison_sociale)')
      .eq('organization_id', orgId)
      .in('status', ['brouillon', 'envoye'])
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const allLeads = leads || []
  const gagnes = allLeads.filter(l => l.status === 'gagne')
  const enCours = allLeads.filter(l => !['gagne', 'perdu'].includes(l.status))
  const nouveaux = allLeads.filter(l => l.status === 'nouveau')
  const caGenere = gagnes.reduce((s, l) => s + (l.montant_estime || 0), 0)
  const pipeline = enCours.reduce((s, l) => s + (l.montant_estime || 0), 0)
  const tauxConversion = allLeads.length > 0 ? Math.round((gagnes.length / allLeads.length) * 100) : 0

  // Stats par commercial
  const teamStats = (commerciaux || []).map(c => {
    const cLeads = allLeads.filter(l => l.assigned_to === c.id)
    const cGagnes = cLeads.filter(l => l.status === 'gagne')
    const cEnCours = cLeads.filter(l => !['gagne', 'perdu'].includes(l.status))
    return {
      ...c,
      totalLeads: cLeads.length,
      gagnes: cGagnes.length,
      enCours: cEnCours.length,
      ca: cGagnes.reduce((s, l) => s + (l.montant_estime || 0), 0),
    }
  }).sort((a, b) => b.ca - a.ca)

  const leadsApporteurs = allLeads.filter(l => l.source === 'apporteur_affaires')

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Bonjour, {session.user.first_name}
        </h1>
        <p className="text-surface-500 mt-1 text-sm">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' — Direction commerciale'}
        </p>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-5 bg-emerald-50">
          <div className="flex items-center gap-2 mb-2">
            <Euro className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">CA réalisé</span>
          </div>
          <div className="text-2xl font-heading font-bold text-emerald-600">
            {Number(caGenere).toLocaleString('fr-FR')} €
          </div>
          <div className="text-xs text-surface-500 mt-1">{gagnes.length} dossier{gagnes.length > 1 ? 's' : ''} gagné{gagnes.length > 1 ? 's' : ''}</div>
        </div>

        <div className="rounded-2xl p-5 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Pipeline</span>
          </div>
          <div className="text-2xl font-heading font-bold text-blue-600">
            {Number(pipeline).toLocaleString('fr-FR')} €
          </div>
          <div className="text-xs text-surface-500 mt-1">{enCours.length} lead{enCours.length > 1 ? 's' : ''} en cours</div>
        </div>

        <div className="rounded-2xl p-5 bg-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Conversion</span>
          </div>
          <div className="text-2xl font-heading font-bold text-amber-600">{tauxConversion}%</div>
          <div className="text-xs text-surface-500 mt-1">{allLeads.length} leads au total</div>
        </div>

        <div className="rounded-2xl p-5 bg-violet-50">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Nouveaux</span>
          </div>
          <div className="text-2xl font-heading font-bold text-violet-600">{nouveaux.length}</div>
          <div className="text-xs text-surface-500 mt-1">à qualifier / valider</div>
        </div>
      </div>

      {/* Alertes leads apporteurs */}
      {nouveaux.filter(l => l.source === 'apporteur_affaires').length > 0 && (
        <div className="card p-4 border-l-4 border-amber-400 bg-amber-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-sm font-medium text-surface-800">Leads apporteurs à valider</div>
                <div className="text-xs text-surface-500">{nouveaux.filter(l => l.source === 'apporteur_affaires').length} lead(s) en attente de validation</div>
              </div>
            </div>
            <Link href="/dashboard/leads" className="text-xs font-medium text-amber-700 hover:text-amber-800">
              Voir les leads
            </Link>
          </div>
        </div>
      )}

      {/* 2 colonnes : Équipe + Derniers leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Performance équipe */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Équipe commerciale ({teamStats.length})
            </span>
          </div>
          {teamStats.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {teamStats.map(c => (
                <div key={c.id} className="px-4 py-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-600">
                      {(c.first_name?.[0] || '')}{(c.last_name?.[0] || '')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      {c.first_name} {c.last_name}
                    </div>
                    <div className="text-xs text-surface-500">
                      {c.enCours} en cours · {c.gagnes} gagné{c.gagnes > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-surface-900">{Number(c.ca).toLocaleString('fr-FR')} €</div>
                    <div className="text-[10px] text-surface-400">{c.totalLeads} leads</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-surface-400">
              <Users className="h-7 w-7 mx-auto mb-2 text-surface-300" />
              Aucun commercial dans l'équipe
            </div>
          )}
        </div>

        {/* Derniers leads */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Derniers leads</span>
            <Link href="/dashboard/leads" className="text-xs text-brand-600 font-medium">Voir tout</Link>
          </div>
          {allLeads.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {allLeads.slice(0, 8).map(lead => (
                <Link key={lead.id} href="/dashboard/leads"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      {lead.contact_prenom} {lead.contact_nom}
                    </div>
                    <div className="text-xs text-surface-500 truncate">
                      {lead.entreprise || '—'}
                      {(lead as any).assigned_user && (
                        <span className="ml-2 text-surface-400">
                          → {(lead as any).assigned_user.first_name} {(lead as any).assigned_user.last_name?.[0]}.
                        </span>
                      )}
                    </div>
                  </div>
                  {lead.montant_estime && lead.montant_estime > 0 && (
                    <span className="text-xs font-bold text-surface-600 shrink-0">{Number(lead.montant_estime).toLocaleString('fr-FR')} €</span>
                  )}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0', STATUS_COLORS[lead.status])}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-surface-400">
              <Target className="h-7 w-7 mx-auto mb-2 text-surface-300" />
              Aucun lead
            </div>
          )}
        </div>
      </div>

      {/* 2 colonnes : Apporteurs + Devis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Apporteurs d'affaires */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" /> Apporteurs ({(apporteurs || []).length})
            </span>
            <Link href="/dashboard/apporteurs" className="text-xs text-brand-600 font-medium">Gérer</Link>
          </div>
          {(apporteurs || []).length > 0 ? (
            <div className="divide-y divide-surface-100">
              {(apporteurs || []).map((a: any) => {
                const aLeads = leadsApporteurs.filter((l: any) => l.apporteur_id === a.id || false)
                return (
                  <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <Briefcase className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">{a.prenom} {a.nom}</div>
                      <div className="text-xs text-surface-500">{a.taux_commission || 0}% commission</div>
                    </div>
                    <div className="text-xs text-surface-400 shrink-0">
                      {aLeads.length} lead{aLeads.length > 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-surface-400">Aucun apporteur</div>
          )}
        </div>

        {/* Devis en attente */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Devis en attente</span>
            <Link href="/dashboard/devis" className="text-xs text-brand-600 font-medium">Voir tout</Link>
          </div>
          {(devis || []).length > 0 ? (
            <div className="divide-y divide-surface-100">
              {(devis || []).map((d: any) => (
                <Link key={d.id} href="/dashboard/devis"
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-800">{d.numero}</div>
                    <div className="text-xs text-surface-500 truncate">{d.client?.raison_sociale || '—'}</div>
                  </div>
                  <div className="text-sm font-bold text-surface-900 shrink-0">
                    {d.montant_ht ? Number(d.montant_ht).toLocaleString('fr-FR') + ' €' : '—'}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-surface-400">Aucun devis en attente</div>
          )}
        </div>
      </div>

      {/* Accès rapides */}
      <div className="card p-4">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Accès rapides</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Vue Terrain', href: '/dashboard/commercial', icon: BarChart3, color: 'text-blue-600 bg-blue-50' },
            { label: 'Pipeline', href: '/dashboard/leads', icon: Target, color: 'text-violet-600 bg-violet-50' },
            { label: 'Apporteurs', href: '/dashboard/apporteurs', icon: Briefcase, color: 'text-amber-600 bg-amber-50' },
            { label: 'Clients', href: '/dashboard/clients', icon: Building2, color: 'text-emerald-600 bg-emerald-50' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-surface-200/80 hover:shadow-card transition-all active:scale-[0.98]">
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', a.color)}>
                <a.icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-surface-800">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
