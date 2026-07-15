import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Recherche globale (navbar) : interroge les entités principales en parallèle.
export async function GET(req: NextRequest) {
  let session
  try { session = await getSession() } catch { return NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const orgId = session.organization.id

  const q = (req.nextUrl.searchParams.get('q') || '').replace(/[,()"%]/g, ' ').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })
  const like = `%${q}%`

  const supabase = await createServiceRoleClient()
  const [clients, leads, sessions, apprenants, formateurs, formations, conventions, dossiers] = await Promise.all([
    supabase.from('clients').select('id, raison_sociale, ville').eq('organization_id', orgId)
      .ilike('raison_sociale', like).limit(5),
    supabase.from('leads').select('id, entreprise, contact_nom, contact_prenom, status').eq('organization_id', orgId)
      .or(`entreprise.ilike.${like},contact_nom.ilike.${like},contact_prenom.ilike.${like}`).limit(5),
    supabase.from('sessions').select('id, reference, intitule, date_debut').eq('organization_id', orgId)
      .or(`reference.ilike.${like},intitule.ilike.${like}`).order('date_debut', { ascending: false }).limit(5),
    supabase.from('apprenants').select('id, nom, prenom, entreprise').eq('organization_id', orgId)
      .or(`nom.ilike.${like},prenom.ilike.${like}`).limit(5),
    supabase.from('formateurs').select('id, nom, prenom').eq('organization_id', orgId)
      .or(`nom.ilike.${like},prenom.ilike.${like}`).limit(5),
    supabase.from('formations').select('id, intitule, reference').eq('organization_id', orgId)
      .or(`intitule.ilike.${like},reference.ilike.${like}`).limit(5),
    supabase.from('conventions').select('id, numero').eq('organization_id', orgId)
      .ilike('numero', like).limit(3),
    supabase.from('dossiers_formation').select('id, numero').eq('organization_id', orgId)
      .ilike('numero', like).limit(3),
  ])

  const results = [
    ...(clients.data || []).map((c: any) => ({
      group: 'Clients', label: c.raison_sociale, sublabel: c.ville || '', href: `/dashboard/clients/${c.id}`,
    })),
    ...(leads.data || []).map((l: any) => ({
      group: 'Leads', label: l.entreprise || `${l.contact_prenom || ''} ${l.contact_nom || ''}`.trim(),
      sublabel: l.status, href: `/dashboard/leads?lead=${l.id}`,
    })),
    ...(sessions.data || []).map((s: any) => ({
      group: 'Sessions', label: s.intitule || s.reference,
      sublabel: `${s.reference || ''}${s.date_debut ? ' · ' + new Date(s.date_debut).toLocaleDateString('fr-FR') : ''}`,
      href: `/dashboard/sessions/${s.id}`,
    })),
    ...(apprenants.data || []).map((a: any) => ({
      group: 'Apprenants', label: `${a.prenom || ''} ${a.nom || ''}`.trim(), sublabel: a.entreprise || '',
      href: `/dashboard/apprenants?q=${encodeURIComponent(a.nom || '')}`,
    })),
    ...(formateurs.data || []).map((f: any) => ({
      group: 'Formateurs', label: `${f.prenom || ''} ${f.nom || ''}`.trim(), sublabel: '',
      href: `/dashboard/formateurs`,
    })),
    ...(formations.data || []).map((f: any) => ({
      group: 'Formations', label: f.intitule, sublabel: f.reference || '', href: `/dashboard/formations/${f.id}`,
    })),
    ...(conventions.data || []).map((c: any) => ({
      group: 'Conventions', label: c.numero, sublabel: '', href: `/dashboard/conventions/${c.id}`,
    })),
    ...(dossiers.data || []).map((d: any) => ({
      group: 'Dossiers', label: d.numero, sublabel: '', href: `/dashboard/dossiers/${d.id}`,
    })),
  ]

  return NextResponse.json({ results })
}
