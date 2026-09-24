'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  PREFIXE_CV, CV_TAILLE_MAX, CV_TYPES, DOMAINES_FORMATEUR, CERTIFICATIONS_FORMATEUR, STATUTS_FORMATEUR,
  listeLibre, type InscriptionFormateur,
} from '@/lib/inscription-formateur'

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
export async function preparerDepotCvAction(token: string, nomFichier: string, taille: number, type: string): Promise<Resultat<{ path: string; jeton: string }>> {
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

/**
 * Enregistre l'inscription d'un formateur.
 * - Adresse inconnue : la fiche est créée, active, marquée « à vérifier ».
 * - Adresse déjà connue : la fiche est complétée (champs vides remplis,
 *   domaines et certifications ajoutés, CV remplacé s'il en dépose un) ; ce
 *   qui diffère d'une valeur déjà saisie n'est jamais écrasé mais relevé
 *   pour le gestionnaire, puisque n'importe qui peut taper une adresse.
 * Chaque envoi est conservé tel quel dans formateur_inscriptions.
 */
export async function soumettreInscriptionFormateurAction(
  token: string,
  saisie: InscriptionFormateur,
  garde: { t0: number; pot: string },
): Promise<Resultat<{ resultat: 'cree' | 'complete' }>> {
  const supabase = await createServiceRoleClient()
  const org = await organisationDuLien(supabase, token)
  if (!org) return { success: false, error: 'Lien d’inscription invalide ou expiré.' }

  // Anti-robots : champ piège rempli, ou formulaire envoyé en moins de 5 secondes
  if (garde?.pot) return { success: true, data: { resultat: 'cree' } }
  if (!garde?.t0 || Date.now() - Number(garde.t0) < 5000) return { success: false, error: 'Merci de vérifier vos informations avant d’envoyer.' }

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
    siret: nettoyer(saisie.siret, 20).replace(/\s+/g, '') || null,
    numero_da: nettoyer(saisie.numero_da, 20).replace(/\s+/g, '') || null,
    taux_tva: saisie.taux_tva === 0 || saisie.taux_tva === 20 ? saisie.taux_tva : null,
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { success: false, error: 'Indiquez une adresse email valide.' }
  if (s.telephone.replace(/\D/g, '').length < 9) return { success: false, error: 'Indiquez un numéro de téléphone valide.' }
  if (!s.domaines.length) return { success: false, error: 'Choisissez au moins un domaine d’intervention.' }
  if (s.siret && !/^\d{14}$/.test(s.siret)) return { success: false, error: 'Le SIRET compte 14 chiffres.' }
  if (!saisie.consentement) return { success: false, error: 'Merci d’accepter l’enregistrement de vos informations.' }

  // Pas plus de 5 envois par heure pour une même adresse
  const ilYAUneHeure = new Date(Date.now() - 3600000).toISOString()
  const { count: recents } = await supabase.from('formateur_inscriptions').select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id).eq('email', email).gte('created_at', ilYAUneHeure)
  if ((recents || 0) >= 5) return { success: false, error: 'Plusieurs envois ont déjà été faits avec cette adresse. Réessayez plus tard.' }

  // CV : uniquement un fichier déposé par ce formulaire, pour cette organisation, et présent
  let cvPath: string | null = null
  if (saisie.cv_path) {
    const p = String(saisie.cv_path)
    if (!p.startsWith(`${PREFIXE_CV}/${org.id}/`) || p.includes('..')) return { success: false, error: 'CV invalide : déposez-le à nouveau.' }
    const { error: eCv } = await supabase.storage.from('documents').createSignedUrl(p, 60)
    if (eCv) return { success: false, error: 'Le CV n’a pas été reçu : déposez-le à nouveau.' }
    cvPath = p
  }

  const maintenant = new Date().toISOString()
  const aujourdhui = maintenant.slice(0, 10)
  const traceCv = cvPath ? [{ date: aujourdhui, type: 'verification_competences', piece: 'CV et compétences déclarés par le formulaire d’inscription' }] : []

  // Fiche existante ?
  const { data: existants } = await supabase.from('formateurs').select('*')
    .eq('organization_id', org.id).ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(2)
  const existant = (existants || [])[0] as any

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
      if (vide(existant[cle])) patch[cle] = valeur
      else if (String(existant[cle]) !== String(valeur)) differences.push({ champ: cle, actuel: existant[cle], declare: valeur })
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

  // Trace de l'envoi, tel quel
  await supabase.from('formateur_inscriptions').insert({
    organization_id: org.id, formateur_id: formateurId, email,
    payload: { ...saisie, email, cv_path: cvPath },
    cv_path: cvPath, resultat, differences,
    user_agent: nettoyer(headers().get('user-agent'), 300) || null,
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
    await sendDocumentEmail({
      to: email,
      orgName: org.name || 'Lab Learning', orgEmail: org.email_contact || org.email, orgLogoUrl: org.logo_url,
      qualiopiCertified: org.is_qualiopi !== false,
      recipientName: esc(s.prenom) || 'Madame, Monsieur',
      subject: 'Votre fiche formateur est enregistrée',
      docTitle: 'Merci, votre fiche est enregistrée',
      intro: `Vos informations sont bien arrivées chez ${esc(org.name || 'nous')}. Nous revenons vers vous dès qu’une mission correspond à votre profil.`,
      metadata: [['Domaines', esc(s.domaines.join(', '))], ...(s.zone_intervention ? [['Zone', esc(s.zone_intervention)] as [string, string]] : [])],
      organizationId: org.id, entityType: 'formateur', entityId: formateurId, templateSlug: 'formateur_inscription_confirmation',
    })
  } catch (e) {
    console.error('[inscription formateur] notifications', e)
  }

  return { success: true, data: { resultat } }
}
