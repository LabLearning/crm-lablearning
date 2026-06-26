#!/usr/bin/env node
/**
 * Import financements → dossiers_formation, et opportunités → leads.
 *   node migration/dendreo-dossiers-leads.mjs           → DRY-RUN
 *   node migration/dendreo-dossiers-leads.mjs --apply    → applique
 * Prérequis : migration 052 (dendreo_id sur dossiers_formation + leads).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const DRY = !process.argv.includes('--apply')
const SBASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DBASE = process.env.DENDREO_API_BASE || `https://pro.dendreo.com/${process.env.DENDREO_SLUG || 'lab_learning'}/api`
const DKEY = process.env.DENDREO_API_KEY
const ORG = process.env.DENDREO_DEFAULT_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
if (!SBASE || !SKEY || !DKEY) { console.error('Env manquante'); process.exit(1) }

const sbH = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
const log = (...a) => console.log(...a)
const clean = (s) => { const v = (s ?? '').toString().trim(); return v || null }
const num = (v) => { const n = Number(v); return isNaN(n) ? null : n }
const day = (s) => (s ? String(s).slice(0, 10) : null)

async function dendreo(resource) {
  const r = await fetch(`${DBASE}/${resource}.php?key=${DKEY}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${resource} → ${r.status}`)
  return r.json()
}
async function sbGetAll(path) {
  const all = []; const page = 1000
  for (let from = 0; ; from += page) {
    const r = await fetch(`${SBASE}/rest/v1${path}`, { headers: { ...sbH, Range: `${from}-${from + page - 1}` } })
    if (!r.ok) throw new Error(`GET ${path} → ${r.status}`)
    const rows = await r.json(); all.push(...rows)
    if (rows.length < page) break
  }
  return all
}
async function existingDendreo(table) {
  try { return new Set((await sbGetAll(`/${table}?organization_id=eq.${ORG}&select=dendreo_id&dendreo_id=not.is.null`)).map((r) => String(r.dendreo_id))) }
  catch (e) {
    if (DRY) { console.warn(`  ⚠ ${table}.dendreo_id absent (migration 052 non appliquée) — traité comme vide`); return new Set() }
    throw new Error(`Applique d'abord la migration 052 (colonne ${table}.dendreo_id manquante)`)
  }
}
async function insert(table, rows) {
  if (DRY || !rows.length) return
  for (let i = 0; i < rows.length; i += 100) {
    const r = await fetch(`${SBASE}/rest/v1/${table}`, { method: 'POST', headers: sbH, body: JSON.stringify(rows.slice(i, i + 100)) })
    if (!r.ok) throw new Error(`POST ${table} → ${r.status} ${(await r.text()).slice(0, 400)}`)
  }
}

log(`\n${DRY ? '🔍 DRY-RUN' : '🚀 APPLY'} — Financements → dossiers · Opportunités → leads`)

// ── FINANCEMENTS → dossiers_formation ──
{
  const [financements, financeurs] = await Promise.all([dendreo('financements'), dendreo('financeurs')])
  const finNom = new Map(financeurs.map((f) => [String(f.id_opca), clean(f.raison_sociale)]))
  const sessions = await sbGetAll(`/sessions?organization_id=eq.${ORG}&select=id,dendreo_id,client_id,formation_id&dendreo_id=not.is.null`)
  const sessByAction = new Map(sessions.map((s) => [String(s.dendreo_id), s]))
  const done = await existingDendreo('dossiers_formation')
  const typeMap = { opca: 'opco', entreprise: 'entreprise', particulier: 'fonds_propres', public: 'france_travail' }
  const rows = []
  for (const f of financements) {
    const did = String(f.id_financement)
    if (done.has(did)) continue
    const sess = sessByAction.get(String(f.id_action_de_formation))
    rows.push({
      organization_id: ORG, dendreo_id: did,
      numero: clean(f.numero_dossier) || `FIN-${did}`,
      session_id: sess?.id || null, client_id: sess?.client_id || null, formation_id: sess?.formation_id || null,
      status: 'en_cours',
      financeur_type: typeMap[String(f.type)] || 'autre',
      financeur_nom: finNom.get(String(f.id_financeur)) || null,
      numero_prise_en_charge: clean(f.numero_dossier), opco_numero_dossier: clean(f.numero_dossier),
      montant_prise_en_charge: num(f.montant_total_finance),
      montant_total_ht: num(f.montant_total_finance), montant_total_ttc: num(f.montant_total_facture),
      notes: '[Dendreo]',
    })
  }
  log(`  financements=${financements.length} · dossiers à créer=${rows.length} · liés à une session=${rows.filter((r) => r.session_id).length}`)
  await insert('dossiers_formation', rows)
}

// ── OPPORTUNITÉS → leads ──
{
  const opportunites = await dendreo('opportunites')
  const clients = await sbGetAll(`/clients?organization_id=eq.${ORG}&select=id,dendreo_id,raison_sociale,siret&dendreo_id=not.is.null`)
  const contacts = await sbGetAll(`/contacts?organization_id=eq.${ORG}&select=dendreo_id,nom,prenom,email,telephone,civilite&dendreo_id=not.is.null`)
  const cliByDid = new Map(clients.map((c) => [String(c.dendreo_id), c]))
  const ctByDid = new Map(contacts.map((c) => [String(c.dendreo_id), c]))
  const done = await existingDendreo('leads')
  const etapeStatus = { '1': 'nouveau', '2': 'contacte', '3': 'proposition_envoyee', '4': 'negociation' }
  const rows = []
  for (const o of opportunites) {
    const did = String(o.id)
    if (done.has(did)) continue
    const cli = o.entreprise_id ? cliByDid.get(String(o.entreprise_id)) : null
    const ct = o.contact_id ? ctByDid.get(String(o.contact_id)) : null
    const status = o.lost_at ? 'perdu' : o.closed_at ? 'gagne' : (etapeStatus[String(o.opportunite_etape_id)] || 'nouveau')
    rows.push({
      organization_id: ORG, dendreo_id: did, type: 'entreprise',
      entreprise: cli?.raison_sociale || clean(o.numero_complet) || 'Opportunité Dendreo',
      siret: cli?.siret || null,
      contact_nom: ct?.nom || null, contact_prenom: ct?.prenom || null,
      contact_email: ct?.email || null, contact_telephone: ct?.telephone || null,
      contact_civilite: ct?.civilite || null,
      status,
      montant_estime: num(o.total_ht_dernier_devis),
      commentaire: clean(o.description) || clean(o.commentaires_internes),
    })
  }
  log(`  opportunités=${opportunites.length} · leads à créer=${rows.length}`)
  await insert('leads', rows)
}

log(`\n${DRY ? 'DRY-RUN — rien écrit. Appliquer (après migration 052) : node migration/dendreo-dossiers-leads.mjs --apply' : '✓ import terminé'}`)
