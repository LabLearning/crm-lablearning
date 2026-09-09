import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { OUTILS_ASSISTANT, executerOutil } from '@/lib/assistant/outils'
import { OUTILS_ACTIONS, NOMS_ACTIONS, type PropositionAction } from '@/lib/assistant/actions-outils'

export const maxDuration = 60

/**
 * Assistant CRM interne : boucle d'agent Claude avec outils de lecture du CRM.
 * Réservé à l'équipe (jamais aux comptes formateur/apprenant) ; chaque outil
 * est scopé sur l'organisation de la session — l'IA ne choisit pas l'org.
 */
const ROLES_EQUIPE = ['super_admin', 'admin', 'gestionnaire', 'commercial', 'manager']
const MODELE = 'claude-opus-5'
const MAX_TOURS = 6

export async function POST(req: Request) {
  let session
  try {
    session = await getSession()
  } catch {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const { user, organization } = session
  if (!ROLES_EQUIPE.includes(user.role)) {
    return NextResponse.json({ error: 'Accès réservé à l’équipe interne' }, { status: 403 })
  }
  const claudeKey = process.env.ANTHROPIC_API_KEY
  if (!claudeKey) return NextResponse.json({ error: 'Clé IA non configurée' }, { status: 500 })

  const corps = await req.json().catch(() => null)
  const historique: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(corps?.messages) ? corps.messages : []
  if (!historique.length || historique[historique.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Message manquant' }, { status: 400 })
  }

  // Contexte de page : l'entité que l'utilisateur regarde (session, client…)
  const { resoudreContexte } = await import('@/lib/assistant/contexte')
  const contexte = await resoudreContexte(typeof corps?.chemin === 'string' ? corps.chemin : null, organization.id).catch(() => null)

  const systeme = [
    `Tu es Starkk, l'assistant IA interne du CRM de ${organization.name}, un organisme de formation certifié Qualiopi (métiers de bouche et restauration).`,
    `Ton style : efficace et direct, avec une pointe d'esprit sobre à la Jarvis (le majordome brillant qui a toujours un coup d'avance) — jamais de familiarité avec les données ni de blabla.`,
    `Tu réponds à ${(user as any).first_name || 'un membre'} de l'équipe (rôle : ${user.role}). Nous sommes le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
    `RÈGLES :`,
    `- Pour toute question factuelle (une session, un client, un document, un chiffre), utilise TOUJOURS les outils avant de répondre. N'invente jamais une donnée ni un lien.`,
    `- Donne les liens en markdown : [Fiche de la session](/dashboard/sessions/xxx), [Convention signée (PDF)](/api/pdf/convention/xxx). L'utilisateur est connecté au CRM, les liens s'ouvrent directement.`,
    `- Réponds en français, court et précis. Dates au format « 28 juillet 2026 », montants en euros.`,
    `- Si une recherche ne donne rien, dis-le et propose une orthographe ou un angle différent.`,
    `- ACTIONS : tu disposes d'un large jeu d'actions action_* (envois de documents, relances, liens de signature, paiements, fiches client et apprenant, inscriptions, présences, statut de session, AGEFICE, attestations d'hygiène, pack hygiène, contrat et mission formateur, facture OPCO, accord de prise en charge, devis, création de session, relance des signatures). Tu les PROPOSES uniquement : elles ne s'exécutent JAMAIS directement, l'utilisateur les confirme d'un clic. Chaque action porte un libellé précis (qui, quoi, quel montant).`,
    `- PLANS : quand la demande couvre plusieurs étapes (« prépare la session », « clôture la session », « lance la facturation »), propose TOUTES les actions nécessaires dans la même réponse, dans l'ordre d'exécution : elles s'affichent comme un plan que l'utilisateur confirme en un clic (ou ligne par ligne). Vérifie d'abord l'état réel avec les outils de lecture pour ne proposer que ce qui manque (ne renvoie pas une convention déjà signée, n'inscris pas un stagiaire déjà inscrit). Annonce le plan en une ligne, sans paraphraser chaque action.`,
    contexte ? `- CONTEXTE DE PAGE : ${contexte.prompt}` : `- L'utilisateur n'est sur aucune fiche précise : demande ou recherche l'entité concernée avant d'agir.`,
    `- Vocabulaire : jamais d'emoji ni de tiret cadratin.`,
  ].join('\n')

  // Boucle d'agent : le modèle appelle les outils jusqu'à sa réponse finale.
  // Les outils action_* ne s'exécutent pas : ils deviennent des propositions
  // renvoyées au client, que l'utilisateur confirme d'un clic.
  const messages: any[] = historique.slice(-16)
  const propositions: PropositionAction[] = []
  try {
    for (let tour = 0; tour < MAX_TOURS; tour++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODELE,
          max_tokens: 2500,
          system: systeme,
          tools: [...OUTILS_ASSISTANT, ...OUTILS_ACTIONS],
          messages,
        }),
      })
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`)
      const rep = await r.json()
      const appels = (rep.content || []).filter((c: any) => c.type === 'tool_use')

      if (rep.stop_reason !== 'tool_use' || appels.length === 0) {
        // Réponse finale : ne garder que les blocs texte (jamais le thinking).
        const texte = (rep.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim()
        return NextResponse.json({ reponse: texte || 'Je n’ai pas de réponse à te donner sur ce point.', actions: propositions, contexte: contexte ? { type: contexte.type, libelle: contexte.libelle } : null })
      }

      messages.push({ role: 'assistant', content: rep.content })
      const resultats = await Promise.all(appels.map(async (a: any) => {
        if (NOMS_ACTIONS.has(a.name)) {
          propositions.push({ id: a.id, type: a.name, params: a.input || {}, libelle: a.input?.libelle || a.name })
          return {
            type: 'tool_result',
            tool_use_id: a.id,
            content: JSON.stringify({ statut: 'proposee', info: "L'action est affichée à l'utilisateur avec un bouton de confirmation. Elle ne sera exécutée que s'il confirme. Dis-lui simplement qu'elle attend sa confirmation." }),
          }
        }
        return {
          type: 'tool_result',
          tool_use_id: a.id,
          content: JSON.stringify(await executerOutil(a.name, a.input || {}, organization.id)).slice(0, 24000),
        }
      }))
      messages.push({ role: 'user', content: resultats })
    }
    return NextResponse.json({ reponse: 'La recherche est trop longue, reformule ta demande de façon plus précise.', actions: propositions })
  } catch (e: any) {
    console.error('[assistant]', e)
    return NextResponse.json({ error: 'L’assistant est indisponible pour le moment. Réessaie dans un instant.' }, { status: 500 })
  }
}
