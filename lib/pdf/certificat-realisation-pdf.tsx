import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface CertificatRealisationProps {
  apprenant: any
  session: any
  formation: any
  org: any
  assiduite?: number
  heuresPresence?: number
}

export function CertificatRealisationPDF({ apprenant, session, formation, org, assiduite, heuresPresence }: CertificatRealisationProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `CR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
  const duree = formation.duree_heures || 0
  const heuresRealisees = heuresPresence != null ? heuresPresence : duree
  const enTotalite = !duree || heuresRealisees >= duree
  const representant = [org?.representant_legal_civilite, org?.representant_legal_prenom, org?.representant_legal_nom].filter(Boolean).join(' ').trim() || `le représentant légal de ${org?.name || 'l\'organisme'}`

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Certificat de réalisation" numero={numero} date={today} org={org} />

        <View style={shared.infoBox}>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Conformément aux dispositions de l'article L.6353-1 du Code du travail
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Organisme de formation</Text>
          <View style={shared.row}><Text style={shared.label}>Raison sociale :</Text><Text style={shared.value}>{org.legal_name || org.name}</Text></View>
          <View style={shared.row}><Text style={shared.label}>N° déclaration :</Text><Text style={shared.value}>{org.numero_da || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{org.siret || ''}</Text></View>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Stagiaire</Text>
          <View style={shared.row}><Text style={shared.label}>Nom :</Text><Text style={shared.value}>{apprenant.prenom} {apprenant.nom}</Text></View>
          {apprenant.entreprise && <View style={shared.row}><Text style={shared.label}>Entreprise :</Text><Text style={shared.value}>{apprenant.entreprise}</Text></View>}
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Caractéristiques de l'action</Text>
          <View style={shared.row}><Text style={shared.label}>Intitulé :</Text><Text style={{ ...shared.value, fontFamily: 'Helvetica-Bold' }}>{formation.intitule}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Nature :</Text><Text style={shared.value}>Action de formation</Text></View>
          <View style={shared.row}><Text style={shared.label}>Modalité :</Text><Text style={shared.value}>{formation.modalite === 'distanciel' ? 'À distance' : formation.modalite === 'mixte' ? 'Mixte (présentiel + à distance)' : 'Présentiel'}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>Du {new Date(session.date_debut).toLocaleDateString('fr-FR')} au {new Date(session.date_fin).toLocaleDateString('fr-FR')}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Nombre total d'heures :</Text><Text style={{ ...shared.value, fontFamily: 'Helvetica-Bold' }}>{heuresRealisees} heures réalisées{duree && heuresRealisees < duree ? ` (sur ${duree} h prévues)` : ''}</Text></View>
          {session.lieu && <View style={shared.row}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{session.lieu}</Text></View>}
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Attestation</Text>
          <Text style={{ fontSize: 9, color: SURFACE_900, lineHeight: 1.8 }}>
            Je soussigné(e) {representant}, atteste que {apprenant.prenom} {apprenant.nom} a réalisé {enTotalite ? 'en totalité' : 'partiellement'} une action concourant au développement des compétences (action de formation au sens de l'article L.6313-1 du Code du travail), dont les caractéristiques figurent ci-dessus.
          </Text>
          {assiduite != null && (
            <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 6 }}>
              Taux d'assiduité : {assiduite}% (calculé sur la base des feuilles d'émargement signées).
            </Text>
          )}
        </View>

        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 8, color: SURFACE_500 }}>Fait à {org.city || '___________'}, le {today}, pour faire valoir ce que de droit.</Text>
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN, marginBottom: 6 }}>Pour {org.name} — {representant}</Text>
            <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1', width: 220 }} />
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature et cachet du dispensateur</Text>
          </View>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
