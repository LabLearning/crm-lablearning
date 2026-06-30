import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  GraduationCap, Calendar, FileText, ClipboardCheck,
  Clock, CheckCircle2, Star, Users, Presentation,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export default async function PortalHomePage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context) redirect('/portail/expired')

  const supabase = await createServiceRoleClient()
  const basePath = `/portail/${params.token}`

  if (context.type === 'apprenant') {
    // Fetch apprenant data
    const [{ data: inscriptions }, { count: pendingQcm }, { count: docsCount }] = await Promise.all([
      supabase
        .from('inscriptions')
        .select(`
        *,
        session:sessions(reference, date_debut, date_fin, horaires, lieu, status,
          formation:formation_id(intitule, duree_heures, modalite)
        )
      `)
        .eq('apprenant_id', context.apprenant.id)
        .order('date_inscription', { ascending: false }),
      supabase
        .from('qcm_reponses')
        .select('*', { count: 'exact', head: true })
        .eq('apprenant_id', context.apprenant.id)
        .eq('is_complete', false),
      supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('apprenant_id', context.apprenant.id),
    ])

    const allInscriptions = inscriptions || []
    const enCours = allInscriptions.filter((i) => ['inscrit', 'confirme', 'en_cours'].includes(i.status))
    const terminees = allInscriptions.filter((i) => i.status === 'complete')

    return (
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">
            Bonjour, {context.apprenant.prenom} !
          </h1>
          <p className="text-surface-500 mt-0.5 text-sm">Votre espace de formation personnel</p>
        </div>

        {/* Quick stats — 2 cols on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href={`${basePath}/formations`} className="portal-stat">
            <div className="portal-stat-icon bg-brand-50"><GraduationCap className="h-5 w-5 text-brand-600" /></div>
            <div><div className="text-[11px] text-surface-500 leading-tight">En cours</div><div className="text-xl font-bold text-surface-900">{enCours.length}</div></div>
          </Link>
          <Link href={`${basePath}/formations`} className="portal-stat">
            <div className="portal-stat-icon bg-success-50"><CheckCircle2 className="h-5 w-5 text-success-600" /></div>
            <div><div className="text-[11px] text-surface-500 leading-tight">Terminées</div><div className="text-xl font-bold text-success-600">{terminees.length}</div></div>
          </Link>
          <Link href={`${basePath}/questionnaires`} className="portal-stat">
            <div className="portal-stat-icon bg-warning-50"><ClipboardCheck className="h-5 w-5 text-warning-600" /></div>
            <div><div className="text-[11px] text-surface-500 leading-tight">QCM</div><div className="text-xl font-bold text-warning-600">{pendingQcm || 0}</div></div>
          </Link>
          <Link href={`${basePath}/documents`} className="portal-stat">
            <div className="portal-stat-icon bg-purple-50"><FileText className="h-5 w-5 text-purple-600" /></div>
            <div><div className="text-[11px] text-surface-500 leading-tight">Documents</div><div className="text-xl font-bold text-purple-600">{docsCount || 0}</div></div>
          </Link>
        </div>

        {/* Upcoming sessions */}
        {enCours.length > 0 && (
          <div className="card p-6">
            <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Prochaines formations</h2>
            <div className="space-y-3">
              {enCours.slice(0, 3).map((ins) => (
                <div key={ins.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-50">
                  <div className="shrink-0 text-center">
                    <div className="text-2xs uppercase text-surface-400">
                      {ins.session?.date_debut && new Date(ins.session.date_debut).toLocaleDateString('fr-FR', { month: 'short' })}
                    </div>
                    <div className="text-xl font-heading font-bold text-brand-600">
                      {ins.session?.date_debut && new Date(ins.session.date_debut).getDate()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{ins.session?.formation?.intitule || '—'}</div>
                    <div className="text-xs text-surface-500 mt-0.5 truncate">
                      {ins.session?.lieu || 'Lieu non défini'}
                      {ins.session?.horaires && ` · ${ins.session.horaires}`}
                    </div>
                  </div>
                  <Badge variant="info">{ins.session?.formation?.modalite || '—'}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- APPORTEUR / PARTENAIRE ----
  if (context.type === 'apporteur') {
    const isPartenaire = context.apporteur.categorie === 'partenaire'

    const [{ data: leads }, { data: commissions }] = await Promise.all([
      supabase
        .from('leads')
        .select('id, contact_nom, contact_prenom, entreprise, status, montant_estime, created_at')
        .eq('apporteur_id', context.apporteur.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('commissions')
        .select('id, montant_commission, montant_base, status')
        .eq('apporteur_id', context.apporteur.id),
    ])

    const allLeads = leads || []
    const allComm = commissions || []
    const gagnes = allLeads.filter((l: any) => l.status === 'gagne').length
    const enCours = allLeads.filter((l: any) => !['gagne', 'perdu'].includes(l.status)).length
    const totalComm = allComm.reduce((s: number, c: any) => s + Number(c.montant_commission || 0), 0)
    const commPayees = allComm.filter((c: any) => c.status === 'payee').reduce((s: number, c: any) => s + Number(c.montant_commission || 0), 0)
    const caGenere = allLeads.filter((l: any) => l.status === 'gagne').reduce((s: number, l: any) => s + Number(l.montant_estime || 0), 0)
    const txConversion = allLeads.length > 0 ? Math.round((gagnes / allLeads.length) * 100) : 0
    const objectifCA = context.apporteur.objectif_annuel_ca || 0
    const progressCA = objectifCA > 0 ? Math.min(100, Math.round((caGenere / objectifCA) * 100)) : 0

    if (isPartenaire) {
      return (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading truncate">
              Tableau de bord {context.apporteur.nom_enseigne || context.apporteur.raison_sociale || ''}
            </h1>
            <p className="text-surface-500 mt-1 text-sm">
              Espace partenaire — {context.apporteur.secteur || 'Formation professionnelle'}
            </p>
          </div>

          {/* KPIs partenaire */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'CA genere', value: Number(caGenere).toLocaleString('fr-FR') + ' EUR', color: 'text-surface-900' },
              { label: 'Commissions', value: Number(totalComm).toLocaleString('fr-FR') + ' EUR', color: 'text-success-600' },
              { label: 'Dossiers gagnes', value: String(gagnes), color: 'text-brand-600' },
              { label: 'Conversion', value: txConversion + '%', color: txConversion >= 20 ? 'text-success-600' : 'text-warning-600' },
            ].map(k => (
              <div key={k.label} className="card p-4 text-center">
                <div className={`text-lg md:text-2xl font-heading font-bold break-all ${k.color}`}>{k.value}</div>
                <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Objectif CA */}
          {objectifCA > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-heading font-semibold text-surface-900">Objectif annuel</div>
                <span className="text-sm font-bold text-brand-600">{progressCA}%</span>
              </div>
              <div className="h-3 rounded-full bg-surface-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: progressCA + '%' }} />
              </div>
              <div className="flex justify-between text-xs text-surface-400 mt-2">
                <span>{Number(caGenere).toLocaleString('fr-FR')} EUR realise</span>
                <span>Objectif : {Number(objectifCA).toLocaleString('fr-FR')} EUR</span>
              </div>
            </div>
          )}

          {/* Infos contrat */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Points de vente', value: context.apporteur.nombre_points_vente || '--' },
              { label: 'Taux commission', value: context.apporteur.taux_commission ? context.apporteur.taux_commission + '%' : '--' },
              { label: 'En cours', value: enCours + ' leads' },
              { label: 'Commissions payees', value: Number(commPayees).toLocaleString('fr-FR') + ' EUR' },
            ].map(k => (
              <div key={k.label} className="p-3 rounded-xl bg-surface-50 text-center">
                <div className="text-lg font-heading font-bold text-surface-800">{k.value}</div>
                <div className="text-[10px] text-surface-400">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Liens rapides */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Voir les dossiers', href: basePath + '/dossiers-partenaire', icon: FileText },
              { label: 'Voir les sessions', href: basePath + '/sessions-partenaire', icon: Calendar },
              { label: 'Mes commissions', href: basePath + '/commissions-apporteur', icon: ClipboardCheck },
            ].map(l => (
              <Link key={l.href} href={l.href} className="card p-5 flex items-center gap-3 hover:shadow-card transition-shadow group">
                <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <l.icon className="h-5 w-5 text-brand-600" />
                </div>
                <span className="text-sm font-medium text-surface-800 group-hover:text-brand-700 transition-colors">{l.label}</span>
              </Link>
            ))}
          </div>

          {/* Derniers leads */}
          {allLeads.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Derniers prospects</h2>
              <div className="space-y-2">
                {allLeads.slice(0, 6).map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-surface-800 truncate">{l.contact_prenom} {l.contact_nom}</div>
                      <div className="text-xs text-surface-400 truncate">{l.entreprise || '--'}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {l.montant_estime && <span className="text-xs text-surface-500 hidden sm:inline">{Number(l.montant_estime).toLocaleString('fr-FR')} EUR</span>}
                      <Badge variant={l.status === 'gagne' ? 'success' : l.status === 'perdu' ? 'danger' : 'default'}>
                        {l.status === 'gagne' ? 'Gagne' : l.status === 'perdu' ? 'Perdu' : 'En cours'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Simple apporteur
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading truncate">
            Bienvenue, {context.apporteur.prenom || context.apporteur.nom}
          </h1>
          <p className="text-surface-500 mt-1">Espace apporteur d'affaires</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Leads apportes', value: allLeads.length },
            { label: 'Gagnes', value: gagnes },
            { label: 'Total commissions', value: Number(totalComm).toLocaleString('fr-FR') + ' EUR' },
            { label: 'Conversion', value: txConversion + '%' },
          ].map(k => (
            <div key={k.label} className="card p-4 text-center">
              <div className="text-xl font-heading font-bold text-surface-900 break-all">{k.value}</div>
              <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href={basePath + '/leads-apporteur'} className="card p-5 flex items-center gap-3 hover:shadow-card transition-shadow group">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors"><Users className="h-5 w-5 text-blue-600" /></div>
            <span className="text-sm font-medium text-surface-800">Voir mes leads</span>
          </Link>
          <Link href={basePath + '/commissions-apporteur'} className="card p-5 flex items-center gap-3 hover:shadow-card transition-shadow group">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><Star className="h-5 w-5 text-emerald-600" /></div>
            <span className="text-sm font-medium text-surface-800">Voir mes commissions</span>
          </Link>
        </div>
        {allLeads.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Derniers leads</h2>
            <div className="space-y-2">
              {allLeads.slice(0, 5).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-800 truncate">{l.contact_nom}</div>
                    <div className="text-xs text-surface-400 truncate">{l.entreprise || '--'}</div>
                  </div>
                  <Badge variant={l.status === 'gagne' ? 'success' : l.status === 'perdu' ? 'danger' : 'default'}>
                    {l.status === 'gagne' ? 'Gagne' : l.status === 'perdu' ? 'Perdu' : 'En cours'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- CLIENT ----
  if (context.type === 'client') {
    const [{ data: conventions }, { data: factures }, { data: dossiers }] = await Promise.all([
      supabase
        .from('conventions')
        .select('id, numero, status, formation:formation_id(intitule)')
        .eq('client_id', context.client.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('factures')
        .select('id, numero, status, montant_ttc, date_emission')
        .eq('client_id', context.client.id)
        .order('date_emission', { ascending: false })
        .limit(5),
      supabase
        .from('dossiers_formation')
        .select('id, status, session:sessions(date_debut, formation:formation_id(intitule))')
        .eq('client_id', context.client.id)
        .limit(5),
    ])

    const displayName = context.contact ? context.contact.prenom + ' ' + context.contact.nom : context.client.raison_sociale || 'Client'
    const nbConventions = (conventions || []).length
    const nbFactures = (factures || []).length
    const nbDossiers = (dossiers || []).length
    const enAttente = (conventions || []).filter((c: any) => c.status === 'envoyee').length
    const impayees = (factures || []).filter((f: any) => ['envoyee', 'en_retard', 'relancee'].includes(f.status)).length

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading truncate">
            Bienvenue, {displayName}
          </h1>
          <p className="text-surface-500 mt-1 truncate">Espace client {context.client.raison_sociale || ''}</p>
        </div>

        {/* Alertes */}
        {(enAttente > 0 || impayees > 0) && (
          <div className="card p-4 border-warning-200 border bg-warning-50/30">
            <div className="flex items-center gap-4 text-sm">
              {enAttente > 0 && <span className="text-warning-700 font-medium">{enAttente} convention(s) en attente de signature</span>}
              {impayees > 0 && <span className="text-danger-600 font-medium">{impayees} facture(s) en attente de paiement</span>}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Dossiers', value: nbDossiers },
            { label: 'Conventions', value: nbConventions },
            { label: 'Factures', value: nbFactures },
            { label: 'En attente', value: enAttente + impayees, alert: enAttente + impayees > 0 },
          ].map(k => (
            <div key={k.label} className="card p-4 text-center">
              <div className={`text-2xl font-heading font-bold ${k.alert ? 'text-warning-600' : 'text-surface-900'}`}>{k.value}</div>
              <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Liens rapides */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Voir les formations', href: basePath + '/formations-client', icon: GraduationCap },
            { label: 'Voir les conventions', href: basePath + '/conventions-client', icon: FileText },
            { label: 'Voir les factures', href: basePath + '/factures-client', icon: ClipboardCheck },
          ].map(l => (
            <Link key={l.href} href={l.href} className="card p-5 flex items-center gap-3 hover:shadow-card transition-shadow group">
              <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <l.icon className="h-5 w-5 text-brand-600" />
              </div>
              <span className="text-sm font-medium text-surface-800 group-hover:text-brand-700 transition-colors">{l.label}</span>
            </Link>
          ))}
        </div>

        {/* Recent conventions */}
        {nbConventions > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Dernieres conventions</h2>
            <div className="space-y-2">
              {(conventions || []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-800 truncate">{c.formation?.intitule || c.numero}</div>
                    <div className="text-xs text-surface-400">{c.numero}</div>
                  </div>
                  <Badge variant={['signee_client', 'signee_of', 'signee_complete'].includes(c.status) ? 'success' : c.status === 'envoyee' ? 'warning' : 'default'}>
                    {['signee_client', 'signee_of', 'signee_complete'].includes(c.status) ? 'Signee' : c.status === 'envoyee' ? 'A signer' : c.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- FORMATEUR ----
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      formation:formation_id(intitule, duree_heures, modalite)
    `)
    .eq('formateur_id', context.formateur.id)
    .order('date_debut', { ascending: true })

  const allSessions = sessions || []
  const upcoming = allSessions.filter((s) => new Date(s.date_debut) >= new Date() && ['planifiee', 'confirmee'].includes(s.status))
  const enCours = allSessions.filter((s) => s.status === 'en_cours')
  const done = allSessions.filter((s) => s.status === 'terminee')

  // Count apprenants for formateur
  const sessionIds = allSessions.map((s) => s.id)
  let totalApprenants = 0
  if (sessionIds.length > 0) {
    const { count } = await supabase
      .from('inscriptions')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds)
      .not('status', 'in', '("annule","abandonne")')
    totalApprenants = count || 0
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Bonjour, {context.formateur.prenom} !
        </h1>
        <p className="text-surface-500 mt-0.5 text-sm">Votre espace formateur</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href={`${basePath}/sessions`} className="portal-stat">
          <div className="portal-stat-icon bg-brand-50"><Calendar className="h-5 w-5 text-brand-600" /></div>
          <div><div className="text-[11px] text-surface-500 leading-tight">À venir</div><div className="text-xl font-bold text-brand-600">{upcoming.length}</div></div>
        </Link>
        <Link href={`${basePath}/sessions`} className="portal-stat">
          <div className="portal-stat-icon bg-success-50"><Presentation className="h-5 w-5 text-success-600" /></div>
          <div><div className="text-[11px] text-surface-500 leading-tight">En cours</div><div className="text-xl font-bold text-success-600">{enCours.length}</div></div>
        </Link>
        <Link href={`${basePath}/apprenants`} className="portal-stat">
          <div className="portal-stat-icon bg-purple-50"><Users className="h-5 w-5 text-purple-600" /></div>
          <div><div className="text-[11px] text-surface-500 leading-tight">Apprenants</div><div className="text-xl font-bold text-purple-600">{totalApprenants}</div></div>
        </Link>
        <div className="portal-stat">
          <div className="portal-stat-icon bg-surface-100"><CheckCircle2 className="h-5 w-5 text-surface-600" /></div>
          <div><div className="text-[11px] text-surface-500 leading-tight">Terminées</div><div className="text-xl font-bold text-surface-700">{done.length}</div></div>
        </div>
      </div>

      {/* Upcoming sessions */}
      {(enCours.length > 0 || upcoming.length > 0) && (
        <div className="card p-6">
          <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-4">Planning</h2>
          <div className="space-y-3">
            {[...enCours, ...upcoming].slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-50">
                <div className="shrink-0 text-center w-14">
                  <div className="text-2xs uppercase text-surface-400">
                    {new Date(s.date_debut).toLocaleDateString('fr-FR', { month: 'short' })}
                  </div>
                  <div className="text-xl font-heading font-bold text-brand-600">
                    {new Date(s.date_debut).getDate()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{s.formation?.intitule || s.intitule || '—'}</div>
                  <div className="text-xs text-surface-500 mt-0.5 truncate">
                    {s.reference} · {s.lieu || 'Non défini'}
                    {s.horaires && ` · ${s.horaires}`}
                  </div>
                </div>
                <Badge variant={s.status === 'en_cours' ? 'success' : 'info'}>
                  {s.status === 'en_cours' ? 'En cours' : 'À venir'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expertise */}
      {context.formateur.domaines_expertise && context.formateur.domaines_expertise.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Domaines d'expertise</h2>
          <div className="flex flex-wrap gap-2">
            {context.formateur.domaines_expertise.map((d) => (
              <Badge key={d} variant="info">{d}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
