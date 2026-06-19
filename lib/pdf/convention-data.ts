// Chargement unifié des données nécessaires au PDF de convention
// (utilisé par la route /api/pdf/convention/[id] et par signature-actions).

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

  const { withDocumentLogo } = await import('./org-logo')
  const orgForDoc = await withDocumentLogo(supabase, org)

  return { convention, org: orgForDoc }
}
