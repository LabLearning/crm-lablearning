import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import {
  PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared,
  BRAND_GREEN, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'
import { STATUTS_INCIDENT, libelleGraviteIncident, libelleTypeIncident } from '@/lib/rapport-france-travail'

/**
 * Rapports transmis à France Travail pour un dossier POEI : rapport d'incident
 * (un par incident) et rapport d'abandon (un par candidat sorti avant la fin).
 *
 * Un rapport ne dit que ce qui est consigné au dossier : une rubrique sans
 * donnée ne s'imprime pas, rien n'est complété par une formule toute faite.
 * Le texte des faits et celui du motif sont repris tels qu'ils ont été saisis
 * et relus à l'écran avant le téléchargement (lib/rapport-france-travail).
 */

export interface DossierRapport {
  numero: string | null
  numeroDossierFt: string | null
  formation: string | null
  dateDebut: string | null
  dateFin: string | null
  dureeHeures: number | null
  employeur: { nom: string | null; adresse: string | null; code_postal: string | null; ville: string | null; siret: string | null } | null
}

export interface PersonneRapport {
  civilite: string | null
  prenom: string | null
  nom: string | null
  identifiantFt: string | null
  numeroEngagement: string | null
  numeroConvention: string | null
  posteVise: string | null
}

export interface IncidentRapport {
  date: string | null
  type: string | null
  gravite: string | null
  titre: string | null
  description: string | null
  mesures: string | null
  statut: string | null
  resoluLe: string | null
  declareLe: string | null
  /** « Prénom Nom, formateur », ou « L'équipe de Lab Learning » quand l'incident a été saisi au bureau */
  declarant: string | null
}

export interface AbandonRapport {
  dateEntree: string | null
  dateFinPrevue: string | null
  dateAbandon: string | null
  heuresPrevues: number | null
  heuresEffectuees: number | null
  motif: string | null
}

interface Commun {
  org: any
  /** Agence France Travail du dossier ; absente, le rapport sort sans destinataire nommé */
  agence: any | null
  dossier: DossierRapport
  reference: string
}

const TEXTE = { fontSize: 9.5, color: SURFACE_700, lineHeight: 1.6 } as const
const GRIS = '#4E5A67'

/**
 * Une date en toutes lettres. Un horodatage (déclaration, clôture, jour du
 * tirage) se lit à l'heure de Paris : le serveur tourne en temps universel et
 * daterait de la veille ce qui s'est passé entre minuit et deux heures. Une
 * date seule (jour de l'incident, de l'abandon) n'a pas d'heure : elle se lit
 * telle quelle.
 */
function frDate(d?: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return String(d)
  const fuseau = /T\d/.test(d) ? 'Europe/Paris' : 'UTC'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: fuseau })
    .replace(/\s/g, ' ').replace(/^1 /, '1er ')
}

// Les espaces fines de la mise en forme française sortent en « / » dans le PDF
const nombre = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\s/g, ' ')

// Le pluriel commence à deux : « 1,5 heure », « 2 heures »
const heures = (n: number) => `${nombre(n)} heure${n >= 2 ? 's' : ''}`

const nomComplet = (p: PersonneRapport | null | undefined) =>
  p ? [p.civilite, p.prenom, (p.nom || '').toUpperCase()].filter(Boolean).join(' ') : ''

// « d’Aïcha », « d’Hélène », mais « de Mme Zoé »
const de = (nom: string) => (/^[aeiouyàâäéèêëîïôöùûüœæh]/i.test(nom) ? `d’${nom}` : `de ${nom}`)

// Un mot sans espace plus long que la ligne (adresse de page collée) se replie au lieu de sortir de la page
const couperMotsLongs = (mot: string) => (mot.length > 40 ? mot.match(/.{1,20}/g) || [mot] : [mot])

/**
 * Une rubrique du rapport. L'espace est au-dessus, pas en dessous : le moteur
 * de mise en page renvoie à la page suivante un bloc dont la marge du bas ne
 * tient pas, et laissait alors un tiers de page vide.
 *
 * Le titre et son contenu sont rendus à la suite dans la page, sans enveloppe
 * commune : c'est à cette condition que le moteur garde le titre avec ce qui
 * le suit (minPresenceAhead n'agit pas sur le premier enfant d'un bloc). Un
 * titre ne reste donc jamais seul en bas de page.
 */
function Rubrique({ titre, icone, children }: { titre: string; icone: string; children?: React.ReactNode }) {
  return (
    <>
      <View wrap={false} minPresenceAhead={48} style={{ marginTop: 16 }}>
        <PdfSectionTitle icon={icone}>{titre}</PdfSectionTitle>
      </View>
      {children}
    </>
  )
}

function Ligne({ label, children, gras }: { label: string; children: React.ReactNode; gras?: boolean }) {
  return (
    <View style={shared.row}>
      <Text style={shared.label}>{label}</Text>
      <Text hyphenationCallback={couperMotsLongs} style={gras ? { ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 } : shared.value}>{children}</Text>
    </View>
  )
}

/** Émetteur et destinataire, comme sur une facture adressée à France Travail. */
function Parties({ org, agence }: { org: any; agence: any | null }) {
  return (
    <View style={{ flexDirection: 'row', gap: 20, marginBottom: 14 }}>
      <View style={{ flex: 1 }}>
        <PdfSectionTitle icon="building">Émetteur</PdfSectionTitle>
        <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>{org?.legal_name || org?.name || ''}</Text>
        {org?.address ? <Text style={{ fontSize: 8, color: GRIS }}>{org.address}</Text> : null}
        {(org?.postal_code || org?.city) ? <Text style={{ fontSize: 8, color: GRIS }}>{`${org?.postal_code || ''} ${org?.city || ''}`.trim()}</Text> : null}
        {org?.siret ? <Text style={{ fontSize: 8, color: GRIS, marginTop: 2 }}>{`SIRET : ${org.siret}`}</Text> : null}
        {org?.numero_da ? <Text style={{ fontSize: 8, color: GRIS }}>{`N° de déclaration d’activité : ${org.numero_da}`}</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <PdfSectionTitle icon="building">Destinataire</PdfSectionTitle>
        {agence ? (
          <>
            <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, marginBottom: 3 }}>{agence.nom}</Text>
            {agence.adresse ? <Text style={{ fontSize: 8, color: GRIS }}>{agence.adresse}</Text> : null}
            {(agence.code_postal || agence.ville) ? <Text style={{ fontSize: 8, color: GRIS }}>{`${agence.code_postal || ''} ${agence.ville || ''}`.trim()}</Text> : null}
          </>
        ) : (
          <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700 }}>France Travail</Text>
        )}
      </View>
    </View>
  )
}

function BlocDossier({ dossier }: { dossier: DossierRapport }) {
  const e = dossier.employeur
  const lieuEmployeur = e ? [e.adresse, [e.code_postal, e.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  return (
    <Rubrique titre="Dossier concerné" icone="list">
      {dossier.numero ? <Ligne label="Dossier POEI" gras>{dossier.numero}</Ligne> : null}
      {dossier.numeroDossierFt ? <Ligne label="N° de dossier France Travail">{dossier.numeroDossierFt}</Ligne> : null}
      {dossier.formation ? <Ligne label="Formation">{dossier.formation}</Ligne> : null}
      {dossier.dateDebut ? (
        <Ligne label="Période prévue">
          {`du ${frDate(dossier.dateDebut)}${dossier.dateFin ? ` au ${frDate(dossier.dateFin)}` : ''}${dossier.dureeHeures ? `, ${heures(dossier.dureeHeures)}` : ''}`}
        </Ligne>
      ) : null}
      {e?.nom ? <Ligne label="Employeur">{`${e.nom}${lieuEmployeur ? `, ${lieuEmployeur}` : ''}`}</Ligne> : null}
      {e?.siret ? <Ligne label="SIRET de l’employeur">{e.siret}</Ligne> : null}
    </Rubrique>
  )
}

function BlocPersonne({ personne, titre }: { personne: PersonneRapport; titre: string }) {
  return (
    <Rubrique titre={titre} icone="users">
      <Ligne label="Nom" gras>{nomComplet(personne)}</Ligne>
      {personne.identifiantFt ? <Ligne label="Identifiant France Travail">{personne.identifiantFt}</Ligne> : null}
      {personne.numeroEngagement ? <Ligne label="N° d’engagement">{personne.numeroEngagement}</Ligne> : null}
      {personne.numeroConvention ? <Ligne label="N° de convention">{personne.numeroConvention}</Ligne> : null}
      {personne.posteVise ? <Ligne label="Poste visé">{personne.posteVise}</Ligne> : null}
    </Rubrique>
  )
}

/** Texte libre : un paragraphe par retour à la ligne, coupure de page permise. */
function Recit({ texte }: { texte: string }) {
  const paragraphes = texte.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  return (
    <View>
      {paragraphes.map((p, i) => (
        <Text key={i} hyphenationCallback={couperMotsLongs} style={{ ...TEXTE, marginBottom: 5 }}>{p}</Text>
      ))}
    </View>
  )
}

/**
 * Formule de clôture et signature, d'un seul tenant : le cachet ne part jamais
 * seul sur une dernière page, il emporte au moins la phrase qui le précède.
 */
function Cloture({ org }: { org: any }) {
  const aujourdhui = frDate(new Date().toISOString())
  const civilite = /^mr\.?$/i.test(String(org?.representant_legal_civilite || '').trim()) ? 'M.' : org?.representant_legal_civilite
  const representant = [civilite, org?.representant_legal_prenom, org?.representant_legal_nom].filter(Boolean).join(' ')
  return (
    <View wrap={false} style={{ marginTop: 10 }}>
      <Text style={{ ...TEXTE, fontSize: 8.5 }}>
        {`Le présent rapport reprend les éléments consignés au dossier de formation. ${org?.name || 'L’organisme'} se tient à la disposition de France Travail pour tout complément.`}
      </Text>
      <Text style={{ fontSize: 8.5, color: SURFACE_500, marginTop: 14 }}>{`Fait à ${org?.city || org?.ville || '___________'}, le ${aujourdhui}`}</Text>
      <View style={{ marginTop: 10 }}>
        <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{`Pour ${org?.name || 'l’organisme de formation'}`}</Text>
        {representant ? (
          <Text style={{ fontSize: 8.5, color: SURFACE_700, marginTop: 2 }}>
            {`${representant}${org?.representant_legal_fonction ? `, ${org.representant_legal_fonction}` : ''}`}
          </Text>
        ) : null}
        <View style={{ height: 80, width: 220, marginTop: 4 }}>
          <View style={{ position: 'absolute', bottom: 14, left: 0, height: 0.5, backgroundColor: SURFACE_200, width: 200 }} />
          {org?.tampon_signature_url ? (
            <Image src={org.tampon_signature_url} style={{ position: 'absolute', top: 0, left: 10, width: 160, height: 78, objectFit: 'contain' }} />
          ) : null}
        </View>
        <Text style={{ fontSize: 7, color: SURFACE_500 }}>Signature et cachet</Text>
      </View>
    </View>
  )
}

function Objet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ ...shared.infoBox, marginBottom: 0, flexDirection: 'row' }}>
      <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700 }}>Objet : </Text>
      <Text style={{ ...shared.infoBoxText, flex: 1 }}>{children}</Text>
    </View>
  )
}

/** Qui a signalé l'incident et quand : la même ligne sur les deux rapports. */
function SignalePar({ incident }: { incident: IncidentRapport }) {
  const jour = incident.declareLe ? frDate(incident.declareLe) : ''
  if (incident.declarant) return <Ligne label="Signalé par">{`${incident.declarant}${jour ? `, le ${jour}` : ''}`}</Ligne>
  return jour ? <Ligne label="Consigné le">{jour}</Ligne> : null
}

function suiviIncident(incident: IncidentRapport): string {
  const libelle = STATUTS_INCIDENT[incident.statut || ''] || 'Ouvert'
  return incident.resoluLe && ['resolu', 'clos'].includes(incident.statut || '')
    ? `${libelle}, le ${frDate(incident.resoluLe)}`
    : libelle
}

/** Rapport d'incident : les faits, les mesures prises, l'état du traitement. */
export function RapportIncidentPDF({ org, agence, dossier, reference, incident, personne }: Commun & {
  incident: IncidentRapport
  personne: PersonneRapport | null
}) {
  const nature = libelleTypeIncident(incident.type)
  const description = incident.description?.trim() || ''
  const mesures = incident.mesures?.trim() || ''
  // « En cours de formation » seulement si la date tombe dans la période du dossier
  const jourIncident = incident.date ? incident.date.slice(0, 10) : ''
  const pendant = !!jourIncident && !!dossier.dateDebut && jourIncident >= dossier.dateDebut.slice(0, 10)
    && (!dossier.dateFin || jourIncident <= dossier.dateFin.slice(0, 10))
  const objet = incident.date
    ? (pendant ? `Incident survenu en cours de formation, le ${frDate(incident.date)}` : `Incident du ${frDate(incident.date)}`)
    : 'Incident survenu en cours de formation'
  return (
    <Document title={`Rapport d’incident ${reference}`} author={org?.name || 'Lab Learning'}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Rapport d’incident" numero={reference} date={`Établi le ${frDate(new Date().toISOString())}`} org={org} />
        <Parties org={org} agence={agence} />
        <Objet>
          {`${objet}${personne ? `. Stagiaire : ${nomComplet(personne)}` : ''}.`}
        </Objet>

        <BlocDossier dossier={dossier} />
        {personne ? <BlocPersonne personne={personne} titre="Stagiaire" /> : null}

        <Rubrique titre="Incident" icone="alert">
          {incident.date ? <Ligne label="Date" gras>{frDate(incident.date)}</Ligne> : null}
          <Ligne label="Nature">{nature}</Ligne>
          <Ligne label="Niveau de gravité">{libelleGraviteIncident(incident.gravite)}</Ligne>
          {incident.titre ? <Ligne label="Intitulé">{incident.titre}</Ligne> : null}
          <SignalePar incident={incident} />
        </Rubrique>

        {description ? (
          <Rubrique titre="Description des faits" icone="fileText">
            <Recit texte={description} />
          </Rubrique>
        ) : null}

        {mesures ? (
          <Rubrique titre="Mesures prises" icone="check">
            <Recit texte={mesures} />
          </Rubrique>
        ) : null}

        <Rubrique titre="Suivi" icone="clock">
          <Ligne label="État du traitement">{suiviIncident(incident)}</Ligne>
        </Rubrique>

        <Cloture org={org} />
        <PdfDocFooter numero={reference} org={org} />
      </Page>
    </Document>
  )
}

/** Rapport d'abandon : le parcours du stagiaire, les circonstances de sa sortie, ce qui en découle. */
export function RapportAbandonPDF({ org, agence, dossier, reference, personne, abandon, incidents }: Commun & {
  personne: PersonneRapport
  abandon: AbandonRapport
  /** Incidents du même stagiaire que le gestionnaire a choisi de joindre */
  incidents?: IncidentRapport[]
}) {
  const prevues = abandon.heuresPrevues != null && abandon.heuresPrevues > 0 ? abandon.heuresPrevues : null
  const realisees = abandon.heuresEffectuees
  // Au-delà des heures prévues, un pourcentage ne dirait plus rien
  const assiduite = realisees != null && prevues && realisees <= prevues ? Math.round((realisees / prevues) * 100) : null
  // Abandon sans une heure suivie, ou déclaré avant le début : la date du dossier est celle où
  // le stagiaire devait entrer, le rapport ne doit pas affirmer qu'il est entré en formation.
  const sansEntree = realisees === 0
    || (!!abandon.dateAbandon && !!abandon.dateEntree && abandon.dateAbandon.slice(0, 10) < abandon.dateEntree.slice(0, 10))
  const leJour = abandon.dateAbandon ? `, le ${frDate(abandon.dateAbandon)}` : ''
  return (
    <Document title={`Rapport d’abandon ${reference}`} author={org?.name || 'Lab Learning'}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Rapport d’abandon de formation" numero={reference} date={`Établi le ${frDate(new Date().toISOString())}`} org={org} />
        <Parties org={org} agence={agence} />
        <Objet>
          {sansEntree
            ? `Abandon ${de(nomComplet(personne))}${leJour}, préparation opérationnelle à l’emploi individuelle (POEI)${realisees === 0 ? ', sans heure de formation réalisée' : ''}.`
            : `Sortie anticipée ${de(nomComplet(personne))}${leJour}, en cours de préparation opérationnelle à l’emploi individuelle (POEI).`}
        </Objet>

        <BlocDossier dossier={dossier} />
        <BlocPersonne personne={personne} titre="Stagiaire" />

        <Rubrique titre="Parcours" icone="calendar">
          {abandon.dateEntree ? <Ligne label={sansEntree ? 'Entrée prévue' : 'Entrée en formation'}>{frDate(abandon.dateEntree)}</Ligne> : null}
          {abandon.dateFinPrevue ? <Ligne label="Fin prévue">{frDate(abandon.dateFinPrevue)}</Ligne> : null}
          {abandon.dateAbandon ? <Ligne label={sansEntree ? 'Abandon' : 'Sortie anticipée'} gras>{frDate(abandon.dateAbandon)}</Ligne> : null}
          {realisees != null ? (
            <Ligne label="Heures réalisées" gras>
              {`${heures(realisees)}${prevues ? ` sur ${nombre(prevues)} prévue${prevues >= 2 ? 's' : ''}` : ''}${assiduite != null ? ` (${assiduite} %)` : ''}`}
            </Ligne>
          ) : prevues ? (
            <Ligne label="Durée prévue">{heures(prevues)}</Ligne>
          ) : null}
        </Rubrique>

        {abandon.motif ? (
          <Rubrique titre="Circonstances de l’abandon" icone="fileText">
            <Recit texte={abandon.motif} />
          </Rubrique>
        ) : null}

        {(incidents || []).map((incident, i) => (
          <Rubrique key={i} titre={incident.date ? `Incident du ${frDate(incident.date)}` : 'Incident'} icone="alert">
            <Ligne label="Nature">{libelleTypeIncident(incident.type)}</Ligne>
            <Ligne label="Niveau de gravité">{libelleGraviteIncident(incident.gravite)}</Ligne>
            {incident.titre ? <Ligne label="Intitulé">{incident.titre}</Ligne> : null}
            <SignalePar incident={incident} />
            {incident.description?.trim() ? <View style={{ marginTop: 4 }}><Recit texte={incident.description} /></View> : null}
            {incident.mesures?.trim() ? (
              <>
                {/* Même règle que les titres de rubrique : jamais seul en bas de page */}
                <View wrap={false} minPresenceAhead={48} style={{ marginTop: 2 }}>
                  <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginBottom: 3 }}>Mesures prises</Text>
                </View>
                <Recit texte={incident.mesures} />
              </>
            ) : null}
          </Rubrique>
        ))}

        <Rubrique titre="Suites" icone="clock">
          <Text style={{ ...TEXTE, fontSize: 8.5 }}>
            Les heures de formation sont facturées au prorata du temps de présence effectif, conformément aux règles de la convention POEI.
          </Text>
        </Rubrique>

        <Cloture org={org} />
        <PdfDocFooter numero={reference} org={org} />
      </Page>
    </Document>
  )
}
