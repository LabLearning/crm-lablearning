import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AccountNotLinked } from '@/components/dashboard/AccountNotLinked'
import { GraduationCap, FileText, ListChecks, Calendar, Clock, ChevronRight, MapPin } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function ApprenantHomePage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Trouver la fiche apprenant liée
  const { data: apprenant } = await supabase
    .from('apprenants')
    .select('id, prenom, nom')
    .eq('user_id', session.user.id)
    .single()

  if (!apprenant) {
    return (
      <div className="animate-fade-in">
        <AccountNotLinked roleName="Apprenant" userName={session.user.first_name || 'Apprenant'} />
      </div>
    )
  }

  // Requêtes indépendantes en parallèle : inscriptions, documents, QCM
  const [
    { data: inscriptions },
    { count: nbDocuments },
    { count: nbQcm },
  ] = await Promise.all([
    // Inscriptions avec sessions et formations
    supabase
      .from('inscriptions')
      .select('id, status, session:sessions(id, reference, date_debut, date_fin, lieu, status, formation:formations(intitule, duree_heures))')
      .eq('apprenant_id', apprenant.id)
      .not('status', 'in', '("annule","abandonne")')
      .order('created_at', { ascending: false }),
    // Documents disponibles
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('apprenant_id', apprenant.id),
    // QCM sessions disponibles
    supabase
      .from('qcm_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('apprenant_id', apprenant.id)
      .is('completed_at', null),
  ])

  const allInscriptions = inscriptions || []
  const enCours = allInscriptions.filter((i: any) => ['confirmee', 'en_cours'].includes(i.session?.status))
  const aVenir = allInscriptions.filter((i: any) => i.session?.status === 'planifiee' || (i.session?.date_debut && new Date(i.session.date_debut) > new Date()))

  const prochaine = aVenir.length > 0 ? aVenir[0] : enCours.length > 0 ? enCours[0] : null

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Bonjour, {session.user.first_name}
        </h1>
        <p className="text-surface-500 mt-1 text-sm">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' — Espace apprenant'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-5 bg-blue-50">
          <div className="text-3xl font-heading font-bold text-blue-600">{allInscriptions.length}</div>
          <div className="text-sm font-medium text-surface-700 mt-1">Formations inscrites</div>
        </div>
        <div className="rounded-2xl p-5 bg-emerald-50">
          <div className="text-3xl font-heading font-bold text-emerald-600">{enCours.length}</div>
          <div className="text-sm font-medium text-surface-700 mt-1">En cours</div>
        </div>
        <div className="rounded-2xl p-5 bg-violet-50">
          <div className="text-3xl font-heading font-bold text-violet-600">{nbQcm || 0}</div>
          <div className="text-sm font-medium text-surface-700 mt-1">QCM à passer</div>
        </div>
        <div className="rounded-2xl p-5 bg-amber-50">
          <div className="text-3xl font-heading font-bold text-amber-600">{nbDocuments || 0}</div>
          <div className="text-sm font-medium text-surface-700 mt-1">Documents</div>
        </div>
      </div>

      {/* Prochaine session */}
      {prochaine && (
        <div className="card p-5 border-l-4" style={{ borderLeftColor: '#195144' }}>
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Prochaine session</div>
          <div className="text-base font-heading font-semibold text-surface-900">
            {(prochaine as any).session?.formation?.intitule || 'Formation'}
          </div>
          <div className="text-sm text-surface-500 mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate((prochaine as any).session?.date_debut, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {(prochaine as any).session?.lieu && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {(prochaine as any).session.lieu}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Mes formations', href: '/dashboard/formations', icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
          { label: 'Documents', href: '/dashboard/documents', icon: FileText, color: 'text-amber-600 bg-amber-50' },
          { label: 'QCM', href: '/dashboard/qcm', icon: ListChecks, color: 'text-violet-600 bg-violet-50' },
          { label: 'Évaluations', href: '/dashboard/evaluations', icon: GraduationCap, color: 'text-emerald-600 bg-emerald-50' },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="card p-4 flex items-center gap-3 hover:shadow-card transition-all active:scale-[0.98]">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${a.color}`}>
              <a.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-surface-800 flex-1">{a.label}</span>
            <ChevronRight className="h-4 w-4 text-surface-300" />
          </Link>
        ))}
      </div>

      {/* Mes formations */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes formations</div>
        </div>
        {allInscriptions.length > 0 ? (
          <div className="divide-y divide-surface-100">
            {allInscriptions.map((ins: any) => (
              <Link key={ins.id} href="/dashboard/formations"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-5 w-5 text-surface-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">
                    {ins.session?.formation?.intitule || ins.session?.reference || 'Formation'}
                  </div>
                  <div className="text-xs text-surface-500">
                    {ins.session?.date_debut && formatDate(ins.session.date_debut, { day: 'numeric', month: 'long' })}
                    {ins.session?.formation?.duree_heures && ` — ${ins.session.formation.duree_heures}h`}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                  ins.status === 'confirme' ? 'bg-emerald-100 text-emerald-700' :
                  ins.status === 'en_attente' ? 'bg-amber-100 text-amber-700' :
                  'bg-surface-100 text-surface-600'
                }`}>
                  {ins.status === 'confirme' ? 'Confirmé' : ins.status === 'en_attente' ? 'En attente' : ins.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-surface-400">
            <Clock className="h-8 w-8 mx-auto mb-2 text-surface-300" />
            Aucune formation pour le moment
          </div>
        )}
      </div>
    </div>
  )
}
