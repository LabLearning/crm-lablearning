/**
 * Génère les fiches de poste formateurs (PDF charte maison) publiées sur la
 * page /site/recrutement. Statiques : régénérer après toute modification des
 * fiches dans app/site/recrutement/page.tsx.
 *
 *   npx tsx scripts/generer-fiches-poste.tsx
 */
import * as React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { writeFileSync, mkdirSync } from 'fs'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfDocHeader, PdfDocFooter, PdfSectionTitle, shared, SURFACE_500, SURFACE_700, SURFACE_900 } from '../lib/pdf/components'

const ORG = {
  name: 'Lab Learning',
  numero_da: '76341315134',
  is_qualiopi: true,
  email_contact: 'sales@lab-learning.fr',
}

const POSTES = [
  {
    fichier: 'formateur-hygiene-alimentaire-haccp',
    titre: 'Formateur·rice Hygiène alimentaire & HACCP',
    accroche: "Former les équipes de restaurants, boucheries et boulangeries aux bonnes pratiques d'hygiène, à la méthode HACCP et au plan de maîtrise sanitaire.",
    missions: [
      "Animer des sessions intra-entreprise d'1 à 3 jours : hygiène alimentaire, PMS, nettoyage-désinfection, traçabilité, allergènes.",
      'Adapter le contenu au terrain : restauration rapide, traditionnelle, métiers de bouche.',
      "Évaluer les acquis (positionnement d'entrée, évaluation de sortie) et tenir l'émargement dans les outils Lab Learning.",
      'Remettre un rapport de fin de session.',
    ],
    profil: [
      "3 ans d'expérience minimum en hygiène alimentaire ou en qualité agroalimentaire.",
      'Formation HACCP attestée (ROFHYA apprécié) ; expérience de la formation pour adultes.',
      'Aisance avec les publics de terrain, y compris en français langue seconde.',
    ],
    conditions: 'Statut indépendant, contrat de prestation par session. Interventions dans toute la France, fortes demandes en Occitanie, Île-de-France, Auvergne-Rhône-Alpes.',
  },
  {
    fichier: 'formateur-prevention-securite',
    titre: 'Formateur·rice Prévention & Sécurité au travail',
    accroche: 'Accompagner les établissements sur le DUERP, les gestes et postures, le SST et la sécurité incendie.',
    missions: [
      'Animer les formations DUERP, prévention des risques professionnels, gestes & postures, SST, sécurité incendie.',
      "Conduire l'analyse des risques avec le gérant et les équipes.",
      'Évaluer les acquis et documenter la session dans les outils Lab Learning.',
    ],
    profil: [
      'Certification de formateur SST (INRS) ou équivalent pour les modules concernés, habilitations à jour.',
      'Expérience en prévention des risques (IPRP, HSE, ergonomie…).',
      'Pédagogie active, cas concrets tirés du secteur CHR.',
    ],
    conditions: 'Statut indépendant, contrat de prestation par session. Interventions dans toute la France.',
  },
  {
    fichier: 'formateur-metiers-de-bouche',
    titre: 'Formateur·rice Métiers de bouche',
    accroche: 'Boucherie, boulangerie, pâtisserie, cuisine, barista : transmettre le geste professionnel en situation réelle, dans le laboratoire ou la cuisine du client.',
    missions: [
      'Animer des formations techniques en établissement : découpe, panification, pâtisserie, préparation culinaire, café.',
      "Positionner le niveau d'entrée de chaque stagiaire et mesurer la progression.",
      'Conseiller le gérant sur les organisations de production.',
    ],
    profil: [
      "5 ans d'expérience métier minimum (CAP/BP/BM ou expérience équivalente démontrée).",
      'Une expérience de transmission (tutorat, apprentissage, formation) est exigée.',
      'Autonomie et adaptation aux contraintes de service.',
    ],
    conditions: 'Statut indépendant, contrat de prestation par session. Interventions dans toute la France, planification adaptée aux jours de fermeture des établissements.',
  },
  {
    fichier: 'formateur-management-gestion',
    titre: 'Formateur·rice Management & Gestion en restauration',
    accroche: 'Former gérants et responsables : management des équipes, rentabilité, coûts matières, relation client, développement commercial.',
    missions: [
      'Animer les formations management, gestion & rentabilité, relation client et développement commercial.',
      "Travailler sur les chiffres réels de l'établissement : coûts matières, marges, plans d'action.",
      'Structurer un plan de progression avec le dirigeant.',
    ],
    profil: [
      "Expérience de direction ou d'accompagnement d'établissements CHR.",
      'Solides bases en gestion (P&L restauration) et en conduite du changement.',
      'Posture de consultant-formateur : écoute et exigence.',
    ],
    conditions: 'Statut indépendant, contrat de prestation par session. Interventions dans toute la France.',
  },
  {
    // Ni POEI ni France Travail : voir le courrier de France Travail du 30/09/2026
    fichier: 'formateur-accompagnateur-prise-de-poste',
    titre: 'Formateur·rice-accompagnateur·rice prise de poste',
    accroche: "Préparer des candidats à leur prise de poste d'équipier polyvalent en restauration rapide, en lien avec l'employeur.",
    missions: [
      'Animer des parcours de plusieurs semaines : hygiène, sécurité, gestes métier, posture professionnelle.',
      'Évaluer chaque semaine la progression des candidats (grilles hebdomadaires) et conduire le bilan final avec le tuteur et l’employeur.',
      'Coordonner avec le gestionnaire Lab Learning le suivi administratif du parcours.',
    ],
    profil: [
      'Expérience en restauration rapide (management ou exploitation) ET en formation ou insertion.',
      'Rigueur documentaire : ces parcours exigent un suivi précis.',
      'Goût pour les publics en insertion professionnelle.',
    ],
    conditions: 'Statut indépendant. Missions longues (4 à 6 semaines) sur site, France entière selon les ouvertures.',
  },
]

function FichePoste({ p }: { p: (typeof POSTES)[number] }) {
  const Item = ({ children }: { children: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 6 }}>
      <Text style={{ fontSize: 8.6, color: SURFACE_500, width: 10 }}>•</Text>
      <Text style={{ fontSize: 8.6, color: SURFACE_700, lineHeight: 1.5, flex: 1 }}>{children}</Text>
    </View>
  )
  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Fiche de poste" numero="Recrutement formateurs" date={new Date().toLocaleDateString('fr-FR')} org={ORG} />
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: 700, color: SURFACE_900, letterSpacing: -0.3 }}>{p.titre}</Text>
          <Text style={{ fontSize: 9, color: SURFACE_700, lineHeight: 1.55, marginTop: 5 }}>{p.accroche}</Text>
        </View>
        <View style={{ marginBottom: 10 }}>
          <PdfSectionTitle>Vos missions</PdfSectionTitle>
          {p.missions.map((m) => <Item key={m}>{m}</Item>)}
        </View>
        <View style={{ marginBottom: 10 }}>
          <PdfSectionTitle>Profil recherché</PdfSectionTitle>
          {p.profil.map((m) => <Item key={m}>{m}</Item>)}
        </View>
        <View style={{ marginBottom: 10 }}>
          <PdfSectionTitle>Conditions</PdfSectionTitle>
          <Text style={{ fontSize: 8.6, color: SURFACE_700, lineHeight: 1.55 }}>{p.conditions}</Text>
          <Text style={{ fontSize: 8.6, color: SURFACE_700, lineHeight: 1.55, marginTop: 4 }}>
            Outils fournis : programmes, supports pédagogiques, espace formateur en ligne (émargement, évaluations, rapport de session).
          </Text>
        </View>
        <View style={shared.infoBox}>
          <Text style={{ fontSize: 8.4, color: SURFACE_700, lineHeight: 1.6 }}>
            {`Candidature : CV, diplômes ou certifications et deux références d'intervention à sales@lab-learning.fr, en précisant la fiche de poste visée et vos zones d'intervention. Conformément à notre démarche qualité (Qualiopi), chaque candidature fait l'objet d'une vérification des compétences : analyse du dossier, entretien, puis évaluation continue sur les premières sessions.`}
          </Text>
        </View>
        <PdfDocFooter numero={p.titre} org={ORG} />
      </Page>
    </Document>
  )
}

async function main() {
  mkdirSync('public/site/documents/fiches-poste', { recursive: true })
  for (const p of POSTES) {
    const buf = await renderToBuffer(<FichePoste p={p} />)
    const chemin = `public/site/documents/fiches-poste/${p.fichier}.pdf`
    writeFileSync(chemin, buf)
    console.log('ok', chemin, Math.round(buf.length / 1024) + ' Ko')
  }
}
main()
