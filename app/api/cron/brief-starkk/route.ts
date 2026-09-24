import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Le brief de la semaine de Starkk : chaque lundi matin, l'équipe reçoit par
 * email le point de la semaine — sessions du lundi au dimanche, signatures en
 * attente, alertes AGEFICE, réclamations. Composé
 * depuis les mêmes données que les outils de l'assistant. (Il partait chaque
 * jour ouvré jusqu'au 24/09/2026 : trop fréquent pour l'équipe. Les factures
 * en retard n'y figurent plus, à la demande de Brahim.)
 *
 * GET /api/cron/brief-starkk  (Authorization: Bearer CRON_SECRET)
 *   ?dry=1              → renvoie le HTML sans envoyer
 *   ?test=adresse@mail  → envoie le brief à cette seule adresse
 */
// Valeurs de l'ENUM user_role uniquement (« admin »/« manager » n'existent pas)
const ROLES_DESTINATAIRES = ['super_admin', 'gestionnaire', 'commercial']

const frDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── Palette (charte Lab Learning) ──
const PINE = '#205040', MINT = '#5CD9A0', INK = '#14110F', SLATE = '#57534E', MUTED = '#8A8580'
const LINE = '#E7E5E4', PAPER = '#F6F5F2', WHITE = '#FFFFFF', AMBER = '#B45309', AMBER_BG = '#FFF7ED', RED = '#B91C1C', RED_BG = '#FEF2F2'

export async function GET(req: Request) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized
  const url = new URL(req.url)
  const dry = url.searchParams.get('dry') === '1'
  const test = url.searchParams.get('test')

  const supabase = await createServiceRoleClient()
  const { data: orgs } = await supabase.from('organizations').select('id, name, email')
  let envoyes = 0

  for (const org of orgs || []) {
    // Destinataires : l'équipe interne active avec email (ou l'adresse de test)
    const { data: equipe } = await supabase.from('users')
      .select('email, first_name')
      .eq('organization_id', org.id).eq('status', 'active')
      .in('role', ROLES_DESTINATAIRES).not('email', 'is', null)
    const destinataires = test ? [{ email: test, first_name: null as string | null }] : (equipe || [])
    if (!destinataires.length) continue

    // La semaine en cours, du lundi au dimanche
    const d0 = new Date()
    const decalage = (d0.getUTCDay() + 6) % 7
    const lundi = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() - decalage)).toISOString().slice(0, 10)
    const dimanche = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() - decalage + 6)).toISOString().slice(0, 10)
    const on = (q: any) => q.eq('organization_id', org.id)

    const [sessSemaine, convs, dossiers, recl] = await Promise.all([
      // Sessions qui se déroulent au moins un jour cette semaine (hors sous-périodes POEI)
      on(supabase.from('sessions').select('id, date_debut, date_fin, lieu, ville, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial), formateur:formateurs(prenom, nom)'))
        .lte('date_debut', dimanche).gte('date_fin', lundi).not('status', 'in', '("annulee")')
        .is('poei_intervention_id', null).order('date_debut'),
      on(supabase.from('conventions').select('id, numero, sent_at, session_id, client:client_id(raison_sociale, nom_commercial)'))
        .not('sent_at', 'is', null).is('signature_client_date', null).order('sent_at').limit(8),
      on(supabase.from('dossiers_agefice').select('id, numero_dossier, statut, mode_reglement, signature_stagiaire_date, date_fin_formation, session_id, apprenant:apprenant_id(prenom, nom)'))
        .neq('statut', 'solde'),
      on(supabase.from('reclamations').select('id', { count: 'exact', head: true }))
        .not('status', 'in', '("cloturee","resolue")'),
    ])

    const nomCli = (c: any) => c?.nom_commercial || c?.raison_sociale || ''
    const nomForm = (f: any) => (f ? `${f.prenom || ''} ${f.nom || ''}`.trim() : '')
    const maintenant = Date.now()
    const alertesAgefice = ((dossiers.data || []) as any[]).map((d) => {
      const points: string[] = []
      let urgent = false
      if (!d.mode_reglement) points.push('règlement du dirigeant à recevoir')
      else if (!d.signature_stagiaire_date) points.push('attestation à faire signer')
      if (d.date_fin_formation) {
        const restant = Math.round((new Date(d.date_fin_formation).getTime() + 122 * 86400000 - maintenant) / 86400000)
        if (restant < 45) { points.push(`remboursement à demander sous ${restant} j`); urgent = restant < 15 }
      }
      return points.length ? {
        nom: `${d.apprenant?.prenom || ''} ${d.apprenant?.nom || ''}`.trim(), numero: d.numero_dossier, points, urgent,
        lien: d.session_id ? `/dashboard/sessions/${d.session_id}?tab=facturation` : '/dashboard/agefice',
      } : null
    }).filter(Boolean) as any[]

    const semaine = (sessSemaine.data || []) as any[]
    const dejaEnCours = semaine.filter((s) => s.date_debut < lundi).length

    // Parcours POEI : la session chapeau n'a pas de formateur, ce sont les
    // interventions qui en portent un (même lecture que le tableau de bord)
    const { data: parcours } = semaine.length
      ? await supabase.from('poei').select('id, session_id').in('session_id', semaine.map((s) => s.id))
      : { data: [] as any[] }
    const poeiParSession = new Map(((parcours || []) as any[]).map((p) => [p.session_id, p.id]))
    const { formateursDesPoei } = await import('@/lib/poei-formateurs')
    const formateursPoei = await formateursDesPoei(supabase, [...poeiParSession.values()])
    const formateurDe = (s: any) => nomForm(s.formateur) || (poeiParSession.has(s.id) ? formateursPoei.get(poeiParSession.get(s.id)!) || '' : '')
    const conventions = (convs.data || []) as any[]
    const nbRecl = recl.count || 0
    const nbSignatures = conventions.length + alertesAgefice.length
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

    // ── Briques HTML (tableaux + styles inline : lisible partout) ──
    const bouton = (path: string, label: string, tone: 'pine' | 'ghost' = 'ghost') => {
      const style = tone === 'pine'
        ? `background:${PINE};color:${WHITE};border:1px solid ${PINE}`
        : `background:${WHITE};color:${PINE};border:1px solid ${LINE}`
      return `<a href="${appUrl}${path}" style="display:inline-block;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;${style}">${label}</a>`
    }
    const tag = (t: string, tone: 'amber' | 'red' | 'muted' = 'muted') => {
      const [bg, fg] = tone === 'red' ? [RED_BG, RED] : tone === 'amber' ? [AMBER_BG, AMBER] : [PAPER, SLATE]
      return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${bg};color:${fg}">${t}</span>`
    }
    /** Une ligne de carte : titre + détail à gauche, action à droite. */
    const ligne = (titre: string, detail: string, action: string, dernier = false) => `
      <tr>
        <td style="padding:12px 16px;${dernier ? '' : `border-bottom:1px solid ${LINE};`}vertical-align:top">
          <div style="font-size:14px;font-weight:600;color:${INK};line-height:1.4">${titre}</div>
          ${detail ? `<div style="font-size:13px;color:${SLATE};line-height:1.5;margin-top:2px">${detail}</div>` : ''}
        </td>
        <td style="padding:12px 16px 12px 0;${dernier ? '' : `border-bottom:1px solid ${LINE};`}vertical-align:middle;text-align:right;width:1%">${action}</td>
      </tr>`
    /** Une carte : en-tête (titre + compteur) puis lignes. */
    const carte = (titre: string, compteur: string, lignes: string[], vide: string) => `
      <tr><td style="padding:0 0 14px">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${WHITE};border:1px solid ${LINE};border-radius:14px;border-collapse:separate;overflow:hidden">
          <tr><td colspan="2" style="padding:12px 16px;border-bottom:1px solid ${LINE};background:${PAPER}">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:13px;font-weight:800;color:${INK};letter-spacing:.2px">${titre}</td>
              <td style="text-align:right;font-size:12px;font-weight:700;color:${MUTED}">${compteur}</td>
            </tr></table>
          </td></tr>
          ${lignes.length ? lignes.map((l, i) => l.replace('__DERNIER__', i === lignes.length - 1 ? 'oui' : '')).join('') : `<tr><td colspan="2" style="padding:14px 16px;font-size:13px;color:${MUTED}">${vide}</td></tr>`}
        </table>
      </td></tr>`
    const L = (titre: string, detail: string, action: string) => ligne(titre, detail, action)
    /** Tuile chiffrée du bandeau. */
    const tuile = (valeur: string, label: string, alerte: boolean) => `
      <td style="width:33%;padding:0 4px">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${alerte ? 'rgba(92,217,160,0.14)' : 'rgba(255,255,255,0.06)'};border:1px solid ${alerte ? 'rgba(92,217,160,0.45)' : 'rgba(255,255,255,0.12)'};border-radius:12px">
          <tr><td style="padding:10px 8px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:${alerte ? MINT : WHITE};line-height:1.1">${valeur}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-top:4px">${label}</div>
          </td></tr>
        </table>
      </td>`

    // ── Sessions de la semaine, dans l'ordre ──
    const periodeSession = (s: any) => s.date_fin && s.date_fin !== s.date_debut
      ? `du ${frDate(s.date_debut)} au ${frDate(s.date_fin)}`
      : `le ${frDate(s.date_debut)}`
    const lignesSessions = semaine.map((s) => L(
      `${s.date_debut < lundi ? `${tag('En cours', 'muted')}&nbsp; ` : ''}${esc(s.formation?.intitule || 'Formation')} <span style="font-weight:500;color:${SLATE}">chez</span> ${esc(nomCli(s.client))}`,
      [periodeSession(s), formateurDe(s) ? `Formateur : ${esc(formateurDe(s))}` : `<span style="color:${AMBER};font-weight:600">Aucun formateur affecté</span>`, s.lieu || s.ville ? esc(s.lieu || s.ville) : ''].filter(Boolean).join(' · '),
      bouton(`/dashboard/sessions/${s.id}`, s.date_debut < lundi ? 'Ouvrir' : 'Préparer'),
    ))

    // ── Signatures et dossiers ──
    const lignesSignatures = [
      ...conventions.map((c) => {
        const jours = c.sent_at ? Math.round((maintenant - new Date(c.sent_at).getTime()) / 86400000) : 0
        return L(
          `Convention ${esc(c.numero)} <span style="font-weight:500;color:${SLATE}">de</span> ${esc(nomCli(c.client))}`,
          `Envoyée le ${frDate(c.sent_at)} ${jours >= 7 ? tag(`${jours} j sans réponse`, jours >= 21 ? 'red' : 'amber') : ''}`,
          bouton(c.session_id ? `/dashboard/sessions/${c.session_id}?tab=conventions` : '/dashboard/conventions', 'Relancer', jours >= 21 ? 'pine' : 'ghost'),
        )
      }),
      ...alertesAgefice.map((a) => L(
        `${tag('AGEFICE', a.urgent ? 'red' : 'amber')}&nbsp; ${esc(a.nom)}${a.numero ? ` <span style="font-weight:500;color:${MUTED}">n° ${esc(a.numero)}</span>` : ''}`,
        esc(a.points.join(' · ')),
        bouton(a.lien, 'Voir le dossier', a.urgent ? 'pine' : 'ghost'),
      )),
    ]

    // ── Réclamations ──
    const lignesRecl = nbRecl > 0
      ? [L(`${nbRecl} réclamation${nbRecl > 1 ? 's' : ''} ouverte${nbRecl > 1 ? 's' : ''}`, 'À traiter dans les délais Qualiopi', bouton('/dashboard/reclamations', 'Traiter', 'pine'))]
      : []

    const toutCalme = !semaine.length && !nbSignatures && !nbRecl
    const dateLongue = `semaine du ${frDate(lundi)}`
    const Dat = dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)
    const prenom = (u: { first_name: string | null }) => (u.first_name ? `Bonjour ${esc(u.first_name)},` : 'Bonjour,')
    const accroche = toutCalme
      ? 'rien ne presse cette semaine. Je continue de veiller.'
      : [
          semaine.length ? `${semaine.length} session${semaine.length > 1 ? 's' : ''} cette semaine` : '',
          nbSignatures ? `${nbSignatures} signature${nbSignatures > 1 ? 's' : ''} à obtenir` : '',
          nbRecl ? `${nbRecl} réclamation${nbRecl > 1 ? 's' : ''}` : '',
        ].filter(Boolean).join(', ') + '. Voici le détail.'

    const htmlPour = (u: { first_name: string | null }) => `
      <div style="background:${PAPER};padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
          <!-- Bandeau -->
          <tr><td style="background:#0C1210;border-radius:18px 18px 0 0;padding:22px 22px 18px">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="width:52px;vertical-align:middle"><img src="${appUrl}/starkk.png" width="52" height="52" style="border-radius:50%;display:block;border:2px solid ${MINT}" alt="Starkk"/></td>
              <td style="padding-left:14px;vertical-align:middle">
                <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${MINT}">Le brief de la semaine</div>
                <div style="font-size:20px;font-weight:800;color:${WHITE};line-height:1.2;margin-top:2px">${Dat}</div>
              </td>
            </tr></table>
            <div style="font-size:14px;color:rgba(255,255,255,0.78);line-height:1.6;margin-top:16px">
              ${prenom(u)} ${accroche}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
              ${tuile(String(semaine.length), 'Sessions', semaine.length > 0)}
              ${tuile(String(nbSignatures), 'Signatures', nbSignatures > 0)}
              ${tuile(String(nbRecl), 'Réclamations', nbRecl > 0)}
            </tr></table>
          </td></tr>
          <!-- Corps -->
          <tr><td style="background:${WHITE};border:1px solid ${LINE};border-top:0;border-radius:0 0 18px 18px;padding:18px 16px 6px">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${carte('Sessions de la semaine', semaine.length ? `${semaine.length} session${semaine.length > 1 ? 's' : ''}${dejaEnCours ? ` · dont ${dejaEnCours} déjà en cours` : ''}` : '', lignesSessions, 'Aucune session cette semaine.')}
              ${carte('Signatures et dossiers en attente', nbSignatures ? `${nbSignatures} en attente` : '', lignesSignatures, 'Rien à relancer : toutes les conventions envoyées sont signées.')}
              ${nbRecl ? carte('Réclamations', `${nbRecl} ouverte${nbRecl > 1 ? 's' : ''}`, lignesRecl, '') : ''}
            </table>
          </td></tr>
          <!-- Pied -->
          <tr><td style="padding:18px 8px 0;text-align:center">
            <div style="font-size:12px;color:${MUTED};line-height:1.6">
              Un détail, une action ? Ouvrez la bulle <strong style="color:${PINE}">Starkk</strong> dans le CRM et demandez-lui.<br/>
              ${bouton('/dashboard', 'Ouvrir le CRM', 'pine')}
            </div>
          </td></tr>
        </table>
      </div>`

    if (dry) return new NextResponse(htmlPour(destinataires[0] as any), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

    const { sendBrandedEmail } = await import('@/lib/email')
    for (const u of destinataires) {
      const r = await sendBrandedEmail({
        to: u.email,
        toName: u.first_name || undefined,
        subject: toutCalme ? `Brief de Starkk, ${dateLongue} : tout est calme` : `Brief de Starkk, ${dateLongue} : ${[semaine.length ? `${semaine.length} session${semaine.length > 1 ? 's' : ''}` : '', nbSignatures ? `${nbSignatures} signature${nbSignatures > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')}`,
        html: htmlPour(u as any),
        orgName: org.name || 'Lab Learning',
        orgEmail: (org as any).email || undefined,
        organizationId: org.id,
        entityType: 'brief_starkk',
        templateSlug: 'brief_starkk',
      })
      if (r.success) envoyes++
    }
    if (test) break
  }

  return NextResponse.json({ success: true, envoyes })
}
