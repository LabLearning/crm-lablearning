/**
 * Contexte d'un certificat de réalisation POEI.
 *
 * Le certificat porte le parcours entier : ses dates, sa durée, son lieu. Il
 * ne dépend donc pas d'une session précise : la session chapeau quand elle
 * existe, sinon la première session d'intervention, sert seulement de support
 * (lieu, modalité) ; les dates sont toujours celles du parcours. Sans cela,
 * un parcours sans session chapeau (NSTCHY) n'avait aucun certificat, et un
 * parcours à plusieurs interventions aurait porté les dates d'une seule.
 */
import { heuresCertificatsPoei, poeiDeLaSession, type HeuresCertificat } from '@/lib/certificat-heures'

export interface ContexteCertificatPoei {
  poei: any
  /** Session « support » aux dates du parcours ; son id peut être celui d'une intervention. */
  session: any
  formation: any
  entrepriseNom: string | null
  heures: Map<string, HeuresCertificat>
  /** Date portée par défaut sur le certificat : fin du parcours. */
  dateParcours: string | null
}

export async function contexteCertificatPoei(supabase: any, poeiId: string, organizationId: string): Promise<ContexteCertificatPoei | null> {
  const { data: poei } = await supabase
    .from('poei')
    .select('id, numero, organization_id, session_id, formation_id, date_debut, date_fin, duree_heures, client:clients(raison_sociale, nom_commercial)')
    .eq('id', poeiId).eq('organization_id', organizationId).maybeSingle()
  if (!poei) return null

  // Session support : chapeau, sinon première intervention (par date)
  let support: any = null
  if (poei.session_id) {
    const { data } = await supabase.from('sessions').select('*').eq('id', poei.session_id).maybeSingle()
    support = data
  }
  if (!support) {
    const { data: ivs } = await supabase.from('poei_interventions').select('id').eq('poei_id', poei.id)
    const ivIds = ((ivs || []) as any[]).map((i) => i.id)
    if (ivIds.length) {
      const { data } = await supabase.from('sessions').select('*').in('poei_intervention_id', ivIds)
        .order('date_debut', { ascending: true }).limit(1)
      support = (data || [])[0] || null
    }
  }

  const formationId = poei.formation_id || support?.formation_id || null
  const { data: formation } = formationId
    ? await supabase.from('formations').select('*').eq('id', formationId).maybeSingle()
    : { data: null }

  const session = {
    ...(support || { id: null, lieu: null, adresse: null, ville: null, code_postal: null, modalite: 'presentiel' }),
    formation_id: formationId,
    date_debut: poei.date_debut || support?.date_debut || null,
    date_fin: poei.date_fin || support?.date_fin || poei.date_debut || null,
  }

  const heures = await heuresCertificatsPoei(supabase, poei, (formation as any)?.duree_heures)
  return {
    poei,
    session,
    formation,
    entrepriseNom: poei.client?.raison_sociale || poei.client?.nom_commercial || null,
    heures,
    dateParcours: poei.date_fin || poei.date_debut || null,
  }
}

/**
 * Session prête à imprimer : si elle appartient à un parcours POEI (chapeau ou
 * intervention), ses dates deviennent celles du parcours entier ; sinon elle
 * est rendue telle quelle.
 */
export async function datesDuParcours<T extends { id: string; date_debut?: string | null; date_fin?: string | null }>(supabase: any, sess: T, organizationId: string): Promise<T> {
  const poei = await poeiDeLaSession(supabase, sess.id, organizationId)
  if (!poei) return sess
  return { ...sess, date_debut: poei.date_debut || sess.date_debut, date_fin: poei.date_fin || sess.date_fin || poei.date_debut }
}
