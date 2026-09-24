import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { InscriptionFormateurForm } from './InscriptionFormateurForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Devenir formateur',
  robots: { index: false, follow: false },
}

/**
 * Lien général d'inscription des formateurs : le même pour tous, envoyé par
 * l'équipe. Le formateur remplit sa fiche lui-même (identité, statut,
 * domaines, tarifs, CV) et elle arrive directement dans le CRM.
 */
export default async function DevenirFormateurPage({ params }: { params: { token: string } }) {
  const supabase = await createServiceRoleClient()
  const valide = /^[a-f0-9]{16,64}$/i.test(params.token || '')
  const { data: org } = valide
    ? await supabase.from('organizations').select('*').eq('inscription_formateur_token', params.token).maybeSingle()
    : { data: null }

  if (!org) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
        <div className="card max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-heading font-bold text-surface-900">Lien introuvable</h1>
          <p className="text-sm text-surface-600 mt-2">
            Ce lien d&apos;inscription n&apos;est plus valable. Demandez le lien à jour à l&apos;organisme de formation qui vous l&apos;a envoyé.
          </p>
        </div>
      </div>
    )
  }

  return (
    <InscriptionFormateurForm
      token={params.token}
      orgNom={(org as any).name || 'Lab Learning'}
      orgLogo={(org as any).logo_url || null}
    />
  )
}
