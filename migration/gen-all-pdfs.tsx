import { renderToFile } from '@react-pdf/renderer'
import { createElement } from 'react'

const org = {
  name: 'Lab Learning',
  legal_name: 'SAS Lab-Learning',
  siret: '93165856100036',
  numero_da: '76341315134',
  numero_tva_intra: 'FR12931658561',
  rcs: 'RCS Montpellier 931 658 561',
  forme_juridique: 'SAS',
  capital_social: 10000,
  code_ape: '8559A',
  address: '6b boulevard Berthelot',
  postal_code: '34000',
  city: 'Montpellier',
  email: 'digital@lab-learning.fr',
  email_contact: 'digital@lab-learning.fr',
  phone: '04 67 00 00 00',
  is_qualiopi: true,
  qualiopi_certificat_numero: 'CERT_S1024_0345',
  banque_nom: 'BNP Paribas',
  banque_iban: 'FR76 3000 4000 1234 5678 9012 345',
  banque_bic: 'BNPAFRPP',
  banque_titulaire: 'SAS Lab-Learning',
  referent_handicap_nom: 'Brahim Ouchrif',
  referent_handicap_email: 'handicap@lab-learning.fr',
  referent_handicap_telephone: '06 12 34 56 78',
  delai_acces: 'Inscription possible jusqu\'à 7 jours avant le démarrage',
  representant_legal_civilite: 'M.',
  representant_legal_prenom: 'Julien',
  representant_legal_nom: 'COLELLA',
  representant_legal_fonction: 'Président',
  logo_url: 'https://igfmlzyxufgywxkneese.supabase.co/storage/v1/object/public/organisation/ff747dfe-c034-44d8-98d7-e53892263fb5/logo-1780908948.png',
}

const apprenant = { civilite: 'M.', prenom: 'Sacha', nom: 'OUZEGDOUH-JOHNSON', email: 'sacha@example.fr', entreprise: 'Chamas Tacos Annecy', organization_id: '_' }
const formation = {
  intitule: 'Hygiène alimentaire HACCP',
  reference: 'FORM-001',
  duree_heures: 14,
  duree_jours: 2,
  modalite: 'presentiel',
  categorie: 'Hygiène alimentaire & sécurité sanitaire',
  prerequis: 'Aucun prérequis particulier',
  public_vise: 'Personnel manipulant des denrées alimentaires',
  objectifs_pedagogiques: ['Maîtriser les règles d\'hygiène alimentaire', 'Mettre en œuvre un Plan de Maîtrise Sanitaire'],
  competences_visees: ['Appliquer les bonnes pratiques d\'hygiène', 'Auditer son établissement'],
  methodes_pedagogiques: 'Apports théoriques, études de cas, mises en situation.',
  moyens_techniques: 'Salle équipée, supports numériques, vidéoprojecteur.',
  modalites_evaluation: 'QCM en fin de formation + cas pratique.',
  accessibilite_handicap: 'Locaux accessibles PMR. Adaptations possibles sur demande.',
  tarif_inter_ht: 350,
  tarif_intra_ht: 1500,
}

const session = {
  id: 'sess-001',
  reference: 'SESS-001',
  date_debut: '2026-06-15',
  date_fin: '2026-06-16',
  lieu: 'Lab Learning — 24 rue du Châteaudun, 34300 Agde',
  horaires: '09:00–12:30 / 13:30–17:00',
  modalite: 'presentiel',
}

const formateur = {
  prenom: 'Maximilien',
  nom: 'Pringault',
  email: 'm.pringault@example.fr',
  siret: '12345678901234',
  adresse: '1 rue Exemple',
  code_postal: '34000',
  ville: 'Montpellier',
  tarif_journalier: 600,
  qualifications: ['Vétérinaire spécialiste hygiène alimentaire'],
  diplomes: ['Docteur vétérinaire (ENVT)'],
  certifications: ['Certification HACCP'],
}

const client = {
  raison_sociale: 'Chamas Tacos Annecy SARL',
  siret: '93761154900018',
  tva_intra: 'FR98937611549',
  adresse: '10 avenue de Brogny',
  code_postal: '74600',
  ville: 'Annecy',
  email: 'contact@chamas-annecy.fr',
  telephone: '04 50 12 34 56',
  type: 'entreprise',
}

const dossier = {
  id: 'dos-001',
  numero: 'DOS-2026-042',
  client_id: 'cl-001',
  formation_id: 'form-001',
  session_id: 'sess-001',
  montant_total_ht: 4200,
  montant_total_ttc: 4200,
  montant_prise_en_charge: 4200,
}

const convention = {
  numero: 'CONV-2026-072',
  type: 'intra_entreprise',
  date_emission: '2026-06-01',
  status: 'signee_complete',
  organization_id: '_',
  client: { raison_sociale: client.raison_sociale, email: client.email },
  formation: { intitule: formation.intitule },
  objet: formation.intitule,
  duree_heures: formation.duree_heures,
  dates_formation: 'Du 15 au 16 juin 2026',
  lieu: session.lieu,
  nombre_stagiaires: 3,
  montant_ht: 4200,
  montant_ttc: 4200,
  taux_tva: 0,
  financeur_type: 'opco',
  financeur_nom: 'Akto',
  signature_client_nom: 'Pierre Dupont',
  signature_client_date: '2026-06-08',
  signature_of_date: '2026-06-08',
  modalites_evaluation: 'Évaluation des acquis par QCM en fin de session + cas pratique. Émargements signés par demi-journée.',
}

const devis = {
  numero: 'DEV-2026-045',
  status: 'envoye',
  date_emission: '2026-05-25',
  date_validite: '2026-06-25',
  date_acceptation: null,
  objet: 'Formation Hygiène alimentaire HACCP pour 6 collaborateurs',
  client,
  contact: { prenom: 'Pierre', nom: 'Dupont', email: 'p.dupont@chamas-annecy.fr' },
  formation: { intitule: formation.intitule, reference: 'FORM-001' },
  organization_id: '_',
  lignes: [{ id: 'l1', designation: 'Hygiène HACCP — Inter', description: '14h / personne', quantite: 6, unite: 'stag.', prix_unitaire_ht: 350, montant_ht: 2100 }],
  remise_pourcent: 0, remise_montant: 0,
  montant_ht: 2100, taux_tva: 0, montant_tva: 0, montant_ttc: 2100,
  conditions_particulieres: 'Devis valable 30 jours.',
}

const facture = {
  numero: 'F-2026-0089',
  type: 'facture',
  status: 'envoyee',
  date_emission: '2026-06-08',
  date_echeance: '2026-07-08',
  date_envoi: '2026-06-08',
  date_paiement_complet: null,
  objet: 'Formation Hygiène HACCP',
  client,
  formation: { intitule: formation.intitule },
  organization_id: '_',
  lignes: [{ id: 'l1', designation: 'Hygiène HACCP — 2 jours', description: '14 h', quantite: 6, unite: 'stag.', prix_unitaire_ht: 350, montant_ht: 2100 }],
  paiements: [],
  remise_pourcent: 0, remise_montant: 0,
  montant_ht: 2100, taux_tva: 0, montant_tva: 0, montant_ttc: 2100,
  montant_paye: 0, montant_restant: 2100,
  subrogation: false, financeur_nom: null,
  conditions_paiement: 'Virement à 30 jours fin de mois.',
}

async function gen() {
  const { ConventionPDF } = await import('../lib/pdf/convention-pdf')
  const { DevisPDF } = await import('../lib/pdf/devis-pdf')
  const { FacturePDF } = await import('../lib/pdf/facture-pdf')
  const { AttestationFormationPDF } = await import('../lib/pdf/attestation-formation-pdf')
  const { CertificatRealisationPDF } = await import('../lib/pdf/certificat-realisation-pdf')
  const { ConvocationPDF } = await import('../lib/pdf/convocation-pdf')
  const { ProgrammeFormationPDF } = await import('../lib/pdf/programme-formation-pdf')
  const { ContratFormationPDF } = await import('../lib/pdf/contrat-formation-pdf')
  const { ContratFormateurPDF } = await import('../lib/pdf/contrat-formateur-pdf')
  const { ContratApporteurPDF } = await import('../lib/pdf/contrat-apporteur-pdf')

  const targets: Array<[string, any]> = [
    ['convention.pdf', createElement(ConventionPDF, { convention, org } as any)],
    ['devis.pdf', createElement(DevisPDF, { devis, org } as any)],
    ['facture.pdf', createElement(FacturePDF, { facture, org } as any)],
    ['attestation.pdf', createElement(AttestationFormationPDF, { apprenant, session, formation, org, assiduite: 100 })],
    ['certificat.pdf', createElement(CertificatRealisationPDF, { apprenant, session, formation, org, assiduite: 100, heuresPresence: 14 })],
    ['convocation.pdf', createElement(ConvocationPDF, { apprenant, session, formation, org, formateur })],
    ['programme.pdf', createElement(ProgrammeFormationPDF, { formation, org })],
    ['contrat-formation-particulier.pdf', createElement(ContratFormationPDF, { dossier, client, formation, session, org, formateur } as any)],
    ['contrat-sous-traitance-formateur.pdf', createElement(ContratFormateurPDF, { formateur, org, session: { ...session, formation, reference: 'SESS-001' } } as any)],
    ['contrat-apporteur.pdf', createElement(ContratApporteurPDF, { apporteur: { prenom: 'Apporteur', nom: 'TEST', email: 'apporteur@test.fr', telephone: '06 00 00 00 00', taux_commission: 10, siret: null }, org } as any)],
  ]

  for (const [name, el] of targets) {
    try {
      await renderToFile(el as any, `/tmp/sample-${name}`)
      console.log(`✓ /tmp/sample-${name}`)
    } catch (e: any) {
      console.error(`✗ ${name} →`, e?.message?.slice(0, 200))
    }
  }
}
gen()
