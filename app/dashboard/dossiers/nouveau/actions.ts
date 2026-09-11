'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { estimationPriseEnCharge } from '@/lib/agefice'

/**
 * Création d'un dossier complet en un geste : client (existant ou nouveau)
 * → apprenants → session avec inscriptions. Le circuit commercial ne passe
 * plus par les leads (réservés au site web) — tout se retrouve dans Sessions.
 */
export async function creerDossierCompletAction(formData: FormData): Promise<ActionResult & { data?: { sessionId: string } }> {
  const session = await getSession()
  if (['formateur', 'apprenant'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // ── 1. Le client : existant, ou créé à la volée ──
  let clientId = String(formData.get('client_id') || '').trim() || null
  const nouveauClient = String(formData.get('nouveau_client') || '') === 'oui'

  if (nouveauClient) {
    const raison = String(formData.get('client_raison_sociale') || '').trim()
    if (!raison) return { success: false, error: 'Le nom de l\'établissement est requis' }
    const { data: client, error: eClient } = await supabase.from('clients').insert({
      organization_id: orgId,
      type: 'entreprise',
      raison_sociale: raison,
      siret: String(formData.get('client_siret') || '').replace(/\s/g, '') || null,
      email: String(formData.get('client_email') || '').trim() || null,
      telephone: String(formData.get('client_telephone') || '').trim() || null,
      adresse: String(formData.get('client_adresse') || '').trim() || null,
      code_postal: String(formData.get('client_code_postal') || '').trim() || null,
      ville: String(formData.get('client_ville') || '').trim() || null,
    }).select('id').single()
    if (eClient) {
      console.error('[dossier client]', eClient.message)
      return { success: false, error: `Création du client impossible : ${eClient.message}` }
    }
    clientId = client.id

    // Contact référent si renseigné
    const contactNom = String(formData.get('contact_nom') || '').trim()
    if (contactNom) {
      await supabase.from('contacts').insert({
        organization_id: orgId,
        client_id: clientId,
        prenom: String(formData.get('contact_prenom') || '').trim() || null,
        nom: contactNom,
        email: String(formData.get('contact_email') || '').trim() || null,
        telephone: String(formData.get('contact_telephone') || '').trim() || null,
        est_principal: true,
        est_signataire: true,
      })
    }
  }
  if (!clientId) return { success: false, error: 'Choisissez un client ou créez-en un' }

  // ── 2. Les apprenants — fiche complète (état civil, adresse, n° sécu…) ──
  let apprenants: Array<Record<string, any>> = []
  try { apprenants = JSON.parse(String(formData.get('apprenants') || '[]')) } catch { /* liste vide */ }
  apprenants = apprenants.filter((a) => ((a.nom || a.prenom || '') as string).trim())
  if (!apprenants.length) return { success: false, error: 'Ajoutez au moins un apprenant' }

  const champ = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const { data: crees, error: eApp } = await supabase.from('apprenants').insert(
    apprenants.map((a) => ({
      organization_id: orgId,
      client_id: clientId,
      civilite: champ(a.civilite),
      prenom: champ(a.prenom),
      nom: champ(a.nom),
      email: champ(a.email),
      telephone: champ(a.telephone),
      poste: champ(a.poste),
      sexe: champ(a.sexe),
      date_naissance: champ(a.date_naissance),
      lieu_naissance: champ(a.lieu_naissance),
      numero_securite_sociale: champ(a.numero_securite_sociale),
      adresse: champ(a.adresse),
      code_postal: champ(a.code_postal),
      ville: champ(a.ville),
      type_contrat: champ(a.type_contrat),
      situation_handicap: !!a.situation_handicap,
      type_handicap: champ(a.type_handicap),
      besoins_adaptation: champ(a.besoins_adaptation),
    })),
  ).select('id')
  if (eApp) {
    console.error('[dossier apprenants]', eApp.message)
    return { success: false, error: `Création des apprenants impossible : ${eApp.message}` }
  }

  // ── 3. La session ──
  const formationId = String(formData.get('formation_id') || '').trim()
  const dateDebut = String(formData.get('date_debut') || '').trim()
  const dateFin = String(formData.get('date_fin') || '').trim() || dateDebut
  if (!formationId || !dateDebut) return { success: false, error: 'Formation et date de début requises' }
  const formateurId = String(formData.get('formateur_id') || '').trim() || null

  const { count } = await supabase.from('sessions')
    .select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
  const ref = `SES-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { data: cl } = await supabase.from('clients')
    .select('adresse, code_postal, ville').eq('id', clientId).maybeSingle()

  const { data: sess, error: eSess } = await supabase.from('sessions').insert({
    organization_id: orgId,
    formation_id: formationId,
    client_id: clientId,
    type_session: 'intra',
    modalite: 'presentiel',
    reference: ref,
    date_debut: dateDebut,
    date_fin: dateFin,
    lieu: cl?.ville ? `Chez le client — ${cl.ville}` : 'Chez le client',
    adresse: cl?.adresse || null,
    code_postal: cl?.code_postal || null,
    ville: cl?.ville || null,
    places_max: Math.max(apprenants.length, 12),
    formateur_id: formateurId,
    status: 'planifiee',
    created_by: session.user.id,
    mission_status: formateurId ? 'pending' : 'not_required',
    mission_proposed_at: formateurId ? new Date().toISOString() : null,
    mission_proposed_by: formateurId ? session.user.id : null,
  }).select('id').single()
  if (eSess) {
    console.error('[dossier session]', eSess.message)
    return { success: false, error: `Création de la session impossible : ${eSess.message}` }
  }

  // ── 4. Les inscriptions ──
  const { error: eIns } = await supabase.from('inscriptions').insert(
    (crees || []).map((a) => ({
      organization_id: orgId,
      session_id: sess.id,
      apprenant_id: a.id,
      status: 'inscrit',
    })),
  )
  if (eIns) console.error('[dossier inscriptions]', eIns.message)

  // Session imminente (aujourd'hui à J+3) : la convocation part tout de suite
  try { const { convoquerSiImminente } = await import('@/lib/convocations'); await convoquerSiImminente(supabase, sess.id, session.user.id) } catch { /* le cron rattrape */ }

  // ── 5. Financement AGEFICE : dossier de prise en charge créé et relié ──
  let warning: string | undefined
  if (String(formData.get('financement') || '') === 'agefice') {
    await supabase.from('clients').update({ financeur_type: 'agefice' }).eq('id', clientId)
    const { data: fo } = await supabase.from('formations')
      .select('duree_heures, prix_inter').eq('id', formationId).maybeSingle()
    const dureeH = fo?.duree_heures || null
    const { error: eAg } = await supabase.from('dossiers_agefice').insert({
      organization_id: orgId,
      client_id: clientId,
      apprenant_id: (crees || [])[0]?.id || null,
      formation_id: formationId,
      session_id: sess.id,
      statut: 'a_constituer',
      duree_heures: dureeH,
      date_debut_formation: dateDebut,
      date_fin_formation: dateFin,
      montant_demande: estimationPriseEnCharge({
        modalite: 'presentiel', duree_heures: dureeH, cout_pedagogique: null,
        categorie: 'metier', cfp_faible: false,
      }),
    })
    if (eAg) {
      console.error('[dossier agefice]', eAg.message)
      warning = 'Session créée, mais dossier AGEFICE non créé (migration 143 à appliquer ?)'
    }
  }

  await logAudit({
    action: 'create', entity_type: 'session', entity_id: sess.id,
    details: { via: 'dossier_complet', client_id: clientId, apprenants: (crees || []).length },
  })
  return { success: true, data: { sessionId: sess.id }, ...(warning ? { warning } : {}) } as any
}
