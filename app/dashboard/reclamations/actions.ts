'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createReclamationAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const objet = formData.get('objet') as string
  const description = formData.get('description') as string
  const origine = formData.get('origine') as string
  const priorite = formData.get('priorite') as string
  const emetteur_nom = formData.get('emetteur_nom') as string
  const emetteur_email = formData.get('emetteur_email') as string
  const responsable_id = formData.get('responsable_id') as string

  if (!objet || !description) return { success: false, error: 'Objet et description requis' }

  const { data, error } = await supabase
    .from('reclamations')
    .insert({
      organization_id: session.organization.id,
      numero: '',
      objet,
      description,
      origine: origine || 'apprenant',
      priorite: priorite || 'moyenne',
      emetteur_nom: emetteur_nom || null,
      emetteur_email: emetteur_email || null,
      responsable_id: responsable_id || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  // Accusé de réception au plaignant (Qualiopi Ind. 29)
  if (emetteur_email) {
    try {
      const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
      const { sendDocumentEmail } = await import('@/lib/email')
      await sendDocumentEmail({
        to: emetteur_email,
        orgName: org?.name || 'Lab Learning',
        orgEmail: (org as any)?.email_contact || org?.email,
        orgLogoUrl: (org as any)?.logo_url,
        qualiopiCertified: (org as any)?.is_qualiopi !== false,
        recipientName: emetteur_nom || 'Madame, Monsieur',
        subject: `Accusé de réception de votre réclamation — ${data.numero || ''}`,
        docTitle: 'Nous avons bien reçu votre réclamation',
        intro: `Nous accusons réception de votre réclamation et vous remercions de nous avoir fait part de votre retour. Conformément à notre engagement qualité, nous allons l'analyser et vous tenir informé(e) des suites données.`,
        metadata: [
          ['Référence', data.numero || ''],
          ['Objet', objet],
          ['Date de réception', new Date().toLocaleDateString('fr-FR')],
        ],
        footerNote: 'Vous serez recontacté(e) dans les meilleurs délais. Pour toute question, vous pouvez répondre directement à cet email.',
      })
    } catch (e) { console.error('[email reclamation accuse]', e) }
  }

  await logAudit({ action: 'create', entity_type: 'reclamation', entity_id: data.id })
  revalidatePath('/dashboard/reclamations')
  return { success: true, data }
}

export async function updateReclamationStatusAction(id: string, status: string, details?: Record<string, string>): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updateData: Record<string, unknown> = { status }
  if (status === 'en_analyse') updateData.date_analyse = new Date().toISOString().split('T')[0]
  if (status === 'action_corrective') {
    updateData.action_corrective = details?.action_corrective || null
    updateData.date_resolution = new Date().toISOString().split('T')[0]
  }
  if (status === 'cloturee') {
    updateData.date_cloture = new Date().toISOString().split('T')[0]
    updateData.commentaire_cloture = details?.commentaire_cloture || null
    updateData.resolution_satisfaisante = details?.resolution_satisfaisante === 'true'
  }
  if (details?.analyse_contenu) updateData.analyse_contenu = details.analyse_contenu

  const { error } = await supabase
    .from('reclamations')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  // Email réponse + plan d'action quand on clôture (Qualiopi Ind. 29-31)
  if (status === 'cloturee' || status === 'action_corrective') {
    try {
      const { data: rec } = await supabase
        .from('reclamations')
        .select('numero, objet, emetteur_nom, emetteur_email, action_corrective, commentaire_cloture')
        .eq('id', id).single()
      if (rec?.emetteur_email) {
        const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
        const { sendDocumentEmail } = await import('@/lib/email')
        const isClosed = status === 'cloturee'
        const action = (rec as any).action_corrective || details?.action_corrective || ''
        const closure = (rec as any).commentaire_cloture || details?.commentaire_cloture || ''
        await sendDocumentEmail({
          to: rec.emetteur_email,
          orgName: org?.name || 'Lab Learning',
          orgEmail: (org as any)?.email_contact || org?.email,
          orgLogoUrl: (org as any)?.logo_url,
          qualiopiCertified: (org as any)?.is_qualiopi !== false,
          recipientName: rec.emetteur_nom || 'Madame, Monsieur',
          subject: isClosed
            ? `Réclamation ${rec.numero} — clôturée`
            : `Réclamation ${rec.numero} — action corrective`,
          docTitle: isClosed
            ? 'Votre réclamation a été clôturée'
            : 'Action corrective mise en place suite à votre réclamation',
          intro: isClosed
            ? `Suite à votre réclamation, nous avons mis en œuvre les mesures nécessaires et clôturons votre dossier. Merci d'avoir contribué à l'amélioration continue de nos prestations.`
            : `Suite à l'analyse de votre réclamation, voici les mesures correctives que nous mettons en place.`,
          metadata: [
            ['Référence', rec.numero || ''],
            ['Objet', rec.objet || ''],
            ...(action ? [['Action corrective', action] as [string, string]] : []),
            ...(isClosed && closure ? [['Conclusion', closure] as [string, string]] : []),
          ],
          footerNote: 'Si la résolution ne vous satisfait pas, vous pouvez nous répondre directement à cet email.',
        })
      }
    } catch (e) { console.error('[email reclamation reponse]', e) }
  }

  await logAudit({ action: 'update_status', entity_type: 'reclamation', entity_id: id, details: { status } })
  revalidatePath('/dashboard/reclamations')
  return { success: true }
}

export async function createActionAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const titre = formData.get('titre') as string
  const description = formData.get('description') as string
  const source = formData.get('source') as string
  const reclamation_id = formData.get('reclamation_id') as string
  const priorite = formData.get('priorite') as string
  const responsable_id = formData.get('responsable_id') as string
  const date_echeance = formData.get('date_echeance') as string

  if (!titre) return { success: false, error: 'Titre requis' }

  const { data, error } = await supabase
    .from('actions_amelioration')
    .insert({
      organization_id: session.organization.id,
      titre,
      description: description || null,
      source: source || 'interne',
      reclamation_id: reclamation_id || null,
      priorite: priorite || 'moyenne',
      responsable_id: responsable_id || null,
      date_echeance: date_echeance || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'create', entity_type: 'action_amelioration', entity_id: data.id })
  revalidatePath('/dashboard/reclamations')
  return { success: true, data }
}

export async function updateActionStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updateData: Record<string, unknown> = { status }
  if (status === 'realisee') updateData.date_realisation = new Date().toISOString().split('T')[0]
  if (status === 'verifiee') updateData.date_verification = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('actions_amelioration')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/reclamations')
  return { success: true }
}

export async function deleteReclamationAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('reclamations').delete().eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/reclamations')
  return { success: true }
}
