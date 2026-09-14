import { BackLink } from '@/components/ui'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { Store, ClipboardCheck, Star } from '@/components/ui/icons'
import { commissionTypeLabel, syncFranchiseCommissions } from '@/lib/commission'
import { getFranchiseCommissionLines, getFranchiseParcours, getFranchiseAudits, syntheseAudits } from '@/lib/franchise-data'
import FranchisePhases from './FranchisePhases'
import FranchiseDetailClient from './FranchiseDetailClient'
import { FranchiseGabaritsClient } from './FranchiseGabaritsClient'
import FranchiseAccessClient from './FranchiseAccessClient'
import FranchiseCoverageClient from './FranchiseCoverageClient'
import FranchiseLogoClient from './FranchiseLogoClient'
import LinkEtablissementClient from './LinkEtablissementClient'
import { FranchiseSettingsClient } from './FranchiseSettingsClient'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default async function FranchiseDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: franchise } = await supabase
    .from('franchises')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (!franchise) notFound()

  // Requêtes indépendantes (n'utilisent que params.id / orgId)
  const [
    { data: etablissements },
    { data: allClients },
    { data: franchiseUsers },
  ] = await Promise.all([
    // Établissements
    supabase
      .from('clients')
      .select('id, raison_sociale, ville, code_postal')
      .eq('franchise_id', params.id)
      .eq('organization_id', orgId)
      .order('raison_sociale'),
    // Tous les clients de l'org (pour rattacher de nouveaux établissements)
    supabase
      .from('clients')
      .select('id, raison_sociale, ville, franchise_id')
      .eq('organization_id', orgId)
      .order('raison_sociale'),
    // Utilisateurs franchise (comptes d'accès)
    supabase
      .from('users')
      .select('id, email, first_name, last_name, status')
      .eq('organization_id', orgId)
      .eq('role', 'franchise')
      .eq('franchise_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  // Le financier est assis sur les SESSIONS des établissements : on aligne les
  // lignes de commission (création / recalcul des non figées) avant de lire.
  await syncFranchiseCommissions(supabase, params.id, orgId)
  const [lignes, groupes, audits] = await Promise.all([
    getFranchiseCommissionLines(supabase, params.id, orgId),
    // date_partenariat n'existe qu'après la migration 150 : absente, aucun
    // établissement ne bascule en « avant le partenariat ».
    getFranchiseParcours(supabase, params.id, orgId, (franchise as any).date_partenariat || null),
    getFranchiseAudits(supabase, params.id, orgId),
  ])
  const bilanAudits = syntheseAudits(audits)

  const name = franchise.nom || franchise.raison_sociale || 'Franchise'

  // Totaux financiers (sessions non annulées)
  const actives = lignes.filter((l) => l.status !== 'annulee')
  const pecTotal = actives.reduce((s, l) => s + Number(l.base_montant || 0), 0)
  const caTotal = actives.filter((l) => l.session?.status === 'terminee').reduce((s, l) => s + Number(l.base_montant || 0), 0)
  const coutFormateurTotal = actives.reduce((s, l) => s + Number(l.cout_formateur || 0), 0)
  // Couverture : établissements formés = ceux qui ont au moins une session
  const nbFormes = new Set(actives.map((l) => l.client?.id).filter(Boolean)).size
  const commAVenir = lignes.filter((l) => l.status === 'a_venir').reduce((s, l) => s + Number(l.commission_montant || 0), 0)
  const commValidee = lignes.filter((l) => l.status === 'validee').reduce((s, l) => s + Number(l.commission_montant || 0), 0)
  const commPayee = lignes.filter((l) => l.status === 'payee').reduce((s, l) => s + Number(l.commission_montant || 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <BackLink fallbackHref="/dashboard/franchises" label="Franchises" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${franchise.logo_url ? 'bg-white border border-surface-200' : 'bg-brand-50'}`}>
            {franchise.logo_url ? (
              <img src={franchise.logo_url} alt={name} className="h-full w-full object-contain p-1" />
            ) : (
              <Store className="h-6 w-6 text-brand-600" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">{name}</h1>
            <p className="text-surface-500 text-sm mt-0.5">
              {franchise.secteur && <span>{franchise.secteur} · </span>}
              {(etablissements || []).length} établissement{(etablissements || []).length > 1 ? 's' : ''}
              {franchise.nombre_etablissements ? ` · ${franchise.nombre_etablissements} déclarés` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FranchiseSettingsClient franchise={franchise as any} />
          <LinkEtablissementClient franchiseId={franchise.id} allClients={(allClients || []) as any[]} variant="button" />
        </div>
      </div>

      {/* Logo co-branding */}
      <div className="card p-4">
        <FranchiseLogoClient franchiseId={franchise.id} logoUrl={franchise.logo_url} />
      </div>

      {/* Gabarits du Pack Hygiène (PMS, affichages, livret) */}
      <FranchiseGabaritsClient
        franchiseId={franchise.id}
        gabarits={{ pms: (franchise as any).pms_path || null, affichages: (franchise as any).affichages_path || null, livret: (franchise as any).livret_path || null }}
        pmsPersonnalisable={(franchise as any).pms_personnalisable !== false}
      />

      {/* Financier global */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FinCard label="Sessions réalisées (prise en charge)" value={fmtEuro(caTotal)} />
        <FinCard label="Prise en charge, toutes sessions" value={fmtEuro(pecTotal)} />
        <FinCard label="Coût formateurs" value={fmtEuro(coutFormateurTotal)} />
        <FinCard label="Commissions totales" value={fmtEuro(commAVenir + commValidee + commPayee)} accent />
      </div>

      {/* Couverture réseau + prévisionnel */}
      <FranchiseCoverageClient
        franchiseId={franchise.id}
        totalDeclares={Number(franchise.nombre_etablissements || 0)}
        nbFormes={nbFormes}
        nbRattaches={(etablissements || []).length}
        caTotal={caTotal}
        pecTotal={pecTotal}
        commTotal={commAVenir + commValidee + commPayee}
        taux={Number(franchise.taux_commission || 10)}
      />

      {/* Accès portail franchise */}
      <FranchiseAccessClient franchiseId={franchise.id} users={(franchiseUsers || []) as any[]} canImpersonate={session.user.role === 'super_admin'} />

      {/* Bloc config + commission breakdown (client) */}
      <FranchiseDetailClient
        franchiseId={franchise.id}
        commissionType={(franchise.commission_type as any) || 'budget_debloque'}
        taux={Number(franchise.taux_commission || 10)}
        commAVenir={commAVenir}
        commValidee={commValidee}
        commPayee={commPayee}
        lignes={lignes}
      />

      {/* Le réseau par avancement de dossier */}
      <FranchisePhases groupes={groupes} audits={Object.fromEntries(audits)} bilanAudits={bilanAudits} />
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
