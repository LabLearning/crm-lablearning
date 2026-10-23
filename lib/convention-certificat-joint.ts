/**
 * Convention signée suivie de son certificat de signature électronique (demande
 * de Brahim du 21/10/2026) : le certificat se place juste après la convention,
 * avant son annexe, le programme (demande du 23/10/2026 ; il était jusque-là la
 * dernière page). C'est le certificat de la route
 * /api/pdf/preuve-signature/convention/[id], à l'identique : il décrit la
 * signature et l'exemplaire signé archivé, jamais la date portée.
 *
 * Il n'accompagne pas une convention modifiée depuis sa signature sans qu'elle
 * le dise (prix corrigé, programme repris, session déplacée, avenant retiré) :
 * collé derrière la version à jour, il la présenterait comme celle que le
 * client a signée. Un avenant de contenu (stagiaires, durée…) est mentionné sur
 * la convention elle-même : le certificat peut alors la suivre.
 *
 * Chaque certificat joint se journalise, comme un tirage du certificat seul
 * (il porte l'adresse IP et la signature du client).
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { PDFDocument } from 'pdf-lib'
import { CERTIFICAT_SIGNATURE_CONVENTION } from '@/lib/fonctionnalites'
import { construirePreuveSignatureConvention } from '@/lib/certificat-signature-convention'
import { CertificatSignatureConventionPDF, type PreuveSignatureConvention } from '@/lib/pdf/certificat-signature-convention-pdf'

/** Pourquoi le certificat ne suit pas la convention. */
export type RaisonSansCertificat =
  /** interrupteur du certificat coupé */
  | 'desactive'
  /** pas de signature électronique du client, ou tracé illisible : le certificat seul est refusé aussi */
  | 'non_delivre'
  /** contenu changé depuis la signature sans que la convention le dise */
  | 'modifiee'
  /** l'exemplaire archivé ne correspond plus à son empreinte */
  | 'archive_alteree'
  /** panne passagère (stockage, base, rendu) : il suffit de réessayer */
  | 'indisponible'
  /** compte sans les droits du module Conventions */
  | 'droits'

export type CertificatJoint =
  | { ok: true; pdf: Uint8Array; numero: string | null; empreinte: string }
  | { ok: false; raison: RaisonSansCertificat }

const LIBELLES_PRIX = new Set(['Montant', 'Montant HT', 'Montant TTC', 'Taux de TVA'])

/**
 * Modifications postérieures à la signature que la convention régénérée ne
 * mentionne pas : tout ce qui n'est pas porté par un avenant de contenu (le
 * PDF ne cite ni les avenants de prix ni les avenants retirés).
 */
export function modificationsNonMentionnees(preuve: PreuveSignatureConvention): string[] {
  return preuve.apresSignature
    .filter((e) => !e.avenant || !!e.note || LIBELLES_PRIX.has(e.libelle))
    .map((e) => e.libelle)
}

/**
 * Page où commence l'annexe de la convention : la première après la page 1
 * dont l'en-tête est « Annexe — Programme de formation ». Introuvable, ou
 * texte illisible : null, le certificat va alors en fin de document.
 */
export async function debutAnnexe(conventionPdf: Uint8Array): Promise<number | null> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    // Une copie : la lecture peut détacher la mémoire du tableau qu'on lui passe
    const doc = await getDocumentProxy(new Uint8Array(conventionPdf))
    const { text } = await extractText(doc, { mergePages: false })
    const pages = (Array.isArray(text) ? text : [text]).map((t) => String(t || '').replace(/\s+/g, ' '))
    const i = pages.findIndex((t, n) => n > 0 && /Annexe\s*[—–-]\s*Programme de formation/i.test(t))
    return i > 0 ? i : null
  } catch (e) {
    console.error('[annexe de la convention]', e)
    return null
  }
}

export async function joindreCertificatSignature(
  supabase: any,
  orgId: string,
  conventionId: string,
  conventionPdf: Uint8Array,
): Promise<CertificatJoint> {
  if (!CERTIFICAT_SIGNATURE_CONVENTION) return { ok: false, raison: 'desactive' }
  try {
    const dossier = await construirePreuveSignatureConvention(supabase, orgId, conventionId)
    if (!dossier.ok) return { ok: false, raison: 'non_delivre' }
    const exemplaire = dossier.preuve.document.exemplaire
    // Archive illisible au moment du tirage : le plus souvent une panne du stockage
    if (exemplaire.etat === 'fige' && exemplaire.introuvable) return { ok: false, raison: 'indisponible' }
    // Le certificat dirait « à vérifier » : l'équipe le retrouve seul, avec son alerte
    if (exemplaire.etat === 'fige' && exemplaire.verifie === false) return { ok: false, raison: 'archive_alteree' }
    if (modificationsNonMentionnees(dossier.preuve).length) return { ok: false, raison: 'modifiee' }

    const certificat = await renderToBuffer(
      createElement(CertificatSignatureConventionPDF, { preuve: dossier.preuve, org: dossier.org }) as any,
    )
    // Le titre et l'auteur du fichier restent ceux de la convention
    const pdf = await PDFDocument.load(conventionPdf, { updateMetadata: false })
    const pagesCertificat = await PDFDocument.load(certificat, { updateMetadata: false })
    // Juste après la convention, avant son annexe ; à défaut, en dernière page
    let position = (await debutAnnexe(conventionPdf)) ?? pdf.getPageCount()
    for (const page of await pdf.copyPages(pagesCertificat, pagesCertificat.getPageIndices())) pdf.insertPage(position++, page)
    return { ok: true, pdf: await pdf.save(), numero: dossier.numero, empreinte: dossier.preuve.empreinteDossier }
  } catch (e) {
    console.error('[certificat joint à la convention]', e)
    return { ok: false, raison: 'indisponible' }
  }
}

/**
 * La convention téléchargée par un compte du CRM : signée électroniquement,
 * elle est suivie de son certificat si le compte a les droits du module
 * Conventions (ceux du certificat seul), une fois ce tirage inscrit au journal.
 * Sinon, la convention telle quelle, avec la raison quand elle est signée.
 */
export async function conventionPourCompte(
  supabase: any,
  compte: { organizationId: string; role: string },
  convention: { id: string; status?: string | null; signature_client_signature_data?: string | null },
  conventionPdf: Uint8Array,
  joint_a: 'convention' | 'apercu',
): Promise<{ pdf: Uint8Array; certificatJoint: boolean; raison: RaisonSansCertificat | null }> {
  const signeeEnLigne = !!convention.signature_client_signature_data
    && ['signee_client', 'signee_complete'].includes(String(convention.status || ''))
  if (!signeeEnLigne) return { pdf: conventionPdf, certificatJoint: false, raison: null }

  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', compte.organizationId).eq('role', compte.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/conventions', compte.role as any, (permissions || []) as any).allowed) {
    return { pdf: conventionPdf, certificatJoint: false, raison: 'droits' }
  }

  const joint = await joindreCertificatSignature(supabase, compte.organizationId, convention.id, conventionPdf)
  if (!joint.ok) return { pdf: conventionPdf, certificatJoint: false, raison: joint.raison }
  // Pas de certificat remis sans sa ligne au journal
  const { logAudit } = await import('@/lib/audit')
  const journalise = await logAudit({
    action: 'emettre_certificat_signature', entity_type: 'convention', entity_id: convention.id,
    details: { numero: joint.numero, empreinte: joint.empreinte, joint_a },
  })
  if (!journalise) return { pdf: conventionPdf, certificatJoint: false, raison: 'indisponible' }
  return { pdf: joint.pdf, certificatJoint: true, raison: null }
}
