'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button, Input, Select, Modal, useToast, PaginationBar } from '@/components/ui'
import { RotateCcw, ExternalLink, ChevronDown, ChevronUp, Search, Filter, X, User } from '@/components/ui/icons'
import { formatDate } from '@/lib/utils'
import {
  TABLES_ACTIVITE, OPERATIONS_ACTIVITE, CHAMPS_CLES, libelleChamp, formatValeur, formatValeurLisible, lienActivite, nomActeur,
  phraseActivite, phraseEvenement, type Activite, type Libelles,
} from '@/lib/activite'
import { annulerActiviteAction } from './actions'

export interface Utilisateur { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; role: string }
export interface Evenement {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  acteur?: { first_name: string | null; last_name: string | null; avatar_url: string | null; email?: string | null } | null
}

interface Filtres { acteur: string; table: string; operation: string; du: string; au: string; q: string }

interface Props {
  vue: 'modifications' | 'evenements'
  activites: Activite[]
  evenements: Evenement[]
  total: number
  page: number
  parPage: number
  utilisateurs: Utilisateur[]
  filtres: Filtres
  peutAnnuler: boolean
  journalAbsent: boolean
  erreur?: string | null
  libelles: Libelles
}

/** Libellés des événements applicatifs (audit_logs), pour lecture humaine. */
const EVENEMENTS: Record<string, string> = {
  create: 'a créé', update: 'a modifié', delete: 'a supprimé', send_email: 'a envoyé un mail', send: 'a envoyé',
  login: "s'est connecté", export: 'a exporté', create_avoir: 'a créé un avoir', reveal_opco_secret: 'a consulté le mot de passe OPCO',
  save_opco_secret: 'a enregistré le mot de passe OPCO', delete_opco_secret: 'a effacé le mot de passe OPCO',
  rekey_opco_secret: 'a rechiffré le mot de passe OPCO', annulation_activite: 'a annulé une activité',
  envoi_positionnement: 'a envoyé un questionnaire de positionnement', reveal: 'a consulté', generate_pdf: 'a généré un document',
  impersonate: "s'est connecté en tant que", invite: 'a invité',
}

/** Fuseau métier : le journal s'affiche en heure de Paris, côté serveur (UTC) comme dans le navigateur. */
const FUSEAU = 'Europe/Paris'
const heure = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU })
/** Jour civil parisien AAAA-MM-JJ (le format en-CA donne nativement cet ordre). */
const jourCle = (d: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d))
const jourLibelle = (cle: string) => {
  const aujourdhui = jourCle(new Date())
  const hier = jourCle(new Date(Date.now() - 86_400_000))
  if (cle === aujourdhui) return "Aujourd'hui"
  if (cle === hier) return 'Hier'
  return new Date(`${cle}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSEAU })
}

function Initiales({ nom, url }: { nom: string; url?: string | null }) {
  if (url) return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
  const ini = nom === 'Système' ? 'SY' : nom.split(' ').map((m) => m[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <span className={`h-8 w-8 rounded-full shrink-0 inline-flex items-center justify-center text-[11px] font-bold ${nom === 'Système' ? 'bg-surface-200 text-surface-600' : 'bg-brand-100 text-brand-700'}`}>
      {ini || <User className="h-4 w-4" />}
    </span>
  )
}

export function ActiviteClient({ vue, activites, evenements, total, page, parPage, utilisateurs, filtres, peutAnnuler, journalAbsent, erreur = null, libelles }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [f, setF] = useState<Filtres>(filtres)
  const [filtresOuverts, setFiltresOuverts] = useState(!!(filtres.table || filtres.operation || filtres.du || filtres.au))
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [aAnnuler, setAAnnuler] = useState<Activite | null>(null)
  const [pending, startTransition] = useTransition()
  const [annulation, setAnnulation] = useState(false)

  function appliquer(patch: Partial<Filtres> & { vue?: string }) {
    const suivant = { ...f, ...patch }
    setF(suivant)
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(suivant)) if (v && k !== 'vue') params.set(k, v)
    const v = patch.vue ?? vue
    if (v === 'evenements') params.set('vue', 'evenements')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  async function confirmerAnnulation() {
    if (!aAnnuler) return
    setAnnulation(true)
    const r = await annulerActiviteAction(aAnnuler.id)
    setAnnulation(false)
    if (r.success) {
      toast(r.data?.avertissement ? 'warning' : 'success', r.data?.avertissement ? `Annulée. ${r.data.avertissement}` : 'Activité annulée, la fiche est revenue à son état précédent')
      setAAnnuler(null); router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  const nbFiltres = [f.table, f.operation, f.du, f.au].filter(Boolean).length
  const lignes: Array<{ cle: string; date: string; contenu: React.ReactNode }> = vue === 'modifications'
    ? activites.map((a) => ({ cle: a.id, date: a.created_at, contenu: <LigneActivite a={a} libelles={libelles} ouvert={ouvert === a.id} basculer={() => setOuvert(ouvert === a.id ? null : a.id)} peutAnnuler={peutAnnuler} demanderAnnulation={() => setAAnnuler(a)} /> }))
    : evenements.map((e) => ({ cle: e.id, date: e.created_at, contenu: <LigneEvenement e={e} libelles={libelles} /> }))

  // Regroupement par jour
  const groupes: Array<{ jour: string; libelle: string; lignes: typeof lignes }> = []
  for (const l of lignes) {
    const j = jourCle(l.date)
    const g = groupes[groupes.length - 1]
    if (g && g.jour === j) g.lignes.push(l)
    else groupes.push({ jour: j, libelle: jourLibelle(j), lignes: [l] })
  }

  return (
    <div className="space-y-4">
      {/* Vue + acteur + recherche */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {([['modifications', 'Modifications'], ['evenements', 'Événements']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => appliquer({ vue: v })}
                className={`px-3 min-h-[36px] rounded-lg text-sm font-medium transition-colors ${vue === v ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-64">
            <Select id="acteur" aria-label="Utilisateur" value={f.acteur} onChange={(e) => appliquer({ acteur: e.target.value })}
              options={[{ value: '', label: 'Tous les utilisateurs' }, { value: 'systeme', label: 'Système (synchronisations, scripts)' },
                ...utilisateurs.map((u) => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.id }))]} />
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <label htmlFor="recherche-activite" className="sr-only">{vue === 'modifications' ? 'Rechercher une fiche' : 'Rechercher une action'}</label>
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input id="recherche-activite" type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') appliquer({ q: f.q.trim() }) }}
              placeholder={vue === 'modifications' ? 'Rechercher une fiche (numéro, nom, intitulé)' : 'Rechercher une action'}
              className="input-base pl-9" />
          </div>
          <button type="button" onClick={() => setFiltresOuverts(!filtresOuverts)} aria-expanded={filtresOuverts}
            className="btn-secondary inline-flex items-center gap-1.5 !py-2 !px-3 text-sm">
            <Filter className="h-4 w-4" /> Filtres{nbFiltres ? ` (${nbFiltres})` : ''}
          </button>
        </div>
        {filtresOuverts && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-surface-100">
            <Select id="table" label={vue === 'modifications' ? 'Type de fiche' : "Type d'entité"} value={f.table} onChange={(e) => appliquer({ table: e.target.value })}
              options={[{ value: '', label: 'Toutes' }, ...Object.entries(TABLES_ACTIVITE).map(([k, v]) => ({ value: k, label: v.pluriel }))]} />
            {vue === 'modifications' && (
              <Select id="operation" label="Opération" value={f.operation} onChange={(e) => appliquer({ operation: e.target.value })}
                options={[{ value: '', label: 'Toutes' }, ...Object.entries(OPERATIONS_ACTIVITE).map(([k, v]) => ({ value: k, label: v.libelle }))]} />
            )}
            <Input id="du" type="date" label="Du" value={f.du} onChange={(e) => appliquer({ du: e.target.value })} />
            <Input id="au" type="date" label="Au" value={f.au} onChange={(e) => appliquer({ au: e.target.value })} />
            {(nbFiltres > 0 || f.q || f.acteur) && (
              <button type="button" onClick={() => appliquer({ acteur: '', table: '', operation: '', du: '', au: '', q: '' })}
                className="sm:col-span-4 justify-self-start text-xs font-medium text-surface-500 hover:text-surface-800 inline-flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> Effacer les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {journalAbsent ? (
        <div className="card p-6 text-sm text-surface-600">
          Le journal n&apos;est pas encore activé sur cette base : appliquez la migration <span className="font-mono">155_journal_activite.sql</span>.
          Les événements applicatifs restent consultables dans l&apos;onglet Événements.
        </div>
      ) : erreur ? (
        <div className="card p-6 text-sm text-danger-700 bg-danger-50 border-danger-100">{erreur}</div>
      ) : lignes.length === 0 ? (
        <div className="card p-10 text-center text-sm text-surface-500">Aucune activité pour ces critères.</div>
      ) : (
        <div className={`space-y-5 ${pending ? 'opacity-60' : ''}`}>
          <p className="text-xs text-surface-500">{total.toLocaleString('fr-FR')} {vue === 'modifications' ? 'modification' : 'événement'}{total > 1 ? 's' : ''}</p>
          {groupes.map((g) => (
            <section key={g.jour}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2 px-1">{g.libelle}</h2>
              <div className="card divide-y divide-surface-100">
                {g.lignes.map((l) => <div key={l.cle}>{l.contenu}</div>)}
              </div>
            </section>
          ))}
          <PaginationBar total={total} page={page} perPage={parPage} />
        </div>
      )}

      <Modal isOpen={!!aAnnuler} onClose={() => setAAnnuler(null)} size="md" title="Annuler cette activité ?"
        description={aAnnuler ? (
          aAnnuler.operation === 'update' ? `Les champs modifiés (${aAnnuler.champs.map(libelleChamp).join(', ')}) reprendront leur valeur précédente.`
            : aAnnuler.operation === 'insert' ? 'La fiche créée sera supprimée.'
              : 'La fiche supprimée sera recréée telle qu’elle était, avec les lignes liées parties avec elle. Les secrets et signatures ne sont pas restaurés.'
        ) : undefined}>
        {aAnnuler && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-50 border border-surface-200 p-3 text-sm text-surface-700">
              <span className="font-semibold text-surface-900">{nomActeur(aAnnuler)}</span> {phraseActivite(aAnnuler).verbe} {phraseActivite(aAnnuler).objet}{' '}
              <span className="font-semibold text-surface-900">{aAnnuler.libelle}</span> le {formatDate(aAnnuler.created_at)} à {heure(aAnnuler.created_at)}.
            </div>
            <p className="text-xs text-surface-500">L&apos;annulation est elle-même inscrite au journal, à votre nom.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAAnnuler(null)}>Garder</Button>
              <Button variant="danger" onClick={confirmerAnnulation} isLoading={annulation} icon={<RotateCcw className="h-4 w-4" />}>Annuler l&apos;activité</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function LigneActivite({ a, libelles, ouvert, basculer, peutAnnuler, demanderAnnulation }: {
  a: Activite; libelles: Libelles; ouvert: boolean; basculer: () => void; peutAnnuler: boolean; demanderAnnulation: () => void
}) {
  const op = OPERATIONS_ACTIVITE[a.operation]
  const ph = phraseActivite(a)
  const lien = lienActivite(a)
  const nom = nomActeur(a)
  const impersonateur = a.impersonateur ? `${a.impersonateur.first_name || ''} ${a.impersonateur.last_name || ''}`.trim() : null
  const ref = (a.apres || a.avant || {}) as Record<string, unknown>
  const technique = ['id', 'organization_id', 'created_at', 'updated_at', 'created_by']
  // Ce qui est montré tout de suite : les champs modifiés, ou les champs clés d'une fiche créée / supprimée
  const cles = a.operation === 'update'
    ? a.champs
    : (CHAMPS_CLES[a.table_name] || Object.keys(ref).filter((k) => !technique.includes(k)).slice(0, 8)).filter((k) => ref[k] !== null && ref[k] !== undefined && ref[k] !== '')
  const toutes = Object.keys(ref).filter((k) => !technique.includes(k) && !cles.includes(k))
  return (
    <div className={`px-3 sm:px-4 py-3 ${a.annulee_le ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="pt-0.5"><Initiales nom={nom} url={a.acteur?.avatar_url} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-surface-800 leading-snug">
            <span className="font-semibold text-surface-900">{nom}</span>
            {impersonateur && <span className="text-surface-400"> (par {impersonateur})</span>}
            {' '}{ph.verbe} {ph.objet}{' '}
            {lien ? (
              <Link href={lien} className="font-semibold text-brand-600 hover:underline break-words">{ph.libelle || 'sans nom'}</Link>
            ) : (
              <span className="font-semibold text-surface-900 break-words">{ph.libelle || 'sans nom'}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
            <span className="tabular-nums">{heure(a.created_at)}</span>
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-semibold ${op.classe}`}>{op.libelle}</span>
            {a.annulee_le && <span className="inline-flex items-center rounded-md border border-surface-200 bg-surface-100 px-1.5 py-0.5 font-semibold text-surface-600">Annulée le {formatDate(a.annulee_le)}</span>}
            {lien && (
              <Link href={lien} className="inline-flex items-center gap-1 text-surface-500 hover:text-surface-800 min-h-[28px]">
                <ExternalLink className="h-3.5 w-3.5" /> Ouvrir la fiche
              </Link>
            )}
          </div>

          {/* Le détail de l'action, toujours visible */}
          {cles.length > 0 && (
            <dl className="mt-2 rounded-xl border border-surface-200 bg-surface-50/60 px-3 py-2 text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {cles.map((c) => (
                <div key={c} className="flex gap-2 min-w-0">
                  <dt className="text-surface-500 shrink-0">{libelleChamp(c)}</dt>
                  <dd className="text-surface-800 break-words min-w-0">
                    {a.operation === 'update' ? (
                      <><span className="line-through text-surface-400">{formatValeurLisible(c, a.avant?.[c], libelles)}</span>
                        <span className="mx-1 text-surface-300">→</span>
                        <span className="font-medium text-surface-900">{formatValeurLisible(c, a.apres?.[c], libelles)}</span></>
                    ) : formatValeurLisible(c, ref[c], libelles)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {toutes.length > 0 && (
            <div className="mt-1.5">
              <button type="button" onClick={basculer} aria-expanded={ouvert} aria-controls={`detail-${a.id}`} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline min-h-[28px]">
                {ouvert ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {ouvert ? 'Masquer les autres champs' : `Voir les ${toutes.length} autres champs`}
              </button>
              {ouvert && (
                <dl id={`detail-${a.id}`} className="mt-1 rounded-xl border border-surface-200 px-3 py-2 text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  {toutes.map((c) => (
                    <div key={c} className="flex gap-2 min-w-0">
                      <dt className="text-surface-500 shrink-0">{libelleChamp(c)}</dt>
                      <dd className="text-surface-800 break-words min-w-0">{formatValeurLisible(c, ref[c], libelles)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
        {peutAnnuler && !a.annulee_le && a.record_id && (
          <button type="button" onClick={demanderAnnulation} title="Annuler cette activité"
            className="shrink-0 h-10 w-10 sm:h-9 sm:w-auto sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-200 text-surface-600 hover:text-danger-700 hover:border-danger-200 hover:bg-danger-50 text-xs font-medium">
            <RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">Annuler</span>
          </button>
        )}
      </div>
    </div>
  )
}

function LigneEvenement({ e, libelles }: { e: Evenement; libelles: Libelles }) {
  const nom = e.user_id ? (`${e.acteur?.first_name || ''} ${e.acteur?.last_name || ''}`.trim() || e.acteur?.email || 'Utilisateur supprimé') : 'Système'
  const ph = phraseEvenement(e.action, e.entity_type, e.entity_id, e.details, libelles)
  const lien = lienActivite({ table_name: e.entity_type === 'session' ? 'sessions' : e.entity_type === 'client' ? 'clients' : e.entity_type === 'poei' ? 'poei' : e.entity_type === 'apprenant' ? 'apprenants' : e.entity_type === 'formateur' ? 'formateurs' : e.entity_type === 'franchise' ? 'franchises' : e.entity_type, record_id: e.entity_id, avant: null, apres: (e.details || null) as any })
  return (
    <div className="px-3 sm:px-4 py-3 flex items-start gap-3">
      <div className="pt-0.5"><Initiales nom={nom} url={e.acteur?.avatar_url} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-surface-800 leading-snug">
          <span className="font-semibold text-surface-900">{nom}</span> {ph.verbe}
          {ph.objet && <> {lien && e.entity_id ? <Link href={lien} className="font-semibold text-brand-600 hover:underline break-words">{ph.objet}</Link> : <span className="font-semibold text-surface-900 break-words">{ph.objet}</span>}</>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
          <span className="tabular-nums">{heure(e.created_at)}</span>
          {ph.precisions.map((p, i) => <span key={i}>{p}</span>)}
          {lien && e.entity_id && (
            <Link href={lien} className="inline-flex items-center gap-1 text-surface-500 hover:text-surface-800 min-h-[28px]">
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir la fiche
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
