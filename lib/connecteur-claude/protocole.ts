import { OUTILS_ASSISTANT, executerOutil } from '@/lib/assistant/outils'
import { ErreurLecture, agreger, compter, decrireTables, lire } from './lecture'
import { nettoyer } from './securite'

/**
 * Connecteur Claude : serveur MCP (Model Context Protocol) du CRM, en lecture
 * seule. Messages JSON-RPC reçus par /api/mcp (transport HTTP, sans session).
 * Outils génériques sur toutes les tables, plus les outils de lecture de
 * Starkk (fiches complètes, indicateurs, analyse financière).
 */

export type ContexteConnecteur = { organizationId: string; userId: string; cleId: string; base: string }

/**
 * Journal d'un appel d'outil : réservé AVANT l'exécution (une ligne qui sert
 * aussi au plafond d'appels), complété après. Sans ligne réservée, rien n'est lu.
 */
export type JournalConnecteur = {
  reserver: (e: { outil: string; table?: string; arguments: Record<string, unknown> }) => Promise<string | null>
  conclure: (id: string, e: { lignes?: number; ms: number; erreur?: string }) => Promise<void>
}

export const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

const IDENT = /^[a-z_][a-z0-9_]*$/
const sansControle = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, '')

/**
 * Valide les arguments contre le inputSchema de l'outil, AVANT toute lecture :
 * aucun argument inattendu, chaque valeur du type déclaré (une liste à la place
 * d'un texte serait lue mais mal journalisée), imbrication bornée.
 */
function validerArguments(schema: any, valeur: any, chemin = 'arguments', profondeur = 0): string | null {
  if (profondeur > 4) return `${chemin} : imbrication trop profonde`
  const type = schema?.type
  if (type === 'object' || (!type && schema?.properties)) {
    if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return `${chemin} doit être un objet`
    const proprietes = schema.properties || {}
    for (const k of Object.keys(valeur)) if (!(k in proprietes)) return `Argument inattendu : ${sansControle(k).slice(0, 40)}`
    for (const r of schema.required || []) if (valeur[r] === undefined || valeur[r] === null || valeur[r] === '') return `Argument requis : ${r}`
    for (const [k, sous] of Object.entries(proprietes)) {
      if (valeur[k] === undefined) continue
      const e = validerArguments(sous, valeur[k], `${chemin}.${k}`, profondeur + 1)
      if (e) return e
    }
    return null
  }
  if (type === 'array') {
    if (!Array.isArray(valeur)) return `${chemin} doit être une liste`
    if (valeur.length > 50) return `${chemin} : 50 éléments au plus`
    for (let i = 0; i < valeur.length; i++) {
      const e = validerArguments(schema.items || {}, valeur[i], `${chemin}[${i}]`, profondeur + 1)
      if (e) return e
    }
    return null
  }
  if (type === 'string') {
    if (typeof valeur !== 'string') return `${chemin} doit être un texte`
    if (valeur.length > 2000) return `${chemin} est trop long`
    if (Array.isArray(schema.enum) && !schema.enum.includes(valeur)) return `${chemin} : valeur non permise`
    return null
  }
  if (type === 'integer') return Number.isInteger(valeur) ? null : `${chemin} doit être un entier`
  if (type === 'number') return typeof valeur === 'number' && Number.isFinite(valeur) ? null : `${chemin} doit être un nombre`
  if (type === 'boolean') return typeof valeur === 'boolean' ? null : `${chemin} doit être vrai ou faux`
  // Sans type déclaré (valeur d'un filtre) : une valeur simple, ou une liste de valeurs simples
  const simple = (x: any) => x === null || typeof x === 'number' || typeof x === 'boolean' || (typeof x === 'string' && x.length <= 500)
  if (simple(valeur) || (Array.isArray(valeur) && valeur.length <= 500 && valeur.every(simple))) return null
  return `${chemin} : valeur simple ou liste de valeurs simples attendue`
}

/**
 * Paramètres de l'appel pour le journal, une fois validés : la table, les
 * colonnes demandées (fiches liées comprises), les colonnes de filtre et de tri,
 * les identifiants et le texte cherché. Les valeurs de filtres ne sont pas
 * recopiées (elles peuvent être des données personnelles).
 */
function resumeArguments(args: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (k === 'filtres' && Array.isArray(v)) out[k] = v.map((f: any) => `${sansControle(String(f?.colonne ?? '')).slice(0, 40)} ${String(f?.op ?? '')}`)
    else if (k === 'ordre' && Array.isArray(v)) out[k] = v.map((o: any) => sansControle(String(o?.colonne ?? '')).slice(0, 40))
    else if (typeof v === 'string') out[k] = sansControle(v).slice(0, k === 'colonnes' ? 2000 : 200)
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v
    else out[k] = sansControle(JSON.stringify(v)).slice(0, 200)
  }
  return out
}

const FILTRES = {
  type: 'array',
  description: 'Conditions combinées en ET. Exemple : [{"colonne":"status","op":"eq","valeur":"emise"},{"colonne":"date_emission","op":"gte","valeur":"2026-01-01"}]',
  items: {
    type: 'object',
    properties: {
      colonne: { type: 'string' },
      op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'est_vide', 'non_vide'], description: 'ilike : contient, sans casse, avec % comme joker (ex. "%dupont%")' },
      valeur: { description: 'Valeur simple, ou liste pour « in » ; inutile pour est_vide et non_vide' },
    },
    required: ['colonne', 'op'],
  },
}

const LECTURE_SEULE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const OUTILS_GENERIQUES = [
  {
    name: 'tables',
    title: 'Tables du CRM',
    description: 'Liste toutes les tables lisibles du CRM, ou, avec « table », ses colonnes, leur type et les tables liées (lien_vers). À appeler avant « lire » quand tu ne connais pas le nom exact d’une table ou d’une colonne.',
    inputSchema: { type: 'object', properties: { table: { type: 'string', description: 'Nom d’une table pour voir ses colonnes' } } },
    annotations: LECTURE_SEULE,
  },
  {
    name: 'lire',
    title: 'Lire une table',
    description: 'Lit les lignes de n’importe quelle table du CRM, avec filtres, tri et pagination (200 lignes au plus par appel, « suite » indique s’il en reste). « colonnes » peut inclure une fiche liée par sa clé étrangère : "id, numero, montant_ttc, client:client_id(raison_sociale, nom_commercial)".',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        colonnes: { type: 'string', description: 'Colonnes séparées par des virgules ; vide = toutes' },
        filtres: FILTRES,
        ordre: {
          type: 'array',
          items: { type: 'object', properties: { colonne: { type: 'string' }, croissant: { type: 'boolean' } }, required: ['colonne'] },
        },
        limite: { type: 'integer', minimum: 1, maximum: 200, description: '50 par défaut' },
        decalage: { type: 'integer', minimum: 0, description: 'Pour la page suivante' },
      },
      required: ['table'],
    },
    annotations: LECTURE_SEULE,
  },
  {
    name: 'compter',
    title: 'Compter des lignes',
    description: 'Nombre exact de lignes d’une table, avec les mêmes filtres que « lire ».',
    inputSchema: { type: 'object', properties: { table: { type: 'string' }, filtres: FILTRES }, required: ['table'] },
    annotations: LECTURE_SEULE,
  },
  {
    name: 'agreger',
    title: 'Totaux et regroupements',
    description: 'Somme, moyenne, minimum, maximum ou nombre de lignes d’une table filtrée, au total ou par groupe (une colonne, ou une date ramenée au jour, au mois ou à l’année). Exemple : chiffre facturé par mois = table factures, operation somme, colonne montant_ht, grouper_par date_emission, regrouper_date mois.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        operation: { type: 'string', enum: ['compte', 'somme', 'moyenne', 'min', 'max'] },
        colonne: { type: 'string', description: 'Colonne calculée (inutile pour compte)' },
        grouper_par: { type: 'string' },
        regrouper_date: { type: 'string', enum: ['jour', 'mois', 'annee'] },
        filtres: FILTRES,
      },
      required: ['table', 'operation'],
    },
    annotations: LECTURE_SEULE,
  },
]

const OUTILS_STARKK = OUTILS_ASSISTANT.map((o: any) => ({
  name: o.name,
  description: o.description,
  inputSchema: o.input_schema,
  annotations: LECTURE_SEULE,
}))

export const OUTILS_CONNECTEUR = [...OUTILS_GENERIQUES, ...OUTILS_STARKK]
const NOMS_STARKK = new Set<string>(OUTILS_STARKK.map((o) => o.name))

const GUIDE = `CRM de Lab Learning, organisme de formation professionnelle (restauration, boucherie, boulangerie, pâtisserie, hôtellerie), certifié Qualiopi. Tout est en lecture seule.

Repères :
- Commercial : leads (demandes entrantes) → clients (établissements) et contacts ; devis et devis_lignes ; apporteurs_affaires et commissions ; franchises (réseaux) et commissions_sessions.
- Formation : formations (catalogue) → sessions (une action datée, client, formateur) → inscriptions → apprenants ; emargements (une ligne par stagiaire et demi-journée ; motif_absence « Repos » = jour de repos, autre motif = absence) et emargement_feuilles (validation et signature du formateur) ; conventions et convention_avenants ; rapports_session.
- POEI (France Travail) : poei → poei_candidats (apprenant_id, statut, heures_effectuees), poei_interventions (formateur) dont les sessions portent poei_intervention_id ; la session chapeau est poei.session_id.
- Facturation : factures (numero, status, montant_ht, montant_ttc, date_emission, client_id, session_id) et facture_lignes ; paiements ; cessions_creances (affacturage).
- Formateurs : formateurs, contrats_formateur, factures_formateur, pointages_formateur, formateur_evaluations.
- Qualité : qualiopi_indicateurs, qualiopi_preuves, reclamations, actions_amelioration, evaluations_satisfaction, qcm et qcm_reponses.
- Suivi : crm_taches, email_logs (mails envoyés), audit_logs (journal des actions).

Méthode : « rechercher » pour retrouver une personne, une entreprise ou une pièce ; les outils detail_* pour une fiche complète ; « tables » puis « lire », « compter » ou « agreger » pour tout le reste. Les montants sont en euros. Cite les numéros de pièces et les liens fournis.`

/**
 * Taille maximale d'une réponse d'outil : sous ce que Claude accepte d'un
 * résultat (environ 150 000 caractères dans l'application) et loin de la
 * limite de 4,5 Mo des réponses Vercel
 */
const TAILLE_MAX = 120_000

/**
 * Texte renvoyé à Claude. Une lecture trop volumineuse perd des lignes, en le
 * disant (« suite » reste vrai) ; toute autre réponse trop lourde est refusée.
 */
function texte(resultat: any): string {
  let t = JSON.stringify(resultat)
  if (t.length <= TAILLE_MAX) return t
  if (Array.isArray(resultat?.lignes)) {
    const r = { ...resultat }
    while (t.length > TAILLE_MAX && r.lignes.length > 1) {
      r.lignes = r.lignes.slice(0, Math.ceil(r.lignes.length / 2))
      r.nombre = r.lignes.length
      r.suite = true
      r.decalage_suivant = (Number(resultat.decalage) || 0) + r.lignes.length
      r.reduit = 'Réponse trop volumineuse : seules les premières lignes sont données. Demande moins de colonnes ou une limite plus petite, puis reprends à decalage_suivant.'
      t = JSON.stringify(r)
    }
    if (t.length <= TAILLE_MAX) return t
  }
  return JSON.stringify({ erreur: 'Réponse trop volumineuse : demande moins de colonnes, une limite plus petite ou un filtre plus précis.' })
}

const invalide = (message: string) => ({ jsonrpc: '2.0', id: null, error: { code: -32600, message } })

/**
 * Traite un message JSON-RPC. Renvoie null quand il n'y a rien à répondre :
 * notification (sans « id ») ou réponse envoyée par le client.
 */
export async function traiterMessage(
  m: any,
  ctx: ContexteConnecteur,
  journal?: JournalConnecteur,
): Promise<any | null> {
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.jsonrpc !== '2.0') return invalide('Requête JSON-RPC invalide')
  if (typeof m.method !== 'string') {
    // Réponse du client à une demande du serveur : acceptée, jamais de réponse à une réponse
    return 'result' in m || 'error' in m ? null : invalide('Requête JSON-RPC invalide')
  }
  // Notification (notifications/initialized, annulation…) : rien à répondre
  if (!('id' in m)) return null
  const id = m.id
  if (typeof id !== 'string' && typeof id !== 'number') return invalide('Identifiant de requête invalide (jamais null)')
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result })
  const ko = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })

  switch (m.method) {
    case 'initialize': {
      const demandee = String(m.params?.protocolVersion || '')
      return ok({
        protocolVersion: VERSIONS.includes(demandee) ? demandee : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'crm-lab-learning', title: 'CRM Lab Learning', version: '1.0.0' },
        instructions: GUIDE,
      })
    }
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: OUTILS_CONNECTEUR })
    case 'tools/call': {
      const nom = String(m.params?.name || '')
      const args = m.params?.arguments && typeof m.params.arguments === 'object' && !Array.isArray(m.params.arguments) ? m.params.arguments : {}
      const outil = OUTILS_CONNECTEUR.find((o) => o.name === nom)
      if (!outil) return ko(-32602, `Outil inconnu : ${sansControle(nom).slice(0, 64)}`)
      const refus = (texteRefus: string) => ok({ content: [{ type: 'text', text: texteRefus }], isError: true })
      // Arguments vérifiés avant tout : rien d'inattendu, chaque valeur de son type (et le journal dit vrai)
      const invalides = validerArguments(outil.inputSchema, args)
      if (invalides) return refus(`Arguments invalides : ${invalides}`)
      // Un caractère nul ferait échouer l'écriture du journal : refusé d'emblée
      if (JSON.stringify(args).includes('\\u0000')) return refus('Caractère non permis dans les arguments')
      const table = typeof args.table === 'string' && IDENT.test(args.table) && args.table.length <= 64 ? args.table : undefined
      let entree: string | null = null
      if (journal) {
        entree = await journal.reserver({ outil: nom, table, arguments: resumeArguments(args) })
        // Pas de lecture sans trace (journal indisponible, ou plafond d'appels atteint)
        if (!entree) return refus('Lecture refusée : plafond d’appels atteint ou journal momentanément indisponible. Réessaie dans un instant.')
      }
      const t0 = Date.now()
      try {
        let resultat: any
        if (nom === 'tables') resultat = await decrireTables(args)
        else if (nom === 'lire') resultat = await lire(args, ctx.organizationId, ctx.base)
        else if (nom === 'compter') resultat = await compter(args, ctx.organizationId)
        else if (nom === 'agreger') resultat = nettoyer(await agreger(args, ctx.organizationId, ctx.base), ctx.base)
        // Le propriétaire de la clé est un super administrateur : tous les outils de Starkk lui sont ouverts
        else resultat = nettoyer(await executerOutil(nom, args, ctx.organizationId, { id: ctx.userId, role: 'super_admin' }), ctx.base)
        const sortie = texte(resultat)
        if (journal && entree) await journal.conclure(entree, { lignes: Array.isArray(resultat?.lignes) ? resultat.lignes.length : undefined, ms: Date.now() - t0 })
        return ok({ content: [{ type: 'text', text: sortie }], isError: !!resultat?.erreur || sortie.startsWith('{"erreur"') })
      } catch (e: any) {
        const message = e instanceof ErreurLecture ? String(nettoyer(e.message)).slice(0, 300) : 'Erreur pendant la lecture du CRM'
        if (!(e instanceof ErreurLecture)) console.error('[connecteur claude]', nom, e)
        if (journal && entree) await journal.conclure(entree, { ms: Date.now() - t0, erreur: message })
        return ok({ content: [{ type: 'text', text: message }], isError: true })
      }
    }
    default:
      return ko(-32601, `Méthode non prise en charge : ${m.method}`)
  }
}
