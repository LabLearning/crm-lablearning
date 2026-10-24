import { calculerAudience, nettoyerFiltres } from './audience'
import { envoyerEmailBrevo, envoyerSmsBrevo, ErreurBrevo } from './brevo'
import { configCampagnes, manquesPourEnvoyer } from './config'
import { jetonDesinscription, lienDesabonnementUnClic, lienDesinscription } from './desinscription'
import { cleOpposition, oppositionsParmi } from './oppositions'
import { composerSms, compterSms, dansFenetreSms, MAX_PARTIES_SMS, personnaliser, type CanalCampagne } from './regles'
import { rendreEmailCampagne } from './rendu'

/**
 * Envoi des campagnes, en deux temps :
 * 1. lancement : l'audience est calculée et figée (une ligne par destinataire
 *    dans campagne_envois), la campagne passe « en cours » ;
 * 2. envoi par lots, par la tâche planifiée toutes les 5 minutes : chaque lot
 *    est réservé d'abord (statut « en_cours » posé sous condition), si bien
 *    que deux passages simultanés n'écrivent jamais deux fois à la même
 *    personne ; les oppositions sont relues juste avant l'envoi ; un SMS
 *    n'attend que la fenêtre (lundi-samedi, 8 h - 21 h 30, hors fériés).
 * Un envoi resté « en_cours » plus de 15 minutes (passage coupé) est classé en
 * échec, état inconnu : le renvoyer risquerait un doublon chez le destinataire.
 */
export const TAILLE_LOT = 120
const DELAI_ENVOI_PERDU_MS = 15 * 60 * 1000

export interface Campagne {
  id: string
  organization_id: string
  nom: string
  canal: CanalCampagne
  statut: string
  objet: string | null
  contenu: string
  bouton_libelle: string | null
  bouton_url: string | null
  audience: any
  programmee_le: string | null
}

/** Ce qui empêche d'envoyer cette campagne (phrases à afficher), ou rien. */
export function refusCampagne(c: Pick<Campagne, 'canal' | 'objet' | 'contenu' | 'bouton_libelle' | 'bouton_url'>): string[] {
  const refus: string[] = []
  if (!String(c.contenu || '').trim()) refus.push('Le message est vide')
  if (c.canal === 'email') {
    if (!String(c.objet || '').trim()) refus.push('L’objet de l’e-mail est vide')
    if ((c.bouton_libelle && !c.bouton_url) || (!c.bouton_libelle && c.bouton_url)) refus.push('Le bouton demande un libellé et une adresse')
    if (c.bouton_url && !/^https:\/\/\S+$/.test(c.bouton_url)) refus.push('L’adresse du bouton doit commencer par https://')
  } else {
    const n = compterSms(composerSms(c.contenu, configCampagnes().numeroStop))
    if (n.sms > MAX_PARTIES_SMS) refus.push(`Le SMS est trop long : ${n.sms} parties, ${MAX_PARTIES_SMS} au plus`)
  }
  return refus
}

/**
 * Lance la campagne depuis l'état attendu (« brouillon » pour « Envoyer
 * maintenant », « programmee » pour la tâche planifiée) :
 * 1. la campagne est réservée (en_cours, sans date de lancement) sous
 *    condition : un seul lancement, et jamais une campagne déprogrammée
 *    entre-temps ;
 * 2. les restes d'un lancement interrompu sont effacés, l'audience est
 *    calculée et figée ;
 * 3. la date de lancement est posée : la tâche n'envoie qu'une campagne
 *    lancée. Arrêtée pendant ce temps, elle ne part pas.
 * Sur toute erreur, les envois préparés sont effacés et la campagne redevient
 * un brouillon.
 */
export async function lancerCampagne(supabase: any, c: Campagne, depuis: 'brouillon' | 'programmee'): Promise<{ destinataires: number }> {
  const maintenant = () => new Date().toISOString()
  const { data: prise, error: ePrise } = await supabase.from('campagnes').update({ statut: 'en_cours', lancee_le: null, updated_at: maintenant() })
    .eq('id', c.id).eq('statut', depuis).select('id')
  if (ePrise) throw new Error(`Lancement impossible : ${ePrise.message}`)
  if (!prise?.length) throw new Error(depuis === 'programmee' ? 'Campagne déprogrammée ou déjà lancée' : 'Cette campagne est déjà lancée')
  const effacerPreparation = () => supabase.from('campagne_envois').delete().eq('campagne_id', c.id).eq('statut', 'a_envoyer')
  try {
    await effacerPreparation()
    const { destinataires } = await calculerAudience(supabase, c.organization_id, c.canal, nettoyerFiltres(c.audience))
    if (!destinataires.length) throw new Error('Aucun destinataire : élargissez l’audience')
    for (let i = 0; i < destinataires.length; i += 500) {
      const { error } = await supabase.from('campagne_envois').upsert(destinataires.slice(i, i + 500).map((d) => ({
        organization_id: c.organization_id,
        campagne_id: c.id,
        personne_type: d.personne_type,
        personne_id: d.personne_id,
        nom: d.nom,
        destination: d.destination,
        statut: 'a_envoyer',
      })), { onConflict: 'campagne_id,destination', ignoreDuplicates: true })
      if (error) throw new Error(`Destinataires non enregistrés : ${error.message}`)
    }
    const { data: lancee } = await supabase.from('campagnes').update({ lancee_le: maintenant(), nb_destinataires: destinataires.length, updated_at: maintenant() })
      .eq('id', c.id).eq('statut', 'en_cours').is('lancee_le', null).select('id')
    if (!lancee?.length) {
      await effacerPreparation()
      throw new Error('La campagne a été arrêtée pendant son lancement')
    }
    return { destinataires: destinataires.length }
  } catch (e) {
    await effacerPreparation()
    // Retour au brouillon, sauf si la campagne a été arrêtée entre-temps (elle reste annulée)
    await supabase.from('campagnes').update({ statut: 'brouillon', programmee_le: null, updated_at: maintenant() })
      .eq('id', c.id).eq('statut', 'en_cours').is('lancee_le', null)
    throw e
  }
}

/** Prénom et établissement des destinataires d'un lot, pour personnaliser le message. */
async function personnesDuLot(supabase: any, orgId: string, envois: any[]) {
  const ids = (type: string) => envois.filter((e) => e.personne_type === type && e.personne_id).map((e) => e.personne_id)
  const [leads, contacts] = await Promise.all([
    ids('lead').length ? supabase.from('leads').select('id, contact_prenom, entreprise').eq('organization_id', orgId).in('id', ids('lead')) : { data: [] },
    ids('contact').length ? supabase.from('contacts').select('id, prenom, client:client_id(raison_sociale, nom_commercial)').eq('organization_id', orgId).in('id', ids('contact')) : { data: [] },
  ])
  const personnes = new Map<string, { prenom: string | null; etablissement: string | null }>()
  for (const l of (leads.data || []) as any[]) personnes.set(l.id, { prenom: l.contact_prenom || null, etablissement: l.entreprise || null })
  for (const c of (contacts.data || []) as any[]) personnes.set(c.id, { prenom: c.prenom || null, etablissement: c.client?.nom_commercial || c.client?.raison_sociale || null })
  return personnes
}

/**
 * Envoie un lot d'une campagne en cours. Renvoie le nombre d'envois traités.
 * `finAvant` : heure (ms) au-delà de laquelle on s'arrête, pour finir avant la
 * limite de durée de la fonction ; les lignes pas encore tentées sont rendues.
 */
export async function envoyerLot(
  supabase: any, c: Campagne, org: { nom: string; email?: string | null; logoUrl?: string | null; qualiopi?: boolean }, finAvant = Date.now() + 240000,
): Promise<number> {
  const config = configCampagnes()
  if (manquesPourEnvoyer(c.canal, config).length) return 0
  if (c.canal === 'sms' && !dansFenetreSms()) return 0

  // Envois perdus (passage coupé pendant l'envoi) : classés en échec, sans renvoi
  await supabase.from('campagne_envois').update({ statut: 'echec', erreur: 'Envoi interrompu : état inconnu, non renvoyé' })
    .eq('campagne_id', c.id).eq('statut', 'en_cours').lt('envoye_le', new Date(Date.now() - DELAI_ENVOI_PERDU_MS).toISOString())

  // Réservation du lot : seules les lignes encore « à envoyer » passent « en cours », pour ce passage seulement
  const { data: candidats, error: eLecture } = await supabase.from('campagne_envois').select('id')
    .eq('campagne_id', c.id).eq('statut', 'a_envoyer').order('id').limit(TAILLE_LOT)
  if (eLecture) throw new Error(`Lecture des envois : ${eLecture.message}`)
  if (!candidats?.length) {
    await recompter(supabase, c.id)
    await terminerSiFini(supabase, c.id)
    return 0
  }
  const { data: lot, error: eReserve } = await supabase.from('campagne_envois')
    .update({ statut: 'en_cours', envoye_le: new Date().toISOString() })
    .in('id', candidats.map((x: any) => x.id)).eq('statut', 'a_envoyer')
    .select('id, personne_type, personne_id, nom, destination')
  // Une réservation refusée (base pas à jour, par exemple) remonte dans le bilan de la tâche au lieu de bloquer en silence
  if (eReserve) throw new Error(`Réservation du lot : ${eReserve.message}`)
  if (!lot?.length) return 0

  const lignes = lot as any[]
  // Lignes pas encore tentées : rendues aussitôt (restées « en cours », elles passeraient en échec dans 15 minutes)
  const rendre = (ids: string[], erreur?: string) => ids.length
    ? supabase.from('campagne_envois').update({ statut: 'a_envoyer', envoye_le: null, ...(erreur ? { erreur } : {}) }).in('id', ids).eq('statut', 'en_cours')
    : Promise.resolve()
  let oppositions: Set<string>
  let personnes: Map<string, { prenom: string | null; etablissement: string | null }>
  try {
    // Désinscriptions relues juste avant l'envoi, pour les destinataires du lot seulement
    oppositions = await oppositionsParmi(supabase, c.organization_id, c.canal, lignes.map((e) => e.destination))
    personnes = await personnesDuLot(supabase, c.organization_id, lignes)
  } catch (err) {
    await rendre(lignes.map((e) => e.id))
    throw err
  }
  let traites = 0
  for (let i = 0; i < lignes.length; i++) {
    const e = lignes[i]
    // Plus de temps : la suite attend le passage suivant
    if (Date.now() > finAvant) { await rendre(lignes.slice(i).map((x) => x.id)); break }
    // Arrêtée pendant l'envoi (bouton « Arrêter l'envoi ») : la suite du lot ne part pas
    if (i > 0 && i % 10 === 0) {
      const { data: etat } = await supabase.from('campagnes').select('statut').eq('id', c.id).maybeSingle()
      if (etat && etat.statut !== 'en_cours') {
        await supabase.from('campagne_envois').update({ statut: 'exclu', erreur: 'Campagne arrêtée avant cet envoi' })
          .in('id', lignes.slice(i).map((x) => x.id)).eq('statut', 'en_cours')
        break
      }
    }
    // Désinscrit depuis le lancement : rien ne part
    if (oppositions.has(cleOpposition(c.canal, e.destination) || '')) {
      await supabase.from('campagne_envois').update({ statut: 'exclu', erreur: 'Désinscrit avant l’envoi' }).eq('id', e.id)
      continue
    }
    const personne = personnes.get(e.personne_id) || { prenom: null, etablissement: null }
    let sms: string | null = null
    if (c.canal === 'sms') {
      // Longueur vérifiée sur le message de chacun (un nom d'établissement long peut ajouter une partie)
      sms = composerSms(personnaliser(c.contenu, personne), config.numeroStop)
      if (compterSms(sms).sms > MAX_PARTIES_SMS) {
        await supabase.from('campagne_envois').update({ statut: 'exclu', erreur: `Message trop long pour ce destinataire (plus de ${MAX_PARTIES_SMS} SMS)` }).eq('id', e.id)
        continue
      }
    }
    try {
      let messageId: string | null
      if (c.canal === 'email') {
        const jeton = jetonDesinscription({ orgId: c.organization_id, canal: 'email', valeur: e.destination, campagneId: c.id })
        const m = rendreEmailCampagne(
          { objet: c.objet || '', contenu: c.contenu, boutonLibelle: c.bouton_libelle, boutonUrl: c.bouton_url },
          personne, { desinscription: lienDesinscription(jeton) }, org,
        )
        messageId = await envoyerEmailBrevo(config.cleApi!, {
          expediteur: { email: config.expediteurEmail!, nom: config.expediteurNom },
          reponse: config.reponseEmail,
          destinataire: { email: e.destination, nom: e.nom },
          objet: m.objet,
          html: m.html,
          texte: m.texte,
          // Désabonnement en un clic depuis la messagerie (Gmail, Outlook…)
          enTetes: { 'List-Unsubscribe': `<${lienDesabonnementUnClic(jeton)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
          etiquettes: ['campagne', `campagne-${c.id}`],
        })
      } else {
        messageId = await envoyerSmsBrevo(config.cleApi!, {
          expediteur: config.expediteurSms, numero: e.destination, texte: sms!, unicode: compterSms(sms!).unicode, etiquette: `campagne-${c.id}`,
        })
      }
      await supabase.from('campagne_envois').update({ statut: 'envoye', message_id: messageId, envoye_le: new Date().toISOString(), erreur: null }).eq('id', e.id)
      traites++
    } catch (err: any) {
      const message = String(err?.message || err).slice(0, 500)
      const portee = err instanceof ErreurBrevo ? err.portee : 'compte'
      if (portee === 'destinataire') {
        // Adresse ou numéro refusé : échec pour ce destinataire, on continue
        await supabase.from('campagne_envois').update({ statut: 'echec', erreur: message }).eq('id', e.id)
        traites++
        continue
      }
      if (portee === 'inconnue') {
        // Peut-être parti : jamais renvoyé ; Brevo est lent, la suite attend le passage suivant
        await supabase.from('campagne_envois').update({ statut: 'echec', erreur: message }).eq('id', e.id)
        await rendre(lignes.slice(i + 1).map((x) => x.id))
        traites++
        break
      }
      // Compte, crédits, expéditeur, quota, panne : rien n'est dû au destinataire. Cette ligne et la suite attendent
      // le passage suivant ; l'erreur reste sur la ligne, la fiche de la campagne l'affiche
      await rendre(lignes.slice(i).map((x) => x.id), message)
      break
    }
  }
  await recompter(supabase, c.id)
  await terminerSiFini(supabase, c.id)
  return traites
}

/** Compteurs de la campagne, relus sur ses envois. */
export async function recompter(supabase: any, campagneId: string) {
  const compter = (statut: string) => supabase.from('campagne_envois').select('id', { count: 'exact', head: true }).eq('campagne_id', campagneId).eq('statut', statut)
  const [envoyes, echecs] = await Promise.all([compter('envoye'), compter('echec')])
  if (envoyes.error || echecs.error) return
  await supabase.from('campagnes').update({ nb_envoyes: envoyes.count || 0, nb_echecs: echecs.count || 0, updated_at: new Date().toISOString() }).eq('id', campagneId)
}

/** Plus rien à envoyer ni en cours : la campagne est envoyée. Un comptage en erreur ne clôt jamais. */
async function terminerSiFini(supabase: any, campagneId: string) {
  const { count, error } = await supabase.from('campagne_envois').select('id', { count: 'exact', head: true })
    .eq('campagne_id', campagneId).in('statut', ['a_envoyer', 'en_cours'])
  if (error || count === null || count === undefined) return
  if (count === 0) {
    await supabase.from('campagnes').update({ statut: 'envoyee', terminee_le: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', campagneId).eq('statut', 'en_cours')
  }
}

/**
 * Passage de la tâche planifiée : lance les campagnes programmées dont l'heure
 * est venue, puis envoie un lot de chaque campagne en cours.
 */
export async function traiterCampagnes(supabase: any): Promise<{ lancees: number; envois: number; erreurs: string[] }> {
  const bilan = { lancees: 0, envois: 0, erreurs: [] as string[] }
  const finAvant = Date.now() + 240000
  // Lancement coupé en route (réservée, jamais datée) depuis plus de 10 minutes : retour au brouillon, préparation effacée
  const { data: coupees } = await supabase.from('campagnes').select('id, nom')
    .eq('statut', 'en_cours').is('lancee_le', null).lt('updated_at', new Date(Date.now() - 10 * 60000).toISOString()).limit(20)
  for (const c of (coupees || []) as any[]) {
    await supabase.from('campagne_envois').delete().eq('campagne_id', c.id).eq('statut', 'a_envoyer')
    await supabase.from('campagnes').update({ statut: 'brouillon', programmee_le: null, updated_at: new Date().toISOString() })
      .eq('id', c.id).eq('statut', 'en_cours').is('lancee_le', null)
    bilan.erreurs.push(`${c.nom} : lancement interrompu, revenue en brouillon`)
  }
  const { data: programmees } = await supabase.from('campagnes').select('*')
    .eq('statut', 'programmee').lte('programmee_le', new Date().toISOString()).limit(20)
  for (const c of (programmees || []) as (Campagne & { created_by?: string | null })[]) {
    // En cas d'échec (plus d'audience…), lancerCampagne a remis la campagne en brouillon : son auteur est prévenu
    try { await lancerCampagne(supabase, c, 'programmee'); bilan.lancees++ } catch (e: any) {
      bilan.erreurs.push(`${c.nom} : ${e?.message || e}`)
      if (c.created_by) {
        try {
          const { createNotification } = await import('@/lib/email')
          await createNotification({
            organizationId: c.organization_id, userId: c.created_by, type: 'info',
            titre: 'Campagne non partie',
            message: `La campagne « ${c.nom} » programmée n'est pas partie : ${String(e?.message || e).slice(0, 200)}. Elle est revenue en brouillon.`,
            lienUrl: `/dashboard/campagnes/${c.id}`, lienLabel: 'Voir la campagne', entityType: 'campagne', entityId: c.id,
          })
        } catch { /* l'erreur reste au bilan de la tâche */ }
      }
    }
  }
  // Seulement les campagnes lancées (datées) : une campagne en cours de préparation n'a pas encore tous ses envois
  const { data: enCours } = await supabase.from('campagnes').select('*').eq('statut', 'en_cours').not('lancee_le', 'is', null).limit(20)
  const orgs = new Map<string, any>()
  for (const c of (enCours || []) as Campagne[]) {
    // Budget de temps de la fonction (300 s) : la campagne suivante attend le passage suivant
    if (Date.now() > finAvant) break
    if (!orgs.has(c.organization_id)) {
      const { data: o } = await supabase.from('organizations').select('name, email, email_contact, logo_url, is_qualiopi').eq('id', c.organization_id).maybeSingle()
      orgs.set(c.organization_id, { nom: o?.name || 'Lab Learning', email: o?.email_contact || o?.email || null, logoUrl: o?.logo_url || null, qualiopi: o?.is_qualiopi !== false })
    }
    try { bilan.envois += await envoyerLot(supabase, c, orgs.get(c.organization_id), finAvant) } catch (e: any) { bilan.erreurs.push(`${c.nom} : ${e?.message || e}`) }
  }
  // Envois de plus de 3 ans (durée de conservation des prospects) : effacés ; les compteurs des campagnes restent
  await supabase.from('campagne_envois').delete().lt('envoye_le', new Date(Date.now() - 3 * 365 * 86400000).toISOString())
  return bilan
}
