import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Mail, Phone, MapPin, Handshake, Users, GraduationCap,
  Banknote, Clock, CheckCircle2, CalendarDays, UserCog,
} from '@/components/ui/icons'
import { Badge, Avatar } from '@/components/ui'
import { BackLink } from '@/components/ui/BackLink'
import { formatDate } from '@/lib/utils'
import {
  syncCommissionsApporteur, chargerCommissionsApporteur, totauxCommissions, nomApporteur, descriptionCommission,
} from '@/lib/commission-apporteur'
import { ApporteurCommissions } from '../ApporteurCommissions'
import { ApporteurEditButton } from '../ApporteurEditButton'

export const dynamic = 'force-dynamic'

const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))

/**
 * Fiche apporteur d'affaires : sa règle de commission, ses établissements,
 * et chaque commission générée par une session terminée chez eux, avec
 * son état (en attente, à verser, versée).
 */
export default async function ApporteurDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const peutGerer = ['super_admin', 'gestionnaire', 'directeur_commercial', 'comptable'].includes(session.user.role)

  const { data: a } = await supabase.from('apporteurs_affaires')
    .select('*').eq('id', params.id).eq('organization_id', orgId).maybeSingle()
  if (!a) redirect('/dashboard/apporteurs')

  const nomAff = nomApporteur(a)
  const sync = await syncCommissionsApporteur(supabase, orgId, { apporteurId: params.id })

  const [lignes, { data: clients }, { data: leads }, { data: compte }] = await Promise.all([
    chargerCommissionsApporteur(supabase, params.id, orgId),
    supabase.from('clients')
      .select('id, raison_sociale, nom_commercial, ville, created_at')
      .eq('organization_id', orgId).eq('apporteur_id', params.id)
      .order('created_at', { ascending: false }),
    supabase.from('leads')
      .select('id, entreprise, status, created_at')
      .eq('organization_id', orgId).eq('apporteur_id', params.id)
      .order('created_at', { ascending: false }).limit(20),
    a.user_id
      ? supabase.from('users').select('id, status, email').eq('id', a.user_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ])

  const clientIds = (clients || []).map((c: any) => c.id)
  const { data: sessionsAVenir } = clientIds.length
    ? await supabase.from('sessions').select('id', { count: 'exact', head: false })
        .eq('organization_id', orgId).in('client_id', clientIds).in('status', ['planifiee', 'confirmee', 'en_cours'])
    : { data: [] as any[] }

  const t = totauxCommissions(lignes)
  const actives = lignes.filter((l) => l.status !== 'annulee')

  const kpis = [
    { Icon: Building2, label: 'Établissements apportés', valeur: String((clients || []).length), sous: (sessionsAVenir || []).length ? `${(sessionsAVenir || []).length} session${(sessionsAVenir || []).length > 1 ? 's' : ''} à venir` : undefined },
    { Icon: GraduationCap, label: 'Formations commissionnées', valeur: String(actives.length), sous: `${eur(actives.reduce((s, l) => s + Number(l.montant_base || 0), 0))} de base` },
    { Icon: Banknote, label: 'À verser', valeur: eur(t.validee), sous: t.en_attente ? `${eur(t.en_attente)} en attente d’encaissement` : undefined },
    { Icon: CheckCircle2, label: 'Versées', valeur: eur(t.payee), sous: t.nb.payee ? `${t.nb.payee} versement${t.nb.payee > 1 ? 's' : ''}` : undefined },
  ]

  const periodeContrat = a.date_debut_contrat || a.date_fin_contrat
    ? `Contrat ${a.date_debut_contrat ? `du ${formatDate(a.date_debut_contrat, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}${a.date_fin_contrat ? ` au ${formatDate(a.date_fin_contrat, { day: 'numeric', month: 'short', year: 'numeric' })}` : ' sans échéance'}`
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <BackLink fallbackHref="/dashboard/apporteurs" label="Apporteurs" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700" />
        {peutGerer && <ApporteurEditButton apporteur={a as any} />}
      </div>

      {/* En-tête */}
      <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar firstName={a.prenom || nomAff} lastName={a.nom || ''} size="xl" className="!h-16 !w-16" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-heading font-bold text-surface-900">{nomAff}</h1>
            <Badge variant={a.is_active ? 'success' : 'default'} dot>{a.is_active ? 'Actif' : 'Inactif'}</Badge>
            {a.categorie && <Badge variant="purple">{a.categorie}</Badge>}
            {compte && <Badge variant={compte.status === 'active' ? 'info' : 'warning'}>{compte.status === 'active' ? 'Compte actif' : 'Invitation envoyée'}</Badge>}
          </div>
          {a.raison_sociale && a.raison_sociale !== nomAff && <div className="text-sm text-surface-500 mt-0.5">{a.raison_sociale}</div>}
          <div className="flex items-center gap-4 mt-2 text-sm text-surface-500 flex-wrap">
            {a.email && <a href={`mailto:${a.email}`} className="flex items-center gap-1 hover:text-surface-700"><Mail className="h-3.5 w-3.5" />{a.email}</a>}
            {a.telephone && <a href={`tel:${a.telephone}`} className="flex items-center gap-1 hover:text-surface-700"><Phone className="h-3.5 w-3.5" />{a.telephone}</a>}
            {a.ville && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.ville}</span>}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-surface-500 flex-wrap">
            <span className="inline-flex items-center gap-1 font-medium text-surface-700"><Banknote className="h-3.5 w-3.5 text-brand-500" />{descriptionCommission(a)}</span>
            {periodeContrat && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{periodeContrat}</span>}
            {compte?.id && session.user.role === 'super_admin' && (
              <Link href="/dashboard/users" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><UserCog className="h-3.5 w-3.5" />Voir son espace depuis Utilisateurs</Link>
            )}
          </div>
          {a.conditions && <p className="text-xs text-surface-500 mt-2 max-w-2xl">{a.conditions}</p>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center gap-1.5 text-brand-500 mb-2"><k.Icon className="h-4 w-4" /></div>
            <div className="text-xl font-heading font-bold text-surface-900 tabular-nums">{k.valeur}</div>
            <div className="text-xs text-surface-500 mt-0.5">{k.label}</div>
            {k.sous && <div className="text-2xs text-surface-400 mt-0.5">{k.sous}</div>}
          </div>
        ))}
      </div>

      {/* Commissions par état */}
      <ApporteurCommissions apporteurId={params.id} lignes={lignes} peutGerer={peutGerer} sansMontant={sync.sansMontant} />

      {/* Établissements apportés */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
          <Handshake className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Établissements apportés ({(clients || []).length})</span>
        </div>
        {(clients || []).length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-400 px-6">
            Aucun établissement rattaché. Choisissez cet apporteur dans le formulaire d&apos;un client (bouton Modifier de la fiche client).
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {(clients || []).map((c: any) => {
              const total = lignes.filter((l) => l.client_id === c.id && l.status !== 'annulee').reduce((s, l) => s + Number(l.montant_commission || 0), 0)
              return (
                <Link key={c.id} href={`/dashboard/clients/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                  <Building2 className="h-4 w-4 text-surface-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{c.nom_commercial || c.raison_sociale}</div>
                    <div className="text-xs text-surface-500">{[c.ville, `rattaché le ${formatDate(c.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}`].filter(Boolean).join(' · ')}</div>
                  </div>
                  {total > 0 && <span className="text-sm font-semibold text-surface-700 tabular-nums">{eur(total)}</span>}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Leads apportés (ancien circuit) */}
      {(leads || []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Leads apportés ({(leads || []).length})</span>
          </div>
          <div className="divide-y divide-surface-100">
            {(leads || []).map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                <Users className="h-4 w-4 text-surface-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-surface-900 truncate">{l.entreprise || 'Lead'}</div>
                  <div className="text-xs text-surface-500">{formatDate(l.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <Badge variant="default">{l.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {t.nb.en_attente > 0 && (
        <p className="text-xs text-surface-400 inline-flex items-start gap-1.5 px-1">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Les lignes en attente sont recalculées à chaque ouverture de cette fiche : une session terminée, un prix modifié ou une facture réglée s&apos;y reflètent d&apos;eux-mêmes. Les lignes à verser ou versées sont figées.
        </p>
      )}
    </div>
  )
}
