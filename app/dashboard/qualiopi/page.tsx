import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { QualiopiDashboard } from './QualiopiDashboard'
import type { QualiopiIndicateur } from '@/lib/types/qualiopi'

export interface CrmEvidence { label: string; href: string; count: number }

export default async function QualiopiPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: indicateurs } = await supabase
    .from('qualiopi_indicateurs')
    .select('*, preuves:qualiopi_preuves(*)')
    .eq('organization_id', orgId)
    .order('critere', { ascending: true })
    .order('indicateur', { ascending: true })

  // Signer les preuves stockées (bucket privé) en un seul appel batch (createSignedUrls)
  const preuvesToSign: { p: any; path: string }[] = []
  for (const ind of indicateurs || []) {
    for (const p of (ind as any).preuves || []) {
      if (!p.document_url) continue
      if (/^https?:\/\//.test(p.document_url)) {
        p.signed_url = p.document_url
      } else {
        preuvesToSign.push({ p, path: p.document_url })
      }
    }
  }
  if (preuvesToSign.length > 0) {
    const { data: signedList } = await supabase.storage
      .from('dossiers')
      .createSignedUrls(preuvesToSign.map((x) => x.path), 3600)
    ;(signedList || []).forEach((signed, idx) => {
      preuvesToSign[idx].p.signed_url = signed?.error ? null : signed?.signedUrl || null
    })
  }

  // Preuves vivantes déjà produites par le CRM (compteurs par module)
  const safeCount = async (table: string): Promise<number> => {
    try {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
      return count || 0
    } catch { return 0 }
  }
  const [nbEmarg, nbSatis, nbRecla, nbActions, nbDocs] = await Promise.all([
    safeCount('emargements'),
    safeCount('evaluations_satisfaction'),
    safeCount('reclamations'),
    safeCount('actions_amelioration'),
    safeCount('documents'),
  ])

  const crmEvidence: Record<number, CrmEvidence[]> = {
    9: [{ label: 'Documents remis (livret, convocations…)', href: '/dashboard/documents', count: nbDocs }],
    11: [{ label: 'Attestations & évaluations des acquis', href: '/dashboard/evaluations', count: nbDocs }],
    12: [{ label: 'Émargements signés', href: '/dashboard/sessions', count: nbEmarg }],
    28: [{ label: 'Questionnaires de satisfaction', href: '/dashboard/evaluations', count: nbSatis }],
    29: [{ label: 'Réclamations enregistrées', href: '/dashboard/reclamations', count: nbRecla }],
    30: [{ label: "Actions d'amélioration", href: '/dashboard/reclamations', count: nbActions }],
    31: [{ label: "Actions d'amélioration", href: '/dashboard/reclamations', count: nbActions }],
    32: [{ label: "Actions d'amélioration", href: '/dashboard/reclamations', count: nbActions }],
  }

  return (
    <div className="animate-fade-in">
      <QualiopiDashboard
        indicateurs={(indicateurs || []) as QualiopiIndicateur[]}
        initialized={(indicateurs || []).length > 0}
        crmEvidence={crmEvidence}
      />
    </div>
  )
}
