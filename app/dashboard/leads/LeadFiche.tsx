'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Phone, Mail, Whatsapp, Globe, Meta, Google, CheckCircle2, XCircle, Loader2, PenTool, Trash2,
  CalendarClock, MessageSquare, PhoneCall, Calendar, StickyNote, ArrowRight, Building2, Megaphone, Copy, Check, Handshake,
} from '@/components/ui/icons'
import { Button, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import {
  ETAPES, MOTIFS_PERTE, ORIGINES, aRefaitUneDemande, etapeDuLead, numeroWhatsapp, origineDuLead, publiciteDuLead, type EtapeLead,
} from '@/lib/leads-entrants'
import {
  ajouterEchangeLeadAction, attribuerLeadAction, changerEtapeLeadAction, historiqueLeadAction,
  modifierCoordonneesLeadAction, planifierRappelLeadAction, supprimerLeadAction,
} from './suivi-actions'
import type { MembreEquipe } from './LeadsInbox'

type Historique = NonNullable<Awaited<ReturnType<typeof historiqueLeadAction>>['data']>

const TYPES_ECHANGE: { id: 'appel' | 'email' | 'rdv' | 'note'; label: string; Icone: any }[] = [
  { id: 'appel', label: 'Appel', Icone: PhoneCall },
  { id: 'email', label: 'E-mail', Icone: Mail },
  { id: 'rdv', label: 'Rendez-vous', Icone: Calendar },
  { id: 'note', label: 'Note', Icone: StickyNote },
]
const LIBELLE_ECHANGE: Record<string, string> = { appel: 'Appel', email: 'E-mail', rdv: 'Rendez-vous', note: 'Note', relance: 'Relance', autre: 'Suivi' }

/** Champs d'origine montrés, dans l'ordre, avec leur libellé */
const CHAMPS_ORIGINE: [string, string][] = [
  ['plateforme', 'Plateforme'], ['campagne', 'Campagne'], ['ensemble', 'Ensemble de publicités'], ['annonce', 'Publicité'],
  ['formulaire', 'Formulaire'], ['utm_source', 'Source (UTM)'], ['utm_medium', 'Support (UTM)'], ['utm_campaign', 'Campagne (UTM)'],
  ['utm_content', 'Contenu (UTM)'], ['utm_term', 'Mot-clé (UTM)'], ['page_arrivee', 'Page d’arrivée'],
]
const PLATEFORMES: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', audience_network: 'Audience Network', whatsapp: 'WhatsApp', google: 'Google', youtube: 'YouTube' }

const section = 'rounded-xl border border-surface-200/80 p-4'
const titreSection = 'mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-500'

/**
 * Fiche d'un lead, remontée pour chaque lead (key) : l'état local repart du bon lead.
 * Suivi : un responsable attribue à qui il veut ; les autres prennent un lead
 * libre ou cessent de suivre le leur (même règle côté serveur, lib/leads-acces).
 */
export function LeadFiche({ lead, equipe, moi, peutSuivre, estResponsable, peutSupprimer, peutCreerDossier, clientsAccessibles, aujourdhui, onSupprime }: {
  lead: any
  equipe: MembreEquipe[]
  moi: string
  peutSuivre: boolean
  estResponsable: boolean
  peutSupprimer: boolean
  peutCreerDossier: boolean
  /** Commercial : clients de son portefeuille ; null : tous */
  clientsAccessibles: string[] | null
  aujourdhui: string
  onSupprime: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const etape = etapeDuLead(lead)
  const origine = origineDuLead(lead.source)
  const pub = publiciteDuLead(lead)
  const wa = numeroWhatsapp(lead.contact_telephone)
  const attribution = (lead.attribution || {}) as Record<string, any>
  const reponses: { question: string; reponse: string }[] = Array.isArray(lead.reponses) ? lead.reponses : []

  const [historique, setHistorique] = useState<Historique | null>(null)
  const [choixPerte, setChoixPerte] = useState(false)
  const [motif, setMotif] = useState('')
  const [typeEchange, setTypeEchange] = useState<'appel' | 'email' | 'rdv' | 'note'>('appel')
  const [texteEchange, setTexteEchange] = useState('')
  const [rappelDate, setRappelDate] = useState<string>(lead.next_action_date || '')
  const [rappelQuoi, setRappelQuoi] = useState<string>(lead.next_action || '')
  const [edition, setEdition] = useState(false)
  // Coordonnées à corriger : reprises du lead à chaque ouverture de l'édition (un lead complété entre-temps,
  // ou une correction annulée, ne repart pas d'un état ancien)
  const coordDuLead = () => ({
    contact_prenom: lead.contact_prenom || '', contact_nom: lead.contact_nom || '', contact_email: lead.contact_email || '',
    contact_telephone: lead.contact_telephone || '', contact_poste: lead.contact_poste || '', entreprise: lead.entreprise || '',
    ville: lead.ville || '', code_postal: lead.code_postal || '',
  })
  const [coord, setCoord] = useState(coordDuLead)
  const [copie, setCopie] = useState<string | null>(null)

  async function chargerHistorique() {
    const r = await historiqueLeadAction(lead.id)
    if (r.success && r.data) setHistorique(r.data)
  }
  useEffect(() => {
    setHistorique(null)
    chargerHistorique()
    setRappelDate(lead.next_action_date || '')
    setRappelQuoi(lead.next_action || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.updated_at])

  // Après une action, réussie ou refusée, la fiche est relue : un refus vient souvent d'un lead changé entre-temps
  function apres(r: { success: boolean; error?: string } | undefined, message: string) {
    if (r?.success) toast('success', message)
    else toast('error', r?.error || 'Pas de réponse du serveur : réessayez')
    router.refresh()
  }

  function changerEtape(e: EtapeLead) {
    if (e === etape) return
    if (e === 'perdu') { setChoixPerte(true); return }
    startTransition(async () => apres(await changerEtapeLeadAction(lead.id, e), `Lead passé à « ${ETAPES.find((x) => x.id === e)?.label} »`))
  }
  function confirmerPerte() {
    startTransition(async () => {
      const r = await changerEtapeLeadAction(lead.id, 'perdu', motif || null)
      if (r?.success) { setChoixPerte(false); setMotif('') }
      apres(r, 'Lead marqué perdu')
    })
  }
  function noterEchange() {
    if (!texteEchange.trim()) return
    startTransition(async () => {
      const r = await ajouterEchangeLeadAction(lead.id, typeEchange, texteEchange)
      if (r?.success) {
        setTexteEchange('')
        toast('success', r.data?.etapeChangee ? 'Échange noté, lead passé à « Contacté »' : 'Échange noté')
        router.refresh()
        chargerHistorique()
      } else toast('error', r?.error || 'Pas de réponse du serveur : réessayez')
    })
  }
  function enregistrerRappel(date: string | null) {
    startTransition(async () => apres(await planifierRappelLeadAction(lead.id, date, rappelQuoi || null), date ? 'Rappel programmé' : 'Rappel retiré'))
  }
  function attribuer(userId: string) {
    const message = userId === moi ? 'Vous suivez ce lead' : userId ? 'Lead attribué' : lead.assigned_to === moi ? 'Vous ne suivez plus ce lead' : 'Lead sans suivi attitré'
    startTransition(async () => apres(await attribuerLeadAction(lead.id, userId || null), message))
  }
  function enregistrerCoordonnees() {
    startTransition(async () => {
      const r = await modifierCoordonneesLeadAction(lead.id, coord)
      if (r?.success) setEdition(false)
      apres(r, 'Coordonnées enregistrées')
    })
  }
  function supprimer() {
    if (!confirm(`Supprimer définitivement le lead de ${[lead.contact_prenom, lead.contact_nom].filter(Boolean).join(' ') || 'ce prospect'} ? Ses coordonnées, ses réponses, ses échanges et ses e-mails seront effacés du CRM ; seul l’identifiant technique de sa demande chez Meta ou Google est gardé, pour ne pas la réimporter.`)) return
    startTransition(async () => {
      const r = await supprimerLeadAction(lead.id)
      if (r?.success) { onSupprime(); toast('success', 'Lead supprimé'); router.refresh() }
      else toast('error', r?.error || 'Pas de réponse du serveur : réessayez')
    })
  }
  async function copier(texte: string, quoi: string) {
    try { await navigator.clipboard.writeText(texte); setCopie(quoi); setTimeout(() => setCopie(null), 1500) } catch { /* presse-papiers refusé */ }
  }

  const libelleOrigine = ORIGINES.find((o) => o.id === origine)?.label || 'Autre origine'
  const IconeCanal = origine === 'meta' ? Meta : origine === 'google_ads' ? Google : origine === 'site' ? Globe : origine === 'apporteur' ? Handshake : Building2
  const gagne = !!lead.converted_client_id || lead.status === 'gagne'
  const nomSuivi = lead.assigned_to
    ? (() => {
        const u = equipe.find((x) => x.id === lead.assigned_to) || lead.assigned_user
        return u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Une personne de l’équipe' : 'Une personne de l’équipe'
      })()
    : null
  const champsOrigine = CHAMPS_ORIGINE
    .map(([cle, libelle]) => [libelle, cle === 'plateforme' ? (PLATEFORMES[String(attribution[cle] || '').toLowerCase()] || attribution[cle]) : attribution[cle]] as [string, any])
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  // Identifiant de clic : celui de Google vient d'une annonce ; celui de Meta (fbclid) est ajouté à tout lien
  // ouvert depuis Facebook ou Instagram, publicité ou non
  const clicGoogle = ['gclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid'].some((k) => attribution[k])
  const clicMeta = !!attribution.fbclid
  const identifiantsClic = [clicGoogle ? 'Google Ads' : null, clicMeta ? 'Facebook ou Instagram' : null].filter(Boolean) as string[]

  return (
    <div className="space-y-4">
      {/* Origine et réception */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-surface-600">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-700">
          <IconeCanal className="h-3.5 w-3.5" /> {libelleOrigine}
        </span>
        {pub && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-700">
            {pub === 'meta' ? <Meta className="h-3.5 w-3.5" /> : <Google className="h-3.5 w-3.5" />} venu d’une publicité {pub === 'meta' ? 'Meta' : 'Google'}
          </span>
        )}
        <span className="text-xs text-surface-500">
          Reçu le {formatDate(lead.created_at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {aRefaitUneDemande(lead) ? ` · nouvelle demande le ${formatDate(lead.derniere_demande_le, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}
          {lead.contacte_le ? ` · premier contact le ${formatDate(lead.contacte_le, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
      </div>

      {/* Joindre le prospect */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {lead.contact_telephone ? (
          <a href={`tel:${String(lead.contact_telephone).replace(/\s+/g, '')}`}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Phone className="h-4 w-4" /> {lead.contact_telephone}
          </a>
        ) : <span className="flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-surface-200 text-xs text-surface-400">Pas de téléphone</span>}
        {wa ? (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50/40">
            <Whatsapp className="h-4 w-4" /> WhatsApp
          </a>
        ) : <span className="hidden sm:block" />}
        {lead.contact_email ? (
          <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-xl border border-surface-200">
            <a href={`mailto:${lead.contact_email}`} className="flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-brand-50/40">
              <Mail className="h-4 w-4 shrink-0" /><span className="truncate">{lead.contact_email}</span>
            </a>
            <button type="button" onClick={() => copier(lead.contact_email, 'email')} aria-label="Copier l’adresse e-mail"
              className="border-l border-surface-200 px-2.5 text-surface-400 hover:bg-surface-50 hover:text-surface-700">
              {copie === 'email' ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        ) : <span className="flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-surface-200 text-xs text-surface-400">Pas d’e-mail</span>}
      </div>

      {/* Étape */}
      <div className={section}>
        <div className={titreSection}>Étape</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Étape du lead">
          {ETAPES.map((e) => {
            // Relié à un client, le lead reste « Gagné » : seul « Perdu » le sort de là
            const bloque = !!lead.converted_client_id && e.id !== 'gagne' && e.id !== 'perdu'
            return (
            <button key={e.id} type="button" role="radio" aria-checked={etape === e.id} disabled={!peutSuivre || pending || bloque}
              onClick={() => changerEtape(e.id)} title={bloque ? 'Lead relié à un client' : e.aide}
              className={cn('min-h-[40px] rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default',
                etape === e.id
                  ? e.id === 'perdu' ? 'border-surface-400 bg-surface-100 text-surface-700' : e.id === 'gagne' ? 'border-success-500 bg-success-50 text-success-700' : 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-surface-200 text-surface-500 hover:border-surface-300 hover:text-surface-800')}>
              {e.label}
            </button>
            )
          })}
        </div>
        {etape === 'perdu' && lead.lost_reason && <p className="mt-2 text-xs text-surface-500">Motif : {lead.lost_reason}</p>}
        {choixPerte && (
          <div className="mt-3 space-y-2 rounded-lg bg-surface-50 p-3">
            <div className="text-xs font-medium text-surface-700">Pourquoi ce lead est-il perdu ?</div>
            <div className="flex flex-wrap gap-1.5">
              {MOTIFS_PERTE.map((m) => (
                <button key={m} type="button" onClick={() => setMotif(m)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs', motif === m ? 'border-surface-900 bg-surface-900 text-white' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300')}>
                  {m}
                </button>
              ))}
            </div>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ou écrivez le motif" className="input-base w-full" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setChoixPerte(false); setMotif('') }}>Annuler</Button>
              <Button size="sm" onClick={confirmerPerte} isLoading={pending}>Marquer perdu</Button>
            </div>
          </div>
        )}
      </div>

      {/* Sa demande */}
      <div className={section}>
        <div className={titreSection}><MessageSquare className="h-3.5 w-3.5" /> Sa demande</div>
        {reponses.length > 0 ? (
          <dl className="space-y-2.5">
            {reponses.map((r, i) => (
              <div key={i}>
                <dt className="text-xs text-surface-500">{r.question}</dt>
                <dd className="text-sm text-surface-900 whitespace-pre-wrap [overflow-wrap:anywhere]">{r.reponse}</dd>
              </div>
            ))}
          </dl>
        ) : lead.commentaire ? (
          <p className="text-sm text-surface-700 whitespace-pre-wrap [overflow-wrap:anywhere]">{lead.commentaire}</p>
        ) : (
          <p className="text-sm text-surface-400">Pas de détail enregistré.</p>
        )}
        {(lead.formation_souhaitee || lead.effectif_libelle) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {lead.formation_souhaitee && <span className="rounded-full border border-surface-200 px-2.5 py-1 text-xs text-surface-700">{lead.formation_souhaitee}</span>}
            {lead.effectif_libelle && <span className="rounded-full border border-surface-200 px-2.5 py-1 text-xs text-surface-700">{lead.effectif_libelle}</span>}
          </div>
        )}
        {reponses.length > 0 && lead.commentaire && (
          <details className="mt-3 text-xs text-surface-500">
            <summary className="cursor-pointer select-none font-medium text-surface-600">Journal du lead</summary>
            <p className="mt-1.5 whitespace-pre-wrap">{lead.commentaire}</p>
          </details>
        )}
      </div>

      {/* Origine détaillée */}
      {(champsOrigine.length > 0 || identifiantsClic.length > 0) && (
        <div className={section}>
          <div className={titreSection}><Megaphone className="h-3.5 w-3.5" /> D’où vient-il</div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {champsOrigine.map(([libelle, valeur]) => (
              <div key={libelle} className="min-w-0">
                <dt className="text-xs text-surface-500">{libelle}</dt>
                <dd className="text-sm text-surface-900 [overflow-wrap:anywhere]">{String(valeur)}</dd>
              </div>
            ))}
            {identifiantsClic.length > 0 && (
              <div className="min-w-0">
                <dt className="text-xs text-surface-500">Identifiant de clic</dt>
                <dd className="text-sm text-surface-900">{identifiantsClic.join(', ')} (gardé pour mesurer les campagnes)</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Suivi : qui, et quand rappeler */}
      {peutSuivre && (
        <div className={section}>
          <div className={titreSection}><CalendarClock className="h-3.5 w-3.5" /> Suivi</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {estResponsable ? (
              <label className="block">
                <span className="mb-1 block text-xs text-surface-500">Suivi par</span>
                <select value={lead.assigned_to || ''} onChange={(e) => attribuer(e.target.value)} disabled={pending} className="input-base w-full">
                  <option value="">Personne</option>
                  {/* Une personne qui a quitté l'équipe reste affichée tant que le lead lui est attribué */}
                  {lead.assigned_to && !equipe.some((u) => u.id === lead.assigned_to) && <option value={lead.assigned_to}>{nomSuivi}</option>}
                  {equipe.map((u) => <option key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(' ')}</option>)}
                </select>
              </label>
            ) : (
              <div>
                <span className="mb-1 block text-xs text-surface-500">Suivi par</span>
                <div className="flex min-h-[42px] flex-wrap items-center gap-2">
                  <span className="text-sm text-surface-800">{lead.assigned_to === moi ? 'Vous' : nomSuivi || 'Personne'}</span>
                  {!gagne && !lead.assigned_to && (
                    <Button size="sm" variant="secondary" onClick={() => attribuer(moi)} disabled={pending}>Je prends ce lead</Button>
                  )}
                  {!gagne && lead.assigned_to === moi && (
                    <Button size="sm" variant="secondary" onClick={() => attribuer('')} disabled={pending}>Ne plus le suivre</Button>
                  )}
                </div>
              </div>
            )}
            <div>
              <span className="mb-1 block text-xs text-surface-500">Prochain rappel</span>
              <div className="flex gap-2">
                <input type="date" value={rappelDate} min={aujourdhui} onChange={(e) => setRappelDate(e.target.value)} className="input-base w-full" aria-label="Date du prochain rappel" />
                {lead.next_action_date && (
                  <button type="button" onClick={() => { setRappelDate(''); enregistrerRappel(null) }} disabled={pending} aria-label="Retirer le rappel"
                    className="shrink-0 rounded-xl border border-surface-200 px-2.5 text-surface-400 hover:bg-surface-50 hover:text-surface-700"><XCircle className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input value={rappelQuoi} onChange={(e) => setRappelQuoi(e.target.value)} placeholder="Ce qu’il faut faire (ex. lui envoyer le programme)" className="input-base w-full" />
            <Button size="sm" variant="secondary" onClick={() => enregistrerRappel(rappelDate || null)} disabled={pending || (!rappelDate && !lead.next_action_date)}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {/* Échanges */}
      <div className={section}>
        <div className={titreSection}><PhoneCall className="h-3.5 w-3.5" /> Échanges</div>
        {peutSuivre && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type d’échange">
              {TYPES_ECHANGE.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={typeEchange === t.id} onClick={() => setTypeEchange(t.id)}
                  className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                    typeEchange === t.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:border-surface-300')}>
                  <t.Icone className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>
            <textarea value={texteEchange} onChange={(e) => setTexteEchange(e.target.value)} rows={2} className="input-base w-full resize-none"
              placeholder={typeEchange === 'appel' ? 'Ce qui s’est dit (besoin, nombre de salariés, financement…)' : typeEchange === 'note' ? 'Une note pour l’équipe' : 'Ce qui a été envoyé ou convenu'} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-surface-400">{etape === 'a_traiter' && typeEchange !== 'note' ? 'Le lead passera à « Contacté ».' : ''}</span>
              <Button size="sm" onClick={noterEchange} isLoading={pending} disabled={!texteEchange.trim()}>Noter l’échange</Button>
            </div>
          </div>
        )}
        <div className={cn(peutSuivre && 'mt-3 border-t border-surface-100 pt-3')}>
          {!historique ? (
            <div className="flex items-center gap-2 text-xs text-surface-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement de l’historique…</div>
          ) : historique.echanges.length === 0 && historique.receptions.length === 0 ? (
            <p className="text-xs text-surface-400">Aucun échange noté pour l’instant.</p>
          ) : (
            <ol className="space-y-2">
              {[
                ...historique.echanges.map((e) => ({ cle: `e-${e.id}`, date: e.date, titre: e.subject === 'Étape' ? 'Suivi' : LIBELLE_ECHANGE[e.type] || 'Échange', texte: e.content, auteur: e.auteur, reponses: [] as { question: string; reponse: string }[] })),
                // Chaque formulaire rempli, avec ses réponses : la fiche ne garde que celles du premier
                ...historique.receptions.map((r) => ({ cle: `r-${r.id}`, date: r.recu_le, titre: r.canal === 'meta' ? 'Formulaire Meta' : r.canal === 'google_ads' ? 'Formulaire Google' : 'Formulaire du site', texte: r.evenement, auteur: null, reponses: r.reponses || [] })),
              ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).map((x) => (
                <li key={x.cle} className="rounded-lg bg-surface-50 px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-surface-500">
                    <span className="font-semibold text-surface-700">{x.titre}</span>
                    <span className="tabular-nums">{formatDate(x.date, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {x.auteur && <span>· {x.auteur}</span>}
                  </div>
                  {x.texte && <p className="mt-0.5 text-sm text-surface-700 whitespace-pre-wrap [overflow-wrap:anywhere]">{x.texte}</p>}
                  {x.reponses.length > 0 && (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer select-none font-medium text-surface-600">Ses réponses ({x.reponses.length})</summary>
                      <dl className="mt-1.5 space-y-1.5">
                        {x.reponses.map((r, i) => (
                          <div key={i}>
                            <dt className="text-surface-500">{r.question}</dt>
                            <dd className="text-sm text-surface-800 whitespace-pre-wrap [overflow-wrap:anywhere]">{r.reponse}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Coordonnées */}
      {peutSuivre && (
        <div className={section}>
          <div className="flex items-center justify-between">
            <div className={cn(titreSection, 'mb-0')}>Coordonnées</div>
            {!edition && (
              <button type="button" onClick={() => { setCoord(coordDuLead()); setEdition(true) }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline">
                <PenTool className="h-3.5 w-3.5" /> Corriger
              </button>
            )}
          </div>
          {edition ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ['contact_prenom', 'Prénom'], ['contact_nom', 'Nom'], ['contact_telephone', 'Téléphone'], ['contact_email', 'E-mail'],
                  ['entreprise', 'Établissement'], ['contact_poste', 'Fonction'], ['code_postal', 'Code postal'], ['ville', 'Ville'],
                ] as [keyof typeof coord, string][]).map(([cle, libelle]) => (
                  <label key={cle} className="block">
                    <span className="mb-1 block text-xs text-surface-500">{libelle}{cle === 'contact_nom' ? ' *' : ''}</span>
                    <input value={coord[cle]} onChange={(e) => setCoord((c) => ({ ...c, [cle]: e.target.value }))} className="input-base w-full"
                      type={cle === 'contact_email' ? 'email' : cle === 'contact_telephone' ? 'tel' : 'text'} />
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setCoord(coordDuLead()); setEdition(false) }}>Annuler</Button>
                <Button size="sm" onClick={enregistrerCoordonnees} isLoading={pending}>Enregistrer</Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-surface-600">
              {[lead.contact_poste, lead.code_postal && lead.ville ? `${lead.code_postal} ${lead.ville}` : lead.ville].filter(Boolean).join(' · ') || 'Corrigez le nom, l’établissement ou la ville après l’appel.'}
            </p>
          )}
        </div>
      )}

      {/* Suite */}
      <div className="flex flex-col-reverse gap-2 border-t border-surface-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {peutSupprimer ? (
          <button type="button" onClick={supprimer} disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50">
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
        ) : <span />}
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Un commercial n'ouvre que les clients de son portefeuille : la fiche le renverrait vers la liste */}
          {lead.converted_client_id && (!clientsAccessibles || clientsAccessibles.includes(lead.converted_client_id)) && (
            <Link href={`/dashboard/clients/${lead.converted_client_id}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50/40">
              <Building2 className="h-4 w-4" /> Voir le client
            </Link>
          )}
          {lead.session_id && (
            <Link href={`/dashboard/sessions/${lead.session_id}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50/40">
              <CheckCircle2 className="h-4 w-4" /> Voir la session
            </Link>
          )}
          {/* Même règle que l'assistant : un commercial monte le dossier d'un lead à lui ou que personne ne suit */}
          {peutSuivre && peutCreerDossier && etape !== 'perdu' && !lead.session_id && (estResponsable || !lead.assigned_to || lead.assigned_to === moi) && (
            <Link href={`/dashboard/dossiers/nouveau?lead=${lead.id}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
              Créer le dossier <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
