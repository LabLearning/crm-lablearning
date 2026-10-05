import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ReceiptText } from '@/components/ui/icons'
import { SESSION_DETAIL_SELECT, chargerDetailsPrestations, periodeFr } from '@/lib/facture-formateur-detail'
import { FacturesFormateursList } from './FacturesFormateursList'

export const dynamic = 'force-dynamic'

export default async function FacturesFormateursPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: facturesRaw } = await supabase
    .from('factures_formateur')
    .select(`*, formateur:formateur_id(prenom, nom), ${SESSION_DETAIL_SELECT}`)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })
  const factures = (facturesRaw || []) as any[]

  // Le détail de chaque prestation vient de la session rattachée
  const details = await chargerDetailsPrestations(supabase, factures)

  // Factures sans session : les sessions du même formateur pas encore facturées, pour les rattacher d'un clic
  const orphelins = [...new Set(factures.filter((f) => !f.session_id).map((f) => f.formateur_id))] as string[]
  const candidates: Record<string, { id: string; label: string }[]> = {}
  if (orphelins.length > 0) {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, formateur_id, reference, date_debut, date_fin, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)')
      .eq('organization_id', session.organization.id)
      .in('formateur_id', orphelins)
      .neq('status', 'annulee')
      .order('date_debut', { ascending: false })
      .limit(1000)
    const facturees = new Set(factures.filter((f) => f.session_id && f.status !== 'rejetee').map((f) => `${f.formateur_id}:${f.session_id}`))
    for (const s of (sessions || []) as any[]) {
      if (facturees.has(`${s.formateur_id}:${s.id}`)) continue
      const client = s.client?.nom_commercial || s.client?.raison_sociale
      ;(candidates[s.formateur_id] ||= []).push({
        id: s.id,
        label: [periodeFr(s.date_debut, s.date_fin), client, s.formation?.intitule, s.reference].filter(Boolean).join(' · '),
      })
    }
  }

  // URLs signées des PDF déposés (bucket privé)
  const paths = factures.map((f) => f.fichier_url).filter((u) => u && !/^https?:\/\//.test(u)) as string[]
  const fileUrls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('dossiers').createSignedUrls(paths, 3600)
    ;(signed || []).forEach((s, i) => { if (s?.signedUrl && !s.error) fileUrls[paths[i]] = s.signedUrl })
  }
  for (const f of factures) if (f.fichier_url && /^https?:\/\//.test(f.fichier_url)) fileUrls[f.fichier_url] = f.fichier_url

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <ReceiptText className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-surface-900">Factures formateurs</h1>
          <p className="text-sm text-surface-500">Factures de prestation envoyées par les formateurs, avec le détail de chaque prestation : à valider puis à mettre en paiement.</p>
        </div>
      </div>

      <FacturesFormateursList factures={factures} fileUrls={fileUrls} details={details} candidates={candidates} />
    </div>
  )
}
