// Rejoue, en lecture seule, le PDF de toutes les conventions signées en ligne tel que le CRM le
// télécharge : la convention, son certificat de signature, puis l'annexe (le programme). Sans passer
// par la route : aucune ligne d'audit, aucun envoi. À lancer après toute retouche du gabarit de
// convention (lib/pdf/convention-pdf.tsx) ou du certificat joint (lib/convention-certificat-joint.ts).
// Contrôles : aucune erreur de rendu ; « Fait à …, le <jour réel> » et « Le <jour réel> » sous les
// signatures, jamais la date portée quand elle diffère (sans horodatage réel : aucune date) ; quand le
// certificat est joint, il se place juste avant l'annexe, une seule fois, porte le numéro de la
// convention et annonce le même nombre de pages que la convention ; sinon, la raison est attendue
// (convention modifiée depuis la signature sans le dire, archive altérée) ; l'exemplaire archivé,
// tel que la copie après signature l'envoie, reçoit son certificat au même endroit ; une convention
// non signée garde « Fait à …, le <date> ».
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
/** Texte page par page dans l'ordre de lecture : la mise en page mêle l'en-tête de l'annexe à sa colonne de droite. */
function textePagesOrdre(octets: Uint8Array): string[] {
  const f = path.join(TMP, 'y.pdf')
  fs.writeFileSync(f, octets)
  return execFileSync('pdftotext', [f, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\f')
}
const ANNEXE = /Annexe\s*[—–-]\s*Programme de formation/
const CERTIFICAT = /Certificat de signature électronique/
/** Page du certificat et page de l'annexe dans un PDF joint, comparées à l'annexe de la convention seule. */
function placement(numero: string, convention: Uint8Array, jointPdf: Uint8Array): string[] {
  const erreurs: string[] = []
  const annexe = textePagesOrdre(convention).findIndex((t, i) => i > 0 && ANNEXE.test(t.replace(/\s+/g, ' ')))
  const textes = textePagesOrdre(jointPdf)
  const certificats = textes.map((t, i) => (CERTIFICAT.test(t) ? i : -1)).filter((i) => i >= 0)
  if (certificats.length !== 1) erreurs.push(`${numero} : ${certificats.length} page(s) de certificat`)
  const k = certificats[0] ?? -1
  if (annexe < 1) erreurs.push(`${numero} : annexe introuvable dans la convention`)
  else {
    if (k !== annexe) erreurs.push(`${numero} : certificat en page ${k + 1}, l'annexe commence page ${annexe + 1}`)
    if (!ANNEXE.test((textes[k + 1] || '').replace(/\s+/g, ' '))) erreurs.push(`${numero} : la page qui suit le certificat n'est pas l'annexe`)
  }
  return erreurs
}
const MOIS = '(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)'
const FAIT_DATE = new RegExp(`Fait à [^\\n]*, le \\d{1,2}(er)? ${MOIS} \\d{4}`)
const RAISONS_ATTENDUES = new Set(['modifiee', 'archive_alteree'])

;(async () => {
  const anomalies: string[] = []
  const sansCertificat: Record<string, string[]> = {}
  let avecCertificat = 0
  let exemplairesControles = 0
  const exemplairesAnciens: string[] = []
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
        anomalies.push(...placement(c.numero, convention, joint.pdf))
        const certif = textePages(joint.pdf).find((p) => CERTIFICAT.test(p)) || ''
        if (!certif.includes(String(c.numero))) anomalies.push(`${c.numero} : le certificat ne porte pas le numéro`)
        // Pages annoncées par le certificat (celles de l'exemplaire archivé, quand il existe)
        const annonce = ((certif.match(/Pages du document[^\n]*\n([^\n]*)/) || [])[1] || '').match(/(\d+)\s+Signée/)
        if (annonce && Number(annonce[1]) !== pagesConvention) anomalies.push(`${c.numero} : le certificat annonce ${annonce[1]} pages, la convention en a ${pagesConvention}`)
        if (SORTIE) fs.writeFileSync(path.join(SORTIE, `convention-${c.numero}.pdf`), joint.pdf)
        avecCertificat++

        // L'exemplaire archivé, tel que la copie après signature l'envoie avec son certificat
        const { data: preuve } = await sb.from('conventions').select('signature_document_path').eq('id', c.id).maybeSingle()
        if (preuve?.signature_document_path) {
          const { data: fichier } = await sb.storage.from('documents').download(preuve.signature_document_path)
          if (fichier) {
            const fige = new Uint8Array(await fichier.arrayBuffer())
            const jointFige = await joindreCertificatSignature(sb, ORG, c.id, fige)
            if (jointFige.ok) {
              const erreurs = placement(c.numero, fige, jointFige.pdf)
              // Un exemplaire figé avant l'annexe actuelle (02/10/2026) garde son certificat à la fin
              if (erreurs.some((e) => e.includes('annexe introuvable'))) exemplairesAnciens.push(c.numero)
              else anomalies.push(...erreurs.map((e) => `${e} (exemplaire archivé)`))
              exemplairesControles++
            }
          }
        }
      } catch (e: any) { anomalies.push(`${c.numero} : erreur ${String(e?.message || e).slice(0, 140)}`) }
    }

    for (const c of nonSignees || []) {
      try {
        const loaded = await loadConventionForPdf(sb, c.id)
        const convention = new Uint8Array(await renderToBuffer(createElement(ConventionPDF, { convention: loaded.convention, org: loaded.org })))
        if (!FAIT_DATE.test(textePages(convention).join('\n'))) anomalies.push(`${c.numero} (non signée) : la date d'émission a disparu de « Fait à »`)
      } catch (e: any) { anomalies.push(`${c.numero} (non signée) : erreur ${String(e?.message || e).slice(0, 140)}`) }
    }

    console.log(`${signees.length} conventions signées en ligne · ${avecCertificat} avec certificat juste avant l'annexe · ${exemplairesControles} exemplaires archivés contrôlés · ${(nonSignees || []).length} non signées contrôlées`)
    for (const [raison, numeros] of Object.entries(sansCertificat)) console.log(`sans certificat (${raison}) : ${numeros.length} · ${numeros.join(', ')}`)
    if (exemplairesAnciens.length) console.log(`exemplaires archivés sans l'annexe actuelle (certificat à la fin) : ${exemplairesAnciens.length} · ${exemplairesAnciens.join(', ')}`)
    console.log(anomalies.length ? `ANOMALIES :\n  ${anomalies.join('\n  ')}` : 'Aucune anomalie : jour réel de signature imprimé, jamais la date portée, certificat juste avant l\'annexe quand il peut suivre.')
    process.exitCode = anomalies.length ? 1 : 0
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true })
  }
})().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e); process.exit(1) })
