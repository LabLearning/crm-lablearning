'use client'

import { FileText, Download, Users, Mail as MailIcon, GraduationCap, ClipboardCheck, Receipt, Award } from '@/components/ui/icons'
import { dernierEnvoiDoc, destinatairesDoc, type EnvoiEmail } from '@/lib/emails-session'

/**
 * Onglet Documents : les livrables de la session — convocation, émargement,
 * programme, certificats, facture — et les documents individuels par
 * apprenant (attestation de fin, certificat de réalisation, hygiène).
 * La contractualisation (conventions, contrats) a son propre onglet.
 */
interface Props {
  sessionId: string
  formationId?: string | null
  estHygiene?: boolean
  aClient?: boolean
  facture?: { id: string; numero?: string | null; status?: string | null; montant_ttc?: number | null } | null
  participants: { id: string; prenom: string | null; nom: string | null; email?: string | null }[]
  envois?: EnvoiEmail[]
}

function BoutonDoc({ href, icon: Icon, titre, sous, teinte = 'brand' }: {
  href: string
  icon: any
  titre: string
  sous: string
  teinte?: 'brand' | 'blue' | 'amber' | 'emerald'
}) {
  const fonds = { brand: 'bg-brand-50 text-brand-600', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600' }[teinte]
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-surface-200 px-4 py-3 min-h-[56px] hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
      <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${fonds}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-surface-900">{titre}</span>
        <span className="block text-xs text-surface-500">{sous}</span>
      </span>
      <Download className="h-4 w-4 text-surface-300 shrink-0" />
    </a>
  )
}

export function SessionDocsTab({ sessionId, formationId, estHygiene, aClient, facture, participants, envois = [] }: Props) {
  const nbConvoques = destinatairesDoc(envois, 'convocation')
  const etatEnvoi = (type: any, email?: string | null) => {
    const e = dernierEnvoiDoc(envois, type, email)
    return e ? `envoyé le ${new Date((e.sent_at || e.created_at)!).toLocaleDateString('fr-FR')}` : null
  }
  return (
    <div className="space-y-4">
      {/* ── Documents de la session ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Documents de la session</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BoutonDoc href={`/api/pdf/convocation-session/${sessionId}`} icon={MailIcon}
            titre="Convocation" sous={nbConvoques > 0 ? `Envoyée à ${nbConvoques} participant${nbConvoques > 1 ? 's' : ''}` : 'Jamais envoyée : dates et horaires'} />
          <BoutonDoc href={`/api/pdf/emargement/${sessionId}`} icon={ClipboardCheck} teinte="blue"
            titre="Feuille d'émargement" sous="Par demi-journée, à faire signer" />
          {formationId && (
            <BoutonDoc href={`/api/pdf/programme/${formationId}?session=${sessionId}`} icon={GraduationCap} teinte="emerald"
              titre="Programme de formation" sous="Avec le calendrier de la session" />
          )}
          <BoutonDoc href={`/api/pdf/certificats-session?session=${sessionId}`} icon={Award} teinte="amber"
            titre="Certificats de réalisation" sous="Tous les apprenants en un document" />
          {estHygiene && (
            <BoutonDoc href={`/api/pdf/attestation-hygiene?session=${sessionId}`} icon={ClipboardCheck} teinte="emerald"
              titre="Attestations d'hygiène (groupées)" sous={(() => { const e = dernierEnvoiDoc(envois, 'hygiene'); return e ? `Envoyées le ${new Date((e.sent_at || e.created_at)!).toLocaleDateString('fr-FR')}` : 'Envoi automatique à la clôture de la session' })()} />
          )}
          {estHygiene && aClient && (
            <BoutonDoc href={`/api/pdf/diplome-etablissement/${sessionId}`} icon={Award} teinte="emerald"
              titre="Diplôme d'établissement" sous="À encadrer en salle, personnel formé à l'hygiène" />
          )}
          {facture?.id && (
            <BoutonDoc href={`/api/pdf/facture/${facture.id}`} icon={Receipt}
              titre={`Facture ${facture.numero || ''}`}
              sous={`${facture.status === 'payee' ? 'Acquittée' : facture.status === 'emise' || facture.status === 'envoyee' ? 'Émise' : 'Brouillon'}${facture.montant_ttc ? ` · ${Number(facture.montant_ttc).toLocaleString('fr-FR')} € TTC` : ''}`} />
          )}
        </div>
      </div>

      {/* ── Documents par apprenant ── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Documents par apprenant</span>
        </div>
        {participants.length === 0 ? (
          <div className="text-center py-8 text-xs text-surface-400">Aucun inscrit</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {participants.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 sm:py-2.5 flex-wrap">
                <span className="flex-1 min-w-[140px]">
                  <span className="block text-sm font-medium text-surface-900">{a.prenom} {a.nom}</span>
                  {(() => {
                    const att = etatEnvoi('attestation', a.email)
                    const cert = etatEnvoi('certificat', a.email)
                    const hyg = estHygiene ? etatEnvoi('hygiene', a.email) : null
                    const morceaux = [att && `attestation ${att}`, cert && `certificat ${cert}`, hyg && `hygiène ${hyg}`].filter(Boolean)
                    return morceaux.length ? <span className="block text-2xs text-emerald-600">{morceaux.join(' · ')}</span> : <span className="block text-2xs text-surface-400">rien d'envoyé</span>
                  })()}
                </span>
                {/* Sur mobile, les trois PDF forment une rangée pleine largeur sous le nom */}
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <a href={`/api/pdf/attestation/${a.id}?session=${sessionId}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center flex-1 sm:flex-none min-h-[40px] sm:min-h-0 text-xs font-medium rounded-lg border border-surface-200 px-2.5 py-1.5 text-surface-600 hover:border-surface-300 transition-colors whitespace-nowrap">
                    Attestation de fin
                  </a>
                  <a href={`/api/pdf/certificat-realisation/${a.id}?session=${sessionId}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center flex-1 sm:flex-none min-h-[40px] sm:min-h-0 text-xs font-medium rounded-lg border border-surface-200 px-2.5 py-1.5 text-surface-600 hover:border-surface-300 transition-colors whitespace-nowrap">
                    Certificat
                  </a>
                  {estHygiene && (
                    <a href={`/api/pdf/attestation-hygiene?session=${sessionId}&apprenant=${a.id}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center justify-center flex-1 sm:flex-none min-h-[40px] sm:min-h-0 text-xs font-medium rounded-lg border border-surface-200 px-2.5 py-1.5 text-surface-600 hover:border-surface-300 transition-colors whitespace-nowrap">
                      Attestation hygiène
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
