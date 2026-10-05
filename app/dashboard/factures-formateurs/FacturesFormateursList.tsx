'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ReceiptEuro, Download, CheckCircle2, Clock, XCircle, Search, Calendar, Building2, MapPin, Users, AlertTriangle, Link2 } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { dureeFr, type DetailPrestation } from '@/lib/facture-formateur-detail'
import { rattacherSessionFactureFormateurAction, updateFactureFormateurStatusAction } from '@/app/dashboard/formateurs/actions'

const STATUT: Record<string, { label: string; cls: string; Icon: any }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-surface-100 text-surface-600', Icon: ReceiptEuro },
  envoyee: { label: 'À valider', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  validee: { label: 'Validée', cls: 'bg-sky-50 text-sky-700', Icon: CheckCircle2 },
  payee: { label: 'Payée', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  rejetee: { label: 'Rejetée', cls: 'bg-danger-50 text-danger-700', Icon: XCircle },
}
const ORDER = ['envoyee', 'validee', 'brouillon', 'payee', 'rejetee']
const fmt = (n: any) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

function Fait({ Icon, label, children }: { Icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-400" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-surface-400">{label}</div>
        <div className="text-sm text-surface-800 break-words">{children}</div>
      </div>
    </div>
  )
}

/** Ce que la facture rémunère : la formation, les dates, le client, le lieu, les stagiaires. */
function Detail({ d, montantHt }: { d: DetailPrestation; montantHt: number }) {
  const duree = dureeFr(d)
  const ecart = d.prevu !== null && Math.abs(d.prevu - montantHt) >= 0.01
  return (
    <div className="mt-2.5 rounded-xl border border-surface-100 bg-surface-50/70 px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link href={`/dashboard/sessions/${d.sessionId}`} className="text-sm font-semibold text-surface-900 hover:text-brand-600">
          {d.formation || 'Session de formation'}
        </Link>
        {d.poei && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">POEI</span>}
        {d.reference && <span className="font-mono text-[11px] text-surface-400">{d.reference}</span>}
      </div>
      <div className="mt-2.5 grid gap-x-5 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Fait Icon={Calendar} label="Dates">
          {d.periode || 'Dates non renseignées'}
          {duree && <span className="block text-xs text-surface-500">{duree}</span>}
        </Fait>
        <Fait Icon={Building2} label="Client">
          {d.clientId
            ? <Link href={`/dashboard/clients/${d.clientId}`} className="hover:text-brand-600">{d.client}</Link>
            : (d.client || 'Sans client')}
          {d.clientVille && <span className="block text-xs text-surface-500">{d.clientVille}</span>}
        </Fait>
        <Fait Icon={MapPin} label="Lieu">
          {d.lieu || d.modalite || 'Non renseigné'}
          {d.lieu && d.modalite && d.modalite !== 'Présentiel' && <span className="block text-xs text-surface-500">{d.modalite}</span>}
        </Fait>
        <Fait Icon={Users} label="Stagiaires">
          {d.stagiaires ? `${d.stagiaires} ${d.stagiaires > 1 ? 'inscrits' : 'inscrit'}` : 'Aucun inscrit'}
        </Fait>
      </div>
      {(d.tarifJour !== null || d.prevu !== null) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-surface-100 pt-2 text-xs text-surface-500">
          {d.tarifJour !== null && <span>Soit <b className="font-semibold text-surface-700">{fmt(d.tarifJour)}</b> par jour</span>}
          {d.prevu !== null && !ecart && <span>Conforme au montant prévu sur la session</span>}
          {ecart && (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Montant prévu sur la session : {fmt(d.prevu)}, facturé : {fmt(montantHt)} HT
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Facture sans session : rien à afficher tant qu'elle n'est pas rattachée. */
function SansSession({ f, candidates, pending, onRattacher }: {
  f: any
  candidates: { id: string; label: string }[]
  pending: boolean
  onRattacher: (sessionId: string) => void
}) {
  const [choix, setChoix] = useState('')
  return (
    <div className="mt-2.5 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3.5 py-3">
      <p className="flex items-start gap-2 text-sm text-surface-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          Cette facture n’est rattachée à aucune session : le détail de la prestation (dates, client, lieu) ne peut pas s’afficher.
          {f.objet && <span className="block text-xs text-surface-500">Objet déclaré par le formateur : {f.objet}</span>}
        </span>
      </p>
      {candidates.length > 0 ? (
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Session à rattacher</span>
            <select value={choix} onChange={(e) => setChoix(e.target.value)} className="input-base !min-h-10 !py-2 w-full text-sm">
              <option value="">Choisir la session de ce formateur…</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={!choix || pending}
            onClick={() => onRattacher(choix)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-surface-900 px-3 text-xs font-semibold text-white hover:bg-surface-800 disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" /> Rattacher
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-surface-500">Aucune session de ce formateur n’est en attente de facture.</p>
      )}
    </div>
  )
}

export function FacturesFormateursList({ factures, fileUrls, details, candidates }: {
  factures: any[]
  fileUrls: Record<string, string>
  /** Détail de la prestation, par identifiant de facture. */
  details: Record<string, DetailPrestation>
  /** Sessions non facturées, par formateur, pour les factures sans session. */
  candidates: Record<string, { id: string; label: string }[]>
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string>('all')

  function act(id: string, status: 'validee' | 'payee' | 'rejetee') {
    let motif: string | undefined
    if (status === 'rejetee') { const m = prompt('Motif du rejet ?'); if (m === null) return; motif = m }
    start(async () => {
      const r = await updateFactureFormateurStatusAction(id, status, motif)
      if (r.success) { toast('success', 'Facture mise à jour'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  function rattacher(id: string, sessionId: string) {
    start(async () => {
      const r = await rattacherSessionFactureFormateurAction(id, sessionId)
      if (r.success) { toast('success', 'Facture rattachée à sa session'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: factures.length }
    for (const f of factures) c[f.status] = (c[f.status] || 0) + 1
    return c
  }, [factures])

  const totalAvalider = useMemo(
    () => factures.filter((f) => f.status === 'envoyee').reduce((s, f) => s + Number(f.montant_ttc || 0), 0),
    [factures],
  )
  const sansSession = useMemo(() => factures.filter((f) => !details[f.id]).length, [factures, details])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return factures
      .filter((f) => filter === 'all' || f.status === filter)
      .filter((f) => {
        if (!term) return true
        const d = details[f.id]
        const texte = [f.formateur?.prenom, f.formateur?.nom, f.numero, f.reference_externe, f.objet, d?.formation, d?.client, d?.clientVille, d?.lieu, d?.reference]
          .filter(Boolean).join(' ').toLowerCase()
        return texte.includes(term)
      })
      .sort((a, b) => (ORDER.indexOf(a.status) - ORDER.indexOf(b.status)) || String(b.created_at).localeCompare(String(a.created_at)))
  }, [factures, details, filter, q])

  return (
    <div className="space-y-4">
      {/* Filtres statut */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', ...ORDER].map((s) => {
          if (s !== 'all' && !counts[s]) return null
          const active = filter === s
          const label = s === 'all' ? 'Toutes' : STATUT[s].label
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
              {label} <span className={active ? 'text-white/70' : 'text-surface-400'}>· {counts[s] || 0}</span>
            </button>
          )
        })}
        <div className="relative w-full sm:ml-auto sm:w-auto">
          <Search className="h-4 w-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Formateur, client, formation, n°…"
            className="input-base pl-9 py-1.5 text-sm w-full sm:w-72" />
        </div>
      </div>

      {(totalAvalider > 0 || sansSession > 0) && (
        <div className="flex flex-wrap gap-2">
          {totalAvalider > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-2 inline-flex items-center gap-2">
              <Clock className="h-4 w-4" /> {counts.envoyee || 0} facture{(counts.envoyee || 0) > 1 ? 's' : ''} à valider : {fmt(totalAvalider)}
            </div>
          )}
          {sansSession > 0 && (
            <div className="text-sm text-surface-600 bg-surface-100 rounded-lg px-4 py-2 inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> {sansSession} facture{sansSession > 1 ? 's' : ''} sans session rattachée
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-14 text-sm text-surface-400">Aucune facture formateur</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {rows.map((f) => {
              const st = STATUT[f.status] || STATUT.envoyee
              const d = details[f.id]
              return (
                <div key={f.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                    <div className="min-w-0 flex-1 basis-52">
                      <Link href={`/dashboard/formateurs/${f.formateur_id}`} className="block truncate text-sm font-semibold text-surface-900 hover:text-brand-600">
                        {f.formateur ? `${f.formateur.prenom} ${f.formateur.nom}` : 'Formateur'}
                      </Link>
                      <div className="text-xs text-surface-500 mt-0.5">
                        {f.numero}
                        {f.reference_externe && <> · n° du formateur {f.reference_externe}</>}
                        {' '}· émise le {formatDate(f.date_emission || f.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-surface-900">{fmt(f.montant_ttc)}</div>
                      {Number(f.taux_tva) > 0 && <div className="text-[11px] text-surface-400">{fmt(f.montant_ht)} HT</div>}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}><st.Icon className="h-3 w-3" /> {st.label}</span>
                    <a href={(f.fichier_url && fileUrls[f.fichier_url]) ? fileUrls[f.fichier_url] : `/api/pdf/facture-formateur/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-50 text-surface-500 text-[11px] font-medium hover:bg-surface-100 shrink-0"><Download className="h-3 w-3" /> PDF</a>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {f.status === 'envoyee' && (
                        <>
                          <button onClick={() => act(f.id, 'validee')} disabled={pending} className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-[11px] font-medium hover:bg-sky-100 disabled:opacity-50">Valider</button>
                          <button onClick={() => act(f.id, 'rejetee')} disabled={pending} className="px-2.5 py-1 rounded-lg bg-danger-50 text-danger-600 text-[11px] font-medium hover:bg-danger-100 disabled:opacity-50">Rejeter</button>
                        </>
                      )}
                      {f.status === 'validee' && (
                        <button onClick={() => act(f.id, 'payee')} disabled={pending} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 disabled:opacity-50">Marquer payée</button>
                      )}
                    </div>
                  </div>
                  {d
                    ? <Detail d={d} montantHt={Number(f.montant_ht) || 0} />
                    : <SansSession f={f} candidates={candidates[f.formateur_id] || []} pending={pending} onRattacher={(sessionId) => rattacher(f.id, sessionId)} />}
                  {f.status === 'rejetee' && f.motif_rejet && <div className="mt-1.5 text-xs text-danger-600">Motif : {f.motif_rejet}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
