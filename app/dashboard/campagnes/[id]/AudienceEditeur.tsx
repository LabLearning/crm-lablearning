'use client'

import { useMemo } from 'react'
import { Users, RefreshCw, MapPin, GraduationCap, Building2, Info } from '@/components/ui/icons'
import { Button, ChoixMultiples } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ETAPES, ORIGINES } from '@/lib/leads-entrants'
import { cleFormation, cleTexte, cleVille, NOMS_DEPARTEMENTS, PERIMETRES, PERIODES_FORMATION, type FiltresAudience, type PublicAudience } from '@/lib/campagnes/publics'
import type { OptionsAudience } from '@/lib/campagnes/audience'

export interface CalculAudience {
  total: number
  exemples: string[]
  exclus: { sansCoordonnee: number; opposition: number; doublon: number; particulier: number; ancien: number }
  parPublic: Record<PublicAudience, number>
  franchisesAtteints: number
}

/** Jamais au-delà de 3 ans : la durée de conservation des prospects annoncée sur le site */
const PERIODES_DEMANDE: { jours: number; label: string }[] = [
  { jours: 30, label: '30 derniers jours' }, { jours: 90, label: '3 derniers mois' }, { jours: 180, label: '6 derniers mois' },
  { jours: 365, label: '12 derniers mois' }, { jours: 1095, label: '3 dernières années' },
]

const bloc = 'rounded-xl border border-surface-200 p-4 space-y-3'
const sousTitre = 'text-xs font-semibold uppercase tracking-wider text-surface-500'
const aide = 'text-xs text-surface-500'
const puce = (actif: boolean) => cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
  actif ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300')
const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

/** Ce que retient le filtre de formation, dit simplement (il change avec le mode et la période) */
function aideFormations(f: FiltresAudience['formations']): string {
  const prospect = f.mode === 'jamais' ? 'Pour un prospect : il ne les a pas demandées.' : 'Pour un prospect : la formation demandée.'
  if (f.mode === 'jamais') return `Clients qui n’ont jamais suivi ces formations, ni prévues. ${prospect}`
  switch (f.periode) {
    case 'moins_6_mois': return `Clients dont une session de ces formations a commencé ces 6 derniers mois, ou commencera. ${prospect}`
    case 'moins_1_an': return `Clients dont une session de ces formations a commencé ces 12 derniers mois, ou commencera. ${prospect}`
    case 'plus_1_an': return `Clients formés il y a plus d’un an, sans session depuis ni prévue : à relancer. ${prospect}`
    case 'plus_2_ans': return `Clients formés il y a plus de 2 ans, sans session depuis ni prévue : à relancer. ${prospect}`
    default: return `Clients dont un apprenant a suivi, suit ou suivra l’une de ces formations. ${prospect}`
  }
}

/**
 * Audience d'une campagne : les publics (prospects, clients indépendants ou
 * franchisés, têtes de réseau, apporteurs), puis les filtres des prospects et
 * des clients (ville ou département, secteur, formation). Le décompte se met
 * à jour à chaque changement.
 */
export function AudienceEditeur({ audience, onChange, options, optionsIndisponibles, modifiable, calculable, figee, email, calcul, calculEnCours, erreurCalcul, onCalculer }: {
  audience: FiltresAudience
  onChange: (a: FiltresAudience) => void
  options: OptionsAudience
  optionsIndisponibles: boolean
  modifiable: boolean
  /** Le décompte se calcule (brouillon, ou campagne programmée qui le sera à son départ) */
  calculable: boolean
  /** Campagne partie : le nombre de destinataires figé à son lancement */
  figee: number | null
  email: boolean
  calcul: CalculAudience | null
  calculEnCours: boolean
  erreurCalcul: string | null
  onCalculer: () => void
}) {
  const maj = (p: Partial<FiltresAudience>) => onChange({ ...audience, ...p })
  const majProspects = (p: Partial<FiltresAudience['prospects']>) => maj({ prospects: { ...audience.prospects, ...p } })
  const majClients = (p: Partial<FiltresAudience['clients']>) => maj({ clients: { ...audience.clients, ...p } })
  const majReseaux = (p: Partial<FiltresAudience['reseaux']>) => maj({ reseaux: { ...audience.reseaux, ...p } })
  const majFormations = (p: Partial<FiltresAudience['formations']>) => maj({ formations: { ...audience.formations, ...p } })

  const optionsVilles = useMemo(() => options.villes.map((v) => ({ value: v.cle, label: v.libelle, detail: String(v.nombre) })), [options.villes])
  const optionsDepartements = useMemo(() => options.departements.map((d) => ({
    value: d.code, label: NOMS_DEPARTEMENTS[d.code] ? `${d.code} · ${NOMS_DEPARTEMENTS[d.code]}` : d.code, detail: String(d.nombre),
  })), [options.departements])
  const optionsSecteurs = useMemo(() => options.secteurs.map((s) => ({ value: s.cle, label: s.libelle, detail: String(s.nombre) })), [options.secteurs])
  const optionsFormations = useMemo(() => options.formations.map((f) => ({
    value: f.cle, label: f.libelle, detail: f.clients ? pluriel(f.clients, 'client', 'clients') : undefined,
  })), [options.formations])
  // Les formations se choisissent par intitulé (toutes ses versions) ; l'audience garde les identifiants
  const groupesChoisis = useMemo(() => {
    const ids = new Set(audience.formations.ids)
    return options.formations.filter((f) => f.ids.some((id) => ids.has(id))).map((f) => f.cle)
  }, [audience.formations.ids, options.formations])
  const choisirFormations = (cles: string[]) => {
    const voulues = new Set(cles)
    const proposees = new Set(options.formations.flatMap((f) => f.ids))
    const anciennes = audience.formations.ids.filter((id) => !proposees.has(id))
    majFormations({ ids: Array.from(new Set([...anciennes, ...options.formations.filter((f) => voulues.has(f.cle)).flatMap((f) => f.ids)])) })
  }

  const filtrable = audience.prospects.actif || audience.clients.actif
  const reseauxProposes = useMemo(() => new Set(options.reseaux.map((r) => r.id)), [options.reseaux])
  const reseauxRetires = (ids: string[]) => (optionsIndisponibles ? [] : ids.filter((id) => !reseauxProposes.has(id)))
  const formationsRetirees = useMemo(() => {
    if (optionsIndisponibles) return []
    const proposees = new Set(options.formations.flatMap((f) => f.ids))
    return audience.formations.ids.filter((id) => !proposees.has(id))
  }, [audience.formations.ids, options.formations, optionsIndisponibles])
  const puceRetiree = (libelle: string, retirer: () => void, cle: string) => (
    <button key={cle} type="button" onClick={retirer} className="rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700">
      {libelle} · retirer
    </button>
  )
  const ligne = (n: number, libelle: string) => <span className="whitespace-nowrap"><span className="font-semibold text-surface-900 tabular-nums">{n}</span> {libelle}</span>

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-500"><Users className="h-3.5 w-3.5" /> Audience</div>
      {optionsIndisponibles && (
        <p className="flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> Les villes, secteurs et formations n’ont pas pu être chargés : rechargez la page pour les choisir.
        </p>
      )}

      <fieldset disabled={!modifiable} className="min-w-0 space-y-3">
        <div className={sousTitre}>Qui écrire</div>

        {/* Prospects */}
        <div className={bloc}>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={audience.prospects.actif} onChange={(e) => majProspects({ actif: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-500" />
            <span>
              <span className="block text-sm font-medium text-surface-800">Prospects</span>
              <span className={aide}>Les demandes reçues (site, Meta, Google Ads, apporteurs), et les anciens leads si vous les cochez.</span>
            </span>
          </label>
          {audience.prospects.actif && (
            <div className="space-y-3 pl-6">
              <div>
                <div className="mb-1.5 text-xs text-surface-500">Origine (aucune choisie : toutes)</div>
                <div className="flex flex-wrap gap-1.5">
                  {ORIGINES.map((o) => <button key={o.id} type="button" onClick={() => majProspects({ origines: basculer(audience.prospects.origines, o.id) })} className={puce(audience.prospects.origines.includes(o.id))}>{o.court}</button>)}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs text-surface-500">Étape (aucune choisie : toutes)</div>
                <div className="flex flex-wrap gap-1.5">
                  {ETAPES.map((e) => <button key={e.id} type="button" onClick={() => majProspects({ etapes: basculer(audience.prospects.etapes, e.id) })} className={puce(audience.prospects.etapes.includes(e.id))}>{e.label}</button>)}
                </div>
              </div>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs text-surface-500">Demande reçue</span>
                <select value={audience.prospects.depuisJours} onChange={(e) => majProspects({ depuisJours: Number(e.target.value) })} className="input-base w-full">
                  {PERIODES_DEMANDE.map((p) => <option key={p.jours} value={p.jours}>{p.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Clients */}
        <div className={bloc}>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={audience.clients.actif} onChange={(e) => majClients({ actif: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-500" />
            <span>
              <span className="block text-sm font-medium text-surface-800">Clients</span>
              <span className={aide}>Les établissements clients : leurs contacts, ou l’e-mail et le mobile de leur fiche quand ils n’ont pas de contact.</span>
            </span>
          </label>
          {audience.clients.actif && (
            <div className="space-y-3 pl-6">
              <div className="inline-flex flex-wrap rounded-xl border border-surface-200 bg-surface-50 p-0.5" role="radiogroup" aria-label="Clients à écrire">
                {PERIMETRES.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={audience.clients.perimetre === p.id}
                    onClick={() => majClients({ perimetre: p.id, franchiseIds: p.id === 'franchises' ? audience.clients.franchiseIds : [] })}
                    className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      audience.clients.perimetre === p.id ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-800')}>
                    {p.label}
                  </button>
                ))}
              </div>
              {audience.clients.perimetre === 'franchises' && (
                <div>
                  <div className="mb-1.5 text-xs text-surface-500">Réseaux (aucun choisi : tous les réseaux)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.reseaux.map((r) => (
                      <button key={r.id} type="button" onClick={() => majClients({ franchiseIds: basculer(audience.clients.franchiseIds, r.id) })} className={puce(audience.clients.franchiseIds.includes(r.id))}>
                        {r.nom} <span className="tabular-nums text-surface-400">· {r.etablissements}</span>
                      </button>
                    ))}
                    {reseauxRetires(audience.clients.franchiseIds).map((id) => puceRetiree('Réseau retiré ou inactif', () => majClients({ franchiseIds: audience.clients.franchiseIds.filter((x) => x !== id) }), id))}
                    {!options.reseaux.length && <span className={aide}>Aucun réseau de franchise.</span>}
                  </div>
                </div>
              )}
              <label className="flex items-start gap-2 text-sm text-surface-700">
                <input type="checkbox" checked={audience.clients.unParEtablissement} onChange={(e) => majClients({ unParEtablissement: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-500" />
                <span>Un seul destinataire par établissement <span className="block text-xs text-surface-500">
                  {audience.clients.unParEtablissement
                    ? 'Le contact principal, sinon le référent formation, sinon le signataire, sinon un autre contact, sinon la fiche du client.'
                    : 'Décoché : tous les contacts de l’établissement. La fiche du client ne sert que si aucun contact n’est joignable.'}
                </span></span>
              </label>
            </div>
          )}
        </div>

        {/* Têtes de réseau */}
        <div className={bloc}>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={audience.reseaux.actif} onChange={(e) => majReseaux({ actif: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-500" />
            <span>
              <span className="block text-sm font-medium text-surface-800">Têtes de réseau</span>
              <span className={aide}>Les franchiseurs : le référent de chaque franchise et les comptes actifs du portail franchise.</span>
            </span>
          </label>
          {audience.reseaux.actif && (
            <div className="pl-6">
              <div className="mb-1.5 text-xs text-surface-500">Réseaux (aucun choisi : tous)</div>
              <div className="flex flex-wrap gap-1.5">
                {options.reseaux.map((r) => (
                  <button key={r.id} type="button" onClick={() => majReseaux({ franchiseIds: basculer(audience.reseaux.franchiseIds, r.id) })} className={puce(audience.reseaux.franchiseIds.includes(r.id))}>
                    {r.nom} <span className="tabular-nums text-surface-400">· {pluriel(r.comptes, 'compte', 'comptes')}</span>
                  </button>
                ))}
                {reseauxRetires(audience.reseaux.franchiseIds).map((id) => puceRetiree('Réseau retiré ou inactif', () => majReseaux({ franchiseIds: audience.reseaux.franchiseIds.filter((x) => x !== id) }), id))}
                {!options.reseaux.length && <span className={aide}>Aucun réseau de franchise.</span>}
              </div>
            </div>
          )}
        </div>

        {/* Apporteurs */}
        <div className={bloc}>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={audience.apporteurs.actif} onChange={(e) => maj({ apporteurs: { actif: e.target.checked } })} className="mt-0.5 h-4 w-4 accent-brand-500" />
            <span>
              <span className="block text-sm font-medium text-surface-800">Apporteurs d’affaires</span>
              <span className={aide}>Les apporteurs actifs.</span>
            </span>
          </label>
        </div>

        {/* Filtres des prospects et des clients */}
        <div className={cn('space-y-4 pt-2', !filtrable && 'opacity-60')}>
          <div className={sousTitre}>Affiner <span className="font-normal normal-case tracking-normal text-surface-400">(prospects et clients)</span></div>
          {!filtrable && <p className={aide}>Cochez les prospects ou les clients pour filtrer par lieu, secteur ou formation.</p>}

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-surface-800"><MapPin className="h-4 w-4 text-surface-400" /> Lieu</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Pas de <label> autour : un clic sur l'intitulé activerait le premier bouton de puce (le retrait) */}
              <div>
                <span className="mb-1 block text-xs text-surface-500">Villes</span>
                <ChoixMultiples options={optionsVilles} valeurs={audience.villes} onChange={(villes) => maj({ villes })} placeholder="Toutes les villes" label="Villes" cleRecherche={cleVille} disabled={!modifiable || !filtrable} />
              </div>
              <div>
                <span className="mb-1 block text-xs text-surface-500">Départements</span>
                <ChoixMultiples options={optionsDepartements} valeurs={audience.departements} onChange={(departements) => maj({ departements })} placeholder="Tous les départements" label="Départements" disabled={!modifiable || !filtrable} />
              </div>
            </div>
            {(audience.villes.length > 0 || audience.departements.length > 0) && <p className={aide}>Dans l’une des villes ou l’un des départements choisis. Une fiche sans ville ni code postal n’est pas retenue.</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-surface-800"><Building2 className="h-4 w-4 text-surface-400" /> Secteur d’activité</div>
            <ChoixMultiples options={optionsSecteurs} valeurs={audience.secteurs} onChange={(secteurs) => maj({ secteurs })} placeholder="Tous les secteurs" label="Secteurs d’activité" cleRecherche={cleTexte} disabled={!modifiable || !filtrable} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-surface-800"><GraduationCap className="h-4 w-4 text-surface-400" /> Formations</div>
            <ChoixMultiples options={optionsFormations} valeurs={groupesChoisis} onChange={choisirFormations} placeholder="Toutes, sans filtre" label="Formations" cleRecherche={cleFormation} disabled={!modifiable || !filtrable} />
            {formationsRetirees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {puceRetiree(formationsRetirees.length > 1 ? `${formationsRetirees.length} formations retirées du catalogue` : 'Formation retirée du catalogue',
                  () => majFormations({ ids: audience.formations.ids.filter((id) => !formationsRetirees.includes(id)) }), 'formations-retirees')}
              </div>
            )}
            {audience.formations.ids.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="inline-flex rounded-xl border border-surface-200 bg-surface-50 p-0.5" role="radiogroup" aria-label="Formations suivies ou non">
                  {([['suivie', 'Déjà formés'], ['jamais', 'Jamais formés']] as const).map(([id, libelle]) => (
                    <button key={id} type="button" role="radio" aria-checked={audience.formations.mode === id} onClick={() => majFormations({ mode: id })}
                      className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        audience.formations.mode === id ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-800')}>
                      {libelle}
                    </button>
                  ))}
                </div>
                {audience.formations.mode === 'suivie' && (
                  <select value={audience.formations.periode} onChange={(e) => majFormations({ periode: e.target.value as FiltresAudience['formations']['periode'] })} className="input-base sm:w-auto" aria-label="Quand">
                    {PERIODES_FORMATION.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                )}
              </div>
            )}
            {audience.formations.ids.length > 0 && (
              <p className={aide}>{aideFormations(audience.formations)} Les POEI ne comptent pas.</p>
            )}
          </div>
        </div>
      </fieldset>

      {/* Décompte */}
      <div className="space-y-2 border-t border-surface-100 pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {figee !== null ? (
            <span className="text-sm text-surface-700">
              <span className="text-lg font-heading font-bold text-surface-900 tabular-nums">{figee}</span> destinataire{figee > 1 ? 's' : ''} retenu{figee > 1 ? 's' : ''} au lancement
            </span>
          ) : calcul && !calculEnCours ? (
            <span className="text-sm text-surface-700">
              <span className="text-lg font-heading font-bold text-surface-900 tabular-nums">{calcul.total}</span> destinataire{calcul.total > 1 ? 's' : ''}
              {!modifiable && <span className="text-surface-500"> aujourd’hui (recalculé au départ)</span>}
            </span>
          ) : <span className="text-sm text-surface-500">{calculEnCours ? 'Calcul en cours…' : 'Audience pas encore calculée'}</span>}
          {calculable && (
            <Button size="sm" variant="secondary" onClick={onCalculer} isLoading={calculEnCours} icon={<RefreshCw className="h-3.5 w-3.5" />}>Recalculer</Button>
          )}
        </div>
        {erreurCalcul && <p className="text-sm text-danger-600">{erreurCalcul}</p>}
        {calcul && !calculEnCours && figee === null && (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-600">
              {audience.prospects.actif && ligne(calcul.parPublic.prospects, 'prospects')}
              {audience.clients.actif && <span>{ligne(calcul.parPublic.clients, 'chez les clients')}{calcul.franchisesAtteints > 0 && audience.clients.perimetre !== 'independants' ? <span className="text-surface-400"> (dont {pluriel(calcul.franchisesAtteints, 'franchisé', 'franchisés')})</span> : null}</span>}
              {audience.reseaux.actif && ligne(calcul.parPublic.reseaux, 'en tête de réseau')}
              {audience.apporteurs.actif && ligne(calcul.parPublic.apporteurs, calcul.parPublic.apporteurs > 1 ? 'apporteurs' : 'apporteur')}
            </div>
            <p className="text-xs text-surface-500">
              Écartés : {calcul.exclus.sansCoordonnee} sans {email ? 'e-mail' : 'mobile'}, {pluriel(calcul.exclus.opposition, 'opposé', 'opposés')} (désinscription, STOP, rebond, case du site),
              {' '}{calcul.exclus.doublon} en double, {pluriel(calcul.exclus.particulier, 'particulier ou sans établissement', 'particuliers ou sans établissement')},
              {' '}{pluriel(calcul.exclus.ancien, 'client sans relation depuis 3 ans', 'clients sans relation depuis 3 ans')}.
            </p>
            {calcul.exemples.length > 0 && <p className="text-xs text-surface-500">Par exemple : {calcul.exemples.join(' ; ')}</p>}
          </>
        )}
        <p className="text-xs text-surface-400">
          Professionnels seulement : les particuliers ne sont jamais écrits. Les personnes opposées (lien, STOP, rebond, case du site) sont écartées, au lancement comme à l’envoi.
          Les clients et les anciens leads (salons, phoning, demandes d’avant le 24/10/2026) n’ont pas été prévenus de ces envois quand leurs coordonnées ont été prises :
          commencez par un message d’information, sans offre.
        </p>
      </div>
    </div>
  )
}
