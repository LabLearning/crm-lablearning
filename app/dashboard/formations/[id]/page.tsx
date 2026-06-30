import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Clock, Users, GraduationCap, MapPin, Calendar, Tag,
  CheckCircle2, FileText, ListChecks, Euro, Download,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export default async function FormationDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: formation } = await supabase
    .from('formations')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!formation) redirect('/dashboard/formations')

  // Sessions liées + QCM liés (indépendants entre eux)
  const [{ data: sessions }, { data: qcms }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, reference, status, date_debut, date_fin, lieu, formateur:formateurs(prenom, nom)')
      .eq('formation_id', params.id)
      .order('date_debut', { ascending: false }),
    supabase
      .from('qcm')
      .select('id, titre, type, status')
      .eq('formation_id', params.id),
  ])

  const STATUS_LABELS: Record<string, string> = {
    planifiee: 'Planifiée', confirmee: 'Confirmée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
  }
  const STATUS_VARIANTS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
    planifiee: 'default', confirmee: 'info', en_cours: 'success', terminee: 'default', annulee: 'danger',
  }

  const objectifs = formation.objectifs_pedagogiques || []
  const competences = formation.competences_visees || []

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/formations" className="mt-1 p-2 rounded-xl hover:bg-surface-100 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5 text-surface-500" />
        </Link>
        <div className="flex-1 min-w-0">
          {formation.reference && <div className="text-xs font-mono text-surface-400 mb-0.5">{formation.reference}</div>}
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">
            {formation.intitule}
          </h1>
          {formation.sous_titre && <p className="text-surface-500 mt-1 text-sm">{formation.sous_titre}</p>}
          <div className="flex items-center gap-4 mt-2 text-sm text-surface-500 flex-wrap">
            {formation.duree_heures && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formation.duree_heures}h</span>}
            {formation.duree_jours && <span>{formation.duree_jours} jour{formation.duree_jours > 1 ? 's' : ''}</span>}
            {formation.categorie && <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{formation.categorie}</span>}
            <Badge variant={formation.is_active ? 'success' : 'default'}>{formation.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>
        <a href={`/api/pdf/programme/${params.id}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shrink-0 transition-colors" style={{ backgroundColor: '#195245' }}>
          <Download className="h-4 w-4" /> Programme PDF
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-blue-50 text-center">
          <div className="text-2xl font-heading font-bold text-blue-600">{(sessions || []).length}</div>
          <div className="text-xs text-surface-600">Sessions</div>
        </div>
        <div className="rounded-2xl p-4 bg-violet-50 text-center">
          <div className="text-2xl font-heading font-bold text-violet-600">{(qcms || []).length}</div>
          <div className="text-xs text-surface-600">QCM</div>
        </div>
        <div className="rounded-2xl p-4 bg-emerald-50 text-center">
          <div className="text-2xl font-heading font-bold text-emerald-600">{formation.duree_heures || 0}h</div>
          <div className="text-xs text-surface-600">Durée</div>
        </div>
        <div className="rounded-2xl p-4 bg-amber-50 text-center">
          <div className="text-2xl font-heading font-bold text-amber-600">{objectifs.length}</div>
          <div className="text-xs text-surface-600">Objectifs</div>
        </div>
      </div>

      {/* Programme */}
      {(objectifs.length > 0 || formation.programme_detaille || formation.prerequis || formation.public_vise) && (
        <div className="card p-6 space-y-4">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Programme & objectifs</div>

          {objectifs.length > 0 && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-2">Objectifs pédagogiques</div>
              <ul className="space-y-1.5">
                {objectifs.map((o: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-surface-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {formation.public_vise && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-1">Public visé</div>
              <p className="text-sm text-surface-600">{formation.public_vise}</p>
            </div>
          )}

          {formation.prerequis && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-1">Prérequis</div>
              <p className="text-sm text-surface-600">{formation.prerequis}</p>
            </div>
          )}

          {formation.programme_detaille && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-1">Programme détaillé</div>
              <pre className="text-sm text-surface-600 whitespace-pre-wrap font-sans">{formation.programme_detaille}</pre>
            </div>
          )}

          {competences.length > 0 && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-2">Compétences visées</div>
              <div className="flex flex-wrap gap-2">
                {competences.map((c: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-brand-50 text-xs font-medium text-brand-700">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pédagogie */}
      {(formation.methodes_pedagogiques || formation.moyens_techniques || formation.modalites_evaluation) && (
        <div className="card p-6 space-y-3">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Moyens pédagogiques</div>
          {formation.methodes_pedagogiques && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-1">Méthodes</div>
              <p className="text-sm text-surface-600">{formation.methodes_pedagogiques}</p>
            </div>
          )}
          {formation.moyens_techniques && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-1">Moyens techniques</div>
              <p className="text-sm text-surface-600">{formation.moyens_techniques}</p>
            </div>
          )}
          {formation.modalites_evaluation && (
            <div>
              <div className="text-sm font-medium text-surface-800 mb-1">Modalités d'évaluation</div>
              <p className="text-sm text-surface-600">{formation.modalites_evaluation}</p>
            </div>
          )}
        </div>
      )}

      {/* Sessions */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100">
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Sessions ({(sessions || []).length})</span>
        </div>
        {(sessions || []).length > 0 ? (
          <div className="divide-y divide-surface-100">
            {(sessions || []).map((s: any) => (
              <Link key={s.id} href={`/dashboard/sessions/${s.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors">
                <Calendar className="h-4 w-4 text-surface-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900">{s.reference}</div>
                  <div className="text-xs text-surface-500">
                    {formatDate(s.date_debut, { day: 'numeric', month: 'short' })} — {formatDate(s.date_fin, { day: 'numeric', month: 'short' })}
                    {s.lieu && ` · ${s.lieu}`}
                    {s.formateur && ` · ${s.formateur.prenom} ${s.formateur.nom}`}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANTS[s.status] || 'default'}>{STATUS_LABELS[s.status] || s.status}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-sm text-surface-400">Aucune session planifiée</div>
        )}
      </div>

      {/* QCM */}
      {(qcms || []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">QCM associés ({(qcms || []).length})</span>
          </div>
          <div className="divide-y divide-surface-100">
            {(qcms || []).map((q: any) => (
              <div key={q.id} className="flex items-center gap-3 px-4 py-3.5">
                <ListChecks className="h-4 w-4 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900">{q.titre}</div>
                </div>
                <Badge variant={q.status === 'publie' ? 'success' : 'default'}>{q.status === 'publie' ? 'Publié' : 'Brouillon'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
