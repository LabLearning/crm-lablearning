import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { fillPdc, type PdcRow } from '@/lib/pdf/fill-pdc'

function fmt(d: string | null | undefined): string {
  if (!d) return ''
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

// Parse programme_detaille -> semaines (titre, durée, modules)
function parseWeeks(text: string) {
  const weeks: { titre: string; duree: string; modules: string[] }[] = []
  let w: any = null
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^Semaine/i.test(line)) {
      const parts = line.split(/\s+[—–-]\s+Durée\s*:\s*/i)
      w = { titre: parts[0].replace(/^Semaine\s*\d+\s*[—–-]\s*/i, '').trim(), duree: (parts[1] || '').trim(), modules: [] }
      weeks.push(w)
    } else if (/^Module/i.test(line) && w) {
      w.modules.push(line.replace(/^Module\s*\d+\s*[—–-]\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim())
    }
  }
  return weeks
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()

  // Contrôle d'org : le candidat POEI doit appartenir à l'organisation de l'appelant.
  const { data: candidat } = await supabase
    .from('poei_candidats')
    .select('*, apprenant:apprenants(civilite, nom, prenom, email, telephone)')
    .eq('id', params.id)
    .eq('organization_id', auth.user.organizationId)
    .single()
  if (!candidat) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })

  const { data: poei } = await supabase.from('poei').select('*').eq('id', candidat.poei_id).single()
  const [{ data: client }, { data: formation }, { data: session }] = await Promise.all([
    poei?.client_id ? supabase.from('clients').select('*').eq('id', poei.client_id).single() : Promise.resolve({ data: null } as any),
    poei?.formation_id ? supabase.from('formations').select('intitule, programme_detaille, duree_heures').eq('id', poei.formation_id).single() : Promise.resolve({ data: null } as any),
    poei?.session_id ? supabase.from('sessions').select('date_debut, date_fin, horaires_jours').eq('id', poei.session_id).single() : Promise.resolve({ data: null } as any),
  ])

  const cli: any = client || {}
  const f: any = formation || {}
  const sess: any = session || {}
  const app: any = candidat.apprenant || {}

  // Lignes tableau = semaines du programme (dates calées sur les jours de session), max 5
  const weeks = parseWeeks(f.programme_detaille || '')
  const jours: any[] = Array.isArray(sess.horaires_jours) ? sess.horaires_jours : []
  const perWeek = weeks.length ? Math.ceil(jours.length / weeks.length) : 0
  // Date de debut de chaque semaine : jour reel de session si dispo, sinon
  // date_debut de session + 7 jours par semaine
  const base = poei?.date_debut || sess.date_debut
  const weekDate = (i: number): string => {
    if (perWeek && jours[i * perWeek]?.date) return fmt(jours[i * perWeek].date)
    if (!base) return ''
    const d = new Date(base)
    d.setDate(d.getDate() + i * 7)
    return fmt(d.toISOString())
  }
  let rows: PdcRow[] = weeks.map((w, i) => ({
    date: weekDate(i),
    comp: w.modules.join(' · '),
    heures: w.duree ? w.duree.replace(/h$/i, ' h') : '',
    obj: w.titre,
  }))
  // Si > 5 semaines, fusionne le surplus dans la 5e ligne
  if (rows.length > 5) {
    const tail = rows.slice(4)
    rows = rows.slice(0, 4)
    rows.push({
      date: tail[0].date,
      comp: tail.map((r) => r.comp).join(' · '),
      heures: '', obj: tail.map((r) => r.obj).join(' / '),
    })
  }

  const data = {
    employeur: [cli.civilite, cli.prenom, (cli.nom || '').toUpperCase()].filter(Boolean).join(' '),
    raison: [cli.raison_sociale, cli.sigle].filter(Boolean).join(' - '),
    adresse: cli.adresse || '',
    cp: cli.code_postal || '', ville: cli.ville || '',
    responsable: poei?.tuteur_nom || [cli.civilite, cli.prenom, cli.nom].filter(Boolean).join(' '),
    telFixe: cli.telephone || '', telPort: cli.whatsapp || '',
    mail: cli.email || '',
    poste: candidat.poste_vise || poei?.poste_vise || '',
    debut: fmt(poei?.date_debut || sess.date_debut),
    fin: fmt(poei?.date_fin || sess.date_fin),
    hebdo: jours.length ? '35 heures' : '',
    total: (poei?.duree_heures || f.duree_heures) ? `${poei?.duree_heures || f.duree_heures} heures` : '',
    embauche: fmt(candidat.date_embauche_prevue || poei?.date_embauche_prevue),
    stagiaireCiv: app.civilite || 'M', stagiaire: `${(app.nom || '').toUpperCase()} ${app.prenom || ''}`.trim(),
    tuteurCiv: '', tuteur: poei?.tuteur_nom || '', fonction: '',
    rows,
  }

  // Charge le vrai formulaire France Travail et le remplit
  const tplRes = await fetch(new URL('/templates/pdc-france-travail.pdf', req.url))
  const tpl = await tplRes.arrayBuffer()
  const pdf = await fillPdc(tpl, data)

  const nom = `${app.prenom || ''}_${app.nom || 'candidat'}`.replace(/\s+/g, '')
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="plan-developpement-competences-${nom}.pdf"`,
    },
  })
}
