'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

/** Lectures permises par formateur sur 24 heures glissantes : chacune est un appel à l'IA payé par l'organisme. */
// Large : un formateur qui rattrape plusieurs sessions le même jour ne doit pas être bloqué
const LECTURES_PAR_JOUR = 80
/** Photos acceptées : celles que la grille envoie (JPEG compressé à 1600 px) et leurs équivalents. */
const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp']
/** Une photo de fiche compressée pèse quelques centaines de Ko : au-delà de ~2 Mo, ce n'en est pas une. */
const PHOTO_BASE64_MAX = 3_000_000
const ACTION_JOURNAL = 'lecture_ia_fiches'

/**
 * Compte la lecture dans le journal (audit_logs) AVANT l'appel à l'IA, puis
 * vérifie le plafond : la ligne est écrite d'abord, pour que des appels lancés
 * en parallèle ne passent pas tous. Renvoie le motif du refus (la ligne est
 * alors retirée), ou null si la lecture est permise.
 */
async function reserverLecture(supabase: any, orgId: string, formateurId: string, details: Record<string, unknown>): Promise<string | null> {
  const indisponible = 'La lecture IA est momentanément indisponible — remplissez la grille à la main.'
  const { data: fiche } = await supabase.from('formateurs').select('user_id').eq('id', formateurId).maybeSingle()
  const { data: ligne, error } = await supabase.from('audit_logs').insert({
    organization_id: orgId,
    user_id: fiche?.user_id || null,
    action: ACTION_JOURNAL,
    entity_type: 'formateur',
    entity_id: formateurId,
    details,
  }).select('id').single()
  if (error || !ligne) return indisponible
  const { count, error: erreurCompte } = await supabase.from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'formateur').eq('entity_id', formateurId).eq('action', ACTION_JOURNAL)
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  if (!erreurCompte && (count || 0) <= LECTURES_PAR_JOUR) return null
  await supabase.from('audit_logs').delete().eq('id', ligne.id)
  return erreurCompte
    ? indisponible
    : `Vous avez atteint la limite de ${LECTURES_PAR_JOUR} lectures IA sur 24 heures : remplissez la grille à la main, ou réessayez demain.`
}

/**
 * Lecture IA des fiches papier : le formateur photographie les questionnaires
 * remplis, Claude lit le nom du stagiaire et les réponses, et la grille se
 * préremplit — le formateur VÉRIFIE puis enregistre. L'IA propose, l'humain
 * valide : rien ne s'écrit en base ici.
 */
export async function lireFichesAction(
  token: string,
  sessionId: string,
  qcmId: string,
  images: { base64: string; mediaType: string }[],
): Promise<{ success: boolean; error?: string; resultats?: Record<string, Record<string, string>>; nonReconnus?: string[] }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') return { success: false, error: 'Accès non autorisé' }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: "Lecture IA non configurée (clé API manquante) — remplissez la grille à la main." }
  }
  if (!Array.isArray(images) || !images.length || images.length > 6) return { success: false, error: '1 à 6 photos par lecture.' }
  // Le type et le contenu partent tels quels à l'IA : seulement des photos, de taille raisonnable
  for (const img of images) {
    if (!img || typeof img.base64 !== 'string' || !img.base64 || !TYPES_PHOTO.includes(img.mediaType)) {
      return { success: false, error: 'Format de photo non pris en charge (JPEG, PNG ou WebP).' }
    }
    if (img.base64.length > PHOTO_BASE64_MAX) return { success: false, error: 'Photo trop lourde : reprenez-la ou réduisez sa taille.' }
  }

  const formateurId = (context as any).formateur.id as string
  const supabase = await createServiceRoleClient()
  const [{ data: sess }, { data: lien }] = await Promise.all([
    supabase.from('sessions').select('id').eq('id', sessionId).eq('formateur_id', formateurId).maybeSingle(),
    // Le questionnaire doit être rattaché à la session, comme ceux que la grille propose
    supabase.from('qcm_sessions').select('id').eq('session_id', sessionId).eq('qcm_id', qcmId).limit(1).maybeSingle(),
  ])
  if (!sess) return { success: false, error: 'Session introuvable' }
  if (!lien) return { success: false, error: 'Questionnaire introuvable pour cette session' }

  // Structure du questionnaire + stagiaires attendus.
  const [{ data: questions }, { data: inscrits }] = await Promise.all([
    supabase.from('qcm_questions')
      .select('id, texte, type, position, choix:qcm_choix(id, texte, position)')
      .eq('qcm_id', qcmId).order('position', { ascending: true }),
    supabase.from('inscriptions')
      .select('apprenant:apprenant_id(id, prenom, nom)').eq('session_id', sessionId),
  ])
  if (!questions?.length) return { success: false, error: 'Questionnaire sans questions' }

  // Plafond journalier, juste avant l'appel payant
  const refus = await reserverLecture(supabase, (context as any).organization.id, formateurId, {
    session_id: sessionId, qcm_id: qcmId, photos: images.length,
  })
  if (refus) return { success: false, error: refus }

  const LETTRES = 'ABCDEFGHIJ'
  const stagiaires = (inscrits || []).map((i: any) => i.apprenant).filter(Boolean)
  const descQuestions = (questions as any[]).map((q, i) => {
    if ((q.choix || []).length) {
      const opts = (q.choix as any[]).sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((c, j) => `${LETTRES[j]}) ${c.texte}`).join(' | ')
      return `${i + 1}. [choix] ${q.texte} — options : ${opts}`
    }
    if (q.type === 'texte_libre') return `${i + 1}. [texte libre] ${q.texte}`
    const plafond = q.type === 'note_1_10' || q.type === 'nps' ? 10 : 5
    return `${i + 1}. [note 1-${plafond}] ${q.texte}`
  }).join('\n')

  const prompt = `Voici ${images.length} photo(s) de questionnaires de formation remplis à la main.

Le questionnaire comporte ces questions :
${descQuestions}

Les stagiaires possibles (nom exact à rapprocher de ce qui est écrit sur la fiche) :
${stagiaires.map((s: any) => `- ${s.prenom} ${s.nom}`).join('\n')}

Pour CHAQUE fiche lisible, identifie le stagiaire et ses réponses. Réponds UNIQUEMENT avec un JSON de cette forme, sans autre texte :
{"fiches":[{"stagiaire":"Prénom Nom (exactement comme dans la liste)","reponses":{"1":"B","2":"4","3":"texte recopié"}}],"non_reconnus":["description des fiches illisibles ou stagiaires hors liste"]}

Règles : pour une question [choix], donne la LETTRE cochée (ou "" si rien de coché). Pour une [note], le chiffre entouré/coché. Pour un [texte libre], recopie le texte manuscrit tel quel. Ne devine jamais : en cas de doute sur une réponse, mets "".`

  const contenu: any[] = [{ type: 'text', text: prompt }]
  for (const img of images) {
    contenu.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } })
  }

  let brut = ''
  try {
    const rep = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: contenu }],
      }),
    })
    if (!rep.ok) {
      const detail = await rep.text()
      console.error('[lecture fiches]', rep.status, detail.slice(0, 300))
      return { success: false, error: rep.status === 401 ? 'Clé API invalide' : 'La lecture a échoué — réessayez ou remplissez à la main.' }
    }
    const json = await rep.json()
    brut = (json.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  } catch (e) {
    console.error('[lecture fiches]', e)
    return { success: false, error: 'La lecture a échoué — réessayez ou remplissez à la main.' }
  }

  let extrait: any
  try {
    extrait = JSON.parse(brut.slice(brut.indexOf('{'), brut.lastIndexOf('}') + 1))
  } catch {
    return { success: false, error: "Lecture illisible — réessayez avec une photo plus nette." }
  }

  // Lettres -> ids de choix, rapprochement des noms.
  const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim()
  const parNom = new Map(stagiaires.map((s: any) => [norm(`${s.prenom} ${s.nom}`), s.id]))
  const resultats: Record<string, Record<string, string>> = {}
  // Le formulaire n'en montre que 180 caractères : ce qui repart vers le
  // navigateur reste borné, l'action ne doit pas servir de relais vers l'IA
  const nonReconnus: string[] = (Array.isArray(extrait.non_reconnus) ? extrait.non_reconnus : [])
    .slice(0, 10).map((n: unknown) => String(n ?? '').slice(0, 150))

  for (const fiche of extrait.fiches || []) {
    const apprenantId = parNom.get(norm(String(fiche.stagiaire || '')))
      || [...parNom.entries()].find(([n]) => n.includes(norm(String(fiche.stagiaire || ''))) || norm(String(fiche.stagiaire || '')).includes(n))?.[1]
    if (!apprenantId) { nonReconnus.push(String(fiche.stagiaire || 'fiche sans nom').slice(0, 150)); continue }
    const reponses: Record<string, string> = {}
    ;(questions as any[]).forEach((q, i) => {
      const v = String(fiche.reponses?.[String(i + 1)] ?? '').trim()
      if (!v) return
      if ((q.choix || []).length) {
        const idx = LETTRES.indexOf(v.toUpperCase().charAt(0))
        const choix = (q.choix as any[]).sort((a, b) => (a.position || 0) - (b.position || 0))[idx]
        if (choix) reponses[q.id] = choix.id
      } else if (q.type === 'texte_libre') {
        reponses[q.id] = v
      } else {
        const n = parseInt(v, 10)
        if (!Number.isNaN(n)) reponses[q.id] = String(n)
      }
    })
    if (Object.keys(reponses).length) resultats[apprenantId] = reponses
  }

  if (!Object.keys(resultats).length) {
    return { success: false, error: nonReconnus.length ? `Aucune fiche rapprochée (${nonReconnus.join(' ; ').slice(0, 150)})` : 'Aucune réponse lue sur ces photos.' }
  }
  return { success: true, resultats, nonReconnus }
}
