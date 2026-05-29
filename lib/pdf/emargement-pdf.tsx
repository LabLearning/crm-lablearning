import { Document, Page, View, Text } from '@react-pdf/renderer'
import { shared, BRAND_GREEN, BRAND_LIGHT, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface EmargementProps {
  session: any
  formation: any
  org: any
  formateur: any
  apprenants: any[]
}

// Liste des demi-journées entre date_debut et date_fin (max raisonnable)
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
  const creneaux = buildCreneaux(session.date_debut, session.date_fin)
  const nameW = 150
  const lieu = session.lieu || session.adresse || [session.code_postal, session.ville].filter(Boolean).join(' ') || '—'
  const numero = session.reference || `SESS-${String(session.id).slice(0, 8)}`

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={shared.page}>
        {/* En-tête */}
        <View style={{ ...shared.header, marginBottom: 16 }}>
          <View>
            <Text style={shared.orgName}>{org?.name || 'Lab Learning'}</Text>
            <Text style={shared.orgTagline}>Organisme de formation professionnelle</Text>
            {org?.numero_da && <Text style={shared.orgTagline}>N° déclaration d'activité : {org.numero_da}</Text>}
            <Text style={shared.qualiopiTag}>Certifié Qualiopi</Text>
          </View>
          <View>
            <Text style={shared.docTitle}>Feuille d'émargement</Text>
            <Text style={shared.docMeta}>{numero}</Text>
          </View>
        </View>

        {/* Infos formation */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
          <View style={{ width: '50%', marginBottom: 3 }}><Text style={shared.label}>Formation :</Text><Text style={{ ...shared.value, fontFamily: 'Helvetica-Bold' }}>{formation?.intitule || '—'}</Text></View>
          <View style={{ width: '50%', marginBottom: 3 }}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{formateur ? `${formateur.prenom || ''} ${formateur.nom || ''}`.trim() : '—'}</Text></View>
          <View style={{ width: '50%', marginBottom: 3 }}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>Du {new Date(session.date_debut).toLocaleDateString('fr-FR')} au {new Date(session.date_fin || session.date_debut).toLocaleDateString('fr-FR')}</Text></View>
          <View style={{ width: '50%', marginBottom: 3 }}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{lieu}</Text></View>
          {(formation?.duree_heures || session.horaires) && (
            <View style={{ width: '50%', marginBottom: 3 }}><Text style={shared.label}>Durée / horaires :</Text><Text style={shared.value}>{formation?.duree_heures ? `${formation.duree_heures} h` : ''} {session.horaires || ''}</Text></View>
          )}
        </View>

        {/* Tableau d'émargement */}
        <View style={{ borderWidth: 0.5, borderColor: '#d6d3d1' }}>
          {/* Ligne jours */}
          <View style={{ flexDirection: 'row', backgroundColor: BRAND_GREEN }}>
            <View style={{ width: nameW, padding: 5, justifyContent: 'center' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fff' }}>Stagiaire</Text>
            </View>
            {creneaux.map((c, i) => (
              <View key={i} style={{ flex: 1, padding: 4, borderLeftWidth: 0.5, borderLeftColor: '#3a6f60', alignItems: 'center' }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' }}>{c.jour}</Text>
                <Text style={{ fontSize: 6, color: '#c9e2d9' }}>{c.creneau}</Text>
              </View>
            ))}
          </View>

          {/* Lignes stagiaires */}
          {(apprenants.length > 0 ? apprenants : [null, null, null, null, null]).map((a, idx) => (
            <View key={idx} style={{ flexDirection: 'row', minHeight: 32, borderTopWidth: 0.5, borderTopColor: '#e7e5e4', backgroundColor: idx % 2 ? '#fafaf9' : '#fff' }}>
              <View style={{ width: nameW, padding: 5, justifyContent: 'center' }}>
                <Text style={{ fontSize: 8, color: SURFACE_900 }}>{a ? `${a.prenom || ''} ${a.nom || ''}`.trim() : ''}</Text>
                {a?.entreprise && <Text style={{ fontSize: 6, color: SURFACE_500 }}>{a.entreprise}</Text>}
              </View>
              {creneaux.map((_, i) => (
                <View key={i} style={{ flex: 1, borderLeftWidth: 0.5, borderLeftColor: '#e7e5e4' }} />
              ))}
            </View>
          ))}

          {/* Ligne formateur */}
          <View style={{ flexDirection: 'row', minHeight: 32, borderTopWidth: 1, borderTopColor: BRAND_GREEN, backgroundColor: BRAND_LIGHT }}>
            <View style={{ width: nameW, padding: 5, justifyContent: 'center' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN }}>Formateur</Text>
            </View>
            {creneaux.map((_, i) => (
              <View key={i} style={{ flex: 1, borderLeftWidth: 0.5, borderLeftColor: '#cfe3db' }} />
            ))}
          </View>
        </View>

        <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 10, lineHeight: 1.5 }}>
          Chaque stagiaire et le formateur signent dans la case correspondant à la demi-journée de présence.
          Cette feuille d'émargement atteste de la réalité de l'action de formation (art. L6353-1 du Code du travail).
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
          <View>
            <Text style={{ fontSize: 8, color: SURFACE_700 }}>Cachet de l'organisme</Text>
            <View style={{ height: 50, width: 180, borderWidth: 0.5, borderColor: '#d6d3d1', marginTop: 4 }} />
          </View>
          <View>
            <Text style={{ fontSize: 8, color: SURFACE_700 }}>Signature du formateur</Text>
            <View style={{ height: 50, width: 180, borderWidth: 0.5, borderColor: '#d6d3d1', marginTop: 4 }} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
