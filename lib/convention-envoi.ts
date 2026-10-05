// Une convention a-t-elle été envoyée au client par e-mail ?
//
// Deux façons de faire signer : « Envoyer la convention » (le client reçoit la
// demande par e-mail) ou « Lien » (le lien est préparé seul ; le gestionnaire
// le transmet lui-même ou fait signer sur place). Dans le second cas rien ne
// part par e-mail, pas même l'exemplaire signé : écrire au client reste un
// geste du gestionnaire, le bouton « Envoyer la convention ».

const ENVOIS = ['send_convention_signature', 'send_convention_inter', 'send_contrat_particulier']
/** Demande annulée ou signature annulée : la convention repart de zéro. */
const REMISES_A_ZERO = ['cancel_signature_request', 'cancel_signed_convention']

export async function conventionEnvoyeeParMail(supabase: any, conventionId: string): Promise<boolean> {
  const [{ data: journal }, { data: mails }] = await Promise.all([
    supabase.from('audit_logs').select('action, created_at')
      .eq('entity_type', 'convention').eq('entity_id', conventionId)
      .in('action', [...ENVOIS, ...REMISES_A_ZERO])
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('email_logs').select('status, created_at')
      .eq('entity_type', 'convention').eq('entity_id', conventionId)
      .ilike('subject', '%signature requise%')
      .order('created_at', { ascending: false }).limit(50),
  ])
  const lignes = (journal || []) as { action: string; created_at: string }[]
  // Seuls comptent les envois postérieurs à la dernière remise à zéro
  const remise = lignes.find((l) => REMISES_A_ZERO.includes(l.action))
  const depuis = remise ? Date.parse(remise.created_at) : 0
  const compte = (d: string) => Date.parse(d) > depuis
  return ((mails || []) as { status: string | null; created_at: string }[]).some((m) => m.status !== 'failed' && compte(m.created_at))
    || lignes.some((l) => ENVOIS.includes(l.action) && compte(l.created_at))
}
