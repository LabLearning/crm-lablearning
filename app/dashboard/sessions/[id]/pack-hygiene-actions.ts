'use server'

import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

/**
 * Envoie le Pack Hygiène (classeur PDF unique) au formateur de la session,
 * par email, pour qu'il l'imprime et l'apporte dans l'établissement.
 * `preview` renvoie l'email tel qu'il partirait, sans l'envoyer.
 */
export async function envoyerPackHygieneFormateurAction(
  sessionId: string,
  opts?: { preview?: boolean; message?: string },
): Promise<ActionResult & { data?: { to?: string; subject?: string; html?: string; tailleKo?: number } }> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: sess } = await supabase
    .from('sessions')
    .select('id, reference, date_debut, date_fin, lieu, adresse, code_postal, ville, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial, adresse, code_postal, ville), formateur:formateur_id(id, prenom, nom, email)')
    .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }
  const formateur: any = (sess as any).formateur
  if (!formateur?.email) return { success: false, error: 'Aucun formateur avec email sur cette session' }

  const client: any = (sess as any).client
  const etablissement = client?.nom_commercial || client?.raison_sociale || 'l’établissement'
  const fr = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
  const dates = sess.date_debut === sess.date_fin || !sess.date_fin ? `le ${fr(sess.date_debut)}` : `du ${fr(sess.date_debut)} au ${fr(sess.date_fin)}`
  const lieu = [sess.lieu, sess.adresse, [sess.code_postal, sess.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    || [client?.adresse, [client?.code_postal, client?.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  const { data: org } = await supabase.from('organizations').select('name, email, email_contact, logo_url, is_qualiopi').eq('id', orgId).single()
  const { resolveEmailLogoUrl } = await import('@/lib/pdf/org-logo')
  const emailLogo = await resolveEmailLogoUrl(supabase, org)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const params = {
    to: formateur.email,
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || (org as any)?.email,
    orgLogoUrl: emailLogo || undefined,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: [formateur.prenom, formateur.nom].filter(Boolean).join(' '),
    subject: `Pack Hygiène à imprimer : ${etablissement}, ${dates}`,
    docTitle: 'Votre Pack Hygiène pour la formation',
    intro: `Vous trouverez ci-joint le classeur complet à imprimer et à apporter chez ${etablissement} ${dates} : plan de maîtrise sanitaire personnalisé, affichages obligatoires, livret d’accueil, règlement intérieur, programme et feuilles d’émargement. Les attestations d’hygiène et le diplôme de l’établissement sont en fin de classeur, à remettre le dernier jour.${opts?.message ? `\n\n${opts.message}` : ''}`,
    metadata: [
      ['Établissement', etablissement],
      ['Formation', (sess as any).formation?.intitule || sess.reference || ''],
      ['Dates', dates.charAt(0).toUpperCase() + dates.slice(1)],
      ...(lieu ? [['Lieu', lieu] as [string, string]] : []),
    ] as [string, string][],
    footerNote: 'Le classeur est imprimé recto, dans l’ordre du sommaire. Prévoyez des intercalaires aux pages de séparation.',
  }

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { to: params.to, subject: params.subject, html: buildDocumentEmailHtml(params as any) } }
  }

  // Le classeur, produit par la route (mêmes gabarits, mêmes règles)
  const { GET } = await import('@/app/api/pdf/pack-hygiene/[sessionId]/route')
  const res = await GET(new NextRequest(`${appUrl}/api/pdf/pack-hygiene/${sessionId}?doc=classeur`), { params: { sessionId } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, error: (err as any)?.error || 'Impossible de produire le classeur' }
  }
  const classeur = new Uint8Array(await res.arrayBuffer())
  if (classeur.length > 35 * 1024 * 1024) {
    return { success: false, error: `Classeur trop lourd pour un email (${Math.round(classeur.length / 1024 / 1024)} Mo). Téléchargez-le et transmettez-le autrement.` }
  }

  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    ...params,
    pdfBuffer: classeur,
    pdfFilename: `Pack Hygiene - ${etablissement.replace(/[\\/:*?"<>|]/g, '-')}.pdf`,
    organizationId: orgId,
    entityType: 'session',
    entityId: sessionId,
    triggeredBy: session.user.id,
  } as any)
  if (!r.success) return { success: false, error: r.error || 'Envoi impossible' }

  await logAudit({ action: 'send_pack_hygiene', entity_type: 'session', entity_id: sessionId, details: { to: formateur.email, tailleKo: Math.round(classeur.length / 1024) } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { to: formateur.email, tailleKo: Math.round(classeur.length / 1024) } }
}
