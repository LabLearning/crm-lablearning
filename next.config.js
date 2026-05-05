const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
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
