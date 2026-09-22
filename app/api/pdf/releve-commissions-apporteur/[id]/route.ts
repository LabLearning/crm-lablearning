import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { syncCommissionsApporteur, chargerCommissionsApporteur, nomApporteur, descriptionCommission } from '@/lib/commission-apporteur'
import { ReleveCommissionsApporteurPDF, type LigneReleveApporteur } from '@/lib/pdf/releve-commissions-apporteur-pdf'

/** Rôles internes autorisés à éditer le relevé d'un apporteur. */
const ROLES_INTERNES = ['super_admin', 'admin', 'gestionnaire', 'comptable', 'directeur_commercial']

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Relevé des commissions d'un apporteur d'affaires. Par défaut les
 * commissions à verser ; `?etat=payee` réédite l'historique des versements,
 * `?etat=en_attente` le prévisionnel.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  const orgId = auth.user.organizationId
  const { data: apporteur } = await supabase
    .from('apporteurs_affaires').select('*')
    .eq('id', params.id).eq('organization_id', orgId).maybeSingle()
  if (!apporteur) return NextResponse.json({ error: 'Apporteur introuvable' }, { status: 404 })

  // Un compte apporteur ne lit que son propre relevé.
  if (auth.user.role === 'apporteur_affaires') {
    if (apporteur.user_id !== auth.user.id) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  } else if (!ROLES_INTERNES.includes(auth.user.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const etat = new URL(req.url).searchParams.get('etat') || 'validee'
  if (!['validee', 'payee', 'en_attente'].includes(etat)) {
    return NextResponse.json({ error: 'État inconnu' }, { status: 400 })
  }

  await syncCommissionsApporteur(supabase, orgId, { apporteurId: params.id })
  const toutes = await chargerCommissionsApporteur(supabase, params.id, orgId)
  const retenues = toutes.filter((l) => l.status === etat && Number(l.montant_commission || 0) > 0)
  if (!retenues.length) {
    return NextResponse.json({ error: 'Aucune commission à relever pour cet état' }, { status: 404 })
  }

  const lignes: LigneReleveApporteur[] = retenues.map((l) => ({
    etablissement: l.client?.nom_commercial || l.client?.raison_sociale || l.lead?.entreprise || 'Établissement',
    ville: l.client?.ville || null,
    formation: l.session?.formation?.intitule || l.session?.intitule || (l.libelle || 'Formation').split(' · ')[0],
    reference: l.session?.reference || null,
    dateDebut: l.session?.date_debut || l.date_session || null,
    dateFin: l.session?.date_fin || null,
    base: Number(l.montant_base || 0),
    taux: l.taux_applique != null ? Number(l.taux_applique) : null,
    commission: Number(l.montant_commission || 0),
    datePaiement: etat === 'payee' ? l.date_paiement : null,
    referencePaiement: etat === 'payee' ? l.reference_paiement : null,
  }))

  const enAttente = toutes.filter((l) => l.status === 'en_attente' && Number(l.montant_commission || 0) > 0)
  const enCours = etat === 'validee'
    ? { nombre: enAttente.length, montant: enAttente.reduce((t, l) => t + Number(l.montant_commission || 0), 0) }
    : { nombre: 0, montant: 0 }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const nom = nomApporteur(apporteur)
  const d = new Date()
  const numero = `COM-${slug(nom).toUpperCase().slice(0, 12)}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

  const buffer = await renderToBuffer(
    createElement(ReleveCommissionsApporteurPDF, {
      org,
      apporteur: {
        nom: `${apporteur.prenom || ''} ${apporteur.nom || ''}`.trim() || nom,
        raison_sociale: apporteur.nom_enseigne || apporteur.raison_sociale || null,
        siret: apporteur.siret, adresse: apporteur.adresse, code_postal: apporteur.code_postal, ville: apporteur.ville, email: apporteur.email,
        regle: descriptionCommission(apporteur),
      },
      lignes, numero, etat: etat as 'validee' | 'payee' | 'en_attente', enCours,
    }) as any,
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="releve-commissions-${slug(nom)}-${d.toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
