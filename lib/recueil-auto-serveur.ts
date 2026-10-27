import { fusionner, reponsesAutomatiques, themeDuRecueil, CLE_AUTO, type FaitsRecueil, type ThemeRecueil } from './recueil-auto'

/**
 * Recueils du besoin remplis automatiquement (lib/recueil-auto.ts), en base.
 *
 * Seulement pour les sessions pas encore commencées : le recueil est daté du
 * jour où le CRM l'écrit, avant la formation (jamais antidaté, jamais réécrit
 * après coup). Sans recueil, il est créé complet ; un recueil existant ne
 * reçoit que ses champs vides, et suit les faits pour les champs que le CRM a
 * écrits et que personne n'a modifiés. Appelé à la création d'un dossier ou
 * d'une session, avant l'envoi d'une convention, et chaque heure (tâche
 * planifiée) pour les sessions à venir.
 */

const jourParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

async function parPaquets<T = any>(ids: string[], lire: (paquet: string[]) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const lignes: T[] = []
  const uniques = Array.from(new Set(ids.filter(Boolean)))
  for (let i = 0; i < uniques.length; i += 150) {
    const { data, error } = await lire(uniques.slice(i, i + 150))
    if (error) throw new Error(error.message)
    lignes.push(...(data || []))
  }
  return lignes
}

export interface BilanRecueils { crees: number; completes: number; inchanges: number; ignorees: number }

/**
 * `sessionIds` : ces sessions-là (création d'un dossier, envoi d'une
 * convention) ; sinon toutes les sessions à venir de l'organisme.
 */
export async function assurerRecueils(supabase: any, orgId: string, opts: { sessionIds?: string[] } = {}): Promise<BilanRecueils> {
  const bilan: BilanRecueils = { crees: 0, completes: 0, inchanges: 0, ignorees: 0 }
  const aujourdhui = jourParis()

  let requete = supabase.from('sessions')
    .select('id, reference, status, date_debut, date_fin, horaires_jours, lieu, ville, modalite, type_session, places_max, intitule, client_id, formation_id')
    .eq('organization_id', orgId).neq('status', 'annulee')
  requete = opts.sessionIds?.length ? requete.in('id', opts.sessionIds) : requete.gte('date_debut', aujourdhui)
  const { data: sessionsBrutes, error } = await requete.limit(1000)
  if (error) throw new Error(`Sessions : ${error.message}`)
  // Pas commencées (ou sans date encore) ; jamais les agrégats du bilan pédagogique et financier (BPF-…)
  const sessions = ((sessionsBrutes || []) as any[]).filter((s) => !String(s.reference || '').startsWith('BPF-') && (!s.date_debut || String(s.date_debut).slice(0, 10) >= aujourdhui))
  bilan.ignorees = (sessionsBrutes || []).length - sessions.length
  if (!sessions.length) return bilan

  const ids = sessions.map((s) => s.id)
  const [recueils, templates, formations, clients, inscriptions] = await Promise.all([
    parPaquets<any>(ids, (p) => supabase.from('recueils_besoin').select('id, session_id, template_id, theme, reponses, statut, date_recueil').eq('organization_id', orgId).in('session_id', p)),
    supabase.from('recueil_besoin_templates').select('id, theme, questions, is_active').eq('organization_id', orgId).then((r: any) => {
      if (r.error) throw new Error(`Modèles : ${r.error.message}`)
      return (r.data || []) as any[]
    }),
    parPaquets<any>(sessions.map((s) => s.formation_id), (p) => supabase.from('formations')
      .select('id, intitule, analyse_besoin, objectifs_pedagogiques, public_vise, prerequis, duree_heures').eq('organization_id', orgId).in('id', p)),
    parPaquets<any>(sessions.map((s) => s.client_id), (p) => supabase.from('clients')
      .select('id, raison_sociale, nom_commercial, secteur_activite, ville, franchise_id').eq('organization_id', orgId).in('id', p)),
    parPaquets<any>(ids, (p) => supabase.from('inscriptions').select('session_id, apprenant_id, status').eq('organization_id', orgId).in('session_id', p)),
  ])
  if (!templates.length) return bilan
  const [franchises, apprenants] = await Promise.all([
    parPaquets<any>(clients.map((c) => c.franchise_id), (p) => supabase.from('franchises').select('id, nom').eq('organization_id', orgId).in('id', p)),
    parPaquets<any>(inscriptions.map((i) => i.apprenant_id), (p) => supabase.from('apprenants')
      .select('id, poste, type_contrat, situation_handicap').eq('organization_id', orgId).in('id', p)),
  ])

  const recueilDe = new Map(recueils.map((r) => [r.session_id, r]))
  const formationDe = new Map(formations.map((f) => [f.id, f]))
  const clientDe = new Map(clients.map((c) => [c.id, c]))
  const franchiseDe = new Map(franchises.map((f) => [f.id, f.nom]))
  const apprenantDe = new Map(apprenants.map((a) => [a.id, a]))
  const inscritsDe = new Map<string, any[]>()
  for (const i of inscriptions) {
    if (i.status === 'annule') continue
    const a = apprenantDe.get(i.apprenant_id)
    if (!a) continue
    const liste = inscritsDe.get(i.session_id)
    if (liste) liste.push(a); else inscritsDe.set(i.session_id, [a])
  }
  const modeleDe = (theme: string, templateId?: string | null) =>
    templates.find((t: any) => t.id === templateId) || templates.find((t: any) => t.theme === theme && t.is_active !== false) || templates.find((t: any) => t.theme === theme)

  for (const s of sessions) {
    const formation = formationDe.get(s.formation_id) || null
    const client = clientDe.get(s.client_id) || null
    const existant = recueilDe.get(s.id)
    const theme = (existant?.theme || themeDuRecueil(formation?.intitule || s.intitule)) as ThemeRecueil
    const modele = modeleDe(theme, existant?.template_id)
    if (!modele) { bilan.ignorees++; continue }
    const faits: FaitsRecueil = {
      session: s,
      formation,
      client: client ? { ...client, franchise: client.franchise_id ? franchiseDe.get(client.franchise_id) || null : null } : null,
      inscrits: inscritsDe.get(s.id) || [],
    }
    const questions = ((modele.questions || []) as any[]).map((q) => q.id)
    const auto = reponsesAutomatiques(faits, theme, questions)
    // Un participant a signalé un handicap : la case de l'analyse PSH est cochée (jamais décochée par le CRM)
    const psh = faits.inscrits.some((i) => i.situation_handicap) ? { psh_actif: 'oui' } : {}

    if (!existant) {
      const reponses = { ...auto, ...psh, [CLE_AUTO]: JSON.stringify({ le: aujourdhui, champs: auto }) }
      const { error: e } = await supabase.from('recueils_besoin').upsert({
        organization_id: orgId, session_id: s.id, template_id: modele.id, theme,
        reponses, statut: 'complete', rempli_par: null, date_recueil: aujourdhui, updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,session_id', ignoreDuplicates: true })
      if (e) throw new Error(`Recueil non enregistré : ${e.message}`)
      bilan.crees++
      continue
    }

    const { reponses, modifies } = fusionner(existant.reponses || {}, auto, aujourdhui)
    const avecPsh = psh.psh_actif && reponses.psh_actif !== 'oui' ? { ...reponses, ...psh } : reponses
    const toutRempli = questions.every((q) => String(avecPsh[q] ?? '').trim())
    const aCompleter = existant.statut !== 'complete' && toutRempli
    if (!modifies.length && avecPsh === reponses && !aCompleter) { bilan.inchanges++; continue }
    const { error: e } = await supabase.from('recueils_besoin').update({
      reponses: avecPsh,
      ...(aCompleter ? { statut: 'complete', date_recueil: existant.date_recueil || aujourdhui } : {}),
      ...(existant.template_id ? {} : { template_id: modele.id, theme }),
      updated_at: new Date().toISOString(),
    }).eq('id', existant.id).eq('organization_id', orgId)
    if (e) throw new Error(`Recueil non complété : ${e.message}`)
    bilan.completes++
  }
  return bilan
}

/** Les réponses automatiques d'une session, sans rien enregistrer (bouton « Pré-remplir » de l'onglet Recueil) */
export async function reponsesAutomatiquesDeSession(supabase: any, orgId: string, sessionId: string, theme: string | null): Promise<{ theme: ThemeRecueil; reponses: Record<string, string> } | null> {
  const { data: s } = await supabase.from('sessions')
    .select('id, reference, date_debut, date_fin, horaires_jours, lieu, ville, modalite, type_session, places_max, intitule, client_id, formation_id')
    .eq('organization_id', orgId).eq('id', sessionId).maybeSingle()
  if (!s) return null
  const [{ data: formation }, { data: client }, { data: inscriptions }, { data: templates }] = await Promise.all([
    s.formation_id ? supabase.from('formations').select('intitule, analyse_besoin, objectifs_pedagogiques, public_vise, prerequis, duree_heures').eq('organization_id', orgId).eq('id', s.formation_id).maybeSingle() : { data: null },
    s.client_id ? supabase.from('clients').select('raison_sociale, nom_commercial, secteur_activite, ville, franchise_id').eq('organization_id', orgId).eq('id', s.client_id).maybeSingle() : { data: null },
    supabase.from('inscriptions').select('apprenant_id, status').eq('organization_id', orgId).eq('session_id', sessionId),
    supabase.from('recueil_besoin_templates').select('id, theme, questions, is_active').eq('organization_id', orgId),
  ])
  const ids = ((inscriptions || []) as any[]).filter((i) => i.status !== 'annule').map((i) => i.apprenant_id).filter(Boolean)
  const [{ data: apprenants }, { data: franchise }] = await Promise.all([
    ids.length ? supabase.from('apprenants').select('poste, type_contrat, situation_handicap').eq('organization_id', orgId).in('id', ids) : { data: [] },
    client?.franchise_id ? supabase.from('franchises').select('nom').eq('organization_id', orgId).eq('id', client.franchise_id).maybeSingle() : { data: null },
  ])
  const t = (theme || themeDuRecueil(formation?.intitule || s.intitule)) as ThemeRecueil
  const modele = ((templates || []) as any[]).find((m) => m.theme === t && m.is_active !== false) || ((templates || []) as any[]).find((m) => m.theme === t)
  if (!modele) return null
  const faits: FaitsRecueil = { session: s, formation: formation || null, client: client ? { ...client, franchise: franchise?.nom || null } : null, inscrits: (apprenants || []) as any[] }
  return { theme: t, reponses: reponsesAutomatiques(faits, t, ((modele.questions || []) as any[]).map((q) => q.id)) }
}
