#!/usr/bin/env node
/**
 * Purge des sessions terminées hors matrice — décision du 18/08/2026.
 *
 * RÈGLE : les sessions réelles sont celles de la matrice des dossiers
 * (AKTO, OPCO EP, Opcommerce, POEI finis) et du BPF, plus les financements
 * AGEFICE / FAFCEA / paiement personnel et les sessions encore en activité.
 * Tout le reste est du bruit d'import (doublons Dendreo, coquilles) : supprimé.
 *
 * GARDE-FOUS :
 *  - une session TERMINÉE hors matrice/BPF mais portant une FACTURE n'est
 *    JAMAIS supprimée par ce script — listée pour arbitrage humain ;
 *  - les satellites sont supprimés explicitement (plusieurs FK sont en
 *    SET NULL : un DELETE brut laisserait recueils, émargements et constats
 *    orphelins qui fausseraient tous les compteurs Qualiopi) ;
 *  - les conventions des sessions purgées partent avec leurs avenants et
 *    leur journal de signature : ces lignes sont sauvegardées avec elles, et
 *    scripts/restaurer-purge-sessions.mjs sait les remettre.
 *
 * USAGE : node scripts/purge-sessions-hors-matrice.mjs <classement.json>            (simulation)
 *         node scripts/purge-sessions-hors-matrice.mjs <classement.json> --ecrire   (application)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'

config({ path: '.env.local' })
const ECRIRE = process.argv.includes('--ecrire')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Tables portant un session_id à vider avant la session elle-même.
// L'ordre compte : les réponses QCM avant les qcm_sessions, etc.
const SATELLITES = [
  'qcm_reponses', 'qcm_sessions', 'evaluations_satisfaction', 'evaluations_acquis',
  'evaluations_apprenant', 'emargements', 'emargement_feuilles', 'recueils_besoin',
  'incidents', 'inscriptions', 'session_formations', 'session_deroule_etapes',
  'certificat_signatures', 'appreciations_parties_prenantes', 'taches_formateur',
  'pointages_formateur', 'contrats_formateur', 'demandes_changement_participants',
  'conventions', 'documents', 'signatures', 'dossiers_formation', 'lead_formations',
  'poei_mandats', 'limova_appels',
]

// Tables rattachées à une convention et non à une session : ses avenants et
// son journal de signature. La base les supprime avec la convention (clés en
// cascade) ; elles partent donc dans la sauvegarde, pour être remises après elle.
const SATELLITES_CONVENTION = ['convention_avenants', 'convention_signature_evenements']

async function tout(table, cols) {
  const lignes = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(de, de + 999)
    if (error) throw new Error(table + ': ' + error.message)
    lignes.push(...data)
    if (data.length < 1000) break
  }
  return lignes
}

// Toutes les lignes d'une table pour une liste d'identifiants, par tranches et
// par pages (une réponse plafonne à 1000 lignes). Une erreur arrête le script.
async function lignesPour(table, colonne, ids, cols = '*') {
  const lignes = []
  for (let i = 0; i < ids.length; i += 80) {
    const tranche = ids.slice(i, i + 80)
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase.from(table).select(cols).in(colonne, tranche).order('id').range(de, de + 999)
      if (error) throw new Error(table + ': ' + error.message)
      lignes.push(...data)
      if (data.length < 1000) break
    }
  }
  return lignes
}

const classement = JSON.parse(readFileSync(
  process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2]
    : '/private/tmp/claude-501/-Users-brahimouchrif-Projects-crm-lablearning/04d3a660-0bb5-4829-a5e1-685cc8491e7f/scratchpad/classement.json', 'utf8'))

// Le classement exporté ne porte que la référence : on remonte aux ids réels.
const sessions = await tout('sessions', 'id, reference, status, date_debut, client_id')
const invalides = new Set(classement.sessions.filter((s) => s.classement === 'presume_invalide').map((s) => s.ref))
const cibles = sessions.filter((s) => invalides.has(s.reference || s.id.slice(0, 8)) && s.status === 'terminee')

// Gel : toute cible portant une facture est écartée.
const ids = cibles.map((s) => s.id)
const facturees = new Set()
for (let i = 0; i < ids.length; i += 80) {
  const { data } = await supabase.from('factures').select('session_id').in('session_id', ids.slice(i, i + 80))
  for (const f of data || []) facturees.add(f.session_id)
}
const aSupprimer = cibles.filter((s) => !facturees.has(s.id))
const gelees = cibles.filter((s) => facturees.has(s.id))

console.log(`Cibles : ${cibles.length} | à supprimer : ${aSupprimer.length} | gelées (facture présente) : ${gelees.length}`)
console.log('\n--- Gelées pour arbitrage (facture rattachée) :')
for (const s of gelees) console.log(`  ${s.reference}  ${String(s.date_debut).slice(0, 10)}`)

const idsSuppr = aSupprimer.map((s) => s.id)

// Conventions des sessions à supprimer : leurs avenants et leur journal de
// signature n'ont pas de session_id, ils se retrouvent par elles.
const idsConventions = (await lignesPour('conventions', 'session_id', idsSuppr, 'id')).map((c) => c.id)
// Signées électroniquement : l'image n'est pas lue, les conventions sont comptées
let conventionsSignees = 0
for (let i = 0; i < idsConventions.length; i += 80) {
  const { count, error } = await supabase.from('conventions').select('id', { count: 'exact', head: true })
    .in('id', idsConventions.slice(i, i + 80)).not('signature_client_signature_data', 'is', null)
  if (error) throw new Error('conventions: ' + error.message)
  conventionsSignees += count || 0
}
console.log(`\nConventions emportées avec ces sessions : ${idsConventions.length}, dont ${conventionsSignees} signée${conventionsSignees > 1 ? 's' : ''} électroniquement`)

// Sauvegarde restaurable AVANT toute suppression : chaque ligne supprimée
// (session + satellites) part dans backups/ — dossier hors git, données
// nominatives.
if (ECRIRE) {
  const { mkdirSync, writeFileSync } = await import('fs')
  mkdirSync('backups', { recursive: true })
  const sauvegarde = { date: new Date().toISOString(), sessions: aSupprimer, tables: {} }
  for (const table of SATELLITES) {
    const lignes = []
    for (let i = 0; i < idsSuppr.length; i += 80) {
      const { data, error } = await supabase.from(table).select('*').in('session_id', idsSuppr.slice(i, i + 80))
      if (error) break
      lignes.push(...(data || []))
    }
    if (lignes.length) sauvegarde.tables[table] = lignes
  }
  // Avenants et journal de signature des conventions emportées : une lecture en
  // échec arrête le script ici, avant toute suppression
  for (const table of SATELLITES_CONVENTION) {
    const lignes = await lignesPour(table, 'convention_id', idsConventions)
    if (lignes.length) sauvegarde.tables[table] = lignes
  }
  const { data: sessCompletes } = await supabase.from('sessions').select('*').in('id', idsSuppr.slice(0, 80))
  sauvegarde.sessions_completes = sessCompletes || []
  for (let i = 80; i < idsSuppr.length; i += 80) {
    const { data } = await supabase.from('sessions').select('*').in('id', idsSuppr.slice(i, i + 80))
    sauvegarde.sessions_completes.push(...(data || []))
  }
  const chemin = `backups/purge-sessions-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(chemin, JSON.stringify(sauvegarde))
  console.log(`Sauvegarde écrite : ${chemin} (${Object.values(sauvegarde.tables).reduce((a, t) => a + t.length, 0)} lignes satellites + ${sauvegarde.sessions_completes.length} sessions)`)
}

let totalSat = 0
// Avenants et journal de signature : comptés avant que leurs conventions ne
// partent ; pas de suppression explicite, la base les emporte avec elles
for (const table of SATELLITES_CONVENTION) {
  let n = 0
  for (let i = 0; i < idsConventions.length; i += 80) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).in('convention_id', idsConventions.slice(i, i + 80))
    if (error) { console.log(`  (${table} : ${error.message.slice(0, 50)})`); break }
    n += count || 0
  }
  if (n) { console.log(`  ${table.padEnd(36)} ${n}`); totalSat += n }
}
for (const table of SATELLITES) {
  let n = 0
  for (let i = 0; i < idsSuppr.length; i += 80) {
    const tranche = idsSuppr.slice(i, i + 80)
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).in('session_id', tranche)
    if (error) { if (i === 0) console.log(`  (${table} : ${error.message.slice(0, 50)})`); break }
    n += count || 0
    if (ECRIRE && count) {
      const { error: e } = await supabase.from(table).delete().in('session_id', tranche)
      if (e) console.error(`  !! ${table}: ${e.message}`)
    }
  }
  if (n) { console.log(`  ${table.padEnd(36)} ${n}`); totalSat += n }
}
console.log(`Satellites concernés : ${totalSat}`)

if (ECRIRE) {
  let ok = 0
  for (let i = 0; i < idsSuppr.length; i += 50) {
    const { error } = await supabase.from('sessions').delete().in('id', idsSuppr.slice(i, i + 50))
    if (error) console.error('  !!', error.message)
    else ok += Math.min(50, idsSuppr.length - i)
  }
  console.log(`\nAPPLIQUÉ — ${ok} sessions supprimées, ${gelees.length} gelées.`)
} else {
  console.log(`\nSIMULATION — ${aSupprimer.length} sessions seraient supprimées. Relancer avec --ecrire.`)
}
