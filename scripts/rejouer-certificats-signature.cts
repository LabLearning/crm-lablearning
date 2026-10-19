// Rejoue le certificat de signature de toutes les conventions signées en ligne, en lecture seule :
// sans passer par la route, donc sans ligne d'audit ni envoi. À lancer après toute retouche du
// certificat (lib/certificat-signature-convention.ts, lib/pdf/certificat-signature-convention-pdf.tsx).
// Contrôles : une seule page, aucune erreur de rendu, horodatage égal à la colonne
// signature_client_signed_at. Les PDF sont déposés dans le dossier passé en argument, s'il y en a un.
//   npx tsx scripts/rejouer-certificats-signature.cts [dossier]
// Script CommonJS : la police du PDF ne s'enregistre pas autrement.
const fs = require('node:fs')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')
const { renderToBuffer } = require('@react-pdf/renderer')
const { createElement } = require('react')
const { PDFDocument } = require('pdf-lib')
const { construirePreuveSignatureConvention } = require('../lib/certificat-signature-convention')
const { CertificatSignatureConventionPDF } = require('../lib/pdf/certificat-signature-convention-pdf')

const env: Record<string, string> = {}
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ORG = process.env.ORG_ID || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const SORTIE = process.argv[2] || null
if (SORTIE) fs.mkdirSync(SORTIE, { recursive: true })

;(async () => {
  const { data: convs, error } = await sb.from('conventions')
    .select('id, numero, signature_client_signed_at')
    .eq('organization_id', ORG).in('status', ['signee_client', 'signee_complete'])
    .not('signature_client_signature_data', 'is', null).order('numero')
  if (error) throw error
  const anomalies: string[] = []
  let rendus = 0
  for (const c of convs || []) {
    const d = await construirePreuveSignatureConvention(sb, ORG, c.id)
    if (!d.ok) { anomalies.push(`${c.numero} : refusé (${d.status} ${d.error})`); continue }
    try {
      const buffer = await renderToBuffer(createElement(CertificatSignatureConventionPDF, { preuve: d.preuve, org: d.org }))
      const pages = (await PDFDocument.load(buffer)).getPageCount()
      if (pages !== 1) anomalies.push(`${c.numero} : ${pages} pages`)
      const colonne = c.signature_client_signed_at ? new Date(c.signature_client_signed_at).toISOString() : null
      if (colonne && d.preuve.signature.horodatage !== colonne) anomalies.push(`${c.numero} : horodatage ${d.preuve.signature.horodatage} ≠ colonne ${colonne}`)
      if (SORTIE) fs.writeFileSync(path.join(SORTIE, `certificat-${c.numero}.pdf`), buffer)
      rendus++
    } catch (e: any) { anomalies.push(`${c.numero} : erreur de rendu ${String(e?.message || e).slice(0, 120)}`) }
  }
  console.log(`${(convs || []).length} conventions signées en ligne · ${rendus} certificats rendus`)
  console.log(anomalies.length ? `ANOMALIES :\n  ${anomalies.join('\n  ')}` : 'Aucune anomalie : une page chacun, horodatage conforme.')
  process.exit(anomalies.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
