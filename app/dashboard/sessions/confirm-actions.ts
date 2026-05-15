'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { randomBytes, createHash } from 'crypto'
import type { ActionResult } from '@/lib/types'

function newToken() {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
}

/**
 * Bouton "Confirmer la session" :
 * - Status session → 'en_attente_signatures'
 * - Crée le contrat formateur en brouillon avec token signature
 * - Génère token signature pour la convention si pas déjà fait
 * - Envoie 2 emails : convention au client + contrat au formateur
 */
export async function confirmSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Charger la session avec ses relations
  const { data: sess } = await supabase
    .from('sessions')
    .select(`
      id, organization_id, status, formateur_id, mission_status, client_id,
      date_debut, date_fin, lieu, cout_formateur,
      formation:formation_id(intitule, duree_jours, duree_heures),
      formateur:formateurs(prenom, nom, email, tarif_journalier),
      client:clients(raison_sociale, email)
    `)
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!sess) return { success: false, error: 'Session introuvable' }
  if (!sess.formateur_id) return { success: false, error: 'Aucun formateur attribué à cette session' }
  if (sess.mission_status !== 'accepted') {
    return { success: false, error: 'Le formateur doit d\'abord accepter la mission' }
  }
  if (sess.status === 'en_attente_signatures' || sess.status === 'validee') {
    return { success: false, error: 'Session déjà confirmée' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  // ── 1. Mettre à jour la session ──
  await supabase
    .from('sessions')
    .update({
      status: 'en_attente_signatures',
      confirmed_at: new Date().toISOString(),
      confirmed_by: session.user.id,
    })
    .eq('id', sessionId)

  // ── Seed des tâches formateur (check-list de fin de session) ──
  if (sess.formateur_id) {
    const { seedTachesFormateur } = await import('@/lib/taches-formateur')
    await seedTachesFormateur(supabase, sessionId, sess.formateur_id, sess.organization_id)
  }

  // ── Seed QCM positionnement + évaluation entrée pour les apprenants ──
  const { seedQcmReponsesForSession, notifyApprenantsForQcm } = await import('@/lib/qcm-auto-seed')
  for (const t of ['positionnement', 'entree'] as const) {
    const r = await seedQcmReponsesForSession(supabase, sessionId, t)
    if (r.created > 0) await notifyApprenantsForQcm(supabase, sessionId, t)
  }

  // ── 2. Convention : générer un token de signature si manquant ──
  const { data: convention } = await supabase
    .from('conventions')
    .select('id, signature_token, status')
    .eq('session_id', sessionId)
    .maybeSingle()

  let convToken = convention?.signature_token
  if (convention && !convToken) {
    convToken = newToken()
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    await supabase
      .from('conventions')
      .update({
        signature_token: convToken,
        signature_token_expires_at: expires.toISOString(),
        status: 'envoyee',
        sent_at: new Date().toISOString(),
      })
      .eq('id', convention.id)
  }

  // ── 3. Contrat formateur : créer ou réutiliser ──
  const { data: existingContrat } = await supabase
    .from('contrats_formateur')
    .select('id, signature_token')
    .eq('session_id', sessionId)
    .maybeSingle()

  let contratId = existingContrat?.id
  let contratToken = existingContrat?.signature_token

  if (!contratId) {
    const { count: contratCount } = await supabase
      .from('contrats_formateur')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', sess.organization_id)
    const numero = `CT-${new Date().getFullYear()}-${String((contratCount || 0) + 1).padStart(3, '0')}`

    const formateur = (sess as any).formateur
    const tarif = formateur?.tarif_journalier || null
    const duree = (sess as any).formation?.duree_jours || null
    const montantHt = (tarif && duree) ? Number(tarif) * Number(duree) : (sess.cout_formateur || null)

    contratToken = newToken()
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)

    const { data: contrat } = await supabase
      .from('contrats_formateur')
      .insert({
        organization_id: sess.organization_id,
        session_id: sessionId,
        formateur_id: sess.formateur_id,
        numero,
        status: 'envoye',
        tarif_journalier: tarif,
        nombre_jours: duree,
        montant_ht: montantHt,
        signature_token: contratToken,
        signature_token_expires_at: expires.toISOString(),
        sent_at: new Date().toISOString(),
        created_by: session.user.id,
      })
      .select()
      .single()
    contratId = contrat?.id
  }

  // ── 4. Envoyer les 2 emails ──
  try {
    const { sendTemplateEmail, createNotification } = await import('@/lib/email')
    const formationName = (sess as any).formation?.intitule || 'Formation'
    const dateRange = `du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin).toLocaleDateString('fr-FR')}`

    // Email au client → convention
    const clientEmail = (sess as any).client?.email
    if (clientEmail && convToken) {
      await sendTemplateEmail({
        to: clientEmail,
        subject: `Convention de formation à signer — ${formationName}`,
        html: emailConventionHtml({
          orgName: session.organization.name,
          clientName: (sess as any).client?.raison_sociale || '',
          formationName,
          dateRange,
          signUrl: `${appUrl}/convention/${convToken}/signer`,
        }),
      })
    }

    // Email au formateur → contrat
    const formateur = (sess as any).formateur
    if (formateur?.email && contratToken) {
      await sendTemplateEmail({
        to: formateur.email,
        subject: `Contrat de prestation à signer — ${formationName}`,
        html: emailContratFormateurHtml({
          orgName: session.organization.name,
          formateurName: `${formateur.prenom} ${formateur.nom}`,
          formationName,
          dateRange,
          signUrl: `${appUrl}/contrat-formateur/${contratToken}/signer`,
        }),
      })

      // Notif in-app si formateur a un compte
      const { data: formateurUser } = await supabase
        .from('formateurs').select('user_id').eq('id', sess.formateur_id).single()
      if (formateurUser?.user_id) {
        await createNotification({
          organizationId: sess.organization_id,
          userId: formateurUser.user_id,
          titre: 'Contrat de prestation à signer',
          message: `Votre contrat pour la mission "${formationName}" est prêt à signer.`,
          type: 'session',
          lienUrl: `${appUrl}/contrat-formateur/${contratToken}/signer`,
          lienLabel: 'Signer le contrat',
          entityType: 'session',
          entityId: sessionId,
        })
      }
    }
  } catch (e) {
    console.error('[Confirm Session — emails]', e)
  }

  await logAudit({ action: 'confirm_session', entity_type: 'session', entity_id: sessionId })
  revalidatePath('/dashboard/sessions')
  revalidatePath('/dashboard/conventions')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────
// Templates email simples (HTML inline, branding Lab Learning)
// ─────────────────────────────────────────────────────────────────────

function emailConventionHtml(p: { orgName: string; clientName: string; formationName: string; dateRange: string; signUrl: string }): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1C1917">
  <div style="background:#195144;color:white;padding:20px;border-radius:12px;margin-bottom:24px">
    <h1 style="margin:0;font-size:20px">Convention de formation à signer</h1>
  </div>
  <p>Bonjour <strong>${p.clientName}</strong>,</p>
  <p>${p.orgName} vous transmet la convention de formation pour la session :</p>
  <ul>
    <li><strong>${p.formationName}</strong></li>
    <li>Période : ${p.dateRange}</li>
  </ul>
  <p>Merci de cliquer sur le bouton ci-dessous pour consulter et signer la convention. Le lien est valable 30 jours.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="${p.signUrl}" style="background:#195144;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Signer la convention</a>
  </p>
  <p style="font-size:12px;color:#888">Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="word-break:break-all">${p.signUrl}</span></p>
  </body></html>`
}

function emailContratFormateurHtml(p: { orgName: string; formateurName: string; formationName: string; dateRange: string; signUrl: string }): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1C1917">
  <div style="background:#195144;color:white;padding:20px;border-radius:12px;margin-bottom:24px">
    <h1 style="margin:0;font-size:20px">Contrat de prestation à signer</h1>
  </div>
  <p>Bonjour <strong>${p.formateurName}</strong>,</p>
  <p>${p.orgName} vous transmet le contrat de prestation pour la mission que vous avez acceptée :</p>
  <ul>
    <li><strong>${p.formationName}</strong></li>
    <li>Période : ${p.dateRange}</li>
  </ul>
  <p>Merci de signer électroniquement votre contrat en cliquant ci-dessous (valable 30 jours) :</p>
  <p style="text-align:center;margin:32px 0">
    <a href="${p.signUrl}" style="background:#195144;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Signer le contrat</a>
  </p>
  <p style="font-size:12px;color:#888">Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="word-break:break-all">${p.signUrl}</span></p>
  </body></html>`
}

// ─────────────────────────────────────────────────────────────────────
// Action publique : signer le contrat formateur (page /contrat-formateur/[token]/signer)
// ─────────────────────────────────────────────────────────────────────

export async function signContratFormateurPublicAction(
  token: string,
  data: { nom: string; signatureDataUrl: string },
  meta: { ip?: string; userAgent?: string },
): Promise<ActionResult> {
  if (!data.nom?.trim()) return { success: false, error: 'Nom requis' }
  if (!data.signatureDataUrl?.startsWith('data:image/')) return { success: false, error: 'Signature manquante' }

  const supabase = await createServiceRoleClient()
  const { data: contrat } = await supabase
    .from('contrats_formateur')
    .select('id, organization_id, session_id, signature_token_expires_at, status, created_by')
    .eq('signature_token', token)
    .single()
  if (!contrat) return { success: false, error: 'Lien invalide' }
  if (contrat.signature_token_expires_at && new Date(contrat.signature_token_expires_at) < new Date()) {
    return { success: false, error: 'Lien expiré' }
  }
  if (['signe_formateur', 'signe_complete'].includes(contrat.status)) {
    return { success: false, error: 'Contrat déjà signé' }
  }

  const now = new Date().toISOString()
  await supabase
    .from('contrats_formateur')
    .update({
      status: 'signe_formateur',
      signature_formateur_date: now,
      signature_formateur_nom: data.nom.trim(),
      signature_formateur_signature_data: data.signatureDataUrl,
      signature_formateur_ip: meta.ip || null,
      signature_formateur_user_agent: meta.userAgent || null,
    })
    .eq('id', contrat.id)

  // Si la convention a aussi été signée par le client → bascule la session en validee
  await maybeValidateSession(supabase, contrat.session_id, contrat.organization_id)

  // Notif au gestionnaire
  if (contrat.created_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: contrat.organization_id,
      userId: contrat.created_by,
      titre: 'Contrat formateur signé',
      message: `${data.nom.trim()} a signé le contrat de prestation.`,
      type: 'session',
      lienUrl: `/dashboard/sessions/${contrat.session_id}`,
      lienLabel: 'Voir la session',
      entityType: 'session',
      entityId: contrat.session_id,
    })
  }

  await logAudit({ action: 'sign_contrat_formateur', entity_type: 'contrat_formateur', entity_id: contrat.id, details: { signataire: data.nom } })
  return { success: true, data: { contratId: contrat.id } }
}

/** Si convention signee_client ET contrat signe_formateur → session 'validee' + dossier OPCO auto */
export async function maybeValidateSession(supabase: any, sessionId: string, organizationId: string) {
  const { data: conv } = await supabase
    .from('conventions').select('status').eq('session_id', sessionId).maybeSingle()
  const { data: contrat } = await supabase
    .from('contrats_formateur').select('status').eq('session_id', sessionId).maybeSingle()

  const convOK = conv && ['signee_client', 'signee_complete'].includes(conv.status)
  const contratOK = contrat && ['signe_formateur', 'signe_complete'].includes(contrat.status)

  if (!convOK || !contratOK) return

  await supabase
    .from('sessions')
    .update({ status: 'validee', validated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('organization_id', organizationId)

  // ── Création auto du dossier de financement OPCO si client + financeur OPCO ──
  await maybeCreateDossierOpco(supabase, sessionId, organizationId)
}

/**
 * Crée un dossier_formation avec workflow OPCO si :
 *   - La session est liée à un client
 *   - Ce client a un opco_id et financeur_type = 'opco'
 *   - Aucun dossier n'existe déjà pour cette session
 */
async function maybeCreateDossierOpco(supabase: any, sessionId: string, organizationId: string) {
  // Vérifier qu'il n'y a pas déjà un dossier pour cette session
  const { data: existing } = await supabase
    .from('dossiers_formation').select('id').eq('session_id', sessionId).maybeSingle()
  if (existing) return

  // Récupérer la session avec son client
  const { data: sess } = await supabase
    .from('sessions')
    .select(`
      id, client_id, formation_id, formateur_id,
      date_debut, date_fin, cout_formateur,
      client:clients(raison_sociale, opco_id, financeur_type, opco_compte_status, numero_opco),
      formation:formation_id(intitule, tarif_inter_ht, tarif_intra_ht, taux_tva)
    `)
    .eq('id', sessionId)
    .maybeSingle()
  if (!sess) return

  const client = (sess as any).client
  if (!client?.opco_id || client.financeur_type !== 'opco') return  // Pas un dossier OPCO

  // Compter inscriptions actives pour montant
  const { count: nbApprenants } = await supabase
    .from('inscriptions').select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')

  const formation = (sess as any).formation
  const tarif = formation?.tarif_intra_ht || formation?.tarif_inter_ht || 0
  const montantHt = tarif * (nbApprenants || 1)
  const tauxTva = formation?.taux_tva || 20
  const montantTtc = montantHt * (1 + tauxTva / 100)

  const { count: dossierCount } = await supabase
    .from('dossiers_formation').select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
  const numero = `DOSS-${new Date().getFullYear()}-${String((dossierCount || 0) + 1).padStart(3, '0')}`

  // Le statut OPCO dépend du statut compte client
  const opcoStatus = client.opco_compte_status === 'actif' ? 'pret_a_envoyer' : 'a_constituer'

  await supabase.from('dossiers_formation').insert({
    organization_id: organizationId,
    numero,
    session_id: sessionId,
    formation_id: sess.formation_id,
    client_id: sess.client_id,
    status: 'convention_signee',
    opco_id: client.opco_id,
    opco_workflow_status: opcoStatus,
    financeur_type: 'opco',
    financeur_nom: client.numero_opco || null,
    montant_total_ht: montantHt,
    montant_total_ttc: montantTtc,
    date_creation: new Date().toISOString().split('T')[0],
    date_convention: new Date().toISOString().split('T')[0],
    date_debut_formation: sess.date_debut,
    date_fin_formation: sess.date_fin,
  })
}
