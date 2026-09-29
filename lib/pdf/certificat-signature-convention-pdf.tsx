import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import {
  PdfDocHeader, PdfDocFooter, PdfSectionTitle, shared,
  BRAND_GREEN, BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'

/**
 * Certificat de signature électronique d'une convention : le dossier de
 * preuve de l'acte, sur le modèle des plateformes de signature. Il ne dit que
 * ce que le CRM a réellement enregistré : une preuve absente est écrite comme
 * telle, jamais reconstituée.
 */

export interface EvenementPreuve { at: string; libelle: string; detail?: string | null }

export interface PreuveSignatureConvention {
  emisLe: string
  document: {
    intitule: string
    numero: string
    identifiant: string
    objet: string | null
    formation: string | null
    session: string | null
    client: string | null
    clientSiret: string | null
    /** « Entreprise cliente », ou « Stagiaire » pour un contrat de particulier */
    clientLibelle: string
    organisme: string
    organismeSiret: string | null
    organismeNda: string | null
    /** Nom du document dans les phrases : « la convention » ou « le contrat » */
    nomCourt: string
    exemplaire:
      | { etat: 'fige'; sha256: string; figeLe: string | null; verifie: boolean | null; empreinteEnregistree: boolean; introuvable: boolean }
      /** anterieure : signature d'avant l'archivage ; echec : archivage raté, empreinte éventuellement notée à la signature */
      | { etat: 'non_fige'; raison: 'anterieure' | 'echec'; sha256Note: string | null }
  }
  signataire: { nom: string; qualite: string; entreprise: string | null; emailLien: string; procede: string }
  signature: {
    horodatage: string | null
    /** signature : enregistré à l'acte ; notification : journal créé au même instant ; copie : envoi automatique de l'exemplaire signé, juste après */
    sourceHorodatage: 'signature' | 'notification' | 'copie' | null
    ip: string | null
    appareil: string | null
    userAgent: string | null
    consentement: { etat: 'coche'; texte: string } | { etat: 'coche_non_conserve' } | { etat: 'absent' }
    image: string
    imageSha256: string
  }
  evenements: EvenementPreuve[]
  empreinteDossier: string
}

/** Date et heure de Paris, et la même en UTC, pour qu'aucune lecture ne soit ambiguë. */
export function horodatageLisible(iso: string): string {
  const d = new Date(iso)
  const paris = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d)
  return `${paris} (heure de Paris)`
}
const utc = (iso: string) => new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
const courte = (iso: string) => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(new Date(iso))

const Ligne = ({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) => (
  <View style={{ flexDirection: 'row', marginBottom: 4.5 }} wrap={false}>
    <Text style={{ fontSize: 8.3, color: SURFACE_500, width: 128 }}>{label}</Text>
    <Text style={{ fontSize: mono ? 7.6 : 8.5, color: SURFACE_900, flex: 1, fontFamily: mono ? 'Courier' : 'Satoshi', lineHeight: 1.35 }}>{children}</Text>
  </View>
)
const Note = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: 7.4, color: SURFACE_500, lineHeight: 1.45, marginTop: 3 }}>{children}</Text>
)
/** Une empreinte SHA-256 en deux lignes : en police à chasse fixe, elle ne se coupe pas d'elle-même. */
const enDeux = (h: string) => `${h.slice(0, 32)}\n${h.slice(32)}`

const Carte = ({ children }: { children: React.ReactNode }) => (
  <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 12 }}>{children}</View>
)

export function CertificatSignatureConventionPDF({ preuve, org }: { preuve: PreuveSignatureConvention; org: any }) {
  const { document: doc, signataire, signature } = preuve
  return (
    <Document title={`Certificat de signature ${doc.numero}`} author={doc.organisme}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader
          docTitle="Certificat de signature électronique"
          numero={doc.numero}
          date={`Émis le ${horodatageLisible(preuve.emisLe)}`}
          org={org}
        />

        <Text style={{ fontSize: 8.8, color: SURFACE_700, lineHeight: 1.5, marginBottom: 16 }}>
          {doc.organisme} certifie que le document décrit ci-dessous a été signé électroniquement par le signataire
          indiqué, et rassemble dans ce certificat les éléments de preuve enregistrés lors de la signature.
        </Text>

        <View style={shared.section}>
          <PdfSectionTitle icon="fileText">Document signé</PdfSectionTitle>
          <Carte>
            <Ligne label="Document">{doc.intitule}</Ligne>
            <Ligne label="Référence">{doc.numero}</Ligne>
            {doc.objet ? <Ligne label="Objet">{doc.objet}</Ligne> : null}
            {doc.formation ? <Ligne label="Formation">{doc.formation}</Ligne> : null}
            {doc.session ? <Ligne label="Session">{doc.session}</Ligne> : null}
            {doc.client ? <Ligne label={doc.clientLibelle}>{[doc.client, doc.clientSiret ? `SIRET ${doc.clientSiret}` : null].filter(Boolean).join(' · ')}</Ligne> : null}
            <Ligne label="Organisme de formation">
              {[doc.organisme, doc.organismeSiret ? `SIRET ${doc.organismeSiret}` : null, doc.organismeNda ? `NDA ${doc.organismeNda}` : null].filter(Boolean).join(' · ')}
            </Ligne>
            <Ligne label="Identifiant du document" mono>{doc.identifiant}</Ligne>
          </Carte>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle icon="userCheck">Signataire</PdfSectionTitle>
          <Carte>
            <Ligne label="Nom déclaré">{signataire.nom}</Ligne>
            <Ligne label="Qualité">{signataire.qualite}</Ligne>
            {signataire.entreprise ? <Ligne label="Pour le compte de">{signataire.entreprise}</Ligne> : null}
            <Ligne label="Lien de signature transmis à">{signataire.emailLien}</Ligne>
            <Ligne label="Procédé">{signataire.procede}</Ligne>
          </Carte>
        </View>

        <View style={shared.section} wrap={false}>
          <PdfSectionTitle icon="penLine">Signature</PdfSectionTitle>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1.6 }}>
              <Carte>
                <Ligne label="Date et heure">
                  {signature.horodatage
                    ? `${signature.sourceHorodatage === 'copie' ? 'Au plus tard le ' : ''}${horodatageLisible(signature.horodatage)}`
                    : 'Non enregistrées'}
                </Ligne>
                {signature.horodatage ? <Ligne label="Temps universel" mono>{utc(signature.horodatage)}</Ligne> : null}
                <Ligne label="Adresse IP">{signature.ip || 'Non enregistrée'}</Ligne>
                <Ligne label="Appareil">{signature.appareil || 'Non enregistré'}</Ligne>
                <Ligne label="Consentement">
                  {signature.consentement.etat === 'coche'
                    ? `Case cochée : « ${signature.consentement.texte} »`
                    : signature.consentement.etat === 'coche_non_conserve'
                      ? 'Case cochée (obligatoire pour signer depuis le 29 septembre 2026) ; texte non conservé'
                      : 'Non recueilli par une case dédiée'}
                </Ligne>
                {signature.sourceHorodatage === 'notification' ? (
                  <Note>
                    Horodatage relevé dans le journal du CRM : la notification « Convention signée par le client » est créée
                    par le serveur à l’instant même de la signature.
                  </Note>
                ) : null}
                {signature.sourceHorodatage === 'copie' ? (
                  <Note>
                    Seul horodatage conservé pour cette signature : l’envoi automatique de l’exemplaire signé, que le serveur
                    déclenche quelques secondes après la validation du signataire.
                  </Note>
                ) : null}
                {!signature.ip ? (
                  <Note>L’adresse IP des signataires est enregistrée pour les signatures faites depuis le 29 septembre 2026.</Note>
                ) : null}
              </Carte>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ backgroundColor: SURFACE_50, paddingVertical: 5, paddingHorizontal: 9, borderBottomWidth: 0.5, borderBottomColor: SURFACE_200 }}>
                  <Text style={{ fontSize: 7.8, fontWeight: 700, color: SURFACE_900 }}>Signature tracée</Text>
                </View>
                <View style={{ padding: 8, alignItems: 'center', justifyContent: 'center', height: 86 }}>
                  <Image src={signature.image} style={{ maxHeight: 70, maxWidth: 170, objectFit: 'contain' }} />
                </View>
              </View>
              <Text style={{ fontSize: 6.6, color: SURFACE_400, marginTop: 4 }}>Empreinte SHA-256 de l’image</Text>
              <Text style={{ fontSize: 6.4, color: SURFACE_500, fontFamily: 'Courier' }}>{enDeux(signature.imageSha256)}</Text>
            </View>
          </View>
          {signature.userAgent ? (
            <View style={{ marginTop: 5, width: '100%' }}>
              <Text style={{ fontSize: 6.6, color: SURFACE_400, lineHeight: 1.4 }}>En-tête du navigateur : {signature.userAgent}</Text>
            </View>
          ) : null}
        </View>

        <View style={shared.section}>
          <PdfSectionTitle icon="clock">Journal des événements</PdfSectionTitle>
          <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: SURFACE_50, paddingVertical: 5, paddingHorizontal: 9, borderBottomWidth: 0.5, borderBottomColor: SURFACE_200 }}>
              <Text style={{ fontSize: 7.4, fontWeight: 700, color: SURFACE_500, width: 104 }}>Date et heure (Paris)</Text>
              <Text style={{ fontSize: 7.4, fontWeight: 700, color: SURFACE_500, flex: 1 }}>Événement</Text>
            </View>
            {preuve.evenements.map((e, i) => (
              <View key={i} wrap={false} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 9, borderTopWidth: i ? 0.5 : 0, borderTopColor: SURFACE_200 }}>
                <Text style={{ fontSize: 7.8, color: SURFACE_700, width: 104, fontFamily: 'Courier' }}>{courte(e.at)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8.2, color: SURFACE_900 }}>{e.libelle}</Text>
                  {e.detail ? <Text style={{ fontSize: 7.2, color: SURFACE_500, marginTop: 1.5 }}>{e.detail}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={shared.section} wrap={false}>
          <PdfSectionTitle icon="check">Intégrité</PdfSectionTitle>
          <View style={{ backgroundColor: BRAND_ULTRA_LIGHT, borderRadius: 6, padding: 12 }}>
            {doc.exemplaire.etat === 'fige' ? (
              <>
                <Ligne label="Exemplaire signé">
                  {`Figé au moment de la signature${doc.exemplaire.figeLe ? `, le ${horodatageLisible(doc.exemplaire.figeLe)}` : ''}, et conservé par l’organisme.`}
                </Ligne>
                <Ligne label="Empreinte SHA-256" mono>{doc.exemplaire.sha256}</Ligne>
                <Ligne label="Contrôle">
                  {doc.exemplaire.introuvable
                    ? 'Attention : l’exemplaire est introuvable dans l’archive à l’émission de ce certificat.'
                    : !doc.exemplaire.empreinteEnregistree
                    ? 'Empreinte calculée à l’émission de ce certificat : elle n’a pas pu être enregistrée au moment de la signature.'
                    : doc.exemplaire.verifie === true
                    ? 'L’exemplaire conservé a été relu à l’émission de ce certificat : son empreinte est identique.'
                    : doc.exemplaire.verifie === false
                      ? 'Attention : l’exemplaire conservé ne correspond plus à l’empreinte enregistrée.'
                      : 'Exemplaire non relu à l’émission de ce certificat.'}
                </Ligne>
              </>
            ) : (
              <>
                <Ligne label="Exemplaire signé">
                  {doc.exemplaire.raison === 'anterieure'
                    ? `Non figé : la signature est antérieure à l’archivage automatique des exemplaires signés (29 septembre 2026). Le PDF de ${doc.nomCourt} est reconstitué à partir des données enregistrées et intègre les avenants éventuels.`
                    : 'Non conservé : l’archivage de l’exemplaire a échoué au moment de la signature.'}
                </Ligne>
                {doc.exemplaire.sha256Note ? <Ligne label="Empreinte notée à la signature" mono>{doc.exemplaire.sha256Note}</Ligne> : null}
              </>
            )}
            <Ligne label="Empreinte des preuves" mono>{preuve.empreinteDossier}</Ligne>
            <Note>
              L’empreinte des preuves est calculée sur l’ensemble des éléments de ce certificat (document, signataire,
              signature, journal). Toute modification de l’un d’eux donnerait une empreinte différente.
            </Note>
          </View>
        </View>

        <View style={shared.section} wrap={false}>
          <PdfSectionTitle icon="scale">Valeur juridique</PdfSectionTitle>
          <Text style={{ fontSize: 7.8, color: SURFACE_700, lineHeight: 1.5 }}>
            Signature électronique simple au sens de l’article 3 du règlement (UE) n° 910/2014 du 23 juillet 2014 (eIDAS).
            Conformément à l’article 25 de ce règlement et aux articles 1366 et 1367 du Code civil, l’effet juridique et
            la recevabilité de cette signature comme preuve en justice ne peuvent être refusés au seul motif qu’elle se
            présente sous une forme électronique. Ce certificat est établi par {doc.organisme} à partir des données de
            son système de gestion ; il n’est pas délivré par un prestataire de services de confiance qualifié.
          </Text>
        </View>

        <PdfDocFooter numero={`Certificat de signature · ${doc.numero}`} org={org} />
      </Page>
    </Document>
  )
}

/** Appareil et navigateur, en clair, à partir de l'en-tête user-agent. */
export function decrireAppareil(ua: string | null | undefined): string | null {
  if (!ua) return null
  // Pas de version du système : Safari et Chrome la figent ou la réduisent dans
  // cet en-tête, elle serait souvent fausse (l'en-tête brut reste imprimé)
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
