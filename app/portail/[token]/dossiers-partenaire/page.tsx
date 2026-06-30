import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FolderOpen, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

const DOSSIER_STATUS: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'danger' }> = {
  en_creation: { label: 'En creation', variant: 'default' },
  devis_envoye: { label: 'Devis envoye', variant: 'info' },
  convention_signee: { label: 'Convention signee', variant: 'success' },
  en_cours: { label: 'En cours', variant: 'info' },
  realise: { label: 'Realise', variant: 'success' },
  facture: { label: 'Facture', variant: 'success' },
  cloture: { label: 'Cloture', variant: 'default' },
}

export default async function PartenaireDossiersPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apporteur') redirect('/portail/expired')
  const supabase = await createServiceRoleClient()

  // Get leads from this partner and their dossiers — and in parallel, all org
  // dossiers (independent query keyed on organization, not on the leads chain).
  const [dossiersFromLeads, { data: allDossiers }] = await Promise.all([
    (async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, contact_nom, entreprise, status, montant_estime, converted_client_id')
        .eq('apporteur_id', context.apporteur.id)

      const clientIds = (leads || []).map((l: any) => l.converted_client_id).filter(Boolean)

      if (clientIds.length > 0) {
        const { data } = await supabase
          .from('dossiers_formation')
          .select(`
        id, numero, status, montant_total_ht, montant_total_ttc, date_creation,
        financeur_nom, financeur_type,
        client:clients(raison_sociale),
        formation:formation_id(intitule, duree_heures),
        session:sessions(date_debut, date_fin, lieu, status)
      `)
          .in('client_id', clientIds)
          .order('date_creation', { ascending: false })
        return data || []
      }
      return []
    })(),
    // Also get dossiers created from partner's leads (via notes matching)
    supabase
      .from('dossiers_formation')
      .select(`
      id, numero, status, montant_total_ht, montant_total_ttc, date_creation,
      financeur_nom,
      client:clients(raison_sociale),
      formation:formation_id(intitule, duree_heures),
      session:sessions(date_debut, date_fin, lieu)
    `)
      .eq('organization_id', context.organization.id)
      .order('date_creation', { ascending: false })
      .limit(50),
  ])

  let dossiers: any[] = dossiersFromLeads

  // Merge and deduplicate
  const allIds = new Set(dossiers.map((d: any) => d.id))
  ;(allDossiers || []).forEach((d: any) => {
    if (!allIds.has(d.id)) { dossiers.push(d); allIds.add(d.id) }
  })

  const totalCA = dossiers.reduce((s: number, d: any) => s + Number(d.montant_total_ttc || 0), 0)
  const nbRealises = dossiers.filter((d: any) => ['realise', 'facture', 'cloture'].includes(d.status)).length

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">Dossiers de formation</h1>
      <p className="text-surface-500 text-sm mb-6">Suivi des dossiers lies a vos prospects</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total dossiers', value: dossiers.length, color: 'text-surface-900' },
          { label: 'Realises', value: nbRealises, color: 'text-success-600' },
          { label: 'CA total', value: Number(totalCA).toLocaleString('fr-FR') + ' EUR', color: 'text-surface-900' },
          { label: 'Commission estimee', value: Number(Math.round(totalCA * (context.apporteur.taux_commission || 0) / 100)).toLocaleString('fr-FR') + ' EUR', color: 'text-brand-600' },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <div className={`text-xl font-heading font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {dossiers.map((d: any) => {
          const sc = DOSSIER_STATUS[d.status] || DOSSIER_STATUS.en_creation
          return (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-base font-heading font-semibold text-surface-900">
                    {d.formation?.intitule || d.numero}
                  </div>
                  <div className="text-sm text-surface-500 mt-1 space-y-0.5">
                    <div>Client : {d.client?.raison_sociale || '--'}</div>
                    <div>Reference : {d.numero}</div>
                    {d.session?.date_debut && <div>Dates : {formatDate(d.session.date_debut, { day: 'numeric', month: 'long', year: 'numeric' })}{d.session.date_fin && d.session.date_fin !== d.session.date_debut ? ' - ' + formatDate(d.session.date_fin, { day: 'numeric', month: 'long' }) : ''}</div>}
                    {d.session?.lieu && <div>Lieu : {d.session.lieu}</div>}
                    {d.financeur_nom && <div>Financeur : {d.financeur_nom}</div>}
                    {d.montant_total_ttc && <div>Montant : {Number(d.montant_total_ttc).toLocaleString('fr-FR')} EUR</div>}
                  </div>
                </div>
                <Badge variant={sc.variant}>{sc.label}</Badge>
              </div>
            </div>
          )
        })}
      </div>

      {dossiers.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-16">
          <FolderOpen className="h-8 w-8 text-surface-300 mb-3" />
          <p className="text-sm text-surface-500">Aucun dossier pour le moment</p>
        </div>
      )}
    </div>
  )
}
