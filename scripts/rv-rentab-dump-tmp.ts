import { readFileSync, writeFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] ||= l.slice(i + 1).trim()
}
const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const OUT = '/private/tmp/claude-501/-Users-brahimouchrif-Projects-crm-lablearning/04d3a660-0bb5-4829-a5e1-685cc8491e7f/scratchpad/raw/'
async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const sb: any = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const all = async (t: string, sel: string, org = true) => {
    const out: any[] = []
    for (let f = 0; ; f += 1000) {
      let q = sb.from(t).select(sel)
      if (org) q = q.eq('organization_id', ORG)
      const { data, error } = await q.order('id').range(f, f + 999)
      if (error) { console.error(t, error); break }
      out.push(...data); if (data.length < 1000) break
    }
    writeFileSync(OUT + t + '.json', JSON.stringify(out))
    console.log(t, out.length)
  }
  require('fs').mkdirSync(OUT, { recursive: true })
  await all('sessions', '*, formation:formation_id(intitule, duree_jours, is_poei, tarif_inter_ht, tarif_intra_ht), client:client_id(id, raison_sociale, nom_commercial, franchise_id, financeur_type, apporteur_id)')
  await all('factures', '*')
  await all('facture_lignes', '*', false)
  await all('contrats_formateur', '*')
  await all('factures_formateur', '*')
  await all('commissions_sessions', '*')
  await all('conventions', 'id, numero, session_id, client_id, status, montant_ht, montant_ttc')
  await all('dossiers_agefice', '*')
  await all('inscriptions', 'id, session_id, status, apprenant:apprenant_id(client_id)')
  await all('formateurs', 'id, prenom, nom, tarif_journalier, type_contrat')
  await all('franchises', '*')
  await all('poei', '*')
  await all('poei_interventions', '*')
  await all('clients', 'id, raison_sociale, nom_commercial, franchise_id, apporteur_id')
  await all('apporteurs_affaires', '*')
  await all('paiements', '*')
}
main().catch((e) => { console.error(e); process.exit(1) })
