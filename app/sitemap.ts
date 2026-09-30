import type { MetadataRoute } from 'next'
import { createServiceRoleClient } from '@/lib/supabase/server'

const BASE = 'https://www.lab-learning.fr'
const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'

/**
 * Plan du site vitrine : les pages fixes, les quatre branches et chaque fiche
 * formation active. Les fiches portent leur vraie date de mise à jour — c'est
 * elle qui dit aux moteurs quoi re-crawler.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/formations`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/financements`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/audit-plus`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/starkk`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/resultats`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/partenaires`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/a-propos`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE}/recrutement`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/faq`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/reclamation`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/reglement-interieur`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/mentions-legales`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${BASE}/cgv`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${BASE}/confidentialite`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${BASE}/cookies`, changeFrequency: 'yearly', priority: 0.1 },
  ]

  const branches = ['restauration-rapide', 'restaurant-hcr', 'boucherie-charcuterie', 'boulangerie-patisserie']
    .map((slug) => ({ url: `${BASE}/branches/${slug}`, changeFrequency: 'weekly' as const, priority: 0.8 }))

  let formations: MetadataRoute.Sitemap = []
  try {
    const supabase = await createServiceRoleClient()
    // Seules les fiches publiées au catalogue entrent au sitemap : indexer
    // les doublons dépubliés ferait concurrencer les fiches entre elles.
    const { data } = await supabase.from('formations')
      .select('id, date_derniere_maj, updated_at')
      .eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true).limit(500)
    formations = (data || []).map((f: any) => ({
      url: `${BASE}/formations/${f.id}`,
      lastModified: f.date_derniere_maj || f.updated_at || undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch {
    // Sans base joignable, le plan reste utile avec les pages fixes.
  }

  return [...fixes, ...branches, ...formations]
}
