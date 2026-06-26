#!/usr/bin/env node
/**
 * Reprise complète Dendreo (reste) :
 *   évaluations → evaluations_apprenant · salles → salles_formation
 *   règlements → paiements · sources/étapes/catégories/admins → dendreo_reference
 *   node migration/dendreo-extras.mjs [--apply]   (prérequis : migration 053)
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
const num = (v) => { const n = Number(v); return isNaN(n) ? null : n }
const day = (s) => (s ? String(s).slice(0, 10) : null)

async function dendreo(resource) {
  const r = await fetch(`${DBASE}/${resource}.php?key=${DKEY}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) return []
  const d = await r.json(); return Array.isArray(d) ? d : []
}
async function sbGetAll(path) {
  const all = []; const page = 1000
  for (let from = 0; ; from += page) {
    const r = await fetch(`${SBASE}/rest/v1${path}`, { headers: { ...sbH, Range: `${from}-${from + page - 1}` } })
    if (!r.ok) { if (DRY) { console.warn(`  ⚠ ${path} → ${r.status} (migration 053 ?)`); return [] } throw new Error(`GET ${path} → ${r.status}`) }
    const rows = await r.json(); all.push(...rows)
    if (rows.length < page) break
  }
  return all
}
async function insert(table, rows) {
  if (DRY || !rows.length) return
  for (let i = 0; i < rows.length; i += 100) {
    const r = await fetch(`${SBASE}/rest/v1/${table}`, { method: 'POST', headers: { ...sbH, Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 100)) })
    if (!r.ok) throw new Error(`POST ${table} → ${r.status} ${(await r.text()).slice(0, 500)}`)
  }
}

log(`\n${DRY ? '🔍 DRY-RUN' : '🚀 APPLY'} — Dendreo extras`)

const sessions = await sbGetAll(`/sessions?organization_id=eq.${ORG}&select=id,dendreo_id,formation_id&dendreo_id=not.is.null`)
const sessByAction = new Map(sessions.map((s) => [String(s.dendreo_id), s]))
const apprenants = await sbGetAll(`/apprenants?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
const apprByDid = new Map(apprenants.map((a) => [String(a.dendreo_id), a.id]))
const formateurs = await sbGetAll(`/formateurs?organization_id=eq.${ORG}&select=id,dendreo_id,nom,prenom&dendreo_id=not.is.null`)
const formByDid = new Map(formateurs.map((f) => [String(f.dendreo_id), `${f.prenom || ''} ${f.nom || ''}`.trim()]))

// ── ÉVALUATIONS → evaluations_apprenant ──
{
  const evals = await dendreo('evaluations')
  const existing = await sbGetAll(`/evaluations_apprenant?organization_id=eq.${ORG}&select=dendreo_id&dendreo_id=not.is.null`)
  const done = new Set(existing.map((e) => String(e.dendreo_id)))
  const rows = []
  for (const e of evals) {
    const sess = sessByAction.get(String(e.id_action_de_formation))
    const apprId = apprByDid.get(String(e.id_participant))
    for (const r of (Array.isArray(e.evaluations) ? e.evaluations : [])) {
      const did = `${e.id_lmp}-${r.evaluation_set_id || r.id_evaluation}`
      if (done.has(did)) continue
      done.add(did)
      const evName = r.evaluator_type && /Formateur/.test(r.evaluator_type) ? formByDid.get(String(r.evaluator_id)) : null
      rows.push({
        organization_id: ORG, dendreo_id: did,
        session_id: sess?.id || null, apprenant_id: apprId || null, formation_id: sess?.formation_id || null,
        intitule: clean(r.evaluation_name), note: num(r.note), note_max: num(r.amplitude_notation),
        appreciation: clean(r.appreciation), evaluateur: evName || null,
        validated: String(r.validated) === '1', date_evaluation: clean(r.created_at),
      })
    }
  }
  log(`  évaluations: lignes source=${evals.length} · résultats à créer=${rows.length} (liés apprenant=${rows.filter((r) => r.apprenant_id).length})`)
  await insert('evaluations_apprenant', rows.filter((r) => r.apprenant_id))
}

// ── SALLES → salles_formation ──
{
  const salles = await dendreo('salles_de_formation')
  const existing = await sbGetAll(`/salles_formation?organization_id=eq.${ORG}&select=dendreo_id&dendreo_id=not.is.null`)
  const done = new Set(existing.map((s) => String(s.dendreo_id)))
  const rows = []
  for (const s of salles) {
    const did = String(s.id_salle_de_formation)
    if (done.has(did) || !clean(s.intitule)) continue
    done.add(did)
    rows.push({
      organization_id: ORG, dendreo_id: did, intitule: clean(s.intitule),
      adresse: clean(s.adresse), code_postal: clean(s.code_postal), ville: clean(s.ville),
      capacite_max: num(s.capacite_max), telephone: clean(s.telephone), email: clean(s.email),
      acces_handicap: s.acces_handicapes === '1' || s.acces_handicapes === 1 || s.acces_handicapes === true,
      lien_google_maps: clean(s.lien_google_maps), elearning: s.elearning === '1' || s.elearning === 1,
    })
  }
  log(`  salles à créer=${rows.length}/${salles.length}`)
  await insert('salles_formation', rows)
}

// ── RÈGLEMENTS → paiements ──
{
  const regls = await dendreo('reglements')
  const factures = await sbGetAll(`/factures?organization_id=eq.${ORG}&select=id,dendreo_id&dendreo_id=not.is.null`)
  const facByDid = new Map(factures.map((f) => [String(f.dendreo_id), f.id]))
  const existingPaie = await sbGetAll(`/paiements?organization_id=eq.${ORG}&select=facture_id,reference,montant`)
  const seen = new Set(existingPaie.map((p) => `${p.facture_id}|${p.montant}`))
  const rows = []
  for (const r of regls) {
    const facId = facByDid.get(String(r.facture_id))
    if (!facId) continue
    const key = `${facId}|${num(r.amount)}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      organization_id: ORG, facture_id: facId, montant: num(r.amount),
      mode: clean(r.method), date_paiement: day(r.date), reference: clean(r.reference),
      payeur_type: clean(r.emetteur_type), notes: '[Dendreo]',
    })
  }
  log(`  règlements → paiements à créer=${rows.length}/${regls.length}`)
  await insert('paiements', rows)
}

// ── RÉFÉRENTIELS → dendreo_reference (zéro perte) ──
{
  const idOf = (o) => o.id || Object.entries(o).find(([k]) => /^id_/.test(k) && !/^id_(add|edit|delete)$/.test(k))?.[1]
  const labelOf = (o) => clean(o.nom_complet) || clean(o.raison_sociale) || clean(o.intitule) || clean(o.nom) || clean(o.libelle) || clean(o.label) || clean(o.titre)
  const refs = [['source', 'sources'], ['etape', 'etapes'], ['categorie_module', 'categories_module'], ['categorie_produit', 'categories_produit'], ['administrateur', 'administrateurs']]
  const existing = await sbGetAll(`/dendreo_reference?organization_id=eq.${ORG}&select=ref_type,dendreo_id`)
  const done = new Set(existing.map((x) => `${x.ref_type}|${x.dendreo_id}`))
  let total = 0
  for (const [type, res] of refs) {
    const items = await dendreo(res)
    const rows = []
    for (const o of items) {
      const did = idOf(o); if (did == null) continue
      const key = `${type}|${did}`
      if (done.has(key)) continue
      done.add(key)
      rows.push({ organization_id: ORG, ref_type: type, dendreo_id: String(did), label: labelOf(o), data: o })
    }
    if (rows.length) { await insert('dendreo_reference', rows); total += rows.length }
    log(`    ${type}: ${rows.length}`)
  }
  log(`  référentiels à créer=${total}`)
}

log(`\n${DRY ? 'DRY-RUN — rien écrit. Appliquer (après migration 053) : node migration/dendreo-extras.mjs --apply' : '✓ extras importés'}`)
