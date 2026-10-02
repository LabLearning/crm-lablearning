import * as React from 'react'
import { Document, Page, View, Text, Image as PdfImage } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'
import type { BilanFt } from '@/lib/poei-bilan-ft'

interface Section { key: string; titre: string; items: { id: string; label: string }[] }

interface Props {
  org: any
  poei: any
  apprenant: any
  formateurNom: string | null
  /** Contact signataire de l'établissement employeur, s'il est connu. */
  representantEmployeur?: string | null
  /** Numéro de convention France Travail — porté par le candidat. */
  conventionNumero?: string | null
  /**
   * Signatures électroniques déjà recueillies dans la POEI. L'employeur n'en
   * a pas en base : sa case reste à signer à la main.
   */
  signatures?: {
    beneficiaire?: { data?: string | null; nom?: string | null; date?: string | null } | null
    tuteur?: { data?: string | null; nom?: string | null; date?: string | null } | null
    employeur?: { data?: string | null; nom?: string | null; date?: string | null } | null
  } | null
  semaine: number | null
  sections: Section[]
  items: Record<string, { n?: string; o?: string }>
  appreciations: Record<string, string>
  appreciationsMeta: { key: string; label: string }[]
  pointsForts?: string | null
  aRenforcer?: string | null
  recommandations?: string | null
  avisFinal?: string | null
  motivationAvis?: string | null
  conclusion?: string | null
  dureeRealisee?: string | null
  absences?: string | null
  dateEvaluation?: string | null
  statut?: string | null
  /** Heures du certificat de réalisation : elles priment sur la durée saisie dans la grille */
  heuresCertifiees?: number | null
  heuresPrevues?: number | null
  /** Fin du suivi quand le parcours a été interrompu (date de l'abandon) */
  dateFinSuivi?: string | null
  /** Bilan de fin de formation France Travail, imprimé à la suite de l'attestation */
  bilanFt?: BilanFt | null
  /** Signature donnée par le stagiaire sur CE bilan (lien personnel), avec son horodatage réel */
  signatureBilan?: { data: string; nom: string; date: string } | null
}

// ── Bilan de fin de formation France Travail : le tableau du formulaire ──
const BORD = { borderBottomWidth: 0.5, borderBottomColor: SURFACE_400 } as const
const celluleLibelle = {
  width: '46%', paddingVertical: 2.5, paddingHorizontal: 6, backgroundColor: SURFACE_50,
  borderRightWidth: 0.5, borderRightColor: SURFACE_400, justifyContent: 'center',
} as const
const celluleValeur = { flex: 1, paddingVertical: 2.5, paddingHorizontal: 6, justifyContent: 'center', minHeight: 16 } as const

function LigneFt({ libelle, valeur, gras = false, haut = 16 }: { libelle: string; valeur?: string; gras?: boolean; haut?: number }) {
  return (
    <View style={{ flexDirection: 'row', ...BORD }} wrap={false}>
      <View style={celluleLibelle}>
        <Text style={{ fontSize: 8, color: SURFACE_900, ...(gras ? { fontFamily: 'Satoshi', fontWeight: 700 } : {}) }}>{libelle}</Text>
      </View>
      <View style={{ ...celluleValeur, minHeight: haut }}>
        {/* Un texte long (motif de sortie détaillé) passe en plus petit pour garder le tableau lisible */}
        <Text style={{ fontSize: (valeur || '').length > 400 ? 7 : 8, color: SURFACE_900, lineHeight: 1.4 }}>{(valeur || '').replace(/\r/g, '').replace(/\n{2,}/g, '\n')}</Text>
      </View>
    </View>
  )
}

function LigneDoubleFt({ libelle, prevue, reelle, entete = false }: { libelle: string; prevue?: string; reelle?: string; entete?: boolean }) {
  const valeur = { fontSize: 8, color: SURFACE_900, textAlign: 'center', ...(entete ? { fontFamily: 'Satoshi', fontWeight: 700 } : {}) } as const
  return (
    <View style={{ flexDirection: 'row', ...BORD }} wrap={false}>
      <View style={celluleLibelle}><Text style={{ fontSize: 8, color: SURFACE_900 }}>{libelle}</Text></View>
      <View style={{ ...celluleValeur, borderRightWidth: 0.5, borderRightColor: SURFACE_400 }}><Text style={valeur}>{prevue || ''}</Text></View>
      <View style={celluleValeur}><Text style={valeur}>{reelle || ''}</Text></View>
    </View>
  )
}

function RubriqueFt({ titre, droite }: { titre: string; droite?: string }) {
  return (
    <View style={{ flexDirection: 'row', ...BORD, backgroundColor: BRAND_ULTRA_LIGHT }} wrap={false}>
      <View style={{ ...celluleLibelle, backgroundColor: BRAND_ULTRA_LIGHT, paddingVertical: 4 }}>
        <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{titre}</Text>
      </View>
      <View style={{ ...celluleValeur, paddingVertical: 4 }}>
        <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, textAlign: 'center' }}>{droite || ''}</Text>
      </View>
    </View>
  )
}

/** Mêmes rubriques, dans le même ordre, que le formulaire France Travail. */
function TableauBilanFt({ b }: { b: BilanFt }) {
  return (
    <View style={{ borderWidth: 0.5, borderColor: SURFACE_400, borderBottomWidth: 0 }}>
      <LigneFt gras libelle="Nom de l'organisme de formation" valeur={b.organisme} />
      <LigneFt gras libelle="Référent de l'organisme de formation" valeur={b.referent} />
      <LigneFt gras libelle="Intitulé de l'action de formation" valeur={b.intitule} />
      <LigneFt gras libelle="Nom du demandeur d'emploi" valeur={b.nom} />
      <LigneFt gras libelle="Prénom du demandeur d'emploi" valeur={b.prenom} />
      <LigneFt gras libelle="N° identifiant Pôle emploi" valeur={b.identifiant} />
      <LigneDoubleFt entete libelle="" prevue="Prévue" reelle="Réelle" />
      <LigneDoubleFt libelle="Date de début de l'action de formation" prevue={b.debutPrevue} reelle={b.debutReelle} />
      <LigneDoubleFt libelle="Date de fin de l'action de formation" prevue={b.finPrevue} reelle={b.finReelle} />
      <LigneDoubleFt libelle="Nombre d'heures de formation" prevue={b.heuresPrevues} reelle={b.heuresReelles} />
      <LigneFt libelle="Métier visé par l'action de formation" valeur={b.metier} />
      <LigneFt libelle="Niveau de qualification atteint en fin de formation" valeur={b.niveau} />
      <LigneFt libelle="Formation certifiante" valeur={b.certifiante} />
      <RubriqueFt titre="Suivi du stagiaire pendant la formation" droite="Réponse" />
      <LigneFt libelle="A achevé la formation" valeur={b.acheve} />
      <LigneFt libelle="Si sortie anticipée : motif" valeur={b.motifSortie} />
      <LigneFt libelle="Date du dernier jour de formation" valeur={b.dernierJour} />
      <RubriqueFt titre="Suivi du stagiaire après la formation" droite="Réponse" />
      <LigneFt libelle="Reprise d'emploi en cours de formation" valeur={b.repriseCours} />
      <LigneFt libelle="Reprise d'emploi sur contrat durable (CDD de + 6 mois ou CDI)" valeur={b.repriseCoursDurable} />
      <LigneFt libelle="Date de la reprise d'activité" valeur={b.repriseCoursDate} />
      <LigneFt libelle="Reprise d'emploi dès la fin de formation" valeur={b.repriseFin} />
      <LigneFt libelle="Reprise d'emploi sur contrat durable (CDD de + 6 mois ou CDI)" valeur={b.repriseFinDurable} />
      <LigneFt libelle="Date de la reprise d'activité" valeur={b.repriseFinDate} />
      <LigneFt libelle="Reprise d'emploi à une date prévisionnelle" valeur={b.reprisePrevue} />
      <LigneFt gras libelle="Avis du stagiaire sur la formation" valeur={b.avisStagiaire} haut={32} />
      <LigneFt gras libelle="Avis du centre de formation" valeur={b.avisCentre} haut={32} />
    </View>
  )
}

const heuresTexte = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

const NIV: Record<string, { label: string; color: string }> = {
  A: { label: 'Acquis', color: '#177245' },
  EC: { label: 'En cours', color: '#b45309' },
  NA: { label: 'Non acquis', color: '#b4241f' },
}

const fmtCourt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

/** Case Oui / Non du formulaire France Travail : cochée ou vide. */
function OuiNon({ acquis }: { acquis: boolean | null }) {
  const Case = ({ plein }: { plein: boolean }) => (
    <View style={{
      width: 8, height: 8, borderRadius: 4, borderWidth: 0.8,
      borderColor: SURFACE_400, backgroundColor: plein ? SURFACE_900 : 'transparent',
    }} />
  )
  return (
    <View style={{ width: 66, flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Case plein={acquis === true} /><Text style={{ fontSize: 7.5, color: SURFACE_700 }}>Oui</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Case plein={acquis === false} /><Text style={{ fontSize: 7.5, color: SURFACE_700 }}>Non</Text>
      </View>
    </View>
  )
}

/** Ligne à compléter à la main quand la donnée n'est pas dans le CRM. */
const LigneVide = () => (
  <View style={{ flex: 1, borderBottomWidth: 0.5, borderBottomColor: SURFACE_400, height: 11, marginLeft: 4 }} />
)

/**
 * Grille d'évaluation POEI d'un candidat.
 *
 * Le suivi hebdomadaire reste un document interne. L'évaluation finale, elle,
 * suit le formulaire France Travail « Attestation de développement de
 * compétences » (novembre 2025) : mêmes mentions, mêmes trois signatures —
 * employeur, tuteur, bénéficiaire — et compétences en Oui/Non. C'est la pièce
 * remise à France Travail à la fin de la POEI, en trois exemplaires. Le détail
 * de l'évaluation du formateur suit en annexe : il nourrit l'attestation, il
 * ne la remplace pas.
 */
export function GrillePoeiPDF(p: Props) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const dateAff = p.dateEvaluation ? new Date(p.dateEvaluation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : today
  const isFinale = p.semaine == null
  const nomAppr = `${p.apprenant?.prenom || ''} ${String(p.apprenant?.nom || '').toUpperCase()}`.trim()
  const clientNom = p.poei?.client?.nom_commercial || p.poei?.client?.raison_sociale || ''
  const posteVise = p.poei?.poste_vise || p.poei?.formation?.intitule || ''
  // La convention est propre à chaque candidat ; les champs de la POEI ne
  // servent que de repli.
  const conventionNumero = p.conventionNumero || p.poei?.numero_engagement || p.poei?.numero_dossier_ft || null

  const tousItems = p.sections.flatMap((s) => s.items)
  const total = tousItems.length
  const evalues = tousItems.filter((i) => p.items?.[i.id]?.n)
  const acquis = evalues.filter((i) => p.items[i.id].n === 'A').length
  const encours = evalues.filter((i) => p.items[i.id].n === 'EC').length
  const nonAcquis = evalues.filter((i) => p.items[i.id].n === 'NA').length

  /** Le détail interne de la grille — page unique en hebdo, annexe en finale. */
  const DetailGrille = (
    <>
      {/* Bandeau de progression : lecture immédiate du niveau atteint */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }} wrap={false}>
        {([['Acquis', acquis, '#177245', '#e9f5ee'],
           ['En cours', encours, '#b45309', '#fdf1e3'],
           ['Non acquis', nonAcquis, '#b4241f', '#fbeceb'],
           ['Renseignées', `${evalues.length}/${total}`, '#37414D', '#EEF1F4']] as const).map(([l, v, c, bg]) => (
          <View key={l} style={{ flex: 1, backgroundColor: bg, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi', fontWeight: 700, color: c }}>{v}</Text>
            <Text style={{ fontSize: 6.5, color: c, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>{l}</Text>
          </View>
        ))}
      </View>

      {p.sections.map((sec) => (
        <View key={sec.key} style={shared.section} wrap={false}>
          <PdfSectionTitle>{sec.titre}</PdfSectionTitle>
          {sec.items.map((it, i) => {
            const v = p.items?.[it.id]
            const n = v?.n ? NIV[v.n] : null
            return (
              <View key={it.id} style={{ flexDirection: 'row', gap: 6, paddingVertical: 2.5, borderBottomWidth: 0.4, borderBottomColor: '#efedea' }}>
                <Text style={{ width: 14, fontSize: 7.5, color: SURFACE_500 }}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, color: SURFACE_900, lineHeight: 1.4 }}>{it.label}</Text>
                  {v?.o ? <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 1 }}>{v.o}</Text> : null}
                </View>
                <Text style={{ width: 58, fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: n ? n.color : '#9AA6B2', textAlign: 'right' }}>
                  {n ? n.label : '—'}
                </Text>
              </View>
            )
          })}
        </View>
      ))}

      {isFinale && (
        <>
          {p.appreciationsMeta.some((a) => p.appreciations?.[a.key]) && (
            <View style={shared.section} wrap={false}>
              <PdfSectionTitle>Appréciation globale</PdfSectionTitle>
              {p.appreciationsMeta.filter((a) => p.appreciations?.[a.key]).map((a) => (
                <View key={a.key} style={shared.row}>
                  <Text style={shared.label}>{a.label} :</Text>
                  <Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{p.appreciations[a.key]}</Text>
                </View>
              ))}
            </View>
          )}

          {(p.pointsForts || p.aRenforcer || p.recommandations) && (
            <View style={shared.section} wrap={false}>
              <PdfSectionTitle>Synthèse</PdfSectionTitle>
              {([['Points forts', p.pointsForts], ['À renforcer', p.aRenforcer], ['Recommandations', p.recommandations]] as const)
                .filter(([, v]) => v).map(([l, v]) => (
                  <View key={l} style={{ marginBottom: 6 }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{l}</Text>
                    <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5, marginTop: 2 }}>{v}</Text>
                  </View>
                ))}
            </View>
          )}

          {p.avisFinal && (
            <View style={shared.section} wrap={false}>
              <PdfSectionTitle>Avis final du formateur</PdfSectionTitle>
              <Text style={{ fontSize: 10, fontFamily: 'Satoshi', fontWeight: 700, color: p.avisFinal.includes('DÉFAVORABLE') ? '#b4241f' : p.avisFinal.includes('RÉSERVES') ? '#b45309' : '#177245' }}>
                {p.avisFinal}
              </Text>
              {p.motivationAvis ? <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5, marginTop: 4 }}>{p.motivationAvis}</Text> : null}
            </View>
          )}

          {p.conclusion && (
            <View style={shared.section} wrap={false}>
              <PdfSectionTitle>Conclusion</PdfSectionTitle>
              <Text style={{ fontSize: 8.5, color: SURFACE_900, lineHeight: 1.6 }}>{p.conclusion}</Text>
            </View>
          )}
        </>
      )}
    </>
  )

  // ── Suivi hebdomadaire : document interne, mise en page inchangée ──
  if (!isFinale) {
    return (
      <Document>
        <Page size="A4" style={shared.page}>
          <PdfDocHeader
            docTitle={`Bilan de la semaine ${p.semaine}`}
            numero={p.poei?.numero || ''} date={dateAff} org={p.org}
          />
          <View style={shared.section}>
            <PdfSectionTitle>Bénéficiaire</PdfSectionTitle>
            <View style={shared.row}><Text style={shared.label}>Nom et prénom :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{nomAppr}</Text></View>
            {clientNom ? <View style={shared.row}><Text style={shared.label}>Entreprise / site :</Text><Text style={shared.value}>{clientNom}</Text></View> : null}
            {posteVise ? <View style={shared.row}><Text style={shared.label}>Fonction visée :</Text><Text style={shared.value}>{posteVise}</Text></View> : null}
            {p.formateurNom ? <View style={shared.row}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{p.formateurNom}</Text></View> : null}
          </View>
          {DetailGrille}
          <PdfDocFooter numero={p.poei?.numero || ''} org={p.org} />
        </Page>
      </Document>
    )
  }

  // ── Bilan final : bilan de fin de formation France Travail, attestation de compétences, puis le détail en annexe ──
  // Mêmes heures que le certificat de réalisation (abandon : heures effectuées
  // sur la durée prévue) ; la saisie libre de la grille ne sert qu'à défaut.
  const dureeAffichee = p.heuresCertifiees != null && p.heuresCertifiees > 0
    ? `${heuresTexte(p.heuresCertifiees)} heures${p.heuresPrevues && p.heuresCertifiees < p.heuresPrevues ? ` (sur ${heuresTexte(p.heuresPrevues)} heures prévues)` : ''}`
    : p.dureeRealisee || (p.poei?.duree_heures ? `${p.poei.duree_heures} heures` : '')
  const acquisDe = (id: string): boolean | null => {
    const n = p.items?.[id]?.n
    if (!n) return null
    return n === 'A'
  }

  return (
    <Document>
      {/*
        Bilan de fin de formation France Travail, demandé sur Chorus Pro. Le
        cachet est celui de l'organisme. La case du stagiaire porte la signature
        qu'il a donnée sur ce bilan (lien personnel) ; tant qu'il ne l'a pas
        signé elle reste vierge : la signature de son certificat n'y est jamais
        reportée. Aucune date n'est imprimée sous les signatures (l'horodatage
        réel reste en base).
      */}
      {p.bilanFt ? (
        <Page size="A4" style={shared.page}>
          <PdfDocHeader
            docTitle="Bilan de fin de formation"
            numero={p.poei?.numero || ''} date={dateAff} org={p.org}
          />
          <TableauBilanFt b={p.bilanFt} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }} wrap={false}>
            <View style={{ width: 90 }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>Date</Text>
              <Text style={{ fontSize: 8.5, color: SURFACE_900, marginTop: 3 }}>{dateAff}</Text>
            </View>
            <View style={{ flex: 1, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 4, padding: 6, height: 74 }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>Signature et cachet du centre de formation</Text>
              {p.org?.tampon_signature_url ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <PdfImage src={p.org.tampon_signature_url} style={{ width: 110, height: 50, objectFit: 'contain', marginTop: 3 }} />
              ) : null}
            </View>
            <View style={{ flex: 1, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 4, padding: 6, height: 74 }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>Signature du stagiaire</Text>
              {p.signatureBilan?.data ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <PdfImage src={p.signatureBilan.data} style={{ width: 120, height: 42, objectFit: 'contain', marginTop: 3 }} />
                  <Text style={{ fontSize: 5.5, color: SURFACE_500, marginTop: 1 }}>
                    {p.signatureBilan.nom || ''}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <PdfDocFooter numero={p.poei?.numero || ''} org={p.org} />
        </Page>
      ) : null}

      <Page size="A4" style={shared.page}>
        <PdfDocHeader
          docTitle="Attestation de développement de compétences"
          numero={p.poei?.numero || ''} date={dateAff} org={p.org}
        />

        {/* Les références France Travail : c'est par elles que le dossier est retrouvé. */}
        <View style={shared.infoBox}>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {`Préparation opérationnelle à l'emploi individuelle (POEI) tutorée — Convention n° ${conventionNumero || 'non renseigné (à compléter sur la fiche POEI)'}${p.poei?.numero_dossier_ft && p.poei?.numero_dossier_ft !== conventionNumero ? ` — Dossier France Travail n° ${p.poei.numero_dossier_ft}` : ''}`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Sous la responsabilité de l'employeur</PdfSectionTitle>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5 }}>
            <Text style={{ fontSize: 9, color: SURFACE_900 }}>Je soussigné(e)&nbsp;:</Text>
            {p.representantEmployeur
              ? <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginLeft: 4 }}>{p.representantEmployeur}</Text>
              : <LigneVide />}
          </View>
          <Text style={{ fontSize: 9, color: SURFACE_900, marginBottom: 5 }}>
            {`représentant(e) de l'établissement ${clientNom || '—'},`}
          </Text>
          <Text style={{ fontSize: 9, color: SURFACE_900, marginBottom: 5 }}>
            {`atteste que ${nomAppr}`}
          </Text>
          <Text style={{ fontSize: 9, color: SURFACE_900, marginBottom: 5 }}>
            {`a suivi une POEI tutorée du ${fmtCourt(p.poei?.date_debut)} au ${fmtCourt(p.dateFinSuivi || p.poei?.date_fin)},`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5 }}>
            <Text style={{ fontSize: 9, color: SURFACE_900 }}>sous la responsabilité de&nbsp;:</Text>
            {p.formateurNom
              ? <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginLeft: 4 }}>{p.formateurNom}</Text>
              : <LigneVide />}
            <Text style={{ fontSize: 9, color: SURFACE_900, marginLeft: 8 }}>Fonction&nbsp;:</Text>
            {p.formateurNom
              ? <Text style={{ fontSize: 9, color: SURFACE_900, marginLeft: 4 }}>Formateur référent</Text>
              : <LigneVide />}
          </View>
          <Text style={{ fontSize: 9, color: SURFACE_900 }}>
            {'et a acquis les compétences ci-dessous pour le poste/métier de\u00A0:'}
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>{`\u00A0${posteVise || '—'}`}</Text>
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Compétences acquises durant la formation en tutorat</PdfSectionTitle>
          {tousItems.map((it, i) => (
            <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, borderBottomWidth: 0.4, borderBottomColor: '#efedea' }} wrap={false}>
              <Text style={{ width: 16, fontSize: 8, color: SURFACE_500 }}>{i + 1}</Text>
              <Text style={{ flex: 1, fontSize: 8.5, color: SURFACE_900, lineHeight: 1.4 }}>{it.label}</Text>
              <OuiNon acquis={acquisDe(it.id)} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
            <Text style={{ fontSize: 9, color: SURFACE_900 }}>Pour une durée de (nombre d'heures réalisées)&nbsp;:</Text>
            {dureeAffichee
              ? <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginLeft: 4 }}>{dureeAffichee}</Text>
              : <LigneVide />}
          </View>
          {p.absences ? (
            <Text style={{ fontSize: 8, color: SURFACE_700, marginTop: 3 }}>Absences / retards : {p.absences}</Text>
          ) : null}
        </View>

        <Text style={{ fontSize: 9, color: SURFACE_900, marginTop: 6 }}>
          Fait à : {p.org?.city || '___________'}, le {dateAff}.
        </Text>

        {/*
          Les signatures du formulaire, plus le cachet de l'organisme. Chaque
          tracé reporté vient d'une signature électronique réellement donnée
          dans la POEI — certificat du bénéficiaire, contrat du tuteur, lien de
          signature de l'employeur. Une case sans signature en base reste
          vierge, à signer à la main : rien n'est fabriqué.
        */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }} wrap={false}>
          {([
            { titre: "L'employeur, son représentant", sous: '(Date, signature, cachet)', sig: p.signatures?.employeur || null, tampon: null },
            { titre: 'Le tuteur', sous: '(Date, signature)', sig: p.signatures?.tuteur || null, tampon: null },
            { titre: 'Le bénéficiaire de la formation', sous: '(Date, signature)', sig: p.signatures?.beneficiaire || null, tampon: null },
            { titre: "L'organisme de formation", sous: '(Cachet et signature)', sig: null, tampon: p.org?.tampon_signature_url || null },
          ] as const).map((b) => (
            <View key={b.titre} style={{ flex: 1, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 4, padding: 6, height: 88 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{b.titre}</Text>
              <Text style={{ fontSize: 6, color: SURFACE_500, marginTop: 1 }}>{b.sous}</Text>
              {b.sig?.data ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <PdfImage src={b.sig.data} style={{ width: 100, height: 36, objectFit: 'contain', marginTop: 3 }} />
                  <Text style={{ fontSize: 5.5, color: SURFACE_500, marginTop: 1 }}>
                    {b.sig.nom || ''}
                  </Text>
                </>
              ) : null}
              {b.tampon ? (
                <PdfImage src={b.tampon} style={{ width: 105, height: 52, objectFit: 'contain', marginTop: 3 }} />
              ) : null}
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 8 }}>
          3 exemplaires : 1 pour le stagiaire, 1 pour le tuteur et 1 pour l'employeur.
        </Text>

        <PdfDocFooter numero={p.poei?.numero || ''} org={p.org} />
      </Page>

      {/* L'évaluation détaillée du formateur : elle nourrit l'attestation. */}
      <Page size="A4" style={shared.page}>
        <PdfDocHeader
          docTitle="Annexe : détail du bilan"
          numero={p.poei?.numero || ''} date={dateAff} org={p.org}
        />
        <View style={shared.section}>
          <PdfSectionTitle>Bénéficiaire</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Nom et prénom :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{nomAppr}</Text></View>
          {clientNom ? <View style={shared.row}><Text style={shared.label}>Entreprise / site :</Text><Text style={shared.value}>{clientNom}</Text></View> : null}
          {p.formateurNom ? <View style={shared.row}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{p.formateurNom}</Text></View> : null}
        </View>
        {DetailGrille}
        <PdfDocFooter numero={p.poei?.numero || ''} org={p.org} />
      </Page>
    </Document>
  )
}
