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
    supabase.from('clients').select('id, raison_sociale, siret, adresse, code_postal, ville, telephone, email').eq('organization_id', orgId)
      .ilike('raison_sociale', like).limit(5),
    supabase.from('leads').select('id, entreprise, contact_nom, contact_prenom, contact_email, contact_telephone, status, montant_estime').eq('organization_id', orgId)
      .or(`entreprise.ilike.${like},contact_nom.ilike.${like},contact_prenom.ilike.${like}`).limit(5),
    supabase.from('sessions').select('id, reference, intitule, date_debut, date_fin, lieu, ville').eq('organization_id', orgId)
      .or(`reference.ilike.${like},intitule.ilike.${like}`).order('date_debut', { ascending: false }).limit(5),
    supabase.from('apprenants').select('id, nom, prenom, entreprise, email, telephone').eq('organization_id', orgId)
      .or(`nom.ilike.${like},prenom.ilike.${like}`).limit(5),
    supabase.from('formateurs').select('id, nom, prenom, email, telephone, zone_intervention').eq('organization_id', orgId)
      .or(`nom.ilike.${like},prenom.ilike.${like}`).limit(5),
    supabase.from('formations').select('id, intitule, reference').eq('organization_id', orgId)
      .or(`intitule.ilike.${like},reference.ilike.${like}`).limit(5),
    supabase.from('conventions').select('id, numero').eq('organization_id', orgId)
      .ilike('numero', like).limit(3),
    supabase.from('dossiers_formation').select('id, numero').eq('organization_id', orgId)
      .ilike('numero', like).limit(3),
  ])

  const adresse = (r: any) => [r.adresse, [r.code_postal, r.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const line = (label: string, value: any) => value ? { label, value: String(value) } : null
  const clean = (arr: any[]) => arr.filter(Boolean)

  const results = [
    ...(clients.data || []).map((c: any) => ({
      group: 'Clients', label: c.raison_sociale, sublabel: c.ville || '', href: `/dashboard/clients/${c.id}`,
      preview: { title: c.raison_sociale, lines: clean([line('SIRET', c.siret), line('Adresse', adresse(c)), line('Téléphone', c.telephone), line('Email', c.email)]) },
    })),
    ...(leads.data || []).map((l: any) => ({
      group: 'Leads', label: l.entreprise || `${l.contact_prenom || ''} ${l.contact_nom || ''}`.trim(),
      sublabel: l.status, href: `/dashboard/leads?lead=${l.id}`,
      preview: { title: l.entreprise || `${l.contact_prenom || ''} ${l.contact_nom || ''}`.trim(), lines: clean([line('Contact', `${l.contact_prenom || ''} ${l.contact_nom || ''}`.trim()), line('Statut', l.status), line('Email', l.contact_email), line('Téléphone', l.contact_telephone), line('Montant estimé', l.montant_estime ? `${Number(l.montant_estime).toLocaleString('fr-FR')} €` : null)]) },
    })),
    ...(sessions.data || []).map((s: any) => ({
      group: 'Sessions', label: s.intitule || s.reference,
      sublabel: `${s.reference || ''}${s.date_debut ? ' · ' + new Date(s.date_debut).toLocaleDateString('fr-FR') : ''}`,
      href: `/dashboard/sessions/${s.id}`,
      preview: { title: s.intitule || s.reference, lines: clean([line('Référence', s.reference), line('Dates', s.date_debut ? `${new Date(s.date_debut).toLocaleDateString('fr-FR')}${s.date_fin ? ' → ' + new Date(s.date_fin).toLocaleDateString('fr-FR') : ''}` : null), line('Lieu', s.lieu || s.ville)]) },
    })),
    ...(apprenants.data || []).map((a: any) => ({
      group: 'Apprenants', label: `${a.prenom || ''} ${a.nom || ''}`.trim(), sublabel: a.entreprise || '',
      href: `/dashboard/apprenants?q=${encodeURIComponent(a.nom || '')}`,
      preview: { title: `${a.prenom || ''} ${a.nom || ''}`.trim(), lines: clean([line('Entreprise', a.entreprise), line('Email', a.email), line('Téléphone', a.telephone)]) },
    })),
    ...(formateurs.data || []).map((f: any) => ({
      group: 'Formateurs', label: `${f.prenom || ''} ${f.nom || ''}`.trim(), sublabel: f.zone_intervention || '',
      href: `/dashboard/formateurs`,
      preview: { title: `${f.prenom || ''} ${f.nom || ''}`.trim(), lines: clean([line('Email', f.email), line('Téléphone', f.telephone), line('Zone', f.zone_intervention)]) },
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
