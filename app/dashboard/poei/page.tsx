import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PoeiList } from './PoeiList'
import type { Poei } from '@/lib/types/poei'

export const dynamic = 'force-dynamic'

export default async function PoeiPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: poeiRaw }, { data: clients }, { data: formationsPoei }, { data: previsions }, { data: vivierCandidats }] = await Promise.all([
    supabase
      .from('poei')
      .select(`
        *,
        client:clients(raison_sociale, nom_commercial, sigle),
        formation:formations(intitule),
        session:sessions(reference, date_debut, date_fin),
        candidats:poei_candidats(id)
      `)
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, raison_sociale, nom_commercial, sigle')
      .eq('organization_id', session.organization.id)
      .order('raison_sociale'),
    // Catalogue : on ne propose que les formations marquées POEI (fallback : toutes si aucune)
    supabase
      .from('formations')
      .select('id, intitule, duree_heures, is_poei')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('intitule'),
    // Pipeline "à planifier" (pré-projets), les plus proches en premier
    supabase
      .from('poei_previsions')
      .select('*, client:clients(raison_sociale, nom_commercial, sigle)')
      .eq('organization_id', session.organization.id)
      .order('date_debut_formation_prevue', { ascending: true, nullsFirst: false }),
    supabase
      .from('candidats_vivier')
      .select('*, client:clients(raison_sociale, nom_commercial, sigle), poei:poei(numero, formation:formations(intitule)), poei_prevision:poei_previsions(entreprise, date_debut_formation_prevue, client:clients(raison_sociale, nom_commercial, sigle))')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
  ])

  // Le statut affiché est déduit des faits (candidats, dépôt FT, dates de
  // session) : un dossier ne peut plus rester « en montage » alors que la
  // formation est en cours.
  const { data: agencesFt } = await supabase
    .from('agences_france_travail')
    .select('id, nom, ville')
    .eq('organization_id', session.organization.id).eq('is_active', true).order('nom')

  const { statutAttenduPoei, blocagesPoei } = await import('@/lib/poei-statut')
  const poei = (poeiRaw || []).map((p: any) => {
    const nb = (p.candidats || []).length
    const faits = {
      statut: p.statut,
      nb_candidats: nb,
      date_depot_ft: p.date_depot_ft,
      date_accord_ft: p.date_accord_ft,
      session_date_debut: p.session?.date_debut,
      session_date_fin: p.session?.date_fin,
      date_debut: p.date_debut,
      date_fin: p.date_fin,
    }
    return {
      ...p,
      candidats_count: nb,
      statut: statutAttenduPoei(faits),
      nb_blocages: blocagesPoei({
        ...faits,
        duree_heures: p.duree_heures,
        montant_horaire: p.montant_horaire,
        session_id: p.session_id,
        client_id: p.client_id,
      }).length,
    }
  }) as Poei[]

  const onlyPoei = (formationsPoei || []).filter((f: any) => f.is_poei)
  const formations = (onlyPoei.length > 0 ? onlyPoei : (formationsPoei || [])) as any[]

  return (
    <div className="animate-fade-in">
      <PoeiList
        poei={poei}
        previsions={(previsions || []) as any[]}
        clients={clients || []}
        formations={formations}
        hasPoeiCatalog={onlyPoei.length > 0}
        vivierCandidats={(vivierCandidats || []) as any[]}
        agences={(agencesFt || []) as any[]}
      />
    </div>
  )
}
