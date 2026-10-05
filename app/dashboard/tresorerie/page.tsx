import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Wallet, AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Info, Landmark, Lock } from '@/components/ui/icons'
import { lireBanqueQonto, messageErreurQonto, qontoConfigure, type BanqueQonto } from '@/lib/qonto'
import {
  JOURS_RELEVE, PERIODES, chargerEngagements, chargerFacturesCitees, encaissementsNonSaisis, jourParis, montantFr,
  numerosFactureCites, peutVoirTresorerie, rapprocher, synthetiserBanque,
  type Engagements, type FluxSemaine, type LigneTiers, type PointSolde, type VirementRapproche,
} from '@/lib/tresorerie'
import { BoutonActualiser } from './BoutonActualiser'
import { MouvementsTable, type LigneMouvement } from './MouvementsTable'

/** Au-delà, la liste des mouvements ne garde que les plus récents (le reste alourdirait la page). */
const MOUVEMENTS_MAX = 800

const dateLongue = (jour: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${jour}T12:00:00Z`))
const dateCourte = (jour: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${jour}T12:00:00Z`))
const heureParis = (iso: string) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso))
const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un)

const STATUT_FACTURE: Record<string, string> = {
  payee: 'Payée', en_retard: 'En retard', emise: 'Émise', envoyee: 'Envoyée', payee_partiellement: 'Payée en partie', brouillon: 'Brouillon', annulee: 'Annulée',
}

// ─── Pièces ─────────────────────────────────────────────────────────────────

function Tuile({ label, valeur, sous, fort }: { label: string; valeur: string; sous: string; fort?: boolean }) {
  return (
    <div className={cn('card p-4 sm:p-5 min-w-0', fort && '!bg-brand-600 !border-brand-600')}>
      <p className={cn('text-xs font-medium', fort ? 'text-white/70' : 'text-surface-500')}>{label}</p>
      <p className={cn('mt-1.5 font-heading text-xl sm:text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap', fort ? '!text-white' : 'text-surface-900')}>{valeur}</p>
      <p className={cn('mt-1 text-xs', fort ? 'text-white/60' : 'text-surface-400')}>{sous}</p>
    </div>
  )
}

/** Solde total à la clôture de chaque jour. L'axe part toujours de zéro : la pente ne trompe pas. */
function Courbe({ points }: { points: PointSolde[] }) {
  const L = 600
  const H = 170
  const HAUT = 10
  const BAS = 6
  const valeurs = points.map((p) => p.solde)
  const max = Math.max(...valeurs, 0)
  const min = Math.min(...valeurs, 0)
  const etendue = max - min || 1
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * L : L / 2)
  const y = (v: number) => HAUT + (1 - (v - min) / etendue) * (H - HAUT - BAS)
  const trace = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.solde).toFixed(1)}`).join(' ')
  const pas = points.length > 1 ? L / (points.length - 1) : L
  const plusBas = points.reduce((a, b) => (b.solde < a.solde ? b : a), points[0])
  const plusHaut = points.reduce((a, b) => (b.solde > a.solde ? b : a), points[0])

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" className="block h-44 w-full lg:h-64" role="img" aria-label={`Solde total du ${dateCourte(points[0].jour)} au ${dateCourte(points[points.length - 1].jour)} : de ${montantFr(points[0].solde)} à ${montantFr(points[points.length - 1].solde)}`}>
          <line x1={0} x2={L} y1={y(0)} y2={y(0)} stroke="#CBD3DB" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path d={`${trace} L${L},${y(0)} L0,${y(0)} Z`} fill="#205040" fillOpacity={0.09} />
          <path d={trace} fill="none" stroke="#205040" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {/* Une bande par jour : l'infobulle donne le solde du jour */}
          {points.map((p, i) => (
            <rect key={p.jour} x={Math.max(0, x(i) - pas / 2)} y={0} width={pas} height={H} fill="transparent">
              <title>{`${dateCourte(p.jour)} : ${montantFr(p.solde)}`}</title>
            </rect>
          ))}
        </svg>
        <span className="pointer-events-none absolute left-0 top-0 rounded bg-white/80 px-1 font-mono text-[10px] tabular-nums text-surface-400">{montantFr(max)}</span>
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-surface-400">
        <span>{dateCourte(points[0].jour)}</span>
        <span>{dateCourte(points[points.length - 1].jour)}</span>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-surface-500">
        <span>Plus bas : <b className="font-semibold tabular-nums text-surface-800">{montantFr(plusBas.solde)}</b> le {dateCourte(plusBas.jour)}</span>
        <span>Plus haut : <b className="font-semibold tabular-nums text-surface-800">{montantFr(plusHaut.solde)}</b> le {dateCourte(plusHaut.jour)}</span>
      </p>
    </div>
  )
}

/** Entrées (pin) et sorties (gris) de chaque semaine, hors virements entre comptes de la société. */
function Semaines({ semaines }: { semaines: FluxSemaine[] }) {
  const max = Math.max(1, ...semaines.flatMap((s) => [s.entrees, s.sorties]))
  const pasLibelle = Math.ceil(semaines.length / 9)
  return (
    <div>
      <div className="flex h-40 items-end gap-1 sm:gap-2">
        {semaines.map((s) => (
          <div
            key={s.lundi}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5"
            title={`Semaine du ${dateCourte(s.lundi)} : ${montantFr(s.entrees)} entrés, ${montantFr(s.sorties)} sortis`}
          >
            <span className="w-1/2 max-w-[18px] rounded-t-[3px] bg-brand-500" style={{ height: `${(s.entrees / max) * 100}%`, minHeight: s.entrees > 0 ? 2 : 0 }} />
            <span className="w-1/2 max-w-[18px] rounded-t-[3px] bg-surface-300" style={{ height: `${(s.sorties / max) * 100}%`, minHeight: s.sorties > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 border-t border-surface-200 pt-1.5 sm:gap-2" aria-hidden="true">
        {semaines.map((s, i) => (
          <span key={s.lundi} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center font-mono text-[10px] tabular-nums text-surface-400">
            {i % pasLibelle === 0 ? `${s.lundi.slice(8, 10)}/${s.lundi.slice(5, 7)}` : ''}
          </span>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-surface-500">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-brand-500" /> Entrées</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-surface-300" /> Sorties</span>
        <span className="text-surface-400">Par semaine, virements entre vos comptes exclus.</span>
      </p>
    </div>
  )
}

function ListeTiers({ lignes, vide }: { lignes: LigneTiers[]; vide: string }) {
  if (!lignes.length) return <p className="text-sm text-surface-500">{vide}</p>
  const total = lignes.reduce((s, l) => s + l.montant, 0) || 1
  const tete = lignes.slice(0, 6)
  const reste = lignes.slice(6)
  const autres = reste.length ? [{ nom: `${reste.length} ${pluriel(reste.length, 'autre tiers', 'autres tiers')}`, montant: reste.reduce((s, l) => s + l.montant, 0), nb: reste.reduce((s, l) => s + l.nb, 0) }] : []
  return (
    <ul className="space-y-3">
      {[...tete, ...autres].map((l) => (
        <li key={l.nom}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-surface-800">{l.nom}</span>
            <span className="shrink-0 font-mono text-sm tabular-nums text-surface-900">{montantFr(l.montant)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-100">
              <span className="block h-full rounded-full bg-brand-500/70" style={{ width: `${Math.max(1, (l.montant / total) * 100)}%` }} />
            </span>
            <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-surface-400">{Math.round((l.montant / total) * 100)} % · {l.nb} {pluriel(l.nb, 'mouv.', 'mouv.')}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Bloc({ titre, sous, children, className }: { titre: string; sous?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('card p-4 sm:p-5 min-w-0', className)}>
      <h2 className="font-heading font-semibold text-surface-900">{titre}</h2>
      {sous && <p className="mt-0.5 text-xs text-surface-500">{sous}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function LigneMontant({ label, lot, href, note }: { label: string; lot: { nb: number; total: number }; href?: string; note?: string }) {
  const contenu = (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-surface-800">{label}</span>
        <span className="block text-xs text-surface-400">{lot.nb} {note || pluriel(lot.nb, 'ligne', 'lignes')}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-sm tabular-nums text-surface-900">
        {montantFr(lot.total)}
        {href && <ArrowRight className="h-3.5 w-3.5 text-surface-300 group-hover:text-brand-600" />}
      </span>
    </>
  )
  const classe = 'group flex items-center justify-between gap-3 py-2.5'
  return href ? <Link href={href} className={classe}>{contenu}</Link> : <div className={classe}>{contenu}</div>
}

function ConnecterQonto() {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <Landmark className="h-5 w-5 text-brand-600" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-surface-900">Reliez Qonto pour voir vos soldes ici</h2>
          <p className="mt-1 text-sm text-surface-600">
            Tant que la clé n’est pas enregistrée, cette page n’affiche que ce que le CRM connaît : les factures à encaisser et les paiements à prévoir.
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-surface-700">
            <li>Dans Qonto, ouvrez Paramètres, puis Intégrations et partenariats, puis Clé API.</li>
            <li>Copiez l’identifiant et la clé secrète.</li>
            <li>Enregistrez-les dans les variables d’environnement du CRM, sous les noms <code className="rounded bg-surface-100 px-1 py-0.5 font-mono text-xs">QONTO_LOGIN</code> et <code className="rounded bg-surface-100 px-1 py-0.5 font-mono text-xs">QONTO_SECRET_KEY</code>, puis redéployez.</li>
          </ol>
          <p className="mt-4 flex items-start gap-2 text-xs text-surface-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-400" />
            Le CRM ne fait que lire : soldes et mouvements. Il n’émet aucun virement et ne modifie rien dans Qonto.
          </p>
        </div>
      </div>
    </section>
  )
}

function Rapprochement({ virements }: { virements: VirementRapproche[] }) {
  const aPointer = virements.filter((v) => v.aPointer)
  const liste = [...aPointer, ...virements.filter((v) => !v.aPointer)].slice(0, 12)
  return (
    <Bloc
      titre="Virements qui citent une facture"
      sous={aPointer.length
        ? `${aPointer.length} ${pluriel(aPointer.length, 'virement reçu cite une facture', 'virements reçus citent une facture')} encore ouverte dans le CRM.`
        : 'Toutes les factures citées par un virement sont déjà soldées dans le CRM.'}
    >
      <ul className="divide-y divide-surface-100">
        {liste.map((v) => (
          <li key={v.mouvement.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
            <span className="w-16 shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-surface-400">{dateCourte(jourParis(v.mouvement.date))}</span>
            <span className="min-w-0 flex-1 basis-40 truncate text-sm font-medium text-surface-800">{v.mouvement.tiers}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {v.factures.map((f) => (
                <span
                  key={f.id}
                  className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                    f.status === 'payee' ? 'bg-brand-50 text-brand-700' : 'bg-warning-50 text-warning-700')}
                >
                  {f.status === 'payee' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  <span className="font-mono">{f.numero}</span>
                  <span className="font-normal opacity-80">{STATUT_FACTURE[f.status] || f.status}</span>
                </span>
              ))}
              {v.inconnus.map((n) => (
                <span key={n} className="inline-flex items-center rounded-md bg-surface-100 px-2 py-0.5 font-mono text-xs text-surface-500" title="Numéro inconnu du CRM">{n}</span>
              ))}
            </span>
            <span className="ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums text-brand-600">+{montantFr(v.mouvement.montant, 2)}</span>
          </li>
        ))}
      </ul>
      {aPointer.length > 0 && (
        <Link href="/dashboard/factures" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
          Pointer ces factures <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </Bloc>
  )
}

function Attendus({ e, affacturage }: { e: Engagements; affacturage: boolean }) {
  const { aEncaisser: enc, aPayer: pay } = e
  const maxTranche = Math.max(1, ...enc.tranches.map((t) => t.montant))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloc titre="À encaisser" sous="Factures émises et non soldées dans le CRM.">
        <p className="font-heading text-2xl font-bold tracking-tight tabular-nums text-surface-900">{montantFr(enc.total)}</p>
        <p className="mt-1 text-xs text-surface-500">
          {enc.nb} {pluriel(enc.nb, 'facture', 'factures')}
          {enc.enRetard.nb > 0 && <> · <span className="font-medium text-warning-700">{montantFr(enc.enRetard.total)} en retard ({enc.enRetard.nb})</span></>}
        </p>

        {enc.nb > 0 && (
          <>
            <h3 className="section-label mt-5">Par financeur</h3>
            <ul className="mt-1 divide-y divide-surface-100">
              {enc.parFinanceur.slice(0, 7).map((f) => (
                <li key={f.nom} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-surface-800">{f.nom}</span>
                    <span className="block text-xs text-surface-400">
                      {f.nb} {pluriel(f.nb, 'facture', 'factures')}{f.plusAncienne && ` · échéance la plus ancienne le ${dateCourte(f.plusAncienne)}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-surface-900">{montantFr(f.montant)}</span>
                </li>
              ))}
            </ul>

            <h3 className="section-label mt-5">Par ancienneté</h3>
            <ul className="mt-2 space-y-2">
              {enc.tranches.filter((t) => t.nb > 0).map((t) => (
                <li key={t.label} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-xs">
                  <span className="truncate text-surface-600">{t.label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface-100">
                    <span className="block h-full rounded-full bg-warning-500/70" style={{ width: `${Math.max(1, (t.montant / maxTranche) * 100)}%` }} />
                  </span>
                  <span className="font-mono tabular-nums text-surface-800">{montantFr(t.montant)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {(affacturage || enc.sansMontant > 0) && (
          <div className="mt-5 space-y-2 rounded-xl bg-surface-50 p-3 text-xs text-surface-600">
            {affacturage && (
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-400" />
                Une partie de vos encaissements arrive par un affactureur. Le CRM ne sait pas quelles factures lui ont été cédées : une facture déjà financée reste comptée ici tant qu’elle n’est pas marquée payée.
              </p>
            )}
            {enc.sansMontant > 0 && (
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-500" />
                {enc.sansMontant} {pluriel(enc.sansMontant, 'facture émise n’a aucun montant et n’est pas comptée', 'factures émises n’ont aucun montant et ne sont pas comptées')}.
              </p>
            )}
          </div>
        )}
        <Link href="/dashboard/factures" className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
          Ouvrir les factures <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Bloc>

      <Bloc titre="À payer" sous="Ce que le CRM sait devoir : formateurs et commissions.">
        <p className="font-heading text-2xl font-bold tracking-tight tabular-nums text-surface-900">{montantFr(pay.total)}</p>
        <p className="mt-1 text-xs text-surface-500">Salaires, charges, loyers et abonnements ne sont pas dans le CRM : ils n’apparaissent que dans les mouvements Qonto.</p>
        <div className="mt-4 divide-y divide-surface-100">
          <LigneMontant label="Factures formateurs à valider" lot={pay.formateursAValider} href="/dashboard/factures-formateurs" note={pluriel(pay.formateursAValider.nb, 'facture reçue', 'factures reçues')} />
          <LigneMontant label="Factures formateurs validées, à régler" lot={pay.formateursValidees} href="/dashboard/factures-formateurs" note={pluriel(pay.formateursValidees.nb, 'facture', 'factures')} />
          <LigneMontant label="Commissions franchises validées" lot={pay.franchisesValidees} href="/dashboard/franchises" note={pluriel(pay.franchisesValidees.nb, 'session', 'sessions')} />
          <LigneMontant label="Commissions apporteurs validées" lot={pay.apporteursValidees} href="/dashboard/apporteurs" note={pluriel(pay.apporteursValidees.nb, 'commission', 'commissions')} />
        </div>
        {pay.commissionsAVenir.nb > 0 && (
          <p className="mt-3 rounded-xl bg-surface-50 p-3 text-xs text-surface-600">
            À venir, pas encore dû : <b className="font-semibold tabular-nums text-surface-800">{montantFr(pay.commissionsAVenir.total)}</b> de commissions sur {pay.commissionsAVenir.nb} {pluriel(pay.commissionsAVenir.nb, 'ligne', 'lignes')} (sessions pas encore payées par le financeur).
          </p>
        )}
        {pay.formateurs.length > 0 && (
          <>
            <h3 className="section-label mt-5">Factures formateurs les plus anciennes</h3>
            <ul className="mt-1 divide-y divide-surface-100">
              {pay.formateurs.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-surface-800">{f.nom}</span>
                    <span className="block text-xs text-surface-400">{[f.numero, f.date && `reçue le ${dateCourte(f.date)}`, f.status === 'validee' ? 'validée' : 'à valider'].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-surface-900">{montantFr(f.montant)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Bloc>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function TresoreriePage({ searchParams }: { searchParams: { periode?: string } }) {
  const session = await getSession()
  if (!peutVoirTresorerie(session.user.role)) redirect('/dashboard')
  const supabase = await createServiceRoleClient()
  const organizationId = session.organization.id
  const jours = PERIODES.find((p) => String(p.jours) === searchParams.periode)?.jours ?? 30
  const aujourdhui = jourParis(new Date())
  const relie = qontoConfigure()

  const [engagements, org, lecture] = await Promise.all([
    chargerEngagements(supabase, organizationId, aujourdhui).catch(() => null),
    supabase.from('organizations').select('siret').eq('id', organizationId).single(),
    relie
      ? lireBanqueQonto(JOURS_RELEVE).then((b) => ({ banque: b as BanqueQonto | null, erreur: null as string | null }))
        .catch((e) => ({ banque: null, erreur: messageErreurQonto(e) }))
      : Promise.resolve({ banque: null as BanqueQonto | null, erreur: null as string | null }),
  ])

  // Le relevé d'une société n'est montré qu'à l'organisme qui porte le même SIREN
  let { banque, erreur } = lecture
  const sirenOrganisme = String(org.data?.siret || '').replace(/\D/g, '').slice(0, 9)
  if (banque && (!banque.siren || banque.siren !== sirenOrganisme)) {
    banque = null
    erreur = 'Le compte Qonto relié appartient à une autre société que cet organisme (SIREN différent). Vérifiez le SIRET dans les paramètres, ou la clé enregistrée.'
  }

  const synthese = banque ? synthetiserBanque(banque, jours, aujourdhui) : null
  const premierJour = synthese?.courbe[0]?.jour
  const mouvementsPeriode = banque && premierJour ? banque.mouvements.filter((m) => jourParis(m.date) >= premierJour) : []
  const nomCompte = new Map((banque?.comptes || []).map((c) => [c.id, c.nom]))

  const cites = banque ? [...new Set(banque.mouvements.filter((m) => m.sens === 'credit' && !m.interne).flatMap((m) => numerosFactureCites(`${m.reference} ${m.libelle}`)))] : []
  const virements = banque ? rapprocher(banque.mouvements, await chargerFacturesCitees(supabase, organizationId, cites).catch(() => [])) : []
  const ecart = banque && engagements ? encaissementsNonSaisis(banque, engagements.dernierPaiement) : null
  const affacturage = !!banque?.mouvements.some((m) => m.sens === 'credit' && /factor|affactur/i.test(`${m.tiers} ${m.libelle}`))

  const lignes: LigneMouvement[] = mouvementsPeriode.slice(0, MOUVEMENTS_MAX).map((m) => ({
    id: m.id,
    jour: jourParis(m.date),
    montant: m.montant,
    sens: m.sens,
    tiers: m.tiers,
    detail: [m.reference, m.categorie].filter(Boolean).join(' · '),
    compte: nomCompte.get(m.compteId) || '',
    interne: m.interne,
  }))
  const net = synthese ? synthese.entrees - synthese.sorties : 0
  const periodeLabel = PERIODES.find((p) => p.jours === jours)!.label

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-heading font-bold text-surface-900">Trésorerie</h1>
            <p className="text-sm text-surface-500">
              {banque
                ? `Relevé Qonto de ${heureParis(banque.luLe)}, ${banque.comptes.length} ${pluriel(banque.comptes.length, 'compte', 'comptes')}. Encaissements attendus et paiements à prévoir.`
                : 'Encaissements attendus et paiements à prévoir, d’après le CRM.'}
            </p>
          </div>
        </div>
        {banque && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <nav aria-label="Période" className="inline-flex rounded-lg bg-surface-100 p-0.5 self-start">
              {PERIODES.map((p) => (
                <Link
                  key={p.jours}
                  href={p.jours === 30 ? '/dashboard/tresorerie' : `/dashboard/tresorerie?periode=${p.jours}`}
                  aria-current={p.jours === jours ? 'page' : undefined}
                  className={cn('inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold transition-colors', p.jours === jours ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-800')}
                >
                  {p.label}
                </Link>
              ))}
            </nav>
            <BoutonActualiser />
          </div>
        )}
      </div>

      {!relie && <ConnecterQonto />}
      {erreur && (
        <div className="card p-4 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-warning-600 mt-0.5 shrink-0" />
          <p className="text-sm text-surface-600">{erreur}</p>
        </div>
      )}

      {banque && synthese && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Tuile
              fort
              label="En banque aujourd’hui"
              valeur={montantFr(synthese.total)}
              sous={synthese.disponible < synthese.total - 0.5 ? `${montantFr(synthese.disponible)} disponibles, cartes en attente déduites` : `Sur ${banque.comptes.length} ${pluriel(banque.comptes.length, 'compte', 'comptes')}`}
            />
            <Tuile label={`Encaissé sur ${periodeLabel}`} valeur={montantFr(synthese.entrees)} sous={`${synthese.nbEntrees} ${pluriel(synthese.nbEntrees, 'entrée', 'entrées')}`} />
            <Tuile label={`Décaissé sur ${periodeLabel}`} valeur={montantFr(synthese.sorties)} sous={`${synthese.nbSorties} ${pluriel(synthese.nbSorties, 'sortie', 'sorties')}`} />
            <Tuile label="Variation nette" valeur={`${net > 0 ? '+' : ''}${montantFr(net)}`} sous={net >= 0 ? 'Plus d’entrées que de sorties' : 'Plus de sorties que d’entrées'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Bloc titre="Solde total" sous={`Tous comptes confondus, à la clôture de chaque jour, sur ${periodeLabel}.`} className="lg:col-span-2">
              <Courbe points={synthese.courbe} />
            </Bloc>
            <Bloc titre="Comptes" sous={banque.raisonSociale || undefined}>
              <ul className="divide-y divide-surface-100">
                {banque.comptes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-surface-800">
                        {c.nom}
                        {c.principal && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">Principal</span>}
                      </span>
                      <span className="block font-mono text-[11px] text-surface-400">{c.iban ? `···· ${c.iban.slice(-4)}` : ''}</span>
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-surface-900">{montantFr(c.solde, 2)}</span>
                  </li>
                ))}
              </ul>
            </Bloc>
          </div>

          <Bloc titre="Entrées et sorties" sous={`Semaine par semaine, sur ${periodeLabel}.`}>
            <Semaines semaines={synthese.semaines} />
          </Bloc>

          <div className="grid gap-4 lg:grid-cols-2">
            <Bloc titre="D’où vient l’argent" sous={`Encaissements par tiers, sur ${periodeLabel}.`}>
              <ListeTiers lignes={synthese.origines} vide="Aucun encaissement sur la période." />
            </Bloc>
            <Bloc titre="Où il part" sous={`Décaissements par tiers, sur ${periodeLabel}.`}>
              <ListeTiers lignes={synthese.destinations} vide="Aucun décaissement sur la période." />
            </Bloc>
          </div>

          {banque.tronque && (
            <p className="text-xs text-surface-500">Un compte compte plus de mouvements que la page n’en lit : les plus anciens des six derniers mois manquent, et la courbe peut être faussée au début.</p>
          )}
        </>
      )}

      {ecart && engagements && engagements.aEncaisser.nb > 0 && (
        <div className="card flex items-start gap-3 border-warning-500/30 bg-warning-50/60 p-4 sm:p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
          <div className="min-w-0 text-sm text-surface-700">
            <p className="font-semibold text-surface-900">
              {montantFr(ecart.total)} reçus en banque depuis le dernier paiement saisi dans le CRM
            </p>
            <p className="mt-1">
              {ecart.depuis === engagements.dernierPaiement
                ? `Le dernier paiement enregistré dans le CRM date du ${dateLongue(ecart.depuis)}.`
                : `Le dernier paiement enregistré dans le CRM est antérieur au ${dateLongue(ecart.depuis)}, début du relevé.`}{' '}
              Depuis, Qonto a reçu {ecart.nb} {pluriel(ecart.nb, 'encaissement', 'encaissements')}
              {ecart.principaux.length > 0 && <> ({ecart.principaux.map((t) => `${t.nom} ${montantFr(t.montant)}`).join(', ')})</>}.
              {' '}Pendant ce temps, {engagements.aEncaisser.nb} {pluriel(engagements.aEncaisser.nb, 'facture reste ouverte', 'factures restent ouvertes')} dans le CRM : une partie est sans doute déjà réglée et reste à pointer.
            </p>
          </div>
        </div>
      )}

      {virements.length > 0 && <Rapprochement virements={virements} />}

      {engagements
        ? <Attendus e={engagements} affacturage={affacturage} />
        : (
          <div className="card p-4 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-warning-600 mt-0.5 shrink-0" />
            <p className="text-sm text-surface-600">Les factures et les paiements à prévoir n’ont pas pu être lus. Rechargez la page.</p>
          </div>
        )}

      {banque && <MouvementsTable lignes={lignes} comptes={banque.comptes.map((c) => c.nom)} tronque={mouvementsPeriode.length > MOUVEMENTS_MAX} />}
    </div>
  )
}
