import { BackLink } from '@/components/ui'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { Store, Building2, ReceiptEuro, Banknote, Wallet } from '@/components/ui/icons'
import { syncFranchiseCommissions } from '@/lib/commission'
import { getFranchiseCommissionLines, getFranchiseParcours, getFranchiseAudits, getFranchiseAuditsListe, syntheseAuditsListe } from '@/lib/franchise-data'
import FranchisePhases from './FranchisePhases'
import FranchiseDetailClient from './FranchiseDetailClient'
import { FranchiseGabaritsClient } from './FranchiseGabaritsClient'
import FranchiseAccessClient from './FranchiseAccessClient'
import FranchiseCoverageClient from './FranchiseCoverageClient'
import FranchiseLogoClient from './FranchiseLogoClient'
import LinkEtablissementClient from './LinkEtablissementClient'
import { FranchiseSettingsClient } from './FranchiseSettingsClient'
import FranchiseOnglets from './FranchiseOnglets'

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
  const [lignes, groupes, audits, listeAudits] = await Promise.all([
    getFranchiseCommissionLines(supabase, params.id, orgId, { avecSources: true }),
    // date_partenariat n'existe qu'après la migration 150 : absente, aucun
    // établissement ne bascule en « avant le partenariat ».
    getFranchiseParcours(supabase, params.id, orgId, (franchise as any).date_partenariat || null),
    getFranchiseAudits(supabase, params.id, orgId),
    getFranchiseAuditsListe(supabase, params.id, orgId),
  ])
  const bilanAudits = syntheseAuditsListe(listeAudits)

  const name = franchise.nom || franchise.raison_sociale || 'Franchise'

  // Totaux financiers (sessions non annulées)
  const actives = lignes.filter((l) => l.status !== 'annulee')
  const pecTotal = actives.reduce((s, l) => s + Number(l.base_montant || 0), 0)
  // Réalisé au sens des dates de formation, pas du statut de la session
  const { etatSession } = await import('@/lib/franchise-data')
  const caTotal = actives.filter((l) => l.session && etatSession(l.session) === 'terminee').reduce((s, l) => s + Number(l.base_montant || 0), 0)
  const coutFormateurTotal = actives.reduce((s, l) => s + Number(l.cout_formateur || 0), 0)
  // Frais déduits des commissions au budget net (migration 166) : ceux des
  // parcours POEI et le déplacement du formateur d'une session
  const fraisTotal = actives.reduce((s, l) => s + Number(l.frais_annexes || 0), 0)
  // Couverture : établissements formés = ceux qui ont au moins une session
  const nbFormes = new Set(actives.map((l) => l.client?.id).filter(Boolean)).size
  const somme = (statut: string) => lignes.filter((l) => l.status === statut).reduce((s, l) => s + Number(l.commission_montant || 0), 0)
  const commAVenir = somme('a_venir')
  const commValidee = somme('validee')
  const commPayee = somme('payee')
  const nbAVerser = lignes.filter((l) => l.status === 'validee').length
  const joursVerses = Array.from(new Set(lignes.filter((l) => l.status === 'payee' && l.payee_at)
    .map((l) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(l.payee_at as string))))).sort()
  const dernierVersement = joursVerses[joursVerses.length - 1] || null
  const totalDeclares = Number(franchise.nombre_etablissements || 0)
  const nbRattaches = (etablissements || []).length
  const nbAcces = ((franchiseUsers || []) as any[]).filter((u) => u.status !== 'suspended').length

  return (
    <div className="space-y-5 animate-fade-in">
      <BackLink fallbackHref="/dashboard/franchises" label="Franchises" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700" />

      {/* En-tête : qui, et les deux actions de la fiche */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${franchise.logo_url ? 'bg-white border border-surface-200' : 'bg-brand-50'}`}>
            {franchise.logo_url ? (
              <img src={franchise.logo_url} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <Store className="h-6 w-6 text-brand-600" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">{name}</h1>
            <p className="text-surface-500 text-sm mt-0.5">
              {franchise.secteur && <span>{franchise.secteur} · </span>}
              {nbRattaches} établissement{nbRattaches > 1 ? 's' : ''} rattaché{nbRattaches > 1 ? 's' : ''}
              {franchise.contact_nom ? ` · contact : ${franchise.contact_nom}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FranchiseSettingsClient franchise={franchise as any} />
          <LinkEtablissementClient franchiseId={franchise.id} allClients={(allClients || []) as any[]} variant="button" />
        </div>
      </div>

      {/* Les quatre chiffres de la fiche, une seule fois */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Chiffre
          icone={Building2}
          label="Établissements formés"
          valeur={totalDeclares > 0 ? `${nbFormes} / ${totalDeclares}` : String(nbFormes)}
          sous={totalDeclares > 0
            ? `${Math.min(100, Math.round((nbFormes / totalDeclares) * 100))} % du réseau · ${Math.max(0, totalDeclares - nbFormes)} à former`
            : `sur ${nbRattaches} rattaché${nbRattaches > 1 ? 's' : ''}`}
        />
        <Chiffre
          icone={ReceiptEuro}
          label="Prise en charge des formations"
          valeur={fmtEuro(pecTotal)}
          sous={`${caTotal < pecTotal ? `${fmtEuro(caTotal)} réalisés · ` : ''}coût formateurs et frais ${fmtEuro(coutFormateurTotal + fraisTotal)}`}
        />
        <Chiffre
          icone={Banknote}
          label="Commissions à verser"
          valeur={fmtEuro(commValidee)}
          ton="brand"
          sous={`${nbAVerser} session${nbAVerser > 1 ? 's' : ''} · ${fmtEuro(commAVenir)} à venir`}
        />
        <Chiffre
          icone={Wallet}
          label="Commissions versées"
          valeur={fmtEuro(commPayee)}
          ton="success"
          sous={dernierVersement
            ? `${joursVerses.length} versement${joursVerses.length > 1 ? 's' : ''} · dernier le ${new Date(dernierVersement + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`
            : 'Aucun versement pour le moment'}
        />
      </div>

      <FranchiseOnglets
        nbEtablissements={nbRattaches}
        nbAVerser={nbAVerser}
        nbAcces={nbAcces}
        commissions={
          <FranchiseDetailClient
            franchiseId={franchise.id}
            commissionType={(franchise.commission_type as any) || 'budget_debloque'}
            taux={Number(franchise.taux_commission || 10)}
            lignes={lignes}
          />
        }
        etablissements={
          <>
            <FranchiseCoverageClient
              franchiseId={franchise.id}
              totalDeclares={totalDeclares}
              nbFormes={nbFormes}
              nbRattaches={nbRattaches}
              pecTotal={pecTotal}
              commTotal={commAVenir + commValidee + commPayee}
            />
            <FranchisePhases groupes={groupes} audits={Object.fromEntries(audits)} bilanAudits={bilanAudits} />
          </>
        }
        acces={
          <>
            <FranchiseAccessClient franchiseId={franchise.id} users={(franchiseUsers || []) as any[]} canImpersonate={session.user.role === 'super_admin'} />
            <div className="card p-4">
              <FranchiseLogoClient franchiseId={franchise.id} logoUrl={franchise.logo_url} />
            </div>
            <FranchiseGabaritsClient
              franchiseId={franchise.id}
              gabarits={{ pms: (franchise as any).pms_path || null, affichages: (franchise as any).affichages_path || null, livret: (franchise as any).livret_path || null }}
              pmsPersonnalisable={(franchise as any).pms_personnalisable !== false}
            />
          </>
        }
      />
    </div>
  )
}

function Chiffre({ icone: Icone, label, valeur, sous, ton }: {
  icone: React.ElementType
  label: string
  valeur: string
  sous?: string
  ton?: 'brand' | 'success'
}) {
  const couleur = ton === 'brand' ? 'text-brand-600' : ton === 'success' ? 'text-success-700' : 'text-surface-900'
  return (
    <div className="card p-4 min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
        <Icone className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 text-xl font-heading font-bold tabular-nums ${couleur}`}>{valeur}</div>
      {sous && <div className="mt-1 text-xs text-surface-500 leading-snug">{sous}</div>}
    </div>
  )
}
