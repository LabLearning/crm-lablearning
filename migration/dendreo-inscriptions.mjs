#!/usr/bin/env node
/**
 * Import des inscriptions Dendreo (participant ↔ action) → table `inscriptions`.
 *   node migration/dendreo-inscriptions.mjs           → DRY-RUN
 *   node migration/dendreo-inscriptions.mjs --apply    → applique
 *
 * Source : le détail d'une action (actions_de_formation.php?id_action_de_formation=X)
 * renvoie un tableau `participants` (les inscrits). On crée une inscription par
 * (session, apprenant), idempotent sur cette paire. Prérequis : sync principal fait.
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

const sbH = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const log = (...a) => console.log(...a)

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
async function dendreoAction(id, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(`${DBASE}/actions_de_formation.php?id_action_de_formation=${id}&key=${DKEY}`, { headers: { Accept: 'application/json' } })
      if (r.status === 429 || r.status >= 500) { await sleep(400 * (t + 1)); continue }
      if (!r.ok) return null
      const d = await r.json()
      return Array.isArray(d) ? d[0] : d
    } catch { await sleep(400 * (t + 1)) }
  }
  return null
}
// GET paginé (contourne la limite max-rows de PostgREST)
async function sbGet(path) {
  const all = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const r = await fetch(`${SBASE}/rest/v1${path}`, { headers: { ...sbH, Range: `${from}-${from + page - 1}` } })
    if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${(await r.text()).slice(0, 200)}`)
    const rows = await r.json()
    all.push(...rows)
    if (rows.length < page) break
  }
  return all
}
async function sbInsert(rows) {
  if (DRY || !rows.length) return
  for (let i = 0; i < rows.length; i += 100) {
    const r = await fetch(`${SBASE}/rest/v1/inscriptions`, { method: 'POST', headers: { ...sbH, Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 100)) })
    if (!r.ok) throw new Error(`POST inscriptions → ${r.status} ${(await r.text()).slice(0, 300)}`)
  }
}
// Pool de concurrence simple
async function pool(items, size, fn) {
  const out = []; let i = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx) }
  }))
  return out
}

log(`\n${DRY ? '🔍 DRY-RUN' : '🚀 APPLY'} — Import inscriptions Dendreo`)

const sessions = await sbGet(`/sessions?organization_id=eq.${ORG}&select=id,dendreo_id,status&dendreo_id=not.is.null`)
const apprenants = await sbGet(`/apprenants?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
const existing = await sbGet(`/inscriptions?organization_id=eq.${ORG}&select=session_id,apprenant_id`)
const apprByDid = new Map(apprenants.map((a) => [String(a.dendreo_id), a.id]))
const pairSet = new Set(existing.map((e) => `${e.session_id}|${e.apprenant_id}`))
log(`  sessions(dendreo)=${sessions.length} apprenants(dendreo)=${apprenants.length} inscriptions existantes=${existing.length}`)

const statusFor = (s) => s === 'terminee' ? 'complete' : s === 'en_cours' ? 'en_cours' : 'confirme'

let toInsert = []
let noAppr = 0, processed = 0, failed = 0
await pool(sessions, 5, async (s) => {
  const action = await dendreoAction(s.dendreo_id)
  if (!action) { failed++; return }
  processed++
  const parts = (action && action.participants) || []
  for (const p of parts) {
    const apprId = apprByDid.get(String(p.id_participant))
    if (!apprId) { noAppr++; continue }
    const key = `${s.id}|${apprId}`
    if (pairSet.has(key)) continue
    pairSet.add(key)
    toInsert.push({
      organization_id: ORG, session_id: s.id, apprenant_id: apprId,
      status: statusFor(s.status),
      date_inscription: (p.date_add || '').slice(0, 10) || null,
    })
  }
})

log(`  actions OK=${processed} · échec=${failed} · inscriptions à créer=${toInsert.length} · participants sans apprenant CRM=${noAppr}`)
await sbInsert(toInsert)

log(`\n${DRY ? 'DRY-RUN — rien écrit. Appliquer : node migration/dendreo-inscriptions.mjs --apply' : `✓ ${toInsert.length} inscriptions créées`}`)
