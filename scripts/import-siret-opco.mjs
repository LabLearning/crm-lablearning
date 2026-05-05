import { createClient } from '@supabase/supabase-js'
import { createReadStream, readFileSync } from 'fs'
import { createInterface } from 'readline'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1]
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1]
const supabase = createClient(url, key)

// Map des noms OPCO du fichier vers nos codes
const NAME_TO_CODE = {
  'AKTO': 'AKTO',
  'OPCO EP': 'OPCO_EP',
  "L'OPCOMMERCE": 'OPCOMMERCE',
  'AFDAS': 'AFDAS',
  'ATLAS': 'ATLAS',
  'CONSTRUCTYS': 'CONSTRUCTYS',
  'OCAPIAT': 'OCAPIAT',
  'OPCO2I': 'OPCO_2I',
  'OPCO MOBILITES': 'OPCO_MOBILITES',
  'OPCO SANTE': 'OPCO_SANTE',
  'UNIFORMATION COHESION SOCIALE': 'UNIFORMATION',
}

const BATCH_SIZE = 5000
const FILE = '/tmp/siret-opco.csv'

const rl = createInterface({ input: createReadStream(FILE), crlfDelay: Infinity })

let isFirstLine = true
let total = 0
let imported = 0
let skipped = 0
let errors = 0
let batch = []
const startTime = Date.now()

async function flushBatch() {
  if (batch.length === 0) return
  const { error } = await supabase.from('siret_opco').upsert(batch, { onConflict: 'siret' })
  if (error) { errors += batch.length; console.error(`Batch error: ${error.message}`) }
  else imported += batch.length
  batch = []

  const elapsed = (Date.now() - startTime) / 1000
  const rate = imported / elapsed
  const eta = (3500000 - total) / rate
  process.stdout.write(`\r  ${imported.toLocaleString()} imported / ${total.toLocaleString()} read | ${rate.toFixed(0)} rows/s | ETA ${(eta/60).toFixed(1)}min | skipped=${skipped} errors=${errors}    `)
}

console.log('Importing SIRET-OPCO...')
for await (const line of rl) {
  if (isFirstLine) { isFirstLine = false; continue }
  total++
  // SIRET|IDCC|OPCO_PROPRIETAIRE|OPCO_GESTION
  const parts = line.split('|')
  if (parts.length < 3) { skipped++; continue }
  const siret = parts[0].trim()
  const idcc = parts[1].trim() || null
  const opcoName = parts[2].trim()
  if (!siret || !opcoName) { skipped++; continue }
  const opcoCode = NAME_TO_CODE[opcoName]
  if (!opcoCode) { skipped++; continue }

  batch.push({ siret, opco_code: opcoCode, idcc })
  if (batch.length >= BATCH_SIZE) await flushBatch()
}
await flushBatch()

console.log(`\n\nDone in ${((Date.now() - startTime)/1000/60).toFixed(1)}min`)
console.log(`  Total read: ${total.toLocaleString()}`)
console.log(`  Imported: ${imported.toLocaleString()}`)
console.log(`  Skipped: ${skipped.toLocaleString()}`)
console.log(`  Errors: ${errors.toLocaleString()}`)
