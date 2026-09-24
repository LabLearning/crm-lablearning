import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SansFormateurClient } from './SansFormateurClient'

export const dynamic = 'force-dynamic'

/**
 * Écran de rattrapage : les sessions sans formateur affecté, avec une
 * affectation à la volée — indispensable pour que chaque session sache à qui
 * envoyer ses grilles de questionnaires et qui porte le contrat.
 */
export default async function SansFormateurPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: sessionsBrutes }, { data: formateurs }, { data: parcours }] = await Promise.all([
    // Les sessions d'intervention POEI reçoivent leur formateur depuis
    // l'intervention (une affectation ici serait écrasée) : elles sont exclues
    supabase.from('sessions')
      .select('id, reference, status, date_debut, intitule, client:client_id(raison_sociale, nom_commercial), formation:formation_id(intitule, is_poei)')
      .eq('organization_id', session.organization.id)
      .is('formateur_id', null)
      .is('poei_intervention_id', null)
      .not('reference', 'like', 'BPF-%')
      .order('date_debut', { ascending: false })
      .range(0, 999),
    supabase.from('formateurs')
      .select('id, prenom, nom')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('nom'),
    // Parcours POEI en cours ou à venir (le statut n'est pas toujours tenu :
    // la date de fin fait foi) ; leur session chapeau n'a jamais de formateur
    supabase.from('poei')
      .select('id, numero, session_id, date_debut, date_fin, statut, client:client_id(raison_sociale, nom_commercial), formation:formation_id(intitule)')
      .eq('organization_id', session.organization.id)
      .not('statut', 'in', '("terminee","abandonne","refuse","embauche")')
      .or(`date_fin.is.null,date_fin.gte.${new Date().toISOString().slice(0, 10)}`),
  ])

  // La session chapeau d'un parcours n'est pas « sans formateur » : ce sont
  // les interventions qui en portent un. Le parcours est signalé à part s'il
  // n'a aucun formateur sur aucune intervention.
  const sessionsChapeau = new Set(((parcours || []) as any[]).map((p) => p.session_id).filter(Boolean))
  const { data: tousChapeaux } = await supabase.from('poei').select('session_id').eq('organization_id', session.organization.id).not('session_id', 'is', null)
  for (const x of (tousChapeaux || []) as any[]) sessionsChapeau.add(x.session_id)
  const sessions = ((sessionsBrutes || []) as any[]).filter((s) => !sessionsChapeau.has(s.id) && !s.formation?.is_poei)
  const { formateursDesPoei } = await import('@/lib/poei-formateurs')
  const formateursPoei = await formateursDesPoei(supabase, ((parcours || []) as any[]).map((p) => p.id))
  const parcoursSansFormateur = ((parcours || []) as any[])
    .filter((p) => !formateursPoei.get(p.id))
    .sort((a, b) => String(a.date_debut || '9999').localeCompare(String(b.date_debut || '9999')))
    .map((p) => ({
      id: p.id, numero: p.numero, date_debut: p.date_debut, date_fin: p.date_fin,
      client: p.client?.nom_commercial || p.client?.raison_sociale || null,
      formation: p.formation?.intitule || null,
    }))

  // Le nombre d'inscrits aide à prioriser (une session à 10 stagiaires
  // compte plus qu'une coquille vide).
  const ids = (sessions || []).map((s: any) => s.id)
  const inscritsParSession: Record<string, number> = {}
  for (let i = 0; i < ids.length; i += 80) {
    const { data } = await supabase.from('inscriptions').select('session_id').in('session_id', ids.slice(i, i + 80))
    for (const x of data || []) inscritsParSession[x.session_id] = (inscritsParSession[x.session_id] || 0) + 1
  }

  return (
    <SansFormateurClient
      sessions={(sessions || []).map((s: any) => ({
        id: s.id,
        reference: s.reference,
        status: s.status,
        date_debut: s.date_debut,
        client: s.client?.nom_commercial || s.client?.raison_sociale || null,
        formation: s.formation?.intitule || s.intitule || null,
        inscrits: inscritsParSession[s.id] || 0,
      }))}
      formateurs={(formateurs || []).map((f: any) => ({ id: f.id, nom: `${f.prenom} ${f.nom}` }))}
      parcoursPoei={parcoursSansFormateur}
    />
  )
}
