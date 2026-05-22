import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { commissionStatusLabel } from '@/lib/commission'
import {
  ArrowLeft, Building2, MapPin, GraduationCap, Banknote, Users, FileText,
  Calendar, Hash, BadgeCheck,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))

const STATUS_STYLE: Record<string, string> = {
  a_venir: 'bg-surface-100 text-surface-600',
  validee: 'bg-blue-50 text-blue-700',
  payee: 'bg-emerald-50 text-emerald-700',
  annulee: 'bg-rose-50 text-rose-700',
}

const OPCO_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  a_constituer: { label: 'À constituer', bg: 'bg-surface-100', text: 'text-surface-600' },
  pret_a_envoyer: { label: 'Prêt à envoyer', bg: 'bg-surface-100', text: 'text-surface-600' },
  envoye_opco: { label: 'Transmis OPCO', bg: 'bg-amber-50', text: 'text-amber-700' },
  en_attente_opco: { label: 'En attente', bg: 'bg-amber-50', text: 'text-amber-700' },
  valide_opco: { label: 'Accordé', bg: 'bg-blue-50', text: 'text-blue-700' },
  refuse_opco: { label: 'Refusé', bg: 'bg-rose-50', text: 'text-rose-700' },
  mise_en_paiement: { label: 'Mise en paiement', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  paye: { label: 'Payé', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

// notes import : "Formation — dates — N stagiaires — ADF_xxx — état AKTO: X"
function parseNote(notes: string | null) {
  if (!notes) return { formation: 'Formation', dates: null, nbStag: null, adf: null, etat: null }
  const p = notes.split(' — ')
  const etatPart = p.find((x) => x.startsWith('état AKTO:'))
  return {
    formation: p[0] || 'Formation',
    dates: p[1] || null,
    nbStag: p[2] || null,
    adf: p.find((x) => /^ADF_/.test(x)) || null,
    etat: etatPart ? etatPart.replace('état AKTO:', '').trim() : null,
  }
}

function initials(nom: string | null, prenom: string | null) {
  return ((nom?.[0] || '') + (prenom?.[0] || '')).toUpperCase() || '?'
}

export default async function FranchiseEtablissementDetail({ params }: { params: { id: string } }) {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  // Sécurité : le client doit appartenir à la franchise
  const { data: client } = await supabase
    .from('clients')
    .select('id, raison_sociale, ville, code_postal, adresse, secteur_activite, siret, franchise_id')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (!client || client.franchise_id !== franchise.id) notFound()

  const [{ data: dossiers }, { data: apprenants }] = await Promise.all([
    supabase
      .from('dossiers_formation')
      .select('id, numero, status, montant_prise_en_charge, numero_prise_en_charge, opco_workflow_status, commission_montant, commission_status, date_creation, notes')
      .eq('client_id', client.id)
      .eq('organization_id', orgId)
      .order('date_creation', { ascending: false }),
    supabase
      .from('apprenants')
      .select('id, nom, prenom, civilite, poste')
      .eq('client_id', client.id)
      .eq('organization_id', orgId)
      .order('nom'),
  ])

  const ds = dossiers || []
  const apps = apprenants || []
  const pec = ds.reduce((s, d) => s + Number(d.montant_prise_en_charge || 0), 0)
  const comm = ds.reduce((s, d) => s + Number(d.commission_montant || 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/franchise/etablissements" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700">
        <ArrowLeft className="h-4 w-4" /> Mes établissements
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">{client.raison_sociale}</h1>
          <p className="text-surface-500 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
            {(client.code_postal || client.ville || client.adresse) && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[client.adresse, client.code_postal, client.ville].filter(Boolean).join(' ')}</span>
            )}
            {client.secteur_activite && <span>· {client.secteur_activite}</span>}
            {client.siret && <span className="font-mono text-xs">· SIRET {client.siret}</span>}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={GraduationCap} tint="brand" value={String(ds.length)} label="Formations" />
        <Stat icon={Users} tint="violet" value={String(apps.length)} label="Stagiaires" />
        <Stat icon={FileText} tint="blue" value={fmtEuro(pec)} label="Prise en charge" />
        <Stat icon={Banknote} tint="amber" value={fmtEuro(comm)} label="Commission générée" />
      </div>

      {/* Dossiers détaillés */}
      <div>
        <div className="text-sm font-heading font-semibold text-surface-900 mb-2">Dossiers de formation ({ds.length})</div>
        {ds.length === 0 ? (
          <div className="card p-6 text-center text-sm text-surface-400">Aucun dossier pour cet établissement.</div>
        ) : (
          <div className="space-y-2">
            {ds.map((d) => {
              const n = parseNote(d.notes)
              const opco = d.opco_workflow_status ? OPCO_LABEL[d.opco_workflow_status] : null
              const cs = STATUS_STYLE[d.commission_status || 'a_venir']
              return (
                <div key={d.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-surface-900">{n.formation}</span>
                        {opco && <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${opco.bg} ${opco.text}`}>{opco.label}</span>}
                      </div>
                      <div className="text-xs text-surface-500 mt-1 flex items-center gap-3 flex-wrap">
                        {n.dates && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{n.dates}</span>}
                        {n.nbStag && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{n.nbStag}</span>}
                        {d.numero_prise_en_charge && <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />Dossier OPCO {d.numero_prise_en_charge}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-amber-600 tabular-nums">{fmtEuro(d.commission_montant)}</div>
                      <div className="text-[11px] text-surface-400">votre commission</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-4 text-xs flex-wrap">
                    <span className="text-surface-500">Prise en charge : <strong className="text-surface-800 tabular-nums">{fmtEuro(d.montant_prise_en_charge)}</strong></span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cs}`}>
                      <BadgeCheck className="h-3 w-3" /> Commission {commissionStatusLabel(d.commission_status).toLowerCase()}
                    </span>
                    <span className="text-surface-300 font-mono ml-auto">{d.numero}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stagiaires */}
      <div>
        <div className="text-sm font-heading font-semibold text-surface-900 mb-2">
          Stagiaires formés ({apps.length})
        </div>
        {apps.length === 0 ? (
          <div className="card p-6 text-center text-sm text-surface-400">Aucun stagiaire enregistré pour cet établissement.</div>
        ) : (
          <div className="card p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {apps.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-50">
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials(a.nom, a.prenom)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      {[a.prenom, a.nom].filter(Boolean).join(' ') || 'Stagiaire'}
                    </div>
                    {a.poste && <div className="text-[11px] text-surface-400 truncate">{a.poste}</div>}
                  </div>
                </div>
              ))}
            </div>
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
