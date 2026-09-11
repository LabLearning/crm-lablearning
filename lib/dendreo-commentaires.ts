/**
 * Le champ « commentaires » des participants Dendreo sert de fourre-tout :
 * numéro de sécurité sociale, type de contrat, poste, adresse, email, date
 * de naissance y sont tapés à la main, dans n'importe quel ordre. On en
 * extrait ce qui se reconnaît sans ambiguïté ; le texte brut reste en note.
 */

export interface InfosCommentaire {
  numero_securite_sociale?: string
  /** true : 15 chiffres, clé correcte ; false : clé fausse (faute de frappe) ; absent : 13 chiffres sans clé */
  nir_cle_valide?: boolean
  type_contrat?: string
  statut_bpf?: 'salarie' | 'apprenti'
  poste?: string
  adresse?: string
  code_postal?: string
  ville?: string
  email?: string
  date_naissance?: string
}

const METIERS = [
  'apprenti cuisinier', 'apprentie cuisinière', 'apprenti boulanger', 'apprenti pâtissier', 'apprenti patissier', 'apprenti boucher',
  'chef de cuisine', 'chef de partie', 'second de cuisine', 'commis de cuisine', 'employé polyvalent', 'employée polyvalente',
  'équipier polyvalent', 'equipier polyvalent', 'responsable de salle', 'chef de rang',
  'cuisinier', 'cuisinière', 'pâtissier', 'pâtissière', 'patissier', 'patissiere', 'boulanger', 'boulangère', 'boucher', 'bouchère',
  'charcutier', 'traiteur', 'serveur', 'serveuse', 'barman', 'barmaid', 'plongeur', 'plongeuse', 'commis', 'équipier', 'equipier',
  'manager', 'gérant', 'gérante', 'gerant', 'vendeur', 'vendeuse', 'caissier', 'caissière', 'préparateur', 'préparatrice', 'livreur', 'pizzaiolo',
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Clé de contrôle d'un NIR à 15 chiffres : 97 - (13 premiers chiffres mod 97). */
function cleNirValide(nir15: string): boolean {
  // Reste modulo 97 chiffre par chiffre : 13 chiffres dépassent la précision d'un Number
  let reste = 0
  for (const c of nir15.slice(0, 13)) reste = (reste * 10 + Number(c)) % 97
  return 97 - reste === Number(nir15.slice(13))
}

export function extraireInfosCommentaire(brut: string | null | undefined): InfosCommentaire {
  const texte = String(brut || '').replace(/\s+/g, ' ').trim()
  const out: InfosCommentaire = {}
  if (!texte) return out

  // Email
  const email = texte.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (email) out.email = email[0].toLowerCase()

  // Date de naissance jj/mm/aa(aa)
  const dn = texte.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/)
  if (dn) {
    let an = Number(dn[3])
    if (dn[3].length === 2) an += an > Number(String(new Date().getFullYear()).slice(2)) ? 1900 : 2000
    const j = Number(dn[1]), m = Number(dn[2])
    if (j >= 1 && j <= 31 && m >= 1 && m <= 12 && an > 1930) out.date_naissance = `${an}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`
  }

  // Adresse « 20 rue X 75018 Paris »
  const adr = texte.match(/\b(\d{1,4}\s?(?:bis|ter)?\s*,?\s*(?:rue|avenue|av\.?|boulevard|bd|chemin|place|allée|allee|impasse|route|quai|cours|square|résidence|residence|cité|cite)\b[^;,]*?)\s+(\d{5})\s+([A-Za-zÀ-ÿ'’ -]{2,40}?)(?=\s*(?:[;,]|$|\d|CDI|CDD|apprenti|contrat))/i)
  if (adr) {
    out.adresse = adr[1].trim()
    out.code_postal = adr[2]
    out.ville = adr[3].trim().replace(/\s+/g, ' ')
  }

  // NIR : lu par groupes de chiffres (espaces et points tolérés). Un NIR à
  // 15 chiffres n'est retenu que si sa clé est bonne ; sinon on essaie les 13
  // premiers chiffres s'ils forment un groupe complet (le numéro de rue qui
  // suit ne doit pas être avalé comme une clé).
  const runs = texte.match(/\d[\d\s.]*\d/g) || []
  for (const run of runs) {
    const groupes = run.split(/[\s.]+/).filter(Boolean)
    let trouve: string | null = null
    let cle: boolean | undefined
    for (let debut = 0; debut < groupes.length && !trouve; debut++) {
      let acc = ''
      for (let i = debut; i < groupes.length; i++) {
        acc += groupes[i]
        if (acc.length > 15) break
        if (!/^[12378]/.test(acc)) break
        if (acc.length === 15 && cleNirValide(acc)) { trouve = acc; cle = true; break }
        if (acc.length === 13) {
          const suite = acc + (groupes[i + 1] || '')
          if (suite.length === 15 && cleNirValide(suite)) { trouve = suite; cle = true; break }
          trouve = acc; cle = undefined
          if (suite.length !== 15) break
        }
      }
      if (!trouve) {
        // 15 chiffres d'un bloc mais clé fausse : signalé, jamais pris pour bon
        const bloc = groupes.slice(debut).join('')
        if (/^[12378]\d{14}$/.test(bloc)) { trouve = bloc; cle = false }
      }
    }
    if (trouve && trouve !== out.code_postal) {
      out.numero_securite_sociale = trouve
      out.nir_cle_valide = cle
      break
    }
  }

  // Type de contrat
  if (/apprenti|apprentissage/i.test(texte)) { out.type_contrat = 'Apprentissage'; out.statut_bpf = 'apprenti' }
  else if (/professionnalisation|contrat pro\b/i.test(texte)) { out.type_contrat = 'Contrat de professionnalisation'; out.statut_bpf = 'salarie' }
  else if (/\bCDI\b/i.test(texte)) { out.type_contrat = 'CDI'; out.statut_bpf = 'salarie' }
  else if (/\bCDD\b/i.test(texte)) { out.type_contrat = 'CDD'; out.statut_bpf = 'salarie' }
  else if (/alternance/i.test(texte)) { out.type_contrat = 'Alternance' }
  else if (/int[ée]rim/i.test(texte)) { out.type_contrat = 'Intérim'; out.statut_bpf = 'salarie' }

  // Poste : le métier le plus long reconnu dans le texte
  const bas = texte.toLowerCase()
  const metier = METIERS.filter((m) => new RegExp(`(^|[^a-zà-ÿ])${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zà-ÿ]|$)`, 'i').test(bas))
    .sort((a, b) => b.length - a.length)[0]
  if (metier) out.poste = cap(metier)

  return out
}

/**
 * Le NIR encode le sexe (1er chiffre) et l'année + le mois de naissance
 * (chiffres 2 à 5). Contrôle croisé avec la fiche : un écart signale une
 * faute de frappe ou un numéro qui appartient à quelqu'un d'autre.
 */
export function nirCoherent(nir: string, dateNaissance?: string | null, civilite?: string | null): { ok: boolean; raison?: string } {
  if (!/^\d{13}(\d{2})?$/.test(nir)) return { ok: false, raison: 'format' }
  const sexe = nir[0]
  if (dateNaissance && /^\d{4}-\d{2}/.test(dateNaissance) && (sexe === '1' || sexe === '2')) {
    const aa = dateNaissance.slice(2, 4), mm = dateNaissance.slice(5, 7)
    const nirAa = nir.slice(1, 3), nirMm = nir.slice(3, 5)
    // Mois 20 à 42 ou 50 à 99 : cas particuliers (naissance à l'étranger mal connue, etc.)
    const moisSpecial = Number(nirMm) >= 20
    if (nirAa !== aa) return { ok: false, raison: `année ${nirAa} ≠ ${aa}` }
    if (!moisSpecial && nirMm !== mm) return { ok: false, raison: `mois ${nirMm} ≠ ${mm}` }
  }
  const civ = String(civilite || '').toLowerCase()
  if ((sexe === '1' || sexe === '7') && /^(mme|madame|mlle|mademoiselle)/.test(civ)) return { ok: false, raison: 'sexe (NIR homme, fiche femme)' }
  if ((sexe === '2' || sexe === '8') && /^(m\.?$|m\s|monsieur|mr)/.test(civ)) return { ok: false, raison: 'sexe (NIR femme, fiche homme)' }
  return { ok: true }
}
