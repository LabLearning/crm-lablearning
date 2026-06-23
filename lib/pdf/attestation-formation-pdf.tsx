import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, BRAND_LIGHT, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface AttestationFormationProps {
  apprenant: any
  session: any
  formation: any
  org: any
  assiduite?: number
}

export function AttestationFormationPDF({ apprenant, session, formation, org, assiduite }: AttestationFormationProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `ATT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Attestation de fin de formation" numero={numero} date={today} org={org} />

        <View style={shared.section}>
          <Text style={{ fontSize: 10, color: SURFACE_700, lineHeight: 1.8, marginBottom: 10 }}>
            Je soussigné(e), représentant(e) de {org.name}, organisme de formation certifié Qualiopi, atteste que :
          </Text>
        </View>

        <View style={shared.infoBox}>
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginBottom: 4 }}>
            {apprenant.prenom} {apprenant.nom}
          </Text>
          {apprenant.entreprise && <Text style={shared.infoBoxText}>Entreprise : {apprenant.entreprise}</Text>}
        </View>

        <View style={shared.section}>
          <Text style={{ fontSize: 10, color: SURFACE_700, lineHeight: 1.8 }}>
            a suivi la formation suivante :
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Formation suivie</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Intitulé :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{formation.intitule}</Text></View>
          {formation.reference && <View style={shared.row}><Text style={shared.label}>Référence :</Text><Text style={shared.value}>{formation.reference}</Text></View>}
          <View style={shared.row}><Text style={shared.label}>Durée :</Text><Text style={shared.value}>{formation.duree_heures || 0} heures</Text></View>
          <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>Du {new Date(session.date_debut).toLocaleDateString('fr-FR')} au {new Date(session.date_fin).toLocaleDateString('fr-FR')}</Text></View>
          {session.lieu && <View style={shared.row}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{session.lieu}</Text></View>}
          {session.formateur && <View style={shared.row}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{session.formateur.prenom} {session.formateur.nom}</Text></View>}
          {assiduite != null && <View style={shared.row}><Text style={shared.label}>Assiduité :</Text><Text style={shared.value}>{assiduite}%</Text></View>}
        </View>

        {formation.objectifs_pedagogiques && formation.objectifs_pedagogiques.length > 0 && (
          <View style={shared.section}>
            <PdfSectionTitle>Objectifs pédagogiques atteints</PdfSectionTitle>
            {formation.objectifs_pedagogiques.map((obj: string, i: number) => (
              <Text key={i} style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, paddingLeft: 10 }}>
                - {obj}
              </Text>
            ))}
          </View>
        )}

        {formation.competences_visees && formation.competences_visees.length > 0 && (
          <View style={shared.section}>
            <PdfSectionTitle>Compétences acquises</PdfSectionTitle>
            {formation.competences_visees.map((comp: string, i: number) => (
              <Text key={i} style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, paddingLeft: 10 }}>
                - {comp}
              </Text>
            ))}
          </View>
        )}

        <View style={shared.section}>
          <PdfSectionTitle>Modalités d'évaluation</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {formation.modalites_evaluation || 'Évaluation des acquis en cours et en fin de formation (QCM, mise en situation pratique).'}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Résultats de l'évaluation des acquis</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {assiduite != null
              ? `Les objectifs pédagogiques de la formation ont été évalués. Acquis validés au regard des objectifs visés. Assiduité constatée : ${assiduite}%.`
              : 'Les objectifs pédagogiques de la formation ont été évalués. Acquis validés au regard des objectifs visés.'}
          </Text>
        </View>

        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 8, color: SURFACE_500 }}>Fait à {org.city || '___________'}, le {today}</Text>
          <View style={{ marginTop: 15 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>Pour {org.name}</Text>
            <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1', width: 200 }} />
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature et cachet</Text>
          </View>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
