import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface CertificatRealisationProps {
  apprenant: any
  session: any
  formation: any
  org: any
  assiduite?: number
  heuresPresence?: number
  /** Durée de référence de l'action : le parcours POEI plutôt que la formation. */
  dureeTotale?: number
  /** Signature électronique du bénéficiaire (candidat POEI) */
  signatureCandidat?: { data?: string | null; nom?: string | null; signedAt?: string | null } | null
  /** Date portée sur le certificat (ex. dernier jour de la POEI) */
  dateSignature?: string | null
}

/** 63.5 → « 63,5 », 70 → « 70 » */
const heuresFr = (n: number) => String(Math.round(Number(n) * 100) / 100).replace('.', ',')

export function CertificatRealisationPage({ apprenant, session, formation, org, assiduite, heuresPresence, dureeTotale, signatureCandidat, dateSignature }: CertificatRealisationProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  // La date portée sur le certificat prime sur la date du jour (dernier jour de POEI)
  const dateSignatureAffichee = dateSignature
    ? new Date(dateSignature).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const numero = `CR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
  const duree = dureeTotale || formation.duree_heures || 0
  const heuresRealisees = heuresPresence != null ? heuresPresence : duree
  const enTotalite = !duree || heuresRealisees >= duree
  const representant = [org?.representant_legal_civilite, org?.representant_legal_prenom, org?.representant_legal_nom].filter(Boolean).join(' ').trim() || `le représentant légal de ${org?.name || 'l\'organisme'}`
  const adresseOrg = [org?.address, [org?.postal_code, org?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  // « M. » ou « Mme » : la civilité est libre en base.
  const civ = (() => {
    const n = String(apprenant?.civilite || '').toLowerCase()
    if (n.startsWith('mme') || n.startsWith('mad') || n === 'f') return 'Mme'
    if (n.startsWith('m')) return 'M.'
    return ''
  })()
  const stagiaire = [civ, apprenant.prenom, String(apprenant.nom || '').toUpperCase()].filter(Boolean).join(' ')
  const entreprise = session?.client?.nom_commercial || session?.client?.raison_sociale || apprenant?.entreprise || null
  const fmtCourt = (d: string) => new Date(d).toLocaleDateString('fr-FR')
  const memeJour = !session.date_fin || session.date_fin === session.date_debut
  const periode = memeJour
    ? `le ${fmtCourt(session.date_debut)}`
    : `du ${fmtCourt(session.date_debut)} au ${fmtCourt(session.date_fin)}`

  return (
    <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Certificat de réalisation" numero={numero} org={org} />

        <View style={shared.infoBox}>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Conformément aux dispositions de l'article L.6353-1 du Code du travail
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Dispensateur de formation</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Raison sociale :</Text><Text style={shared.value}>{org.legal_name || org.name}</Text></View>
          {adresseOrg && <View style={shared.row}><Text style={shared.label}>Adresse :</Text><Text style={shared.value}>{adresseOrg}</Text></View>}
          <View style={shared.row}><Text style={shared.label}>N° déclaration :</Text><Text style={shared.value}>{org.numero_da || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{org.siret || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>TVA intracom. :</Text><Text style={shared.value}>{org.numero_tva_intra || 'Non renseignée'}</Text></View>
        </View>

        {/*
          Le corps suit le modèle publié par le ministère du Travail : mêmes
          mentions, même ordre. C'est ce que les financeurs contrôlent.
        */}
        <View style={shared.section}>
          <PdfSectionTitle>Attestation</PdfSectionTitle>
          <Text style={{ fontSize: 9, color: SURFACE_900, lineHeight: 1.8 }}>
            {`Je soussigné(e) ${representant}, représentant légal du dispensateur de formation ${org?.name || 'Lab Learning'}, atteste que :`}
          </Text>

          <Text style={{ fontSize: 10, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginTop: 8 }}>
            {stagiaire}
          </Text>
          {apprenant.date_naissance ? (
            <Text style={{ fontSize: 9, color: SURFACE_900, marginTop: 2 }}>
              {`né(e) le ${fmtCourt(apprenant.date_naissance)}`}
            </Text>
          ) : null}
          {entreprise && (
            <Text style={{ fontSize: 9, color: SURFACE_900, marginTop: 2 }}>{`salarié(e) de l'entreprise ${entreprise}`}</Text>
          )}
          <Text style={{ fontSize: 9, color: SURFACE_900, lineHeight: 1.8, marginTop: 6 }}>
            {`a ${enTotalite ? 'suivi' : 'partiellement suivi'} l'action de formation « ${formation.intitule} »,`}
          </Text>
          <Text style={{ fontSize: 9, color: SURFACE_900, lineHeight: 1.8 }}>
            {`qui s'est déroulée ${periode}${session.lieu ? ` à ${session.lieu}` : ''},`}
          </Text>
          <Text style={{ fontSize: 9, color: SURFACE_900, lineHeight: 1.8 }}>
            {`pour une durée totale de ${heuresFr(heuresRealisees)} heures${duree && heuresRealisees < duree ? ` (sur ${heuresFr(duree)} heures prévues)` : ''}.`}
          </Text>

          <Text style={{ fontSize: 8.5, color: SURFACE_700, marginTop: 8 }}>
            Nature de l'action concourant au développement des compétences : action de formation
            <Text style={{ fontSize: 6 }}> (1)</Text> — article L.6313-1 du Code du travail.
            Modalité : {formation.modalite === 'distanciel' ? 'à distance' : formation.modalite === 'mixte' ? 'mixte (présentiel et à distance)' : 'présentiel'}.
          </Text>
          {assiduite != null && (
            <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 4 }}>
              Taux d'assiduité : {assiduite}% (hors demi-journées d’absence déclarées sur les feuilles d’émargement).
            </Text>
          )}
        </View>

        {/* Engagement de conservation des pièces — mention du modèle officiel. */}
        <View style={shared.infoBox}>
          <Text style={{ fontSize: 7.5, color: SURFACE_700, lineHeight: 1.6, textAlign: 'justify' }}>
            Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je
            m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le présent
            certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement. En
            cas de cofinancement des fonds européens, la durée de conservation est étendue conformément
            aux obligations conventionnelles spécifiques.
          </Text>
        </View>

        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 8, color: SURFACE_500 }}>
            Fait à {org.city || '___________'}, le {dateSignatureAffichee || today}, pour faire valoir ce que de droit.
          </Text>
          {/*
            Seul le dispensateur signe : l'article L6353-1 n'exige rien du
            stagiaire sur ce document. La colonne bénéficiaire ne subsiste que
            sur le circuit POEI, où le candidat signe électroniquement — c'est
            le modèle France Travail qui la demande là-bas.
          */}
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>Pour {org.name} — {representant}</Text>
              <View style={{ height: 60, position: 'relative', borderBottomWidth: 0.5, borderBottomColor: '#CBD3DB' }}>
                {org.tampon_signature_url ? (
                  <Image src={org.tampon_signature_url} style={{ position: 'absolute', top: 0, left: 0, width: 150, height: 75, objectFit: 'contain' }} />
                ) : null}
              </View>
              <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Cachet et signature du responsable du dispensateur de formation</Text>
            </View>
            {signatureCandidat?.data ? (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>
                  Le bénéficiaire — {signatureCandidat?.nom || `${apprenant.prenom} ${apprenant.nom}`}
                </Text>
                <View style={{ height: 60, position: 'relative', borderBottomWidth: 0.5, borderBottomColor: '#CBD3DB' }}>
                  <Image src={signatureCandidat.data} style={{ position: 'absolute', top: 0, left: 0, width: 140, height: 60, objectFit: 'contain' }} />
                </View>
                <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>
                  Signé électroniquement{signatureCandidat.signedAt ? ` le ${new Date(signatureCandidat.signedAt).toLocaleDateString('fr-FR')}` : ''}
                </Text>
              </View>
            ) : <View style={{ flex: 1 }} />}
          </View>
        </View>

      {/* Renvoi du modèle officiel sur les formations à distance. */}
      <Text style={{ position: 'absolute', bottom: 44, left: 40, right: 40, fontSize: 6.5, color: SURFACE_500, borderTopWidth: 0.5, borderTopColor: '#E1E6EB', paddingTop: 4 }} fixed>
        (1) Dans le cadre des formations à distance, prendre en compte la réalisation des activités
        pédagogiques et le temps estimé pour les réaliser.
      </Text>
      <PdfDocFooter numero={numero} org={org} />
    </Page>
  )
}

export function CertificatRealisationPDF(props: CertificatRealisationProps) {
  return <Document><CertificatRealisationPage {...props} /></Document>
}

/** Tous les certificats d'une session, un stagiaire par page. */
export function CertificatsSessionPDF({ stagiaires, session, formation, org }: {
  stagiaires: { apprenant: any; assiduite?: number; heuresPresence?: number; dureeTotale?: number }[]
  session: any
  formation: any
  org: any
}) {
  return (
    <Document>
      {stagiaires.map((s, i) => (
        <CertificatRealisationPage key={i} apprenant={s.apprenant} session={session}
          formation={formation} org={org} assiduite={s.assiduite} heuresPresence={s.heuresPresence} dureeTotale={s.dureeTotale} />
      ))}
    </Document>
  )
}
