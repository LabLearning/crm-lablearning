import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { NoteTracabilitePDF } from '@/lib/pdf/note-tracabilite-pdf'

/** Montant déclaré au BPF 2025, référence des contrôles de cohérence. */
const BPF_2025 = 284495.23

/**
 * Note de traçabilité de la migration, chiffrée à la demande.
 *
 * Les valeurs sont comptées en base au moment de la génération : la note ne
 * peut pas présenter des chiffres périmés à l'auditeur.
 */
export async function GET() {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  // Elle porte le chiffre d'affaires facturé et le montant du bilan pédagogique : l'admin seul
  if (auth.user.role !== 'super_admin') return NextResponse.json({ error: 'Réservé à l’admin' }, { status: 403 })

  const supabase = await createServiceRoleClient()
  const orgId = auth.user.organizationId

  const compte = async (table: string, filtre?: (q: any) => any) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
    if (filtre) q = filtre(q)
    const { count, error } = await q
    return error ? 0 : (count || 0)
  }

  const tousLes = async (table: string, select: string) => {
    let out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(select).eq('organization_id', orgId).range(from, from + 999)
      if (error || !data || data.length === 0) break
      out = out.concat(data)
      if (data.length < 1000) break
    }
    return out
  }

  const [sessions, factures, evals, org] = await Promise.all([
    tousLes('sessions', 'dendreo_id, date_debut'),
    tousLes('factures', 'dendreo_id, date_emission, montant_ttc'),
    tousLes('evaluations_acquis', 'note'),
    supabase.from('organizations').select('*').eq('id', orgId).single().then((r) => r.data),
  ])

  const [
    apprenantsTotal, apprenantsRepris, inscriptions, presenceImportee,
    emargementsTotal, emargementsSignes, qcmTotal, qcmComplets,
    veilles, reclamations, actionsAmelioration, recueilsBesoin, auditsHygiene,
  ] = await Promise.all([
    compte('apprenants'),
    compte('apprenants', (q) => q.not('dendreo_id', 'is', null)),
    compte('inscriptions'),
    compte('inscriptions', (q) => q.not('heures_presence', 'is', null)),
    compte('emargements'),
    compte('emargements', (q) => q.not('signature_data', 'is', null)),
    compte('qcm_reponses'),
    compte('qcm_reponses', (q) => q.eq('is_complete', true)),
    compte('veilles'),
    compte('reclamations'),
    compte('actions_amelioration'),
    compte('recueils_besoin'),
    compte('ah_audits'),
  ])

  const f2025 = factures.filter((f) => String(f.date_emission || '').startsWith('2025'))
  const notes = evals.map((e) => Number(e.note)).filter((n) => !isNaN(n))

  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const orgLogo = await withDocumentLogo(supabase, org)

  const buffer = await renderToBuffer(
    createElement(NoteTracabilitePDF, {
      org: orgLogo,
      dateEdition: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      c: {
        sessionsTotal: sessions.length,
        sessionsReprises: sessions.filter((s) => s.dendreo_id).length,
        sessions2025: sessions.filter((s) => String(s.date_debut || '').startsWith('2025')).length,
        sessions2026: sessions.filter((s) => String(s.date_debut || '').startsWith('2026')).length,
        apprenantsTotal, apprenantsRepris, inscriptions,
        facturesTotal: factures.length,
        facturesReprises: factures.filter((f) => f.dendreo_id).length,
        factures2025Nb: f2025.length,
        factures2025Montant: f2025.reduce((a, f) => a + Number(f.montant_ttc || 0), 0),
        bpf2025: BPF_2025,
        presenceImportee,
        evaluationsAcquis: evals.length,
        noteMoyenne: notes.length ? notes.reduce((a, n) => a + n, 0) / notes.length : 0,
        emargementsSignes, emargementsTotal, qcmComplets, qcmTotal,
        veilles, reclamations, actionsAmelioration, recueilsBesoin, auditsHygiene,
      },
    }) as any,
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="note-tracabilite-migration.pdf"',
      'Cache-Control': 'private, max-age=0',
    },
  })
}
