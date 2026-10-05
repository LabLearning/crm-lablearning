import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ArrowRight, ChevronDown } from '@/components/ui/icons'
import { montantFr, type DepensesPersonne, type LigneDetail, type LigneTiers, type Ventilation, type VersementsFormateur } from '@/lib/tresorerie'

const dateCourte = (jour: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${jour}T12:00:00Z`))
const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un)
const part = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)} % des sorties` : '')

const GRILLE = 'md:grid md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_1.25rem] md:items-center md:gap-3'
const ENTETE = 'hidden border-t border-surface-100 bg-surface-50/60 px-5 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-surface-400'
const RESUME = 'cursor-pointer list-none px-4 py-3 transition-colors hover:bg-surface-50/70 sm:px-5 [&::-webkit-details-marker]:hidden'

function Tuile({ label, valeur, sous, fort }: { label: string; valeur: string; sous: string; fort?: boolean }) {
  return (
    <div className={cn('card p-4 sm:p-5 min-w-0', fort && '!bg-brand-600 !border-brand-600')}>
      <p className={cn('text-xs font-medium', fort ? 'text-white/70' : 'text-surface-500')}>{label}</p>
      <p className={cn('mt-1.5 font-heading text-xl sm:text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap', fort ? '!text-white' : 'text-surface-900')}>{valeur}</p>
      <p className={cn('mt-1 text-xs', fort ? 'text-white/60' : 'text-surface-400')}>{sous}</p>
    </div>
  )
}

function Chiffre({ label, children, fort }: { label: string; children: React.ReactNode; fort?: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-2 md:block md:text-right">
      <span className="text-xs text-surface-400 md:hidden">{label}</span>
      <span className={cn('font-mono text-sm tabular-nums', fort ? 'font-semibold text-surface-900' : 'text-surface-700')}>{children}</span>
    </span>
  )
}

/** Les virements un à un : la date, ce que dit le libellé, le compte d'où il part. */
function Virements({ lignes }: { lignes: LigneDetail[] }) {
  if (!lignes.length) return <p className="mt-1.5 text-xs text-surface-400">Aucun virement sur la période.</p>
  return (
    <ul className="mt-1.5 space-y-1.5">
      {lignes.map((l, i) => (
        <li key={i} className="flex items-baseline gap-3 text-xs">
          <span className="w-16 shrink-0 whitespace-nowrap font-mono tabular-nums text-surface-400">{dateCourte(l.jour)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-surface-700" title={l.libelle}>{l.libelle || 'Sans libellé'}</span>
            {l.compte && <span className="block truncate text-surface-400">Compte {l.compte}</span>}
          </span>
          <span className="shrink-0 font-mono tabular-nums text-surface-800">{montantFr(l.montant, 2)}</span>
        </li>
      ))}
    </ul>
  )
}

function Commercants({ lignes }: { lignes: LigneTiers[] }) {
  if (!lignes.length) return <p className="mt-1.5 text-xs text-surface-400">Aucun paiement par carte sur la période.</p>
  const tete = lignes.slice(0, 14)
  const reste = lignes.slice(14)
  return (
    <ul className="mt-1.5 space-y-1">
      {tete.map((l) => (
        <li key={l.nom} className="flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-surface-700">{l.nom}{l.nb > 1 && <span className="text-surface-400"> ({l.nb})</span>}</span>
          <span className="shrink-0 font-mono tabular-nums text-surface-800">{montantFr(l.montant, 2)}</span>
        </li>
      ))}
      {reste.length > 0 && (
        <li className="flex items-baseline justify-between gap-3 text-xs text-surface-500">
          <span>{reste.length} {pluriel(reste.length, 'autre commerçant', 'autres commerçants')}</span>
          <span className="shrink-0 font-mono tabular-nums">{montantFr(reste.reduce((s, l) => s + l.montant, 0), 2)}</span>
        </li>
      )}
    </ul>
  )
}

function LignePersonne({ p }: { p: DepensesPersonne }) {
  return (
    <details className="group border-t border-surface-100">
      <summary className={cn(RESUME, GRILLE)}>
        <span className="flex items-center justify-between gap-3 md:block">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-surface-800">{p.nom}</span>
            <span className="block text-xs text-surface-400">
              {p.versements.length} {pluriel(p.versements.length, 'virement', 'virements')} · {p.nbPaiements} {pluriel(p.nbPaiements, 'paiement par carte', 'paiements par carte')}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-surface-300 transition-transform group-open:rotate-180 md:hidden" />
        </span>
        <span className="mt-2 grid grid-cols-3 gap-x-4 md:mt-0 md:contents">
          <Chiffre label="Versé">{montantFr(p.verse)}</Chiffre>
          <Chiffre label="Carte">{montantFr(p.carte)}</Chiffre>
          <Chiffre label="Total" fort>{montantFr(p.total)}</Chiffre>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-surface-300 transition-transform group-open:rotate-180 md:block" />
      </summary>
      <div className="grid gap-5 bg-surface-50/60 px-4 py-4 sm:px-5 md:grid-cols-2">
        <div className="min-w-0">
          <h4 className="section-label">Ce qui lui a été versé</h4>
          <Virements lignes={p.versements} />
        </div>
        <div className="min-w-0">
          <h4 className="section-label">Payé avec sa carte</h4>
          <Commercants lignes={p.commercants} />
        </div>
      </div>
    </details>
  )
}

function LigneFormateur({ f }: { f: VersementsFormateur }) {
  return (
    <details className="group border-t border-surface-100">
      <summary className={cn(RESUME, GRILLE)}>
        <span className="flex items-center justify-between gap-3 md:block">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-surface-800">{f.nom}</span>
            <span className="block text-xs text-surface-400">{f.formateurId ? 'Fiche formateur reconnue' : 'Payé depuis le compte des formateurs, pas de fiche à ce nom'}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-surface-300 transition-transform group-open:rotate-180 md:hidden" />
        </span>
        <span className="mt-2 grid grid-cols-3 gap-x-4 md:mt-0 md:contents">
          <Chiffre label="Virements">{f.lignes.length}</Chiffre>
          <Chiffre label="Dernier">{dateCourte(f.dernier)}</Chiffre>
          <Chiffre label="Versé" fort>{montantFr(f.total)}</Chiffre>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-surface-300 transition-transform group-open:rotate-180 md:block" />
      </summary>
      <div className="bg-surface-50/60 px-4 py-4 sm:px-5">
        <h4 className="section-label">Virements reçus</h4>
        <Virements lignes={f.lignes} />
        {f.formateurId && (
          <Link href={`/dashboard/formateurs/${f.formateurId}`} className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
            Ouvrir sa fiche <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </details>
  )
}

/** Qui reçoit quoi : les personnes de l'organisme, les formateurs, puis les autres virements. */
export function VuePersonnes({ v, periode }: { v: Ventilation; periode: string }) {
  const autres = v.autres.slice(0, 25)
  const autresReste = v.autres.slice(25)
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tuile fort label={`Sorti sur ${periode}`} valeur={montantFr(v.sorties)} sous="Virements entre vos comptes exclus" />
        <Tuile label="Équipe" valeur={montantFr(v.totalEquipe)} sous={[`${v.equipe.length} ${pluriel(v.equipe.length, 'personne', 'personnes')}`, part(v.totalEquipe, v.sorties)].filter(Boolean).join(' · ')} />
        <Tuile label="Formateurs" valeur={montantFr(v.totalFormateurs)} sous={[`${v.formateurs.length} ${pluriel(v.formateurs.length, 'formateur', 'formateurs')}`, part(v.totalFormateurs, v.sorties)].filter(Boolean).join(' · ')} />
        <Tuile label="Autres virements" valeur={montantFr(v.totalAutres)} sous={[`${v.autres.length} ${pluriel(v.autres.length, 'bénéficiaire', 'bénéficiaires')}`, part(v.totalAutres, v.sorties)].filter(Boolean).join(' · ')} />
      </div>

      <section className="card overflow-hidden" aria-labelledby="equipe-titre">
        <div className="p-4 sm:p-5">
          <h2 id="equipe-titre" className="font-heading font-semibold text-surface-900">Par personne de l’organisme</h2>
          <p className="mt-0.5 text-xs text-surface-500">Ce qui a été versé à chacun par virement et ce que chacun a payé avec sa carte, sur {periode}. Ouvrez une ligne pour voir le détail.</p>
        </div>
        {v.equipe.length === 0 ? (
          <p className="border-t border-surface-100 p-5 text-sm text-surface-500">Aucun virement ni paiement par carte rattaché à une personne sur la période.</p>
        ) : (
          <>
            <div className={cn(ENTETE, GRILLE)}>
              <span className="text-left">Personne</span>
              <span>Versé par virement</span>
              <span>Payé par carte</span>
              <span>Total</span>
              <span />
            </div>
            {v.equipe.map((p) => <LignePersonne key={p.cle} p={p} />)}
            <div className={cn('border-t-2 border-surface-200 bg-surface-50/60 px-4 py-3 sm:px-5', GRILLE)}>
              <span className="block text-sm font-semibold text-surface-900">Total équipe</span>
              <span className="mt-2 grid grid-cols-3 gap-x-4 md:mt-0 md:contents">
                <Chiffre label="Versé">{montantFr(v.equipe.reduce((s, p) => s + p.verse, 0))}</Chiffre>
                <Chiffre label="Carte">{montantFr(v.equipe.reduce((s, p) => s + p.carte, 0))}</Chiffre>
                <Chiffre label="Total" fort>{montantFr(v.totalEquipe)}</Chiffre>
              </span>
              <span className="hidden md:block" />
            </div>
          </>
        )}
      </section>

      <section className="card overflow-hidden" aria-labelledby="formateurs-titre">
        <div className="p-4 sm:p-5">
          <h2 id="formateurs-titre" className="font-heading font-semibold text-surface-900">Par formateur</h2>
          <p className="mt-0.5 text-xs text-surface-500">Ce qui a été versé à chaque formateur, sur {periode}. Un formateur qui fait aussi partie de l’équipe est compté plus haut, une seule fois.</p>
        </div>
        {v.formateurs.length === 0 ? (
          <p className="border-t border-surface-100 p-5 text-sm text-surface-500">Aucun virement à un formateur reconnu sur la période.</p>
        ) : (
          <>
            <div className={cn(ENTETE, GRILLE)}>
              <span className="text-left">Formateur</span>
              <span>Virements</span>
              <span>Dernier virement</span>
              <span>Versé</span>
              <span />
            </div>
            {v.formateurs.map((f) => <LigneFormateur key={f.cle} f={f} />)}
            <div className={cn('border-t-2 border-surface-200 bg-surface-50/60 px-4 py-3 sm:px-5', GRILLE)}>
              <span className="block text-sm font-semibold text-surface-900">Total formateurs</span>
              <span className="mt-2 grid grid-cols-3 gap-x-4 md:mt-0 md:contents">
                <Chiffre label="Virements">{v.formateurs.reduce((s, f) => s + f.lignes.length, 0)}</Chiffre>
                <span className="hidden md:block" />
                <Chiffre label="Versé" fort>{montantFr(v.totalFormateurs)}</Chiffre>
              </span>
              <span className="hidden md:block" />
            </div>
          </>
        )}
      </section>

      <section className="card p-4 sm:p-5" aria-labelledby="autres-titre">
        <h2 id="autres-titre" className="font-heading font-semibold text-surface-900">Autres virements émis</h2>
        <p className="mt-0.5 text-xs text-surface-500">
          Les bénéficiaires que la page n’a rattachés ni à l’équipe ni à un formateur : fournisseurs, apporteurs, et formateurs payés au nom de leur société.
        </p>
        {v.autres.length === 0 ? <p className="mt-4 text-sm text-surface-500">Aucun autre virement sur la période.</p> : (
          <ul className="mt-3 divide-y divide-surface-100">
            {autres.map((l) => (
              <li key={l.nom} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-surface-800">{l.nom}{l.nb > 1 && <span className="text-xs text-surface-400"> ({l.nb} virements)</span>}</span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-surface-900">{montantFr(l.montant)}</span>
              </li>
            ))}
            {autresReste.length > 0 && (
              <li className="flex items-baseline justify-between gap-3 py-2 text-sm text-surface-500">
                <span>{autresReste.length} {pluriel(autresReste.length, 'autre bénéficiaire', 'autres bénéficiaires')}</span>
                <span className="shrink-0 font-mono tabular-nums">{montantFr(autresReste.reduce((s, l) => s + l.montant, 0))}</span>
              </li>
            )}
          </ul>
        )}
        <p className="mt-4 rounded-xl bg-surface-50 p-3 text-xs text-surface-600">
          Le reste des sorties, soit <b className="font-semibold tabular-nums text-surface-800">{montantFr(v.reste)}</b>, ce sont les prélèvements et les frais bancaires : ils ne sont rattachés à personne.
          Un virement est attribué à une personne seulement quand le nom du bénéficiaire correspond exactement au sien ; dans le doute, il reste dans cette liste.
        </p>
      </section>
    </>
  )
}
