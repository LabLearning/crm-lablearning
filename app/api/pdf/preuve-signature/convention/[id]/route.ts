import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { sha256 } from '@/lib/preuve-signature-convention'
import {
  CertificatSignatureConventionPDF, decrireAppareil,
  type EvenementPreuve, type PreuveSignatureConvention,
} from '@/lib/pdf/certificat-signature-convention-pdf'


/**
 * Certificat de signature électronique d'une convention (dossier de preuve).
 * Il ne se délivre que pour une convention signée électroniquement par le
 * client, et ne présente que les preuves réellement enregistrées.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId
  const supabase = await createServiceRoleClient()

  // Le certificat porte l'IP, le navigateur et la signature du client : mêmes
  // droits que la page Conventions, selon les permissions de l'organisation
  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', orgId).eq('role', auth.user.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/conventions', auth.user.role as any, (permissions || []) as any).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const { data: c } = await supabase.from('conventions')
    .select(`id, organization_id, numero, objet, status, created_at, created_by,
      signature_client_nom, signature_client_signature_data, signature_client_ip, signature_client_user_agent,
      client:client_id(type, raison_sociale, siret), formation:formation_id(intitule),
      session:session_id(reference, date_debut, date_fin)`)
    .eq('id', params.id).eq('organization_id', orgId).maybeSingle()
  if (!c) return NextResponse.json({ error: 'Convention introuvable' }, { status: 404 })
  if (!c.signature_client_signature_data || !['signee_client', 'signee_complete'].includes(c.status)) {
    return NextResponse.json({ error: 'Aucune signature électronique du client n’est enregistrée pour cette convention.' }, { status: 404 })
  }

  const [preuves, { data: orgRaw }, { data: notifs }, { data: mails }, { data: audits }, evenementsRes] = await Promise.all([
    // Colonnes de la migration 161 : absentes, le certificat se contente de l'historique
    supabase.from('conventions')
      .select('signature_client_signed_at, signature_document_path, signature_document_sha256, signature_consentement')
      .eq('id', c.id).maybeSingle(),
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('notifications').select('created_at')
      .eq('entity_type', 'convention').eq('entity_id', c.id).eq('titre', 'Convention signée par le client')
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('email_logs').select('to_email, subject, status, resend_id, sent_at, created_at')
      .eq('entity_type', 'convention').eq('entity_id', c.id).order('created_at', { ascending: true }),
    supabase.from('audit_logs').select('action, user_id, created_at')
      .eq('entity_type', 'convention').eq('entity_id', c.id)
      .in('action', ['generate_signature_link', 'send_convention_signature', 'send_convention_inter', 'cancel_signature_request', 'sign_convention', 'cancel_signed_convention'])
      .order('created_at', { ascending: true }),
    supabase.from('convention_signature_evenements').select('evenement, survenu_at, ip_address, user_agent, details')
      .eq('convention_id', c.id).order('survenu_at', { ascending: true }),
  ])
  const p: any = preuves.error ? {} : preuves.data || {}
  const evenements: any[] = evenementsRes.error ? [] : evenementsRes.data || []

  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Noms des utilisateurs cités par le journal
  const userIds = Array.from(new Set([
    c.created_by, ...(audits || []).map((a: any) => a.user_id), ...evenements.map((e) => e.details?.par),
  ].filter(Boolean))) as string[]
  const { data: users } = userIds.length
    ? await supabase.from('users').select('id, first_name, last_name, email').in('id', userIds)
    : { data: [] as any[] }
  const nomUser = (id: string | null | undefined) => {
    const u = (users || []).find((x: any) => x.id === id)
    return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : null
  }

  // Horodatage réel : enregistré à la signature, sinon celui de la notification
  // créée au même instant ; la date portée sur la convention n'est jamais utilisée
  // (à défaut, l'envoi automatique de l'exemplaire signé : la signature est
  // antérieure de quelques secondes, c'est donc un « au plus tard »)
  const particulier = (c as any).client?.type === 'particulier'
  const demandes = (mails || []).filter((m: any) => !/copie ex[ée]cut[ée]e/i.test(m.subject || '') && /signer|signature/i.test(m.subject || ''))
  const copies = (mails || []).filter((m: any) => /copie ex[ée]cut[ée]e/i.test(m.subject || ''))
  // Une trace antérieure à la dernière annulation appartient à une signature
  // effacée : elle ne date jamais la signature actuelle
  const derniereAnnulation = [
    ...(audits || []).filter((a: any) => a.action === 'cancel_signed_convention').map((a: any) => a.created_at),
    ...evenements.filter((e) => e.evenement === 'annulation').map((e) => e.survenu_at),
  ].sort().pop() || ''
  const apres = (t: string | null | undefined) => (t && t > derniereAnnulation ? t : null)
  const evtSignature = [...evenements].reverse().find((e) => e.evenement === 'signature' && apres(e.survenu_at)) || null
  const notif = apres(notifs?.[0]?.created_at)
  const derniereCopie = copies.length ? apres(copies[copies.length - 1].sent_at || copies[copies.length - 1].created_at) : null
  const horodatage: string | null = p.signature_client_signed_at || evtSignature?.survenu_at || notif || derniereCopie || null
  const sourceHorodatage: PreuveSignatureConvention['signature']['sourceHorodatage'] =
    evtSignature ? 'signature'
    : (p.signature_client_signed_at || notif) ? 'notification'
    : derniereCopie ? 'copie' : null

  // Exemplaire figé : relu pour vérifier son empreinte
  let exemplaire: PreuveSignatureConvention['document']['exemplaire'] = { etat: 'non_fige' }
  const msFichier = (chemin: string) => Number((chemin.match(/signee-(\d+)\.pdf$/) || [])[1]) || 0
  if (p.signature_document_path && p.signature_document_sha256) {
    let verifie: boolean | null = null
    const { data: fichier } = await supabase.storage.from('documents').download(p.signature_document_path)
    if (fichier) verifie = sha256(Buffer.from(await fichier.arrayBuffer())) === p.signature_document_sha256
    const ms = msFichier(String(p.signature_document_path))
    exemplaire = { etat: 'fige', sha256: p.signature_document_sha256, figeLe: ms ? new Date(ms).toISOString() : null, verifie, empreinteEnregistree: true }
  } else {
    // Exemplaire déposé mais dont le chemin n'a pas pu être noté (colonnes
    // absentes) : le fichier de la signature en cours se retrouve dans le dossier
    const dossier = `${orgId}/conventions/${c.id}`
    const { data: fichiers } = await supabase.storage.from('documents').list(dossier, { limit: 100 })
    const dernier = (fichiers || [])
      .map((f: any) => ({ nom: f.name as string, ms: msFichier(f.name) }))
      .filter((f) => f.ms && new Date(f.ms).toISOString() > derniereAnnulation)
      .sort((a, b) => b.ms - a.ms)[0]
    if (dernier) {
      const { data: fichier } = await supabase.storage.from('documents').download(`${dossier}/${dernier.nom}`)
      if (fichier) {
        exemplaire = {
          etat: 'fige', sha256: sha256(Buffer.from(await fichier.arrayBuffer())),
          figeLe: new Date(dernier.ms).toISOString(), verifie: null, empreinteEnregistree: false,
        }
      }
    }
  }

  const ipUa = (ip?: string | null, ua?: string | null) => [ip ? `IP ${ip}` : null, decrireAppareil(ua)].filter(Boolean).join(' · ') || null

  // ── Journal ──
  const journal: EvenementPreuve[] = []
  journal.push({ at: c.created_at, libelle: particulier ? 'Contrat de formation créé' : 'Convention créée', detail: nomUser(c.created_by) ? `par ${nomUser(c.created_by)}` : null })
  for (const a of audits || []) {
    const par = nomUser(a.user_id)
    const libelle: Record<string, string> = {
      generate_signature_link: 'Lien de signature préparé',
      send_convention_signature: 'Envoi pour signature demandé',
      send_convention_inter: 'Envoi pour signature demandé',
      cancel_signature_request: 'Demande de signature annulée',
      cancel_signed_convention: 'Signature précédente annulée',
      sign_convention: 'Signature validée depuis un navigateur connecté au CRM',
    }
    journal.push({ at: a.created_at, libelle: libelle[a.action] || a.action, detail: par ? (a.action === 'sign_convention' ? `compte ${par}` : `par ${par}`) : null })
  }
  for (const m of demandes) {
    journal.push({
      at: m.sent_at || m.created_at,
      libelle: 'Email de demande de signature envoyé',
      detail: [`à ${m.to_email}`, m.status === 'sent' ? 'accepté par le service d’envoi' : `statut ${m.status}`, m.resend_id ? `identifiant d’envoi ${m.resend_id}` : null].filter(Boolean).join(' · '),
    })
  }
  for (const e of evenements) {
    // Une ouverture depuis un poste de l'équipe n'est pas celle du signataire
    const equipe = e.details?.compte_crm ? `depuis un compte du CRM (${e.details.compte_crm})` : null
    const detail = [equipe, ipUa(e.ip_address, e.user_agent)].filter(Boolean).join(' · ') || null
    if (e.evenement === 'lien_ouvert') journal.push({ at: e.survenu_at, libelle: 'Page de signature ouverte', detail })
    else if (e.evenement === 'document_consulte') journal.push({ at: e.survenu_at, libelle: particulier ? 'Contrat complet consulté (PDF)' : 'Convention complète consultée (PDF)', detail })
    else if (e.evenement === 'signature') journal.push({ at: e.survenu_at, libelle: `Signature par ${e.details?.signataire || c.signature_client_nom}`, detail })
    else if (e.evenement === 'annulation') journal.push({ at: e.survenu_at, libelle: 'Signature annulée par l’organisme', detail: nomUser(e.details?.par) ? `par ${nomUser(e.details?.par)}` : null })
  }
  if (!evtSignature && horodatage) {
    journal.push({
      at: horodatage,
      libelle: `Signature par ${c.signature_client_nom}${sourceHorodatage === 'copie' ? ' (au plus tard)' : ''}`,
      detail: ipUa(c.signature_client_ip, c.signature_client_user_agent),
    })
  }
  if (exemplaire.etat === 'fige' && exemplaire.figeLe) {
    journal.push({ at: exemplaire.figeLe, libelle: 'Exemplaire signé figé et archivé', detail: `empreinte SHA-256 ${exemplaire.sha256.slice(0, 16)}…` })
  }
  for (const m of copies) {
    journal.push({ at: m.sent_at || m.created_at, libelle: 'Exemplaire signé envoyé', detail: [`à ${m.to_email}`, m.resend_id ? `identifiant d’envoi ${m.resend_id}` : null].filter(Boolean).join(' · ') })
  }
  journal.sort((a, b) => a.at.localeCompare(b.at))
  // Un même geste journalisé deux fois dans la minute n'apparaît qu'une fois
  const evenementsJournal = journal.filter((e, i) => !journal.slice(0, i).some((x) =>
    x.libelle === e.libelle && x.detail === e.detail && Math.abs(new Date(x.at).getTime() - new Date(e.at).getTime()) < 60_000))

  const session: any = (c as any).session
  const fmtJour = (d: string | null) => d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR') : null
  const clientNom = (c as any).client?.raison_sociale || null

  const preuve: PreuveSignatureConvention = {
    emisLe: new Date().toISOString(),
    document: {
      intitule: particulier ? 'Contrat de formation professionnelle' : 'Convention de formation professionnelle',
      numero: c.numero || c.id,
      identifiant: c.id,
      objet: c.objet || null,
      formation: (c as any).formation?.intitule || null,
      session: session ? [session.reference, session.date_debut ? `du ${fmtJour(session.date_debut)} au ${fmtJour(session.date_fin || session.date_debut)}` : null].filter(Boolean).join(', ') : null,
      client: clientNom,
      clientSiret: (c as any).client?.siret || null,
      organisme: orgRaw?.legal_name || orgRaw?.name || 'Organisme de formation',
      organismeSiret: orgRaw?.siret || null,
      organismeNda: orgRaw?.numero_da || null,
      exemplaire,
    },
    signataire: {
      nom: c.signature_client_nom || 'Non renseigné',
      qualite: particulier ? 'Stagiaire, partie au contrat' : 'Représentant de l’entreprise cliente',
      entreprise: particulier ? null : clientNom,
      emailLien: demandes.length ? Array.from(new Set(demandes.map((m: any) => m.to_email))).join(', ') : null,
    },
    signature: {
      horodatage,
      sourceHorodatage,
      ip: c.signature_client_ip || evtSignature?.ip_address || null,
      appareil: decrireAppareil(c.signature_client_user_agent || evtSignature?.user_agent),
      userAgent: c.signature_client_user_agent || evtSignature?.user_agent || null,
      consentement: p.signature_consentement || null,
      image: c.signature_client_signature_data,
      imageSha256: sha256(c.signature_client_signature_data),
    },
    evenements: evenementsJournal,
    empreinteDossier: '',
  }
  // Empreinte des preuves : tout sauf la date d'émission et l'image elle-même
  // (représentée par sa propre empreinte), pour qu'un nouveau tirage la retrouve
  const { emisLe, ...stable } = preuve
  preuve.empreinteDossier = sha256(JSON.stringify({ ...stable, signature: { ...stable.signature, image: undefined } }))

  const buffer = await renderToBuffer(createElement(CertificatSignatureConventionPDF, { preuve, org }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificat-signature-${c.numero || c.id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
