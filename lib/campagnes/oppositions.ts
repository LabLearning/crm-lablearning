import { cleEmail, cleTelephone, type CanalCampagne } from './regles'

/**
 * Oppositions : les personnes qui ne veulent plus recevoir de campagne sur un
 * canal (lien de désinscription, STOP, rebond, plainte, case du formulaire,
 * demande). Clé : l'e-mail en minuscules, ou les 9 derniers chiffres du
 * téléphone. Aucune campagne ne leur écrit, ni au lancement ni à l'envoi.
 */
export type SourceOpposition = 'lien_desinscription' | 'stop_sms' | 'rebond' | 'plainte' | 'formulaire' | 'demande' | 'manuel'

/** Clé d'opposition d'une coordonnée, selon le canal. */
export function cleOpposition(canal: CanalCampagne, coordonnee: string | null | undefined): string | null {
  return canal === 'email' ? cleEmail(coordonnee) : cleTelephone(coordonnee)
}

/** Toutes les oppositions d'un canal (lues par lots : la liste peut dépasser 1 000 lignes). */
export async function oppositionsDuCanal(supabase: any, orgId: string, canal: CanalCampagne): Promise<Set<string>> {
  const valeurs = new Set<string>()
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from('oppositions_marketing').select('valeur')
      .eq('organization_id', orgId).eq('canal', canal).order('id').range(de, de + 999)
    if (error) throw new Error(`Lecture des oppositions : ${error.message}`)
    for (const o of (data || []) as any[]) valeurs.add(o.valeur)
    if (!data || data.length < 1000) break
  }
  return valeurs
}

/** Étiquette posée sur le lead quand la case est cochée : le refus reste connu même si l'opposition n'a pas pu s'écrire */
export const ETIQUETTE_SANS_ACTUALITES = 'sans-actualites'

/**
 * Coordonnées (clés du canal) des leads qui ont coché « Je ne souhaite pas
 * recevoir les actualités » : elles ne reçoivent rien, même sous une autre
 * fiche (le contact d'un client), y compris si l'opposition n'a pas pu
 * s'écrire. Relues au lancement et avant chaque lot.
 */
export async function refusDesFormulaires(supabase: any, orgId: string, canal: CanalCampagne): Promise<Set<string>> {
  const cles = new Set<string>()
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from('leads').select('contact_email, contact_telephone')
      .eq('organization_id', orgId).contains('tags', [ETIQUETTE_SANS_ACTUALITES]).order('id').range(de, de + 999)
    if (error) throw new Error(`Lecture des refus des formulaires : ${error.message}`)
    for (const l of (data || []) as any[]) {
      const cle = cleOpposition(canal, canal === 'email' ? l.contact_email : l.contact_telephone)
      if (cle) cles.add(cle)
    }
    if (!data || data.length < 1000) break
  }
  return cles
}

/** Oppositions parmi ces destinations seulement (lecture ciblée sur l'index unique) : pour un lot d'envoi ou un essai. */
export async function oppositionsParmi(supabase: any, orgId: string, canal: CanalCampagne, destinations: string[]): Promise<Set<string>> {
  const cles = Array.from(new Set(destinations.map((d) => cleOpposition(canal, d)).filter((c): c is string => !!c)))
  if (!cles.length) return new Set()
  const { data, error } = await supabase.from('oppositions_marketing').select('valeur')
    .eq('organization_id', orgId).eq('canal', canal).in('valeur', cles)
  if (error) throw new Error(`Lecture des oppositions : ${error.message}`)
  return new Set(((data || []) as any[]).map((o) => o.valeur))
}

/** Ajoute une opposition (sans effet si elle existe déjà). Renvoie vrai si elle est nouvelle. */
export async function ajouterOpposition(
  supabase: any, orgId: string, canal: CanalCampagne, coordonnee: string, source: SourceOpposition, detail?: string | null,
): Promise<boolean> {
  const valeur = cleOpposition(canal, coordonnee)
  if (!valeur) return false
  const { error } = await supabase.from('oppositions_marketing').insert({
    organization_id: orgId, canal, valeur, source, detail: detail ? String(detail).slice(0, 300) : null,
  })
  if (error && error.code !== '23505') throw new Error(`Opposition non enregistrée : ${error.message}`)
  return !error
}

/**
 * Case « Je ne souhaite pas recevoir les actualités » d'un formulaire du site :
 * l'adresse et le mobile donnés ne recevront aucune campagne. Sans effet avant
 * la migration 168 (l'appelant ignore l'erreur).
 */
export async function noterRefusDuFormulaire(supabase: any, orgId: string, coordonnees: { email?: string | null; telephone?: string | null }, formulaire: string) {
  // L'un n'empêche pas l'autre : chaque coordonnée est tentée de son côté, l'erreur remonte ensuite
  const essais = await Promise.allSettled([
    coordonnees.email ? ajouterOpposition(supabase, orgId, 'email', coordonnees.email, 'formulaire', `Case cochée : ${formulaire}`) : Promise.resolve(false),
    coordonnees.telephone ? ajouterOpposition(supabase, orgId, 'sms', coordonnees.telephone, 'formulaire', `Case cochée : ${formulaire}`) : Promise.resolve(false),
  ])
  const echec = essais.find((e) => e.status === 'rejected') as PromiseRejectedResult | undefined
  if (echec) throw echec.reason
}

/**
 * Désinscription par le lien d'une campagne (page du site ou un clic depuis
 * la messagerie) : l'opposition, et la désinscription comptée sur la campagne
 * quand elle est nouvelle.
 */
export async function desinscrireParLien(supabase: any, cible: { orgId: string; canal: CanalCampagne; valeur: string; campagneId?: string | null }, detail: string) {
  const nouvelle = await ajouterOpposition(supabase, cible.orgId, cible.canal, cible.valeur, 'lien_desinscription', detail)
  if (nouvelle && cible.campagneId) {
    const { data: c } = await supabase.from('campagnes').select('nb_desinscrits').eq('id', cible.campagneId).eq('organization_id', cible.orgId).maybeSingle()
    if (c) await supabase.from('campagnes').update({ nb_desinscrits: (c.nb_desinscrits || 0) + 1 }).eq('id', cible.campagneId)
  }
  return nouvelle
}
