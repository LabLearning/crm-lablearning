/**
 * Notifie tous les comptes franchise (role='franchise') rattachés à une franchise.
 * Si `notif.email` est fourni, envoie aussi un email brandé à chaque user.
 * Best-effort : n'interrompt jamais l'action appelante en cas d'erreur.
 */
export async function notifyFranchiseUsers(
  supabase: any,
  franchiseId: string | null | undefined,
  organizationId: string,
  notif: {
    titre: string
    message: string
    type?: string
    lienUrl?: string
    lienLabel?: string
    entityType?: string
    entityId?: string
    email?: {
      subject: string
      docTitle: string
      intro: string
      metadata?: Array<[string, string]>
      ctaLabel?: string
      ctaUrl?: string
    }
  },
) {
  if (!franchiseId) return
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('organization_id', organizationId)
      .eq('franchise_id', franchiseId)
      .eq('role', 'franchise')
      .eq('status', 'active')

    if (!users || users.length === 0) return

    const { createNotifications, sendDocumentEmail } = await import('@/lib/email')
    await createNotifications(
      users.map((u: any) => ({
        organizationId,
        userId: u.id,
        titre: notif.titre,
        message: notif.message,
        type: notif.type || 'info',
        lienUrl: notif.lienUrl,
        lienLabel: notif.lienLabel,
        entityType: notif.entityType,
        entityId: notif.entityId,
      })),
    )

    // Email brandé optionnel
    if (notif.email) {
      const { data: org } = await supabase.from('organizations').select('*').eq('id', organizationId).single()
      for (const u of users) {
        if (!u.email) continue
        try {
          await sendDocumentEmail({
            to: u.email,
            orgName: org?.name || 'Lab Learning',
            orgEmail: (org as any)?.email_contact || org?.email,
            orgLogoUrl: (org as any)?.logo_url,
            qualiopiCertified: (org as any)?.is_qualiopi !== false,
            recipientName: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Madame, Monsieur',
            subject: notif.email.subject,
            docTitle: notif.email.docTitle,
            intro: notif.email.intro,
            metadata: notif.email.metadata,
            ctaLabel: notif.email.ctaLabel || (notif.lienUrl ? 'Voir dans mon espace' : undefined),
            ctaUrl: notif.email.ctaUrl || (notif.lienUrl ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}${notif.lienUrl}` : undefined),
          })
        } catch (e) { console.error('[notifyFranchiseUsers email]', e) }
      }
    }
  } catch (e) {
    console.error('[notifyFranchiseUsers]', e)
  }
}
