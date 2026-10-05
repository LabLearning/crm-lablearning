import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ArrowRight, ChevronDown, Info } from '@/components/ui/icons'
import { montantFr, type VersementsFormateur } from '@/lib/tresorerie'
import type { Acompte } from '@/lib/rapprochement-formateurs'
import { SUIVI_LABEL, type Lot, type PilotageFormateur, type PilotageFormateurs as Pilotage, type SessionFormateur, type SuiviSession } from '@/lib/pilotage-formateurs'

/** Ce que la banque a versé à un formateur ; `equipe` : il est payé comme membre de l'équipe, pas comme formateur. */
export interface BanqueFormateur {
  versements: VersementsFormateur | null
  equipe: boolean
  /** Virements qui désignent une facture sans en avoir le montant : avances et acomptes. */
  acomptes: Acompte[]
}

const dateCourte = (jour: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${jour}T12:00:00Z`))
const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un)

const SUIVI_CLS: Record<SuiviSession, string> = {
  a_facturer: 'bg-surface-100 text-surface-600',
  a_valider: 'bg-amber-50 text-amber-700',
  validee: 'bg-sky-50 text-sky-700',
  payee: 'bg-emerald-50 text-emerald-700',
  en_cours: 'bg-brand-50 text-brand-700',
  a_venir: 'bg-brand-50 text-brand-700',
}

const GRILLE_5 = 'md:grid md:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))_1.25rem] md:items-center md:gap-3'
const GRILLE_6 = 'md:grid md:grid-cols-[minmax(0,1.5fr)_repeat(6,minmax(0,1fr))_1.25rem] md:items-center md:gap-3'

function Tuile({ label, valeur, sous, fort }: { label: string; valeur: string; sous: string; fort?: boolean }) {
  return (
    <div className={cn('card p-4 sm:p-5 min-w-0', fort && '!bg-brand-600 !border-brand-600')}>
      <p className={cn('text-xs font-medium', fort ? 'text-white/70' : 'text-surface-500')}>{label}</p>
      <p className={cn('mt-1.5 font-heading text-xl sm:text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap', fort ? '!text-white' : 'text-surface-900')}>{valeur}</p>
      <p className={cn('mt-1 text-xs', fort ? 'text-white/60' : 'text-surface-400')}>{sous}</p>
    </div>
  )
}

/** Une case du tableau : un nombre et, dessous, le montant. Vide, elle s'efface. */
function Case({ label, nb, montant, sous, ton }: { label: string; nb: number | null; montant?: number | null; sous?: string; ton?: string }) {
  const vide = !nb && !montant
  return (
    <span className="flex items-baseline justify-between gap-2 md:block md:text-right">
      <span className="text-xs text-surface-400 md:hidden">{label}</span>
      <span>
        <span className={cn('font-mono text-sm tabular-nums', vide ? 'text-surface-300' : cn('font-semibold', ton || 'text-surface-900'))}>
          {vide ? '—' : nb !== null ? nb : montantFr(montant || 0)}
        </span>
        {!vide && (sous || (nb !== null && montant != null && montant > 0)) && (
          <span className="ml-2 text-[11px] text-surface-400 md:ml-0 md:block">{sous || montantFr(montant || 0)}</span>
        )}
      </span>
    </span>
  )
}

function LigneSession({ s }: { s: SessionFormateur }) {
  const ecart = s.facture && s.prevu !== null && Math.abs(s.prevu - s.facture.montantHt) >= 0.01
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
      <span className="w-full shrink-0 text-xs tabular-nums text-surface-500 sm:w-52">{s.periode}</span>
      <span className="min-w-0 flex-1 basis-56">
        <Link href={`/dashboard/sessions/${s.id}`} className="block truncate text-sm text-surface-800 hover:text-brand-600">
          {s.client || 'Sans client'}
          {s.poei && <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">POEI</span>}
        </Link>
        <span className="block truncate text-xs text-surface-400">{s.formation}{s.jours ? ` · ${s.jours} ${pluriel(s.jours, 'jour', 'jours')}` : ''}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm tabular-nums text-surface-800">
          {s.facture ? montantFr(s.facture.montantTtc) : s.prevu !== null ? montantFr(s.prevu) : <span className="text-surface-300">—</span>}
        </span>
        <span className={cn('block text-[11px]', ecart ? 'font-medium text-amber-700' : 'text-surface-400')}>
          {s.facture ? (ecart ? `prévu ${montantFr(s.prevu || 0)}` : s.facture.numero) : s.prevu !== null ? 'prévu' : 'montant non fixé'}
        </span>
      </span>
      <span className={cn('inline-flex w-36 shrink-0 justify-center rounded-full px-2 py-0.5 text-[11px] font-medium', SUIVI_CLS[s.suivi])}>{SUIVI_LABEL[s.suivi]}</span>
    </li>
  )
}

function LigneFormateur({ p, banque, avecBanque }: { p: PilotageFormateur; banque: BanqueFormateur | undefined; avecBanque: boolean }) {
  const v = banque?.versements || null
  const nonRecue = p.aFacturer.nb
    ? (p.aFacturer.total > 0 ? `${montantFr(p.aFacturer.total)}${p.aFacturerSansMontant ? ' et plus' : ''}` : 'montant non fixé')
    : undefined
  return (
    <details className="group border-t border-surface-100">
      <summary className={cn('cursor-pointer list-none px-4 py-3 transition-colors hover:bg-surface-50/70 sm:px-5 [&::-webkit-details-marker]:hidden', avecBanque ? GRILLE_6 : GRILLE_5)}>
        <span className="flex items-center justify-between gap-3 md:block">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-surface-900">{p.nom}</span>
            <span className="block text-xs text-surface-400">
              {[p.enCours ? `${p.enCours} en cours` : null, p.aVenir ? `${p.aVenir} à venir` : null].filter(Boolean).join(' · ') || (p.realisees ? `${p.jours ? `${String(p.jours).replace('.', ',')} ${pluriel(p.jours, 'jour', 'jours')}` : 'Durée non renseignée'}` : 'Aucune session réalisée sur la période')}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-surface-300 transition-transform group-open:rotate-180 md:hidden" />
        </span>
        <span className="mt-2 grid grid-cols-1 gap-y-1 md:mt-0 md:contents">
          <Case label="Sessions réalisées" nb={p.realisees} />
          <Case label="Facture non reçue" nb={p.aFacturer.nb} sous={nonRecue} />
          <Case label="À valider" nb={p.aValider.nb} montant={p.aValider.total} ton="text-amber-700" />
          <Case label="Validées, à payer" nb={p.validees.nb} montant={p.validees.total} ton="text-sky-700" />
          <Case label="Payées" nb={p.payees.nb} montant={p.payees.total} ton="text-emerald-700" />
          {avecBanque && (banque?.equipe
            ? <span className="flex items-baseline justify-between gap-2 md:block md:text-right"><span className="text-xs text-surface-400 md:hidden">Versé en banque</span><span className="text-[11px] text-surface-400">Membre de l’équipe</span></span>
            : <Case label="Versé en banque" nb={null} montant={v?.total || 0} sous={v ? `${v.lignes.length} ${pluriel(v.lignes.length, 'virement', 'virements')}` : undefined} />)}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-surface-300 transition-transform group-open:rotate-180 md:block" />
      </summary>

      <div className="space-y-4 bg-surface-50/60 px-4 py-4 sm:px-5">
        <div>
          <h4 className="section-label">Sessions</h4>
          {p.sessions.length === 0
            ? <p className="mt-1.5 text-xs text-surface-400">Aucune session sur la période.</p>
            : <ul className="mt-1 divide-y divide-surface-100">{p.sessions.map((s) => <LigneSession key={s.id} s={s} />)}</ul>}
        </div>

        {p.autresFactures.length > 0 && (
          <div>
            <h4 className="section-label">Autres factures de la période</h4>
            <ul className="mt-1 divide-y divide-surface-100">
              {p.autresFactures.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-surface-700">{f.numero}{f.objet ? ` · ${f.objet}` : ''}</span>
                  <span className="font-mono tabular-nums text-surface-800">{montantFr(f.montantTtc)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {avecBanque && !!banque?.acomptes.length && (
          <div>
            <h4 className="section-label">Avances et acomptes versés</h4>
            <p className="mt-1 text-xs text-surface-500">
              Ces virements n’ont le montant d’aucune facture : ils ne soldent rien, mais ils viennent en déduction de ce qui reste à payer.
              Total : <b className="font-semibold text-surface-800">{montantFr(banque.acomptes.reduce((s, a) => s + a.virement.montant, 0), 2)}</b>.
            </p>
            <ul className="mt-1 divide-y divide-surface-100">
              {banque.acomptes.map((a) => (
                <li key={a.virement.id} className="flex items-baseline gap-3 py-1.5 text-xs">
                  <span className="w-16 shrink-0 whitespace-nowrap font-mono tabular-nums text-surface-400">{dateCourte(a.virement.jour)}</span>
                  <span className="min-w-0 flex-1 truncate text-surface-700" title={a.virement.libelle}>
                    {a.virement.libelle || 'Sans libellé'}
                    <span className="text-surface-400"> · {a.factures.length ? `sur ${a.factures.join(', ')}` : 'facture non précisée'}</span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-surface-800">{montantFr(a.virement.montant, 2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {avecBanque && !banque?.equipe && (
          <div>
            <h4 className="section-label">Virements reçus en banque</h4>
            {!v ? <p className="mt-1.5 text-xs text-surface-400">Aucun virement à son nom sur la période. S’il est payé au nom de sa société, ses virements sont dans Trésorerie, onglet Personnes et formateurs.</p> : (
              <ul className="mt-1 divide-y divide-surface-100">
                {v.lignes.map((l, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-1.5 text-xs">
                    <span className="w-16 shrink-0 whitespace-nowrap font-mono tabular-nums text-surface-400">{dateCourte(l.jour)}</span>
                    <span className="min-w-0 flex-1 truncate text-surface-700" title={l.libelle}>{l.libelle || 'Sans libellé'}{l.compte && <span className="text-surface-400"> · compte {l.compte}</span>}</span>
                    <span className="shrink-0 font-mono tabular-nums text-surface-800">{montantFr(l.montant, 2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Link href={`/dashboard/formateurs/${p.id}`} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
          Ouvrir la fiche de {p.nom} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </details>
  )
}

const lotTexte = (l: Lot, un: string, plusieurs: string) => `${l.nb} ${pluriel(l.nb, un, plusieurs)}`

/** Le pilotage par formateur : sessions réalisées, factures en cours, payées, et ce que la banque a versé. */
export function PilotageFormateurs({ pilotage, banque, periode, banqueNote }: {
  pilotage: Pilotage
  /** Versements bancaires par identifiant de formateur ; null quand le relevé n'est pas visible pour ce rôle. */
  banque: Record<string, BanqueFormateur> | null
  /** « sur les 6 derniers mois », « depuis le 1er janvier 2026 »… */
  periode: string
  /** Précision sur la fenêtre du relevé quand elle est plus courte que la période affichée. */
  banqueNote: string | null
}) {
  const t = pilotage.total
  const avecBanque = !!banque
  const verse = banque ? Object.values(banque).reduce((s, b) => s + (b.versements?.total || 0), 0) : 0
  const nbPayes = banque ? Object.values(banque).filter((b) => b.versements).length : 0
  const enCours = t.aValider.total + t.validees.total

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tuile fort label={`Sessions réalisées ${periode}`} valeur={String(t.realisees)}
          sous={[`${t.formateurs} ${pluriel(t.formateurs, 'formateur', 'formateurs')}`, t.enCours ? `${t.enCours} en cours` : null, t.aVenir ? `${t.aVenir} à venir` : null].filter(Boolean).join(' · ')} />
        <Tuile label="Factures non reçues" valeur={String(t.aFacturer.nb)}
          sous={t.aFacturer.total > 0 ? `${montantFr(t.aFacturer.total)} de rémunération prévue${t.aFacturerSansMontant ? `, ${t.aFacturerSansMontant} sans montant fixé` : ''}` : 'Sessions réalisées sans facture dans le CRM'} />
        <Tuile label="Factures en cours" valeur={montantFr(enCours)}
          sous={`${lotTexte(t.aValider, 'à valider', 'à valider')} · ${lotTexte(t.validees, 'validée à payer', 'validées à payer')}`} />
        {avecBanque
          ? <Tuile label="Versé en banque" valeur={montantFr(verse)} sous={`${nbPayes} ${pluriel(nbPayes, 'formateur payé à son nom', 'formateurs payés à leur nom')}${banqueNote ? `, ${banqueNote}` : ''}`} />
          : <Tuile label="Factures payées" valeur={montantFr(t.payees.total)} sous={lotTexte(t.payees, 'facture marquée payée', 'factures marquées payées')} />}
      </div>

      <section className="card overflow-hidden" aria-labelledby="pilotage-formateurs-titre">
        <div className="p-4 sm:p-5">
          <h2 id="pilotage-formateurs-titre" className="font-heading font-semibold text-surface-900">Par formateur</h2>
          <p className="mt-0.5 text-xs text-surface-500">
            Sessions terminées {periode}, et où en est la facture de chacune. Ouvrez une ligne pour voir les sessions une à une.
          </p>
        </div>
        {pilotage.formateurs.length === 0 ? (
          <p className="border-t border-surface-100 p-5 text-sm text-surface-500">Aucune session animée par un formateur sur la période.</p>
        ) : (
          <>
            <div className={cn('hidden border-t border-surface-100 bg-surface-50/60 px-5 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-surface-400', avecBanque ? GRILLE_6 : GRILLE_5)}>
              <span className="text-left">Formateur</span>
              <span>Sessions réalisées</span>
              <span>Facture non reçue</span>
              <span>À valider</span>
              <span>Validées, à payer</span>
              <span>Payées</span>
              {avecBanque && <span>Versé en banque</span>}
              <span />
            </div>
            {pilotage.formateurs.map((p) => <LigneFormateur key={p.id} p={p} banque={banque?.[p.id]} avecBanque={avecBanque} />)}
            <div className={cn('border-t-2 border-surface-200 bg-surface-50/60 px-4 py-3 sm:px-5', avecBanque ? GRILLE_6 : GRILLE_5)}>
              <span className="block text-sm font-semibold text-surface-900">Total</span>
              <span className="mt-2 grid grid-cols-1 gap-y-1 md:mt-0 md:contents">
                <Case label="Sessions réalisées" nb={t.realisees} />
                <Case label="Facture non reçue" nb={t.aFacturer.nb} sous={t.aFacturer.total > 0 ? `${montantFr(t.aFacturer.total)}${t.aFacturerSansMontant ? ' et plus' : ''}` : undefined} />
                <Case label="À valider" nb={t.aValider.nb} montant={t.aValider.total} ton="text-amber-700" />
                <Case label="Validées, à payer" nb={t.validees.nb} montant={t.validees.total} ton="text-sky-700" />
                <Case label="Payées" nb={t.payees.nb} montant={t.payees.total} ton="text-emerald-700" />
                {avecBanque && <Case label="Versé en banque" nb={null} montant={verse} />}
              </span>
              <span className="hidden md:block" />
            </div>
          </>
        )}
        <div className="space-y-1.5 border-t border-surface-100 p-4 text-xs text-surface-500 sm:p-5">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-400" />
            <span>
              « Facture non reçue » : la session est terminée et aucune facture du formateur n’est enregistrée dans le CRM pour elle. Le montant est la rémunération prévue sur la session ; « et plus » signale des sessions dont elle n’est pas fixée.
            </span>
          </p>
          {avecBanque && (
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-400" />
              <span>
                « Versé en banque » : les virements Qonto dont le bénéficiaire porte le nom du formateur, {banqueNote || periode}. Un formateur payé au nom de sa société n’y figure pas. Ce montant ne dépend pas du statut des factures : une facture peut être réglée en banque sans être marquée payée ici.
              </span>
            </p>
          )}
        </div>
      </section>
    </>
  )
}
