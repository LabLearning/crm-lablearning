import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { VivierList } from './VivierList'

export const dynamic = 'force-dynamic'

export default async function VivierPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: candidats }, { data: clients }, { data: poeis }, { data: previsions }] = await Promise.all([
    supabase
      .from('candidats_vivier')
      .select('*, client:clients(raison_sociale, nom_commercial, sigle, ville), poei:poei(numero, formation:formations(intitule), client:clients(raison_sociale, nom_commercial, sigle, ville)), poei_prevision:poei_previsions(entreprise, date_debut_formation_prevue, client:clients(raison_sociale, nom_commercial, sigle, ville))')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, raison_sociale, nom_commercial, sigle')
      .eq('organization_id', session.organization.id)
      .order('raison_sociale', { ascending: true }),
    supabase
      .from('poei')
      .select('id, numero, formation:formations(intitule), client:clients(raison_sociale, nom_commercial, sigle)')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('poei_previsions')
      .select('id, entreprise, date_debut_formation_prevue, statut, client:clients(raison_sociale, nom_commercial, sigle)')
      .eq('organization_id', session.organization.id)
      .not('statut', 'in', '("transforme","abandonne")')
      .order('date_debut_formation_prevue', { ascending: true, nullsFirst: false }),
  ])

  // URLs signées des CV (bucket privé documents)
  const cands = (candidats || []) as any[]
  const cvPaths = cands.map((c) => c.cv_url).filter((u) => u && !/^https?:\/\//.test(u)) as string[]
  const cvUrls: Record<string, string> = {}
  if (cvPaths.length > 0) {
    const { data: signed } = await supabase.storage.from('documents').createSignedUrls(cvPaths, 3600)
    ;(signed || []).forEach((s: any, i: number) => { if (s?.signedUrl && !s.error) cvUrls[cvPaths[i]] = s.signedUrl })
  }
  for (const c of cands) if (c.cv_url && /^https?:\/\//.test(c.cv_url)) cvUrls[c.cv_url] = c.cv_url

  return <VivierList candidats={cands} clients={(clients || []) as any[]} poeis={(poeis || []) as any[]} previsions={(previsions || []) as any[]} cvUrls={cvUrls} />
}
