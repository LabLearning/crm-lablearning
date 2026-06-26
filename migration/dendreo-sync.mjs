#!/usr/bin/env node
/**
 * Sync Dendreo (API live) → Lab Learning CRM — idempotent par dendreo_id.
 *
 *   node migration/dendreo-sync.mjs            → DRY-RUN (rapport, n'écrit rien)
 *   node migration/dendreo-sync.mjs --apply    → applique (insert des manquants)
 *
 * Prérequis : migration 049_dendreo_sync.sql appliquée (colonnes dendreo_id).
 * Politique : "CRM fait foi" → on INSÈRE les enregistrements Dendreo absents,
 * on NE met PAS à jour ceux déjà présents (pas d'écrasement des saisies).
 * Ordre : entreprises → formateurs → modules → contacts → participants → actions.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const DRY = !process.argv.includes('--apply')
const SBASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DBASE = process.env.DENDREO_API_BASE || `https://pro.dendreo.com/${process.env.DENDREO_SLUG || 'lab_learning'}/api`
const DKEY = process.env.DENDREO_API_KEY
const ORG = process.env.DENDREO_DEFAULT_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
if (!SBASE || !SKEY || !DKEY) { console.error('Env manquante (SUPABASE / DENDREO)'); process.exit(1) }

const sbHeaders = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const log = (...a) => console.log(...a)
const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
const clean = (s) => { const v = (s ?? '').toString().trim(); return v || null }

async function dendreo(resource) {
  const r = await fetch(`${DBASE}/${resource}.php`, { headers: { Authorization: `Token token="${DKEY}"`, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Dendreo ${resource} → ${r.status}`)
  return r.json()
}
async function sb(method, path, body) {
  const r = await fetch(`${SBASE}/rest/v1${path}`, { method, headers: sbHeaders, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${(await r.text()).slice(0, 400)}`)
  return r.json()
}
async function existingByDendreo(table) {
  try {
    const rows = await sb('GET', `/${table}?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
    return new Map(rows.map((x) => [String(x.dendreo_id), x.id]))
  } catch (e) {
    if (String(e).includes('dendreo_id does not exist')) {
      if (DRY) { console.warn(`  ⚠ ${table}.dendreo_id absent (migration 049 non appliquée) — traité comme vide`); return new Map() }
      throw new Error(`Colonne ${table}.dendreo_id absente : applique d'abord la migration 049_dendreo_sync.sql`)
    }
    throw e
  }
}
// Insert par batch, renvoie les lignes créées (avec id + dendreo_id)
async function insertBatch(table, rows) {
  if (DRY || rows.length === 0) return []
  const out = []
  for (let i = 0; i < rows.length; i += 100) {
    const r = await sb('POST', `/${table}`, rows.slice(i, i + 100))
    out.push(...r)
  }
  return out
}

log(`\n${DRY ? '🔍 DRY-RUN' : '🚀 APPLY'} — Sync Dendreo → CRM (org ${ORG.slice(0, 8)})`)

// ── Chargement source ──
log('\n[1] Lecture Dendreo…')
const [entreprises, formateurs, modules, contacts, participants, actions] = await Promise.all([
  dendreo('entreprises'), dendreo('formateurs'), dendreo('modules'),
  dendreo('contacts'), dendreo('participants'), dendreo('actions_de_formation'),
])
log(`  entreprises=${entreprises.length} formateurs=${formateurs.length} modules=${modules.length} contacts=${contacts.length} participants=${participants.length} actions=${actions.length}`)

// Ensembles source pour mesurer la couverture des liens (valide en dry-run ET apply)
const entrepriseIds = new Set(entreprises.map((e) => String(e.id_entreprise)))
const moduleNames = new Set()
modules.forEach((m) => { if (m.intitule) moduleNames.add(norm(m.intitule)); if (m.intitule_court) moduleNames.add(norm(m.intitule_court)) })

const report = {}
const clientMap = await existingByDendreo('clients')      // id_entreprise → client.id
const formateurMap = await existingByDendreo('formateurs')
const formationMap = await existingByDendreo('formations') // id_module → formation.id
const contactMap = await existingByDendreo('contacts')
const apprenantMap = await existingByDendreo('apprenants')
const sessionMap = await existingByDendreo('sessions')

// ── ENTREPRISES → clients ──
{
  const toInsert = []
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
      notes: '[Dendreo]',
    })
  }
  const created = await insertBatch('clients', toInsert)
  created.forEach((r) => r.dendreo_id && clientMap.set(String(r.dendreo_id), r.id))
  report.clients = { new: toInsert.length, existing: entreprises.length - toInsert.length }
}

// ── FORMATEURS ──
{
  const toInsert = []
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

// ── MODULES → formations ──
const formationByName = new Map()
{
  const toInsert = []
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
      objectifs_pedagogiques: clean(m.objectif) ? [clean(m.objectif)] : null, prerequis: clean(m.pre_requis), public_vise: clean(m.public_vise),
      methodes_pedagogiques: clean(m.modalites_pedagogiques), moyens_techniques: clean(m.moyens_supports_pedagogiques),
      modalites_evaluation: clean(m.modalites_devaluation), accessibilite_handicap: clean(m.accessibilite),
      programme_detaille: clean(String(m.description || '').replace(/<\s*li[^>]*>/gi, '\n• ').replace(/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/gi, '\n').replace(/<\s*br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').split('\n').map((l) => l.trim()).filter((l) => l && l !== '•').join('\n')),
      tarif_inter_ht: m.prix != null ? Number(m.prix) : null, tarif_intra_ht: m.prix_intra != null ? Number(m.prix_intra) : null,
      is_active: true,
    })
  }
  const created = await insertBatch('formations', toInsert)
  created.forEach((r) => { if (r.dendreo_id) formationMap.set(String(r.dendreo_id), r.id); formationByName.set(norm(r.intitule), r.id) })
  // index aussi les existantes pour le matching sessions
  if (DRY) toInsert.forEach((f) => formationByName.set(norm(f.intitule), '__new__'))
  for (const [did, id] of formationMap) { const m = modules.find((x) => String(x.id_module) === did); if (m) formationByName.set(norm(m.intitule), id) }
  report.formations = { new: toInsert.length, existing: modules.length - toInsert.length }
}

// ── CONTACTS ──
{
  const toInsert = []
  let orphan = 0
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

// ── PARTICIPANTS → apprenants ──
{
  const toInsert = []
  let orphan = 0
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

// ── ACTIONS_DE_FORMATION → sessions ──
{
  const toInsert = []
  let orphanForm = 0
  for (const a of actions) {
    const did = String(a.id_action_de_formation)
    if (sessionMap.has(did)) continue
    const formationId = formationByName.get(norm(a.intitule)) || formationByName.get(norm(a.formation))
    const matchable = moduleNames.has(norm(a.intitule)) || moduleNames.has(norm(a.formation))
    if (!matchable) orphanForm++
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
  // En apply, on n'insère que celles avec formation_id résolu (NOT NULL probable)
  const insertable = DRY ? toInsert : toInsert.filter((s) => s.formation_id)
  await insertBatch('sessions', insertable)
  report.sessions = { new: insertable.length, existing: actions.length - toInsert.length, orphan_formation: orphanForm }
}

// ── Récap ──
log('\n═══════════════════════════════════════')
log(`RÉSUMÉ ${DRY ? '(DRY-RUN — rien écrit)' : '(APPLIQUÉ)'}`)
log('═══════════════════════════════════════')
for (const [k, v] of Object.entries(report)) {
  log(`  ${k.padEnd(12)} new=${String(v.new).padStart(4)}  existing=${String(v.existing).padStart(4)}` +
      (v.orphan !== undefined ? `  orphelins=${v.orphan}` : '') +
      (v.orphan_formation !== undefined ? `  sans_formation=${v.orphan_formation}` : ''))
}
if (DRY) log('\n→ Appliquer : node migration/dendreo-sync.mjs --apply  (après migration 049)')
