'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Search, X, Phone, Mail, Whatsapp, Globe, Meta, Facebook, Instagram, Google, Settings2, Download,
  CalendarClock, Building2, MapPin, AlertTriangle, UserRound, Archive, Timer, TrendingUp, Clock, Users, Handshake, Repeat,
} from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import {
  ETAPES, ORIGINES, aRefaitUneDemande, dateDemande, dureeLisible, estEntrant, etapeDuLead, numeroWhatsapp, origineDuLead,
  publiciteDuLead, type EtapeLead, type OrigineLead,
} from '@/lib/leads-entrants'
import { modeleParSlug, nomModele } from '@/lib/modeles'
import { LeadFiche } from './LeadFiche'

export interface MembreEquipe { id: string; first_name: string | null; last_name: string | null; role: string }

interface Props {
  leads: any[]
  equipe: MembreEquipe[]
  clientsQuiOntRepondu: any[]
  canaux: { canal: string; actif: boolean; derniere_reception_at: string | null; derniere_erreur: string | null; derniere_erreur_at: string | null }[]
  migrationManquante: boolean
  indicateurs: {
    ouverts: number; aTraiter: number; aTraiterDepuis24h: number; recus7j: number
    parOrigine7j: Record<OrigineLead, number>
    delaiMedianMs: number | null; delaisMesures: number; entrants90j: number; gagnes90j: number
  }
  /** Date du jour à Paris (AAAA-MM-JJ), calculée par le serveur */
  aujourdhui: string
  moi: string
  leadOuvert: string | null
  peutSuivre: boolean
  /** Réattribue librement et supprime (lib/leads-acces) */
  estResponsable: boolean
  peutSupprimer: boolean
  peutGererCanaux: boolean
  /** Droit de créer une session par l'assistant Nouveau dossier */
  peutCreerDossier: boolean
  /** Commercial : clients de son portefeuille (lien « Voir le client ») ; null pour les autres rôles */
  clientsAccessibles: string[] | null
}

type FiltreEtape = 'ouverts' | EtapeLead | 'tous'
type FiltreOrigine = 'tous' | OrigineLead

const STYLE_ORIGINE: Record<OrigineLead, string> = {
  site: 'bg-brand-50 text-brand-600',
  meta: 'bg-info-50 text-info-600',
  google_ads: 'bg-warning-50 text-warning-700',
  apporteur: 'bg-surface-100 text-surface-700',
  ancien: 'bg-surface-100 text-surface-500',
}

const STYLE_ETAPE: Record<EtapeLead, string> = {
  a_traiter: 'bg-accent-50 text-success-700 ring-1 ring-accent-300',
  contacte: 'bg-info-50 text-info-600',
  qualifie: 'bg-warning-50 text-warning-700',
  gagne: 'bg-success-50 text-success-700',
  perdu: 'bg-surface-100 text-surface-500',
}

export function IconeOrigine({ lead, className }: { lead: any; className?: string }) {
  const origine = origineDuLead(lead.source)
  const plateforme = String(lead.attribution?.plateforme || '').toLowerCase()
  const Icone = origine === 'meta' ? (plateforme === 'instagram' ? Instagram : plateforme === 'facebook' ? Facebook : Meta)
    : origine === 'google_ads' ? Google
    : origine === 'site' ? Globe
    : origine === 'apporteur' ? Handshake
    : Archive
  const libelle = ORIGINES.find((o) => o.id === origine)?.label || 'Origine inconnue'
  return (
    <span title={libelle} aria-label={libelle} className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', STYLE_ORIGINE[origine], className)}>
      <Icone className="h-5 w-5" />
    </span>
  )
}

export function PastilleEtape({ etape }: { etape: EtapeLead }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', STYLE_ETAPE[etape])}>
      {ETAPES.find((e) => e.id === etape)?.label}
    </span>
  )
}

export const nomDuLead = (l: any) => [l.contact_prenom, l.contact_nom].filter(Boolean).join(' ') || l.contact_email || l.contact_telephone || 'Prospect'

/** Ce que le prospect a demandé, en une ligne. */
export function resumeDemande(l: any): string {
  const a = l.attribution || {}
  const origine = origineDuLead(l.source)
  if (origine === 'meta' || origine === 'google_ads') {
    return [a.formulaire ? `Formulaire « ${a.formulaire} »` : 'Formulaire publicitaire', a.campagne ? `campagne « ${a.campagne} »` : null]
      .filter(Boolean).join(' · ')
  }
  const tags: string[] = l.tags || []
  if (tags.includes('modele-gratuit')) {
    const modeles = tags.map((t) => modeleParSlug(t)).filter(Boolean).map((m) => nomModele(m!))
    return modeles.length ? `Modèle gratuit : ${modeles.join(', ')}` : 'Modèle gratuit téléchargé'
  }
  if (tags.includes('starkk-site')) return 'Demande de rappel (assistant Starkk du site)'
  if (tags.includes('contact')) {
    const sujet = (l.reponses || []).find((r: any) => r.question === 'Sujet')?.reponse
    return sujet ? `Message : « ${sujet} »` : 'Message depuis la page Contact'
  }
  const ligne = String(l.commentaire || '').split('\n').filter(Boolean).pop() || ''
  return ligne.replace(/^\[[^\]]+\]\s*/, '').slice(0, 140) || l.formation_souhaitee || ''
}

/** « il y a 12 min », « il y a 3 h », « hier à 18:40 », sinon la date. Seulement après l'affichage (voir maintenant). */
function ilYA(iso: string, maintenant: number): string {
  const ecart = maintenant - new Date(iso).getTime()
  if (ecart < 60000) return 'à l’instant'
  if (ecart < 3600000) return `il y a ${Math.floor(ecart / 60000)} min`
  if (ecart < 6 * 3600000) return `il y a ${Math.floor(ecart / 3600000)} h`
  const jour = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const hier = jour(new Date(maintenant - 86400000))
  const heure = new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  if (jour(new Date(iso)) === jour(new Date(maintenant))) return `aujourd’hui à ${heure}`
  if (jour(new Date(iso)) === hier) return `hier à ${heure}`
  return formatDate(iso, { day: 'numeric', month: 'short' })
}

export function LeadsInbox({
  leads, equipe, clientsQuiOntRepondu, canaux, migrationManquante, indicateurs, aujourdhui, moi, leadOuvert,
  peutSuivre, estResponsable, peutSupprimer, peutGererCanaux, peutCreerDossier, clientsAccessibles,
}: Props) {
  const chemin = usePathname()
  // ?lead= lu dans l'adresse : il revient à null après le nettoyage, et redevient l'identifiant au clic suivant
  // sur une notification, même pour le même lead (la valeur venue du serveur, elle, ne change plus)
  const leadDemande = useSearchParams()?.get('lead') || null
  const { toast } = useToast()
  const [origine, setOrigine] = useState<FiltreOrigine>('tous')
  const [etape, setEtape] = useState<FiltreEtape>('ouverts')
  const [recherche, setRecherche] = useState('')
  const [mesLeads, setMesLeads] = useState(false)
  const [ficheId, setFicheId] = useState<string | null>(null)
  const [tousLesClients, setTousLesClients] = useState(false)
  // Copie du lead ouvert : la fiche reste ouverte même si la liste revient d'un cache plus ancien
  const [ficheCopie, setFicheCopie] = useState<any>(null)
  const ouvrir = (l: any) => { setFicheId(l.id); setFicheCopie(l) }
  // L'heure n'est lue qu'après l'affichage : le rendu serveur et le premier rendu navigateur restent identiques
  const [maintenant, setMaintenant] = useState<number | null>(null)
  useEffect(() => {
    setMaintenant(Date.now())
    const t = setInterval(() => setMaintenant(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  // Ouverture depuis une notification (?lead=…), une seule fois. L'adresse est nettoyée sans navigation
  // (history.replaceState, suivi par le routeur) : un router.replace rejouerait une liste du cache
  useEffect(() => {
    const id = leadDemande || leadOuvert
    if (!id) return
    const l = leads.find((x) => x.id === id)
    if (l) ouvrir(l)
    else toast('error', 'Lead introuvable : il a peut-être été supprimé')
    window.history.replaceState(null, '', chemin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadDemande])

  const correspond = (l: any) => {
    if (mesLeads && l.assigned_to !== moi) return false
    const q = recherche.trim().toLowerCase()
    if (!q) return true
    const chiffres = q.replace(/\D/g, '')
    const texte = [l.contact_prenom, l.contact_nom, l.entreprise, l.contact_email, l.ville, (l.tags || []).join(' '), l.attribution?.campagne, l.attribution?.formulaire]
      .filter(Boolean).join(' ').toLowerCase()
    return texte.includes(q) || (chiffres.length >= 4 && String(l.contact_telephone || '').replace(/\D/g, '').includes(chiffres))
  }
  const etapeOk = (l: any, f: FiltreEtape) => {
    const e = etapeDuLead(l)
    return f === 'tous' || (f === 'ouverts' ? ['a_traiter', 'contacte', 'qualifie'].includes(e) : e === f)
  }
  // « Tous » : les demandes entrantes, dont un ancien lead qui a refait une demande
  const origineOk = (l: any, f: FiltreOrigine) => (f === 'tous' ? estEntrant(l) : origineDuLead(l.source) === f)

  const visibles = useMemo(() => leads.filter((l) => correspond(l) && etapeOk(l, etape) && origineOk(l, origine)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, recherche, mesLeads, etape, origine, moi])
  const comptesOrigine = useMemo(() => {
    const c: Record<FiltreOrigine, number> = { tous: 0, site: 0, meta: 0, google_ads: 0, apporteur: 0, ancien: 0 }
    for (const l of leads) {
      if (!correspond(l) || !etapeOk(l, etape)) continue
      c[origineDuLead(l.source)]++
      if (estEntrant(l)) c.tous++
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, recherche, mesLeads, etape, moi])
  const comptesEtape = useMemo(() => {
    const c: Record<string, number> = { ouverts: 0, tous: 0, a_traiter: 0, contacte: 0, qualifie: 0, gagne: 0, perdu: 0 }
    for (const l of leads) {
      if (!correspond(l) || !origineOk(l, origine)) continue
      const e = etapeDuLead(l)
      c[e]++
      c.tous++
      if (['a_traiter', 'contacte', 'qualifie'].includes(e)) c.ouverts++
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, recherche, mesLeads, origine, moi])

  const fiche = ficheId ? leads.find((l) => l.id === ficheId) || (ficheCopie?.id === ficheId ? ficheCopie : null) : null
  const canalMeta = canaux.find((c) => c.canal === 'meta')
  const canalGoogle = canaux.find((c) => c.canal === 'google_ads')

  function exporter() {
    const entetes = ['Reçu le', 'Dernière demande', 'Origine', 'Demande', 'Étape', 'Prénom', 'Nom', 'Établissement', 'Téléphone', 'E-mail', 'Ville', 'Suivi par']
    const lignes = visibles.map((l) => [
      new Date(l.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      aRefaitUneDemande(l) ? new Date(l.derniere_demande_le).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '',
      ORIGINES.find((o) => o.id === origineDuLead(l.source))?.label || '',
      resumeDemande(l),
      ETAPES.find((e) => e.id === etapeDuLead(l))?.label || '',
      l.contact_prenom || '', l.contact_nom || '', l.entreprise || '', l.contact_telephone || '', l.contact_email || '', l.ville || '',
      l.assigned_user ? [l.assigned_user.first_name, l.assigned_user.last_name].filter(Boolean).join(' ') : '',
    ])
    // Valeurs saisies sur le site ou dans une publicité : une cellule qui commence par = + - @ serait
    // lue comme une formule par Excel ; l'apostrophe la garde en texte
    const cellule = (c: unknown) => {
      const v = String(c ?? '')
      return `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
    }
    const csv = '﻿' + [entetes, ...lignes].map((r) => r.map(cellule).join(';')).join('\n')
    // Lien inséré dans la page et adresse gardée un moment : Safari (iPad) lit le fichier après le clic
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `leads_${aujourdhui}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    toast('success', `${visibles.length} lead${visibles.length > 1 ? 's' : ''} exporté${visibles.length > 1 ? 's' : ''}`)
  }

  const delai = indicateurs.delaiMedianMs != null ? dureeLisible(indicateurs.delaiMedianMs) : null

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Leads</h1>
          <p className="mt-1 text-sm text-surface-500">Les demandes reçues du site, des publicités Meta et Google et des apporteurs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exporter} icon={<Download className="h-3.5 w-3.5" />}>Exporter</Button>
          {peutGererCanaux && (
            <Link href="/dashboard/leads/canaux"
              className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
              <Settings2 className="h-4 w-4" /> Canaux
            </Link>
          )}
        </div>
      </div>

      {/* Canaux à brancher : seulement pour qui peut les brancher */}
      {peutGererCanaux && (migrationManquante || !canalMeta?.actif || !canalGoogle?.actif || canalMeta?.derniere_erreur) && (
        <div className="card flex flex-col gap-3 border-info-100 bg-info-50/60 p-4 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-info-600"><Meta className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1 text-sm text-surface-700">
            {migrationManquante
              ? <><span className="font-semibold text-surface-900">Migration 167 à appliquer.</span> Elle prépare la réception des prospects Meta et Google Ads et l’enregistrement des messages de la page Contact ; d’ici là, ces messages arrivent seulement par e-mail. Les modèles gratuits et les demandes de rappel arrivent déjà ici.</>
              : canalMeta?.actif && canalMeta?.derniere_erreur
                ? <><span className="font-semibold text-surface-900">Meta signale une erreur.</span> {canalMeta.derniere_erreur}</>
                : <><span className="font-semibold text-surface-900">{!canalMeta?.actif ? 'Meta n’est pas encore branché.' : 'Google Ads n’est pas encore branché.'}</span> Branchez vos formulaires publicitaires pour recevoir chaque prospect ici, dès qu’il les remplit.</>}
          </div>
          {!migrationManquante && (
            <Link href="/dashboard/leads/canaux" className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5 !px-4 !py-2 text-sm">
              Brancher les canaux
            </Link>
          )}
        </div>
      )}

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" onClick={() => { setEtape('a_traiter'); setOrigine('tous') }}
          className={cn('card p-4 text-left transition-colors hover:border-brand-200', indicateurs.aTraiter > 0 && 'border-accent-300 bg-accent-50/40')}>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400"><UserRound className="h-3.5 w-3.5" /> À traiter</div>
          <div className="mt-1 text-2xl font-heading font-bold text-surface-900 tabular-nums">{indicateurs.aTraiter}</div>
          <div className="mt-0.5 text-xs text-surface-500">
            {indicateurs.aTraiterDepuis24h > 0
              ? <span className="font-medium text-warning-700">dont {indicateurs.aTraiterDepuis24h} depuis plus de 24 h</span>
              : indicateurs.aTraiter > 0 ? 'Tous reçus il y a moins de 24 h' : 'Aucune demande en attente'}
          </div>
        </button>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400"><Users className="h-3.5 w-3.5" /> Reçus sur 7 jours</div>
          <div className="mt-1 text-2xl font-heading font-bold text-surface-900 tabular-nums">{indicateurs.recus7j}</div>
          <div className="mt-0.5 text-xs text-surface-500 tabular-nums">
            Site {indicateurs.parOrigine7j.site} · Meta {indicateurs.parOrigine7j.meta} · Google {indicateurs.parOrigine7j.google_ads}
            {indicateurs.parOrigine7j.apporteur > 0 && <> · Apporteurs {indicateurs.parOrigine7j.apporteur}</>}
            {indicateurs.parOrigine7j.ancien > 0 && <> · Anciens {indicateurs.parOrigine7j.ancien}</>}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400"><Timer className="h-3.5 w-3.5" /> Premier contact</div>
          <div className="mt-1 text-2xl font-heading font-bold text-surface-900 tabular-nums">{delai || '—'}</div>
          <div className="mt-0.5 text-xs text-surface-500">
            {delai ? `Délai médian sur 30 jours (${indicateurs.delaisMesures} lead${indicateurs.delaisMesures > 1 ? 's' : ''})` : 'Mesuré au premier échange noté (appel, e-mail, rendez-vous) ou au passage à « Contacté »'}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400"><TrendingUp className="h-3.5 w-3.5" /> Gagnés sur 90 jours</div>
          <div className="mt-1 text-2xl font-heading font-bold text-surface-900 tabular-nums">
            {indicateurs.gagnes90j}<span className="text-base font-semibold text-surface-400"> / {indicateurs.entrants90j}</span>
          </div>
          <div className="mt-0.5 text-xs text-surface-500">
            {indicateurs.entrants90j ? `${Math.round((indicateurs.gagnes90j / indicateurs.entrants90j) * 100)} % des demandes reçues` : 'Aucune demande sur la période'}
          </div>
        </div>
      </div>

      {/* Clients déjà connus qui ont rempli un formulaire */}
      {clientsQuiOntRepondu.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-surface-100 px-4 py-3">
            <Building2 className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">
              Clients qui ont répondu ({clientsQuiOntRepondu.length >= 100 ? '100+' : clientsQuiOntRepondu.length})
            </span>
            <span className="text-xs text-surface-400">· 60 derniers jours, pas de lead : ils sont déjà clients</span>
          </div>
          <ul className="divide-y divide-surface-100">
            {(tousLesClients ? clientsQuiOntRepondu : clientsQuiOntRepondu.slice(0, 5)).map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/clients/${r.client_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm hover:bg-surface-50">
                  <span className="font-medium text-surface-900">{r.client?.nom_commercial || r.client?.raison_sociale || r.resume}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-surface-500">{r.resume}{r.evenement ? ` · ${r.evenement}` : ''}</span>
                  <span className="text-xs text-surface-400 tabular-nums">{formatDate(r.recu_le, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </Link>
              </li>
            ))}
          </ul>
          {clientsQuiOntRepondu.length > 5 && (
            <button type="button" onClick={() => setTousLesClients((v) => !v)}
              className="w-full border-t border-surface-100 px-4 py-2.5 text-left text-xs font-semibold text-brand-600 hover:bg-surface-50">
              {tousLesClients ? 'Afficher moins' : `Voir les ${clientsQuiOntRepondu.length} réponses`}
            </button>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="space-y-3">
        <div className="tabs-scroll flex gap-1 overflow-x-auto rounded-lg bg-surface-100 p-0.5" role="tablist" aria-label="Origine des leads">
          {([{ id: 'tous' as const, label: 'Tous' }, ...ORIGINES.filter((o) => !['apporteur', 'ancien'].includes(o.id) || comptesOrigine[o.id] > 0 || origine === o.id).map((o) => ({ id: o.id, label: o.court }))]).map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={origine === o.id} onClick={() => setOrigine(o.id)}
              className={cn('flex min-h-[40px] shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                origine === o.id ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-800')}>
              {o.id === 'site' && <Globe className="h-4 w-4" />}
              {o.id === 'meta' && <Meta className="h-4 w-4" />}
              {o.id === 'google_ads' && <Google className="h-4 w-4" />}
              {o.id === 'apporteur' && <Handshake className="h-4 w-4" />}
              {o.id === 'ancien' && <Archive className="h-4 w-4" />}
              {o.label}
              <span className={cn('rounded-full px-1.5 text-2xs tabular-nums', origine === o.id ? 'bg-surface-100 text-surface-600' : 'bg-white/70 text-surface-500')}>{comptesOrigine[o.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="tabs-scroll flex gap-1.5 overflow-x-auto">
            {([{ id: 'ouverts' as const, label: 'En cours' }, ...ETAPES.map((e) => ({ id: e.id, label: e.label })), { id: 'tous' as const, label: 'Tous' }]).map((e) => (
              <button key={e.id} type="button" aria-pressed={etape === e.id} onClick={() => setEtape(e.id)}
                title={ETAPES.find((x) => x.id === e.id)?.aide || (e.id === 'ouverts' ? 'À traiter, contactés et qualifiés' : 'Toutes les étapes')}
                className={cn('h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap',
                  etape === e.id ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
                {e.label} <span className="tabular-nums opacity-70">{comptesEtape[e.id]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, établissement, téléphone, campagne…"
                aria-label="Rechercher un lead" className="input-base min-h-[40px] w-full !pl-9" />
              {recherche && (
                <button type="button" onClick={() => setRecherche('')} aria-label="Effacer la recherche"
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-surface-400 hover:text-surface-600"><X className="h-4 w-4" /></button>
              )}
            </div>
            <button type="button" aria-pressed={mesLeads} onClick={() => setMesLeads((v) => !v)}
              className={cn('h-10 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors',
                mesLeads ? 'border-surface-900 bg-surface-900 text-white' : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50')}>
              Suivis par moi
            </button>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="card overflow-hidden">
        {visibles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-surface-100 text-surface-400"><Users className="h-5 w-5" /></div>
            <p className="mt-3 text-sm font-medium text-surface-800">
              {etape === 'a_traiter' || etape === 'ouverts' ? 'Aucune demande en attente' : 'Aucun lead ici'}
            </p>
            <p className="mt-1 text-xs text-surface-500">
              {recherche || mesLeads ? 'Changez la recherche ou les filtres.' : 'Les prochaines demandes du site et des publicités arriveront ici.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {visibles.map((l) => {
              const e = etapeDuLead(l)
              const pub = publiciteDuLead(l)
              const wa = numeroWhatsapp(l.contact_telephone)
              const rappelEnRetard = l.next_action_date && l.next_action_date < aujourdhui && ['a_traiter', 'contacte', 'qualifie'].includes(e)
              const suivi = l.assigned_user ? [l.assigned_user.first_name, l.assigned_user.last_name].filter(Boolean).join(' ') : null
              const revenu = aRefaitUneDemande(l)
              const recu = dateDemande(l)
              return (
                <li key={l.id} className="group relative flex items-start gap-3 px-4 py-3.5 hover:bg-surface-50/70 sm:items-center">
                  <IconeOrigine lead={l} />
                  <button type="button" onClick={() => ouvrir(l)} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {e === 'a_traiter' && <span className="h-2 w-2 shrink-0 rounded-full bg-accent-500" aria-label="Pas encore traité" />}
                      <span className={cn('text-sm text-surface-900', e === 'a_traiter' ? 'font-semibold' : 'font-medium')}>{nomDuLead(l)}</span>
                      {l.entreprise && <span className="inline-flex min-w-0 items-center gap-1 text-sm text-surface-600"><Building2 className="h-3.5 w-3.5 shrink-0 text-surface-400" /><span className="truncate">{l.entreprise}</span></span>}
                      {l.ville && <span className="inline-flex items-center gap-1 text-xs text-surface-500"><MapPin className="h-3 w-3 shrink-0" />{l.ville}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-surface-500">{resumeDemande(l) || '—'}</span>
                    {(revenu || pub || rappelEnRetard || (l.next_action_date && !rappelEnRetard && ['a_traiter', 'contacte', 'qualifie'].includes(e)) || suivi) && (
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {revenu && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-1.5 py-0.5 text-[11px] font-medium text-success-700"
                            title={`Premier contact reçu le ${formatDate(l.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}`}>
                            <Repeat className="h-3 w-3" /> Nouvelle demande
                          </span>
                        )}
                        {pub && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-1.5 py-0.5 text-[11px] font-medium text-surface-600">
                            {pub === 'meta' ? <Meta className="h-3 w-3" /> : <Google className="h-3 w-3" />} via {pub === 'meta' ? 'Meta' : 'Google Ads'}
                          </span>
                        )}
                        {rappelEnRetard && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-warning-700">
                            <AlertTriangle className="h-3 w-3" /> Rappel prévu le {formatDate(l.next_action_date, { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {l.next_action_date && !rappelEnRetard && ['a_traiter', 'contacte', 'qualifie'].includes(e) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-1.5 py-0.5 text-[11px] font-medium text-surface-600">
                            <CalendarClock className="h-3 w-3" /> {l.next_action_date === aujourdhui ? 'À rappeler aujourd’hui' : `À rappeler le ${formatDate(l.next_action_date, { day: 'numeric', month: 'short' })}`}
                          </span>
                        )}
                        {suivi && <span className="text-[11px] text-surface-400">Suivi par {suivi}</span>}
                      </span>
                    )}
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <PastilleEtape etape={e} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-surface-400 tabular-nums" title={new Date(recu).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}>
                      <Clock className="h-3 w-3" />
                      {maintenant ? ilYA(recu, maintenant) : formatDate(recu, { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="hidden items-center gap-1 sm:flex">
                      {l.contact_telephone && (
                        <a href={`tel:${String(l.contact_telephone).replace(/\s+/g, '')}`} aria-label={`Appeler ${nomDuLead(l)}`} title="Appeler"
                          className="rounded-lg p-1.5 text-surface-400 hover:bg-white hover:text-brand-600"><Phone className="h-4 w-4" /></a>
                      )}
                      {wa && (
                        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label={`Écrire sur WhatsApp à ${nomDuLead(l)}`} title="WhatsApp"
                          className="rounded-lg p-1.5 text-surface-400 hover:bg-white hover:text-brand-600"><Whatsapp className="h-4 w-4" /></a>
                      )}
                      {l.contact_email && (
                        <a href={`mailto:${l.contact_email}`} aria-label={`Écrire à ${nomDuLead(l)}`} title="E-mail"
                          className="rounded-lg p-1.5 text-surface-400 hover:bg-white hover:text-brand-600"><Mail className="h-4 w-4" /></a>
                      )}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal isOpen={!!fiche} onClose={() => { setFicheId(null); setFicheCopie(null) }} size="lg"
        title={fiche ? nomDuLead(fiche) : ''}
        description={fiche ? [fiche.entreprise, fiche.ville].filter(Boolean).join(' · ') || undefined : undefined}>
        {fiche && (
          <LeadFiche
            key={fiche.id}
            lead={fiche}
            equipe={equipe}
            moi={moi}
            peutSuivre={peutSuivre}
            estResponsable={estResponsable}
            peutSupprimer={peutSupprimer}
            peutCreerDossier={peutCreerDossier}
            clientsAccessibles={clientsAccessibles}
            aujourdhui={aujourdhui}
            onSupprime={() => { setFicheId(null); setFicheCopie(null) }}
          />
        )}
      </Modal>
    </div>
  )
}
