'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  PREFIXE_CV, CV_TAILLE_MAX, CV_TYPES, DOMAINES_FORMATEUR, CERTIFICATIONS_FORMATEUR, STATUTS_FORMATEUR,
  listeLibre, type InscriptionFormateur,
} from '@/lib/inscription-formateur'
import { ageHorodatage } from '@/lib/inscription-formateur-garde'

type Resultat<T = undefined> = { success: boolean; error?: string; data?: T }

/** Organisation du lien général ; null si le jeton est inconnu ou la migration 160 absente. */
async function organisationDuLien(supabase: any, token: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(String(token || ''))) return null
  const { data, error } = await supabase.from('organizations')
    .select('*')
    .eq('inscription_formateur_token', token).maybeSingle()
  if (error || !data) return null
  return data as any
}

/**
 * Prépare le dépôt du CV : le navigateur l'envoie ensuite directement au
 * stockage par une URL signée, sans passer par le serveur (pas de limite de
 * taille de requête, pas de fichier en mémoire côté fonction).
 */
export async function preparerDepotCvAction(token: string, jetonPage: string, nomFichier: string, taille: number, type: string): Promise<Resultat<{ path: string; jeton: string }>> {
  // Seule une page servie par nous depuis moins d'un jour peut demander un dépôt
  if (ageHorodatage(token, jetonPage) === null) return { success: false, error: 'Page expirée : rechargez-la puis déposez à nouveau votre CV.' }
  const supabase = await createServiceRoleClient()
  const org = await organisationDuLien(supabase, token)
  if (!org) return { success: false, error: 'Lien d’inscription invalide ou expiré.' }
  if (!CV_TYPES.includes(type)) return { success: false, error: 'Le CV doit être un fichier PDF ou Word.' }
  if (!(taille > 0) || taille > CV_TAILLE_MAX) return { success: false, error: 'Le CV ne doit pas dépasser 8 Mo.' }
  const propre = String(nomFichier || 'cv').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${PREFIXE_CV}/${org.id}/${crypto.randomUUID()}/${propre}`
  const { data, error } = await supabase.storage.from('documents').createSignedUploadUrl(path)
  if (error || !data) return { success: false, error: 'Le dépôt du CV est indisponible. Réessayez dans un instant.' }
  return { success: true, data: { path, jeton: data.token } }
}

const nettoyer = (s: unknown, max = 500) => String(s ?? '').trim().slice(0, max)
const montant = (n: unknown): number | null => {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 && v <= 10000 ? Math.round(v * 100) / 100 : null
}
/** Le gabarit des mails n'échappe pas le HTML : toute valeur saisie publiquement passe par ici. */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const vide = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
/** Lettres, espaces, apostrophes, traits d'union, points : un nom, jamais une adresse web. */
const NOM_VALIDE = /^[\p{L}][\p{L}\p{M}' ’.-]{0,79}$/u
/** Forme comparable d'une valeur, pour ne pas relever d'écart sur la casse, les espaces ou le format. */
function comparable(cle: string, v: unknown): string {
  if (v === null || v === undefined) return ''
  if (['tarif_journalier', 'tarif_horaire', 'taux_tva'].includes(cle)) return String(Number(v))
  if (cle === 'telephone') { const d = String(v).replace(/\D/g, ''); return d.length === 11 && d.startsWith('33') ? `0${d.slice(2)}` : d }
  if (cle === 'siret' || cle === 'code_postal') return String(v).replace(/\D/g, '')
  if (cle === 'numero_da') return String(v).replace(/\W/g, '').toLowerCase()
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Enregistre l'inscription d'un formateur.
 * - Adresse inconnue : la fiche est créée, active, marquée « à vérifier ».
 * - Adresse déjà connue : la fiche est complétée (champs vides remplis,
 *   domaines et certifications ajoutés, CV remplacé s'il en dépose un) ; ce
 *   qui diffère d'une valeur déjà saisie n'est jamais écrasé mais relevé
 *   pour le gestionnaire, puisque n'importe qui peut taper une adresse.
 * Chaque envoi est conservé (valeurs nettoyées) dans formateur_inscriptions.
 */
export async function soumettreInscriptionFormateurAction(
  token: string,
  saisie: InscriptionFormateur,
  garde: { jeton: string; pot: string },
): Promise<Resultat<{ resultat: 'cree' | 'complete' }>> {
  const supabase = await createServiceRoleClient()
  const org = await organisationDuLien(supabase, token)
  if (!org) return { success: false, error: 'Lien d’inscription invalide ou expiré.' }

  // Anti-robots : champ piège rempli, page non servie par nous, ou envoyée moins de 5 secondes après son affichage
  if (garde?.pot) return { success: true, data: { resultat: 'cree' } }
  const age = ageHorodatage(token, garde?.jeton)
  if (age === null) return { success: false, error: 'Page expirée : rechargez-la. Vos informations devront être saisies à nouveau.' }
  if (age < 5000) return { success: false, error: 'Merci de vérifier vos informations avant d’envoyer.' }

  const email = nettoyer(saisie.email, 200).toLowerCase()
  const s = {
    civilite: ['M.', 'Mme'].includes(saisie.civilite) ? saisie.civilite : null,
    prenom: nettoyer(saisie.prenom, 100),
    nom: nettoyer(saisie.nom, 100),
    telephone: nettoyer(saisie.telephone, 30),
    adresse: nettoyer(saisie.adresse, 200) || null,
    code_postal: nettoyer(saisie.code_postal, 10) || null,
    ville: nettoyer(saisie.ville, 100) || null,
    type_contrat: STATUTS_FORMATEUR.some((x) => x.value === saisie.type_contrat) ? saisie.type_contrat : null,
    // Un salarié n'a ni SIRET, ni déclaration d'activité, ni TVA à déclarer
    siret: saisie.type_contrat === 'salarie' ? null : nettoyer(saisie.siret, 20).replace(/\s+/g, '') || null,
    numero_da: saisie.type_contrat === 'salarie' ? null : nettoyer(saisie.numero_da, 20).replace(/\s+/g, '') || null,
    taux_tva: saisie.type_contrat !== 'salarie' && (saisie.taux_tva === 0 || saisie.taux_tva === 20) ? saisie.taux_tva : null,
    domaines: [...new Set([...(saisie.domaines || []).filter((d) => (DOMAINES_FORMATEUR as readonly string[]).includes(d)), ...listeLibre(saisie.domaines_autres).map((x) => x.slice(0, 80))])].slice(0, 30),
    certifications: [...new Set([...(saisie.certifications || []).filter((c) => (CERTIFICATIONS_FORMATEUR as readonly string[]).includes(c)), ...listeLibre(saisie.certifications_autres).map((x) => x.slice(0, 80))])].slice(0, 30),
    diplomes: listeLibre(nettoyer(saisie.diplomes, 2000).replace(/\n/g, ';')).slice(0, 20).map((intitule) => ({ intitule })),
    experience: nettoyer(saisie.experience, 3000) || null,
    zone_intervention: nettoyer(saisie.zone_intervention, 300) || null,
    disponibilites: nettoyer(saisie.disponibilites, 1000) || null,
    tarif_journalier: montant(saisie.tarif_journalier),
    tarif_horaire: montant(saisie.tarif_horaire),
    bio: nettoyer(saisie.bio, 2000) || null,
  }

  // Contrôles
  if (!s.prenom || !s.nom) return { success: false, error: 'Indiquez votre prénom et votre nom.' }
  if (!NOM_VALIDE.test(s.prenom) || !NOM_VALIDE.test(s.nom)) return { success: false, error: 'Votre prénom et votre nom ne peuvent contenir que des lettres, des espaces, des apostrophes et des traits d’union.' }
  // « * » et « % » servent de jokers dans les recherches : refusés, ils ne figurent dans aucune adresse réelle
  if (!/^[^\s@*%]+@[^\s@*%]+\.[^\s@*%]{2,}$/.test(email)) return { success: false, error: 'Indiquez une adresse email valide.' }
  if (s.telephone.replace(/\D/g, '').length < 9) return { success: false, error: 'Indiquez un numéro de téléphone valide.' }
  if (!s.domaines.length) return { success: false, error: 'Choisissez au moins un domaine d’intervention.' }
  if (s.siret && !/^\d{14}$/.test(s.siret)) return { success: false, error: 'Le SIRET compte 14 chiffres.' }
  if (!saisie.consentement) return { success: false, error: 'Merci d’accepter l’enregistrement de vos informations.' }

  // Limites par heure : 5 envois par adresse, 10 par connexion, 40 pour tout l'organisme
  const h = headers()
  const ip = nettoyer((h.get('x-forwarded-for') || '').split(',')[0] || h.get('x-real-ip'), 60) || 'inconnue'
  const ilYAUneHeure = new Date(Date.now() - 3600000).toISOString()
  const compter = (q: any) => q.select('id', { count: 'exact', head: true }).eq('organization_id', org.id).gte('created_at', ilYAUneHeure)
  const [parAdresse, parConnexion, auTotal] = await Promise.all([
    compter(supabase.from('formateur_inscriptions')).eq('email', email),
    compter(supabase.from('formateur_inscriptions')).eq('payload->>_ip', ip),
    compter(supabase.from('formateur_inscriptions')),
  ])
  if ((parAdresse.count || 0) >= 5) return { success: false, error: 'Plusieurs envois ont déjà été faits avec cette adresse. Réessayez plus tard.' }
  if ((parConnexion.count || 0) >= 10 || (auTotal.count || 0) >= 40) return { success: false, error: 'Trop d’envois en peu de temps. Réessayez dans une heure.' }

  // CV : un fichier déposé par ce formulaire, pour cette organisation, présent, PDF ou Word, 8 Mo au plus
  let cvPath: string | null = null
  if (saisie.cv_path) {
    const p = String(saisie.cv_path)
    const forme = new RegExp(`^${PREFIXE_CV}/${org.id}/[0-9a-f-]{36}/([A-Za-z0-9._-]{1,80})$`).exec(p)
    if (!forme || forme[1].startsWith('.')) return { success: false, error: 'CV invalide : déposez-le à nouveau.' }
    const dossier = p.slice(0, p.lastIndexOf('/'))
    const { data: objets } = await supabase.storage.from('documents').list(dossier, { limit: 10 })
    const objet = (objets || []).find((o: any) => o.name === forme[1]) as any
    if (!objet) return { success: false, error: 'Le CV n’a pas été reçu : déposez-le à nouveau.' }
    const taille = Number(objet.metadata?.size) || 0
    const type = String(objet.metadata?.mimetype || '')
    if (taille > CV_TAILLE_MAX || !CV_TYPES.includes(type)) {
      await supabase.storage.from('documents').remove([p])
      return { success: false, error: 'Le CV doit être un fichier PDF ou Word de 8\u202fMo au plus.' }
    }
    cvPath = p
  }

  const maintenant = new Date().toISOString()
  const aujourdhui = maintenant.slice(0, 10)
  const traceCv = cvPath ? [{ date: aujourdhui, type: 'verification_competences', piece: 'CV et compétences déclarés par le formulaire d’inscription' }] : []

  // Fiche existante : même adresse exactement (la recherche insensible à la casse ne sert qu'à la retrouver)
  const { data: existants } = await supabase.from('formateurs').select('*')
    .eq('organization_id', org.id).ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .order('created_at', { ascending: true }).limit(5)
  const existant = ((existants || []) as any[]).find((x) => String(x.email || '').trim().toLowerCase() === email)

  const champs: Record<string, unknown> = {
    civilite: s.civilite, prenom: s.prenom, nom: s.nom, telephone: s.telephone,
    adresse: s.adresse, code_postal: s.code_postal, ville: s.ville,
    type_contrat: s.type_contrat, siret: s.siret, numero_da: s.numero_da, taux_tva: s.taux_tva,
    qualifications: s.experience, zone_intervention: s.zone_intervention, disponibilites: s.disponibilites,
    tarif_journalier: s.tarif_journalier, tarif_horaire: s.tarif_horaire, bio: s.bio,
  }

  let formateurId: string
  let resultat: 'cree' | 'complete'
  const differences: { champ: string; actuel: unknown; declare: unknown }[] = []

  if (!existant) {
    // Les champs laissés vides prennent la valeur par défaut de la table (taux_tva est NOT NULL)
    const renseignes = Object.fromEntries(Object.entries(champs).filter(([, v]) => !vide(v)))
    const { data: cree, error } = await supabase.from('formateurs').insert({
      organization_id: org.id,
      email,
      ...renseignes,
      domaines_expertise: s.domaines,
      certifications: s.certifications,
      diplomes: s.diplomes,
      cv_url: cvPath,
      historique_habilitations: traceCv,
      is_active: true,
      a_verifier: true,
      inscrit_via_formulaire_at: maintenant,
    }).select('id').single()
    if (error || !cree) {
      console.error('[inscription formateur] création', error)
      return { success: false, error: 'L’enregistrement a échoué. Réessayez dans un instant.' }
    }
    formateurId = cree.id
    resultat = 'cree'
  } else {
    // Compléter sans écraser : seuls les champs vides sont remplis
    const patch: Record<string, unknown> = { a_verifier: true, inscrit_via_formulaire_at: maintenant }
    for (const [cle, valeur] of Object.entries(champs)) {
      if (vide(valeur)) continue
      // taux_tva vaut 0 par défaut en base : 0 n'y est pas une réponse, on le traite comme vide
      const videExistant = cle === 'taux_tva' ? Number(existant[cle]) === 0 : vide(existant[cle])
      if (videExistant) patch[cle] = valeur
      else if (comparable(cle, existant[cle]) !== comparable(cle, valeur)) differences.push({ champ: cle, actuel: existant[cle], declare: valeur })
    }
    patch.domaines_expertise = [...new Set([...(existant.domaines_expertise || []), ...s.domaines])]
    patch.certifications = [...new Set([...(existant.certifications || []), ...s.certifications])]
    if (s.diplomes.length) {
      const connus = new Set(((existant.diplomes || []) as any[]).map((d) => String(d?.intitule || d).toLowerCase()))
      patch.diplomes = [...(existant.diplomes || []), ...s.diplomes.filter((d) => !connus.has(d.intitule.toLowerCase()))]
    }
    if (cvPath) {
      if (existant.cv_url && existant.cv_url !== cvPath) differences.push({ champ: 'cv_url', actuel: existant.cv_url, declare: cvPath })
      patch.cv_url = cvPath
      patch.historique_habilitations = [...(existant.historique_habilitations || []), ...traceCv]
    }
    const { error } = await supabase.from('formateurs').update(patch).eq('id', existant.id).eq('organization_id', org.id)
    if (error) {
      console.error('[inscription formateur] complément', error)
      return { success: false, error: 'L’enregistrement a échoué. Réessayez dans un instant.' }
    }
    formateurId = existant.id
    resultat = 'complete'
  }

  // Trace de l'envoi : les valeurs nettoyées, jamais l'objet brut reçu
  await supabase.from('formateur_inscriptions').insert({
    organization_id: org.id, formateur_id: formateurId, email,
    payload: { ...s, email, cv_path: cvPath, consentement: true, _ip: ip },
    cv_path: cvPath, resultat, differences,
    user_agent: nettoyer(h.get('user-agent'), 300) || null,
  })

  // Prévenir l'équipe (dans le CRM et par mail) et confirmer au formateur : au mieux
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
    const nomComplet = `${s.prenom} ${s.nom}`.trim()
    const { data: equipe } = await supabase.from('users').select('id, email')
      .eq('organization_id', org.id).eq('status', 'active').in('role', ['super_admin', 'gestionnaire'])
    const { createNotifications, sendDocumentEmail } = await import('@/lib/email')
    const titre = resultat === 'cree' ? 'Nouveau formateur inscrit' : 'Fiche formateur complétée'
    const suite = (nom: string, domaines: string) => resultat === 'cree'
      ? `${nom} s’est inscrit par le lien formateur (${domaines}).`
      : `${nom} a complété sa fiche par le lien formateur${differences.length ? ` : ${differences.length} information${differences.length > 1 ? 's' : ''} diffère${differences.length > 1 ? 'nt' : ''} de la fiche, à vérifier` : ''}.`
    const message = suite(nomComplet, s.domaines.slice(0, 3).join(', '))
    if ((equipe || []).length) {
      await createNotifications((equipe || []).map((u: any) => ({
        organizationId: org.id, userId: u.id, titre, message, type: 'info',
        lienUrl: `/dashboard/formateurs/${formateurId}`, lienLabel: 'Voir la fiche', entityType: 'formateur', entityId: formateurId,
      })))
      const destinataires = (equipe || []).map((u: any) => u.email).filter(Boolean)
      if (destinataires.length) {
        await sendDocumentEmail({
          to: destinataires,
          orgName: org.name || 'Lab Learning', orgEmail: org.email_contact || org.email, orgLogoUrl: org.logo_url,
          qualiopiCertified: org.is_qualiopi !== false,
          recipientName: 'l’équipe',
          subject: `${titre} : ${nomComplet}`,
          docTitle: titre,
          intro: suite(esc(nomComplet), esc(s.domaines.slice(0, 3).join(', '))),
          metadata: [
            ['Email', esc(email)], ['Téléphone', esc(s.telephone)],
            ['Domaines', esc(s.domaines.join(', '))],
            ...(s.zone_intervention ? [['Zone', esc(s.zone_intervention)] as [string, string]] : []),
            ...(s.tarif_journalier ? [['Tarif journalier', `${s.tarif_journalier.toLocaleString('fr-FR')} € HT`] as [string, string]] : []),
            ['CV', cvPath ? 'déposé' : 'non fourni'],
          ],
          ctaLabel: 'Voir la fiche', ctaUrl: `${appUrl}/dashboard/formateurs/${formateurId}`,
          organizationId: org.id, entityType: 'formateur', entityId: formateurId, templateSlug: 'formateur_inscription_equipe',
        })
      }
    }
    // Confirmation au formateur : texte fixe, seul le prénom (lettres uniquement) est repris
    await sendDocumentEmail({
      to: email,
      orgName: org.name || 'Lab Learning', orgEmail: org.email_contact || org.email, orgLogoUrl: org.logo_url,
      qualiopiCertified: org.is_qualiopi !== false,
      recipientName: esc(s.prenom),
      subject: 'Votre fiche formateur est enregistrée',
      docTitle: 'Merci, votre fiche est enregistrée',
      intro: `Vos informations sont bien arrivées chez ${esc(org.name || 'nous')}. Nous revenons vers vous dès qu’une mission correspond à votre profil.`,
      organizationId: org.id, entityType: 'formateur', entityId: formateurId, templateSlug: 'formateur_inscription_confirmation',
    })
  } catch (e) {
    console.error('[inscription formateur] notifications', e)
  }

  return { success: true, data: { resultat } }
}
