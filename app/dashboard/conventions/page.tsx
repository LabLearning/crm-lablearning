import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { CERTIFICAT_SIGNATURE_CONVENTION } from '@/lib/fonctionnalites'
import { ConventionsList, type ConventionListe } from './ConventionsList'

export default async function ConventionsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: conventions }, { data: signeesElectroniquement }, { data: clients }, { data: formations }, { data: sessions }] = await Promise.all([
    // Seules les colonnes que la liste affiche : ni l'image de la signature, ni
    // le jeton du lien, ni l'adresse IP et le navigateur du signataire ne
    // partent au navigateur
    supabase
      .from('conventions')
      .select('id, numero, type, status, objet, montant_ttc, duree_heures, nombre_stagiaires, financeur_type, signature_client_date, signature_of_date, signature_client_signed_at, signature_document_path, client:clients(raison_sociale, nom_commercial, sigle), formation:formations(intitule)')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    // Conventions signées électroniquement par le client : leur certificat de
    // signature peut être délivré (l'image elle-même n'est pas chargée ici).
    // Même ordre que la liste, pour que les deux lectures couvrent les mêmes lignes.
    supabase
      .from('conventions')
      .select('id')
      .eq('organization_id', session.organization.id)
      .in('status', ['signee_client', 'signee_complete'])
      .not('signature_client_signature_data', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, raison_sociale')
      .eq('organization_id', session.organization.id)
      .order('raison_sociale'),
    supabase
      .from('formations')
      .select('id, intitule, duree_heures')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('intitule'),
    // Sessions sélectionnables dans une convention (planning + participants du PDF)
    supabase
      .from('sessions')
      .select('id, intitule, reference, date_debut, date_fin, formation_id, client_id, lieu, ville')
      .eq('organization_id', session.organization.id)
      .order('date_debut', { ascending: false })
      .limit(300),
  ])

  // Indicateurs calculés ici : le chemin de l'exemplaire figé reste sur le serveur
  const avecCertificat = new Set(((signeesElectroniquement || []) as any[]).map((c) => c.id))
  const lignes = ((conventions || []) as any[]).map(({ signature_document_path, ...c }) => ({
    ...c,
    certificat_signature: CERTIFICAT_SIGNATURE_CONVENTION && avecCertificat.has(c.id),
    exemplaire_archive: !!signature_document_path,
  }))

  return (
    <div className="animate-fade-in">
      <ConventionsList
        conventions={lignes as ConventionListe[]}
        clients={clients || []}
        formations={formations || []}
        sessions={(sessions || []) as any[]}
      />
    </div>
  )
}
