import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfDocHeader, PdfDocFooter, PdfSectionTitle, PdfSignatureCards, shared,
  BRAND_GREEN, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900, SURFACE_50,
} from './components'

interface AvenantProps {
  avenant: any        // convention_avenants row
  convention: any     // convention + client + formation + session
  org: any
}

const fmtFr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

function ParticipantList({ title, items, accent }: { title: string; items: any[]; accent?: boolean }) {
  if (!items || items.length === 0) return null
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: accent ? BRAND_GREEN : SURFACE_500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
        {title}
      </Text>
      {items.map((p: any, i: number) => (
        <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 1.5 }}>
          <Text style={{ fontSize: 8.5, color: BRAND_GREEN }}>•</Text>
          <Text style={{ fontSize: 8.5, color: SURFACE_700 }}>{`${p.prenom || ''} ${p.nom || ''}`.trim()}</Text>
        </View>
      ))}
    </View>
  )
}

export function AvenantConventionPDF({ avenant, convention, org }: AvenantProps) {
  const numeroAvenant = `${convention.numero || 'CONVENTION'} — Avenant n°${avenant.numero}`
  const today = new Date(avenant.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const client = convention.client
  const formation = convention.formation
  const sess = convention.session

  return (
    <Document title={numeroAvenant} author={org?.name || 'Lab Learning'}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle={`Avenant n°${avenant.numero}`} numero={convention.numero || ''} date={`Établi le ${today}`} org={org} />

        <Text style={{ fontSize: 13, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginBottom: 4 }}>
          Avenant n°{avenant.numero} à la convention de formation {convention.numero}
        </Text>
        <Text style={{ fontSize: 8.5, color: SURFACE_500, marginBottom: 14, lineHeight: 1.5 }}>
          Le présent avenant modifie la liste des participants de l'action de formation visée ci-dessous.
          Toutes les autres clauses de la convention initiale demeurent inchangées et continuent de produire leurs effets.
        </Text>

        {/* Rappel de la convention */}
        <View style={shared.card}>
          <PdfSectionTitle>Convention concernée</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Convention</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{convention.numero || '—'}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Client</Text><Text style={shared.value}>{client?.raison_sociale || '—'}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Formation</Text><Text style={shared.value}>{formation?.intitule || '—'}</Text></View>
          {sess?.date_debut ? <View style={shared.row}><Text style={shared.label}>Dates</Text><Text style={shared.value}>{`du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`}</Text></View> : null}
        </View>

        {/* Article 1 : modification de l'effectif */}
        <View style={shared.section}>
          <PdfSectionTitle>Article 1 — Modification des participants</PdfSectionTitle>
          <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.6, marginBottom: 8 }}>
            {`L'effectif de l'action de formation passe de ${avenant.nombre_avant} à ${avenant.nombre_apres} participant${avenant.nombre_apres > 1 ? 's' : ''}, selon le détail suivant :`}
          </Text>
          <ParticipantList title="Participants ajoutés" items={avenant.ajoutes || []} accent />
          <ParticipantList title="Participants retirés" items={avenant.retires || []} />
        </View>

        {/* Article 2 : liste actualisée */}
        <View style={shared.section}>
          <PdfSectionTitle>Article 2 — Liste complète des participants après avenant</PdfSectionTitle>
          <View style={{ backgroundColor: SURFACE_50, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 10 }}>
            {(avenant.participants_apres || []).map((p: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 1.5 }}>
                <Text style={{ fontSize: 8.5, color: BRAND_GREEN }}>{`${i + 1}.`}</Text>
                <Text style={{ fontSize: 8.5, color: SURFACE_700 }}>{`${p.prenom || ''} ${p.nom || ''}`.trim()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Signatures */}
        <PdfSignatureCards
          faitMention={`Fait le ${today}, en deux exemplaires.`}
          items={[
            {
              title: `Pour l'organisme de formation — ${org?.name || 'Lab Learning'}`,
              name: [org?.representant_legal_prenom, org?.representant_legal_nom].filter(Boolean).join(' ') || undefined,
              mention: 'Lu et approuvé',
              stamp: org?.tampon_signature_url || null,
            },
            {
              title: `Pour le client — ${client?.raison_sociale || ''}`,
              mention: 'Lu et approuvé, bon pour accord',
            },
          ]}
        />

        <PdfDocFooter numero={numeroAvenant} org={org} />
      </Page>
    </Document>
  )
}
