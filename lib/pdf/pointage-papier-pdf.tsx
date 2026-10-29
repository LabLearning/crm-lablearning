import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'

export interface PointageSession {
  date: string
  reference: string
  client: string
  formation: string
  participants: { nom: string }[]
}

const GREEN = '#205040'
const INK = '#0F1720'
const SOFT = '#4E5A67'
const LINE = '#e2e0db'

const Box = () => <View style={{ width: 10, height: 10, borderWidth: 1, borderColor: '#37414D', borderRadius: 2, marginRight: 4 }} />

/**
 * Feuille de pointage papier à imprimer : une section par session, chaque
 * participant avec une case « Présent » et une case « Absent » à cocher.
 * Sert à réconcilier la présence non saisie dans le CRM (indicateur 12).
 */
export function PointagePapierPDF({ sessions, orgName, editedOn }: { sessions: PointageSession[]; orgName: string; editedOn: string }) {
  return (
    <Document>
      <Page size="A4" style={{ paddingTop: 34, paddingBottom: 40, paddingHorizontal: 34, fontFamily: 'Helvetica', fontSize: 9, color: INK }}>
        {/* En-tête */}
        <View style={{ borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 8, marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: GREEN }}>Feuille de pointage — présences à confirmer</Text>
          <Text style={{ fontSize: 8.5, color: SOFT, marginTop: 3 }}>
            {orgName} · Cocher « Présent » ou « Absent » d'après l'émargement papier de chaque session, puis retourner ce document.
          </Text>
          <Text style={{ fontSize: 7.5, color: SOFT, marginTop: 2 }}>Édité le {editedOn} · {sessions.length} session(s) · {sessions.reduce((n, s) => n + s.participants.length, 0)} participant(s)</Text>
        </View>

        {sessions.map((s, si) => {
          // D'un seul tenant tant que la session tient sur une page ; au-delà, elle se coupe entre deux
          // participants, le bandeau toujours avec le premier : un bloc insécable plus haut qu'une page
          // serait comprimé par react-pdf (lignes tassées)
          const longue = s.participants.length > 30
          const ligne = (p: (typeof s.participants)[number], pi: number) => (
            <View key={pi} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: pi < s.participants.length - 1 ? 0.5 : 0, borderBottomColor: '#f0efec' }}>
              <Text style={{ flex: 1, fontSize: 9 }}>{p.nom}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: 70 }}><Box /><Text style={{ fontSize: 8.5 }}>Présent</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: 64 }}><Box /><Text style={{ fontSize: 8.5, color: '#b4241f' }}>Absent</Text></View>
              <Text style={{ width: 150, fontSize: 7.5, color: SOFT, borderBottomWidth: 0.5, borderBottomColor: LINE }}> </Text>
            </View>
          )
          return (
          <View key={si} wrap={longue} style={{ marginBottom: 12, borderWidth: 0.5, borderColor: LINE, borderRadius: 4 }}>
            <View wrap={false}>
              {/* Bandeau session */}
              <View style={{ backgroundColor: '#f2f5f3', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: LINE }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: INK, fontSize: 10 }}>{s.client || 'Client non renseigné'}</Text>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: GREEN, fontSize: 8.5 }}>{s.date}  ·  {s.reference}</Text>
                </View>
                <Text style={{ color: SOFT, fontSize: 8.5, marginTop: 1 }}>{s.formation}</Text>
              </View>
              {s.participants.slice(0, 1).map((p, pi) => ligne(p, pi))}
            </View>
            {/* Lignes participants */}
            {s.participants.slice(1).map((p, pi) => ligne(p, pi + 1))}
          </View>
          )
        })}

        <Text style={{ position: 'absolute', bottom: 22, left: 34, right: 34, fontSize: 7, color: SOFT, textAlign: 'center' }}
          render={({ pageNumber, totalPages }) => `${orgName} — Feuille de pointage · page ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
