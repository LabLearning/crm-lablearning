/**
 * Service de recherche d'entreprises via l'API publique data.gouv
 * Source: https://recherche-entreprises.api.gouv.fr/
 * Pas de clé API requise. Données INSEE/Sirene officielles.
 */

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'

export interface SireneCompany {
  siren: string
  siret: string
  raison_sociale: string
  adresse: string
  code_postal: string
  ville: string
  code_naf: string
  libelle_naf: string | null  // Libellé du code NAF (= secteur d'activité)
  code_idcc: string | null    // Code IDCC de la convention collective (depuis siret_opco)
  taille_entreprise: 'TPE' | 'PME' | 'ETI' | 'GE' | ''
  est_actif: boolean
  dirigeant: { prenom: string; nom: string; qualite: string } | null
}

interface ApiResult {
  siren: string
  nom_complet: string
  nom_raison_sociale: string | null
  categorie_entreprise: string | null
  etat_administratif: string
  dirigeants: Array<{ nom?: string; prenoms?: string; qualite?: string; type_dirigeant?: string }>
  siege: {
    siret: string
    activite_principale: string | null
    code_postal: string | null
    libelle_commune: string | null
    numero_voie: string | null
    type_voie: string | null
    libelle_voie: string | null
    complement_adresse: string | null
    tranche_effectif_salarie: string | null
    etat_administratif: string
  }
}

function buildAdresse(siege: ApiResult['siege']): string {
  const parts = [
    siege.numero_voie,
    siege.type_voie,
    siege.libelle_voie,
  ].filter(Boolean).join(' ').trim()
  return parts || ''
}

function mapTaille(categorie: string | null, effectif: string | null): SireneCompany['taille_entreprise'] {
  if (categorie === 'PME') return 'PME'
  if (categorie === 'ETI') return 'ETI'
  if (categorie === 'GE') return 'GE'
  // INSEE codes effectif: 00,01,02,03 = < 10 → TPE
  if (effectif && ['00', '01', '02', '03'].includes(effectif)) return 'TPE'
  return ''
}

function mapResult(r: ApiResult): SireneCompany {
  const siege = r.siege || ({} as ApiResult['siege'])
  const firstDirigeant = r.dirigeants?.find(d => d.type_dirigeant === 'personne physique') || r.dirigeants?.[0]
  return {
    siren: r.siren,
    siret: siege.siret || '',
    raison_sociale: r.nom_raison_sociale || r.nom_complet || '',
    adresse: buildAdresse(siege),
    code_postal: siege.code_postal || '',
    ville: siege.libelle_commune || '',
    code_naf: siege.activite_principale || '',
    libelle_naf: null,  // Rempli côté serveur dans le proxy via lookup DB
    code_idcc: null,    // Idem
    taille_entreprise: mapTaille(r.categorie_entreprise, siege.tranche_effectif_salarie),
    est_actif: r.etat_administratif === 'A',
    dirigeant: firstDirigeant?.prenoms && firstDirigeant?.nom
      ? {
          prenom: firstDirigeant.prenoms.split(' ')[0],
          nom: firstDirigeant.nom,
          qualite: firstDirigeant.qualite || '',
        }
      : null,
  }
}

export async function searchCompanies(query: string, limit = 10): Promise<SireneCompany[]> {
  const q = query.trim()
  if (q.length < 2) return []

  // Côté browser : passer par notre proxy Vercel (réseau plus stable que celui du user)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams({ q, limit: String(limit) })
    const res = await fetch(`/api/sirene/search?${params}`)
    if (!res.ok) throw new Error('proxy error')
    const data = await res.json()
    return data.companies || []
  }

  // Côté serveur : appel direct à l'API publique
  const params = new URLSearchParams({
    q,
    page: '1',
    per_page: String(Math.min(limit, 25)),
    etat_administratif: 'A',
  })
  const res = await fetch(`${API_URL}?${params}`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data.results)) return []
  return data.results.map(mapResult)
}

export async function getCompanyBySiret(siret: string): Promise<SireneCompany | null> {
  const clean = siret.replace(/\D/g, '')
  if (clean.length !== 14) return null
  const params = new URLSearchParams({ q: clean, page: '1', per_page: '1' })
  const res = await fetch(`${API_URL}?${params}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data.results) || data.results.length === 0) return null
  return mapResult(data.results[0])
}
