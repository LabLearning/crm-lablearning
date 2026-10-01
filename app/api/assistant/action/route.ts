import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { executerAction } from '@/lib/assistant/actions-outils'
import { consignerResultat, controlerAction, lireResultat, reserverExecution, verifierProposition } from '@/lib/assistant/propositions'

// Certaines actions produisent et envoient des documents lourds (pack hygiène) :
// une coupure en cours de route laisserait des envois partis sans résultat consigné.
export const maxDuration = 300

/**
 * Exécution d'une action proposée par l'assistant, APRÈS confirmation
 * explicite de l'utilisateur dans l'interface.
 *
 * Le navigateur n'envoie que le jeton signé de la proposition : l'action et
 * ses paramètres sont ceux que le serveur a figés au moment de la proposition,
 * pour cet utilisateur et cette organisation. Avant d'exécuter, on revérifie
 * la permission propre à l'action et le périmètre de l'organisation, puis on
 * réserve l'exécution pour qu'une proposition ne parte qu'une fois.
 */
const ROLES_EQUIPE = ['super_admin', 'admin', 'gestionnaire', 'commercial', 'manager']

const refus = (statut: number, message: string) => NextResponse.json({ success: false, message }, { status: statut })

/** Réponse pour une proposition déjà confirmée : son résultat consigné, sans nouvelle exécution. */
const reponseConsignee = (deja: { statut: string; message?: string } | null) => {
  if (deja?.statut === 'executee') return NextResponse.json({ success: true, message: deja.message || 'Action déjà effectuée.' })
  if (deja?.statut === 'echec') return refus(409, deja.message || 'Cette action a déjà été tentée et a échoué : redemandez-la à Starkk.')
  return refus(409, 'Cette action est déjà en cours d’exécution.')
}

export async function POST(req: Request) {
  let session
  try {
    session = await getSession()
  } catch {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const { user, organization, permissions, impersonatedBy } = session
  if (!ROLES_EQUIPE.includes(user.role) || ['suspended', 'inactive'].includes((user as any).status)) {
    return NextResponse.json({ error: 'Accès réservé à l’équipe interne' }, { status: 403 })
  }

  const corps = await req.json().catch(() => null)
  if (typeof corps?.jeton !== 'string' || !corps.jeton) {
    return refus(400, 'Cette proposition date d’avant la mise à jour de sécurité : rechargez la page, puis redemandez-la à Starkk.')
  }

  const verification = verifierProposition(corps.jeton, { orgId: organization.id, userId: user.id })
  if (!verification.ok) return refus(verification.statut, verification.message)
  const proposition = verification.proposition

  // Déjà confirmée (nouvel essai après une coupure, second onglet) : on renvoie
  // ce qui a été consigné, avant de rejouer des contrôles que l'action
  // elle-même a pu rendre faux (une facture soldée n'est plus « payable »).
  const consigne = await lireResultat(proposition.id, organization.id)
  if (consigne) return reponseConsignee(consigne)

  // Revérifié au moment d'exécuter : le rôle, les droits ou les données ont
  // pu changer depuis la proposition.
  const controle = await controlerAction({ type: proposition.type, params: proposition.params, orgId: organization.id, user, permissions })
  if (!controle.ok) return refus(controle.statut, controle.message)

  // Le compte réellement connecté signe la ligne d'audit (comme logAudit) ;
  // en « se connecter en tant que », le compte emprunté est nommé à côté.
  const acteurId = impersonatedBy?.id || user.id
  const auNomDe = impersonatedBy
    ? [(user as any).first_name, (user as any).last_name].filter(Boolean).join(' ') || (user as any).email || user.id
    : undefined
  const reservation = await reserverExecution({ proposition, acteurId, auNomDe })
  if (reservation === 'erreur') return refus(503, 'Confirmation impossible pour le moment, réessayez dans un instant.')
  if (reservation === 'deja') {
    // Deux confirmations simultanées : l'autre a réservé, rien ne s'exécute ici
    return reponseConsignee(await lireResultat(proposition.id, organization.id))
  }

  let resultat: { success: boolean; message: string }
  try {
    resultat = await executerAction(proposition.type, proposition.params, organization.id, user.id)
  } catch (e) {
    console.error('[assistant/action]', e)
    resultat = { success: false, message: 'L’action a échoué de façon inattendue.' }
  }

  await consignerResultat({ proposition, auNomDe, resultat })
  return NextResponse.json(resultat)
}
