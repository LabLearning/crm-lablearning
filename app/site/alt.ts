/** Texte alternatif d'une photo de formation : « Formation … », sans doubler le mot quand l'intitulé commence déjà par lui. */
export const altFormation = (titre: string) => {
  const t = String(titre || '').trim()
  return /^formation\b/i.test(t) ? t : `Formation ${t}`
}
