'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { STATUTS_ACTIFS, JOURS_APRES_FIN } from '@/lib/formateur-sessions'

/**
 * Bornes de l'ajout direct : chaque ajout peut déclencher une convocation par
 * mail à l'adresse saisie et un avenant de convention. Au-delà, le formateur
 * passe par une déclaration de changement, que l'équipe valide.
 */
const AJOUTS_DIRECTS_PAR_SESSION = 20
const AJOUTS_DIRECTS_PAR_24H = 25

/** Champs du formulaire d'ajout : libellé et longueur maximale. */
const CHAMPS_AJOUT: Array<[string, string, number]> = [
  ['nom', 'Nom', 100],
  ['prenom', 'Prénom', 100],
  ['email', 'Adresse e-mail', 254],
  ['sexe', 'Sexe', 10],
  ['date_naissance', 'Date de naissance', 10],
  ['adresse', 'Adresse', 200],
  ['code_postal', 'Code postal', 10],
  ['ville', 'Ville', 100],
  ['type_contrat', 'Type de contrat', 60],
  ['numero_securite_sociale', 'N° de sécurité sociale', 30],
]

/**
 * Même périmètre que la liste « Mes apprenants » (lib/formateur-sessions) :
 * une session en cours ou à venir, ou terminée depuis moins de
 * JOURS_APRES_FIN jours. Jamais une session annulée.
 */
function sessionOuverteAuFormateur(sess: { status?: string | null; date_fin?: string | null }): boolean {
  if (sess.status && STATUTS_ACTIFS.includes(sess.status)) return true
  if (sess.status !== 'terminee' || !sess.date_fin) return false
  const limite = new Date()
  limite.setDate(limite.getDate() - JOURS_APRES_FIN)
  return String(sess.date_fin).slice(0, 10) >= limite.toISOString().slice(0, 10)
}

/**
 * Le formateur déclare un changement de participant (ajout / retrait / remplacement).
 * Crée une demande (ticket) que le gestionnaire devra valider. Ne modifie PAS
 * directement les inscriptions.
 */
export async function declareParticipantChangeAction(
  token: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const sessionId = formData.get('session_id') as string
  const type = formData.get('type') as string // ajout / retrait / remplacement
  if (!sessionId || !type) return { success: false, error: 'Informations manquantes' }

  // Vérifier que la session appartient bien au formateur
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id, reference, formateur_id, formation:formation_id(intitule)')
    .eq('id', sessionId)
    .single()
  if (!sess || sess.formateur_id !== context.formateur.id) {
    return { success: false, error: 'Session non autorisée' }
  }

  const apprenantId = (formData.get('apprenant_id') as string) || null
  const nouveauNom = (formData.get('nouveau_nom') as string || '').trim() || null
  const nouveauPrenom = (formData.get('nouveau_prenom') as string || '').trim() || null

  // Validation selon le type
  if ((type === 'retrait' || type === 'remplacement') && !apprenantId) {
    return { success: false, error: 'Sélectionnez le participant concerné' }
  }
  if ((type === 'ajout' || type === 'remplacement') && !nouveauNom) {
    return { success: false, error: 'Renseignez le nom du nouveau participant' }
  }

  const { data: demande, error } = await supabase
    .from('demandes_changement_participants')
    .insert({
      organization_id: sess.organization_id,
      session_id: sessionId,
      formateur_id: context.formateur.id,
      type,
      apprenant_id: apprenantId,
      nouveau_nom: nouveauNom,
      nouveau_prenom: nouveauPrenom,
      nouveau_email: (formData.get('nouveau_email') as string || '').trim() || null,
      nouveau_telephone: (formData.get('nouveau_telephone') as string || '').trim() || null,
      motif: (formData.get('motif') as string || '').trim() || null,
      statut: 'en_attente',
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Notifier les gestionnaires / admins
  try {
    const { createNotifications } = await import('@/lib/email')
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', sess.organization_id)
      .in('role', ['super_admin', 'gestionnaire'])
      .eq('status', 'active')
    const formationNom = (sess as any).formation?.intitule || sess.reference
    const formateurNom = `${context.formateur.prenom || ''} ${context.formateur.nom || ''}`.trim()
    const typeLabel = type === 'ajout' ? 'Ajout' : type === 'retrait' ? 'Retrait' : 'Remplacement'
    if (admins && admins.length > 0) {
      await createNotifications(
        admins.map((u: any) => ({
          organizationId: sess.organization_id,
          userId: u.id,
          titre: 'Changement de participant à valider',
          message: `${formateurNom} demande un ${typeLabel.toLowerCase()} de participant sur "${formationNom}".`,
          type: 'action',
          lienUrl: '/dashboard/changements',
          lienLabel: 'Valider la demande',
          entityType: 'demande_changement',
          entityId: demande.id,
        })),
      )
    }
  } catch (e) {
    console.error('[declare change notify]', e)
  }

  revalidatePath(`/portail/${token}/apprenants`)
  return { success: true }
}

/**
 * Le formateur ajoute directement un apprenant à une session qu'il anime.
 *
 * Contrairement à declareParticipantChangeAction (ticket à valider), c'est un
 * ajout immédiat : l'apprenant est créé (ou réutilisé si déjà présent chez le
 * client) puis inscrit. Autorisé uniquement sur une session dont le formateur
 * du token est bien le formateur, que son espace lui montre, et dans la
 * limite des plafonds ci-dessus. Chaque ajout est tracé dans le journal.
 */
export async function addApprenantBySessionFormateurAction(
  token: string,
  sessionId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }
  if (typeof (formData as any)?.get !== 'function') return { success: false, error: 'Informations manquantes' }
  const supabase = await createServiceRoleClient()

  // La session doit être animée par ce formateur
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id, client_id, formateur_id, status, date_fin')
    .eq('id', sessionId)
    .maybeSingle()
  if (!sess || sess.formateur_id !== context.formateur.id) {
    return { success: false, error: 'Session non autorisée' }
  }
  if (!sessionOuverteAuFormateur(sess)) {
    return { success: false, error: 'Cette session n\'accepte plus d\'ajout : adressez-vous à l\'équipe' }
  }

  const str = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v.trim() || null : null
  }
  const nom = str('nom')
  const prenom = str('prenom')
  if (!nom) return { success: false, error: 'Le nom est requis' }

  // Ces valeurs repartent dans les convocations, les feuilles et les avenants
  for (const [cle, libelle, max] of CHAMPS_AJOUT) {
    const v = str(cle)
    if (!v) continue
    if (v.length > max) return { success: false, error: `Champ « ${libelle} » trop long (${max} caractères au plus)` }
    if (/[<>]/.test(v)) return { success: false, error: `Champ « ${libelle} » : les caractères < et > ne sont pas acceptés` }
  }
  const email = str('email')
  if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(email)) {
    return { success: false, error: 'L\'adresse e-mail n\'est pas valide' }
  }

  const orgId = sess.organization_id
  const clientId = sess.client_id

  // Plafonds, comptés sur le journal des ajouts directs de ce formateur
  const depuis = new Date(Date.now() - 24 * 3600_000).toISOString()
  const ajoutsDuFormateur = () => supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('action', 'inscription')
    .eq('details->>formateur_id', context.formateur.id)
  const [{ count: surSession }, { count: surJour }] = await Promise.all([
    ajoutsDuFormateur().eq('entity_type', 'session').eq('entity_id', sessionId),
    ajoutsDuFormateur().gte('created_at', depuis),
  ])
  if ((surSession || 0) >= AJOUTS_DIRECTS_PAR_SESSION) {
    return { success: false, error: `Vous avez déjà ajouté ${AJOUTS_DIRECTS_PAR_SESSION} stagiaires à cette session : pour les suivants, déclarez un changement ou contactez l'équipe` }
  }
  if ((surJour || 0) >= AJOUTS_DIRECTS_PAR_24H) {
    return { success: false, error: `Vous avez ajouté ${AJOUTS_DIRECTS_PAR_24H} stagiaires en 24 heures : pour les suivants, déclarez un changement ou contactez l'équipe` }
  }

  // Déduplication : même prénom + nom déjà rattaché au client → on réutilise
  let apprenantId: string | null = null
  if (clientId) {
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    const { data: existants } = await supabase
      .from('apprenants')
      .select('id, prenom, nom')
      .eq('organization_id', orgId)
      .eq('client_id', clientId)
    const match = (existants || []).find((a: any) =>
      norm(a.nom || '') === norm(nom) && norm(a.prenom || '') === norm(prenom || ''),
    )
    if (match) apprenantId = match.id
  }

  if (!apprenantId) {
    const { data: created, error: cErr } = await supabase
      .from('apprenants')
      .insert({
        organization_id: orgId,
        client_id: clientId,
        prenom: prenom || nom,
        nom,
        email: str('email'),
        sexe: str('sexe'),
        date_naissance: str('date_naissance'),
        adresse: str('adresse'),
        code_postal: str('code_postal'),
        ville: str('ville'),
        type_contrat: str('type_contrat'),
        numero_securite_sociale: str('numero_securite_sociale'),
      })
      .select('id')
      .single()
    if (cErr || !created) return { success: false, error: 'Impossible de créer l\'apprenant' }
    apprenantId = created.id
  }

  // Inscrire (sans doublon d'inscription)
  const { data: dejaInscrit } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('apprenant_id', apprenantId)
    .maybeSingle()
  if (!dejaInscrit) {
    const { data: inscription, error: iErr } = await supabase
      .from('inscriptions')
      .insert({
        organization_id: orgId,
        session_id: sessionId,
        apprenant_id: apprenantId,
        status: 'inscrit',
      })
      .select('id')
      .single()
    if (iErr || !inscription) return { success: false, error: 'Impossible d\'inscrire l\'apprenant' }

    // Trace de l'ajout, au nom du formateur (sert aussi aux plafonds ci-dessus)
    const { data: fiche } = await supabase
      .from('formateurs')
      .select('user_id')
      .eq('id', context.formateur.id)
      .maybeSingle()
    const { error: jErr } = await supabase.from('audit_logs').insert({
      organization_id: orgId,
      user_id: fiche?.user_id || null,
      action: 'inscription',
      entity_type: 'session',
      entity_id: sessionId,
      details: {
        apprenant_id: apprenantId,
        session_id: sessionId,
        inscription_id: inscription.id,
        formateur_id: context.formateur.id,
        via: 'ajout_formateur',
      },
    })
    if (jErr) console.error('[ajout formateur] journal', jErr.message)

    // Convention déjà envoyée/signée ? → avenant automatique
    try {
      const { syncConventionAvenant } = await import('@/lib/convention-avenants')
      await syncConventionAvenant(supabase, sessionId, null)
    } catch (e) { console.error('[avenant formateur ajout]', e) }
    try { const { convoquerSiImminente } = await import('@/lib/convocations'); await convoquerSiImminente(supabase, sessionId, null) } catch { /* le cron rattrape */ }
  }

  revalidatePath(`/portail/${token}/apprenants`)
  revalidatePath(`/portail/${token}/emargement`)
  return { success: true }
}
