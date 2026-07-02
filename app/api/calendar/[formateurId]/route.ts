import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcalDate(dateStr: string): string {
  // DATE format : YYYYMMDD (all-day event)
  return dateStr.replace(/-/g, '')
}

function formatIcalDateEnd(dateStr: string): string {
  // Pour un événement all-day, la date de fin en iCal est exclusive (jour suivant)
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0].replace(/-/g, '')
}

export async function GET(_req: Request, { params }: { params: { formateurId: string } }) {
  const { searchParams } = new URL(_req.url)
  const token = searchParams.get('token')

  const supabase = await createServiceRoleClient()

  // Vérifier le formateur et le token de sécurité
  const { data: formateur } = await supabase
    .from('formateurs')
    .select('id, prenom, nom, email, organization_id')
    .eq('id', params.formateurId)
    .single()

  if (!formateur) {
    return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })
  }

  // Token simple = hash de l'email (pas d'auth lourde pour un flux iCal)
  const expectedToken = Buffer.from(formateur.email + formateur.id).toString('base64url').substring(0, 20)
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
  }

  // Récupérer toutes les sessions du formateur
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, date_debut, date_fin, lieu, status, formation:formation_id(intitule, duree_heures)')
    .eq('formateur_id', formateur.id)
    .not('status', 'eq', 'annulee')
    .order('date_debut', { ascending: true })

  // Récupérer le nom de l'organisation
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', formateur.organization_id)
    .single()

  const orgName = org?.name || 'Lab Learning'
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  // Générer le fichier iCal
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${orgName}//CRM Formation//FR`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcal(`${formateur.prenom} ${formateur.nom} — ${orgName}`)}`,
    `X-WR-CALDESC:${escapeIcal(`Planning de formation — ${orgName}`)}`,
    'X-WR-TIMEZONE:Europe/Paris',
  ]

  for (const s of (sessions || [])) {
    const formation = s.formation as any
    const title = formation?.intitule || s.reference
    const location = s.lieu || ''
    const description = [
      `Référence : ${s.reference}`,
      formation?.duree_heures ? `Durée : ${formation.duree_heures}h` : '',
      `Statut : ${s.status}`,
      `Formateur : ${formateur.prenom} ${formateur.nom}`,
    ].filter(Boolean).join('\\n')

    const statusLabel = s.status === 'confirmee' ? 'CONFIRMED' : s.status === 'en_cours' ? 'CONFIRMED' : 'TENTATIVE'

    ical.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@${orgName.toLowerCase().replace(/\s/g, '')}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatIcalDate(s.date_debut)}`,
      `DTEND;VALUE=DATE:${formatIcalDateEnd(s.date_fin)}`,
      `SUMMARY:${escapeIcal(title)}`,
      location ? `LOCATION:${escapeIcal(location)}` : '',
      `DESCRIPTION:${description}`,
      `STATUS:${statusLabel}`,
      `ORGANIZER;CN=${escapeIcal(orgName)}:mailto:digital@lab-learning.fr`,
      'END:VEVENT',
    )
  }

  ical.push('END:VCALENDAR')

  const icalContent = ical.filter(Boolean).join('\r\n')

  return new NextResponse(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="planning-${formateur.prenom}-${formateur.nom}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
