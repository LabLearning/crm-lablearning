#!/usr/bin/env node
/**
 * Backfill des champs Dendreo manquants sur les lignes déjà importées.
 *   node migration/dendreo-backfill.mjs           → DRY-RUN
 *   node migration/dendreo-backfill.mjs --apply    → applique (UPDATE par dendreo_id)
 *
 * Corrige : clients (email_standard, ape_code→code_naf, code_naf.intitule→secteur,
 * site_internet→site_web), formations (categorie.intitule), sessions (formateur_id
 * + lieu/adresse via la salle, depuis le détail de l'action).
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
const clean = (s) => { const v = (s ?? '').toString().trim(); return v || null }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function dendreo(resource, qs = '') {
  const r = await fetch(`${DBASE}/${resource}.php?${qs}${qs ? '&' : ''}key=${DKEY}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  return r.json()
}
async function dendreoAction(id, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const d = await dendreo('actions_de_formation', `id_action_de_formation=${id}`).catch(() => null)
    if (d) return Array.isArray(d) ? d[0] : d
    await sleep(400 * (t + 1))
  }
  return null
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
async function patch(table, dendreoId, body) {
  if (DRY) return true
  const r = await fetch(`${SBASE}/rest/v1/${table}?organization_id=eq.${ORG}&dendreo_id=eq.${encodeURIComponent(dendreoId)}`, {
    method: 'PATCH', headers: { ...sbH, Prefer: 'return=minimal' }, body: JSON.stringify(body),
  })
  if (!r.ok) { console.error(`PATCH ${table}/${dendreoId} → ${r.status} ${(await r.text()).slice(0, 160)}`); return false }
  return true
}
async function pool(items, size, fn) {
  let i = 0
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const idx = i++; await fn(items[idx]) } }))
}
const onlySet = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null))

log(`\n${DRY ? '🔍 DRY-RUN' : '🚀 APPLY'} — Backfill Dendreo`)

// ── CLIENTS ──
{
  const entreprises = await dendreo('entreprises') || []
  let n = 0
  for (const e of entreprises) {
    const body = onlySet({
      email: clean(e.email_standard), code_naf: clean(e.ape_code),
      secteur_activite: clean(e.code_naf && e.code_naf.intitule), site_web: clean(e.site_internet),
    })
    if (Object.keys(body).length === 0) continue
    if (await patch('clients', e.id_entreprise, body)) n++
  }
  log(`  clients enrichis : ${n}`)
}

// ── FORMATIONS ──
{
  const modules = await dendreo('modules') || []
  let n = 0
  for (const m of modules) {
    const cat = clean(m.categorie && m.categorie.intitule)
    if (!cat) continue
    if (await patch('formations', m.id_module, { categorie: cat })) n++
  }
  log(`  formations (catégorie) : ${n}`)
}

// ── SESSIONS (formateur + lieu via détail action) ──
{
  const salles = await dendreo('salles_de_formation') || []
  const salleMap = new Map(salles.map((s) => [String(s.id_salle_de_formation), s]))
  const formateurs = await sbGetAll(`/formateurs?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
  const formByDid = new Map(formateurs.map((f) => [String(f.dendreo_id), f.id]))
  const sessions = await sbGetAll(`/sessions?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
  let withFormateur = 0, withLieu = 0, failed = 0
  await pool(sessions, 5, async (s) => {
    const a = await dendreoAction(s.dendreo_id)
    if (!a) { failed++; return }
    const body = {}
    const fdid = (a.formateurs && a.formateurs[0] && a.formateurs[0].id_formateur) || null
    const fid = fdid ? formByDid.get(String(fdid)) : null
    if (fid) { body.formateur_id = fid; withFormateur++ }
    const salle = a.id_salle_de_formation ? salleMap.get(String(a.id_salle_de_formation)) : null
    if (salle) {
      if (clean(salle.intitule)) { body.lieu = clean(salle.intitule); withLieu++ }
      if (clean(salle.adresse)) body.adresse = clean(salle.adresse)
      if (clean(salle.code_postal)) body.code_postal = clean(salle.code_postal)
      if (clean(salle.ville)) body.ville = clean(salle.ville)
    }
    if (Object.keys(body).length) await patch('sessions', s.dendreo_id, body)
  })
  log(`  sessions : formateur=${withFormateur} · lieu=${withLieu} · actions en échec=${failed}`)
}

log(`\n${DRY ? 'DRY-RUN — rien écrit. Appliquer : node migration/dendreo-backfill.mjs --apply' : '✓ backfill terminé'}`)
