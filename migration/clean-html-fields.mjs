// Rattrapage one-shot : nettoie le HTML Dendreo stocké dans les champs
// des formations (70/72 polluées). Idempotent : ne touche que les champs
// qui contiennent encore des balises HTML.
// Usage :  node migration/clean-html-fields.mjs          (dry-run)
//          node migration/clean-html-fields.mjs --apply
import { config } from 'dotenv'
import { fieldItems, htmlFieldToText } from './html-clean.mjs'

config({ path: '.env.local' })
const SBASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
const headers = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json' }

const TEXT_FIELDS = [
  'public_vise', 'prerequis', 'methodes_pedagogiques', 'moyens_techniques',
  'modalites_evaluation', 'modalites_admission', 'accessibilite_handicap',
  'programme_detaille', 'competences_visees', 'sous_titre',
]
const hasHtml = (v) => typeof v === 'string' && /<[a-z][^>]*>/i.test(v)

async function main() {
  const res = await fetch(`${SBASE}/rest/v1/formations?select=id,reference,objectifs_pedagogiques,${TEXT_FIELDS.join(',')}`, { headers })
  const formations = await res.json()
  let updated = 0

  for (const f of formations) {
    const patch = {}

    for (const field of TEXT_FIELDS) {
      if (hasHtml(f[field])) patch[field] = htmlFieldToText(f[field])
    }

    const obj = f.objectifs_pedagogiques
    if (Array.isArray(obj) && obj.some((o) => hasHtml(String(o)))) {
      const cleaned = obj.flatMap((o) => fieldItems(String(o ?? '')))
      patch.objectifs_pedagogiques = cleaned.length ? cleaned : null
    } else if (hasHtml(obj)) {
      const cleaned = fieldItems(obj)
      patch.objectifs_pedagogiques = cleaned.length ? cleaned : null
    }

    if (Object.keys(patch).length === 0) continue
    console.log(`${f.reference}: ${Object.keys(patch).join(', ')}`)
    if (APPLY) {
      const r = await fetch(`${SBASE}/rest/v1/formations?id=eq.${f.id}`, {
        method: 'PATCH', headers, body: JSON.stringify(patch),
      })
      if (!r.ok) { console.error(`  ERREUR ${r.status}:`, await r.text()); continue }
    }
    updated++
  }
  console.log(`\n${APPLY ? 'Nettoyées' : 'À nettoyer (dry-run)'} : ${updated}/${formations.length}`)
}
main()
