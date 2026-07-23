import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface Emargement {
  apprenant_id: string
  date: string
  creneau: string
  est_present: boolean | null
  signature_data: string | null
  signed_at: string | null
  motif_absence: string | null
}
interface Feuille {
  date: string
  creneau: string
  formateur_signature_data: string | null
  validated_at: string | null
}
interface Apprenant { id: string; prenom?: string | null; nom?: string | null; entreprise?: string | null }

interface Props {
  session: any
  formation: any
  org: any
  formateur: any
  apprenants: Apprenant[]
  emargements: Emargement[]
  feuilles: Feuille[]
}

const CRENEAU_ORDER: Record<string, number> = { matin: 0, journee: 1, apres_midi: 2 }
function creneauLabel(c: string) {
  if (c === 'matin') return 'Matin'
  if (c === 'apres_midi') return 'Après-midi'
  return 'Journée'
}

/**
 * Feuille d'émargement SIGNÉE : reprend la mise en page de la feuille vierge
 * mais remplit chaque case avec la signature numérique réelle du stagiaire
 * (ou « Absent » + motif). Une page par jour. Sert au formateur et à l'admin
 * pour récupérer les présences signées.
 */
export function EmargementSignePDF({ session, formation, org, formateur, apprenants, emargements, feuilles }: Props) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const lieu = session.lieu || session.adresse || [session.code_postal, session.ville].filter(Boolean).join(' ') || '—'
  const numero = session.reference || `SESS-${String(session.id || '').slice(0, 8)}`

  // Signatures indexées par apprenant + jour + créneau
  const sigKey = (apprenantId: string, date: string, creneau: string) => `${apprenantId}|${date}|${creneau}`
  const emByKey = new Map<string, Emargement>()
  for (const e of emargements) emByKey.set(sigKey(e.apprenant_id, e.date, e.creneau), e)
  const feuilleByKey = new Map<string, Feuille>()
  for (const f of feuilles) feuilleByKey.set(`${f.date}|${f.creneau}`, f)

  // Jours réellement émargés (les week-ends sont déjà exclus à la création)
  const dates = Array.from(new Set(emargements.map((e) => e.date))).sort()
  const jours = dates.map((date) => {
    const creneaux = Array.from(new Set(emargements.filter((e) => e.date === date).map((e) => e.creneau)))
      .sort((a, b) => (CRENEAU_ORDER[a] ?? 9) - (CRENEAU_ORDER[b] ?? 9))
    return { date, creneaux }
  })

  const sortedApprenants = [...apprenants].sort((a, b) => `${a.nom || ''}`.localeCompare(`${b.nom || ''}`))
  const chunk = sortedApprenants.length > 0 ? sortedApprenants : []

  const pageWidth = 505
  const nameW = 140

  return (
    <Document>
      {jours.map(({ date, creneaux }, dayIdx) => {
        const creneauW = creneaux.length > 0 ? (pageWidth - nameW) / creneaux.length : 60
        const jourLabel = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const allValidated = creneaux.length > 0 && creneaux.every((c) => feuilleByKey.get(`${date}|${c}`)?.validated_at)
        return (
          <Page key={date} size="A4" orientation="portrait" style={shared.page}>
            <PdfDocHeader
              docTitle="Feuille d'émargement signée"
              numero={numero}
              date={jours.length > 1 ? `Jour ${dayIdx + 1} / ${jours.length}` : `Éditée le ${today}`}
              org={org}
            />

            <View style={shared.card}>
              <PdfSectionTitle>Action de formation</PdfSectionTitle>
              <View style={shared.row}><Text style={shared.label}>Intitulé</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>{`${formation?.intitule || '—'}${formation?.duree_heures ? ` (${formation.duree_heures} heures)` : ''}`}</Text></View>
              <View style={shared.row}><Text style={shared.label}>Jour</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{jourLabel}</Text></View>
              <View style={shared.row}><Text style={shared.label}>Lieu{session.horaires ? ' / horaires' : ''}</Text><Text style={shared.value}>{`${lieu}${session.horaires ? ` — ${session.horaires}` : ''}`}</Text></View>
              <View style={shared.row}><Text style={shared.label}>Formateur</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{formateur ? `${formateur.prenom || ''} ${formateur.nom || ''}`.trim() : '—'}</Text></View>
            </View>

            <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, marginBottom: 12 }}>
              {/* En-tête colonnes */}
              <View style={{ flexDirection: 'row', backgroundColor: BRAND_GREEN }}>
                <View style={{ width: nameW, padding: 9, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.6 }}>Stagiaire</Text>
                </View>
                {creneaux.map((c, i) => (
                  <View key={i} style={{ width: creneauW, paddingVertical: 7, paddingHorizontal: 3, borderLeftWidth: 0.5, borderLeftColor: '#2a6555', alignItems: 'center' }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: '#fff' }}>{creneauLabel(c)}</Text>
                  </View>
                ))}
              </View>

              {/* Lignes stagiaires : signature réelle ou absence */}
              {chunk.map((a, idx) => (
                <View key={a.id} wrap={false} style={{ flexDirection: 'row', minHeight: 46, borderTopWidth: 0.5, borderTopColor: SURFACE_200, backgroundColor: idx % 2 ? SURFACE_50 : '#fff' }}>
                  <View style={{ width: nameW, padding: 9, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 8, color: SURFACE_900, fontFamily: 'Satoshi', fontWeight: 700 }}>{`${a.nom || ''}`.toUpperCase().trim()}</Text>
                    <Text style={{ fontSize: 8, color: SURFACE_700, marginTop: 1 }}>{a.prenom || ''}</Text>
                    {a.entreprise && <Text style={{ fontSize: 6, color: SURFACE_500, marginTop: 2 }}>{a.entreprise}</Text>}
                  </View>
                  {creneaux.map((c, i) => {
                    const em = emByKey.get(sigKey(a.id, date, c))
                    return (
                      <View key={i} style={{ width: creneauW, borderLeftWidth: 0.5, borderLeftColor: SURFACE_200, alignItems: 'center', justifyContent: 'center', padding: 3 }}>
                        {em?.signature_data ? (
                          <Image src={em.signature_data} style={{ height: 34, maxWidth: creneauW - 8, objectFit: 'contain' }} />
                        ) : em?.motif_absence || em?.est_present === false ? (
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: '#b91c1c' }}>Absent</Text>
                            {em?.motif_absence && <Text style={{ fontSize: 6, color: SURFACE_500, marginTop: 1, textAlign: 'center' }}>{em.motif_absence}</Text>}
                          </View>
                        ) : null}
                      </View>
                    )
                  })}
                </View>
              ))}

              {/* Ligne formateur : sa signature de validation par créneau */}
              <View style={{ flexDirection: 'row', minHeight: 46, borderTopWidth: 1.2, borderTopColor: BRAND_GREEN, backgroundColor: BRAND_ULTRA_LIGHT }}>
                <View style={{ width: nameW, padding: 9, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, textTransform: 'uppercase', letterSpacing: 0.6 }}>Formateur</Text>
                  {formateur && <Text style={{ fontSize: 7.5, color: SURFACE_700, marginTop: 3 }}>{formateur.prenom} {formateur.nom}</Text>}
                </View>
                {creneaux.map((c, i) => {
                  const f = feuilleByKey.get(`${date}|${c}`)
                  return (
                    <View key={i} style={{ width: creneauW, borderLeftWidth: 0.5, borderLeftColor: '#cfe3db', alignItems: 'center', justifyContent: 'center', padding: 3 }}>
                      {f?.formateur_signature_data ? (
                        <Image src={f.formateur_signature_data} style={{ height: 34, maxWidth: creneauW - 8, objectFit: 'contain' }} />
                      ) : null}
                    </View>
                  )
                })}
              </View>
            </View>

            <Text style={{ fontSize: 7.5, color: SURFACE_500, marginBottom: 10, lineHeight: 1.5 }}>
              {allValidated
                ? 'Feuille validée par le formateur. Les signatures ci-dessus ont été recueillies par voie électronique et attestent de la réalité de la présence (art. L.6353-1 du Code du travail).'
                : 'Signatures recueillies par voie électronique. Cette feuille atteste de la réalité des présences enregistrées (art. L.6353-1 du Code du travail).'}
            </Text>

            <PdfDocFooter numero={numero} org={org} />
          </Page>
        )
      })}
    </Document>
  )
}
