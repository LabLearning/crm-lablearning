import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared,
  BRAND_GREEN, BRAND_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'

export interface LigneReleveApporteur {
  etablissement: string
  ville: string | null
  formation: string
  reference: string | null
  dateDebut: string | null
  dateFin: string | null
  base: number
  taux: number | null
  commission: number
  datePaiement?: string | null
  referencePaiement?: string | null
}

export interface ReleveCommissionsApporteurProps {
  org: any
  apporteur: {
    nom: string
    raison_sociale?: string | null
    siret?: string | null
    adresse?: string | null
    code_postal?: string | null
    ville?: string | null
    email?: string | null
    regle: string
  }
  lignes: LigneReleveApporteur[]
  numero: string
  etat: 'validee' | 'payee' | 'en_attente'
  /** Commissions en attente d'encaissement, résumées sur le relevé « à verser ». */
  enCours: { nombre: number; montant: number }
}

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
    .format(Number(n || 0)).replace(/[  ]/g, ' ')
const jour = (d?: string | null) =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
const periode = (debut?: string | null, fin?: string | null) =>
  !debut ? '' : (!fin || fin === debut) ? jour(debut) : `${jour(debut)} au ${jour(fin)}`

const COL = { formation: '46%', base: '18%', taux: '12%', commission: '24%' }

const TITRES = {
  validee: { doc: 'Relevé de commissions', montant: 'Montant à verser', total: 'Total à verser' },
  payee: { doc: 'Relevé de commissions versées', montant: 'Montant versé', total: 'Total versé' },
  en_attente: { doc: 'Commissions en attente', montant: 'Commission prévisionnelle', total: 'Total prévisionnel' },
}

/**
 * Relevé des commissions d'un apporteur d'affaires, session par session,
 * regroupées par établissement. Pièce justificative du versement : l'apporteur
 * facture ce montant, majoré de la TVA s'il y est assujetti.
 */
export function ReleveCommissionsApporteurPDF({ org, apporteur, lignes, numero, etat, enCours }: ReleveCommissionsApporteurProps) {
  const total = lignes.reduce((t, l) => t + l.commission, 0)
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const titres = TITRES[etat]

  const parEtablissement = new Map<string, LigneReleveApporteur[]>()
  for (const l of lignes) {
    if (!parEtablissement.has(l.etablissement)) parEtablissement.set(l.etablissement, [])
    parEtablissement.get(l.etablissement)!.push(l)
  }
  const groupes = [...parEtablissement.entries()]
    .map(([nom, ls]) => ({
      nom,
      ville: ls[0]?.ville || null,
      lignes: ls.slice().sort((a, b) => String(a.dateDebut).localeCompare(String(b.dateDebut))),
      total: ls.reduce((t, l) => t + l.commission, 0),
    }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom))

  const adresse = [apporteur.adresse, [apporteur.code_postal, apporteur.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle={titres.doc} numero={numero} date={aujourdhui} org={org} />

        <View style={shared.section}>
          <PdfSectionTitle>Bénéficiaire</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Apporteur :</Text><Text style={shared.value}>{apporteur.raison_sociale || apporteur.nom}</Text></View>
          {apporteur.raison_sociale && apporteur.raison_sociale !== apporteur.nom ? <View style={shared.row}><Text style={shared.label}>Contact :</Text><Text style={shared.value}>{apporteur.nom}</Text></View> : null}
          {apporteur.siret ? <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{apporteur.siret}</Text></View> : null}
          {adresse ? <View style={shared.row}><Text style={shared.label}>Adresse :</Text><Text style={shared.value}>{adresse}</Text></View> : null}
          {apporteur.email ? <View style={shared.row}><Text style={shared.label}>Email :</Text><Text style={shared.value}>{apporteur.email}</Text></View> : null}
          <View style={shared.row}><Text style={shared.label}>Commission :</Text><Text style={shared.value}>{apporteur.regle}</Text></View>
        </View>

        <View style={{
          backgroundColor: BRAND_LIGHT, borderRadius: 6, padding: 14, marginBottom: 18,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <View>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3 }}>{titres.montant}</Text>
            <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 700, color: BRAND_GREEN, letterSpacing: -0.4 }}>{euro(total)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: SURFACE_500 }}>
              {lignes.length} formation{lignes.length > 1 ? 's' : ''} · {groupes.length} établissement{groupes.length > 1 ? 's' : ''}
            </Text>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginTop: 2 }}>Montants hors TVA</Text>
          </View>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Détail par formation</PdfSectionTitle>
          <View style={shared.table}>
            <View style={shared.tableHeader} fixed>
              <Text style={[shared.tableHeaderCell, { width: COL.formation }]}>Formation</Text>
              <Text style={[shared.tableHeaderCell, { width: COL.base, textAlign: 'right' }]}>Base HT</Text>
              <Text style={[shared.tableHeaderCell, { width: COL.taux, textAlign: 'right' }]}>Taux</Text>
              <Text style={[shared.tableHeaderCell, { width: COL.commission, textAlign: 'right' }]}>Commission</Text>
            </View>

            {groupes.map((g, ig) => (
              <View key={g.nom}>
                <View minPresenceAhead={56} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: SURFACE_50, paddingVertical: 6, paddingHorizontal: 10,
                  borderBottomWidth: 0.5, borderBottomColor: SURFACE_200,
                  borderTopWidth: ig === 0 ? 0 : 0.5, borderTopColor: SURFACE_200,
                }}>
                  <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>
                    {g.nom}{g.ville ? ` — ${g.ville}` : ''}
                  </Text>
                  <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{euro(g.total)}</Text>
                </View>

                {g.lignes.map((l, i) => (
                  <View key={`${l.reference}-${i}`} wrap={false} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                    <View style={{ width: COL.formation, paddingRight: 6 }}>
                      <Text style={[shared.tableCell, { color: SURFACE_900 }]}>{l.formation}</Text>
                      <Text style={{ fontSize: 7.5, color: SURFACE_400, marginTop: 1.5 }}>
                        {[l.reference, periode(l.dateDebut, l.dateFin), l.datePaiement ? `versée le ${jour(l.datePaiement)}${l.referencePaiement ? ` (${l.referencePaiement})` : ''}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[shared.tableCell, { width: COL.base, textAlign: 'right' }]}>{euro(l.base)}</Text>
                    <Text style={[shared.tableCell, { width: COL.taux, textAlign: 'right' }]}>{l.taux != null ? `${l.taux.toLocaleString('fr-FR')} %` : 'fixe'}</Text>
                    <Text style={[shared.tableCell, { width: COL.commission, textAlign: 'right', fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }]}>{euro(l.commission)}</Text>
                  </View>
                ))}
              </View>
            ))}

            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: BRAND_GREEN, paddingVertical: 9, paddingHorizontal: 10,
            }}>
              <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff' }}>{titres.total}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff' }}>{euro(total)}</Text>
            </View>
          </View>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Conditions</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            La commission est calculée sur le montant hors taxes de chaque formation réalisée chez un établissement apporté :
            montant pris en charge par le financeur, sinon prix HT de la session. Les montants de ce relevé sont hors TVA ;
            l&apos;apporteur les facture majorés de la TVA s&apos;il y est assujetti.
            {etat === 'validee' ? ` Ne figurent ici que les formations terminées et encaissées par ${org?.name || 'Lab Learning'}, la commission n'étant due qu'après règlement du client ou du financeur.` : ''}
            {etat === 'en_attente' ? ' Ce relevé est prévisionnel : les formations listées sont terminées mais leur règlement n’est pas encore arrivé.' : ''}
            {etat === 'validee' && enCours.nombre > 0 ? ` ${enCours.nombre} autre${enCours.nombre > 1 ? 's formations sont' : ' formation est'} en attente de règlement, pour ${euro(enCours.montant)} de commission à venir.` : ''}
          </Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 6 }}>
            Relevé établi le {aujourdhui}.
            {etat === 'validee' ? ` Merci d'émettre votre facture pour ${euro(total)} HT en rappelant la référence ${numero}.` : ''}
          </Text>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
