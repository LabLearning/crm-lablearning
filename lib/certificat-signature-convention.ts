/**
 * Dossier de preuve de la signature électronique d'une convention : tout ce
 * que le certificat imprime, rassemblé à partir de ce que le CRM a enregistré.
 *
 * Règle de fond : l'horodatage est celui, réel, de la signature. La date
 * portée sur la convention (signature_client_date, signature_of_date) n'est
 * jamais lue ici. Une preuve absente est dite absente, jamais reconstituée.
 */
import { sha256 } from '@/lib/preuve-signature-convention'
import { analyserSignature } from '@/lib/signature-image'
import { seuilEncre } from '@/lib/signature-encre'
import {
  decrireAppareil,
  type EvenementPreuve, type PreuveSignatureConvention,
} from '@/lib/pdf/certificat-signature-convention-pdf'

/**
 * Ce que le client lit et signe dans une convention. Une écriture qui touche
 * l'un de ces champs après la signature est une modification du document
 * signé : le certificat la porte à son journal.
 */
const CHAMPS_CONTENU: Record<string, string> = {
  objet: 'Objet',
  formation_id: 'Programme de formation',
  duree_heures: 'Durée',
  dates_formation: 'Dates de formation',
  lieu: 'Lieu',
  nombre_stagiaires: 'Nombre de stagiaires',
  participants_snapshot: 'Liste des participants',
  montant_ht: 'Montant HT',
  taux_tva: 'Taux de TVA',
  montant_ttc: 'Montant TTC',
  financeur_type: 'Type de financeur',
  financeur_nom: 'Financeur',
  client_id: 'Client',
  session_id: 'Session',
  type: 'Type de convention',
}
/** Ce que la convention reprend de sa session : un changement après la signature se dit aussi. */
const CHAMPS_SESSION: Record<string, string> = {
  date_debut: 'Date de début',
  date_fin: 'Date de fin',
  horaires_jours: 'Horaires',
  lieu: 'Lieu',
  adresse: 'Adresse',
  code_postal: 'Code postal',
  ville: 'Ville',
}
/** Champs qu'un avenant porte déjà lui-même : inutile de les redire à côté de lui. */
const CHAMPS_AVENANT = new Set(['participants_snapshot', 'nombre_stagiaires', 'montant_ht', 'montant_ttc'])

export type DossierPreuveConvention =
  | { ok: true; preuve: PreuveSignatureConvention; org: any; numero: string | null }
  | { ok: false; status: number; error: string }

/**
 * Rassemble la preuve d'une convention de l'organisme. Ne se délivre que pour
 * une convention signée électroniquement par le client, dont l'image de
 * signature porte un tracé.
 */
export async function construirePreuveSignatureConvention(
  supabase: any, orgId: string, conventionId: string,
): Promise<DossierPreuveConvention> {
  // Ni signature_client_date ni signature_of_date ne sont lues ici : ce sont
  // des dates portées, elles n'ont pas leur place dans un dossier de preuve
  const { data: c } = await supabase.from('conventions')
    .select(`id, organization_id, numero, objet, status, created_at, created_by, session_id, dates_formation,
      signature_client_nom, signature_client_signature_data, signature_client_ip, signature_client_user_agent,
      client:client_id(type, raison_sociale, siret), formation:formation_id(intitule),
      session:session_id(reference)`)
    .eq('id', conventionId).eq('organization_id', orgId).maybeSingle()
  if (!c) return { ok: false, status: 404, error: 'Convention introuvable' }
  if (!c.signature_client_signature_data || !['signee_client', 'signee_complete'].includes(c.status)) {
    return { ok: false, status: 404, error: 'Aucune signature électronique du client n’est enregistrée pour cette convention.' }
  }
  // Une image sans tracé, ou illisible, n'est pas une signature : on ne la certifie pas
  const trace = analyserSignature(c.signature_client_signature_data)
  if (!trace || trace.encre < seuilEncre(trace.largeur, trace.hauteur)) {
    return {
      ok: false, status: 409,
      error: 'La signature enregistrée ne porte pas de tracé lisible : le certificat ne peut pas être délivré. La convention doit être signée de nouveau.',
    }
  }

  const [preuves, { data: orgRaw }, { data: notifs }, { data: mails }, { data: audits }, evenementsRes, activitesRes, avenantsRes, equipeRes, journalDebutRes, activitesSessionRes] = await Promise.all([
    supabase.from('conventions')
      .select('signature_client_signed_at, signature_document_path, signature_document_sha256, signature_consentement')
      .eq('id', c.id).maybeSingle(),
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('notifications').select('created_at')
      .eq('entity_type', 'convention').eq('entity_id', c.id).eq('titre', 'Convention signée par le client')
      .order('created_at', { ascending: true }),
    supabase.from('email_logs').select('to_email, subject, status, resend_id, sent_at, created_at')
      .eq('entity_type', 'convention').eq('entity_id', c.id).order('created_at', { ascending: true }),
    supabase.from('audit_logs').select('action, user_id, created_at, details')
      .eq('entity_type', 'convention').eq('entity_id', c.id)
      .in('action', ['generate_signature_link', 'send_convention_signature', 'send_convention_inter', 'send_contrat_particulier', 'cancel_signature_request', 'sign_convention', 'cancel_signed_convention', 'retirer_avenant_correction', 'reprendre_formation_session'])
      .order('created_at', { ascending: true }),
    supabase.from('convention_signature_evenements').select('evenement, survenu_at, ip_address, user_agent, details')
      .eq('convention_id', c.id).order('survenu_at', { ascending: true }),
    // Écritures de la convention, avec l'état avant et après (journal d'activité)
    supabase.from('activites').select('champs, avant, apres, acteur_nom, created_at')
      .eq('table_name', 'conventions').eq('record_id', c.id).eq('operation', 'update')
      .order('created_at', { ascending: true }),
    supabase.from('convention_avenants')
      .select('numero, nombre_avant, nombre_apres, montant_avant, montant_apres, changements, created_by, created_at')
      .eq('convention_id', c.id).order('created_at', { ascending: true }),
    // Adresses relevées quand un compte du CRM était connecté : celles de l'équipe
    supabase.from('convention_signature_evenements').select('ip_address, details')
      .eq('organization_id', orgId).not('details->>compte_crm', 'is', null),
    // Depuis quand le journal d'activité existe : avant, une modification n'a pas laissé de trace
    supabase.from('activites').select('created_at').eq('organization_id', orgId)
      .order('created_at', { ascending: true }).limit(1),
    // Écritures de la session liée : dates, horaires et lieu que la convention reprend
    c.session_id
      ? supabase.from('activites').select('champs, avant, apres, acteur_nom, created_at')
          .eq('table_name', 'sessions').eq('record_id', c.session_id).eq('operation', 'update')
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as any[], error: null }),
  ])
  const p: any = preuves.error ? {} : preuves.data || {}
  // Tous les instants au même format, pour les comparer et les trier sans piège
  const iso = (t: string | null | undefined) => (t ? new Date(t).toISOString() : null)
  const evenements: any[] = (evenementsRes.error ? [] : evenementsRes.data || []).map((e: any) => ({ ...e, survenu_at: iso(e.survenu_at) }))
  const activites: any[] = activitesRes.error ? [] : activitesRes.data || []
  const avenants: any[] = avenantsRes.error ? [] : avenantsRes.data || []
  const activitesSession: any[] = activitesSessionRes.error ? [] : activitesSessionRes.data || []

  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Noms des utilisateurs cités par le journal
  const userIds = Array.from(new Set([
    c.created_by, ...(audits || []).map((a: any) => a.user_id), ...evenements.map((e) => e.details?.par),
    ...avenants.map((a) => a.created_by),
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
  const duDocument = particulier ? 'du contrat' : 'de la convention'
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
  // La première copie partie après la signature en cours la borne au plus près
  const premiereCopie = copiesCycle.length ? iso(copiesCycle[0].sent_at || copiesCycle[0].created_at) : null
  const horodatage: string | null = iso(p.signature_client_signed_at) || evtSignature?.survenu_at || notif || premiereCopie || null
  const sourceHorodatage: PreuveSignatureConvention['signature']['sourceHorodatage'] =
    evtSignature ? 'signature'
    : notif ? 'notification'
    : p.signature_client_signed_at ? 'enregistre'
    : premiereCopie ? 'copie' : null

  // La signature a son événement : elle est passée par le parcours qui capte
  // l'adresse IP, le consentement et l'exemplaire (en service depuis fin septembre 2026)
  const captation = !!evtSignature
  const canal = evtSignature?.details?.canal || null

  // Exemplaire figé : relu pour vérifier son empreinte
  const msFichier = (chemin: string) => Number((chemin.match(/signee-(\d+)\.pdf$/) || [])[1]) || 0
  let exemplaire: PreuveSignatureConvention['document']['exemplaire'] = {
    etat: 'non_fige',
    raison: captation ? 'echec' : 'anterieure',
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
    // Exemplaire déposé mais dont le chemin n'a pas pu être noté : le fichier de
    // la signature en cours se retrouve dans le dossier
    const dossier = `${orgId}/conventions/${c.id}`
    const { data: fichiers } = await supabase.storage.from('documents').list(dossier, { limit: 100 })
    const dernier = (fichiers || [])
      .map((f: any) => ({ nom: f.name as string, ms: msFichier(f.name) }))
      .filter((f: { nom: string; ms: number }) => f.ms && new Date(f.ms).toISOString() > derniereAnnulation)
      .sort((a: { ms: number }, b: { ms: number }) => b.ms - a.ms)[0]
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
  // Signature validée dans un navigateur où un compte du CRM était connecté :
  // noté dans l'événement depuis le 08/10/2026, déduit du journal d'audit avant
  const auditSignature = [...(audits || [])].reverse().find((a: any) => a.action === 'sign_convention' && apres(a.created_at))
  const compteSignature: string | null = evtSignature?.details?.compte_crm || (auditSignature ? nomUser(auditSignature.user_id) || 'compte interne' : null)

  // Adresse de la signature également relevée lors de visites faites depuis un
  // compte du CRM. On s'en tient au fait enregistré, sans nommer ces comptes :
  // ils peuvent être étrangers à l'acte.
  const ipSignature: string | null = c.signature_client_ip || evtSignature?.ip_address || null
  const adresseVueAvecCompteCrm = !!ipSignature && ((equipeRes.error ? [] : equipeRes.data || []) as any[])
    .some((e) => e.ip_address && String(e.ip_address) === String(ipSignature))

  // Le document complet a-t-il été ouvert depuis la page avant la signature ?
  const consultations = evenements.filter((e) => e.evenement === 'document_consulte' && apres(e.survenu_at) && (!horodatage || e.survenu_at <= horodatage))
  const parSignataire = consultations.filter((e) => !e.details?.compte_crm)
  const lecture: PreuveSignatureConvention['signature']['lecture'] =
    !captation ? { etat: 'non_enregistre' }
    : parSignataire.length ? { etat: 'ouvert', le: parSignataire[parSignataire.length - 1].survenu_at }
    : consultations.length ? { etat: 'ouvert_equipe', le: consultations[consultations.length - 1].survenu_at, compte: String(consultations[consultations.length - 1].details?.compte_crm) }
    : { etat: 'non_ouvert' }

  // ── Modifications du contenu postérieures à la signature ──
  const euros = (v: unknown) => `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')} €`
  const court = (v: unknown) => { const t = String(v ?? '').trim(); return t.length > 110 ? `${t.slice(0, 107)}…` : t }
  const modifs = horodatage
    ? activites
        .map((a) => ({ ...a, at: iso(a.created_at)!, contenu: ((a.champs || []) as string[]).filter((k) => CHAMPS_CONTENU[k]) }))
        .filter((a) => a.at > horodatage && a.contenu.length)
    : []
  const avenantsApres = horodatage ? avenants.map((a) => ({ ...a, at: iso(a.created_at)! })).filter((a) => a.at > horodatage) : []
  // Programmes cités par leur identifiant dans le journal d'activité
  const formationIds = Array.from(new Set(modifs.flatMap((a) => [a.avant?.formation_id, a.apres?.formation_id]).filter(Boolean))) as string[]
  const { data: formationsCitees } = formationIds.length
    ? await supabase.from('formations').select('id, intitule').in('id', formationIds)
    : { data: [] as any[] }
  const titreFormation = (id: unknown) => (formationsCitees || []).find((f: any) => f.id === id)?.intitule || null
  const valeur = (champ: string, v: unknown): string => {
    if (v == null || v === '') return 'vide'
    if (champ === 'formation_id') return titreFormation(v) ? `« ${titreFormation(v)} »` : 'autre programme'
    if (champ === 'duree_heures') return `${Number(v).toLocaleString('fr-FR').replace(/\s/g, ' ')} h`
    if (champ === 'montant_ht' || champ === 'montant_ttc') return euros(v)
    if (champ === 'taux_tva') return `${v} %`
    if (champ === 'participants_snapshot') return Array.isArray(v) ? `${v.length} participant${v.length > 1 ? 's' : ''}` : 'liste modifiée'
    if (champ === 'client_id' || champ === 'session_id') return 'autre fiche'
    return `« ${court(v)} »`
  }
  const proche = (a: string, b: string, ms: number) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < ms
  // Reprises de programme : l'intitulé d'avant et d'après y est noté en clair,
  // à l'instant du geste (la fiche du catalogue, elle, peut être renommée)
  const reprises = horodatage
    ? (audits || []).filter((a: any) => a.action === 'reprendre_formation_session' && iso(a.created_at)! > horodatage)
        .map((a: any) => ({ at: iso(a.created_at)!, avant: a.details?.avant as string | undefined, apres: a.details?.apres as string | undefined }))
    : []

  // Document tel que signé : l'instantané noté à la signature, sinon la valeur
  // d'avant la première modification postérieure, sinon la valeur d'aujourd'hui
  const instantane: any = evtSignature?.details?.document || null
  const avantPremiereModif = (champ: string): { connu: boolean; valeur: unknown } => {
    const m = modifs.find((a) => a.contenu.includes(champ))
    return m ? { connu: true, valeur: m.avant?.[champ] } : { connu: false, valeur: null }
  }
  const objetAvant = avantPremiereModif('objet')
  const formationAvant = avantPremiereModif('formation_id')
  const objetActuel: string | null = c.objet || null
  const formationActuelle: string | null = (c as any).formation?.intitule || null
  const objetSigne: string | null = instantane ? (instantane.objet ?? null) : objetAvant.connu ? ((objetAvant.valeur as string) || null) : objetActuel
  const formationSignee: string | null = instantane ? (instantane.formation ?? null)
    : reprises[0]?.avant ? reprises[0].avant
    : formationAvant.connu ? (titreFormation(formationAvant.valeur) || null) : formationActuelle
  const datesSignees: string | null = instantane ? (instantane.dates_formation ?? null)
    : avantPremiereModif('dates_formation').connu ? ((avantPremiereModif('dates_formation').valeur as string) || null) : (c.dates_formation || null)

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
      detail: [
        `à ${m.to_email}`,
        // Les mails « signature requise » partent avec le PDF en pièce jointe : seule présentation
        // enregistrée du document complet pour les signatures d'avant la captation
        m.status === 'sent' && /signature requise/i.test(m.subject || '') ? `${particulier ? 'contrat joint' : 'convention jointe'} en PDF` : null,
        m.status === 'sent' ? 'accepté par le service d’envoi' : `statut ${m.status}`,
        m.resend_id ? `identifiant d’envoi ${m.resend_id}` : null,
      ].filter(Boolean).join(' · '),
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
  // Signatures antérieures à celle que retient le certificat, connues par leur
  // seule notification : annulées, ou remplacées sans annulation journalisée
  for (const n of notifs || []) {
    const t = iso(n.created_at)!
    if (evenements.some((e) => e.evenement === 'signature' && proche(e.survenu_at, t, 60_000))) continue
    if (t <= derniereAnnulation) journal.push({ at: t, libelle: 'Signature antérieure, annulée ensuite' })
    else if (horodatage && new Date(t).getTime() < new Date(horodatage).getTime() - 60_000) {
      journal.push({ at: t, libelle: 'Signature antérieure enregistrée, remplacée depuis', detail: 'annulation non journalisée' })
    }
  }
  // La signature en cours, à l'instant retenu dans le certificat
  if (horodatage) {
    journal.push({
      at: horodatage,
      libelle: `Signature par ${c.signature_client_nom || 'un signataire au nom non renseigné'}${sourceHorodatage === 'copie' ? ' (au plus tard)' : ''}`,
      detail: [
        canal === 'portail' ? 'depuis l’espace client' : null,
        compteSignature ? `navigateur connecté au CRM (${compteSignature})` : null,
        ipUa(ipSignature, c.signature_client_user_agent || evtSignature?.user_agent),
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
  // Ce qui a changé dans le document après sa signature
  let nbModifications = 0
  for (const a of avenantsApres) {
    const lignes: string[] = []
    for (const ch of (Array.isArray(a.changements) ? a.changements : []) as any[]) {
      if (ch?.libelle) lignes.push(`${ch.libelle} : ${court(ch.avant ?? 'vide')} → ${court(ch.apres ?? 'vide')}`)
    }
    if (a.montant_avant != null && a.montant_apres != null && Number(a.montant_avant) !== Number(a.montant_apres)) {
      lignes.push(`montant : ${euros(a.montant_avant)} → ${euros(a.montant_apres)}`)
    }
    if (a.nombre_avant != null && a.nombre_apres != null && a.nombre_avant !== a.nombre_apres) {
      lignes.push(`participants : ${a.nombre_avant} → ${a.nombre_apres}`)
    } else if (!lignes.length && a.nombre_avant != null) {
      // Un participant remplacé par un autre : l'effectif ne bouge pas
      lignes.push(`liste des participants modifiée (${a.nombre_apres ?? a.nombre_avant} participant${Number(a.nombre_apres ?? a.nombre_avant) > 1 ? 's' : ''})`)
    }
    nbModifications++
    journal.push({
      at: a.at, alerte: true,
      libelle: `Après la signature : avenant n° ${a.numero} établi`,
      detail: [lignes.join(' ; ') || null, nomUser(a.created_by) ? `par ${nomUser(a.created_by)}` : null].filter(Boolean).join(' · ') || null,
    })
  }
  for (const a of modifs) {
    // Ce qu'un avenant du même instant porte déjà n'est pas redit
    const avecAvenant = avenantsApres.some((v) => proche(v.at, a.at, 20_000))
    const champs = a.contenu.filter((k: string) => !(avecAvenant && CHAMPS_AVENANT.has(k)))
    // Montant TTC identique au HT (pas de TVA) : une seule ligne
    const memeMontant = champs.includes('montant_ht') && champs.includes('montant_ttc')
      && Number(a.avant?.montant_ht) === Number(a.avant?.montant_ttc) && Number(a.apres?.montant_ht) === Number(a.apres?.montant_ttc)
    const reprise = reprises.find((r: { at: string }) => proche(r.at, a.at, 10_000))
    const lignes = champs
      .filter((k: string) => !(memeMontant && k === 'montant_ttc'))
      .map((k: string) => k === 'formation_id' && reprise?.avant && reprise?.apres
        ? `${CHAMPS_CONTENU[k]} : « ${reprise.avant} » → « ${reprise.apres} »`
        : `${memeMontant && k === 'montant_ht' ? 'Montant' : CHAMPS_CONTENU[k]} : ${valeur(k, a.avant?.[k])} → ${valeur(k, a.apres?.[k])}`)
    if (!lignes.length) continue
    nbModifications++
    journal.push({
      at: a.at, alerte: true,
      libelle: `Après la signature : ${nomCourt} a été modifié${particulier ? '' : 'e'} dans le CRM, sans nouvelle signature`,
      detail: [lignes.join(' ; '), a.acteur_nom ? `par ${a.acteur_nom}` : null].filter(Boolean).join(' · '),
    })
  }
  const jourFr = (v: unknown) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR') : 'vide')
  for (const a of horodatage ? activitesSession : []) {
    const at = iso(a.created_at)!
    const champs = ((a.champs || []) as string[]).filter((k) => CHAMPS_SESSION[k])
    if (at <= horodatage! || !champs.length) continue
    const lignes = champs.map((k) => k === 'horaires_jours' ? 'Horaires modifiés'
      : k === 'date_debut' || k === 'date_fin' ? `${CHAMPS_SESSION[k]} : ${jourFr(a.avant?.[k])} → ${jourFr(a.apres?.[k])}`
      : `${CHAMPS_SESSION[k]} : ${valeur(k, a.avant?.[k])} → ${valeur(k, a.apres?.[k])}`)
    nbModifications++
    journal.push({
      at, alerte: true,
      libelle: 'Après la signature : la session a été modifiée dans le CRM',
      detail: [lignes.join(' ; '), a.acteur_nom ? `par ${a.acteur_nom}` : null].filter(Boolean).join(' · '),
    })
  }
  for (const a of (audits || []).filter((x: any) => x.action === 'retirer_avenant_correction' && horodatage && iso(x.created_at)! > horodatage)) {
    nbModifications++
    journal.push({
      at: iso(a.created_at)!, alerte: true,
      libelle: 'Après la signature : avenant de correction retiré',
      detail: nomUser(a.user_id) ? `par ${nomUser(a.user_id)}` : null,
    })
  }
  journal.sort((a, b) => a.at.localeCompare(b.at))
  // Un même geste journalisé deux fois dans la minute n'apparaît qu'une fois
  const evenementsJournal = journal.filter((e, i) => !journal.slice(0, i).some((x) =>
    x.libelle === e.libelle && x.detail === e.detail && Math.abs(new Date(x.at).getTime() - new Date(e.at).getTime()) < 60_000))

  const session: any = (c as any).session
  const clientNom = (c as any).client?.raison_sociale || null

  // Destinataire du lien : seulement les envois réellement partis
  const adresses = Array.from(new Set(demandes.filter((m: any) => m.status === 'sent').map((m: any) => String(m.to_email || '').toLowerCase()).filter(Boolean)))
  const emailLien = adresses.length ? adresses.join(', ')
    : envoisCrm.length ? 'Envoi demandé depuis le CRM ; destinataire non journalisé'
    : 'Lien préparé dans le CRM ; aucun envoi par e-mail enregistré'

  const consentementTexte = p.signature_consentement || evtSignature?.details?.consentement || null
  const debutJournal = iso(journalDebutRes.error ? null : (journalDebutRes.data || [])[0]?.created_at)
  const preuve: PreuveSignatureConvention = {
    emisLe: new Date().toISOString(),
    document: {
      intitule: particulier ? 'Contrat de formation professionnelle' : 'Convention de formation professionnelle',
      numero: c.numero || c.id,
      identifiant: c.id,
      objet: objetSigne,
      objetActuel: objetActuel && objetActuel !== objetSigne ? objetActuel : null,
      formation: formationSignee,
      formationActuelle: formationActuelle && formationActuelle !== formationSignee ? formationActuelle : null,
      session: session?.reference || null,
      datesFormation: datesSignees,
      client: clientNom,
      clientSiret: (c as any).client?.siret || null,
      clientLibelle: particulier ? 'Stagiaire' : 'Entreprise cliente',
      organisme: orgRaw?.legal_name || orgRaw?.name || 'Organisme de formation',
      organismeSiret: orgRaw?.siret || null,
      organismeNda: orgRaw?.numero_da || null,
      nomCourt,
      duDocument,
      modifications: nbModifications,
      // Une signature plus ancienne que le journal d'activité a pu être suivie de modifications non tracées
      journalModificationsDepuis: debutJournal && horodatage && horodatage < debutJournal ? debutJournal : null,
      exemplaire,
    },
    signataire: {
      nom: c.signature_client_nom || 'Non renseigné',
      qualite: particulier ? 'Stagiaire, partie au contrat' : 'Représentant de l’entreprise cliente',
      entreprise: particulier ? null : clientNom,
      emailLien,
      procede: canal === 'portail'
        ? 'Espace client (lien d’accès propre au client), sans vérification d’identité, puis signature tracée à l’écran.'
        : 'Lien unique propre à ce document (jeton aléatoire de 256 bits), sans vérification d’identité, puis signature tracée à l’écran.',
    },
    signature: {
      horodatage,
      sourceHorodatage,
      captation,
      ip: ipSignature,
      adresseVueAvecCompteCrm,
      appareil: decrireAppareil(c.signature_client_user_agent || evtSignature?.user_agent),
      userAgent: c.signature_client_user_agent || evtSignature?.user_agent || null,
      compteCrm: compteSignature,
      consentement: consentementTexte ? { etat: 'coche', texte: consentementTexte }
        : canal === 'portail' ? { etat: 'non_enregistre' }
        : captation ? { etat: 'texte_non_enregistre' }
        : { etat: 'sans_case' },
      lecture,
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

  return { ok: true, preuve, org, numero: c.numero || null }
}
