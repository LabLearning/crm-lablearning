import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/types'
import { MODULES_RECHERCHE, clientDansPortefeuille, outilAutorise, peutLire } from '@/lib/assistant/propositions'

/**
 * Outils de l'assistant CRM interne : lecture seule, TOUJOURS scopé sur
 * l'organisation de l'utilisateur connecté. Chaque outil renvoie des données
 * compactes + des liens (/dashboard/... et /api/pdf/...) que le chat rend
 * cliquables — l'utilisateur est déjà authentifié dans le même navigateur.
 */

export const OUTILS_ASSISTANT = [
  {
    name: 'rechercher',
    description: "Recherche globale dans le CRM par nom, email ou numéro : clients, apprenants, formateurs, sessions, factures, conventions. À utiliser en premier quand on te parle d'une personne, d'une entreprise ou d'un document sans te donner son identifiant.",
    input_schema: {
      type: 'object',
      properties: {
        requete: { type: 'string', description: 'Texte cherché (nom, email, numéro de facture/convention…)' },
        type: { type: 'string', enum: ['tous', 'clients', 'apprenants', 'formateurs', 'sessions', 'factures', 'conventions'], description: 'Limiter à un type (défaut : tous)' },
      },
      required: ['requete'],
    },
  },
  {
    name: 'detail_session',
    description: "Tout d'une session : formation, dates, client, formateur, stagiaires inscrits, état de la contractualisation et de la facturation, et les liens vers chaque document (convocation, émargement, convention, certificats, facture…).",
    input_schema: {
      type: 'object',
      properties: { session_id: { type: 'string', description: 'UUID de la session' } },
      required: ['session_id'],
    },
  },
  {
    name: 'detail_client',
    description: 'Fiche complète d’un client : coordonnées, contacts, sessions, conventions et factures liées.',
    input_schema: {
      type: 'object',
      properties: { client_id: { type: 'string', description: 'UUID du client' } },
      required: ['client_id'],
    },
  },
  {
    name: 'detail_apprenant',
    description: 'Fiche d’un apprenant : coordonnées, entreprise, sessions suivies, liens vers ses attestations et certificats.',
    input_schema: {
      type: 'object',
      properties: { apprenant_id: { type: 'string', description: 'UUID de l’apprenant' } },
      required: ['apprenant_id'],
    },
  },
  {
    name: 'lister_sessions',
    description: 'Sessions sur une période (défaut : les 30 prochains jours), filtrables par statut. Pour « les sessions de la semaine », « qu’est-ce qui est prévu en octobre », etc.',
    input_schema: {
      type: 'object',
      properties: {
        debut: { type: 'string', description: 'Date AAAA-MM-JJ (défaut : aujourd’hui - 7 jours)' },
        fin: { type: 'string', description: 'Date AAAA-MM-JJ (défaut : aujourd’hui + 30 jours)' },
        statut: { type: 'string', enum: ['planifiee', 'confirmee', 'en_cours', 'terminee', 'annulee'], description: 'Filtrer par statut' },
      },
    },
  },
  {
    name: 'indicateurs',
    description: 'Chiffres clés du moment : sessions en cours et à venir, factures en attente de paiement (avec montant), réclamations ouvertes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'analyse_financiere',
    description: "Analyse financière : encaissements sur une période, encours et retards par client (top débiteurs), factures récentes. Pour « combien on a encaissé ce mois », « qui nous doit de l'argent », « où en est la facturation de X ».",
    input_schema: {
      type: 'object',
      properties: {
        debut: { type: 'string', description: 'Date AAAA-MM-JJ (défaut : 1er jour du mois en cours)' },
        fin: { type: 'string', description: 'Date AAAA-MM-JJ (défaut : aujourd’hui)' },
      },
    },
  },
  {
    name: 'emargements_session',
    description: "État des émargements (signatures de présence) d'une session : par stagiaire, créneaux signés / manquants / absences. Pour « qui n'a pas signé », « la feuille est-elle complète ».",
    input_schema: {
      type: 'object',
      properties: { session_id: { type: 'string', description: 'UUID de la session' } },
      required: ['session_id'],
    },
  },
  {
    name: 'etat_agefice',
    description: "Pipeline AGEFICE complet : dossiers par statut, règlements et signatures d'attestation manquants, échéances de remboursement (4 mois après la fin de formation). Pour « où en sont les dossiers AGEFICE ».",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'signatures_en_attente',
    description: "Tout ce qui attend une signature : conventions envoyées non signées, attestations AGEFICE non signées par le dirigeant, sessions terminées avec émargements non signés. Pour « qu'est-ce qui bloque », « quelles signatures manquent ».",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'detail_formation',
    description: 'Fiche d’une formation du catalogue (tarifs, durée, taux) et ses prochaines sessions. Cherche par nom.',
    input_schema: {
      type: 'object',
      properties: { nom: { type: 'string', description: 'Nom (ou morceau du nom) de la formation' } },
      required: ['nom'],
    },
  },
] as const

const nomClient = (c: any) => c?.nom_commercial || c?.raison_sociale || 'Client'

/** Exécute un outil pour une organisation donnée. Renvoie toujours du JSON sérialisable. */
export async function executerOutil(
  nom: string, args: any, orgId: string,
  utilisateur?: { id: string; role: string; permissions?: Permission[] },
): Promise<any> {
  const supabase = await createServiceRoleClient()
  const org = (q: any) => q.eq('organization_id', orgId)
  // Un commercial ne voit que les clients qu'il suit, comme dans l'interface
  // (liste filtrée sur assigned_to, fiche réservée à son portefeuille).
  const commercial = utilisateur?.role === 'commercial' ? utilisateur : null
  // Mêmes droits de lecture par module que les pages du dashboard
  const droits = utilisateur?.permissions ? { role: utilisateur.role, permissions: utilisateur.permissions } : null
  if (droits && !outilAutorise(nom, droits.role, droits.permissions)) {
    return { erreur: 'Ces données ne relèvent pas des droits de lecture de l’utilisateur.' }
  }

  try {
    if (nom === 'rechercher') {
      const q = String(args.requete || '').trim()
      if (q.length < 2) return { erreur: 'Requête trop courte' }
      const motif = `%${q}%`
      const type = args.type || 'tous'
      const veut = (t: string) => (type === 'tous' || type === t)
        && (!droits || !MODULES_RECHERCHE[t] || peutLire(MODULES_RECHERCHE[t], droits.role, droits.permissions))
      const [clients, apprenants, formateurs, factures, conventions, formations] = await Promise.all([
        veut('clients') ? (commercial
          ? org(supabase.from('clients').select('id, raison_sociale, nom_commercial, ville, type')).eq('assigned_to', commercial.id)
          : org(supabase.from('clients').select('id, raison_sociale, nom_commercial, ville, type'))
        ).or(`raison_sociale.ilike.${motif},nom_commercial.ilike.${motif}`).limit(6) : { data: [] },
        veut('apprenants') ? org(supabase.from('apprenants').select('id, prenom, nom, email, client:client_id(raison_sociale, nom_commercial)')).or(`nom.ilike.${motif},prenom.ilike.${motif},email.ilike.${motif}`).limit(6) : { data: [] },
        veut('formateurs') ? org(supabase.from('formateurs').select('id, prenom, nom, email')).or(`nom.ilike.${motif},prenom.ilike.${motif}`).limit(4) : { data: [] },
        veut('factures') ? org(supabase.from('factures').select('id, numero, status, montant_ttc, client:client_id(raison_sociale, nom_commercial)')).ilike('numero', motif).limit(5) : { data: [] },
        veut('conventions') ? org(supabase.from('conventions').select('id, numero, status, session_id, client:client_id(raison_sociale, nom_commercial)')).ilike('numero', motif).limit(5) : { data: [] },
        veut('sessions') ? org(supabase.from('formations').select('id, intitule')).ilike('intitule', motif).limit(4) : { data: [] },
      ])
      // Sessions dont la formation ou le client correspond
      let sessions: any[] = []
      if (veut('sessions')) {
        const idsFormations = ((formations as any).data || []).map((f: any) => f.id)
        const idsClients = ((clients as any).data || []).map((c: any) => c.id)
        if (idsFormations.length || idsClients.length) {
          const filtres = [
            idsFormations.length ? `formation_id.in.(${idsFormations.join(',')})` : null,
            idsClients.length ? `client_id.in.(${idsClients.join(',')})` : null,
          ].filter(Boolean).join(',')
          const { data } = await org(supabase.from('sessions')
            .select('id, date_debut, date_fin, status, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)'))
            .or(filtres).order('date_debut', { ascending: false }).limit(8)
          sessions = data || []
        }
      }
      return {
        clients: ((clients as any).data || []).map((c: any) => ({ id: c.id, nom: nomClient(c), ville: c.ville, type: c.type, lien: `/dashboard/clients/${c.id}` })),
        apprenants: ((apprenants as any).data || []).map((a: any) => ({ id: a.id, nom: `${a.prenom || ''} ${a.nom || ''}`.trim(), email: a.email, entreprise: nomClient(a.client), lien: `/dashboard/apprenants/${a.id}` })),
        formateurs: ((formateurs as any).data || []).map((f: any) => ({ id: f.id, nom: `${f.prenom || ''} ${f.nom || ''}`.trim(), email: f.email, lien: `/dashboard/formateurs/${f.id}` })),
        sessions: sessions.map((s: any) => ({ id: s.id, formation: s.formation?.intitule, client: nomClient(s.client), du: s.date_debut, au: s.date_fin, statut: s.status, lien: `/dashboard/sessions/${s.id}` })),
        factures: ((factures as any).data || []).map((f: any) => ({ id: f.id, numero: f.numero, statut: f.status, montant_ttc: f.montant_ttc, client: nomClient(f.client), pdf: `/api/pdf/facture/${f.id}` })),
        conventions: ((conventions as any).data || []).map((c: any) => ({ id: c.id, numero: c.numero, statut: c.status, client: nomClient(c.client), pdf: `/api/pdf/convention/${c.id}`, session: c.session_id ? `/dashboard/sessions/${c.session_id}?tab=conventions` : null })),
      }
    }

    if (nom === 'detail_session') {
      const sid = String(args.session_id)
      const { data: s } = await org(supabase.from('sessions')
        .select('id, date_debut, date_fin, status, type_session, ville, lieu, formation:formation_id(id, intitule, categorie), client:client_id(id, raison_sociale, nom_commercial), formateur:formateurs(id, prenom, nom, email)'))
        .eq('id', sid).maybeSingle()
      if (!s) return { erreur: 'Session introuvable dans cette organisation' }
      const [{ data: insc }, { data: convs }, { data: factures }] = await Promise.all([
        supabase.from('inscriptions').select('status, apprenant:apprenants(id, prenom, nom, email)').eq('session_id', sid),
        org(supabase.from('conventions').select('id, numero, status, sent_at, signature_client_date, client:client_id(raison_sociale, nom_commercial)')).eq('session_id', sid),
        org(supabase.from('factures').select('id, numero, status, montant_ttc')).eq('session_id', sid),
      ])
      const fid = (s as any).formation?.id
      return {
        session: {
          id: s.id, formation: (s as any).formation?.intitule, du: s.date_debut, au: s.date_fin,
          statut: s.status, type: (s as any).type_session, lieu: (s as any).lieu || (s as any).ville,
          client: (s as any).client ? { nom: nomClient((s as any).client), lien: `/dashboard/clients/${(s as any).client.id}` } : null,
          formateur: (s as any).formateur ? `${(s as any).formateur.prenom} ${(s as any).formateur.nom}` : null,
          lien: `/dashboard/sessions/${s.id}`,
        },
        stagiaires: (insc || []).map((i: any) => ({ nom: `${i.apprenant?.prenom || ''} ${i.apprenant?.nom || ''}`.trim(), statut: i.status, lien: i.apprenant ? `/dashboard/apprenants/${i.apprenant.id}` : null })),
        conventions: (convs || []).map((c: any) => ({ numero: c.numero, statut: c.status, signee_le: c.signature_client_date, partie: nomClient(c.client), pdf: `/api/pdf/convention/${c.id}` })),
        factures: (factures || []).map((f: any) => ({ numero: f.numero, statut: f.status, montant_ttc: f.montant_ttc, pdf: `/api/pdf/facture/${f.id}` })),
        documents: {
          convocation: `/api/pdf/convocation-session/${sid}`,
          feuille_emargement: `/api/pdf/emargement/${sid}`,
          programme: fid ? `/api/pdf/programme/${fid}?session=${sid}` : null,
          certificats_groupes: `/api/pdf/certificats-session?session=${sid}`,
        },
      }
    }

    if (nom === 'detail_client') {
      const cid = String(args.client_id)
      const { data: c } = await org(supabase.from('clients').select('id, raison_sociale, nom_commercial, type, email, telephone, ville, adresse, siret')).eq('id', cid).maybeSingle()
      if (!c) return { erreur: 'Client introuvable dans cette organisation' }
      if (commercial) {
        if (!(await clientDansPortefeuille(cid, orgId, commercial.id))) {
          return { erreur: 'Ce client n’est pas dans le portefeuille de l’utilisateur : sa fiche est réservée au commercial qui le suit ou à un responsable.' }
        }
      }
      const [{ data: contacts }, { data: sessions }, { data: factures }, { data: convs }] = await Promise.all([
        org(supabase.from('contacts').select('prenom, nom, email, telephone, fonction')).eq('client_id', cid).limit(6),
        org(supabase.from('sessions').select('id, date_debut, date_fin, status, formation:formation_id(intitule)')).eq('client_id', cid).order('date_debut', { ascending: false }).limit(8),
        org(supabase.from('factures').select('id, numero, status, montant_ttc, date_emission')).eq('client_id', cid).order('created_at', { ascending: false }).limit(8),
        org(supabase.from('conventions').select('id, numero, status, signature_client_date, session_id')).eq('client_id', cid).order('created_at', { ascending: false }).limit(8),
      ])
      return {
        client: { ...c, nom: nomClient(c), lien: `/dashboard/clients/${cid}` },
        contacts: contacts || [],
        sessions: (sessions || []).map((s: any) => ({ formation: s.formation?.intitule, du: s.date_debut, statut: s.status, lien: `/dashboard/sessions/${s.id}` })),
        factures: (factures || []).map((f: any) => ({ numero: f.numero, statut: f.status, montant_ttc: f.montant_ttc, pdf: `/api/pdf/facture/${f.id}` })),
        conventions: (convs || []).map((cv: any) => ({ numero: cv.numero, statut: cv.status, signee_le: cv.signature_client_date, pdf: `/api/pdf/convention/${cv.id}` })),
      }
    }

    if (nom === 'detail_apprenant') {
      const aid = String(args.apprenant_id)
      const { data: a } = await org(supabase.from('apprenants').select('id, prenom, nom, email, telephone, client:client_id(id, raison_sociale, nom_commercial)')).eq('id', aid).maybeSingle()
      if (!a) return { erreur: 'Apprenant introuvable dans cette organisation' }
      const { data: insc } = await supabase.from('inscriptions')
        .select('status, session:sessions(id, date_debut, date_fin, status, organization_id, formation:formation_id(intitule))')
        .eq('apprenant_id', aid)
      const sessions = (insc || []).filter((i: any) => i.session?.organization_id === orgId)
      return {
        apprenant: { id: a.id, nom: `${a.prenom || ''} ${a.nom || ''}`.trim(), email: a.email, telephone: (a as any).telephone, entreprise: nomClient((a as any).client), lien: `/dashboard/apprenants/${aid}` },
        sessions: sessions.map((i: any) => ({
          formation: i.session?.formation?.intitule, du: i.session?.date_debut, statut_session: i.session?.status, statut_inscription: i.status,
          lien: `/dashboard/sessions/${i.session?.id}`,
          attestation: `/api/pdf/attestation/${aid}?session=${i.session?.id}`,
          certificat: `/api/pdf/certificat-realisation/${aid}?session=${i.session?.id}`,
        })),
      }
    }

    if (nom === 'lister_sessions') {
      const debut = args.debut || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      const fin = args.fin || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      let q = org(supabase.from('sessions')
        .select('id, date_debut, date_fin, status, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial), formateur:formateurs(prenom, nom)'))
        .gte('date_debut', debut).lte('date_debut', fin).order('date_debut')
      if (args.statut) q = q.eq('status', args.statut)
      const { data } = await q.limit(40)
      return {
        periode: { debut, fin },
        sessions: (data || []).map((s: any) => ({
          formation: s.formation?.intitule, client: nomClient(s.client), du: s.date_debut, au: s.date_fin,
          statut: s.status, formateur: s.formateur ? `${s.formateur.prenom} ${s.formateur.nom}` : null,
          lien: `/dashboard/sessions/${s.id}`,
        })),
      }
    }

    if (nom === 'indicateurs') {
      const auj = new Date().toISOString().slice(0, 10)
      const [enCours, aVenir, factAttente, reclOuvertes] = await Promise.all([
        org(supabase.from('sessions').select('id', { count: 'exact', head: true })).lte('date_debut', auj).gte('date_fin', auj).not('status', 'in', '("annulee")'),
        org(supabase.from('sessions').select('id', { count: 'exact', head: true })).gt('date_debut', auj).not('status', 'in', '("annulee")'),
        // Le vrai encours : ce qui reste à encaisser (montant_restant) sur les
        // factures émises/envoyées/en retard — jamais montant_ttc, trompeur.
        org(supabase.from('factures').select('status, montant_ttc, montant_restant')).in('status', ['emise', 'envoyee', 'en_retard']),
        org(supabase.from('reclamations').select('id', { count: 'exact', head: true })).not('status', 'in', '("cloturee","resolue")'),
      ])
      const enAttente = ((factAttente as any).data || []) as any[]
      const retard = enAttente.filter((f) => f.status === 'en_retard')
      const restant = (fs: any[]) => fs.reduce((s, f) => s + Number(f.montant_restant ?? f.montant_ttc ?? 0), 0)
      return {
        sessions_en_cours: enCours.count || 0,
        sessions_a_venir: aVenir.count || 0,
        factures_en_attente: { nombre: enAttente.length, montant_restant: restant(enAttente) },
        dont_en_retard: { nombre: retard.length, montant_restant: restant(retard) },
        reclamations_ouvertes: reclOuvertes.count || 0,
        liens: { sessions: '/dashboard/sessions', factures: '/dashboard/factures' },
      }
    }

    if (nom === 'analyse_financiere') {
      const maintenant = new Date()
      const debut = args.debut || `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-01`
      const fin = args.fin || maintenant.toISOString().slice(0, 10)
      const [{ data: paiements }, { data: impayees }] = await Promise.all([
        org(supabase.from('paiements').select('montant, date_paiement, mode')).gte('date_paiement', debut).lte('date_paiement', fin),
        org(supabase.from('factures').select('id, numero, status, montant_restant, montant_ttc, date_echeance, relance_count, financeur_nom, client:client_id(id, raison_sociale, nom_commercial)'))
          .in('status', ['emise', 'envoyee', 'en_retard', 'payee_partiellement']).gt('montant_restant', 0),
      ])
      // Regroupe les impayés par débiteur : le client, sinon le FINANCEUR
      // (les factures subrogées AKTO/OPCO n'ont pas de client_id).
      const parClient = new Map<string, { debiteur: string; client_id: string | null; nb: number; du: number; factures: any[] }>()
      for (const f of (impayees || []) as any[]) {
        const cle = f.client?.id || `financeur:${f.financeur_nom || 'inconnu'}`
        if (!parClient.has(cle)) parClient.set(cle, { debiteur: f.client ? nomClient(f.client) : (f.financeur_nom || 'Sans destinataire'), client_id: f.client?.id || null, nb: 0, du: 0, factures: [] })
        const e = parClient.get(cle)!
        e.nb++; e.du += Number(f.montant_restant || 0)
        if (e.factures.length < 5) e.factures.push({ numero: f.numero, statut: f.status, du: f.montant_restant, echeance: f.date_echeance, relances: f.relance_count || 0, pdf: `/api/pdf/facture/${f.id}` })
      }
      const debiteurs = [...parClient.values()].sort((a, b) => b.du - a.du).slice(0, 10)
        .map((d) => ({ ...d, lien: d.client_id ? `/dashboard/clients/${d.client_id}` : null }))
      const encaisse = ((paiements || []) as any[]).reduce((s, p) => s + Number(p.montant || 0), 0)
      return {
        periode: { debut, fin },
        encaisse: { total: encaisse, nb_paiements: (paiements || []).length },
        encours_total: (impayees || []).reduce((s: number, f: any) => s + Number(f.montant_restant || 0), 0),
        top_debiteurs: debiteurs,
        lien_factures: '/dashboard/factures',
      }
    }

    if (nom === 'emargements_session') {
      const sid = String(args.session_id)
      const { data: s } = await org(supabase.from('sessions').select('id, formation:formation_id(intitule)')).eq('id', sid).maybeSingle()
      if (!s) return { erreur: 'Session introuvable dans cette organisation' }
      const [{ data: emargs }, { data: insc }] = await Promise.all([
        supabase.from('emargements').select('apprenant_id, date, creneau, est_present, signed_at, motif_absence').eq('session_id', sid),
        supabase.from('inscriptions').select('apprenant:apprenants(id, prenom, nom)').eq('session_id', sid).not('status', 'in', '("annule","abandonne")'),
      ])
      const parApprenant = new Map<string, { nom: string; signes: number; presents_non_signes: number; absences: number }>()
      for (const i of (insc || []) as any[]) {
        if (i.apprenant) parApprenant.set(i.apprenant.id, { nom: `${i.apprenant.prenom || ''} ${i.apprenant.nom || ''}`.trim(), signes: 0, presents_non_signes: 0, absences: 0 })
      }
      for (const e of (emargs || []) as any[]) {
        const a = parApprenant.get(e.apprenant_id)
        if (!a) continue
        if (e.est_present === false) a.absences++
        else if (e.signed_at) a.signes++
        else a.presents_non_signes++
      }
      return {
        formation: (s as any).formation?.intitule,
        stagiaires: [...parApprenant.values()],
        feuille_pdf: `/api/pdf/emargement/${sid}`,
        lien_session: `/dashboard/sessions/${sid}?tab=presences`,
      }
    }

    if (nom === 'etat_agefice') {
      const { data: dossiers } = await org(supabase.from('dossiers_agefice')
        .select('id, numero_dossier, statut, montant_accorde, date_fin_formation, mode_reglement, signature_stagiaire_date, session_id, client:client_id(raison_sociale, nom_commercial), apprenant:apprenant_id(prenom, nom)'))
        .order('created_at', { ascending: false }).limit(50)
      const auj = Date.now()
      const lignes = ((dossiers || []) as any[]).map((d) => {
        // Délai AGEFICE : demande de remboursement au plus tard 4 mois après la fin
        const fin = d.date_fin_formation ? new Date(d.date_fin_formation).getTime() : null
        const limite = fin ? new Date(fin + 122 * 86400000).toISOString().slice(0, 10) : null
        const joursRestants = fin ? Math.round((fin + 122 * 86400000 - auj) / 86400000) : null
        return {
          dirigeant: `${d.apprenant?.prenom || ''} ${d.apprenant?.nom || ''}`.trim() || nomClient(d.client),
          numero_accord: d.numero_dossier, statut: d.statut, montant: d.montant_accorde,
          regle: !!d.mode_reglement, attestation_signee: !!d.signature_stagiaire_date,
          limite_remboursement: limite, jours_restants: joursRestants,
          lien: d.session_id ? `/dashboard/sessions/${d.session_id}?tab=facturation` : '/dashboard/agefice',
        }
      })
      return {
        dossiers: lignes,
        alertes: lignes.filter((l) => (l.jours_restants != null && l.jours_restants < 45 && l.statut !== 'solde') || !l.regle || !l.attestation_signee),
      }
    }

    if (nom === 'signatures_en_attente') {
      const [{ data: convs }, { data: dossiers }, { data: sessions }] = await Promise.all([
        org(supabase.from('conventions').select('id, numero, sent_at, session_id, client:client_id(raison_sociale, nom_commercial)'))
          .not('sent_at', 'is', null).is('signature_client_date', null).order('sent_at', { ascending: false }).limit(15),
        org(supabase.from('dossiers_agefice').select('id, numero_dossier, session_id, mode_reglement, signature_stagiaire_date, apprenant:apprenant_id(prenom, nom)'))
          .is('signature_stagiaire_date', null),
        org(supabase.from('sessions').select('id, date_fin, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)'))
          .eq('status', 'terminee').order('date_fin', { ascending: false }).limit(12),
      ])
      // Émargements non signés sur les sessions terminées récentes
      const manquesEmargement: any[] = []
      for (const s of (sessions || []) as any[]) {
        const { count: total } = await supabase.from('emargements').select('id', { count: 'exact', head: true }).eq('session_id', s.id)
        if (!total) continue
        const { count: signes } = await supabase.from('emargements').select('id', { count: 'exact', head: true }).eq('session_id', s.id).not('signature_data', 'is', null)
        if ((signes || 0) < total) {
          manquesEmargement.push({ formation: s.formation?.intitule, client: nomClient(s.client), fin: s.date_fin, signes: signes || 0, total, lien: `/dashboard/sessions/${s.id}?tab=presences` })
        }
      }
      return {
        conventions_non_signees: ((convs || []) as any[]).map((c) => ({ numero: c.numero, client: nomClient(c.client), envoyee_le: c.sent_at, lien: c.session_id ? `/dashboard/sessions/${c.session_id}?tab=conventions` : '/dashboard/conventions' })),
        attestations_agefice_non_signees: ((dossiers || []) as any[]).map((d) => ({ dirigeant: `${d.apprenant?.prenom || ''} ${d.apprenant?.nom || ''}`.trim(), numero_accord: d.numero_dossier, reglement_enregistre: !!d.mode_reglement, lien: d.session_id ? `/dashboard/sessions/${d.session_id}?tab=facturation` : '/dashboard/agefice' })),
        emargements_incomplets: manquesEmargement,
      }
    }

    if (nom === 'detail_formation') {
      const motif = `%${String(args.nom || '').trim()}%`
      const { data: fs } = await org(supabase.from('formations')
        .select('id, intitule, categorie, duree_heures, duree_jours, tarif_inter_ht, tarif_intra_ht, taux_satisfaction, taux_reussite, nombre_apprenants_total, is_active'))
        .ilike('intitule', motif).eq('is_active', true).limit(4)
      if (!fs?.length) return { erreur: 'Aucune formation trouvée avec ce nom' }
      const auj = new Date().toISOString().slice(0, 10)
      const sorties = await Promise.all((fs as any[]).map(async (f) => {
        const { data: sessions } = await org(supabase.from('sessions')
          .select('id, date_debut, status, client:client_id(raison_sociale, nom_commercial)'))
          .eq('formation_id', f.id).gte('date_debut', auj).order('date_debut').limit(5)
        return {
          ...f,
          lien: `/dashboard/formations/${f.id}`,
          programme_pdf: `/api/pdf/programme/${f.id}`,
          prochaines_sessions: (sessions || []).map((se: any) => ({ du: se.date_debut, statut: se.status, client: nomClient(se.client), lien: `/dashboard/sessions/${se.id}` })),
        }
      }))
      return { formations: sorties }
    }

    return { erreur: `Outil inconnu : ${nom}` }
  } catch (e: any) {
    return { erreur: `Échec de l'outil ${nom} : ${e?.message || 'erreur inconnue'}` }
  }
}
