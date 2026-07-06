import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, shared, PdfDocHeader, PdfDocFooter, PdfSignatureCards, BRAND_GREEN, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

// ─── Helpers contenu ─────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined): string {
  if (n == null) return '—'
  // Remplace les espaces insécables (U+202F/U+00A0) du format fr-FR : glyphe absent
  // de la police → rendu "/" dans le PDF
  return Number(n)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u202F\u00A0]/g, " ")
}

// Nettoie le HTML éventuel (contenus importés de Dendreo : <p>, <ul>, <li>, <strong>…)
function cleanHtml(v: string): string {
  return v
    .replace(/\r\n?/g, '\n')  // fins de ligne Windows → \n (sinon doubles sauts de ligne)
    .replace(/<\s*(br|\/p|\/li|\/ul|\/ol|\/div|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtLongDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
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
  const mins = (fh * 60 + fm) - (dh * 60 + dm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

const TYPE_LABELS: Record<string, string> = {
  inter_entreprise: 'Inter-entreprise',
  intra_entreprise: 'Intra-entreprise',
  individuelle: 'Individuelle',
}

const MODALITE_LABELS: Record<string, string> = {
  presentiel: 'Présentiel',
  distanciel: 'Distanciel',
  mixte: 'Mixte (présentiel et distanciel)',
}

const FINANCEUR_LABELS: Record<string, string> = {
  opco: 'OPCO',
  cpf: 'CPF',
  pole_emploi: 'France Travail',
  france_travail: 'France Travail',
  entreprise: 'Entreprise (autofinancement)',
  region: 'Région',
  autre: 'Autre organisme',
}

// Entier 0..999 999 en toutes lettres (français)
function below100(n: number): string {
  const u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
  if (n < 20) return u[n]
  const d = Math.floor(n / 10), r = n % 10
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
  const c = Math.floor(n / 100), r = n % 100
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

function toList(v: any): string[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v.flatMap((x) => cleanHtml(String(x)).split(/\r?\n/)).map((x) => x.trim()).filter(Boolean)
  const parts = cleanHtml(String(v)).split(/\r?\n|•|;/).map((x) => x.trim()).filter(Boolean)
  return parts.length ? parts : null
}

function nomComplet(p: { civilite?: string | null; nom?: string | null; prenom?: string | null }): string {
  const civ = p.civilite ? `${p.civilite} ` : ''
  const nom = (p.nom || '').toUpperCase()
  const prenom = p.prenom || ''
  return `${civ}${nom}${prenom ? ` ${prenom}` : ''}`.trim()
}

// Liste à puces dans le style "value" du design d'origine
function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((it, i) => (
        // wrap={false} : la puce et son texte restent solidaires (pas de "•" orphelin
        // en bas de page, l'item passe entier à la page suivante)
        <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ fontSize: 8.5, color: BRAND_GREEN, width: 12 }}>•</Text>
          <Text style={{ fontSize: 8.5, color: SURFACE_700, flex: 1, lineHeight: 1.45 }}>{it}</Text>
        </View>
      ))}
    </>
  )
}

// Ligne montant : libellé à gauche, montant aligné à droite (bloc largeur fixe)
function MoneyRow({ label, amount, bold, top }: { label: string; amount: string; bold?: boolean; top?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, marginTop: top ? 4 : 0, paddingTop: top ? 4 : 0, borderTopWidth: top ? 0.5 : 0, borderTopColor: SURFACE_200 }}>
      <Text style={{ fontSize: bold ? 9 : 8.5, color: bold ? BRAND_GREEN : SURFACE_500, fontFamily: 'Satoshi', fontWeight: bold ? 700 : 400 }}>{label}</Text>
      <Text style={{ fontSize: bold ? 10.5 : 9, color: bold ? BRAND_GREEN : SURFACE_900, fontFamily: 'Satoshi', fontWeight: bold ? 700 : 500 }}>{amount}</Text>
    </View>
  )
}

// Ligne libellé / valeur alignée (libellé largeur fixe, valeur qui prend le reste)
function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
      <Text style={{ fontSize: 8.5, color: SURFACE_500, width: 130 }}>{label}</Text>
      <Text style={{ fontSize: 8.5, color: SURFACE_900, flex: 1, lineHeight: 1.45, fontFamily: 'Satoshi', fontWeight: bold ? 700 : 400 }}>{value}</Text>
    </View>
  )
}


// ─── Composant principal ─────────────────────────────────────────────────────

export function ConventionPDF({ convention, org }: { convention: any; org?: any }) {
  const client = convention.client || {}
  const formation = convention.formation || {}
  const session = convention.session || {}
  const participants: any[] = convention.participants || []

  const ofName = org?.name || 'Lab Learning'
  const ofEmail = org?.email_contact || org?.email || 'digital@lab-learning.fr'
  const repOf = [org?.representant_legal_civilite, org?.representant_legal_prenom, org?.representant_legal_nom].filter(Boolean).join(' ').trim()
  const repOfLine = [repOf, org?.representant_legal_fonction || 'Président'].filter(Boolean).join(', ')
  const ville = org?.city || 'Montpellier'
  const refHandicap = [org?.referent_handicap_nom, org?.referent_handicap_email, org?.referent_handicap_telephone].filter(Boolean).join(' · ')

  const clientName = client.raison_sociale || convention.client?.raison_sociale || '—'
  const clientCpVille = [client.code_postal, client.ville].filter(Boolean).join(' ')
  const clientRep = [client.civilite, client.prenom, (client.nom || '').toUpperCase()].filter(Boolean).join(' ').trim()

  const formationTitle = formation.intitule || convention.objet || '—'
  const modalite = MODALITE_LABELS[session.modalite || formation.modalite || 'presentiel'] || 'Présentiel'

  const lieuComplet = [session.lieu, session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ') || convention.lieu || '—'

  const jours: any[] = Array.isArray(session.horaires_jours) ? session.horaires_jours : []
  const nbJours = jours.length || formation.duree_jours || (convention.duree_heures ? Math.max(1, Math.round(convention.duree_heures / 7)) : 1)
  const dureeHeures = convention.duree_heures || formation.duree_heures || null
  const dateDebut = session.date_debut || null
  const dateFin = session.date_fin || null
  const datesSession = dateDebut
    ? (dateFin && dateFin !== dateDebut ? `du ${fmtLongDate(dateDebut)} au ${fmtLongDate(dateFin)}` : `le ${fmtLongDate(dateDebut)}`)
    : (convention.dates_formation || '—')

  const cout = Number(convention.montant_ttc ?? convention.montant_ht ?? 0)
  const hasTva = Number(convention.taux_tva) > 0

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
    ? cleanHtml(formation.methodes_pedagogiques)
    : "La formation est animée selon une approche active, participative et opérationnelle. Elle alterne des apports théoriques courts, des échanges avec les participants, des analyses de situations professionnelles, des études de cas, des exercices pratiques et des mises en situation."

  // Financement
  const dossier = convention.dossier || {}
  const financeurLabel = convention.financeur_type ? (FINANCEUR_LABELS[convention.financeur_type] || convention.financeur_type) : null
  const financeurLine = [financeurLabel, convention.financeur_nom].filter(Boolean).join(' — ')
  const numeroPEC = dossier.opco_numero_dossier || dossier.numero_prise_en_charge || dossier.numero || null

  // Délai d'accès (Qualiopi) — paramètre OF, avec valeur par défaut
  const delaiAcces = (org?.delai_acces && String(org.delai_acces).trim())
    ? String(org.delai_acces).trim()
    : "L'inscription doit être finalisée au plus tard 7 jours ouvrés avant le démarrage de la formation, sous réserve des places disponibles."

  // Détails formation
  const prerequis = (typeof formation.prerequis === 'string' && formation.prerequis.trim()) ? cleanHtml(formation.prerequis) : (toList(formation.prerequis)?.join(' ') || null)
  const publicVise = (typeof formation.public_vise === 'string' && formation.public_vise.trim()) ? cleanHtml(formation.public_vise) : (toList(formation.public_vise)?.join(' ') || null)
  const programme = toList(formation.programme_detaille)

  // Texte d'intro (construit en JS pour garantir les espaces)
  const qualiopiPhrase = org?.is_qualiopi !== false
    ? ` Organisme de formation certifié Qualiopi${org?.qualiopi_certificat_numero ? ` (certificat n° ${org.qualiopi_certificat_numero})` : ''}.`
    : ''
  const introText = `Établie entre l'organisme de formation et le bénéficiaire désignés ci-dessous.${qualiopiPhrase}`

  // « Fait à … le … » avant signatures — date de signature si signée, sinon date d'émission
  // (jamais la date de session : une convention émise avant la formation portait une date passée/future incohérente)
  const dateFait = convention.signature_of_date || convention.signature_client_date || convention.date_emission || convention.created_at || new Date().toISOString()

  return (
    <Document title={`Convention ${convention.numero || ''}`} author={ofName}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader
          docTitle="Convention de formation"
          numero={convention.numero}
          date={`Émise le ${fmtDate(convention.date_emission)}`}
          statut={TYPE_LABELS[convention.type] || convention.type}
          org={org}
        />

        {/* Intro légale */}
        <View style={{ ...shared.infoBox, marginBottom: 18 }}>
          <Text style={{ ...shared.infoBoxText, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>
            Convention de formation professionnelle (articles L. 6353-2 et R. 6353-1 du Code du travail)
          </Text>
          <Text style={shared.infoBoxText}>{introText}</Text>
        </View>

        {/* Parties */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <PdfSectionTitle>Organisme de formation</PdfSectionTitle>
            <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>{org?.legal_name || ofName}</Text>
            {org?.address && <Text style={{ fontSize: 8, color: SURFACE_700, marginBottom: 2 }}>{org.address}{org.postal_code || org.city ? `, ${org.postal_code || ''} ${org.city || ''}` : ''}</Text>}
            {org?.siret && <View style={shared.row}><Text style={shared.label}>SIRET</Text><Text style={shared.value}>{org.siret}</Text></View>}
            <View style={shared.row}><Text style={shared.label}>N° déclaration</Text><Text style={shared.value}>{org?.numero_da || '—'}</Text></View>
            {!!repOfLine && <View style={shared.row}><Text style={shared.label}>Représentant</Text><Text style={shared.value}>{repOfLine}</Text></View>}
            <View style={shared.row}><Text style={shared.label}>Email</Text><Text style={shared.value}>{ofEmail}</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <PdfSectionTitle>Bénéficiaire / Employeur</PdfSectionTitle>
            <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>{clientName}</Text>
            {client.adresse && <Text style={{ fontSize: 8, color: SURFACE_700, marginBottom: 2 }}>{client.adresse}{clientCpVille ? `, ${clientCpVille}` : ''}</Text>}
            {client.siret && <View style={shared.row}><Text style={shared.label}>SIRET</Text><Text style={shared.value}>{client.siret}</Text></View>}
            {!!clientRep && <View style={shared.row}><Text style={shared.label}>Représentant</Text><Text style={shared.value}>{clientRep}</Text></View>}
            <View style={shared.row}><Text style={shared.label}>Nb de stagiaires</Text><Text style={shared.value}>{participants.length || convention.nombre_stagiaires || '—'}</Text></View>
          </View>
        </View>

        {/* Objet et durée */}
        <View style={shared.section}>
          <PdfSectionTitle>Objet, nature et durée de la formation</PdfSectionTitle>
          <InfoRow label="Intitulé" value={formationTitle} bold />
          <InfoRow label="Nature" value="Action de formation (article L. 6313-1 CT)" />
          <InfoRow label="Date(s)" value={datesSession} />
          <InfoRow label="Durée totale" value={`${dureeHeures ? `${dureeHeures} heures` : '—'} sur ${nbJours} jour${nbJours > 1 ? 's' : ''}`} />
          <InfoRow label="Mode d'organisation" value={modalite} />
          <InfoRow label="Délai d'accès" value={delaiAcces} />
        </View>

        {/* Planning */}
        {jours.length > 0 && (
          <View style={shared.section}>
            <PdfSectionTitle>Dates et horaires</PdfSectionTitle>
            <View style={shared.table}>
              <View style={shared.tableHeader}>
                <Text style={{ ...shared.tableHeaderCell, width: '22%' }}>Jour</Text>
                <Text style={{ ...shared.tableHeaderCell, width: '22%' }}>Horaires</Text>
                <Text style={{ ...shared.tableHeaderCell, width: '12%' }}>Durée</Text>
                <Text style={{ ...shared.tableHeaderCell, width: '44%' }}>Lieu</Text>
              </View>
              {jours.flatMap((j: any, idx: number) => {
                const creneaux = [
                  { d: j.matin_debut, f: j.matin_fin },
                  { d: j.aprem_debut, f: j.aprem_fin },
                ].filter((c) => c.d && c.f)
                return creneaux.map((c, ci) => (
                  // wrap={false} : une ligne du tableau ne se coupe jamais au saut de page
                  <View key={`${idx}-${ci}`} wrap={false} style={{ ...shared.tableRow, ...((idx + ci) % 2 === 1 ? shared.tableRowAlt : {}) }}>
                    <Text style={{ ...shared.tableCell, width: '22%' }}>{ci === 0 ? fmtLongDate(j.date) : ''}</Text>
                    <Text style={{ ...shared.tableCell, width: '22%' }}>{fmtHeure(c.d)} - {fmtHeure(c.f)}</Text>
                    <Text style={{ ...shared.tableCell, width: '12%' }}>{dureeCreneau(c.d, c.f)}</Text>
                    <Text style={{ ...shared.tableCell, width: '44%' }}>{lieuComplet}</Text>
                  </View>
                ))
              })}
            </View>
          </View>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <View style={shared.section}>
            <PdfSectionTitle>Participants</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_700, marginBottom: 6 }}>
              Le bénéficiaire s'engage à assurer la présence des participants aux dates, lieux et heures prévus.
            </Text>
            <Bullets items={participants.map((p) => nomComplet(p))} />
          </View>
        )}

        {/* Conditions financières */}
        <View style={shared.section}>
          <PdfSectionTitle>Prix de la formation</PdfSectionTitle>
          <View style={{ width: 260 }}>
            <MoneyRow label={`Frais pédagogiques${hasTva ? ' (HT)' : ''}`} amount={`${fmt(convention.montant_ht)} €`} />
            <MoneyRow label="Frais refacturés" amount="0,00 €" />
            {hasTva && <MoneyRow label={`TVA (${convention.taux_tva} %)`} amount={`${fmt(Number(convention.montant_ttc) - Number(convention.montant_ht))} €`} />}
            <MoneyRow label={hasTva ? 'Total TTC' : 'Coût total'} amount={`${fmt(cout)} €`} bold top />
          </View>
          <Text style={{ fontSize: 8, color: SURFACE_500, marginTop: 6 }}>Soit {eurosEnLettres(cout)}.</Text>
          {!hasTva && (
            <Text style={{ fontSize: 7.5, color: SURFACE_500, marginTop: 3 }}>
              TVA non applicable — article 261-4-4°a du CGI (action de formation professionnelle continue).
            </Text>
          )}
        </View>

        {/* Financement */}
        {(financeurLine || numeroPEC) && (
          <View style={shared.section}>
            <PdfSectionTitle>Financement</PdfSectionTitle>
            {!!financeurLine && <InfoRow label="Financeur" value={financeurLine} />}
            {numeroPEC && <InfoRow label="N° de dossier" value={numeroPEC} />}
            {dossier.montant_prise_en_charge != null && (
              <View style={{ width: 260 }}><MoneyRow label="Prise en charge" amount={`${fmt(dossier.montant_prise_en_charge)} €`} /></View>
            )}
          </View>
        )}

        {/* Public visé et prérequis */}
        {(publicVise || prerequis) && (
          <View style={shared.section}>
            <PdfSectionTitle>Public visé et prérequis</PdfSectionTitle>
            {publicVise && <InfoRow label="Public visé" value={publicVise} />}
            {prerequis && <InfoRow label="Prérequis" value={prerequis} />}
          </View>
        )}

        {/* Objectifs */}
        {objectifs && objectifs.length > 0 && (
          <View style={shared.section}>
            <PdfSectionTitle>Objectifs pédagogiques</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_700, marginBottom: 6 }}>À l'issue de la formation, les participants seront capables de :</Text>
            <Bullets items={objectifs} />
          </View>
        )}

        {/* Programme détaillé */}
        {programme && programme.length > 0 && (
          <View style={shared.section}>
            <PdfSectionTitle>Programme de la formation</PdfSectionTitle>
            {programme.map((line, i) => {
              const isModule = /^module|^jour|^partie|^s[ée]quence/i.test(line)
              return (
                <Text key={i} style={{ fontSize: 8.5, color: isModule ? SURFACE_900 : SURFACE_700, fontFamily: isModule ? 'Satoshi' : 'Satoshi', fontWeight: isModule ? 700 : 400, marginBottom: 2, marginTop: isModule ? 4 : 0, lineHeight: 1.45 }}>
                  {isModule ? line : `•  ${line.replace(/^[-•]\s*/, '')}`}
                </Text>
              )
            })}
          </View>
        )}

        {/* Moyens */}
        <View style={shared.section}>
          <PdfSectionTitle>Moyens et supports pédagogiques</PdfSectionTitle>
          <Bullets items={moyens} />
        </View>

        {/* Évaluation */}
        <View style={shared.section}>
          <PdfSectionTitle>Modalités d'évaluation des acquis</PdfSectionTitle>
          <Bullets items={modalitesEval} />
        </View>

        {/* Suivi */}
        <View style={shared.section}>
          <PdfSectionTitle>Modalités pédagogiques et de suivi</PdfSectionTitle>
          <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.6 }}>{modalitesPeda}</Text>
        </View>

        {/* Accessibilité handicap */}
        <View style={shared.section}>
          <PdfSectionTitle>Accessibilité — situation de handicap</PdfSectionTitle>
          {/* Chaîne unique : les interpolations en plusieurs segments provoquent des chevauchements de lettres dans react-pdf */}
          <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.6 }}>
            {`Les formations sont accessibles aux personnes en situation de handicap. Pour étudier les adaptations nécessaires, contacter ${refHandicap || ofEmail}.`}
          </Text>
        </View>

        {/* Clauses réglementaires */}
        <View style={shared.section}>
          <PdfSectionTitle>Clauses réglementaires</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginBottom: 6 }}>
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>Non-réalisation — </Text>
            En application de l'article L. 6354-1 du Code du travail, faute de réalisation totale ou partielle de la prestation, l'organisme prestataire doit rembourser au cocontractant les sommes indûment perçues.
          </Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginBottom: 6 }}>
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>Dédommagement — </Text>
            En cas de renoncement par le bénéficiaire au moins 10 jours avant le démarrage, il s'engage au versement de 30 % du prix à titre de dédit ; à moins de 10 jours, 100 % du prix. Ces sommes ne sont pas imputables sur l'obligation de participation à la formation professionnelle continue et ne peuvent faire l'objet d'une prise en charge par l'OPCO. En cas de renoncement de l'organisme à moins de 10 jours, celui-ci s'engage au remboursement de la formation.
          </Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>Litiges — </Text>
            {`À défaut de règlement amiable (le cas échéant via un conciliateur désigné par les parties), le tribunal de ${ville} sera seul compétent.`}
          </Text>
        </View>

        {/* Signatures (cartes partagées) */}
        <PdfSignatureCards
          faitMention={`Fait à ${ville}, le ${fmtLongDate(dateFait)}, en deux exemplaires originaux.`}
          items={[
            {
              title: `Pour le bénéficiaire — ${clientName}`,
              name: clientRep || '—',
              mention: 'Lu et approuvé, bon pour accord',
              signed: !!convention.signature_client_nom,
              signedBy: convention.signature_client_nom,
              signedDate: convention.signature_client_date ? fmtDate(convention.signature_client_date) : null,
            },
            {
              title: `Pour l'organisme — ${ofName}`,
              name: repOfLine || `${ofName} — Représentant légal`,
              mention: 'Représentant légal',
              signed: !!convention.signature_of_date,
              signedBy: ofName,
              signedDate: convention.signature_of_date ? fmtDate(convention.signature_of_date) : null,
              stamp: org?.tampon_signature_url || null,
            },
          ]}
        />

        <PdfDocFooter numero={convention.numero} org={org} />
      </Page>
    </Document>
  )
}
