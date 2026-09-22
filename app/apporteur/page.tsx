import Link from 'next/link'
import { getApporteurSession } from '@/lib/apporteur-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  syncCommissionsApporteur, chargerCommissionsApporteur, totauxCommissions, descriptionCommission, libelleLigne,
  LIBELLES_STATUT_COMMISSION, type StatutCommissionApporteur,
} from '@/lib/commission-apporteur'
import { Building2, Banknote, Clock, CheckCircle2, ArrowRight, Percent, GraduationCap } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n || 0))
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

const BADGE: Record<StatutCommissionApporteur, string> = {
  validee: 'bg-brand-50 text-brand-700',
  en_attente: 'bg-amber-50 text-amber-700',
  payee: 'bg-emerald-50 text-emerald-700',
  annulee: 'bg-surface-100 text-surface-500',
}

/** Accueil de l'espace apporteur : ce qui est dû, puis l'activité récente. */
export default async function ApporteurHomePage() {
  const { user, apporteur, organization } = await getApporteurSession()
  if (!apporteur) return null
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  await syncCommissionsApporteur(supabase, orgId, { apporteurId: apporteur.id })
  const [lignes, { data: clients }] = await Promise.all([
    chargerCommissionsApporteur(supabase, apporteur.id, orgId),
    supabase.from('clients').select('id').eq('organization_id', orgId).eq('apporteur_id', apporteur.id),
  ])
  const t = totauxCommissions(lignes)
  const actives = lignes.filter((l) => l.status !== 'annulee')
  const recentes = actives.slice(0, 5)

  const kpis = [
    { Icon: Building2, label: 'Établissements apportés', valeur: String((clients || []).length) },
    { Icon: GraduationCap, label: 'Formations commissionnées', valeur: String(actives.length) },
    { Icon: Clock, label: 'En attente d’encaissement', valeur: fmtEuro(t.en_attente) },
    { Icon: CheckCircle2, label: 'Déjà versées', valeur: fmtEuro(t.payee) },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Bonjour{user.first_name ? `, ${user.first_name}` : ''}
        </h1>
        <p className="text-surface-500 text-sm mt-1">Vos commissions sur les formations réalisées par {organization.name} chez les établissements que vous avez apportés.</p>
      </div>

      <div className="card p-5 bg-brand-50/40 border-brand-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">À vous verser aujourd&apos;hui</div>
            <div className="text-3xl font-heading font-bold text-brand-700 tabular-nums mt-1">{fmtEuro(t.validee)}</div>
            <div className="text-xs text-surface-500 mt-1">
              {t.nb.validee} formation{t.nb.validee > 1 ? 's' : ''} encaissée{t.nb.validee > 1 ? 's' : ''} · {fmtEuro(t.en_attente)} en attente · {fmtEuro(t.payee)} déjà versées
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm bg-white rounded-xl px-3 py-2 border border-brand-100">
            <Percent className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-surface-900">{apporteur.mode_calcul === 'fixe' ? 'Montant fixe' : `${Number(apporteur.taux_commission || 0).toLocaleString('fr-FR')} %`}</div>
              <div className="text-xs text-surface-500">{descriptionCommission(apporteur)}</div>
            </div>
          </div>
        </div>
        <Link href="/apporteur/commissions" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
          Voir le détail des commissions <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center gap-1.5 text-brand-500 mb-2"><k.Icon className="h-4 w-4" /></div>
            <div className="text-xl font-heading font-bold text-surface-900 tabular-nums">{k.valeur}</div>
            <div className="text-xs text-surface-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Dernières commissions</span>
          </div>
          <Link href="/apporteur/commissions" className="text-xs font-medium text-brand-600 hover:underline">Tout voir</Link>
        </div>
        {recentes.length === 0 ? (
          <div className="text-center py-10 text-sm text-surface-400 px-6">
            Aucune commission pour le moment. Elles apparaissent dès qu&apos;une formation est terminée chez un établissement que vous avez apporté.
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {recentes.map((l) => {
              const { titre, sousTitre } = libelleLigne(l)
              const statut = (l.status as StatutCommissionApporteur) in BADGE ? (l.status as StatutCommissionApporteur) : 'en_attente'
              return (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{titre}</div>
                    <div className="text-xs text-surface-500 truncate">{[sousTitre, fmtDate(l.date_session)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={`hidden sm:inline-flex px-2 py-1 rounded-md text-[11px] font-semibold ${BADGE[statut]}`}>{LIBELLES_STATUT_COMMISSION[statut]}</span>
                  <div className="text-sm font-bold text-surface-900 tabular-nums">{fmtEuro(Number(l.montant_commission || 0))}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
