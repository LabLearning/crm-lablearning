import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared,
  BRAND_GREEN, BRAND_LIGHT, SURFACE_100, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'
import { QUESTIONS_FORMATEUR } from '@/lib/evaluation-formateur-referent'

export interface EvaluationReferentPdfProps {
  org: any
  numero: string
  formateurNom: string
  etablissement: string | null
  /** Parcours POEI ou session sur lesquels le formateur est intervenu. */
  intervention: { libelle: string; dateDebut: string | null; dateFin: string | null } | null
  referent: { nom: string | null; fonction: string | null; email: string | null }
  notes: Record<string, number | null>
  noteGlobale: number | null
  recommande: boolean | null
  commentaire: string | null
  envoyeLe: string | null
  reponduLe: string | null
}

const jour = (d?: string | null) =>
  d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR') : 'date non renseignée'
const sur5 = (n: number | null | undefined) => (n == null ? 'Sans réponse' : `${n} / 5`)

/**
 * Avis du référent de l'établissement sur un formateur, tel qu'il a été
 * répondu depuis le questionnaire envoyé en fin de parcours. Pièce du recueil
 * des appréciations des parties prenantes (Qualiopi, indicateur 30).
 */
export function EvaluationFormateurReferentPDF(p: EvaluationReferentPdfProps) {
  const repondu = !!p.reponduLe
  return (
    <Document title={`Évaluation du formateur ${p.formateurNom}`} author={p.org?.name || 'Lab Learning'}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Évaluation du formateur par le référent" numero={p.numero} date={jour(p.reponduLe || p.envoyeLe)} org={p.org} />

        <View style={shared.section}>
          <PdfSectionTitle>Formateur et intervention</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{p.formateurNom}</Text></View>
          {p.etablissement ? <View style={shared.row}><Text style={shared.label}>Établissement :</Text><Text style={shared.value}>{p.etablissement}</Text></View> : null}
          {p.intervention ? (
            <View style={shared.row}>
              <Text style={shared.label}>Intervention :</Text>
              <Text style={shared.value}>
                {`${p.intervention.libelle}${p.intervention.dateDebut ? `, du ${jour(p.intervention.dateDebut)} au ${jour(p.intervention.dateFin)}` : ''}`}
              </Text>
            </View>
          ) : null}
          <View style={shared.row}>
            <Text style={shared.label}>Référent :</Text>
            <Text style={shared.value}>
              {[p.referent.nom, p.referent.fonction].filter(Boolean).join(', ') || 'Référent de l’établissement'}
              {p.referent.email ? ` (${p.referent.email})` : ''}
            </Text>
          </View>
        </View>

        {/* La note d'ensemble, lisible d'un coup */}
        <View style={{
          backgroundColor: BRAND_LIGHT, borderRadius: 6, padding: 13, marginBottom: 16,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <View>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3 }}>Appréciation d&apos;ensemble</Text>
            <Text style={{ fontSize: 19, fontFamily: 'Montserrat', fontWeight: 700, color: BRAND_GREEN, letterSpacing: -0.3 }}>
              {repondu ? sur5(p.noteGlobale) : 'En attente'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3 }}>{repondu ? 'Répondu le' : 'Questionnaire envoyé le'}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>
              {jour(repondu ? p.reponduLe : p.envoyeLe)}
            </Text>
            {p.recommande != null ? (
              <Text style={{ fontSize: 8, color: SURFACE_700, marginTop: 2 }}>
                {p.recommande ? 'Recommande ce formateur' : 'Ne recommande pas ce formateur'}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Réponses du référent</PdfSectionTitle>
          <View style={shared.table}>
            <View style={shared.tableHeader}>
              <Text style={[shared.tableHeaderCell, { width: '76%' }]}>Critère</Text>
              <Text style={[shared.tableHeaderCell, { width: '24%', textAlign: 'right' }]}>Note</Text>
            </View>
            {QUESTIONS_FORMATEUR.map((q, i) => {
              const n = p.notes[q.cle]
              return (
                <View key={q.cle} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                  <View style={{ width: '76%', paddingRight: 8 }}>
                    <Text style={[shared.tableCell, { color: SURFACE_900 }]}>{q.label}</Text>
                    {/* Jauge : cinq crans, ceux atteints en vert */}
                    <View style={{ flexDirection: 'row', marginTop: 3 }}>
                      {[1, 2, 3, 4, 5].map((k) => (
                        <View key={k} style={{
                          width: 18, height: 4, marginRight: 3, borderRadius: 2,
                          backgroundColor: n != null && k <= n ? BRAND_GREEN : SURFACE_100,
                        }} />
                      ))}
                    </View>
                  </View>
                  <Text style={[shared.tableCell, {
                    width: '24%', textAlign: 'right', fontFamily: 'Satoshi', fontWeight: 700,
                    color: n == null ? SURFACE_400 : n <= 2 ? SURFACE_700 : SURFACE_900,
                  }]}>
                    {sur5(n)}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>

        {p.commentaire ? (
          <View style={shared.section} wrap={false}>
            <PdfSectionTitle>Commentaire du référent</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.6 }}>{p.commentaire}</Text>
          </View>
        ) : null}

        <View style={shared.section} wrap={false}>
          <Text style={{ fontSize: 7.5, color: SURFACE_400, lineHeight: 1.5 }}>
            {`Questionnaire adressé par ${p.org?.name || 'Lab Learning'} au référent de l'établissement en fin d'intervention et renseigné par lui, sans intervention de l'organisme. Ce document fait partie du recueil des appréciations des parties prenantes prévu par le référentiel national qualité.`}
          </Text>
        </View>

        <PdfDocFooter numero={p.numero} org={p.org} />
      </Page>
    </Document>
  )
}
