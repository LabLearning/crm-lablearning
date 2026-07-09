// Nettoyage des champs HTML Dendreo → texte lisible multi-lignes.
// Même logique que lib/pdf/programme-formation-pdf.tsx (fieldItems) :
// - une <li> ouvre un item, le texte qui suit (p, texte nu) s'y accroche
// - les lignes coupées en pleine phrase sont recollées
// Utilisé par dendreo-sync.mjs (import) et clean-html-fields.mjs (rattrapage).

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
}
const decodeEntities = (s) => s.replace(/&[a-z#0-9]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? ' ')

// Puces standard + puces Word Symbol (Private Use U+F000–U+F0FF)
const LEADING_BULLETS = new RegExp("^(?:\\s*[\\u2022\\u00b7\\u2219\\u25cf\\u25aa\\u25e6\\u2043\\u2013\\u2014\\uf000-\\uf0ff*\\-]+)+\\s*")
const stripBullet = (s) => s.replace(LEADING_BULLETS, '').trim()
const stripPua = (s) => s.replace(/[-]/g, '').replace(/[ \t]{2,}/g, ' ')

function mergeContinuations(lines) {
  const out = []
  const endsSentence = (s) => /[.!?:)\]]$/.test(s)
  const isUpper = (s) => s === s.toUpperCase() && /[A-ZÀ-Ý]/.test(s)
  for (const line of lines) {
    const prev = out[out.length - 1]
    const startsLower = /^[a-zà-ÿ(]/.test(line)
    if (prev && !endsSentence(prev) && !/^jour\s*\d/i.test(prev) && (startsLower || (isUpper(prev) && isUpper(line)))) {
      out[out.length - 1] = `${prev} ${line}`
    } else {
      out.push(line)
    }
  }
  return out
}

/** Champ HTML ou texte → liste d'items propres. */
export function fieldItems(s) {
  const raw = (s ?? '').toString().replace(/\r\n?/g, '\n').trim()
  if (!raw) return []

  if (/<[a-z][^>]*>/i.test(raw)) {
    if (/<li\b/i.test(raw)) {
      const items = []
      let current = ''
      for (const token of raw.split(/(<[^>]+>)/)) {
        if (!token) continue
        if (token.startsWith('<')) {
          if (/^<li\b/i.test(token)) {
            if (current.trim()) items.push(current.trim())
            current = ''
          }
        } else {
          const text = decodeEntities(token).replace(/\s+/g, ' ').trim()
          if (text) current += (current ? ' ' : '') + text
        }
      }
      if (current.trim()) items.push(current.trim())
      return items.map((i) => stripBullet(stripPua(i))).filter(Boolean)
    }
    const text = decodeEntities(
      raw.replace(/<\/(p|div|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
    )
    return mergeContinuations(text.split('\n').map((l) => stripBullet(stripPua(l)).trim()).filter(Boolean))
  }

  return mergeContinuations(raw.split('\n').map((l) => stripBullet(stripPua(l)).trim()).filter(Boolean))
}

/** Champ HTML ou texte → texte propre multi-lignes (null si vide). */
export function htmlFieldToText(s) {
  const items = fieldItems(s)
  if (items.length === 0) return null
  return items.join('\n')
}
