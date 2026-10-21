// Rejoue, en lecture seule, le plan de développement de compétences (formulaire France Travail)
// de chaque candidat POEI, tel que la route /api/pdf/pdc/[id] le produit. À lancer après toute
// retouche de lib/poei-pdc.ts ou lib/pdf/fill-pdc.ts.
// Anomalies : erreur ; mot du tableau hors de sa case ; puce coupée ou omise (« … ») ; heures du
// tableau différentes de la durée annoncée ; dates de lignes qui reculent ou sortent de la période.
// À compléter dans le CRM : employeur, tuteur, fonction, date d'embauche, civilité manquants ;
// plan non produit parce que la formation rattachée est plus courte que la POEI.
//   npx tsx scripts/rejouer-plans-poei.mts [dossier hors dépôt] [numéro de POEI…]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { donneesPlanDeveloppement } from '../lib/poei-pdc'
import { fillPdc } from '../lib/pdf/fill-pdc'

const env: Record<string, string> = {}
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ORG = process.env.ORG_ID || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const FILTRE = process.argv.slice(3)

// Dossier de sortie hors du dépôt : les plans portent noms, téléphones et e-mails
const reel = (p: string): string => {
  let x = path.resolve(p)
  const suite: string[] = []
  while (!fs.existsSync(x)) { suite.unshift(path.basename(x)); x = path.dirname(x) }
  return path.join(fs.realpathSync.native(x), ...suite).toLowerCase()
}
const SORTIE = process.argv[2] ? path.resolve(process.argv[2]) : null
if (SORTIE && (reel(SORTIE) + path.sep).startsWith(reel(process.cwd()) + path.sep)) {
  console.error('Dossier de sortie refusé : il est dans le dépôt (les plans portent des données personnelles).')
  process.exit(2)
}
if (SORTIE) fs.mkdirSync(SORTIE, { recursive: true, mode: 0o700 })
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pdc-'))
const modele = fs.readFileSync('public/templates/pdc-france-travail.pdf')

// Cases du tableau (points depuis le haut de la page), comme dans lib/pdf/fill-pdc.ts
const LIGNES = [[494.5, 554.25], [554.25, 613.75], [613.75, 673.5], [673.5, 733.25], [733.25, 792.75]]
const COLONNES = [[119.75, 307.5], [307.5, 388.5], [388.5, 576.25]]
const enHeures = (t: string) => { const m = t.match(/(\d+)\s*h(?:\s*(\d{2}))?/); return m ? Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0) : 0 }
const iso = (jjmmaaaa: string) => jjmmaaaa.split('/').reverse().join('-')

const anomalies: string[] = []
const aCompleter: Record<string, string[]> = {}
const noter = (quoi: string, qui: string) => { (aCompleter[quoi] ||= []).push(qui) }
let rendus = 0
try {
  const { data: poeis, error } = await sb.from('poei').select('id, numero').eq('organization_id', ORG).order('numero')
  if (error) throw error
  for (const p of poeis || []) {
    if (FILTRE.length && !FILTRE.includes(p.numero)) continue
    const { data: cands, error: e2 } = await sb.from('poei_candidats').select('id, apprenant:apprenants(nom, prenom)').eq('poei_id', p.id).eq('organization_id', ORG)
    if (e2) throw e2
    for (const c of cands || []) {
      const qui = `${p.numero} ${(c as any).apprenant?.prenom || ''} ${(c as any).apprenant?.nom || ''}`.trim()
      try {
        const pdc = await donneesPlanDeveloppement(sb, ORG, c.id)
        if (!pdc) { anomalies.push(`${qui} : candidat introuvable`); continue }
        const court = pdc.alertes.find((a) => a.code === 'programme_court')
        if (court) { noter(`plan non produit : ${court.message}`, qui); continue }
        for (const a of pdc.alertes) {
          if (a.code === 'planning_incomplet') noter('planning incomplet ou hors des dates de la POEI (dates du tableau tirées du calendrier)', qui)
          else anomalies.push(`${qui} : ${a.message}`)
        }
        const d = pdc.data
        if (!d.employeur) noter('employeur et responsable (aucun contact sur la fiche client)', qui)
        if (!d.tuteur) noter('tuteur', qui)
        if (d.tuteur && !d.fonction) noter('fonction du tuteur (poste du contact)', qui)
        if (d.tuteur && !d.tuteurCiv) noter('civilité du tuteur (aucune case cochée)', qui)
        if (!d.embauche) noter("date d'embauche prévue", qui)
        if (!d.stagiaireCiv) noter('civilité du stagiaire (aucune case cochée)', qui)
        if (!d.hebdo) noter('durée hebdomadaire (dates ou durée de la POEI)', qui)

        // Cohérence du tableau
        const rows = d.rows || []
        const somme = rows.reduce((s, r) => s + enHeures(r.heures || ''), 0)
        const total = enHeures((d.total || '').replace(' heures', ' h'))
        if (total && Math.abs(somme - total) > 0.5) anomalies.push(`${qui} : le tableau compte ${somme} h pour ${total} h annoncées`)
        const dates = rows.map((r) => iso(r.date || '')).filter(Boolean)
        if (dates.some((x, i) => i && x < dates[i - 1])) anomalies.push(`${qui} : les dates des lignes reculent (${dates.join(', ')})`)
        if (d.debut && dates[0] && dates[0] < iso(d.debut)) anomalies.push(`${qui} : première ligne avant le début`)

        const pdf = await fillPdc(modele, d)
        const f = path.join(TMP, 'x.pdf')
        fs.writeFileSync(f, pdf)
        // Position de chaque mot du tableau : dans sa colonne, dans sa ligne ; aucune puce coupée
        const html = execFileSync('pdftotext', ['-bbox', f, '-'], { encoding: 'utf8' })
        let coupures = 0
        let omissions = 0
        let precedent = { mot: '', y: -1 }
        for (const m of html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)) {
          const [x0, y0, x1, y1] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
          if (y0 < 494.5 || x0 < 119.75) continue
          // « • … » seul sur sa ligne : des puces omises ; « … » en fin de puce : une puce raccourcie
          if (m[5] === '…') { if (precedent.mot === '•' && Math.abs(precedent.y - y0) < 0.6) omissions++; else coupures++ }
          precedent = { mot: m[5], y: y0 }
          const ligne = LIGNES.findIndex(([h, b]) => y0 >= h - 0.5 && y0 < b)
          const colonne = COLONNES.findIndex(([g, dr]) => x0 >= g && x0 < dr)
          if (ligne < 0 || colonne < 0) { anomalies.push(`${qui} : « ${m[5]} » hors du tableau`); continue }
          if (x1 > COLONNES[colonne][1] + 0.5) anomalies.push(`${qui} : « ${m[5]} » déborde de sa colonne (ligne ${ligne + 1})`)
          if (y1 > LIGNES[ligne][1] + 0.5) anomalies.push(`${qui} : « ${m[5]} » déborde de sa ligne ${ligne + 1}`)
        }
        if (omissions) anomalies.push(`${qui} : des puces omises (« • … ») sur ${omissions} case(s)`)
        if (coupures) noter('à relire : puces raccourcies par « … » (phrases trop longues pour la case)', qui)
        if (SORTIE) fs.writeFileSync(path.join(SORTIE, `${p.numero}-${pdc.fichier}`), pdf, { mode: 0o600 })
        rendus++
      } catch (e: any) { anomalies.push(`${qui} : erreur ${String(e?.message || e).slice(0, 140)}`) }
    }
  }
  console.log(`${rendus} plans rendus`)
  const uniques = [...new Set(anomalies)]
  console.log(uniques.length ? `ANOMALIES :\n  ${uniques.join('\n  ')}` : 'Aucune anomalie : tableau cohérent, chaque mot dans sa case.')
  const manques = Object.entries(aCompleter)
  if (manques.length) {
    console.log('À COMPLÉTER DANS LE CRM :')
    for (const [quoi, qui] of manques) console.log(`  ${quoi} : ${qui.length} · ${qui.slice(0, 6).join(', ')}${qui.length > 6 ? '…' : ''}`)
  }
  process.exitCode = uniques.length ? 1 : 0
} finally {
  fs.rmSync(TMP, { recursive: true, force: true })
}
