import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Contexte de page de Starkk : à partir du chemin où se trouve l'utilisateur
 * dans le CRM, on identifie l'entité affichée (session, client, apprenant,
 * facture, formateur, POEI, franchise) pour que « envoie la convention » ou
 * « relance le client » se comprennent sans rien préciser.
 */

export interface ContextePage {
  /** Type d'entité affichée */
  type: 'session' | 'client' | 'apprenant' | 'facture' | 'formateur' | 'poei' | 'franchise' | 'page'
  id?: string
  /** Libellé court pour la puce du widget */
  libelle: string
  /** Phrase injectée dans le prompt système */
  prompt: string
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const fr = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

export async function resoudreContexte(path: string | null | undefined, orgId: string): Promise<ContextePage | null> {
  if (!path) return null
  const supabase = await createServiceRoleClient()
  const m = (re: RegExp) => path.match(re)?.[1] || null

  const sessionId = m(new RegExp(`^/dashboard/sessions/(${UUID})`))
  if (sessionId) {
    const { data: s } = await supabase.from('sessions')
      .select('id, reference, date_debut, date_fin, status, type_session, client_id, formateur_id, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial), formateur:formateur_id(prenom, nom)')
      .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
    if (!s) return null
    const cli: any = (s as any).client, f: any = (s as any).formateur
    const nomCli = cli?.nom_commercial || cli?.raison_sociale || 'sans client'
    const dates = s.date_debut === s.date_fin || !s.date_fin ? `le ${fr(s.date_debut)}` : `du ${fr(s.date_debut)} au ${fr(s.date_fin)}`
    return {
      type: 'session', id: s.id,
      libelle: `Session ${nomCli} · ${fr(s.date_debut)}`,
      prompt: `L'utilisateur est SUR LA FICHE DE LA SESSION ${s.reference || ''} (session_id = ${s.id}) : « ${(s as any).formation?.intitule || 'Formation'} » chez ${nomCli}${s.client_id ? ` (client_id = ${s.client_id})` : ''}, ${dates}, statut ${s.status}, type ${s.type_session}${f ? `, formateur ${f.prenom} ${f.nom}${s.formateur_id ? ` (formateur_id = ${s.formateur_id})` : ''}` : ', AUCUN formateur affecté'}. Quand il dit « cette session », « la convention », « le client », « le formateur », « les stagiaires », il parle de celle-ci : utilise ces identifiants directement, sans rechercher ni redemander.`,
    }
  }

  const clientId = m(new RegExp(`^/dashboard/clients/(${UUID})`))
  if (clientId) {
    const { data: c } = await supabase.from('clients').select('id, raison_sociale, nom_commercial, ville, franchise:franchise_id(nom)')
      .eq('id', clientId).eq('organization_id', orgId).maybeSingle()
    if (!c) return null
    const nom = c.nom_commercial || c.raison_sociale
    return {
      type: 'client', id: c.id, libelle: `Client ${nom}`,
      prompt: `L'utilisateur est SUR LA FICHE DU CLIENT « ${nom} » (client_id = ${c.id}${c.ville ? `, ${c.ville}` : ''}${(c as any).franchise?.nom ? `, franchise ${(c as any).franchise.nom}` : ''}). « Ce client », « lui », « ses sessions », « ses factures » désignent celui-ci : utilise client_id directement.`,
    }
  }

  const apprenantId = m(new RegExp(`^/dashboard/apprenants/(${UUID})`))
  if (apprenantId) {
    const { data: a } = await supabase.from('apprenants').select('id, prenom, nom, email, client:client_id(raison_sociale, nom_commercial)')
      .eq('id', apprenantId).eq('organization_id', orgId).maybeSingle()
    if (!a) return null
    const cli: any = (a as any).client
    return {
      type: 'apprenant', id: a.id, libelle: `Apprenant ${a.prenom} ${a.nom}`,
      prompt: `L'utilisateur est SUR LA FICHE DE L'APPRENANT ${a.prenom} ${a.nom} (apprenant_id = ${a.id}${a.email ? `, ${a.email}` : ', sans email'}${cli ? `, chez ${cli.nom_commercial || cli.raison_sociale}` : ''}). « Ce stagiaire », « lui », « son lien d'émargement » désignent celui-ci.`,
    }
  }

  const factureId = m(new RegExp(`^/dashboard/factures/(${UUID})`))
  if (factureId) {
    const { data: f } = await supabase.from('factures').select('id, numero, status, montant_ttc, montant_restant, financeur_nom, client:client_id(raison_sociale, nom_commercial)')
      .eq('id', factureId).eq('organization_id', orgId).maybeSingle()
    if (!f) return null
    const cli: any = (f as any).client
    return {
      type: 'facture', id: f.id, libelle: `Facture ${f.numero}`,
      prompt: `L'utilisateur est SUR LA FACTURE ${f.numero} (facture_id = ${f.id}) : ${Number(f.montant_ttc || 0).toLocaleString('fr-FR')} € TTC, statut ${f.status}, restant dû ${Number(f.montant_restant ?? f.montant_ttc ?? 0).toLocaleString('fr-FR')} €, débiteur ${cli?.nom_commercial || cli?.raison_sociale || f.financeur_nom || 'inconnu'}. « Cette facture », « la relancer », « le paiement » désignent celle-ci.`,
    }
  }

  const formateurId = m(new RegExp(`^/dashboard/formateurs/(${UUID})`))
  if (formateurId) {
    const { data: f } = await supabase.from('formateurs').select('id, prenom, nom, email').eq('id', formateurId).eq('organization_id', orgId).maybeSingle()
    if (!f) return null
    return {
      type: 'formateur', id: f.id, libelle: `Formateur ${f.prenom} ${f.nom}`,
      prompt: `L'utilisateur est SUR LA FICHE DU FORMATEUR ${f.prenom} ${f.nom} (formateur_id = ${f.id}${f.email ? `, ${f.email}` : ''}). « Ce formateur », « lui », « ses sessions » désignent celui-ci.`,
    }
  }

  const poeiId = m(new RegExp(`^/dashboard/poei/(${UUID})`))
  if (poeiId) {
    const { data: p } = await supabase.from('poei').select('id, numero, session_id, client:client_id(raison_sociale, nom_commercial)').eq('id', poeiId).eq('organization_id', orgId).maybeSingle()
    if (!p) return null
    const cli: any = (p as any).client
    return {
      type: 'poei', id: p.id, libelle: `POEI ${p.numero}`,
      prompt: `L'utilisateur est SUR LE DOSSIER POEI ${p.numero} (poei_id = ${p.id}${p.session_id ? `, session_id = ${p.session_id}` : ''}) de ${cli?.nom_commercial || cli?.raison_sociale || ''}. « Ce dossier », « les candidats » désignent celui-ci.`,
    }
  }

  const franchiseId = m(new RegExp(`^/dashboard/franchises/(${UUID})`))
  if (franchiseId) {
    const { data: f } = await supabase.from('franchises').select('id, nom').eq('id', franchiseId).eq('organization_id', orgId).maybeSingle()
    if (!f) return null
    return { type: 'franchise', id: f.id, libelle: `Franchise ${f.nom}`, prompt: `L'utilisateur est SUR LA FICHE DE LA FRANCHISE ${f.nom} (franchise_id = ${f.id}). « Cette franchise », « ses établissements » désignent celle-ci.` }
  }

  const pages: Record<string, string> = {
    '/dashboard/sessions': 'la liste des sessions', '/dashboard/clients': 'la liste des clients', '/dashboard/factures': 'la liste des factures',
    '/dashboard/apprenants': 'la liste des apprenants', '/dashboard/formateurs': 'la liste des formateurs', '/dashboard/conventions': 'la liste des conventions',
    '/dashboard/poei': 'la liste des dossiers POEI', '/dashboard/agefice': 'les dossiers AGEFICE', '/dashboard/qualiopi': 'l’espace Qualiopi', '/dashboard': 'le tableau de bord',
  }
  const cle = Object.keys(pages).sort((a, b) => b.length - a.length).find((k) => path === k || path.startsWith(k + '/') || path.startsWith(k + '?'))
  if (cle) return { type: 'page', libelle: pages[cle].replace(/^(la |le |les |l’)/, (x) => x.charAt(0).toUpperCase() + x.slice(1)), prompt: `L'utilisateur est sur ${pages[cle]}.` }
  return null
}
