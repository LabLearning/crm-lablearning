import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { commissionStatusLabel } from '@/lib/commission'
import { ArrowLeft, Building2, MapPin, GraduationCap, Banknote, Users, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))

const STATUS_STYLE: Record<string, string> = {
  a_venir: 'bg-surface-100 text-surface-600',
  validee: 'bg-blue-50 text-blue-700',
  payee: 'bg-emerald-50 text-emerald-700',
  annulee: 'bg-rose-50 text-rose-700',
}

export default async function FranchiseEtablissementDetail({ params }: { params: { id: string } }) {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  // Sécurité : le client doit appartenir à la franchise
  const { data: client } = await supabase
    .from('clients')
    .select('id, raison_sociale, ville, code_postal, secteur_activite, siret, franchise_id')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (!client || client.franchise_id !== franchise.id) notFound()

  const { data: dossiers } = await supabase
    .from('dossiers_formation')
    .select('id, numero, status, montant_prise_en_charge, commission_montant, commission_status, date_creation, notes')
    .eq('client_id', client.id)
    .eq('organization_id', orgId)
    .order('date_creation', { ascending: false })

  const ds = dossiers || []
  const pec = ds.reduce((s, d) => s + Number(d.montant_prise_en_charge || 0), 0)
  const comm = ds.reduce((s, d) => s + Number(d.commission_montant || 0), 0)

  // Nb apprenants de l'établissement
  const { count: nbApprenants } = await supabase
    .from('apprenants')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('organization_id', orgId)

  // Extrait le nom de la formation depuis les notes (avant le premier " — ")
  const formationName = (notes: string | null) => (notes ? notes.split(' — ')[0] : 'Formation')

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/franchise/etablissements" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700">
        <ArrowLeft className="h-4 w-4" /> Mes établissements
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">{client.raison_sociale}</h1>
          <p className="text-surface-500 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
            {(client.code_postal || client.ville) && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[client.code_postal, client.ville].filter(Boolean).join(' ')}</span>
            )}
            {client.secteur_activite && <span>· {client.secteur_activite}</span>}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={GraduationCap} tint="brand" value={String(ds.length)} label="Formations" />
        <Stat icon={Users} tint="violet" value={String(nbApprenants || 0)} label="Stagiaires" />
        <Stat icon={FileText} tint="blue" value={fmtEuro(pec)} label="Prise en charge" />
        <Stat icon={Banknote} tint="amber" value={fmtEuro(comm)} label="Commission générée" />
      </div>

      {/* Dossiers */}
      <div>
        <div className="text-sm font-heading font-semibold text-surface-900 mb-2">Dossiers de formation ({ds.length})</div>
        {ds.length === 0 ? (
          <div className="card p-6 text-center text-sm text-surface-400">Aucun dossier pour cet établissement.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50/60 border-b border-surface-200">
                <tr className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">
                  <th className="px-4 py-3 text-left">Formation</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Prise en charge</th>
                  <th className="px-4 py-3 text-right">Votre commission</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {ds.map((d) => (
                  <tr key={d.id} className="border-b border-surface-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-surface-900">{formationName(d.notes)}</div>
                      <div className="text-[11px] text-surface-400 font-mono">{d.numero}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600">
                      {d.date_creation ? new Date(d.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-surface-700">{fmtEuro(d.montant_prise_en_charge)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-amber-600 tabular-nums">{fmtEuro(d.commission_montant)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-semibold ${STATUS_STYLE[d.commission_status || 'a_venir']}`}>
                        {commissionStatusLabel(d.commission_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, tint, value, label }: { icon: any; tint: string; value: string; label: string }) {
  const tints: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600', violet: 'bg-violet-50 text-violet-600',
    blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="card p-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tints[tint]}`}><Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></div>
      <div className="text-xl font-heading font-bold text-surface-900 mt-3 tabular-nums truncate">{value}</div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
    </div>
  )
}
