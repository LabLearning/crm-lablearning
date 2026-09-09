import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Le brief du matin de Starkk : chaque jour ouvré, l'équipe reçoit par email
 * le point du jour — sessions, signatures en attente, encours de facturation,
 * alertes AGEFICE, réclamations. Composé depuis les mêmes données que les
 * outils de l'assistant.
 *
 * GET /api/cron/brief-starkk  (Authorization: Bearer CRON_SECRET)
 *   ?dry=1              → renvoie le HTML sans envoyer
 *   ?test=adresse@mail  → envoie le brief à cette seule adresse
 */
// Valeurs de l'ENUM user_role uniquement (« admin »/« manager » n'existent pas)
const ROLES_DESTINATAIRES = ['super_admin', 'gestionnaire', 'commercial']

const euros = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} €`
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

    const auj = new Date().toISOString().slice(0, 10)
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const on = (q: any) => q.eq('organization_id', org.id)

    const [sessJour, sessDemain, convs, dossiers, factRetard, recl] = await Promise.all([
      on(supabase.from('sessions').select('id, date_debut, date_fin, lieu, ville, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial), formateur:formateurs(prenom, nom)'))
        .lte('date_debut', auj).gte('date_fin', auj).not('status', 'in', '("annulee")'),
      on(supabase.from('sessions').select('id, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial), formateur:formateurs(prenom, nom)'))
        .eq('date_debut', demain).not('status', 'in', '("annulee")'),
      on(supabase.from('conventions').select('id, numero, sent_at, session_id, client:client_id(raison_sociale, nom_commercial)'))
        .not('sent_at', 'is', null).is('signature_client_date', null).order('sent_at').limit(8),
      on(supabase.from('dossiers_agefice').select('id, numero_dossier, statut, mode_reglement, signature_stagiaire_date, date_fin_formation, session_id, apprenant:apprenant_id(prenom, nom)'))
        .neq('statut', 'solde'),
      on(supabase.from('factures').select('id, numero, montant_restant, client:client_id(raison_sociale, nom_commercial)'))
        .eq('status', 'en_retard').gt('montant_restant', 0).order('montant_restant', { ascending: false }),
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

    const jour = (sessJour.data || []) as any[]
    const lendemain = (sessDemain.data || []) as any[]
    const conventions = (convs.data || []) as any[]
    const retards = (factRetard.data || []) as any[]
    const totalRetard = retards.reduce((s, f) => s + Number(f.montant_restant || 0), 0)
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
      <td style="width:25%;padding:0 4px">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${alerte ? 'rgba(92,217,160,0.14)' : 'rgba(255,255,255,0.06)'};border:1px solid ${alerte ? 'rgba(92,217,160,0.45)' : 'rgba(255,255,255,0.12)'};border-radius:12px">
          <tr><td style="padding:10px 8px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:${alerte ? MINT : WHITE};line-height:1.1">${valeur}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-top:4px">${label}</div>
          </td></tr>
        </table>
      </td>`

    // ── Sessions ──
    const lignesSessions = [
      ...jour.map((s) => L(
        `${esc(s.formation?.intitule || 'Formation')} <span style="font-weight:500;color:${SLATE}">chez</span> ${esc(nomCli(s.client))}`,
        [nomForm(s.formateur) ? `Formateur : ${esc(nomForm(s.formateur))}` : `<span style="color:${AMBER};font-weight:600">Aucun formateur affecté</span>`, s.lieu || s.ville ? esc(s.lieu || s.ville) : '', s.date_fin !== s.date_debut ? `jusqu’au ${frDate(s.date_fin)}` : ''].filter(Boolean).join(' · '),
        bouton(`/dashboard/sessions/${s.id}`, 'Ouvrir'),
      )),
      ...lendemain.map((s) => L(
        `${tag('Demain', 'muted')}&nbsp; ${esc(s.formation?.intitule || 'Formation')} <span style="font-weight:500;color:${SLATE}">chez</span> ${esc(nomCli(s.client))}`,
        nomForm(s.formateur) ? `Formateur : ${esc(nomForm(s.formateur))}` : `<span style="color:${AMBER};font-weight:600">Aucun formateur affecté</span>`,
        bouton(`/dashboard/sessions/${s.id}`, 'Préparer'),
      )),
    ]

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

    // ── Facturation ──
    const lignesFactures = retards.slice(0, 4).map((f) => L(
      `${esc(f.numero)} <span style="font-weight:500;color:${SLATE}">de</span> ${esc(nomCli(f.client))}`,
      `${euros(Number(f.montant_restant))} restant dus`,
      bouton('/dashboard/factures', 'Relancer'),
    ))
    if (retards.length > 4) lignesFactures.push(L(`+ ${retards.length - 4} autre${retards.length - 4 > 1 ? 's' : ''} facture${retards.length - 4 > 1 ? 's' : ''} en retard`, '', bouton('/dashboard/factures', 'Voir tout')))

    // ── Réclamations ──
    const lignesRecl = nbRecl > 0
      ? [L(`${nbRecl} réclamation${nbRecl > 1 ? 's' : ''} ouverte${nbRecl > 1 ? 's' : ''}`, 'À traiter dans les délais Qualiopi', bouton('/dashboard/reclamations', 'Traiter', 'pine'))]
      : []

    const toutCalme = !jour.length && !lendemain.length && !nbSignatures && !retards.length && !nbRecl
    const dateLongue = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const Dat = dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)
    const prenom = (u: { first_name: string | null }) => (u.first_name ? `Bonjour ${esc(u.first_name)},` : 'Bonjour,')
    const accroche = toutCalme
      ? 'rien ne presse aujourd’hui. Je continue de veiller.'
      : [
          jour.length ? `${jour.length} session${jour.length > 1 ? 's' : ''} en cours` : '',
          nbSignatures ? `${nbSignatures} signature${nbSignatures > 1 ? 's' : ''} à obtenir` : '',
          retards.length ? `${euros(totalRetard)} de factures en retard` : '',
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
                <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${MINT}">Le brief du matin</div>
                <div style="font-size:20px;font-weight:800;color:${WHITE};line-height:1.2;margin-top:2px">${Dat}</div>
              </td>
            </tr></table>
            <div style="font-size:14px;color:rgba(255,255,255,0.78);line-height:1.6;margin-top:16px">
              ${prenom(u)} ${accroche}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
              ${tuile(String(jour.length), 'Sessions', jour.length > 0)}
              ${tuile(String(nbSignatures), 'Signatures', nbSignatures > 0)}
              ${tuile(retards.length ? euros(totalRetard).replace(' €', '&nbsp;€') : '0', 'En retard', retards.length > 0)}
              ${tuile(String(nbRecl), 'Réclamations', nbRecl > 0)}
            </tr></table>
          </td></tr>
          <!-- Corps -->
          <tr><td style="background:${WHITE};border:1px solid ${LINE};border-top:0;border-radius:0 0 18px 18px;padding:18px 16px 6px">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${carte('Sessions', jour.length + lendemain.length ? `${jour.length} aujourd’hui · ${lendemain.length} demain` : '', lignesSessions, 'Aucune session aujourd’hui ni demain.')}
              ${carte('Signatures et dossiers en attente', nbSignatures ? `${nbSignatures} en attente` : '', lignesSignatures, 'Rien à relancer : toutes les conventions envoyées sont signées.')}
              ${carte('Facturation', retards.length ? `${retards.length} en retard · ${euros(totalRetard)}` : '', lignesFactures, 'Aucune facture en retard.')}
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
        subject: toutCalme ? `Brief de Starkk, ${dateLongue} : tout est calme` : `Brief de Starkk, ${dateLongue} : ${[jour.length ? `${jour.length} session${jour.length > 1 ? 's' : ''}` : '', nbSignatures ? `${nbSignatures} signature${nbSignatures > 1 ? 's' : ''}` : '', retards.length ? `${euros(totalRetard)} en retard` : ''].filter(Boolean).join(', ')}`,
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
