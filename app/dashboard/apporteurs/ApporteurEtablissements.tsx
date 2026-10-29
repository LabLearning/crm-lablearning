'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Handshake, Link2, Unlink, Search, Check, Loader2, AlertTriangle, Info, X } from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ApercuRattachement } from '@/lib/commission-apporteur'
import {
  chercherEtablissementsApporteurAction, apercuRattachementApporteurAction, rattacherEtablissementsApporteurAction, detacherEtablissementApporteurAction,
} from './actions'

const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export interface EtablissementApporte { id: string; nom: string; detail: string; commission: number }
interface Resultat { id: string; nom: string; detail: string; dejaRattache: boolean; autreApporteur: string | null }

interface Props {
  apporteurId: string
  apporteurNom: string
  actif: boolean
  etablissements: EtablissementApporte[]
  peutGerer: boolean
}

/**
 * Établissements apportés, sur la fiche administrateur d'un apporteur : la
 * liste, le rattachement direct (recherche, plusieurs à la fois) et le
 * retrait, sans passer par la fiche de chaque client.
 */
export function ApporteurEtablissements({ apporteurId, apporteurNom, actif, etablissements, peutGerer }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [ouvert, setOuvert] = useState(false)
  const [aRetirer, setARetirer] = useState<EtablissementApporte | null>(null)
  const [pending, start] = useTransition()

  function retirer() {
    const e = aRetirer
    if (!e) return
    start(async () => {
      const r = await detacherEtablissementApporteurAction(apporteurId, e.id)
      if (r.success) {
        toast('success', `${e.nom} n’est plus rattaché à ${apporteurNom}`)
        setARetirer(null)
        router.refresh()
      } else toast('error', r.error || 'Retrait impossible')
    })
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2 flex-wrap">
        <Handshake className="h-4 w-4 text-brand-500" />
        <span className="flex-1 text-xs font-semibold text-surface-500 uppercase tracking-wider">Établissements apportés ({etablissements.length})</span>
        {peutGerer && etablissements.length > 0 && (
          <Button size="sm" variant="secondary" icon={<Link2 className="h-3.5 w-3.5" />} onClick={() => setOuvert(true)}>
            Rattacher un établissement
          </Button>
        )}
      </div>

      {etablissements.length === 0 ? (
        <div className="text-center py-8 px-6 space-y-3">
          <p className="text-sm text-surface-400">
            {peutGerer
              ? 'Aucun établissement rattaché pour l’instant.'
              : 'Aucun établissement rattaché. Choisissez cet apporteur dans le formulaire d’un client (bouton Modifier de la fiche client).'}
          </p>
          {peutGerer && (
            <Button size="sm" icon={<Link2 className="h-3.5 w-3.5" />} onClick={() => setOuvert(true)}>Rattacher un établissement</Button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-surface-100">
          {etablissements.map((c) => (
            <li key={c.id} className="flex items-center gap-1 pr-2 hover:bg-surface-50 transition-colors">
              <Link href={`/dashboard/clients/${c.id}`} className="flex flex-1 min-w-0 items-center gap-3 px-4 py-3">
                <Building2 className="h-4 w-4 text-surface-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{c.nom}</div>
                  {c.detail && <div className="text-xs text-surface-500 truncate">{c.detail}</div>}
                </div>
                {c.commission > 0 && <span className="text-sm font-semibold text-surface-700 tabular-nums">{eur(c.commission)}</span>}
              </Link>
              {peutGerer && (
                <button
                  type="button" onClick={() => setARetirer(c)} aria-label={`Retirer ${c.nom} de cet apporteur`} title="Retirer de cet apporteur"
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                >
                  <Unlink className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {ouvert && (
        <RattacherEtablissements
          apporteurId={apporteurId} apporteurNom={apporteurNom} actif={actif}
          onClose={() => setOuvert(false)}
          onRattache={() => { setOuvert(false); router.refresh() }}
        />
      )}

      <Modal isOpen={!!aRetirer} onClose={() => setARetirer(null)} title="Retirer cet établissement ?" size="sm">
        {aRetirer && (
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              <span className="font-medium text-surface-900">{aRetirer.nom}</span> ne sera plus rattaché à {apporteurNom}.
              Ses commissions en attente disparaissent ; celles déjà validées ou versées restent acquises.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setARetirer(null)} disabled={pending}>Annuler</Button>
              <Button variant="danger" onClick={retirer} isLoading={pending} icon={<Unlink className="h-4 w-4" />}>Retirer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/** Recherche d'établissements et choix multiple, puis rattachement en une fois. */
function RattacherEtablissements({ apporteurId, apporteurNom, actif, onClose, onRattache }: {
  apporteurId: string; apporteurNom: string; actif: boolean; onClose: () => void; onRattache: () => void
}) {
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [resultats, setResultats] = useState<Resultat[]>([])
  const [tronque, setTronque] = useState(false)
  const [cherche, setCherche] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [choisis, setChoisis] = useState<Map<string, Resultat>>(new Map())
  const [pending, start] = useTransition()
  // Seule la réponse à la dernière saisie compte (les plus lentes arrivent parfois après)
  const tour = useRef(0)

  useEffect(() => {
    const terme = q.trim()
    const n = ++tour.current
    if (terme.length < 2) { setResultats([]); setTronque(false); setCherche(false); setErreur(null); return }
    setCherche(true)
    const minuteur = setTimeout(async () => {
      const r = await chercherEtablissementsApporteurAction(apporteurId, terme)
      if (n !== tour.current) return
      setCherche(false)
      const d = (r.data || {}) as { resultats?: Resultat[]; tronque?: boolean }
      if (r.success) { setResultats(d.resultats || []); setTronque(!!d.tronque); setErreur(null) }
      else { setResultats([]); setErreur(r.error || 'Recherche impossible') }
    }, 250)
    return () => clearTimeout(minuteur)
  }, [q, apporteurId])

  function basculer(r: Resultat) {
    if (r.dejaRattache) return
    setChoisis((avant) => {
      const m = new Map(avant)
      if (m.has(r.id)) m.delete(r.id); else m.set(r.id, r)
      return m
    })
  }

  const liste = Array.from(choisis.values())
  const changent = liste.filter((r) => r.autreApporteur)
  const cle = liste.map((r) => r.id).sort().join(',')

  // Ce que le rattachement déclenchera sur les formations déjà terminées, recalculé à chaque choix
  const [apercu, setApercu] = useState<ApercuRattachement | null>(null)
  const [calcul, setCalcul] = useState(false)
  const tourApercu = useRef(0)
  useEffect(() => {
    const n = ++tourApercu.current
    if (!cle) { setApercu(null); setCalcul(false); return }
    setCalcul(true)
    const minuteur = setTimeout(async () => {
      const r = await apercuRattachementApporteurAction(apporteurId, cle.split(','))
      if (n !== tourApercu.current) return
      setCalcul(false)
      setApercu(r.success ? (r.data as ApercuRattachement) : null)
    }, 300)
    return () => clearTimeout(minuteur)
  }, [cle, apporteurId])

  function rattacher() {
    if (!liste.length) return
    start(async () => {
      const r = await rattacherEtablissementsApporteurAction(apporteurId, liste.map((x) => x.id))
      if (!r.success) { toast('error', r.error || 'Rattachement impossible'); return }
      const d = (r.data || {}) as { rattaches?: number; commissions?: number }
      const n = Number(d.rattaches || 0)
      const c = Number(d.commissions || 0)
      toast('success', n
        ? `${pluriel(n, 'établissement')} rattaché${n > 1 ? 's' : ''} à ${apporteurNom}${c ? ` · ${pluriel(c, 'commission')} calculée${c > 1 ? 's' : ''}` : ''}`
        : 'Ces établissements étaient déjà rattachés')
      onRattache()
    })
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title="Rattacher des établissements"
      description={`Les formations terminées chez eux pendant son contrat donnent une commission à ${apporteurNom}, hors POEI.`}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, enseigne, ville, code postal ou SIRET"
            aria-label="Rechercher un établissement"
            className="input-base w-full pl-9 pr-9 text-base sm:text-sm"
          />
          {cherche && <Loader2 className="h-4 w-4 text-surface-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>

        {!actif && (
          <p className="flex items-start gap-2 text-xs text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Cet apporteur est inactif : aucune commission n’est calculée tant qu’il n’est pas réactivé.
          </p>
        )}

        <div className="rounded-xl border border-surface-200 max-h-[45vh] sm:max-h-80 overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="text-sm text-surface-400 text-center px-4 py-6">Tapez au moins deux caractères pour chercher un établissement.</p>
          ) : erreur ? (
            <p className="text-sm text-danger-600 text-center px-4 py-6">{erreur}</p>
          ) : !cherche && resultats.length === 0 ? (
            <p className="text-sm text-surface-400 text-center px-4 py-6">Aucun établissement ne correspond à « {q.trim()} ».</p>
          ) : (
            <ul className="divide-y divide-surface-100">
              {resultats.map((r) => {
                const coche = choisis.has(r.id)
                return (
                  <li key={r.id}>
                    <button
                      type="button" onClick={() => basculer(r)} disabled={r.dejaRattache} aria-pressed={coche}
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
                        r.dejaRattache ? 'cursor-default opacity-60' : 'hover:bg-surface-50',
                        coche && 'bg-brand-50/60',
                      )}
                    >
                      <span className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center',
                        coche || r.dejaRattache ? 'bg-brand-500 border-brand-500 text-white' : 'border-surface-300 bg-white',
                      )}>
                        {(coche || r.dejaRattache) && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-surface-900 truncate">{r.nom}</span>
                        {r.detail && <span className="block text-xs text-surface-500 truncate">{r.detail}</span>}
                      </span>
                      {r.dejaRattache ? (
                        <span className="shrink-0 text-2xs font-medium text-brand-700 bg-brand-50 rounded-full px-2 py-0.5">Déjà rattaché</span>
                      ) : r.autreApporteur ? (
                        <span className="shrink-0 max-w-[40%] truncate text-2xs font-medium text-warning-700 bg-warning-50 rounded-full px-2 py-0.5">Chez {r.autreApporteur}</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {tronque && !erreur && (
            <p className="text-2xs text-surface-400 text-center px-4 py-2 border-t border-surface-100">Trente premiers résultats : précisez la recherche pour voir les autres.</p>
          )}
        </div>

        {liste.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {liste.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1 max-w-full rounded-full bg-brand-50 text-brand-700 text-xs font-medium pl-2.5 pr-1 py-0.5">
                  <span className="truncate">{r.nom}</span>
                  <button type="button" onClick={() => basculer(r)} aria-label={`Retirer ${r.nom} du choix`}
                    className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center hover:bg-brand-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="flex items-start gap-2 text-xs text-surface-600 bg-surface-50 rounded-lg px-3 py-2" aria-live="polite">
              {calcul || !apercu ? (
                <><Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin text-surface-400" />Calcul des commissions sur les formations déjà terminées…</>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-surface-400" />
                  <span>
                    {apercu.formations === 0
                      ? 'Aucune formation déjà terminée chez eux pendant le contrat : les commissions viendront avec les prochaines.'
                      : `${pluriel(apercu.formations, 'formation')} déjà terminée${apercu.formations > 1 ? 's' : ''} chez eux pendant le contrat ${apercu.formations > 1 ? 'donneront' : 'donnera'} ${eur(apercu.montant)} de commission${apercu.aVerser ? `, dont ${apercu.aVerser} déjà réglée${apercu.aVerser > 1 ? 's' : ''} : à verser tout de suite` : ''}.`}
                    {apercu.sansMontant > 0 && ` ${apercu.sansMontant} autre${apercu.sansMontant > 1 ? 's' : ''} sans montant calculable pour l’instant.`}
                  </span>
                </>
              )}
            </p>
            {changent.length > 0 && (
              <p className="flex items-start gap-2 text-xs text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {changent.length === 1
                    ? `${changent[0].nom} quittera ${changent[0].autreApporteur} : un établissement n’a qu’un apporteur.`
                    : `${changent.length} établissements quitteront leur apporteur actuel : un établissement n’a qu’un apporteur.`}
                  {' '}Les commissions en attente suivent l’établissement ; celles déjà validées ou versées restent acquises à l’ancien apporteur.
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={rattacher} isLoading={pending} disabled={!liste.length} icon={<Link2 className="h-4 w-4" />}>
            {liste.length ? `Rattacher ${pluriel(liste.length, 'établissement')}` : 'Rattacher'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
