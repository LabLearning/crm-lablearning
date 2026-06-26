#!/usr/bin/env node
/**
 * Import des créneaux Dendreo → sessions.horaires_jours (planning jour-par-jour).
 *   node migration/dendreo-creneaux.mjs           → DRY-RUN
 *   node migration/dendreo-creneaux.mjs --apply    → applique (PATCH par dendreo_id)
 * Pas de migration nécessaire (horaires_jours est déjà un jsonb sur sessions).
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
const hm = (dt) => { const m = String(dt || '').match(/\d{2}:\d{2}/); return m ? m[0] : '' }
const ymd = (dt) => String(dt || '').slice(0, 10)

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
async function pool(items, size, fn) { let i = 0; await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const idx = i++; await fn(items[idx]) } })) }

log(`\n${DRY ? '🔍 DRY-RUN' : '🚀 APPLY'} — Créneaux → sessions.horaires_jours`)

const creneaux = await dendreo('creneaux')
const sessions = await sbGetAll(`/sessions?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
const sessByAction = new Map(sessions.map((s) => [String(s.dendreo_id), s.id]))

// Grouper créneaux par action → par jour → matin/aprem
const byAction = new Map()
for (const c of creneaux) {
  const aid = String(c.id_action_de_formation)
  if (!sessByAction.has(aid)) continue
  if (!byAction.has(aid)) byAction.set(aid, new Map())
  const days = byAction.get(aid)
  const day = ymd(c.date_debut)
  if (!day) continue
  if (!days.has(day)) days.set(day, { date: day, matin_debut: '', matin_fin: '', aprem_debut: '', aprem_fin: '' })
  const slot = days.get(day)
  const deb = hm(c.date_debut), fin = hm(c.date_fin)
  const startH = parseInt(deb.slice(0, 2) || '0', 10)
  const isMatin = /matin/i.test(c.name || '') || (!/midi|aprem|après/i.test(c.name || '') && startH < 13)
  if (isMatin) { slot.matin_debut = deb; slot.matin_fin = fin } else { slot.aprem_debut = deb; slot.aprem_fin = fin }
}

const updates = []
for (const [aid, days] of byAction) {
  const jours = [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
  updates.push({ sessionId: sessByAction.get(aid), jours })
}
log(`  créneaux=${creneaux.length} · sessions à planifier=${updates.length}`)

let done = 0
await pool(updates, 8, async (u) => {
  if (DRY) { done++; return }
  const r = await fetch(`${SBASE}/rest/v1/sessions?id=eq.${u.sessionId}`, { method: 'PATCH', headers: { ...sbH, Prefer: 'return=minimal' }, body: JSON.stringify({ horaires_jours: u.jours }) })
  if (r.ok) done++
  else console.error('PATCH session', u.sessionId, r.status)
})
log(`\n${DRY ? `DRY-RUN — ${updates.length} sessions seraient planifiées. Appliquer : node migration/dendreo-creneaux.mjs --apply` : `✓ ${done} sessions planifiées (horaires_jours)`}`)
