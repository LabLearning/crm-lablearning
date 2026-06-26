#!/usr/bin/env node
/**
 * Importe le programme détaillé Dendreo (module.description, HTML) →
 * formations.programme_detaille (texte lisible). Idempotent par dendreo_id.
 *   node migration/dendreo-programmes.mjs [--apply]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
const DRY = !process.argv.includes('--apply')
const SBASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DBASE = process.env.DENDREO_API_BASE || `https://pro.dendreo.com/${process.env.DENDREO_SLUG || 'lab_learning'}/api`
const DKEY = process.env.DENDREO_API_KEY
const ORG = process.env.DENDREO_DEFAULT_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const sbH = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json' }

// HTML → texte lisible
function htmlToText(html) {
  if (!html) return null
  let t = String(html)
  t = t.replace(/<\s*li[^>]*>/gi, '\n• ')
  t = t.replace(/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/gi, '\n')
  t = t.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  t = t.replace(/<[^>]+>/g, '')
  t = t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&eacute;/gi, 'é')
       .replace(/&egrave;/gi, 'è').replace(/&agrave;/gi, 'à').replace(/&ccedil;/gi, 'ç')
       .replace(/&rsquo;/gi, '’').replace(/&[a-z]+;/gi, ' ')
  t = t.split('\n').map((l) => l.trim()).filter((l) => l && l !== '•').join('\n')
  t = t.replace(/\n{3,}/g, '\n\n').trim()
  return t || null
}

async function dendreo(res) {
  const r = await fetch(`${DBASE}/${res}.php?key=${DKEY}`, { headers: { Accept: 'application/json' } })
  return r.ok ? r.json() : []
}
async function patch(did, body) {
  if (DRY) return true
  const r = await fetch(`${SBASE}/rest/v1/formations?organization_id=eq.${ORG}&dendreo_id=eq.${did}`, { method: 'PATCH', headers: { ...sbH, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  return r.ok
}

const modules = await dendreo('modules')
let n = 0
for (const m of modules) {
  const txt = htmlToText(m.description)
  if (!txt) continue
  if (await patch(String(m.id_module), { programme_detaille: txt })) n++
}
console.log(`${DRY ? 'DRY-RUN' : 'APPLY'} — programmes détaillés ${DRY ? 'à importer' : 'importés'} : ${n}/${modules.length}`)
if (DRY) {
  const ex = htmlToText(modules.find((m) => m.description)?.description)
  console.log('\n--- exemple converti ---\n' + (ex || '').slice(0, 500))
}
