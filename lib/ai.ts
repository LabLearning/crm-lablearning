const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

interface AIResponse {
  success: boolean
  content: string
  error?: string
  /** La réponse a été coupée par la limite de tokens */
  truncated?: boolean
}

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { success: false, content: '', error: 'Clé API Anthropic non configurée' }
  }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const message = (err as any)?.error?.message || `Erreur API Claude (${res.status})`
      console.error('[callClaude] API', res.status, message)
      return { success: false, content: '', error: message }
    }

    const data = await res.json()
    // La réponse peut comporter plusieurs blocs : on les concatène plutôt que
    // de ne lire que le premier, sinon un préambule fait perdre le JSON
    const text = (data.content || [])
      .filter((b: any) => b?.type === 'text' && b.text)
      .map((b: any) => b.text)
      .join('')
    if (!text) {
      console.error('[callClaude] réponse vide', JSON.stringify(data).slice(0, 400))
      return { success: false, content: '', error: 'Réponse vide de l\'IA' }
    }
    // stop_reason = max_tokens → la réponse est tronquée, le JSON sera invalide
    if (data.stop_reason === 'max_tokens') {
      console.warn('[callClaude] réponse tronquée (max_tokens)')
    }
    return { success: true, content: text, truncated: data.stop_reason === 'max_tokens' }
  } catch (err) {
    console.error('[callClaude] réseau', err)
    return { success: false, content: '', error: 'Erreur réseau lors de l\'appel à l\'IA' }
  }
}

/**
 * Extrait un tableau JSON d'une réponse de modèle.
 * Le modèle peut entourer le JSON de texte ou de balises Markdown, et la
 * réponse peut être tronquée : on répare alors en fermant le tableau après
 * le dernier objet complet, plutôt que de tout perdre.
 */
function parseJsonArray(content: string): { ok: true; rows: any[] } | { ok: false; error: string } {
  let text = (content || '').trim()

  // Retire les clôtures Markdown ```json … ```
  text = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()

  const start = text.indexOf('[')
  if (start === -1) {
    // Certaines réponses encapsulent le tableau : {"participants": [...]}
    try {
      const obj = JSON.parse(text)
      const arr = Array.isArray(obj) ? obj : Object.values(obj).find(Array.isArray)
      if (Array.isArray(arr)) return { ok: true, rows: arr }
    } catch { /* on tombe dans l'erreur ci-dessous */ }
    console.error('[parseJsonArray] aucun tableau trouvé :', text.slice(0, 300))
    return { ok: false, error: 'L\'IA n\'a pas renvoyé de liste exploitable' }
  }

  const candidate = text.slice(start, text.lastIndexOf(']') + 1 || undefined)
  try {
    const parsed = JSON.parse(candidate)
    if (Array.isArray(parsed)) return { ok: true, rows: parsed }
  } catch { /* tentative de réparation ci-dessous */ }

  // Réponse tronquée : on conserve les objets complets
  const lastComplete = candidate.lastIndexOf('}')
  if (lastComplete > 0) {
    try {
      const repaired = JSON.parse(candidate.slice(0, lastComplete + 1) + ']')
      if (Array.isArray(repaired) && repaired.length > 0) {
        console.warn('[parseJsonArray] réponse tronquée, réparée avec', repaired.length, 'entrées')
        return { ok: true, rows: repaired }
      }
    } catch { /* échec définitif */ }
  }

  console.error('[parseJsonArray] JSON illisible :', candidate.slice(0, 300))
  return { ok: false, error: 'Réponse de l\'IA illisible' }
}

// ── Génération de QCM ─────────────────────────────────────

interface GeneratedQuestion {
  question: string
  reponses: { texte: string; est_correcte: boolean }[]
  explication: string
}

export async function generateQCMQuestions(params: {
  formationTitle: string
  theme: string
  niveau: 'debutant' | 'intermediaire' | 'avance'
  nbQuestions: number
}): Promise<{ success: boolean; questions: GeneratedQuestion[]; error?: string }> {
  const systemPrompt = `Tu es un expert en ingénierie pédagogique pour la formation professionnelle dans les métiers de la restauration, boucherie, boulangerie, pâtisserie et hôtellerie. Tu génères des QCM de qualité professionnelle conformes aux exigences Qualiopi.

Règles strictes :
- Chaque question a exactement 4 réponses possibles
- Une seule réponse correcte par question
- Les questions doivent être claires, précises et professionnelles
- Les mauvaises réponses doivent être plausibles
- Chaque question a une explication pédagogique
- Le contenu doit être factuel et conforme à la réglementation française
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après`

  const userPrompt = `Génère ${params.nbQuestions} questions QCM pour la formation "${params.formationTitle}" sur le thème "${params.theme}".
Niveau : ${params.niveau}

Réponds en JSON avec ce format exact :
[
  {
    "question": "La question ici ?",
    "reponses": [
      {"texte": "Réponse A", "est_correcte": false},
      {"texte": "Réponse B", "est_correcte": true},
      {"texte": "Réponse C", "est_correcte": false},
      {"texte": "Réponse D", "est_correcte": false}
    ],
    "explication": "Explication de la bonne réponse"
  }
]`

  const result = await callClaude(systemPrompt, userPrompt)
  if (!result.success) {
    return { success: false, questions: [], error: result.error }
  }

  try {
    // Extraire le JSON du contenu (au cas où il y a du texte autour)
    const jsonMatch = result.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { success: false, questions: [], error: 'Réponse IA invalide' }
    }
    const questions = JSON.parse(jsonMatch[0]) as GeneratedQuestion[]
    return { success: true, questions }
  } catch {
    return { success: false, questions: [], error: 'Erreur de parsing JSON' }
  }
}

// ── Génération de programme de formation ───────────────────

interface ProgrammeModule {
  titre: string
  duree: string
  objectifs: string[]
  contenu: string[]
}

interface GeneratedProgramme {
  objectif_general: string
  public_cible: string
  prerequis: string
  modules: ProgrammeModule[]
  modalites_evaluation: string[]
  moyens_pedagogiques: string[]
}

export async function generateProgrammeFormation(params: {
  intitule: string
  categorie: string
  duree_heures: number
  modalite: string
}): Promise<{ success: boolean; programme: GeneratedProgramme | null; error?: string }> {
  const systemPrompt = `Tu es un ingénieur pédagogique expert en formation professionnelle dans les métiers de bouche (restauration, boucherie, boulangerie, pâtisserie, hôtellerie). Tu crées des programmes de formation conformes aux exigences Qualiopi et aux référentiels métier.

Règles :
- Programme structuré en modules avec durées, objectifs et contenu détaillé
- Conforme à la réglementation française (HACCP, hygiène, sécurité)
- Objectifs pédagogiques formulés avec des verbes d'action (être capable de...)
- Modalités d'évaluation variées (QCM, mise en situation, exercices pratiques)
- Adapté à la durée totale indiquée
- Réponds UNIQUEMENT en JSON valide`

  const userPrompt = `Génère un programme de formation complet pour :
- Intitulé : "${params.intitule}"
- Catégorie : ${params.categorie}
- Durée : ${params.duree_heures} heures
- Modalité : ${params.modalite}

Réponds en JSON avec ce format exact :
{
  "objectif_general": "L'objectif général de la formation",
  "public_cible": "Description du public visé",
  "prerequis": "Les prérequis nécessaires",
  "modules": [
    {
      "titre": "Module 1 : Titre",
      "duree": "3h",
      "objectifs": ["Objectif 1", "Objectif 2"],
      "contenu": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "modalites_evaluation": ["QCM de validation", "Mise en situation pratique"],
  "moyens_pedagogiques": ["Support de cours", "Exercices pratiques"]
}`

  const result = await callClaude(systemPrompt, userPrompt)
  if (!result.success) {
    return { success: false, programme: null, error: result.error }
  }

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, programme: null, error: 'Réponse IA invalide' }
    }
    const programme = JSON.parse(jsonMatch[0]) as GeneratedProgramme
    return { success: true, programme }
  } catch {
    return { success: false, programme: null, error: 'Erreur de parsing JSON' }
  }
}

// ── Extraction d'un programme depuis un PDF ───────────────

export interface ExtractedFormation {
  intitule?: string
  sous_titre?: string
  categorie?: string
  modalite?: 'presentiel' | 'distanciel' | 'mixte'
  duree_heures?: number
  duree_jours?: number
  objectifs_pedagogiques?: string[]
  competences_visees?: string[]
  prerequis?: string
  public_vise?: string
  programme_detaille?: string
  methodes_pedagogiques?: string
  moyens_techniques?: string
  modalites_evaluation?: string
  modalites_admission?: string
  accessibilite_handicap?: string
}

/**
 * Envoie un PDF de programme à Claude et récupère les champs structurés
 * d'une formation, prêts à pré-remplir le formulaire du CRM.
 */
export async function extractFormationFromPdf(
  pdfBase64: string,
): Promise<{ success: boolean; formation: ExtractedFormation | null; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { success: false, formation: null, error: 'Clé API Anthropic non configurée' }

  const systemPrompt = `Tu es un assistant qui analyse des programmes de formation professionnelle (PDF) pour un organisme certifié Qualiopi. Tu extrais fidèlement les informations et les renvoies en JSON strict. N'invente rien : si une information est absente du document, omets le champ (ne le renvoie pas). Reformule le moins possible ; recopie le contenu du PDF.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, avec ces clés (toutes optionnelles) :
{
  "intitule": "Intitulé exact de la formation",
  "sous_titre": "Sous-titre éventuel",
  "categorie": "Catégorie / domaine",
  "modalite": "presentiel | distanciel | mixte",
  "duree_heures": nombre,
  "duree_jours": nombre,
  "objectifs_pedagogiques": ["objectif 1", "objectif 2"],
  "competences_visees": ["compétence 1"],
  "prerequis": "texte (ou 'Aucun prérequis' si mentionné)",
  "public_vise": "texte",
  "programme_detaille": "programme complet en texte multi-lignes ; garde les journées/modules et leurs contenus, une ligne par point",
  "methodes_pedagogiques": "texte",
  "moyens_techniques": "texte",
  "modalites_evaluation": "texte",
  "modalites_admission": "texte",
  "accessibilite_handicap": "texte"
}`

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Analyse ce programme de formation et renvoie le JSON structuré.' },
          ],
        }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, formation: null, error: err.error?.message || `Erreur API Claude (${res.status})` }
    }
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: false, formation: null, error: 'Réponse IA invalide' }
    const formation = JSON.parse(jsonMatch[0]) as ExtractedFormation
    return { success: true, formation }
  } catch (e: any) {
    return { success: false, formation: null, error: 'Erreur réseau ou parsing (' + (e?.message || '') + ')' }
  }
}

// ── Extraction de participants depuis un texte libre ───────

export interface ExtractedParticipant {
  civilite?: string
  prenom?: string
  nom?: string
  email?: string
  telephone?: string
  date_naissance?: string
  lieu_naissance?: string
  numero_securite_sociale?: string
  adresse?: string
  code_postal?: string
  ville?: string
  type_contrat?: string
  niveau_diplome?: string
  poste?: string
}

const CONTRAT_VALUES = ['Dirigeant', 'CDI', 'CDD', 'Intérim', 'Alternance', 'Stage', "Demandeur d'emploi", 'Autre']

const MOIS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Ramène une date au format ISO. L'IA renvoie souvent la date telle qu'écrite
 * dans le texte source ; on couvre donc 12/03/1990, 12-03-90 et 3 janvier 1995.
 * Une année sur 2 chiffres > année courante est considérée comme 19xx.
 */
export function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined
  const value = raw.trim()
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const expandYear = (y: string) => {
    if (y.length === 4) return Number(y)
    const n = Number(y)
    const pivot = new Date().getFullYear() % 100
    return n > pivot ? 1900 + n : 2000 + n
  }
  const build = (y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return undefined
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const numeric = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/)
  if (numeric) return build(expandYear(numeric[3]), Number(numeric[2]), Number(numeric[1]))

  const textual = stripAccents(value.toLowerCase()).match(/^(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{2}|\d{4})$/)
  if (textual) {
    const mois = MOIS_FR[textual[2]]
    if (mois) return build(expandYear(textual[3]), mois, Number(textual[1]))
  }
  return undefined
}

export function normalizeNir(raw?: string): string | undefined {
  if (!raw) return undefined
  const digits = raw.replace(/[\s.\-]/g, '').toUpperCase()
  return digits ? digits : undefined
}

export function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined
  let value = raw.replace(/[\s.\-()]/g, '')
  if (!value) return undefined
  if (value.startsWith('+33')) value = '0' + value.slice(3)
  else if (value.startsWith('0033')) value = '0' + value.slice(4)
  return value
}

function cleanParticipant(p: ExtractedParticipant): ExtractedParticipant {
  const trim = (v?: string) => {
    const s = (v || '').trim()
    return s ? s : undefined
  }
  const contrat = trim(p.type_contrat)
  const matchedContrat = contrat
    ? CONTRAT_VALUES.find((c) => stripAccents(c.toLowerCase()) === stripAccents(contrat.toLowerCase())) || 'Autre'
    : undefined
  return {
    civilite: trim(p.civilite),
    prenom: trim(p.prenom),
    nom: trim(p.nom),
    email: trim(p.email)?.toLowerCase(),
    telephone: normalizePhone(p.telephone),
    date_naissance: normalizeDate(p.date_naissance),
    lieu_naissance: trim(p.lieu_naissance),
    numero_securite_sociale: normalizeNir(p.numero_securite_sociale),
    adresse: trim(p.adresse),
    code_postal: trim(p.code_postal),
    ville: trim(p.ville),
    type_contrat: matchedContrat,
    niveau_diplome: trim(p.niveau_diplome),
    poste: trim(p.poste),
  }
}

/**
 * Analyse un bloc de texte libre (mail, tableau collé, WhatsApp…) et en extrait
 * la liste des participants. Rien n'est enregistré : le résultat est destiné à
 * une prévisualisation éditable côté client.
 */
export async function extractParticipantsFromText(
  rawText: string,
): Promise<{ success: boolean; participants: ExtractedParticipant[]; error?: string }> {
  const text = (rawText || '').trim()
  if (!text) return { success: false, participants: [], error: 'Texte vide' }

  const systemPrompt = `Tu es un assistant qui extrait des listes de participants à une formation professionnelle depuis du texte libre (email, tableau copié, message WhatsApp, extrait de PDF) pour un organisme de formation certifié Qualiopi.

Règles strictes :
- N'invente JAMAIS une information : si un champ est absent du texte, omets-le (ne renvoie pas la clé).
- Une entrée par personne, dans l'ordre du texte. Ignore les lignes qui ne décrivent pas une personne (titres, salutations, signatures).
- Sépare correctement prénom et nom. Dans les listes de formation, le NOM est souvent en majuscules et le prénom en casse normale (ex : "Hayat AYTEKIN" → prenom "Hayat", nom "AYTEKIN"). Sans indice, considère le premier mot comme le prénom.
- "date_naissance" doit être au format ISO YYYY-MM-DD. Convertis toi-même "12/03/1990" (jour/mois/année), "3 janvier 1995" ou "12-03-90".
- "numero_securite_sociale" sans espaces ni tirets.
- "telephone" au format français avec indicatif 0 (ex : 0612345678).
- "type_contrat" doit valoir exactement une de ces valeurs : ${CONTRAT_VALUES.join(', ')}. Fais correspondre les synonymes ("apprentissage", "contrat pro" → Alternance ; "chômage", "Pôle emploi", "France Travail" → Demandeur d'emploi ; "gérant", "patron" → Dirigeant). Si aucune ne correspond, omets le champ.
- "civilite" vaut "M." ou "Mme" uniquement si le texte le précise (Monsieur/Madame, "né"/"née").
- "lieu_naissance" est une ville de naissance, à ne pas confondre avec "ville" (ville de résidence de l'adresse).

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, chaque élément ayant ces clés optionnelles :
[{"civilite":"","prenom":"","nom":"","email":"","telephone":"","date_naissance":"","lieu_naissance":"","numero_securite_sociale":"","adresse":"","code_postal":"","ville":"","type_contrat":"","niveau_diplome":"","poste":""}]`

  const userPrompt = `Extrais les participants de ce texte. Réponds uniquement par le tableau JSON, sans phrase d'introduction ni balise Markdown.\n\n"""\n${text}\n"""`

  // Une fiche complète pèse ~150 tokens : on dimensionne sur la taille du
  // texte collé pour éviter les réponses coupées sur les longues listes
  const maxTokens = Math.min(16000, Math.max(4096, Math.ceil(text.length / 2)))

  const result = await callClaude(systemPrompt, userPrompt, maxTokens)
  if (!result.success) {
    return { success: false, participants: [], error: result.error || 'L\'IA n\'a pas répondu' }
  }

  const parsed = parseJsonArray(result.content)
  if (!parsed.ok) {
    return { success: false, participants: [], error: parsed.error }
  }

  // On garde uniquement les entrées identifiables ; le reste est du bruit.
  const participants = parsed.rows
    .filter((p) => p && typeof p === 'object')
    .map((p) => cleanParticipant(p as ExtractedParticipant))
    .filter((p) => p.nom || p.prenom)

  if (participants.length === 0) {
    return {
      success: false,
      participants: [],
      error: 'Aucun participant identifié dans ce texte. Vérifiez qu\'il contient bien des noms de personnes.',
    }
  }

  if (result.truncated) {
    return {
      success: true,
      participants,
      error: `Liste trop longue : seuls les ${participants.length} premiers participants ont pu être lus. Collez le reste en une seconde fois.`,
    }
  }

  return { success: true, participants }
}
