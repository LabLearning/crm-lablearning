import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, Globe, MapPin, Building2, User, FileText,
  Receipt, FolderOpen, Users, Hash, Banknote, Calendar,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '@/lib/types/formation'
import { CLIENT_TYPE_LABELS, FINANCEUR_LABELS } from '@/lib/types/crm'
import type { Client } from '@/lib/types/crm'
import { ClientEditButton } from './ClientEditButton'
import { ClientNotes } from './ClientNotes'
import { ClientParticipants } from './ClientParticipants'
import { ClientDocuments } from './ClientDocuments'
import { ClientContacts } from './ClientContacts'

export const dynamic = 'force-dynamic'

function fmtMontant(n: any): string {
  return `${Number(n || 0).toLocaleString('fr-FR')} €`
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!client) redirect('/dashboard/clients')

  // Contrôle d'accès : un commercial ne peut voir que ses clients assignés
  const role = session.user.role
  const canAssign = ['super_admin', 'gestionnaire', 'directeur_commercial', 'comptable'].includes(role)
  if (role === 'commercial' && (client as any).assigned_to !== session.user.id) {
    redirect('/dashboard/clients')
  }

  // Données liées — toutes indépendantes (ne dépendent que de l'id client) → en parallèle
  const [
    { data: contacts },
    { data: leads },
    { data: dossiers },
    { data: devis },
    { data: factures },
    { data: users },
    { data: participants },
    { data: documents },
    { data: sessions },
  ] = await Promise.all([
    supabase.from('contacts').select('*').eq('client_id', params.id).order('est_principal', { ascending: false }),
    supabase.from('leads').select('*').eq('converted_client_id', params.id).order('created_at', { ascending: false }),
    supabase.from('dossiers_formation').select('*, formation:formation_id(intitule), session:session_id(id, reference, date_debut, date_fin, formateur:formateurs(prenom, nom))').eq('client_id', params.id).order('created_at', { ascending: false }),
    supabase.from('devis').select('*').eq('client_id', params.id).order('created_at', { ascending: false }),
    supabase.from('factures').select('*').eq('client_id', params.id).order('date_emission', { ascending: false }),
    canAssign
      ? supabase.from('users').select('id, first_name, last_name').eq('organization_id', session.organization.id).eq('status', 'active').order('first_name')
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('apprenants').select('id, prenom, nom, email, telephone, poste').eq('client_id', params.id).order('nom'),
    supabase.from('documents').select('id, nom, type, description, file_name, file_size, storage_path, created_at').eq('client_id', params.id).order('created_at', { ascending: false }),
    supabase.from('sessions').select('id, reference, intitule, date_debut, date_fin, status, formateur:formateurs(prenom, nom), formation:formation_id(intitule)').eq('client_id', params.id).order('date_debut', { ascending: false }),
  ])
  const sessionsList = (sessions || []) as any[]

  // Nb d'apprenants inscrits par session (pour les dossiers liés à une session)
  const dossierSessionIds = (dossiers || []).map((d: any) => d.session?.id).filter(Boolean)
  const inscritsBySession: Record<string, number> = {}
  if (dossierSessionIds.length > 0) {
    const { data: inscRows } = await supabase
      .from('inscriptions')
      .select('session_id')
      .in('session_id', dossierSessionIds)
      .not('status', 'in', '("annule","abandonne")')
    for (const r of inscRows || []) {
      inscritsBySession[r.session_id] = (inscritsBySession[r.session_id] || 0) + 1
    }
  }

  const c = client as Client
  const assignee = (users || []).find((u: any) => u.id === c.assigned_to)
  const assignedName = assignee ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim() : null
  const contactsList = (contacts || []) as any[]
  const dossiersList = (dossiers || []) as any[]
  const devisList = (devis || []) as any[]
  const facturesList = (factures || []) as any[]
  const leadsList = (leads || []) as any[]

  const isEntreprise = c.type === 'entreprise'
  const displayName = isEntreprise
    ? (c.raison_sociale || 'Sans nom')
    : `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Sans nom'

  const totalFacture = facturesList
    .filter((f) => f.type !== 'avoir' && f.status !== 'annulee')
    .reduce((s, f) => s + Number(f.montant_ttc || 0), 0)
  const totalPaye = facturesList.reduce((s, f) => s + Number(f.montant_paye || 0), 0)

  const stats = [
    { label: 'Contacts', value: contactsList.length, icon: Users },
    { label: 'Dossiers', value: dossiersList.length, icon: FolderOpen },
    { label: 'Factures', value: facturesList.length, icon: Receipt },
    { label: 'CA facturé', value: fmtMontant(totalFacture), icon: Banknote },
  ]

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-surface-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-2xs text-surface-400 uppercase tracking-wider">{label}</div>
        <div className="text-sm text-surface-700 break-words">{value}</div>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clients" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700">
          <ArrowLeft className="h-4 w-4" /> Clients
        </Link>
        <ClientEditButton client={c} users={(users || []) as any[]} canAssign={canAssign} />
      </div>

      {/* En-tête */}
      <div className="card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${isEntreprise ? 'bg-brand-50' : 'bg-purple-50'}`}>
          {isEntreprise ? <Building2 className="h-7 w-7 text-brand-600" /> : <User className="h-7 w-7 text-purple-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-heading font-bold text-surface-900 truncate">{displayName}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant={isEntreprise ? 'info' : 'default'}>{CLIENT_TYPE_LABELS[c.type]}</Badge>
            {c.financeur_type && <Badge variant="warning">{FINANCEUR_LABELS[c.financeur_type]}</Badge>}
            {canAssign && assignedName && <Badge variant="default">Assigné à {assignedName}</Badge>}
            {(c.tags || []).map((t) => <Badge key={t} variant="default">{t}</Badge>)}
          </div>
          <div className="flex items-center gap-4 mt-2.5 text-sm text-surface-500 flex-wrap">
            {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-surface-700"><Mail className="h-3.5 w-3.5" />{c.email}</a>}
            {c.telephone && <a href={`tel:${c.telephone}`} className="flex items-center gap-1 hover:text-surface-700"><Phone className="h-3.5 w-3.5" />{c.telephone}</a>}
            {c.site_web && <a href={c.site_web.startsWith('http') ? c.site_web : `https://${c.site_web}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-surface-700"><Globe className="h-3.5 w-3.5" />{c.site_web}</a>}
          </div>
          {c.siret && <div className="text-xs text-surface-400 mt-1 font-mono">SIRET {c.siret}</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon bg-surface-100">
              <s.icon className="h-5 w-5 text-surface-600" />
            </div>
            <div>
              <p className="stat-label">{s.label}</p>
              <p className="stat-value text-surface-900 mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Colonne gauche : infos */}
        <div className="space-y-5">
          {/* Coordonnées */}
          <div className="card p-5">
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Coordonnées</div>
            {(c.adresse || c.ville) ? (
              <InfoRow icon={MapPin} label="Adresse" value={
                <>{c.adresse && <div>{c.adresse}</div>}<div>{[c.code_postal, c.ville].filter(Boolean).join(' ')}</div>{c.pays && c.pays !== 'France' && <div>{c.pays}</div>}</>
              } />
            ) : null}
            {c.email && <InfoRow icon={Mail} label="Email" value={c.email} />}
            {c.telephone && <InfoRow icon={Phone} label="Téléphone" value={c.telephone} />}
            {!c.adresse && !c.ville && !c.email && !c.telephone && (
              <div className="text-sm text-surface-400">Aucune coordonnée renseignée</div>
            )}
          </div>

          {/* Informations légales / financeur */}
          {(isEntreprise || c.financeur_type || c.numero_opco) && (
            <div className="card p-5">
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Informations</div>
              {c.financeur_type && <InfoRow icon={Banknote} label="Financeur" value={FINANCEUR_LABELS[c.financeur_type]} />}
              {c.numero_opco && <InfoRow icon={Hash} label="N° OPCO" value={c.numero_opco} />}
              {c.code_naf && <InfoRow icon={Hash} label="Code NAF" value={c.code_naf} />}
              {c.secteur_activite && <InfoRow icon={Building2} label="Secteur" value={c.secteur_activite} />}
              {c.taille_entreprise && <InfoRow icon={Users} label="Taille" value={c.taille_entreprise} />}
              {(c as any).forme_juridique && <InfoRow icon={FileText} label="Forme juridique" value={(c as any).forme_juridique} />}
              {(c as any).tva_intra && <InfoRow icon={Hash} label="TVA intra" value={(c as any).tva_intra} />}
              {(c as any).convention_collective && <InfoRow icon={FileText} label="Convention collective" value={(c as any).convention_collective} />}
            </div>
          )}
        </div>

        {/* Colonne droite : contacts + activité */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contacts (ajout / modification / suppression) */}
          <ClientContacts clientId={c.id} contacts={contactsList as any[]} />

          {/* Sessions de formation du client */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-500" />
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Sessions de formation ({sessionsList.length})</span>
            </div>
            {sessionsList.length === 0 ? (
              <div className="text-center py-8 text-sm text-surface-400">Aucune session</div>
            ) : (
              <div className="divide-y divide-surface-100">
                {sessionsList.slice(0, 15).map((s) => {
                  const formateurNom = s.formateur ? `${s.formateur.prenom || ''} ${s.formateur.nom || ''}`.trim() : null
                  return (
                    <Link key={s.id} href={`/dashboard/sessions/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                      <Calendar className="h-4 w-4 text-surface-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">
                          {s.formation?.intitule || s.intitule || s.reference || 'Session'}
                        </div>
                        <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap mt-0.5">
                          {s.reference && <span className="font-mono text-surface-400">{s.reference}</span>}
                          {s.date_debut && (
                            <span>{formatDate(s.date_debut, { day: 'numeric', month: 'short' })}{s.date_fin && s.date_fin !== s.date_debut ? ` → ${formatDate(s.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
                          )}
                          {formateurNom && <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{formateurNom}</span>}
                        </div>
                      </div>
                      {s.status && (
                        <Badge variant={SESSION_STATUS_COLORS[s.status as keyof typeof SESSION_STATUS_COLORS] || 'default'} dot>
                          {SESSION_STATUS_LABELS[s.status as keyof typeof SESSION_STATUS_LABELS] || s.status}
                        </Badge>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dossiers de formation */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-brand-500" />
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Dossiers de formation ({dossiersList.length})</span>
            </div>
            {dossiersList.length === 0 ? (
              <div className="text-center py-8 text-sm text-surface-400">Aucun dossier</div>
            ) : (
              <div className="divide-y divide-surface-100">
                {dossiersList.slice(0, 10).map((d) => {
                  const sess = d.session
                  const nbApprenants = sess?.id ? (inscritsBySession[sess.id] || 0) : 0
                  const formateurNom = sess?.formateur ? `${sess.formateur.prenom || ''} ${sess.formateur.nom || ''}`.trim() : null
                  return (
                    <Link key={d.id} href={`/dashboard/dossiers/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                      <FileText className="h-4 w-4 text-surface-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">
                          {d.formation?.intitule || d.reference || d.numero || 'Dossier'}
                        </div>
                        <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap mt-0.5">
                          {d.numero && <span className="font-mono text-surface-400">{d.numero}</span>}
                          {sess?.date_debut && (
                            <span>{formatDate(sess.date_debut, { day: 'numeric', month: 'short' })}{sess.date_fin && sess.date_fin !== sess.date_debut ? ` → ${formatDate(sess.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
                          )}
                          {formateurNom && <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{formateurNom}</span>}
                          {sess?.id && <span className="flex items-center gap-1"><Users className="h-3 w-3 shrink-0" />{nbApprenants} apprenant{nbApprenants > 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      {d.statut && <Badge variant="default">{String(d.statut).replace(/_/g, ' ')}</Badge>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Factures */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-brand-500" />
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Factures ({facturesList.length})</span>
              </div>
              {totalPaye > 0 && <span className="text-xs text-surface-500">{fmtMontant(totalPaye)} encaissé</span>}
            </div>
            {facturesList.length === 0 ? (
              <div className="text-center py-8 text-sm text-surface-400">Aucune facture</div>
            ) : (
              <div className="divide-y divide-surface-100">
                {facturesList.slice(0, 10).map((f) => (
                  <Link key={f.id} href={`/dashboard/factures`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                    <Receipt className="h-4 w-4 text-surface-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">{f.numero || 'Facture'}</div>
                      <div className="text-xs text-surface-400">{f.date_emission ? formatDate(f.date_emission, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-surface-800">{fmtMontant(f.montant_ttc)}</div>
                      {f.status && <div className="text-2xs text-surface-400">{String(f.status).replace(/_/g, ' ')}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Employés / participants de l'entreprise */}
          {isEntreprise && <ClientParticipants clientId={c.id} participants={(participants || []) as any[]} />}

          <ClientDocuments clientId={c.id} documents={(documents || []) as any[]} />

          {/* Commentaires (éditable) — sous les factures */}
          <ClientNotes clientId={c.id} initialNotes={c.notes} />

          {/* Devis */}
          {devisList.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-500" />
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Devis ({devisList.length})</span>
              </div>
              <div className="divide-y divide-surface-100">
                {devisList.slice(0, 10).map((d) => (
                  <Link key={d.id} href={`/dashboard/devis`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                    <FileText className="h-4 w-4 text-surface-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">{d.numero || 'Devis'}</div>
                      <div className="text-xs text-surface-400">{formatDate(d.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-surface-800">{fmtMontant(d.montant_ttc)}</div>
                      {d.status && <div className="text-2xs text-surface-400">{String(d.status).replace(/_/g, ' ')}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
