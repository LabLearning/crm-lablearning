import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import {
  PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared,
  BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'

export interface ApprenantHygiene {
  id?: string
  civilite?: string | null
  prenom?: string | null
  nom?: string | null
  date_naissance?: string | null
  entreprise?: string | null
}

const jour = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

const jourLong = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

/** « M. » ou « Mme » : la civilité est libre en base, on la ramène aux deux formes. */
function civilite(v?: string | null): string {
  const n = String(v || '').toLowerCase()
  if (n.startsWith('mme') || n.startsWith('mad') || n === 'f') return 'Mme'
  if (n.startsWith('m')) return 'M.'
  return ''
}

/**
 * Attestation de formation spécifique en matière d'hygiène alimentaire.
 *
 * Ce n'est pas l'attestation de fin de formation : c'est le document
 * réglementaire de l'arrêté du 12 février 2024, celui que l'établissement
 * présente lors d'un contrôle de la DDPP. Sa rédaction est contrainte — visa
 * de l'arrêté, identité et adresse du signataire, date de naissance du
 * stagiaire, durée et dates — et un document qui s'en écarte ne vaut rien
 * devant un contrôleur.
 *
 * La mise en page suit la charte des autres documents du CRM : le texte
 * réglementaire est intangible, sa présentation ne l'est pas.
 *
 * Un exemplaire par stagiaire, sur une page.
 */
export function AttestationHygienePDF({
  apprenants, session, formation, org, heuresParApprenant, periodeParApprenant,
}: {
  apprenants: ApprenantHygiene[]
  session: { reference?: string | null; date_debut: string; date_fin?: string | null }
  formation: { intitule?: string | null; duree_heures?: number | null }
  org: any
  /** Heures suivies par apprenant, indexées par leur identifiant. */
  heuresParApprenant?: Record<string, number>
  /**
   * Dates propres à un apprenant (AAAA-MM-JJ) : celles du module hygiène d'un
   * candidat POEI parti après le module, au lieu de celles du parcours.
   */
  periodeParApprenant?: Record<string, { debut: string; fin: string }>
}) {
  const signataire = [
    org?.representant_legal_civilite, org?.representant_legal_prenom, org?.representant_legal_nom,
  ].filter(Boolean).join(' ').trim() || 'le représentant légal'
  const fonction = String(org?.representant_legal_fonction || 'représentant légal').toLowerCase()
  const adresseOrg = [org?.address, [org?.postal_code, org?.city].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ')
  const dureePrevue = Number(formation?.duree_heures || 0)

  return (
    <Document>
      {apprenants.map((a, i) => {
        const periode = periodeParApprenant?.[a.id || '']
        const debut = jour(periode?.debut || session.date_debut)
        const finIso = periode?.fin || session.date_fin || session.date_debut
        const fin = jour(finIso)
        const heures = heuresParApprenant?.[a.id || ''] ?? dureePrevue
        const nom = `${(a.nom || '').toUpperCase()} ${a.prenom || ''}`.trim() || 'Le stagiaire'
        const identite = [civilite(a.civilite), nom].filter(Boolean).join(' ')
        // react-pdf supprime les nœuds de texte composés uniquement d'espaces :
        // une phrase découpée en expressions JSX perd ses espaces à la jonction.
        // On la compose donc entièrement en amont.
        const phrase = [
          `Je soussigné ${signataire}, ${fonction} de l'organisme de formation ${org?.name || 'Lab Learning'}`,
          adresseOrg ? ` domicilié au ${adresseOrg}` : '',
          `, atteste que ${identite}`,
          a.date_naissance ? `, né(e) le ${jour(a.date_naissance)},` : '',
          ` a suivi la formation spécifique en matière d'hygiène alimentaire adaptée à l'activité`,
          ` des établissements de restauration commerciale d'une durée de`,
          ` ${heures.toFixed(2).replace('.', ',')} heures, qui s'est déroulée du ${debut} au ${fin}.`,
        ].join('')
        const numero = `ATH-${new Date(session.date_debut).getFullYear()}-${(session.reference || '').replace(/[^\w-]/g, '') || String(i + 1).padStart(3, '0')}`

        return (
          <Page key={i} size="A4" style={shared.page}>
            <PdfDocHeader
              docTitle="Attestation d'hygiène alimentaire"
              numero={numero}
              date={jourLong(finIso)}
              org={org}
            />

            {/* Le visa de l'arrêté fait la valeur du document devant un contrôleur. */}
            <View style={shared.infoBox}>
              <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
                Formation spécifique en matière d&apos;hygiène alimentaire adaptée à l&apos;activité des
                établissements de restauration commerciale, délivrée conformément à l&apos;arrêté du
                12 février 2024 relatif au cahier des charges de cette formation.
              </Text>
            </View>

            <View style={shared.section}>
              <PdfSectionTitle>Organisme de formation</PdfSectionTitle>
              <View style={shared.row}><Text style={shared.label}>Raison sociale :</Text><Text style={shared.value}>{org?.legal_name || org?.name}</Text></View>
              {adresseOrg && <View style={shared.row}><Text style={shared.label}>Adresse :</Text><Text style={shared.value}>{adresseOrg}</Text></View>}
              <View style={shared.row}><Text style={shared.label}>N° déclaration :</Text><Text style={shared.value}>{org?.numero_da || ''}</Text></View>
              <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{org?.siret || ''}</Text></View>
            </View>

            <View style={shared.section}>
              <PdfSectionTitle>Stagiaire</PdfSectionTitle>
              <View style={shared.row}>
                <Text style={shared.label}>Nom :</Text>
                <Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{identite}</Text>
              </View>
              {/* Exigée par le cahier des charges : elle identifie le titulaire lors d'un contrôle. */}
              <View style={shared.row}>
                <Text style={shared.label}>Né(e) le :</Text>
                <Text style={shared.value}>{a.date_naissance ? jour(a.date_naissance) : '—'}</Text>
              </View>
              {a.entreprise && <View style={shared.row}><Text style={shared.label}>Entreprise :</Text><Text style={shared.value}>{a.entreprise}</Text></View>}
            </View>

            <View style={shared.section}>
              <PdfSectionTitle>Caractéristiques de la formation</PdfSectionTitle>
              <View style={shared.row}>
                <Text style={shared.label}>Intitulé :</Text>
                <Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>
                  {formation?.intitule || 'Hygiène alimentaire et prévention des risques'}
                </Text>
              </View>
              <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>Du {debut} au {fin}</Text></View>
              <View style={shared.row}>
                <Text style={shared.label}>Durée :</Text>
                <Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>
                  {heures.toFixed(2).replace('.', ',')} heures
                </Text>
              </View>
            </View>

            <View style={shared.section}>
              <PdfSectionTitle>Attestation</PdfSectionTitle>
              <Text style={{ fontSize: 9, color: SURFACE_900, lineHeight: 1.8 }}>{phrase}</Text>
            </View>

            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 8, color: SURFACE_500 }}>
                Fait à {org?.city || '___________'}, le {jourLong(finIso)},
                pour servir et valoir ce que de droit.
              </Text>

              <View style={{ flexDirection: 'row', gap: 24, marginTop: 12, alignItems: 'flex-start' }} wrap={false}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>
                    Pour {org?.name || 'Lab Learning'} — {signataire}
                  </Text>
                  <View style={{ height: 66, position: 'relative', borderBottomWidth: 0.5, borderBottomColor: '#CBD3DB' }}>
                    {org?.tampon_signature_url ? (
                      <Image src={org.tampon_signature_url} style={{ position: 'absolute', top: 0, left: 0, width: 160, height: 80, objectFit: 'contain' }} />
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature et cachet de l&apos;organisme</Text>
                </View>
              </View>
            </View>

            <PdfDocFooter numero={numero} org={org} />
          </Page>
        )
      })}
    </Document>
  )
}
