import * as React from 'react'
import { Document, Page, View, Text, Image, Svg, Path } from '@react-pdf/renderer'
import { BRAND_GREEN, SURFACE_400, SURFACE_700, SURFACE_900 } from './components'

/**
 * Certificat de signature électronique d'une convention, sur le modèle de la
 * dernière page des conventions signées dans Dendreo (demande de Brahim du
 * 19/10/2026) : une page simple, le document et l'organisme en neuf cases, puis
 * la signature (tracé, signataire, dates, niveau de sécurité, adresse IP).
 * Il ne dit que ce que le CRM a réellement enregistré : une preuve absente est
 * écrite comme telle, et la date portée sur la convention ne remplace jamais
 * l'horodatage réel. Les traces internes restent dans le dossier complet, que
 * couvre l'empreinte des preuves.
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
    /** Nombre de pages de l'exemplaire signé archivé */
    pagesDocument: number | null
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

/** « jeudi 15 octobre 2026 à 16:52:20 », heure de Paris. */
function dateLongue(iso: string): string {
  const jourSemaine = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long' }).format(new Date(iso))
  return `${jourSemaine} ${horodatageLisible(iso).replace(' (heure de Paris)', '')}`
}

/** Une empreinte SHA-256 en deux moitiés : sans espace, elle ne passe pas à la ligne d'elle-même. */
const enDeuxLignes = (h: string) => `${h.slice(0, 32)}\n${h.slice(32)}`
/** Un identifiant (UUID) coupé après son troisième tiret, comme sur le modèle. */
const identifiantEnDeux = (id: string) => id.replace(/^((?:[^-]+-){3})/, '$1\n')

const VERT = '#3FA97C'
const VALEUR = '#5E6B7A'

/** Rosette « signé » (icône Lucide badge-check). */
const Rosette = () => (
  <Svg width={36} height={36} viewBox="0 0 24 24">
    <Path
      d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      stroke={VERT} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round"
    />
    <Path d="m9 12 2 2 4-4" stroke={VERT} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)

const Section = ({ titre, style }: { titre: string; style?: any }) => (
  <View style={{ borderBottomWidth: 0.7, borderBottomColor: SURFACE_700, paddingBottom: 5, marginBottom: 14, ...style }}>
    <Text style={{ fontSize: 12.5, color: SURFACE_900 }}>{titre}</Text>
  </View>
)

/** Une case : le libellé, puis la valeur en gris. */
const Case = ({ label, children, mono, style, colonne }: { label: string; children: React.ReactNode; mono?: boolean; style?: any; colonne?: boolean }) => (
  <View style={{ ...(colonne ? {} : { flex: 1 }), paddingRight: 14, marginBottom: 14, ...style }} wrap={false}>
    <Text style={{ fontSize: 9, color: SURFACE_900 }}>{label}</Text>
    <Text style={{ fontSize: mono ? 7.4 : 9, color: VALEUR, marginTop: 2, lineHeight: 1.35, fontFamily: mono ? 'Courier' : 'Satoshi' }}>{children}</Text>
  </View>
)

const Rangee = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row' }}>{children}</View>
)

export function CertificatSignatureConventionPDF({ preuve, org }: { preuve: PreuveSignatureConvention; org: any }) {
  const { document: doc, signataire, signature, parcours } = preuve
  const contrat = doc.nomCourt === 'le contrat'
  const auPlusTard = signature.sourceHorodatage === 'copie'
  const exemplaire = doc.exemplaire
  const organisme = org?.name || doc.organisme

  const etat = [
    'Signée',
    preuve.apresSignature.length ? 'modifiée depuis la signature' : null,
    exemplaire.etat === 'fige' && (exemplaire.introuvable || exemplaire.verifie === false) ? 'exemplaire archivé à vérifier' : null,
  ].filter(Boolean).join(' ; ')
  const pages = parcours.pagesDocument != null ? String(parcours.pagesDocument)
    : exemplaire.etat === 'fige' ? 'Non lu' : 'Exemplaire non conservé'
  const horodatage = !signature.horodatage ? 'Non conservé'
    : auPlusTard ? 'Au plus tard (envoi automatique de l’exemplaire signé)'
    : 'Serveur du CRM'
  const emetteur = [
    org?.legal_name || organisme,
    org?.address || null,
    [org?.postal_code, org?.city].filter(Boolean).join(' ') || null,
    [org?.phone || org?.telephone, org?.email_contact || org?.email].filter(Boolean).join(' - ') || null,
  ].filter(Boolean).join('\n')
  const niveau = parcours.canal === 'portail' ? 'Espace client' : parcours.envoi.email ? 'E-mail (lien unique)' : 'Lien unique'
  const dateEnvoi = parcours.canal === 'portail' ? 'Espace client, sans e-mail'
    : parcours.envoi.email ? dateLongue(parcours.envoi.email.le) : 'Aucun e-mail enregistré'
  const dateSignature = signature.horodatage ? `${auPlusTard ? 'au plus tard ' : ''}${dateLongue(signature.horodatage)}` : 'Non enregistrée'

  return (
    <Document title={`Certificat de signature ${doc.numero}`} author={doc.organisme}>
      <Page size="A4" style={{ fontFamily: 'Satoshi', color: SURFACE_900, paddingTop: 46, paddingBottom: 110, paddingHorizontal: 50 }}>

        <View style={{ alignItems: 'center', marginBottom: 34 }}>
          <Rosette />
          <Text style={{ fontSize: 9.5, color: VALEUR, marginTop: 6, textAlign: 'center', lineHeight: 1.4 }}>
            {`Document signé électroniquement\nsur le CRM de ${organisme}`}
          </Text>
        </View>

        <Section titre="Certificat de signature électronique" />
        <View style={{ paddingLeft: 18 }}>
          <Rangee>
            <Case label="Identifiant du document">{identifiantEnDeux(doc.identifiant)}</Case>
            <Case label="Pages du document">{pages}</Case>
            <Case label="État">{etat}</Case>
          </Rangee>
          <Rangee>
            <Case label="Jeton de signature" mono>{parcours.jeton ? enDeuxLignes(parcours.jeton) : 'Non conservé'}</Case>
            <Case label="Référence">{`${contrat ? 'Contrat' : 'Convention'} ${doc.numero}`}</Case>
            <Case label="Fuseau horaire">(Europe/Paris)</Case>
          </Rangee>
          <Rangee>
            <Case label="Horodatage">{horodatage}</Case>
            <Case label="Signature">1</Case>
            <Case label="Émetteur du document">{emetteur}</Case>
          </Rangee>
          <Rangee>
            <Case label="Empreinte du document signé (SHA-256)" mono={exemplaire.etat === 'fige'}>
              {exemplaire.etat === 'fige' ? enDeuxLignes(exemplaire.sha256) : 'Exemplaire signé non conservé à la signature'}
            </Case>
            <Case label="Empreinte du dossier de preuve (SHA-256)" mono style={{ flex: 2 }}>{enDeuxLignes(preuve.empreinteDossier)}</Case>
          </Rangee>
        </View>

        <Section titre="Signature" style={{ marginTop: 10 }} />
        <View style={{ flexDirection: 'row', paddingLeft: 18 }} wrap={false}>
          <View style={{ width: 176, marginRight: 22 }}>
            <Text style={{ fontSize: 9, color: VALEUR }}>Signature</Text>
            <View style={{ borderWidth: 1, borderColor: VERT, height: 90, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <Image src={signature.image} style={{ maxHeight: 78, maxWidth: 164, objectFit: 'contain' }} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Case colonne label="Signataire">{signataire.nom}</Case>
            <Case colonne label="Date de signature">{dateSignature}</Case>
            <Case colonne label="Date d’envoi">{dateEnvoi}</Case>
          </View>
          <View style={{ flex: 1 }}>
            <Case colonne label="Niveau de sécurité">{niveau}</Case>
            <Case colonne label="IP">{signature.ip || 'Non relevée'}</Case>
            <Case colonne label="Appareil">{signature.appareil || 'Non relevé'}</Case>
          </View>
        </View>

        <Text style={{ fontSize: 7, color: VALEUR, marginTop: 18, lineHeight: 1.4 }}>
          Signature électronique de niveau simple au sens du règlement (UE) n°{' '}910/2014 (eIDAS). L’identité du signataire n’a été vérifiée ni par l’organisme ni par un tiers.
        </Text>

        <View fixed style={{ position: 'absolute', bottom: 34, left: 50, right: 50, alignItems: 'center' }}>
          {org?.logo_url
            ? <Image src={org.logo_url} style={{ height: 30, width: 110, objectFit: 'contain' }} />
            : <Text style={{ fontSize: 14, fontWeight: 700, color: BRAND_GREEN }}>{organisme}</Text>}
          <Text style={{ fontSize: 8.5, color: SURFACE_700, marginTop: 6 }}>Organisme de formation professionnelle</Text>
          {org?.email_contact || org?.email
            ? <Text style={{ fontSize: 8, color: SURFACE_400, marginTop: 3 }}>{org?.email_contact || org?.email}</Text>
            : null}
        </View>
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
