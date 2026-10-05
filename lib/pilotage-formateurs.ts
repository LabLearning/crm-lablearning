/**
 * Pilotage par formateur : ses sessions réalisées, en cours et à venir, et où
 * en est la facture de chacune (pas encore reçue, à valider, validée, payée).
 *
 * Une session « réalisée » est une session non annulée dont le dernier jour est
 * passé. Son suivi vient de la facture formateur rattachée à la session ; une
 * facture rejetée ne compte pas, la session redevient « à facturer ».
 *
 * `construirePilotage` est pur : il reçoit les lignes déjà lues et la date du
 * jour. `chargerPilotageFormateurs` fait les requêtes.
 */

import { fetchAllPaged } from '@/lib/supabase/fetch-all'
import { periodeFr } from '@/lib/facture-formateur-detail'

export type SuiviSession = 'a_facturer' | 'a_valider' | 'validee' | 'payee' | 'en_cours' | 'a_venir'

export const SUIVI_LABEL: Record<SuiviSession, string> = {
  a_facturer: 'Facture non reçue',
  a_valider: 'Facture à valider',
  validee: 'Validée, à payer',
  payee: 'Payée',
  en_cours: 'Session en cours',
  a_venir: 'Session à venir',
}

export interface FactureLiee { id: string; numero: string; montantHt: number; montantTtc: number; status: string; date: string | null }

export interface SessionFormateur {
  id: string
  reference: string | null
  formation: string
  client: string | null
  debut: string
  fin: string
  periode: string
  jours: number | null
  poei: boolean
  /** Rémunération prévue (session, ou intervention pour une POEI) ; null quand elle n'est pas fixée. */
  prevu: number | null
  facture: FactureLiee | null
  suivi: SuiviSession
}

export interface Lot { nb: number; total: number }

export interface PilotageFormateur {
  id: string
  nom: string
  realisees: number
  jours: number
  enCours: number
  aVenir: number
  /** Sessions réalisées sans facture : `total` additionne les montants prévus connus. */
  aFacturer: Lot
  /** Parmi elles, celles dont la rémunération n'est pas fixée : leur montant manque au total. */
  aFacturerSansMontant: number
  aValider: Lot
  validees: Lot
  payees: Lot
  /** Sessions, de la plus récente à la plus ancienne ; les sessions à venir en tête. */
  sessions: SessionFormateur[]
  /** Factures émises sur la période qui ne portent sur aucune de ces sessions. */
  autresFactures: (FactureLiee & { objet: string | null })[]
}

export interface PilotageFormateurs {
  formateurs: PilotageFormateur[]
  total: { realisees: number; formateurs: number; aFacturer: Lot; aFacturerSansMontant: number; aValider: Lot; validees: Lot; payees: Lot; enCours: number; aVenir: number }
}

const arrondi = (n: number) => Math.round(n * 100) / 100
const lot = (): Lot => ({ nb: 0, total: 0 })
const plus = (l: Lot, montant: number) => { l.nb++; l.total = arrondi(l.total + montant) }
const nomPropre = (prenom: unknown, nom: unknown) => `${String(prenom || '').trim()} ${String(nom || '').trim()}`.trim()
  .toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase()) || 'Formateur'

const versFacture = (f: any): FactureLiee => ({
  id: f.id,
  numero: f.numero || '',
  montantHt: Number(f.montant_ht) || 0,
  montantTtc: Number(f.montant_ttc) || Number(f.montant_ht) || 0,
  status: f.status,
  date: f.date_emission || (f.created_at ? String(f.created_at).slice(0, 10) : null),
})

function joursDe(s: any): number | null {
  const liste = Array.isArray(s.horaires_jours) ? s.horaires_jours.filter((j: any) => j?.date) : []
  if (liste.length) return new Set(liste.map((j: any) => String(j.date))).size
  if (s.formation?.is_poei || s.poei_intervention_id) return null
  const j = Number(s.formation?.duree_jours) || 0
  return j > 0 ? j : null
}

export function construirePilotage(
  entree: {
    formateurs: any[]
    /** Sessions non annulées qui ont un formateur et se terminent le `debut` ou après. */
    sessions: any[]
    /** Toutes les factures formateur de l'organisme. */
    factures: any[]
    /** Sessions « chapeau » d'un parcours POEI dont le travail est porté par des interventions : à ne pas compter deux fois. */
    chapeauxDoublons: Set<string>
    /** Montant HT d'une intervention POEI, par identifiant d'intervention. */
    montantIntervention: Map<string, number>
  },
  debut: string,
  aujourdhui: string,
): PilotageFormateurs {
  const parFormateur = new Map<string, PilotageFormateur>()
  const fiche = (id: string) => {
    let p = parFormateur.get(id)
    if (!p) {
      const f = entree.formateurs.find((x) => x.id === id)
      p = { id, nom: f ? nomPropre(f.prenom, f.nom) : 'Formateur', realisees: 0, jours: 0, enCours: 0, aVenir: 0, aFacturer: lot(), aFacturerSansMontant: 0, aValider: lot(), validees: lot(), payees: lot(), sessions: [], autresFactures: [] }
      parFormateur.set(id, p)
    }
    return p
  }

  // La facture d'une session : la plus récente qui n'est pas rejetée
  const factureDe = new Map<string, any>()
  for (const f of [...entree.factures].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (f.session_id && f.status !== 'rejetee') factureDe.set(`${f.formateur_id}:${f.session_id}`, f)
  }
  const facturesVues = new Set<string>()

  for (const s of entree.sessions) {
    if (!s.formateur_id || !s.date_debut || !s.date_fin || entree.chapeauxDoublons.has(s.id)) continue
    const fin = String(s.date_fin).slice(0, 10)
    const deb = String(s.date_debut).slice(0, 10)
    const etat = fin < aujourdhui ? 'realisee' : deb > aujourdhui ? 'a_venir' : 'en_cours'
    if (etat === 'realisee' && fin < debut) continue
    const p = fiche(s.formateur_id)
    const brute = factureDe.get(`${s.formateur_id}:${s.id}`)
    const facture = brute ? versFacture(brute) : null
    if (brute) facturesVues.add(brute.id)
    const prevuBrut = (s.poei_intervention_id ? entree.montantIntervention.get(s.poei_intervention_id) : 0) || Number(s.cout_formateur) || 0
    const prevu = prevuBrut > 0 ? prevuBrut : null
    const jours = joursDe(s)
    const suivi: SuiviSession = etat !== 'realisee' ? etat
      : !facture ? 'a_facturer'
      : facture.status === 'payee' ? 'payee'
      : facture.status === 'validee' ? 'validee' : 'a_valider'

    if (etat === 'a_venir') p.aVenir++
    else if (etat === 'en_cours') p.enCours++
    else { p.realisees++; p.jours = arrondi(p.jours + (jours || 0)) }

    if (suivi === 'a_facturer') { plus(p.aFacturer, prevu || 0); if (!prevu) p.aFacturerSansMontant++ }
    // Une facture reçue compte dès qu'elle existe, même si la session n'est pas finie
    if (facture) plus(facture.status === 'payee' ? p.payees : facture.status === 'validee' ? p.validees : p.aValider, facture.montantTtc)

    p.sessions.push({
      id: s.id,
      reference: s.reference || null,
      formation: String(s.formation?.intitule || s.intitule || 'Formation').replace(/\s+/g, ' ').trim(),
      client: String(s.client?.nom_commercial || s.client?.raison_sociale || '').trim() || null,
      debut: deb,
      fin,
      periode: periodeFr(deb, fin) || '',
      jours,
      poei: !!(s.formation?.is_poei || s.poei_intervention_id),
      prevu,
      facture,
      suivi,
    })
  }

  // Factures de la période qui ne portent sur aucune session ci-dessus (session plus ancienne, ou facture libre)
  for (const f of entree.factures) {
    if (facturesVues.has(f.id) || f.status === 'rejetee' || f.status === 'brouillon') continue
    const date = f.date_emission || (f.created_at ? String(f.created_at).slice(0, 10) : '')
    if (!date || date < debut) continue
    const p = fiche(f.formateur_id)
    const liee = versFacture(f)
    p.autresFactures.push({ ...liee, objet: f.objet || null })
    plus(liee.status === 'payee' ? p.payees : liee.status === 'validee' ? p.validees : p.aValider, liee.montantTtc)
  }

  const ordre: Record<string, number> = { a_venir: 0, en_cours: 1 }
  const formateurs = [...parFormateur.values()]
    .map((p) => ({ ...p, sessions: p.sessions.sort((a, b) => (ordre[a.suivi] ?? 2) - (ordre[b.suivi] ?? 2) || b.fin.localeCompare(a.fin)) }))
    // En tête : ceux pour qui il reste quelque chose à faire, du plus gros montant au plus petit
    .sort((a, b) => (b.aValider.total + b.validees.total + b.aFacturer.total) - (a.aValider.total + a.validees.total + a.aFacturer.total)
      || (b.aFacturer.nb - a.aFacturer.nb) || (b.realisees - a.realisees) || a.nom.localeCompare(b.nom))

  const somme = (f: (p: PilotageFormateur) => Lot): Lot => formateurs.reduce((t, p) => ({ nb: t.nb + f(p).nb, total: arrondi(t.total + f(p).total) }), lot())
  return {
    formateurs,
    total: {
      realisees: formateurs.reduce((t, p) => t + p.realisees, 0),
      formateurs: formateurs.filter((p) => p.realisees > 0).length,
      aFacturer: somme((p) => p.aFacturer),
      aFacturerSansMontant: formateurs.reduce((t, p) => t + p.aFacturerSansMontant, 0),
      aValider: somme((p) => p.aValider),
      validees: somme((p) => p.validees),
      payees: somme((p) => p.payees),
      enCours: formateurs.reduce((t, p) => t + p.enCours, 0),
      aVenir: formateurs.reduce((t, p) => t + p.aVenir, 0),
    },
  }
}

/** Lit ce qu'il faut pour le pilotage : formateurs, sessions depuis `debut`, factures, parcours POEI. */
export async function chargerPilotageFormateurs(supabase: any, organizationId: string, debut: string, aujourdhui: string): Promise<PilotageFormateurs> {
  const [formateurs, sessions, factures, poei, interventions] = await Promise.all([
    supabase.from('formateurs').select('id, prenom, nom').eq('organization_id', organizationId).limit(2000),
    fetchAllPaged<any>((from, to) => supabase.from('sessions')
      .select('id, reference, intitule, formateur_id, date_debut, date_fin, status, cout_formateur, horaires_jours, poei_intervention_id, formation:formation_id(intitule, is_poei, duree_jours), client:client_id(raison_sociale, nom_commercial)')
      .eq('organization_id', organizationId).not('formateur_id', 'is', null).neq('status', 'annulee').gte('date_fin', debut)
      .order('date_fin', { ascending: false }).range(from, to)),
    supabase.from('factures_formateur')
      .select('id, numero, formateur_id, session_id, montant_ht, montant_ttc, status, date_emission, created_at, objet')
      .eq('organization_id', organizationId).limit(5000),
    supabase.from('poei').select('id, session_id').eq('organization_id', organizationId).limit(2000),
    supabase.from('poei_interventions').select('id, poei_id, montant_ht').eq('organization_id', organizationId).limit(5000),
  ])
  if (formateurs.error) throw formateurs.error
  if (factures.error) throw factures.error

  // Un parcours POEI qui a des interventions est payé par intervention : sa session chapeau ne compte pas en plus
  const avecInterventions = new Set(((interventions.data || []) as any[]).map((i) => i.poei_id))
  const sessionsIntervention = new Set(sessions.filter((s) => s.poei_intervention_id).map((s) => s.id))
  const chapeauxDoublons = new Set(((poei.data || []) as any[])
    .filter((p) => p.session_id && avecInterventions.has(p.id) && !sessionsIntervention.has(p.session_id))
    .map((p) => p.session_id as string))

  return construirePilotage({
    formateurs: (formateurs.data || []) as any[],
    sessions,
    factures: (factures.data || []) as any[],
    chapeauxDoublons,
    montantIntervention: new Map(((interventions.data || []) as any[]).map((i) => [i.id, Number(i.montant_ht) || 0])),
  }, debut, aujourdhui)
}
