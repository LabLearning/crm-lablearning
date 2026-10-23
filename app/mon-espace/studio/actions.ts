'use server'

import { createElement } from 'react'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

/**
 * Studio formateur (espace connecté) : à partir de photos/notes prises en
 * mission, l'IA structure un document propre, mis en page aux couleurs de la
 * franchise (couleurs déduites du logo à la première génération puis
 * mémorisées). Le PDF est archivé dans les documents de la session.
 */

/** Remplace les glyphes absents de la police PDF (≥, ≤, ✓…) — sinon ils
 *  sortent en lettres parasites (« e », « d ») dans le document. */
function assainirTexte(v: string): string {
  return v
    .replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/[✓✔☑]/g, '').replace(/[✗✘]/g, 'X')
    .replace(/[−–—]/g, (m) => (m === '−' ? '-' : m))
    .replace(/\u00a0/g, ' ')
    .trim()
}
function assainirStructure(x: any): any {
  if (typeof x === 'string') return assainirTexte(x)
  if (Array.isArray(x)) return x.map(assainirStructure)
  if (x && typeof x === 'object') {
    const o: any = {}
    for (const k of Object.keys(x)) o[k] = assainirStructure(x[k])
    return o
  }
  return x
}

/** Générations permises par formateur sur 24 heures glissantes : chacune est un appel à l'IA payé par l'organisme. */
const GENERATIONS_PAR_JOUR = 10
/** Pages de PDF sources par génération : au-delà, le document produit ne peut pas tout reprendre et le coût s'envole. */
// Un PMS de franchise compte 46 pages : la limite reste au-dessus
const PAGES_PDF_MAX = 80
/** Taille décompressée annoncée d'un Word ou d'un Excel : au-delà, c'est une bombe de décompression. */
const DECOMPRESSE_MAX = 100 * 1024 * 1024
/** En-tête d'un ancien classeur Excel (.xls) : conteneur binaire OLE. */
const SIGNATURE_XLS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const ACTION_JOURNAL = 'generation_studio_ia'

/**
 * Compte la génération dans le journal (audit_logs) AVANT de lire les fichiers
 * et d'appeler l'IA, puis vérifie le plafond : la ligne est écrite d'abord,
 * pour que des appels lancés en parallèle ne passent pas tous. Renvoie le motif
 * du refus (la ligne est alors retirée), ou null si la génération est permise.
 */
async function reserverGeneration(supabase: any, orgId: string, userId: string, formateurId: string, details: Record<string, unknown>): Promise<string | null> {
  const indisponible = 'Le studio est momentanément indisponible — réessayez dans un instant.'
  const { data: ligne, error } = await supabase.from('audit_logs').insert({
    organization_id: orgId,
    user_id: userId,
    action: ACTION_JOURNAL,
    entity_type: 'formateur',
    entity_id: formateurId,
    details,
  }).select('id').single()
  if (error || !ligne) return indisponible
  const { count, error: erreurCompte } = await supabase.from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'formateur').eq('entity_id', formateurId).eq('action', ACTION_JOURNAL)
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  if (!erreurCompte && (count || 0) <= GENERATIONS_PAR_JOUR) return null
  await supabase.from('audit_logs').delete().eq('id', ligne.id)
  return erreurCompte
    ? indisponible
    : `Vous avez atteint la limite de ${GENERATIONS_PAR_JOUR} documents générés sur 24 heures : réessayez demain.`
}

/** Orientation de la 1re page et nombre de pages d'un PDF — pdf-lib d'abord,
 *  sinon vote majoritaire sur tous les MediaBox et décompte des objets /Page. */
async function lirePdf(buf: Buffer): Promise<{ paysage: boolean | null; pages: number | null }> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const docPdf = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false })
    const page = docPdf.getPage(0)
    const { width, height } = page.getSize()
    return {
      paysage: page.getRotation().angle % 180 === 90 ? height > width : width > height,
      pages: docPdf.getPageCount(),
    }
  } catch { /* PDF exotique : heuristique octets ci-dessous */ }
  const texte = buf.toString('latin1')
  let larges = 0, hauts = 0
  for (const m of texte.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)) {
    if (parseFloat(m[3]) - parseFloat(m[1]) > parseFloat(m[4]) - parseFloat(m[2])) larges++
    else hauts++
  }
  const pages = (texte.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length
  return { paysage: !larges && !hauts ? null : larges >= hauts, pages: pages || null }
}

/** Taille totale annoncée une fois décompressé, lue dans le répertoire central
 *  du zip (un Word ou un Excel récent en est un) ; null si ce n'est pas un zip. */
function tailleDecompresseeZip(buf: Buffer): number | null {
  try {
    if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) return null
    let fin = -1
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break }
    }
    if (fin < 0) return null
    let pos = buf.readUInt32LE(fin + 16)
    let total = 0
    for (let n = buf.readUInt16LE(fin + 10); n > 0; n--) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) return null
      const taille = buf.readUInt32LE(pos + 24)
      if (taille === 0xffffffff) return null // zip64 : jamais pour un document de quelques Mo
      total += taille
      pos += 46 + buf.readUInt16LE(pos + 28) + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32)
    }
    return total
  } catch { return null }
}

/** Texte d'un CSV : UTF-8, sinon Windows-1252 (export Excel français). */
function decoderTexte(buf: Buffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { /* pas de l'UTF-8 */ }
  try { return new TextDecoder('windows-1252').decode(buf) } catch { return buf.toString('latin1') }
}

/**
 * La bibliothèque xlsx installée (0.18.5) est sujette à la pollution de
 * prototype (CVE-2023-30533) tant qu'elle n'est pas mise à jour. Sa lecture
 * étant synchrone, on relève les prototypes de base juste avant et on efface
 * juste après tout ajout ou toute modification, avant qu'une autre requête ne
 * s'exécute sur l'instance.
 */
function sansPollution<T>(lire: () => T): T {
  // Outils de remise en état saisis avant la lecture, qui pourrait les remplacer
  const cles = Reflect.ownKeys
  const descripteur = Object.getOwnPropertyDescriptor
  const definir = Object.defineProperty
  const protos: any[] = [Object.prototype, Array.prototype, Function.prototype, String.prototype, Number.prototype, Boolean.prototype]
  const releves = protos.map((p) => cles(p).map((k) => ({ k, d: descripteur(p, k) as PropertyDescriptor })))
  try {
    return lire()
  } finally {
    // Boucles indexées : les itérateurs d'Array.prototype ont pu être remplacés
    for (let i = 0; i < protos.length; i++) {
      const p = protos[i]
      const releve = releves[i]
      const actuelles = cles(p)
      for (let j = 0; j < actuelles.length; j++) {
        let connue = false
        for (let r = 0; r < releve.length; r++) if (releve[r].k === actuelles[j]) { connue = true; break }
        if (!connue) delete p[actuelles[j]]
      }
      for (let r = 0; r < releve.length; r++) {
        const { k, d } = releve[r]
        const actuel = descripteur(p, k)
        if (!actuel || actuel.value !== d.value || actuel.get !== d.get || actuel.set !== d.set
          || actuel.writable !== d.writable || actuel.enumerable !== d.enumerable || actuel.configurable !== d.configurable) {
          definir(p, k, d)
        }
      }
    }
  }
}

/** Orientation d'une image PNG/JPEG : lit les dimensions dans les en-têtes. */
function imageEstPaysage(buf: Buffer, type: string): boolean | null {
  try {
    if (type === 'image/png' && buf.length > 24) {
      return buf.readUInt32BE(16) > buf.readUInt32BE(20)
    }
    if (type === 'image/jpeg') {
      let i = 2
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) break
        const marqueur = buf[i + 1]
        const long = buf.readUInt16BE(i + 2)
        if (marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc) {
          return buf.readUInt16BE(i + 7) > buf.readUInt16BE(i + 5)
        }
        i += 2 + long
      }
    }
  } catch { /* en-tête illisible : on laisse l'IA décider */ }
  return null
}

export async function genererDocumentBrandeAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; data?: { documentId: string } }> {
  const session = await getSession()
  if (session.user.role !== 'formateur') return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const { data: formateurRow } = await supabase.from('formateurs')
    .select('id, prenom, nom').eq('user_id', session.user.id).maybeSingle()
  if (!formateurRow) return { success: false, error: 'Fiche formateur introuvable' }
  const context = { formateur: formateurRow }

  const sessionId = String(formData.get('session_id') || '').trim()
  const titreDemande = String(formData.get('titre') || '').trim()
  const consignes = String(formData.get('consignes') || '').trim()
  if (!sessionId) return { success: false, error: 'Choisissez la session concernée' }
  if (!titreDemande && !consignes) return { success: false, error: 'Donnez au moins un titre ou des consignes' }

  // La session doit être au formateur connecté
  const { data: sess } = await supabase.from('sessions')
    .select('id, client_id, formateur_id, client:client_id(raison_sociale, nom_commercial, franchise_id)')
    .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess || sess.formateur_id !== context.formateur.id) {
    return { success: false, error: 'Session non autorisée' }
  }

  // Le branding : franchise si le client en a une, sinon l'établissement
  let franchise: any = null
  if ((sess as any).client?.franchise_id) {
    const { data: f } = await supabase.from('franchises')
      .select('id, nom, logo_url, couleur_primaire, couleur_secondaire')
      .eq('id', (sess as any).client.franchise_id).maybeSingle()
    franchise = f
  }
  const marqueNom = franchise?.nom || (sess as any).client?.nom_commercial || (sess as any).client?.raison_sociale || 'Établissement'

  // Clé IA vérifiée avant d'ouvrir le moindre fichier
  const claudeKey = process.env.ANTHROPIC_API_KEY
  const apiKey = process.env.OPENAI_API_KEY
  if (!claudeKey && !apiKey) return { success: false, error: 'Clé IA non configurée' }

  // Fichiers sources : photos (vision), PDF (natif API), Word/Excel/CSV (texte extrait).
  // 1) Contrôles sans rien décoder : taille, format, en-tête
  const fichiers = formData.getAll('fichiers') as File[]
  const sources: Array<{ f: File; buf: Buffer; genre: 'image' | 'pdf' | 'docx' | 'tableur' | 'csv' }> = []
  for (const f of fichiers.slice(0, 5)) {
    if (!f || typeof f.arrayBuffer !== 'function' || f.size === 0) continue
    if (f.size > 4 * 1024 * 1024) return { success: false, error: `« ${f.name} » dépasse 4 Mo` }
    const buf = Buffer.from(await f.arrayBuffer())
    const nomBas = (f.name || '').toLowerCase()
    if (/^image\/(jpeg|png|webp)$/.test(f.type)) {
      sources.push({ f, buf, genre: 'image' })
    } else if (f.type === 'application/pdf' || nomBas.endsWith('.pdf')) {
      sources.push({ f, buf, genre: 'pdf' })
    } else if (nomBas.endsWith('.csv')) {
      sources.push({ f, buf, genre: 'csv' })
    } else if (nomBas.endsWith('.docx') || nomBas.endsWith('.xlsx')) {
      // Un Word ou un Excel récent est un zip : ni faux fichier, ni bombe de décompression
      const taille = tailleDecompresseeZip(buf)
      if (taille === null || taille > DECOMPRESSE_MAX) return { success: false, error: `Lecture impossible : ${f.name}` }
      sources.push({ f, buf, genre: nomBas.endsWith('.docx') ? 'docx' : 'tableur' })
    } else if (nomBas.endsWith('.xls')) {
      // Ancien format Excel : seulement le vrai conteneur binaire, pas du HTML ou du XML renommé
      if (!buf.subarray(0, 8).equals(SIGNATURE_XLS)) {
        return { success: false, error: `Lecture impossible : ${f.name} (enregistrez-le au format .xlsx, ou exportez-le en PDF)` }
      }
      sources.push({ f, buf, genre: 'tableur' })
    } else {
      return { success: false, error: `Format non géré : ${f.name} (photos, PDF, Word, Excel)` }
    }
  }

  // 2) Plafond journalier, avant toute lecture du contenu et tout appel payant
  const refus = await reserverGeneration(supabase, orgId, session.user.id, context.formateur.id, {
    session_id: sessionId, fichiers: sources.length,
  })
  if (refus) return { success: false, error: refus }

  // 3) Lecture du contenu
  const images: string[] = []
  const pdfs: Array<{ nom: string; b64: string }> = []
  const textes: Array<{ nom: string; texte: string }> = []
  // Orientation détectée dans les fichiers sources — prime sur l'avis de l'IA.
  let sourcePaysage: boolean | null = null
  let pagesPdf = 0
  for (const { f, buf, genre } of sources) {
    if (genre === 'image') {
      images.push(`data:${f.type};base64,${buf.toString('base64')}`)
      if (sourcePaysage === null) sourcePaysage = imageEstPaysage(buf, f.type)
    } else if (genre === 'pdf') {
      pdfs.push({ nom: f.name, b64: buf.toString('base64') })
      const { paysage, pages } = await lirePdf(buf)
      if (sourcePaysage === null) sourcePaysage = paysage
      pagesPdf += pages || 0
      if (pagesPdf > PAGES_PDF_MAX) {
        return { success: false, error: `Les PDF joints dépassent ${PAGES_PDF_MAX} pages : ne gardez que les pages utiles.` }
      }
    } else if (genre === 'docx') {
      try {
        const mammoth = await import('mammoth')
        const r = await mammoth.extractRawText({ buffer: buf })
        textes.push({ nom: f.name, texte: (r.value || '').slice(0, 20000) })
      } catch { return { success: false, error: `Lecture impossible : ${f.name}` } }
    } else if (genre === 'csv') {
      // Un CSV est du texte : il n'a pas besoin de la bibliothèque des tableurs
      textes.push({ nom: f.name, texte: decoderTexte(buf).slice(0, 20000) })
    } else {
      try {
        const XLSX = await import('xlsx')
        const texte = sansPollution(() => {
          // Lecture réduite à ce que le CSV reprend : ni formules ni mise en forme
          const wb = XLSX.read(buf, { type: 'buffer', sheetRows: 2000, cellFormula: false, cellHTML: false })
          const morceaux: string[] = []
          for (const sheet of wb.SheetNames.slice(0, 5)) {
            morceaux.push(`--- Feuille « ${sheet} » ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[sheet])}`)
          }
          return morceaux.join('\n\n')
        })
        textes.push({ nom: f.name, texte: texte.slice(0, 20000) })
      } catch { return { success: false, error: `Lecture impossible : ${f.name}` } }
    }
  }

  const PROMPT_STUDIO = `Tu es le studio documentaire d'un organisme de formation haut de gamme (restaurants et métiers de bouche). Tu produis des documents en FRANÇAIS impeccables. Réponds UNIQUEMENT en JSON : {"titre": string, "sous_titre": string|null, "orientation": "portrait"|"paysage", "etiquettes": string[], "couleur_primaire": "#RRGGBB"|null, "couleur_secondaire": "#RRGGBB"|null, "sections": [{"titre": string, "icone": "temperature"|"controle"|"alerte"|"cuisson"|"froid"|"temps"|"nettoyage"|"securite"|"stockage"|"produit"|"personnel"|"document"|"reception"|"service", "ton": "normal"|"attention"|"critique", "paragraphes": string[]|null, "items": string[]|null, "colonnes": string[]|null, "lignes": string[][]|null, "etapes": [{"numero": number, "titre": string, "details": string[], "ccp": string|null}]|null}]}. RÈGLES ABSOLUES : (1) tu REPRODUIS le document source INTÉGRALEMENT : même ordre, mêmes sections, chaque étape, chaque valeur, chaque consigne, chaque ligne de liste — tu ne résumes JAMAIS, tu ne condenses JAMAIS, tu ne fusionnes pas des sections ; un document de 15 pages donne un JSON long, c'est normal ; (2) un PROCESSUS séquentiel (réception -> stockage -> cuisson…) devient une section "etapes" : une étape par carte avec ses détails, et son point de contrôle critique dans "ccp" s'il y en a un ; s'il y a plusieurs filières, une section d'étapes PAR filière ; (3) les caractéristiques produits, plannings, fréquences deviennent des TABLEAUX ; les consignes et points de contrôle des LISTES ; (4) le TITRE est un vrai titre humain, jamais un nom de fichier ni des underscores ; (5) écris >= et <= (jamais les symboles), pas de caractères spéciaux décoratifs ; (6) titres de sections actifs et courts ; (7) "etiquettes" : 2-3 mots-clés de couverture (ex. HACCP, Hygiène, Service) ; "icone" : la plus proche du sujet de la section ; "ton" : "critique" pour les sections de points de contrôle critiques ou dangers, "attention" pour les vigilances, "normal" sinon ; (8) "orientation" reprend celle du document source (une page large type organigramme ou planning -> "paysage", sinon "portrait"). ; (9) travaille PAGE PAR PAGE : chaque page, chaque bloc, chaque fiche produit du source doit se retrouver dans le JSON — une fiche produit (ingrédients, nutrition, références, EAN…) devient un TABLEAU à 2 colonnes Champ/Valeur, une par produit ; (10) une coche ou une puce du source = UN item distinct de "items", jamais deux consignes fusionnées, et les consignes ne vont JAMAIS dans "paragraphes" ; avant de répondre, relis le source page par page et vérifie que rien ne manque. Autant de sections que le document source en contient — aucune limite.`

  const doitDeduireCouleurs = !franchise?.couleur_primaire
  const aSources = images.length + pdfs.length + textes.length > 0
  const contenuUser: any[] = [{
    type: 'input_text',
    text: [
      // L'API exige le mot « JSON » dans le message d'entrée pour le mode json_object.
      'Produis le document au format JSON demandé.',
      `Marque du document : ${marqueNom}.`,
      titreDemande ? `Titre souhaité : ${titreDemande}` : null,
      consignes ? `Consignes du formateur : ${consignes}` : null,
      aSources ? `Les fichiers joints sont les documents sources (notes, tableaux, affichages) : transcris et structure leur contenu fidèlement, sans rien inventer.` : 'Aucune source : construis le document à partir du titre et des consignes.',
      ...textes.map((t) => `--- Contenu du fichier « ${t.nom} » ---\n${t.texte}`),
      doitDeduireCouleurs && franchise?.logo_url ? 'La dernière image est le LOGO de la marque : déduis-en couleur_primaire et couleur_secondaire (hex, contrastées sur blanc, jamais blanc/noir purs).' : null,
    ].filter(Boolean).join('\n\n'),
  }]
  for (const p of pdfs) contenuUser.push({ type: 'input_file', filename: p.nom, file_data: `data:application/pdf;base64,${p.b64}` })
  for (const img of images) contenuUser.push({ type: 'input_image', image_url: img })
  if (doitDeduireCouleurs && franchise?.logo_url) {
    contenuUser.push({ type: 'input_image', image_url: franchise.logo_url })
  }

  let structure: any
  try {
    if (claudeKey) {
      // Claude : lecture native des PDF, fidélité de reproduction supérieure.
      const blocs: any[] = [{ type: 'text', text: (contenuUser[0] as any).text }]
      for (const pdf of pdfs) blocs.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.b64 } })
      for (const img of images) {
        const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(img)
        if (m) blocs.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
      }
      if (doitDeduireCouleurs && franchise?.logo_url) {
        blocs.push({ type: 'image', source: { type: 'url', url: franchise.logo_url } })
      }
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-opus-5',
          max_tokens: 16000,
          system: PROMPT_STUDIO,
          messages: [{ role: 'user', content: blocs }],
        }),
      })
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`)
      const j = await r.json()
      const brut = (j.content || []).map((c: any) => c.text).filter(Boolean).join('')
      // Le modèle peut entourer le JSON de texte ou de clôtures markdown.
      const debut = brut.indexOf('{')
      const fin = brut.lastIndexOf('}')
      if (debut === -1 || fin <= debut) throw new Error('Sortie sans JSON')
      structure = JSON.parse(brut.slice(debut, fin + 1))
    } else {
      // Secours : API Responses OpenAI (seule à accepter les PDF chez eux).
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.15,
          max_output_tokens: 16000,
          text: { format: { type: 'json_object' } },
          instructions: PROMPT_STUDIO,
          input: [{ role: 'user', content: contenuUser }],
        }),
      })
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`)
      const j = await r.json()
      const texteSortie = j.output_text
        || (j.output || []).flatMap((o: any) => (o.content || [])).map((c: any) => c.text).filter(Boolean).join('')
      structure = JSON.parse(texteSortie || '{}')
    }
  } catch (e: any) {
    console.error('[studio ia]', e?.message)
    return { success: false, error: 'La génération IA a échoué — réessayez' }
  }
  structure = assainirStructure(structure)
  if (!structure?.titre || !Array.isArray(structure.sections) || structure.sections.length === 0) {
    return { success: false, error: 'Le contenu généré est vide — précisez vos consignes' }
  }

  // Couleurs : mémorisées sur la franchise à la première déduction
  const hex = (v: any) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null)
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16)
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  }
  // L'accent doit être la couleur VIVE : si l'IA met la sombre en primaire
  // (logos noir + jaune type Chicken Street), on inverse.
  {
    const c1 = hex(structure.couleur_primaire), c2 = hex(structure.couleur_secondaire)
    if (c1 && c2 && lum(c1) < 0.25 && lum(c2) > lum(c1) + 0.2) {
      structure.couleur_primaire = c2
      structure.couleur_secondaire = c1
    }
  }
  let couleur = franchise?.couleur_primaire || hex(structure.couleur_primaire) || '#205040'
  let couleur2 = franchise?.couleur_secondaire || hex(structure.couleur_secondaire) || null
  if (franchise && doitDeduireCouleurs && hex(structure.couleur_primaire)) {
    try {
      await supabase.from('franchises').update({
        couleur_primaire: hex(structure.couleur_primaire),
        couleur_secondaire: hex(structure.couleur_secondaire),
      }).eq('id', franchise.id)
    } catch { /* colonnes absentes avant migration 141 : le document sort quand même */ }
  }

  // Rendu PDF + archivage dans les documents de la session
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { DocumentBrandePDF } = await import('@/lib/pdf/document-brande-pdf')
    // Logo Lab Learning (variante sombre) pour le footer
    let labLogoUrl: string | null = null
    try {
      const { data: org } = await supabase.from('organizations').select('*').eq('id', orgId).single()
      const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
      labLogoUrl = ((await withDocumentLogo(supabase, org)) as any)?.logo_url || null
    } catch { /* footer texte en repli */ }
    const buffer = await renderToBuffer(createElement(DocumentBrandePDF, {
      doc: structure,
      franchiseNom: marqueNom,
      logoUrl: franchise?.logo_url || null,
      couleur, couleur2,
      formateurNom: `${context.formateur.prenom || ''} ${context.formateur.nom || ''}`.trim() || null,
      dateStr: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      labLogoUrl,
      paysage: sourcePaysage !== null ? sourcePaysage : structure.orientation === 'paysage',
    }) as any)

    const slug = String(structure.titre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'document'
    const path = `${orgId}/studio/${sessionId}/${Date.now()}-${slug}.pdf`
    const { error: eUp } = await supabase.storage.from('documents')
      .upload(path, new Uint8Array(buffer), { contentType: 'application/pdf' })
    if (eUp) throw new Error(eUp.message)

    const { data: docRow, error: eDoc } = await supabase.from('documents').insert({
      organization_id: orgId,
      nom: `${structure.titre} — ${marqueNom}`,
      type: 'support_pedagogique',
      session_id: sessionId,
      formateur_id: context.formateur.id,
      storage_path: path,
      file_name: `${slug}.pdf`,
      file_size: buffer.length,
      mime_type: 'application/pdf',
      visibilite: 'tous',
      origine: 'studio_formateur',
    }).select('id').single()
    if (eDoc) throw new Error(eDoc.message)

    revalidatePath('/mon-espace/studio')
    return { success: true, data: { documentId: docRow.id } }
  } catch (e: any) {
    console.error('[studio pdf]', e?.message)
    return { success: false, error: 'Mise en page du document impossible — réessayez' }
  }
}

/**
 * Supprime un document généré par le formateur (fichier du bucket + ligne) —
 * uniquement les siens, uniquement ceux issus du studio.
 */
export async function supprimerDocumentStudioAction(documentId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (session.user.role !== 'formateur') return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: formateurRow } = await supabase.from('formateurs')
    .select('id').eq('user_id', session.user.id).maybeSingle()
  if (!formateurRow) return { success: false, error: 'Fiche formateur introuvable' }

  const { data: doc } = await supabase.from('documents')
    .select('id, storage_path, formateur_id, origine')
    .eq('id', documentId).eq('organization_id', session.organization.id).maybeSingle()
  if (!doc || doc.formateur_id !== formateurRow.id || doc.origine !== 'studio_formateur') {
    return { success: false, error: 'Document introuvable ou non supprimable' }
  }

  if (doc.storage_path) {
    await supabase.storage.from('documents').remove([doc.storage_path])
  }
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) return { success: false, error: 'Suppression impossible' }

  revalidatePath('/mon-espace/studio')
  return { success: true }
}

/**
 * Données du studio pour le widget flottant : sessions du formateur et
 * historique des générations — chargées à l'ouverture du panneau.
 */
export async function getStudioDataAction(): Promise<{
  success: boolean
  error?: string
  data?: { sessions: { id: string; libelle: string; franchise: string | null }[]; generes: any[] }
}> {
  const session = await getSession()
  if (session.user.role !== 'formateur') return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data: formateurRow } = await supabase.from('formateurs')
    .select('id').eq('user_id', session.user.id).maybeSingle()
  if (!formateurRow) return { success: false, error: 'Fiche formateur introuvable' }

  const [{ data: sessions }, { data: generes }] = await Promise.all([
    supabase.from('sessions')
      .select('id, reference, date_debut, status, client:client_id(raison_sociale, nom_commercial, franchise:franchise_id(nom)), formation:formation_id(intitule)')
      .eq('formateur_id', formateurRow.id)
      .order('date_debut', { ascending: false })
      .limit(40),
    supabase.from('documents')
      .select('id, nom, created_at, session_id')
      .eq('formateur_id', formateurRow.id)
      .eq('origine', 'studio_formateur')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    success: true,
    data: {
      sessions: (sessions || []).map((s: any) => ({
        id: s.id,
        libelle: [
          s.formation?.intitule,
          s.client?.franchise?.nom || s.client?.nom_commercial || s.client?.raison_sociale,
          s.date_debut ? new Date(s.date_debut).toLocaleDateString('fr-FR') : null,
        ].filter(Boolean).join(' — '),
        franchise: s.client?.franchise?.nom || null,
      })),
      generes: (generes || []) as any[],
    },
  }
}
