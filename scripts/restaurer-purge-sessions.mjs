#!/usr/bin/env node
/**
 * Restauration de la purge du 18/08/2026 — décision : des sessions réelles
 * ont été emportées, on remet tout.
 *
 * Source : backups/purge-sessions-2026-08-18.json (lignes complètes, ids
 * d'origine conservés — les FK retombent d'elles-mêmes). Les sessions sont
 * réinsérées d'abord, puis les satellites dans l'ordre des dépendances
 * (inscriptions avant émargements, qcm_sessions avant qcm_reponses, la
 * convention avant ses avenants et son journal de signature…).
 * Idempotent : les lignes déjà présentes sont ignorées (conflit sur id).
 *
 * USAGE : node scripts/restaurer-purge-sessions.mjs backups/purge-sessions-2026-08-18.json
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'

config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const chemin = process.argv[2] || 'backups/purge-sessions-2026-08-18.json'
const sauvegarde = JSON.parse(readFileSync(chemin, 'utf8'))

// Ordre de réinsertion : parents avant enfants. Le dossier de formation passe
// avant les incidents et les conventions qui le référencent (dossier_id) ;
// la convention avant ses avenants et son journal de signature
// (convention_id), puis avant les documents et les formations de lead.
const ORDRE = [
  'session_formations', 'inscriptions', 'recueils_besoin', 'emargement_feuilles',
  'emargements', 'qcm_sessions', 'qcm_reponses', 'evaluations_satisfaction',
  'evaluations_acquis', 'evaluations_apprenant', 'dossiers_formation', 'incidents',
  'conventions', 'convention_avenants', 'convention_signature_evenements',
  'contrats_formateur', 'documents', 'certificat_signatures',
  'taches_formateur', 'pointages_formateur', 'demandes_changement_participants',
  'lead_formations',
]

async function inserer(table, lignes) {
  let ok = 0, ko = 0
  for (let i = 0; i < lignes.length; i += 100) {
    const tranche = lignes.slice(i, i + 100)
    const { error } = await supabase.from(table).upsert(tranche, { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      // repli ligne à ligne pour ne pas perdre une tranche entière sur une seule ligne fautive
      for (const l of tranche) {
        const { error: e } = await supabase.from(table).upsert(l, { onConflict: 'id', ignoreDuplicates: true })
        if (e) { ko++; if (ko <= 3) console.error(`  !! ${table}: ${e.message.slice(0, 90)}`) }
        else ok++
      }
    } else ok += tranche.length
  }
  return { ok, ko }
}

console.log(`Sauvegarde du ${sauvegarde.date} — ${sauvegarde.sessions_completes.length} sessions, ${Object.keys(sauvegarde.tables).length} tables satellites`)

const rs = await inserer('sessions', sauvegarde.sessions_completes)
console.log(`sessions : ${rs.ok} restaurées${rs.ko ? `, ${rs.ko} en échec` : ''}`)

for (const table of ORDRE) {
  const lignes = sauvegarde.tables[table]
  if (!lignes?.length) continue
  const r = await inserer(table, lignes)
  console.log(`${table.padEnd(36)} ${r.ok} restaurées${r.ko ? `, ${r.ko} EN ÉCHEC` : ''}`)
}
// Tables de la sauvegarde hors ORDRE (filet)
for (const [table, lignes] of Object.entries(sauvegarde.tables)) {
  if (ORDRE.includes(table) || !lignes?.length) continue
  const r = await inserer(table, lignes)
  console.log(`${table.padEnd(36)} ${r.ok} restaurées${r.ko ? `, ${r.ko} EN ÉCHEC` : ''} (hors ordre)`)
}
console.log('\nRestauration terminée.')
