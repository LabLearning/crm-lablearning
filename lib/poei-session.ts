/**
 * Session d'intervention POEI.
 *
 * Tout l'opérationnel du CRM (émargement, questionnaires, documents, accès du
 * formateur à ses stagiaires) est rattaché à une session. Une intervention POEI
 * — la sous-période animée par un formateur donné — doit donc porter sa propre
 * session, sinon le formateur n'a accès à rien.
 *
 * La session « parcours » du POEI (poei.session_id) reste le chapeau
 * administratif : convention, financement, vision d'ensemble.
 */

/** Crée ou met à jour la session d'une intervention, et y inscrit les candidats du POEI */
export async function syncInterventionSession(
  supabase: any,
  interventionId: string,
  actorUserId?: string | null,
): Promise<string | null> {
  const { data: iv } = await supabase
    .from('poei_interventions')
    .select('*, poei:poei(id, numero, formation_id, client_id, session_id)')
    .eq('id', interventionId)
    .single()
  if (!iv) return null

  const poei = Array.isArray(iv.poei) ? iv.poei[0] : iv.poei
  if (!poei) return null

  // Sans dates, une session n'a pas de sens (ni émargement, ni planning)
  if (!iv.date_debut) return null

  const lieu = [iv.lieu, iv.adresse].filter(Boolean).join(' — ') || null

  const champs = {
    organization_id: iv.organization_id,
    poei_intervention_id: interventionId,
    formation_id: poei.formation_id || null,
    client_id: poei.client_id || null,
    formateur_id: iv.formateur_id || null,
    intitule: iv.libelle,
    type_session: 'intra',
    modalite: 'presentiel',
    date_debut: iv.date_debut,
    date_fin: iv.date_fin || iv.date_debut,
    horaires: iv.horaires || null,
    lieu,
    adresse: iv.adresse || null,
    code_postal: iv.code_postal || null,
    ville: iv.ville || null,
    cout_formateur: iv.montant_ht ?? null,
    // La mission est portée par l'intervention : la session en est le reflet
    mission_status: iv.mission_status || 'not_required',
    mission_proposed_at: iv.mission_proposed_at || null,
    mission_proposed_by: iv.mission_proposed_by || null,
    mission_responded_at: iv.mission_responded_at || null,
  }

  const { data: existante } = await supabase
    .from('sessions')
    .select('id')
    .eq('poei_intervention_id', interventionId)
    .maybeSingle()

  let sessionId = existante?.id as string | undefined

  if (sessionId) {
    await supabase.from('sessions').update(champs).eq('id', sessionId)
  } else {
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', iv.organization_id)
    const reference = `POEI-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const { data: creee, error } = await supabase
      .from('sessions')
      .insert({
        ...champs,
        reference,
        status: 'planifiee',
        places_min: 1,
        created_by: actorUserId || null,
      })
      .select('id')
      .single()
    if (error || !creee) {
      console.error('[syncInterventionSession]', error)
      return null
    }
    sessionId = creee.id
  }

  await inscrireCandidats(supabase, poei.id, sessionId!, iv.organization_id)

  // Feuilles d'émargement prêtes dès la création : le formateur ne doit pas
  // dépendre d'une visite préalable de la fiche session par un administrateur
  try {
    const { ensureEmargements } = await import('@/lib/emargements')
    await ensureEmargements(supabase, sessionId!, iv.organization_id)
  } catch (e) { console.error('[emargements intervention]', e) }

  return sessionId!
}

/**
 * Inscrit les candidats du POEI dans la session d'intervention.
 * Les mêmes stagiaires suivent tout le parcours : chaque intervention les
 * retrouve, sans ressaisie.
 */
async function inscrireCandidats(
  supabase: any,
  poeiId: string,
  sessionId: string,
  orgId: string,
): Promise<void> {
  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('apprenant_id')
    .eq('poei_id', poeiId)
    .not('apprenant_id', 'is', null)

  const apprenantIds = Array.from(
    new Set((candidats || []).map((c: any) => c.apprenant_id).filter(Boolean)),
  ) as string[]
  if (apprenantIds.length === 0) return

  const { data: deja } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
  const dejaIds = new Set((deja || []).map((i: any) => i.apprenant_id))

  const aInscrire = apprenantIds.filter((id) => !dejaIds.has(id))
  if (aInscrire.length === 0) return

  await supabase.from('inscriptions').insert(
    aInscrire.map((apprenant_id) => ({
      organization_id: orgId,
      session_id: sessionId,
      apprenant_id,
      status: 'inscrit',
    })),
  )
}

/**
 * Répercute sur toutes les sessions d'intervention un changement de candidats
 * du POEI (ajout d'un stagiaire en cours de parcours, par exemple).
 */
export async function syncCandidatsSurInterventions(
  supabase: any,
  poeiId: string,
  orgId: string,
): Promise<void> {
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, poei_intervention_id')
    .not('poei_intervention_id', 'is', null)

  if (!sessions?.length) return

  const { data: interventions } = await supabase
    .from('poei_interventions')
    .select('id')
    .eq('poei_id', poeiId)
  const ivIds = new Set((interventions || []).map((i: any) => i.id))

  for (const s of sessions) {
    if (ivIds.has(s.poei_intervention_id)) {
      await inscrireCandidats(supabase, poeiId, s.id, orgId)
    }
  }
}
