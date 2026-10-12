'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users, GraduationCap, CheckCircle2, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, Search } from '@/components/ui/icons'
import { useToast, AdresseGroupe, AdresseInput, CodePostalInput, VilleInput } from '@/components/ui'
import { cn } from '@/lib/utils'
import { creerDossierCompletAction } from './actions'

// Collage « 12/05/1985 » dans un champ date natif (refusé par le navigateur sinon)
function collerDateNative(e: React.ClipboardEvent<HTMLInputElement>) {
  const t = e.clipboardData.getData('text').trim()
  const m = t.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})$/)
  const iso = m ? `${m[3].length === 2 ? (Number(m[3]) > 30 ? '19' : '20') + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (/^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null)
  if (!iso) return
  e.preventDefault()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(e.currentTarget, iso)
  e.currentTarget.dispatchEvent(new Event('input', { bubbles: true }))
  e.currentTarget.dispatchEvent(new Event('change', { bubbles: true }))
}


interface ClientRef { id: string; raison_sociale: string | null; nom_commercial: string | null; siret: string | null; ville: string | null }
interface FormationRef { id: string; intitule: string; duree_heures: number | null; duree_jours: number | null }
interface FormateurRef { id: string; prenom: string | null; nom: string | null }
interface ApprenantLigne {
  prenom: string; nom: string; email: string; poste: string
  civilite: string; sexe: string; telephone: string
  date_naissance: string; lieu_naissance: string; numero_securite_sociale: string
  adresse: string; code_postal: string; ville: string; type_contrat: string
  situation_handicap: boolean; type_handicap: string; besoins_adaptation: string
}

const LIGNE_VIDE: ApprenantLigne = {
  prenom: '', nom: '', email: '', poste: '',
  civilite: '', sexe: '', telephone: '',
  date_naissance: '', lieu_naissance: '', numero_securite_sociale: '',
  adresse: '', code_postal: '', ville: '', type_contrat: '',
  situation_handicap: false, type_handicap: '', besoins_adaptation: '',
}

const ETAPES = [
  { n: 1, label: 'Client', Icon: Building2 },
  { n: 2, label: 'Apprenants', Icon: Users },
  { n: 3, label: 'Formation', Icon: GraduationCap },
]

/**
 * Assistant « nouveau dossier » : client (existant ou créé, SIRET → fiche
 * préremplie) → apprenants → formation + dates → session créée avec ses
 * inscriptions, direction la fiche session.
 */
export function NouveauDossierWizard({ clients, formations, formateurs }: {
  clients: ClientRef[]
  formations: FormationRef[]
  formateurs: FormateurRef[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [etape, setEtape] = useState(1)
  const [envoi, setEnvoi] = useState(false)

  // Étape 1 — client
  const [modeClient, setModeClient] = useState<'existant' | 'nouveau'>('existant')
  const [recherche, setRecherche] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [siret, setSiret] = useState('')
  const [chargeSiret, setChargeSiret] = useState(false)
  const [nc, setNc] = useState({ raison: '', email: '', telephone: '', adresse: '', code_postal: '', ville: '' })
  const [contact, setContact] = useState({ prenom: '', nom: '', email: '', telephone: '' })

  // Étape 2 — apprenants (fiche complète dépliable par ligne)
  const [apprenants, setApprenants] = useState<ApprenantLigne[]>([{ ...LIGNE_VIDE }])
  const [detailOuvert, setDetailOuvert] = useState<number | null>(null)
  const majApprenant = (i: number, patch: Partial<ApprenantLigne>) =>
    setApprenants((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  // Étape 3 — formation
  const [rechercheFormation, setRechercheFormation] = useState('')
  const [formationId, setFormationId] = useState<string | null>(null)
  // Financement du dossier : OPCO (défaut) ou AGEFICE (dirigeant indépendant)
  const [financement, setFinancement] = useState<'opco' | 'agefice'>(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('financement') === 'agefice' ? 'agefice' : 'opco',
  )
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [formateurId, setFormateurId] = useState('')

  const clientsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return clients.slice(0, 8)
    return clients.filter((c) => `${c.raison_sociale || ''} ${c.nom_commercial || ''} ${c.siret || ''}`.toLowerCase().includes(q)).slice(0, 8)
  }, [clients, recherche])

  const formationsFiltrees = useMemo(() => {
    const q = rechercheFormation.trim().toLowerCase()
    if (!q) return formations.slice(0, 10)
    return formations.filter((f) => f.intitule.toLowerCase().includes(q)).slice(0, 10)
  }, [formations, rechercheFormation])

  const clientChoisi = clients.find((c) => c.id === clientId)
  const formationChoisie = formations.find((f) => f.id === formationId)
  const apprenantsValides = apprenants.filter((a) => (a.nom || a.prenom).trim())

  async function chercherSiret() {
    const s = siret.replace(/\s/g, '')
    if (!/^\d{14}$/.test(s)) { toast('error', 'SIRET : 14 chiffres attendus'); return }
    setChargeSiret(true)
    try {
      const r = await fetch(`/api/public/entreprise?siret=${s}`)
      const d = await r.json()
      if (!r.ok) toast('error', d.error || 'Entreprise introuvable')
      else {
        setNc((v) => ({ ...v, raison: d.nom || v.raison, adresse: d.adresse || v.adresse }))
        toast('success', `Fiche préremplie : ${d.nom}`)
      }
    } catch { toast('error', 'Recherche indisponible') }
    setChargeSiret(false)
  }

  const etape1Ok = modeClient === 'existant' ? !!clientId : !!nc.raison.trim()
  const etape2Ok = apprenantsValides.length > 0
  const etape3Ok = !!formationId && !!dateDebut

  async function creer() {
    setEnvoi(true)
    const fd = new FormData()
    if (modeClient === 'existant') fd.set('client_id', clientId || '')
    else {
      fd.set('nouveau_client', 'oui')
      fd.set('client_raison_sociale', nc.raison)
      fd.set('client_siret', siret)
      fd.set('client_email', nc.email)
      fd.set('client_telephone', nc.telephone)
      fd.set('client_adresse', nc.adresse)
      fd.set('client_code_postal', nc.code_postal)
      fd.set('client_ville', nc.ville)
      fd.set('contact_prenom', contact.prenom)
      fd.set('contact_nom', contact.nom)
      fd.set('contact_email', contact.email)
      fd.set('contact_telephone', contact.telephone)
    }
    fd.set('apprenants', JSON.stringify(apprenantsValides))
    fd.set('formation_id', formationId || '')
    fd.set('date_debut', dateDebut)
    fd.set('date_fin', dateFin || dateDebut)
    fd.set('formateur_id', formateurId)
    fd.set('financement', financement)
    const r = await creerDossierCompletAction(fd)
    setEnvoi(false)
    if (r.success && r.data?.sessionId) {
      toast('success', 'Dossier créé — session prête')
      router.push(`/dashboard/sessions/${r.data.sessionId}`)
    } else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Nouveau dossier</h1>
        <p className="text-sm text-surface-500 mt-1">
          Client, apprenants, formation : la session se crée en un geste avec ses inscriptions.
        </p>
      </div>

      {/* Étapes */}
      <div className="flex items-center gap-2">
        {ETAPES.map((e, i) => (
          <div key={e.n} className="flex items-center gap-2">
            <button onClick={() => e.n < etape && setEtape(e.n)}
              className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                etape === e.n ? 'bg-surface-900 text-white'
                : e.n < etape ? 'bg-emerald-50 text-emerald-700 cursor-pointer' : 'bg-surface-100 text-surface-400')}>
              {e.n < etape ? <CheckCircle2 className="h-4 w-4" /> : <e.Icon className="h-4 w-4" />}
              {e.label}
            </button>
            {i < ETAPES.length - 1 && <span className="h-px w-6 bg-surface-200" />}
          </div>
        ))}
      </div>

      {etape === 1 && (
        <div className="card p-5 space-y-4">
          <div className="flex gap-2">
            {[{ v: 'existant', l: 'Client existant' }, { v: 'nouveau', l: 'Nouveau client' }].map((o) => (
              <button key={o.v} onClick={() => setModeClient(o.v as any)}
                className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  modeClient === o.v ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
                {o.l}
              </button>
            ))}
          </div>

          {modeClient === 'existant' ? (
            <div>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un établissement…" className="input-base !pl-10" />
              </div>
              <div className="mt-3 divide-y divide-surface-50 rounded-xl border border-surface-100 overflow-hidden">
                {clientsFiltres.map((c) => (
                  <button key={c.id} onClick={() => setClientId(c.id)}
                    className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-3',
                      clientId === c.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-surface-50 text-surface-800')}>
                    <span className="font-medium truncate">{c.nom_commercial || c.raison_sociale}</span>
                    <span className="text-xs text-surface-400 shrink-0">{c.ville || c.siret || ''}</span>
                  </button>
                ))}
                {clientsFiltres.length === 0 && <div className="px-4 py-3 text-sm text-surface-400">Aucun résultat — créez un nouveau client.</div>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={siret} onChange={(e) => setSiret(e.target.value)} inputMode="numeric"
                  placeholder="SIRET (préremplit la fiche)" className="input-base flex-1" />
                <button onClick={chercherSiret} disabled={chargeSiret} className="btn-secondary !px-4 shrink-0 disabled:opacity-50">
                  {chargeSiret ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechercher'}
                </button>
              </div>
              <input value={nc.raison} onChange={(e) => setNc({ ...nc, raison: e.target.value })} placeholder="Raison sociale *" className="input-base" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder="Email établissement" className="input-base" />
                <input value={nc.telephone} onChange={(e) => setNc({ ...nc, telephone: e.target.value })} placeholder="Téléphone" className="input-base" />
              </div>
              <div className="grid sm:grid-cols-[1fr,120px,1fr] gap-3">
                <AdresseGroupe>
                  <AdresseInput value={nc.adresse} onChange={(e) => setNc({ ...nc, adresse: e.target.value })} placeholder="Adresse" />
                  <CodePostalInput value={nc.code_postal} onChange={(e) => setNc({ ...nc, code_postal: e.target.value })} placeholder="CP" />
                  <VilleInput value={nc.ville} onChange={(e) => setNc({ ...nc, ville: e.target.value })} placeholder="Ville" />
                </AdresseGroupe>
              </div>
              <div className="pt-2 border-t border-surface-100">
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2.5">Contact référent (recommandé)</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={contact.prenom} onChange={(e) => setContact({ ...contact, prenom: e.target.value })} placeholder="Prénom" className="input-base" />
                  <input value={contact.nom} onChange={(e) => setContact({ ...contact, nom: e.target.value })} placeholder="Nom" className="input-base" />
                  <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email (convocations, signatures)" className="input-base" />
                  <input value={contact.telephone} onChange={(e) => setContact({ ...contact, telephone: e.target.value })} placeholder="Téléphone" className="input-base" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => setEtape(2)} disabled={!etape1Ok}
              className="btn-primary inline-flex items-center gap-2 !py-2.5 !px-5 text-sm disabled:opacity-40">
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {etape === 2 && (
        <div className="card p-5 space-y-3">
          <div className="text-sm text-surface-600">
            Les apprenants sont rattachés à <strong className="text-surface-900">{modeClient === 'existant' ? (clientChoisi?.nom_commercial || clientChoisi?.raison_sociale) : nc.raison}</strong>.
          </div>
          {apprenants.map((a, i) => (
            <div key={i} className="rounded-xl border border-surface-100">
              <div className="grid grid-cols-[1fr,1fr,1.2fr,1fr,auto,36px] gap-2 items-center p-2">
                <input value={a.prenom} onChange={(e) => majApprenant(i, { prenom: e.target.value })} placeholder="Prénom" className="input-base !py-2" />
                <input value={a.nom} onChange={(e) => majApprenant(i, { nom: e.target.value })} placeholder="Nom *" className="input-base !py-2" />
                <input value={a.email} onChange={(e) => majApprenant(i, { email: e.target.value })} placeholder="Email (portail)" className="input-base !py-2" />
                <input value={a.poste} onChange={(e) => majApprenant(i, { poste: e.target.value })} placeholder="Poste" className="input-base !py-2" />
                <button onClick={() => setDetailOuvert(detailOuvert === i ? null : i)}
                  className={cn('px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                    detailOuvert === i ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
                  Détails
                </button>
                <button onClick={() => { setApprenants(apprenants.filter((_, j) => j !== i)); if (detailOuvert === i) setDetailOuvert(null) }}
                  disabled={apprenants.length === 1}
                  className="h-9 w-9 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 flex items-center justify-center">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {detailOuvert === i && (
                <div className="border-t border-surface-100 bg-surface-50/40 p-3 space-y-3">
                  <div className="grid sm:grid-cols-4 gap-2.5">
                    <select value={a.civilite} onChange={(e) => majApprenant(i, { civilite: e.target.value })} className="input-base !py-2">
                      <option value="">Civilité</option><option value="M.">M.</option><option value="Mme">Mme</option>
                    </select>
                    <select value={a.sexe} onChange={(e) => majApprenant(i, { sexe: e.target.value })} className="input-base !py-2">
                      <option value="">Sexe</option><option value="H">Homme</option><option value="F">Femme</option>
                    </select>
                    <input value={a.telephone} onChange={(e) => majApprenant(i, { telephone: e.target.value })} placeholder="Téléphone" className="input-base !py-2" />
                    <input value={a.type_contrat} onChange={(e) => majApprenant(i, { type_contrat: e.target.value })} placeholder="Contrat (CDI, CDD…)" className="input-base !py-2" />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    <label className="text-xs text-surface-500">Date de naissance
                      <input type="date" onPaste={collerDateNative} value={a.date_naissance} onChange={(e) => majApprenant(i, { date_naissance: e.target.value })} className="input-base !py-2 mt-1" />
                    </label>
                    <label className="text-xs text-surface-500">Lieu de naissance
                      <VilleInput autonome value={a.lieu_naissance} onChange={(e) => majApprenant(i, { lieu_naissance: e.target.value })} className="!py-2" conteneurClassName="mt-1" />
                    </label>
                    <label className="text-xs text-surface-500">N° de sécurité sociale
                      <input value={a.numero_securite_sociale} onChange={(e) => majApprenant(i, { numero_securite_sociale: e.target.value })} className="input-base !py-2 mt-1" />
                    </label>
                  </div>
                  <div className="grid sm:grid-cols-[2fr,100px,1fr] gap-2.5">
                    <AdresseGroupe>
                      <AdresseInput value={a.adresse} onChange={(e) => majApprenant(i, { adresse: e.target.value })} placeholder="Adresse" className="!py-2" />
                      <CodePostalInput value={a.code_postal} onChange={(e) => majApprenant(i, { code_postal: e.target.value })} placeholder="CP" className="!py-2" />
                      <VilleInput value={a.ville} onChange={(e) => majApprenant(i, { ville: e.target.value })} placeholder="Ville" className="!py-2" />
                    </AdresseGroupe>
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm text-surface-700">
                      <input type="checkbox" checked={a.situation_handicap}
                        onChange={(e) => majApprenant(i, { situation_handicap: e.target.checked })}
                        className="h-4 w-4 accent-surface-900" />
                      Situation de handicap (le référent handicap est prévenu)
                    </label>
                    {a.situation_handicap && (
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        <input value={a.type_handicap} onChange={(e) => majApprenant(i, { type_handicap: e.target.value })} placeholder="Type (visuel, moteur…)" className="input-base !py-2" />
                        <input value={a.besoins_adaptation} onChange={(e) => majApprenant(i, { besoins_adaptation: e.target.value })} placeholder="Besoins d'adaptation" className="input-base !py-2" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setApprenants([...apprenants, { ...LIGNE_VIDE }])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            <Plus className="h-4 w-4" /> Ajouter un apprenant
          </button>
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setEtape(1)} className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800"><ArrowLeft className="h-4 w-4" /> Retour</button>
            <button onClick={() => setEtape(3)} disabled={!etape2Ok}
              className="btn-primary inline-flex items-center gap-2 !py-2.5 !px-5 text-sm disabled:opacity-40">
              Continuer ({apprenantsValides.length} apprenant{apprenantsValides.length > 1 ? 's' : ''}) <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {etape === 3 && (
        <div className="card p-5 space-y-4">
          <div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input value={rechercheFormation} onChange={(e) => setRechercheFormation(e.target.value)}
                placeholder="Rechercher une formation…" className="input-base !pl-10" />
            </div>
            <div className="mt-3 max-h-56 overflow-y-auto divide-y divide-surface-50 rounded-xl border border-surface-100">
              {formationsFiltrees.map((f) => (
                <button key={f.id} onClick={() => setFormationId(f.id)}
                  className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-3',
                    formationId === f.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-surface-50 text-surface-800')}>
                  <span className="font-medium truncate">{f.intitule}</span>
                  <span className="text-xs text-surface-400 shrink-0">{[f.duree_heures ? `${f.duree_heures} h` : null, f.duree_jours ? `${f.duree_jours} j` : null].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Financement : détermine le circuit administratif du dossier */}
          <div>
            <div className="text-xs text-surface-500 mb-1.5">Financement</div>
            <div className="flex gap-2">
              {([['opco', 'OPCO (salariés)'], ['agefice', 'AGEFICE (dirigeant indépendant)']] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setFinancement(v)}
                  className={cn('px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors',
                    financement === v ? 'bg-surface-900 text-white border-surface-900' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300')}>
                  {label}
                </button>
              ))}
            </div>
            {financement === 'agefice' && (
              <p className="text-[11px] text-surface-400 mt-1.5">
                Un dossier AGEFICE sera créé automatiquement — dépôt au Point d&apos;Accueil 15 j à 4 mois avant le début.
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-xs text-surface-500">Début *
              <input type="date" onPaste={collerDateNative} value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); if (!dateFin) setDateFin(e.target.value) }} className="input-base mt-1" />
            </label>
            <label className="text-xs text-surface-500">Fin
              <input type="date" onPaste={collerDateNative} value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} className="input-base mt-1" />
            </label>
            <label className="text-xs text-surface-500">Formateur (optionnel)
              <select value={formateurId} onChange={(e) => setFormateurId(e.target.value)} className="input-base mt-1">
                <option value="">— À affecter plus tard —</option>
                {formateurs.map((f) => <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>)}
              </select>
            </label>
          </div>

          {/* Récap */}
          {etape3Ok && (
            <div className="rounded-xl bg-surface-50 border border-surface-100 p-4 text-sm text-surface-700">
              <strong className="text-surface-900">{formationChoisie?.intitule}</strong>
              {' — '}{modeClient === 'existant' ? (clientChoisi?.nom_commercial || clientChoisi?.raison_sociale) : nc.raison}
              {' · '}{apprenantsValides.length} apprenant{apprenantsValides.length > 1 ? 's' : ''}
              {' · '}session intra en établissement{formateurId ? '' : ' · formateur à affecter'}{financement === 'agefice' ? ' · financement AGEFICE' : ''}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => setEtape(2)} className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800"><ArrowLeft className="h-4 w-4" /> Retour</button>
            <button onClick={creer} disabled={!etape3Ok || envoi}
              className="btn-primary inline-flex items-center gap-2 !py-2.5 !px-5 text-sm disabled:opacity-40">
              {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Créer le dossier
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
