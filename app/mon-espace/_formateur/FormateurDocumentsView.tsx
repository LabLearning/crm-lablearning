import { createServiceRoleClient } from '@/lib/supabase/server'
import { FileText, Download } from 'lucide-react'
import { Badge } from '@/components/ui'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES_SUPPORT } from '@/lib/types/document'
import { formatDate } from '@/lib/utils'
import { PendingSignatures } from '@/app/portail/[token]/documents/PendingSignatures'

/**
 * Documents du formateur (branche formateur de la page portail /documents),
 * extraite pour être rendue à l'identique dans l'espace connecté. `token` reste
 * transmis à PendingSignatures pour la signature en ligne.
 */
export async function FormateurDocumentsView({
  formateurId,
  formateurEmail,
  organizationId,
  token,
}: {
  formateurId: string
  formateurEmail: string | null
  organizationId: string
  token: string
}) {
  const supabase = await createServiceRoleClient()

  const { data: documents } = await supabase
    .from('documents')
    .select('*, signatures(*)')
    // Les supports pédagogiques ont leur propre section, filtrée par visibilité
    .not('type', 'in', `(${DOCUMENT_TYPES_SUPPORT.join(',')})`)
    .eq('formateur_id', formateurId)
    .order('created_at', { ascending: false })

  const allDocs = documents || []

  // URL de téléchargement par document : lien direct si http(s), sinon URL signée (bucket privé "dossiers")
  const downloadUrls: Record<string, string> = {}
  const docsToSign: { id: string; path: string }[] = []
  for (const doc of allDocs) {
    if (!doc.file_url) continue
    if (/^https?:\/\//.test(doc.file_url)) {
      downloadUrls[doc.id] = doc.file_url
    } else {
      docsToSign.push({ id: doc.id, path: doc.file_url })
    }
  }
  if (docsToSign.length > 0) {
    const { data: signedList } = await supabase.storage
      .from('dossiers')
      .createSignedUrls(docsToSign.map((d) => d.path), 60 * 60)
    ;(signedList || []).forEach((signed, idx) => {
      if (signed?.signedUrl && !signed.error) downloadUrls[docsToSign[idx].id] = signed.signedUrl
    })
  }

  // Documents à signer par le formateur
  let pendingSignatures: { id: string; signataire_nom: string; status: string; token: string; document: { nom: string; type: string } }[] = []
  if (formateurEmail) {
    const { data: sigs } = await supabase
      .from('signatures')
      .select('id, signataire_nom, status, token, document:documents(nom, type)')
      .eq('organization_id', organizationId)
      .eq('signataire_email', formateurEmail)
      .eq('status', 'en_attente')
    pendingSignatures = (sigs || []) as any
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">Mes documents</h1>
        <p className="text-surface-500 mt-1">Documents et attestations</p>
      </div>

      {/* Pending signatures — signature dessinée en ligne */}
      <PendingSignatures token={token} signatures={pendingSignatures} />

      {/* Documents list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Document</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Date</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {allDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-surface-400 shrink-0" />
                      <span className="text-sm font-medium text-surface-900 truncate">{doc.nom}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5"><Badge variant="default">{(DOCUMENT_TYPE_LABELS as any)[doc.type || 'autre']}</Badge></td>
                  <td className="px-6 py-3.5 hidden md:table-cell text-sm text-surface-500">{formatDate(doc.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-6 py-3.5 text-right">
                    {downloadUrls[doc.id] && (
                      <a href={downloadUrls[doc.id]} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-900 text-white text-xs font-medium hover:bg-surface-800 transition-colors">
                        <Download className="h-3.5 w-3.5" /> Télécharger
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allDocs.length === 0 && <div className="text-center py-12 text-sm text-surface-500">Aucun document disponible</div>}
      </div>
    </div>
  )
}
