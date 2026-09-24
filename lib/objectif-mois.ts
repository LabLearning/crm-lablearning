/**
 * Objectif du mois : combien d'établissements sont déjà calés en formation
 * pour le mois suivant, face à l'objectif fixé par la direction.
 *
 * « Établissement calé » = client distinct ayant au moins une session non
 * annulée qui DÉMARRE dans le mois visé. Une session INTER (sans client)
 * compte les établissements de ses stagiaires inscrits. Les POEI comptent,
 * dédoublonnées par établissement : une session d'intervention ne compte pas
 * en plus de son parcours (la session chapeau le représente dans son propre
 * mois, ou sa première intervention s'il n'a pas de chapeau, comme dans les
 * écrans de sessions). Les sessions « BPF-… » (reprises comptables) sont
 * ignorées.
 *
 * Ce module ne dépend que du client Supabase passé en paramètre : il est
 * appelé par le tableau de bord (rendu serveur).
 */

import { cartePoeiSessions } from '@/lib/poei-sessions'

export const OBJECTIF_PAR_DEFAUT = 25

/** Rôles qui fixent l'objectif. Déclaré ici et pas dans objectif-actions.ts :
    un fichier 'use server' n'exporte que des fonctions async. */
export const ROLES_OBJECTIF: string[] = ['super_admin', 'gestionnaire', 'directeur_commercial']

export interface EtablissementCale {
  id: string
  nom: string
  ville: string | null
  /** Premier jour de formation dans le mois. */
  premiereSession: string
  /** Au moins une de ses sessions du mois est une POEI. */
  poei: boolean
  /** Date à laquelle sa première session du mois a été créée (calage). */
  caleLe: string
  /** Calé depuis lundi 00:00, heure de Paris (calculé côté serveur, même borne que nouveauxCetteSemaine). */
  recent: boolean
}

export interface ObjectifMois {
  /** « 2026-10 » */
  cle: string
  /** « 2026-10-01 » */
  debut: string
  /** « 2026-10-31 » */
  fin: string
  /** « Octobre » */
  nomMois: string
  /** « octobre 2026 » */
  libelle: string
  annee: number
  /** Jours entre aujourd'hui (Paris) et le premier jour du mois visé. */
  joursAvantDebut: number
  objectif: number
  /** L'objectif vient-il d'une saisie (sinon valeur par défaut) ? */
  objectifSaisi: boolean
  /** La table des objectifs n'existe pas encore (migration 158 à appliquer). */
  tableAbsente: boolean
  etablissements: EtablissementCale[]
  /** Nombre de sessions qui démarrent dans le mois. */
  nbSessions: number
  /** Stagiaires distincts inscrits (actifs) sur ces sessions. */
  nbStagiaires: number
  /** Établissements dont la première session du mois a été créée depuis lundi 00:00, heure de Paris. */
  nouveauxCetteSemaine: number
  /** Établissements venus d'une POEI. */
  nbPoei: number
  /** Pourcentage de l'objectif atteint (peut dépasser 100). */
  pourcentage: number
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Date du jour à Paris, « AAAA-MM-JJ ». */
export function aujourdhuiParis(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ref)
}

/** Bornes du mois suivant la date de référence (heure de Paris). */
export function moisSuivant(ref: Date = new Date()) {
  const [a, m] = aujourdhuiParis(ref).split('-').map(Number)
  const annee = m === 12 ? a + 1 : a
  const mois = m === 12 ? 1 : m + 1
  const mm = String(mois).padStart(2, '0')
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate()
  const nom = MOIS[mois - 1]
  return {
    cle: `${annee}-${mm}`,
    debut: `${annee}-${mm}-01`,
    fin: `${annee}-${mm}-${String(dernier).padStart(2, '0')}`,
    nomMois: nom.charAt(0).toUpperCase() + nom.slice(1),
    libelle: `${nom} ${annee}`,
    annee,
  }
}

const joursEntre = (de: string, a: string) =>
  Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86400000)

/** Charge l'objectif du mois suivant et les établissements déjà calés. */
export async function chargerObjectifMois(supabase: any, organizationId: string, ref: Date = new Date()): Promise<ObjectifMois> {
  const m = moisSuivant(ref)
  const auj = aujourdhuiParis(ref)
  // Début de la semaine civile à Paris (lundi 00:00), en UTC : même découpage que l'agenda
  const lundi = (() => { const d = new Date(`${auj}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) })()
  const decalage = (new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${lundi}T00:00:00Z`)).find((p) => p.type === 'timeZoneName')?.value || 'GMT').replace('GMT', '') || '+00:00'
  const debutSemaine = new Date(`${lundi}T00:00:00${decalage}`).toISOString()

  const [objRes, sessRes, carte] = await Promise.all([
    supabase.from('objectifs_formation').select('etablissements')
      .eq('organization_id', organizationId).eq('mois', m.debut).maybeSingle(),
    supabase.from('sessions')
      .select('id, reference, client_id, date_debut, created_at, poei_intervention_id, formation:formation_id(is_poei), client:client_id(id, raison_sociale, nom_commercial, ville)')
      .eq('organization_id', organizationId)
      .gte('date_debut', m.debut).lte('date_debut', m.fin)
      .neq('status', 'annulee'),
    cartePoeiSessions(supabase, organizationId),
  ])
  // supabase-js ne lève pas : une requête en échec doit masquer le bloc (catch de la page), pas afficher un faux zéro
  if (sessRes.error) throw sessRes.error

  // Table absente tant que la migration 158 n'est pas appliquée : objectif par défaut
  const tableAbsente = !!objRes.error && /objectifs_formation|42P01|PGRST205/i.test(`${objRes.error.code} ${objRes.error.message}`)
  const objectifSaisi = !objRes.error && !!objRes.data?.etablissements
  const objectif = objectifSaisi ? Number(objRes.data.etablissements) : OBJECTIF_PAR_DEFAUT

  // Une session d'intervention POEI ne s'ajoute pas à son parcours (règle de lib/poei-sessions.ts)
  const sessions = ((sessRes.data || []) as any[])
    .filter((s) => !String(s.reference || '').startsWith('BPF-') && !carte.doublons.has(s.id))
  const estPoei = (s: any) => carte.poeiParSession.has(s.id) || !!s.poei_intervention_id || !!s.formation?.is_poei

  // Inscriptions actives des sessions du mois : stagiaires, et établissements des sessions INTER
  const ids = sessions.map((s) => s.id)
  const inscriptions: any[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('inscriptions')
      .select('session_id, apprenant_id, status, apprenant:apprenants(client_id, client:client_id(id, raison_sociale, nom_commercial, ville))')
      .in('session_id', ids.slice(i, i + 100))
      .not('status', 'in', '("annule","abandonne")')
    if (error) throw error
    inscriptions.push(...((data || []) as any[]))
  }

  const parEtab = new Map<string, EtablissementCale>()
  const ajouter = (client: any, s: any) => {
    if (!client?.id) return
    const nom = client.nom_commercial || client.raison_sociale || 'Établissement'
    const e = parEtab.get(client.id)
    if (!e) {
      parEtab.set(client.id, { id: client.id, nom, ville: client.ville || null, premiereSession: s.date_debut, poei: estPoei(s), caleLe: s.created_at, recent: false })
      return
    }
    if (s.date_debut < e.premiereSession) e.premiereSession = s.date_debut
    if (s.created_at < e.caleLe) e.caleLe = s.created_at
    if (estPoei(s)) e.poei = true
  }
  for (const s of sessions) {
    if (s.client_id) { ajouter(s.client, s); continue }
    for (const ins of inscriptions.filter((x) => x.session_id === s.id)) ajouter(ins.apprenant?.client, s)
  }

  const etablissements = [...parEtab.values()]
    .sort((a, b) => a.caleLe.localeCompare(b.caleLe))
    .map((e) => ({ ...e, recent: e.caleLe >= debutSemaine }))
  const nbStagiaires = new Set(inscriptions.map((x) => x.apprenant_id)).size

  return {
    ...m,
    joursAvantDebut: Math.max(0, joursEntre(auj, m.debut)),
    objectif,
    objectifSaisi,
    tableAbsente,
    etablissements,
    nbSessions: sessions.length,
    nbStagiaires,
    nouveauxCetteSemaine: etablissements.filter((e) => e.recent).length,
    nbPoei: etablissements.filter((e) => e.poei).length,
    pourcentage: objectif > 0 ? Math.round((etablissements.length / objectif) * 100) : 0,
  }
}
