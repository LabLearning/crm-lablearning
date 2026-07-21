import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ContratsList } from './ContratsList'

export const dynamic = 'force-dynamic'

export default async function ContratsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: contrats } = await supabase
    .from('contrats_formateur')
    .select(`
      id, numero, status, montant_ht, sent_at, created_at, storage_path,
      signature_formateur_date, signature_formateur_nom,
      signature_token, signature_token_expires_at,
      formateur_id, session_id, poei_intervention_id,
      formateur:formateurs(prenom, nom, email),
      session:sessions(id, reference, date_debut, formation:formation_id(intitule), client:clients(raison_sociale)),
      intervention:poei_interventions(id, libelle, date_debut, poei_id, poei:poei(numero, client:clients(raison_sociale)))
    `)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })

  const one = (v: any) => (Array.isArray(v) ? v[0] : v)

  const lignes = (contrats || []).map((c: any) => {
    const sess = one(c.session)
    const iv = one(c.intervention)
    const f = one(c.formateur)
    const tokenValide = c.signature_token
      && (!c.signature_token_expires_at || new Date(c.signature_token_expires_at) > new Date())
    return {
      id: c.id,
      numero: c.numero,
      formateurId: c.formateur_id,
      formateurNom: f ? `${f.prenom || ''} ${f.nom || ''}`.trim() : '—',
      formateurEmail: f?.email || null,
      intitule: sess?.formation?.intitule || sess?.reference || iv?.libelle || 'Prestation',
      clientNom: sess?.client?.raison_sociale || iv?.poei?.client?.raison_sociale || null,
      origine: sess ? 'session' : iv ? 'poei' : 'autre',
      lienUrl: sess?.id ? `/dashboard/sessions/${sess.id}`
        : iv?.poei_id ? `/dashboard/poei/${iv.poei_id}` : null,
      dateMission: sess?.date_debut || iv?.date_debut || null,
      montantHt: c.montant_ht,
      envoyeLe: c.sent_at,
      signeLe: c.signature_formateur_date,
      signePar: c.signature_formateur_nom,
      archive: Boolean(c.storage_path),
      lienExpire: Boolean(c.signature_token) && !tokenValide,
      annule: c.status === 'annule',
    }
  })

  return (
    <div className="animate-fade-in">
      <ContratsList contrats={lignes} />
    </div>
  )
}
