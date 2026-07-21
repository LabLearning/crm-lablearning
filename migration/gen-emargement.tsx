import { renderToFile } from '@react-pdf/renderer'
import { createElement } from 'react'
import { EmargementPDF } from '../lib/pdf/emargement-pdf'

const session = {
  reference: 'HACCP-AGDE-202606',
  date_debut: '2026-06-08',
  date_fin: '2026-06-09',
  lieu: 'Lab Learning — 24 rue du Châteaudun, 34300 Agde',
  adresse: '24 rue du Châteaudun',
  code_postal: '34300',
  ville: 'Agde',
  horaires: '09:00–12:30 / 13:30–17:00',
}

const formation = {
  intitule: 'Hygiène alimentaire HACCP',
  duree_heures: 14,
}

const org = {
  name: 'Lab Learning',
  legal_name: 'SAS Lab-Learning',
  numero_da: '76341315134',
  siret: '93165856100036',
  is_qualiopi: true,
  // Logo vert foncé pour fond blanc (PDF) — distinct du logo blanc utilisé dans les emails à header vert
  logo_url: 'https://igfmlzyxufgywxkneese.supabase.co/storage/v1/object/public/organisation/ff747dfe-c034-44d8-98d7-e53892263fb5/logo-1780908948.png',
}

const formateur = { prenom: 'Maximilien', nom: 'Pringault' }

const apprenants = [
  { prenom: 'Sacha', nom: 'OUZEGDOUH-JOHNSON', entreprise: null },
  { prenom: 'Morgane', nom: 'CLARET', entreprise: null },
  { prenom: 'Cédric', nom: 'FERNANDEZ', entreprise: null },
]

async function main() {
  await renderToFile(
    createElement(EmargementPDF, { session, formation, org, formateur, apprenants }) as any,
    '/tmp/emargement-haccp-agde-2026-06-08.pdf',
  )
  console.log('PDF généré : /tmp/emargement-haccp-agde-2026-06-08.pdf')
}
main()
