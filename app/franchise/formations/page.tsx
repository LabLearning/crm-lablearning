import Link from 'next/link'
import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getFranchiseFormations, LIBELLES_ETATS, type EtatFormation, type FormationFranchise } from '@/lib/franchise-data'
import { syncFranchiseCommissions } from '@/lib/commission'
import { GraduationCap, Play, CalendarClock, CheckCircle, Users } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

function periode(debut: string | null, fin: string | null): string {
  if (!debut) return 'Date à fixer'
  const d = new Date(debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  if (!fin || fin === debut) return d
  const f = new Date(fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${new Date(debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${f}`
}

const ICONES: Record<EtatFormation, typeof GraduationCap> = {
  en_cours: Play,
  a_venir: CalendarClock,
  terminee: CheckCircle,
}
const TEINTES: Record<EtatFormation, string> = {
  en_cours: 'bg-blue-50 text-blue-600',
  a_venir: 'bg-violet-50 text-violet-600',
  terminee: 'bg-emerald-50 text-emerald-600',
}

/**
 * Les formations du réseau d'un coup d'œil : en cours, à venir, terminées.
 * Chaque ligne porte l'état de sa commission, pour éviter l'aller-retour
 * avec l'onglet Commissions.
 */
export default async function FranchiseFormationsPage() {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  await syncFranchiseCommissions(supabase, franchise.id, orgId)
  const groupes = await getFranchiseFormations(supabase, franchise.id, orgId, (franchise as any).date_partenariat || null)
  const total = groupes.reduce((t, g) => t + g.formations.length, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Formations</h1>
        <p className="text-surface-500 text-sm mt-1">
          {total === 0
            ? 'Aucune formation enregistrée pour votre réseau.'
            : `${total} formation${total > 1 ? 's' : ''} dans votre réseau, avec l'état de chaque commission.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['en_cours', 'a_venir', 'terminee'] as EtatFormation[]).map((etat) => {
          const g = groupes.find((x) => x.etat === etat)
          const Icone = ICONES[etat]
          return (
            <div key={etat} className="card p-4">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${TEINTES[etat]}`}>
                <Icone className="h-4 w-4" />
              </div>
              <div className="text-xl font-heading font-bold text-surface-900 tabular-nums">{g?.formations.length || 0}</div>
              <div className="text-xs text-surface-500">{LIBELLES_ETATS[etat].titre}</div>
              {!!g?.nbParticipants && (
                <div className="text-[11px] text-surface-400 mt-0.5">{g.nbParticipants} stagiaire{g.nbParticipants > 1 ? 's' : ''}</div>
              )}
            </div>
          )
        })}
      </div>

      {total === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <GraduationCap className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Les formations apparaîtront ici dès qu&apos;une session sera planifiée dans un de vos établissements.</p>
        </div>
      ) : (
        groupes.map((g) => {
          const Icone = ICONES[g.etat]
          return (
            <div key={g.etat} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-4 px-4 pt-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${TEINTES[g.etat]}`}>
                    <Icone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-heading font-semibold text-surface-900">{LIBELLES_ETATS[g.etat].titre}</h2>
                    <p className="text-xs text-surface-400 mt-0.5 tabular-nums">
                      {g.formations.length} formation{g.formations.length > 1 ? 's' : ''}
                      {g.nbParticipants > 0 && ` · ${g.nbParticipants} stagiaire${g.nbParticipants > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                {g.commission > 0 && (
                  <div className="text-right shrink-0">
                    <div className="text-lg font-heading font-bold text-amber-600 tabular-nums">{fmtEuro(g.commission)}</div>
                    <div className="text-[11px] text-surface-400">de commission</div>
                  </div>
                )}
              </div>
              <p className="text-xs text-surface-500 px-4 pt-2 pb-3">{LIBELLES_ETATS[g.etat].texte}</p>

              <div className="border-t border-surface-100 divide-y divide-surface-100">
                {g.formations.map((f) => <Ligne key={f.id} f={f} />)}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function Ligne({ f }: { f: FormationFranchise }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-surface-900">{f.titre}</div>
        <div className="text-xs text-surface-500 mt-0.5">
          {f.clientId ? (
            <Link href={`/franchise/etablissements/${f.clientId}`} className="hover:text-brand-600 font-medium">{f.client}</Link>
          ) : f.client}
          {f.ville && ` · ${f.ville}`}
          {' · '}{periode(f.dateDebut, f.dateFin)}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {f.nbParticipants > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-surface-500">
              <Users className="h-3 w-3 text-surface-400" />{f.nbParticipants} stagiaire{f.nbParticipants > 1 ? 's' : ''}
            </span>
          )}
          <EtatCommission f={f} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold tabular-nums ${f.commission ? 'text-amber-600' : 'text-surface-300'}`}>
          {f.commission ? fmtEuro(f.commission) : '—'}
        </div>
        {f.base > 0 && <div className="text-[11px] text-surface-400 tabular-nums">sur {fmtEuro(f.base)}</div>}
      </div>
    </div>
  )
}

/** Une phrase, pas un code : la franchise doit comprendre où en est son argent. */
function EtatCommission({ f }: { f: FormationFranchise }) {
  const puce = (texte: string, cls: string) => (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{texte}</span>
  )
  if (f.poei) return puce('Parcours POEI, hors commission', 'bg-surface-100 text-surface-500')
  if (f.horsPartenariat) return puce('Hors partenariat', 'bg-surface-100 text-surface-500')
  if (f.statutCommission === 'payee') return puce('Commission versée', 'bg-emerald-50 text-emerald-700')
  if (f.statutCommission === 'validee') return puce('Commission à vous verser', 'bg-blue-50 text-blue-700')
  if (f.statutCommission === 'a_venir' && f.base > 0) return puce('En attente du règlement du dossier', 'bg-amber-50 text-amber-700')
  if (f.etat === 'terminee') return puce('Montant du dossier à compléter', 'bg-amber-50 text-amber-700')
  return puce('Commission calculée à la fin de la formation', 'bg-surface-100 text-surface-500')
}
