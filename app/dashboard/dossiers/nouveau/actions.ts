'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { estimationPriseEnCharge } from '@/lib/agefice'
import { refusFormationPoei } from '@/lib/poei-garde'
import { peutGererSessions } from '@/lib/sessions-acces'
import { estResponsableLeads, peutRelierLeadAuClient, refusAttribution } from '@/lib/leads-acces'

/**
 * Création d'un dossier complet en un geste : client (existant ou nouveau)
 * → apprenants → session avec inscriptions. Le circuit commercial ne passe
 * plus par les leads (réservés au site web) — tout se retrouve dans Sessions.
 * Depuis un lead (lead_id) : le lead passe à « Gagné », relié au client et à
 * la session créés ; le nouveau client reprend l'apporteur, la franchise et
 * le suivi du lead, comme à la conversion. Un commercial ne monte que le
 * dossier d'un lead qu'il suit ou que personne ne suit, et le lead n'est
 * relié qu'à un client de son portefeuille (lib/leads-acces).
 * Tout est vérifié avant la première écriture ; si une étape échoue ensuite,
 * ce qui a été créé dans cet appel est retiré : un nouvel essai ne crée pas
 * de client en double. Un lead n'a qu'un dossier.
 * Joignable hors du tableau de bord comme toute action exportée : réservée au
 * personnel qui peut créer des sessions.
 */
export async function creerDossierCompletAction(formData: FormData): Promise<ActionResult & { data?: { sessionId: string } }> {
  const session = await getSession()
  if (!peutGererSessions(session, 'create')) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const erreurPoei = await refusFormationPoei(supabase, [String(formData.get('formation_id') || '')])
  if (erreurPoei) return { success: false, error: erreurPoei }
  const orgId = session.organization.id

  // ── 0. Le lead d'origine (page Leads), vérifié avant de rien créer ──
  const leadId = String(formData.get('lead_id') || '').trim()
  let leadOrigine: any = null
  if (leadId) {
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return { success: false, error: 'Lead introuvable' }
    const { data } = await supabase.from('leads').select('*').eq('id', leadId).eq('organization_id', orgId).maybeSingle()
    if (!data) return { success: false, error: 'Lead introuvable' }
    if (!estResponsableLeads(session.user.role) && data.assigned_to && data.assigned_to !== session.user.id) {
      return { success: false, error: 'Ce lead est suivi par une autre personne : elle, ou un responsable, crée son dossier' }
    }
    if (data.session_id) return { success: false, error: 'Ce lead a déjà son dossier : ouvrez sa session depuis la fiche du lead' }
    leadOrigine = data
  }

  // ── Tout ce qui est saisi est vérifié avant d'écrire quoi que ce soit ──
  let clientId = String(formData.get('client_id') || '').trim() || null
  const nouveauClient = String(formData.get('nouveau_client') || '') === 'oui'
  const raison = String(formData.get('client_raison_sociale') || '').trim()
  if (nouveauClient && !raison) return { success: false, error: 'Le nom de l\'établissement est requis' }
  if (!nouveauClient) {
    if (!clientId) return { success: false, error: 'Choisissez un client ou créez-en un' }
    const { data: existe } = await supabase.from('clients').select('id').eq('id', clientId).eq('organization_id', orgId).maybeSingle()
    if (!existe) return { success: false, error: 'Client introuvable : rechargez la page' }
  }

  let apprenants: Array<Record<string, any>> = []
  try { apprenants = JSON.parse(String(formData.get('apprenants') || '[]')) } catch { /* liste vide */ }
  if (!Array.isArray(apprenants)) apprenants = []
  apprenants = apprenants.filter((a) => a && ((a.nom || a.prenom || '') as string).trim())
  if (!apprenants.length) return { success: false, error: 'Ajoutez au moins un apprenant' }
  // Prénom et nom sont obligatoires sur la fiche d'un apprenant
  if (apprenants.some((a) => !String(a.prenom || '').trim() || !String(a.nom || '').trim())) {
    return { success: false, error: 'Indiquez le prénom et le nom de chaque apprenant' }
  }

  const formationId = String(formData.get('formation_id') || '').trim()
  const dateDebut = String(formData.get('date_debut') || '').trim()
  const dateFin = String(formData.get('date_fin') || '').trim() || dateDebut
  if (!formationId || !dateDebut) return { success: false, error: 'Formation et date de début requises' }
  const formateurId = String(formData.get('formateur_id') || '').trim() || null

  // Ce que cet appel a créé, retiré si une étape suivante échoue (un nouvel essai repart de zéro)
  const creesIci: { client?: string; contact?: string; apprenants: string[] } = { apprenants: [] }
  const annuler = async () => {
    if (creesIci.apprenants.length) await supabase.from('apprenants').delete().in('id', creesIci.apprenants).eq('organization_id', orgId)
    if (creesIci.contact) await supabase.from('contacts').delete().eq('id', creesIci.contact).eq('organization_id', orgId)
    if (creesIci.client) await supabase.from('clients').delete().eq('id', creesIci.client).eq('organization_id', orgId)
  }
  let warning: string | undefined

  // ── 1. Le client : existant, ou créé à la volée ──
  if (nouveauClient) {
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
      // Financé par son OPCO par défaut (un dossier AGEFICE le repasse en AGEFICE plus bas)
      financeur_type: 'opco',
      // Comme à la conversion : l'apporteur du lead suit l'établissement (sa commission se calcule par
      // le client) et la franchise le classe dans son réseau
      apporteur_id: leadOrigine?.apporteur_id || null,
      franchise_id: leadOrigine?.franchise_id || null,
      // Le client créé appartient à qui suit le lead, sinon à qui monte le dossier (un commercial le retrouve dans ses clients)
      created_by: session.user.id,
      assigned_to: leadOrigine?.assigned_to || session.user.id,
    }).select('id').single()
    if (eClient) {
      console.error('[dossier client]', eClient.message)
      return { success: false, error: `Création du client impossible : ${eClient.message}` }
    }
    clientId = client.id
    creesIci.client = client.id

    // Contact référent si renseigné (prénom obligatoire en base : vide plutôt que rien)
    const contactNom = String(formData.get('contact_nom') || '').trim()
    if (contactNom) {
      const { data: contact, error: eContact } = await supabase.from('contacts').insert({
        organization_id: orgId,
        client_id: clientId,
        prenom: String(formData.get('contact_prenom') || '').trim(),
        nom: contactNom,
        email: String(formData.get('contact_email') || '').trim() || null,
        telephone: String(formData.get('contact_telephone') || '').trim() || null,
        est_principal: true,
        est_signataire: true,
      }).select('id').single()
      if (eContact) {
        console.error('[dossier contact]', eContact.message)
        warning = 'Le contact référent n’a pas été enregistré : ajoutez-le sur la fiche du client'
      } else creesIci.contact = contact.id
    }
  }
  if (!clientId) return { success: false, error: 'Choisissez un client ou créez-en un' }

  // ── 2. Les apprenants — fiche complète (état civil, adresse, n° sécu…) ──
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
    await annuler()
    return { success: false, error: `Création des apprenants impossible : ${eApp.message}` }
  }
  creesIci.apprenants = ((crees || []) as any[]).map((a) => a.id)

  // ── 3. La session ──
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
    await annuler()
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
      warning = [warning, 'Session créée, mais dossier AGEFICE non créé (migration 143 à appliquer ?)'].filter(Boolean).join(' · ')
    }
  }

  // ── 6. Le lead d'origine (page Leads) : gagné, relié au client et à la session ──
  if (leadOrigine) {
    // Le lien met le client dans le portefeuille de qui suit le lead : un commercial ne relie que ses clients.
    // Un lead déjà relié à un autre client garde ce lien
    const dejaRelieAilleurs = !!leadOrigine.converted_client_id && leadOrigine.converted_client_id !== clientId
    const relier = !dejaRelieAilleurs && await peutRelierLeadAuClient(supabase, session, leadOrigine, clientId, { clientCreeIci: nouveauClient })
    if (relier && !nouveauClient) {
      // Client existant : l'apporteur et la franchise du lead comblent ce qui manque, le contact du lead le rejoint
      const { data: cl } = await supabase.from('clients').select('apporteur_id, franchise_id').eq('id', clientId).eq('organization_id', orgId).maybeSingle()
      const patch: Record<string, unknown> = {}
      if (cl && !cl.apporteur_id && leadOrigine.apporteur_id) patch.apporteur_id = leadOrigine.apporteur_id
      if (cl && !cl.franchise_id && leadOrigine.franchise_id) patch.franchise_id = leadOrigine.franchise_id
      if (Object.keys(patch).length) await supabase.from('clients').update(patch).eq('id', clientId).eq('organization_id', orgId)
      if (leadOrigine.contact_nom || leadOrigine.contact_email) {
        const { data: contacts } = await supabase.from('contacts').select('id, nom, prenom, email')
          .eq('organization_id', orgId).eq('client_id', clientId)
        const nomLead = `${leadOrigine.contact_prenom || ''} ${leadOrigine.contact_nom || ''}`.trim().toLowerCase()
        const dejaLa = ((contacts || []) as any[]).some((c) =>
          (leadOrigine.contact_email && String(c.email || '').toLowerCase() === String(leadOrigine.contact_email).toLowerCase())
          || (!!nomLead && `${c.prenom || ''} ${c.nom || ''}`.trim().toLowerCase() === nomLead))
        if (!dejaLa) {
          // Prénom obligatoire en base : vide plutôt que rien (un lead du site n'a souvent qu'un nom)
          const { error: eContactLead } = await supabase.from('contacts').insert({
            organization_id: orgId,
            client_id: clientId,
            prenom: leadOrigine.contact_prenom || '',
            nom: leadOrigine.contact_nom || leadOrigine.contact_email,
            email: leadOrigine.contact_email || null,
            telephone: leadOrigine.contact_telephone || null,
            poste: leadOrigine.contact_poste || null,
            est_principal: (contacts || []).length === 0,
          })
          if (eContactLead) console.error('[dossier contact du lead]', eContactLead.message)
        }
      }
    }
    await supabase.from('leads').update({
      status: 'gagne',
      ...(relier ? { converted_client_id: clientId, converted_at: leadOrigine.converted_at || new Date().toISOString() } : {}),
      session_id: sess.id,
      // Un lead que personne ne suivait revient à qui monte son dossier, selon les règles d'attribution
      // (jamais un lead déjà relié à un client pour un commercial : il lui ouvrirait ce client)
      ...(!leadOrigine.assigned_to && !refusAttribution(session, leadOrigine, session.user.id) ? { assigned_to: session.user.id } : {}),
    }).eq('id', leadId).eq('organization_id', orgId)
    await supabase.from('lead_interactions').insert({
      organization_id: orgId, lead_id: leadId, type: 'autre', subject: 'Étape',
      content: `Dossier créé : session ${ref}. Passé à « Gagné ».${relier ? '' : dejaRelieAilleurs ? ' Le lead reste relié à son client d’origine.' : ' Client hors du portefeuille de qui a monté le dossier : le lead ne lui est pas relié.'}`,
      user_id: session.user.id,
    })
    if (!relier && !dejaRelieAilleurs) warning = [warning, 'Le lead n’est pas relié au client, qui n’est pas dans votre portefeuille : un responsable peut le faire'].filter(Boolean).join(' · ')
    revalidatePath('/dashboard/leads')
  }
  revalidatePath('/dashboard/sessions')

  await logAudit({
    action: 'create', entity_type: 'session', entity_id: sess.id,
    details: { via: 'dossier_complet', client_id: clientId, apprenants: (crees || []).length, ...(leadId ? { lead_id: leadId } : {}) },
  })
  return { success: true, data: { sessionId: sess.id }, ...(warning ? { warning } : {}) } as any
}
