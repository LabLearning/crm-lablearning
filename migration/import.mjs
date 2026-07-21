#!/usr/bin/env node
/**
 * Import Dendreo → Lab Learning CRM
 *
 * Usage :
 *   node migration/import.mjs            → dry-run (rapport, ne touche pas la base)
 *   node migration/import.mjs --apply    → applique réellement
 *
 * Ordre : formations → clients → formateurs → stagiaires → sessions → dossiers.
 * Chaque entité importée garde son id source dans le champ `notes` ou `reference`
 * pour traçabilité (ex: "[MIG:FORM-001]").
 */
import { readFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const DRY_RUN = !process.argv.includes('--apply')
const SBASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'

if (!SBASE || !KEY) { console.error('Missing env'); process.exit(1) }

const headers = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

const log = (...a) => console.log(...a)
const tag = (id) => `[MIG:${id}]`

async function rpc(method, path, body) {
  const r = await fetch(`${SBASE}/rest/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 600)}`)
  }
  return r.json()
}

const data = JSON.parse(readFileSync('migration/data.json', 'utf8'))

log(`\n${DRY_RUN ? '🔍 DRY-RUN' : '🚀 APPLY'} — Import Dendreo → CRM`)
log(`  org_id : ${ORG}`)
log(`  source : ${Object.entries(data).map(([k, v]) => `${k}=${v.length}`).join(', ')}`)

// Fetch existing data once
log('\n[1/7] Fetch données existantes...')
const existing = {
  formations: await rpc('GET', `/formations?organization_id=eq.${ORG}&select=id,intitule,reference`),
  clients: await rpc('GET', `/clients?organization_id=eq.${ORG}&select=id,raison_sociale,siret`),
  formateurs: await rpc('GET', `/formateurs?organization_id=eq.${ORG}&select=id,nom,prenom`),
  apprenants: await rpc('GET', `/apprenants?organization_id=eq.${ORG}&select=id,nom,prenom`),
  sessions: await rpc('GET', `/sessions?organization_id=eq.${ORG}&select=id,date_debut,formation_id,client_id`),
  dossiers: await rpc('GET', `/dossiers_formation?organization_id=eq.${ORG}&select=id,numero_prise_en_charge`),
}
log(`  ✓ existant : formations=${existing.formations.length}, clients=${existing.clients.length}, formateurs=${existing.formateurs.length}, apprenants=${existing.apprenants.length}, sessions=${existing.sessions.length}, dossiers=${existing.dossiers.length}`)

const stats = {}
const idMap = { formations: {}, clients: {}, formateurs: {} }  // sourceId → dbId

// Index helpers
const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
const idxFormations = new Map(existing.formations.map((f) => [norm(f.intitule), f.id]))
const idxClientsSiret = new Map(existing.clients.filter((c) => c.siret).map((c) => [c.siret.toString(), c.id]))
const idxClientsNom = new Map(existing.clients.map((c) => [norm(c.raison_sociale), c.id]))
const idxFormateurs = new Map(existing.formateurs.map((f) => [norm(`${f.nom} ${f.prenom}`), f.id]))

// ───────────────────────────────────────────────────────────────────────────
// [2] FORMATIONS
// ───────────────────────────────────────────────────────────────────────────
log('\n[2/7] Formations...')
const formationsToInsert = []
const formationsExist = []
for (const f of data.formations) {
  const key = norm(f.titre)
  if (idxFormations.has(key)) {
    formationsExist.push(f)
    idMap.formations[f.id] = idxFormations.get(key)
    continue
  }
  formationsToInsert.push({
    organization_id: ORG,
    intitule: f.titre,
    reference: f.id,  // traçabilité Dendreo
    duree_heures: f.duree_type_h || 0,  // NOT NULL — défaut 0 si inconnu
    categorie: f.domaine || null,
    modalite: 'presentiel',
    sous_titre: f.code_nsf ? `Code NSF ${f.code_nsf}` : null,
    is_active: true,
  })
}
log(`  à insérer: ${formationsToInsert.length} · existantes: ${formationsExist.length}`)
stats.formations = { new: formationsToInsert.length, existing: formationsExist.length }

if (!DRY_RUN && formationsToInsert.length > 0) {
  const inserted = await rpc('POST', '/formations', formationsToInsert)
  inserted.forEach((row, i) => { idMap.formations[formationsToInsert[i].reference] = row.id; idxFormations.set(norm(row.intitule), row.id) })
  log(`  ✓ inséré ${inserted.length}`)
} else if (DRY_RUN) {
  // Simuler l'ajout aux indexes pour que les sessions trouvent ces formations
  formationsToInsert.forEach((f) => idxFormations.set(norm(f.intitule), '__simul__'))
}

// ───────────────────────────────────────────────────────────────────────────
// [3] CLIENTS
// ───────────────────────────────────────────────────────────────────────────
log('\n[3/7] Clients...')
const clientsToInsert = []
const clientsExist = []
const clientsSkipped = []
for (const c of data.clients) {
  // Skip placeholders type "(3 particuliers)"
  if (c.nom?.startsWith('(') || !c.nom) { clientsSkipped.push(c); continue }
  const siret = c.siret?.toString().replace(/\s/g, '') || null
  let existingId = siret ? idxClientsSiret.get(siret) : null
  if (!existingId) existingId = idxClientsNom.get(norm(c.nom))
  if (existingId) {
    clientsExist.push(c)
    idMap.clients[c.id] = existingId
    continue
  }
  clientsToInsert.push({
    organization_id: ORG,
    type: 'entreprise',
    raison_sociale: c.nom,
    siret: siret,
    notes: `${tag(c.id)} ${c.nb_sessions || 0} sessions`,
  })
}
// Auto-créer les clients manquants référencés dans Dossiers OPCO mais absents de l'onglet Clients
const knownClients = new Set([
  ...existing.clients.map((c) => norm(c.raison_sociale)),
  ...clientsToInsert.map((c) => norm(c.raison_sociale)),
])
const dossiersClients = new Set(data.dossiers.map((d) => d.client?.trim()).filter(Boolean))
const autoClientsAdded = []
for (const cli of dossiersClients) {
  if (knownClients.has(norm(cli))) continue
  if (cli.startsWith('(')) continue  // skip placeholders
  clientsToInsert.push({
    organization_id: ORG,
    type: 'entreprise',
    raison_sociale: cli,
    siret: null,  // pas connu — auto-créé depuis dossiers
    notes: `[MIG:auto-from-dossier]`,
  })
  autoClientsAdded.push(cli)
  knownClients.add(norm(cli))
}
log(`  à insérer: ${clientsToInsert.length} (dont ${autoClientsAdded.length} auto depuis dossiers) · existants: ${clientsExist.length} · skipped (placeholders): ${clientsSkipped.length}`)
stats.clients = { new: clientsToInsert.length, existing: clientsExist.length, skipped: clientsSkipped.length, autoFromDossiers: autoClientsAdded.length }

if (!DRY_RUN && clientsToInsert.length > 0) {
  const inserted = await rpc('POST', '/clients', clientsToInsert)
  for (const row of inserted) {
    const sourceMatch = row.notes?.match(/\[MIG:(CLI-\d+)\]/)
    if (sourceMatch) idMap.clients[sourceMatch[1]] = row.id
    idxClientsNom.set(norm(row.raison_sociale), row.id)
    if (row.siret) idxClientsSiret.set(row.siret.toString(), row.id)
  }
  log(`  ✓ inséré ${inserted.length}`)
} else if (DRY_RUN) {
  clientsToInsert.forEach((c) => {
    idxClientsNom.set(norm(c.raison_sociale), '__simul__')
    if (c.siret) idxClientsSiret.set(c.siret.toString(), '__simul__')
  })
}

// ───────────────────────────────────────────────────────────────────────────
// [4] FORMATEURS
// ───────────────────────────────────────────────────────────────────────────
log('\n[4/7] Formateurs...')
const splitName = (full) => {
  const parts = (full || '').trim().split(/\s+/)
  // Heuristique : si MAJUSCULES, c'est le nom puis prénom
  if (parts.length >= 2) {
    const upperCount = parts.filter((p) => p === p.toUpperCase() && /[A-Z]/.test(p)).length
    if (upperCount >= 1) return { nom: parts[0], prenom: parts.slice(1).join(' ') }
    return { nom: parts[parts.length - 1], prenom: parts.slice(0, -1).join(' ') }
  }
  return { nom: full || '—', prenom: '' }
}
const formateursToInsert = []
const formateursExist = []
for (const f of data.formateurs) {
  const { nom, prenom } = splitName(f.nom_complet)
  const key = norm(`${nom} ${prenom}`)
  if (idxFormateurs.has(key)) { formateursExist.push(f); idMap.formateurs[f.id] = idxFormateurs.get(key); continue }
  formateursToInsert.push({
    organization_id: ORG,
    nom: nom,
    prenom: prenom,
    type_contrat: f.statut === 'Interne' || f.statut === 'CDI' || f.statut === 'Apprenti' ? 'salarie' : 'sous_traitance',
    is_active: true,
    notes: `${tag(f.id)} ${f.statut || ''} · ${f.nom_commercial || ''} · ${f.nb_sessions || 0} sess · ${f.heures || 0} h · ${f.stagiaires || 0} stag`.trim(),
  })
}
log(`  à insérer: ${formateursToInsert.length} · existants: ${formateursExist.length}`)
stats.formateurs = { new: formateursToInsert.length, existing: formateursExist.length }

if (!DRY_RUN && formateursToInsert.length > 0) {
  const inserted = await rpc('POST', '/formateurs', formateursToInsert)
  for (const row of inserted) {
    const sourceMatch = row.notes?.match(/\[MIG:(FORMER-\d+)\]/)
    if (sourceMatch) idMap.formateurs[sourceMatch[1]] = row.id
    idxFormateurs.set(norm(`${row.nom} ${row.prenom}`), row.id)
  }
  log(`  ✓ inséré ${inserted.length}`)
} else if (DRY_RUN) {
  formateursToInsert.forEach((f) => idxFormateurs.set(norm(`${f.nom} ${f.prenom}`), '__simul__'))
}

// ───────────────────────────────────────────────────────────────────────────
// [5] STAGIAIRES (apprenants)
// ───────────────────────────────────────────────────────────────────────────
log('\n[5/7] Stagiaires...')
const apprenantsToInsert = []
const apprenantsExist = []
const apprenantsOrphan = []
const idxAppr = new Map(existing.apprenants.map((a) => [norm(`${a.nom}|${a.prenom}`), a.id]))
for (const s of data.stagiaires) {
  const key = norm(`${s.nom}|${s.prenom}`)
  if (idxAppr.has(key)) { apprenantsExist.push(s); continue }
  // Trouver le client
  const sir = s.siret_client?.toString().replace(/\s/g, '') || null
  let clientId = sir ? idxClientsSiret.get(sir) : null
  if (!clientId && s.client) clientId = idxClientsNom.get(norm(s.client))
  if (!clientId) apprenantsOrphan.push(s)
  apprenantsToInsert.push({
    organization_id: ORG,
    nom: (s.nom || '').trim(),
    prenom: (s.prenom || '').trim(),
    entreprise: s.client || null,
    client_id: clientId || null,
    notes: tag(s.id),
  })
  idxAppr.set(key, '__pending__')
}
log(`  à insérer: ${apprenantsToInsert.length} · déjà en base: ${apprenantsExist.length} · orphelins (client introuvable): ${apprenantsOrphan.length}`)
stats.apprenants = { new: apprenantsToInsert.length, existing: apprenantsExist.length, orphans: apprenantsOrphan.length }

if (!DRY_RUN && apprenantsToInsert.length > 0) {
  // Insert par batch de 100 pour ne pas exploser
  let inserted = 0
  for (let i = 0; i < apprenantsToInsert.length; i += 100) {
    const batch = apprenantsToInsert.slice(i, i + 100)
    const r = await rpc('POST', '/apprenants', batch)
    inserted += r.length
  }
  log(`  ✓ inséré ${inserted}`)
}

// ───────────────────────────────────────────────────────────────────────────
// [6] SESSIONS
// ───────────────────────────────────────────────────────────────────────────
log('\n[6/7] Sessions...')
const sessionsToInsert = []
const sessionsExist = []
const sessionsOrphan = []  // matchs partiels (formation manquante)
for (const s of data.sessions) {
  const clientId = s.client ? idxClientsNom.get(norm(s.client)) : null
  const formationId = s.formation_titre ? idxFormations.get(norm(s.formation_titre)) : null
  const formateurId = s.formateur ? idxFormateurs.get(norm(splitName(s.formateur).nom + ' ' + splitName(s.formateur).prenom)) : null
  if (!clientId || !formationId) { sessionsOrphan.push({ ...s, missing: { client: !clientId, formation: !formationId } }); continue }
  // Détection doublon : même date + même client + même formation
  const exists = existing.sessions.find((e) => e.date_debut === s.date_debut && e.client_id === clientId && e.formation_id === formationId)
  if (exists) { sessionsExist.push(s); continue }
  const past = new Date(s.date_debut) < new Date()
  sessionsToInsert.push({
    organization_id: ORG,
    formation_id: formationId,
    client_id: clientId,
    formateur_id: formateurId,
    date_debut: s.date_debut,
    date_fin: s.date_debut,  // approximation : 1 jour, à affiner si pluri-jours connus
    places_max: s.nb_stagiaires || null,
    status: past ? 'terminee' : 'confirmee',
    type_session: 'intra',
    notes_internes: `${tag(s.id)} financeur=${s.financeur || ''} · dossier=${s.n_dossier || ''} · durée_h=${s.duree_h || ''}`,
  })
}
log(`  à insérer: ${sessionsToInsert.length} · déjà en base: ${sessionsExist.length} · orphelines (client/formation manquant): ${sessionsOrphan.length}`)
stats.sessions = { new: sessionsToInsert.length, existing: sessionsExist.length, orphans: sessionsOrphan.length }

if (!DRY_RUN && sessionsToInsert.length > 0) {
  let inserted = 0
  for (let i = 0; i < sessionsToInsert.length; i += 50) {
    const batch = sessionsToInsert.slice(i, i + 50)
    const r = await rpc('POST', '/sessions', batch)
    inserted += r.length
  }
  log(`  ✓ inséré ${inserted}`)
}

// ───────────────────────────────────────────────────────────────────────────
// [7] DOSSIERS OPCO
// ───────────────────────────────────────────────────────────────────────────
log('\n[7/7] Dossiers OPCO...')
const dossiersToInsert = []
const dossiersExist = []
const dossiersOrphan = []
const idxDossierNum = new Map(existing.dossiers.filter((d) => d.numero_prise_en_charge).map((d) => [d.numero_prise_en_charge, d.id]))
for (const d of data.dossiers) {
  if (d.n_dossier && idxDossierNum.has(d.n_dossier)) { dossiersExist.push(d); continue }
  const clientId = d.client ? idxClientsNom.get(norm(d.client)) : null
  const formationId = d.formation ? idxFormations.get(norm(d.formation)) : null
  if (!clientId) { dossiersOrphan.push({ ...d, reason: 'client introuvable' }); continue }
  // statut Dendreo → opco_workflow_status enum (réduit à valeurs sûres : a_constituer / paye)
  const statusMap = {
    'Payé': 'paye',
    'paye': 'paye',
  }
  dossiersToInsert.push({
    organization_id: ORG,
    numero: d.id || `DOS-${Date.now()}`,  // NOT NULL — utilise l'ID Dendreo
    client_id: clientId,
    formation_id: formationId || null,
    financeur_type: 'opco',
    financeur_nom: d.organisme || null,
    numero_prise_en_charge: d.n_dossier || null,
    montant_prise_en_charge: d.montant_demande || null,
    montant_total_ht: d.montant_demande || null,
    montant_total_ttc: d.montant_demande || null,
    date_debut_formation: d.date_debut?.slice(0, 10) || null,
    opco_workflow_status: statusMap[d.statut] || 'a_constituer',
    notes: `${tag(d.id)} statut_origine=${d.statut || ''} · payé=${d.montant_paye || 0}`,
  })
}
log(`  à insérer: ${dossiersToInsert.length} · déjà en base: ${dossiersExist.length} · orphelins (client introuvable): ${dossiersOrphan.length}`)
stats.dossiers = { new: dossiersToInsert.length, existing: dossiersExist.length, orphans: dossiersOrphan.length }

if (!DRY_RUN && dossiersToInsert.length > 0) {
  let inserted = 0
  for (let i = 0; i < dossiersToInsert.length; i += 50) {
    const batch = dossiersToInsert.slice(i, i + 50)
    const r = await rpc('POST', '/dossiers_formation', batch)
    inserted += r.length
  }
  log(`  ✓ inséré ${inserted}`)
}

// ───────────────────────────────────────────────────────────────────────────
// Récap
// ───────────────────────────────────────────────────────────────────────────
log('\n═══════════════════════════════════════════════════')
log(`RÉSUMÉ ${DRY_RUN ? '(DRY-RUN, rien inséré)' : '(APPLIQUÉ)'}`)
log('═══════════════════════════════════════════════════')
for (const [entity, s] of Object.entries(stats)) {
  log(`  ${entity.padEnd(12)} : new=${(s.new || 0).toString().padStart(4)} · existing=${(s.existing || 0).toString().padStart(4)}${s.orphans !== undefined ? ` · orphans=${s.orphans}` : ''}${s.skipped !== undefined ? ` · skipped=${s.skipped}` : ''}`)
}

if (DRY_RUN) {
  log('\n→ Pour appliquer pour de vrai : node migration/import.mjs --apply')
}

// Échantillons d'orphelins pour debug
if (DRY_RUN) {
  if (sessionsOrphan.length > 0) {
    log(`\n⚠ Échantillon sessions orphelines (${sessionsOrphan.length} total) :`)
    sessionsOrphan.slice(0, 5).forEach((o) => log(`  - ${o.id} ${o.date_debut} client="${o.client}" form="${o.formation_titre}" missing=${JSON.stringify(o.missing)}`))
  }
  if (dossiersOrphan.length > 0) {
    log(`\n⚠ Échantillon dossiers orphelins (${dossiersOrphan.length}) :`)
    dossiersOrphan.slice(0, 5).forEach((o) => log(`  - ${o.id} ${o.n_dossier} client="${o.client}"`))
  }
}
