/**
 * Détail de la prestation d'une facture formateur : la formation, les dates,
 * le client, le lieu, la durée, le nombre de stagiaires. Tout vient de la
 * session rattachée à la facture (et de l'intervention, pour une POEI) : rien
 * n'est recopié sur la facture, donc une session corrigée corrige ses factures.
 *
 * Une seule source pour les trois endroits qui montrent une facture formateur :
 * la liste du tableau de bord, l'espace du formateur et le PDF.
 */

/** À placer dans le select d'une requête sur `factures_formateur`. */
export const SESSION_DETAIL_SELECT = 'session:session_id(id, reference, intitule, date_debut, date_fin, lieu, adresse, code_postal, ville, modalite, horaires, horaires_jours, cout_formateur, poei_intervention_id, formation:formation_id(intitule, duree_heures, duree_jours, is_poei), client:client_id(id, raison_sociale, nom_commercial, ville))'

export interface DetailPrestation {
  sessionId: string
  reference: string | null
  formation: string | null
  dateDebut: string | null
  dateFin: string | null
  /** « du 21 au 23 septembre 2026 », « le 16 juillet 2026 ». */
  periode: string | null
  jours: number | null
  heures: number | null
  clientId: string | null
  client: string | null
  clientVille: string | null
  lieu: string | null
  /** Présentiel, distanciel… */
  modalite: string | null
  stagiaires: number | null
  /** Rémunération prévue sur la session (ou l'intervention POEI), quand elle est fixée. */
  prevu: number | null
  /** Montant HT de la facture rapporté au nombre de jours. */
  tarifJour: number | null
  poei: boolean
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const jour = (iso: string) => { const j = Number(iso.slice(8, 10)); return j === 1 ? '1er' : String(j) }
const mois = (iso: string) => MOIS[Number(iso.slice(5, 7)) - 1]
const annee = (iso: string) => iso.slice(0, 4)

/** Une période lisible, sans répéter le mois ni l'année quand ils sont communs. */
export function periodeFr(debut: string | null | undefined, fin: string | null | undefined): string | null {
  const d = debut ? String(debut).slice(0, 10) : null
  const f = fin ? String(fin).slice(0, 10) : d
  if (!d || !f) return null
  if (d === f) return `le ${jour(d)} ${mois(d)} ${annee(d)}`
  if (annee(d) !== annee(f)) return `du ${jour(d)} ${mois(d)} ${annee(d)} au ${jour(f)} ${mois(f)} ${annee(f)}`
  if (d.slice(5, 7) !== f.slice(5, 7)) return `du ${jour(d)} ${mois(d)} au ${jour(f)} ${mois(f)} ${annee(f)}`
  return `du ${jour(d)} au ${jour(f)} ${mois(f)} ${annee(f)}`
}

const MODALITES: Record<string, string> = { presentiel: 'Présentiel', distanciel: 'Distanciel', mixte: 'Mixte', hybride: 'Mixte', elearning: 'E-learning' }
const propre = (s: unknown) => String(s || '').replace(/\s+/g, ' ').trim()

/** Lieu lisible : le nom du lieu quand il dit autre chose que le client ou l'adresse, puis l'adresse. */
function lieuDe(s: any, client: string | null): string | null {
  const rue = propre(s.adresse)
  const cpVille = [propre(s.code_postal), propre(s.ville)].filter(Boolean).join(' ')
  const compact = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
  // L'adresse saisie contient parfois déjà le code postal et la ville
  const adresse = rue && cpVille && compact(rue).includes(compact(cpVille)) ? rue : [rue, cpVille].filter(Boolean).join(', ')
  const nom = propre(s.lieu)
  if (!nom) return adresse || null
  if (!adresse) return nom
  if (compact(adresse).includes(compact(nom)) || compact(nom) === compact(client || '')) return adresse
  // Le nom du lieu reprend déjà la rue : on ne la répète pas
  if (rue && compact(nom).includes(compact(rue))) return !cpVille || compact(nom).includes(compact(cpVille)) ? nom : `${nom}, ${cpVille}`
  return `${nom} · ${adresse}`
}

function joursDe(s: any, intervention: any): number | null {
  const liste = Array.isArray(s.horaires_jours) ? s.horaires_jours.filter((j: any) => j?.date) : []
  if (liste.length) return new Set(liste.map((j: any) => String(j.date))).size
  // Une POEI s'étale sur des semaines : le nombre de jours de la formation n'est pas celui de l'intervenant
  if (intervention || s.formation?.is_poei) {
    const h = Number(intervention?.nb_heures) || 0
    return h > 0 ? Math.round((h / 7) * 10) / 10 : null
  }
  const j = Number(s.formation?.duree_jours) || 0
  if (j > 0) return j
  if (s.date_debut && s.date_fin) {
    const n = Math.round((Date.parse(`${String(s.date_fin).slice(0, 10)}T00:00:00Z`) - Date.parse(`${String(s.date_debut).slice(0, 10)}T00:00:00Z`)) / 86_400_000) + 1
    return n > 0 && n <= 5 ? n : null
  }
  return null
}

/** Détail d'une facture à partir de sa session déjà chargée (SESSION_DETAIL_SELECT). */
export function detailPrestation(facture: any, extras: { stagiaires?: number | null; intervention?: any } = {}): DetailPrestation | null {
  const s = facture?.session
  if (!s) return null
  const iv = extras.intervention || null
  const client = propre(s.client?.nom_commercial || s.client?.raison_sociale) || null
  const debut = (iv?.date_debut || s.date_debut || null) as string | null
  const fin = (iv?.date_fin || s.date_fin || debut) as string | null
  const jours = joursDe(s, iv)
  const heures = iv ? (Number(iv.nb_heures) || null) : s.formation?.is_poei ? null : (Number(s.formation?.duree_heures) || null)
  const prevu = Number(iv?.montant_ht) || Number(s.cout_formateur) || 0
  const ht = Number(facture.montant_ht) || 0
  return {
    sessionId: String(s.id),
    reference: s.reference || null,
    formation: propre(s.formation?.intitule || s.intitule) || null,
    dateDebut: debut ? String(debut).slice(0, 10) : null,
    dateFin: fin ? String(fin).slice(0, 10) : null,
    periode: periodeFr(debut, fin),
    jours,
    heures,
    clientId: s.client?.id || null,
    client,
    clientVille: propre(s.client?.ville) || null,
    lieu: lieuDe(iv?.adresse || iv?.lieu ? { ...s, lieu: iv.lieu || s.lieu, adresse: iv.adresse || s.adresse, code_postal: iv.code_postal || s.code_postal, ville: iv.ville || s.ville } : s, client),
    modalite: MODALITES[String(s.modalite || '').toLowerCase()] || null,
    stagiaires: extras.stagiaires ?? null,
    prevu: prevu > 0 ? prevu : null,
    tarifJour: jours && jours > 0 && ht > 0 ? Math.round((ht / jours) * 100) / 100 : null,
    poei: !!(iv || s.formation?.is_poei),
  }
}

/**
 * Détail de plusieurs factures d'un coup : compte les stagiaires inscrits et
 * lit les interventions POEI en deux requêtes, quel que soit le nombre de
 * factures. Les factures doivent porter leur session (SESSION_DETAIL_SELECT).
 */
export async function chargerDetailsPrestations(supabase: any, factures: any[]): Promise<Record<string, DetailPrestation>> {
  const sessions = factures.map((f) => f.session).filter(Boolean)
  const sessionIds = [...new Set(sessions.map((s: any) => s.id))] as string[]
  const interventionIds = [...new Set(sessions.map((s: any) => s.poei_intervention_id).filter(Boolean))] as string[]
  const [inscriptions, interventions] = await Promise.all([
    sessionIds.length
      ? supabase.from('inscriptions').select('session_id, status').in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")').limit(5000)
      : Promise.resolve({ data: [] }),
    interventionIds.length
      ? supabase.from('poei_interventions').select('id, libelle, date_debut, date_fin, nb_heures, montant_ht, lieu, adresse, code_postal, ville').in('id', interventionIds)
      : Promise.resolve({ data: [] }),
  ])
  const nb = new Map<string, number>()
  for (const i of (inscriptions.data || []) as any[]) nb.set(i.session_id, (nb.get(i.session_id) || 0) + 1)
  const parId = new Map(((interventions.data || []) as any[]).map((i) => [i.id, i]))

  const details: Record<string, DetailPrestation> = {}
  for (const f of factures) {
    if (!f.session) continue
    const d = detailPrestation(f, { stagiaires: nb.get(f.session.id) ?? null, intervention: f.session.poei_intervention_id ? parId.get(f.session.poei_intervention_id) : null })
    if (d) details[f.id] = d
  }
  return details
}

const nombre = (n: number) => String(n).replace('.', ',')

/** Durée lisible : « 3 jours · 21 heures ». */
export function dureeFr(d: DetailPrestation): string | null {
  const parts = [
    d.jours ? `${nombre(d.jours)} ${d.jours > 1 ? 'jours' : 'jour'}` : null,
    d.heures ? `${nombre(d.heures)} ${d.heures > 1 ? 'heures' : 'heure'}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** Les lignes « libellé : valeur » du détail, dans l'ordre où on les lit sur une facture. */
export function lignesDetail(d: DetailPrestation): [string, string][] {
  const lignes: [string, string | null][] = [
    ['Formation', d.formation],
    ['Dates', d.periode],
    ['Durée', dureeFr(d)],
    ['Client', [d.client, d.clientVille && !String(d.client || '').toLowerCase().includes(d.clientVille.toLowerCase()) ? d.clientVille : null].filter(Boolean).join(', ') || null],
    ['Lieu', [d.lieu, d.modalite && d.modalite !== 'Présentiel' ? d.modalite : null].filter(Boolean).join(' · ') || null],
    ['Stagiaires', d.stagiaires ? String(d.stagiaires) : null],
    ['Session', d.reference],
  ]
  return lignes.filter((l): l is [string, string] => !!l[1])
}
