#!/usr/bin/env node
/**
 * Import des factures Dendreo → table `factures` (idempotent par dendreo_id).
 *   node migration/dendreo-factures.mjs           → DRY-RUN
 *   node migration/dendreo-factures.mjs --apply    → applique
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

const sbH = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json' }
const log = (...a) => console.log(...a)
const num = (v) => { const n = Number(v); return isNaN(n) ? null : n }
const day = (s) => (s ? String(s).slice(0, 10) : null)
const clean = (s) => { const v = (s ?? '').toString().trim(); return v || null }
const TODAY = new Date().toISOString().slice(0, 10)

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
async function insertBatch(rows) {
  if (DRY || !rows.length) return
  for (let i = 0; i < rows.length; i += 100) {
    const r = await fetch(`${SBASE}/rest/v1/factures`, { method: 'POST', headers: { ...sbH, Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 100)) })
    if (!r.ok) throw new Error(`POST factures → ${r.status} ${(await r.text()).slice(0, 1200)}`)
  }
}

log(`\n${DRY ? '🔍 DRY-RUN' : '🚀 APPLY'} — Import factures Dendreo`)

const factures = await dendreo('factures')
const clients = await sbGetAll(`/clients?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
const existing = await sbGetAll(`/factures?organization_id=eq.${ORG}&select=dendreo_id&dendreo_id=not.is.null`)
const clientByDid = new Map(clients.map((c) => [String(c.dendreo_id), c.id]))
const done = new Set(existing.map((f) => String(f.dendreo_id)))
log(`  factures Dendreo=${factures.length} · clients=${clients.length} · déjà importées=${done.size}`)

const statut = (f) => {
  const ttc = num(f.montant_total_ttc) || 0
  const paye = num(f.montant_paiements) || 0
  if (ttc > 0 && paye >= ttc) return 'payee'
  if (paye > 0 && paye < ttc) return 'payee_partiellement'
  const ech = day(f.date_echeance)
  if (ech && ech < TODAY) return 'en_retard'
  return 'emise'
}

let toInsert = [], noClient = 0
for (const f of factures) {
  const did = String(f.id_facture)
  if (done.has(did)) continue
  const clientId = f.id_entreprise && f.id_entreprise !== '0' ? clientByDid.get(String(f.id_entreprise)) : null
  if (f.id_entreprise && f.id_entreprise !== '0' && !clientId) noClient++
  const ht = num(f.montant_total_ht), ttc = num(f.montant_total_ttc), tva = num(f.montant_total_tva), paye = num(f.montant_paiements) || 0
  const isAvoir = f.id_avoir && f.id_avoir !== '0' && f.id_parent
  toInsert.push({
    organization_id: ORG, dendreo_id: did,
    numero: clean(f.numero_complet) || clean(f.numero) || `DENDREO-${did}`,
    type: isAvoir ? 'avoir' : 'facture',
    client_id: clientId || null,
    status: statut(f),
    date_emission: day(f.date_emission), date_echeance: day(f.date_echeance),
    date_paiement_complet: (ttc && paye >= ttc) ? day(f.date_paiement) : null,
    montant_ht: ht, montant_ttc: ttc, montant_tva: tva,
    taux_tva: ht && tva != null ? Math.round((tva / ht) * 100) : null,
    montant_paye: paye, montant_restant: ttc != null ? Math.max(0, ttc - paye) : null,
    remise_pourcent: num(f.remise),
    objet: clean(f.remarque),
    // Si pas d'entreprise cliente, le payeur (financeur/OPCO) est dans raison_sociale
    financeur_nom: !clientId ? clean(f.raison_sociale) : null,
    notes_internes: '[Dendreo]',
  })
}
log(`  à insérer=${toInsert.length} · sans client rattaché=${noClient}`)
await insertBatch(toInsert)
log(`\n${DRY ? 'DRY-RUN — rien écrit. Appliquer : node migration/dendreo-factures.mjs --apply' : `✓ ${toInsert.length} factures créées`}`)
