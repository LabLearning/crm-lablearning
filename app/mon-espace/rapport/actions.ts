'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import type { CompteRendu } from '@/lib/compte-rendu'

/**
 * Compte rendu de formation du formateur (espace connecté) : brouillon
 * enregistrable, puis transmission au gestionnaire. Le compte rendu transmis
 * apparaît dans l'onglet Bilan de la session et notifie l'équipe.
 */
export async function enregistrerCompteRenduAction(
  sessionId: string,
  saisie: CompteRendu,
  transmettre: boolean,
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: formateur } = await supabase.from('formateurs')
    .select('id, prenom, nom').eq('user_id', session.user.id).single()
  if (!formateur) return { success: false, error: 'Fiche formateur introuvable' }

  // La session doit être à ce formateur.
  const { data: sess } = await supabase.from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, formation_id, formation:formation_id(intitule)')
    .eq('id', sessionId).eq('formateur_id', formateur.id)
    .eq('organization_id', session.organization.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  // Un compte rendu déjà transmis ne se réécrit pas depuis l'espace formateur.
  const { data: existant } = await supabase.from('rapports_session')
    .select('id, status').eq('session_id', sessionId).eq('formateur_id', formateur.id).maybeSingle()
  if (existant?.status === 'soumis' || existant?.status === 'valide') {
    return { success: false, error: 'Ce compte rendu a déjà été transmis.' }
  }

  // La saisie est recalée sur la session (demi-journées, objectifs, stagiaires)
  // et chaque texte est borné : rien d'autre n'est enregistré
  const { compteRenduSession } = await import('@/lib/compte-rendu-data')
  const { manquesCompteRendu, syntheseTexte, METHODES, MODALITES_EVALUATION, NIVEAUX_GROUPE, PARTICIPATIONS, SALLES } = await import('@/lib/compte-rendu')
  const t = (v: unknown, max = 4000) => String(v ?? '').slice(0, max)
  const dans = (v: unknown, liste: string[]) => (liste.includes(String(v)) ? String(v) : '')
  // Seules les demi-journées, objectifs de la fiche et stagiaires de la session
  // sont repris par la fusion ; les objectifs ajoutés par le formateur aussi
  const cr = await compteRenduSession(supabase, sess as any, {
    version: 1,
    deroule: (saisie?.deroule || []).slice(0, 400).map((d) => ({
      date: t(d.date, 10), creneau: d.creneau === 'apres_midi' ? 'apres_midi' : 'matin',
      contenu: t(d.contenu), methodes: (d.methodes || []).filter((m) => METHODES.includes(m)),
      ...(d.statut === 'autre_formateur' || d.statut === 'non_realisee' ? { statut: d.statut } : {}),
    })),
    objectifs: (saisie?.objectifs || []).slice(0, 60).map((o) => ({
      objectif: t(o.objectif, 500),
      niveau: ['atteint', 'partiel', 'non_atteint'].includes(o.niveau) ? o.niveau : '',
      commentaire: t(o.commentaire, 1000),
      ...(o.perso ? { perso: true } : {}),
    })),
    groupe: {
      niveau: dans(saisie?.groupe?.niveau, NIVEAUX_GROUPE), participation: dans(saisie?.groupe?.participation, PARTICIPATIONS),
      dynamique: t(saisie?.groupe?.dynamique), assiduite: t(saisie?.groupe?.assiduite),
    },
    evaluation: {
      modalites: (saisie?.evaluation?.modalites || []).filter((m) => MODALITES_EVALUATION.includes(m)),
      synthese: t(saisie?.evaluation?.synthese),
    },
    stagiaires: (saisie?.stagiaires || []).slice(0, 200).map((s) => ({
      apprenant_id: t(s.apprenant_id, 40), nom: t(s.nom, 200),
      acquis: ['acquis', 'en_cours', 'non_acquis'].includes(s.acquis) ? s.acquis : '',
      commentaire: t(s.commentaire, 1000),
    })),
    conditions: { salle: dans(saisie?.conditions?.salle, SALLES), commentaire: t(saisie?.conditions?.commentaire), difficultes: t(saisie?.conditions?.difficultes) },
    bilan: {
      points_positifs: t(saisie?.bilan?.points_positifs), retours_stagiaires: t(saisie?.bilan?.retours_stagiaires),
      besoins_detectes: t(saisie?.bilan?.besoins_detectes), recommandations: t(saisie?.bilan?.recommandations),
      commentaires: t(saisie?.bilan?.commentaires),
    },
  } as any)

  // Transmission incomplète : la saisie est quand même gardée en brouillon
  const manques = transmettre ? manquesCompteRendu(cr) : []
  const transmis = transmettre && !manques.length

  const synthese = syntheseTexte(cr)
  const donnees = {
    organization_id: session.organization.id,
    session_id: sessionId,
    formateur_id: formateur.id,
    ...synthese,
    status: transmis ? 'soumis' : 'brouillon',
    submitted_at: transmis ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  const ecrire = (d: Record<string, unknown>) => existant
    ? supabase.from('rapports_session').update(d).eq('id', existant.id)
    : supabase.from('rapports_session').insert(d)

  let { error } = await ecrire({ ...donnees, compte_rendu: cr })
  // Migration 162 pas encore appliquée : le détail complet est rangé dans la
  // colonne JSON existante, d'où la page le relit (compteRenduStocke)
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    ({ error } = await ecrire({ ...donnees, commentaires_apprenants: { compte_rendu: cr, stagiaires: synthese.commentaires_apprenants } }))
  }
  if (error) { console.error('[compte rendu]', error.message); return { success: false, error: 'Enregistrement impossible' } }

  if (manques.length) {
    revalidatePath(`/mon-espace/rapport/${sessionId}`)
    return { success: false, error: `Brouillon enregistré. Avant de transmettre, complétez : ${manques.join(', ')}.`, data: { manques } }
  }

  if (transmis) {
    // Notifier les gestionnaires : le compte rendu est arrivé.
    const { createNotifications } = await import('@/lib/email')
    const { data: equipe } = await supabase.from('users')
      .select('id').eq('organization_id', session.organization.id)
      .in('role', ['super_admin', 'gestionnaire'])
    const intitule = (sess as any).formation?.intitule || (sess as any).intitule || (sess as any).reference || 'la session'
    await createNotifications((equipe || []).map((u: any) => ({
      organizationId: session.organization.id,
      userId: u.id,
      titre: 'Compte rendu de formation transmis',
      message: `${formateur.prenom} ${formateur.nom} a transmis son compte rendu pour « ${intitule} »${(sess as any).reference ? ` (${(sess as any).reference})` : ''}.`,
      type: 'info',
      lienUrl: `/dashboard/sessions/${sessionId}?tab=rapport`,
      lienLabel: 'Voir la session',
      entityType: 'session',
      entityId: sessionId,
    })))
  }

  revalidatePath('/mon-espace/sessions')
  revalidatePath(`/mon-espace/rapport/${sessionId}`)
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}
