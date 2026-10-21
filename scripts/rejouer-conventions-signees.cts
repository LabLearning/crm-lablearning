// Rejoue, en lecture seule, le PDF de toutes les conventions signées en ligne tel que le CRM le
// télécharge : la convention, puis son certificat de signature en dernière page. Sans passer par la
// route : aucune ligne d'audit, aucun envoi. À lancer après toute retouche du gabarit de convention
// (lib/pdf/convention-pdf.tsx) ou du certificat joint (lib/convention-certificat-joint.ts).
// Contrôles : aucune erreur de rendu ; « Fait à …, le <jour réel> » et « Le <jour réel> » sous les
// signatures, jamais la date portée quand elle diffère (sans horodatage réel : aucune date) ; quand le
// certificat est joint, il est la dernière page, porte le numéro de la convention et annonce le même
// nombre de pages que la convention ; sinon, la raison est attendue (convention modifiée depuis la
// signature sans le dire, archive altérée) ; une convention non signée garde « Fait à …, le <date> ».
//   npx tsx scripts/rejouer-conventions-signees.cts [dossier]
// Le dossier, facultatif, reçoit les PDF : il doit être hors du dépôt (ils portent IP et signatures).
// Script CommonJS : la police du PDF ne s'enregistre pas autrement. Il lit le texte avec pdftotext.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createClient } = require('@supabase/supabase-js')
const { renderToBuffer } = require('@react-pdf/renderer')
const { createElement } = require('react')
const { PDFDocument } = require('pdf-lib')
const { loadConventionForPdf } = require('../lib/pdf/convention-data')
const { ConventionPDF } = require('../lib/pdf/convention-pdf')
const { joindreCertificatSignature } = require('../lib/convention-certificat-joint')

const env: Record<string, string> = {}
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ORG = process.env.ORG_ID || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const SORTIE = process.argv[2] ? path.resolve(process.argv[2]) : null
if (SORTIE && (SORTIE + path.sep).startsWith(path.resolve('.') + path.sep)) {
  console.error('Dossier de sortie refusé : il est dans le dépôt, et ces PDF portent les IP et les signatures des clients.')
  process.exit(2)
}
if (SORTIE) fs.mkdirSync(SORTIE, { recursive: true })
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-'))

/** Texte d'un PDF, page par page (pdftotext sépare les pages par un saut de page). */
function textePages(octets: Uint8Array): string[] {
  const f = path.join(TMP, 'x.pdf')
  fs.writeFileSync(f, octets)
  return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\f')
}
const MOIS = '(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)'
const FAIT_DATE = new RegExp(`Fait à [^\\n]*, le \\d{1,2}(er)? ${MOIS} \\d{4}`)
const RAISONS_ATTENDUES = new Set(['modifiee', 'archive_alteree'])

;(async () => {
  const anomalies: string[] = []
  const sansCertificat: Record<string, string[]> = {}
  let avecCertificat = 0
  try {
    const signees: any[] = []
    for (let f = 0; ; f += 500) {
      const { data, error } = await sb.from('conventions').select('id, numero, signature_client_signed_at, signature_client_date')
        .eq('organization_id', ORG).in('status', ['signee_client', 'signee_complete'])
        .not('signature_client_signature_data', 'is', null).order('numero').range(f, f + 499)
      if (error) throw error
      signees.push(...(data || [])); if ((data || []).length < 500) break
    }
    const { data: nonSignees, error: e2 } = await sb.from('conventions').select('id, numero')
      .eq('organization_id', ORG).in('status', ['brouillon', 'envoyee']).order('created_at', { ascending: false }).limit(6)
    if (e2) throw e2

    for (const c of signees) {
      try {
        const loaded = await loadConventionForPdf(sb, c.id)
        const convention = new Uint8Array(await renderToBuffer(createElement(ConventionPDF, { convention: loaded.convention, org: loaded.org })))
        const pagesConvention = (await PDFDocument.load(convention)).getPageCount()
        const texte = textePages(convention).join('\n')
        // Bloc des signatures : de « Fait à » jusqu'au pied de page, sans les lignes d'avenant
        const bloc = ((texte.match(/Fait à[\s\S]{0,1500}/) || [''])[0]).replace(/Avenant[^\n]*/g, '')
        // Jour réel (heure de Paris) attendu ; la date portée, lue en temps universel, ne doit jamais apparaître
        const paris = (o: any) => (d: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...o }).format(new Date(d))
        const court = paris({ day: '2-digit', month: '2-digit', year: 'numeric' })
        const long = (d: string) => paris({ day: 'numeric', month: 'long', year: 'numeric' })(d).replace(/^1 /, '1er ')
        const porteeCourt = c.signature_client_date ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(c.signature_client_date)) : null
        if (c.signature_client_signed_at) {
          if (!texte.includes(`, le ${long(c.signature_client_signed_at)}, en deux exemplaires originaux.`)) anomalies.push(`${c.numero} : « Fait à » sans le jour réel ${long(c.signature_client_signed_at)}`)
          if (!bloc.includes(`Le ${court(c.signature_client_signed_at)}`)) anomalies.push(`${c.numero} : jour réel absent sous la signature`)
          if (porteeCourt && porteeCourt !== court(c.signature_client_signed_at) && bloc.includes(porteeCourt)) anomalies.push(`${c.numero} : la date portée ${porteeCourt} est imprimée`)
        } else {
          if (!/Fait à [^\n,]+, en deux exemplaires originaux\./.test(texte)) anomalies.push(`${c.numero} : ligne « Fait à » inattendue`)
          if (/Le \d{2}\/\d{2}\/\d{4}/.test(bloc)) anomalies.push(`${c.numero} : date sous une signature sans horodatage réel`)
        }
        if (!/Signé électroniquement/.test(bloc)) anomalies.push(`${c.numero} : mention « Signé électroniquement » absente`)

        const joint = await joindreCertificatSignature(sb, ORG, c.id, convention)
        if (!joint.ok) {
          ;(sansCertificat[joint.raison] ||= []).push(c.numero)
          if (!RAISONS_ATTENDUES.has(joint.raison)) anomalies.push(`${c.numero} : certificat non joint (${joint.raison})`)
          if (SORTIE) fs.writeFileSync(path.join(SORTIE, `convention-${c.numero}-sans-certificat.pdf`), convention)
          continue
        }
        const pagesJoint = (await PDFDocument.load(joint.pdf)).getPageCount()
        if (pagesJoint !== pagesConvention + 1) anomalies.push(`${c.numero} : ${pagesJoint} pages au lieu de ${pagesConvention + 1}`)
        const derniere = textePages(joint.pdf).filter((p) => p.trim()).pop() || ''
        if (!/Certificat de signature électronique/.test(derniere)) anomalies.push(`${c.numero} : la dernière page n'est pas le certificat`)
        if (!derniere.includes(String(c.numero))) anomalies.push(`${c.numero} : le certificat ne porte pas le numéro`)
        // Pages annoncées par le certificat (celles de l'exemplaire archivé, quand il existe)
        const annonce = ((derniere.match(/Pages du document[^\n]*\n([^\n]*)/) || [])[1] || '').match(/(\d+)\s+Signée/)
        if (annonce && Number(annonce[1]) !== pagesConvention) anomalies.push(`${c.numero} : le certificat annonce ${annonce[1]} pages, la convention en a ${pagesConvention}`)
        if (SORTIE) fs.writeFileSync(path.join(SORTIE, `convention-${c.numero}.pdf`), joint.pdf)
        avecCertificat++
      } catch (e: any) { anomalies.push(`${c.numero} : erreur ${String(e?.message || e).slice(0, 140)}`) }
    }

    for (const c of nonSignees || []) {
      try {
        const loaded = await loadConventionForPdf(sb, c.id)
        const convention = new Uint8Array(await renderToBuffer(createElement(ConventionPDF, { convention: loaded.convention, org: loaded.org })))
        if (!FAIT_DATE.test(textePages(convention).join('\n'))) anomalies.push(`${c.numero} (non signée) : la date d'émission a disparu de « Fait à »`)
      } catch (e: any) { anomalies.push(`${c.numero} (non signée) : erreur ${String(e?.message || e).slice(0, 140)}`) }
    }

    console.log(`${signees.length} conventions signées en ligne · ${avecCertificat} avec certificat en dernière page · ${(nonSignees || []).length} non signées contrôlées`)
    for (const [raison, numeros] of Object.entries(sansCertificat)) console.log(`sans certificat (${raison}) : ${numeros.length} · ${numeros.join(', ')}`)
    console.log(anomalies.length ? `ANOMALIES :\n  ${anomalies.join('\n  ')}` : 'Aucune anomalie : jour réel de signature imprimé, jamais la date portée, certificat en dernière page quand il peut suivre.')
    process.exitCode = anomalies.length ? 1 : 0
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true })
  }
})().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e); process.exit(1) })
