import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFranchiseSession } from '@/lib/franchise-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { commissionStatusLabel } from '@/lib/commission'
import { estFormationHygiene } from '@/lib/formation-hygiene'
import { etatSession, aujourdhuiParis } from '@/lib/franchise-data'
import {
  ArrowLeft, Building2, MapPin, GraduationCap, Banknote, Users, FileText,
  Calendar, BadgeCheck, ShieldCheck, Download, ClipboardList,
} from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const fmtEuro = (n: number | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))

const STATUS_STYLE: Record<string, string> = {
  a_venir: 'bg-surface-100 text-surface-600',
  validee: 'bg-blue-50 text-blue-700',
  payee: 'bg-emerald-50 text-emerald-700',
  annulee: 'bg-rose-50 text-rose-700',
}

const ETAT_STYLE: Record<string, { label: string; cls: string }> = {
  a_venir: { label: 'À venir', cls: 'bg-violet-50 text-violet-700' },
  en_cours: { label: 'En cours', cls: 'bg-blue-50 text-blue-700' },
  terminee: { label: 'Terminée', cls: 'bg-emerald-50 text-emerald-700' },
}

const jourCourt = (d: string | null) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const periode = (a: string | null, b: string | null) => (!a ? 'Dates à venir' : b && b !== a ? `${jourCourt(a)} au ${jourCourt(b)}` : jourCourt(a))

function initials(nom: string | null, prenom: string | null) {
  return ((nom?.[0] || '') + (prenom?.[0] || '')).toUpperCase() || '?'
}

export default async function FranchiseEtablissementDetail({ params }: { params: { id: string } }) {
  const { franchise, organization } = await getFranchiseSession()
  const supabase = await createServiceRoleClient()
  const orgId = organization.id

  // Sécurité : le client doit appartenir à la franchise
  const { data: client } = await supabase
    .from('clients')
    .select('id, raison_sociale, ville, code_postal, adresse, secteur_activite, siret, franchise_id')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (!client || client.franchise_id !== franchise.id) notFound()

  const { getFranchiseAudits } = await import('@/lib/franchise-data')
  const auditsReseau = await getFranchiseAudits(supabase, franchise.id, orgId)
  const audits = auditsReseau.get(client.id) || null

  const [{ data: sessionsBrutes }, { data: apprenants }, { data: lignes }, { data: poeis }] = await Promise.all([
    supabase.from('sessions')
      .select('id, reference, intitule, date_debut, date_fin, poei_intervention_id, dendreo_id, formation:formation_id(intitule, categorie)')
      .eq('client_id', client.id).eq('organization_id', orgId).neq('status', 'annulee'),
    supabase
      .from('apprenants')
      .select('id, nom, prenom, civilite, poste')
      .eq('client_id', client.id)
      .eq('organization_id', orgId)
      .order('nom'),
    supabase.from('commissions_sessions').select('session_id, base_montant, commission_montant, status')
      .eq('client_id', client.id).eq('organization_id', orgId).neq('status', 'annulee'),
    supabase.from('poei').select('id, numero, session_id, date_debut, date_fin')
      .eq('client_id', client.id).eq('organization_id', orgId),
  ])
  const sessions = (sessionsBrutes || []) as any[]
  const ids = sessions.map((x) => x.id)
  const ivIds = sessions.map((x) => x.poei_intervention_id).filter(Boolean)
  const [{ data: rapports }, { data: inscriptions }, { data: interventions }] = await Promise.all([
    ids.length
      ? supabase.from('rapports_session').select('session_id, submitted_at, formateur:formateur_id(prenom, nom)').in('session_id', ids).in('status', ['soumis', 'valide'])
      : Promise.resolve({ data: [] as any[] }),
    ids.length
      ? supabase.from('inscriptions').select('session_id').in('session_id', ids).not('status', 'in', '("annule","abandonne")')
      : Promise.resolve({ data: [] as any[] }),
    ivIds.length
      ? supabase.from('poei_interventions').select('id, poei_id').in('id', ivIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Regroupement : une formation par session, un parcours POEI pour toutes ses sessions
  const poeiDeSession = new Map<string, string>()
  for (const p of (poeis || []) as any[]) if (p.session_id) poeiDeSession.set(p.session_id, p.id)
  const poeiDeIv = new Map(((interventions || []) as any[]).map((i) => [i.id, i.poei_id]))
  for (const x of sessions) if (x.poei_intervention_id && poeiDeIv.get(x.poei_intervention_id)) poeiDeSession.set(x.id, poeiDeIv.get(x.poei_intervention_id))
  const ligneDe = new Map(((lignes || []) as any[]).map((l) => [l.session_id, l]))
  const inscritsDe = new Map<string, number>()
  for (const i of (inscriptions || []) as any[]) inscritsDe.set(i.session_id, (inscritsDe.get(i.session_id) || 0) + 1)
  const aujourdhui = aujourdhuiParis()

  type Formation = {
    cle: string; titre: string; debut: string | null; fin: string | null; etat: 'a_venir' | 'en_cours' | 'terminee'
    stagiaires: number; base: number; commission: number | null; statutCommission: string | null
    hygiene: string | null; comptesRendus: { sessionId: string; formateur: string; le: string | null }[]
    /** Formation d'hygiène (session d'hygiène ou parcours POEI) */
    estHygiene: boolean
    /** Formation venue de Dendreo : ses documents y ont été produits et sont importés à part */
    dendreo: boolean
  }
  const groupes = new Map<string, any[]>()
  for (const x of sessions) {
    const cle = poeiDeSession.get(x.id) ? `poei:${poeiDeSession.get(x.id)}` : `s:${x.id}`
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle)!.push(x)
  }
  const formations: Formation[] = Array.from(groupes.entries()).map(([cle, ss]) => {
    const poei = cle.startsWith('poei:') ? ((poeis || []) as any[]).find((p) => p.id === cle.slice(5)) : null
    const premiere = [...ss].sort((a, b) => String(a.date_debut || '9').localeCompare(String(b.date_debut || '9')))[0]
    const rep = (poei && ss.find((x) => x.id === poei.session_id)) || premiere
    const f = Array.isArray(rep.formation) ? rep.formation[0] : rep.formation
    const debut = poei?.date_debut || rep.date_debut
    const fin = poei?.date_fin || ss.map((x) => x.date_fin || x.date_debut).filter(Boolean).sort().pop() || rep.date_fin
    const etat = etatSession({ date_debut: debut, date_fin: fin }, aujourdhui)
    const lignesGroupe = ss.map((x) => ligneDe.get(x.id)).filter(Boolean) as any[]
    const dendreo = ss.some((x) => x.dendreo_id || /^ADF_/i.test(String(x.reference || '')))
    const estHygiene = !!poei || estFormationHygiene(f)
    return {
      cle,
      titre: `${poei ? 'POEI · ' : ''}${f?.intitule || rep.intitule || 'Formation'}`,
      debut, fin, etat,
      stagiaires: Math.max(0, ...ss.map((x) => inscritsDe.get(x.id) || 0)),
      base: lignesGroupe.reduce((t, l) => t + Number(l.base_montant || 0), 0),
      commission: lignesGroupe.length ? lignesGroupe.reduce((t, l) => t + Number(l.commission_montant || 0), 0) : null,
      statutCommission: lignesGroupe[0]?.status || null,
      // Attestations d'hygiène, une fois la formation terminée : le module
      // hygiène d'une POEI, ou une session d'hygiène alimentaire
      estHygiene,
      dendreo,
      hygiene: etat !== 'terminee' || dendreo || !ss.some((x) => (inscritsDe.get(x.id) || 0) > 0) ? null
        : poei ? `/api/pdf/attestation-hygiene?poei=${poei.id}`
          : estFormationHygiene(f) ? `/api/pdf/attestation-hygiene?session=${rep.id}` : null,
      comptesRendus: ((rapports || []) as any[]).filter((r) => ss.some((x) => x.id === r.session_id)).map((r) => ({
        sessionId: r.session_id,
        formateur: r.formateur ? `${r.formateur.prenom || ''} ${r.formateur.nom || ''}`.trim() : 'Formateur',
        le: r.submitted_at,
      })),
    }
  })
    // Une session terminée sans aucun stagiaire n'est pas une formation délivrée (doublon d'import)
    .filter((f) => !(f.etat === 'terminee' && f.stagiaires === 0))
    .sort((a, b) => String(b.debut || '').localeCompare(String(a.debut || '')))

  const apps = apprenants || []
  const pec = formations.reduce((t, f) => t + f.base, 0)
  const comm = formations.reduce((t, f) => t + (f.commission || 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/franchise/etablissements" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700">
        <ArrowLeft className="h-4 w-4" /> Mes établissements
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">{client.raison_sociale}</h1>
          <p className="text-surface-500 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
            {(client.code_postal || client.ville || client.adresse) && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[client.adresse, client.code_postal, client.ville].filter(Boolean).join(' ')}</span>
            )}
            {client.secteur_activite && <span>· {client.secteur_activite}</span>}
            {client.siret && <span className="font-mono text-xs">· SIRET {client.siret}</span>}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={GraduationCap} tint="brand" value={String(formations.length)} label="Formations" />
        <Stat icon={Users} tint="violet" value={String(apps.length)} label="Stagiaires" />
        <Stat icon={FileText} tint="blue" value={fmtEuro(pec)} label="Budget des formations" />
        <Stat icon={Banknote} tint="amber" value={fmtEuro(comm)} label="Commission générée TTC" />
      </div>

      {/* Un audit d'entrée et un audit de sortie par établissement formé */}
      {formations.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([['Audit d’entrée', audits?.entree || null], ['Audit de sortie', audits?.sortie || null]] as const).map(([titre, a]) => (
            <div key={titre} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-surface-900">{titre}</div>
                  <div className="text-xs text-surface-500">
                    {a ? [a.date ? new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null, a.mention].filter(Boolean).join(' · ') : 'Pas encore dans votre espace'}
                  </div>
                </div>
              </div>
              {a ? (
                <div className="text-sm font-heading font-bold text-surface-900 tabular-nums shrink-0">{a.score != null ? `${a.score}/100` : '—'}</div>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">En cours d’importation</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Audits hygiène : la photo d'entrée, puis ce qui a bougé */}
      {audits && audits.historique.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="text-sm font-heading font-semibold text-surface-900">
              Audits hygiène ({audits.nb})
            </div>
            {audits.entree?.score != null && audits.sortie?.score != null && (
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="text-surface-400 tabular-nums">{audits.entree.score}</span>
                <span className="text-surface-300">→</span>
                <span className="font-heading font-bold text-surface-900 tabular-nums">{audits.sortie.score}</span>
                <span className="text-xs text-surface-500">sur 100</span>
                {audits.gain != null && audits.gain > 0 && (
                  <span className="text-sm font-semibold text-emerald-600">+{audits.gain} points</span>
                )}
              </span>
            )}
          </div>
          <div className="card divide-y divide-surface-100">
            {audits.historique.map((a, i) => (
              <div key={`${a.rapport}-${i}`} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{a.type || 'Audit hygiène'}</div>
                  <div className="text-xs text-surface-500">
                    {a.date ? new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                    {a.rapport ? ` · ${a.rapport}` : ''}
                  </div>
                </div>
                {a.mention && (
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-md shrink-0 ${
                    /SATISFAISANT/i.test(a.mention) ? 'bg-emerald-50 text-emerald-700'
                      : /INSUFFISANT/i.test(a.mention) ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700'}`}>
                    {a.mention}
                  </span>
                )}
                <div className="text-sm font-heading font-bold text-surface-900 tabular-nums shrink-0 w-14 text-right">
                  {a.score != null ? `${a.score}/100` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formations de l'établissement, avec leurs documents */}
      <div>
        <div className="text-sm font-heading font-semibold text-surface-900 mb-2">Formations ({formations.length})</div>
        {formations.length === 0 ? (
          <div className="card p-6 text-center text-sm text-surface-400">Aucune formation pour cet établissement.</div>
        ) : (
          <div className="space-y-2">
            {formations.map((f) => {
              const e = ETAT_STYLE[f.etat]
              const cs = STATUS_STYLE[f.statutCommission || 'a_venir'] || STATUS_STYLE.a_venir
              return (
                <div key={f.cle} className="card p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-surface-900">{f.titre}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${e.cls}`}>{e.label}</span>
                      </div>
                      <div className="text-xs text-surface-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{periode(f.debut, f.fin)}</span>
                        {f.stagiaires > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{f.stagiaires} stagiaire{f.stagiaires > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    {f.commission != null && (
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-amber-600 tabular-nums">{fmtEuro(f.commission)}</div>
                        <div className="text-[11px] text-surface-400">votre commission</div>
                      </div>
                    )}
                  </div>
                  {(f.hygiene || f.comptesRendus.length > 0 || f.commission != null || f.etat === 'terminee') && (
                    <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-2 text-xs flex-wrap">
                      {f.hygiene && (
                        <a href={f.hygiene} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 font-medium text-surface-700 hover:bg-surface-50">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Attestations d&apos;hygiène (PDF)
                        </a>
                      )}
                      {f.comptesRendus.map((c) => (
                        <a key={c.sessionId} href={`/api/pdf/compte-rendu/${c.sessionId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 font-medium text-surface-700 hover:bg-surface-50">
                          <ClipboardList className="h-3.5 w-3.5 text-brand-600" /> Compte rendu de {c.formateur}
                          <Download className="h-3 w-3 text-surface-400" />
                        </a>
                      ))}
                      {f.etat === 'terminee' && f.estHygiene && !f.hygiene && (
                        // Formation venue de Dendreo : ses attestations y ont été produites et sont importées à part
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 font-medium text-amber-700">
                          <ShieldCheck className="h-3.5 w-3.5" /> Attestations d&apos;hygiène : en cours d&apos;importation
                        </span>
                      )}
                      {f.etat === 'terminee' && f.comptesRendus.length === 0 && (
                        // Bilan envoyé par mail ou resté dans Dendreo : il est importé à la main
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 font-medium text-amber-700">
                          <ClipboardList className="h-3.5 w-3.5" /> Compte rendu : en cours d&apos;importation
                        </span>
                      )}
                      {f.commission != null && (
                        <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cs}`}>
                          <BadgeCheck className="h-3 w-3" /> Commission {commissionStatusLabel(f.statutCommission as any).toLowerCase()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stagiaires */}
      <div>
        <div className="text-sm font-heading font-semibold text-surface-900 mb-2">
          Stagiaires formés ({apps.length})
        </div>
        {apps.length === 0 ? (
          <div className="card p-6 text-center text-sm text-surface-400">Aucun stagiaire enregistré pour cet établissement.</div>
        ) : (
          <div className="card p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {apps.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-50">
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials(a.nom, a.prenom)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      {[a.prenom, a.nom].filter(Boolean).join(' ') || 'Stagiaire'}
                    </div>
                    {a.poste && <div className="text-[11px] text-surface-400 truncate">{a.poste}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, tint, value, label }: { icon: any; tint: string; value: string; label: string }) {
  const tints: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600', violet: 'bg-violet-50 text-violet-600',
    blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="card p-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tints[tint]}`}><Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></div>
      <div className="text-xl font-heading font-bold text-surface-900 mt-3 tabular-nums truncate">{value}</div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
    </div>
  )
}
