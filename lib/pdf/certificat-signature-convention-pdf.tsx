import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import {
  PdfDocFooter,
  BRAND_GREEN, BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'

/**
 * Certificat de signature électronique d'une convention : le dossier de
 * preuve de l'acte, sur le modèle des plateformes de signature. Il ne dit que
 * ce que le CRM a réellement enregistré : une preuve absente est écrite comme
 * telle, jamais reconstituée, et la date portée sur la convention n'y figure
 * jamais à la place de l'horodatage réel.
 */

export interface EvenementPreuve {
  at: string
  libelle: string
  detail?: string | null
  /** Modification du document postérieure à sa signature : mise en avant dans le journal */
  alerte?: boolean
}

export interface PreuveSignatureConvention {
  emisLe: string
  document: {
    intitule: string
    numero: string
    identifiant: string
    /** Objet tel que signé ; objetActuel n'est renseigné que s'il a changé depuis */
    objet: string | null
    objetActuel: string | null
    /** Programme tel que signé ; formationActuelle n'est renseignée que s'il a changé depuis */
    formation: string | null
    formationActuelle: string | null
    /** Référence de la session */
    session: string | null
    /** Dates de formation telles qu'elles sont écrites dans la convention */
    datesFormation: string | null
    client: string | null
    clientSiret: string | null
    /** « Entreprise cliente », ou « Stagiaire » pour un contrat de particulier */
    clientLibelle: string
    organisme: string
    organismeSiret: string | null
    organismeNda: string | null
    /** Nom du document dans les phrases : « la convention » ou « le contrat » */
    nomCourt: string
    /** Le même, accordé : « de la convention » ou « du contrat » */
    duDocument: string
    /** Nombre de modifications du contenu enregistrées après la signature */
    modifications: number
    /** Début du journal des modifications, quand la signature lui est antérieure */
    journalModificationsDepuis: string | null
    exemplaire:
      | { etat: 'fige'; sha256: string; figeLe: string | null; verifie: boolean | null; empreinteEnregistree: boolean; introuvable: boolean }
      /** anterieure : signature d'avant l'archivage ; echec : archivage raté, empreinte éventuellement notée à la signature */
      | { etat: 'non_fige'; raison: 'anterieure' | 'echec'; sha256Note: string | null }
  }
  signataire: { nom: string; qualite: string; entreprise: string | null; emailLien: string; procede: string }
  signature: {
    horodatage: string | null
    /**
     * signature : événement enregistré à l'acte ; notification : journal créé au même instant ;
     * enregistre : horodatage conservé sur la convention, sans autre trace ;
     * copie : envoi automatique de l'exemplaire signé, juste après
     */
    sourceHorodatage: 'signature' | 'notification' | 'enregistre' | 'copie' | null
    /** La signature est passée par le parcours qui capte IP, consentement et exemplaire */
    captation: boolean
    ip: string | null
    /** Cette adresse IP a aussi été relevée lors de visites faites depuis un compte du CRM */
    adresseVueAvecCompteCrm: boolean
    appareil: string | null
    userAgent: string | null
    /** Compte du CRM connecté dans le navigateur qui a validé la signature */
    compteCrm: string | null
    consentement:
      | { etat: 'coche'; texte: string }
      | { etat: 'texte_non_enregistre' }
      | { etat: 'sans_case' }
      | { etat: 'non_enregistre' }
    /** Ouverture du document complet (PDF) depuis la page de signature, avant de signer */
    lecture:
      | { etat: 'ouvert'; le: string }
      | { etat: 'ouvert_equipe'; le: string; compte: string }
      | { etat: 'non_ouvert' }
      | { etat: 'non_enregistre' }
    image: string
    imageSha256: string
  }
  evenements: EvenementPreuve[]
  /** Envoi, copie et jeton, dans le cycle de la signature en cours (tirés des traces, hors empreinte) */
  parcours: {
    envoi: {
      /** Dernier e-mail de demande parti avant la signature */
      email: { le: string; pdfJoint: boolean } | null
      /** E-mail de demande resté non parti, postérieur au dernier envoi */
      echec: { le: string; statut: string } | null
    }
    /** Adresses des e-mails de demande partis dans le cycle */
    adresses: string[]
    archiveLe: string | null
    /** Copie de l'exemplaire signé envoyée au client */
    copie: { etat: 'client' | 'echec' | 'non_journalise' | 'aucune'; le: string | null }
    canal: 'portail' | 'lien'
    /** Empreinte SHA-256 du jeton de signature (le jeton lui-même reste valable : jamais imprimé) */
    jeton: string | null
  }
  /** Éléments modifiés après la signature, du signé à l'actuel, les plus lourds d'abord */
  apresSignature: Array<{ libelle: string; avant: string; apres: string; fois: number; dernier: string; avenant: string | null; note: string | null }>
  empreinteDossier: string
}

/** Date et heure de Paris, en toutes lettres. */
export function horodatageLisible(iso: string): string {
  const d = new Date(iso)
  const paris = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d)
  // Le premier du mois s'écrit « 1er »
  return `${paris.replace(/^1 /, '1er ')} (heure de Paris)`
}
const utc = (iso: string) => new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
/** Date et heure courtes ; l'espace insécable garde l'heure avec sa date en fin de ligne. */
const courte = (iso: string) => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(new Date(iso)).replace(/(\d{4}),? /, '$1\u00a0')
const jour = (iso: string) => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(iso))

/**
 * Police des dates et des heures : la même partout dans le certificat, celle
 * du journal des événements (Courier, police standard du PDF).
 */
const POLICE_DATES = 'Courier'
const MOIS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre'
const MOTIF_DATES = [
  `\\d{1,2}(?:er)? (?:${MOIS}) \\d{4}(?: à \\d{2}:\\d{2}(?::\\d{2})?)?`,
  '\\d{2}/\\d{2}/\\d{4}(?:,?[ \\u00a0]\\d{2}:\\d{2}(?::\\d{2})?)?',
  '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2} UTC',
].join('|')

/**
 * Le texte, avec chaque date et chaque heure passée dans la police des dates.
 * `taille` est le corps de cette police : un peu sous celui du texte voisin,
 * le Courier étant plus large.
 */
function avecDates(texte: string | null | undefined, taille: number): React.ReactNode {
  if (!texte) return texte
  const motif = new RegExp(MOTIF_DATES, 'g')
  const morceaux: React.ReactNode[] = []
  let fin = 0
  let m: RegExpExecArray | null
  while ((m = motif.exec(texte)) !== null) {
    if (m.index > fin) morceaux.push(texte.slice(fin, m.index))
    morceaux.push(<Text key={m.index} style={{ fontFamily: POLICE_DATES, fontSize: taille, fontWeight: 400 }}>{m[0]}</Text>)
    fin = m.index + m[0].length
  }
  if (!morceaux.length) return texte
  if (fin < texte.length) morceaux.push(texte.slice(fin))
  return morceaux
}

// ── Mise en page identique pour tous les certificats ──
// Mêmes blocs, mêmes lignes, dans le même ordre : seule la valeur change, et
// une preuve absente s'écrit comme telle. Les blocs ont une hauteur minimale
// commune : le certificat tient sur une page dans les cas connus, et une
// valeur très longue agrandit son bloc (voire passe en page 2) au lieu d'être
// coupée. Rien n'est jamais tronqué en silence.

const TAILLE_LABEL = 7.3
const TAILLE_VALEUR = 7.9
const INTERLIGNE = 1.28
const NBSP = ' '

// Largeurs intérieures des blocs (page de 505 pt, deux colonnes partagées 1,2 / 1
// séparées de 6 pt ; 10 pt de marge et 0,5 pt de bordure de chaque côté)
const PART_LARGE = 1.2
const INTERIEUR_LARGE = 251
const INTERIEUR_ETROIT = 205
const INTERIEUR_PLEIN = 484

// Chasses de Manrope 400 (police du texte), en millièmes de cadratin, mesurées
// sur le fichier de la police : de quoi savoir si une valeur tient sans le moteur PDF
const CARACTERES_MESURES = "0123456789 !\"#$%&'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ’«»…€°·–"
const CHASSES_MESUREES = [610,390,570,553,590,578,621,502,581,621,200,314,392,921,589,902,652,214,426,426,437,577,266,420,254,388,299,306,615,750,615,524,904,634,613,716,672,570,503,705,685,234,464,594,510,841,685,724,604,724,631,617,597,702,604,936,606,556,614,407,388,407,670,660,490,556,592,554,593,585,355,592,594,234,251,496,234,848,594,592,592,593,361,525,401,594,508,768,527,528,530,420,254,420,662,556,556,556,554,585,585,585,585,234,234,592,592,594,594,594,528,1019,942,634,634,634,716,570,570,570,570,234,234,724,724,702,702,702,556,1120,919,222,536,536,632,649,450,227,540]
const CHASSE = new Map(Array.from(CARACTERES_MESURES).map((c, i) => [c, CHASSES_MESUREES[i] / 1000]))
CHASSE.set(NBSP, 0.2)

/** Corps du Courier des dates glissées dans le texte des lignes (voir avecDates). */
const TAILLE_DATES_LIGNE = 6.9

/**
 * Largeur d'un texte en points. Courier a une chasse fixe de 0,6 cadratin ;
 * dans un texte courant, les dates passent en Courier (avecDates) et se
 * mesurent comme telles. Le gras de Manrope est un peu plus large.
 */
function largeurTexte(t: string, taille: number, mono = false, gras = false, tailleDates = TAILLE_DATES_LIGNE): number {
  if (mono) return Array.from(t).length * 0.6 * taille
  let w = 0
  let fin = 0
  const motif = new RegExp(MOTIF_DATES, 'g')
  let m: RegExpExecArray | null
  const manrope = (x: string) => { for (const ch of x) w += taille * (CHASSE.get(ch) ?? 0.6) * (gras ? 1.07 : 1) }
  while ((m = motif.exec(t)) !== null) {
    manrope(t.slice(fin, m.index))
    w += Array.from(m[0]).length * 0.6 * tailleDates
    fin = m.index + m[0].length
  }
  manrope(t.slice(fin))
  return w
}

/** Le texte découpé en lignes comme le moteur PDF le fait : aux espaces, mot par mot. */
function decouper(t: string, largeur: number, taille: number, mono = false, gras = false): string[] {
  const lignes: string[] = []
  for (const paragraphe of t.split('\n')) {
    let ligne = ''
    for (const mot of paragraphe.split(/ +/)) {
      const essai = ligne ? `${ligne} ${mot}` : mot
      if (!ligne || largeurTexte(essai, taille, mono, gras) <= largeur) ligne = essai
      else { lignes.push(ligne); ligne = mot }
    }
    lignes.push(ligne)
  }
  return lignes
}

/**
 * Coupe un texte trop long pour `lignes` lignes de `largeur` points, avec « … ».
 * Le moteur PDF ne coupe rien lui-même : sa coupure mange des espaces et peut
 * faire disparaître la fin sans le dire. Jamais de coupure au milieu d'une date.
 */
function ajuster(t: string, lignes: number, largeur: number, taille: number, mono = false, gras = false): string {
  const utile = largeur * 0.97
  const tient = (x: string) => {
    const l = decouper(x, utile, taille, mono, gras)
    return l.length <= lignes && l.every((y) => largeurTexte(y, taille, mono, gras) <= utile)
  }
  if (tient(t)) return t
  const dates: Array<[number, number]> = []
  const motif = new RegExp(MOTIF_DATES, 'g')
  let m: RegExpExecArray | null
  while ((m = motif.exec(t)) !== null) dates.push([m.index, m.index + m[0].length])
  for (let n = t.length - 1; n > 0; n--) {
    if (dates.some(([a, b]) => n > a && n < b)) continue
    const essai = `${t.slice(0, n).replace(/[\s,;:·(-]+$/, '')}…`
    if (tient(essai)) return essai
  }
  return '…'
}

/**
 * Adresses e-mail sur `lignes` lignes au plus. Une adresse n'a pas d'espace où
 * passer à la ligne : trop longue, elle y passe après son @ (retour à la ligne
 * réel, sans tiret ajouté). Le reste se coupe avec « … ».
 */
function adressesEnLignes(texte: string, lignes: number, largeur: number, taille: number): string {
  if (!texte.includes('@')) return ajuster(texte, lignes, largeur, taille)
  const tient = (t: string) => largeurTexte(t, taille) <= largeur * 0.97
  const unites: Array<{ t: string; coupe: boolean }> = []
  const adresses = texte.split(/,\s*/).filter(Boolean)
  adresses.forEach((a, i) => {
    const fin = i < adresses.length - 1 ? ',' : ''
    const k = a.indexOf('@') + 1
    if (tient(a + fin) || k <= 0) unites.push({ t: a + fin, coupe: false })
    else { unites.push({ t: a.slice(0, k), coupe: true }); unites.push({ t: ajuster(a.slice(k) + fin, 1, largeur, taille), coupe: false }) }
  })
  const sortie: string[] = []
  let ligne = ''
  for (const u of unites) {
    const essai = ligne ? `${ligne} ${u.t}` : u.t
    if (ligne && !tient(essai)) { sortie.push(ligne); ligne = u.t } else ligne = essai
    if (u.coupe) { sortie.push(ligne); ligne = '' }
  }
  if (ligne) sortie.push(ligne)
  if (sortie.length <= lignes) return sortie.join('\n')
  const gardees = sortie.slice(0, lignes)
  gardees[lignes - 1] = ajuster(`${gardees[lignes - 1]} …`.replace(/,? …$/, ' …'), 1, largeur, taille)
  return gardees.join('\n')
}

const POLICE_DATES_GRAS = 'Courier-Bold'
/** Une empreinte SHA-256 en deux moitiés : sans espace, elle ne passe pas à la ligne d'elle-même. */
const enDeuxLignes = (h: string) => `${h.slice(0, 32)}\n${h.slice(32)}`
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
/** Dates écrites à l'anglaise (« 2026-07-23 ») remises au format du certificat. */
const datesFr = (t: string) => t.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1')

/** Une ligne « libellé : valeur » ; la valeur passe à la ligne autant qu'il le faut, sans jamais être coupée. */
const Ligne = ({ label, children, mono, largeur = 78, fort }: {
  label: string; children: React.ReactNode; mono?: boolean; largeur?: number; fort?: boolean; interieur?: number
}) => (
  <View style={{ flexDirection: 'row', marginBottom: 2.8 }} wrap={false}>
    <Text style={{ fontSize: TAILLE_LABEL, color: SURFACE_500, width: largeur, lineHeight: INTERLIGNE }}>{label}</Text>
    <Text style={{
      fontSize: mono ? 6.9 : TAILLE_VALEUR, color: SURFACE_900, flex: 1, lineHeight: INTERLIGNE,
      fontFamily: mono ? (fort ? POLICE_DATES_GRAS : POLICE_DATES) : 'Satoshi', fontWeight: !mono && fort ? 700 : 400,
    }}>
      {!mono && typeof children === 'string' ? avecDates(children, TAILLE_DATES_LIGNE) : children}
    </Text>
  </View>
)

const Bloc = ({ titre, hauteur, children, style }: { titre: string; hauteur: number; children: React.ReactNode; style?: any }) => (
  <View wrap={false} style={{ minHeight: hauteur, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 5, ...style }}>
    <Text style={{ fontSize: 8.2, fontWeight: 700, color: SURFACE_900, marginBottom: 4 }}>{titre}</Text>
    {children}
  </View>
)

export function CertificatSignatureConventionPDF({ preuve, org }: { preuve: PreuveSignatureConvention; org: any }) {
  const { document: doc, signataire, signature, parcours } = preuve
  const contrat = doc.nomCourt === 'le contrat'
  const Type = contrat ? 'Contrat' : 'Convention'
  const auPlusTard = signature.sourceHorodatage === 'copie'
  const exemplaire = doc.exemplaire
  const elements = preuve.apresSignature
  const pasEncore = 'Non relevée à cette date'

  const provenance =
    signature.sourceHorodatage === 'signature' ? 'enregistré par le serveur à l’instant de la signature'
    : signature.sourceHorodatage === 'notification' ? `relevé sur la notification « ${Type} signé${contrat ? '' : 'e'} par le client », créée par le serveur au moment de la signature`
    : signature.sourceHorodatage === 'enregistre' ? `enregistré par le serveur sur ${doc.nomCourt} au moment de la signature`
    : signature.sourceHorodatage === 'copie' ? 'au plus tard : seule trace, l’envoi automatique de l’exemplaire signé, quelques secondes après la validation'
    : 'aucune trace d’horodatage conservée'

  const envoi = parcours.envoi
  const lienEnvoye = parcours.canal === 'portail' ? 'Signature depuis l’espace client, sans e-mail'
    : envoi.email ? `${courte(envoi.email.le)}, par e-mail${envoi.email.pdfJoint ? ' (PDF joint)' : ''}${envoi.echec ? ` ; e-mail suivant non parti (${envoi.echec.statut})` : ''}`
    : envoi.echec ? `E-mail non parti (${envoi.echec.statut}), le ${courte(envoi.echec.le)}`
    : 'Aucun e-mail enregistré'
  const copie =
    parcours.copie.etat === 'client' ? courte(parcours.copie.le!)
    : parcours.copie.etat === 'echec' ? `Envoi en échec, le ${courte(parcours.copie.le!)}`
    : parcours.copie.etat === 'non_journalise' ? 'Envoi non journalisé à cette date'
    : 'Aucun envoi au client enregistré'
  const archivage = parcours.archiveLe ? courte(parcours.archiveLe)
    : exemplaire.etat === 'fige' ? 'Figé, date non relevée'
    : exemplaire.raison === 'anterieure' ? 'Non archivé : antérieur à l’archivage automatique'
    : 'Échec de l’archivage'
  // Les champs de la session se regroupent : « session (date de fin, horaires, ville) »
  const elementsLus: string[] = []
  const champsSession = elements.filter((e) => / de la session$/.test(e.libelle)).map((e) => e.libelle.replace(/ de la session$/, '').toLowerCase())
  for (const e of elements) {
    if (/ de la session$/.test(e.libelle)) {
      if (!elementsLus.some((x) => x.startsWith('session ('))) elementsLus.push(`session (${champsSession.join(', ')})`)
    } else elementsLus.push(e.libelle.charAt(0).toLowerCase() + e.libelle.slice(1))
  }
  // Le constat d'abord : une coupure ne peut emporter que la fin de la liste
  const modifications = elements.length === 0
    ? `Aucune modification ${doc.duDocument} ou de sa session enregistrée après la signature${doc.journalModificationsDepuis ? ` (suivi depuis le ${jour(doc.journalModificationsDepuis)})` : ''}`
    : `Le document actuel diffère de l’exemplaire signé : ${pluriel(doc.modifications, 'modification')} après la signature, sans nouvelle signature du client (${elementsLus.join(', ')}).`

  return (
    <Document title={`Certificat de signature ${doc.numero}`} author={doc.organisme}>
      <Page size="A4" style={{ fontFamily: 'Satoshi', fontSize: 8, color: SURFACE_900, paddingTop: 30, paddingBottom: 46, paddingHorizontal: 45 }}>

        {/* En-tête */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 9, borderBottomWidth: 0.7, borderBottomColor: SURFACE_200, marginBottom: 9 }}>
          {org?.logo_url
            ? <Image src={org.logo_url} style={{ height: 30, width: 84, objectFit: 'contain', objectPosition: 'left' }} />
            : <Text style={{ fontSize: 14, fontWeight: 700, color: BRAND_GREEN }}>{doc.organisme}</Text>}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 15, color: SURFACE_900, letterSpacing: -0.3 }}>Certificat de signature électronique</Text>
            <Text style={{ fontSize: 7.6, color: SURFACE_500, marginTop: 2.5 }}>
              {Type} {doc.numero} · émis le <Text style={{ fontFamily: POLICE_DATES, fontSize: 7 }}>{courte(preuve.emisLe)}</Text> (heure de Paris)
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.45, marginBottom: 8 }}>
          {doc.organisme} atteste que son système de gestion (CRM) a enregistré la signature électronique {doc.duDocument} décrit{contrat ? '' : 'e'} ci-dessous,
          sous le nom déclaré par le signataire, {auPlusTard ? 'au plus tard ' : ''}à la date et à l’heure indiquées. Ni l’organisme ni un tiers n’ont vérifié l’identité du signataire.
        </Text>

        {/* L'instant de la signature */}
        <View style={{ backgroundColor: BRAND_ULTRA_LIGHT, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 7.6, color: BRAND_GREEN, fontWeight: 700 }}>
            {signature.horodatage ? (auPlusTard ? 'Signature électronique enregistrée au plus tard le' : 'Signature électronique enregistrée le') : 'Date et heure de la signature électronique'}
          </Text>
          <Text style={{ fontFamily: POLICE_DATES_GRAS, fontSize: 13, color: SURFACE_900, marginTop: 3 }}>
            {signature.horodatage ? horodatageLisible(signature.horodatage) : 'Non enregistrées'}
          </Text>
          <Text style={{ fontSize: 7, color: SURFACE_700, marginTop: 3 }}>
            {signature.horodatage ? <Text style={{ fontFamily: POLICE_DATES, fontSize: 6.6 }}>{utc(signature.horodatage)}</Text> : null}
            {signature.horodatage ? ' · ' : ''}{provenance}
          </Text>
        </View>

        {/* Document et signataire */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <Bloc titre={`${Type} signé${contrat ? '' : 'e'}`} hauteur={176} style={{ flex: PART_LARGE }}>
            <Ligne label="Document">{doc.intitule}</Ligne>
            <Ligne label="Référence">{doc.numero}</Ligne>
            <Ligne label={doc.clientLibelle}>{[doc.client || 'Non renseigné', doc.clientSiret ? `SIRET${NBSP}${doc.clientSiret}` : null].filter(Boolean).join(' · ')}</Ligne>
            <Ligne label="Formation">{doc.formation || 'Non renseignée'}</Ligne>
            <Ligne label="Dates de formation" mono>{doc.datesFormation ? datesFr(doc.datesFormation) : 'Non précisées'}</Ligne>
            <Ligne label="Session">{doc.session || 'Aucune'}</Ligne>
            <Ligne label="Organisme">{[doc.organisme, doc.organismeSiret ? `SIRET${NBSP}${doc.organismeSiret}` : null, doc.organismeNda ? `NDA${NBSP}${doc.organismeNda}` : null].filter(Boolean).join(' · ')}</Ligne>
            <Ligne label="Identifiant" mono>{doc.identifiant}</Ligne>
          </Bloc>
          <Bloc titre="Signataire" hauteur={176} style={{ flex: 1 }}>
            <Ligne label="Nom déclaré" largeur={64} interieur={INTERIEUR_ETROIT}>{signataire.nom}</Ligne>
            <Ligne label="Qualité déclarée" largeur={64} interieur={INTERIEUR_ETROIT}>
              {contrat ? 'Stagiaire, partie au contrat'
                : signature.consentement.etat === 'coche' ? 'Représentant de l’entreprise cliente (case cochée)'
                : 'Non déclarée (pas de case à cette date)'}
            </Ligne>
            <Ligne label="Procédé" largeur={64} interieur={INTERIEUR_ETROIT}>
              {parcours.canal === 'portail' ? 'Espace client, puis signature tracée à l’écran' : 'Lien unique propre au document, puis signature tracée à l’écran'}
            </Ligne>
            <View style={{ marginTop: 3, height: 56, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE_50 }}>
              <Image src={signature.image} style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain' }} />
            </View>
          </Bloc>
        </View>

        {/* Signature et envoi */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <Bloc titre="Signature électronique" hauteur={150} style={{ flex: PART_LARGE }}>
            <Ligne label="Date et heure" mono fort>
              {signature.horodatage ? `${courte(signature.horodatage)} (heure de Paris)${auPlusTard ? ', au plus tard' : ''}` : 'Non enregistrées'}
            </Ligne>
            <Ligne label="Adresse IP">{signature.ip || (signature.captation ? 'Non enregistrée' : pasEncore)}</Ligne>
            <Ligne label="Appareil">{signature.appareil ? `${signature.appareil}${signature.captation ? '' : ' (déclaré par la page)'}` : signature.captation ? 'Non enregistré' : 'Non relevé à cette date'}</Ligne>
            <Ligne label="Consentement">
              {signature.consentement.etat === 'coche' ? `Case cochée : « ${signature.consentement.texte} »`
                : signature.consentement.etat === 'texte_non_enregistre' ? 'Case obligatoire, texte non enregistré'
                : signature.consentement.etat === 'non_enregistre' ? 'Non enregistré'
                : 'Pas de case de consentement à cette date'}
            </Ligne>
            <Ligne label="Jeton de signature" mono>{parcours.jeton ? <>{enDeuxLignes(parcours.jeton)}</> : 'Non conservé'}</Ligne>
          </Bloc>
          <Bloc titre="Envoi et archivage" hauteur={150} style={{ flex: 1 }}>
            <Ligne label="Lien envoyé le" largeur={74} interieur={INTERIEUR_ETROIT}>{lienEnvoye}</Ligne>
            <Ligne label="Destinataire" largeur={74} interieur={INTERIEUR_ETROIT}>
              {parcours.canal === 'portail' ? 'Espace client du client'
                : parcours.adresses.length ? <>{adressesEnLignes(parcours.adresses.join(', '), 12, INTERIEUR_ETROIT - 74, TAILLE_VALEUR)}</>
                : 'Aucun e-mail enregistré'}
            </Ligne>
            <Ligne label="Archivage" largeur={74} interieur={INTERIEUR_ETROIT} mono={!!parcours.archiveLe}>{archivage}</Ligne>
            <Ligne label="Copie au client" largeur={74} interieur={INTERIEUR_ETROIT} mono={parcours.copie.etat === 'client'}>{copie}</Ligne>
          </Bloc>
        </View>

        {/* Intégrité */}
        <Bloc titre="Intégrité" hauteur={132} style={{ marginBottom: 8, backgroundColor: BRAND_ULTRA_LIGHT, borderColor: BRAND_ULTRA_LIGHT }}>
          <Ligne label="Exemplaire signé" largeur={118} interieur={INTERIEUR_PLEIN}>
            {exemplaire.etat === 'fige'
              ? `Figé à la signature et conservé par l’organisme, qui le produit sur demande. ${
                  exemplaire.introuvable ? 'Attention : introuvable dans l’archive à l’émission de ce certificat.'
                  : !exemplaire.empreinteEnregistree ? 'Empreinte calculée à l’émission de ce certificat.'
                  : exemplaire.verifie === true ? 'Relu à l’émission de ce certificat : empreinte identique.'
                  : exemplaire.verifie === false ? 'Attention : il ne correspond plus à l’empreinte enregistrée.'
                  : 'Non relu à l’émission de ce certificat.'}`
              : exemplaire.raison === 'anterieure'
                ? `Non figé : aucun exemplaire conservé à la signature ; le PDF ${doc.duDocument} est régénéré avec les données actuelles et peut différer du document signé.`
                : 'Non conservé : l’archivage a échoué à la signature ; un PDF régénéré peut différer du document signé.'}
          </Ligne>
          <Ligne label="Empreinte de l’exemplaire" largeur={118} interieur={INTERIEUR_PLEIN} mono>
            {exemplaire.etat === 'fige' ? exemplaire.sha256 : exemplaire.sha256Note ? `${exemplaire.sha256Note} (notée à la signature)` : 'Aucune'}
          </Ligne>
          <Ligne label="Modifications" largeur={118} interieur={INTERIEUR_PLEIN}>{modifications}</Ligne>
          <Ligne label="Empreinte du tracé" largeur={118} interieur={INTERIEUR_PLEIN} mono>{signature.imageSha256}</Ligne>
          <Ligne label="Empreinte des preuves" largeur={118} interieur={INTERIEUR_PLEIN} mono>{preuve.empreinteDossier}</Ligne>
          <Text style={{ fontSize: 6.6, color: SURFACE_500, lineHeight: 1.3 }}>
            Empreintes SHA-256 calculées par le CRM ; le jeton de signature est l’empreinte du lien unique, qui n’est jamais imprimé ; celle des preuves porte sur
            l’ensemble des données enregistrées pour cette signature. Aucun scellement par un tiers.
          </Text>
        </Bloc>

        {/* Valeur juridique */}
        <Text style={{ fontSize: 6.5, color: SURFACE_500, lineHeight: 1.4 }}>
          Signature électronique de niveau simple (règlement (UE) n°{NBSP}910/2014, eIDAS, article 3, point 10) : son effet juridique et sa recevabilité comme preuve en justice
          ne peuvent être refusés au seul motif qu’elle est électronique ou non qualifiée (article 25, paragraphe 1), mais elle ne bénéficie pas de la présomption de fiabilité
          de l’article 1367 du Code civil, réservée à la signature qualifiée (décret n°{NBSP}2017-1416 du 28 septembre 2017). Établi par {doc.organisme}, partie à l’acte, à partir de son CRM,
          ce document n’est pas un certificat au sens de l’article 3, points 14 et 15, du règlement et n’émane d’aucun prestataire de services de confiance.
        </Text>

        <PdfDocFooter numero={`Certificat de signature · ${doc.numero}`} org={org} />
      </Page>
    </Document>
  )
}

/** Appareil et navigateur, en clair, à partir de l'en-tête user-agent. */
export function decrireAppareil(ua: string | null | undefined): string | null {
  if (!ua) return null
  // Pas de version du système : Safari et Chrome la figent ou la réduisent dans
  // cet en-tête, elle serait souvent fausse (l'en-tête brut reste au dossier de preuve)
  const systeme =
    /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : 'Système non identifié'
  const navigateur =
    /EdgA?\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'navigateur non identifié'
  return `${systeme}, ${navigateur}`
}
