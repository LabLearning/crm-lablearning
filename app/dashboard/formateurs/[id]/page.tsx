import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, Euro, Presentation, Award, Star, Calendar,
  MapPin, Building2, ShieldCheck, FileText,
} from 'lucide-react'
import { Avatar, Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '@/lib/types/formation'

export const dynamic = 'force-dynamic'

const contratLabels: Record<string, string> = { salarie: 'Salarié', prestataire: 'Prestataire', sous_traitance: 'Sous-traitance', benevole: 'Bénévole' }

export default async function FormateurDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: f } = await supabase
    .from('formateurs')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()
  if (!f) redirect('/dashboard/formateurs')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, lieu, ville, status, formation:formation_id(intitule), client:client_id(raison_sociale)')
    .eq('formateur_id', params.id)
    .order('date_debut', { ascending: false })

  const list = (sessions || []) as any[]
  const now = new Date().toISOString().slice(0, 10)
  const upcoming = list.filter((s) => (s.date_fin || s.date_debut) >= now)
  const past = list.filter((s) => (s.date_fin || s.date_debut) < now)

  const SessionRow = (s: any) => (
    <Link key={s.id} href={`/dashboard/sessions/${s.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors border-b border-surface-100/60 last:border-0">
      <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
        <Calendar className="h-4 w-4 text-surface-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-surface-900 truncate">{s.formation?.intitule || s.intitule || s.reference || 'Session'}</div>
        <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap">
          <span>{formatDate(s.date_debut, { day: 'numeric', month: 'short' })} — {formatDate(s.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {s.client?.raison_sociale && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{s.client.raison_sociale}</span>}
          {(s.lieu || s.ville) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[s.lieu, s.ville].filter(Boolean).join(', ')}</span>}
        </div>
      </div>
      <Badge variant={SESSION_STATUS_COLORS[s.status] || 'default'}>{SESSION_STATUS_LABELS[s.status] || s.status}</Badge>
    </Link>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <Link href="/dashboard/formateurs" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700">
        <ArrowLeft className="h-4 w-4" /> Formateurs
      </Link>

      {/* En-tête */}
      <div className="card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar firstName={f.prenom} lastName={f.nom} src={f.photo_url} size="xl" className="!h-20 !w-20 !text-xl" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-heading font-bold text-surface-900">{f.civilite} {f.prenom} {f.nom}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="default">{contratLabels[f.type_contrat] || f.type_contrat}</Badge>
            {!f.is_active && <Badge variant="warning">Inactif</Badge>}
            {f.note_moyenne && (
              <span className="flex items-center gap-1 text-xs font-medium text-surface-700"><Star className="h-3 w-3 text-warning-500 fill-warning-500" />{f.note_moyenne}/5</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-surface-500 flex-wrap">
            {f.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{f.email}</span>}
            {f.telephone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{f.telephone}</span>}
            {f.tarif_journalier && <span className="flex items-center gap-1"><Euro className="h-3.5 w-3.5" />{Number(f.tarif_journalier).toLocaleString('fr-FR')} €/j</span>}
            {(f as any).zone_intervention && <span className="flex items-center gap-1 text-brand-600 font-medium"><MapPin className="h-3.5 w-3.5" />{(f as any).zone_intervention}</span>}
            {(f as any).numero_da && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />DA {(f as any).numero_da}</span>}
          </div>
          {(f.siret) && <div className="text-xs text-surface-400 mt-1">SIRET {f.siret}</div>}
        </div>
        <div className="text-center shrink-0">
          <div className="text-3xl font-heading font-bold text-brand-600">{list.length}</div>
          <div className="text-xs text-surface-500">session{list.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Expertise / certifications */}
      {((f.domaines_expertise || []).length > 0 || (f.certifications || []).length > 0) && (
        <div className="card p-5 space-y-3">
          {(f.domaines_expertise || []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Domaines d'expertise</div>
              <div className="flex flex-wrap gap-1.5">{(f.domaines_expertise || []).map((d: string) => <Badge key={d} variant="info">{d}</Badge>)}</div>
            </div>
          )}
          {(f.certifications || []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Certifications</div>
              <div className="flex flex-wrap gap-1.5">{(f.certifications || []).map((c: string) => <Badge key={c} variant="success"><Award className="h-3 w-3 mr-0.5" />{c}</Badge>)}</div>
            </div>
          )}
        </div>
      )}

      {/* Sessions */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
          <Presentation className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Sessions animées ({list.length})</span>
        </div>
        {list.length === 0 ? (
          <div className="text-center py-10 text-sm text-surface-400">Aucune session rattachée à ce formateur</div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div className="px-4 py-2 bg-surface-50 text-2xs font-semibold text-surface-400 uppercase tracking-wider">À venir / en cours ({upcoming.length})</div>
                {upcoming.map(SessionRow)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className="px-4 py-2 bg-surface-50 text-2xs font-semibold text-surface-400 uppercase tracking-wider">Passées ({past.length})</div>
                {past.map(SessionRow)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
