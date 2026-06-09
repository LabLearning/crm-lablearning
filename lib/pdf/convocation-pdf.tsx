import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface ConvocationProps {
  apprenant: any
  session: any
  formation: any
  org: any
  formateur: any
}

export function ConvocationPDF({ apprenant, session, formation, org, formateur }: ConvocationProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `CONV-${new Date().getFullYear()}-${String(session.reference || session.id).slice(0, 8)}`
  const civilite = apprenant.civilite || ''
  const lieu = session.lieu || session.adresse || [session.adresse, session.code_postal, session.ville].filter(Boolean).join(', ') || 'le lieu communiqué par l\'organisme'
  const dDebut = new Date(session.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dFin = new Date(session.date_fin || session.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const refContact = [org?.referent_handicap_email, org?.referent_handicap_telephone].filter(Boolean).join(' · ')
    || org?.email_contact || org?.email || ''
  const refHandicap = org?.referent_handicap_nom
    ? `${org.referent_handicap_nom}${refContact ? ` (${refContact})` : ''}`
    : refContact ? `notre référent handicap (${refContact})` : 'le référent handicap de l\'organisme'

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Convocation" numero={numero} date={today} org={org} />

        <View style={shared.section}>
          <Text style={{ fontSize: 10, color: SURFACE_900, fontFamily: 'Helvetica-Bold' }}>
            {[civilite, apprenant.prenom, apprenant.nom].filter(Boolean).join(' ')}
          </Text>
          {apprenant.entreprise && <Text style={{ fontSize: 9, color: SURFACE_500, marginTop: 2 }}>{apprenant.entreprise}</Text>}
        </View>

        <View style={shared.section}>
          <Text style={{ fontSize: 10, color: SURFACE_700, lineHeight: 1.8 }}>
            {civilite ? `${civilite},` : 'Madame, Monsieur,'}
          </Text>
          <Text style={{ fontSize: 10, color: SURFACE_700, lineHeight: 1.8, marginTop: 8 }}>
            Nous avons le plaisir de vous convoquer à la session de formation détaillée ci-dessous.
            Nous vous remercions de bien vouloir vous présenter muni(e) de cette convocation.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Détails de la formation</Text>
          <View style={shared.row}><Text style={shared.label}>Intitulé :</Text><Text style={{ ...shared.value, fontFamily: 'Helvetica-Bold' }}>{formation?.intitule || '—'}</Text></View>
          {formation?.duree_heures ? <View style={shared.row}><Text style={shared.label}>Durée :</Text><Text style={shared.value}>{formation.duree_heures} heures</Text></View> : null}
          <View style={shared.row}><Text style={shared.label}>Début :</Text><Text style={shared.value}>{dDebut}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Fin :</Text><Text style={shared.value}>{dFin}</Text></View>
          {session.horaires && <View style={shared.row}><Text style={shared.label}>Horaires :</Text><Text style={shared.value}>{session.horaires}</Text></View>}
          <View style={shared.row}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{lieu}</Text></View>
          {session.lien_visio && <View style={shared.row}><Text style={shared.label}>Lien visio :</Text><Text style={shared.value}>{session.lien_visio}</Text></View>}
          {formateur && <View style={shared.row}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{`${formateur.prenom || ''} ${formateur.nom || ''}`.trim()}</Text></View>}
        </View>

        {formation?.prerequis && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Prérequis</Text>
            <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>{formation.prerequis}</Text>
          </View>
        )}

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Informations pratiques</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            - Merci de vous présenter 15 minutes avant le début de la session.{'\n'}
            - L'émargement est obligatoire pour chaque demi-journée.{'\n'}
            - Une attestation de fin de formation vous sera remise à l'issue de la session.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Accessibilité — situation de handicap</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Si vous êtes en situation de handicap et avez besoin d'un aménagement, contactez {refHandicap} afin d'étudier ensemble les adaptations possibles.
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 8, color: SURFACE_500 }}>Fait à {org?.city || org?.ville || '___________'}, le {today}</Text>
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN, marginBottom: 6 }}>Pour {org?.name || 'Lab Learning'}</Text>
            <View style={{ height: 46, borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1', width: 200 }} />
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature et cachet</Text>
          </View>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
