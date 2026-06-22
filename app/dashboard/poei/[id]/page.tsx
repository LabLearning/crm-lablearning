import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui'
import { POEI_STATUS_LABELS, POEI_STATUS_COLORS } from '@/lib/types/poei'
import { PoeiStatusBar } from './PoeiStatusBar'
import { PoeiEditor } from './PoeiEditor'
import type { Poei } from '@/lib/types/poei'

export const dynamic = 'force-dynamic'

export default async function PoeiDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select(`*, client:clients(raison_sociale), formation:formations(intitule), session:sessions(reference, date_debut, date_fin)`)
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!poei) redirect('/dashboard/poei')
  const p = poei as Poei

  const { data: clients } = await supabase
    .from('clients').select('id, raison_sociale').eq('organization_id', session.organization.id).order('raison_sociale')
  const { data: formations } = await supabase
    .from('formations').select('id, intitule').eq('organization_id', session.organization.id).eq('is_active', true).order('intitule')
  const { data: sessions } = await supabase
    .from('sessions').select('id, intitule, reference, date_debut, ville').eq('organization_id', session.organization.id).order('date_debut', { ascending: false }).limit(300)

  const candidatNom = `${p.candidat_prenom || ''} ${p.candidat_nom}`.trim()

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div>
        <Link href="/dashboard/poei" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux POEI
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900">{candidatNom || 'Candidat'}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm text-surface-500 font-mono">{p.numero}</span>
              <Badge variant={POEI_STATUS_COLORS[p.statut]} dot>{POEI_STATUS_LABELS[p.statut]}</Badge>
              {p.poste_vise && <span className="text-sm text-surface-600">· {p.poste_vise}</span>}
            </div>
          </div>
        </div>
      </div>

      <PoeiStatusBar poeiId={p.id} statut={p.statut} />

      <PoeiEditor poei={p} clients={clients || []} formations={formations || []} sessions={(sessions || []) as any[]} />
    </div>
  )
}
