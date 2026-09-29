/**
 * Audits hygiène d'un établissement (miroir AuditHygiène, tables ah_*), lus
 * pour les comptes rendus de formation et l'espace franchise.
 *
 * Module sans import serveur : les types et la mise en forme servent aussi
 * côté navigateur ; le chargement reçoit le client Supabase.
 *
 * Les réponses de la grille sont rangées par clé « s<section>_<réf.> » :
 * val = ok, warn (partiel), ko (non conforme) ou na ; l'observation est dans
 * « note » (« comment » sur les anciens audits). La section se lit dans le
 * préfixe de la référence, plus stable que l'ordre des sections.
 */

export interface EcartAudit { section: string; ref: string; niveau: 'non_conforme' | 'partiel'; observation: string | null }

export interface AuditEtablissement {
  id: string
  numRapport: string | null
  date: string | null
  auditeur: string | null
  type: string | null
  score: number | null
  mention: string | null
  conformes: number
  partiels: number
  nonConformes: number
  ecarts: EcartAudit[]
  documentsManquants: string[]
}

const SECTIONS: [RegExp, string][] = [
  [/^Nu\d/, 'Nuisibles et déchets'],
  [/^Tr\d/, 'Traçabilité'],
  [/^L\d/, 'Locaux'],
  [/^E\d/, 'Équipements'],
  [/^H\d/, 'Hygiène du personnel'],
  [/^M\d/, 'Matières premières'],
  [/^T\d/, 'Températures'],
  [/^N\d/, 'Nettoyage et désinfection'],
]

/** Documents obligatoires de la grille (partie hygiène puis sécurité). */
const DOCUMENTS: Record<string, string> = {
  cl_h1: 'Contrat de dératisation et désinsectisation',
  cl_h2: 'Contrat d’analyses alimentaires (laboratoire agréé)',
  cl_h3: 'Contrat de collecte des huiles usagées',
  cl_h4: 'Plan de maîtrise sanitaire (PMS)',
  cl_h5: 'Liste des allergènes affichée',
  cl_h6: 'Affichage des origines des viandes',
  cl_h7: 'Attestation de formation HACCP',
  cl_h_excl: 'Consignes d’éviction du personnel malade affichées',
  cl_s1: 'Vérification annuelle des installations électriques',
  cl_s2: 'Vérification de l’étanchéité des circuits frigorifiques',
  cl_s3: 'Vérification annuelle des extincteurs',
  cl_s4: 'Attestation de formation incendie',
  cl_s5: 'Ramonage des hottes',
  cl_s6: 'Fiches de données de sécurité des produits chimiques',
  cl_s7: 'DUERP à jour',
  cl_s_visite_med: 'Visite médicale et suivi par la médecine du travail',
}

const nombre = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Lit une ligne ah_audits : écarts et documents manquants. */
export function lireAudit(a: any): AuditEtablissement {
  const ecarts: EcartAudit[] = []
  const reponses = a?.answers && typeof a.answers === 'object' ? a.answers : {}
  for (const [cle, v] of Object.entries(reponses) as [string, any][]) {
    if (!v || (v.val !== 'ko' && v.val !== 'warn')) continue
    const ref = cle.replace(/^s\d+_/, '')
    const section = SECTIONS.find(([re]) => re.test(ref))?.[1] || 'Autre'
    const observation = String(v.note ?? v.comment ?? '').trim() || null
    ecarts.push({ section, ref, niveau: v.val === 'ko' ? 'non_conforme' : 'partiel', observation })
  }
  const ordre = SECTIONS.map(([, s]) => s)
  ecarts.sort((x, y) => ordre.indexOf(x.section) - ordre.indexOf(y.section) || x.ref.localeCompare(y.ref, 'fr', { numeric: true }))

  const liste = a?.checklist && typeof a.checklist === 'object' ? a.checklist : {}
  const absent = (v: unknown) => v === false || String(v).toLowerCase() === 'non'
  const documentsManquants = Object.entries(liste).filter(([k, v]) => DOCUMENTS[k] && absent(v)).map(([k]) => DOCUMENTS[k])

  return {
    id: a.id,
    numRapport: a.num_rapport || null,
    date: a.date_audit || null,
    auditeur: a.formateur_nom || null,
    type: a.type_audit || null,
    score: a.score_global == null ? null : nombre(a.score_global),
    mention: a.mention || null,
    conformes: nombre(a.nb_conformes),
    partiels: nombre(a.nb_partiels),
    nonConformes: nombre(a.nb_non_conformes),
    ecarts,
    documentsManquants,
  }
}

/** Audits finalisés de l'établissement (client), du plus ancien au plus récent. */
export async function auditsDuClient(supabase: any, clientId: string, organizationId: string): Promise<AuditEtablissement[]> {
  const { data: etabs } = await supabase.from('ah_etablissements').select('id')
    .eq('client_id', clientId).eq('organization_id', organizationId)
  const ids = (etabs || []).map((e: any) => e.id)
  if (!ids.length) return []
  const { data } = await supabase.from('ah_audits')
    .select('id, num_rapport, date_audit, formateur_nom, type_audit, score_global, mention, nb_conformes, nb_partiels, nb_non_conformes, statut, answers, checklist')
    .in('etablissement_id', ids).neq('statut', 'en_cours')
    .order('date_audit', { ascending: true })
  return ((data || []) as any[]).filter((a) => Number(a.score_global) > 0).map(lireAudit)
}

/**
 * Audits d'entrée et de sortie d'une session : le dernier audit fait au plus
 * tard à la fin de la session, puis le premier fait après elle.
 */
export function auditsDeLaSession(audits: AuditEtablissement[], session: { date_debut?: string | null; date_fin?: string | null }) {
  const fin = String(session.date_fin || session.date_debut || '').slice(0, 10)
  if (!fin) return { entree: null, sortie: null }
  const avant = audits.filter((a) => a.date && a.date <= fin)
  const apres = audits.filter((a) => a.date && a.date > fin)
  return { entree: avant[avant.length - 1] || null, sortie: apres[0] || null }
}
