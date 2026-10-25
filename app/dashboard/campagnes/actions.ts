'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession, type SessionContext } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { peutGererCampagnes } from '@/lib/acces-reserves'
import { calculerAudience } from '@/lib/campagnes/audience'
import { aUnPublic, audienceParDefaut, departementsInconnus, nettoyerFiltres, type PublicAudience } from '@/lib/campagnes/publics'
import { envoyerEmailBrevo, envoyerSmsBrevo } from '@/lib/campagnes/brevo'
import { configCampagnes, manquesPourEnvoyer } from '@/lib/campagnes/config'
import { jetonDesinscription, lienDesinscription } from '@/lib/campagnes/desinscription'
import { lancerCampagne, refusCampagne, type Campagne } from '@/lib/campagnes/envoi'
import { oppositionsParmi } from '@/lib/campagnes/oppositions'
import { compterSms, dansFenetreSms, numeroSmsFrance, smsPour, type CanalCampagne } from '@/lib/campagnes/regles'
import { rendreEmailCampagne } from '@/lib/campagnes/rendu'
import type { ActionResult } from '@/lib/types'

/**
 * Campagnes marketing (onglet Commercial > Campagnes) : réservées aux
 * responsables (lib/acces-reserves, ROLES_CAMPAGNES). Comme toute action
 * exportée d'un module 'use server', chacune vérifie elle-même le rôle et
 * l'organisme de la campagne.
 */
const REFUS = { success: false, error: 'Accès non autorisé' } as const
const peut = (s: SessionContext) => peutGererCampagnes(s.user.role)
  && checkDashboardAccess('/dashboard/campagnes', s.user.role as any, s.permissions).allowed

const propre = (v: unknown, max: number) => String(v ?? '').replace(/\u0000/g, '').slice(0, max)

async function campagneDeLOrganisme(supabase: any, session: SessionContext, id: string): Promise<Campagne & Record<string, any> | null> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabase.from('campagnes').select('*').eq('id', id).eq('organization_id', session.organization.id).maybeSingle()
  return data || null
}

/** Organisme tel qu'il signe les e-mails (nom, logo, adresse, Qualiopi). */
function signature(session: SessionContext) {
  const o: any = session.organization
  return { nom: o.name || 'Lab Learning', email: o.email_contact || o.email || null, logoUrl: o.logo_url || null, qualiopi: o.is_qualiopi !== false }
}

export async function creerCampagneAction(canal: CanalCampagne): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  if (canal !== 'email' && canal !== 'sms') return { success: false, error: 'Canal inconnu' }
  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase.from('campagnes').insert({
    organization_id: session.organization.id,
    nom: canal === 'email' ? 'Nouvelle campagne e-mail' : 'Nouvelle campagne SMS',
    canal,
    contenu: '',
    // Par défaut : les demandes entrantes des 3 dernières années (pas les anciens leads de salons ou de phoning)
    audience: audienceParDefaut(),
    created_by: session.user.id,
  }).select('id').single()
  if (error || !data) return { success: false, error: 'La campagne n’a pas été créée : la migration 168 est-elle appliquée ?' }
  await logAudit({ action: 'create', entity_type: 'campagne', entity_id: data.id, details: { canal } })
  revalidatePath('/dashboard/campagnes')
  return { success: true, data: { id: data.id } }
}

export interface ChampsCampagne {
  nom: string
  objet?: string | null
  contenu: string
  bouton_libelle?: string | null
  bouton_url?: string | null
  audience: unknown
}

/** Enregistre un brouillon (une campagne programmée se déprogramme d'abord). */
export async function enregistrerCampagneAction(id: string, champs: ChampsCampagne): Promise<ActionResult> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const c = await campagneDeLOrganisme(supabase, session, id)
  if (!c) return { success: false, error: 'Campagne introuvable' }
  if (c.statut !== 'brouillon') return { success: false, error: 'Seul un brouillon se modifie : déprogrammez la campagne d’abord' }
  const nom = propre(champs.nom, 120).trim()
  if (!nom) return { success: false, error: 'Donnez un nom à la campagne' }
  const inconnus = departementsInconnus(champs.audience)
  if (inconnus.length) return { success: false, error: `Département non reconnu : ${inconnus.slice(0, 3).join(', ')} (2 chiffres, 2A, 2B ou 97x)` }
  const { error } = await supabase.from('campagnes').update({
    nom,
    objet: c.canal === 'email' ? (propre(champs.objet, 200).trim() || null) : null,
    contenu: propre(champs.contenu, c.canal === 'email' ? 20000 : 1000),
    bouton_libelle: c.canal === 'email' ? (propre(champs.bouton_libelle, 60).trim() || null) : null,
    bouton_url: c.canal === 'email' ? (propre(champs.bouton_url, 500).trim() || null) : null,
    audience: nettoyerFiltres(champs.audience),
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('organization_id', session.organization.id).eq('statut', 'brouillon')
  if (error) return { success: false, error: 'Enregistrement impossible' }
  revalidatePath('/dashboard/campagnes')
  revalidatePath(`/dashboard/campagnes/${id}`)
  return { success: true }
}

/** Taille de l'audience, par public, et ce qui en est exclu, avec quelques noms pour vérifier. */
export async function calculerAudienceAction(canal: CanalCampagne, filtres: unknown): Promise<ActionResult<{
  total: number
  exemples: string[]
  exclus: { sansCoordonnee: number; opposition: number; doublon: number; particulier: number; ancien: number }
  parPublic: Record<PublicAudience, number>
  franchisesAtteints: number
}>> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  if (canal !== 'email' && canal !== 'sms') return { success: false, error: 'Canal inconnu' }
  const inconnus = departementsInconnus(filtres)
  if (inconnus.length) return { success: false, error: `Département non reconnu : ${inconnus.slice(0, 3).join(', ')} (2 chiffres, 2A, 2B ou 97x)` }
  const supabase = await createServiceRoleClient()
  try {
    const r = await calculerAudience(supabase, session.organization.id, canal, nettoyerFiltres(filtres))
    // Un échantillon pris dans chaque public, pour vérifier d'un coup d'œil
    const exemples: string[] = []
    for (const pub of ['clients', 'reseaux', 'apporteurs', 'prospects'] as PublicAudience[]) {
      for (const d of r.destinataires.filter((x) => x.public === pub).slice(0, 3)) {
        exemples.push(d.etablissement && d.etablissement !== d.nom ? `${d.nom} (${d.etablissement})` : d.nom)
      }
    }
    return { success: true, data: { total: r.destinataires.length, exemples: exemples.slice(0, 10), exclus: r.exclus, parPublic: r.parPublic, franchisesAtteints: r.franchisesAtteints } }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Calcul impossible' }
  }
}

/** Aperçu de l'e-mail tel qu'il partira (prénom et établissement d'exemple). */
export async function apercuEmailAction(champs: { objet: string; contenu: string; bouton_libelle?: string | null; bouton_url?: string | null }): Promise<ActionResult<{ objet: string; html: string }>> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  const m = rendreEmailCampagne(
    { objet: propre(champs.objet, 200), contenu: propre(champs.contenu, 20000), boutonLibelle: propre(champs.bouton_libelle, 60) || null, boutonUrl: propre(champs.bouton_url, 500) || null },
    { prenom: 'Karim', etablissement: 'Le Fournil' }, { desinscription: 'https://www.lab-learning.fr/desinscription/exemple' }, signature(session),
  )
  return { success: true, data: { objet: m.objet, html: m.html } }
}

/**
 * Essai : l'e-mail à sa propre adresse, le SMS à son propre mobile (fiche
 * utilisateur). Mêmes règles qu'un envoi (oppositions, fenêtre des SMS),
 * 5 essais par heure et par personne, chacun noté au journal d'activité.
 */
const ESSAIS_PAR_HEURE = 5
export async function envoyerEssaiAction(id: string): Promise<ActionResult<{ a: string }>> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const c = await campagneDeLOrganisme(supabase, session, id)
  if (!c) return { success: false, error: 'Campagne introuvable' }
  const refus = refusCampagne(c)
  if (refus.length) return { success: false, error: refus.join(' · ') }
  const config = configCampagnes()
  const manques = manquesPourEnvoyer(c.canal, config)
  if (manques.length) return { success: false, error: `Envoi pas encore branché : il manque ${manques.join(', ')}` }
  const { count: essais } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id).eq('action', 'essai_campagne').gte('created_at', new Date(Date.now() - 3600000).toISOString())
  if ((essais || 0) >= ESSAIS_PAR_HEURE) return { success: false, error: `${ESSAIS_PAR_HEURE} essais par heure au plus : réessayez plus tard` }
  const destination = c.canal === 'email' ? String(session.user.email || '').toLowerCase() : numeroSmsFrance((session.user as any).phone)
  if (!destination) return { success: false, error: 'Ajoutez votre numéro de mobile à votre profil pour recevoir l’essai' }
  if (c.canal === 'sms' && !dansFenetreSms()) return { success: false, error: 'Les SMS partent du lundi au samedi, de 8 h à 21 h 30, hors jours fériés : essai à refaire dans ces horaires' }
  try {
    if ((await oppositionsParmi(supabase, session.organization.id, c.canal, [destination])).size) {
      return { success: false, error: 'Cette adresse ou ce numéro est désinscrit : aucun message n’y part, essai compris' }
    }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Essai impossible' }
  }
  await logAudit({ action: 'essai_campagne', entity_type: 'campagne', entity_id: c.id, details: { canal: c.canal } })
  const moi = { prenom: session.user.first_name || null, etablissement: session.organization.name || null }
  try {
    if (c.canal === 'email') {
      const jeton = jetonDesinscription({ orgId: session.organization.id, canal: 'email', valeur: session.user.email })
      const m = rendreEmailCampagne({ objet: c.objet || '', contenu: c.contenu, boutonLibelle: c.bouton_libelle, boutonUrl: c.bouton_url }, moi, { desinscription: lienDesinscription(jeton) }, signature(session))
      await envoyerEmailBrevo(config.cleApi!, {
        expediteur: { email: config.expediteurEmail!, nom: config.expediteurNom }, reponse: config.reponseEmail,
        destinataire: { email: session.user.email, nom: `${session.user.first_name || ''} ${session.user.last_name || ''}`.trim() || null },
        objet: `[Essai] ${m.objet}`, html: m.html, texte: m.texte, etiquettes: ['campagne-essai'],
      })
      return { success: true, data: { a: session.user.email } }
    }
    const texte = smsPour(c.contenu, moi, config.numeroStop)
    await envoyerSmsBrevo(config.cleApi!, { expediteur: config.expediteurSms, numero: destination, texte, unicode: compterSms(texte).unicode, etiquette: 'campagne-essai' })
    return { success: true, data: { a: `+${destination}` } }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Essai impossible' }
  }
}

/**
 * Envoi : tout de suite (l'audience est figée, les envois partent avec la
 * tâche des 5 minutes, dans la fenêtre des SMS), ou à une date.
 */
export async function programmerCampagneAction(id: string, quand: string | null): Promise<ActionResult<{ destinataires?: number }>> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const c = await campagneDeLOrganisme(supabase, session, id)
  if (!c) return { success: false, error: 'Campagne introuvable' }
  if (c.statut !== 'brouillon') return { success: false, error: 'Cette campagne n’est plus un brouillon' }
  const refus = refusCampagne(c)
  if (refus.length) return { success: false, error: refus.join(' · ') }
  if (!aUnPublic(nettoyerFiltres(c.audience))) return { success: false, error: 'Choisissez au moins un public dans l’audience' }
  const manques = manquesPourEnvoyer(c.canal)
  if (manques.length) return { success: false, error: `Envoi pas encore branché : il manque ${manques.join(', ')}` }

  if (quand) {
    const t = Date.parse(quand)
    if (!Number.isFinite(t) || t < Date.now() + 60000) return { success: false, error: 'Choisissez une date à venir' }
    if (t > Date.now() + 90 * 86400000) return { success: false, error: 'Programmez dans les 90 prochains jours' }
    const { error } = await supabase.from('campagnes').update({ statut: 'programmee', programmee_le: new Date(t).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('organization_id', session.organization.id).eq('statut', 'brouillon')
    if (error) return { success: false, error: 'Programmation impossible' }
    await logAudit({ action: 'programmer', entity_type: 'campagne', entity_id: id, details: { quand: new Date(t).toISOString(), canal: c.canal } })
    revalidatePath('/dashboard/campagnes')
    revalidatePath(`/dashboard/campagnes/${id}`)
    return { success: true, data: {} }
  }
  try {
    const r = await lancerCampagne(supabase, c, 'brouillon')
    await logAudit({ action: 'lancer', entity_type: 'campagne', entity_id: id, details: { destinataires: r.destinataires, canal: c.canal } })
    revalidatePath('/dashboard/campagnes')
    revalidatePath(`/dashboard/campagnes/${id}`)
    return { success: true, data: { destinataires: r.destinataires } }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Lancement impossible' }
  }
}

/**
 * Déprogrammer (retour au brouillon) ou arrêter une campagne en cours (ce qui
 * n'est pas parti ne partira pas). `attendu` : l'état que montrait l'écran. La
 * tâche planifiée a pu lancer ou finir la campagne entre-temps : rien n'est
 * fait alors, et la personne voit le nouvel état avant de décider.
 */
export async function arreterCampagneAction(id: string, attendu?: string): Promise<ActionResult<{ fait: 'deprogrammee' | 'arretee' }>> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const c = await campagneDeLOrganisme(supabase, session, id)
  if (!c) return { success: false, error: 'Campagne introuvable' }
  const PARTIE = 'La campagne vient de partir : la page se met à jour, « Arrêter l’envoi » reste possible'
  const FINIE = 'La campagne vient de se terminer : il n’y a plus rien à arrêter'
  if (attendu && c.statut !== attendu) {
    return { success: false, error: c.statut === 'en_cours' ? PARTIE : c.statut === 'envoyee' ? FINIE : 'La campagne a changé entre-temps : la page se met à jour' }
  }
  // Chaque changement est conditionnel, pour la même raison
  let fait: 'deprogrammee' | 'arretee'
  if (c.statut === 'programmee') {
    const { data } = await supabase.from('campagnes').update({ statut: 'brouillon', programmee_le: null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('statut', 'programmee').select('id')
    if (!data?.length) return { success: false, error: PARTIE }
    fait = 'deprogrammee'
  } else if (c.statut === 'en_cours') {
    const { data } = await supabase.from('campagnes').update({ statut: 'annulee', terminee_le: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('statut', 'en_cours').select('id')
    if (!data?.length) return { success: false, error: FINIE }
    // Datées : effacées avec les autres envois au bout de 3 ans
    await supabase.from('campagne_envois').update({ statut: 'exclu', erreur: 'Campagne arrêtée avant cet envoi', envoye_le: new Date().toISOString() }).eq('campagne_id', id).eq('statut', 'a_envoyer')
    fait = 'arretee'
  } else {
    return { success: false, error: 'Rien à arrêter' }
  }
  await logAudit({ action: 'arreter', entity_type: 'campagne', entity_id: id, details: { statut: c.statut } })
  revalidatePath('/dashboard/campagnes')
  revalidatePath(`/dashboard/campagnes/${id}`)
  return { success: true, data: { fait } }
}

/** Copie d'une campagne (contenu et audience), en brouillon. */
export async function dupliquerCampagneAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const c = await campagneDeLOrganisme(supabase, session, id)
  if (!c) return { success: false, error: 'Campagne introuvable' }
  const { data, error } = await supabase.from('campagnes').insert({
    organization_id: session.organization.id, nom: `${c.nom} (copie)`.slice(0, 120), canal: c.canal, objet: c.objet, contenu: c.contenu,
    bouton_libelle: c.bouton_libelle, bouton_url: c.bouton_url, audience: c.audience, created_by: session.user.id,
  }).select('id').single()
  if (error || !data) return { success: false, error: 'Copie impossible' }
  revalidatePath('/dashboard/campagnes')
  return { success: true, data: { id: data.id } }
}

/** Supprime un brouillon ou une campagne annulée (une campagne envoyée reste, pour l'historique). */
export async function supprimerCampagneAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!peut(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const c = await campagneDeLOrganisme(supabase, session, id)
  if (!c) return { success: false, error: 'Campagne introuvable' }
  if (c.statut !== 'brouillon' && c.statut !== 'annulee') return { success: false, error: 'Une campagne envoyée ou en cours reste dans l’historique' }
  const { error } = await supabase.from('campagnes').delete().eq('id', id).eq('organization_id', session.organization.id).in('statut', ['brouillon', 'annulee'])
  if (error) return { success: false, error: 'Suppression impossible' }
  await logAudit({ action: 'delete', entity_type: 'campagne', entity_id: id, details: { nom: c.nom } })
  revalidatePath('/dashboard/campagnes')
  return { success: true }
}
