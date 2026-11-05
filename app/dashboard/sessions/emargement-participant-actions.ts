'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { MOTIF_REPOS } from '@/lib/emargement-repos'
import { statutCreneau, signableParLeStagiaire, bloqueParFeuille, ORDRE_CRENEAU, type CreneauParticipant } from '@/lib/emargement-participant'
import type { ActionResult } from '@/lib/types'

// Émargement d'un participant demi-journée par demi-journée, depuis la fiche
// session ou la fiche POEI (lib/emargement-participant.ts). Chaque action est
// un point d'entrée public : rôle, organisation et sessions vérifiés à chaque appel.

async function contexte() {
  const session = await getSession()
  if (!checkDashboardAccess('/dashboard/sessions', session.user.role as any, session.permissions).allowed) return null
  return { session, supabase: await createServiceRoleClient() }
}

/** Les sessions demandées qui appartiennent à l'organisation */
async function sessionsAutorisees(supabase: any, orgId: string, ids: unknown) {
  const propres = Array.from(new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string'))).slice(0, 60) as string[]
  if (!propres.length) return []
  const { data } = await supabase.from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, formation:formation_id(intitule)')
    .in('id', propres).eq('organization_id', orgId)
  return (data || []) as any[]
}

const echapper = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const aujourdhuiParis = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })

/** Les demi-journées d'un participant sur les sessions données, avec leur état */
async function lireCreneaux(supabase: any, apprenantId: string, sessionIds: string[]): Promise<CreneauParticipant[]> {
  if (!sessionIds.length) return []
  const [{ data: lignes }, { data: feuilles }] = await Promise.all([
    supabase.from('emargements')
      .select('id, session_id, date, creneau, est_present, signature_data, signed_at, motif_absence')
      .eq('apprenant_id', apprenantId).in('session_id', sessionIds),
    supabase.from('emargement_feuilles').select('session_id, date, creneau, validated_at').in('session_id', sessionIds),
  ])
  const validees = new Set(((feuilles || []) as any[]).filter((f) => f.validated_at).map((f) => `${f.session_id}|${f.date}|${f.creneau}`))
  const jour = aujourdhuiParis()
  return ((lignes || []) as any[])
    .map((e) => ({
      id: e.id, session_id: e.session_id, date: e.date, creneau: e.creneau,
      statut: statutCreneau(e, jour),
      motif: e.motif_absence || null,
      signed_at: e.signed_at || null,
      verrouille: validees.has(`${e.session_id}|${e.date}|${e.creneau}`),
      futur: e.date > jour,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || (ORDRE_CRENEAU[a.creneau] ?? 9) - (ORDRE_CRENEAU[b.creneau] ?? 9))
}

/** Tout ce que le panneau affiche pour un participant */
export async function emargementParticipantAction(apprenantId: string, sessionIds: string[]): Promise<ActionResult & {
  data?: {
    apprenant: { prenom: string | null; nom: string | null; email: string | null }
    sessions: { id: string; libelle: string }[]
    creneaux: CreneauParticipant[]
    dernierEnvoi: string | null
  }
}> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { session, supabase } = ctx
  const orgId = session.organization.id

  const [{ data: a }, sessions] = await Promise.all([
    supabase.from('apprenants').select('id, prenom, nom, email').eq('id', apprenantId).eq('organization_id', orgId).maybeSingle(),
    sessionsAutorisees(supabase, orgId, sessionIds),
  ])
  if (!a) return { success: false, error: 'Participant introuvable' }
  const ids = sessions.map((s) => s.id)
  // Les demi-journées manquantes du planning, comme à l'ouverture d'une fiche
  // session (idempotent ; une ligne qui porte une trace n'est jamais retirée)
  const { ensureEmargements } = await import('@/lib/emargements')
  await Promise.all(ids.map((id) => ensureEmargements(supabase, id, orgId).catch(() => 0)))
  const [creneaux, envois] = await Promise.all([
    lireCreneaux(supabase, apprenantId, ids),
    a.email && ids.length
      ? supabase.from('email_logs').select('created_at, sent_at, status').eq('organization_id', orgId)
        .eq('entity_type', 'emargement').in('entity_id', ids).eq('to_email', a.email)
        .order('created_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const dernier = ((envois as any).data || [])[0]
  return {
    success: true,
    data: {
      apprenant: { prenom: a.prenom, nom: a.nom, email: a.email },
      sessions: sessions.map((s) => ({ id: s.id, libelle: [s.reference, s.formation?.intitule || s.intitule].filter(Boolean).join(' · ') })),
      creneaux,
      dernierEnvoi: dernier ? (dernier.sent_at || dernier.created_at) : null,
    },
  }
}

/**
 * Présent, absent (avec motif), repos, ou retour à « à signer ». Un créneau
 * signé par le stagiaire ne se modifie pas : sa signature est une preuve.
 */
export async function marquerCreneauParticipantAction(emargementId: string, statut: 'present' | 'absent' | 'repos' | 'effacer', motif?: string | null): Promise<ActionResult> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { session, supabase } = ctx
  if (!['present', 'absent', 'repos', 'effacer'].includes(statut)) return { success: false, error: 'État inconnu' }

  const { data: em } = await supabase.from('emargements')
    .select('id, session_id, date, signature_data, session:session_id(organization_id)')
    .eq('id', emargementId).maybeSingle()
  if (!em || (em as any).session?.organization_id !== session.organization.id) return { success: false, error: 'Créneau introuvable' }
  if ((em as any).signature_data) return { success: false, error: 'Ce créneau est déjà signé par le stagiaire : il ne se modifie plus' }
  if (statut === 'present' && (em as any).date > aujourdhuiParis()) return { success: false, error: 'Un jour à venir ne se marque pas présent' }

  const maj = statut === 'present' ? { est_present: true, motif_absence: null }
    : statut === 'absent' ? { est_present: false, motif_absence: (typeof motif === 'string' && motif.trim() ? motif.trim().slice(0, 200) : 'Non précisé') }
    : statut === 'repos' ? { est_present: false, motif_absence: MOTIF_REPOS }
    : { est_present: false, motif_absence: null }
  const { error } = await supabase.from('emargements').update(maj).eq('id', emargementId).is('signature_data', null)
  if (error) return { success: false, error: 'Enregistrement impossible' }

  revalidatePath(`/dashboard/sessions/${(em as any).session_id}`)
  revalidatePath('/dashboard/poei/[id]', 'page')
  return { success: true }
}

/** Le lien personnel vers son espace « Mes émargements » (créé s'il n'existe pas) */
export async function lienSignatureParticipantAction(apprenantId: string): Promise<ActionResult & { data?: { url: string } }> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { session, supabase } = ctx
  const { data: a } = await supabase.from('apprenants').select('id, email').eq('id', apprenantId).eq('organization_id', session.organization.id).maybeSingle()
  if (!a) return { success: false, error: 'Participant introuvable' }
  const { getOrCreateApprenantToken } = await import('@/lib/portal-token')
  const token = await getOrCreateApprenantToken(supabase, a.id, session.organization.id, a.email)
  if (!token) return { success: false, error: 'Lien impossible à créer' }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  return { success: true, data: { url: `${appUrl}/portail/${token}/mes-emargements` } }
}

/**
 * Mail au stagiaire avec le lien de son espace pour signer ses journées de
 * présence. Toujours un aperçu d'abord (apercu: true renvoie le mail sans
 * l'envoyer) ; l'envoi est tracé dans email_logs et le journal d'audit.
 */
export async function envoyerLienSignatureParticipantAction(apprenantId: string, sessionIds: string[], opts?: { apercu?: boolean }): Promise<ActionResult & {
  data?: { html?: string; subject?: string; email?: string; aSigner?: number }
}> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { session, supabase } = ctx
  const orgId = session.organization.id

  const [{ data: a }, sessions, { data: org }] = await Promise.all([
    supabase.from('apprenants').select('id, prenom, nom, civilite, email').eq('id', apprenantId).eq('organization_id', orgId).maybeSingle(),
    sessionsAutorisees(supabase, orgId, sessionIds),
    supabase.from('organizations').select('*').eq('id', orgId).single(),
  ])
  if (!a) return { success: false, error: 'Participant introuvable' }
  if (!a.email) return { success: false, error: `${a.prenom || ''} ${a.nom || ''}`.trim() + ' n’a pas d’adresse e-mail : copiez le lien et envoyez-le-lui autrement' }
  if (!sessions.length) return { success: false, error: 'Session introuvable' }

  const creneaux = await lireCreneaux(supabase, a.id, sessions.map((s) => s.id))
  const aSigner = creneaux.filter(signableParLeStagiaire).length
  const bloques = creneaux.filter(bloqueParFeuille).length

  const { getOrCreateApprenantToken } = await import('@/lib/portal-token')
  const token = await getOrCreateApprenantToken(supabase, a.id, orgId, a.email)
  if (!token) return { success: false, error: 'Lien impossible à créer' }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const url = `${appUrl}/portail/${token}/mes-emargements`

  const intitule = sessions[0].formation?.intitule || sessions[0].intitule || 'votre formation'
  const debut = sessions.map((s) => s.date_debut).filter(Boolean).sort()[0]
  const fin = sessions.map((s) => s.date_fin).filter(Boolean).sort().slice(-1)[0]
  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const params = {
    orgName: (org as any)?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || (org as any)?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: [a.civilite, a.prenom, a.nom].filter(Boolean).join(' ').trim() || 'Madame, Monsieur',
    subject: `Signez vos journées de présence — ${intitule}`,
    docTitle: 'Vos journées de présence à signer',
    intro: aSigner > 0
      ? `Pour valider votre présence à la formation « ${echapper(intitule)} », merci de signer vos feuilles d’émargement en ligne : ${aSigner} demi-journée${aSigner > 1 ? 's vous attendent' : ' vous attend'}. Cela prend une minute, depuis votre téléphone.`
      : `Retrouvez vos feuilles d’émargement de la formation « ${echapper(intitule)} » en ligne, depuis votre téléphone.`,
    metadata: ([
      ['Formation', intitule],
      debut && fin ? ['Période', `Du ${fmt(debut)} au ${fmt(fin)}`] : null,
      ['À signer', `${aSigner} demi-journée${aSigner > 1 ? 's' : ''}`],
    ].filter(Boolean)) as [string, string][],
    ctaLabel: 'Signer mes journées',
    ctaUrl: url,
    footerNote: 'Ce lien est personnel : merci de ne pas le transférer.',
  }

  if (opts?.apercu) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { html: buildDocumentEmailHtml(params), subject: params.subject, email: a.email, aSigner } }
  }

  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    ...params,
    to: a.email,
    organizationId: orgId,
    entityType: 'emargement',
    entityId: sessions[0].id,
    triggeredBy: session.user.id,
  } as any)
  if (!(r as any)?.success) return { success: false, error: (r as any)?.error || 'Envoi impossible' }
  await logAudit({ action: 'envoi_lien_emargement', entity_type: 'apprenant', entity_id: a.id, details: { sessions: sessions.map((s) => s.id), a_signer: aSigner, bloques } })
  return { success: true, data: { email: a.email, aSigner } }
}

/**
 * Rouvre les feuilles validées des demi-journées que ce participant doit encore
 * signer : sans cela il ne peut pas signer. Réservé à l'administration et tracé
 * (la feuille est une pièce Qualiopi) ; le formateur la valide de nouveau ensuite.
 */
export async function rouvrirFeuillesParticipantAction(apprenantId: string, sessionIds: string[]): Promise<ActionResult & { data?: { rouvertes: number } }> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { session, supabase } = ctx
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) return { success: false, error: 'Réservé à l’administration' }

  const sessions = await sessionsAutorisees(supabase, session.organization.id, sessionIds)
  const creneaux = await lireCreneaux(supabase, apprenantId, sessions.map((s) => s.id))
  const cibles = Array.from(new Set(creneaux.filter(bloqueParFeuille).map((c) => `${c.session_id}|${c.date}|${c.creneau}`)))
  let rouvertes = 0
  for (const cle of cibles) {
    const [sid, date, creneau] = cle.split('|')
    const { data: f } = await supabase.from('emargement_feuilles').select('id, validated_at').eq('session_id', sid).eq('date', date).eq('creneau', creneau).maybeSingle()
    if (!f?.validated_at) continue
    const { error } = await supabase.from('emargement_feuilles').update({ validated_at: null, updated_at: new Date().toISOString() }).eq('id', f.id)
    if (error) continue
    rouvertes++
    await logAudit({ action: 'rouvrir_feuille_emargement', entity_type: 'session', entity_id: sid, details: { date, creneau, validee_le: f.validated_at, pour_apprenant: apprenantId } })
    revalidatePath(`/dashboard/sessions/${sid}`)
  }
  revalidatePath('/dashboard/poei/[id]', 'page')
  return { success: true, data: { rouvertes } }
}
