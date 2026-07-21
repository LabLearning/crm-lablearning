import { renderToFile } from '@react-pdf/renderer'
import { createElement } from 'react'
import { EmargementPDF } from '../lib/pdf/emargement-pdf'

const org = {
  name: 'Lab Learning',
  legal_name: 'SAS Lab-Learning',
  numero_da: '76341315134',
  siret: '93165856100036',
  is_qualiopi: true,
  logo_url: 'https://igfmlzyxufgywxkneese.supabase.co/storage/v1/object/public/organisation/ff747dfe-c034-44d8-98d7-e53892263fb5/logo-1780908948.png',
}

const formateur = { prenom: 'Maximilien', nom: 'Pringault' }

const apprenants = [
  { prenom: 'Sacha', nom: 'OUZEGDOUH-JOHNSON', entreprise: null },
  { prenom: 'Morgane', nom: 'CLARET', entreprise: null },
  { prenom: 'Cédric', nom: 'FERNANDEZ', entreprise: null },
]

const baseSession = {
  reference: 'TEST-DUREE',
  lieu: 'Lab Learning — 24 rue du Châteaudun, 34300 Agde',
  horaires: '09:00–12:30 / 13:30–17:00',
}

const baseFormation = { intitule: 'Hygiène alimentaire HACCP' }

async function gen(days: number, fileName: string) {
  const dateDebut = new Date('2026-09-07')
  const dateFin = new Date(dateDebut)
  dateFin.setDate(dateFin.getDate() + days - 1)
  await renderToFile(
    createElement(EmargementPDF, {
      session: { ...baseSession, date_debut: dateDebut.toISOString().slice(0,10), date_fin: dateFin.toISOString().slice(0,10) },
      formation: { ...baseFormation, duree_heures: days * 7 },
      org, formateur, apprenants,
    }) as any,
    `/tmp/${fileName}`,
  )
  console.log(`✓ ${days} jours → /tmp/${fileName}`)
}

async function main() {
  await gen(1, 'emarg-1j.pdf')
  await gen(2, 'emarg-2j.pdf')
  await gen(4, 'emarg-4j.pdf')
  await gen(8, 'emarg-8j.pdf')
}
main()
