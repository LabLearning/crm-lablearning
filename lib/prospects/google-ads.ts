import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { chiffrerSecrets, dechiffrerSecrets } from './coffre'
import type { ProspectEntrant, ReponseProspect } from './types'
import { demandeNomEtablissement } from './questions'

/**
 * Formulaires pour prospects Google Ads → leads du CRM.
 *
 * Dans Google Ads, l'élément « formulaire pour prospects » accepte une
 * intégration par webhook : une adresse (la nôtre) et une clé que Google
 * renvoie dans chaque envoi (google_key). La clé est rangée deux fois :
 * chiffrée (pour l'afficher à l'administrateur qui la colle dans Google Ads)
 * et sous forme d'empreinte (pour reconnaître un envoi sans la déchiffrer).
 */

export const URL_WEBHOOK_GOOGLE = `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/api/webhooks/google-ads`

export const empreinteCle = (cle: string) => createHash('sha256').update(`google-ads:${cle}`).digest('hex')

export function nouvelleCleGoogle(): string {
  return randomBytes(24).toString('base64url')
}

/** Enregistre une nouvelle clé (la précédente cesse aussitôt de fonctionner). */
export async function enregistrerCleGoogle(supabase: any, orgId: string, cle: string, userId: string) {
  const { error } = await supabase.from('canaux_prospects').upsert({
    organization_id: orgId,
    canal: 'google_ads',
    actif: true,
    config: { cle_creee_le: new Date().toISOString(), cle_creee_par: userId },
    secrets: chiffrerSecrets({ cle }),
    cle_verification: empreinteCle(cle),
    derniere_erreur: null,
    derniere_erreur_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,canal' })
  if (error) throw new Error(`Enregistrement de la clé impossible : ${error.message}`)
}

export async function lireCleGoogle(supabase: any, orgId: string): Promise<string | null> {
  const { data } = await supabase.from('canaux_prospects').select('secrets')
    .eq('organization_id', orgId).eq('canal', 'google_ads').maybeSingle()
  return dechiffrerSecrets<{ cle: string }>((data as any)?.secrets)?.cle || null
}

/**
 * Organisme dont la clé correspond à celle reçue (comparaison des empreintes à
 * temps constant), ou null. Lève une erreur si la base ne répond pas : le
 * webhook répond alors 503 et Google renvoie le prospect, au lieu d'un refus
 * définitif de clé.
 */
export async function organismeDeLaCle(supabase: any, cleRecue: string): Promise<string | null> {
  if (!cleRecue || cleRecue.length > 200) return null
  const empreinte = empreinteCle(cleRecue)
  const { data, error } = await supabase.from('canaux_prospects').select('organization_id, cle_verification')
    .eq('canal', 'google_ads').eq('actif', true)
  if (error) throw new Error(`Lecture des canaux impossible : ${error.message}`)
  for (const c of (data || []) as any[]) {
    const attendue = String(c.cle_verification || '')
    if (attendue.length === empreinte.length && timingSafeEqual(Buffer.from(attendue), Buffer.from(empreinte))) return c.organization_id
  }
  return null
}

// ─── Traduction d'un envoi Google Ads ─────────────────────────────────────

const LIBELLES: Record<string, string> = {
  FULL_NAME: 'Nom complet', FIRST_NAME: 'Prénom', LAST_NAME: 'Nom', EMAIL: 'E-mail', WORK_EMAIL: 'E-mail professionnel',
  PHONE_NUMBER: 'Téléphone', WORK_PHONE: 'Téléphone professionnel', PHONE_NUMBER_VERIFIED: 'Téléphone vérifié',
  POSTAL_CODE: 'Code postal', STREET_ADDRESS: 'Adresse', CITY: 'Ville', REGION: 'Région', COUNTRY: 'Pays',
  COMPANY_NAME: 'Entreprise', JOB_TITLE: 'Fonction',
  // Questions préréglées de Google utiles pour une formation
  COMPANY_SIZE: 'Taille de l’entreprise', YEARS_IN_BUSINESS: 'Ancienneté de l’entreprise', JOB_ROLE: 'Fonction',
  JOB_INDUSTRY: 'Secteur', EDUCATION_PROGRAM: 'Programme souhaité', EDUCATION_COURSE: 'Formation souhaitée',
  SERVICE: 'Service souhaité', OFFER: 'Offre', PREFERRED_CONTACT_METHOD: 'Moyen de contact préféré',
  PREFERRED_CONTACT_TIME: 'Moment préféré pour être rappelé', PREFERRED_LOCATION: 'Lieu souhaité', PURCHASE_TIMELINE: 'Échéance',
}
const EFFECTIF = ['COMPANY_SIZE']
const FORMATION = ['EDUCATION_COURSE', 'EDUCATION_PROGRAM', 'SERVICE']
/** Déjà rangés dans le lead : pas répétés dans les réponses */
const IDENTITE = ['FULL_NAME', 'FIRST_NAME', 'LAST_NAME', 'EMAIL', 'WORK_EMAIL', 'PHONE_NUMBER', 'WORK_PHONE', 'POSTAL_CODE', 'CITY', 'COMPANY_NAME', 'JOB_TITLE']

export function traduireEnvoiGoogle(corps: any): ProspectEntrant {
  const colonnes = new Map<string, { libelle: string; valeur: string }>()
  for (const c of (corps.user_column_data || []) as any[]) {
    const id = String(c.column_id || c.column_name || '').trim()
    const valeur = String(c.string_value ?? '').trim()
    // column_name est déclaré obsolète par Google : column_id d'abord, le nom en secours
    if (id && valeur) colonnes.set(id.toUpperCase() in LIBELLES ? id.toUpperCase() : id, { libelle: String(c.column_name || id).replace(/_/g, ' '), valeur })
  }
  const v = (id: string) => colonnes.get(id)?.valeur || null
  const reponses: ReponseProspect[] = []
  const complements: ProspectEntrant['complements'] = {}
  let entreprise = v('COMPANY_NAME')
  colonnes.forEach(({ libelle, valeur }, id) => {
    if (IDENTITE.includes(id)) return
    const question = LIBELLES[id] || libelle
    reponses.push({ question, reponse: valeur })
    const q = question.toLowerCase()
    if (!complements.effectif_libelle && (EFFECTIF.includes(id) || /salari|effectif|employ|équipe|equipe|company size|size of/.test(q))) complements.effectif_libelle = valeur
    if (!complements.formation_souhaitee && (FORMATION.includes(id) || /formation|course|training/.test(q))) complements.formation_souhaitee = valeur
    if (!entreprise && !EFFECTIF.includes(id) && demandeNomEtablissement(question)) entreprise = valeur
  })

  // Identifiants à 0 : sans objet (adgroup_id et creative_id ne valent que pour la vidéo)
  const id = (x: unknown) => (x === null || x === undefined || x === '' || x === 0 || x === '0' ? null : String(x))
  const soumis = corps.lead_submit_time ? new Date(String(corps.lead_submit_time).replace(' ', 'T')) : null
  return {
    canal: 'google_ads',
    externeId: id(corps.lead_id),
    soumisLe: soumis && !Number.isNaN(soumis.getTime()) ? soumis.toISOString() : null,
    test: corps.is_test === true || corps.is_test === 'true',
    identite: {
      prenom: v('FIRST_NAME'),
      nom: v('LAST_NAME'),
      nomComplet: v('FULL_NAME'),
      email: v('EMAIL') || v('WORK_EMAIL'),
      telephone: v('PHONE_NUMBER') || v('WORK_PHONE'),
      entreprise,
      ville: v('CITY'),
      codePostal: v('POSTAL_CODE'),
      poste: v('JOB_TITLE'),
    },
    reponses,
    complements,
    attribution: {
      canal: 'google_ads',
      plateforme: 'google',
      campagne_id: id(corps.campaign_id),
      // Performance Max : groupe d'éléments à la place du groupe d'annonces
      ensemble_id: id(corps.adgroup_id) || id(corps.asset_group_id),
      annonce_id: id(corps.creative_id),
      formulaire_id: id(corps.form_id),
      gclid: id(corps.gcl_id),
    },
    // Tel que reçu, sans la clé : lead_stage, lead_source et questions personnalisées ne sont pas documentés
    brut: Object.fromEntries(Object.entries(corps || {}).filter(([k]) => k !== 'google_key')),
    evenement: `Formulaire Google Ads${corps.campaign_id ? ` (campagne ${corps.campaign_id})` : ''}.`,
    etiquettes: ['google-ads'],
  }
}
