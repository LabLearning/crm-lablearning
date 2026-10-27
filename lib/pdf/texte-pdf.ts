/**
 * Texte prêt pour la police des PDF (Manrope), qui ne dessine ni les emoji, ni
 * les coches, ni les accents « décomposés » : sans cela, le PDF affiche un signe
 * parasite par-dessus le mot qui suit (« 🗓 Jour 1 ») ou perd l'accent
 * (« Methode » pour « Méthode » écrit e + accent séparé, fiches reprises de Dendreo).
 * Le texte enregistré n'est pas touché, seulement ce qui s'imprime.
 */

// Pictogrammes et emoji, avec leurs suites (variante emoji, teint, assemblage) ; ©, ® et ™ restent, la police les a
const EMOJI = /(?![©®™])\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*|[\u{1F3FB}-\u{1F3FF}️⃣‍]/gu
// Coches absentes de la police (√ en a une : il n'est retiré qu'en tête de ligne, comme puce)
const COCHES = /[✓✔✅☑]/g

export function textePdf(v: unknown): string {
  return String(v ?? '')
    .normalize('NFC')
    .replace(EMOJI, '')
    .replace(COCHES, '')
    // Espace fine insécable (séparateur de milliers de toLocaleString) : absente de la police
    .replace(/ /g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
}
