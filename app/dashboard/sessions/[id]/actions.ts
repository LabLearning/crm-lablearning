'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function updateSessionStatusAction(sessionId: string, newStatus: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({ status: newStatus })
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: error.message }

  // Quand la session est marquée terminée : email d'évaluation au commanditaire (Qualiopi Ind. 28)
  if (newStatus === 'terminee') {
    try {
      const { data: sess } = await supabase
        .from('sessions')
        .select(`
          id, date_debut, date_fin,
          formation:formation_id(intitule),
          client:client_id(raison_sociale, email)
        `)
        .eq('id', sessionId)
        .single()
      const cli: any = (sess as any)?.client
      if (cli?.email) {
        const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
        const { sendDocumentEmail } = await import('@/lib/email')
        const formationNom = (sess as any).formation?.intitule || 'Formation'
        const periode = sess?.date_debut
          ? `Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin || sess.date_debut).toLocaleDateString('fr-FR')}`
          : '—'
        const replyEmail = (org as any)?.email_contact || org?.email
        await sendDocumentEmail({
          to: cli.email,
          orgName: org?.name || 'Lab Learning',
          orgEmail: replyEmail,
          orgLogoUrl: (org as any)?.logo_url,
          qualiopiCertified: (org as any)?.is_qualiopi !== false,
          recipientName: cli.raison_sociale || 'Madame, Monsieur',
          subject: `Votre avis sur la formation — ${formationNom}`,
          docTitle: 'Donnez-nous votre avis (commanditaire)',
          intro: `La formation que vous nous avez confiée pour vos collaborateurs vient de se terminer. Votre retour en tant que commanditaire est essentiel à notre démarche qualité (indicateur Qualiopi 28).`,
          metadata: [
            ['Formation', formationNom],
            ['Période', periode],
          ],
          ctaLabel: 'Répondre par email',
          ctaUrl: replyEmail ? `mailto:${replyEmail}?subject=${encodeURIComponent('Retour formation — ' + formationNom)}` : undefined,
          footerNote: 'Vos remarques nous aident à améliorer continuellement nos prestations.',
        })
      }
    } catch (e) { console.error('[email eval client]', e) }
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

export async function togglePresenceAction(emargementId: string, estPresent: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('emargements')
    .update({ est_present: estPresent })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function signEmargementAction(emargementId: string, signatureBase64: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Récupérer l'émargement pour avoir le contexte
  const { data: emargement } = await supabase
    .from('emargements')
    .select('id, session_id, apprenant_id')
    .eq('id', emargementId)
    .single()

  if (!emargement) return { success: false, error: 'Émargement introuvable' }

  // Upload de la signature
  let signatureUrl: string | null = null
  if (signatureBase64.startsWith('data:image/')) {
    const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `${session.organization.id}/${emargement.session_id}/${emargement.apprenant_id}_${Date.now()}.png`

    const { error: uploadErr } = await supabase.storage
      .from('pointages')
      .upload(path, buffer, { contentType: 'image/png', upsert: true })

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('pointages').getPublicUrl(path)
      signatureUrl = urlData?.publicUrl || null
    }
  }

  // Mettre à jour l'émargement : présent + signature + heure
  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signature_data: signatureUrl,
      signed_at: new Date().toISOString(),
    })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function createEmargementJourAction(sessionId: string, date: string, creneau: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Récupérer les apprenants inscrits
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  if (!inscriptions || inscriptions.length === 0) {
    return { success: false, error: 'Aucun apprenant inscrit' }
  }

  // Vérifier les doublons
  const apprenantIds = inscriptions.map(i => i.apprenant_id)
  const { data: existing } = await supabase
    .from('emargements')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .in('apprenant_id', apprenantIds)

  const existingIds = new Set((existing || []).map((e: any) => e.apprenant_id))

  const toInsert = inscriptions
    .filter(i => !existingIds.has(i.apprenant_id))
    .map(i => ({
      session_id: sessionId,
      apprenant_id: i.apprenant_id,
      date,
      creneau,
      est_present: false,
      organization_id: session.organization.id,
    }))

  if (toInsert.length === 0) {
    return { success: false, error: 'Feuille d\'émargement déjà créée pour ce jour' }
  }

  const { error } = await supabase.from('emargements').insert(toInsert)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}
