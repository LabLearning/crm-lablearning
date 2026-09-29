/**
 * Santé de la plateforme et alertes de panne.
 *
 * Le CRM entier repose sur Supabase : quand la base tombe, la connexion, les
 * données et le stockage tombent avec elle (panne du 29/09/2026, 1 h 45 sans
 * accès, personne prévenu). On sonde donc directement chaque service, par HTTP
 * brut avec un délai court : le client supabase-js peut attendre très
 * longtemps une base qui ne répond plus.
 *
 * Les alertes partent par Resend, qui ne dépend pas de Supabase. La clé
 * d'idempotence (demi-heure + services en panne) est la même pour la tâche
 * Vercel et la surveillance GitHub (.github/workflows/surveillance-crm.yml) :
 * une même panne, où qu'elle soit vue, ne donne qu'un message par demi-heure.
 */

export interface EtatService { ok: boolean; ms: number; erreur?: string }

export type NomService = 'base' | 'connexion' | 'stockage' | 'ecriture'

export interface EtatSante {
  ok: boolean
  verifieLe: string
  /** « ecriture » n'est sondée que par la tâche planifiée (écriture du battement). */
  services: Partial<Record<NomService, EtatService>> & { base: EtatService; connexion: EtatService; stockage: EtatService }
}

export const LIBELLES_SERVICES: Record<NomService, string> = {
  base: 'Base de données',
  connexion: 'Connexion des utilisateurs',
  stockage: 'Stockage des documents',
  ecriture: 'Enregistrement en base',
}

const IMPACTS: Record<NomService, string> = {
  base: 'Le CRM ne peut plus lire ses données : les pages ne s’affichent plus.',
  connexion: 'Les utilisateurs ne peuvent plus se connecter.',
  stockage: 'Les documents (PDF, pièces jointes) ne s’ouvrent plus.',
  ecriture: 'Le CRM ne peut plus rien enregistrer : la base est en lecture seule, le plus souvent parce que le disque est plein.',
}

const DELAI_MS = 8000

/** Appel HTTP borné dans le temps ; le corps est toujours lu pour libérer la connexion. */
async function appeler(url: string, init: RequestInit = {}): Promise<{ status: number; corps: string; ms: number; erreur?: string }> {
  const debut = Date.now()
  const controle = new AbortController()
  const minuteur = setTimeout(() => controle.abort(), DELAI_MS)
  try {
    const r = await fetch(url, { ...init, cache: 'no-store', signal: controle.signal })
    const corps = await r.text().catch(() => '')
    return { status: r.status, corps, ms: Date.now() - debut }
  } catch (e: any) {
    return {
      status: 0, corps: '', ms: Date.now() - debut,
      erreur: e?.name === 'AbortError' ? `aucune réponse en ${DELAI_MS / 1000} s` : String(e?.message || e),
    }
  } finally {
    clearTimeout(minuteur)
  }
}

async function sonder(url: string, entetes: Record<string, string>): Promise<EtatService> {
  const r = await appeler(url, { headers: entetes })
  if (r.erreur) return { ok: false, ms: r.ms, erreur: r.erreur }
  return r.status >= 200 && r.status < 300 ? { ok: true, ms: r.ms } : { ok: false, ms: r.ms, erreur: `HTTP ${r.status}` }
}

const configSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && service ? { url, entetes: { apikey: service, Authorization: `Bearer ${service}` } } : null
}

/** Base, authentification et stockage Supabase répondent-ils ? */
export async function verifierSante(): Promise<EtatSante> {
  const verifieLe = new Date().toISOString()
  const cfg = configSupabase()
  if (!cfg) {
    const absent: EtatService = { ok: false, ms: 0, erreur: 'configuration Supabase absente' }
    return { ok: false, verifieLe, services: { base: absent, connexion: absent, stockage: absent } }
  }
  const [base, connexion, stockage] = await Promise.all([
    // Une vraie lecture : PostgREST répond sans la base pour certaines routes
    sonder(`${cfg.url}/rest/v1/organizations?select=id&limit=1`, cfg.entetes),
    // /auth/v1/health ne touche pas la base : on lit un compte, comme une connexion
    sonder(`${cfg.url}/auth/v1/admin/users?page=1&per_page=1`, cfg.entetes),
    sonder(`${cfg.url}/storage/v1/bucket`, cfg.entetes),
  ])
  return { ok: base.ok && connexion.ok && stockage.ok, verifieLe, services: { base, connexion, stockage } }
}

export const servicesEnPanne = (etat: EtatSante): NomService[] =>
  (Object.keys(etat.services) as NomService[]).filter((k) => etat.services[k] && !etat.services[k]!.ok).sort()

/** Base, connexion ou enregistrement en panne : le CRM est inutilisable. */
export const panneCritique = (etat: EtatSante) => servicesEnPanne(etat).some((s) => s !== 'stockage')

// ── Battement : dernière vérification réussie (table sante_plateforme) ───────

export interface Battement { ok: boolean; tableAbsente?: boolean; dernierOk: Date | null; erreur?: string }

const tableAbsente = (status: number, corps: string) => status === 404 || /PGRST205|42P01/.test(corps)

export async function lireBattement(): Promise<Battement> {
  const cfg = configSupabase()
  if (!cfg) return { ok: false, dernierOk: null, erreur: 'configuration Supabase absente' }
  const r = await appeler(`${cfg.url}/rest/v1/sante_plateforme?id=eq.crm&select=dernier_ok`, { headers: cfg.entetes })
  if (r.erreur) return { ok: false, dernierOk: null, erreur: r.erreur }
  // Migration 163 pas encore appliquée
  if (tableAbsente(r.status, r.corps)) return { ok: false, tableAbsente: true, dernierOk: null }
  if (r.status !== 200) return { ok: false, dernierOk: null, erreur: `HTTP ${r.status} ${r.corps.slice(0, 160)}` }
  try {
    const ligne = JSON.parse(r.corps)?.[0]
    return { ok: true, dernierOk: ligne?.dernier_ok ? new Date(ligne.dernier_ok) : null }
  } catch {
    return { ok: false, dernierOk: null, erreur: 'réponse illisible' }
  }
}

/** Écrit le battement : c'est aussi la sonde d'écriture (base en lecture seule, disque plein). */
export async function ecrireBattement(le: Date): Promise<EtatService> {
  const cfg = configSupabase()
  if (!cfg) return { ok: false, ms: 0, erreur: 'configuration Supabase absente' }
  const r = await appeler(`${cfg.url}/rest/v1/sante_plateforme?on_conflict=id`, {
    method: 'POST',
    headers: { ...cfg.entetes, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 'crm', dernier_ok: le.toISOString(), updated_at: new Date().toISOString() }),
  })
  if (r.erreur) return { ok: false, ms: r.ms, erreur: r.erreur }
  return r.status >= 200 && r.status < 300 ? { ok: true, ms: r.ms } : { ok: false, ms: r.ms, erreur: `HTTP ${r.status} ${r.corps.slice(0, 160)}` }
}

export async function historiserPanne(debut: Date, fin: Date): Promise<void> {
  const cfg = configSupabase()
  if (!cfg) return
  await appeler(`${cfg.url}/rest/v1/incidents_plateforme?on_conflict=debut`, {
    method: 'POST',
    headers: { ...cfg.entetes, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ debut: debut.toISOString(), fin: fin.toISOString(), minutes: Math.round((fin.getTime() - debut.getTime()) / 60000) }),
  })
}

// ── Alertes ─────────────────────────────────────────────────────────────────

export function destinatairesAlertes(): string[] {
  return (process.env.ALERTES_EMAILS || 'digital@lab-learning.fr').split(/[,;\s]+/).filter(Boolean)
}

const EXPEDITEUR = 'Surveillance CRM <noreply@lab-learning.fr>'
const SUJET_RETABLI = 'Le CRM Lab Learning répond de nouveau'

/**
 * Clé d'idempotence d'une alerte : la demi-heure (UTC) et les services en
 * panne. Même format dans .github/workflows/surveillance-crm.yml.
 */
export function clePanne(etat: EtatSante): string {
  const d = new Date(etat.verifieLe)
  const demiHeure = d.getUTCMinutes() < 30 ? '00' : '30'
  return `crm-panne-${d.toISOString().slice(0, 13)}-${demiHeure}-${servicesEnPanne(etat).join('+') || 'aucun'}`
}

const heureParis = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(d).replace(':', ' h ')
const jourParis = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(d)
const duree = (ms: number) => {
  const min = Math.max(1, Math.round(ms / 60000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}
const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function gabarit(titre: string, couleur: string, corps: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f1f5f4;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${couleur};color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">${echapper(titre)}</td></tr>
<tr><td style="padding:20px 24px;font-size:15px;line-height:1.55">${corps}</td></tr>
<tr><td style="padding:12px 24px 20px;font-size:12px;color:#64748b">Surveillance automatique du CRM Lab Learning, vérification toutes les 2 minutes.</td></tr>
</table></td></tr></table></body></html>`
}

function lienProjetSupabase() {
  const ref = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname.split('.')[0] } catch { return '' } })()
  return ref ? `https://supabase.com/dashboard/project/${ref}` : 'https://supabase.com/dashboard'
}

export function messagePanne(etat: EtatSante, opts: { dernierOk?: Date | null; essai?: boolean } = {}) {
  const d = new Date(etat.verifieLe)
  const enPanne = servicesEnPanne(etat)
  // Essai sans panne : l'e-mail montre l'alerte telle qu'elle arriverait pour la base
  const critique = enPanne.length === 0 || panneCritique(etat)
  const constat = !critique ? 'stockage des documents du CRM indisponible'
    : enPanne.every((s) => s === 'ecriture' || s === 'stockage') ? 'le CRM ne peut plus rien enregistrer'
      : 'le CRM Lab Learning est inaccessible'
  const sujet = `${opts.essai ? 'Essai : ' : critique ? 'URGENT : ' : 'Alerte : '}${constat}`
  const lignes = (Object.keys(etat.services) as NomService[]).map((k) => {
    const s = etat.services[k]!
    return `<li><b>${LIBELLES_SERVICES[k]}</b> : ${s.ok ? 'répond' : `en panne (${echapper(s.erreur || 'erreur')})`}</li>`
  }).join('')
  const impacts = enPanne.map((k) => `<p style="margin:6px 0">${IMPACTS[k]}</p>`).join('')
  const projet = lienProjetSupabase()
  const html = gabarit(sujet, critique ? '#b42318' : '#b54708', `
${opts.essai ? '<p><b>Ceci est un essai de la surveillance, le CRM fonctionne.</b></p>' : ''}
<p>Panne constatée à <b>${heureParis(d)}</b> (${jourParis(d)}).${opts.dernierOk ? ` Dernière vérification réussie : ${heureParis(opts.dernierOk)}.` : ''}</p>
${impacts}
<ul style="padding-left:18px">${lignes}</ul>
<p style="margin-bottom:6px"><b>Ce qu'il faut faire</b></p>
<ol style="padding-left:18px;margin-top:0">
<li>Ouvrir le <a href="${projet}">projet Supabase</a> et lire le statut en haut de page.</li>
${enPanne.includes('ecriture')
    ? '<li>Regarder d’abord le disque (Settings, Compute and Disk) : un disque plein se règle en l’agrandissant, pas en redémarrant.</li>'
    : '<li>S’il est « Unhealthy » : Settings, General, Restart project, puis « Fast database reboot ».</li>'}
<li>Regarder Reports, Database : processeur, mémoire, disque.</li>
<li>Vérifier que la panne n'est pas générale sur <a href="https://status.supabase.com">status.supabase.com</a>.</li>
</ol>
<p>Un message vous préviendra dès que le CRM répond de nouveau. Tant que la panne dure, un rappel part toutes les 30 minutes.</p>`)
  const texte = [
    sujet, '',
    `Panne constatée à ${heureParis(d)} (${jourParis(d)}).${opts.dernierOk ? ` Dernière vérification réussie : ${heureParis(opts.dernierOk)}.` : ''}`,
    ...enPanne.map((k) => IMPACTS[k]),
    ...(Object.keys(etat.services) as NomService[]).map((k) => `- ${LIBELLES_SERVICES[k]} : ${etat.services[k]!.ok ? 'répond' : `en panne (${etat.services[k]!.erreur})`}`),
    '', `Projet Supabase : ${projet}`,
  ].join('\n')
  return { sujet, html, texte }
}

export function messageRetabli(dernierOk: Date, retour: Date) {
  const html = gabarit(SUJET_RETABLI, '#205040', `
<p>Le CRM fonctionne de nouveau depuis <b>${heureParis(retour)}</b> (${jourParis(retour)}).</p>
<p>Aucune vérification n'avait abouti depuis ${heureParis(dernierOk)}, soit environ <b>${duree(retour.getTime() - dernierOk.getTime())}</b> d'indisponibilité.</p>
<p>Pour en connaître la cause, regardez Reports, Database dans le <a href="${lienProjetSupabase()}">projet Supabase</a> sur cette période.</p>`)
  const texte = `${SUJET_RETABLI}\n\nDe nouveau disponible depuis ${heureParis(retour)}. Aucune vérification n'avait abouti depuis ${heureParis(dernierOk)} (${duree(retour.getTime() - dernierOk.getTime())}).`
  return { sujet: SUJET_RETABLI, html, texte }
}

export interface ResultatEnvoi { envoye: boolean; dejaEnvoye: boolean; reessayer: boolean; detail: string }

/**
 * Envoie une alerte par Resend. Une clé d'idempotence déjà utilisée (même
 * alerte déjà partie, par Vercel ou par GitHub) n'envoie rien de plus : Resend
 * répond 409, ou renvoie la réponse d'origine pour un contenu identique.
 */
export async function envoyerAlerte(m: { sujet: string; html: string; texte: string }, cle: string): Promise<ResultatEnvoi> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { envoye: false, dejaEnvoye: false, reessayer: false, detail: 'RESEND_API_KEY absente' }
  const r = await appeler('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': cle },
    body: JSON.stringify({ from: EXPEDITEUR, to: destinatairesAlertes(), subject: m.sujet, html: m.html, text: m.texte }),
  })
  if (r.erreur) return { envoye: false, dejaEnvoye: false, reessayer: true, detail: r.erreur }
  if (r.status >= 200 && r.status < 300) return { envoye: true, dejaEnvoye: false, reessayer: false, detail: r.corps.slice(0, 200) }
  if (r.status === 409) return { envoye: false, dejaEnvoye: true, reessayer: false, detail: 'déjà envoyée' }
  return { envoye: false, dejaEnvoye: false, reessayer: r.status === 429 || r.status >= 500, detail: `Resend HTTP ${r.status} ${r.corps.slice(0, 200)}` }
}

/**
 * Une alerte de panne est-elle partie depuis cette date ? Lu dans les
 * derniers e-mails envoyés par Resend : c'est le seul témoin qui survit à une
 * panne de la base. null quand Resend ne répond pas.
 */
export async function alerteEnvoyeeDepuis(depuis: Date): Promise<boolean | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  const r = await appeler('https://api.resend.com/emails?limit=100', { headers: { Authorization: `Bearer ${apiKey}` } })
  if (r.erreur || r.status !== 200) return null
  try {
    const liste = (JSON.parse(r.corps)?.data || []) as any[]
    const date = (s: string) => new Date(String(s).replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1').replace(/\+00(:00)?$/, 'Z'))
    return liste.some((e) =>
      String(e.from || '').startsWith('Surveillance CRM')
      && /^(URGENT|Alerte) : /.test(String(e.subject || ''))
      && date(e.created_at).getTime() > depuis.getTime())
  } catch {
    return null
  }
}
