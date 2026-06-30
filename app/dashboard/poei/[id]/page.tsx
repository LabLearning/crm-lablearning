import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, GraduationCap, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui'
import { POEI_STATUS_LABELS, POEI_STATUS_COLORS } from '@/lib/types/poei'
import { formatDate } from '@/lib/utils'
import { PoeiStatusBar } from './PoeiStatusBar'
import { PoeiEditor } from './PoeiEditor'
import { PoeiCandidats } from './PoeiCandidats'
import type { Poei, PoeiCandidat } from '@/lib/types/poei'

export const dynamic = 'force-dynamic'

export default async function PoeiDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select(`*, client:clients(raison_sociale), formation:formations(intitule), session:sessions(id, reference, date_debut, date_fin)`)
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!poei) redirect('/dashboard/poei')
  const p = poei as Poei

  const [{ data: candidatsRaw }, { data: clients }, { data: formations }, { data: apprenants }] = await Promise.all([
    supabase
      .from('poei_candidats')
      .select('*, apprenant:apprenants(nom, prenom, email, telephone)')
      .eq('poei_id', params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('clients').select('id, raison_sociale').eq('organization_id', session.organization.id).order('raison_sociale'),
    supabase
      .from('formations').select('id, intitule').eq('organization_id', session.organization.id).eq('is_active', true).order('intitule'),
    supabase
      .from('apprenants').select('id, nom, prenom').eq('organization_id', session.organization.id).order('nom').limit(1000),
  ])
  const candidats = (candidatsRaw || []) as PoeiCandidat[]

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div>
        <Link href="/dashboard/poei" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux POEI
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900 inline-flex items-center gap-2">
              <Building2 className="h-5 w-5 text-sky-500" />
              {p.client?.raison_sociale || 'Projet POEI'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-surface-500">
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold">POEI</span>
              <span className="font-mono">{p.numero}</span>
              <Badge variant={POEI_STATUS_COLORS[p.statut]} dot>{POEI_STATUS_LABELS[p.statut]}</Badge>
              {p.formation?.intitule && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {p.formation.intitule}</span>}
              {p.date_debut && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(p.date_debut, { day: '2-digit', month: 'short' })}{p.date_fin ? ' → ' + formatDate(p.date_fin, { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>}
            </div>
          </div>
        </div>
      </div>

      <PoeiStatusBar poeiId={p.id} statut={p.statut} />

      <PoeiCandidats poeiId={p.id} candidats={candidats} apprenants={apprenants || []} />

      <PoeiEditor poei={p} clients={clients || []} formations={formations || []} />
    </div>
  )
}
