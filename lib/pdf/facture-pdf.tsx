import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { PdfSectionTitle, shared, PdfDocHeader, PdfDocFooter } from './components'
import type { Facture } from '@/lib/types/facture'

function fmt(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202F\u00A0]/g, " ")
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

export interface DetailAction { label: string; valeur: string }

export function FacturePDF({ facture, org, agence, detail }: {
  facture: Facture
  org?: any
  agence?: any
  /** Type, référence, participant, dates, durée, lieu, n° d'engagement… */
  detail?: DetailAction[]
}) {
  // La créance n'est cédée au factor que sur les factures réglées par un
  // financeur (OPCO, France Travail). Un payeur direct (AGEFICE : le dirigeant
  // paie l'OF lui-même) règle Lab Learning, jamais Bibby Factor. Une facture
  // marquée « sans affacturage » est réglée à l'organisme quoi qu'il arrive.
  const payeurFinanceur = !!(facture.financeur_type || facture.financeur_nom)
  const affacture = !!org?.affacturage_actif && !!org?.affacturage_societe && payeurFinanceur && !facture.sans_affacturage
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
  // Facture soldée : le statut le dit ou les règlements couvrent le TTC.
  const totalRegleGlobal = (paiements || []).filter((p: any) => p.status !== 'refuse' && p.status !== 'annule')
    .reduce((t: number, p: any) => t + Number(p.montant || 0), 0)
  const estAcquittee = facture.status === 'payee' || (totalRegleGlobal > 0 && totalRegleGlobal >= Number(facture.montant_ttc || 0))

  return (
    <Document title={`${docTitle} ${facture.numero}`} author="Lab Learning">
      <Page size="A4" style={{ ...shared.page, paddingTop: 38, paddingBottom: 44, paddingHorizontal: 40 }}>
        <PdfDocHeader
          docTitle={docTitle === 'FACTURE' ? 'Facture' : docTitle === 'AVOIR' ? 'Avoir' : docTitle === 'FACTURE D\'ACOMPTE' ? 'Facture d\'acompte' : docTitle === 'FACTURE DE SOLDE' ? 'Facture de solde' : docTitle}
          numero={facture.numero}
          date={`Émise le ${fmtDate(facture.date_emission)}`}
          statut={estAcquittee ? 'Acquittée' : `Échéance ${fmtDate(facture.date_echeance)}`}
          org={org}
        />

        {/* Émetteur (OF) + Facturer à */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <PdfSectionTitle>Émetteur</PdfSectionTitle>
            <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>{ofNom}</Text>
            {org?.address && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{org.address}</Text>}
            {(org?.postal_code || org?.city) && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{org?.postal_code || ''} {org?.city || ''}</Text>}
            {org?.siret && <Text style={{ fontSize: 8, color: '#4E5A67', marginTop: 2 }}>SIRET : {org.siret}</Text>}
            {org?.rcs && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{org.rcs}</Text>}
            {org?.numero_tva_intra && <Text style={{ fontSize: 8, color: '#4E5A67' }}>TVA : {org.numero_tva_intra}</Text>}
            {(org?.forme_juridique || org?.capital_social) && (
              <Text style={{ fontSize: 8, color: '#4E5A67' }}>
                {org.forme_juridique || ''}{org.capital_social ? ` au capital de ${Number(org.capital_social).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, " ")} €` : ''}
              </Text>
            )}
            {org?.numero_da && <Text style={{ fontSize: 8, color: '#4E5A67' }}>N° déclaration d'activité : {org.numero_da}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <PdfSectionTitle>Facturer à</PdfSectionTitle>
            {agence ? (
              <>
                <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>{agence.nom}</Text>
                {agence.adresse && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{agence.adresse}</Text>}
                {(agence.code_postal || agence.ville) && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{agence.code_postal || ''} {agence.ville || ''}</Text>}
                {agence.siret && <Text style={{ fontSize: 8, color: '#4E5A67', marginTop: 2 }}>SIRET : {agence.siret}</Text>}
                {agence.tva_intra && <Text style={{ fontSize: 8, color: '#4E5A67' }}>TVA : {agence.tva_intra}</Text>}
                <View style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 7.5, color: '#6B7885' }}>Pour le compte de :</Text>
                  {/* Pas d'italique : la police embarquée n'a pas cette variante
                      et react-pdf fait alors échouer TOUT le document. */}
                  <Text style={{ fontSize: 8, color: '#37414D' }}>{clientName}</Text>
                  {client.adresse && <Text style={{ fontSize: 8, color: '#6B7885' }}>{client.adresse}</Text>}
                  {(client.code_postal || client.ville) && <Text style={{ fontSize: 8, color: '#6B7885' }}>{client.code_postal || ''} {client.ville || ''}</Text>}
                  {/* SIRET de l'entreprise bénéficiaire : France Travail le
                      demande pour rattacher la facture au bon employeur. */}
                  {client.siret && <Text style={{ fontSize: 8, color: '#6B7885' }}>SIRET : {client.siret}</Text>}
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>{clientName}</Text>
                {client.adresse && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{client.adresse}</Text>}
                {(client.code_postal || client.ville) && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{client.code_postal || ''} {client.ville || ''}</Text>}
                {client.siret && <Text style={{ fontSize: 8, color: '#4E5A67', marginTop: 2 }}>SIRET : {client.siret}</Text>}
                {client.tva_intra && <Text style={{ fontSize: 8, color: '#4E5A67' }}>TVA : {client.tva_intra}</Text>}
                {client.email && <Text style={{ fontSize: 8, color: '#4E5A67' }}>{client.email}</Text>}
              </>
            )}
          </View>
        </View>

        {/* Object */}
        {facture.objet && (
          <View style={{ ...shared.infoBox, marginBottom: 10, flexDirection: 'row' }}>
            <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700 }}>Objet : </Text>
            <Text style={{ ...shared.infoBoxText, flex: 1 }}>{facture.objet}</Text>
          </View>
        )}

        {/* Détail de l'action de formation — attendu par les financeurs
            (France Travail, OPCO) pour rapprocher la facture du dossier. */}
        {/* Deux colonnes : huit lignes de détail faisaient déborder la facture
            sur une seconde page. */}
        {detail && detail.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
            {[detail.filter((_, i) => i % 2 === 0), detail.filter((_, i) => i % 2 === 1)].map((colonne, ci) => (
              <View key={ci} style={{ flex: 1 }}>
                {colonne.map((d) => (
                  <View key={d.label} style={{ flexDirection: 'row', marginBottom: 2 }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, width: 82 }}>{d.label} :</Text>
                    <Text style={{ fontSize: 8, color: '#4E5A67', flex: 1 }}>{d.valeur}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Lines */}
        <View style={{ ...shared.section, marginBottom: 10 }}>
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
                      <Text style={{ fontSize: 7, color: '#9AA6B2', marginTop: 1 }}>{l.description}</Text>
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
        <View style={{ ...shared.totalsBox, marginBottom: 8 }}>
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
          <View style={{ ...shared.section, marginBottom: 10 }}>
            <PdfSectionTitle>Règlements reçus</PdfSectionTitle>
            {paiements.map((p) => (
              <View key={p.id} style={{ ...shared.row, marginBottom: 4 }}>
                <Text style={{ ...shared.label, width: 90 }}>{fmtDate(p.date_paiement)}</Text>
                <Text style={{ ...shared.value, width: 100 }}>{PAIEMENT_LABELS[p.mode] || p.mode}</Text>
                <Text style={{ fontSize: 8, color: '#16a34a', width: 80, textAlign: 'right' }}>
                  {fmt(p.montant)} €
                </Text>
                {p.reference && <Text style={{ fontSize: 7, color: '#6B7885', marginLeft: 8 }}>Réf. {p.reference}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Facture acquittée : mention exigée par les financeurs (AGEFICE
            notamment) — mode et référence du règlement + tampon de l'organisme. */}
        {(() => {
          const regles = paiements.filter((p: any) => p.status !== 'refuse' && p.status !== 'annule')
          const totalRegle = regles.reduce((t: number, p: any) => t + Number(p.montant || 0), 0)
          const acquittee = facture.status === 'payee' || (totalRegle > 0 && totalRegle >= Number(facture.montant_ttc || 0))
          if (!acquittee) return null
          const dernier: any = regles[regles.length - 1] || {}
          const detailReglement = [
            dernier.date_paiement ? `le ${fmtDate(dernier.date_paiement)}` : null,
            dernier.mode ? `par ${(PAIEMENT_LABELS as any)[dernier.mode] || dernier.mode}` : null,
            dernier.reference ? (/n°/i.test(dernier.reference) ? dernier.reference : `n° ${dernier.reference}`) : null,
          ].filter(Boolean).join(' ')
          return (
            <View style={{ marginBottom: 10, backgroundColor: '#F1F8F4', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: '#205040', borderRadius: 999, paddingVertical: 2.5, paddingHorizontal: 9 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: '#FFFFFF', letterSpacing: 1 }}>FACTURE ACQUITTÉE</Text>
                </View>
                <Text style={{ fontSize: 7.5, color: '#3D6B52', marginTop: 3.5, lineHeight: 1.4 }}>
                  {`Règlement reçu en totalité${detailReglement ? ` ${detailReglement}` : ''} — vaut reçu (art. 1353 du Code civil).`}
                </Text>
              </View>
              {org?.tampon_signature_url ? (
                <Image src={org.tampon_signature_url} style={{ width: 118, height: 59, objectFit: 'contain' }} />
              ) : null}
            </View>
          )
        })()}

        {/* Reste à régler — attendu par les financeurs. Quand un règlement a
            déjà été reçu, l'information figure déjà dans le bloc des totaux. */}
        {!(facture.montant_paye > 0) && Number(facture.montant_restant ?? facture.montant_ttc) > 0 && (
          <View style={{ marginTop: 0, marginBottom: 6, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9.5, fontFamily: 'Satoshi', fontWeight: 700, color: '#0F1720' }}>
              Reste à régler : {fmt(facture.montant_restant ?? facture.montant_ttc)} €
            </Text>
          </View>
        )}

        {/* Conditions */}
        {facture.conditions_paiement && (
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700 }}>Modalité de paiement : </Text>
            <Text style={{ fontSize: 8.5, color: '#37414D' }}>{facture.conditions_paiement}</Text>
          </View>
        )}

        {/* OPCO / Subrogation */}
        {facture.subrogation && facture.financeur_nom && !affacture && (
          <View style={{ ...shared.infoBox, marginTop: 8 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 2 }}>Subrogation de paiement</Text>
            <Text style={shared.infoBoxText}>
              Paiement attendu de {facture.financeur_nom} par subrogation de paiement.
            </Text>
          </View>
        )}

        {/* Facture cédée à un factor : le règlement lui est adressé, pas à
            l'organisme. Imprimer notre IBAN ici ferait payer le mauvais compte. */}
        {affacture ? (
          <View wrap={false} style={{ ...shared.infoBox, marginTop: 8 }}>
            <Text style={{ fontSize: 10.5, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 4, color: '#0F1720' }}>
              Cession de créance — règlement à {org?.affacturage_societe}
            </Text>
            <Text style={{ fontSize: 8.5, color: '#37414D', lineHeight: 1.45 }}>
              {org?.affacturage_mention
                || `Pour être libératoire, votre règlement doit être effectué directement à l'ordre de ${org?.affacturage_societe}${org?.affacturage_compte ? `, sur le compte : ${org.affacturage_compte}` : ''} qui le reçoit par subrogation dans le cadre d'un contrat d'affacturage. ${org?.affacturage_societe} devra être avisé de toute demande de renseignement ou réclamation.`}
            </Text>
            {org?.affacturage_iban && (
              <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: '#0F1720', marginTop: 4 }}>
                IBAN : {org.affacturage_iban}{org?.affacturage_bic ? `   Swift : ${org.affacturage_bic}` : ''}
              </Text>
            )}
          </View>
        ) : iban && !estAcquittee ? (
          <View wrap={false} style={{ ...shared.section, marginBottom: 10 }}>
            <PdfSectionTitle>Règlement par virement</PdfSectionTitle>
            <View style={shared.row}><Text style={shared.label}>Bénéficiaire</Text><Text style={shared.value}>{titulaire}</Text></View>
            {banque && <View style={shared.row}><Text style={shared.label}>Banque</Text><Text style={shared.value}>{banque}</Text></View>}
            <View style={shared.row}><Text style={shared.label}>IBAN</Text><Text style={shared.value}>{iban}</Text></View>
            {bic && <View style={shared.row}><Text style={shared.label}>BIC</Text><Text style={shared.value}>{bic}</Text></View>}
            <Text style={{ fontSize: 7, color: '#6B7885', marginTop: 4 }}>Merci d'indiquer le numéro de facture {facture.numero} en référence du virement.</Text>
          </View>
        ) : null}

        {/* Mentions légales (art. L441-9, L441-10, D441-5) */}
        <View wrap={false} style={{ ...shared.infoBox, marginTop: 6, paddingVertical: 6 }}>
          <Text style={{ fontSize: 6.5, color: '#6B7885', lineHeight: 1.35 }}>
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
