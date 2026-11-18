'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, useToast } from '@/components/ui'
import { Send, Copy, Eye, Download, RefreshCw, Check, Clock, Mail, AlertTriangle, Loader2, ClipboardList } from '@/components/ui/icons'
import { SEUIL_REUSSITE, questionnaire as questionnaireDe } from '@/lib/poei-positionnement'
import { ReponsesPositionnement } from '../poei/ReponsesPositionnement'
import {
  detailPositionnementVivierAction, envoyerPositionnementVivierAction, reinitialiserPositionnementVivierAction,
  type DetailPositionnementVivier,
} from './positionnement-actions'

const fr = (n: number) => String(n).replace('.', ',')
const dateHeure = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

const STATUT_MAIL: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Parti', cls: 'bg-emerald-50 text-emerald-700' },
  delivered: { label: 'Remis', cls: 'bg-emerald-50 text-emerald-700' },
  opened: { label: 'Ouvert', cls: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'En cours', cls: 'bg-amber-50 text-amber-700' },
  failed: { label: 'Échec', cls: 'bg-danger-50 text-danger-700' },
}

/**
 * Suivi du questionnaire de positionnement d'un candidat du vivier : projet et
 * questionnaire concernés, aperçu du mail avant envoi, dates d'envoi et de
 * réponse, résultat et réponses, envois passés.
 */
export function PositionnementVivier({ vivierId, onChange }: { vivierId: string; onChange: () => void }) {
  const { toast } = useToast()
  const [d, setD] = useState<DetailPositionnementVivier | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [voirReponses, setVoirReponses] = useState(false)

  const charger = useCallback(async () => {
    const r = await detailPositionnementVivierAction(vivierId)
    if (r.success && r.data) { setD(r.data); setErreur(null) } else setErreur(r.error || 'Lecture impossible')
  }, [vivierId])
  useEffect(() => { charger() }, [charger])

  async function envoyer() {
    setEnvoi(true)
    const r = await envoyerPositionnementVivierAction(vivierId)
    setEnvoi(false)
    if (r.success && r.data) {
      toast('success', r.data.mail ? 'Questionnaire envoyé' : 'Lien créé : copiez-le pour le transmettre au candidat')
      await charger(); onChange()
    } else { toast('error', r.error || 'Envoi impossible'); await charger(); onChange() }
  }

  async function reinitialiser() {
    if (!d || !confirm(`Effacer les réponses de ${d.candidat.nom} et lui renvoyer un questionnaire neuf ?`)) return
    setEnvoi(true)
    const r = await reinitialiserPositionnementVivierAction(vivierId)
    setEnvoi(false)
    if (r.success) { toast('success', 'Réponses effacées, questionnaire renvoyé'); setVoirReponses(false) }
    else toast('error', r.error || 'Réinitialisation impossible')
    await charger(); onChange()
  }

  function copier(lien: string) {
    navigator.clipboard?.writeText(lien)
    toast('success', 'Lien copié')
  }

  if (erreur) return <p className="text-sm text-danger-600">{erreur}</p>
  if (!d) return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-surface-500">
      <Loader2 className="h-4 w-4 animate-spin" /> Chargement du suivi…
    </div>
  )

  const p = d.positionnement
  const r = p?.resultat || null
  const qReponses = p ? questionnaireDe(p.questionnaire) : null
  const peutEnvoyer = !d.blocage && p?.statut !== 'complete'

  return (
    <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
      {/* Projet et questionnaire concernés */}
      <div className="rounded-xl border border-surface-200 bg-surface-50/70 divide-y divide-surface-200/70">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
          <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wider text-surface-400">Projet POEI</span>
          <span className="text-sm text-surface-800">
            {d.projet
              ? <>{d.projet.numero || 'Projet'}{d.projet.employeur ? ` · ${d.projet.employeur}` : ''}{d.projet.duree ? <span className="text-surface-500"> · parcours de {d.projet.duree} h</span> : null}</>
              : <span className="text-surface-500">Aucun projet rattaché</span>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
          <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wider text-surface-400">Questionnaire</span>
          {d.questionnaire ? (
            <>
              <span className="text-sm text-surface-800 flex-1 min-w-0">
                {d.questionnaire.titre} <span className="text-surface-500">· {d.questionnaire.nbQuestions} questions en {d.questionnaire.nbDomaines} domaines</span>
              </span>
              <a href={`/positionnement/apercu/${d.questionnaire.code}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <Eye className="h-3.5 w-3.5" /> Aperçu
              </a>
            </>
          ) : <span className="text-sm text-surface-500">Choisi d&apos;après l&apos;enseigne du projet</span>}
        </div>
      </div>

      {d.blocage && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{d.blocage}</p>
        </div>
      )}

      {/* Les deux étapes : envoi, puis réponse */}
      {d.migration && (
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Etape fait={!!p} titre="Envoyé" texte={p?.envoyeLe ? `le ${dateHeure(p.envoyeLe)}` : 'Pas encore envoyé'} />
          <Etape fait={p?.statut === 'complete'} titre="Répondu"
            texte={p?.statut === 'complete' && p.completeLe ? `le ${dateHeure(p.completeLe)}` : p ? 'En attente de réponse' : 'Après l’envoi'} />
        </ol>
      )}

      {/* Résultat */}
      {p?.statut === 'complete' && r && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Chiffre label="Bonnes réponses" valeur={`${r.justes}/${r.nbQuestions}`} />
            <Chiffre label="Réussite" valeur={`${fr(r.maitriseGlobale)} %`} />
            <Chiffre label="Note" valeur={`${fr(r.note)}/20`} />
            <Chiffre label="Heures justifiées" valeur={`${fr(r.heuresPreconisees)} h`} sous={`sur ${fr(r.heuresReferentiel)} h`} accent />
          </div>
          <p className="text-sm text-surface-700">
            <span className="font-medium text-surface-900">{r.niveauLibelle}.</span>{' '}
            {r.seuilAtteint
              ? `Seuil de ${SEUIL_REUSSITE} % atteint : seul l'écart restant par domaine est à former.`
              : `Sous le seuil de ${SEUIL_REUSSITE} % : le parcours complet est requis.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setVoirReponses((v) => !v)} icon={<ClipboardList className="h-4 w-4" />}>
              {voirReponses ? 'Masquer les réponses' : 'Voir les réponses'}
            </Button>
            <a href={`/api/pdf/poei-positionnement/${p.poeiId}?vivier=${vivierId}`} target="_blank" rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm">
              <Download className="h-4 w-4" /> Fiche France Travail
            </a>
            <Button size="sm" variant="ghost" onClick={reinitialiser} isLoading={envoi} icon={<RefreshCw className="h-4 w-4" />}>
              Effacer et renvoyer
            </Button>
          </div>
          {voirReponses && p.reponses && qReponses && (
            <ReponsesPositionnement questionnaire={qReponses} reponses={p.reponses} resultat={r} />
          )}
        </div>
      )}

      {/* Aperçu du mail, puis envoi */}
      {peutEnvoyer && (
        <div className="space-y-3">
          {d.apercu ? (
            <div>
              <div className="text-2xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Aperçu du mail</div>
              <div className="rounded-xl border border-surface-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-100 bg-white text-sm space-y-0.5">
                  <div><span className="text-surface-400">À </span><span className="text-surface-800">{d.apercu.to}</span></div>
                  <div><span className="text-surface-400">Objet </span><span className="font-medium text-surface-900">{d.apercu.subject}</span></div>
                </div>
                <iframe title="Aperçu du mail" srcDoc={d.apercu.html} sandbox="" className="block w-full h-[420px] bg-surface-50" />
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-surface-400" />
              <p>Pas d&apos;email dans la fiche du candidat : le bouton crée son lien personnel, à lui transmettre par SMS ou WhatsApp.</p>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {p?.lien && (
              <Button variant="secondary" onClick={() => copier(p.lien)} icon={<Copy className="h-4 w-4" />}>Copier le lien</Button>
            )}
            {(d.candidat.email || !p) && (
              <Button onClick={envoyer} isLoading={envoi} icon={<Send className="h-4 w-4" />}>
                {d.candidat.email ? (p ? 'Renvoyer le questionnaire' : 'Envoyer le questionnaire') : 'Créer le lien'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Envois passés */}
      {d.mails.length > 0 && (
        <div>
          <div className="text-2xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Envois</div>
          <div className="rounded-xl border border-surface-200 divide-y divide-surface-100">
            {d.mails.map((m, i) => {
              const s = STATUT_MAIL[m.statut] || { label: m.statut, cls: 'bg-surface-100 text-surface-600' }
              return (
                <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                  <span className="text-surface-800 tabular-nums">{dateHeure(m.date)}</span>
                  <span className="text-surface-500 truncate flex-1 min-w-0">{m.to}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Etape({ fait, titre, texte }: { fait: boolean; titre: string; texte: string }) {
  return (
    <li className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${fait ? 'border-emerald-200 bg-emerald-50/60' : 'border-surface-200 bg-white'}`}>
      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${fait ? 'bg-emerald-500 text-white' : 'bg-surface-100 text-surface-400'}`}>
        {fait ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-surface-900">{titre}</div>
        <div className="text-xs text-surface-600">{texte}</div>
      </div>
    </li>
  )
}

function Chiffre({ label, valeur, sous, accent }: { label: string; valeur: string; sous?: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-surface-500">{label}</div>
      <div className={`text-lg font-heading font-bold tabular-nums ${accent ? 'text-brand-600' : 'text-surface-900'}`}>{valeur}</div>
      {sous && <div className="text-[11px] text-surface-500">{sous}</div>}
    </div>
  )
}
