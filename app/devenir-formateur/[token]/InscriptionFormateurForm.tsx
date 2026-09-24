'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DOMAINES_FORMATEUR, CERTIFICATIONS_FORMATEUR, STATUTS_FORMATEUR, CV_TAILLE_MAX, CV_TYPES,
  type InscriptionFormateur,
} from '@/lib/inscription-formateur'
import { preparerDepotCvAction, soumettreInscriptionFormateurAction } from './actions'
import { Check, CheckCircle2, FileText, Loader2, Upload, X, AlertCircle } from '@/components/ui/icons'

const VIDE: InscriptionFormateur = {
  civilite: '', prenom: '', nom: '', email: '', telephone: '',
  adresse: '', code_postal: '', ville: '',
  type_contrat: 'sous_traitance', siret: '', numero_da: '', taux_tva: null,
  domaines: [], domaines_autres: '', certifications: [], certifications_autres: '',
  diplomes: '', experience: '', zone_intervention: '', disponibilites: '',
  tarif_journalier: null, tarif_horaire: null, bio: '',
  cv_path: null, cv_nom: null, consentement: false,
}

export function InscriptionFormateurForm({ token, orgNom, orgLogo }: { token: string; orgNom: string; orgLogo: string | null }) {
  const [f, setF] = useState<InscriptionFormateur>(VIDE)
  const [pot, setPot] = useState('')
  const t0 = useRef(Date.now())
  const [cvEtat, setCvEtat] = useState<'vide' | 'envoi' | 'ok'>('vide')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [fini, setFini] = useState<null | 'cree' | 'complete'>(null)
  const fichier = useRef<HTMLInputElement>(null)

  const maj = <K extends keyof InscriptionFormateur>(k: K, v: InscriptionFormateur[K]) => setF((p) => ({ ...p, [k]: v }))
  const bascule = (k: 'domaines' | 'certifications', v: string) =>
    setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }))

  async function deposerCv(file: File | undefined) {
    if (!file) return
    setErreur(null)
    if (!CV_TYPES.includes(file.type)) { setErreur('Le CV doit être un fichier PDF ou Word (.doc, .docx).'); return }
    if (file.size > CV_TAILLE_MAX) { setErreur('Le CV ne doit pas dépasser 8 Mo.'); return }
    setCvEtat('envoi')
    const prep = await preparerDepotCvAction(token, file.name, file.size, file.type)
    if (!prep.success || !prep.data) { setCvEtat('vide'); setErreur(prep.error || 'Le dépôt du CV a échoué.'); return }
    const { error } = await createClient().storage.from('documents')
      .uploadToSignedUrl(prep.data.path, prep.data.jeton, file, { contentType: file.type })
    if (error) { setCvEtat('vide'); setErreur('Le dépôt du CV a échoué. Réessayez.'); return }
    setF((p) => ({ ...p, cv_path: prep.data!.path, cv_nom: file.name }))
    setCvEtat('ok')
  }

  function retirerCv() {
    setF((p) => ({ ...p, cv_path: null, cv_nom: null }))
    setCvEtat('vide')
    if (fichier.current) fichier.current.value = ''
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    if (!f.domaines.length && !f.domaines_autres.trim()) { setErreur('Choisissez au moins un domaine d’intervention.'); return }
    if (!f.consentement) { setErreur('Merci d’accepter l’enregistrement de vos informations.'); return }
    if (cvEtat === 'envoi') { setErreur('Le CV est encore en cours d’envoi, patientez un instant.'); return }
    setEnvoi(true)
    const r = await soumettreInscriptionFormateurAction(token, f, { t0: t0.current, pot })
    setEnvoi(false)
    if (!r.success) { setErreur(r.error || 'L’envoi a échoué. Réessayez.'); return }
    setFini(r.data?.resultat || 'cree')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const entete = (
    <header className="bg-brand-500 text-white">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-3">
          {orgLogo
            ? <img src={orgLogo} alt={orgNom} className="h-10 w-auto" />
            : <span className="font-heading font-extrabold text-lg tracking-tight">{orgNom}</span>}
        </div>
        <h1 className="mt-5 font-heading text-2xl sm:text-3xl font-bold leading-tight text-balance !text-white">Rejoignez notre réseau de formateurs</h1>
        <p className="mt-2 text-sm sm:text-base text-white/80 max-w-xl">
          Renseignez votre profil une fois : vos domaines, vos tarifs et votre CV arrivent directement chez {orgNom}.
          Nous vous contactons dès qu&apos;une mission correspond à votre profil.
        </p>
      </div>
    </header>
  )

  if (fini) {
    return (
      <div className="min-h-screen bg-surface-50">
        {entete}
        <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
          <div className="card p-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-accent-400/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-brand-500" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-bold text-surface-900">
              {fini === 'cree' ? 'Merci, votre fiche est enregistrée' : 'Merci, votre fiche est à jour'}
            </h2>
            <p className="mt-2 text-sm text-surface-600">
              L&apos;équipe de {orgNom} a bien reçu vos informations{f.cv_path ? ' et votre CV' : ''}.
              Un email de confirmation vient de vous être envoyé à {f.email}.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {entete}
      <form onSubmit={envoyer} className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Champ piège pour les robots, invisible */}
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label>Site web<input tabIndex={-1} autoComplete="off" value={pot} onChange={(e) => setPot(e.target.value)} /></label>
        </div>

        <Bloc titre="Vous" aide="Pour vous joindre et vous envoyer vos ordres de mission.">
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Champ label="Civilité">
              <select className="input-base" value={f.civilite} onChange={(e) => maj('civilite', e.target.value)}>
                <option value="">—</option><option value="Mme">Mme</option><option value="M.">M.</option>
              </select>
            </Champ>
            <Champ label="Prénom" requis>
              <input className="input-base" required autoComplete="given-name" value={f.prenom} onChange={(e) => maj('prenom', e.target.value)} />
            </Champ>
          </div>
          <Champ label="Nom" requis>
            <input className="input-base" required autoComplete="family-name" value={f.nom} onChange={(e) => maj('nom', e.target.value)} />
          </Champ>
          <div className="grid sm:grid-cols-2 gap-3">
            <Champ label="Email" requis>
              <input className="input-base" type="email" required autoComplete="email" value={f.email} onChange={(e) => maj('email', e.target.value)} />
            </Champ>
            <Champ label="Téléphone" requis>
              <input className="input-base" type="tel" required autoComplete="tel" value={f.telephone} onChange={(e) => maj('telephone', e.target.value)} />
            </Champ>
          </div>
          <Champ label="Adresse">
            <input className="input-base" autoComplete="street-address" value={f.adresse} onChange={(e) => maj('adresse', e.target.value)} />
          </Champ>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Champ label="Code postal">
              <input className="input-base" inputMode="numeric" autoComplete="postal-code" value={f.code_postal} onChange={(e) => maj('code_postal', e.target.value)} />
            </Champ>
            <Champ label="Ville">
              <input className="input-base" autoComplete="address-level2" value={f.ville} onChange={(e) => maj('ville', e.target.value)} />
            </Champ>
          </div>
        </Bloc>

        <Bloc titre="Votre statut" aide="Pour établir votre contrat et vos factures.">
          <Champ label="Vous intervenez">
            <div className="grid gap-2">
              {STATUTS_FORMATEUR.map((s) => (
                <label key={s.value} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${f.type_contrat === s.value ? 'border-brand-500 bg-brand-50 text-surface-900' : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300'}`}>
                  <input type="radio" name="statut" className="accent-brand-500" checked={f.type_contrat === s.value} onChange={() => maj('type_contrat', s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
          </Champ>
          {f.type_contrat !== 'salarie' && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Champ label="SIRET" aide="14 chiffres">
                  <input className="input-base font-mono" inputMode="numeric" value={f.siret} onChange={(e) => maj('siret', e.target.value)} />
                </Champ>
                <Champ label="Numéro de déclaration d'activité" aide="Si vous en avez un">
                  <input className="input-base font-mono" value={f.numero_da} onChange={(e) => maj('numero_da', e.target.value)} />
                </Champ>
              </div>
              <Champ label="TVA">
                <div className="flex flex-wrap gap-2">
                  <Puce actif={f.taux_tva === 20} onClick={() => maj('taux_tva', f.taux_tva === 20 ? null : 20)}>Assujetti (20 %)</Puce>
                  <Puce actif={f.taux_tva === 0} onClick={() => maj('taux_tva', f.taux_tva === 0 ? null : 0)}>Franchise en base, pas de TVA</Puce>
                </div>
              </Champ>
            </>
          )}
        </Bloc>

        <Bloc titre="Vos domaines d'intervention" aide="Choisissez tout ce que vous pouvez animer.">
          <div className="flex flex-wrap gap-2">
            {DOMAINES_FORMATEUR.map((d) => <Puce key={d} actif={f.domaines.includes(d)} onClick={() => bascule('domaines', d)}>{d}</Puce>)}
          </div>
          <Champ label="Autres domaines" aide="Séparés par des virgules">
            <input className="input-base" value={f.domaines_autres} onChange={(e) => maj('domaines_autres', e.target.value)} placeholder="Ex. : traiteur, food truck" />
          </Champ>
        </Bloc>

        <Bloc titre="Vos certifications et diplômes">
          <div className="flex flex-wrap gap-2">
            {CERTIFICATIONS_FORMATEUR.map((c) => <Puce key={c} actif={f.certifications.includes(c)} onClick={() => bascule('certifications', c)}>{c}</Puce>)}
          </div>
          <Champ label="Autres certifications" aide="Séparées par des virgules">
            <input className="input-base" value={f.certifications_autres} onChange={(e) => maj('certifications_autres', e.target.value)} />
          </Champ>
          <Champ label="Diplômes" aide="Un par ligne">
            <textarea className="input-base min-h-[80px]" value={f.diplomes} onChange={(e) => maj('diplomes', e.target.value)} placeholder={'Ex. : BP Boucher\nBTS MHR'} />
          </Champ>
        </Bloc>

        <Bloc titre="Votre expérience">
          <Champ label="Parcours métier et expérience de formation">
            <textarea className="input-base min-h-[110px]" value={f.experience} onChange={(e) => maj('experience', e.target.value)}
              placeholder="Vos années en cuisine, en boucherie ou en salle, les publics que vous avez formés, les organismes pour lesquels vous intervenez…" />
          </Champ>
          <Champ label="Présentation courte" aide="Deux ou trois phrases, reprises dans vos fiches de présentation">
            <textarea className="input-base min-h-[80px]" value={f.bio} onChange={(e) => maj('bio', e.target.value)} />
          </Champ>
        </Bloc>

        <Bloc titre="Zone, disponibilités et tarifs">
          <Champ label="Zone d'intervention" aide="Départements ou villes où vous pouvez vous déplacer">
            <input className="input-base" value={f.zone_intervention} onChange={(e) => maj('zone_intervention', e.target.value)} placeholder="Ex. : Île-de-France, Oise, Lyon" />
          </Champ>
          <Champ label="Disponibilités">
            <input className="input-base" value={f.disponibilites} onChange={(e) => maj('disponibilites', e.target.value)} placeholder="Ex. : lundi et mardi, hors vacances scolaires" />
          </Champ>
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Tarif journalier HT">
              <Montant valeur={f.tarif_journalier} onChange={(v) => maj('tarif_journalier', v)} suffixe="€ / jour" />
            </Champ>
            <Champ label="Tarif horaire HT">
              <Montant valeur={f.tarif_horaire} onChange={(v) => maj('tarif_horaire', v)} suffixe="€ / h" />
            </Champ>
          </div>
        </Bloc>

        <Bloc titre="Votre CV" aide="PDF ou Word, 8 Mo maximum.">
          {cvEtat === 'ok' && f.cv_nom ? (
            <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-3">
              <FileText className="h-5 w-5 text-brand-500 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm text-surface-900">{f.cv_nom}</span>
              <button type="button" onClick={retirerCv} className="p-1 text-surface-500 hover:text-surface-900" aria-label="Retirer le CV">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors ${cvEtat === 'envoi' ? 'border-brand-300 bg-brand-50' : 'border-surface-200 bg-white hover:border-brand-300'}`}>
              {cvEtat === 'envoi'
                ? <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
                : <Upload className="h-6 w-6 text-brand-500" />}
              <span className="text-sm font-medium text-surface-900">{cvEtat === 'envoi' ? 'Envoi du CV…' : 'Déposer mon CV'}</span>
              <input ref={fichier} type="file" className="sr-only" disabled={cvEtat === 'envoi'}
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => deposerCv(e.target.files?.[0])} />
            </label>
          )}
        </Bloc>

        <div className="card p-5 space-y-4">
          <label className="flex items-start gap-3 text-sm text-surface-700 cursor-pointer">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={f.consentement} onChange={(e) => maj('consentement', e.target.checked)} />
            <span>
              J&apos;accepte que {orgNom} enregistre ces informations et mon CV pour me proposer des missions de formation.
              Je peux demander leur modification ou leur suppression à tout moment.
            </span>
          </label>

          {erreur && (
            <p className="flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-700" role="alert">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{erreur}
            </p>
          )}

          <button type="submit" disabled={envoi || cvEtat === 'envoi'} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60">
            {envoi ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…</> : <><Check className="h-4 w-4" /> Envoyer ma fiche</>}
          </button>
        </div>

        <p className="text-center text-xs text-surface-400 pb-6">{orgNom} · organisme de formation certifié Qualiopi</p>
      </form>
    </div>
  )
}

function Bloc({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="font-heading text-base font-bold text-surface-900">{titre}</h2>
        {aide && <p className="text-xs text-surface-500 mt-0.5">{aide}</p>}
      </div>
      {children}
    </section>
  )
}

function Champ({ label, aide, requis, children }: { label: string; aide?: string; requis?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="text-sm font-medium text-surface-700">
        {label}{requis && <span className="text-danger-500"> *</span>}
        {aide && <span className="font-normal text-surface-400"> · {aide}</span>}
      </div>
      {children}
    </div>
  )
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${actif ? 'border-brand-500 bg-brand-500 text-white' : 'border-surface-200 bg-white text-surface-700 hover:border-brand-300'}`}>
      {actif && <Check className="h-3.5 w-3.5" />}{children}
    </button>
  )
}

function Montant({ valeur, onChange, suffixe }: { valeur: number | null; onChange: (v: number | null) => void; suffixe: string }) {
  return (
    <div className="relative">
      <input className="input-base pr-16 tabular-nums" type="number" inputMode="decimal" min={0} step="1"
        value={valeur ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">{suffixe}</span>
    </div>
  )
}
