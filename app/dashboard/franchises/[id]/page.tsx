import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ArrowLeft, Store, Building2, Banknote, Target, ClipboardCheck, Star } from 'lucide-react'
import { commissionTypeLabel } from '@/lib/commission'
import FranchiseDetailClient from './FranchiseDetailClient'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default async function FranchiseDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: franchise } = await supabase
    .from('apporteurs_affaires')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .eq('categorie', 'partenaire')
    .single()

  if (!franchise) notFound()

  // Établissements
  const { data: etablissements } = await supabase
    .from('clients')
    .select('id, raison_sociale, ville, code_postal')
    .eq('franchise_id', params.id)
    .eq('organization_id', orgId)
    .order('raison_sociale')

  const clientIds = (etablissements || []).map((c) => c.id)

  // Dossiers de la franchise (par franchise_id OU par client rattaché)
  const { data: dossiers } = await supabase
    .from('dossiers_formation')
    .select(`
      id, numero, status, opco_workflow_status,
      montant_total_ttc, montant_prise_en_charge, cout_formateur,
      commission_montant, commission_taux, commission_type, commission_status, commission_payee_at,
      date_creation,
      client:clients(id, raison_sociale),
      formation:formations(intitule)
    `)
    .eq('organization_id', orgId)
    .or(
      clientIds.length
        ? `franchise_id.eq.${params.id},client_id.in.(${clientIds.join(',')})`
        : `franchise_id.eq.${params.id}`,
    )
    .order('date_creation', { ascending: false })

  // Audits de la franchise (récents)
  const { data: audits } = await supabase
    .from('audits_etablissement')
    .select('id, date_audit, type_audit, note_globale, note_sur, client:clients(raison_sociale)')
    .eq('franchise_id', params.id)
    .eq('organization_id', orgId)
    .order('date_audit', { ascending: false })
    .limit(8)

  const auditsList = audits || []
  const auditsWithNote = auditsList.filter((a) => a.note_globale != null)
  const avgAudit = auditsWithNote.length
    ? auditsWithNote.reduce((s, a) => s + (Number(a.note_globale) / a.note_sur) * 20, 0) / auditsWithNote.length
    : null

  const ds = dossiers || []
  const name = franchise.nom_enseigne || franchise.raison_sociale || `${franchise.prenom || ''} ${franchise.nom || ''}`.trim()

  // Totaux financiers
  const caTotal = ds.reduce((s, d) => s + Number(d.montant_total_ttc || 0), 0)
  const pecTotal = ds.reduce((s, d) => s + Number(d.montant_prise_en_charge || 0), 0)
  const coutFormateurTotal = ds.reduce((s, d) => s + Number(d.cout_formateur || 0), 0)
  const commAVenir = ds.filter((d) => d.commission_status === 'a_venir').reduce((s, d) => s + Number(d.commission_montant || 0), 0)
  const commValidee = ds.filter((d) => d.commission_status === 'validee').reduce((s, d) => s + Number(d.commission_montant || 0), 0)
  const commPayee = ds.filter((d) => d.commission_status === 'payee').reduce((s, d) => s + Number(d.commission_montant || 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/dashboard/franchises" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700">
        <ArrowLeft className="h-4 w-4" /> Franchises
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
            <Store className="h-6 w-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">{name}</h1>
            <p className="text-surface-500 text-sm mt-0.5">
              {franchise.secteur && <span>{franchise.secteur} · </span>}
              {(etablissements || []).length} établissement{(etablissements || []).length > 1 ? 's' : ''}
              {franchise.nombre_points_vente ? ` · ${franchise.nombre_points_vente} points de vente déclarés` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Financier global */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FinCard label="CA généré (TTC)" value={fmtEuro(caTotal)} />
        <FinCard label="Prise en charge OPCO" value={fmtEuro(pecTotal)} />
        <FinCard label="Coût formateurs" value={fmtEuro(coutFormateurTotal)} />
        <FinCard label="Commissions totales" value={fmtEuro(commAVenir + commValidee + commPayee)} accent />
      </div>

      {/* Bloc config + commission breakdown (client) */}
      <FranchiseDetailClient
        franchiseId={franchise.id}
        commissionType={(franchise.commission_type as any) || 'budget_debloque'}
        taux={Number(franchise.taux_commission || 10)}
        commAVenir={commAVenir}
        commValidee={commValidee}
        commPayee={commPayee}
        dossiers={ds as any[]}
      />

      {/* Audits */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-heading font-semibold text-surface-900">
            Audits récents ({auditsList.length})
          </div>
          {avgAudit != null && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <Star className="h-4 w-4" /> {avgAudit.toFixed(1)}/20 de moyenne
            </span>
          )}
        </div>
        {auditsList.length === 0 ? (
          <div className="card p-6 text-center text-sm text-surface-400">
            Aucun audit pour cette franchise. Les audits arrivent via l'outil terrain (API) ou en saisie manuelle dans Audits.
          </div>
        ) : (
          <div className="card divide-y divide-surface-100">
            {auditsList.map((a) => {
              const pct = a.note_globale != null ? (Number(a.note_globale) / a.note_sur) * 100 : null
              const noteCol = pct == null ? 'text-surface-400' : pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="h-4 w-4 text-surface-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      {(a.client as any)?.raison_sociale || 'Établissement'}
                    </div>
                    <div className="text-xs text-surface-500">
                      {a.type_audit} · {new Date(a.date_audit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className={`text-sm font-heading font-bold tabular-nums shrink-0 ${noteCol}`}>
                    {a.note_globale != null ? `${a.note_globale}/${a.note_sur}` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Établissements */}
      <div>
        <div className="text-sm font-heading font-semibold text-surface-900 mb-2">
          Établissements ({(etablissements || []).length})
        </div>
        {(etablissements || []).length === 0 ? (
          <div className="card p-6 text-center text-sm text-surface-400">
            Aucun établissement rattaché à cette franchise pour le moment.
          </div>
        ) : (
          <div className="card divide-y divide-surface-100">
            {(etablissements || []).map((c) => {
              const cDossiers = ds.filter((d) => (d.client as any)?.id === c.id)
              return (
                <Link key={c.id} href={`/dashboard/clients/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/60 transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-surface-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{c.raison_sociale}</div>
                    <div className="text-xs text-surface-500">{[c.code_postal, c.ville].filter(Boolean).join(' ')}</div>
                  </div>
                  <div className="text-xs text-surface-500 shrink-0">
                    {cDossiers.length} dossier{cDossiers.length > 1 ? 's' : ''}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function FinCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-surface-500">{label}</div>
      <div className={`text-xl font-heading font-bold mt-1 tabular-nums ${accent ? 'text-amber-600' : 'text-surface-900'}`}>
        {value}
      </div>
    </div>
  )
}
