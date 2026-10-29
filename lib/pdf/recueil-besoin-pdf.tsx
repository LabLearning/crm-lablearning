import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface Question { id: string; label: string }

interface Props {
  org: any
  session: any
  formation: any
  client: any
  theme: string | null
  themeLabel: string
  questions: Question[]
  reponses: Record<string, string>
  dateRecueil: string | null
  rempliPar: string | null
}

/**
 * Recueil du besoin d'une session (indicateur Qualiopi 4) : analyse du besoin
 * du commanditaire, à joindre au dossier de la session.
 */
export function RecueilBesoinPDF({ org, session, formation, client, themeLabel, questions, reponses, dateRecueil, rempliPar }: Props) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const dateAff = dateRecueil ? new Date(dateRecueil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : today
  const clientNom = client?.nom_commercial || client?.raison_sociale || '—'

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Recueil du besoin" numero={session?.reference || ''} date={dateAff} org={org} />

        <View style={shared.infoBox}>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Analyse du besoin du commanditaire préalable à l'action de formation (critère 2, indicateur 4 du RNQ).
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Prestation concernée</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Client :</Text><Text style={shared.value}>{clientNom}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Formation :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{formation?.intitule || session?.intitule || '—'}</Text></View>
          {session?.date_debut && (
            <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>
              Du {new Date(session.date_debut).toLocaleDateString('fr-FR')} au {new Date(session.date_fin || session.date_debut).toLocaleDateString('fr-FR')}
            </Text></View>
          )}
          {session?.reference && <View style={shared.row}><Text style={shared.label}>Référence :</Text><Text style={shared.value}>{session.reference}</Text></View>}
          <View style={shared.row}><Text style={shared.label}>Grille utilisée :</Text><Text style={shared.value}>{themeLabel}</Text></View>
        </View>

        <View style={shared.section}>
          {questions.length === 0 && <PdfSectionTitle>Analyse du besoin</PdfSectionTitle>}
          {questions.map((q, i) => {
            const rep = (reponses?.[q.id] || '').trim()
            // Une réponse très longue se coupe entre deux pages : insécable et plus haute qu'une page,
            // elle serait comprimée par react-pdf (lignes superposées)
            const longue = rep.length > 1200
            const bloc = (
              <View key={q.id} style={{ marginBottom: 10 }} wrap={longue}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>
                  {i + 1}. {q.label}
                </Text>
                <Text style={{ fontSize: 9, color: rep ? SURFACE_900 : '#9AA6B2', lineHeight: 1.6, marginTop: 3 }}>
                  {rep || 'Non renseigné'}
                </Text>
              </View>
            )
            if (i > 0) return bloc
            // Le titre de la section tient avec la première question : jamais seul en bas de page
            return longue
              ? <React.Fragment key={q.id}><PdfSectionTitle>Analyse du besoin</PdfSectionTitle>{bloc}</React.Fragment>
              : <View key={q.id} wrap={false}><PdfSectionTitle>Analyse du besoin</PdfSectionTitle>{bloc}</View>
          })}
        </View>

        <View style={{ marginTop: 20 }} wrap={false}>
          <Text style={{ fontSize: 8, color: SURFACE_500 }}>
            Recueil réalisé le {dateAff}{rempliPar ? ` par ${rempliPar}` : ''}.
          </Text>
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>Pour {org?.name}</Text>
              <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#CBD3DB' }} />
              <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>Le commanditaire — {clientNom}</Text>
              <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#CBD3DB' }} />
              <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature</Text>
            </View>
          </View>
        </View>

        <PdfDocFooter numero={session?.reference || ''} org={org} />
      </Page>
    </Document>
  )
}
