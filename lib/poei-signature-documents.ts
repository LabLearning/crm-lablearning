/**
 * Signature unique des documents de fin de POEI par le stagiaire.
 *
 * Le stagiaire signe une fois, sur une page qui lui dit ce qu'il signe : son
 * certificat de réalisation, son attestation de compétences et son bilan de
 * fin de formation. Sa signature est alors portée sur chacun. Le bilan n'est
 * pas réaffiché sur la page (choix de Lab Learning : il est établi avec le
 * formateur, en présence du stagiaire) ; celui-ci y note sa formation.
 * La signature n'est jamais portée sur un document que la page ne nommait
 * pas : une signature donnée quand elle ne présentait que le certificat ne
 * couvre pas le bilan, qui se signe alors par son propre lien.
 */
import { APPRECIATIONS_STAGIAIRE, CHAMPS_BILAN_FT, SIGNATURE_BILAN, construireBilanFt, lignesBilanFt } from '@/lib/poei-bilan-ft'
import { signatureVide } from '@/lib/signature-image'

export interface BilanPourSignature {
  grilleId: string
  appreciations: Record<string, any>
  lignes: { libelle: string; valeur: string }[]
  avisInitial: string
  noteInitiale: string
  dejaSigne: boolean
}

/** Ce que le stagiaire dit de sa formation en signant : son appréciation et un commentaire libre. */
export interface AvisStagiaire { note: string; avis: string }

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
    noteInitiale: String(a[CHAMPS_BILAN_FT.noteStagiaire] || ''),
    dejaSigne: !!a[SIGNATURE_BILAN.signeLe],
  }
}

interface Trace { data: string; nom: string; ip: string; agent: string }

/** Porte la signature sur le bilan (une seule fois). Renvoie false s'il était déjà signé ou en cas d'erreur. */
export async function signerBilan(supabase: any, bilan: { grilleId: string; appreciations: Record<string, any> }, reponse: AvisStagiaire, t: Trace): Promise<boolean> {
  const note = (APPRECIATIONS_STAGIAIRE as readonly string[]).includes(reponse?.note) ? reponse.note : ''
  const { data, error } = await supabase.from('poei_grilles').update({
    appreciations: {
      ...bilan.appreciations,
      [CHAMPS_BILAN_FT.noteStagiaire]: note,
      [CHAMPS_BILAN_FT.avisStagiaire]: String(reponse?.avis || '').trim().slice(0, 1500),
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

/**
 * Rouvre une signature de certificat enregistrée sans tracé : jusqu'au
 * 07/10/2026, un simple appui dans le cadre suffisait à valider la page, et
 * l'image enregistrée était blanche. Le certificat redevient « à signer »,
 * avec le même lien, valable 60 jours de plus.
 *
 * Ne touche jamais une signature qui porte un tracé, ni une image illisible.
 * L'acte d'origine (date, nom saisi, adresse IP) reste dans le journal.
 */
export async function rouvrirCertificatSiVide(supabase: any, sig: any, userId?: string | null): Promise<boolean> {
  if (!sig?.id || !sig.signed_at || !signatureVide(sig.signature_data)) return false
  const { data, error } = await supabase.from('certificat_signatures').update({
    signed_at: null, signature_data: null, signataire_nom: null, ip_address: null, user_agent: null,
    token_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  }).eq('id', sig.id).eq('signed_at', sig.signed_at).select('id')
  if (error || !data?.length) { if (error) console.error('[signature vide]', error); return false }
  const { error: eJournal } = await supabase.from('audit_logs').insert({
    organization_id: sig.organization_id, user_id: userId || null,
    action: 'signature_vide_rouverte', entity_type: 'certificat_signature', entity_id: sig.id,
    details: {
      poei_id: sig.poei_id, apprenant_id: sig.apprenant_id, role: sig.role || 'candidat',
      motif: 'image de signature sans tracé', validee_le: sig.signed_at,
      nom_saisi: sig.signataire_nom || null, ip: sig.ip_address || null,
    },
  })
  if (eJournal) console.error('[signature vide, journal]', eJournal)
  return true
}
