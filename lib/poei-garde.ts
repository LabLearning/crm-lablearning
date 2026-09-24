/**
 * Une POEI se crée et se gère dans le module POEI, qui fabrique lui-même ses
 * sessions techniques (parcours et interventions). Aucune session OPCO ne
 * doit être créée à la main avec une formation POEI : ce garde-fou le refuse
 * dans « Session seule » et dans l'assistant « Nouveau dossier ».
 */
export async function refusFormationPoei(supabase: any, formationIds: string[]): Promise<string | null> {
  const ids = [...new Set(formationIds.map((x) => String(x || '').trim()).filter(Boolean))]
  if (!ids.length) return null
  const { data } = await supabase.from('formations').select('intitule').in('id', ids).eq('is_poei', true).limit(1)
  const f = (data || [])[0]
  return f ? `« ${f.intitule} » est une formation POEI : créez une POEI dans le module POEI, elle crée elle-même ses sessions.` : null
}
