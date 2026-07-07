import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SessionsList } from './SessionsList'
import type { Session } from '@/lib/types/formation'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // ── Voie rapide : tout en 1 requête SQL (RPC sessions_page_data).
  // Évite 8 allers-retours, les .in() à 371 UUIDs dans l'URL et le
  // plafond PostgREST de 1000 lignes (1705 inscriptions, 1220 apprenants).
  try {
    const { data, error } = await supabase.rpc('sessions_page_data', { org: orgId })
    if (!error && data && Array.isArray(data.sessions)) {
      const sessionsWithCounts = data.sessions.map((s: any) => ({
        ...s,
        _nb_inscrits: (s._inscrits_ids || []).length,
        _inscrits_ids: s._inscrits_ids || [],
        _formation_ids: s._formation_ids || [],
        _is_poei: !!s._is_poei,
      }))
      return (
        <div className="animate-fade-in">
          <SessionsList
            sessions={sessionsWithCounts as Session[]}
            formations={(data.formations || []) as any[]}
            formateurs={(data.formateurs || []) as any[]}
            clients={(data.clients || []) as any[]}
            apprenants={(data.apprenants || []) as any[]}
          />
        </div>
      )
    }
  } catch { /* repli legacy ci-dessous */ }

  // ── Repli : requêtes classiques tant que la migration 066 n'est pas appliquée ──
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      formation:formation_id(intitule, reference, modalite, duree_heures, is_poei),
      formateur:formateurs(prenom, nom),
      client:client_id(raison_sociale)
    `)
    .eq('organization_id', orgId)
    .order('date_debut', { ascending: false })

  const sessionIds = (sessions || []).map((s) => s.id)

  const [
    { data: allInscrits },
    { data: allLinkedFormations },
    { data: formations },
    { data: formateurs },
    { data: clients },
    { data: apprenants },
    { data: poeiLinks },
  ] = await Promise.all([
    sessionIds.length > 0
      ? supabase.from('inscriptions').select('session_id, apprenant_id').in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")').range(0, 9999)
      : Promise.resolve({ data: [] as any[] }),
    sessionIds.length > 0
      ? supabase.from('session_formations').select('session_id, formation_id, ordre').in('session_id', sessionIds).order('ordre')
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('formations')
      .select('id, intitule, reference, modalite, duree_heures, duree_jours')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('intitule'),
    supabase
      .from('formateurs')
      .select('id, prenom, nom, tarif_journalier')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('nom'),
    supabase
      .from('clients')
      .select('id, raison_sociale, adresse, code_postal, ville')
      .eq('organization_id', orgId)
      .eq('type', 'entreprise')
      .order('raison_sociale'),
    supabase
      .from('apprenants')
      .select('id, prenom, nom, email, client_id')
      .eq('organization_id', orgId)
      .order('nom')
      .range(0, 9999),
    supabase
      .from('poei')
      .select('session_id')
      .eq('organization_id', orgId)
      .not('session_id', 'is', null),
  ])

  const inscritsBySession: Record<string, string[]> = {}
  for (const i of allInscrits || []) {
    ;(inscritsBySession[i.session_id] ||= []).push(i.apprenant_id)
  }
  const formationsBySession: Record<string, string[]> = {}
  for (const f of allLinkedFormations || []) {
    ;(formationsBySession[f.session_id] ||= []).push(f.formation_id)
  }

  const poeiSessionIds = new Set((poeiLinks || []).map((p: any) => p.session_id))

  const sessionsWithCounts = (sessions || []).map((s) => {
    const inscritsIds = inscritsBySession[s.id] || []
    return {
      ...s,
      _nb_inscrits: inscritsIds.length,
      _inscrits_ids: inscritsIds,
      _formation_ids: formationsBySession[s.id] || [],
      _is_poei: !!((s as any).formation?.is_poei) || poeiSessionIds.has(s.id),
    }
  })

  return (
    <div className="animate-fade-in">
      <SessionsList
        sessions={sessionsWithCounts as Session[]}
        formations={(formations || []) as any[]}
        formateurs={(formateurs || []) as any[]}
        clients={(clients || []) as any[]}
        apprenants={(apprenants || []) as any[]}
      />
    </div>
  )
}
