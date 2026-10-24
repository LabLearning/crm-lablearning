import { isPlaceholderEmail } from '@/lib/utils'
import { attributionUtile } from './attribution'
import { equipeAPrevenir } from './equipe'
import {
  CANAL_LABELS, SOURCE_PAR_CANAL,
  type ProspectEntrant, type ResultatReception, type StatutReception,
} from './types'

/**
 * Réception d'un prospect, quel que soit son canal (site, Meta, Google Ads).
 *
 * 1. Journal (prospects_recus) : un prospect identifié par son canal n'est
 *    traité qu'une fois, même si le webhook et le relevé périodique l'apportent
 *    tous les deux. Une réception en erreur se rejoue à la livraison suivante.
 * 2. Prospect d'essai (outils de test Meta et Google) : journal seulement.
 * 3. Déjà connu ?
 *    - un client ou un contact (même e-mail), ou un lead déjà devenu client :
 *      c'est un client qui répond. La réponse reste au journal ; un lead
 *      retrouvé reçoit seulement la ligne datée (il n'est ni rouvert ni remis
 *      en tête), et l'alerte renvoie vers le client ;
 *    - un lead (même e-mail, sinon même téléphone) : il reçoit les étiquettes,
 *      une ligne datée dans son commentaire et sa date de dernière demande ; un
 *      lead perdu repasse « à traiter ». Ses réponses d'origine restent (les
 *      suivantes sont au journal). Un canal vérifié (Meta, Google) complète
 *      les champs vides ; ses autres coordonnées sont notées. Un formulaire du
 *      site, anonyme, ne remplit aucun champ : ce qu'il indique est noté dans
 *      la ligne datée, « à vérifier » ;
 *    - sinon : un lead est créé au statut « nouveau », daté de l'envoi du
 *      formulaire (un prospect rattrapé par le relevé garde sa vraie date).
 * 4. L'équipe commerciale est prévenue dans le CRM (lib/prospects/equipe) ;
 *    pas d'alerte pour un prospect envoyé il y a plus de 24 h (rattrapage).
 * Une erreur de lecture pendant le dédoublonnage fait échouer la réception
 * (rejouée ensuite) plutôt que de créer un lead en double.
 * Mêmes règles que les modèles gratuits et la demande de rappel du site.
 */

const MAX_COMMENTAIRE = 5000
/** Au-delà, une réception restée « en cours » est considérée comme interrompue */
const DELAI_REPRISE_MS = 2 * 60 * 1000
/** Prospect envoyé il y a plus longtemps : importé sans alerte (rattrapage du relevé) */
const AGE_SANS_ALERTE_MS = 24 * 3600 * 1000

export const EMAIL_VALIDE = /^[^\s@*%]+@[^\s@*%]+\.[^\s@*%]{2,}$/

const propre = (v: unknown, max = 200) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const jokers = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * Commentaire borné à MAX_COMMENTAIRE : on garde le début (la demande
 * d'origine) et la fin (les dernières lignes), le milieu est coupé.
 */
export function bornerCommentaire(texte: string): string {
  if (texte.length <= MAX_COMMENTAIRE) return texte
  const debut = 1500
  return `${texte.slice(0, debut)}\n[…]\n${texte.slice(-(MAX_COMMENTAIRE - debut - 5))}`
}

/** Les 9 derniers chiffres : « 06 12 34 56 78 » et « +33 6 12 34 56 78 » se rejoignent. */
export function cleTelephone(tel: string | null | undefined): string | null {
  const chiffres = String(tel || '').replace(/\D/g, '')
  return chiffres.length >= 9 ? chiffres.slice(-9) : null
}

/** « Karim Ben Ali » → prénom Karim, nom Ben Ali ; un seul mot → nom seul. */
function scinderNom(complet: string): { prenom: string | null; nom: string | null } {
  const mots = complet.split(' ').filter(Boolean)
  if (!mots.length) return { prenom: null, nom: null }
  if (mots.length === 1) return { prenom: null, nom: mots[0] }
  return { prenom: mots[0], nom: mots.slice(1).join(' ') }
}

function normaliser(p: ProspectEntrant) {
  const id = p.identite || {}
  let prenom = propre(id.prenom, 80) || null
  let nom = propre(id.nom, 80) || null
  if (!prenom && !nom && id.nomComplet) ({ prenom, nom } = scinderNom(propre(id.nomComplet, 160)))
  const emailBrut = propre(id.email, 200).toLowerCase()
  const email = EMAIL_VALIDE.test(emailBrut) && !isPlaceholderEmail(emailBrut) ? emailBrut : null
  const telBrut = propre(id.telephone, 30)
  return {
    prenom, nom, email,
    telephone: cleTelephone(telBrut) ? telBrut : null,
    entreprise: propre(id.entreprise, 160) || null,
    ville: propre(id.ville, 120) || null,
    codePostal: propre(id.codePostal, 10) || null,
    poste: propre(id.poste, 120) || null,
  }
}

type Normalise = ReturnType<typeof normaliser>

const nomAffiche = (n: Normalise) => [n.prenom, n.nom].filter(Boolean).join(' ') || n.email || n.telephone || 'Prospect'

/** Ouvre la réception au journal, ou dit qu'elle a déjà eu lieu. */
async function ouvrirJournal(
  supabase: any, orgId: string, p: ProspectEntrant, resume: string, donnees: Record<string, unknown>,
): Promise<{ id: string } | { dejaRecu: ResultatReception }> {
  const ligne = {
    organization_id: orgId,
    canal: p.canal,
    externe_id: p.externeId || null,
    soumis_le: p.soumisLe || null,
    statut: 'en_cours',
    traite_le: new Date().toISOString(),
    resume,
    donnees,
  }
  const { data, error } = await supabase.from('prospects_recus').insert(ligne).select('id').single()
  if (!error && data) return { id: data.id }
  if (error?.code !== '23505' || !p.externeId) throw new Error(`Journal des prospects : ${error?.message || 'écriture impossible'}`)

  // Déjà reçu : on ne reprend la main que sur une réception en erreur ou interrompue
  const { data: existant } = await supabase.from('prospects_recus')
    .select('id, statut, lead_id, client_id, recu_le, traite_le, tentatives')
    .eq('organization_id', orgId).eq('canal', p.canal).eq('externe_id', p.externeId)
    .maybeSingle()
  if (!existant) throw new Error('Journal des prospects : réception introuvable')
  // Interrompue : en cours depuis plus de 2 minutes après sa dernière prise en main
  const priseEnMain = new Date(existant.traite_le || existant.recu_le).getTime()
  const interrompue = existant.statut === 'en_cours' && Date.now() - priseEnMain > DELAI_REPRISE_MS
  if (existant.statut === 'erreur' || interrompue) {
    // Le nombre de tentatives sert de verrou : deux reprises simultanées ne passent pas toutes les deux,
    // et la prise en main datée empêche un troisième processus de la croire interrompue.
    // Une notification Meta notée avant sa lecture arrive avec 0 tentative.
    const tentatives = Number(existant.tentatives ?? 0)
    const { data: repris } = await supabase.from('prospects_recus')
      .update({ statut: 'en_cours', tentatives: tentatives + 1, traite_le: new Date().toISOString(), erreur: null, resume, donnees })
      .eq('id', existant.id).eq('tentatives', tentatives)
      .select('id')
    if (repris?.length) return { id: existant.id }
  }
  // Encore traitée ailleurs (moins de 2 minutes) : rien n'est acquis, le canal doit renvoyer plus tard
  const statut = existant.statut === 'en_cours' || existant.statut === 'erreur' ? 'en_cours' : 'deja_recu'
  return { dejaRecu: { statut, leadId: existant.lead_id || null, clientId: existant.client_id || null } }
}

async function fermerJournal(supabase: any, id: string, statut: StatutReception, champs: { leadId?: string | null; clientId?: string | null; erreur?: string | null }) {
  await supabase.from('prospects_recus').update({
    statut,
    lead_id: champs.leadId || null,
    client_id: champs.clientId || null,
    erreur: champs.erreur ? String(champs.erreur).slice(0, 1000) : null,
  }).eq('id', id)
}

export async function recevoirProspect(supabase: any, orgId: string, p: ProspectEntrant): Promise<ResultatReception> {
  const n = normaliser(p)
  const reponses = (p.reponses || [])
    .map((r) => ({ question: propre(r.question, 300), reponse: propre(r.reponse, 1000) }))
    .filter((r) => r.question && r.reponse)
    .slice(0, 40)
  const attribution = { canal: p.canal, ...(p.attribution || {}) }
  const etiquettes = Array.from(new Set((p.etiquettes || []).map((e) => propre(e, 60).toLowerCase()).filter(Boolean)))
  const resume = [nomAffiche(n), n.entreprise].filter(Boolean).join(' · ').slice(0, 200)
  const donnees = { identite: n, reponses, attribution, evenement: p.evenement, etiquettes, complements: p.complements || {}, ...(p.brut ? { brut: p.brut } : {}) }

  const ouverture = await ouvrirJournal(supabase, orgId, p, resume, donnees)
  if ('dejaRecu' in ouverture) return ouverture.dejaRecu
  const journalId = ouverture.id

  try {
    if (p.test) {
      await fermerJournal(supabase, journalId, 'test', {})
      await noterReception(supabase, orgId, p.canal)
      return { statut: 'test', leadId: null, clientId: null }
    }
    if (!n.email && !n.telephone) {
      await fermerJournal(supabase, journalId, 'erreur', { erreur: 'Ni e-mail ni téléphone exploitable' })
      return { statut: 'erreur', leadId: null, clientId: null, erreur: 'Ni e-mail ni téléphone exploitable' }
    }

    // Déjà connu ? Un contact ou un client d'abord (on ne refait pas un prospect d'un client), puis un lead.
    // Une lecture en erreur fait échouer la réception (rejouée ensuite) : la prendre pour « inconnu » ferait un doublon
    const lu = <T,>(r: { data: T | null; error: any }, quoi: string): T => {
      if (r.error) throw new Error(`Lecture des ${quoi} : ${r.error.message || 'impossible'}`)
      return (r.data || []) as T
    }
    const CHAMPS_LEAD = 'id, status, tags, commentaire, reponses, contact_email, contact_telephone, entreprise, ville, code_postal, effectif_libelle, formation_souhaitee, attribution, converted_client_id, derniere_demande_le'
    const motif = n.email ? jokers(n.email) : null
    const vide = Promise.resolve({ data: [], error: null })
    const [rContacts, rClients, rLeads] = await Promise.all([
      motif ? supabase.from('contacts').select('id, client_id, email').eq('organization_id', orgId).ilike('email', motif).limit(5) : vide,
      motif ? supabase.from('clients').select('id, email').eq('organization_id', orgId).ilike('email', motif).limit(5) : vide,
      motif
        ? supabase.from('leads').select(CHAMPS_LEAD).eq('organization_id', orgId).ilike('contact_email', motif).order('created_at', { ascending: false }).limit(5)
        : vide,
    ])
    const contacts = lu<any[]>(rContacts, 'contacts')
    const clients = lu<any[]>(rClients, 'clients')
    const leadsEmail = lu<any[]>(rLeads, 'leads')
    const memeEmail = (v: unknown) => !!n.email && String(v || '').trim().toLowerCase() === n.email
    let lead: any = leadsEmail.find((l) => memeEmail(l.contact_email)) || null
    if (!lead && n.telephone) {
      const cle = cleTelephone(n.telephone)
      for (let de = 0; !lead; de += 1000) {
        const lot = lu<any[]>(await supabase.from('leads').select(CHAMPS_LEAD)
          .eq('organization_id', orgId).not('contact_telephone', 'is', null)
          .order('created_at', { ascending: false }).range(de, de + 999), 'leads')
        lead = lot.find((l) => cleTelephone(l.contact_telephone) === cle) || null
        if (lot.length < 1000) break
      }
    }
    // Client connu par un contact ou par sa fiche (même e-mail), ou lead déjà devenu client : c'est un client qui répond
    const clientParEmail: string | null = contacts.find((c) => memeEmail(c.email))?.client_id || clients.find((c) => memeEmail(c.email))?.id || null
    const clientId: string | null = clientParEmail || lead?.converted_client_id || null

    // Date de la demande : l'envoi du formulaire chez le canal (un prospect rattrapé par le relevé garde sa vraie
    // date), jamais dans le futur
    const maintenantMs = Date.now()
    const soumisMs = p.soumisLe ? Date.parse(p.soumisLe) : NaN
    const demandeMs = Number.isFinite(soumisMs) ? Math.min(soumisMs, maintenantMs) : maintenantMs
    const demandeLe = new Date(demandeMs).toISOString()
    const jour = new Date(demandeMs).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
    let ligne = `[${jour}] ${propre(p.evenement, 400)}`
    let statut: StatutReception
    let leadId: string | null = null
    const verifie = p.canal !== 'site'

    if (lead) {
      leadId = lead.id
      statut = clientId ? 'client_connu' : 'lead_complete'
      // Coordonnées qui diffèrent de celles du lead : notées (à vérifier pour un formulaire du site, anonyme)
      const autres = [
        n.email && n.email !== String(lead.contact_email || '').toLowerCase() ? `e-mail ${n.email}` : null,
        n.telephone && cleTelephone(n.telephone) !== cleTelephone(lead.contact_telephone) ? `téléphone ${n.telephone}` : null,
      ].filter(Boolean)
      if (autres.length) ligne += verifie ? ` Autres coordonnées données : ${autres.join(', ')}.` : ` Coordonnées données (à vérifier) : ${autres.join(', ')}.`
      // Formulaire du site : ce qu'il indique est noté, aucun champ du lead n'est rempli
      if (!verifie) {
        const indique = [
          n.entreprise && n.entreprise !== lead.entreprise ? `établissement ${n.entreprise}` : null,
          n.ville && n.ville !== lead.ville ? `ville ${n.ville}` : null,
        ].filter(Boolean)
        if (indique.length) ligne += ` Indiqué : ${indique.join(', ')}.`
      }
      // Un client qui répond n'est ni rouvert ni remis en tête des demandes : l'alerte renvoie vers sa fiche
      const rouvrir = !clientId && lead.status === 'perdu'
      if (rouvrir) ligne += ' Lead rouvert : nouvelle demande.'
      const precedente = lead.derniere_demande_le ? Date.parse(lead.derniere_demande_le) : NaN
      const maj: Record<string, unknown> = {
        tags: Array.from(new Set([...((lead.tags || []) as string[]), ...etiquettes])),
        commentaire: bornerCommentaire([lead.commentaire, ligne].filter(Boolean).join('\n')),
        ...(rouvrir ? { status: 'nouveau' } : {}),
        // La date de dernière demande ne recule jamais (une réception rattrapée peut être plus ancienne)
        ...(!clientId && !(precedente >= demandeMs) ? { derniere_demande_le: demandeLe } : {}),
        // Une attribution vide ({ canal } seul) laisse la place à celle d'une publicité
        ...(!lead.attribution || (!attributionUtile(lead.attribution) && attributionUtile(attribution)) ? { attribution } : {}),
      }
      if (verifie) {
        // Canal vérifié (Meta, Google) : il complète les champs vides ; ses réponses d'origine restent
        // (celles des demandes suivantes sont au journal, dans l'historique de la fiche)
        Object.assign(maj, {
          ...(reponses.length && !(Array.isArray(lead.reponses) && lead.reponses.length) ? { reponses } : {}),
          ...(!lead.contact_email && n.email ? { contact_email: n.email } : {}),
          ...(!lead.contact_telephone && n.telephone ? { contact_telephone: n.telephone } : {}),
          ...(!lead.entreprise && n.entreprise ? { entreprise: n.entreprise } : {}),
          ...(!lead.ville && n.ville ? { ville: n.ville } : {}),
          ...(!lead.code_postal && n.codePostal ? { code_postal: n.codePostal } : {}),
          ...(!lead.effectif_libelle && p.complements?.effectif_libelle ? { effectif_libelle: propre(p.complements.effectif_libelle, 80) } : {}),
          ...(!lead.formation_souhaitee && p.complements?.formation_souhaitee ? { formation_souhaitee: propre(p.complements.formation_souhaitee, 300) } : {}),
        })
      }
      const { error } = await supabase.from('leads').update(maj).eq('id', lead.id).eq('organization_id', orgId)
      if (error) throw new Error(`Mise à jour du lead : ${error.message}`)
    } else if (clientId) {
      statut = 'client_connu'
    } else {
      statut = 'lead_cree'
      const { data: cree, error } = await supabase.from('leads').insert({
        organization_id: orgId,
        type: 'entreprise',
        entreprise: n.entreprise,
        // contact_nom est obligatoire : sans nom de famille, le prénom en tient lieu
        contact_nom: n.nom || n.prenom || n.email || n.telephone || 'Prospect',
        contact_prenom: n.nom ? n.prenom : null,
        contact_email: n.email,
        contact_telephone: n.telephone,
        contact_poste: n.poste,
        ville: n.ville,
        code_postal: n.codePostal,
        effectif_libelle: p.complements?.effectif_libelle ? propre(p.complements.effectif_libelle, 80) : null,
        formation_souhaitee: p.complements?.formation_souhaitee ? propre(p.complements.formation_souhaitee, 300) : null,
        source: SOURCE_PAR_CANAL[p.canal],
        status: 'nouveau',
        opco_compte_status: 'aucun',
        tags: etiquettes,
        commentaire: ligne,
        reponses: reponses.length ? reponses : null,
        attribution,
        // Daté de l'envoi du formulaire : la page Leads compte et trie sur la vraie date de la demande
        created_at: demandeLe,
        derniere_demande_le: demandeLe,
      }).select('id').single()
      if (error || !cree) throw new Error(`Création du lead : ${error?.message || 'refusée'}`)
      leadId = cree.id
    }

    // Coordonnées de l'alerte : un formulaire du site est anonyme. Pour un lead ou un client déjà connu, on montre
    // ses coordonnées connues ; celles qui diffèrent sont signalées « à vérifier », jamais données comme sûres
    let aJoindre = [n.telephone, n.email].filter(Boolean).join(' · ')
    if (!verifie && lead) {
      const connues = [lead.contact_telephone, lead.contact_email].filter(Boolean)
      const autres = [
        n.telephone && cleTelephone(n.telephone) !== cleTelephone(lead.contact_telephone) ? n.telephone : null,
        n.email && n.email !== String(lead.contact_email || '').toLowerCase() ? n.email : null,
      ].filter(Boolean)
      aJoindre = [connues.join(' · '), autres.length ? `coordonnées données, à vérifier : ${autres.join(' · ')}` : ''].filter(Boolean).join(' ; ')
    } else if (!verifie && statut === 'client_connu') {
      // Client reconnu par son e-mail : le téléphone saisi reste à vérifier
      aJoindre = [n.email, n.telephone ? `téléphone donné, à vérifier : ${n.telephone}` : ''].filter(Boolean).join(' ; ')
    }

    await fermerJournal(supabase, journalId, statut, { leadId, clientId })
    await noterReception(supabase, orgId, p.canal)
    // Un prospect envoyé il y a plus de 24 h vient d'un rattrapage : il entre dans la page Leads sans alerte
    if (maintenantMs - demandeMs <= AGE_SANS_ALERTE_MS) await alerterEquipe(supabase, orgId, p, n, statut, leadId, clientId, aJoindre)
    return { statut, leadId, clientId }
  } catch (e: any) {
    const erreur = String(e?.message || e).slice(0, 1000)
    console.error('[prospects] réception', p.canal, erreur)
    await fermerJournal(supabase, journalId, 'erreur', { erreur }).catch(() => {})
    return { statut: 'erreur', leadId: null, clientId: null, erreur }
  }
}

/** Dernière réception d'un canal publicitaire, pour la page des canaux. */
async function noterReception(supabase: any, orgId: string, canal: ProspectEntrant['canal']) {
  if (canal === 'site') return
  await supabase.from('canaux_prospects').update({ derniere_reception_at: new Date().toISOString() })
    .eq('organization_id', orgId).eq('canal', canal)
}

async function alerterEquipe(
  supabase: any, orgId: string, p: ProspectEntrant, n: Normalise,
  statut: StatutReception, leadId: string | null, clientId: string | null, joindre: string,
) {
  try {
    // Un client connu n'est montré qu'aux responsables et au commercial qui le suit (portefeuille)
    const equipe = await equipeAPrevenir(supabase, orgId, statut === 'client_connu' ? clientId : null)
    if (!equipe.length) return
    const canal = CANAL_LABELS[p.canal]
    const qui = `${nomAffiche(n)}${n.entreprise ? ` (${n.entreprise})` : ''}`
    const titre = statut === 'lead_cree' ? `Nouveau prospect : ${canal}`
      : statut === 'lead_complete' ? `Un lead a de nouveau répondu : ${canal}`
      : `Un client a répondu : ${canal}`
    const message = `${qui}. ${propre(p.evenement, 300)}${joindre ? ` À joindre : ${joindre}.` : ''}`
    const lien = statut === 'client_connu' && clientId
      ? { lienUrl: `/dashboard/clients/${clientId}`, lienLabel: 'Voir le client', entityType: 'client', entityId: clientId }
      : { lienUrl: `/dashboard/leads?lead=${leadId}`, lienLabel: 'Voir le lead', entityType: 'lead', entityId: leadId as string }
    const { createNotifications } = await import('@/lib/email')
    await createNotifications(equipe.map((userId) => ({
      organizationId: orgId, userId, titre, message: message.slice(0, 500), type: 'info', ...lien,
    })))
  } catch (e) {
    console.error('[prospects] alerte équipe', e)
  }
}
