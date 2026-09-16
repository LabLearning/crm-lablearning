'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { sendDocumentEmail } from '@/lib/email'
import { QUESTIONS } from '@/lib/poei-positionnement'

const MESSAGE_MIGRATION = 'Appliquez la migration 152 pour envoyer les questionnaires de positionnement.'
const tableAbsente = (e: any) => ['PGRST205', '42P01'].includes(String(e?.code))

function canManage(role: string) {
  return ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial', 'formateur'].includes(role)
}

const lienPublic = (token: string) =>
  `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/positionnement/${token}`

/**
 * Envoie le questionnaire de positionnement aux candidats sélectionnés.
 *
 * Chaque candidat reçoit un lien personnel, sans compte ni mot de passe : il
 * répond depuis son téléphone. Un candidat qui a déjà répondu n'est pas
 * relancé, pour ne pas écraser ses réponses.
 */
export async function envoyerPositionnementAction(
  poeiId: string,
  candidatIds: string[],
): Promise<ActionResult<{ envoyes: number; ignores: number; liens: { nom: string; lien: string }[] }>> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!candidatIds?.length) return { success: false, error: 'Aucun candidat sélectionné' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: poei } = await supabase
    .from('poei').select('id, numero, duree_heures, client:client_id(raison_sociale, nom_commercial)')
    .eq('id', poeiId).eq('organization_id', orgId).maybeSingle()
  if (!poei) return { success: false, error: 'Parcours POEI introuvable' }

  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('id, statut, apprenant:apprenants(id, prenom, nom, email)')
    .eq('poei_id', poeiId).eq('organization_id', orgId).in('id', candidatIds)

  const { data: orgRow } = await supabase.from('organizations').select('*').eq('id', orgId).single()

  let envoyes = 0
  let ignores = 0
  const liens: { nom: string; lien: string }[] = []

  for (const c of (candidats || []) as any[]) {
    if (c.statut === 'abandonne' || !c.apprenant) { ignores++; continue }
    const nom = `${c.apprenant.prenom || ''} ${c.apprenant.nom || ''}`.trim() || 'Candidat'

    const { data: deja, error: eLecture } = await supabase
      .from('poei_positionnements').select('id, token, statut')
      .eq('candidat_id', c.id).maybeSingle()
    if (eLecture && tableAbsente(eLecture)) return { success: false, error: MESSAGE_MIGRATION }
    // Déjà répondu : on ne renvoie pas, les réponses seraient perdues
    if (deja?.statut === 'complete') { ignores++; continue }

    let token = deja?.token as string | undefined
    if (!deja) {
      const { data: cree, error } = await supabase.from('poei_positionnements').insert({
        organization_id: orgId, poei_id: poeiId, candidat_id: c.id,
        statut: 'envoye', envoye_le: new Date().toISOString(),
      }).select('token').single()
      if (error) {
        if (tableAbsente(error)) return { success: false, error: MESSAGE_MIGRATION }
        console.error('[positionnement envoi]', error)
        continue
      }
      token = cree!.token
    } else {
      await supabase.from('poei_positionnements')
        .update({ envoye_le: new Date().toISOString() }).eq('id', deja.id)
    }
    if (!token) continue

    const lien = lienPublic(token)
    liens.push({ nom, lien })

    // Sans email en fiche, le lien reste disponible à la copie côté gestionnaire
    if (!c.apprenant.email) { envoyes++; continue }

    const employeur = (poei as any).client?.nom_commercial || (poei as any).client?.raison_sociale || null
    const r = await sendDocumentEmail({
      to: c.apprenant.email,
      orgName: orgRow?.name || 'Lab Learning',
      orgEmail: (orgRow as any)?.email_contact || (orgRow as any)?.email || '',
      orgLogoUrl: (orgRow as any)?.logo_url || null,
      qualiopiCertified: (orgRow as any)?.is_qualiopi !== false,
      recipientName: nom,
      subject: 'Votre questionnaire de positionnement avant la formation',
      docTitle: 'Questionnaire de positionnement',
      intro: `Avant votre entrée en formation${employeur ? ` chez ${employeur}` : ''}, merci de répondre à ce questionnaire. Il compte ${QUESTIONS.length} questions et prend moins de dix minutes. Il sert à adapter la formation à ce que vous savez déjà faire : répondez seul, sans chercher les réponses.`,
      metadata: [
        ['Questions', `${QUESTIONS.length} questions à choix unique`],
        ['Durée', 'Moins de 10 minutes'],
        ['À faire', 'Avant le premier jour de formation'],
      ],
      ctaLabel: 'Répondre au questionnaire',
      ctaUrl: lien,
      footerNote: "Ce questionnaire n'est pas un examen : il n'y a aucune conséquence sur votre entrée en formation.",
      organizationId: orgId,
      entityType: 'poei_candidat',
      entityId: c.id,
      templateSlug: 'positionnement_poei',
    })
    if ((r as any)?.success !== false) envoyes++
  }

  await logAudit({ action: 'envoi_positionnement', entity_type: 'poei', entity_id: poeiId, details: { envoyes, ignores } })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { envoyes, ignores, liens } }
}

/**
 * Efface les réponses d'un candidat et lui renvoie le questionnaire.
 *
 * Sert quand un candidat a répondu à côté, ou pour un autre que lui : ses
 * réponses ne sont plus exploitables, il repart d'un lien neuf.
 */
export async function reinitialiserPositionnementAction(poeiId: string, candidatId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('poei_positionnements').delete()
    .eq('candidat_id', candidatId).eq('poei_id', poeiId).eq('organization_id', session.organization.id)
  if (error) {
    if (tableAbsente(error)) return { success: false, error: MESSAGE_MIGRATION }
    return { success: false, error: 'Suppression impossible' }
  }
  const renvoi = await envoyerPositionnementAction(poeiId, [candidatId])
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return renvoi.success ? { success: true } : renvoi
}
