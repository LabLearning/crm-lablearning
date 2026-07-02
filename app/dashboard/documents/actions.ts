'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { sendDocumentEmail } from '@/lib/email'
import type { ActionResult } from '@/lib/types'

const DOCUMENTS_BUCKET = 'documents'

export async function createDocumentAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const nom = formData.get('nom') as string
  const type = formData.get('type') as string
  const requires_signature = formData.get('requires_signature') === 'true'
  const storagePath = (formData.get('storage_path') as string) || null
  const fileSize = formData.get('file_size')

  if (!nom) return { success: false, error: 'Nom requis' }

  const { data, error } = await supabase.from('documents').insert({
    organization_id: session.organization.id,
    nom,
    type: type || 'autre',
    description: (formData.get('description') as string) || null,
    client_id: (formData.get('client_id') as string) || null,
    session_id: (formData.get('session_id') as string) || null,
    dossier_id: (formData.get('dossier_id') as string) || null,
    formateur_id: (formData.get('formateur_id') as string) || null,
    apprenant_id: (formData.get('apprenant_id') as string) || null,
    storage_path: storagePath,
    file_name: (formData.get('file_name') as string) || null,
    file_size: fileSize ? Number(fileSize) : null,
    mime_type: (formData.get('mime_type') as string) || null,
    requires_signature,
    created_by: session.user.id,
  }).select().single()

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'create', entity_type: 'document', entity_id: data.id })
  revalidatePath('/dashboard/documents')
  return { success: true, data }
}

export async function sendDocumentByEmailAction(documentId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const toEmail = (formData.get('recipient_email') as string || '').trim()
  const toName = (formData.get('recipient_name') as string || '').trim()
  const recipientType = (formData.get('recipient_type') as string) || 'libre'
  const subject = (formData.get('subject') as string || '').trim()
  const message = (formData.get('message') as string || '').trim()

  if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return { success: false, error: 'Adresse email invalide' }
  }

  // Document (doit appartenir à l'organisation)
  const { data: doc } = await supabase
    .from('documents')
    .select('id, nom, storage_path, file_name, mime_type')
    .eq('id', documentId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!doc) return { success: false, error: 'Document introuvable' }
  if (!doc.storage_path) return { success: false, error: 'Ce document n\'a pas de fichier joint' }

  // Télécharger le fichier depuis le storage (service role → bypass RLS)
  const { data: blob, error: dlErr } = await supabase.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path)
  if (dlErr || !blob) return { success: false, error: 'Impossible de récupérer le fichier' }
  const buffer = Buffer.from(await blob.arrayBuffer())

  // Infos organisation pour l'email brandé
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', session.organization.id)
    .single()

  const orgAny = (org || {}) as any
  const result = await sendDocumentEmail({
    to: toEmail,
    orgName: orgAny.name || session.organization.name,
    orgEmail: orgAny.email_contact || orgAny.email || undefined,
    orgLogoUrl: orgAny.logo_url || null,
    qualiopiCertified: orgAny.est_qualiopi ?? orgAny.qualiopi_certifie ?? undefined,
    recipientName: toName || 'Madame, Monsieur',
    subject: subject || doc.nom,
    docTitle: doc.nom,
    intro: message || 'Veuillez trouver ci-joint le document.',
    pdfBuffer: buffer,
    pdfFilename: doc.file_name || doc.nom,
    attachmentContentType: doc.mime_type || 'application/octet-stream',
  })

  // Journalisation
  await supabase.from('email_logs').insert({
    organization_id: session.organization.id,
    to_email: toEmail,
    to_name: toName || null,
    subject: subject || doc.nom,
    template: 'document_manuel',
    variables: { recipient_type: recipientType, document_id: documentId },
    entity_type: 'document',
    entity_id: documentId,
    status: result.success ? 'sent' : 'failed',
    error: result.success ? null : (result.error || null),
    sent_at: result.success ? new Date().toISOString() : null,
    triggered_by: session.user.id,
  })

  if (!result.success) return { success: false, error: result.error || 'Échec de l\'envoi' }

  await logAudit({ action: 'send_email', entity_type: 'document', entity_id: documentId })
  return { success: true }
}

export async function requestSignatureAction(documentId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const nom = formData.get('signataire_nom') as string
  const email = formData.get('signataire_email') as string
  const role = formData.get('signataire_role') as string

  if (!nom || !email) return { success: false, error: 'Nom et email requis' }

  const { data, error } = await supabase.from('signatures').insert({
    organization_id: session.organization.id,
    document_id: documentId,
    signataire_nom: nom,
    signataire_email: email,
    signataire_role: role || null,
  }).select().single()

  if (error) return { success: false, error: 'Erreur' }

  // TODO: Send signature email with token

  await logAudit({ action: 'request_signature', entity_type: 'signature', entity_id: data.id })
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard/signatures')
  return { success: true, data: { token: data.token } }
}

export async function signDocumentAction(token: string, signatureData: string): Promise<ActionResult> {
  const supabase = await createServiceRoleClient()

  const { data: sig } = await supabase
    .from('signatures')
    .select('id, status, expire_at')
    .eq('token', token)
    .single()

  if (!sig) return { success: false, error: 'Signature introuvable' }
  if (sig.status !== 'en_attente') return { success: false, error: 'Cette signature a déjà été traitée' }
  if (sig.expire_at && new Date(sig.expire_at) < new Date()) return { success: false, error: 'Le lien de signature a expiré' }

  const { error } = await supabase
    .from('signatures')
    .update({
      status: 'signe',
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
    })
    .eq('id', sig.id)

  if (error) return { success: false, error: 'Erreur' }

  revalidatePath('/dashboard/signatures')
  return { success: true }
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('documents').delete().eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  await logAudit({ action: 'delete', entity_type: 'document', entity_id: id })
  revalidatePath('/dashboard/documents')
  return { success: true }
}
