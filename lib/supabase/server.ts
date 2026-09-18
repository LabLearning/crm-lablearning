import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { entetesActeur } from '@/lib/acteur'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components (read-only)
          }
        },
      },
    }
  )
}

export async function createServiceRoleClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // no-store : empêche le Data Cache de Next/Vercel de mémoriser les
      // réponses Supabase (il persiste entre déploiements et servait des
      // données figées sur les pages sans cookies, ex. portails par token)
      global: {
        // L'utilisateur à l'origine de la requête (journal d'activité, migration
        // 155) est résolu à CHAQUE appel HTTP, pas à la création du client : un
        // client créé avant getSession() signe quand même ses écritures.
        fetch: (url: any, options: any = {}) => {
          const h = new Headers(options.headers)
          for (const [k, v] of Object.entries(entetesActeur())) h.set(k, v)
          return fetch(url, { ...options, headers: h, cache: 'no-store' })
        },
      },
    }
  )
}
