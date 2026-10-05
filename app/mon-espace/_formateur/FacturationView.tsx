import { createServiceRoleClient } from '@/lib/supabase/server'
import { SESSION_DETAIL_SELECT, chargerDetailsPrestations } from '@/lib/facture-formateur-detail'
import { FacturationClient } from './FacturationClient'

/**
 * Facturation du formateur : ses sessions facturables (rémunération fixée) et
 * ses factures de prestation envoyées à l'organisme, avec leur statut.
 * Rendu à l'identique en espace connecté et en portail (token transmis).
 */
export async function FacturationView({ formateurId, token }: { formateurId: string; token: string | null }) {
  const supabase = await createServiceRoleClient()

  const [{ data: sessions }, { data: factures }, { data: formateur }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, reference, intitule, date_debut, date_fin, status, cout_formateur, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial, sigle)')
      .eq('formateur_id', formateurId)
      .order('date_fin', { ascending: false }),
    supabase
      .from('factures_formateur')
      .select(`*, ${SESSION_DETAIL_SELECT}`)
      .eq('formateur_id', formateurId)
      .order('created_at', { ascending: false }),
    supabase
      .from('formateurs')
      .select('facture_modele')
      .eq('id', formateurId)
      .single(),
  ])

  const facturesList = (factures || []) as any[]
  // Détail de chaque prestation facturée : dates, client, lieu, durée
  const details = await chargerDetailsPrestations(supabase, facturesList)
  const invoiced = new Set(facturesList.map((f) => f.session_id).filter(Boolean))
  // Facturable = session non encore facturée qui est soit terminée / passée,
  // soit dont la rémunération est déjà fixée. Le montant peut être vide (venant
  // de Dendreo) : le formateur le saisit alors lui-même.
  const today = new Date().toISOString().slice(0, 10)
  const facturable = ((sessions || []) as any[])
    .filter((s) => !invoiced.has(s.id))
    .filter((s) => Number(s.cout_formateur) > 0 || s.status === 'terminee' || (s.date_fin && s.date_fin <= today))

  // URLs signées pour les fichiers déposés (bucket privé)
  const paths = facturesList.map((f) => f.fichier_url).filter((u) => u && !/^https?:\/\//.test(u)) as string[]
  const fileUrls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('dossiers').createSignedUrls(paths, 3600)
    ;(signed || []).forEach((s, i) => { if (s?.signedUrl && !s.error) fileUrls[paths[i]] = s.signedUrl })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">Facturation</h1>
        <p className="text-surface-500 mt-1">Facturez vos prestations et suivez vos paiements</p>
      </div>
      <FacturationClient
        token={token}
        facturable={facturable}
        factures={facturesList}
        fileUrls={fileUrls}
        details={details}
        modele={(formateur as any)?.facture_modele || 'epure'}
      />
    </div>
  )
}
