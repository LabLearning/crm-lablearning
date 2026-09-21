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

/** Statuts où la convention engage déjà le client : toute modification passe par un avenant. */
export const STATUTS_CONTRACTUELS = ['envoyee', 'signee_client', 'signee_complete']

export interface ChangementConvention {
  champ: string
  libelle: string
  avant: string | number | null
  apres: string | number | null
}

const fmtEuro = (n: unknown) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/**
 * Applique une modification (prix, durée, prise en charge…) à une convention
 * déjà envoyée ou signée, et en garde la trace dans un avenant numéroté.
 *
 * La convention elle-même est mise à jour : son PDF, régénéré à la volée,
 * porte la nouvelle valeur et mentionne l'avenant. Rien n'est à refaire
 * signer, l'avenant peut être transmis au client si le financeur le demande.
 */
export async function enregistrerAvenantModification(
  supabase: any,
  conventionId: string,
  modif: { montantApres?: number | null; changements?: ChangementConvention[]; motif?: string | null },
  actorUserId?: string | null,
): Promise<{ avenantId: string; numero: number } | null> {
  const { data: conv } = await supabase
    .from('conventions')
    .select('id, organization_id, numero, status, montant_ht, montant_ttc, taux_tva, participants_snapshot, formation:formations(intitule), client:clients(raison_sociale)')
    .eq('id', conventionId)
    .maybeSingle()
  if (!conv) return null

  const patch: Record<string, unknown> = {}
  const changements: ChangementConvention[] = [...(modif.changements || [])]
  let montantAvant: number | null = null
  let montantApres: number | null = null
  if (modif.montantApres != null && Number(modif.montantApres) !== Number(conv.montant_ht)) {
    montantAvant = Number(conv.montant_ht || 0)
    montantApres = Number(modif.montantApres)
    const tva = Number(conv.taux_tva || 0)
    patch.montant_ht = montantApres
    patch.montant_ttc = Math.round(montantApres * (1 + tva / 100) * 100) / 100
  }
  for (const c of changements) patch[c.champ] = c.apres
  if (montantApres == null && changements.length === 0) return null

  const { count } = await supabase
    .from('convention_avenants')
    .select('*', { count: 'exact', head: true })
    .eq('convention_id', conv.id)
  const numero = (count || 0) + 1

  const motif = modif.motif || [
    montantApres != null ? `Prix : ${fmtEuro(montantAvant)} → ${fmtEuro(montantApres)}` : null,
    ...changements.map((c) => `${c.libelle} : ${c.avant ?? 'vide'} → ${c.apres ?? 'vide'}`),
  ].filter(Boolean).join(' ; ')

  const participants = Array.isArray(conv.participants_snapshot) ? conv.participants_snapshot : []
  const base = {
    organization_id: conv.organization_id,
    convention_id: conv.id,
    numero,
    motif,
    participants_avant: participants,
    participants_apres: participants,
    ajoutes: [],
    retires: [],
    nombre_avant: participants.length,
    nombre_apres: participants.length,
    created_by: actorUserId || null,
  }
  let avenant: any = null
  {
    const { data, error } = await supabase
      .from('convention_avenants')
      .insert({ ...base, montant_avant: montantAvant, montant_apres: montantApres, changements: changements.length ? changements : null })
      .select('id, numero')
      .single()
    if (error && ['42703', 'PGRST204'].includes(String(error.code))) {
      // Migration 156 non appliquée : l'avenant est créé sans le détail du prix, le motif le porte
      const repli = await supabase.from('convention_avenants').insert(base).select('id, numero').single()
      avenant = repli.data
    } else if (!error) {
      avenant = data
    }
  }
  if (!avenant) return null

  await supabase.from('conventions').update(patch).eq('id', conv.id)

  try {
    const { createNotification } = await import('./email')
    const { data: managers } = await supabase
      .from('users').select('id')
      .eq('organization_id', conv.organization_id).in('role', ['super_admin', 'gestionnaire']).eq('status', 'active')
    for (const m of managers || []) {
      if (actorUserId && m.id === actorUserId) continue
      await createNotification({
        organizationId: conv.organization_id,
        userId: m.id,
        titre: `Avenant n°${numero} — convention ${conv.numero}`,
        message: `${motif} (${conv.client?.raison_sociale || ''} — ${conv.formation?.intitule || ''}). La convention est à jour, l'avenant est prêt à être transmis au client.`,
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

/**
 * Le prix d'une session change : les conventions liées déjà envoyées ou
 * signées suivent, chacune par un avenant. Les brouillons sont mis à jour
 * directement par l'appelant.
 */
export async function syncConventionMontantSession(
  supabase: any,
  sessionId: string,
  montant: number,
  actorUserId?: string | null,
): Promise<{ conventionId: string; numero: number }[]> {
  const { data: convs } = await supabase
    .from('conventions')
    .select('id, montant_ht')
    .eq('session_id', sessionId)
    .in('status', STATUTS_CONTRACTUELS)
  const faits: { conventionId: string; numero: number }[] = []
  for (const c of (convs || []) as any[]) {
    if (Number(c.montant_ht) === Number(montant)) continue
    const r = await enregistrerAvenantModification(supabase, c.id, { montantApres: montant }, actorUserId)
    if (r) faits.push({ conventionId: c.id, numero: r.numero })
  }
  return faits
}
