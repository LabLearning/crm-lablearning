import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AccountNotLinked } from '@/components/dashboard/AccountNotLinked'
import {
  Euro, TrendingUp, Users, Target, Building2, MapPin,
  ChevronRight, UserPlus, Clock, Calculator, ClipboardList,
  Send, Mails, CalendarDays, Wallet,
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
const COMMISSION_VARIANTS: Record<string, 'success' | 'warning' | 'default'> = {
  payee: 'success', validee: 'warning', en_attente: 'default',
}
const COMMISSION_LABELS: Record<string, string> = {
  payee: 'Payée', validee: 'Validée', en_attente: 'En attente',
}

export default async function ApporteurHomePage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // Trouver la fiche apporteur liée
  const { data: apporteur } = await supabase
    .from('apporteurs_affaires')
    .select('id, taux_commission')
    .eq('user_id', session.user.id)
    .single()

  if (!apporteur) {
    return (
      <div className="animate-fade-in">
        <AccountNotLinked roleName="Apporteur d'affaires" userName={session.user.first_name || 'Apporteur'} />
      </div>
    )
  }

  // Requêtes indépendantes en parallèle : leads, commissions, leads avec client
  const [
    { data: leads },
    { data: commissions },
    { data: leadsWithClient },
  ] = await Promise.all([
    // Leads sourcés par cet apporteur
    supabase
      .from('leads')
      .select('id, contact_nom, contact_prenom, entreprise, status, montant_estime, created_at')
      .eq('apporteur_id', apporteur.id)
      .order('created_at', { ascending: false })
      .limit(50),
    // Commissions
    supabase
      .from('commissions')
      .select('id, montant, status, date_validation, lead:leads(contact_nom, contact_prenom, entreprise, status)')
      .eq('apporteur_id', apporteur.id)
      .order('date_validation', { ascending: false })
      .limit(20),
    // Clients liés aux leads
    supabase
      .from('leads')
      .select('client_id')
      .eq('apporteur_id', apporteur.id)
      .not('client_id', 'is', null),
  ])

  const allLeads = leads || []
  const gagnes = allLeads.filter(l => l.status === 'gagne')
  const enCours = allLeads.filter(l => !['gagne', 'perdu'].includes(l.status))
  const caGenere = gagnes.reduce((s, l) => s + (l.montant_estime || 0), 0)
  const pipeline = enCours.reduce((s, l) => s + (l.montant_estime || 0), 0)
  const tauxConversion = allLeads.length > 0 ? Math.round((gagnes.length / allLeads.length) * 100) : 0

  const allCommissions = commissions || []
  const commissionsPayees = allCommissions.filter(c => c.status === 'payee').reduce((s, c) => s + (c.montant || 0), 0)
  const commissionsEnAttente = allCommissions.filter(c => c.status !== 'payee').reduce((s, c) => s + (c.montant || 0), 0)

  const clientIds = [...new Set((leadsWithClient || []).map((l: any) => l.client_id).filter(Boolean))]
  let clients: any[] = []
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from('clients')
      .select('id, raison_sociale, ville, secteur_activite')
      .in('id', clientIds)
    clients = data || []
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Bonjour, {session.user.first_name}
        </h1>
        <p className="text-surface-500 mt-1 text-sm">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' — Espace apporteur d\'affaires'}
        </p>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-5 bg-emerald-50">
          <div className="flex items-center gap-2 mb-2">
            <Euro className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">CA généré</span>
          </div>
          <div className="text-2xl font-heading font-bold text-emerald-600">
            {Number(caGenere).toLocaleString('fr-FR')} €
          </div>
          <div className="text-xs text-surface-500 mt-1">{gagnes.length} dossier{gagnes.length > 1 ? 's' : ''} gagné{gagnes.length > 1 ? 's' : ''}</div>
        </div>

        <div className="rounded-2xl p-5 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Commissions</span>
          </div>
          <div className="text-2xl font-heading font-bold text-blue-600">
            {Number(commissionsPayees + commissionsEnAttente).toLocaleString('fr-FR')} €
          </div>
          <div className="text-xs text-surface-500 mt-1">{Number(commissionsPayees).toLocaleString('fr-FR')} € encaissées</div>
        </div>

        <div className="rounded-2xl p-5 bg-violet-50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Pipeline</span>
          </div>
          <div className="text-2xl font-heading font-bold text-violet-600">
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
      </div>

      {/* Alerte commissions en attente */}
      {commissionsEnAttente > 0 && (
        <div className="card p-4 border-l-4 border-amber-400 bg-amber-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-sm font-medium text-surface-800">Commissions en attente de paiement</div>
                <div className="text-xs text-surface-500">{allCommissions.filter(c => c.status !== 'payee').length} commission(s) à percevoir</div>
              </div>
            </div>
            <div className="text-lg font-heading font-bold text-amber-600">
              {Number(commissionsEnAttente).toLocaleString('fr-FR')} €
            </div>
          </div>
        </div>
      )}

      {/* Deux colonnes : Leads + Commissions/Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Colonne gauche : Leads */}
        <div className="space-y-4">
          {/* Bouton ajouter */}
          <Link href="/dashboard/leads"
            className="card p-4 flex items-center gap-4 hover:shadow-card transition-all active:scale-[0.99] border-2 border-dashed border-surface-200 hover:border-brand-300">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-brand-50 text-brand-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-heading font-semibold text-surface-900">Soumettre un nouveau lead</div>
              <div className="text-xs text-surface-500">Proposer un prospect à Lab Learning</div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-300 shrink-0" />
          </Link>

          {/* Liste leads */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes leads ({allLeads.length})</span>
              <Link href="/dashboard/leads" className="text-xs text-brand-600 font-medium">Voir tout</Link>
            </div>
            {allLeads.length > 0 ? (
              <div className="divide-y divide-surface-100">
                {allLeads.slice(0, 8).map(lead => (
                  <Link key={lead.id} href="/dashboard/leads"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">{lead.contact_prenom} {lead.contact_nom}</div>
                      {lead.entreprise && <div className="text-xs text-surface-500 truncate">{lead.entreprise}</div>}
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
                Aucun lead pour le moment
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : Commissions + Clients */}
        <div className="space-y-4">
          {/* Commissions */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Commissions</span>
              {apporteur.taux_commission && (
                <span className="text-xs text-surface-400">Taux : {apporteur.taux_commission}%</span>
              )}
            </div>

            {/* Mini résumé */}
            <div className="grid grid-cols-2 divide-x divide-surface-100 border-b border-surface-100">
              <div className="px-4 py-3 text-center">
                <div className="text-lg font-heading font-bold text-emerald-600">{Number(commissionsPayees).toLocaleString('fr-FR')} €</div>
                <div className="text-[11px] text-surface-400">Encaissées</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="text-lg font-heading font-bold text-amber-600">{Number(commissionsEnAttente).toLocaleString('fr-FR')} €</div>
                <div className="text-[11px] text-surface-400">En attente</div>
              </div>
            </div>

            {allCommissions.length > 0 ? (
              <div className="divide-y divide-surface-100">
                {allCommissions.slice(0, 6).map((c: any) => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">
                          {c.lead?.contact_prenom} {c.lead?.contact_nom}
                        </div>
                        <div className="text-xs text-surface-500 truncate">{c.lead?.entreprise || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={COMMISSION_VARIANTS[c.status] || 'default'}>
                          {COMMISSION_LABELS[c.status] || c.status}
                        </Badge>
                        <span className="text-sm font-bold text-surface-900">
                          {Number(c.montant || 0).toLocaleString('fr-FR')} €
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-surface-400">
                <Euro className="h-6 w-6 mx-auto mb-2 text-surface-300" />
                Aucune commission
              </div>
            )}
          </div>

          {/* Clients */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes clients ({clients.length})</span>
            </div>
            {clients.length > 0 ? (
              <div className="divide-y divide-surface-100">
                {clients.map((client: any) => (
                  <div key={client.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-surface-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">{client.raison_sociale}</div>
                      {client.ville && <div className="text-xs text-surface-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{client.ville}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-surface-400">
                <Building2 className="h-6 w-6 mx-auto mb-2 text-surface-300" />
                Aucun client lié
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outils terrain */}
      <div className="card p-4">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Outils terrain</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Simulateur OPCO', href: '/dashboard/simulateur', icon: Calculator, color: 'text-violet-600 bg-violet-50' },
            { label: 'Audit Conformité', href: '/dashboard/audit', icon: ClipboardList, color: 'text-amber-600 bg-amber-50' },
            { label: 'Prospection', href: '/dashboard/prospection', icon: Send, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Mailing', href: '/dashboard/mailing', icon: Mails, color: 'text-rose-600 bg-rose-50' },
            { label: 'Agenda', href: '/dashboard/agenda', icon: CalendarDays, color: 'text-teal-600 bg-teal-50' },
            { label: 'Catalogue', href: '/dashboard/formations', icon: Users, color: 'text-blue-600 bg-blue-50' },
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
