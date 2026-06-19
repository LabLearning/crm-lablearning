// Résout le logo à utiliser sur les DOCUMENTS PDF (fond blanc) → logo foncé/vert.
//
// Contexte : `organizations.logo_url` peut pointer sur la version BLANCHE du logo
// (utilisée dans les en-têtes d'email sur fond vert). Sur un PDF fond blanc, ce
// logo blanc est invisible. Quand c'est le cas, on récupère la version document
// (fichier `logo-*` du bucket, hors `logo-white-*`) dans le même dossier org.
// Pour les organismes n'ayant qu'un seul logo, `logo_url` est renvoyé tel quel.
export async function resolveDocumentLogoUrl(supabase: any, org: any): Promise<string | null> {
  const current: string | null = org?.logo_url || null
  if (!current) return null
  // Déjà un logo document (pas la variante blanche) → on le garde.
  if (!current.includes('/logo-white')) return current

  const orgId = org?.id
  if (!orgId) return current

  const { data: files } = await supabase.storage.from('organisation').list(orgId, { limit: 100 })
  const green = (files || []).find(
    (f: any) => f.name.startsWith('logo-') && !f.name.startsWith('logo-white'),
  )
  if (!green) return current

  const { data: pub } = supabase.storage.from('organisation').getPublicUrl(`${orgId}/${green.name}`)
  return pub?.publicUrl || current
}

// Renvoie une copie de `org` dont le logo_url est adapté aux documents PDF.
export async function withDocumentLogo(supabase: any, org: any): Promise<any> {
  if (!org) return org
  const logo = await resolveDocumentLogoUrl(supabase, org)
  return { ...org, logo_url: logo }
}
