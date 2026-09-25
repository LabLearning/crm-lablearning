import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CertificatSignatureClient } from './CertificatSignatureClient'

export const dynamic = 'force-dynamic'

export default async function CertificatSignerPage({ params }: { params: { token: string } }) {
  const supabase = await createServiceRoleClient()

  const { data: sig } = await supabase
    .from('certificat_signatures')
    .select(`
      id, token, token_expires_at, signed_at, date_signature, signature_data, role, email, apprenant_id,
      apprenant:apprenants(prenom, nom, entreprise),
      poei:poei(id, date_debut, date_fin, duree_heures, poste_vise,
        formation:formation_id(intitule, duree_heures),
        client:client_id(raison_sociale, nom_commercial)),
      organization:organizations(name, logo_url)
    `)
    .eq('token', params.token)
    .maybeSingle()

  if (!sig) redirect('/portail/expired')
  if (sig.token_expires_at && new Date(sig.token_expires_at) < new Date()) redirect('/portail/expired')

  // Le signataire employeur signe pour tous les candidats du projet : la page
  // lui montre le projet et leur nombre, pas la fiche d'un candidat.
  let nbCandidats = 0
  let employeurNom: string | null = null
  if ((sig as any).role === 'employeur' && (sig as any).poei?.id) {
    const [{ count }, { data: poeiRow }] = await Promise.all([
      supabase.from('poei_candidats').select('id', { count: 'exact', head: true }).eq('poei_id', (sig as any).poei.id),
      supabase.from('poei').select('client_id').eq('id', (sig as any).poei.id).maybeSingle(),
    ])
    nbCandidats = count || 0
    // Le référent de l'entreprise : une seule source, la fiche client.
    if (poeiRow?.client_id) {
      const { data: contacts } = await supabase
        .from('contacts').select('prenom, nom, est_signataire, est_principal')
        .eq('client_id', poeiRow.client_id)
      const c = (contacts || []).find((x: any) => x.est_signataire)
        || (contacts || []).find((x: any) => x.est_principal)
        || (contacts || [])[0]
      if (c) employeurNom = [c.prenom, c.nom].filter(Boolean).join(' ').trim() || null
    }
  }

  // Candidat : les heures portées sur SON certificat (saisies dans la POEI, sinon durée du parcours)
  let heuresCandidat: { heures: number; prevues: number } | null = null
  if ((sig as any).role !== 'employeur' && (sig as any).apprenant_id && (sig as any).poei?.id) {
    const { heuresCertificatsPoei } = await import('@/lib/certificat-heures')
    const h = (await heuresCertificatsPoei(supabase, (sig as any).poei, (sig as any).poei?.formation?.duree_heures))
      .get(String((sig as any).apprenant_id))
    if (h) heuresCandidat = { heures: h.heures, prevues: h.dureeTotale }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <CertificatSignatureClient sig={sig as any} token={params.token} nbCandidats={nbCandidats} employeurNom={employeurNom} heuresCandidat={heuresCandidat} />
    </div>
  )
}
