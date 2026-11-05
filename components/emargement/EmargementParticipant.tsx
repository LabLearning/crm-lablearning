'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, useToast } from '@/components/ui'
import { CheckCircle2, XCircle, Moon, Clock, Lock, Copy, Mail, Loader2, PenTool, RefreshCw, ClipboardCheck, Eye } from '@/components/ui/icons'
import {
  LIBELLE_CRENEAU, LIBELLE_STATUT, signableParLeStagiaire, bloqueParFeuille,
  type CreneauParticipant, type StatutCreneau,
} from '@/lib/emargement-participant'
import {
  emargementParticipantAction, marquerCreneauParticipantAction, lienSignatureParticipantAction,
  envoyerLienSignatureParticipantAction, rouvrirFeuillesParticipantAction,
} from '@/app/dashboard/sessions/emargement-participant-actions'

type Donnees = NonNullable<Awaited<ReturnType<typeof emargementParticipantAction>>['data']>

const PASTILLE: Record<StatutCreneau, string> = {
  signe: 'bg-emerald-50 text-emerald-700',
  present: 'bg-amber-50 text-amber-700',
  absent: 'bg-rose-50 text-rose-700',
  repos: 'bg-sky-50 text-sky-700',
  a_signer: 'bg-amber-50 text-amber-700',
  a_venir: 'bg-surface-100 text-surface-500',
}

/** Une action interrompue (réseau, session expirée) rend null au lieu de casser le panneau */
async function appel<T>(f: () => Promise<T>): Promise<T | null> {
  try { return (await f()) ?? null } catch { return null }
}

const jourLong = (d: string) => {
  const s = new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const quand = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Émargement d'un participant, demi-journée par demi-journée : présent, absent
 * ou repos, puis le lien de son espace pour qu'il signe ses journées de
 * présence (aperçu du mail avant tout envoi). Les créneaux déjà signés ne se
 * modifient pas.
 */
function PanneauEmargement({ apprenantId, sessionIds }: { apprenantId: string; sessionIds: string[] }) {
  const { toast } = useToast()
  const [d, setD] = useState<Donnees | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [avenir, setAvenir] = useState(false)
  const [motifPour, setMotifPour] = useState<string | null>(null)
  const [motif, setMotif] = useState('')
  const [apercu, setApercu] = useState<{ html: string; subject: string; email: string } | null>(null)

  const cleSessions = sessionIds.join(',')
  const charger = useCallback(async () => {
    const r = await appel(() => emargementParticipantAction(apprenantId, cleSessions.split(',').filter(Boolean)))
    if (r?.success && r.data) { setD(r.data); setErreur(null) } else setErreur(r?.error || 'Chargement impossible : vérifiez la connexion puis rouvrez le panneau')
  }, [apprenantId, cleSessions])
  useEffect(() => { charger() }, [charger])

  const marquer = (c: CreneauParticipant, statut: 'present' | 'absent' | 'repos' | 'effacer', m?: string) => start(async () => {
    const r = await appel(() => marquerCreneauParticipantAction(c.id, statut, m))
    if (!r?.success) toast('error', r?.error || 'Enregistrement impossible, réessayez')
    setMotifPour(null); setMotif('')
    await charger()
  })

  const copierLien = () => start(async () => {
    const r = await appel(() => lienSignatureParticipantAction(apprenantId))
    if (!r?.success || !r.data) { toast('error', r?.error || 'Lien impossible'); return }
    try { await navigator.clipboard.writeText(r.data.url); toast('success', 'Lien copié : collez-le dans un SMS ou un WhatsApp') }
    catch { window.prompt('Lien de signature', r.data.url) }
  })

  const voirApercu = () => start(async () => {
    const r = await appel(() => envoyerLienSignatureParticipantAction(apprenantId, sessionIds, { apercu: true }))
    if (!r?.success || !r.data?.html) { toast('error', r?.error || 'Aperçu impossible'); return }
    setApercu({ html: r.data.html, subject: r.data.subject || '', email: r.data.email || '' })
  })

  const envoyer = () => start(async () => {
    const r = await appel(() => envoyerLienSignatureParticipantAction(apprenantId, sessionIds))
    if (!r?.success) { toast('error', r?.error || 'Envoi impossible : vérifiez l’historique des mails avant de renvoyer'); return }
    toast('success', `Lien envoyé à ${r.data?.email}`)
    setApercu(null)
    await charger()
  })

  const rouvrir = () => start(async () => {
    if (!window.confirm('Rouvrir les feuilles validées de ces demi-journées ? Le formateur devra les valider de nouveau une fois signées.')) return
    const r = await appel(() => rouvrirFeuillesParticipantAction(apprenantId, sessionIds))
    if (!r?.success) toast('error', r?.error || 'Réouverture impossible, réessayez')
    else toast('success', `${r.data?.rouvertes || 0} feuille${(r.data?.rouvertes || 0) > 1 ? 's rouvertes' : ' rouverte'}`)
    await charger()
  })

  if (erreur) return <div className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{erreur}</div>
  if (!d) return <div className="flex items-center justify-center py-10 text-sm text-surface-400"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…</div>

  const compte = (s: StatutCreneau) => d.creneaux.filter((c) => c.statut === s).length
  const aSigner = d.creneaux.filter(signableParLeStagiaire).length
  const bloques = d.creneaux.filter(bloqueParFeuille).length
  const visibles = d.creneaux.filter((c) => avenir || c.statut !== 'a_venir')
  const jours = Array.from(new Set(visibles.map((c) => c.date)))
  const plusieursSessions = d.sessions.length > 1
  const libelleSession = (id: string) => d.sessions.find((s) => s.id === id)?.libelle || ''

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${PASTILLE.signe}`}>{compte('signe')} signée{compte('signe') > 1 ? 's' : ''}</span>
        {compte('present') > 0 && <span className={`rounded-full px-2 py-0.5 ${PASTILLE.present}`}>{compte('present')} présent sans signature</span>}
        {compte('a_signer') > 0 && <span className={`rounded-full px-2 py-0.5 ${PASTILLE.a_signer}`}>{compte('a_signer')} non renseignée{compte('a_signer') > 1 ? 's' : ''}</span>}
        {compte('absent') > 0 && <span className={`rounded-full px-2 py-0.5 ${PASTILLE.absent}`}>{compte('absent')} absence{compte('absent') > 1 ? 's' : ''}</span>}
        {compte('repos') > 0 && <span className={`rounded-full px-2 py-0.5 ${PASTILLE.repos}`}>{compte('repos')} repos</span>}
        {compte('a_venir') > 0 && <span className={`rounded-full px-2 py-0.5 ${PASTILLE.a_venir}`}>{compte('a_venir')} à venir</span>}
      </div>

      {/* Signature par le stagiaire */}
      <div className="rounded-xl border border-surface-200 p-3.5 space-y-3">
        <div className="flex items-start gap-2.5">
          <PenTool className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div className="min-w-0 text-sm text-surface-700">
            {aSigner > 0 ? (
              <><span className="font-semibold text-surface-900">{aSigner} demi-journée{aSigner > 1 ? 's' : ''} à faire signer</span>{' '}par {d.apprenant.prenom || 'le stagiaire'} dans son espace « Mes émargements ».</>
            ) : bloques > 0 ? (
              <span className="font-semibold text-surface-900">Aucune demi-journée signable pour l’instant.</span>
            ) : (
              <><span className="font-semibold text-surface-900">Rien à faire signer pour l’instant.</span> Les demi-journées passées sont signées, ou marquées absent ou repos.</>
            )}
            {d.dernierEnvoi && <span className="block text-xs text-surface-500 mt-0.5">Dernier lien envoyé le {quand(d.dernierEnvoi)}</span>}
          </div>
        </div>
        {bloques > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 min-w-[200px]">{bloques} demi-journée{bloques > 1 ? 's sont' : ' est'} sur des feuilles déjà validées par le formateur : il ne pourra les signer qu’une fois ces feuilles rouvertes.</span>
            <button type="button" onClick={rouvrir} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" /> Rouvrir ces feuilles
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copierLien} disabled={pending} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-surface-200 px-3 text-xs font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-50">
            <Copy className="h-3.5 w-3.5" /> Copier le lien
          </button>
          <button type="button" onClick={voirApercu} disabled={pending || !d.apprenant.email} title={d.apprenant.email ? undefined : 'Pas d’adresse e-mail : copiez le lien'}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-surface-900 px-3 text-xs font-semibold text-white hover:bg-surface-800 disabled:opacity-50">
            <Mail className="h-3.5 w-3.5" /> Envoyer par mail…
          </button>
        </div>
        {!d.apprenant.email && (
          <p className="text-xs text-surface-500">Pas d’adresse e-mail sur sa fiche : copiez le lien et envoyez-le par SMS ou WhatsApp.</p>
        )}
        {apercu && (
          <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-surface-600"><Eye className="h-3.5 w-3.5" /> Aperçu · à {apercu.email} · « {apercu.subject} »</div>
            <iframe title="Aperçu du mail" srcDoc={apercu.html} className="h-[360px] w-full rounded-lg border border-surface-200 bg-white" sandbox="" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApercu(null)} className="min-h-[36px] rounded-lg border border-surface-200 bg-white px-3 text-xs font-medium text-surface-600">Annuler</button>
              <button type="button" onClick={envoyer} disabled={pending} className="btn-primary inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs disabled:opacity-50">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Envoyer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Les demi-journées */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">Demi-journées</span>
        {compte('a_venir') > 0 && (
          <label className="inline-flex items-center gap-1.5 text-xs text-surface-500">
            <input type="checkbox" checked={avenir} onChange={(e) => setAvenir(e.target.checked)} className="rounded border-surface-300" /> Afficher les jours à venir
          </label>
        )}
      </div>
      {jours.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-200 px-4 py-6 text-center text-sm text-surface-400">Aucune demi-journée passée pour l’instant</div>
      ) : (
        <div className="divide-y divide-surface-100 rounded-xl border border-surface-200">
          {jours.map((jour) => (
            <div key={jour} className="px-3 py-2.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-surface-900">{jourLong(jour)}</span>
                {plusieursSessions && <span className="truncate text-[10px] text-surface-400">{Array.from(new Set(visibles.filter((c) => c.date === jour).map((c) => c.session_id))).map(libelleSession).join(', ')}</span>}
              </div>
              <div className="space-y-2">
                {visibles.filter((c) => c.date === jour).map((c) => (
                  <div key={c.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-[76px] shrink-0 text-xs text-surface-500">{LIBELLE_CRENEAU[c.creneau] || c.creneau}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PASTILLE[c.statut]}`}>
                        {c.statut === 'signe' ? <CheckCircle2 className="h-3 w-3" /> : c.statut === 'absent' ? <XCircle className="h-3 w-3" /> : c.statut === 'repos' ? <Moon className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {LIBELLE_STATUT[c.statut]}{c.statut === 'absent' && c.motif ? ` · ${c.motif}` : ''}
                      </span>
                      {c.verrouille && c.statut !== 'signe' && <span title="Feuille validée par le formateur"><Lock className="h-3.5 w-3.5 text-surface-400" /></span>}
                      <span className="flex-1" />
                      {c.statut === 'signe' ? (
                        <span className="text-[11px] text-emerald-700">{c.signed_at ? `le ${quand(c.signed_at)}` : ''}</span>
                      ) : (
                        <div className="flex gap-1">
                          {([
                            ['present', 'Présent', CheckCircle2, 'bg-emerald-600 text-white'],
                            ['absent', 'Absent', XCircle, 'bg-rose-600 text-white'],
                            ['repos', 'Repos', Moon, 'bg-sky-600 text-white'],
                          ] as const).filter(([s]) => !(c.futur && s === 'present')).map(([s, label, Icone, actif]) => {
                            const estActif = (s === 'present' && c.statut === 'present') || (s === 'absent' && c.statut === 'absent') || (s === 'repos' && c.statut === 'repos')
                            return (
                              <button key={s} type="button" disabled={pending}
                                onClick={() => estActif ? marquer(c, 'effacer') : s === 'absent' ? (setMotifPour(c.id), setMotif('')) : marquer(c, s)}
                                className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${estActif ? actif : 'border border-surface-200 bg-white text-surface-600 hover:bg-surface-50'}`}>
                                <Icone className="h-3.5 w-3.5" /> {label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {motifPour === c.id && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[84px]">
                        <input autoFocus value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif de l’absence (maladie, retard…)"
                          onKeyDown={(e) => { if (e.key === 'Enter') marquer(c, 'absent', motif) }}
                          className="input-base !min-h-[34px] flex-1 min-w-[180px] text-xs" />
                        <button type="button" onClick={() => marquer(c, 'absent', motif)} className="min-h-[34px] rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white">Valider</button>
                        <button type="button" onClick={() => setMotifPour(null)} className="min-h-[34px] rounded-lg border border-surface-200 px-3 text-xs text-surface-600">Annuler</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Bouton « Émargement » d'un participant, qui ouvre son panneau */
export function BoutonEmargementParticipant({ apprenantId, sessionIds, nom, className, compact }: {
  apprenantId: string; sessionIds: string[]; nom: string; className?: string
  /** Libellé masqué sur téléphone, icône seule */
  compact?: boolean
}) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} aria-label={`Émargement de ${nom}`}
        className={className || 'inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-surface-200 px-2.5 text-xs font-semibold text-surface-600 hover:bg-surface-50'}>
        <ClipboardCheck className="h-3.5 w-3.5" /> <span className={compact ? 'hidden sm:inline' : undefined}>Émargement</span>
      </button>
      <Modal isOpen={ouvert} onClose={() => { setOuvert(false); router.refresh() }} title={`Émargement · ${nom}`} size="lg">
        {ouvert && <PanneauEmargement apprenantId={apprenantId} sessionIds={sessionIds} />}
      </Modal>
    </>
  )
}
