import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { chiffrerSecrets, dechiffrerSecrets } from './coffre'
import { recevoirProspect } from './recevoir'
import type { ProspectEntrant, ReponseProspect, ResultatReception } from './types'
import { demandeNomEtablissement } from './questions'

/**
 * Formulaires publicitaires Meta (Facebook, Instagram) → leads du CRM.
 *
 * Deux arrivées, un seul traitement (recevoirProspect, qui ne traite qu'une
 * fois chaque prospect) :
 *  - en direct : Meta appelle /api/webhooks/meta (champ « leadgen » de la
 *    Page) avec l'identifiant du prospect, que l'on lit ensuite par l'API ;
 *  - en rattrapage : un relevé périodique (/api/cron/prospects-meta) lit les
 *    prospects récents de chaque formulaire de la Page, au cas où une
 *    notification se serait perdue.
 *
 * Secrets (chiffrés dans canaux_prospects.secrets) : la clé secrète de l'app
 * (signature des notifications, abonnement de l'app) et le jeton de la Page
 * (lecture des prospects, abonnement de la Page).
 */

// v26.0 : dernière version au 24/10/2026 (la v24.0 de la Marketing API a expiré le 06/10/2026)
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0'
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`
export const URL_WEBHOOK_META = `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/api/webhooks/meta`

export interface SecretsMeta { app_secret: string; page_token: string }
export interface ConfigMeta { app_id: string; page_id: string; page_nom: string | null; connecte_le: string; connecte_par: string | null }
export interface CanalMeta { organization_id: string; actif: boolean; config: ConfigMeta; secrets: SecretsMeta | null; cle_verification: string | null; dernier_releve_at: string | null }

export class ErreurMeta extends Error {
  constructor(message: string, public code?: number, public sousCode?: number) { super(message) }
}

/** Appel de la Graph API ; les erreurs de Meta sont traduites en phrases utiles. */
async function graph<T = any>(chemin: string, jeton: string, options: { methode?: 'GET' | 'POST' | 'DELETE'; params?: Record<string, string> } = {}): Promise<T> {
  const url = new URL(`${GRAPH}/${chemin.replace(/^\//, '')}`)
  const params = new URLSearchParams(options.params || {})
  params.set('access_token', jeton)
  let reponse: Response
  try {
    reponse = options.methode === 'POST'
      ? await fetch(url, { method: 'POST', body: params, cache: 'no-store', signal: AbortSignal.timeout(15000) })
      : await fetch(`${url}?${params}`, { method: options.methode || 'GET', cache: 'no-store', signal: AbortSignal.timeout(15000) })
  } catch (e: any) {
    throw new ErreurMeta(`Meta ne répond pas (${e?.name === 'TimeoutError' ? 'délai dépassé' : 'réseau'}).`)
  }
  const corps: any = await reponse.json().catch(() => ({}))
  if (!reponse.ok || corps?.error) {
    const err = corps?.error || {}
    throw new ErreurMeta(traduireErreur(err), err.code, err.error_subcode)
  }
  return corps as T
}

function traduireErreur(err: any): string {
  const code = Number(err?.code)
  const brut = String(err?.message || 'erreur inconnue').slice(0, 300)
  if (code === 190) return `Jeton Meta expiré ou révoqué : reconnectez Meta. (${brut})`
  if (code === 10 || code === 200 || code === 3) return `Permission manquante côté Meta (leads_retrieval, pages_manage_metadata, pages_show_list, pages_read_engagement). (${brut})`
  if (code === 100 && Number(err?.error_subcode) === 33) return `Prospect illisible : l'app n'a pas encore l'accès avancé à leads_retrieval (examen de l'app par Meta), ou le jeton n'a pas les droits sur la Page. (${brut})`
  if (code === 100) return `Requête refusée par Meta : identifiant inconnu, prospect supprimé ou champ non autorisé. (${brut})`
  if (code === 4 || code === 17 || code === 32 || code === 613) return `Meta limite le nombre d'appels : nouvel essai au prochain relevé. (${brut})`
  return `Meta : ${brut}`
}

// ─── Signature des notifications ──────────────────────────────────────────

/**
 * Meta peut écrire les identifiants en nombres JSON ; au-delà de 2^53 (16 à 17
 * chiffres), JSON.parse les arrondirait. On les met entre guillemets avant de
 * décoder le corps (après la vérification de la signature, faite sur le brut).
 */
export function decoderAvecIdentifiants(brut: string): any {
  return JSON.parse(brut.replace(/"(leadgen_id|page_id|form_id|ad_id|adgroup_id|id)"\s*:\s*(\d{12,})/g, '"$1":"$2"'))
}

/** Vérifie l'en-tête X-Hub-Signature-256 (HMAC SHA-256 du corps brut, clé secrète de l'app). */
export function signatureValide(corpsBrut: string, entete: string | null, appSecret: string): boolean {
  if (!entete || !entete.startsWith('sha256=') || !appSecret) return false
  const recue = entete.slice(7)
  // Une signature malformée est un refus (401), jamais une exception (500)
  if (!/^[0-9a-f]{64}$/i.test(recue)) return false
  const attendue = createHmac('sha256', appSecret).update(corpsBrut, 'utf8').digest('hex')
  return timingSafeEqual(Buffer.from(recue.toLowerCase(), 'hex'), Buffer.from(attendue, 'hex'))
}

// ─── Canal enregistré ─────────────────────────────────────────────────────

export async function lireCanalMeta(supabase: any, orgId: string): Promise<CanalMeta | null> {
  const { data } = await supabase.from('canaux_prospects').select('*')
    .eq('organization_id', orgId).eq('canal', 'meta').maybeSingle()
  if (!data) return null
  return { ...data, secrets: dechiffrerSecrets<SecretsMeta>(data.secrets) } as CanalMeta
}

/** Tous les canaux Meta actifs (le webhook ne connaît que la Page). */
export async function canauxMetaActifs(supabase: any): Promise<CanalMeta[]> {
  const { data } = await supabase.from('canaux_prospects').select('*').eq('canal', 'meta').eq('actif', true)
  return ((data || []) as any[]).map((c) => ({ ...c, secrets: dechiffrerSecrets<SecretsMeta>(c.secrets) }))
}

async function noterErreur(supabase: any, orgId: string, erreur: string | null) {
  await supabase.from('canaux_prospects').update(erreur
    ? { derniere_erreur: erreur.slice(0, 500), derniere_erreur_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    : { derniere_erreur: null, derniere_erreur_at: null, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId).eq('canal', 'meta')
}

// ─── Connexion ────────────────────────────────────────────────────────────

/** Vérifie l'identifiant et la clé secrète de l'app (jeton d'app « id|secret »). Renvoie le nom de l'app. */
export async function verifierApp(appId: string, appSecret: string): Promise<string> {
  if (!/^\d{5,20}$/.test(appId)) throw new ErreurMeta('Identifiant d’app invalide : des chiffres seulement.')
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) throw new ErreurMeta('Clé secrète de l’app invalide : 32 caractères (chiffres et lettres a à f).')
  try {
    const app = await graph<{ id: string; name?: string }>(appId, `${appId}|${appSecret}`, { params: { fields: 'id,name' } })
    return app.name || appId
  } catch (e: any) {
    // Clé refusée seulement sur une erreur d'authentification de Meta ; une panne ou un délai dépassé
    // est relayé tel quel, pour ne pas faire régénérer une clé qui était bonne
    if (e instanceof ErreurMeta && [101, 102, 190].includes(Number(e.code))) {
      throw new ErreurMeta(`Meta refuse cette clé secrète pour l’app ${appId}. Vérifiez-la dans Paramètres > Général de l’app.`, e.code, e.sousCode)
    }
    throw e
  }
}

export interface PageMeta { id: string; nom: string; jeton: string }

/**
 * Pages accessibles avec le jeton fourni (utilisateur système ou personne
 * administratrice de la Page), chacune avec son jeton de Page.
 */
export async function pagesAccessibles(jeton: string): Promise<PageMeta[]> {
  const r = await graph<{ data: { id: string; name: string; access_token?: string }[] }>('me/accounts', jeton, { params: { fields: 'id,name,access_token', limit: '100' } })
  return (r.data || []).filter((p) => p.access_token).map((p) => ({ id: p.id, nom: p.name, jeton: p.access_token as string }))
}

/**
 * Branche la Page : abonne l'app aux prospects de la Page, déclare l'adresse
 * du webhook sur l'app, puis enregistre les secrets chiffrés. Renvoie le
 * nombre de formulaires trouvés (vérification de la permission de lecture).
 */
export async function connecterMeta(supabase: any, orgId: string, p: {
  appId: string; appSecret: string; page: PageMeta; userId: string
}): Promise<{ formulaires: number; webhookDeclare: boolean; avertissement: string | null }> {
  // 1. La Page envoie ses prospects à l'app
  await graph(`${p.page.id}/subscribed_apps`, p.page.jeton, { methode: 'POST', params: { subscribed_fields: 'leadgen' } })

  // 2. L'app reçoit les notifications de Page sur notre adresse (jeton d'app : id|secret)
  const { data: existant } = await supabase.from('canaux_prospects').select('cle_verification')
    .eq('organization_id', orgId).eq('canal', 'meta').maybeSingle()
  const cleVerification = (existant as any)?.cle_verification || randomBytes(24).toString('hex')
  if (!(existant as any)?.cle_verification) {
    // Meta appelle l'adresse du webhook pendant l'abonnement : le jeton de vérification doit déjà être connu
    const { error } = await supabase.from('canaux_prospects').upsert(
      { organization_id: orgId, canal: 'meta', cle_verification: cleVerification, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id,canal' },
    )
    if (error) throw new ErreurMeta(`Enregistrement du branchement impossible : ${error.message}`)
  }
  let webhookDeclare = true
  let avertissement: string | null = null
  try {
    await graph(`${p.appId}/subscriptions`, `${p.appId}|${p.appSecret}`, {
      methode: 'POST',
      params: { object: 'page', callback_url: URL_WEBHOOK_META, fields: 'leadgen', verify_token: cleVerification, include_values: 'true' },
    })
  } catch (e: any) {
    // Sans abonnement de l'app, le relevé toutes les 10 minutes prend le relais
    webhookDeclare = false
    avertissement = `Le webhook n'a pas pu être déclaré sur l'app (${e?.message || e}). Les prospects arriveront tout de même, par le relevé toutes les 10 minutes.`
  }

  // 3. La lecture des formulaires prouve que le jeton lit bien les prospects
  const formulaires = await formulairesDeLaPage(p.page.id, p.page.jeton)

  const config: ConfigMeta = { app_id: p.appId, page_id: p.page.id, page_nom: p.page.nom, connecte_le: new Date().toISOString(), connecte_par: p.userId }
  const ligne = {
    organization_id: orgId,
    canal: 'meta',
    actif: true,
    config,
    secrets: chiffrerSecrets({ app_secret: p.appSecret, page_token: p.page.jeton }),
    cle_verification: cleVerification,
    derniere_erreur: avertissement,
    derniere_erreur_at: avertissement ? new Date().toISOString() : null,
    // Premier relevé : 90 jours, toute la durée de conservation des prospects chez Meta
    dernier_releve_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('canaux_prospects').upsert(ligne, { onConflict: 'organization_id,canal' })
  if (error) throw new ErreurMeta(`Enregistrement du branchement impossible : ${error.message}`)
  return { formulaires: formulaires.length, webhookDeclare, avertissement }
}

/** Débranche : la Page n'envoie plus ses prospects à l'app ; les secrets sont effacés. */
export async function deconnecterMeta(supabase: any, orgId: string): Promise<void> {
  const canal = await lireCanalMeta(supabase, orgId)
  if (canal?.secrets?.page_token && canal.config?.page_id) {
    try { await graph(`${canal.config.page_id}/subscribed_apps`, canal.secrets.page_token, { methode: 'DELETE' }) } catch { /* jeton déjà mort : rien à couper */ }
  }
  await supabase.from('canaux_prospects').update({ actif: false, secrets: null, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId).eq('canal', 'meta')
}

// ─── Lecture des prospects ────────────────────────────────────────────────

interface FormulaireMeta { id: string; name: string; status?: string; questions?: { key: string; label?: string; type?: string }[] }

export async function formulairesDeLaPage(pageId: string, jeton: string): Promise<FormulaireMeta[]> {
  const sortie: FormulaireMeta[] = []
  let suivant: string | null = `${pageId}/leadgen_forms`
  let params: Record<string, string> = { fields: 'id,name,status', limit: '100' }
  for (let tour = 0; suivant && tour < 10; tour++) {
    const r: any = await graph(suivant, jeton, { params })
    sortie.push(...(r.data || []))
    const apres = r.paging?.cursors?.after
    suivant = r.paging?.next && apres ? `${pageId}/leadgen_forms` : null
    params = { ...params, after: apres || '' }
  }
  return sortie
}

/** Nom et questions d'un formulaire, gardés en mémoire de l'instance une heure. */
const cacheFormulaires = new Map<string, { valeur: FormulaireMeta | null; jusqua: number }>()
async function formulaire(formId: string, jeton: string): Promise<FormulaireMeta | null> {
  const enCache = cacheFormulaires.get(formId)
  if (enCache && enCache.jusqua > Date.now()) return enCache.valeur
  let valeur: FormulaireMeta | null = null
  try { valeur = await graph<FormulaireMeta>(formId, jeton, { params: { fields: 'id,name,questions' } }) } catch { valeur = null }
  cacheFormulaires.set(formId, { valeur, jusqua: Date.now() + 3600000 })
  return valeur
}

const CHAMPS_PROSPECT = 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic,custom_disclaimer_responses'
/** Sans droit de lecture des publicités, Meta refuse les noms de campagne : on relit sans eux. */
const CHAMPS_PROSPECT_MINIMAUX = 'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id,platform,is_organic,custom_disclaimer_responses'

async function lireProspect(leadgenId: string, jeton: string): Promise<any> {
  try {
    return await graph(leadgenId, jeton, { params: { fields: CHAMPS_PROSPECT } })
  } catch (e) {
    if (e instanceof ErreurMeta && (e.code === 100 || e.code === 200 || e.code === 10)) {
      return graph(leadgenId, jeton, { params: { fields: CHAMPS_PROSPECT_MINIMAUX } })
    }
    throw e
  }
}

// ─── Traduction d'un prospect Meta ────────────────────────────────────────

const LIBELLES_STANDARD: Record<string, string> = {
  full_name: 'Nom complet', first_name: 'Prénom', last_name: 'Nom', email: 'E-mail', work_email: 'E-mail professionnel',
  phone_number: 'Téléphone', work_phone_number: 'Téléphone professionnel', company_name: 'Entreprise', job_title: 'Fonction',
  city: 'Ville', zip_code: 'Code postal', post_code: 'Code postal', street_address: 'Adresse', state: 'Région', country: 'Pays',
  date_of_birth: 'Date de naissance', gender: 'Genre', marital_status: 'Situation familiale', relationship_status: 'Situation',
}
/** Champs déjà rangés dans le lead : pas répétés dans les réponses */
const CHAMPS_IDENTITE = ['full_name', 'first_name', 'last_name', 'email', 'work_email', 'phone_number', 'work_phone_number', 'company_name', 'job_title', 'city', 'zip_code', 'post_code']
const PLATEFORMES: Record<string, string> = { fb: 'facebook', ig: 'instagram', msg: 'messenger', an: 'audience_network', wa: 'whatsapp' }

export function traduireProspectMeta(lead: any, form: FormulaireMeta | null): ProspectEntrant {
  const champs = new Map<string, string>()
  for (const f of (lead.field_data || []) as { name: string; values: string[] }[]) {
    const valeur = (f.values || []).map((v) => String(v).trim()).filter(Boolean).join(', ')
    if (f.name && valeur) champs.set(f.name, valeur)
  }
  const libelleQuestion = new Map<string, string>((form?.questions || []).map((q) => [q.key, q.label || q.key]))
  const reponses: ReponseProspect[] = []
  const complements: ProspectEntrant['complements'] = {}
  let entreprise = champs.get('company_name') || null
  champs.forEach((valeur, cle) => {
    if (CHAMPS_IDENTITE.includes(cle)) return
    const question = libelleQuestion.get(cle) || LIBELLES_STANDARD[cle] || cle.replace(/_/g, ' ')
    reponses.push({ question, reponse: valeur.replace(/_/g, ' ') })
    const q = question.toLowerCase()
    if (!complements.effectif_libelle && /salari|effectif|employ|équipe|equipe/.test(q)) complements.effectif_libelle = valeur.replace(/_/g, ' ')
    if (!complements.formation_souhaitee && /formation/.test(q)) complements.formation_souhaitee = valeur.replace(/_/g, ' ')
    if (!entreprise && demandeNomEtablissement(question)) entreprise = valeur
  })
  for (const d of (lead.custom_disclaimer_responses || []) as { checkbox_key: string; is_checked: string | boolean }[]) {
    const coche = d.is_checked === true || d.is_checked === '1' || d.is_checked === 'true'
    reponses.push({ question: libelleQuestion.get(d.checkbox_key) || `Case « ${d.checkbox_key} »`, reponse: coche ? 'Cochée' : 'Non cochée' })
  }

  // L'outil de test de Meta remplit chaque champ de « <test lead: dummy data for …> »
  const test = Array.from(champs.values()).some((v) => /dummy data|test lead/i.test(v))
  const plateforme = PLATEFORMES[String(lead.platform || '').toLowerCase()] || (lead.platform ? String(lead.platform).toLowerCase() : null)
  const nomFormulaire = form?.name || null
  const surQuoi = plateforme === 'instagram' ? ' sur Instagram' : plateforme === 'facebook' ? ' sur Facebook' : ''

  return {
    canal: 'meta',
    externeId: String(lead.id),
    soumisLe: lead.created_time ? new Date(lead.created_time).toISOString() : null,
    test,
    identite: {
      prenom: champs.get('first_name') || null,
      nom: champs.get('last_name') || null,
      nomComplet: champs.get('full_name') || null,
      email: champs.get('email') || champs.get('work_email') || null,
      telephone: champs.get('phone_number') || champs.get('work_phone_number') || null,
      entreprise,
      ville: champs.get('city') || null,
      codePostal: champs.get('zip_code') || champs.get('post_code') || null,
      poste: champs.get('job_title') || null,
    },
    reponses,
    complements,
    attribution: {
      canal: 'meta',
      plateforme,
      campagne: lead.campaign_name || null,
      campagne_id: lead.campaign_id || null,
      ensemble: lead.adset_name || null,
      ensemble_id: lead.adset_id || null,
      annonce: lead.ad_name || null,
      annonce_id: lead.ad_id || null,
      formulaire: nomFormulaire,
      formulaire_id: lead.form_id || form?.id || null,
      organique: typeof lead.is_organic === 'boolean' ? lead.is_organic : null,
    },
    evenement: `Formulaire Meta${nomFormulaire ? ` « ${nomFormulaire} »` : ''}${surQuoi}${lead.campaign_name ? `, campagne « ${lead.campaign_name} »` : ''}.`,
    etiquettes: ['meta', ...(plateforme ? [plateforme] : [])],
  }
}

/**
 * Note la notification au journal avant de lire le prospect chez Meta : si la
 * lecture échoue, l'identifiant reste (Meta abandonne ses envois au bout de
 * 36 heures et ne les rejoue pas). La ligne est en « erreur » à 0 tentative ;
 * la lecture réussie la reprend (voir recevoirProspect).
 */
export async function noterNotificationMeta(supabase: any, orgId: string, n: {
  leadgenId: string; pageId?: string | null; formId?: string | null; adId?: string | null; createdTime?: string | number | null
}): Promise<void> {
  const seconde = Number(n.createdTime)
  const { error } = await supabase.from('prospects_recus').insert({
    organization_id: orgId,
    canal: 'meta',
    externe_id: n.leadgenId,
    statut: 'erreur',
    tentatives: 0,
    erreur: 'Notification reçue : lecture du prospect chez Meta à faire.',
    soumis_le: Number.isFinite(seconde) && seconde > 0 ? new Date(seconde * 1000).toISOString() : null,
    donnees: { notification: { page_id: n.pageId || null, form_id: n.formId || null, ad_id: n.adId || null } },
  })
  // Déjà au journal (relevé passé avant, notification en double) : rien à ajouter
  if (error && error.code !== '23505') console.error('[meta] journal de la notification', error.message)
}

/** Lecture chez Meta impossible : le motif et une tentative de plus, sur la ligne en erreur. */
export async function noterEchecLecture(supabase: any, orgId: string, leadgenId: string, erreur: string): Promise<void> {
  const { data } = await supabase.from('prospects_recus').select('id, tentatives')
    .eq('organization_id', orgId).eq('canal', 'meta').eq('externe_id', leadgenId).eq('statut', 'erreur').maybeSingle()
  if (!data) return
  await supabase.from('prospects_recus').update({ erreur: erreur.slice(0, 1000), tentatives: Number(data.tentatives ?? 0) + 1 }).eq('id', data.id)
}

/** Lit un prospect par son identifiant et le fait entrer dans le CRM. */
export async function importerProspectMeta(supabase: any, canal: CanalMeta, leadgenId: string): Promise<ResultatReception> {
  if (!canal.secrets?.page_token) throw new ErreurMeta('Jeton de Page illisible : reconnectez Meta.')
  const lead = await lireProspect(leadgenId, canal.secrets.page_token)
  const form = lead.form_id ? await formulaire(String(lead.form_id), canal.secrets.page_token) : null
  return recevoirProspect(supabase, canal.organization_id, traduireProspectMeta(lead, form))
}

// ─── Relevé périodique ────────────────────────────────────────────────────

/** essais : prospects de l'outil de test de Meta, au journal seulement (ni lead ni alerte) */
export interface BilanReleve { formulaires: number; lus: number; nouveaux: number; essais: number; erreurs: number; message: string | null }

/** Réception restée « en cours » au-delà : traitement coupé (délai dépassé), à rejouer */
const DELAI_INTERROMPUE_MS = 2 * 60 * 1000

/**
 * Lit les prospects reçus depuis le dernier relevé (une heure de recouvrement)
 * dans chaque formulaire de la Page. Les déjà reçus sont reconnus par le journal.
 */
export async function releverMeta(supabase: any, canal: CanalMeta, options: { depuis?: Date } = {}): Promise<BilanReleve> {
  const bilan: BilanReleve = { formulaires: 0, lus: 0, nouveaux: 0, essais: 0, erreurs: 0, message: null }
  if (!canal.actif || !canal.secrets?.page_token || !canal.config?.page_id) return { ...bilan, message: 'Meta n’est pas branché' }
  const debut = new Date()
  const depuis = Math.floor(((options.depuis ? options.depuis.getTime() : canal.dernier_releve_at ? new Date(canal.dernier_releve_at).getTime() : Date.now() - 90 * 86400000) - 3600000) / 1000)
  try {
    const formulaires = await formulairesDeLaPage(canal.config.page_id, canal.secrets.page_token)
    bilan.formulaires = formulaires.length
    for (const f of formulaires) {
      // Meta ne garde les prospects que 90 jours ; un formulaire archivé peut encore en recevoir de rares
      let suivant: string | null = `${f.id}/leads`
      let params: Record<string, string> = {
        fields: CHAMPS_PROSPECT_MINIMAUX,
        filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: depuis }]),
        limit: '100',
      }
      // Le filtre par date n'est documenté que pour /{ad}/leads : s'il est refusé, on lit sans
      // filtre (du plus récent au plus ancien) et l'on s'arrête au premier prospect trop ancien
      let sansFiltre = false
      for (let tour = 0; suivant && tour < 20; tour++) {
        let r: any
        try {
          r = await graph(suivant, canal.secrets.page_token, { params })
        } catch (e) {
          if (!sansFiltre && tour === 0 && e instanceof ErreurMeta && e.code === 100) {
            sansFiltre = true
            const { filtering: _filtre, ...reste } = params
            params = reste
            r = await graph(suivant, canal.secrets.page_token, { params })
          } else throw e
        }
        let lot = (r.data || []) as any[]
        let fini = false
        if (sansFiltre) {
          const recents = lot.filter((l) => !l.created_time || new Date(l.created_time).getTime() / 1000 > depuis)
          fini = recents.length < lot.length
          lot = recents
        }
        // Déjà reçus (par le webhook ou un relevé précédent) : on ne les relit pas chez Meta
        const { data: connus } = lot.length
          ? await supabase.from('prospects_recus').select('externe_id, statut')
              .eq('organization_id', canal.organization_id).eq('canal', 'meta').in('externe_id', lot.map((l) => String(l.id)))
          : { data: [] }
        const dejaTraites = new Set(((connus || []) as any[]).filter((c) => c.statut !== 'erreur' && c.statut !== 'en_cours').map((c) => c.externe_id))
        for (const lead of lot) {
          bilan.lus++
          if (dejaTraites.has(String(lead.id))) continue
          try {
            // Relu un par un : les noms de campagne et d'annonce ne viennent qu'à l'unité
            const res = await importerProspectMeta(supabase, canal, String(lead.id))
            if (res.statut === 'lead_cree' || res.statut === 'lead_complete' || res.statut === 'client_connu') bilan.nouveaux++
            if (res.statut === 'test') bilan.essais++
            if (res.statut === 'erreur') bilan.erreurs++
          } catch (e: any) {
            bilan.erreurs++
            console.error('[meta] relevé, prospect', lead.id, e?.message || e)
            await noterNotificationMeta(supabase, canal.organization_id, { leadgenId: String(lead.id), formId: f.id, createdTime: lead.created_time ? Math.floor(new Date(lead.created_time).getTime() / 1000) : null })
            await noterEchecLecture(supabase, canal.organization_id, String(lead.id), e?.message || String(e))
          }
        }
        const apres = r.paging?.cursors?.after
        suivant = !fini && r.paging?.next && apres ? `${f.id}/leads` : null
        params = { ...params, after: apres || '' }
      }
    }
    // Prospects restés en erreur au-delà de la fenêtre du relevé (lecture refusée, panne), ou
    // restés « en cours » d'un traitement coupé : rejoués tant que Meta les garde (90 jours),
    // 30 essais au plus chacun
    const coupure = new Date(Date.now() - DELAI_INTERROMPUE_MS).toISOString()
    const { data: enErreur } = await supabase.from('prospects_recus').select('externe_id')
      .eq('organization_id', canal.organization_id).eq('canal', 'meta')
      .or(`statut.eq.erreur,and(statut.eq.en_cours,traite_le.lt.${coupure})`)
      .gte('recu_le', new Date(Date.now() - 90 * 86400000).toISOString()).lt('tentatives', 30)
      .order('recu_le', { ascending: false }).limit(50)
    for (const ligne of (enErreur || []) as any[]) {
      if (!ligne.externe_id) continue
      try {
        const res = await importerProspectMeta(supabase, canal, String(ligne.externe_id))
        if (res.statut === 'lead_cree' || res.statut === 'lead_complete' || res.statut === 'client_connu') bilan.nouveaux++
        if (res.statut === 'test') bilan.essais++
        if (res.statut === 'erreur') bilan.erreurs++
      } catch (e: any) {
        bilan.erreurs++
        await noterEchecLecture(supabase, canal.organization_id, String(ligne.externe_id), e?.message || String(e))
      }
    }
    await supabase.from('canaux_prospects').update({ dernier_releve_at: debut.toISOString(), updated_at: new Date().toISOString() })
      .eq('organization_id', canal.organization_id).eq('canal', 'meta')
    await noterErreur(supabase, canal.organization_id, bilan.erreurs ? `${bilan.erreurs} prospect(s) non importé(s) au dernier relevé : nouvel essai au suivant.` : null)
  } catch (e: any) {
    bilan.message = e?.message || String(e)
    await noterErreur(supabase, canal.organization_id, bilan.message)
  }
  return bilan
}
