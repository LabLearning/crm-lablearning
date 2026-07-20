const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

interface AIResponse {
  success: boolean
  content: string
  error?: string
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<AIResponse> {
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
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return { success: false, content: '', error: err.error?.message || 'Erreur API Claude' }
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    return { success: true, content: text }
  } catch (err) {
    return { success: false, content: '', error: 'Erreur réseau' }
  }
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
