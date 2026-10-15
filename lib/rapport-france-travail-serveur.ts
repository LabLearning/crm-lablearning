import type { DossierRapport, IncidentRapport, PersonneRapport } from '@/lib/pdf/rapport-france-travail-pdf'

/**
 * Lecture des données d'un rapport pour France Travail (incident ou abandon),
 * commune aux deux routes PDF. Tout est filtré par organisation : un
 * identifiant deviné ne donne accès à rien.
 *
 * Une lecture en échec lève une erreur au lieu de laisser une rubrique vide :
 * le gabarit n'imprime pas ce qui manque, et rien ne distinguerait alors une
 * panne d'une donnée non saisie sur un document parti chez un tiers.
 */

export class LectureRapportImpossible extends Error {}

function verifier<T>(r: { data: T; error: any }, quoi: string): T {
  if (r.error) {
    console.error(`[rapport France Travail] lecture ${quoi}`, r.error)
    throw new LectureRapportImpossible(quoi)
  }
  return r.data
}

/** Rôles des portails : un incident saisi par l'un d'eux n'est pas signé « L'équipe de ». */
const ROLES_PORTAIL = ['formateur', 'apprenant', 'apporteur_affaires', 'franchise']

export interface BaseRapport {
  poei: any
  dossier: DossierRapport
  /** Agence France Travail du dossier, ou null : le rapport sort alors sans destinataire nommé */
  agence: any | null
}

export async function chargerDossierRapport(supabase: any, orgId: string, poeiId: string): Promise<BaseRapport | null> {
  const poei = verifier(await supabase.from('poei').select('*').eq('id', poeiId).eq('organization_id', orgId).maybeSingle(), 'du dossier') as any
  if (!poei) return null

  const [rClient, rFormation, rAgence] = await Promise.all([
    poei.client_id
      ? supabase.from('clients').select('raison_sociale, adresse, code_postal, ville, siret').eq('id', poei.client_id).eq('organization_id', orgId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    poei.formation_id
      ? supabase.from('formations').select('intitule').eq('id', poei.formation_id).eq('organization_id', orgId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    poei.agence_ft_id
      ? supabase.from('agences_france_travail').select('nom, adresse, code_postal, ville').eq('id', poei.agence_ft_id).eq('organization_id', orgId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const client = verifier(rClient, 'de l’employeur') as any
  const formation = verifier(rFormation, 'de la formation') as any
  const agence = verifier(rAgence, 'de l’agence France Travail') as any

  return {
    poei,
    agence: agence || null,
    dossier: {
      numero: poei.numero || null,
      numeroDossierFt: poei.numero_dossier_ft || null,
      formation: formation?.intitule || null,
      dateDebut: poei.date_debut || null,
      dateFin: poei.date_fin || null,
      dureeHeures: Number(poei.duree_heures) > 0 ? Number(poei.duree_heures) : null,
      employeur: client
        ? { nom: client.raison_sociale || null, adresse: client.adresse || null, code_postal: client.code_postal || null, ville: client.ville || null, siret: client.siret || null }
        : null,
    },
  }
}

/**
 * Le stagiaire d'un dossier : son identité et ses références France Travail.
 * `candidatConnu` est la ligne du dossier quand l'appelant l'a déjà lue (le
 * rapport d'abandon part d'elle) : un stagiaire sorti puis réinscrit a deux
 * lignes, et ses références doivent venir de celle dont on parle.
 */
export async function chargerPersonneRapport(
  supabase: any, orgId: string, poeiId: string, apprenantId: string, candidatConnu?: any,
): Promise<{ personne: PersonneRapport; candidat: any | null } | null> {
  const [rApprenant, rLignes] = await Promise.all([
    supabase.from('apprenants').select('civilite, prenom, nom').eq('id', apprenantId).eq('organization_id', orgId).maybeSingle(),
    candidatConnu
      ? Promise.resolve({ data: [candidatConnu], error: null })
      : supabase.from('poei_candidats').select('*').eq('poei_id', poeiId).eq('apprenant_id', apprenantId).eq('organization_id', orgId)
        .order('created_at', { ascending: false }).limit(1),
  ])
  const apprenant = verifier(rApprenant, 'du stagiaire') as any
  const lignes = verifier(rLignes, 'du candidat') as any[] | null
  if (!apprenant) return null
  const candidat = (lignes || [])[0] || null
  return {
    candidat: candidat || null,
    personne: {
      civilite: apprenant.civilite || null,
      prenom: apprenant.prenom || null,
      nom: apprenant.nom || null,
      identifiantFt: candidat?.identifiant_ft || null,
      numeroEngagement: candidat?.numero_engagement || null,
      numeroConvention: candidat?.numero_convention || null,
      posteVise: candidat?.poste_vise || null,
    },
  }
}

/**
 * Met des incidents en forme pour le rapport, avec qui les a signalés : le
 * formateur qui a constaté les faits est nommé ; un incident saisi au bureau
 * est signé de l'équipe, sans le nom du salarié qui l'a tapé (le rapport est
 * déjà émis et signé au nom de l'organisme). Un auteur qui n'est pas du bureau
 * (formateur dont la fiche a été supprimée depuis) ne signe pas pour l'équipe :
 * la ligne dit alors seulement quand l'incident a été consigné.
 */
export async function incidentsEnRapport(supabase: any, orgId: string, incidents: any[], nomOrganisme: string): Promise<IncidentRapport[]> {
  if (!incidents.length) return []
  const formateurIds = [...new Set(incidents.map((i) => i.formateur_id).filter(Boolean))]
  const auteurIds = [...new Set(incidents.filter((i) => !i.formateur_id).map((i) => i.auteur_id).filter(Boolean))]
  const [rFormateurs, rAuteurs] = await Promise.all([
    formateurIds.length
      ? supabase.from('formateurs').select('id, civilite, prenom, nom').eq('organization_id', orgId).in('id', formateurIds)
      : Promise.resolve({ data: [], error: null }),
    auteurIds.length
      ? supabase.from('users').select('id, role').eq('organization_id', orgId).in('id', auteurIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const formateurs = verifier(rFormateurs, 'des formateurs') as any[] | null
  const auteurs = verifier(rAuteurs, 'des auteurs') as any[] | null
  const nom = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' ').trim()
  const texte = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || null

  return incidents.map((i) => {
    const formateur = (formateurs || []).find((f: any) => f.id === i.formateur_id)
    const auteur = (auteurs || []).find((u: any) => u.id === i.auteur_id)
    const fonction = /^(mme|madame)\.?$/i.test(String(formateur?.civilite || '').trim()) ? 'formatrice' : 'formateur'
    const declarant = formateur && nom(formateur.prenom, formateur.nom)
      ? `${nom(formateur.prenom, formateur.nom)}, ${fonction}`
      : auteur && !ROLES_PORTAIL.includes(auteur.role)
        ? `L’équipe de ${nomOrganisme}`
        : null
    return {
      date: i.date_incident || null,
      type: i.type || null,
      gravite: i.gravite || null,
      titre: i.titre || null,
      description: texte(i.description),
      mesures: texte(i.mesures_prises),
      statut: i.statut || null,
      resoluLe: i.resolu_at || null,
      declareLe: i.created_at || null,
      declarant,
    }
  })
}

/** Nom de fichier sans accents ni caractères spéciaux. */
export function nomFichierRapport(...morceaux: Array<string | null | undefined>): string {
  const diacritiques = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g')
  return morceaux
    .filter(Boolean)
    .map((m) => String(m).normalize('NFD').replace(diacritiques, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('-')
}
