/**
 * Convocations automatiques des candidats POEI : à J-3, la convocation
 * complète ; à J-1, un rappel. Un candidat ajouté tard (sans convocation à
 * J-1) reçoit directement la convocation complète.
 *
 * Chaque candidat est convoqué à SA date d'entrée (entrée décalée comprise),
 * avec le lieu et les horaires de l'intervention qui couvre ce jour-là.
 * Idempotent : un envoi réussi ou en cours (email_logs, entité poei, modèle
 * ci-dessous, même adresse) n'est jamais refait ; un échec est retenté au
 * passage suivant du cron.
 */

import { isPlaceholderEmail } from '@/lib/utils'

export const TEMPLATE_CONVOCATION_POEI = 'convocation_poei'
export const TEMPLATE_RAPPEL_POEI = 'convocation_poei_rappel'

export interface BilanConvocationsPoei {
  parcours: number
  convocations: number
  rappels: number
  sansEmail: string[]
  apercu: { poei: string; candidat: string; email: string | null; entree: string; envoi: 'convocation' | 'rappel' }[]
}

/** Date du jour à Paris, « AAAA-MM-JJ ». */
const jourParis = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const ecart = (de: string, a: string) =>
  Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86400000)
const dateLongue = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
const adresseDe = (x: any) => [x?.lieu, x?.adresse, [x?.code_postal, x?.ville].filter(Boolean).join(' ')]
  .map((s) => String(s || '').trim()).filter(Boolean).join(', ')

export async function envoyerConvocationsPoei(
  supabase: any,
  opts: { apercu?: boolean; maintenant?: Date } = {},
): Promise<BilanConvocationsPoei> {
  const bilan: BilanConvocationsPoei = { parcours: 0, convocations: 0, rappels: 0, sansEmail: [], apercu: [] }
  const auj = jourParis(opts.maintenant || new Date())

  // Parcours en cours ou à venir (une entrée décalée peut tomber après le début du parcours)
  const { data: parcours, error } = await supabase.from('poei')
    .select('id, organization_id, numero, date_debut, date_fin, statut, client:client_id(raison_sociale, nom_commercial)')
    .not('date_debut', 'is', null)
    .or(`date_fin.is.null,date_fin.gte.${auj}`)
    .not('statut', 'in', '("terminee","refuse","abandonne","embauche")')
  if (error) throw error

  const { sendDocumentEmail } = await import('@/lib/email')
  const { contexteMailPoei, enveloppeOrg, nomComplet } = await import('@/lib/poei-emails')

  for (const p of (parcours || []) as any[]) {
    const { data: candidats } = await supabase.from('poei_candidats')
      .select('id, statut, date_debut, apprenant:apprenants(id, civilite, prenom, nom, email)')
      .eq('poei_id', p.id)
      .not('statut', 'in', '("abandonne","refuse")')
    // Qui doit recevoir quoi aujourd'hui ?
    const cibles = ((candidats || []) as any[]).map((c) => {
      const entree = c.date_debut || p.date_debut
      const j = entree ? ecart(auj, entree) : -1
      return { c, entree, j }
    }).filter((x) => x.j >= 1 && x.j <= 3)
    if (!cibles.length) continue
    bilan.parcours++

    // Déjà envoyé (ou en cours) pour ce parcours
    const { data: logs } = await supabase.from('email_logs')
      .select('to_email, template, status')
      .eq('entity_type', 'poei').eq('entity_id', p.id)
      .in('template', [TEMPLATE_CONVOCATION_POEI, TEMPLATE_RAPPEL_POEI])
      .neq('status', 'failed')
    const deja = new Set(((logs || []) as any[]).map((l) => `${l.template}|${String(l.to_email || '').toLowerCase()}`))

    const ctx = await contexteMailPoei(supabase, p.organization_id, p.id)
    if (!ctx) continue
    const intitule = ctx.formation?.intitule || p.numero || 'votre formation'
    const { data: interventions } = await supabase.from('poei_interventions')
      .select('libelle, date_debut, date_fin, lieu, adresse, code_postal, ville, horaires, formateur:formateurs(prenom, nom)')
      .eq('poei_id', p.id).order('date_debut', { ascending: true })

    for (const { c, entree, j } of cibles) {
      const a = c.apprenant
      const nom = nomComplet(a) || 'Candidat'
      // Adresse factice (import, fiche incomplète) : pas de convocation, le candidat est signalé
      const brut = String(a?.email || '').trim().toLowerCase()
      const email = brut && !isPlaceholderEmail(brut) ? brut : ''
      const convoque = deja.has(`${TEMPLATE_CONVOCATION_POEI}|${email}`)
      // J-3 et J-2 : convocation ; J-1 : rappel, ou convocation si elle n'est jamais partie
      const envoi: 'convocation' | 'rappel' | null = j >= 2 ? (convoque ? null : 'convocation')
        : convoque ? (deja.has(`${TEMPLATE_RAPPEL_POEI}|${email}`) ? null : 'rappel') : 'convocation'
      if (!envoi) continue
      if (!email) { bilan.sansEmail.push(`${p.numero || p.id} : ${nom}`); continue }
      if (opts.apercu) { bilan.apercu.push({ poei: p.numero || p.id, candidat: nom, email, entree, envoi }); continue }

      const params = await parametresConvocationPoei(ctx, interventions || [], entree, envoi)
      const r = await sendDocumentEmail({
        to: email,
        ...enveloppeOrg(ctx.org, ctx.orgRaw),
        recipientName: nom,
        ...params,
        organizationId: p.organization_id,
        entityType: 'poei',
        entityId: p.id,
      })
      if (r.success) {
        if (envoi === 'convocation') { bilan.convocations++; deja.add(`${TEMPLATE_CONVOCATION_POEI}|${email}`) }
        else { bilan.rappels++; deja.add(`${TEMPLATE_RAPPEL_POEI}|${email}`) }
      }
    }
  }
  return bilan
}

/**
 * Textes de la convocation (J-3) ou du rappel (J-1) d'un candidat, entré le
 * jour « entree » : lieu, horaires et formateur de l'intervention qui couvre
 * ce jour-là, sinon ceux de la première intervention.
 */
export async function parametresConvocationPoei(ctx: any, interventions: any[], entree: string, envoi: 'convocation' | 'rappel') {
  const { blocDocumentsAccueil } = await import('@/lib/email')
  const intitule = ctx.formation?.intitule || ctx.p?.numero || 'votre formation'
      // Intervention qui couvre le jour d'entrée, sinon la première
      const iv = (interventions as any[]).find((x) => x.date_debut && x.date_debut <= entree && (x.date_fin || x.date_debut) >= entree)
        || (interventions as any[])[0] || null
      const f: any = iv ? (Array.isArray(iv.formateur) ? iv.formateur[0] : iv.formateur) : null
      const lieu = (iv && adresseDe(iv)) || ctx.lieuStr || 'Communiqué par votre conseiller'
      const horaires = iv?.horaires || ctx.horairesStr || null
      const formateur = f ? `${f.prenom || ''} ${f.nom || ''}`.trim() : (ctx.formateurStr || null)
      const metadata: Array<[string, string]> = [
        ['Formation', intitule],
        ['Premier jour', dateLongue(entree)],
        ...(horaires ? [['Horaires', String(horaires)] as [string, string]] : []),
        ['Lieu', lieu],
        ...(formateur ? [['Formateur', formateur] as [string, string]] : []),
        ...(ctx.employeur ? [['Entreprise', ctx.employeur] as [string, string]] : []),
      ]

  const pied = 'En cas d’empêchement, prévenez-nous au plus vite en répondant à ce mail.'
  return envoi === 'convocation'
    ? {
        subject: `Convocation : votre formation ${intitule} commence le ${dateLongue(entree)}`,
        docTitle: 'Votre convocation en formation',
        intro: `Nous avons le plaisir de vous convoquer à votre formation « ${intitule} ». Vous trouverez ci-dessous toutes les informations pratiques pour votre premier jour.`
          + (ctx.planningStr ? `<br><br><strong>Votre planning</strong><br>${ctx.planningStr.replace(/ — /g, ' : ').replace(/\n/g, '<br>')}` : '')
          + blocDocumentsAccueil(ctx.orgRaw as any),
        metadata,
        footerNote: pied,
        templateSlug: TEMPLATE_CONVOCATION_POEI,
      }
    : {
        subject: 'Rappel : votre formation commence demain',
        docTitle: 'Votre formation commence demain',
        intro: `Petit rappel : votre formation « ${intitule} » commence demain, ${dateLongue(entree)}. Pensez à arriver quelques minutes en avance.`,
        metadata,
        footerNote: pied,
        templateSlug: TEMPLATE_RAPPEL_POEI,
      }
}
