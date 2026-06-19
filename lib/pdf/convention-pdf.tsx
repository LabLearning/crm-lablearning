import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900, SURFACE_200 } from './components'

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtLongDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMoney(n: number | string | null | undefined): string {
  if (n == null) return '0,00'
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtHeure(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = String(t).split(':')
  return `${parseInt(h, 10)}h${(m ?? '00').padStart(2, '0')}`
}

function dureeCreneau(debut?: string | null, fin?: string | null): string {
  if (!debut || !fin) return ''
  const [dh, dm] = debut.split(':').map((x) => parseInt(x, 10))
  const [fh, fm] = fin.split(':').map((x) => parseInt(x, 10))
  let mins = (fh * 60 + fm) - (dh * 60 + dm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

const MODALITE_LABELS: Record<string, string> = {
  presentiel: 'Présentiel',
  distanciel: 'Distanciel',
  mixte: 'Mixte (présentiel et distanciel)',
}

// Nombre entier 0..999 en toutes lettres (français)
function below100(n: number): string {
  const u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
  if (n < 20) return u[n]
  const d = Math.floor(n / 10)
  const r = n % 10
  const tens: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 8: 'quatre-vingt' }
  if (d === 7 || d === 9) {
    const base = d === 7 ? 'soixante' : 'quatre-vingt'
    if (d === 7 && r === 1) return 'soixante et onze'
    return `${base}-${u[10 + r]}`
  }
  if (r === 0) return d === 8 ? 'quatre-vingts' : tens[d]
  if (r === 1 && d >= 2 && d <= 6) return `${tens[d]} et un`
  return `${tens[d]}-${u[r]}`
}

function below1000(n: number): string {
  if (n < 100) return below100(n)
  const c = Math.floor(n / 100)
  const r = n % 100
  const cent = c === 1 ? 'cent' : `${below100(c)} cent`
  if (r === 0) return c > 1 ? `${cent}s` : cent
  return `${cent} ${below100(r)}`
}

function entierEnLettres(n: number): string {
  if (n === 0) return 'zéro'
  const millions = Math.floor(n / 1000000)
  const milliers = Math.floor((n % 1000000) / 1000)
  const reste = n % 1000
  const parts: string[] = []
  if (millions) parts.push(millions === 1 ? 'un million' : `${below1000(millions)} millions`)
  if (milliers) parts.push(milliers === 1 ? 'mille' : `${below1000(milliers)} mille`)
  if (reste) parts.push(below1000(reste))
  return parts.join(' ')
}

function eurosEnLettres(amount: number | string | null | undefined): string {
  const val = Number(amount) || 0
  const euros = Math.floor(val)
  const cents = Math.round((val - euros) * 100)
  const e = `${entierEnLettres(euros)} euro${euros > 1 ? 's' : ''}`
  const c = cents > 0 ? `${entierEnLettres(cents)} centime${cents > 1 ? 's' : ''}` : 'zéro centime'
  return `${e} et ${c}`
}

// Normalise objectifs / moyens / modalités en liste de puces
function toList(v: any): string[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  const parts = String(v).split(/\r?\n|•|;/).map((x) => x.trim()).filter(Boolean)
  return parts.length ? parts : null
}

function nomComplet(p: { civilite?: string | null; nom?: string | null; prenom?: string | null }): string {
  const civ = p.civilite ? `${p.civilite} ` : ''
  const nom = (p.nom || '').toUpperCase()
  const prenom = p.prenom || ''
  return `${civ}${nom}${prenom ? ` ${prenom}` : ''}`.trim()
}

// ─── Styles propres à la convention (rendu document légal) ───────────────────

const s = {
  page: { fontFamily: 'Helvetica', fontSize: 9.5, color: SURFACE_900, paddingTop: 40, paddingBottom: 78, paddingHorizontal: 48, lineHeight: 1.4 } as const,
  logo: { height: 30, width: 120, objectFit: 'contain' as const, marginBottom: 18 },
  title: { fontSize: 19, fontFamily: 'Helvetica-Bold', textAlign: 'center' as const, color: SURFACE_900, marginBottom: 6, letterSpacing: 0.3 },
  subtitle: { fontSize: 9, fontStyle: 'italic' as const, textAlign: 'center' as const, color: SURFACE_700, marginBottom: 20 },
  para: { fontSize: 9.5, color: SURFACE_900, marginBottom: 5, lineHeight: 1.5 },
  partyLabel: { fontSize: 9.5, color: SURFACE_900, marginBottom: 8 },
  partyName: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: SURFACE_900 },
  addrLine: { fontSize: 9.5, color: SURFACE_700, marginLeft: 28 },
  inline: { fontSize: 9.5, color: SURFACE_700 },
  declaration: { fontSize: 9, color: SURFACE_700, textAlign: 'center' as const, marginTop: 12, marginBottom: 8, lineHeight: 1.5 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: SURFACE_900, marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: BRAND_GREEN },
  field: { flexDirection: 'row' as const, marginBottom: 4 },
  fieldBullet: { fontSize: 9.5, color: SURFACE_900, marginRight: 4 },
  fieldText: { fontSize: 9.5, color: SURFACE_900, flex: 1, lineHeight: 1.5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  listItem: { flexDirection: 'row' as const, marginBottom: 2.5, marginLeft: 16 },
  bulletDot: { fontSize: 9, color: SURFACE_700, width: 12 },
  listText: { fontSize: 9, color: SURFACE_700, flex: 1, lineHeight: 1.45 },
  legalText: { fontSize: 9, color: SURFACE_700, lineHeight: 1.5, marginBottom: 8, textAlign: 'justify' as const },
  // Tableau planning
  table: { borderWidth: 1, borderColor: SURFACE_200, marginTop: 6, marginBottom: 6 },
  thead: { flexDirection: 'row' as const, backgroundColor: '#f5f5f4', borderBottomWidth: 1, borderBottomColor: SURFACE_200 },
  th: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: SURFACE_700, paddingVertical: 6, paddingHorizontal: 6, textAlign: 'center' as const },
  dayRow: { flexDirection: 'row' as const, backgroundColor: '#fafaf9', borderBottomWidth: 0.5, borderBottomColor: SURFACE_200 },
  dayCell: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN, paddingVertical: 5, paddingHorizontal: 6 },
  tr: { flexDirection: 'row' as const, borderBottomWidth: 0.5, borderBottomColor: SURFACE_200 },
  td: { fontSize: 8.5, color: SURFACE_700, paddingVertical: 5, paddingHorizontal: 6, lineHeight: 1.4 },
  colJour: { width: '20%' },
  colIntitule: { width: '42%' },
  colLieu: { width: '38%' },
  signRow: { flexDirection: 'row' as const, marginTop: 24, gap: 24 },
  signCol: { flex: 1 },
  signTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: SURFACE_900, marginBottom: 2 },
  signName: { fontSize: 9.5, color: SURFACE_700 },
  signImg: { height: 50, width: 130, objectFit: 'contain' as const, marginTop: 6 },
  signElec: { fontSize: 8, color: BRAND_GREEN, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  signMeta: { fontSize: 7.5, color: SURFACE_500 },
  footer: { position: 'absolute' as const, bottom: 22, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: SURFACE_200, paddingTop: 6 },
  footerText: { fontSize: 6.8, color: SURFACE_500, textAlign: 'center' as const, lineHeight: 1.4 },
  footerPage: { fontSize: 6.8, color: SURFACE_500, textAlign: 'center' as const, marginTop: 2 },
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((it, i) => (
        <View key={i} style={s.listItem}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.listText}>{it}</Text>
        </View>
      ))}
    </>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function ConventionPDF({ convention, org }: { convention: any; org?: any }) {
  const client = convention.client || {}
  const formation = convention.formation || {}
  const session = convention.session || {}
  const participants: any[] = convention.participants || []

  const ofName = org?.name || 'Lab Learning'
  const ofLegal = org?.legal_name || ofName
  const repOf = [org?.representant_legal_civilite, org?.representant_legal_prenom, org?.representant_legal_nom]
    .filter(Boolean).join(' ').trim()
  const repOfFonction = org?.representant_legal_fonction || 'Président'
  const repOfLine = [repOf, repOfFonction].filter(Boolean).join(', ')

  const ville = org?.city || 'Montpellier'

  // Bénéficiaire
  const clientName = client.raison_sociale || client.sigle || '—'
  const clientAddr = client.adresse || ''
  const clientCpVille = [client.code_postal, client.ville].filter(Boolean).join(' ')
  const clientRep = [client.civilite, client.prenom, (client.nom || '').toUpperCase()].filter(Boolean).join(' ').trim()

  // Formation
  const formationTitle = formation.intitule || convention.objet || '—'
  const modalite = MODALITE_LABELS[session.modalite || formation.modalite || 'presentiel'] || 'Présentiel'

  // Lieu complet
  const lieuComplet = [session.lieu, session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ') || convention.lieu || '—'

  // Dates & durée
  const jours: any[] = Array.isArray(session.horaires_jours) ? session.horaires_jours : []
  const nbJours = jours.length || formation.duree_jours || (convention.duree_heures ? Math.max(1, Math.round(convention.duree_heures / 7)) : 1)
  const dureeHeures = convention.duree_heures || formation.duree_heures || null
  const dateDebut = session.date_debut || null
  const dateFin = session.date_fin || null
  const datesSession = dateDebut
    ? (dateFin && dateFin !== dateDebut ? `du ${fmtLongDate(dateDebut)} au ${fmtLongDate(dateFin)}` : `le ${fmtLongDate(dateDebut)}`)
    : (convention.dates_formation || '—')

  // Prix
  const cout = Number(convention.montant_ttc ?? convention.montant_ht ?? 0)

  // Contenus pédagogiques (avec valeurs par défaut si non renseignés)
  const objectifs = toList(formation.objectifs_pedagogiques)
  const moyens = toList(formation.moyens_techniques) || [
    'Support de formation projeté.',
    'Livret participant.',
    'Exercices pratiques et études de cas.',
    "QCM d'évaluation.",
    'Attestation de fin de formation.',
  ]
  const modalitesEval = toList(formation.modalites_evaluation) || [
    'Évaluation des acquis en cours et en fin de formation.',
    'Questionnement oral pendant les séquences.',
    'Exercices pratiques et analyse de situations professionnelles.',
    'QCM final de validation des connaissances.',
  ]
  const modalitesPeda = (typeof formation.methodes_pedagogiques === 'string' && formation.methodes_pedagogiques.trim())
    ? formation.methodes_pedagogiques.trim()
    : "La formation est animée selon une approche active, participative et opérationnelle. Elle alterne des apports théoriques courts, des échanges avec les participants, des analyses de situations professionnelles, des études de cas, des exercices pratiques et des mises en situation."

  // Date de signature / d'établissement
  const dateFait = convention.signature_of_date || convention.signature_client_date || dateFin || convention.date_emission

  // Footer (répété sur chaque page)
  const footerL1 = [
    ofName,
    [org?.address, [org?.postal_code, org?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    org?.phone || org?.telephone_contact,
    org?.email_contact || org?.email,
    org?.website,
  ].filter(Boolean).join(' – ')
  const footerL2 = [
    org?.siret ? `SIRET : ${org.siret}` : null,
    org?.rcs ? `RCS ${org.rcs}` : null,
    org?.code_ape ? `Code APE ${org.code_ape}` : null,
  ].filter(Boolean).join(' – ')
  const footerL3 = org?.numero_da ? `Déclaration d'activité enregistrée sous le numéro ${org.numero_da} auprès du préfet de région` : ''

  return (
    <Document title={`Convention ${convention.numero || ''}`} author={ofName}>
      <Page size="A4" style={s.page}>
        {/* En-tête : logo OF */}
        {org?.logo_url
          ? <Image src={org.logo_url} style={s.logo} />
          : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN, marginBottom: 18 }}>{ofName}</Text>}

        <Text style={s.title}>CONVENTION DE FORMATION PROFESSIONNELLE</Text>
        <Text style={s.subtitle}>(Article L. 6353-2 et R. 6353-1 du code du travail)</Text>

        {/* Parties */}
        <Text style={s.partyLabel}>Entre</Text>
        <View style={{ marginLeft: 28, marginBottom: 10 }}>
          <Text style={s.partyName}>{clientName}</Text>
          <Text style={s.inline}>(ci-après dénommé le bénéficiaire)</Text>
          {clientAddr ? <Text style={s.inline}>Situé {clientAddr}</Text> : null}
          {clientCpVille ? <Text style={s.inline}>{clientCpVille}</Text> : null}
          {client.pays ? <Text style={s.inline}>{client.pays}</Text> : null}
          {client.siret ? <Text style={s.inline}>Siret : {client.siret}</Text> : null}
          {clientRep ? <Text style={s.inline}>Représenté par : {clientRep}</Text> : null}
        </View>

        <Text style={s.partyLabel}>Et</Text>
        <View style={{ marginLeft: 28, marginBottom: 12 }}>
          <Text style={s.partyName}>{ofLegal}</Text>
          {org?.address ? <Text style={s.inline}>Situé {org.address}</Text> : null}
          {[org?.postal_code, org?.city].filter(Boolean).length ? <Text style={s.inline}>{[org?.postal_code, org?.city].filter(Boolean).join(' ')}</Text> : null}
          {repOfLine ? <Text style={s.inline}>Représenté par : {repOfLine}</Text> : null}
        </View>

        <View style={{ marginBottom: 6 }}>
          {org?.numero_da ? <Text style={s.declaration}>Déclaration enregistrée sous le n° {org.numero_da} auprès du Préfet de région</Text> : null}
          {org?.siret ? <Text style={s.declaration}>Numéro SIRET de l'organisme de formation : {org.siret}</Text> : null}
        </View>

        {/* I — OBJET */}
        <Text style={s.sectionTitle}>I – OBJET, NATURE, DUREE DE LA FORMATION</Text>
        <View style={s.field}><Text style={s.fieldText}>Intitulé de l'action de formation : <Text style={s.bold}>{formationTitle}</Text></Text></View>
        <View style={s.field}><Text style={s.fieldText}>Nature de l'action de formation conformément à l'article L 6313-1 CT : <Text style={s.bold}>Action de Formation</Text></Text></View>
        <Text style={{ ...s.para, marginTop: 4 }}>Le programme détaillé de l'action de formation est explicité ci-dessous ou figure en annexe de la présente convention.</Text>
        <View style={s.field}><Text style={s.fieldBullet}>-</Text><Text style={s.fieldText}><Text style={s.bold}>Date(s) de la session :</Text> {datesSession}</Text></View>
        <View style={s.field}><Text style={s.fieldBullet}>-</Text><Text style={s.fieldText}><Text style={s.bold}>Durée totale de la formation :</Text> {dureeHeures ? `${dureeHeures} heures` : '—'} sur {nbJours} jour{nbJours > 1 ? 's' : ''}</Text></View>
        <View style={s.field}><Text style={s.fieldBullet}>-</Text><Text style={s.fieldText}><Text style={s.bold}>Mode d'organisation :</Text> {modalite}</Text></View>
        <View style={s.field}><Text style={s.fieldBullet}>-</Text><Text style={s.fieldText}><Text style={s.bold}>Dates et heures :</Text></Text></View>

        {/* Tableau planning */}
        {jours.length > 0 && (
          <View style={s.table}>
            <View style={s.thead}>
              <Text style={{ ...s.th, ...s.colJour }}>Jour</Text>
              <Text style={{ ...s.th, ...s.colIntitule }}>Intitulé</Text>
              <Text style={{ ...s.th, ...s.colLieu }}>Lieu</Text>
            </View>
            {jours.map((j: any, idx: number) => {
              const creneaux = [
                { d: j.matin_debut, f: j.matin_fin },
                { d: j.aprem_debut, f: j.aprem_fin },
              ].filter((c) => c.d && c.f)
              return (
                <View key={idx} wrap={false}>
                  <View style={s.dayRow}><Text style={{ ...s.dayCell, width: '100%' }}>{fmtLongDate(j.date)}</Text></View>
                  {creneaux.map((c, ci) => (
                    <View key={ci} style={s.tr}>
                      <Text style={{ ...s.td, ...s.colJour }}>{fmtHeure(c.d)} - {fmtHeure(c.f)}{dureeCreneau(c.d, c.f) ? `\n(${dureeCreneau(c.d, c.f)})` : ''}</Text>
                      <Text style={{ ...s.td, ...s.colIntitule }}>{formationTitle}</Text>
                      <Text style={{ ...s.td, ...s.colLieu }}>{lieuComplet}</Text>
                    </View>
                  ))}
                </View>
              )
            })}
          </View>
        )}

        {/* II — ENGAGEMENT */}
        <Text style={s.sectionTitle}>II – ENGAGEMENT DE PARTICIPATION A L'ACTION</Text>
        <Text style={s.para}>Le bénéficiaire s'engage à assurer la présence des participants aux dates, lieux et heures prévus ci-dessus.</Text>
        {participants.length > 0 && (
          <>
            <Text style={{ ...s.para, marginTop: 2 }}>Les Participants seront :</Text>
            <Bullets items={participants.map((p) => nomComplet(p))} />
          </>
        )}

        {/* III — PRIX */}
        <Text style={s.sectionTitle}>III – PRIX DE LA FORMATION</Text>
        <Text style={s.para}>Le coût de la formation, objet de la présente convention, s'élève à <Text style={s.bold}>{fmtMoney(cout)}</Text> ({eurosEnLettres(cout)})</Text>
        <Text style={{ ...s.para, marginTop: 6 }}>Frais Pédagogiques :</Text>
        <Text style={s.para}>Total {fmtMoney(cout)} €</Text>
        <Text style={{ ...s.para, marginTop: 6 }}>Frais refacturés</Text>
        <Text style={s.para}>Total 0,00 €</Text>

        {/* IV — OBJECTIFS, MOYENS */}
        <Text style={s.sectionTitle}>IV – OBJECTIFS, MOYENS PEDAGOGIQUES ET TECHNIQUES MIS EN ŒUVRE :</Text>
        <View style={s.field}><Text style={s.fieldBullet}>-</Text><Text style={s.fieldText}>Intitulé : <Text style={{ fontStyle: 'italic' }}>{formationTitle}</Text></Text></View>
        {objectifs && objectifs.length > 0 && (
          <>
            <Text style={{ ...s.para, marginLeft: 16, marginTop: 4 }}>Objectif(s) : À l'issue de la formation, les participants seront capables de :</Text>
            <Bullets items={objectifs} />
          </>
        )}
        <Text style={{ ...s.para, marginLeft: 16, marginTop: 6 }}>Moyens et supports pédagogiques : Les moyens et supports pédagogiques mis à disposition peuvent comprendre :</Text>
        <Bullets items={moyens} />

        {/* V — SANCTIONS */}
        <Text style={s.sectionTitle}>V – SANCTIONS ET MOYENS PERMETTANT D'APPRECIER LES RESULTATS DE L'ACTION :</Text>
        <View style={s.field}><Text style={s.fieldBullet}>-</Text><Text style={s.fieldText}>Intitulé : <Text style={{ fontStyle: 'italic' }}>{formationTitle}</Text></Text></View>
        <Text style={{ ...s.para, marginLeft: 16, marginTop: 4 }}>Modalités d'évaluation : L'évaluation des acquis est réalisée tout au long de la formation et en fin de parcours. Elle comprend :</Text>
        <Bullets items={modalitesEval} />

        {/* VI — MOYENS DE SUIVI */}
        <Text style={s.sectionTitle}>VI – MOYENS PERMETTANT DE SUIVRE L'EXECUTION DE L'ACTION :</Text>
        <View style={s.field}><Text style={s.fieldBullet}>-</Text><Text style={s.fieldText}>Intitulé : <Text style={{ fontStyle: 'italic' }}>{formationTitle}</Text></Text></View>
        <Text style={{ ...s.para, marginLeft: 16, marginTop: 4 }}>Modalités pédagogiques : {modalitesPeda}</Text>

        {/* VII — NON-REALISATION */}
        <Text style={s.sectionTitle}>VII – NON-REALISATION DE LA PRESTATION DE FORMATION :</Text>
        <Text style={s.legalText}>En application de l'article L.6354-1 du Code du travail, il est convenu entre les signataires de la présente convention, que faute de réalisation totale ou partielle de la prestation de formation, l'organisme prestataire doit rembourser au cocontractant les sommes indûment perçues de ce fait.</Text>

        {/* VIII — DEDOMMAGEMENT */}
        <Text style={s.sectionTitle}>VIII – DEDOMMAGEMENT, REPARATION OU DEDIT :</Text>
        <Text style={s.legalText}>En cas de renoncement par l'entreprise bénéficiaire à l'exécution de la présente convention dans un délai au moins 10 jours avant la date de démarrage de la prestation de formation, objet de la présente convention, l'entreprise bénéficiaire s'engage au versement de la somme de 30% du prix de la formation à titre de dédommagement, réparation ou dédit. Cette somme n'est pas imputable sur l'obligation de participation au titre de la formation professionnelle continue de l'entreprise bénéficiaire et ne peut faire l'objet d'une demande de remboursement ou de prise en charge par l'OPCO.</Text>
        <Text style={s.legalText}>En cas de renoncement par l'entreprise bénéficiaire à l'exécution de la présente convention dans un délai de moins de 10 jours avant la date de démarrage de la prestation de formation, objet de la présente convention, l'entreprise bénéficiaire s'engage au versement de la somme de 100% du prix de la formation à titre de dédommagement, réparation ou dédit. Cette somme n'est pas imputable sur l'obligation de participation au titre de la formation professionnelle continue de l'entreprise bénéficiaire et ne peut faire l'objet d'une demande de remboursement ou de prise en charge par l'OPCO.</Text>
        <Text style={s.legalText}>En cas de renoncement par l'organisme de formation à l'exécution de la présente convention dans un délai de moins de 10 jours avant la date de démarrage de la prestation de formation, objet de la présente convention, l'organisme de formation s'engage au remboursement de la formation.</Text>

        {/* IX — LITIGES */}
        <Text style={s.sectionTitle}>IX – LITIGES :</Text>
        <Text style={s.legalText}>En cas de différends éventuels entre les deux parties sur l'exécution du présent contrat, une procédure de règlement à l'amiable sera mise en œuvre par le biais notamment d'un conciliateur désigné par les parties. Si une contestation ou un différend ne peut être réglé à l'amiable, le tribunal de {ville} sera seul compétent pour régler le litige.</Text>

        <Text style={{ ...s.para, fontStyle: 'italic', marginTop: 14 }}>Fait à {ville.toUpperCase()}, le {fmtLongDate(dateFait)},</Text>

        {/* Signatures */}
        <View style={s.signRow}>
          <View style={s.signCol}>
            <Text style={s.signTitle}>Pour {ofName},</Text>
            <Text style={s.signName}>{repOfLine || '—'}</Text>
            {org?.tampon_signature_url ? <Image src={org.tampon_signature_url} style={s.signImg} /> : null}
            {convention.signature_of_date ? (
              <>
                <Text style={s.signElec}>Signé électroniquement</Text>
                <Text style={s.signMeta}>Le {fmtLongDate(convention.signature_of_date)}</Text>
              </>
            ) : null}
          </View>
          <View style={s.signCol}>
            <Text style={s.signTitle}>Pour {clientName},</Text>
            <Text style={s.signName}>{clientRep || '—'}</Text>
            {convention.signature_client_nom ? (
              <>
                <Text style={s.signElec}>Signé électroniquement</Text>
                <Text style={s.signName}>{convention.signature_client_nom}</Text>
                <Text style={s.signMeta}>Le {fmtLongDate(convention.signature_client_date)}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Footer répété */}
        <View style={s.footer} fixed>
          {footerL1 ? <Text style={s.footerText}>{footerL1}</Text> : null}
          {footerL2 ? <Text style={s.footerText}>{footerL2}</Text> : null}
          {footerL3 ? <Text style={s.footerText}>{footerL3}</Text> : null}
          <Text style={s.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
