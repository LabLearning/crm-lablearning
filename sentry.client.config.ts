// Sentry config — exécuté côté navigateur (client components, événements UI)
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% des transactions tracées en perf (suffisant pour démarrer, économique)
  tracesSampleRate: 0.1,

  // Replay : capture la session du user juste avant et pendant une erreur
  // 0% des sessions normales, 100% des sessions avec erreur (free tier compatible)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],

  // Logs uniquement en prod, ignore les erreurs en dev local
  enabled: process.env.NODE_ENV === 'production',

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
})
