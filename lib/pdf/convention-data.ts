// Chargement unifié des données nécessaires au PDF de convention
// (utilisé par la route /api/pdf/convention/[id] et par signature-actions).

/**
 * Contact référent signataire du client à faire figurer sur la convention.
 * Priorité : contact désigné sur la convention > contact marqué signataire >
 * contact principal > référent formation > premier contact. Retourne null si
 * le client n'a aucun contact.
 */
export async function loadSignataireContact(
  supabase: any,
  clientId: string | null,
  contactId?: string | null,
) {
  if (!clientId) return null
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, prenom, nom, civilite, poste, service, email, telephone, mobile, est_signataire, est_principal, est_referent_formation')
    .eq('client_id', clientId)
  const list = (contacts || []) as any[]
  return (
    (contactId && list.find((c) => c.id === contactId)) ||
    list.find((c) => c.est_signataire) ||
    list.find((c) => c.est_principal) ||
    list.find((c) => c.est_referent_formation) ||
    list[0] ||
    null
  )
}

export async function loadConventionForPdf(supabase: any, conventionId: string) {
  const { data: convention } = await supabase
    .from('conventions')
    .select('*, client:clients(*), formation:formations(*)')
    .eq('id', conventionId)
    .single()

  if (!convention) return null

  // Session liée (dates, horaires détaillés, lieu)
  let session: any = null
  if (convention.session_id) {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', convention.session_id)
      .single()
    session = data
  }

  // Dossier lié (n° de prise en charge / dossier OPCO)
  let dossier: any = null
  if (convention.dossier_id) {
    const { data } = await supabase
      .from('dossiers_formation')
      .select('numero, numero_prise_en_charge, opco_numero_dossier, montant_prise_en_charge')
      .eq('id', convention.dossier_id)
      .single()
    dossier = data
  }

  // Participants : inscriptions actives de la session → apprenants
  let participants: any[] = []
  if (convention.session_id) {
    const { data: inscriptions } = await supabase
      .from('inscriptions')
      .select('apprenant:apprenants(civilite, nom, prenom)')
      .eq('session_id', convention.session_id)
      .not('status', 'in', '("annule","abandonne")')
    participants = (inscriptions || [])
      .map((i: any) => i.apprenant)
      .filter(Boolean)
      .sort((a: any, b: any) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', convention.organization_id)
    .single()

  convention.session = session
  convention.participants = participants
  convention.dossier = dossier
  convention.signataire_contact = await loadSignataireContact(supabase, convention.client_id, convention.contact_id)

  const { withDocumentLogo } = await import('./org-logo')
  const orgForDoc = await withDocumentLogo(supabase, org)

  return { convention, org: orgForDoc }
}
