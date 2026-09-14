import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared,
  BRAND_GREEN, BRAND_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'

export interface LigneReleve {
  etablissement: string
  ville: string | null
  formation: string
  reference: string | null
  dateDebut: string | null
  dateFin: string | null
  nbStagiaires: number
  base: number
  coutFormateur: number
  commission: number
}

export interface ReleveCommissionsProps {
  org: any
  franchise: {
    nom: string
    raison_sociale?: string | null
    siret?: string | null
    adresse?: string | null
    code_postal?: string | null
    ville?: string | null
    contact_nom?: string | null
    contact_email?: string | null
    taux_commission?: number | string | null
    commission_type?: string | null
  }
  lignes: LigneReleve[]
  numero: string
  /** Commissions non encore dues, résumées en une ligne. */
  enCours: { nombre: number; montant: number }
}

// Les espaces insécables du format fr-FR (U+202F, U+00A0) n'ont pas de glyphe
// dans Satoshi : sans remplacement, les milliers se collent au chiffre suivant.
const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
    .format(Number(n || 0)).replace(/[\u202F\u00A0]/g, ' ')
const jour = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
const periode = (debut?: string | null, fin?: string | null) =>
  !debut ? '' : (!fin || fin === debut) ? jour(debut) : `${jour(debut)} au ${jour(fin)}`

// Largeurs de colonnes, en pourcentage de la largeur utile
const COL = { formation: '44%', stagiaires: '12%', base: '20%', commission: '24%' }

/**
 * Relevé des commissions dues à une franchise, dossier par dossier.
 * Sert de pièce justificative au versement : la franchise facture ce montant.
 */
export function ReleveCommissionsPDF({ org, franchise, lignes, numero, enCours }: ReleveCommissionsProps) {
  const total = lignes.reduce((t, l) => t + l.commission, 0)
  const totalStagiaires = lignes.reduce((t, l) => t + l.nbStagiaires, 0)
  const estNet = franchise.commission_type === 'budget_net'
  const taux = Number(franchise.taux_commission || (estNet ? 40 : 10))
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Regroupement par établissement, du plus gros au plus petit
  const parEtablissement = new Map<string, LigneReleve[]>()
  for (const l of lignes) {
    const cle = l.etablissement
    if (!parEtablissement.has(cle)) parEtablissement.set(cle, [])
    parEtablissement.get(cle)!.push(l)
  }
  const groupes = [...parEtablissement.entries()]
    .map(([nom, ls]) => ({
      nom,
      ville: ls[0]?.ville || null,
      lignes: ls.slice().sort((a, b) => String(a.dateDebut).localeCompare(String(b.dateDebut))),
      total: ls.reduce((t, l) => t + l.commission, 0),
    }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom))

  const adresse = [franchise.adresse, [franchise.code_postal, franchise.ville].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ')

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Relevé de commissions" numero={numero} date={aujourdhui} org={org} />

        <View style={shared.section}>
          <PdfSectionTitle>Bénéficiaire</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Franchise :</Text><Text style={shared.value}>{franchise.raison_sociale || franchise.nom}</Text></View>
          {franchise.siret ? <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{franchise.siret}</Text></View> : null}
          {adresse ? <View style={shared.row}><Text style={shared.label}>Adresse :</Text><Text style={shared.value}>{adresse}</Text></View> : null}
          {franchise.contact_nom ? <View style={shared.row}><Text style={shared.label}>Contact :</Text><Text style={shared.value}>{franchise.contact_nom}{franchise.contact_email ? ` — ${franchise.contact_email}` : ''}</Text></View> : null}
          <View style={shared.row}>
            <Text style={shared.label}>Commission :</Text>
            <Text style={shared.value}>
              {taux} % TTC {estNet ? 'du budget net de chaque dossier, après déduction des frais de formateur' : 'du budget débloqué de chaque dossier'}
            </Text>
          </View>
        </View>

        {/* Le montant, tout de suite */}
        <View style={{
          backgroundColor: BRAND_LIGHT, borderRadius: 6, padding: 14, marginBottom: 18,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <View>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3 }}>Montant à verser</Text>
            <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 700, color: BRAND_GREEN, letterSpacing: -0.4 }}>
              {euro(total)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: SURFACE_500 }}>
              {lignes.length} dossier{lignes.length > 1 ? 's' : ''} · {groupes.length} établissement{groupes.length > 1 ? 's' : ''}
            </Text>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginTop: 2 }}>
              {totalStagiaires} stagiaire{totalStagiaires > 1 ? 's' : ''} formé{totalStagiaires > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Détail par dossier</PdfSectionTitle>

          <View style={shared.table}>
            <View style={shared.tableHeader} fixed>
              <Text style={[shared.tableHeaderCell, { width: COL.formation }]}>Formation</Text>
              <Text style={[shared.tableHeaderCell, { width: COL.stagiaires, textAlign: 'center' }]}>Stagiaires</Text>
              <Text style={[shared.tableHeaderCell, { width: COL.base, textAlign: 'right' }]}>
                {estNet ? 'Budget net' : 'Budget débloqué'}
              </Text>
              <Text style={[shared.tableHeaderCell, { width: COL.commission, textAlign: 'right' }]}>Commission TTC</Text>
            </View>

            {groupes.map((g, ig) => (
              <View key={g.nom}>
                {/* Bandeau établissement */}
                <View minPresenceAhead={56} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: SURFACE_50, paddingVertical: 6, paddingHorizontal: 10,
                  borderBottomWidth: 0.5, borderBottomColor: SURFACE_200,
                  borderTopWidth: ig === 0 ? 0 : 0.5, borderTopColor: SURFACE_200,
                }}>
                  <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>
                    {g.nom}{g.ville ? ` — ${g.ville}` : ''}
                  </Text>
                  <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>
                    {euro(g.total)}
                  </Text>
                </View>

                {g.lignes.map((l, i) => (
                  <View key={`${l.reference}-${i}`} wrap={false} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                    <View style={{ width: COL.formation, paddingRight: 6 }}>
                      <Text style={[shared.tableCell, { color: SURFACE_900 }]}>{l.formation}</Text>
                      <Text style={{ fontSize: 7.5, color: SURFACE_400, marginTop: 1.5 }}>
                        {[l.reference, periode(l.dateDebut, l.dateFin)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[shared.tableCell, { width: COL.stagiaires, textAlign: 'center' }]}>{l.nbStagiaires || '—'}</Text>
                    <Text style={[shared.tableCell, { width: COL.base, textAlign: 'right' }]}>{euro(l.base)}</Text>
                    <Text style={[shared.tableCell, { width: COL.commission, textAlign: 'right', fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }]}>
                      {euro(l.commission)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Total */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: BRAND_GREEN, paddingVertical: 9, paddingHorizontal: 10,
            }}>
              <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff' }}>
                Total à verser
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff' }}>
                {euro(total)}
              </Text>
            </View>
          </View>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Conditions</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Les montants indiqués sont des montants TTC : la franchise les facture tels quels, sans TVA
            supplémentaire. Ne figurent ici que les dossiers terminés et encaissés par {org?.name || 'Lab Learning'},
            la commission n&apos;étant due qu&apos;après règlement du financeur.
            {enCours.nombre > 0 ? ` ${enCours.nombre} autre${enCours.nombre > 1 ? 's dossiers sont' : ' dossier est'} en attente de règlement, pour ${euro(enCours.montant)} de commission à venir : ${enCours.nombre > 1 ? 'ils figureront' : 'il figurera'} sur un prochain relevé.` : ''}
          </Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 6 }}>
            Relevé établi le {aujourdhui}. Merci d&apos;émettre votre facture pour {euro(total)} TTC en rappelant
            la référence {numero}.
          </Text>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
