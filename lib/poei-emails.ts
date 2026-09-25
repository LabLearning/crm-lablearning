/**
 * Emails POEI adressés aux candidats : les textes et le contexte sont
 * construits ICI, une seule fois, pour l'envoi réel ET pour l'aperçu.
 * Un aperçu qui divergerait de ce qui part vraiment ferait pire que pas
 * d'aperçu du tout.
 */
import { blocDocumentsAccueil } from '@/lib/email'

export interface EnveloppeOrg {
  orgName: string
  orgEmail?: string
  orgLogoUrl?: string | null
  qualiopiCertified?: boolean
}

export function enveloppeOrg(org: any, orgRaw: any): EnveloppeOrg {
  return {
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || org?.email,
    orgLogoUrl: (orgRaw as any)?.logo_url, // logo clair : en-tête email sur fond vert
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
  }
}

export interface ContexteMailPoei {
  p: any
  formation: any | null
  employeur: string | null
  org: any
  orgRaw: any
  datesStr: string
  lieuStr: string
  horairesStr: string
  formateurStr: string
  planningStr: string
  fmtFr: (d: string | null) => string
  /** Heures de chaque candidat (par apprenant_id) : celles saisies, sinon la durée du parcours. */
  heuresParApprenant: Map<string, { heures: number; dureeTotale: number }>
}

/** Tout ce dont un email POEI a besoin : projet, formation, employeur, lieu, planning. */
export async function contexteMailPoei(supabase: any, orgId: string, poeiId: string): Promise<ContexteMailPoei | null> {
  const { data: p } = await supabase.from('poei').select('*').eq('id', poeiId).eq('organization_id', orgId).single()
  if (!p) return null

  const { data: formation } = p.formation_id
    ? await supabase.from('formations').select('*').eq('id', p.formation_id).single()
    : { data: null } as any

  let employeur: string | null = null
  let client: any = null
  if (p.client_id) {
    const { data: cl } = await supabase.from('clients').select('raison_sociale, nom_commercial, adresse, code_postal, ville').eq('id', p.client_id).single()
    client = cl
    employeur = cl?.raison_sociale || null
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const fmtFr = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')
  const datesStr = p.date_debut ? `du ${fmtFr(p.date_debut)} au ${fmtFr(p.date_fin || p.date_debut)}` : ''

  // Lieu et planning : ce sont les interventions qui portent l'adresse et les
  // horaires réels, le parcours ne fait que les chapeauter
  const { data: interventions } = await supabase
    .from('poei_interventions')
    .select('libelle, date_debut, date_fin, lieu, adresse, code_postal, ville, horaires, formateur:formateurs(prenom, nom)')
    .eq('poei_id', poeiId)
    .order('date_debut', { ascending: true })

  const adresseDe = (x: any) =>
    [x?.lieu, x?.adresse, [x?.code_postal, x?.ville].filter(Boolean).join(' ')]
      .map((s) => String(s || '').trim()).filter(Boolean).join(', ')

  const premiere = (interventions || []).find((iv: any) => adresseDe(iv))
  let lieuStr = premiere ? adresseDe(premiere) : ''
  let horairesStr = (premiere as any)?.horaires || ''
  let formateurStr = ''
  if (premiere) {
    const f: any = Array.isArray((premiere as any).formateur) ? (premiere as any).formateur[0] : (premiere as any).formateur
    formateurStr = f ? `${f.prenom || ''} ${f.nom || ''}`.trim() : ''
  }

  // Repli sur la session du parcours si aucune intervention n'est renseignée
  if (!lieuStr && p.session_id) {
    const { data: sess } = await supabase.from('sessions').select('lieu, adresse, code_postal, ville, horaires').eq('id', p.session_id).single()
    lieuStr = adresseDe(sess)
    horairesStr = horairesStr || sess?.horaires || ''
  }

  // Dernier repli : l'établissement de l'employeur. Une POEI se déroule sur
  // place, chez lui ; c'est le lieu réel dans l'immense majorité des cas, et
  // c'est la seule adresse toujours renseignée.
  if (!lieuStr && client) {
    lieuStr = adresseDe({
      lieu: client.nom_commercial || client.raison_sociale,
      adresse: client.adresse, code_postal: client.code_postal, ville: client.ville,
    })
  }

  // Planning détaillé : une ligne par période, pour une convocation complète
  const planningStr = (interventions || [])
    .filter((iv: any) => iv.date_debut)
    .map((iv: any) => {
      const f: any = Array.isArray(iv.formateur) ? iv.formateur[0] : iv.formateur
      const periode = iv.date_fin && iv.date_fin !== iv.date_debut
        ? `du ${fmtFr(iv.date_debut)} au ${fmtFr(iv.date_fin)}`
        : `le ${fmtFr(iv.date_debut)}`
      return [
        `• ${iv.libelle} — ${periode}`,
        iv.horaires ? `  Horaires : ${iv.horaires}` : null,
        adresseDe(iv) ? `  Lieu : ${adresseDe(iv)}` : null,
        f ? `  Formateur : ${`${f.prenom || ''} ${f.nom || ''}`.trim()}` : null,
      ].filter(Boolean).join('\n')
    })
    .join('\n\n')

  const { heuresCertificatsPoei } = await import('@/lib/certificat-heures')
  const heuresParApprenant = await heuresCertificatsPoei(supabase, p, formation?.duree_heures)

  return { p, formation, employeur, org, orgRaw, datesStr, lieuStr, horairesStr, formateurStr, planningStr, fmtFr, heuresParApprenant }
}

/** Variables {prenom}, {formation}, {dates}… remplacées pour un destinataire. */
export function remplirVariables(ctx: ContexteMailPoei, a: any, s: string): string {
  return s
    .replace(/\{prenom\}/gi, a?.prenom || '')
    .replace(/\{nom\}/gi, a?.nom || '')
    .replace(/\{formation\}/gi, ctx.formation?.intitule || '')
    .replace(/\{entreprise\}/gi, ctx.employeur || '')
    .replace(/\{dates\}/gi, ctx.datesStr)
    .replace(/\{lieu\}/gi, ctx.lieuStr)
    .replace(/\{duree_heures\}/gi, ctx.p.duree_heures != null ? String(ctx.p.duree_heures) : '')
    // Heures effectuées saisies pour ce candidat (onglet Documents), sinon durée du parcours
    .replace(/\{heures_effectuees\}/gi, (() => {
      const h = a?.id ? ctx.heuresParApprenant?.get(String(a.id)) : null
      const n = h?.heures ?? (ctx.p.duree_heures != null ? Number(ctx.p.duree_heures) : null)
      return n != null ? String(Math.round(n * 100) / 100).replace('.', ',') : ''
    })())
    .replace(/\{date_debut\}/gi, ctx.fmtFr(ctx.p.date_debut))
    .replace(/\{date_fin\}/gi, ctx.fmtFr(ctx.p.date_fin))
    .replace(/\{adresse\}/gi, ctx.lieuStr)
    .replace(/\{horaires\}/gi, ctx.horairesStr)
    .replace(/\{formateur\}/gi, ctx.formateurStr)
    .replace(/\{planning\}/gi, ctx.planningStr)
}

/**
 * Texte saisi → HTML email : paragraphes (ligne vide), retours à la ligne,
 * **gras**. Sans ça, tout le message arriverait en un seul bloc.
 */
export function texteVersHtml(txt: string): string {
  const escaped = txt
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#18181b;">$1</strong>')
  return escaped
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p style="margin:0 0 14px;color:#71717a;font-size:15px;line-height:1.7;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export const nomComplet = (a: any) => `${a?.prenom || ''} ${a?.nom || ''}`.trim()

/** Email « attestation d'entrée en formation » (PDF joint). */
export function paramsAttestationEntree(ctx: ContexteMailPoei, a: any, custom?: { subject?: string; message?: string }) {
  const intitule = ctx.formation?.intitule || ''
  return {
    recipientName: nomComplet(a),
    subject: custom?.subject?.trim() || `Votre attestation d'entrée en formation — ${intitule}`,
    logSubject: custom?.subject?.trim() || `Attestation d'entrée — ${intitule}`,
    docTitle: "Attestation d'entrée en formation",
    // Livret d'accueil + règlement intérieur : remis avant l'entrée en formation
    intro: (custom?.message?.trim() || `Vous trouverez ci-joint votre attestation d'entrée en formation « ${intitule} », à transmettre à France Travail si nécessaire.`)
      + blocDocumentsAccueil(ctx.orgRaw),
    metadata: [
      ['Formation', intitule],
      ['Dates', ctx.p.date_debut ? `Du ${new Date(ctx.p.date_debut).toLocaleDateString('fr-FR')} au ${new Date(ctx.p.date_fin || ctx.p.date_debut).toLocaleDateString('fr-FR')}` : '—'],
    ] as Array<[string, string]>,
    pdfFilename: `attestation-entree-${a?.nom || 'candidat'}.pdf`,
  }
}

/** Email « message libre » (variables remplacées, attestation jointe en option). */
export function paramsMessageLibre(
  ctx: ContexteMailPoei, a: any,
  payload: { subject: string; message: string; joindreAttestation?: boolean },
) {
  const sujet = remplirVariables(ctx, a, payload.subject)
  return {
    recipientName: nomComplet(a),
    subject: sujet,
    docTitle: sujet,
    // Livret d'accueil + règlement intérieur en fin de message (mêmes liens que les convocations)
    intro: texteVersHtml(remplirVariables(ctx, a, payload.message))
      + `<p style="margin:0 0 14px;color:#71717a;font-size:15px;line-height:1.7;">${blocDocumentsAccueil(ctx.orgRaw).replace(/^<br><br>/, '')}</p>`,
    metadata: (ctx.formation ? [
      ['Formation', ctx.formation.intitule],
      ...(ctx.datesStr ? [['Dates', ctx.datesStr] as [string, string]] : []),
    ] : []) as Array<[string, string]>,
    pdfFilename: payload.joindreAttestation && ctx.formation ? `attestation-entree-${a?.nom || 'candidat'}.pdf` : undefined,
  }
}

/** Email « lien de signature du certificat de réalisation ». */
export function paramsCertificatSignature(appr: any, url: string) {
  return {
    recipientName: nomComplet(appr) || 'Madame, Monsieur',
    subject: 'Signature de votre certificat de réalisation',
    docTitle: 'Votre certificat de réalisation',
    intro: "Votre formation est terminée. Merci de signer électroniquement votre certificat de réalisation en cliquant sur le bouton ci-dessous.",
    ctaLabel: 'Signer mon certificat',
    ctaUrl: url,
    footerNote: 'Lien personnel, à ne pas transmettre. Valable 60 jours.',
  }
}

/**
 * Prépare (ou réutilise) le lien de signature du certificat de réalisation
 * d'un candidat POEI. La date portée sur le certificat est TOUJOURS le dernier
 * jour de la POEI, quelle que soit la date réelle de signature.
 */
export async function ensureCertificatSignature(supabase: any, orgId: string, poeiId: string, apprenantId: string, userId: string) {
  const { data: poei } = await supabase
    .from('poei').select('id, date_fin, date_debut, session_id').eq('id', poeiId).eq('organization_id', orgId).single()
  if (!poei) return { error: 'POEI introuvable' }

  const { data: appr } = await supabase
    .from('apprenants').select('id, prenom, nom, email').eq('id', apprenantId).eq('organization_id', orgId).single()
  if (!appr) return { error: 'Candidat introuvable' }

  const { data: existing } = await supabase
    .from('certificat_signatures').select('*')
    .eq('organization_id', orgId).eq('poei_id', poeiId).eq('apprenant_id', apprenantId).maybeSingle()

  const dateSignature = poei.date_fin || poei.date_debut || null
  if (existing) {
    // Réaligne la date affichée si la POEI a changé de date de fin
    if (dateSignature && existing.date_signature !== dateSignature) {
      await supabase.from('certificat_signatures').update({ date_signature: dateSignature }).eq('id', existing.id)
    }
    return { sig: { ...existing, date_signature: dateSignature }, appr, poei }
  }

  const { data: created, error } = await supabase.from('certificat_signatures').insert({
    organization_id: orgId, poei_id: poeiId, session_id: poei.session_id || null,
    apprenant_id: apprenantId, email: appr.email || null,
    date_signature: dateSignature, created_by: userId,
  }).select('*').single()
  if (error) { console.error('[certif sig]', error); return { error: 'Erreur lors de la préparation du lien' } }
  return { sig: created, appr, poei }
}

export const urlSignatureCertificat = (token: string) =>
  `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/certificat/${token}/signer`
