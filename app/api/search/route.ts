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
  // Un code postal se tape en entier ou par département (« 33 ») ; un SIRET à partir de neuf chiffres.
  // Sans cette garde, « 33000 » ressortirait tous les SIRET qui contiennent ces chiffres.
  const champsClients = [`raison_sociale.ilike.${like}`, `nom_commercial.ilike.${like}`, `ville.ilike.${like}`, `adresse.ilike.${like}`]
  if (/^\d{2,5}$/.test(q)) champsClients.push(`code_postal.ilike.${q}%`)
  if (/^\d{9,14}$/.test(q)) champsClients.push(`siret.ilike.${like}`)

  // Une personne se tape « Anis Zerroudi » comme « Zerroudi Anis », prénoms et
  // noms composés compris : on essaie chaque coupure entre prénom et nom.
  // Sans cela, la phrase entière était comparée à chaque champ et ne trouvait rien.
  const mots = q.split(/\s+/).filter(Boolean)
  const personne = (prenom: string, nom: string, autres: string[] = []) => {
    const conds = [`${prenom}.ilike.${like}`, `${nom}.ilike.${like}`, ...autres.map((c) => `${c}.ilike.${like}`)]
    for (let i = 1; i < Math.min(mots.length, 5); i++) {
      const avant = `%${mots.slice(0, i).join(' ')}%`
      const apres = `%${mots.slice(i).join(' ')}%`
      conds.push(`and(${prenom}.ilike.${avant},${nom}.ilike.${apres})`, `and(${nom}.ilike.${avant},${prenom}.ilike.${apres})`)
    }
    return conds.join(',')
  }

  const supabase = await createServiceRoleClient()
  const [clients, contacts, leads, sessions, apprenants, formateurs, formations, conventions, dossiers, parVille] = await Promise.all([
    // Le nom, mais aussi la ville, l'adresse, le code postal ou le SIRET
    supabase.from('clients').select('id, raison_sociale, nom_commercial, siret, adresse, code_postal, ville, telephone, email').eq('organization_id', orgId)
      .or(champsClients.join(',')).order('raison_sociale').limit(8),
    // Contacts des clients : nom, prénom, email ou téléphone ; ils s'ouvrent sur la fiche de leur client
    supabase.from('contacts').select('id, civilite, prenom, nom, email, telephone, mobile, poste, client_id, client:client_id(raison_sociale, nom_commercial)').eq('organization_id', orgId)
      .or(personne('prenom', 'nom', ['email', 'telephone', 'mobile'])).order('nom').limit(6),
    supabase.from('leads').select('id, entreprise, contact_nom, contact_prenom, contact_email, contact_telephone, status, montant_estime').eq('organization_id', orgId)
      .or(personne('contact_prenom', 'contact_nom', ['entreprise', 'contact_email'])).limit(5),
    // Sessions OPCO seulement : les sessions techniques d'une POEI sortent sous « POEI »
    supabase.from('sessions').select('id, reference, intitule, date_debut, date_fin, lieu, ville, formation:formation_id(is_poei)').eq('organization_id', orgId)
      .is('poei_intervention_id', null)
      .or(`reference.ilike.${like},intitule.ilike.${like},ville.ilike.${like},lieu.ilike.${like}`).order('date_debut', { ascending: false }).limit(10),
    supabase.from('apprenants').select('id, nom, prenom, entreprise, email, telephone').eq('organization_id', orgId)
      .or(personne('prenom', 'nom', ['email'])).limit(5),
    supabase.from('formateurs').select('id, nom, prenom, email, telephone, zone_intervention').eq('organization_id', orgId)
      .or(personne('prenom', 'nom', ['email'])).limit(5),
    supabase.from('formations').select('id, intitule, reference').eq('organization_id', orgId)
      .or(`intitule.ilike.${like},reference.ilike.${like}`).limit(5),
    supabase.from('conventions').select('id, numero').eq('organization_id', orgId)
      .ilike('numero', like).limit(3),
    supabase.from('dossiers_formation').select('id, numero').eq('organization_id', orgId)
      .ilike('numero', like).limit(3),
    // Combien d'établissements dans cette ville : pour proposer la liste complète
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).ilike('ville', like),
  ])

  // POEI : par numéro, poste visé, ou entreprise trouvée ci-dessus (« NEW SCHOOL » sort ses parcours)
  const idsClients = ((clients.data || []) as any[]).map((c) => c.id)
  const condPoei = [`numero.ilike.${like}`, `poste_vise.ilike.${like}`, ...(idsClients.length ? [`client_id.in.(${idsClients.join(',')})`] : [])]
  const { data: poeis } = await supabase.from('poei')
    .select('id, numero, date_debut, date_fin, statut, client:client_id(raison_sociale, nom_commercial, ville), formation:formation_id(intitule)')
    .eq('organization_id', orgId).or(condPoei.join(',')).order('date_debut', { ascending: false, nullsFirst: false }).limit(5)
  const { data: chapeaux } = await supabase.from('poei').select('session_id').eq('organization_id', orgId).not('session_id', 'is', null)
  const sessionsChapeau = new Set(((chapeaux || []) as any[]).map((x) => x.session_id))
  const sessionsOpco = ((sessions.data || []) as any[]).filter((s) => !s.formation?.is_poei && !sessionsChapeau.has(s.id)).slice(0, 5)

  const adresse = (r: any) => [r.adresse, [r.code_postal, r.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const line = (label: string, value: any) => value ? { label, value: String(value) } : null
  const clean = (arr: any[]) => arr.filter(Boolean)

  // Ville reconnue : un raccourci vers la liste complète, avant les fiches
  const nbVille = parVille.count || 0
  const villeAffichee = nbVille > 0
    ? ((clients.data || []).find((c: any) => c.ville && String(c.ville).toLowerCase().includes(q.toLowerCase()))?.ville || q)
    : null
  const results = [
    ...(nbVille > 0 ? [{
      group: 'Villes', label: `Tous les clients à ${villeAffichee}`, sublabel: `${nbVille} établissement${nbVille > 1 ? 's' : ''}`,
      href: `/dashboard/clients?q=${encodeURIComponent(q)}`,
    }] : []),
    ...(clients.data || []).map((c: any) => ({
      group: 'Clients', label: c.nom_commercial ? `${c.raison_sociale} (${c.nom_commercial})` : c.raison_sociale,
      sublabel: [c.code_postal, c.ville].filter(Boolean).join(' '), href: `/dashboard/clients/${c.id}`,
      preview: { title: c.raison_sociale, lines: clean([line('SIRET', c.siret), line('Adresse', adresse(c)), line('Téléphone', c.telephone), line('Email', c.email)]) },
    })),
    ...(contacts.data || []).map((ct: any) => {
      const nom = `${ct.prenom || ''} ${ct.nom || ''}`.trim()
      // Même libellé que le groupe Clients : raison sociale, puis l'enseigne entre parenthèses
      const entreprise = ct.client?.raison_sociale
        ? (ct.client.nom_commercial ? `${ct.client.raison_sociale} (${ct.client.nom_commercial})` : ct.client.raison_sociale)
        : (ct.client?.nom_commercial || '')
      return {
        group: 'Contacts', label: nom || ct.email || 'Contact',
        sublabel: [entreprise, ct.poste].filter(Boolean).join(' · '),
        href: ct.client_id ? `/dashboard/clients/${ct.client_id}` : '/dashboard/clients',
        preview: { title: [ct.civilite, nom].filter(Boolean).join(' '), lines: clean([line('Entreprise', entreprise), line('Poste', ct.poste), line('Email', ct.email), line('Téléphone', ct.telephone || ct.mobile)]) },
      }
    }),
    ...(leads.data || []).map((l: any) => ({
      group: 'Leads', label: l.entreprise || `${l.contact_prenom || ''} ${l.contact_nom || ''}`.trim(),
      sublabel: l.status, href: `/dashboard/leads?lead=${l.id}`,
      preview: { title: l.entreprise || `${l.contact_prenom || ''} ${l.contact_nom || ''}`.trim(), lines: clean([line('Contact', `${l.contact_prenom || ''} ${l.contact_nom || ''}`.trim()), line('Statut', l.status), line('Email', l.contact_email), line('Téléphone', l.contact_telephone), line('Montant estimé', l.montant_estime ? `${Number(l.montant_estime).toLocaleString('fr-FR')} €` : null)]) },
    })),
    ...((poeis || []) as any[]).map((p: any) => {
      const entreprise = p.client?.nom_commercial || p.client?.raison_sociale || null
      const dates = p.date_debut ? `${new Date(p.date_debut).toLocaleDateString('fr-FR')}${p.date_fin ? ' → ' + new Date(p.date_fin).toLocaleDateString('fr-FR') : ''}` : null
      return {
        group: 'POEI', label: [entreprise, p.client?.ville].filter(Boolean).join(' · ') || p.numero,
        sublabel: [p.numero, dates].filter(Boolean).join(' · '),
        href: `/dashboard/poei/${p.id}`,
        preview: { title: entreprise || p.numero, lines: clean([line('Numéro', p.numero), line('Formation', p.formation?.intitule), line('Dates', dates)]) },
      }
    }),
    ...sessionsOpco.map((s: any) => ({
      group: 'Sessions', label: s.intitule || s.reference,
      sublabel: `${s.reference || ''}${s.date_debut ? ' · ' + new Date(s.date_debut).toLocaleDateString('fr-FR') : ''}`,
      href: `/dashboard/sessions/${s.id}`,
      preview: { title: s.intitule || s.reference, lines: clean([line('Référence', s.reference), line('Dates', s.date_debut ? `${new Date(s.date_debut).toLocaleDateString('fr-FR')}${s.date_fin ? ' → ' + new Date(s.date_fin).toLocaleDateString('fr-FR') : ''}` : null), line('Lieu', s.lieu || s.ville)]) },
    })),
    ...(apprenants.data || []).map((a: any) => ({
      group: 'Apprenants', label: `${a.prenom || ''} ${a.nom || ''}`.trim(), sublabel: a.entreprise || '',
      href: `/dashboard/apprenants/${a.id}`,
      preview: { title: `${a.prenom || ''} ${a.nom || ''}`.trim(), lines: clean([line('Entreprise', a.entreprise), line('Email', a.email), line('Téléphone', a.telephone)]) },
    })),
    ...(formateurs.data || []).map((f: any) => ({
      group: 'Formateurs', label: `${f.prenom || ''} ${f.nom || ''}`.trim(), sublabel: f.zone_intervention || '',
      href: `/dashboard/formateurs/${f.id}`,
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
