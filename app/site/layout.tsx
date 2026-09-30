import type { Metadata } from 'next'
import { SiteNav } from './SiteNav'
import { SiteFooter } from './SiteFooter'
import { CookieBanner } from './CookieBanner'

/**
 * Métadonnées du site vitrine.
 *
 * metadataBase + canonical : chaque page déclare son URL de référence — sans
 * elle, les moteurs choisissent eux-mêmes entre variantes. Le titre par défaut
 * vise 50-60 caractères avec les mots-clés métier ; les pages enfants passent
 * par le template.
 */
export const metadata: Metadata = {
  // Le domaine public de référence : les canonicals consolident le SEO sur
  // lab-learning.fr, même quand la page est servie via crm.lab-learning.fr/site.
  metadataBase: new URL('https://www.lab-learning.fr'),
  title: {
    default: 'Formations Qualiopi métiers de bouche & CHR | Lab Learning',
    template: '%s | Lab Learning',
  },
  description:
    'Organisme de formation certifié Qualiopi : hygiène HACCP, sécurité, management pour la restauration, boucherie, boulangerie, pâtisserie. Financement OPCO.',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Lab Learning',
    title: 'Formations Qualiopi métiers de bouche & CHR | Lab Learning',
    description:
      'Formations professionnelles en intra-entreprise, prises en charge OPCO : hygiène alimentaire HACCP, sécurité, management en restauration.',
    url: '/',
    images: [{ url: '/site/metiers/formation.webp', width: 1200, height: 630, alt: 'Formation aux métiers de la restauration avec Lab Learning' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Formations Qualiopi métiers de bouche & CHR | Lab Learning',
    description: 'Formations professionnelles certifiées Qualiopi, financées par les OPCO.',
  },
  robots: { index: true, follow: true },
}

/**
 * Identité structurée (Schema.org) : l'organisme et son établissement local.
 * C'est ce que lisent les moteurs classiques comme les moteurs génératifs pour
 * répondre avec certitude « qui est Lab Learning » — le rapport SEO notait son
 * absence en premier.
 */
const SCHEMA_ORGANISATION = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.lab-learning.fr/#organization',
      name: 'Lab Learning',
      legalName: 'SAS Lab-Learning',
      url: 'https://www.lab-learning.fr',
      logo: 'https://www.lab-learning.fr/logo-lablearning.svg',
      email: 'contact@lab-learning.fr',
      telephone: '+33451330330',
      vatID: 'FR41931658561',
      taxID: '93165856100036',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '6b boulevard Berthelot, Bureau 3',
        postalCode: '34000',
        addressLocality: 'Montpellier',
        addressCountry: 'FR',
      },
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        name: 'Certification Qualiopi, catégorie Actions de formation',
        url: 'https://www.lab-learning.fr/site/documents/certificat-qualiopi-lab-learning.pdf',
      },
    },
    {
      '@type': 'LocalBusiness',
      '@id': 'https://www.lab-learning.fr/#localbusiness',
      name: 'Lab Learning',
      parentOrganization: { '@id': 'https://www.lab-learning.fr/#organization' },
      url: 'https://www.lab-learning.fr',
      telephone: '+33451330330',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '6b boulevard Berthelot, Bureau 3',
        postalCode: '34000',
        addressLocality: 'Montpellier',
        addressCountry: 'FR',
      },
    },
  ],
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#14110F] antialiased selection:bg-[#205040] selection:text-white">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_ORGANISATION) }}
      />
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
      <CookieBanner />
    </div>
  )
}
