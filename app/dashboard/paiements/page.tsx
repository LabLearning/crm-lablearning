import { getSession } from '@/lib/auth'
import { peutVoirChiffreAffaires } from '@/lib/acces-reserves'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PaiementsList } from './PaiementsList'
import type { Paiement } from '@/lib/types/facture'

export default async function PaiementsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: paiements } = await supabase
    .from('paiements')
    .select(`
      *,
      facture:factures(numero, montant_ttc, client:clients(raison_sociale, nom_commercial, sigle))
    `)
    .eq('organization_id', session.organization.id)
    .order('date_paiement', { ascending: false })

  return (
    <div className="animate-fade-in">
      <PaiementsList paiements={(paiements || []) as Paiement[]} voitChiffreAffaires={peutVoirChiffreAffaires(session.user.role)} />
    </div>
  )
}
