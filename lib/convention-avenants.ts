// Avenants de convention : quand les participants d'une session changent
// APRÈS l'envoi (ou la signature) de la convention, un avenant numéroté est
// créé automatiquement avec le détail des ajouts/retraits, et les
// gestionnaires sont notifiés.
//
// À appeler après toute mutation des inscriptions d'une session.
// No-op si la session n'a pas de convention envoyée/signée, ou si la
// convention n'a pas encore de snapshot (pas encore envoyée en signature).

interface ParticipantRef {
  apprenant_id: string
  nom: string | null
  prenom: string | null
}

export async function syncConventionAvenant(
  supabase: any,
  sessionId: string,
  actorUserId?: string | null,
): Promise<{ avenantId: string; numero: number } | null> {
  if (!sessionId) return null

  const { data: conv } = await supabase
    .from('conventions')
    .select('id, organization_id, numero, status, participants_snapshot, formation:formations(intitule), client:clients(raison_sociale)')
    .eq('session_id', sessionId)
    .in('status', ['envoyee', 'signee_client', 'signee_complete'])
    .maybeSingle()
  if (!conv || !Array.isArray(conv.participants_snapshot)) return null

  // Participants actuels de la session
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(id, nom, prenom)')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')
  const current: ParticipantRef[] = (inscriptions || [])
    .map((i: any) => i.apprenant)
    .filter(Boolean)
    .map((a: any) => ({ apprenant_id: a.id, nom: a.nom, prenom: a.prenom }))
    .sort((a: ParticipantRef, b: ParticipantRef) => (a.nom || '').localeCompare(b.nom || '', 'fr'))

  const before: ParticipantRef[] = conv.participants_snapshot
  const beforeIds = new Set(before.map((p) => p.apprenant_id))
  const currentIds = new Set(current.map((p) => p.apprenant_id))
  const ajoutes = current.filter((p) => !beforeIds.has(p.apprenant_id))
  const retires = before.filter((p) => !currentIds.has(p.apprenant_id))
  if (ajoutes.length === 0 && retires.length === 0) return null

  // Numéro d'avenant (1, 2, 3… par convention)
  const { count } = await supabase
    .from('convention_avenants')
    .select('*', { count: 'exact', head: true })
    .eq('convention_id', conv.id)
  const numero = (count || 0) + 1

  const fmtList = (list: ParticipantRef[]) =>
    list.map((p) => `${p.prenom || ''} ${p.nom || ''}`.trim()).join(', ')

  const { data: avenant, error } = await supabase
    .from('convention_avenants')
    .insert({
      organization_id: conv.organization_id,
      convention_id: conv.id,
      numero,
      motif: [
        ajoutes.length ? `Ajout : ${fmtList(ajoutes)}` : null,
        retires.length ? `Retrait : ${fmtList(retires)}` : null,
      ].filter(Boolean).join(' — '),
      participants_avant: before,
      participants_apres: current,
      ajoutes,
      retires,
      nombre_avant: before.length,
      nombre_apres: current.length,
      created_by: actorUserId || null,
    })
    .select('id, numero')
    .single()
  if (error || !avenant) return null

  // Le snapshot devient la nouvelle référence contractuelle
  await supabase
    .from('conventions')
    .update({ participants_snapshot: current, nombre_stagiaires: current.length })
    .eq('id', conv.id)

  // Notifier les gestionnaires
  try {
    const { createNotification } = await import('./email')
    const { data: managers } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', conv.organization_id)
      .in('role', ['super_admin', 'gestionnaire'])
      .eq('status', 'active')
    for (const m of managers || []) {
      if (actorUserId && m.id === actorUserId) continue
      await createNotification({
        organizationId: conv.organization_id,
        userId: m.id,
        titre: `Avenant n°${numero} — convention ${conv.numero}`,
        message: `Participants modifiés après envoi de la convention (${conv.client?.raison_sociale || ''} — ${conv.formation?.intitule || ''}) : effectif ${before.length} → ${current.length}. L'avenant est prêt à être envoyé au client.`,
        type: 'convention',
        lienUrl: `/dashboard/conventions/${conv.id}`,
        lienLabel: "Voir l'avenant",
        entityType: 'convention',
        entityId: conv.id,
      })
    }
  } catch (e) { console.error('[avenant notif]', e) }

  return { avenantId: avenant.id, numero: avenant.numero }
}
