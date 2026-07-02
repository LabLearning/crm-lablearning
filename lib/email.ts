import { createServerSupabaseClient } from '@/lib/supabase/server'

interface SendEmailParams {
  organizationId: string
  templateSlug: string
  toEmail: string
  toName?: string
  variables: Record<string, string>
  entityType?: string
  entityId?: string
  triggeredBy?: string
}

// Base HTML wrapper for all emails
function wrapInLayout(content: string, orgName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
  <tr><td style="background:linear-gradient(135deg,#1E40AF,#3B82F6);padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${orgName}</h1>
  </td></tr>
  <tr><td style="padding:32px;color:#334155;font-size:15px;line-height:1.6;">
    ${content}
  </td></tr>
  <tr><td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">${orgName} — Organisme de formation</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '')
  }
  return rendered
}

export async function sendTemplateEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string; emailLogId?: string }> {
  const supabase = await createServerSupabaseClient()

  // Fetch template
  const { data: template } = await supabase
    .from('email_templates')
    .select('*')
    .eq('organization_id', params.organizationId)
    .eq('slug', params.templateSlug)
    .eq('is_active', true)
    .single()

  if (!template) {
    return { success: false, error: `Template "${params.templateSlug}" introuvable ou inactif` }
  }

  // Fetch org info
  const { data: org } = await supabase
    .from('organizations')
    .select('name, email')
    .eq('id', params.organizationId)
    .single()

  const allVars = {
    ...params.variables,
    nom_organisme: org?.name || '',
  }

  const subject = renderTemplate(template.sujet, allVars)
  const htmlBody = renderTemplate(template.corps_html, allVars)
  const fullHtml = wrapInLayout(htmlBody, org?.name || 'Lab Learning')

  // Log the email
  const { data: emailLog } = await supabase
    .from('email_logs')
    .insert({
      organization_id: params.organizationId,
      to_email: params.toEmail,
      to_name: params.toName || null,
      subject,
      template: params.templateSlug,
      variables: allVars,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      triggered_by: params.triggeredBy || null,
      status: 'pending',
    })
    .select()
    .single()

  // Send via Resend
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      // Dev mode: just mark as sent
      if (emailLog) {
        await supabase.from('email_logs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', emailLog.id)
      }
      console.log(`[Email] DEV MODE — To: ${params.toEmail}, Subject: ${subject}`)
      return { success: true, emailLogId: emailLog?.id }
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${org?.name || 'Lab Learning'} <${org?.email || 'noreply@lab-learning.fr'}>`,
        to: [params.toEmail],
        subject,
        html: fullHtml,
      }),
    })

    const result = await response.json()

    if (response.ok) {
      if (emailLog) {
        await supabase.from('email_logs').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_id: result.id,
        }).eq('id', emailLog.id)
      }
      return { success: true, emailLogId: emailLog?.id }
    } else {
      if (emailLog) {
        await supabase.from('email_logs').update({
          status: 'failed',
          error: result.message || 'Erreur Resend',
        }).eq('id', emailLog.id)
      }
      return { success: false, error: result.message || 'Erreur d\'envoi' }
    }
  } catch (err) {
    if (emailLog) {
      await supabase.from('email_logs').update({
        status: 'failed',
        error: String(err),
      }).eq('id', emailLog.id)
    }
    return { success: false, error: 'Erreur réseau' }
  }
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrateur',
  gestionnaire: 'Gestionnaire',
  directeur_commercial: 'Directeur Commercial',
  commercial: 'Commercial',
  apporteur_affaires: 'Apporteur d\'affaires',
  formateur: 'Formateur',
  apprenant: 'Apprenant',
  franchise: 'Franchise',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Accès complet à toutes les fonctionnalités du CRM',
  gestionnaire: 'Gestion des formations, apprenants, dossiers et conventions',
  directeur_commercial: 'Pilotage équipe commerciale, pipeline, reporting et apporteurs',
  commercial: 'Pipeline commercial, leads, outils de prospection et simulateur OPCO',
  apporteur_affaires: 'Soumission de leads, suivi de vos commissions et dossiers',
  formateur: 'Gestion de vos sessions, émargement et suivi des apprenants',
  apprenant: 'Accès à vos formations, documents et questionnaires',
  franchise: 'Tableau de bord de votre réseau : établissements, audits, formations et commissions',
}

// Icônes Lucide pré-rendues en PNG blanc 128×128, self-hostées dans le bucket
// 'organisation' (public). Construits une fois par scripts/email-icons.mjs.
// Self-host = pas de dépendance externe → 100% fiable dans tous les clients mail.
const ICONS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/organisation/icons`

const ROLE_ICON_URLS: Record<string, string> = {
  super_admin: `${ICONS_BASE}/shield-check.png`,
  gestionnaire: `${ICONS_BASE}/settings-2.png`,
  directeur_commercial: `${ICONS_BASE}/trending-up.png`,
  commercial: `${ICONS_BASE}/target.png`,
  apporteur_affaires: `${ICONS_BASE}/handshake.png`,
  formateur: `${ICONS_BASE}/graduation-cap.png`,
  apprenant: `${ICONS_BASE}/book-open.png`,
  franchise: `${ICONS_BASE}/building-2.png`,
}

// ── Shared email shell ──────────────────────────────────────
export function emailShell(opts: {
  body: string
  orgName: string
  orgEmail?: string
  orgLogoUrl?: string
  qualiopiCertified?: boolean
  badge?: string
  badgeColor?: string
}): string {
  const badge = opts.badge
    ? `<td align="right" style="vertical-align:top;">
        <div style="background-color:${opts.badgeColor || 'rgba(255,255,255,0.18)'};border-radius:20px;padding:5px 14px;display:inline-block;">
          <span style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${opts.badge}</span>
        </div>
      </td>`
    : ''

  // Logo en image si fourni, sinon nom de l'OF en texte
  const brandMark = opts.orgLogoUrl
    ? `<img src="${opts.orgLogoUrl}" alt="${opts.orgName}" height="32" style="display:block;height:32px;width:auto;border:0;outline:none;text-decoration:none;">`
    : `<span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">${opts.orgName}</span>`

  const taglineText = opts.qualiopiCertified === false
    ? 'Organisme de formation'
    : 'Formation professionnelle certifiée Qualiopi'
  const footerSuffix = opts.qualiopiCertified === false
    ? ' &mdash; Organisme de formation'
    : ' &mdash; Organisme de formation certifié Qualiopi'
  const orgEmail = opts.orgEmail || ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;">

  <!-- Header -->
  <tr><td style="background-color:#195144;border-radius:12px 12px 0 0;padding:24px 32px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td>
        ${brandMark}
        <div style="margin-top:4px;color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:0.3px;">${taglineText}</div>
      </td>
      ${badge}
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background-color:#ffffff;padding:36px 32px;">${opts.body}</td></tr>

  <!-- Footer -->
  <tr><td style="background-color:#fafafa;border-radius:0 0 12px 12px;border-top:1px solid #e4e4e7;padding:20px 32px;text-align:center;">
    <span style="color:#71717a;font-size:12px;font-weight:600;">${opts.orgName}</span>
    <span style="color:#a1a1aa;font-size:11px;">${footerSuffix}</span>
    ${orgEmail ? `<div style="margin-top:6px;color:#a1a1aa;font-size:11px;">
      <a href="mailto:${orgEmail}" style="color:#195144;text-decoration:none;">${orgEmail}</a>
    </div>` : ''}
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export function ctaButton(href: string, label: string, color?: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:28px 0;">
  <tr><td align="center">
    <a href="${href}" target="_blank" style="display:inline-block;padding:14px 48px;background-color:${color || '#195144'};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:-0.2px;">
      ${label}
    </a>
  </td></tr></table>`
}

// ── Invitation email ────────────────────────────────────────
function buildInvitationHtml(params: {
  inviteUrl: string
  role: string
  orgName: string
  invitedByName: string
  orgEmail?: string
  orgLogoUrl?: string
  qualiopiCertified?: boolean
}): string {
  const roleLabel = ROLE_LABELS[params.role] || params.role
  const roleDesc = ROLE_DESCRIPTIONS[params.role] || ''
  const roleIconUrl = ROLE_ICON_URLS[params.role] || `${ICONS_BASE}/shield-check.png`

  const body = `
    <h1 style="margin:0 0 6px;color:#18181b;font-size:22px;font-weight:700;">Vous êtes invité(e)</h1>
    <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
      <strong style="color:#18181b;">${params.invitedByName}</strong> vous invite à rejoindre
      <strong style="color:#195144;">${params.orgName}</strong>.
    </p>

    <!-- Role -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      <tr><td style="background-color:#f4f4f5;border-radius:10px;padding:20px;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="vertical-align:top;padding-right:14px;">
            <div style="width:44px;height:44px;background-color:#195144;border-radius:10px;text-align:center;padding:10px;box-sizing:border-box;">
              <img src="${roleIconUrl}" alt="" width="24" height="24" style="display:block;width:24px;height:24px;border:0;outline:none;text-decoration:none;">
            </div>
          </td>
          <td>
            <div style="color:#18181b;font-size:16px;font-weight:700;margin-bottom:2px;">${roleLabel}</div>
            <div style="color:#71717a;font-size:13px;line-height:1.5;">${roleDesc}</div>
          </td>
        </tr></table>
      </td></tr>
    </table>

    <!-- Steps -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:4px;">
      ${[
        ['1', 'Cliquez sur le bouton ci-dessous'],
        ['2', 'Définissez votre mot de passe'],
        ['3', 'Accédez à votre tableau de bord'],
      ].map(([n, text]) => `
      <tr><td style="padding:5px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="width:28px;height:28px;background-color:#195144;border-radius:50%;text-align:center;line-height:28px;">
            <span style="color:#fff;font-size:12px;font-weight:800;">${n}</span>
          </td>
          <td style="padding-left:12px;color:#3f3f46;font-size:14px;">${text}</td>
        </tr></table>
      </td></tr>`).join('')}
    </table>

    ${ctaButton(params.inviteUrl, 'Créer mon compte')}

    <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;line-height:1.6;">
      Ce lien est valable 7 jours. Si vous n'attendiez pas cette invitation, ignorez cet email.
    </p>`

  return emailShell({
    body,
    orgName: params.orgName,
    orgEmail: params.orgEmail,
    orgLogoUrl: params.orgLogoUrl,
    qualiopiCertified: params.qualiopiCertified,
  })
}

/**
 * Envoi générique d'un email branded (HTML déjà rendu via emailShell).
 * Utiliser pour : signatures, convocations, attestations, factures, etc.
 * Supporte les pièces jointes (PDF) via attachments[].
 */
export async function sendBrandedEmail(params: {
  to: string | string[]
  subject: string
  html: string
  orgName: string
  orgEmail?: string  // adresse reply-to (mail de l'OF)
  fromAddress?: string  // expéditeur (doit être sur domaine vérifié dans Resend)
  attachments?: Array<{ filename: string; content: string; contentType?: string }>  // base64
}): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY
  const recipients = Array.isArray(params.to) ? params.to : [params.to]
  if (!resendApiKey) {
    console.log(`[Branded Email] DEV MODE — To: ${recipients.join(',')} · Subject: ${params.subject}`)
    return { success: true }
  }
  const from = `${params.orgName} <${params.fromAddress || 'noreply@lab-learning.fr'}>`
  const body: any = {
    from,
    to: recipients,
    subject: params.subject,
    html: params.html,
    reply_to: params.orgEmail || undefined,
  }
  if (params.attachments && params.attachments.length > 0) body.attachments = params.attachments

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendApiKey}` },
    body: JSON.stringify(body),
  })
  if (response.ok) return { success: true }
  const err = await response.json().catch(() => ({}))
  return { success: false, error: err.message || 'Erreur Resend' }
}

/**
 * Email "document disponible" : layout brandé standardisé pour tous les envois
 * de pièces (convocation, livret, attestation, certificat, facture, devis...).
 * - intro + tableau metadata (couples label/valeur)
 * - CTA optionnel (vers le portail)
 * - PDF attaché si pdfBuffer fourni
 */
export async function sendDocumentEmail(params: {
  to: string | string[]
  orgName: string
  orgEmail?: string
  orgLogoUrl?: string | null
  qualiopiCertified?: boolean
  fromAddress?: string
  recipientName: string
  subject: string
  docTitle: string            // "Votre convocation à la formation"
  intro: string               // "Vous êtes attendu pour la formation suivante."
  metadata?: Array<[string, string]>
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
  pdfBuffer?: Buffer | Uint8Array
  pdfFilename?: string
  attachmentContentType?: string  // défaut application/pdf
}): Promise<{ success: boolean; error?: string }> {
  const fileExt = (params.pdfFilename?.split('.').pop() || 'DOC').toUpperCase().slice(0, 4)
  const metaRows = (params.metadata || [])
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#71717a;font-size:12px;width:130px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">${k}</td><td style="padding:6px 0;color:#18181b;font-size:14px;">${v}</td></tr>`)
    .join('')

  const body = `
    <h1 style="margin:0 0 6px;color:#18181b;font-size:22px;font-weight:700;">${params.docTitle}</h1>
    <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
      Bonjour <strong style="color:#18181b;">${params.recipientName}</strong>,<br>
      ${params.intro}
    </p>
    ${metaRows ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      <tr><td style="background-color:#f4f4f5;border-radius:10px;padding:14px 22px;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%">${metaRows}</table>
      </td></tr>
    </table>` : ''}
    ${params.pdfFilename ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
      <tr><td style="background-color:#eef7f3;border:1px solid #cfe3db;border-radius:8px;padding:12px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <div style="width:28px;height:28px;background-color:#195144;border-radius:6px;text-align:center;line-height:28px;color:#fff;font-size:10px;font-weight:800;">${fileExt}</div>
          </td>
          <td><span style="color:#195144;font-size:13px;font-weight:600;">${params.pdfFilename}</span><br><span style="color:#71717a;font-size:11px;">Document joint à cet email</span></td>
        </tr></table>
      </td></tr>
    </table>` : ''}
    ${params.ctaUrl && params.ctaLabel ? ctaButton(params.ctaUrl, params.ctaLabel) : ''}
    ${params.footerNote ? `<p style="margin:8px 0 0;color:#a1a1aa;font-size:12px;text-align:center;line-height:1.6;">${params.footerNote}</p>` : ''}`

  const html = emailShell({
    body,
    orgName: params.orgName,
    orgEmail: params.orgEmail,
    orgLogoUrl: params.orgLogoUrl || undefined,
    qualiopiCertified: params.qualiopiCertified,
  })

  const attachments = params.pdfBuffer && params.pdfFilename
    ? [{
        filename: params.pdfFilename,
        content: Buffer.from(params.pdfBuffer).toString('base64'),
        contentType: params.attachmentContentType || 'application/pdf',
      }]
    : undefined

  return sendBrandedEmail({
    to: params.to,
    orgName: params.orgName,
    orgEmail: params.orgEmail,
    fromAddress: params.fromAddress,
    subject: params.subject,
    html,
    attachments,
  })
}

export async function sendInvitationEmail(params: {
  toEmail: string
  role: string
  orgName: string
  orgEmail: string
  invitedByName: string
  inviteUrl: string
  orgLogoUrl?: string | null
  qualiopiCertified?: boolean
  fromAddress?: string  // adresse d'envoi (doit être sur un domaine vérifié dans Resend)
}): Promise<{ success: boolean; error?: string }> {
  const subject = `Invitation à rejoindre ${params.orgName}`
  const html = buildInvitationHtml({
    inviteUrl: params.inviteUrl,
    role: params.role,
    orgName: params.orgName,
    invitedByName: params.invitedByName,
    orgEmail: params.orgEmail,
    orgLogoUrl: params.orgLogoUrl || undefined,
    qualiopiCertified: params.qualiopiCertified,
  })

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.log(`[Invitation Email] DEV MODE — To: ${params.toEmail}`)
    console.log(`[Invitation Email] Invite URL: ${params.inviteUrl}`)
    return { success: true }
  }

  // L'expéditeur DOIT être sur un domaine vérifié dans Resend.
  // Par défaut on utilise noreply@lab-learning.fr (vérifié) ; fromAddress permet d'override pour les futurs OF.
  const from = `${params.orgName} <${params.fromAddress || 'noreply@lab-learning.fr'}>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [params.toEmail],
      subject,
      html,
      reply_to: params.orgEmail || undefined,
    }),
  })

  const body = await response.json().catch(() => ({} as any))

  if (!response.ok) {
    return { success: false, error: body.message || `Erreur Resend (${response.status})` }
  }

  // Resend accepte l'envoi (200 + id) même si l'adresse est sur sa liste de
  // suppression : l'email est alors marqué "suppressed" et jamais délivré.
  // On relit le statut pour détecter ce cas et le remonter à l'appelant.
  const emailId = body.id as string | undefined
  if (emailId) {
    try {
      const check = await fetch(`https://api.resend.com/emails/${emailId}`, {
        headers: { 'Authorization': `Bearer ${resendApiKey}` },
      })
      if (check.ok) {
        const detail = await check.json().catch(() => ({} as any))
        const event = detail.last_event as string | undefined
        if (event && ['suppressed', 'bounced', 'failed'].includes(event)) {
          const reason = event === 'suppressed'
            ? `l'adresse ${params.toEmail} est sur la liste de suppression Resend (bounce ou plainte antérieurs). Retirez-la dans Resend → Suppressions avant de réessayer.`
            : `l'adresse ${params.toEmail} a rejeté l'envoi (${event}).`
          return { success: false, error: `Email non délivré : ${reason}` }
        }
      }
    } catch {
      // best-effort : si la relecture échoue, on considère l'envoi accepté
    }
  }

  return { success: true }
}

type PortalType = 'apprenant' | 'formateur' | 'client' | 'apporteur' | 'partenaire'

const PORTAL_CONFIG: Record<PortalType, { title: string; subtitle: string; accesses: string[] }> = {
  apprenant: {
    title: 'Apprenant',
    subtitle: 'Votre espace de formation personnel',
    accesses: [
      'Consulter vos formations et votre planning',
      'Accéder à vos documents et attestations',
      'Passer vos questionnaires et QCM',
      'Voir vos évaluations de satisfaction',
    ],
  },
  formateur: {
    title: 'Formateur',
    subtitle: 'Votre interface de gestion des sessions',
    accesses: [
      'Consulter votre planning de sessions',
      'Gérer l\'émargement numérique',
      'Suivre vos apprenants par session',
      'Accéder à vos documents de formation',
    ],
  },
  client: {
    title: 'Client',
    subtitle: 'L\'espace dédié à votre entreprise',
    accesses: [
      'Suivre le planning de vos formations',
      'Consulter et signer vos conventions',
      'Accéder à vos factures',
      'Gérer vos documents',
    ],
  },
  apporteur: {
    title: 'Apporteur',
    subtitle: 'Votre tableau de bord apporteur d\'affaires',
    accesses: [
      'Suivre vos leads apportés et leur avancement',
      'Consulter le détail de vos commissions',
      'Voir le statut de chaque dossier',
    ],
  },
  partenaire: {
    title: 'Partenaire',
    subtitle: 'Votre tableau de bord franchise',
    accesses: [
      'Tableau de bord avec CA et indicateurs clés',
      'Suivre vos sessions de formation',
      'Consulter vos commissions en temps réel',
      'Gérer vos dossiers de formation',
    ],
  },
}

function buildPortalAccessHtml(params: {
  portalUrl: string
  portalType: PortalType
  firstName: string
  orgName: string
  orgEmail?: string
  orgLogoUrl?: string
  qualiopiCertified?: boolean
}): string {
  const config = PORTAL_CONFIG[params.portalType]

  const body = `
    <h1 style="margin:0 0 6px;color:#18181b;font-size:22px;font-weight:700;">
      Bonjour ${params.firstName},
    </h1>
    <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
      <strong style="color:#195144;">${params.orgName}</strong> vous ouvre l'accès à votre espace personnel.
      ${config.subtitle}.
    </p>

    <!-- Access list -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      <tr><td style="background-color:#f4f4f5;border-radius:10px;padding:18px 22px;">
        <div style="color:#3f3f46;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;">Ce que vous pouvez faire</div>
        ${config.accesses.map(a => `
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:8px;"><tr>
          <td style="width:22px;vertical-align:top;padding-top:1px;">
            <div style="width:18px;height:18px;background-color:#195144;border-radius:50%;text-align:center;line-height:18px;">
              <span style="color:#fff;font-size:10px;">&#10003;</span>
            </div>
          </td>
          <td style="padding-left:10px;color:#3f3f46;font-size:14px;line-height:1.5;">${a}</td>
        </tr></table>`).join('')}
      </td></tr>
    </table>

    <!-- Note -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:4px;">
      <tr><td style="background-color:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
        <span style="color:#854d0e;font-size:13px;line-height:1.5;">
          <strong>Accès simplifié</strong> &mdash; Aucun mot de passe requis. Cliquez sur le bouton pour accéder directement.
        </span>
      </td></tr>
    </table>

    ${ctaButton(params.portalUrl, 'Accéder à mon espace')}

    <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;line-height:1.6;">
      Ce lien est personnel et sécurisé. Ne le partagez pas.
    </p>`

  return emailShell({
    body,
    orgName: params.orgName,
    orgEmail: params.orgEmail,
    orgLogoUrl: params.orgLogoUrl,
    qualiopiCertified: params.qualiopiCertified,
    badge: config.title,
  })
}

export async function sendPortalAccessEmail(params: {
  toEmail: string
  firstName: string
  portalType: PortalType
  portalUrl: string
  orgName: string
  orgEmail: string
  orgLogoUrl?: string | null
  qualiopiCertified?: boolean
  fromAddress?: string
}): Promise<{ success: boolean; error?: string }> {
  const config = PORTAL_CONFIG[params.portalType]
  const subject = `Votre espace ${config.title} est prêt — ${params.orgName}`
  const html = buildPortalAccessHtml({
    portalUrl: params.portalUrl,
    portalType: params.portalType,
    firstName: params.firstName,
    orgName: params.orgName,
    orgEmail: params.orgEmail,
    orgLogoUrl: params.orgLogoUrl || undefined,
    qualiopiCertified: params.qualiopiCertified,
  })

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.log(`[Portal Email] DEV MODE — Type: ${params.portalType}, To: ${params.toEmail}`)
    console.log(`[Portal Email] URL: ${params.portalUrl}`)
    return { success: true }
  }

  const from = `${params.orgName} <${params.fromAddress || 'noreply@lab-learning.fr'}>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [params.toEmail],
      subject,
      html,
      reply_to: params.orgEmail || undefined,
    }),
  })

  if (response.ok) return { success: true }
  const err = await response.json()
  return { success: false, error: err.message || 'Erreur Resend' }
}

export async function sendNewLeadFromApporteurEmail(params: {
  adminEmail: string
  orgName: string
  apporteurName: string
  apporteurEmail: string
  lead: {
    contact_prenom: string
    contact_nom: string
    contact_email: string
    contact_telephone: string
    entreprise: string
    formation_souhaitee: string
    nombre_stagiaires: string
    date_souhaitee: string
    commentaire: string
  }
  dashboardUrl: string
}): Promise<{ success: boolean; error?: string }> {
  const { adminEmail, orgName, apporteurName, apporteurEmail, lead, dashboardUrl } = params

  const rows: Array<[string, string]> = [
    ['Prénom', lead.contact_prenom],
    ['Nom', lead.contact_nom],
    ['Email', lead.contact_email],
    ['Téléphone', lead.contact_telephone],
    ['Entreprise', lead.entreprise],
    ['Formation souhaitée', lead.formation_souhaitee],
    ['Nombre de stagiaires', lead.nombre_stagiaires],
    ['Date souhaitée', lead.date_souhaitee],
    ['Commentaire', lead.commentaire],
  ]

  const tableRows = rows
    .filter(([, val]) => val && val.trim() !== '')
    .map(
      ([label, val]) => `
      <tr>
        <td style="padding:10px 14px;color:#71717a;font-size:13px;font-weight:600;white-space:nowrap;border-bottom:1px solid #f4f4f5;">${label}</td>
        <td style="padding:10px 14px;color:#18181b;font-size:13px;border-bottom:1px solid #f4f4f5;">${val}</td>
      </tr>`
    )
    .join('')

  const body = `
    <h1 style="margin:0 0 6px;color:#18181b;font-size:22px;font-weight:700;">Nouveau lead soumis</h1>
    <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
      Soumis par <strong style="color:#195144;">${apporteurName}</strong>
      (<a href="mailto:${apporteurEmail}" style="color:#195144;text-decoration:none;">${apporteurEmail}</a>)
    </p>

    <!-- Lead details -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:8px;border:1px solid #e4e4e7;border-radius:10px;overflow:hidden;">
      <tr><td style="background-color:#f4f4f5;padding:10px 14px;">
        <span style="color:#3f3f46;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">Details du lead</span>
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${tableRows}</table>
      </td></tr>
    </table>

    ${ctaButton(dashboardUrl, 'Voir dans le CRM')}`

  const html = emailShell({ body, orgName, badge: 'Lead entrant' })

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.log(`[New Lead Email] DEV MODE — To: ${adminEmail}, Apporteur: ${apporteurName}`)
    return { success: true }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `${orgName} <digital@lab-learning.fr>`,
      to: [adminEmail],
      subject: `Nouveau lead apporté par ${apporteurName} — ${orgName}`,
      html,
    }),
  })

  if (response.ok) return { success: true }
  const err = await response.json()
  return { success: false, error: err.message || 'Erreur Resend' }
}

export async function createNotification(params: {
  organizationId: string
  userId: string
  titre: string
  message: string
  type?: string
  lienUrl?: string
  lienLabel?: string
  entityType?: string
  entityId?: string
}) {
  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceRoleClient()

  await supabase.from('notifications').insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    titre: params.titre,
    message: params.message,
    type: params.type || 'info',
    lien_url: params.lienUrl || null,
    lien_label: params.lienLabel || null,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
  })
}

/**
 * Crée plusieurs notifications en une seule requête (utile pour notifier toute une équipe).
 * Skippe les user_id en doublon et le `excludeUserId` (typiquement l'auteur de l'action).
 */
export async function createNotifications(notifs: Array<{
  organizationId: string
  userId: string
  titre: string
  message: string
  type?: string
  lienUrl?: string
  lienLabel?: string
  entityType?: string
  entityId?: string
}>) {
  if (notifs.length === 0) return
  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceRoleClient()
  await supabase.from('notifications').insert(
    notifs.map((p) => ({
      organization_id: p.organizationId,
      user_id: p.userId,
      titre: p.titre,
      message: p.message,
      type: p.type || 'info',
      lien_url: p.lienUrl || null,
      lien_label: p.lienLabel || null,
      entity_type: p.entityType || null,
      entity_id: p.entityId || null,
    })),
  )
}
