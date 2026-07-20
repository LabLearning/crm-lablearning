// Synchro Dendreo (API live) → CRM — idempotent par dendreo_id.
// Politique "CRM fait foi" : on INSÈRE les enregistrements Dendreo absents,
// on NE met PAS à jour ceux déjà présents (pas d'écrasement des saisies).
// Utilisé par le cron quotidien (/api/cron/dendreo-sync) et exportable
// pour un run manuel. Reprend fidèlement migration/dendreo-sync.mjs.

// ── Nettoyage HTML des champs Dendreo (aligné sur migration/html-clean.mjs) ──
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
}
const decodeEntities = (s: string) => s.replace(/&[a-z#0-9]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? ' ')
const LEADING_BULLETS = new RegExp('^(?:\\s*[\\u2022\\u00b7\\u2219\\u25cf\\u25aa\\u25e6\\u2043\\u2013\\u2014\\uf000-\\uf0ff*\\-]+)+\\s*')
const stripBullet = (s: string) => s.replace(LEADING_BULLETS, '').trim()
const stripPua = (s: string) => s.replace(/[-]/g, '').replace(/[ \t]{2,}/g, ' ')
function mergeContinuations(lines: string[]): string[] {
  const out: string[] = []
  const endsSentence = (s: string) => /[.!?:)\]]$/.test(s)
  const isUpper = (s: string) => s === s.toUpperCase() && /[A-ZÀ-Ý]/.test(s)
  for (const line of lines) {
    const prev = out[out.length - 1]
    const startsLower = /^[a-zà-ÿ(]/.test(line)
    if (prev && !endsSentence(prev) && !/^jour\s*\d/i.test(prev) && (startsLower || (isUpper(prev) && isUpper(line)))) {
      out[out.length - 1] = `${prev} ${line}`
    } else out.push(line)
  }
  return out
}
function fieldItems(s: any): string[] {
  const raw = (s ?? '').toString().replace(/\r\n?/g, '\n').trim()
  if (!raw) return []
  if (/<[a-z][^>]*>/i.test(raw)) {
    if (/<li\b/i.test(raw)) {
      const items: string[] = []; let current = ''
      for (const token of raw.split(/(<[^>]+>)/)) {
        if (!token) continue
        if (token.startsWith('<')) {
          if (/^<li\b/i.test(token)) { if (current.trim()) items.push(current.trim()); current = '' }
        } else {
          const text = decodeEntities(token).replace(/\s+/g, ' ').trim()
          if (text) current += (current ? ' ' : '') + text
        }
      }
      if (current.trim()) items.push(current.trim())
      return items.map((i) => stripBullet(stripPua(i))).filter(Boolean)
    }
    const text = decodeEntities(raw.replace(/<\/(p|div|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    return mergeContinuations(text.split('\n').map((l) => stripBullet(stripPua(l)).trim()).filter(Boolean))
  }
  return mergeContinuations(raw.split('\n').map((l) => stripBullet(stripPua(l)).trim()).filter(Boolean))
}
function htmlFieldToText(s: any): string | null {
  const items = fieldItems(s)
  return items.length ? items.join('\n') : null
}

export interface SyncReport {
  clients: { new: number; existing: number }
  formateurs: { new: number; existing: number }
  formations: { new: number; existing: number }
  contacts: { new: number; existing: number; orphan: number }
  apprenants: { new: number; existing: number; orphan: number }
  sessions: { new: number; existing: number; orphan_formation: number }
}

const norm = (s: any) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
const clean = (s: any): string | null => { const v = (s ?? '').toString().trim(); return v || null }

export async function runDendreoSync(apply: boolean): Promise<SyncReport> {
  const SBASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const DBASE = process.env.DENDREO_API_BASE || `https://pro.dendreo.com/${process.env.DENDREO_SLUG || 'lab_learning'}/api`
  const DKEY = process.env.DENDREO_API_KEY!
  const ORG = process.env.DENDREO_DEFAULT_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
  if (!SBASE || !SKEY || !DKEY) throw new Error('Env manquante (SUPABASE / DENDREO)')

  const sbHeaders = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }

  const dendreo = async (resource: string) => {
    const r = await fetch(`${DBASE}/${resource}.php`, { headers: { Authorization: `Token token="${DKEY}"`, Accept: 'application/json' }, cache: 'no-store' })
    if (!r.ok) throw new Error(`Dendreo ${resource} → ${r.status}`)
    return r.json()
  }
  const sb = async (method: string, path: string, body?: any) => {
    const r = await fetch(`${SBASE}/rest/v1${path}`, { method, headers: sbHeaders, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`)
    return r.json()
  }
  const existingByDendreo = async (table: string) => {
    const rows: any[] = []; const page = 1000
    for (let from = 0; ; from += page) {
      const r = await fetch(`${SBASE}/rest/v1/${table}?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`, { headers: { ...sbHeaders, Range: `${from}-${from + page - 1}` }, cache: 'no-store' })
      if (!r.ok) throw new Error(`GET ${table} → ${r.status}`)
      const batch = await r.json(); rows.push(...batch)
      if (batch.length < page) break
    }
    return new Map<string, string>(rows.map((x) => [String(x.dendreo_id), x.id]))
  }
  const insertBatch = async (table: string, rows: any[]) => {
    if (!apply || rows.length === 0) return [] as any[]
    const out: any[] = []
    for (let i = 0; i < rows.length; i += 100) out.push(...await sb('POST', `/${table}`, rows.slice(i, i + 100)))
    return out
  }

  const [entreprises, formateurs, modules, contacts, participants, actions] = await Promise.all([
    dendreo('entreprises'), dendreo('formateurs'), dendreo('modules'),
    dendreo('contacts'), dendreo('participants'), dendreo('actions_de_formation'),
  ])

  const entrepriseIds = new Set(entreprises.map((e: any) => String(e.id_entreprise)))
  const report: any = {}
  const clientMap = await existingByDendreo('clients')
  const formateurMap = await existingByDendreo('formateurs')
  const formationMap = await existingByDendreo('formations')
  const contactMap = await existingByDendreo('contacts')
  const apprenantMap = await existingByDendreo('apprenants')
  const sessionMap = await existingByDendreo('sessions')

  // ENTREPRISES → clients
  {
    const toInsert: any[] = []
    for (const e of entreprises) {
      const did = String(e.id_entreprise)
      if (clientMap.has(did)) continue
      const raison = clean(e.raison_sociale) || clean(e.appellation) || [clean(e.prenom), clean(e.nom)].filter(Boolean).join(' ')
      if (!raison) continue
      toInsert.push({
        organization_id: ORG, dendreo_id: did, type: 'entreprise',
        raison_sociale: raison, siret: clean(e.siret), tva_intra: clean(e.num_tva_intra),
        forme_juridique: clean(e.statut_juridique), sigle: clean(e.sigle),
        code_naf: clean(e.ape_code), secteur_activite: clean(e.code_naf && e.code_naf.intitule),
        adresse: clean(e.adresse), code_postal: clean(e.code_postal), ville: clean(e.ville),
        telephone: clean(e.telephone), email: clean(e.email_standard), site_web: clean(e.site_internet),
        pays: clean(e.pays), financeur_type: ({ 'Models\\Opca': 'opco', 'Models\\Entreprise': 'entreprise' } as any)[e.financeur_type] || null,
        notes: '[Dendreo]',
      })
    }
    const created = await insertBatch('clients', toInsert)
    created.forEach((r) => r.dendreo_id && clientMap.set(String(r.dendreo_id), r.id))
    report.clients = { new: toInsert.length, existing: entreprises.length - toInsert.length }
  }

  // FORMATEURS
  {
    const toInsert: any[] = []
    for (const f of formateurs) {
      const did = String(f.id_formateur)
      if (formateurMap.has(did)) continue
      if (!clean(f.nom) && !clean(f.prenom)) continue
      const salarie = ['Interne', 'CDI', 'CDD', 'Apprenti'].includes(f.statut)
      toInsert.push({
        organization_id: ORG, dendreo_id: did,
        civilite: clean(f.civilite), nom: clean(f.nom) || '—', prenom: clean(f.prenom) || '',
        email: clean(f.email_pro) || clean(f.email_perso),
        telephone: clean(f.telephone_pro) || clean(f.telephone_perso),
        siret: clean(f.siret), numero_da: clean(f.num_da), adresse: clean(f.adresse), code_postal: clean(f.code_postal), ville: clean(f.ville),
        type_contrat: salarie ? 'salarie' : 'sous_traitance', is_active: true, notes: '[Dendreo]',
      })
    }
    const created = await insertBatch('formateurs', toInsert)
    created.forEach((r) => r.dendreo_id && formateurMap.set(String(r.dendreo_id), r.id))
    report.formateurs = { new: toInsert.length, existing: formateurs.length - toInsert.length }
  }

  // MODULES → formations
  const formationByName = new Map<string, string>()
  {
    const toInsert: any[] = []
    for (const m of modules) {
      const did = String(m.id_module)
      if (formationMap.has(did)) continue
      const intitule = clean(m.intitule) || clean(m.intitule_court)
      if (!intitule) continue
      toInsert.push({
        organization_id: ORG, dendreo_id: did, reference: clean(m.numero_complet) || clean(m.numero),
        intitule, categorie: clean(m.categorie && m.categorie.intitule) || (typeof m.categorie === 'string' ? clean(m.categorie) : null),
        modalite: 'presentiel',
        duree_heures: Number(m.duree_heures) || 0, duree_jours: m.duree_jours != null ? Number(m.duree_jours) : null,
        objectifs_pedagogiques: (() => { const o = fieldItems(m.objectif); return o.length ? o : null })(),
        prerequis: htmlFieldToText(m.pre_requis), public_vise: htmlFieldToText(m.public_vise),
        methodes_pedagogiques: htmlFieldToText(m.modalites_pedagogiques), moyens_techniques: htmlFieldToText(m.moyens_supports_pedagogiques),
        modalites_evaluation: htmlFieldToText(m.modalites_devaluation), accessibilite_handicap: htmlFieldToText(m.accessibilite),
        programme_detaille: htmlFieldToText(m.description),
        tarif_inter_ht: m.prix != null ? Number(m.prix) : null, tarif_intra_ht: m.prix_intra != null ? Number(m.prix_intra) : null,
        modalites_admission: htmlFieldToText(m.infos_admission), is_active: true,
      })
    }
    const created = await insertBatch('formations', toInsert)
    created.forEach((r) => { if (r.dendreo_id) formationMap.set(String(r.dendreo_id), r.id); formationByName.set(norm(r.intitule), r.id) })
    if (!apply) toInsert.forEach((f) => formationByName.set(norm(f.intitule), '__new__'))
    for (const [did, id] of formationMap) { const m = modules.find((x: any) => String(x.id_module) === did); if (m) formationByName.set(norm(m.intitule), id) }
    report.formations = { new: toInsert.length, existing: modules.length - toInsert.length }
  }

  // CONTACTS
  {
    const toInsert: any[] = []; let orphan = 0
    for (const c of contacts) {
      const did = String(c.id_contact)
      if (contactMap.has(did)) continue
      if (!clean(c.nom) && !clean(c.prenom)) continue
      const clientId = c.id_entreprise ? clientMap.get(String(c.id_entreprise)) : null
      if (c.id_entreprise && !entrepriseIds.has(String(c.id_entreprise))) orphan++
      toInsert.push({
        organization_id: ORG, dendreo_id: did, client_id: clientId || null,
        civilite: clean(c.civilite), nom: clean(c.nom) || '—', prenom: clean(c.prenom) || '',
        email: clean(c.email), telephone: clean(c.telephone_direct), mobile: clean(c.portable),
        poste: clean(c.fonction), notes: '[Dendreo]',
      })
    }
    await insertBatch('contacts', toInsert)
    report.contacts = { new: toInsert.length, existing: contacts.length - toInsert.length, orphan }
  }

  // PARTICIPANTS → apprenants
  {
    const toInsert: any[] = []; let orphan = 0
    for (const p of participants) {
      const did = String(p.id_participant)
      if (apprenantMap.has(did)) continue
      if (!clean(p.nom) && !clean(p.prenom)) continue
      const clientId = p.id_entreprise ? clientMap.get(String(p.id_entreprise)) : null
      if (p.id_entreprise && !entrepriseIds.has(String(p.id_entreprise))) orphan++
      toInsert.push({
        organization_id: ORG, dendreo_id: did, client_id: clientId || null,
        civilite: clean(p.civilite), nom: clean(p.nom) || '—', prenom: clean(p.prenom) || '',
        email: clean(p.email), telephone: clean(p.portable),
        date_naissance: clean(p.date_de_naissance), poste: clean(p.fonction),
        statut_bpf: clean(p.statut_bpf),
        entreprise: clean(p.catalogue_entreprise), notes: '[Dendreo]',
      })
    }
    await insertBatch('apprenants', toInsert)
    report.apprenants = { new: toInsert.length, existing: participants.length - toInsert.length, orphan }
  }

  // ACTIONS_DE_FORMATION → sessions
  {
    const formationEntries = [...formationByName.entries()].filter(([, v]) => v && v !== '__new__')
    const fuzzyForm = (intit: any) => {
      const q = norm(intit); if (!q) return null
      for (const [k, id] of formationEntries) if (k.includes(q) || q.includes(k)) return id
      const qt = new Set(q.split(' ').filter((w) => w.length > 3))
      if (!qt.size) return null
      let best: string | null = null, bestScore = 0
      for (const [k, id] of formationEntries) {
        const kt = k.split(' ').filter((w) => w.length > 3)
        const inter = kt.filter((w) => qt.has(w)).length
        const score = inter / Math.max(1, Math.min(qt.size, kt.length))
        if (score > bestScore) { bestScore = score; best = id }
      }
      return bestScore >= 0.5 ? best : null
    }
    const toInsert: any[] = []; let orphanForm = 0
    for (const a of actions) {
      const did = String(a.id_action_de_formation)
      if (sessionMap.has(did)) continue
      const formationId = formationByName.get(norm(a.intitule)) || formationByName.get(norm(a.formation)) || fuzzyForm(a.intitule)
      if (!formationId) orphanForm++
      const clientId = a.id_entreprise ? clientMap.get(String(a.id_entreprise)) : null
      const past = a.date_fin && new Date(a.date_fin) < new Date()
      toInsert.push({
        organization_id: ORG, dendreo_id: did,
        formation_id: formationId && formationId !== '__new__' ? formationId : null,
        client_id: clientId || null,
        reference: clean(a.numero_complet) || clean(a.numero),
        intitule: clean(a.intitule),
        date_debut: clean(a.date_debut) || clean(a.date_effective_debut),
        date_fin: clean(a.date_fin) || clean(a.date_effective_fin) || clean(a.date_debut),
        places_min: a.nb_participants_min != null ? Number(a.nb_participants_min) : null,
        places_max: a.nb_participants_max != null ? Number(a.nb_participants_max) : null,
        status: past ? 'terminee' : 'confirmee',
        type_session: a.type === 'INTRA' || a.mode_organisation === 'intra' ? 'intra' : 'inter',
        notes_internes: '[Dendreo]',
      })
    }
    const insertable = apply ? toInsert.filter((s) => s.formation_id) : toInsert
    await insertBatch('sessions', insertable)
    report.sessions = { new: insertable.length, existing: actions.length - toInsert.length, orphan_formation: orphanForm }
  }

  return report as SyncReport
}
