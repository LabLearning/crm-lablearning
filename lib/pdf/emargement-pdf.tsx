import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, BRAND_LIGHT, BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface EmargementProps {
  session: any
  formation: any
  org: any
  formateur: any
  apprenants: any[]
}

function buildCreneaux(dateDebut: string, dateFin: string) {
  const out: { jour: string; creneau: string }[] = []
  const start = new Date(dateDebut)
  const end = new Date(dateFin || dateDebut)
  let cur = new Date(start)
  let guard = 0
  while (cur <= end && guard < 15) {
    const jour = cur.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    out.push({ jour, creneau: 'Matin' })
    out.push({ jour, creneau: 'Après-midi' })
    cur.setDate(cur.getDate() + 1)
    guard++
  }
  return out
}

export function EmargementPDF({ session, formation, org, formateur, apprenants }: EmargementProps) {
  const allCreneaux = buildCreneaux(session.date_debut, session.date_fin)
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const lieu = session.lieu || session.adresse || [session.code_postal, session.ville].filter(Boolean).join(' ') || '—'
  const numero = session.reference || `SESS-${String(session.id || '').slice(0, 8)}`

  // 1 page = 1 jour (2 créneaux : matin + après-midi). Toujours portrait.
  // Lisibilité maximale : 2 colonnes signatures larges + carte récap complète sur chaque page.
  const jours: typeof allCreneaux[] = []
  for (let i = 0; i < allCreneaux.length; i += 2) {
    jours.push(allCreneaux.slice(i, i + 2))
  }

  // Au-delà de ROWS_PER_PAGE stagiaires, le contenu déborderait de la page A4
  // et couperait le bloc signatures : on découpe en plusieurs feuilles par jour.
  // 5 = maximum pour qu'une feuille complète (récap + tableau + signatures)
  // tienne sur UNE page A4 sans jamais être coupée.
  const ROWS_PER_PAGE = 5
  const sourceApprenants: any[] = apprenants.length > 0 ? apprenants : Array(5).fill(null)
  const appChunks: any[][] = []
  for (let i = 0; i < sourceApprenants.length; i += ROWS_PER_PAGE) {
    appChunks.push(sourceApprenants.slice(i, i + ROWS_PER_PAGE))
  }

  const pages = jours.flatMap((creneaux, dayIdx) =>
    appChunks.map((chunk, chunkIdx) => ({ creneaux, dayIdx, chunk, chunkIdx }))
  )

  // Portrait A4 : 595 - 90 = 505 pt utiles ; nom 140 → 365 / 2 = 182 pt par créneau
  const pageWidth = 505
  const nameW = 140

  return (
    <Document>
      {pages.map(({ creneaux, dayIdx, chunk, chunkIdx }, pageIdx) => {
      const creneauW = creneaux.length > 0 ? (pageWidth - nameW) / creneaux.length : 60
      const isMultiPage = jours.length > 1
      const suite = appChunks.length > 1 ? ` — feuille ${chunkIdx + 1}/${appChunks.length}` : ''
      // Date de cette page (= 1 jour) pour le bandeau
      const startDateForPage = new Date(session.date_debut)
      startDateForPage.setDate(startDateForPage.getDate() + dayIdx)
      const jourLabel = startDateForPage.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      return (
      <Page key={pageIdx} size="A4" orientation="portrait" style={shared.page}>
        <PdfDocHeader
          docTitle="Feuille d'émargement"
          numero={numero}
          date={isMultiPage ? `Jour ${dayIdx + 1} / ${jours.length}${suite}` : `Éditée le ${today}${suite}`}
          org={org}
        />

        {/* Carte récap session — compacte pour que la feuille tienne sur 1 page */}
        <View style={shared.card}>
          <PdfSectionTitle>Action de formation</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Intitulé</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>{`${formation?.intitule || '—'}${formation?.duree_heures ? ` (${formation.duree_heures} heures)` : ''}`}</Text></View>
          <View style={shared.row}><Text style={shared.label}>{isMultiPage ? 'Jour de cette feuille' : 'Date'}</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{`${jourLabel}${isMultiPage ? ` — du ${new Date(session.date_debut).toLocaleDateString('fr-FR')} au ${new Date(session.date_fin || session.date_debut).toLocaleDateString('fr-FR')}` : ''}`}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Lieu{session.horaires ? ' / horaires' : ''}</Text><Text style={shared.value}>{`${lieu}${session.horaires ? ` — ${session.horaires}` : ''}`}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Formateur</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{formateur ? `${formateur.prenom || ''} ${formateur.nom || ''}`.trim() : '—'}</Text></View>
        </View>

        {/* Tableau d'émargement — moderne, coins arrondis, header propre */}
        <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          {/* En-tête colonnes */}
          <View style={{ flexDirection: 'row', backgroundColor: BRAND_GREEN }}>
            <View style={{ width: nameW, padding: 9, justifyContent: 'center' }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.6 }}>Stagiaire</Text>
            </View>
            {creneaux.map((c, i) => (
              <View key={i} style={{ width: creneauW, paddingVertical: 7, paddingHorizontal: 3, borderLeftWidth: 0.5, borderLeftColor: '#2a6555', alignItems: 'center' }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: '#fff' }}>{c.jour}</Text>
                <Text style={{ fontSize: 6, color: '#c9e2d9', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>{c.creneau}</Text>
              </View>
            ))}
          </View>

          {/* Lignes stagiaires (signature) */}
          {chunk.map((a, idx) => (
            <View key={idx} wrap={false} style={{ flexDirection: 'row', minHeight: 46, borderTopWidth: 0.5, borderTopColor: SURFACE_200, backgroundColor: idx % 2 ? SURFACE_50 : '#fff' }}>
              <View style={{ width: nameW, padding: 9, justifyContent: 'center' }}>
                <Text style={{ fontSize: 8, color: SURFACE_900, fontFamily: 'Satoshi', fontWeight: 700 }}>{a ? `${a.nom || ''}`.toUpperCase().trim() : ''}</Text>
                <Text style={{ fontSize: 8, color: SURFACE_700, marginTop: 1 }}>{a?.prenom || ''}</Text>
                {a?.entreprise && <Text style={{ fontSize: 6, color: SURFACE_500, marginTop: 2 }}>{a.entreprise}</Text>}
              </View>
              {creneaux.map((_, i) => (
                <View key={i} style={{ width: creneauW, borderLeftWidth: 0.5, borderLeftColor: SURFACE_200 }} />
              ))}
            </View>
          ))}

          {/* Ligne formateur (mise en avant) */}
          <View style={{ flexDirection: 'row', minHeight: 46, borderTopWidth: 1.2, borderTopColor: BRAND_GREEN, backgroundColor: BRAND_ULTRA_LIGHT }}>
            <View style={{ width: nameW, padding: 9, justifyContent: 'center' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, textTransform: 'uppercase', letterSpacing: 0.6 }}>Formateur</Text>
              {formateur && <Text style={{ fontSize: 7.5, color: SURFACE_700, marginTop: 3 }}>{formateur.prenom} {formateur.nom}</Text>}
            </View>
            {creneaux.map((_, i) => (
              <View key={i} style={{ width: creneauW, borderLeftWidth: 0.5, borderLeftColor: '#cfe3db' }} />
            ))}
          </View>
        </View>

        {/* Mention légale */}
        <Text style={{ fontSize: 7.5, color: SURFACE_500, marginBottom: 10, lineHeight: 1.5 }}>
          Chaque stagiaire et le formateur signent dans la case correspondant à la demi-journée de présence. Cette feuille atteste de la réalité de l'action de formation (art. L.6353-1 du Code du travail) et fait foi des présences enregistrées.
        </Text>

        {/* Signatures finales — cartes neutres, bloc insécable (jamais coupé par un saut de page) */}
        <View wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14 }}>
          <View style={{ flex: 1, backgroundColor: SURFACE_50, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 8 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Cachet de l'organisme</Text>
            <Text style={{ fontSize: 7, color: SURFACE_500, marginBottom: 5 }}>{org?.name || 'Lab Learning'}</Text>
            <View style={{ height: 48, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 3, backgroundColor: '#fff' }} />
          </View>
          <View style={{ flex: 1, backgroundColor: SURFACE_50, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 8 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Signature du formateur</Text>
            {formateur && <Text style={{ fontSize: 7, color: SURFACE_500, marginBottom: 5 }}>{formateur.prenom} {formateur.nom}</Text>}
            <View style={{ height: 48, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 3, backgroundColor: '#fff' }} />
          </View>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
      )
      })}
    </Document>
  )
}
