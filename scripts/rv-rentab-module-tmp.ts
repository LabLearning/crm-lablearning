import { readFileSync, writeFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] ||= l.slice(i + 1).trim()
}
const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const OUT = '/private/tmp/claude-501/-Users-brahimouchrif-Projects-crm-lablearning/04d3a660-0bb5-4829-a5e1-685cc8491e7f/scratchpad/'
async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const sb: any = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  // bloquer toute écriture
  const origFrom = sb.from.bind(sb)
  sb.from = (t: string) => { const q = origFrom(t); for (const m of ['insert','update','upsert','delete']) q[m] = () => { throw new Error('WRITE BLOCKED ' + t) }; return q }
  const { rentabilitePeriode } = await import('../lib/rentabilite-data')
  const du = process.argv[2] || '2026-01-01', au = process.argv[3] || '2026-12-31'
  const r = await rentabilitePeriode(sb, ORG, du, au)
  writeFileSync(OUT + `module-${du}-${au}.json`, JSON.stringify(r, null, 1))
  console.log(r.meta, r.lignes.length)
}
main().catch((e) => { console.error(e); process.exit(1) })
