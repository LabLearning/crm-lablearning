'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Mail, MessageSquare, Eye, Send, CalendarClock, Copy, Trash2, Ban, AlertTriangle, Info, Save,
} from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { nettoyerFiltres, type FiltresAudience } from '@/lib/campagnes/publics'
import type { OptionsAudience } from '@/lib/campagnes/audience'
import { STATUTS_CAMPAGNE, composerSms, compterSms, dansFenetreSms, MAX_PARTIES_SMS, prochaineFenetreSms, type StatutCampagne } from '@/lib/campagnes/regles'
import {
  apercuEmailAction, arreterCampagneAction, calculerAudienceAction, dupliquerCampagneAction, enregistrerCampagneAction,
  envoyerEssaiAction, programmerCampagneAction, supprimerCampagneAction,
} from '../actions'
import { STYLE_STATUT } from '../CampagnesListe'
import { AIDE_MISE_EN_PAGE } from '@/lib/campagnes/aide-mise-en-page'
import { AudienceEditeur, type CalculAudience } from './AudienceEditeur'

const section = 'card p-5 space-y-4'
const titre = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-500'

/** Date et heure locales (« 2026-10-27T09:30 ») pour le champ de programmation */
const versChampDate = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CampagneEditeur({ campagne, options, optionsIndisponibles, manques, numeroStop, expediteurSms, expediteurEmail, envois, derniersEchecs, derniereErreur, aMonMobile }: {
  campagne: any
  /** Réseaux, villes, secteurs et formations proposés dans l'audience */
  options: OptionsAudience
  optionsIndisponibles: boolean
  manques: string[]
  numeroStop: string | null
  expediteurSms: string
  expediteurEmail: string | null
  envois: { aEnvoyer: number; envoyes: number; echecs: number; exclus: number }
  derniersEchecs: { nom: string | null; erreur: string | null }[]
  /** Erreur de Brevo qui retient des envois (compte, crédits, quota…) */
  derniereErreur: string | null
  aMonMobile: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const email = campagne.canal === 'email'
  const statut = campagne.statut as StatutCampagne
  const brouillon = statut === 'brouillon'

  const [nom, setNom] = useState<string>(campagne.nom || '')
  const [objet, setObjet] = useState<string>(campagne.objet || '')
  const [contenu, setContenu] = useState<string>(campagne.contenu || '')
  const [boutonLibelle, setBoutonLibelle] = useState<string>(campagne.bouton_libelle || '')
  const [boutonUrl, setBoutonUrl] = useState<string>(campagne.bouton_url || '')
  const [audience, setAudience] = useState<FiltresAudience>(() => nettoyerFiltres(campagne.audience))
  const [calcul, setCalcul] = useState<CalculAudience | null>(null)
  const [calculEnCours, setCalculEnCours] = useState(false)
  const [erreurCalcul, setErreurCalcul] = useState<string | null>(null)
  // Décompte : un seul calcul à la fois (les actions serveur passent une par une), sur les derniers choix
  const enVol = useRef(false)
  const aRefaire = useRef(false)
  const audienceCourante = useRef(audience)
  audienceCourante.current = audience
  // Brouillon, ou campagne programmée (une estimation : son audience sera recalculée au départ)
  const estimable = brouillon || statut === 'programmee'
  const [apercu, setApercu] = useState<{ objet: string; html: string } | null>(null)
  const [quand, setQuand] = useState<string>('')
  const [confirmer, setConfirmer] = useState<'maintenant' | 'programmer' | null>(null)
  // Date minimale du champ de programmation : lue après l'affichage (l'heure du serveur ferait un écart d'hydratation)
  const [minimum, setMinimum] = useState<string | undefined>(undefined)
  useEffect(() => { setMinimum(versChampDate(new Date().toISOString())) }, [])

  const sms = useMemo(() => (email ? null : compterSms(composerSms(contenu, numeroStop))), [email, contenu, numeroStop])
  // Un choix change : le décompte d'avant ne vaut plus, ni à l'écran ni dans la fenêtre d'envoi ; il est refait une
  // fois les choix posés (une campagne partie garde l'audience figée à son lancement)
  useEffect(() => {
    setCalcul(null)
    setErreurCalcul(null)
    setCalculEnCours(estimable)
    if (!estimable) return
    const t = window.setTimeout(() => { calculer() }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, campagne.canal, estimable])
  /** SMS : premier départ possible (lundi-samedi, 8 h - 21 h 30, hors fériés) à partir d'une date */
  const departSms = (depuis: Date) => (email ? null : prochaineFenetreSms(depuis))

  // Aperçu de l'e-mail enregistré, à l'ouverture d'une campagne qui n'est plus un brouillon
  useEffect(() => {
    if (email && !brouillon) voirApercu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Programmée ou en cours : la fiche suit la tâche planifiée (départ, lots, fin) sans recharger la page. Rien tant
  // que l'onglet est caché, qu'un départ programmé est loin, ou que les SMS attendent leur fenêtre d'envoi
  useEffect(() => {
    if (statut !== 'programmee' && statut !== 'en_cours') return
    const t = window.setInterval(() => {
      if (document.hidden) return
      if (statut === 'programmee' && campagne.programmee_le && Date.parse(campagne.programmee_le) - Date.now() > 10 * 60000) return
      if (statut === 'en_cours' && !email && !dansFenetreSms()) return
      router.refresh()
    }, 30000)
    return () => window.clearInterval(t)
  }, [statut, email, campagne.programmee_le, router])

  const champs = () => ({ nom, objet, contenu, bouton_libelle: boutonLibelle || null, bouton_url: boutonUrl || null, audience })

  async function enregistrer(silencieux = false): Promise<boolean> {
    const r = await enregistrerCampagneAction(campagne.id, champs())
    if (!r?.success) { toast('error', r?.error || 'Pas de réponse du serveur : réessayez'); return false }
    if (!silencieux) toast('success', 'Brouillon enregistré')
    return true
  }
  /** Décompte de l'audience. Un calcul déjà parti : on en refera un seul à son retour, sur les derniers choix */
  async function calculer() {
    if (enVol.current) { aRefaire.current = true; return }
    enVol.current = true
    aRefaire.current = false
    const demandee = audienceCourante.current
    setCalculEnCours(true)
    setErreurCalcul(null)
    try {
      const r = await calculerAudienceAction(campagne.canal, demandee)
      // Les choix ont changé pendant le calcul : ce résultat ne vaut plus, le suivant s'en charge
      if (demandee !== audienceCourante.current) return
      if (r?.success && r.data) setCalcul(r.data)
      else { setCalcul(null); setErreurCalcul(r?.error || 'Calcul impossible') }
    } catch {
      if (demandee === audienceCourante.current) setErreurCalcul('Pas de réponse du serveur : réessayez')
    } finally {
      enVol.current = false
      if (aRefaire.current) calculer()
      else if (demandee === audienceCourante.current) setCalculEnCours(false)
    }
  }
  function voirApercu() {
    startTransition(async () => {
      const r = await apercuEmailAction({ objet, contenu, bouton_libelle: boutonLibelle || null, bouton_url: boutonUrl || null })
      if (r?.success && r.data) setApercu(r.data)
      else toast('error', r?.error || 'Aperçu impossible')
    })
  }
  function essai() {
    startTransition(async () => {
      if (brouillon && !(await enregistrer(true))) return
      const r = await envoyerEssaiAction(campagne.id)
      if (r?.success && r.data) toast('success', `Essai envoyé à ${r.data.a}`)
      else toast('error', r?.error || 'Essai impossible')
    })
  }
  function envoyer() {
    const mode = confirmer
    startTransition(async () => {
      if (!(await enregistrer(true))) return
      const date = mode === 'programmer' && quand ? new Date(quand).toISOString() : null
      const r = await programmerCampagneAction(campagne.id, date)
      setConfirmer(null)
      if (r?.success) {
        const depart = departSms(date ? new Date(date) : new Date())
        const differe = depart && depart.getTime() - (date ? Date.parse(date) : Date.now()) > 10 * 60000
        toast('success', date ? 'Campagne programmée'
          : differe ? `Campagne lancée : ${r.data?.destinataires || 0} destinataires, les SMS partiront le ${formatDate(depart!.toISOString(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
          : `Campagne lancée : ${r.data?.destinataires || 0} destinataires, envoi par lots dans les minutes qui viennent`)
        router.refresh()
      } else toast('error', r?.error || 'Pas de réponse du serveur : réessayez')
    })
  }
  function arreter() {
    if (!confirm(statut === 'programmee' ? 'Déprogrammer cette campagne ? Elle redevient un brouillon.' : 'Arrêter l’envoi ? Ce qui attend ne partira pas ; seuls les quelques messages déjà en cours d’envoi peuvent encore partir.')) return
    startTransition(async () => {
      // L'état vu à l'écran : si la tâche a lancé ou fini la campagne entre-temps, rien n'est fait et la page se met à jour
      const r = await arreterCampagneAction(campagne.id, statut)
      if (r?.success) toast('success', r.data?.fait === 'deprogrammee' ? 'Campagne déprogrammée : elle redevient un brouillon' : 'Envoi arrêté')
      else toast('error', r?.error || 'Pas de réponse du serveur : réessayez')
      router.refresh()
    })
  }
  function dupliquer() {
    startTransition(async () => {
      const r = await dupliquerCampagneAction(campagne.id)
      if (r?.success && r.data) router.push(`/dashboard/campagnes/${r.data.id}`)
      else toast('error', r?.error || 'Copie impossible')
    })
  }
  function supprimer() {
    if (!confirm(`Supprimer la campagne « ${nom} » ?`)) return
    startTransition(async () => {
      const r = await supprimerCampagneAction(campagne.id)
      if (r?.success) { toast('success', 'Campagne supprimée'); router.push('/dashboard/campagnes') }
      else toast('error', r?.error || 'Suppression impossible')
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/dashboard/campagnes" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800"><ArrowLeft className="h-4 w-4" /> Campagnes</Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', email ? 'bg-brand-50 text-brand-600' : 'bg-info-50 text-info-600')}>
              {email ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </span>
            {brouillon ? (
              <input value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Nom de la campagne"
                className="input-base min-w-0 flex-1 !text-lg font-heading font-semibold" />
            ) : <h1 className="truncate text-xl font-heading font-bold text-surface-900">{nom}</h1>}
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', STYLE_STATUT[statut])}>{STATUTS_CAMPAGNE[statut]}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {brouillon && <Button size="sm" variant="secondary" onClick={() => startTransition(async () => { await enregistrer() ; router.refresh() })} isLoading={pending} icon={<Save className="h-3.5 w-3.5" />}>Enregistrer</Button>}
            {(statut === 'programmee' || statut === 'en_cours') && <Button size="sm" variant="secondary" onClick={arreter} disabled={pending} icon={<Ban className="h-3.5 w-3.5" />}>{statut === 'programmee' ? 'Déprogrammer' : 'Arrêter l’envoi'}</Button>}
            <Button size="sm" variant="secondary" onClick={dupliquer} disabled={pending} icon={<Copy className="h-3.5 w-3.5" />}>Dupliquer</Button>
            {(brouillon || statut === 'annulee') && (
              <button type="button" onClick={supprimer} disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-danger-600 hover:bg-danger-50">
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            )}
          </div>
        </div>
        {statut === 'programmee' && campagne.programmee_le && (
          <p className="mt-2 text-sm text-surface-600">Départ prévu le {formatDate(campagne.programmee_le, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. Pour la modifier, déprogrammez-la.</p>
        )}
      </div>

      {manques.length > 0 && (
        <div className="card flex items-start gap-3 border-info-100 bg-info-50/60 p-4 text-sm text-surface-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-600" />
          <span>Envoi pas encore branché : il manque {manques.join(', ')}. Le brouillon, l’audience et l’aperçu marchent déjà.</span>
        </div>
      )}

      {/* Suivi de l'envoi */}
      {!brouillon && (
        <div className={section}>
          <div className={titre}><Send className="h-3.5 w-3.5" /> Envoi</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['Partis', envois.envoyes], ['À partir', envois.aEnvoyer], ['Échecs', envois.echecs], ['Écartés', envois.exclus]] as [string, number][]).map(([l, n]) => (
              <div key={l} className="rounded-xl bg-surface-50 p-3">
                <div className="text-xs text-surface-500">{l}</div>
                <div className="text-xl font-heading font-bold text-surface-900 tabular-nums">{n}</div>
              </div>
            ))}
          </div>
          {campagne.nb_desinscrits > 0 && <p className="text-sm text-surface-600">{campagne.nb_desinscrits} désinscription{campagne.nb_desinscrits > 1 ? 's' : ''} après cette campagne.</p>}
          {derniereErreur && statut === 'en_cours' && (
            <p className="flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Envoi en attente : {derniereErreur}. Il reprendra seul au prochain passage (toutes les 5 minutes).
            </p>
          )}
          {!email && statut === 'en_cours' && <p className="text-xs text-surface-500">Les SMS partent du lundi au samedi, de 8 h à 21 h 30, jamais un jour férié : en dehors, l’envoi reprend à la prochaine ouverture.</p>}
          {derniersEchecs.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-surface-700">Derniers échecs</summary>
              <ul className="mt-2 space-y-1 text-xs text-surface-600">
                {derniersEchecs.map((e, i) => <li key={i}><span className="font-medium text-surface-800">{e.nom || 'Destinataire'}</span> : {e.erreur}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <AudienceEditeur
        audience={audience} onChange={setAudience} options={options} optionsIndisponibles={optionsIndisponibles}
        modifiable={brouillon} calculable={estimable} figee={estimable ? null : Number(campagne.nb_destinataires) || 0}
        email={email} calcul={calcul} calculEnCours={calculEnCours} erreurCalcul={erreurCalcul} onCalculer={calculer}
      />

      {/* Message */}
      <div className={section}>
        <div className={titre}>{email ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />} Message</div>
        {email ? (
          <>
            <fieldset disabled={!brouillon} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-surface-500">Objet</span>
                <input value={objet} onChange={(e) => setObjet(e.target.value)} className="input-base w-full" placeholder="Ex. Formez votre équipe à l’hygiène avant l’été" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-surface-500">Texte : {'{prenom}'} et {'{etablissement}'} sont remplacés pour chacun, les adresses web deviennent des liens</span>
                <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={14} className="input-base w-full font-mono !text-[13px]" placeholder={'Bonjour {prenom},\n\n…'} />
              </label>
              <details className="rounded-xl bg-surface-50 px-3 py-2 text-xs text-surface-600">
                <summary className="cursor-pointer font-medium text-surface-700">Mise en page : image, titres, chiffres clés, listes, encadrés</summary>
                <p className="mt-2">Un bloc par ligne, en début de ligne. « Aperçu » montre le résultat.</p>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[auto,1fr]">
                  {AIDE_MISE_EN_PAGE.map((a) => (
                    <div key={a.code} className="contents">
                      <dt><code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-surface-800">{a.code}</code></dt>
                      <dd className="mb-1 sm:mb-0">{a.effet}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,2fr]">
                <label className="block">
                  <span className="mb-1 block text-xs text-surface-500">Bouton (facultatif)</span>
                  <input value={boutonLibelle} onChange={(e) => setBoutonLibelle(e.target.value)} className="input-base w-full" placeholder="Ex. Voir les dates" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-surface-500">Adresse du bouton</span>
                  <input value={boutonUrl} onChange={(e) => setBoutonUrl(e.target.value)} className="input-base w-full" placeholder="https://www.lab-learning.fr/…" />
                </label>
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={voirApercu} disabled={pending} icon={<Eye className="h-3.5 w-3.5" />}>Aperçu</Button>
              {expediteurEmail && <span className="text-xs text-surface-500">Envoyé par {expediteurEmail}</span>}
            </div>
            {apercu && (
              <div className="overflow-hidden rounded-xl border border-surface-200">
                <div className="border-b border-surface-100 bg-surface-50 px-3 py-2 text-xs text-surface-600">Objet : <span className="font-medium text-surface-900">{apercu.objet || '(vide)'}</span></div>
                {/* Liens inactifs dans l'aperçu : un clic ne doit pas remplacer l'aperçu par la page visée */}
                <iframe title="Aperçu de l’e-mail" srcDoc={apercu.html.replace('</head>', '<style>a{pointer-events:none}</style></head>')} sandbox="" className="h-[560px] w-full bg-white" />
              </div>
            )}
          </>
        ) : (
          <>
            <fieldset disabled={!brouillon}>
              <label className="block">
                <span className="mb-1 block text-xs text-surface-500">Message : « Lab Learning : » est ajouté devant et la mention STOP à la fin ; {'{prenom}'} et {'{etablissement}'} sont remplacés pour chacun</span>
                <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={4} className="input-base w-full" placeholder="Ex. formation hygiène HACCP le 12/11 dans votre ville, prise en charge OPCO possible. Infos : lab-learning.fr" />
              </label>
            </fieldset>
            {sms && (
              <div className="flex flex-wrap items-start gap-3">
                <div className="max-w-sm rounded-2xl rounded-bl-md bg-surface-100 px-3.5 py-2.5 text-sm text-surface-800 whitespace-pre-wrap [overflow-wrap:anywhere]">
                  <div className="mb-1 text-[11px] font-semibold text-surface-500">{expediteurSms}</div>
                  {composerSms(contenu || '…', numeroStop)}
                </div>
                <div className={cn('text-xs', sms.sms > MAX_PARTIES_SMS ? 'font-semibold text-danger-600' : 'text-surface-500')}>
                  {sms.caracteres} caractères · {sms.sms} SMS par personne{sms.unicode ? ' · lettres accentuées (ç, â, ê…) : 70 caractères par SMS' : ''}
                  {sms.sms > MAX_PARTIES_SMS && <div>{MAX_PARTIES_SMS} SMS au plus : raccourcissez le message.</div>}
                  {sms.sms <= MAX_PARTIES_SMS && /\{(prenom|etablissement)\}/.test(contenu) && (
                    <div className="mt-1 max-w-xs">Le prénom et l’établissement de chacun allongent un peu le message ; au-delà de {MAX_PARTIES_SMS} SMS, la personne est écartée.</div>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-surface-400">Les SMS partent du lundi au samedi, de 8 h à 21 h 30, jamais un jour férié, vers des mobiles français.</p>
          </>
        )}
      </div>

      {/* Envoi */}
      {brouillon && (
        <div className={section}>
          <div className={titre}><Send className="h-3.5 w-3.5" /> Envoi</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <Button size="sm" variant="secondary" onClick={essai} disabled={pending || manques.length > 0 || (!email && !aMonMobile)}
              icon={<Send className="h-3.5 w-3.5" />}>
              {email ? 'M’envoyer un essai' : 'Recevoir un essai sur mon mobile'}
            </Button>
            <Button size="sm" onClick={() => setConfirmer('maintenant')} disabled={pending || manques.length > 0} icon={<Send className="h-3.5 w-3.5" />}>Envoyer maintenant</Button>
            <div className="flex items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-surface-500">Ou programmer pour le</span>
                <input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} min={minimum} className="input-base" />
              </label>
              <Button size="sm" variant="secondary" onClick={() => setConfirmer('programmer')} disabled={pending || !quand || manques.length > 0} icon={<CalendarClock className="h-3.5 w-3.5" />}>Programmer</Button>
            </div>
          </div>
          {!email && !aMonMobile && <p className="text-xs text-surface-500">Pour recevoir l’essai, ajoutez votre numéro de mobile à votre profil.</p>}
        </div>
      )}

      <Modal isOpen={!!confirmer} onClose={() => setConfirmer(null)} title={confirmer === 'programmer' ? 'Programmer la campagne' : 'Envoyer la campagne'}>
        <div className="space-y-4 text-sm text-surface-700">
          <p>
            {confirmer === 'programmer' && quand
              ? <>La campagne partira le <strong>{formatDate(new Date(quand).toISOString(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</strong>. L’audience sera calculée à ce moment-là.</>
              : <>L’audience est figée maintenant{calcul ? <> (environ <strong>{calcul.total}</strong> destinataires)</> : null}, puis les {email ? 'e-mails' : 'SMS'} partent par lots dans les minutes qui viennent.</>}
            {(() => {
              // SMS hors de la fenêtre (nuit, dimanche, férié) : le vrai départ
              const voulu = confirmer === 'programmer' && quand ? new Date(quand) : new Date()
              const depart = departSms(voulu)
              return depart && depart.getTime() - voulu.getTime() > 10 * 60000
                ? <> Les SMS ne partent que du lundi au samedi, de 8 h à 21 h 30, hors jours fériés : premier départ le <strong>{formatDate(depart.toISOString(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</strong>.</>
                : null
            })()}
          </p>
          <p className="flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-warning-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Un message parti ne se rattrape pas : vérifiez l’aperçu et envoyez-vous un essai avant.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmer(null)}>Annuler</Button>
            <Button onClick={envoyer} isLoading={pending}>{confirmer === 'programmer' ? 'Programmer' : 'Envoyer'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
