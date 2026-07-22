import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileText, Download } from 'lucide-react'
import { Badge } from '@/components/ui'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES_SUPPORT } from '@/lib/types/document'
import { formatDate } from '@/lib/utils'
import { PendingSignatures } from './PendingSignatures'
import { getSessionSupports, type SessionSupport } from '@/lib/session-contenu'
import { SupportsList } from '../ContenuPedagogique'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function PortalDocumentsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context) redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  // Chaque profil ne voit que SES documents.
  // Le filtre était `organization_id` pour tout ce qui n'est ni apprenant ni
  // formateur : un client se voyait servir l'intégralité des documents de
  // l'organisation — conventions, factures et pièces d'autres entreprises.
  let documentsQuery = supabase
    .from('documents')
    .select('*, signatures(*)')
    // Les supports pédagogiques ont leur propre section, filtrée par visibilité
    .not('type', 'in', `(${DOCUMENT_TYPES_SUPPORT.join(',')})`)
    .order('created_at', { ascending: false })

  if (context.type === 'apprenant') {
    documentsQuery = documentsQuery.eq('apprenant_id', context.apprenant.id)
  } else if (context.type === 'formateur') {
    documentsQuery = documentsQuery.eq('formateur_id', (context as any).formateur.id)
  } else if (context.type === 'client') {
    documentsQuery = documentsQuery.eq('client_id', (context as any).client.id)
  } else {
    // Apporteur, partenaire : aucun document nominatif ne leur est rattaché.
    // Mieux vaut une liste vide qu'un filtre trop large.
    documentsQuery = documentsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { data: documents } = await documentsQuery

  const allDocs = documents || []

  // URL de téléchargement par document : lien direct si http(s), sinon URL signée (bucket privé "dossiers")
  // Les URLs signées sont générées en un seul appel batch (createSignedUrls)
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

  // Supports pédagogiques des sessions de l'apprenant, regroupés par formation.
  // Le filtrage de visibilité est fait dans getSessionSupports (côté serveur).
  const supportsParSession: { sessionId: string; titre: string; supports: SessionSupport[] }[] = []
  if (context.type === 'apprenant') {
    const { data: ins } = await supabase
      .from('inscriptions')
      .select('session:sessions(id, reference, date_debut, formation:formation_id(intitule))')
      .eq('apprenant_id', context.apprenant.id)
      .not('status', 'in', '("annule","abandonne")')

    const sessions = (ins || []).map((i: any) => i.session).filter(Boolean)
    const bySession = await getSessionSupports(supabase, sessions.map((s: any) => s.id), 'stagiaire')
    for (const s of sessions) {
      const list = bySession[s.id] || []
      if (list.length === 0) continue
      supportsParSession.push({
        sessionId: s.id,
        titre: s.formation?.intitule || s.reference || 'Session',
        supports: list,
      })
    }
  }

  // Also get pending signatures
  const email = context.type === 'apprenant' ? context.apprenant.email : context.type === 'formateur' ? (context as any).formateur.email : null
  let pendingSignatures: { id: string; signataire_nom: string; status: string; token: string; document: { nom: string; type: string } }[] = []
  if (email) {
    const { data: sigs } = await supabase
      .from('signatures')
      .select('id, signataire_nom, status, token, document:documents(nom, type)')
      .eq('organization_id', context.organization.id)
      .eq('signataire_email', email)
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
      <PendingSignatures token={params.token} signatures={pendingSignatures} />

      {/* Supports pédagogiques par formation */}
      {supportsParSession.length > 0 && (
        <div className="space-y-4">
          {supportsParSession.map((s) => (
            <div key={s.sessionId} className="card p-5">
              <h2 className="text-sm font-heading font-semibold text-surface-900 mb-3">{s.titre}</h2>
              <SupportsList supports={s.supports} token={params.token} />
            </div>
          ))}
        </div>
      )}

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
