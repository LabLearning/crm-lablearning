import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AccountNotLinked } from '@/components/dashboard/AccountNotLinked'
import { MissionPendingCard } from './MissionPendingCard'
import Link from 'next/link'
import {
  Calendar, Users, ClipboardCheck, Clock, ChevronRight, GraduationCap, FileText,
  Euro, TrendingUp, Target, UserPlus, Building2, MapPin, Wallet, ListChecks,
} from 'lucide-react'
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

export default async function MonEspacePage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const role = session.user.role
  const userName = session.user.first_name || 'Utilisateur'

  // ── FORMATEUR ──
  if (role === 'formateur') {
    const { data: formateur } = await supabase
      .from('formateurs').select('id, prenom, nom').eq('user_id', session.user.id).single()

    if (!formateur) {
      return <AccountNotLinked roleName="Formateur" userName={userName} />
    }

    // Missions à valider (proposées en attente de réponse)
    const { data: pendingMissions } = await supabase
      .from('sessions')
      .select(`
        id, reference, date_debut, date_fin, lieu, horaires, mission_proposed_at,
        formation:formations(intitule),
        proposer:users!sessions_mission_proposed_by_fkey(first_name, last_name)
      `)
      .eq('formateur_id', formateur.id)
      .eq('mission_status', 'pending')
      .order('date_debut', { ascending: true })

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, reference, status, date_debut, date_fin, lieu, formation:formations(intitule)')
      .eq('formateur_id', formateur.id)
      .eq('mission_status', 'accepted')
      .in('status', ['planifiee', 'confirmee', 'en_cours'])
      .order('date_debut', { ascending: true })
      .limit(10)

    const allSessions = sessions || []
    const sessionIds = allSessions.map(s => s.id)
    let nbApprenants = 0
    if (sessionIds.length > 0) {
      const { count } = await supabase.from('inscriptions').select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")')
      nbApprenants = count || 0
    }

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900">Bonjour, {userName}</h1>
          <p className="text-surface-500 mt-1 text-sm">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {/* Missions à valider — en haut, prioritaires */}
        {(pendingMissions || []).length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              {(pendingMissions || []).length} mission{(pendingMissions || []).length > 1 ? 's' : ''} en attente de votre réponse
            </div>
            {(pendingMissions || []).map((m: any) => (
              <MissionPendingCard key={m.id} mission={{
                id: m.id,
                reference: m.reference,
                date_debut: m.date_debut,
                date_fin: m.date_fin,
                lieu: m.lieu,
                horaires: m.horaires,
                formation_intitule: m.formation?.intitule || 'Formation',
                proposed_at: m.mission_proposed_at,
                proposed_by_name: m.proposer ? `${m.proposer.first_name} ${m.proposer.last_name}` : null,
              }} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl p-5 bg-blue-50">
            <div className="text-3xl font-heading font-bold text-blue-600">{allSessions.length}</div>
            <div className="text-sm font-medium text-surface-700 mt-1">Sessions actives</div>
          </div>
          <div className="rounded-2xl p-5 bg-emerald-50">
            <div className="text-3xl font-heading font-bold text-emerald-600">{nbApprenants}</div>
            <div className="text-sm font-medium text-surface-700 mt-1">Apprenants</div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes prochaines sessions</div>
          </div>
          {allSessions.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {allSessions.map((s: any) => (
                <Link key={s.id} href={`/dashboard/sessions/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-surface-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{s.formation?.intitule || s.reference}</div>
                    <div className="text-xs text-surface-500">
                      {formatDate(s.date_debut, { day: 'numeric', month: 'long' })}{s.lieu && ` — ${s.lieu}`}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-300" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-surface-400">
              <Clock className="h-8 w-8 mx-auto mb-2 text-surface-300" />
              Aucune session planifiée
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── APPORTEUR D'AFFAIRES ──
  if (role === 'apporteur_affaires') {
    const { data: apporteur } = await supabase
      .from('apporteurs_affaires').select('id, taux_commission').eq('user_id', session.user.id).single()

    if (!apporteur) {
      return <AccountNotLinked roleName="Apporteur d'affaires" userName={userName} />
    }

    const { data: leads } = await supabase
      .from('leads').select('id, contact_nom, contact_prenom, entreprise, status, montant_estime')
      .eq('apporteur_id', apporteur.id).order('created_at', { ascending: false }).limit(20)

    const allLeads = leads || []
    const gagnes = allLeads.filter(l => l.status === 'gagne')
    const enCours = allLeads.filter(l => !['gagne', 'perdu'].includes(l.status))
    const caGenere = gagnes.reduce((s, l) => s + (l.montant_estime || 0), 0)

    const { data: commissions } = await supabase
      .from('commissions').select('montant_commission, status').eq('apporteur_id', apporteur.id)
    const allComms = commissions || []
    const payees = allComms.filter(c => c.status === 'payee').reduce((s, c) => s + (Number(c.montant_commission) || 0), 0)
    const enAttente = allComms.filter(c => c.status !== 'payee').reduce((s, c) => s + (Number(c.montant_commission) || 0), 0)

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900">Bonjour, {userName}</h1>
          <p className="text-surface-500 mt-1 text-sm">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl p-5 bg-emerald-50">
            <div className="flex items-center gap-2 mb-2"><Euro className="h-4 w-4 text-emerald-500" /><span className="text-xs font-semibold text-emerald-600 uppercase">CA généré</span></div>
            <div className="text-2xl font-heading font-bold text-emerald-600">{Number(caGenere).toLocaleString('fr-FR')} €</div>
            <div className="text-xs text-surface-500 mt-1">{gagnes.length} gagné(s)</div>
          </div>
          <div className="rounded-2xl p-5 bg-blue-50">
            <div className="flex items-center gap-2 mb-2"><Wallet className="h-4 w-4 text-blue-500" /><span className="text-xs font-semibold text-blue-600 uppercase">Commissions</span></div>
            <div className="text-2xl font-heading font-bold text-blue-600">{Number(payees + enAttente).toLocaleString('fr-FR')} €</div>
            <div className="text-xs text-surface-500 mt-1">{Number(payees).toLocaleString('fr-FR')} € encaissées</div>
          </div>
          <div className="rounded-2xl p-5 bg-violet-50">
            <div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-violet-500" /><span className="text-xs font-semibold text-violet-600 uppercase">En cours</span></div>
            <div className="text-2xl font-heading font-bold text-violet-600">{enCours.length}</div>
          </div>
          <div className="rounded-2xl p-5 bg-amber-50">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-amber-500" /><span className="text-xs font-semibold text-amber-600 uppercase">Conversion</span></div>
            <div className="text-2xl font-heading font-bold text-amber-600">{allLeads.length > 0 ? Math.round((gagnes.length / allLeads.length) * 100) : 0}%</div>
          </div>
        </div>

        <Link href="/mon-espace/leads" className="card p-5 flex items-center gap-4 hover:shadow-card transition-all border-2 border-dashed border-surface-200 hover:border-brand-300">
          <div className="h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <UserPlus className="h-6 w-6 text-brand-500" />
          </div>
          <div className="flex-1">
            <div className="text-base font-heading font-semibold text-surface-900">Soumettre un nouveau lead</div>
            <div className="text-sm text-surface-500 mt-0.5">Proposer un prospect à Lab Learning</div>
          </div>
          <ChevronRight className="h-5 w-5 text-surface-300" />
        </Link>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes leads</div>
            <Link href="/mon-espace/leads" className="text-xs text-brand-500 font-medium">Voir tout</Link>
          </div>
          {allLeads.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {allLeads.slice(0, 8).map(lead => (
                <div key={lead.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{lead.contact_prenom} {lead.contact_nom}</div>
                    {lead.entreprise && <div className="text-xs text-surface-500 truncate">{lead.entreprise}</div>}
                  </div>
                  {lead.montant_estime && <span className="text-xs font-bold text-surface-600 shrink-0">{Number(lead.montant_estime).toLocaleString('fr-FR')} €</span>}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0', STATUS_COLORS[lead.status])}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-surface-400">Aucun lead pour le moment</div>
          )}
        </div>
      </div>
    )
  }

  // ── APPRENANT ──
  if (role === 'apprenant') {
    const { data: apprenant } = await supabase
      .from('apprenants').select('id').eq('user_id', session.user.id).single()

    if (!apprenant) {
      return <AccountNotLinked roleName="Apprenant" userName={userName} />
    }

    const { data: inscriptions } = await supabase
      .from('inscriptions')
      .select('id, status, session:sessions(id, reference, date_debut, date_fin, lieu, status, formation:formations(intitule, duree_heures))')
      .eq('apprenant_id', apprenant.id)
      .not('status', 'in', '("annule","abandonne")')

    const allInscriptions = inscriptions || []

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900">Bonjour, {userName}</h1>
          <p className="text-surface-500 mt-1 text-sm">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-5 bg-blue-50">
            <div className="text-3xl font-heading font-bold text-blue-600">{allInscriptions.length}</div>
            <div className="text-sm font-medium text-surface-700 mt-1">Formations inscrites</div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes formations</div>
          </div>
          {allInscriptions.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {allInscriptions.map((ins: any) => (
                <div key={ins.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-5 w-5 text-surface-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{ins.session?.formation?.intitule || ins.session?.reference}</div>
                    <div className="text-xs text-surface-500">
                      {ins.session?.date_debut && formatDate(ins.session.date_debut, { day: 'numeric', month: 'long' })}
                      {ins.session?.formation?.duree_heures && ` — ${ins.session.formation.duree_heures}h`}
                    </div>
                  </div>
                  <Badge variant={ins.status === 'confirme' ? 'success' : 'info'}>
                    {ins.status === 'confirme' ? 'Confirmé' : 'Inscrit'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-surface-400">
              <Clock className="h-8 w-8 mx-auto mb-2 text-surface-300" />
              Aucune formation
            </div>
          )}
        </div>
      </div>
    )
  }

  return <div className="text-center py-10 text-sm text-surface-400">Aucun contenu disponible.</div>
}
