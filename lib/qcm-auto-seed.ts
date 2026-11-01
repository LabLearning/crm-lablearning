/**
 * Auto-création des qcm_reponses pour les apprenants d'une session
 * en fonction du moment du cycle :
 *   - confirmation session → 'positionnement'
 *   - fin de session (terminee) → 'sortie' + 'satisfaction_chaud'
 *   - J+90 après fin session → 'satisfaction_froid' (via cron)
 *
 * Requiert que des QCM de chaque type existent pour la formation
 * (créés dans /dashboard/qcm).
 */

import { typesRemplaces, typesRemplacesOrg } from '@/lib/qcm-autolink'

export type QcmType = 'positionnement' | 'entree' | 'sortie' | 'satisfaction_chaud' | 'satisfaction_froid'

export async function seedQcmReponsesForSession(
  supabase: any,
  sessionId: string,
  qcmType: QcmType,
) {
  // 1. Trouver la session + ses inscriptions actives
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id, formation_id')
    .eq('id', sessionId)
    .single()
  if (!sess?.formation_id) return { created: 0 }
  // La session a son propre questionnaire de ce type (lib/qcm-autolink) : rien à préparer
  if ((await typesRemplaces(supabase, sessionId)).has(qcmType)) return { created: 0 }

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  const apprenantIds = (inscriptions || []).map((i: any) => i.apprenant_id).filter(Boolean)
  if (apprenantIds.length === 0) return { created: 0 }

  // 2. Trouver les QCM du type demandé liés à la formation
  const { data: qcms } = await supabase
    .from('qcm')
    .select('id')
    .eq('organization_id', sess.organization_id)
    .eq('formation_id', sess.formation_id)
    .eq('type', qcmType)
    .eq('status', 'publie')

  if (!qcms || qcms.length === 0) return { created: 0 }  // Pas de QCM configuré pour ce type

  // 3. Pour chaque QCM × apprenant, créer une qcm_reponses si elle n'existe pas
  let created = 0
  for (const qcm of qcms) {
    // Vérifier les réponses déjà existantes pour ce QCM × ces apprenants
    const { data: existing } = await supabase
      .from('qcm_reponses')
      .select('apprenant_id')
      .eq('qcm_id', qcm.id)
      .in('apprenant_id', apprenantIds)

    const existingSet = new Set((existing || []).map((e: any) => e.apprenant_id))
    const toCreate = apprenantIds.filter((aid: string) => !existingSet.has(aid))
    if (toCreate.length === 0) continue

    const rows = toCreate.map((aid: string) => ({
      organization_id: sess.organization_id,
      qcm_id: qcm.id,
      apprenant_id: aid,
      session_id: sessionId,
      is_complete: false,
    }))
    const { error } = await supabase.from('qcm_reponses').insert(rows)
    if (!error) created += rows.length
  }

  return { created }
}

/**
 * Sème les qcm_reponses pour un QCM précis (choisi manuellement dans la banque)
 * rattaché à une session. Idempotent : ne recrée pas une réponse déjà existante.
 * Contrairement à seedQcmReponsesForSession (qui cherche par type), on cible un qcmId.
 */
export async function seedQcmReponsesForQcm(
  supabase: any,
  sessionId: string,
  qcmId: string,
  qcmSessionId?: string | null,
) {
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id')
    .eq('id', sessionId)
    .single()
  if (!sess) return { created: 0 }

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  const apprenantIds = (inscriptions || []).map((i: any) => i.apprenant_id).filter(Boolean)
  if (apprenantIds.length === 0) return { created: 0 }

  const { data: existing } = await supabase
    .from('qcm_reponses')
    .select('apprenant_id')
    .eq('qcm_id', qcmId)
    .eq('session_id', sessionId)
    .in('apprenant_id', apprenantIds)

  const existingSet = new Set((existing || []).map((e: any) => e.apprenant_id))
  const toCreate = apprenantIds.filter((aid: string) => !existingSet.has(aid))
  if (toCreate.length === 0) return { created: 0 }

  const rows = toCreate.map((aid: string) => ({
    organization_id: sess.organization_id,
    qcm_id: qcmId,
    qcm_session_id: qcmSessionId || null,
    apprenant_id: aid,
    session_id: sessionId,
    is_complete: false,
  }))
  const { error } = await supabase.from('qcm_reponses').insert(rows)
  if (error) return { created: 0, error: error.message }
  return { created: rows.length }
}

// Le parcours retenu : positionnement (début) → évaluation des acquis (fin)
// → satisfaction à chaud (fin) → satisfaction à froid (J+90).
// Le type « entree » (évaluation diagnostique) faisait doublon avec le
// positionnement : il n'est plus rattaché aux nouvelles sessions.
// L'évaluation des acquis est préparée dès la planification : le formateur doit
// pouvoir la faire passer en fin de session sans attendre un changement de
// statut. La satisfaction reste déclenchée au bon moment (fin, puis J+90).
const TYPES_BY_STATUS: Record<string, QcmType[]> = {
  planifiee: ['positionnement', 'sortie'],
  confirmee: ['positionnement', 'sortie'],
  en_cours: ['positionnement', 'sortie', 'satisfaction_chaud'],
  terminee: ['positionnement', 'sortie', 'satisfaction_chaud', 'satisfaction_froid'],
}

/**
 * Sème (SILENCIEUSEMENT, sans notification) les qcm_reponses de toute une
 * organisation selon le moment du cycle de chaque session. Idempotent. Appelé
 * après le sync Dendreo pour que les sessions importées relient leurs QCM aux
 * apprenants inscrits. Retourne le nombre de réponses créées.
 */
export async function backfillOrgQcmReponses(supabase: any, orgId: string): Promise<number> {
  try {
    // PostgREST plafonne une requête à 1000 lignes : sans pagination, l'ensemble
    // « déjà vu » (seen) est incomplet sur une grosse table (qcm_reponses ~20k)
    // et les mêmes réponses sont ré-insérées à chaque exécution → doublons.
    const fetchAll = async (build: (from: number, to: number) => any): Promise<any[]> => {
      const out: any[] = []; const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1)
        if (error || !data || data.length === 0) break
        out.push(...data)
        if (data.length < PAGE) break
      }
      return out
    }

    const qcms = await fetchAll((f, t) => supabase
      .from('qcm').select('id, formation_id, type')
      .eq('organization_id', orgId).eq('status', 'publie').not('formation_id', 'is', null).range(f, t))
    if (qcms.length === 0) return 0
    const qcmByFT = new Map<string, string>()
    for (const q of qcms) qcmByFT.set(`${q.formation_id}:${q.type}`, q.id)

    const sessions = await fetchAll((f, t) => supabase
      .from('sessions').select('id, formation_id, status').eq('organization_id', orgId).not('formation_id', 'is', null).range(f, t))
    const inscriptions = await fetchAll((f, t) => supabase
      .from('inscriptions').select('session_id, apprenant_id, status').eq('organization_id', orgId).range(f, t))
    const insBySession = new Map<string, string[]>()
    for (const i of inscriptions) {
      if (['annule', 'abandonne'].includes(i.status) || !i.apprenant_id) continue
      const arr = insBySession.get(i.session_id) || []; arr.push(i.apprenant_id); insBySession.set(i.session_id, arr)
    }

    const existing = await fetchAll((f, t) => supabase
      .from('qcm_reponses').select('qcm_id, apprenant_id').eq('organization_id', orgId).range(f, t))
    const seen = new Set(existing.map((e: any) => `${e.qcm_id}:${e.apprenant_id}`))
    // Types que la session couvre avec ses propres questionnaires (lib/qcm-autolink)
    const remplaces = await typesRemplacesOrg(supabase, orgId)

    const rows: any[] = []
    for (const s of (sessions || [])) {
      const types = TYPES_BY_STATUS[s.status]
      if (!types) continue
      const apprenants = insBySession.get(s.id) || []
      for (const t of types) {
        if (remplaces.has(`${s.id}|${t}`)) continue
        const qid = qcmByFT.get(`${s.formation_id}:${t}`)
        if (!qid) continue
        for (const aid of apprenants) {
          const key = `${qid}:${aid}`
          if (seen.has(key)) continue
          seen.add(key)
          rows.push({ organization_id: orgId, qcm_id: qid, apprenant_id: aid, session_id: s.id, is_complete: false })
        }
      }
    }
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('qcm_reponses').insert(rows.slice(i, i + 500))
    }
    return rows.length
  } catch (e) {
    console.error('[backfillOrgQcmReponses]', e)
    return 0
  }
}

/** Notifie les apprenants concernés qu'un QCM leur est disponible */
export async function notifyApprenantsForQcm(
  supabase: any,
  sessionId: string,
  qcmType: QcmType,
  opts?: { seulementEnAttente?: boolean; relance?: boolean; titre?: string | null },
) {
  const { createNotification } = await import('@/lib/email')
  const labels: Record<QcmType, string> = {
    positionnement: 'Test de positionnement',
    entree: 'Évaluation d\'entrée',
    sortie: 'Évaluation de sortie',
    satisfaction_chaud: 'Questionnaire de satisfaction',
    satisfaction_froid: 'Questionnaire de satisfaction à froid (3 mois)',
  }

  const { data: sess } = await supabase
    .from('sessions')
    .select('organization_id, formation:formation_id(intitule)')
    .eq('id', sessionId).single()
  if (!sess) return

  let { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(id, user_id, civilite, prenom, nom, email, whatsapp, whatsapp_opt_in)')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  // Relance : on ne recontacte que ceux qui n'ont pas encore répondu.
  if (opts?.seulementEnAttente) {
    const { data: qcmsDuType } = await supabase.from('qcm_sessions')
      .select('qcm_id, qcm:qcm_id(type)').eq('session_id', sessionId)
    const ids = (qcmsDuType || []).filter((l: any) => l.qcm?.type === qcmType).map((l: any) => l.qcm_id)
    if (ids.length) {
      const { data: faites } = await supabase.from('qcm_reponses')
        .select('apprenant_id').eq('session_id', sessionId).in('qcm_id', ids).eq('is_complete', true)
      const dejaFait = new Set((faites || []).map((r: any) => r.apprenant_id))
      inscriptions = (inscriptions || []).filter((i: any) => i.apprenant && !dejaFait.has(i.apprenant.id))
    }
  }

  const { data: org } = await supabase.from('organizations').select('*').eq('id', sess.organization_id).single()
  const formationName = (sess as any).formation?.intitule || 'Formation'

  // QCM type → template WhatsApp (les types sans template restent en notif seule)
  const waTemplate: Partial<Record<QcmType, string>> = {
    positionnement: 'questionnaire_positionnement',
    sortie: 'evaluation_sortie',
    satisfaction_chaud: 'satisfaction_chaud',
    satisfaction_froid: 'satisfaction_froid',
  }

  // Email config par type — sujet + intro + CTA
  const emailConfig: Partial<Record<QcmType, { subject: string; docTitle: string; intro: string; cta: string }>> = {
    positionnement: {
      subject: `Test de positionnement — ${formationName}`,
      docTitle: 'Test de positionnement à compléter',
      intro: `Avant le démarrage de votre formation "${formationName}", merci de compléter ce court questionnaire de positionnement. Il nous permet d'adapter le contenu à vos besoins et à votre niveau.`,
      cta: 'Compléter le questionnaire',
    },
    sortie: {
      subject: `Évaluation des acquis — ${formationName}`,
      docTitle: 'Évaluation des acquis',
      intro: `Votre formation "${formationName}" touche à sa fin. Merci de compléter ce questionnaire pour valider les acquis et obtenir votre attestation.`,
      cta: 'Évaluer mes acquis',
    },
    satisfaction_chaud: {
      subject: `Donnez-nous votre avis — ${formationName}`,
      docTitle: 'Évaluation à chaud',
      intro: `Votre avis nous est précieux pour améliorer nos formations. Quelques minutes suffisent pour répondre à ce questionnaire de satisfaction.`,
      cta: 'Donner mon avis',
    },
    satisfaction_froid: {
      subject: `Trois mois après votre formation — ${formationName}`,
      docTitle: 'Évaluation à froid',
      intro: `Trois mois après votre formation "${formationName}", merci de nous dire comment vous avez mis en pratique les acquis. C'est un indicateur clé pour la qualité de nos formations (Qualiopi).`,
      cta: 'Répondre au questionnaire',
    },
  }
  if (opts?.relance) {
    for (const k of Object.keys(emailConfig) as QcmType[]) {
      const c = emailConfig[k]
      if (c) { c.subject = `Rappel — ${c.subject}`; c.intro = `Petit rappel : ${c.intro.charAt(0).toLowerCase()}${c.intro.slice(1)}` }
    }
  }
  // Envoi par le formateur d'un questionnaire précis (un quiz du cours…) : le
  // message le nomme, sans le texte de son type (« votre formation touche à sa
  // fin » au premier jour d'une POEI)
  if (opts?.titre && emailConfig[qcmType]) {
    // Le titre et l'introduction entrent tels quels dans le HTML du mail
    const titreHtml = opts.titre.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    emailConfig[qcmType] = {
      subject: `Questionnaire à compléter — ${opts.titre}`,
      docTitle: titreHtml,
      intro: `Votre formateur vous propose le questionnaire « ${titreHtml} » de votre formation "${formationName}". Il vous attend dans votre espace : quelques minutes suffisent.`,
      cta: 'Répondre au questionnaire',
    }
  }

  const { sendWhatsAppTemplate } = await import('@/lib/whatsapp')
  const { getOrCreateApprenantToken } = await import('@/lib/portal-token')
  const { sendDocumentEmail } = await import('@/lib/email')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  for (const ins of inscriptions || []) {
    const a = (ins as any).apprenant
    if (a?.user_id) {
      await createNotification({
        organizationId: sess.organization_id,
        userId: a.user_id,
        titre: opts?.titre || labels[qcmType],
        message: `Un nouveau questionnaire est disponible pour la formation "${formationName}".`,
        type: 'qcm',
        lienUrl: '/mon-espace',
        lienLabel: 'Compléter le questionnaire',
        entityType: 'session',
        entityId: sessionId,
      })
    }

    // Token portail (réutilisé pour WhatsApp + email)
    const token = (a?.id) ? await getOrCreateApprenantToken(supabase, a.id, sess.organization_id, a?.email) : null

    // WhatsApp si opt-in + numéro + template existant pour ce type
    const tpl = waTemplate[qcmType]
    if (tpl && a?.whatsapp_opt_in && a?.whatsapp && token) {
      await sendWhatsAppTemplate({
        organizationId: sess.organization_id,
        to: a.whatsapp,
        toName: a.prenom || '',
        template: tpl,
        languageCode: 'fr',
        bodyParams: [a.prenom || 'Bonjour', formationName],
        buttonUrlParam: token,
        entityType: 'session',
        entityId: sessionId,
      })
    }

    // Email brandé avec CTA → portail questionnaires
    const eCfg = emailConfig[qcmType]
    if (eCfg && a?.email && token) {
      try {
        await sendDocumentEmail({
          to: a.email,
          orgName: org?.name || 'Lab Learning',
          orgEmail: (org as any)?.email_contact || org?.email,
          orgLogoUrl: (org as any)?.logo_url,
          qualiopiCertified: (org as any)?.is_qualiopi !== false,
          recipientName: [a.civilite, a.prenom, a.nom].filter(Boolean).join(' ').trim() || 'Madame, Monsieur',
          subject: eCfg.subject,
          docTitle: eCfg.docTitle,
          intro: eCfg.intro,
          metadata: [['Formation', formationName]],
          ctaLabel: eCfg.cta,
          ctaUrl: `${appUrl}/portail/${token}/questionnaires`,
          footerNote: 'Aucun mot de passe requis — le lien est personnel et sécurisé.',
          organizationId: sess.organization_id,
          entityType: 'session',
          entityId: sessionId,
        })
      } catch (e) { console.error('[email qcm]', e) }
    }
  }
}

/**
 * Rattache les inscrits aux questionnaires DE LA SESSION.
 *
 * Les fonctions ci-dessus partent des QCM de la formation ; celle-ci part de
 * ceux réellement rattachés à la session (`qcm_sessions`), qui font foi. Elle
 * est appelée à chaque inscription et à chaque rattachement de questionnaire :
 * les stagiaires arrivent souvent après la création de la session, et sans
 * cela ils n'apparaissent dans aucun questionnaire.
 *
 * Idempotente : ne crée que les lignes absentes.
 */
export async function lierInscritsAuxQcmSession(
  supabase: any,
  sessionId: string,
): Promise<{ created: number }> {
  const { data: sess } = await supabase
    .from('sessions').select('id, organization_id').eq('id', sessionId).maybeSingle()
  if (!sess) return { created: 0 }

  const [{ data: liens }, { data: inscriptions }, { data: existantes }] = await Promise.all([
    supabase.from('qcm_sessions').select('id, qcm_id').eq('session_id', sessionId),
    supabase.from('inscriptions').select('apprenant_id').eq('session_id', sessionId)
      .not('status', 'in', '("annule","abandonne")'),
    supabase.from('qcm_reponses').select('qcm_id, apprenant_id').eq('session_id', sessionId),
  ])

  const qcmIds = [...new Set((liens || []).map((l: any) => l.qcm_id).filter(Boolean))] as string[]
  // La réponse porte son rattachement : un questionnaire encore fermé le reste pour l'arrivant
  const lienDe = new Map<string, string>()
  for (const l of (liens || []) as any[]) if (l.qcm_id && !lienDe.has(l.qcm_id)) lienDe.set(l.qcm_id, l.id)
  const apprenantIds = [...new Set((inscriptions || []).map((i: any) => i.apprenant_id).filter(Boolean))]
  if (qcmIds.length === 0 || apprenantIds.length === 0) return { created: 0 }

  const deja = new Set((existantes || []).map((r: any) => `${r.qcm_id}|${r.apprenant_id}`))
  const rows: any[] = []
  for (const qcmId of qcmIds) {
    for (const apprenantId of apprenantIds) {
      if (deja.has(`${qcmId}|${apprenantId}`)) continue
      rows.push({
        organization_id: sess.organization_id,
        qcm_id: qcmId,
        qcm_session_id: lienDe.get(qcmId) || null,
        session_id: sessionId,
        apprenant_id: apprenantId,
        is_complete: false,
      })
    }
  }
  if (rows.length === 0) return { created: 0 }

  const { error } = await supabase.from('qcm_reponses').insert(rows)
  if (error) {
    console.error('[lierInscritsAuxQcmSession]', error.message)
    return { created: 0 }
  }
  return { created: rows.length }
}
