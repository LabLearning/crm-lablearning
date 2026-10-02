/**
 * Signature unique des documents de fin de POEI par le stagiaire.
 *
 * Le stagiaire signe une fois, sur une page qui lui montre tout ce qu'il
 * signe : son certificat de réalisation, son attestation de compétences et
 * son bilan de fin de formation. Sa signature est alors portée sur chacun.
 * Elle n'est jamais portée sur un document qui ne lui a pas été montré : une
 * signature donnée quand la page ne présentait que le certificat ne couvre
 * pas le bilan, qui se signe alors par son propre lien.
 */
import { CHAMPS_BILAN_FT, SIGNATURE_BILAN, construireBilanFt, lignesBilanFt } from '@/lib/poei-bilan-ft'

export interface BilanPourSignature {
  grilleId: string
  appreciations: Record<string, any>
  lignes: { libelle: string; valeur: string }[]
  avisInitial: string
  dejaSigne: boolean
}

/** Bilan final d'un candidat, tel qu'il lui est montré avant signature (null s'il n'est pas encore rempli). */
export async function bilanPourSignature(supabase: any, orgId: string, poeiId: string, apprenantId: string): Promise<BilanPourSignature | null> {
  const { data: g } = await supabase.from('poei_grilles')
    .select('id, items, appreciations, avis_final, motivation_avis, apprenant:apprenants(prenom, nom), formateur:formateurs(prenom, nom)')
    .eq('organization_id', orgId).eq('poei_id', poeiId).eq('apprenant_id', apprenantId).is('semaine', null).maybeSingle()
  if (!g) return null

  const [{ data: org }, { data: poei }, { data: candidat }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('poei')
      .select('id, numero, poste_vise, date_debut, date_fin, duree_heures, formation:formation_id(intitule, duree_heures, est_certifiante)')
      .eq('id', poeiId).eq('organization_id', orgId).single(),
    supabase.from('poei_candidats')
      .select('apprenant_id, statut, date_abandon, motif_abandon, identifiant_ft, poste_vise, type_contrat, date_debut, date_fin, date_embauche_prevue')
      .eq('poei_id', poeiId).eq('apprenant_id', apprenantId).maybeSingle(),
  ])
  if (!org || !poei) return null

  const { heuresCertificatsPoei } = await import('@/lib/certificat-heures')
  const h = (await heuresCertificatsPoei(supabase, poei as any, (poei as any).formation?.duree_heures)).get(String(apprenantId))
  const bilan = construireBilanFt({
    org, poei, candidat, apprenant: (g as any).apprenant,
    formateurNom: (g as any).formateur ? `${(g as any).formateur.prenom || ''} ${(g as any).formateur.nom || ''}`.trim() : null,
    heuresReelles: h?.heures ?? null, heuresPrevues: h?.dureeTotale ?? null,
    grille: g, aujourdhui: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }),
  })
  const a: Record<string, any> = (g as any).appreciations || {}
  return {
    grilleId: (g as any).id,
    appreciations: a,
    lignes: lignesBilanFt(bilan),
    avisInitial: String(a[CHAMPS_BILAN_FT.avisStagiaire] || ''),
    dejaSigne: !!a[SIGNATURE_BILAN.signeLe],
  }
}

interface Trace { data: string; nom: string; ip: string; agent: string }

/** Porte la signature sur le bilan (une seule fois). Renvoie false s'il était déjà signé ou en cas d'erreur. */
export async function signerBilan(supabase: any, bilan: { grilleId: string; appreciations: Record<string, any> }, avis: string, t: Trace): Promise<boolean> {
  const { data, error } = await supabase.from('poei_grilles').update({
    appreciations: {
      ...bilan.appreciations,
      [CHAMPS_BILAN_FT.avisStagiaire]: String(avis || '').trim().slice(0, 1500),
      [SIGNATURE_BILAN.data]: t.data,
      [SIGNATURE_BILAN.nom]: t.nom,
      [SIGNATURE_BILAN.signeLe]: new Date().toISOString(),
      [SIGNATURE_BILAN.ip]: t.ip,
      [SIGNATURE_BILAN.agent]: t.agent,
    },
  }).eq('id', bilan.grilleId).is(`appreciations->>${SIGNATURE_BILAN.signeLe}`, null).select('id')
  if (error) { console.error('[signature bilan]', error); return false }
  return !!data?.length
}

/**
 * Porte la signature sur le certificat de réalisation du candidat s'il n'est
 * pas encore signé (même ligne que le circuit du certificat, créée au besoin).
 */
export async function signerCertificatSiBesoin(supabase: any, orgId: string, poeiId: string, apprenantId: string, t: Trace): Promise<void> {
  const [{ data: existante }, { data: poei }, { data: appr }] = await Promise.all([
    supabase.from('certificat_signatures').select('id, signed_at, date_signature')
      .eq('organization_id', orgId).eq('poei_id', poeiId).eq('apprenant_id', apprenantId).maybeSingle(),
    supabase.from('poei').select('date_fin, date_debut, session_id').eq('id', poeiId).eq('organization_id', orgId).maybeSingle(),
    supabase.from('apprenants').select('email').eq('id', apprenantId).eq('organization_id', orgId).maybeSingle(),
  ])
  if (existante?.signed_at) return
  const champs = {
    signed_at: new Date().toISOString(),
    date_signature: existante?.date_signature || poei?.date_fin || poei?.date_debut || null,
    signature_data: t.data,
    signataire_nom: t.nom,
    ip_address: t.ip || null,
    user_agent: t.agent || null,
  }
  const { error } = existante
    ? await supabase.from('certificat_signatures').update(champs).eq('id', existante.id).is('signed_at', null)
    : await supabase.from('certificat_signatures').insert({
        organization_id: orgId, poei_id: poeiId, session_id: poei?.session_id || null,
        apprenant_id: apprenantId, email: appr?.email || null, ...champs,
      })
  if (error) console.error('[signature certificat depuis le bilan]', error)
}
