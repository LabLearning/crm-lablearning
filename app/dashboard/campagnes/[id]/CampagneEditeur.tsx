'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Mail, MessageSquare, Users, Eye, Send, CalendarClock, Copy, Trash2, Ban, AlertTriangle, Info, Save, RefreshCw,
} from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { ETAPES, ORIGINES, type EtapeLead, type OrigineLead } from '@/lib/leads-entrants'
import { STATUTS_CAMPAGNE, composerSms, compterSms, MAX_PARTIES_SMS, prochaineFenetreSms, type StatutCampagne } from '@/lib/campagnes/regles'
import {
  apercuEmailAction, arreterCampagneAction, calculerAudienceAction, dupliquerCampagneAction, enregistrerCampagneAction,
  envoyerEssaiAction, programmerCampagneAction, supprimerCampagneAction,
} from '../actions'
import { STYLE_STATUT } from '../CampagnesListe'

interface Audience {
  leads: { actif: boolean; origines: OrigineLead[]; etapes: EtapeLead[]; depuisJours: number | null }
  contacts: { actif: boolean; departements: string[]; franchiseId: string | null; principalSeulement: boolean }
}

/** Jamais au-delà de 3 ans : la durée de conservation des prospects annoncée sur le site */
const PERIODES: { jours: number; label: string }[] = [
  { jours: 30, label: '30 derniers jours' }, { jours: 90, label: '3 derniers mois' }, { jours: 180, label: '6 derniers mois' },
  { jours: 365, label: '12 derniers mois' }, { jours: 1095, label: '3 dernières années' },
]

const section = 'card p-5 space-y-4'
const titre = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-500'
const puce = (actif: boolean) => cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
  actif ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300')

function audienceDe(brut: any): Audience {
  return {
    leads: {
      actif: brut?.leads?.actif === true,
      origines: Array.isArray(brut?.leads?.origines) ? brut.leads.origines : [],
      etapes: Array.isArray(brut?.leads?.etapes) ? brut.leads.etapes : [],
      depuisJours: typeof brut?.leads?.depuisJours === 'number' ? brut.leads.depuisJours : 1095,
    },
    contacts: {
      actif: brut?.contacts?.actif === true,
      departements: Array.isArray(brut?.contacts?.departements) ? brut.contacts.departements : [],
      franchiseId: brut?.contacts?.franchiseId || null,
      principalSeulement: brut?.contacts?.principalSeulement === true,
    },
  }
}

/** Date et heure locales (« 2026-10-27T09:30 ») pour le champ de programmation */
const versChampDate = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CampagneEditeur({ campagne, franchises, manques, numeroStop, expediteurSms, expediteurEmail, envois, derniersEchecs, derniereErreur, aMonMobile }: {
  campagne: any
  franchises: { id: string; nom: string }[]
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
  const [audience, setAudience] = useState<Audience>(() => audienceDe(campagne.audience))
  const [departements, setDepartements] = useState<string>(audienceDe(campagne.audience).contacts.departements.join(', '))
  const [calcul, setCalcul] = useState<{ total: number; exemples: string[]; exclus: { sansCoordonnee: number; opposition: number; doublon: number; particulier: number; ancien: number } } | null>(null)
  const [apercu, setApercu] = useState<{ objet: string; html: string } | null>(null)
  const [quand, setQuand] = useState<string>('')
  const [confirmer, setConfirmer] = useState<'maintenant' | 'programmer' | null>(null)
  // Date minimale du champ de programmation : lue après l'affichage (l'heure du serveur ferait un écart d'hydratation)
  const [minimum, setMinimum] = useState<string | undefined>(undefined)
  useEffect(() => { setMinimum(versChampDate(new Date().toISOString())) }, [])

  const sms = useMemo(() => (email ? null : compterSms(composerSms(contenu, numeroStop))), [email, contenu, numeroStop])
  const audienceEnvoyee = useMemo(() => ({
    ...audience,
    contacts: { ...audience.contacts, departements: departements.split(/[\s,;]+/).map((d) => d.trim().toUpperCase()).filter(Boolean) },
  }), [audience, departements])
  // Un filtre change : le décompte affiché ne vaut plus (la fenêtre de confirmation le reprendrait sinon)
  useEffect(() => { setCalcul(null) }, [audienceEnvoyee, campagne.canal])
  /** SMS : premier départ possible (lundi-samedi, 8 h - 21 h 30, hors fériés) à partir d'une date */
  const departSms = (depuis: Date) => (email ? null : prochaineFenetreSms(depuis))

  // Aperçu de l'e-mail enregistré, à l'ouverture d'une campagne qui n'est plus un brouillon
  useEffect(() => {
    if (email && !brouillon) voirApercu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const champs = () => ({ nom, objet, contenu, bouton_libelle: boutonLibelle || null, bouton_url: boutonUrl || null, audience: audienceEnvoyee })

  async function enregistrer(silencieux = false): Promise<boolean> {
    const r = await enregistrerCampagneAction(campagne.id, champs())
    if (!r?.success) { toast('error', r?.error || 'Pas de réponse du serveur : réessayez'); return false }
    if (!silencieux) toast('success', 'Brouillon enregistré')
    return true
  }
  function calculer() {
    startTransition(async () => {
      const r = await calculerAudienceAction(campagne.canal, audienceEnvoyee)
      if (r?.success && r.data) setCalcul(r.data)
      else toast('error', r?.error || 'Calcul impossible')
    })
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
    if (!confirm(statut === 'programmee' ? 'Déprogrammer cette campagne ? Elle redevient un brouillon.' : 'Arrêter l’envoi ? Ce qui n’est pas encore parti ne partira pas.')) return
    startTransition(async () => {
      const r = await arreterCampagneAction(campagne.id)
      if (r?.success) { toast('success', statut === 'programmee' ? 'Campagne déprogrammée' : 'Envoi arrêté'); router.refresh() }
      else toast('error', r?.error || 'Pas de réponse du serveur : réessayez')
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

  const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])
  const majLeads = (p: Partial<Audience['leads']>) => setAudience((a) => ({ ...a, leads: { ...a.leads, ...p } }))
  const majContacts = (p: Partial<Audience['contacts']>) => setAudience((a) => ({ ...a, contacts: { ...a.contacts, ...p } }))

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

      {/* Audience */}
      <div className={section}>
        <div className={titre}><Users className="h-3.5 w-3.5" /> Audience</div>
        <fieldset disabled={!brouillon} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-surface-800">
            <input type="checkbox" checked={audience.leads.actif} onChange={(e) => majLeads({ actif: e.target.checked })} className="h-4 w-4 accent-brand-500" />
            Leads
          </label>
          {audience.leads.actif && (
            <div className="ml-6 space-y-3">
              <div>
                <div className="mb-1.5 text-xs text-surface-500">Origine (aucune choisie : toutes)</div>
                <div className="flex flex-wrap gap-1.5">
                  {ORIGINES.map((o) => <button key={o.id} type="button" onClick={() => majLeads({ origines: basculer(audience.leads.origines, o.id) })} className={puce(audience.leads.origines.includes(o.id))}>{o.court}</button>)}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs text-surface-500">Étape (aucune choisie : toutes)</div>
                <div className="flex flex-wrap gap-1.5">
                  {ETAPES.map((e) => <button key={e.id} type="button" onClick={() => majLeads({ etapes: basculer(audience.leads.etapes, e.id) })} className={puce(audience.leads.etapes.includes(e.id))}>{e.label}</button>)}
                </div>
              </div>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs text-surface-500">Demande reçue</span>
                <select value={audience.leads.depuisJours ?? 1095} onChange={(e) => majLeads({ depuisJours: Number(e.target.value) })} className="input-base w-full">
                  {PERIODES.map((p) => <option key={p.jours} value={p.jours}>{p.label}</option>)}
                </select>
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-surface-800">
            <input type="checkbox" checked={audience.contacts.actif} onChange={(e) => majContacts({ actif: e.target.checked })} className="h-4 w-4 accent-brand-500" />
            Contacts des clients
          </label>
          {audience.contacts.actif && (
            <div className="ml-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-surface-500">Départements (vide : tous), ex. 34, 13, 69</span>
                <input value={departements} onChange={(e) => setDepartements(e.target.value)} className="input-base w-full" placeholder="Tous" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-surface-500">Réseau de franchise</span>
                <select value={audience.contacts.franchiseId || ''} onChange={(e) => majContacts({ franchiseId: e.target.value || null })} className="input-base w-full">
                  <option value="">Tous les clients</option>
                  {franchises.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-surface-700 sm:col-span-2">
                <input type="checkbox" checked={audience.contacts.principalSeulement} onChange={(e) => majContacts({ principalSeulement: e.target.checked })} className="h-4 w-4 accent-brand-500" />
                Seulement le contact principal de chaque client
              </label>
            </div>
          )}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 border-t border-surface-100 pt-3">
          <Button size="sm" variant="secondary" onClick={calculer} isLoading={pending && !calcul} icon={<RefreshCw className="h-3.5 w-3.5" />}>Calculer l’audience</Button>
          {calcul && (
            <span className="text-sm text-surface-700">
              <span className="font-semibold text-surface-900 tabular-nums">{calcul.total}</span> destinataire{calcul.total > 1 ? 's' : ''}
              <span className="text-xs text-surface-500"> · écartés : {calcul.exclus.sansCoordonnee} sans {email ? 'e-mail' : 'mobile'}, {calcul.exclus.opposition} opposés (désinscription, STOP, rebond, case du site), {calcul.exclus.doublon} en double, {calcul.exclus.particulier} particuliers ou sans établissement, {calcul.exclus.ancien} clients sans relation depuis 3 ans</span>
            </span>
          )}
        </div>
        {calcul && calcul.exemples.length > 0 && <p className="text-xs text-surface-500">Par exemple : {calcul.exemples.join(' ; ')}</p>}
        <p className="text-xs text-surface-400">
          Professionnels seulement : les particuliers ne sont jamais écrits. Les personnes opposées (lien, STOP, rebond, case du site) sont écartées, au lancement comme à l’envoi.
          Les anciens leads (salons, phoning, demandes d’avant le 24/10/2026) n’ont pas été informés de ces envois quand leurs coordonnées ont été prises : à n’inclure qu’en connaissance de cause.
        </p>
      </div>

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
                <span className="mb-1 block text-xs text-surface-500">Texte : {'{prenom}'} et {'{etablissement}'} sont remplacés pour chacun, **gras**, les adresses web deviennent des liens</span>
                <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={10} className="input-base w-full" placeholder={'Bonjour {prenom},\n\n…'} />
              </label>
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
                <span className="mb-1 block text-xs text-surface-500">Message : « Lab Learning : » est ajouté devant et la mention STOP à la fin ; {'{prenom}'} est remplacé pour chacun</span>
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
