'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isPlaceholderEmail } from '@/lib/utils'
import { ageHorodatage } from '@/lib/inscription-formateur-garde'
import { rendreModele, signerTelechargement, VALIDITE_LIEN_JOURS } from '@/lib/modeles-acces'
import { CLE_GARDE_MODELES, EFFECTIFS, ORG_SITE_MODELES, modeleParSlug, nomModele, formatModele, type DemandeModele, type ResultatModele } from '@/lib/modeles'

const SITE = 'https://www.lab-learning.fr'
const GABARIT = 'modele_site'
const ETIQUETTE = 'modele-gratuit'

const nettoyer = (s: unknown, max = 200) => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
/** Le gabarit des mails n'échappe pas le HTML : toute valeur saisie publiquement passe par ici. */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
/** Lettres, espaces, apostrophes, traits d'union, points : un nom, jamais une adresse web. */
const NOM_VALIDE = /^[\p{L}][\p{L}\p{M}' ’.-]{0,79}$/u
const jokers = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * L'organisme du site public : Lab Learning. Hors production, CANDIDATURE_ORG_TEST
 * permet de dérouler le formulaire de bout en bout sur un organisme d'essai,
 * sans créer de contact ni alerter l'équipe chez Lab Learning.
 */
async function organisme(supabase: any) {
  const id = (process.env.NODE_ENV !== 'production' && process.env.CANDIDATURE_ORG_TEST) || process.env.PUBLIC_SITE_ORG || ORG_SITE_MODELES
  const { data } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle()
  return (data as any) || null
}

/**
 * Demande d'un modèle gratuit depuis le site.
 *
 * Le restaurateur laisse ses coordonnées et reçoit le PDF tout de suite (lien
 * signé) et par e-mail. Côté CRM :
 * - adresse d'un client ou d'un contact déjà connu : rien n'est créé, l'équipe
 *   commerciale est seulement prévenue ;
 * - adresse d'un lead existant : le lead reçoit l'étiquette du modèle et une
 *   ligne dans son commentaire, son statut ne bouge pas ;
 * - adresse inconnue : un lead « Site web » est créé au statut « Nouveau ».
 * Garde-fous : champ piège, page servie par nous depuis plus de 3 secondes,
 * limites par heure et par adresse.
 */
export async function demanderModeleAction(slug: string, saisie: DemandeModele, garde: { jeton: string; pot: string }): Promise<ResultatModele> {
  const modele = modeleParSlug(String(slug || ''))
  if (!modele) return { success: false, error: 'Ce modèle n’existe plus. Rechargez la page.' }

  // Anti-robots : champ piège rempli (on répond « envoyé » sans rien faire), page non servie par nous, ou envoi immédiat
  if (garde?.pot) return { success: true, data: { url: `/modeles/${modele.slug}`, fichier: modele.fichier, envoye: true } }
  const age = ageHorodatage(CLE_GARDE_MODELES, garde?.jeton)
  if (age === null) return { success: false, error: 'Page expirée : rechargez-la puis renvoyez le formulaire.' }
  if (age < 3000) return { success: false, error: 'Merci de vérifier vos informations avant d’envoyer.' }

  const s = {
    prenom: nettoyer(saisie?.prenom, 80),
    nom: nettoyer(saisie?.nom, 80),
    email: nettoyer(saisie?.email, 200).toLowerCase(),
    etablissement: nettoyer(saisie?.etablissement, 120),
    telephone: nettoyer(saisie?.telephone, 30),
    effectif: EFFECTIFS.includes(saisie?.effectif) ? saisie.effectif : '',
  }
  if (!s.prenom || !NOM_VALIDE.test(s.prenom)) return { success: false, error: 'Indiquez votre prénom (lettres uniquement).' }
  if (s.nom && !NOM_VALIDE.test(s.nom)) return { success: false, error: 'Votre nom ne peut contenir que des lettres, des espaces, des apostrophes et des traits d’union.' }
  // « * » et « % » servent de jokers dans les recherches : refusés, ils ne figurent dans aucune adresse réelle
  if (!/^[^\s@*%]+@[^\s@*%]+\.[^\s@*%]{2,}$/.test(s.email) || isPlaceholderEmail(s.email)) return { success: false, error: 'Indiquez une adresse e-mail valide : le modèle y est envoyé.' }
  if (s.etablissement.length < 2 || /https?:|www\./i.test(s.etablissement)) return { success: false, error: 'Indiquez le nom de votre établissement.' }
  if (s.telephone && s.telephone.replace(/\D/g, '').length < 9) return { success: false, error: 'Le numéro de téléphone semble incomplet. Corrigez-le ou laissez le champ vide.' }

  const supabase = await createServiceRoleClient()
  const org = await organisme(supabase)
  if (!org) return { success: false, error: 'L’envoi est indisponible pour le moment. Réessayez dans un instant.' }

  // Limites par heure, comptées sur le journal des mails : 5 envois par adresse, 60 pour tout le site
  const ilYAUneHeure = new Date(Date.now() - 3600000).toISOString()
  const compter = () => supabase.from('email_logs').select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id).eq('template', GABARIT).gte('created_at', ilYAUneHeure)
  const [parAdresse, auTotal] = await Promise.all([compter().eq('to_email', s.email), compter()])
  if ((parAdresse.count || 0) >= 5) return { success: false, error: 'Plusieurs modèles viennent déjà d’être envoyés à cette adresse. Réessayez dans une heure.' }
  if ((auTotal.count || 0) >= 60) return { success: false, error: 'Beaucoup de demandes en ce moment. Réessayez dans une heure.' }

  // Le PDF d'abord : si sa fabrication échoue, on ne crée rien dans le CRM
  const pdf = await rendreModele(modele.slug).catch((e) => { console.error('[modele site] pdf', e); return null })
  if (!pdf) return { success: false, error: 'Le modèle est indisponible pour le moment. Réessayez dans un instant.' }

  const maintenant = new Date()
  const jour = maintenant.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
  const ligne = `[${jour}] Modèle téléchargé sur le site : ${nomModele(modele)}.`
  const nomComplet = [s.prenom, s.nom].filter(Boolean).join(' ')

  // Déjà connu ? Un contact ou un client d'abord (on ne refait pas un prospect d'un client), puis un lead
  const motif = jokers(s.email)
  const [{ data: contacts }, { data: clients }, { data: leads }] = await Promise.all([
    supabase.from('contacts').select('id, client_id, email').eq('organization_id', org.id).ilike('email', motif).limit(5),
    supabase.from('clients').select('id, raison_sociale, email').eq('organization_id', org.id).ilike('email', motif).limit(5),
    supabase.from('leads').select('id, tags, commentaire, contact_email, contact_telephone, effectif_libelle, converted_client_id').eq('organization_id', org.id).ilike('contact_email', motif).order('created_at', { ascending: false }).limit(5),
  ])
  const meme = (v: unknown) => String(v || '').trim().toLowerCase() === s.email
  const contact = ((contacts || []) as any[]).find((c) => meme(c.email))
  const client = ((clients || []) as any[]).find((c) => meme(c.email))
  const lead = ((leads || []) as any[]).find((l) => meme(l.contact_email))
  const clientId: string | null = contact?.client_id || client?.id || lead?.converted_client_id || null

  let leadId: string | null = null
  let cas: 'client' | 'lead_connu' | 'nouveau' = 'nouveau'
  if (lead) {
    // Lead connu : on garde tout ce qui est saisi, on ajoute seulement la trace et ce qui manquait
    cas = clientId ? 'client' : 'lead_connu'
    leadId = lead.id
    const tags = [...new Set([...((lead.tags || []) as string[]), ETIQUETTE, modele.slug])]
    await supabase.from('leads').update({
      tags,
      commentaire: [lead.commentaire, ligne].filter(Boolean).join('\n').slice(0, 5000),
      ...(!lead.contact_telephone && s.telephone ? { contact_telephone: s.telephone } : {}),
      ...(!lead.effectif_libelle && s.effectif ? { effectif_libelle: s.effectif } : {}),
    }).eq('id', lead.id).eq('organization_id', org.id)
  } else if (clientId) {
    cas = 'client'
  } else {
    const { data: cree, error } = await supabase.from('leads').insert({
      organization_id: org.id,
      type: 'entreprise',
      entreprise: s.etablissement,
      // contact_nom est obligatoire : sans nom de famille, le prénom en tient lieu
      contact_nom: s.nom || s.prenom,
      contact_prenom: s.nom ? s.prenom : null,
      contact_email: s.email,
      contact_telephone: s.telephone || null,
      effectif_libelle: s.effectif || null,
      source: 'site_web',
      status: 'nouveau',
      opco_compte_status: 'aucun',
      tags: [ETIQUETTE, modele.slug],
      commentaire: ligne,
    }).select('id').single()
    if (error || !cree) {
      console.error('[modele site] lead', error)
      return { success: false, error: 'L’envoi a échoué. Réessayez dans un instant.' }
    }
    leadId = cree.id
  }

  const jeton = signerTelechargement(modele.slug, maintenant.getTime())
  const chemin = `/api/site/modeles/${modele.slug}?j=${jeton}`

  // Prévenir l'équipe commerciale dans le CRM et envoyer le modèle : au mieux, le téléchargement reste acquis
  let envoye = false
  try {
    const { createNotifications, sendDocumentEmail } = await import('@/lib/email')
    const { data: equipe } = await supabase.from('users').select('id')
      .eq('organization_id', org.id).eq('status', 'active').in('role', ['super_admin', 'directeur_commercial', 'commercial'])
    const sujet = nomModele(modele).toLowerCase()
    const titre = cas === 'client' ? 'Un client a téléchargé un modèle' : cas === 'lead_connu' ? 'Un lead a téléchargé un modèle' : 'Nouveau contact du site'
    const message = cas === 'nouveau'
      ? `${nomComplet} (${s.etablissement}) a demandé le modèle « ${sujet} ». Un lead « Site web » est créé : à rappeler.`
      : `${nomComplet} (${s.etablissement}) a demandé le modèle « ${sujet} ».`
    if ((equipe || []).length) {
      await createNotifications(((equipe || []) as any[]).map((u) => ({
        organizationId: org.id, userId: u.id, titre, message, type: 'info',
        ...(clientId && cas === 'client'
          ? { lienUrl: `/dashboard/clients/${clientId}`, lienLabel: 'Voir le client', entityType: 'client', entityId: clientId }
          : { lienUrl: `/dashboard/leads?lead=${leadId}`, lienLabel: 'Voir le lead', entityType: 'lead', entityId: leadId as string }),
      })))
    }
    const r = await sendDocumentEmail({
      to: s.email,
      orgName: 'Lab Learning', orgEmail: org.email_contact || org.email, orgLogoUrl: org.logo_url,
      qualiopiCertified: org.is_qualiopi !== false,
      recipientName: esc(s.prenom),
      subject: `Votre modèle : ${nomModele(modele)}`,
      docTitle: 'Votre modèle est prêt',
      intro: `Voici le modèle que vous avez demandé sur notre site, en pièce jointe. Il s’imprime en A4 paysage et se remplit à la main. ${esc(modele.usage[0])}`,
      metadata: [['Modèle', esc(modele.titre)], ['Format', esc(formatModele(modele))]],
      ctaLabel: 'Télécharger le modèle',
      ctaUrl: `${SITE}${chemin}`,
      footerNote: `Lien valable ${VALIDITE_LIEN_JOURS} jours. Une question sur l’hygiène, la sécurité ou le financement de la formation de votre équipe ? Répondez simplement à ce message.`,
      pdfBuffer: pdf,
      pdfFilename: modele.fichier,
      organizationId: org.id,
      entityType: clientId && cas === 'client' ? 'client' : 'lead',
      entityId: (clientId && cas === 'client' ? clientId : leadId) || undefined,
      templateSlug: GABARIT,
    })
    envoye = !!r.success
    if (!r.success) console.error('[modele site] mail', r.error)
  } catch (e) {
    console.error('[modele site] suites', e)
  }

  // Trace côté serveur de l'origine de la demande (jamais dans le CRM) : utile en cas d'abus
  const h = headers()
  console.log('[modele site]', modele.slug, cas, (h.get('x-forwarded-for') || '').split(',')[0] || 'ip inconnue')

  return { success: true, data: { url: chemin, fichier: modele.fichier, envoye } }
}
