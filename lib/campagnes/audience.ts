import { dateDemande, etapeDuLead, origineDuLead, type EtapeLead, type OrigineLead } from '@/lib/leads-entrants'
import { isPlaceholderEmail } from '@/lib/utils'
import { oppositionsDuCanal, cleOpposition, refusDesFormulaires, ETIQUETTE_SANS_ACTUALITES } from './oppositions'
import { cleEmail, numeroSmsFrance, type CanalCampagne } from './regles'

/**
 * Audience d'une campagne : les leads et les contacts des clients choisis à
 * l'écran, une fois chacun (même adresse ou même mobile), sans les
 * oppositions. Cadre : la prospection des professionnels, donc jamais de
 * particulier (type « particulier », lead sans établissement, financement
 * CPF ou France Travail). Et jamais au-delà de la durée de conservation
 * annoncée (3 ans) : un lead dont la dernière demande est plus ancienne, ou le
 * contact d'un client sans relation depuis 3 ans, n'est pas écrit.
 */
export const JOURS_CONSERVATION = 3 * 365
export interface FiltresAudience {
  leads?: {
    actif: boolean
    /** Origines retenues (vide : toutes) */
    origines?: OrigineLead[]
    /** Étapes retenues (vide : toutes) */
    etapes?: EtapeLead[]
    /** Demande reçue dans les N derniers jours (vide : toutes) */
    depuisJours?: number | null
  }
  contacts?: {
    actif: boolean
    /** Départements (2 ou 3 premiers chiffres du code postal du client ; vide : tous) */
    departements?: string[]
    /** Réseau de franchise du client (vide : tous) */
    franchiseId?: string | null
    /** Seulement le contact principal de chaque client */
    principalSeulement?: boolean
  }
}

export interface Destinataire {
  personne_type: 'lead' | 'contact'
  personne_id: string
  nom: string
  prenom: string | null
  etablissement: string | null
  /** E-mail en minuscules, ou mobile au format 336… */
  destination: string
}

export interface ResultatAudience {
  destinataires: Destinataire[]
  exclus: { sansCoordonnee: number; opposition: number; doublon: number; particulier: number; ancien: number }
}

/** Toutes les lignes, par lots de 1 000 ; une erreur de lecture arrête tout (jamais une audience incomplète en silence). */
async function lireTout<T = any>(build: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const lignes: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await build(de, de + 999)
    if (error) throw new Error(`Lecture de l’audience : ${error.message}`)
    lignes.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return lignes
}

const ORIGINES_VALIDES: OrigineLead[] = ['site', 'meta', 'google_ads', 'apporteur', 'ancien']
const ETAPES_VALIDES: EtapeLead[] = ['a_traiter', 'contacte', 'qualifie', 'gagne', 'perdu']

/** Filtres reçus du navigateur : on ne garde que des valeurs connues. */
export function nettoyerFiltres(brut: any): FiltresAudience {
  const liste = <T extends string>(v: unknown, valides: T[]) => (Array.isArray(v) ? v.filter((x): x is T => valides.includes(x)) : [])
  const jours = Number(brut?.leads?.depuisJours)
  return {
    leads: {
      actif: brut?.leads?.actif === true,
      origines: liste(brut?.leads?.origines, ORIGINES_VALIDES),
      etapes: liste(brut?.leads?.etapes, ETAPES_VALIDES),
      // 3 ans au plus, et par défaut (durée de conservation des prospects)
      depuisJours: Number.isFinite(jours) && jours > 0 ? Math.min(Math.round(jours), JOURS_CONSERVATION) : JOURS_CONSERVATION,
    },
    contacts: {
      actif: brut?.contacts?.actif === true,
      departements: (Array.isArray(brut?.contacts?.departements) ? brut.contacts.departements : [])
        .map((d: unknown) => String(d).trim().toUpperCase()).filter((d: string) => /^(\d{2}|2A|2B|97\d)$/.test(d)).slice(0, 30),
      franchiseId: typeof brut?.contacts?.franchiseId === 'string' && /^[0-9a-f-]{36}$/i.test(brut.contacts.franchiseId) ? brut.contacts.franchiseId : null,
      principalSeulement: brut?.contacts?.principalSeulement === true,
    },
  }
}

/** Départements saisis qui ne sont pas reconnus (pour le dire, au lieu de les ignorer et d'élargir l'audience) */
export function departementsInconnus(brut: any): string[] {
  const liste = Array.isArray(brut?.contacts?.departements) ? brut.contacts.departements : []
  return liste.map((d: unknown) => String(d).trim().toUpperCase()).filter((d: string) => d && !/^(\d{2}|2A|2B|97\d)$/.test(d))
}

/** Département d'un code postal : 2 chiffres, 3 pour l'outre-mer, 2A ou 2B pour la Corse. */
export function departement(cp: string | null | undefined): string | null {
  const c = String(cp || '').replace(/\s/g, '')
  if (!/^\d{5}$/.test(c)) return null
  if (c.startsWith('97')) return c.slice(0, 3)
  if (c.startsWith('20')) return Number(c) < 20200 ? '2A' : '2B'
  return c.slice(0, 2)
}

export async function calculerAudience(supabase: any, orgId: string, canal: CanalCampagne, filtres: FiltresAudience): Promise<ResultatAudience> {
  const exclus = { sansCoordonnee: 0, opposition: 0, doublon: 0, particulier: 0, ancien: 0 }
  const vus = new Set<string>()
  const destinataires: Destinataire[] = []
  // Oppositions, et case « Je ne souhaite pas recevoir les actualités » cochée par un lead (sous toutes ses fiches)
  const [opposes, refus] = await Promise.all([oppositionsDuCanal(supabase, orgId, canal), refusDesFormulaires(supabase, orgId, canal)])
  const oppositions = new Set([...opposes, ...refus])

  const retenir = (d: Omit<Destinataire, 'destination'>, coordonnees: (string | null | undefined)[]) => {
    // E-mail : la première adresse exploitable ; SMS : le premier mobile français
    let destination: string | null = null
    for (const c of coordonnees) {
      destination = canal === 'email' ? (cleEmail(c) && !isPlaceholderEmail(cleEmail(c) as string) ? cleEmail(c) : null) : numeroSmsFrance(c)
      if (destination) break
    }
    if (!destination) { exclus.sansCoordonnee++; return }
    if (oppositions.has(cleOpposition(canal, destination) || '')) { exclus.opposition++; return }
    if (vus.has(destination)) { exclus.doublon++; return }
    vus.add(destination)
    destinataires.push({ ...d, destination })
  }

  if (filtres.leads?.actif) {
    const f = filtres.leads
    const depuis = Date.now() - Math.min(f.depuisJours || JOURS_CONSERVATION, JOURS_CONSERVATION) * 86400000
    const leads = await lireTout<any>((de, a) => supabase.from('leads')
      // Tri sur une clé unique : une pagination sur created_at peut sauter ou doubler des lignes de même date
      .select('*').eq('organization_id', orgId).order('id').range(de, a))
    for (const l of leads) {
      if (f.origines?.length && !f.origines.includes(origineDuLead(l.source))) continue
      if (f.etapes?.length && !f.etapes.includes(etapeDuLead(l))) continue
      if (Date.parse(dateDemande(l)) < depuis) continue
      // Un particulier n'est pas prospecté sans son accord : type « particulier », pas d'établissement, ou financement personnel
      if (l.type === 'particulier' || !String(l.entreprise || '').trim() || ['cpf', 'france_travail'].includes(l.financeur_type)) { exclus.particulier++; continue }
      // Case « Je ne souhaite pas recevoir les actualités » gardée aussi sur le lead
      if ((l.tags || []).includes(ETIQUETTE_SANS_ACTUALITES)) { exclus.opposition++; continue }
      retenir(
        { personne_type: 'lead', personne_id: l.id, nom: [l.contact_prenom, l.contact_nom].filter(Boolean).join(' ') || l.entreprise || 'Prospect', prenom: l.contact_prenom || null, etablissement: l.entreprise || null },
        canal === 'email' ? [l.contact_email] : [l.contact_telephone],
      )
    }
  }

  if (filtres.contacts?.actif) {
    const f = filtres.contacts
    const limite = new Date(Date.now() - JOURS_CONSERVATION * 86400000).toISOString()
    const [contacts, sessionsRecentes] = await Promise.all([
      lireTout<any>((de, a) => supabase.from('contacts')
        .select('id, prenom, nom, email, telephone, mobile, est_principal, client:client_id(id, raison_sociale, nom_commercial, type, code_postal, franchise_id, created_at)')
        .eq('organization_id', orgId).not('client_id', 'is', null).order('id').range(de, a)),
      // Relation récente : une session depuis 3 ans
      lireTout<any>((de, a) => supabase.from('sessions').select('client_id')
        .eq('organization_id', orgId).not('client_id', 'is', null).gte('date_debut', limite.slice(0, 10)).order('id').range(de, a)),
    ])
    const clientsRecents = new Set(sessionsRecentes.map((s) => s.client_id))
    for (const c of contacts) {
      const client = c.client
      if (!client) continue
      if (client.type === 'particulier') { exclus.particulier++; continue }
      // Client sans session ni création depuis 3 ans : au-delà de la durée de conservation annoncée
      if (!clientsRecents.has(client.id) && !(client.created_at && client.created_at >= limite)) { exclus.ancien++; continue }
      if (f.principalSeulement && !c.est_principal) continue
      if (f.franchiseId && client.franchise_id !== f.franchiseId) continue
      if (f.departements?.length && !f.departements.includes(departement(client.code_postal) || '')) continue
      retenir(
        { personne_type: 'contact', personne_id: c.id, nom: [c.prenom, c.nom].filter(Boolean).join(' ') || 'Contact', prenom: c.prenom || null, etablissement: client.nom_commercial || client.raison_sociale || null },
        canal === 'email' ? [c.email] : [c.mobile, c.telephone],
      )
    }
  }

  return { destinataires, exclus }
}
