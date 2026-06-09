import { Document, Page, View, Text } from '@react-pdf/renderer'
import { shared, PdfDocHeader, PdfDocFooter } from './components'
import type { Facture } from '@/lib/types/facture'

function fmt(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TYPE_LABELS: Record<string, string> = {
  facture: 'FACTURE',
  acompte: 'FACTURE D\'ACOMPTE',
  solde: 'FACTURE DE SOLDE',
  avoir: 'AVOIR',
}

const PAIEMENT_LABELS: Record<string, string> = {
  virement: 'Virement bancaire',
  cb: 'Carte bancaire',
  cheque: 'Chèque',
  prelevement: 'Prélèvement',
  especes: 'Espèces',
  stripe: 'Paiement en ligne',
  opco: 'OPCO',
  cpf: 'CPF',
  autre: 'Autre',
}

export function FacturePDF({ facture, org }: { facture: Facture; org?: any }) {
  const clientName = facture.client?.raison_sociale
    || (facture.client?.nom ? `${facture.client.prenom || ''} ${facture.client.nom}`.trim() : '—')
  const client: any = facture.client || {}

  const lignes = facture.lignes || []
  const paiements = facture.paiements || []
  const docTitle = TYPE_LABELS[facture.type] || 'FACTURE'

  // OF identité — exonération TVA conditionnelle (formation pro continue + N° DA = art. 261-4-4° a CGI)
  const ofNom = org?.legal_name || org?.name || 'Lab Learning'
  const ofExonereTVA = !!org?.numero_da && (!facture.taux_tva || Number(facture.taux_tva) === 0)
  const iban = org?.banque_iban || ''
  const bic = org?.banque_bic || ''
  const banque = org?.banque_nom || ''
  const titulaire = org?.banque_titulaire || ofNom

  return (
    <Document title={`${docTitle} ${facture.numero}`} author="Lab Learning">
      <Page size="A4" style={shared.page}>
        <PdfDocHeader
          docTitle={docTitle === 'FACTURE' ? 'Facture' : docTitle === 'AVOIR' ? 'Avoir' : docTitle === 'FACTURE D\'ACOMPTE' ? 'Facture d\'acompte' : docTitle === 'FACTURE DE SOLDE' ? 'Facture de solde' : docTitle}
          numero={facture.numero}
          date={`Émise le ${fmtDate(facture.date_emission)}`}
          statut={`Échéance ${fmtDate(facture.date_echeance)}`}
          org={org}
        />

        {/* Émetteur (OF) + Facturer à */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={shared.sectionTitle}>Émetteur</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{ofNom}</Text>
            {org?.address && <Text style={{ fontSize: 8, color: '#57534e' }}>{org.address}</Text>}
            {(org?.postal_code || org?.city) && <Text style={{ fontSize: 8, color: '#57534e' }}>{org?.postal_code || ''} {org?.city || ''}</Text>}
            {org?.siret && <Text style={{ fontSize: 8, color: '#57534e', marginTop: 2 }}>SIRET : {org.siret}</Text>}
            {org?.rcs && <Text style={{ fontSize: 8, color: '#57534e' }}>{org.rcs}</Text>}
            {org?.numero_tva_intra && <Text style={{ fontSize: 8, color: '#57534e' }}>TVA : {org.numero_tva_intra}</Text>}
            {(org?.forme_juridique || org?.capital_social) && (
              <Text style={{ fontSize: 8, color: '#57534e' }}>
                {org.forme_juridique || ''}{org.capital_social ? ` au capital de ${Number(org.capital_social).toLocaleString('fr-FR')} €` : ''}
              </Text>
            )}
            {org?.numero_da && <Text style={{ fontSize: 8, color: '#57534e' }}>N° déclaration d'activité : {org.numero_da}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={shared.sectionTitle}>Facturer à</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{clientName}</Text>
            {client.adresse && <Text style={{ fontSize: 8, color: '#57534e' }}>{client.adresse}</Text>}
            {(client.code_postal || client.ville) && <Text style={{ fontSize: 8, color: '#57534e' }}>{client.code_postal || ''} {client.ville || ''}</Text>}
            {client.siret && <Text style={{ fontSize: 8, color: '#57534e', marginTop: 2 }}>SIRET : {client.siret}</Text>}
            {client.tva_intra && <Text style={{ fontSize: 8, color: '#57534e' }}>TVA : {client.tva_intra}</Text>}
            {client.email && <Text style={{ fontSize: 8, color: '#57534e' }}>{client.email}</Text>}
          </View>
        </View>

        {/* Object */}
        {facture.objet && (
          <View style={{ ...shared.infoBox, marginBottom: 16 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Objet</Text>
            <Text style={shared.infoBoxText}>{facture.objet}</Text>
          </View>
        )}

        {/* Lines */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Détail des prestations</Text>
          <View style={shared.table}>
            <View style={shared.tableHeader}>
              <Text style={{ ...shared.tableHeaderCell, flex: 4 }}>Désignation</Text>
              <Text style={{ ...shared.tableHeaderCell, width: 40, textAlign: 'right' }}>Qté</Text>
              <Text style={{ ...shared.tableHeaderCell, width: 45, textAlign: 'right' }}>Unité</Text>
              <Text style={{ ...shared.tableHeaderCell, width: 70, textAlign: 'right' }}>PU HT</Text>
              <Text style={{ ...shared.tableHeaderCell, width: 70, textAlign: 'right' }}>Total HT</Text>
            </View>
            {lignes.length > 0 ? (
              lignes.map((l, i) => (
                <View key={l.id} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                  <View style={{ flex: 4 }}>
                    <Text style={shared.tableCell}>{l.designation}</Text>
                    {l.description && (
                      <Text style={{ fontSize: 7, color: '#a8a29e', marginTop: 1 }}>{l.description}</Text>
                    )}
                  </View>
                  <Text style={{ ...shared.tableCell, width: 40, textAlign: 'right' }}>{l.quantite}</Text>
                  <Text style={{ ...shared.tableCell, width: 45, textAlign: 'right' }}>{l.unite}</Text>
                  <Text style={{ ...shared.tableCell, width: 70, textAlign: 'right' }}>{fmt(l.prix_unitaire_ht)} €</Text>
                  <Text style={{ ...shared.tableCell, width: 70, textAlign: 'right' }}>{fmt(l.montant_ht)} €</Text>
                </View>
              ))
            ) : (
              <View style={shared.tableRow}>
                <View style={{ flex: 4 }}>
                  <Text style={shared.tableCell}>{facture.objet || 'Prestation de formation professionnelle'}</Text>
                </View>
                <Text style={{ ...shared.tableCell, width: 40, textAlign: 'right' }}>1</Text>
                <Text style={{ ...shared.tableCell, width: 45, textAlign: 'right' }}>Forfait</Text>
                <Text style={{ ...shared.tableCell, width: 70, textAlign: 'right' }}>{fmt(facture.montant_ht)} €</Text>
                <Text style={{ ...shared.tableCell, width: 70, textAlign: 'right' }}>{fmt(facture.montant_ht)} €</Text>
              </View>
            )}
          </View>
        </View>

        {/* Totals */}
        <View style={shared.totalsBox}>
          {facture.remise_montant > 0 && (
            <View style={shared.totalRow}>
              <Text style={shared.totalLabel}>Remise ({facture.remise_pourcent}%)</Text>
              <Text style={shared.totalValue}>- {fmt(facture.remise_montant)} €</Text>
            </View>
          )}
          <View style={shared.totalRow}>
            <Text style={shared.totalLabel}>Total HT</Text>
            <Text style={shared.totalValue}>{fmt(facture.montant_ht)} €</Text>
          </View>
          <View style={shared.totalRow}>
            <Text style={shared.totalLabel}>TVA ({facture.taux_tva}%)</Text>
            <Text style={shared.totalValue}>{fmt(facture.montant_tva)} €</Text>
          </View>
          <View style={{ ...shared.totalRow, marginTop: 4 }}>
            <Text style={shared.totalTTCLabel}>Total TTC</Text>
            <Text style={shared.totalTTCValue}>{fmt(facture.montant_ttc)} €</Text>
          </View>
          {facture.montant_paye > 0 && (
            <>
              <View style={{ ...shared.totalRow, marginTop: 6 }}>
                <Text style={shared.totalLabel}>Montant réglé</Text>
                <Text style={shared.totalValue}>- {fmt(facture.montant_paye)} €</Text>
              </View>
              <View style={{ ...shared.totalRow, marginTop: 2 }}>
                <Text style={{ ...shared.totalTTCLabel, color: facture.montant_restant > 0 ? '#dc2626' : '#16a34a' }}>
                  Reste à payer
                </Text>
                <Text style={{ ...shared.totalTTCValue, color: facture.montant_restant > 0 ? '#dc2626' : '#16a34a' }}>
                  {fmt(facture.montant_restant)} €
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Paiements history */}
        {paiements.length > 0 && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Règlements reçus</Text>
            {paiements.map((p) => (
              <View key={p.id} style={{ ...shared.row, marginBottom: 4 }}>
                <Text style={{ ...shared.label, width: 90 }}>{fmtDate(p.date_paiement)}</Text>
                <Text style={{ ...shared.value, width: 100 }}>{PAIEMENT_LABELS[p.mode] || p.mode}</Text>
                <Text style={{ fontSize: 8, color: '#16a34a', width: 80, textAlign: 'right' }}>
                  {fmt(p.montant)} €
                </Text>
                {p.reference && <Text style={{ fontSize: 7, color: '#78716C', marginLeft: 8 }}>Réf. {p.reference}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Conditions */}
        {facture.conditions_paiement && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Conditions de paiement</Text>
            <Text style={{ fontSize: 8, color: '#57534e', lineHeight: 1.5 }}>{facture.conditions_paiement}</Text>
          </View>
        )}

        {/* OPCO / Subrogation */}
        {facture.subrogation && facture.financeur_nom && (
          <View style={{ ...shared.infoBox, marginTop: 8 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Subrogation de paiement</Text>
            <Text style={shared.infoBoxText}>
              Paiement attendu de {facture.financeur_nom} par subrogation de paiement.
            </Text>
          </View>
        )}

        {/* Coordonnées bancaires (paiement par virement) */}
        {iban && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Règlement par virement</Text>
            <View style={shared.row}><Text style={shared.label}>Bénéficiaire</Text><Text style={shared.value}>{titulaire}</Text></View>
            {banque && <View style={shared.row}><Text style={shared.label}>Banque</Text><Text style={shared.value}>{banque}</Text></View>}
            <View style={shared.row}><Text style={shared.label}>IBAN</Text><Text style={shared.value}>{iban}</Text></View>
            {bic && <View style={shared.row}><Text style={shared.label}>BIC</Text><Text style={shared.value}>{bic}</Text></View>}
            <Text style={{ fontSize: 7, color: '#78716c', marginTop: 4 }}>Merci d'indiquer le numéro de facture {facture.numero} en référence du virement.</Text>
          </View>
        )}

        {/* Mentions légales (art. L441-9, L441-10, D441-5) */}
        <View style={{ ...shared.infoBox, marginTop: 8 }}>
          <Text style={{ fontSize: 7, color: '#78716c', lineHeight: 1.5 }}>
            {ofExonereTVA
              ? `TVA non applicable, art. 261-4-4° a du Code général des impôts (action de formation professionnelle continue dispensée par un organisme déclaré sous le n° ${org?.numero_da || '—'}).\n`
              : 'TVA acquittée sur les encaissements (prestations de services).\n'}
            En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal en vigueur, exigibles sans rappel, et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L.441-10 et D.441-5 du Code de commerce).{'\n'}
            Aucun escompte n'est accordé pour règlement anticipé.
          </Text>
        </View>

        <PdfDocFooter numero={facture.numero} org={org} />
      </Page>
    </Document>
  )
}
