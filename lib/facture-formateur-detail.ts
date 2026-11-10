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
  /** Jours planifiés de la session (horaires_jours), avec leurs horaires lisibles. */
  joursPlanifies: { date: string; horaires: string | null }[]
  /** Horaires communs à tous les jours, s'ils sont identiques. */
  horaires: string | null
  /** Contrat du formateur sur la session (le plus récent hors annulés). */
  contrat: { numero: string | null; tarifJour: number | null; jours: number | null; montant: number | null; signeLe: string | null } | null
  /** Frais de déplacement du formateur saisis sur la session (case de l'onglet Formateur). */
  deplacement: number | null
  /** POEI : les interventions du formateur sur le parcours. */
  interventions: { libelle: string | null; periode: string | null; heures: number | null; montant: number | null }[]
}

/** Une ligne du tableau de facturation : désignation, détail, quantité, prix unitaire, montant. */
export interface LigneFacture {
  libelle: string
  sousLignes: string[]
  quantite: string | null
  prixUnitaire: number | null
  montant: number
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

const heure = (h: unknown) => {
  const m = String(h || '').match(/^(\d{1,2}):(\d{2})/)
  return m ? `${Number(m[1])}h${m[2]}` : null
}
/** « 9h00-12h30, 13h30-17h00 » pour un jour de horaires_jours. */
function horairesDuJour(j: any): string | null {
  const plages = [[j?.matin_debut, j?.matin_fin], [j?.aprem_debut, j?.aprem_fin]]
    .map(([d, f]) => (heure(d) && heure(f) ? `${heure(d)}-${heure(f)}` : null))
    .filter(Boolean)
  return plages.length ? plages.join(', ') : null
}
/** « lundi 19 octobre 2026 », « jeudi 1er octobre 2026 », sans décalage de fuseau. */
export const jourLong = (iso: string) => {
  const d = String(iso).slice(0, 10)
  return `${new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' })} ${jour(d)} ${mois(d)} ${annee(d)}`
}

/** Détail d'une facture à partir de sa session déjà chargée (SESSION_DETAIL_SELECT). */
export function detailPrestation(facture: any, extras: {
  stagiaires?: number | null; intervention?: any
  contrat?: any; deplacement?: number | null; interventions?: any[]
} = {}): DetailPrestation | null {
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
  const joursPlanifies = (Array.isArray(s.horaires_jours) ? s.horaires_jours : [])
    .filter((j: any) => j?.date)
    .map((j: any) => ({ date: String(j.date).slice(0, 10), horaires: horairesDuJour(j) }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
  const tousHoraires = Array.from(new Set(joursPlanifies.map((j: any) => j.horaires).filter(Boolean)))
  const c = extras.contrat || null
  // L'intervention propre de la session passe d'abord : une session qui porte aussi
  // le parcours ne liste pas les autres interventions du formateur (facturées à part)
  const ivs = (iv ? [iv] : (extras.interventions || [])) as any[]
  const heuresIvs = ivs.reduce((t, x) => t + (Number(x.nb_heures) || 0), 0)
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
    joursPlanifies,
    horaires: tousHoraires.length === 1 && joursPlanifies.length > 0 && joursPlanifies.every((j: any) => j.horaires) ? String(tousHoraires[0]) : null,
    contrat: c ? {
      numero: c.numero || null,
      tarifJour: Number(c.tarif_journalier) || null,
      jours: Number(c.nombre_jours) || null,
      montant: Number(c.montant_ht) || null,
      // À l'heure de Paris : une signature à 0 h 47 n'est jamais datée de la veille
      signeLe: c.signature_formateur_date ? new Date(c.signature_formateur_date).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) : null,
    } : null,
    deplacement: Number(extras.deplacement) > 0 ? Math.round(Number(extras.deplacement) * 100) / 100 : null,
    interventions: ivs.map((x) => ({
      libelle: propre(x.libelle) || null,
      periode: periodeFr(x.date_debut, x.date_fin || x.date_debut),
      heures: Number(x.nb_heures) || null,
      montant: Number(x.montant_ht) || null,
    })),
    ...(heuresIvs > 0 && !iv && (s.formation?.is_poei) ? { heures: heuresIvs, jours: Math.round((heuresIvs / 7) * 10) / 10 } : {}),
  }
}

/**
 * Détail de plusieurs factures d'un coup : compte les stagiaires inscrits et
 * lit les interventions POEI en deux requêtes, quel que soit le nombre de
 * factures. Les factures doivent porter leur session (SESSION_DETAIL_SELECT).
 */
export async function chargerDetailsPrestations(
  supabase: any,
  factures: any[],
  /** lignes : contrat, déplacement et interventions, pour le tableau du PDF (inutiles aux listes) */
  opts: { lignes?: boolean } = {},
): Promise<Record<string, DetailPrestation>> {
  const sessions = factures.map((f) => f.session).filter(Boolean)
  const sessionIds = [...new Set(sessions.map((s: any) => s.id))] as string[]
  const interventionIds = [...new Set(sessions.map((s: any) => s.poei_intervention_id).filter(Boolean))] as string[]
  const SEL_IV = 'id, poei_id, formateur_id, libelle, date_debut, date_fin, nb_heures, montant_ht, lieu, adresse, code_postal, ville'
  // Par paquets de 100 identifiants : une longue liste ne fait pas échouer la requête
  const parPaquets = async (ids: string[], requete: (p: string[]) => any): Promise<{ data: any[] }> => {
    if (!opts.lignes || !ids.length) return { data: [] }
    const out: any[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await requete(ids.slice(i, i + 100))
      out.push(...((data || []) as any[]))
    }
    return { data: out }
  }
  const [inscriptions, interventions, contrats, frais, parcours] = await Promise.all([
    sessionIds.length
      ? supabase.from('inscriptions').select('session_id, status').in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")').limit(5000)
      : Promise.resolve({ data: [] }),
    interventionIds.length
      ? supabase.from('poei_interventions').select(SEL_IV).in('id', interventionIds)
      : Promise.resolve({ data: [] }),
    // Contrat du formateur sur la session, déplacement saisi, parcours POEI portés par la session
    parPaquets(sessionIds, (p) => supabase.from('contrats_formateur')
      .select('session_id, formateur_id, numero, status, tarif_journalier, nombre_jours, montant_ht, signature_formateur_date, created_at')
      .in('session_id', p).neq('status', 'annule').order('created_at', { ascending: false })),
    parPaquets(sessionIds, (p) => supabase.from('session_frais').select('session_id, formateur_id, montant').in('session_id', p).eq('categorie', 'deplacement')),
    parPaquets(sessionIds, (p) => supabase.from('poei').select('id, session_id').in('session_id', p)),
  ])
  // Session chapeau d'une POEI : les interventions du parcours (filtrées par formateur plus bas)
  const poeiDeSession = new Map(((parcours.data || []) as any[]).map((p) => [p.session_id, p.id]))
  const poeiIds = Array.from(new Set(poeiDeSession.values()))
  const { data: ivsParcours } = await parPaquets(poeiIds, (p) => supabase.from('poei_interventions').select(SEL_IV).in('poei_id', p).order('date_debut', { ascending: true }))
  const nb = new Map<string, number>()
  for (const i of (inscriptions.data || []) as any[]) nb.set(i.session_id, (nb.get(i.session_id) || 0) + 1)
  const parId = new Map(((interventions.data || []) as any[]).map((i) => [i.id, i]))

  const details: Record<string, DetailPrestation> = {}
  for (const f of factures) {
    if (!f.session) continue
    const contrat = ((contrats.data || []) as any[]).find((c) => c.session_id === f.session.id && (!f.formateur_id || c.formateur_id === f.formateur_id)) || null
    const deplacement = ((frais.data || []) as any[])
      .filter((x) => x.session_id === f.session.id && f.formateur_id && x.formateur_id === f.formateur_id)
      .reduce((t, x) => t + (Number(x.montant) || 0), 0)
    const poeiId = poeiDeSession.get(f.session.id)
    // Session chapeau seulement : une session d'intervention ne porte que la sienne
    const interventionsDuFormateur = poeiId && f.formateur_id && !f.session.poei_intervention_id
      ? ((ivsParcours || []) as any[]).filter((i) => i.poei_id === poeiId && i.formateur_id === f.formateur_id)
      : []
    const d = detailPrestation(f, {
      stagiaires: nb.get(f.session.id) ?? null,
      intervention: f.session.poei_intervention_id ? parId.get(f.session.poei_intervention_id) : null,
      contrat, deplacement, interventions: interventionsDuFormateur,
    })
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
    ['Horaires', d.horaires],
    ['Stagiaires', d.stagiaires ? String(d.stagiaires) : null],
    ['Session', d.reference],
    ['Contrat', d.contrat?.numero ? `${d.contrat.numero}${d.contrat.signeLe ? `, signé le ${periodeFr(d.contrat.signeLe, d.contrat.signeLe)?.replace(/^le /, '')}` : ''}` : null],
  ]
  return lignes.filter((l): l is [string, string] => !!l[1])
}

const egal = (a: number, b: number) => Math.abs(a - b) < 0.01
const centimes = (n: number) => Number.isFinite(n) && Math.abs(Math.round(n * 100) - n * 100) < 1e-6
const euros = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0\u2009]/g, ' ')

/**
 * Lignes du tableau de facturation. Le détail des montants (jours × tarif,
 * déplacement, interventions) n'est écrit que s'il retombe exactement sur le
 * montant HT saisi par le formateur ; sinon une seule ligne au montant saisi,
 * qui garde le détail des dates.
 */
export function lignesFacturees(d: DetailPrestation | null, montantHt: number): LigneFacture[] {
  const ht = Math.round((Number(montantHt) || 0) * 100) / 100
  if (!d) return [{ libelle: 'Prestation de formation', sousLignes: [], quantite: null, prixUnitaire: null, montant: ht }]
  // Espaces insécables dans les guillemets : jamais un « » » seul en début de ligne
  const titre = d.formation ? `Animation de la formation «\u00a0${d.formation}\u00a0»` : 'Prestation de formation'
  const reference = d.reference ? `Session ${d.reference}` : null
  const deplacement = Number(d.deplacement) || 0
  const ligneDeplacement: LigneFacture = { libelle: 'Frais de déplacement', sousLignes: [], quantite: null, prixUnitaire: null, montant: deplacement }

  // POEI : une ligne par intervention du formateur
  if (d.poei && d.interventions.length) {
    const lignes: LigneFacture[] = d.interventions.map((iv) => ({
      libelle: iv.libelle ? `Intervention «\u00a0${iv.libelle}\u00a0»` : 'Intervention',
      sousLignes: [iv.periode ? iv.periode.charAt(0).toUpperCase() + iv.periode.slice(1) : null].filter(Boolean) as string[],
      quantite: iv.heures ? `${String(iv.heures).replace('.', ',')} h` : null,
      prixUnitaire: iv.heures && iv.montant && centimes(iv.montant / iv.heures) ? iv.montant / iv.heures : null,
      montant: Number(iv.montant) || 0,
    }))
    const somme = lignes.reduce((t, l) => t + l.montant, 0)
    if (lignes.every((l) => l.montant > 0) && egal(somme, ht)) return lignes
    if (deplacement > 0 && lignes.every((l) => l.montant > 0) && egal(somme + deplacement, ht)) return [...lignes, ligneDeplacement]
    // Montants qui ne retombent pas sur la facture : les interventions en détail, un seul montant
    return [{
      libelle: [titre, reference].filter(Boolean).join(' · '),
      sousLignes: d.interventions.map((iv) => [iv.libelle, iv.periode, iv.heures ? `${String(iv.heures).replace('.', ',')} h` : null].filter(Boolean).join(' · ')),
      quantite: null, prixUnitaire: null, montant: ht,
    }]
  }

  // Session : chaque jour daté avec ses horaires, puis jours × tarif
  const sousLignes = [
    ...(reference ? [reference] : []),
    ...d.joursPlanifies.map((j) => { const s = jourLong(j.date); return `${s.charAt(0).toUpperCase()}${s.slice(1)}${j.horaires ? ` · ${j.horaires}` : ''}` }),
  ]
  if (!d.joursPlanifies.length && d.periode) sousLignes.push(d.periode.charAt(0).toUpperCase() + d.periode.slice(1))
  const jours = d.joursPlanifies.length || (Number.isInteger(d.jours) ? Number(d.jours) : 0)
  // Montant de la prestation : le contrat, sinon la rémunération prévue, sinon ce qui reste hors déplacement
  const candidats = [d.contrat?.montant, d.prevu].map((x) => Number(x) || 0).filter((x) => x > 0)
  let prestation = candidats.find((x) => egal(x, ht) || (deplacement > 0 && egal(x + deplacement, ht))) ?? 0
  let avecDeplacement = prestation > 0 && deplacement > 0 && egal(prestation + deplacement, ht)
  const retombe = prestation > 0
  if (!prestation) { prestation = ht; avecDeplacement = false }
  // Diviser n'est permis que si rien ne le contredit : ni un contrat d'un autre
  // nombre de jours, ni un HT qui ne retombe sur rien alors qu'un contrat ou un
  // déplacement est connu (pas de « 2 jours × 525 € » pour un contrat 3 × 350 €)
  const joursContrat = Number(d.contrat?.jours) || 0
  const divisible = !(joursContrat && joursContrat !== jours) && (retombe || (!d.contrat && !deplacement))
  const tarif = d.contrat?.tarifJour && jours && egal(d.contrat.tarifJour * jours, prestation) ? d.contrat.tarifJour
    : divisible && jours && centimes(prestation / jours) ? prestation / jours : null
  const lignePrestation: LigneFacture = {
    libelle: titre,
    sousLignes,
    quantite: jours && tarif ? `${jours} ${jours > 1 ? 'jours' : 'jour'}` : null,
    prixUnitaire: jours && tarif ? tarif : null,
    montant: prestation,
  }
  return avecDeplacement ? [lignePrestation, ligneDeplacement] : [lignePrestation]
}

/** Montant en euros pour les PDF (sans espace fine, absente de la police). */
export const montantPdf = (n: number) => `${euros(n)} €`
