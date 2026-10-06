'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { isPlaceholderEmail } from '@/lib/utils'
import { ageHorodatage } from '@/lib/inscription-formateur-garde'
import { STARKK_SITE } from '@/lib/fonctionnalites'
import { CLE_GARDE_STARKK, ORG_SITE_STARKK } from '@/lib/starkk-site'

const ETIQUETTE = 'starkk-site'

const nettoyer = (s: unknown, max = 200) => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
/** Lettres, espaces, apostrophes, traits d'union, points : un nom, jamais une adresse web. */
const NOM_VALIDE = /^[\p{L}][\p{L}\p{M}' ’.-]{0,79}$/u
const jokers = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

type DemandeRappel = { prenom: string; telephone: string; email: string; etablissement: string; message: string }

/**
 * L'organisme du site public : Lab Learning. Hors production, CANDIDATURE_ORG_TEST
 * permet de dérouler la demande sur un organisme d'essai, sans alerter l'équipe.
 */
async function organisme(supabase: any) {
  const id = (process.env.NODE_ENV !== 'production' && process.env.CANDIDATURE_ORG_TEST) || process.env.PUBLIC_SITE_ORG || ORG_SITE_STARKK
  const { data } = await supabase.from('organizations').select('id, name').eq('id', id).maybeSingle()
  return (data as any) || null
}

/**
 * « Être rappelé », depuis la bulle Starkk du site. Le visiteur laisse un
 * prénom, un établissement et un téléphone ou une adresse : un lead « Site
 * web » est créé (ou complété s'il existe), avec les dernières questions
 * posées à Starkk pour que le commercial sache de quoi parler. L'équipe
 * commerciale est prévenue dans le CRM.
 */
export async function demanderRappelStarkkAction(saisie: DemandeRappel, garde: { jeton: string; pot: string }, discussion: string): Promise<{ success: boolean; error?: string }> {
  if (STARKK_SITE === 'coupe') return { success: false, error: 'Ce service n’est pas disponible.' }
  // Anti-robots : champ piège rempli (on répond « envoyé » sans rien faire), page non servie par nous
  if (garde?.pot) return { success: true }
  const age = ageHorodatage(CLE_GARDE_STARKK, garde?.jeton)
  if (age === null) return { success: false, error: 'La discussion a expiré : fermez puis rouvrez la bulle.' }
  if (age < 3000) return { success: false, error: 'Merci de vérifier vos informations avant d’envoyer.' }

  const s = {
    prenom: nettoyer(saisie?.prenom, 80),
    telephone: nettoyer(saisie?.telephone, 30),
    email: nettoyer(saisie?.email, 200).toLowerCase(),
    etablissement: nettoyer(saisie?.etablissement, 120),
    message: nettoyer(saisie?.message, 500),
  }
  if (!s.prenom || !NOM_VALIDE.test(s.prenom)) return { success: false, error: 'Indiquez votre prénom (lettres uniquement).' }
  const telOk = s.telephone.replace(/\D/g, '').length >= 9
  // « * » et « % » servent de jokers dans les recherches : refusés, ils ne figurent dans aucune adresse réelle
  const mailOk = /^[^\s@*%]+@[^\s@*%]+\.[^\s@*%]{2,}$/.test(s.email) && !isPlaceholderEmail(s.email)
  if (s.telephone && !telOk) return { success: false, error: 'Le numéro de téléphone semble incomplet.' }
  if (s.email && !mailOk) return { success: false, error: 'L’adresse e-mail ne semble pas valide.' }
  if (!telOk && !mailOk) return { success: false, error: 'Laissez un téléphone ou une adresse e-mail pour être recontacté.' }
  if (s.etablissement.length < 2 || /https?:|www\./i.test(s.etablissement)) return { success: false, error: 'Indiquez le nom de votre établissement.' }

  const supabase = await createServiceRoleClient()
  const org = await organisme(supabase)
  if (!org) return { success: false, error: 'L’envoi est indisponible pour le moment. Appelez-nous au 04 51 330 330.' }

  // Limite : 20 demandes de rappel par heure pour tout le site
  const ilYAUneHeure = new Date(Date.now() - 3600000).toISOString()
  const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id).contains('tags', [ETIQUETTE]).gte('updated_at', ilYAUneHeure)
  if ((count || 0) >= 20) return { success: false, error: 'Beaucoup de demandes en ce moment. Appelez-nous au 04 51 330 330.' }

  // Les dernières questions posées à Starkk, relues dans le journal (jamais dans ce qu'envoie le navigateur)
  let questions: string[] = []
  if (/^[0-9a-f-]{36}$/i.test(String(discussion || ''))) {
    const { data } = await supabase.from('audit_logs').select('details').eq('organization_id', ORG_SITE_STARKK)
      .eq('entity_type', 'chat_site').eq('entity_id', discussion).order('created_at', { ascending: false }).limit(3)
    questions = ((data || []) as any[]).map((r) => nettoyer(r.details?.question, 200)).filter(Boolean).reverse()
  }
  const jour = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
  const ligne = [
    `[${jour}] Demande de rappel par Starkk (site).`,
    s.message ? `Message : « ${s.message} »` : '',
    questions.length ? `Questions posées : ${questions.map((q) => `« ${q} »`).join(' ; ')}` : '',
  ].filter(Boolean).join(' ')

  // Déjà connu par son adresse ? Un client ou un contact d'abord, puis un lead
  let leadId: string | null = null
  let clientId: string | null = null
  if (mailOk) {
    const motif = jokers(s.email)
    const [{ data: contacts }, { data: clients }, { data: leads }] = await Promise.all([
      supabase.from('contacts').select('client_id, email').eq('organization_id', org.id).ilike('email', motif).limit(5),
      supabase.from('clients').select('id, email').eq('organization_id', org.id).ilike('email', motif).limit(5),
      supabase.from('leads').select('id, tags, commentaire, contact_email, contact_telephone, converted_client_id').eq('organization_id', org.id).ilike('contact_email', motif).order('created_at', { ascending: false }).limit(5),
    ])
    const meme = (v: unknown) => String(v || '').trim().toLowerCase() === s.email
    const lead = ((leads || []) as any[]).find((l) => meme(l.contact_email))
    clientId = ((contacts || []) as any[]).find((c) => meme(c.email))?.client_id || ((clients || []) as any[]).find((c) => meme(c.email))?.id || lead?.converted_client_id || null
    if (lead) {
      leadId = lead.id
      await supabase.from('leads').update({
        tags: [...new Set([...((lead.tags || []) as string[]), ETIQUETTE])],
        commentaire: [lead.commentaire, ligne].filter(Boolean).join('\n').slice(0, 5000),
        ...(!lead.contact_telephone && telOk ? { contact_telephone: s.telephone } : {}),
      }).eq('id', lead.id).eq('organization_id', org.id)
    }
  }
  if (!leadId && !clientId) {
    const { data: cree, error } = await supabase.from('leads').insert({
      organization_id: org.id,
      type: 'entreprise',
      entreprise: s.etablissement,
      // contact_nom est obligatoire : le prénom en tient lieu, le commercial complète au téléphone
      contact_nom: s.prenom,
      contact_email: mailOk ? s.email : null,
      contact_telephone: telOk ? s.telephone : null,
      source: 'site_web',
      status: 'nouveau',
      opco_compte_status: 'aucun',
      tags: [ETIQUETTE],
      commentaire: ligne,
    }).select('id').single()
    if (error || !cree) {
      console.error('[starkk site] rappel', error)
      return { success: false, error: 'L’envoi a échoué. Appelez-nous au 04 51 330 330.' }
    }
    leadId = cree.id
  }

  // Prévenir l'équipe commerciale dans le CRM : au mieux, la demande reste enregistrée
  try {
    const { createNotifications } = await import('@/lib/email')
    const { data: equipe } = await supabase.from('users').select('id')
      .eq('organization_id', org.id).eq('status', 'active').in('role', ['super_admin', 'directeur_commercial', 'commercial'])
    const joindre = [telOk ? s.telephone : '', mailOk ? s.email : ''].filter(Boolean).join(' · ')
    if ((equipe || []).length) {
      await createNotifications(((equipe || []) as any[]).map((u) => ({
        organizationId: org.id, userId: u.id, type: 'info',
        titre: clientId && !leadId ? 'Un client demande à être rappelé' : 'Demande de rappel depuis le site',
        message: `${s.prenom} (${s.etablissement}) demande à être rappelé : ${joindre}.${questions.length ? ` Sa dernière question à Starkk : « ${questions[questions.length - 1]} »` : ''}`,
        ...(leadId
          ? { lienUrl: `/dashboard/leads?lead=${leadId}`, lienLabel: 'Voir le lead', entityType: 'lead', entityId: leadId }
          : { lienUrl: `/dashboard/clients/${clientId}`, lienLabel: 'Voir le client', entityType: 'client', entityId: clientId as string }),
      })))
    }
  } catch (e) {
    console.error('[starkk site] notification', e)
  }

  return { success: true }
}
