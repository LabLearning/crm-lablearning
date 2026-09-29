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
      .order('created_at', { ascending: true }),
    supabase.from('email_logs').select('to_email, subject, status, resend_id, sent_at, created_at')
      .eq('entity_type', 'convention').eq('entity_id', c.id).order('created_at', { ascending: true }),
    supabase.from('audit_logs').select('action, user_id, created_at')
      .eq('entity_type', 'convention').eq('entity_id', c.id)
      .in('action', ['generate_signature_link', 'send_convention_signature', 'send_convention_inter', 'send_contrat_particulier', 'cancel_signature_request', 'sign_convention', 'cancel_signed_convention'])
      .order('created_at', { ascending: true }),
    supabase.from('convention_signature_evenements').select('evenement, survenu_at, ip_address, user_agent, details')
      .eq('convention_id', c.id).order('survenu_at', { ascending: true }),
  ])
  const p: any = preuves.error ? {} : preuves.data || {}
  // Tous les instants au même format, pour les comparer et les trier sans piège
  const iso = (t: string | null | undefined) => (t ? new Date(t).toISOString() : null)
  const evenements: any[] = (evenementsRes.error ? [] : evenementsRes.data || []).map((e: any) => ({ ...e, survenu_at: iso(e.survenu_at) }))

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

  const particulier = (c as any).client?.type === 'particulier'
  const nomCourt = particulier ? 'le contrat' : 'la convention'
  const demandes = (mails || []).filter((m: any) => !/copie ex[ée]cut[ée]e/i.test(m.subject || '') && /signer|signature/i.test(m.subject || ''))
  const copies = (mails || []).filter((m: any) => /copie ex[ée]cut[ée]e/i.test(m.subject || ''))
  const envoisCrm = (audits || []).filter((a: any) => /^send_/.test(a.action))

  // Une trace antérieure à la dernière annulation appartient à une signature
  // effacée : elle ne date jamais la signature actuelle
  const derniereAnnulation = [
    ...(audits || []).filter((a: any) => a.action === 'cancel_signed_convention').map((a: any) => iso(a.created_at)),
    ...evenements.filter((e) => e.evenement === 'annulation').map((e) => e.survenu_at),
  ].filter(Boolean).sort().pop() || ''
  const apres = (t: string | null | undefined) => { const x = iso(t); return x && x > derniereAnnulation ? x : null }

  // Horodatage réel : enregistré à la signature, sinon la notification créée
  // aussitôt, sinon l'envoi automatique de la copie signée (« au plus tard »).
  // La date portée sur la convention n'est jamais utilisée.
  const evtSignature = [...evenements].reverse().find((e) => e.evenement === 'signature' && apres(e.survenu_at)) || null
  const notifsCycle = (notifs || []).map((n: any) => apres(n.created_at)).filter(Boolean) as string[]
  const notif = notifsCycle[notifsCycle.length - 1] || null
  const copiesCycle = copies.filter((m: any) => apres(m.sent_at || m.created_at))
  const derniereCopie = copiesCycle.length ? iso(copiesCycle[copiesCycle.length - 1].sent_at || copiesCycle[copiesCycle.length - 1].created_at) : null
  const horodatage: string | null = iso(p.signature_client_signed_at) || evtSignature?.survenu_at || notif || derniereCopie || null
  const sourceHorodatage: PreuveSignatureConvention['signature']['sourceHorodatage'] =
    evtSignature ? 'signature'
    : (p.signature_client_signed_at || notif) ? 'notification'
    : derniereCopie ? 'copie' : null

  // Signature passée par le parcours actuel : l'IP n'est enregistrée que depuis
  // sa mise en service (aucune des signatures antérieures ne l'a)
  const canal = evtSignature?.details?.canal || null
  const parcoursActuel = !!c.signature_client_ip && canal !== 'portail'

  // Exemplaire figé : relu pour vérifier son empreinte
  const msFichier = (chemin: string) => Number((chemin.match(/signee-(\d+)\.pdf$/) || [])[1]) || 0
  let exemplaire: PreuveSignatureConvention['document']['exemplaire'] = {
    etat: 'non_fige',
    raison: c.signature_client_ip ? 'echec' : 'anterieure',
    sha256Note: evtSignature?.details?.document_sha256 || null,
  }
  if (p.signature_document_path && p.signature_document_sha256) {
    const { data: fichier, error } = await supabase.storage.from('documents').download(p.signature_document_path)
    const verifie = fichier ? sha256(Buffer.from(await fichier.arrayBuffer())) === p.signature_document_sha256 : null
    const ms = msFichier(String(p.signature_document_path))
    exemplaire = {
      etat: 'fige', sha256: p.signature_document_sha256, figeLe: ms ? new Date(ms).toISOString() : null,
      verifie, empreinteEnregistree: true, introuvable: !fichier && !!error,
    }
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
          figeLe: new Date(dernier.ms).toISOString(), verifie: null, empreinteEnregistree: false, introuvable: false,
        }
      }
    }
  }

  const ipUa = (ip?: string | null, ua?: string | null) => [ip ? `IP ${ip}` : null, decrireAppareil(ua)].filter(Boolean).join(' · ') || null
  const equipe = (compte?: string | null) => (compte ? `depuis un compte du CRM (${compte})` : null)
  // Signature validée dans un navigateur où un compte du CRM était connecté
  const auditSignature = [...(audits || [])].reverse().find((a: any) => a.action === 'sign_convention' && apres(a.created_at))
  const compteSignature = evtSignature?.details?.compte_crm || (auditSignature ? nomUser(auditSignature.user_id) || 'compte interne' : null)

  // ── Journal ──
  const journal: EvenementPreuve[] = []
  journal.push({ at: iso(c.created_at)!, libelle: particulier ? 'Contrat de formation créé' : 'Convention créée', detail: nomUser(c.created_by) ? `par ${nomUser(c.created_by)}` : null })
  const LIBELLES_AUDIT: Record<string, string> = {
    generate_signature_link: 'Lien de signature préparé',
    send_convention_signature: 'Envoi pour signature demandé',
    send_convention_inter: 'Envoi pour signature demandé',
    send_contrat_particulier: 'Envoi pour signature demandé',
    cancel_signature_request: 'Demande de signature annulée',
    cancel_signed_convention: 'Signature annulée par l’organisme',
  }
  for (const a of audits || []) {
    if (!LIBELLES_AUDIT[a.action]) continue
    const par = nomUser(a.user_id)
    journal.push({ at: iso(a.created_at)!, libelle: LIBELLES_AUDIT[a.action], detail: par ? `par ${par}` : null })
  }
  for (const m of demandes) {
    journal.push({
      at: iso(m.sent_at || m.created_at)!,
      libelle: m.status === 'sent' ? 'Email de demande de signature envoyé' : 'Email de demande de signature non parti',
      detail: [`à ${m.to_email}`, m.status === 'sent' ? 'accepté par le service d’envoi' : `statut ${m.status}`, m.resend_id ? `identifiant d’envoi ${m.resend_id}` : null].filter(Boolean).join(' · '),
    })
  }
  for (const e of evenements) {
    const detail = [equipe(e.details?.compte_crm), ipUa(e.ip_address, e.user_agent)].filter(Boolean).join(' · ') || null
    if (e.evenement === 'lien_ouvert') journal.push({ at: e.survenu_at, libelle: 'Page de signature ouverte', detail })
    else if (e.evenement === 'document_consulte') journal.push({ at: e.survenu_at, libelle: particulier ? 'Contrat complet consulté (PDF)' : 'Convention complète consultée (PDF)', detail })
    else if (e.evenement === 'signature' && e !== evtSignature) journal.push({ at: e.survenu_at, libelle: `Signature par ${e.details?.signataire || 'le client'}, annulée ensuite`, detail })
    else if (e.evenement === 'annulation' && !(audits || []).some((a: any) => a.action === 'cancel_signed_convention' && Math.abs(new Date(a.created_at).getTime() - new Date(e.survenu_at).getTime()) < 60_000)) {
      journal.push({ at: e.survenu_at, libelle: 'Signature annulée par l’organisme', detail: nomUser(e.details?.par) ? `par ${nomUser(e.details?.par)}` : null })
    }
  }
  // Signatures antérieures effacées, connues par leur seule notification
  for (const n of notifs || []) {
    const t = iso(n.created_at)!
    if (t <= derniereAnnulation && !evenements.some((e) => e.evenement === 'signature' && Math.abs(new Date(e.survenu_at).getTime() - new Date(t).getTime()) < 60_000)) {
      journal.push({ at: t, libelle: 'Signature antérieure, annulée ensuite' })
    }
  }
  // La signature en cours, à l'instant retenu dans le certificat
  if (horodatage) {
    journal.push({
      at: horodatage,
      libelle: `Signature par ${c.signature_client_nom}${sourceHorodatage === 'copie' ? ' (au plus tard)' : ''}`,
      detail: [
        canal === 'portail' ? 'depuis l’espace client' : null,
        compteSignature ? `navigateur connecté au CRM (${compteSignature})` : null,
        ipUa(c.signature_client_ip || evtSignature?.ip_address, c.signature_client_user_agent || evtSignature?.user_agent),
      ].filter(Boolean).join(' · ') || null,
    })
  }
  if (exemplaire.etat === 'fige' && exemplaire.figeLe) {
    journal.push({ at: exemplaire.figeLe, libelle: 'Exemplaire signé figé et archivé', detail: `empreinte SHA-256 ${exemplaire.sha256.slice(0, 16)}…` })
  }
  for (const m of copiesCycle) {
    journal.push({
      at: iso(m.sent_at || m.created_at)!,
      libelle: m.status === 'sent' ? 'Exemplaire signé envoyé' : 'Envoi de l’exemplaire signé en échec',
      detail: [`à ${m.to_email}`, m.status !== 'sent' ? `statut ${m.status}` : null, m.resend_id ? `identifiant d’envoi ${m.resend_id}` : null].filter(Boolean).join(' · '),
    })
  }
  journal.sort((a, b) => a.at.localeCompare(b.at))
  // Un même geste journalisé deux fois dans la minute n'apparaît qu'une fois
  const evenementsJournal = journal.filter((e, i) => !journal.slice(0, i).some((x) =>
    x.libelle === e.libelle && x.detail === e.detail && Math.abs(new Date(x.at).getTime() - new Date(e.at).getTime()) < 60_000))

  const session: any = (c as any).session
  const fmtJour = (d: string | null) => d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR') : null
  const clientNom = (c as any).client?.raison_sociale || null

  // Destinataire du lien : seulement les envois réellement partis
  const adresses = Array.from(new Set(demandes.filter((m: any) => m.status === 'sent').map((m: any) => String(m.to_email || '').toLowerCase()).filter(Boolean)))
  const emailLien = adresses.length ? adresses.join(', ')
    : envoisCrm.length ? 'Envoi demandé depuis le CRM ; destinataire non journalisé'
    : 'Non journalisé'

  const consentementTexte = p.signature_consentement || evtSignature?.details?.consentement || null
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
      clientLibelle: particulier ? 'Stagiaire' : 'Entreprise cliente',
      organisme: orgRaw?.legal_name || orgRaw?.name || 'Organisme de formation',
      organismeSiret: orgRaw?.siret || null,
      organismeNda: orgRaw?.numero_da || null,
      nomCourt,
      exemplaire,
    },
    signataire: {
      nom: c.signature_client_nom || 'Non renseigné',
      qualite: particulier ? 'Stagiaire, partie au contrat' : 'Représentant de l’entreprise cliente',
      entreprise: particulier ? null : clientNom,
      emailLien,
      procede: canal === 'portail'
        ? 'Espace client personnel (lien d’accès confidentiel), puis signature manuscrite tracée à l’écran.'
        : 'Lien personnel et confidentiel (jeton aléatoire de 256 bits) ouvrant une page de signature, puis signature manuscrite tracée à l’écran.',
    },
    signature: {
      horodatage,
      sourceHorodatage,
      ip: c.signature_client_ip || evtSignature?.ip_address || null,
      appareil: decrireAppareil(c.signature_client_user_agent || evtSignature?.user_agent),
      userAgent: c.signature_client_user_agent || evtSignature?.user_agent || null,
      consentement: consentementTexte ? { etat: 'coche', texte: consentementTexte }
        : parcoursActuel ? { etat: 'coche_non_conserve' }
        : { etat: 'absent' },
      image: c.signature_client_signature_data,
      imageSha256: sha256(c.signature_client_signature_data),
    },
    evenements: evenementsJournal,
    empreinteDossier: '',
  }
  // Empreinte des preuves : les seules données enregistrées, sans la date
  // d'émission, sans l'image (représentée par son empreinte) ni le résultat de
  // la relecture de l'archive, pour qu'un nouveau tirage la retrouve
  const { emisLe, ...stable } = preuve
  const docStable = { ...stable.document, exemplaire: { ...stable.document.exemplaire, verifie: undefined, introuvable: undefined } }
  preuve.empreinteDossier = sha256(JSON.stringify({ ...stable, document: docStable, signature: { ...stable.signature, image: undefined } }))

  const buffer = await renderToBuffer(createElement(CertificatSignatureConventionPDF, { preuve, org }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificat-signature-${c.numero || c.id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
