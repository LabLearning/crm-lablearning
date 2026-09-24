/**
 * Objectif du mois : combien d'établissements sont déjà calés en formation
 * pour le mois suivant, face à l'objectif fixé par la direction.
 *
 * « Établissement calé » = client distinct ayant, dans le mois visé, au moins
 *  - côté OPCO : une session non annulée qui DÉMARRE dans le mois. Une session
 *    INTER (sans client) compte les établissements de ses stagiaires inscrits ;
 *  - côté POEI : un parcours POEI qui DÉMARRE dans le mois (date de début du
 *    parcours, comme la colonne POEI du tableau de bord). Les sessions d'un
 *    parcours (chapeau, interventions) ne comptent pas en plus : le parcours
 *    est lu dans la table poei, qu'il ait des sessions ou non.
 * Un établissement qui a une POEI dans le mois est rangé côté POEI.
 * Les sessions « BPF-… » (reprises comptables) sont ignorées.
 *
 * Chiffre d'affaires calé = somme des valeurs HT : une session vaut le montant
 * financé par l'OPCO, sinon son prix HT, sinon ses factures HT non annulées ;
 * un parcours POEI vaut son montant total, sinon taux horaire × durée ×
 * candidats non abandonnés. Ce qui n'a aucun montant compte 0 et est listé à
 * part : le chiffre affiché n'est jamais présenté comme complet alors qu'il
 * ne l'est pas.
 *
 * Ce module ne dépend que du client Supabase passé en paramètre : il est
 * appelé par le tableau de bord (rendu serveur).
 */

import { cartePoeiSessions } from '@/lib/poei-sessions'

export const OBJECTIF_PAR_DEFAUT = 25
/** Objectif de chiffre d'affaires HT calé par mois, faute de saisie. */
export const OBJECTIF_CA_PAR_DEFAUT = 60000

/** Rôles qui fixent l'objectif. Déclaré ici et pas dans objectif-actions.ts :
    un fichier 'use server' n'exporte que des fonctions async. */
export const ROLES_OBJECTIF: string[] = ['super_admin', 'gestionnaire', 'directeur_commercial']

export interface EtablissementCale {
  id: string
  nom: string
  ville: string | null
  /** Premier jour de formation dans le mois. */
  premiereSession: string
  /** Un parcours POEI de l'établissement démarre dans le mois (il est rangé côté POEI). */
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
  /** Nombre de sessions (hors POEI) qui démarrent dans le mois. */
  nbSessions: number
  /** Nombre de parcours POEI qui démarrent dans le mois. */
  nbParcoursPoei: number
  /** Stagiaires distincts : inscrits actifs des sessions + candidats POEI non abandonnés. */
  nbStagiaires: number
  /** Établissements dont la première session du mois a été créée depuis lundi 00:00, heure de Paris. */
  nouveauxCetteSemaine: number
  /** Établissements rangés côté POEI (les autres sont côté OPCO). */
  nbPoei: number
  /** Pourcentage de l'objectif atteint (peut dépasser 100). */
  pourcentage: number
  /** Objectif de chiffre d'affaires HT du mois. */
  objectifCa: number
  /** L'objectif de CA vient-il d'une saisie (sinon 60 000 € par défaut) ? */
  objectifCaSaisi: boolean
  /** La colonne ca_ht n'existe pas encore (migration 159 à appliquer). */
  colonneCaAbsente: boolean
  /** Chiffre d'affaires HT déjà calé sur le mois, arrondi à l'euro. */
  caCale: number
  /** Part du CA calé venant des parcours POEI (le reste vient des sessions). */
  caPoei: number
  /** Part du CA calé par des sessions créées depuis lundi 00:00 (Paris). */
  caCetteSemaine: number
  /** Pourcentage de l'objectif de CA atteint (peut dépasser 100). */
  caPourcentage: number
  /** Sessions et parcours POEI du mois sans aucun montant : leur CA n'est pas compté. */
  sessionsSansMontant: { id: string; libelle: string; href: string }[]
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

  const lireObjectif = async () => {
    const r = await supabase.from('objectifs_formation').select('etablissements, ca_ht')
      .eq('organization_id', organizationId).eq('mois', m.debut).maybeSingle()
    // Colonne ca_ht absente tant que la migration 159 n'est pas appliquée : on relit sans elle
    if (r.error && /ca_ht|42703/i.test(`${r.error.code} ${r.error.message}`)) {
      const r2 = await supabase.from('objectifs_formation').select('etablissements')
        .eq('organization_id', organizationId).eq('mois', m.debut).maybeSingle()
      return { ...r2, colonneCaAbsente: true }
    }
    return { ...r, colonneCaAbsente: false }
  }

  const [objRes, sessRes, carte, poeiRes] = await Promise.all([
    lireObjectif(),
    supabase.from('sessions')
      .select('id, reference, client_id, date_debut, created_at, prix_ht, montant_finance_opco, poei_intervention_id, formation:formation_id(is_poei, intitule), client:client_id(id, raison_sociale, nom_commercial, ville), factures(montant_ht, status)')
      .eq('organization_id', organizationId)
      .gte('date_debut', m.debut).lte('date_debut', m.fin)
      .neq('status', 'annulee'),
    cartePoeiSessions(supabase, organizationId),
    supabase.from('poei')
      .select('id, numero, statut, date_debut, created_at, montant_total, montant_horaire, duree_heures, client:client_id(id, raison_sociale, nom_commercial, ville), candidats:poei_candidats(apprenant_id, statut)')
      .eq('organization_id', organizationId)
      .gte('date_debut', m.debut).lte('date_debut', m.fin),
  ])
  // supabase-js ne lève pas : une requête en échec doit masquer le bloc (catch de la page), pas afficher un faux zéro
  if (sessRes.error) throw sessRes.error
  if (poeiRes.error) throw poeiRes.error

  // Table absente tant que la migration 158 n'est pas appliquée : objectif par défaut
  const tableAbsente = !!objRes.error && /objectifs_formation|42P01|PGRST205/i.test(`${objRes.error.code} ${objRes.error.message}`)
  const objectifSaisi = !objRes.error && !!objRes.data?.etablissements
  const objectif = objectifSaisi ? Number(objRes.data.etablissements) : OBJECTIF_PAR_DEFAUT
  const objectifCaSaisi = !objRes.error && Number((objRes.data as any)?.ca_ht) > 0
  const objectifCa = objectifCaSaisi ? Number((objRes.data as any).ca_ht) : OBJECTIF_CA_PAR_DEFAUT

  // Les sessions d'un parcours POEI (chapeau, interventions) sont comptées par le parcours lui-même
  const sessions = ((sessRes.data || []) as any[])
    .filter((s) => !String(s.reference || '').startsWith('BPF-'))
    .filter((s) => !carte.doublons.has(s.id) && !carte.poeiParSession.has(s.id) && !s.poei_intervention_id)
  const parcoursPoei = ((poeiRes.data || []) as any[]).filter((p) => !/^annul/.test(String(p.statut || '')))

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
  const ajouter = (client: any, s: any, poei = false) => {
    if (!client?.id) return
    const nom = client.nom_commercial || client.raison_sociale || 'Établissement'
    const e = parEtab.get(client.id)
    if (!e) {
      parEtab.set(client.id, { id: client.id, nom, ville: client.ville || null, premiereSession: s.date_debut, poei, caleLe: s.created_at, recent: false })
      return
    }
    if (s.date_debut < e.premiereSession) e.premiereSession = s.date_debut
    if (s.created_at < e.caleLe) e.caleLe = s.created_at
    if (poei) e.poei = true
  }
  for (const s of sessions) {
    // Session d'une formation POEI sans parcours relié (reprise ancienne) : rangée côté POEI
    const poei = !!s.formation?.is_poei
    if (s.client_id) { ajouter(s.client, s, poei); continue }
    for (const ins of inscriptions.filter((x) => x.session_id === s.id)) ajouter(ins.apprenant?.client, s, poei)
  }
  for (const p of parcoursPoei) ajouter(p.client, p, true)

  // ── Chiffre d'affaires calé ──
  const candidatsActifs = (p: any) => ((p.candidats || []) as any[]).filter((c) => c.statut !== 'abandonne')
  const valeurPoei = (p: any): number => {
    const total = Number(p.montant_total) || 0
    return total > 0 ? total : (Number(p.montant_horaire) || 0) * (Number(p.duree_heures) || 0) * candidatsActifs(p).length
  }
  const valeurSession = (s: any): number => {
    const opco = Number(s.montant_finance_opco) || 0
    if (opco > 0) return opco
    const prix = Number(s.prix_ht) || 0
    if (prix > 0) return prix
    return ((s.factures || []) as any[]).filter((f) => f.status !== 'annulee').reduce((t, f) => t + (Number(f.montant_ht) || 0), 0)
  }
  let caCale = 0
  let caCetteSemaine = 0
  const sessionsSansMontant: { id: string; libelle: string; href: string }[] = []
  let caPoei = 0
  for (const s of sessions) {
    const v = valeurSession(s)
    if (v <= 0) {
      const qui = s.client?.nom_commercial || s.client?.raison_sociale || s.formation?.intitule || 'Session'
      sessionsSansMontant.push({ id: s.id, libelle: [qui, s.reference].filter(Boolean).join(' · '), href: `/dashboard/sessions/${s.id}` })
      continue
    }
    caCale += v
    if (s.formation?.is_poei) caPoei += v
    if (s.created_at >= debutSemaine) caCetteSemaine += v
  }
  for (const p of parcoursPoei) {
    const v = valeurPoei(p)
    if (v <= 0) {
      const qui = p.client?.nom_commercial || p.client?.raison_sociale || p.numero || 'Parcours'
      sessionsSansMontant.push({ id: p.id, libelle: `${qui} (POEI)`, href: `/dashboard/poei/${p.id}` })
      continue
    }
    caCale += v
    caPoei += v
    if (p.created_at >= debutSemaine) caCetteSemaine += v
  }
  caCale = Math.round(caCale)
  caPoei = Math.round(caPoei)
  caCetteSemaine = Math.round(caCetteSemaine)

  const etablissements = [...parEtab.values()]
    .sort((a, b) => a.caleLe.localeCompare(b.caleLe))
    .map((e) => ({ ...e, recent: e.caleLe >= debutSemaine }))
  const nbStagiaires = new Set([
    ...inscriptions.map((x) => x.apprenant_id),
    ...parcoursPoei.flatMap((p) => candidatsActifs(p).map((c: any) => c.apprenant_id)),
  ].filter(Boolean)).size

  return {
    ...m,
    joursAvantDebut: Math.max(0, joursEntre(auj, m.debut)),
    objectif,
    objectifSaisi,
    tableAbsente,
    etablissements,
    nbSessions: sessions.length,
    nbParcoursPoei: parcoursPoei.length,
    nbStagiaires,
    nouveauxCetteSemaine: etablissements.filter((e) => e.recent).length,
    nbPoei: etablissements.filter((e) => e.poei).length,
    pourcentage: objectif > 0 ? Math.round((etablissements.length / objectif) * 100) : 0,
    objectifCa,
    objectifCaSaisi,
    colonneCaAbsente: !!(objRes as any).colonneCaAbsente,
    caCale,
    caPoei,
    caCetteSemaine,
    caPourcentage: objectifCa > 0 ? Math.round((caCale / objectifCa) * 100) : 0,
    sessionsSansMontant,
  }
}
