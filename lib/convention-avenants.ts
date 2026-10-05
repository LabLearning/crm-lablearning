// Avenants de convention : quand les participants d'une session changent
// APRÈS l'envoi (ou la signature) de la convention, un avenant numéroté est
// créé automatiquement avec le détail des ajouts/retraits, et les
// gestionnaires sont notifiés. Un changement de prix n'en crée jamais :
// c'est une correction, voir corrigerPrixConvention.
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

/** Statuts où la convention engage déjà le client : une modification de contenu passe par un avenant, sauf le prix. */
export const STATUTS_CONTRACTUELS = ['envoyee', 'signee_client', 'signee_complete']

export interface ChangementConvention {
  champ: string
  libelle: string
  avant: string | number | null
  apres: string | number | null
}

// Espaces ordinaires : l'espace fine insécable de fr-FR n'existe pas dans la police des PDF, où elle s'imprimait comme une barre
const fmtEuro = (n: unknown) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0\u2009]/g, ' ')} €`

/** Ce qu'une correction de prix a changé sur une convention. */
export interface CorrectionPrix {
  conventionId: string
  numero: string
  avant: number | null
  apres: number
}

/**
 * Corrige le prix d'une convention déjà envoyée ou signée.
 *
 * Règle de la direction : un prix modifié après coup est toujours une erreur
 * de saisie que le client connaît. La convention porte donc le bon prix, sans
 * avenant ni mention sur le document. L'ancien prix reste écrit dans les notes
 * internes de la convention ; l'appelant consigne la correction au journal.
 */
export async function corrigerPrixConvention(
  supabase: any,
  conventionId: string,
  montant: number,
  actorUserId?: string | null,
): Promise<CorrectionPrix | null> {
  const { data: conv } = await supabase
    .from('conventions')
    .select('id, organization_id, numero, montant_ht, taux_tva, notes_internes, formation:formations(intitule), client:clients(raison_sociale)')
    .eq('id', conventionId)
    .maybeSingle()
  if (!conv || !Number.isFinite(Number(montant))) return null
  if (conv.montant_ht != null && Number(conv.montant_ht) === Number(montant)) return null

  const avant = conv.montant_ht != null ? Number(conv.montant_ht) : null
  const apres = Number(montant)
  const tva = Number(conv.taux_tva || 0)
  const quoi = avant != null ? `Prix corrigé de ${fmtEuro(avant)} à ${fmtEuro(apres)}` : `Prix fixé à ${fmtEuro(apres)}`
  const note = `[${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}] ${quoi}, sans avenant.`
  const { error } = await supabase
    .from('conventions')
    .update({
      montant_ht: apres,
      montant_ttc: Math.round(apres * (1 + tva / 100) * 100) / 100,
      notes_internes: [conv.notes_internes, note].filter(Boolean).join('\n'),
    })
    .eq('id', conv.id)
  if (error) return null

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
        titre: `Prix corrigé, convention ${conv.numero}`,
        message: `${quoi} (${[conv.client?.raison_sociale, conv.formation?.intitule].filter(Boolean).join(', ')}). La convention affiche le nouveau prix, sans avenant.`,
        type: 'convention',
        lienUrl: `/dashboard/conventions/${conv.id}`,
        lienLabel: 'Voir la convention',
        entityType: 'convention',
        entityId: conv.id,
      })
    }
  } catch (e) { console.error('[prix convention notif]', e) }

  return { conventionId: conv.id, numero: conv.numero, avant, apres }
}

/**
 * Applique une modification de contenu (durée, prise en charge…) à une
 * convention déjà envoyée ou signée, et en garde la trace dans un avenant
 * numéroté. Le prix n'en fait pas partie : il se corrige sans avenant, par
 * `corrigerPrixConvention`.
 *
 * La convention elle-même est mise à jour : son PDF, régénéré à la volée,
 * porte la nouvelle valeur et mentionne l'avenant. Rien n'est à refaire
 * signer, l'avenant peut être transmis au client si le financeur le demande.
 */
export async function enregistrerAvenantModification(
  supabase: any,
  conventionId: string,
  modif: { changements: ChangementConvention[]; motif?: string | null },
  actorUserId?: string | null,
): Promise<{ avenantId: string; numero: number } | null> {
  const { data: conv } = await supabase
    .from('conventions')
    .select('id, organization_id, numero, status, participants_snapshot, formation:formations(intitule), client:clients(raison_sociale)')
    .eq('id', conventionId)
    .maybeSingle()
  if (!conv) return null

  const changements: ChangementConvention[] = [...(modif.changements || [])]
  if (changements.length === 0) return null
  const patch: Record<string, unknown> = {}
  for (const c of changements) patch[c.champ] = c.apres

  const { count } = await supabase
    .from('convention_avenants')
    .select('*', { count: 'exact', head: true })
    .eq('convention_id', conv.id)
  const numero = (count || 0) + 1

  const motif = modif.motif || changements.map((c) => `${c.libelle} : ${c.avant ?? 'vide'} → ${c.apres ?? 'vide'}`).join(' ; ')

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
      .insert({ ...base, changements })
      .select('id, numero')
      .single()
    if (error && ['42703', 'PGRST204'].includes(String(error.code))) {
      // Migration 156 non appliquée : l'avenant est créé sans le détail, le motif le porte
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
 * signées suivent, chacune corrigée sans avenant. Les brouillons sont mis à
 * jour directement par l'appelant.
 */
export async function syncConventionMontantSession(
  supabase: any,
  sessionId: string,
  organizationId: string,
  montant: number,
  actorUserId?: string | null,
): Promise<CorrectionPrix[]> {
  const { data: convs } = await supabase
    .from('conventions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('organization_id', organizationId)
    .in('status', STATUTS_CONTRACTUELS)
  const faites: CorrectionPrix[] = []
  for (const c of (convs || []) as any[]) {
    const r = await corrigerPrixConvention(supabase, c.id, montant, actorUserId)
    if (r) faites.push(r)
  }
  return faites
}
