/**
 * Notifie le compte (role apporteur_affaires) rattaché à une fiche apporteur,
 * dans l'application et par email brandé si demandé. Best-effort : n'interrompt
 * jamais l'action appelante.
 */
export async function notifierApporteur(
  supabase: any,
  apporteurId: string | null | undefined,
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
  if (!apporteurId) return
  try {
    const { data: a } = await supabase.from('apporteurs_affaires').select('user_id, email, prenom, nom').eq('id', apporteurId).maybeSingle()
    if (!a) return
    const { data: u } = a.user_id
      ? await supabase.from('users').select('id, email, first_name, last_name, status').eq('id', a.user_id).eq('organization_id', organizationId).maybeSingle()
      : { data: null }

    const { createNotifications, sendDocumentEmail } = await import('@/lib/email')
    if (u?.id) {
      await createNotifications([{
        organizationId,
        userId: u.id,
        titre: notif.titre,
        message: notif.message,
        type: notif.type || 'info',
        lienUrl: notif.lienUrl,
        lienLabel: notif.lienLabel,
        entityType: notif.entityType,
        entityId: notif.entityId,
      }])
    }

    // Email brandé : au compte s'il existe, sinon à l'adresse de la fiche
    const destinataire = u?.email || a.email
    if (notif.email && destinataire) {
      const { data: org } = await supabase.from('organizations').select('*').eq('id', organizationId).single()
      try {
        await sendDocumentEmail({
          to: destinataire,
          orgName: org?.name || 'Lab Learning',
          orgEmail: (org as any)?.email_contact || org?.email,
          orgLogoUrl: (org as any)?.logo_url,
          qualiopiCertified: (org as any)?.is_qualiopi !== false,
          recipientName: `${u?.first_name || a.prenom || ''} ${u?.last_name || a.nom || ''}`.trim() || 'Madame, Monsieur',
          subject: notif.email.subject,
          docTitle: notif.email.docTitle,
          intro: notif.email.intro,
          metadata: notif.email.metadata,
          ctaLabel: notif.email.ctaLabel || (notif.lienUrl ? 'Voir dans mon espace' : undefined),
          ctaUrl: notif.email.ctaUrl || (notif.lienUrl ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}${notif.lienUrl}` : undefined),
          organizationId,
          entityType: 'apporteur',
          entityId: apporteurId,
        })
      } catch (e) { console.error('[notifierApporteur email]', e) }
    }
  } catch (e) {
    console.error('[notifierApporteur]', e)
  }
}
