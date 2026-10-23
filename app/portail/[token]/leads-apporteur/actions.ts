'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPortalContext } from '@/lib/portal-auth'
import { sendNewLeadFromApporteurEmail } from '@/lib/email'

/** Leads qu'un apporteur peut transmettre sur 24 heures glissantes : chacun part en mail et en notifications à l'équipe. */
const LEADS_PAR_JOUR = 20

/**
 * Le gabarit du mail à l'équipe n'échappe pas le HTML : toute valeur saisie
 * par l'apporteur passe par ici, et aucune balise ne passe. Comme dans
 * lib/email.ts, « & » et l'apostrophe restent tels quels : sans balise ni
 * guillemet ils ne peuvent rien injecter, et l'objet du mail, qui reprend le
 * nom de l'apporteur, ne montre pas d'entités.
 */
const esc = (v: unknown) => String(v ?? '').replace(/[<>"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

export async function submitLeadFromPortalAction(
  token: string,
  formData: FormData
): Promise<{ success: boolean; error?: string; errors?: Record<string, string> }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'apporteur') {
    return { success: false, error: 'Accès non autorisé.' }
  }

  const contact_nom = (formData.get('contact_nom') as string || '').trim()
  const contact_prenom = (formData.get('contact_prenom') as string || '').trim()
  const contact_email = (formData.get('contact_email') as string || '').trim()
  const contact_telephone = (formData.get('contact_telephone') as string || '').trim()
  const contact_poste = (formData.get('contact_poste') as string || '').trim()
  const entreprise = (formData.get('entreprise') as string || '').trim()
  const siret = (formData.get('siret') as string || '').trim()
  const formation_souhaitee = (formData.get('formation_souhaitee') as string || '').trim()
  const nombre_stagiaires_raw = (formData.get('nombre_stagiaires') as string || '').trim()
  const date_souhaitee = (formData.get('date_souhaitee') as string || '').trim()
  const commentaire = (formData.get('commentaire') as string || '').trim()

  // Validation
  const errors: Record<string, string> = {}
  if (!contact_nom) errors.contact_nom = 'Le nom du contact est requis.'
  if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    errors.contact_email = 'Adresse email invalide.'
  }
  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  const nombre_stagiaires = nombre_stagiaires_raw ? parseInt(nombre_stagiaires_raw, 10) : null

  const supabase = await createServiceRoleClient()

  // Plafond de dépôts : le lien n'expire pas, et chaque lead déclenche un mail
  // et des notifications à toute l'équipe
  const { count: deposes, error: erreurCompte } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('apporteur_id', context.apporteur.id)
    .eq('source', 'apporteur_affaires')
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  if (erreurCompte) {
    console.error('[submitLeadFromPortalAction] Count error:', erreurCompte)
    return { success: false, error: 'Erreur lors de la création du lead. Veuillez réessayer.' }
  }
  if ((deposes || 0) >= LEADS_PAR_JOUR) {
    return { success: false, error: `Vous avez déjà transmis ${LEADS_PAR_JOUR} leads ces dernières 24 heures. Réessayez demain, ou écrivez directement à l'équipe ${context.organization.name}.` }
  }

  // Franchise : on ne fait confiance à aucun id venant du formulaire, on vérifie
  // qu'il appartient bien à l'organisation de l'apporteur avant de l'enregistrer
  const franchiseIdRaw = (formData.get('franchise_id') as string || '').trim()
  let franchise_id: string | null = null
  if (franchiseIdRaw) {
    const { data: fr } = await supabase
      .from('franchises')
      .select('id')
      .eq('id', franchiseIdRaw)
      .eq('organization_id', context.organization.id)
      .maybeSingle()
    franchise_id = fr?.id || null
  }

  // Insert lead
  const { data: newLead, error: insertError } = await supabase
    .from('leads')
    .insert({
      organization_id: context.organization.id,
      apporteur_id: context.apporteur.id,
      source: 'apporteur_affaires',
      status: 'nouveau',
      contact_nom: contact_nom || null,
      contact_prenom: contact_prenom || null,
      contact_email: contact_email || null,
      contact_telephone: contact_telephone || null,
      entreprise: entreprise || null,
      franchise_id,
      formation_souhaitee: formation_souhaitee || null,
      nombre_stagiaires: nombre_stagiaires,
      date_souhaitee: date_souhaitee || null,
      commentaire: commentaire || null,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[submitLeadFromPortalAction] Insert error:', insertError)
    return { success: false, error: 'Erreur lors de la création du lead. Veuillez réessayer.' }
  }

  // Fetch admin/gestionnaire users to notify
  const { data: adminUsers } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, role')
    .eq('organization_id', context.organization.id)
    .in('role', ['super_admin', 'gestionnaire'])
    .eq('status', 'active')

  const apporteurFullName = [context.apporteur.prenom, context.apporteur.nom].filter(Boolean).join(' ')

  // Create notifications
  if (adminUsers && adminUsers.length > 0) {
    const notifications = (adminUsers as any[]).map((u: any) => ({
      organization_id: context.organization.id,
      user_id: u.id,
      titre: 'Nouveau lead apporté',
      message: `Lead de ${contact_prenom} ${contact_nom}${entreprise ? ` (${entreprise})` : ''} soumis par ${apporteurFullName}`,
      lien_url: '/dashboard/leads',
      type: 'info',
    }))

    await supabase.from('notifications').insert(notifications)
  }

  // Fetch org info and send email to first super_admin
  const { data: org } = await supabase
    .from('organizations')
    .select('name, email')
    .eq('id', context.organization.id)
    .single()

  const adminEmail =
    (adminUsers as any[] | null)?.find((u: any) => u.role === 'super_admin')?.email ||
    (adminUsers as any[] | null)?.[0]?.email ||
    (org as any)?.email ||
    'digital@lab-learning.fr'

  if (org) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
    // Valeurs échappées pour le mail seulement : le lead garde la saisie d'origine
    await sendNewLeadFromApporteurEmail({
      adminEmail,
      orgName: (org as any).name || context.organization.name,
      apporteurName: esc(apporteurFullName),
      apporteurEmail: esc(context.apporteur.email || ''),
      lead: {
        contact_prenom: esc(contact_prenom),
        contact_nom: esc(contact_nom),
        contact_email: esc(contact_email),
        contact_telephone: esc(contact_telephone),
        entreprise: esc(entreprise),
        formation_souhaitee: esc(formation_souhaitee),
        nombre_stagiaires: esc(nombre_stagiaires_raw),
        date_souhaitee: esc(date_souhaitee),
        commentaire: esc(commentaire),
      },
      dashboardUrl: `${appUrl}/dashboard/leads${newLead ? `/${newLead.id}` : ''}`,
    })
  }

  return { success: true }
}
