const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Lecture IA des fiches papier : les photos passent par une Server
    // Action — la limite par défaut (1 Mo) est trop courte pour des photos
    // de téléphone même compressées.
    serverActions: { bodySizeLimit: '8mb' },
    // Cache client du routeur : une page déjà visitée est réaffichée
    // instantanément pendant 60s au lieu de refaire l'aller-retour serveur.
    // Les Server Actions purgent ce cache (revalidatePath), donc les
    // modifications restent visibles immédiatement.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  // Le site vitrine répond sur lab-learning.fr avec des URLs PROPRES :
  // lab-learning.fr/formations sert /site/formations en interne, et les
  // anciennes URLs /site/… redirigent vers la version propre. Les préfixes
  // sont énumérés (pas de catch-all) pour ne jamais intercepter /api,
  // /_next ni les fichiers statiques du dossier public.
  async redirects() {
    const hosts = ['lab-learning.fr', 'www.lab-learning.fr']
    // Seules les SECTIONS de pages redirigent (/site/formations -> /formations) :
    // les fichiers publics sous /site/ (logos, photos, documents) ne doivent
    // surtout pas être redirigés, ils n'existent qu'à ce chemin.
    const sections = [
      'formations', 'branches', 'resultats', 'a-propos', 'partenaires',
      'financements', 'contact', 'recrutement', 'reclamation',
      'reglement-interieur', 'mentions-legales', 'cgv', 'confidentialite', 'cookies', 'faq',
      'audit-plus', 'starkk', 'guides', 'formation-restauration-rapide',
    ]
    // base vide : même domaine ; sinon le domaine public
    const regles = (h, base) => [
      { source: '/site', has: [{ type: 'host', value: h }], destination: `${base}/`, permanent: true },
      ...sections.flatMap((s) => s === 'formations'
        // Une fiche formation est un identifiant ; les photos de formation
        // (/site/formations/<id>.webp) vivent au même chemin et restent servies telles quelles
        ? [
          { source: '/site/formations', has: [{ type: 'host', value: h }], destination: `${base}/formations`, permanent: true },
          { source: '/site/formations/:id([0-9a-f-]{36})', has: [{ type: 'host', value: h }], destination: `${base}/formations/:id`, permanent: true },
        ]
        : [
          { source: `/site/${s}`, has: [{ type: 'host', value: h }], destination: `${base}/${s}`, permanent: true },
          { source: `/site/${s}/:path*`, has: [{ type: 'host', value: h }], destination: `${base}/${s}/:path*`, permanent: true },
        ]),
    ]
    return [
      ...hosts.flatMap((h) => regles(h, '')),
      // L'ancienne adresse crm.lab-learning.fr/site renvoie au domaine public :
      // le site n'existe qu'à une adresse, celle que les moteurs référencent
      ...regles('crm.lab-learning.fr', 'https://www.lab-learning.fr'),
    ]
  },
  async rewrites() {
    const hosts = ['lab-learning.fr', 'www.lab-learning.fr']
    const sections = [
      'formations', 'branches', 'resultats', 'a-propos', 'partenaires',
      'financements', 'contact', 'recrutement', 'reclamation',
      'reglement-interieur', 'mentions-legales', 'cgv', 'confidentialite', 'cookies', 'faq',
      'audit-plus', 'starkk', 'guides', 'formation-restauration-rapide',
    ]
    const pages = (condition) => sections.flatMap((s) => [
      { source: `/${s}`, ...condition, destination: `/site/${s}` },
      { source: `/${s}/:path*`, ...condition, destination: `/site/${s}/:path*` },
    ])
    return {
      beforeFiles: [
        ...hosts.flatMap((h) => [
          { source: '/', has: [{ type: 'host', value: h }], destination: '/site' },
          ...pages({ has: [{ type: 'host', value: h }] }),
        ]),
        // Les liens du site sont écrits en adresses propres (/formations) : hors du
        // domaine public (aperçus Vercel, poste de développement) elles mènent aux mêmes pages
        ...pages({ has: [{ type: 'host', value: '.*\\.vercel\\.app' }] }),
        ...(process.env.NODE_ENV === 'development' ? pages({}) : []),
      ],
    }
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Org / project Sentry — à renseigner via env vars en prod
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Silence le wizard si auth_token manque (build local sans Sentry)
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload des sourcemaps pour avoir des stack traces lisibles
  widenClientFileUpload: true,

  // Tunnel : évite les ad-blockers qui bloquent les events Sentry côté navigateur
  tunnelRoute: '/monitoring',

  // Ne pas générer de release ni upload de sourcemaps si pas de SENTRY_AUTH_TOKEN
  disableLogger: true,
  automaticVercelMonitors: false,
})
