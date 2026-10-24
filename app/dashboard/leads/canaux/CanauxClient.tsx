'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Meta, Google, Globe, CheckCircle2, AlertTriangle, Copy, Check, RefreshCw, ExternalLink, KeyRound, Eye, XCircle,
  ArrowLeft, Webhook, Clock, Loader2,
} from '@/components/ui/icons'
import { Button, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import {
  afficherCleGoogleAction, connecterMetaAction, deconnecterMetaAction, desactiverGoogleAction,
  genererCleGoogleAction, pagesMetaAction, releverMetaAction,
} from './actions'

interface EtatMeta {
  actif: boolean; pageNom: string | null; pageId: string | null; appId: string | null; connecteLe: string | null
  derniereReception: string | null; dernierReleve: string | null; erreur: string | null; erreurLe: string | null
}
interface EtatGoogle { actif: boolean; cleCreeeLe: string | null; derniereReception: string | null; erreur: string | null; erreurLe: string | null }
interface Reception {
  id: string; canal: string; recuLe: string; statut: string; resume: string | null; erreur: string | null
  leadId: string | null; clientId: string | null; tentatives: number; evenement: string | null
}

const APP_ID_LAB_LEARNING = '3736075419867479'
const OUTIL_TEST_META = 'https://developers.facebook.com/tools/lead-ads-testing'

const STATUTS: Record<string, { label: string; cls: string }> = {
  lead_cree: { label: 'Lead créé', cls: 'bg-success-50 text-success-700' },
  lead_complete: { label: 'Lead complété', cls: 'bg-info-50 text-info-600' },
  client_connu: { label: 'Client connu', cls: 'bg-brand-50 text-brand-700' },
  test: { label: 'Essai', cls: 'bg-surface-100 text-surface-600' },
  erreur: { label: 'Erreur', cls: 'bg-danger-50 text-danger-700' },
  en_cours: { label: 'En cours', cls: 'bg-warning-50 text-warning-700' },
}

const quand = (iso: string | null) => (iso ? formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`
/** Action coupée en route (délai dépassé, réseau) : elle ne renvoie rien */
const COUPEE = 'Pas de réponse du serveur : rechargez la page pour voir où en est l’opération'

function Copiable({ valeur, libelle, masque = false }: { valeur: string; libelle: string; masque?: boolean }) {
  const [copie, setCopie] = useState(false)
  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
      <code className="min-w-0 flex-1 truncate px-3 py-2 font-mono text-xs text-surface-800" aria-label={libelle}>{masque ? '•'.repeat(24) : valeur}</code>
      <button type="button" disabled={masque}
        onClick={async () => { try { await navigator.clipboard.writeText(valeur); setCopie(true); setTimeout(() => setCopie(false), 1500) } catch { /* refusé */ } }}
        aria-label={`Copier ${libelle}`}
        className="flex shrink-0 items-center gap-1 border-l border-surface-200 px-3 text-xs font-medium text-surface-600 hover:bg-white disabled:opacity-40">
        {copie ? <><Check className="h-3.5 w-3.5 text-success-600" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
      </button>
    </div>
  )
}

function Etape({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-semibold text-surface-600 tabular-nums">{n}</span>
      <div className="min-w-0 flex-1 text-sm text-surface-700">{children}</div>
    </li>
  )
}

export function CanauxClient({ migrationManquante, meta, google, receptions, urlWebhookMeta, urlWebhookGoogle }: {
  migrationManquante: boolean
  meta: EtatMeta | null
  google: EtatGoogle | null
  receptions: Reception[]
  urlWebhookMeta: string
  urlWebhookGoogle: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  // ── Meta ──
  const [formulaireMeta, setFormulaireMeta] = useState(!meta?.actif)
  const [appId, setAppId] = useState(meta?.appId || APP_ID_LAB_LEARNING)
  const [appSecret, setAppSecret] = useState('')
  const [jeton, setJeton] = useState('')
  const [pages, setPages] = useState<{ id: string; nom: string }[] | null>(null)
  const [pageChoisie, setPageChoisie] = useState('')
  const [nomApp, setNomApp] = useState<string | null>(null)

  function chercherPages() {
    setPages(null)
    startTransition(async () => {
      const r = await pagesMetaAction(appId, appSecret, jeton)
      if (!r?.success || !r.data) { toast('error', r ? r.error || 'Recherche impossible' : COUPEE); return }
      setNomApp(r.data.app)
      setPages(r.data.pages)
      setPageChoisie(r.data.pages.length === 1 ? r.data.pages[0].id : '')
    })
  }
  function brancherMeta() {
    if (!pageChoisie) { toast('error', 'Choisissez la Page à brancher'); return }
    startTransition(async () => {
      const r = await connecterMetaAction(appId, appSecret, jeton, pageChoisie)
      if (!r?.success || !r.data) { toast('error', r ? r.error || 'Branchement impossible' : COUPEE); router.refresh(); return }
      toast('success', `Page « ${r.data.page} » branchée : ${pluriel(r.data.formulaires, 'formulaire trouvé', 'formulaires trouvés')}, ${pluriel(r.data.importes, 'prospect importé', 'prospects importés')}${r.data.essais ? `, ${pluriel(r.data.essais, 'essai', 'essais')} au journal` : ''}`)
      if (r.warning) toast('warning', r.warning)
      setAppSecret(''); setJeton(''); setPages(null); setFormulaireMeta(false)
      router.refresh()
    })
  }
  function relever(rattrapage = false) {
    if (rattrapage && !confirm('Relire les prospects des 90 derniers jours chez Meta ? Ceux déjà reçus sont reconnus et ne sont pas recréés.')) return
    startTransition(async () => {
      const r = await releverMetaAction(rattrapage)
      if (r?.success && r.data) {
        toast('success', `Relevé fait : ${pluriel(r.data.formulaires, 'formulaire', 'formulaires')}, ${pluriel(r.data.nouveaux, 'nouveau prospect', 'nouveaux prospects')}`
          + `${r.data.essais ? `, ${pluriel(r.data.essais, 'essai', 'essais')} (au journal, sans lead)` : ''}${r.data.erreurs ? `, ${r.data.erreurs} en erreur` : ''}`)
      } else toast('error', r ? r.error || 'Relevé impossible' : COUPEE)
      router.refresh()
    })
  }
  function debrancherMeta() {
    if (!confirm('Débrancher Meta ? Les prospects des formulaires publicitaires n’arriveront plus dans le CRM. Les leads déjà reçus restent.')) return
    startTransition(async () => {
      const r = await deconnecterMetaAction()
      if (r?.success) { toast('success', 'Meta débranché'); setFormulaireMeta(true); router.refresh() }
      else toast('error', r ? r.error || 'Erreur' : COUPEE)
    })
  }

  // ── Google Ads ──
  const [cleGoogle, setCleGoogle] = useState<string | null>(null)
  function creerCle(remplacer: boolean) {
    if (remplacer && !confirm('Changer la clé ? L’ancienne cessera aussitôt de fonctionner : collez la nouvelle dans chaque formulaire Google Ads.')) return
    startTransition(async () => {
      const r = await genererCleGoogleAction()
      if (r?.success && r.data) { setCleGoogle(r.data.cle); toast('success', remplacer ? 'Nouvelle clé créée' : 'Clé créée : collez-la dans Google Ads'); router.refresh() }
      else toast('error', r ? r.error || 'Erreur' : COUPEE)
    })
  }
  function afficherCle() {
    startTransition(async () => {
      const r = await afficherCleGoogleAction()
      if (r?.success && r.data) setCleGoogle(r.data.cle)
      else toast('error', r ? r.error || 'Erreur' : COUPEE)
    })
  }
  function desactiverGoogle() {
    if (!confirm('Désactiver Google Ads ? Les envois de Google seront refusés jusqu’à la création d’une nouvelle clé.')) return
    startTransition(async () => {
      const r = await desactiverGoogleAction()
      if (r?.success) { setCleGoogle(null); toast('success', 'Google Ads désactivé'); router.refresh() }
      else toast('error', r ? r.error || 'Erreur' : COUPEE)
    })
  }

  const carte = 'card overflow-hidden'
  const enTete = 'flex flex-wrap items-center gap-3 border-b border-surface-100 px-5 py-4'

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800"><ArrowLeft className="h-4 w-4" /> Leads</Link>
        <h1 className="mt-1 text-2xl font-heading font-bold text-surface-900 tracking-heading">Canaux de prospects</h1>
        <p className="mt-1 text-sm text-surface-500">Branchez vos formulaires publicitaires : chaque prospect arrive dans Leads dès qu’il les remplit, et l’équipe est prévenue.</p>
      </div>

      {migrationManquante && (
        <div className="card flex items-start gap-3 border-warning-100 bg-warning-50 p-4 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><span className="font-semibold">Migration 167 à appliquer</span> dans l’éditeur SQL de Supabase avant de brancher Meta ou Google Ads.</span>
        </div>
      )}

      {/* ── Meta ── */}
      <section className={carte} aria-labelledby="titre-meta">
        <div className={enTete}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-50 text-info-600"><Meta className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="titre-meta" className="text-base font-heading font-semibold text-surface-900">Meta : Facebook et Instagram</h2>
            <p className="text-xs text-surface-500">Publicités avec formulaire instantané (objectif Prospects)</p>
          </div>
          {meta?.actif
            ? <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700"><CheckCircle2 className="h-3.5 w-3.5" /> Branché</span>
            : <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-500">Pas branché</span>}
        </div>
        <div className="space-y-4 p-5">
          {meta?.actif && (
            <div className="space-y-3">
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-surface-500">Page</dt><dd className="font-medium text-surface-900">{meta.pageNom || meta.pageId}</dd></div>
                <div><dt className="text-xs text-surface-500">Dernier prospect reçu</dt><dd className="text-surface-800 tabular-nums">{quand(meta.derniereReception)}</dd></div>
                <div><dt className="text-xs text-surface-500">Dernier relevé (toutes les 10 min)</dt><dd className="text-surface-800 tabular-nums">{quand(meta.dernierReleve)}</dd></div>
              </dl>
              {meta.erreur && (
                <div className="flex items-start gap-2 rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{meta.erreur}{meta.erreurLe ? ` (${quand(meta.erreurLe)})` : ''}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => relever(false)} isLoading={pending} icon={<RefreshCw className="h-3.5 w-3.5" />}>Relever maintenant</Button>
                <Button size="sm" variant="secondary" onClick={() => relever(true)} disabled={pending}>Rattraper les 90 derniers jours</Button>
                <a href={OUTIL_TEST_META} target="_blank" rel="noreferrer" title="Le prospect de test apparaît dans « Dernières réceptions » comme « Essai », sans créer de lead ni prévenir l’équipe"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50">
                  Envoyer un prospect de test <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button size="sm" variant="secondary" onClick={() => setFormulaireMeta((v) => !v)}>{formulaireMeta ? 'Fermer' : 'Rebrancher'}</Button>
                <button type="button" onClick={debrancherMeta} disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-danger-600 hover:bg-danger-50">
                  <XCircle className="h-4 w-4" /> Débrancher
                </button>
              </div>
              <p className="text-xs text-surface-500">Un prospect envoyé par l’outil de test de Meta apparaît dans « Dernières réceptions » comme « Essai », sans créer de lead ni prévenir l’équipe.</p>
            </div>
          )}

          {formulaireMeta && (
            <div className={cn('space-y-4', meta?.actif && 'border-t border-surface-100 pt-4')}>
              <ol className="space-y-3">
                <Etape n={1}>
                  Sur <a className="font-medium text-brand-600 hover:underline" href={`https://developers.facebook.com/apps/${APP_ID_LAB_LEARNING}/`} target="_blank" rel="noreferrer">developers.facebook.com</a>, dans l’app « Lab Learning CRM » : ajoutez le cas d’usage « Capturer et gérer les prospects publicitaires avec l’API Marketing », puis publiez l’app (icône, catégorie, politique de confidentialité https://www.lab-learning.fr/confidentialite et suppression des données https://www.lab-learning.fr/confidentialite#suppression-donnees).
                </Etape>
                <Etape n={2}>
                  Dans <a className="font-medium text-brand-600 hover:underline" href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer">Paramètres de l’entreprise &gt; Utilisateurs système</a>, ouvrez « crm-api », « Attribuer des éléments » : votre Page Facebook en contrôle total, et le compte publicitaire avec le droit de gérer les campagnes (sans lui, les noms des campagnes ne remontent pas).
                </Etape>
                <Etape n={3}>
                  Toujours sur « crm-api », « Générer un nouveau jeton » pour l’app Lab Learning CRM, expiration « Jamais », avec : <code className="text-xs">leads_retrieval</code>, <code className="text-xs">pages_manage_ads</code>, <code className="text-xs">pages_manage_metadata</code>, <code className="text-xs">pages_read_engagement</code>, <code className="text-xs">pages_show_list</code>, <code className="text-xs">ads_management</code>, <code className="text-xs">ads_read</code> et <code className="text-xs">business_management</code>. Le jeton WhatsApp reste tel quel.
                </Etape>
                <Etape n={4}>
                  Dans l’app, Paramètres de l’app &gt; Général : copiez la <span className="font-medium">clé secrète</span>. Collez-la ci-dessous avec le jeton : ils sont chiffrés dans le CRM et ne s’affichent plus. Si un jour vous régénérez la clé secrète, rebranchez Meta ici.
                </Etape>
                <Etape n={5}>
                  Si l’accès aux prospects a été personnalisé (Paramètres de l’entreprise &gt; Intégrations &gt; Accès aux prospects), donnez l’accès à l’app et à « crm-api ».
                </Etape>
                <Etape n={6}>
                  <span className="font-medium">Pour recevoir les prospects de vraies personnes</span>, Meta demande la vérification de l’entreprise puis l’examen de l’app (accès avancé à <code className="text-xs">leads_retrieval</code> et <code className="text-xs">pages_manage_ads</code>). D’ici là, seuls arrivent les prospects d’essai créés par les comptes qui ont un rôle sur l’app : ils apparaissent dans « Dernières réceptions » comme « Essai », sans créer de lead ni prévenir l’équipe. La campagne peut tourner quand même : Meta garde les prospects 90 jours, et « Rattraper les 90 derniers jours » les fera entrer le jour de l’accord.
                </Etape>
              </ol>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-surface-600">Identifiant de l’app</span>
                  <input value={appId} onChange={(e) => setAppId(e.target.value.trim())} inputMode="numeric" className="input-base w-full font-mono text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-surface-600">Clé secrète de l’app</span>
                  <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value.trim())} autoComplete="off" spellCheck={false} className="input-base w-full font-mono text-sm" placeholder="32 caractères" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-surface-600">Jeton d’accès de l’utilisateur système</span>
                <input type="password" value={jeton} onChange={(e) => setJeton(e.target.value.trim())} autoComplete="off" spellCheck={false} className="input-base w-full font-mono text-sm" placeholder="EAA…" />
              </label>
              <div className="flex justify-end">
                <Button onClick={chercherPages} isLoading={pending && !pages} disabled={!appId || !appSecret || !jeton} icon={<KeyRound className="h-4 w-4" />}>Chercher mes Pages</Button>
              </div>

              {pages && (
                <div className="space-y-3 rounded-xl border border-surface-200 p-4">
                  <div className="text-sm text-surface-700">App vérifiée : <span className="font-medium text-surface-900">{nomApp}</span>. Choisissez la Page qui porte vos publicités :</div>
                  <div className="space-y-2" role="radiogroup" aria-label="Page Facebook à brancher">
                    {pages.map((p) => (
                      <label key={p.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5', pageChoisie === p.id ? 'border-brand-300 bg-brand-50/50' : 'border-surface-200 hover:bg-surface-50')}>
                        <input type="radio" name="page" value={p.id} checked={pageChoisie === p.id} onChange={() => setPageChoisie(p.id)} className="accent-brand-500" />
                        <span className="text-sm font-medium text-surface-900">{p.nom}</span>
                        <span className="ml-auto font-mono text-xs text-surface-400">{p.id}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={brancherMeta} isLoading={pending} disabled={!pageChoisie} icon={<Webhook className="h-4 w-4" />}>Brancher cette Page</Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-surface-500">
                Adresse du webhook, déclarée automatiquement sur l’app au branchement : <code className="break-all">{urlWebhookMeta}</code>. Un relevé toutes les 10 minutes rattrape toute notification perdue.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Google Ads ── */}
      <section className={carte} aria-labelledby="titre-google">
        <div className={enTete}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-700"><Google className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="titre-google" className="text-base font-heading font-semibold text-surface-900">Google Ads</h2>
            <p className="text-xs text-surface-500">Formulaires pour prospects des campagnes Google Ads</p>
          </div>
          {google?.actif
            ? <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700"><CheckCircle2 className="h-3.5 w-3.5" /> Prêt</span>
            : <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-500">Pas branché</span>}
        </div>
        <div className="space-y-4 p-5">
          <ol className="space-y-3">
            <Etape n={1}>{google?.actif ? 'La clé du webhook est créée.' : 'Créez la clé du webhook ci-dessous.'}</Etape>
            <Etape n={2}>Dans Google Ads, ouvrez le formulaire pour prospects de la campagne, section d’export des prospects, puis « Intégration webhook » : collez l’adresse et la clé.</Etape>
            <Etape n={3}>Cliquez sur « Envoyer des données de test » : l’envoi apparaît ci-dessous comme « Essai », sans créer de lead. S’il n’apparaît pas et que Google signale un échec, la clé collée dans Google Ads n’est pas la bonne.</Etape>
          </ol>
          <div className="space-y-2">
            <div className="text-xs font-medium text-surface-600">Adresse du webhook</div>
            <Copiable valeur={urlWebhookGoogle} libelle="l’adresse du webhook" />
          </div>
          {google?.actif && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-surface-600">Clé {google.cleCreeeLe ? <span className="font-normal text-surface-400">(créée le {quand(google.cleCreeeLe)})</span> : null}</div>
              <Copiable valeur={cleGoogle || ''} libelle="la clé" masque={!cleGoogle} />
            </div>
          )}
          {google?.erreur && (
            <div className="flex items-start gap-2 rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{google.erreur}{google.erreurLe ? ` (${quand(google.erreurLe)})` : ''}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!google?.actif ? (
              <Button size="sm" onClick={() => creerCle(false)} isLoading={pending} disabled={migrationManquante} icon={<KeyRound className="h-3.5 w-3.5" />}>Créer la clé du webhook</Button>
            ) : (
              <>
                {!cleGoogle && <Button size="sm" variant="secondary" onClick={afficherCle} isLoading={pending} icon={<Eye className="h-3.5 w-3.5" />}>Afficher la clé</Button>}
                <Button size="sm" variant="secondary" onClick={() => creerCle(true)} disabled={pending} icon={<RefreshCw className="h-3.5 w-3.5" />}>Changer la clé</Button>
                <button type="button" onClick={desactiverGoogle} disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-danger-600 hover:bg-danger-50">
                  <XCircle className="h-4 w-4" /> Désactiver
                </button>
              </>
            )}
          </div>
          {google?.actif && <p className="text-xs text-surface-500">Dernier prospect reçu : {quand(google.derniereReception)}. Chaque affichage de la clé est noté au journal.</p>}
        </div>
      </section>

      {/* ── Site web ── */}
      <section className={carte} aria-labelledby="titre-site">
        <div className={enTete}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Globe className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="titre-site" className="text-base font-heading font-semibold text-surface-900">Site web</h2>
            <p className="text-xs text-surface-500">
              {migrationManquante
                ? 'Modèles gratuits et demande de rappel à Starkk ; la page Contact arrive par e-mail seulement jusqu’à la migration 167'
                : 'Toujours branché : modèles gratuits, demande de rappel à Starkk, page Contact'}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700"><CheckCircle2 className="h-3.5 w-3.5" /> Actif</span>
        </div>
        <div className="space-y-2 p-5 text-sm text-surface-700">
          <p>Une publicité qui renvoie vers le site est reconnue si le visiteur a accepté la mesure d’audience dans le bandeau cookies : le lead « Site web » porte alors la mention « via Meta » ou « via Google Ads » s’il remplit un formulaire pendant cette visite. Sans son accord, le lead reste « Site web », sans mention : la mention « via » est donc un minimum. Les compteurs Meta et Google de la page Leads ne comptent que les formulaires publicitaires.</p>
          <p>Côté Meta, ajoutez dans les « Paramètres d’URL » de chaque publicité : <code className="break-all text-xs">utm_source=meta&amp;utm_medium=paid&amp;utm_campaign={'{{campaign.name}}'}</code>. Sans ce support payant, un clic venu de Facebook ou d’Instagram n’est pas compté comme publicité (Meta marque aussi les liens des publications). Côté Google Ads, laissez le marquage automatique activé (identifiant gclid).</p>
        </div>
      </section>

      {/* ── Réceptions ── */}
      <section className={carte} aria-labelledby="titre-receptions">
        <div className={enTete}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 text-surface-500"><Clock className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="titre-receptions" className="text-base font-heading font-semibold text-surface-900">Dernières réceptions</h2>
            <p className="text-xs text-surface-500">Chaque formulaire reçu, une seule fois, avec ce qu’il est devenu</p>
          </div>
        </div>
        {receptions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-surface-400">{migrationManquante ? 'Le journal apparaîtra après la migration 167.' : 'Aucune réception pour l’instant.'}</p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {receptions.map((r) => {
              const st = STATUTS[r.statut] || { label: r.statut, cls: 'bg-surface-100 text-surface-600' }
              const Icone = r.canal === 'meta' ? Meta : r.canal === 'google_ads' ? Google : Globe
              const lien = r.leadId ? `/dashboard/leads?lead=${r.leadId}` : r.clientId ? `/dashboard/clients/${r.clientId}` : null
              const contenu = (
                <>
                  <Icone className="h-4 w-4 shrink-0 text-surface-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-surface-900">{r.resume || 'Prospect'}</span>
                    <span className="block truncate text-xs text-surface-500">{r.erreur ? `${r.erreur}${r.tentatives > 1 ? ` (${r.tentatives} essais)` : ''}` : r.evenement || ''}</span>
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', st.cls)}>{r.statut === 'en_cours' ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} {st.label}</span>
                  <span className="hidden shrink-0 text-xs text-surface-400 tabular-nums sm:block">{quand(r.recuLe)}</span>
                </>
              )
              return (
                <li key={r.id}>
                  {lien
                    ? <Link href={lien} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50">{contenu}</Link>
                    : <div className="flex items-center gap-3 px-5 py-3">{contenu}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
