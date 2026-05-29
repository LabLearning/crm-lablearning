import { Document, Page, View, Text } from '@react-pdf/renderer'
import { shared, PdfDocHeader, PdfDocFooter, BRAND_GREEN, BRAND_LIGHT } from './components'
import type { Convention } from '@/lib/types/dossier'

function fmt(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TYPE_LABELS: Record<string, string> = {
  inter_entreprise: 'Inter-entreprise',
  intra_entreprise: 'Intra-entreprise',
  individuelle: 'Individuelle',
}

const FINANCEUR_LABELS: Record<string, string> = {
  opco: 'OPCO',
  cpf: 'CPF',
  pole_emploi: 'Pôle Emploi / France Travail',
  entreprise: 'Entreprise (autofinancement)',
  region: 'Région',
  autre: 'Autre organisme',
}

export function ConventionPDF({ convention, org }: { convention: Convention; org?: any }) {
  const clientName = convention.client?.raison_sociale || '—'
  const formationTitle = convention.formation?.intitule || convention.objet || '—'
  const isSignedComplete = convention.status === 'signee_complete'
  const ofName = org?.name || 'Lab Learning'
  const ofEmail = org?.email_contact || org?.email || 'digital@lab-learning.fr'
  const refHandicap = [org?.referent_handicap_nom, org?.referent_handicap_email, org?.referent_handicap_telephone].filter(Boolean).join(' · ')

  return (
    <Document title={`Convention ${convention.numero}`} author="Lab Learning">
      <Page size="A4" style={shared.page}>
        <PdfDocHeader
          docTitle="CONVENTION DE FORMATION"
          numero={convention.numero}
          date={`Émise le ${fmtDate(convention.date_emission)}`}
          statut={TYPE_LABELS[convention.type] || convention.type}
        />

        {/* Legal intro */}
        <View style={{ ...shared.infoBox, marginBottom: 18 }}>
          <Text style={{ ...shared.infoBoxText, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>
            Convention de formation professionnelle continue
          </Text>
          <Text style={shared.infoBoxText}>
            Établie conformément aux articles L.6353-1 et suivants du Code du travail.
            {org?.is_qualiopi !== false ? ` Organisme de formation certifié Qualiopi${org?.qualiopi_certificat_numero ? ` (certificat n° ${org.qualiopi_certificat_numero})` : ''}.` : ''}
          </Text>
        </View>

        {/* Parties */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={shared.sectionTitle}>Organisme de formation</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{org?.legal_name || ofName}</Text>
            {org?.address && <Text style={{ fontSize: 8, color: '#57534e', marginBottom: 2 }}>{org.address}{org.postal_code || org.city ? `, ${org.postal_code || ''} ${org.city || ''}` : ''}</Text>}
            {org?.siret && <View style={shared.row}><Text style={shared.label}>SIRET</Text><Text style={shared.value}>{org.siret}</Text></View>}
            <View style={shared.row}><Text style={shared.label}>N° déclaration</Text><Text style={shared.value}>{org?.numero_da || '—'}</Text></View>
            <View style={shared.row}><Text style={shared.label}>Email</Text><Text style={shared.value}>{ofEmail}</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={shared.sectionTitle}>Bénéficiaire / Employeur</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{clientName}</Text>
            {convention.nombre_stagiaires > 1 && (
              <View style={shared.row}>
                <Text style={shared.label}>Nb de stagiaires</Text>
                <Text style={shared.value}>{convention.nombre_stagiaires}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Formation details */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Désignation de la formation</Text>
          <View style={shared.row}>
            <Text style={shared.label}>Intitulé</Text>
            <Text style={{ ...shared.value, fontFamily: 'Helvetica-Bold' }}>{formationTitle}</Text>
          </View>
          {convention.duree_heures && (
            <View style={shared.row}>
              <Text style={shared.label}>Durée</Text>
              <Text style={shared.value}>{convention.duree_heures} heures</Text>
            </View>
          )}
          {convention.dates_formation && (
            <View style={shared.row}>
              <Text style={shared.label}>Dates</Text>
              <Text style={shared.value}>{convention.dates_formation}</Text>
            </View>
          )}
          {convention.lieu && (
            <View style={shared.row}>
              <Text style={shared.label}>Lieu</Text>
              <Text style={shared.value}>{convention.lieu}</Text>
            </View>
          )}
          <View style={shared.row}>
            <Text style={shared.label}>Stagiaires</Text>
            <Text style={shared.value}>{convention.nombre_stagiaires} personne(s)</Text>
          </View>
        </View>

        {/* Financials */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Conditions financières</Text>
          <View style={shared.row}>
            <Text style={shared.label}>Montant HT</Text>
            <Text style={shared.value}>{fmt(convention.montant_ht)} €</Text>
          </View>
          <View style={shared.row}>
            <Text style={shared.label}>TVA ({convention.taux_tva}%)</Text>
            <Text style={shared.value}>
              {fmt(Number(convention.montant_ttc) - Number(convention.montant_ht))} €
            </Text>
          </View>
          <View style={{ ...shared.row, marginTop: 4 }}>
            <Text style={{ ...shared.label, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN }}>
              Montant TTC
            </Text>
            <Text style={{ ...shared.value, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN }}>
              {fmt(convention.montant_ttc)} €
            </Text>
          </View>
          {convention.financeur_type && (
            <View style={{ ...shared.row, marginTop: 8 }}>
              <Text style={shared.label}>Financeur</Text>
              <Text style={shared.value}>
                {FINANCEUR_LABELS[convention.financeur_type] || convention.financeur_type}
                {convention.financeur_nom ? ` — ${convention.financeur_nom}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Modalités de suivi et d'évaluation (R6353-1) */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Modalités de déroulement, de suivi et d'évaluation</Text>
          <Text style={{ fontSize: 8, color: '#57534e', lineHeight: 1.6 }}>
            {(convention as any).modalites_evaluation
              || "L'exécution de l'action est suivie au moyen de feuilles d'émargement signées par les stagiaires et le formateur. Les acquis sont évalués en cours et en fin de formation (QCM, mise en situation). Une attestation de fin de formation et un certificat de réalisation sont remis à l'issue."}
          </Text>
        </View>

        {/* Accessibilité handicap (Qualiopi) */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Accessibilité — situation de handicap</Text>
          <Text style={{ fontSize: 8, color: '#57534e', lineHeight: 1.6 }}>
            Les formations sont accessibles aux personnes en situation de handicap. Pour étudier les adaptations nécessaires, contacter {refHandicap || ofEmail}.
          </Text>
        </View>

        {/* Regulatory clauses */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Clauses réglementaires</Text>
          <Text style={{ fontSize: 8, color: '#57534e', lineHeight: 1.6 }}>
            {`La présente convention est établie conformément aux dispositions de l'article L.6353-1 du Code du travail.

L'organisme de formation s'engage à réaliser les actions de formation selon les modalités définies ci-dessus, dans le respect du Référentiel National Qualité (Qualiopi).

Le bénéficiaire s'engage à régler le coût pédagogique selon les modalités convenues. En cas d'abandon en cours de stage, le coût des formations effectivement dispensées reste dû.

Les évaluations de satisfaction seront recueillies à l'issue de la formation conformément aux indicateurs Qualiopi.`}
          </Text>
        </View>

        {/* Signatures */}
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={shared.sectionTitle}>Signature du bénéficiaire</Text>
            <Text style={{ fontSize: 8, color: '#78716C', marginBottom: 8 }}>
              Lu et approuvé — Bon pour accord
            </Text>
            {convention.signature_client_nom ? (
              <View style={{ backgroundColor: BRAND_LIGHT, padding: 8, borderRadius: 4 }}>
                <Text style={{ fontSize: 8, color: BRAND_GREEN, fontFamily: 'Helvetica-Bold' }}>
                  Signé électroniquement
                </Text>
                <Text style={{ fontSize: 8, color: '#78716C' }}>{convention.signature_client_nom}</Text>
                <Text style={{ fontSize: 7, color: '#a8a29e' }}>Le {fmtDate(convention.signature_client_date)}</Text>
              </View>
            ) : (
              <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1' }} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={shared.sectionTitle}>Signature de l'organisme</Text>
            <Text style={{ fontSize: 8, color: '#78716C', marginBottom: 8 }}>
              {ofName} — Représentant légal
            </Text>
            {convention.signature_of_date ? (
              <View style={{ backgroundColor: BRAND_LIGHT, padding: 8, borderRadius: 4 }}>
                <Text style={{ fontSize: 8, color: BRAND_GREEN, fontFamily: 'Helvetica-Bold' }}>
                  Signé électroniquement
                </Text>
                <Text style={{ fontSize: 8, color: '#78716C' }}>{ofName}</Text>
                <Text style={{ fontSize: 7, color: '#a8a29e' }}>Le {fmtDate(convention.signature_of_date)}</Text>
              </View>
            ) : (
              <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1' }} />
            )}
          </View>
        </View>

        <PdfDocFooter numero={convention.numero} />
      </Page>
    </Document>
  )
}
