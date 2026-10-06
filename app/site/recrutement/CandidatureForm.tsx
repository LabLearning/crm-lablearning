'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Send, FileCheck2, X } from '../icons'
import { CV_TAILLE_MAX, CV_TYPES, STATUTS_FORMATEUR, type InscriptionFormateur } from '@/lib/inscription-formateur'
import { DISPONIBILITES, DOMAINES_CANDIDATURE, EXPERIENCES, POSTES_CANDIDATURE, ZONES } from './candidature'
import { postulerFormateurAction, preparerCvCandidatureAction } from './actions'

const ETAPES = ['Vous', 'Votre métier', 'Votre candidature']

const champ = 'w-full min-h-12 rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] text-[#14110F] placeholder:text-[#A8A29E] focus:border-[#205040] focus:outline-none focus:ring-[3px] focus:ring-[#5CD9A0]/40'
const etiquette = 'block text-sm font-semibold text-[#14110F] mb-1.5'

/**
 * Candidature d'un formateur, en trois courtes étapes. Elle arrive dans le CRM
 * comme une fiche formateur inactive, à étudier par l'équipe.
 * `posteInitial` : la fiche de poste depuis laquelle le candidat a cliqué.
 */
export function CandidatureForm({ jetonPage, posteInitial }: { jetonPage: string; posteInitial: string | null }) {
  const posteDepart = POSTES_CANDIDATURE.find((p) => p.cle === posteInitial) || null
  const [etape, setEtape] = useState(0)
  const [poste, setPoste] = useState<string>(posteDepart?.cle || '')
  const [f, setF] = useState({
    prenom: '', nom: '', email: '', telephone: '', ville: '', code_postal: '',
    domaines: (posteDepart?.domaines || []) as string[],
    experience: '', type_contrat: '', zone: '', disponibilite: '', message: '', consentement: false,
  })
  const [cv, setCv] = useState<{ path: string; nom: string } | null>(null)
  const [cvEtat, setCvEtat] = useState<'vide' | 'envoi' | 'ok' | 'erreur'>('vide')
  const [cvErreur, setCvErreur] = useState<string | null>(null)
  const [pot, setPot] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [fini, setFini] = useState(false)
  const haut = useRef<HTMLDivElement>(null)
  const fichier = useRef<HTMLInputElement>(null)

  // Corriger un champ efface le message d'erreur : il ne concerne plus ce qui est à l'écran
  const maj = (cle: keyof typeof f, valeur: unknown) => { setErreur(null); setF((x) => ({ ...x, [cle]: valeur })) }

  // Changer de poste coche les domaines qui vont avec, sans décocher ce que le candidat a déjà choisi
  function choisirPoste(cle: string) {
    setPoste(cle)
    const d = POSTES_CANDIDATURE.find((p) => p.cle === cle)?.domaines || []
    setF((x) => ({ ...x, domaines: [...new Set([...x.domaines, ...d])] }))
  }
  const basculerDomaine = (valeur: string) => {
    setErreur(null)
    setF((x) => ({ ...x, domaines: x.domaines.includes(valeur) ? x.domaines.filter((d) => d !== valeur) : [...x.domaines, valeur] }))
  }

  useEffect(() => {
    if (etape > 0 || fini) haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [etape, fini])

  function controler(n: number): string | null {
    if (n === 0) {
      if (!f.prenom.trim() || !f.nom.trim()) return 'Indiquez votre prénom et votre nom.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return 'Indiquez une adresse e-mail valide.'
      if (f.telephone.replace(/\D/g, '').length < 9) return 'Indiquez un numéro de téléphone valide.'
      if (!f.ville.trim()) return 'Indiquez votre ville.'
    }
    if (n === 1) {
      if (!f.domaines.length) return 'Choisissez au moins un domaine.'
      if (!f.experience) return 'Indiquez votre expérience.'
    }
    if (n === 2) {
      if (cvEtat === 'envoi') return 'Votre CV est encore en cours d’envoi, patientez un instant.'
      if (!f.consentement) return 'Merci d’accepter l’enregistrement de vos informations.'
    }
    return null
  }

  function suivant() {
    const e = controler(etape)
    setErreur(e)
    if (!e) setEtape((n) => Math.min(n + 1, ETAPES.length - 1))
  }

  async function deposerCv(file: File | undefined | null) {
    if (!file) return
    setCvErreur(null)
    if (!CV_TYPES.includes(file.type)) { setCvEtat('erreur'); setCvErreur('Le CV doit être un fichier PDF ou Word.'); return }
    if (file.size > CV_TAILLE_MAX) { setCvEtat('erreur'); setCvErreur('Le CV ne doit pas dépasser 8 Mo.'); return }
    setCvEtat('envoi')
    try {
      const prep = await preparerCvCandidatureAction(jetonPage, file.name, file.size, file.type)
      if (!prep.success || !prep.data) throw new Error(prep.error || 'Dépôt impossible')
      const { error } = await createClient().storage.from('documents')
        .uploadToSignedUrl(prep.data.path, prep.data.jeton, file, { contentType: file.type })
      if (error) throw new Error('Le dépôt a échoué. Réessayez.')
      setCv({ path: prep.data.path, nom: file.name })
      setCvEtat('ok')
    } catch (e: any) {
      setCv(null)
      setCvEtat('erreur')
      setCvErreur(e?.message || 'Le dépôt a échoué. Réessayez.')
    }
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    // Entrée dans un champ des deux premières étapes : on avance, on n'envoie pas
    if (etape < ETAPES.length - 1) { suivant(); return }
    const probleme = controler(0) || controler(1) || controler(2)
    setErreur(probleme)
    if (probleme) return
    setEnvoi(true)
    const saisie: InscriptionFormateur = {
      civilite: '', prenom: f.prenom, nom: f.nom, email: f.email, telephone: f.telephone,
      adresse: '', code_postal: f.code_postal, ville: f.ville,
      type_contrat: f.type_contrat, siret: '', numero_da: '', taux_tva: null,
      domaines: f.domaines, domaines_autres: '', certifications: [], certifications_autres: '', diplomes: '',
      experience: `Expérience déclarée : ${f.experience}.`,
      zone_intervention: [f.zone, f.ville.trim()].filter(Boolean).join(', au départ de '),
      disponibilites: f.disponibilite,
      tarif_journalier: null, tarif_horaire: null,
      bio: f.message,
      cv_path: cv?.path || null, cv_nom: cv?.nom || null,
      consentement: f.consentement,
    }
    let r: Awaited<ReturnType<typeof postulerFormateurAction>>
    try {
      r = await postulerFormateurAction(saisie, { jeton: jetonPage, pot }, poste || null)
    } catch {
      setEnvoi(false)
      setErreur('L’envoi a échoué : vérifiez votre connexion puis réessayez. Vos informations sont conservées.')
      return
    }
    setEnvoi(false)
    if (!r.success) { setErreur(r.error || 'L’envoi a échoué. Réessayez.'); return }
    setFini(true)
  }

  if (fini) {
    return (
      <div ref={haut} className="scroll-mt-28 rounded-3xl bg-white ring-1 ring-black/5 p-8 md:p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#205040]">
          <CheckCircle2 className="h-7 w-7 text-white" />
        </div>
        <h3 className="mt-4 font-heading text-2xl font-bold text-[#14110F]">Candidature envoyée</h3>
        <p className="mx-auto mt-2 max-w-md text-[#57534E] leading-relaxed">
          Merci {f.prenom.trim()}. Un e-mail de confirmation vient de partir à {f.email.trim()}.
          Nous étudions chaque profil et revenons vers vous dès que le vôtre a été étudié.
        </p>
        {!cv && (
          <p className="mx-auto mt-3 max-w-md text-sm text-[#78716C]">
            Vous n&apos;avez pas joint de CV : vous pouvez l&apos;envoyer en réponse à l&apos;e-mail de confirmation.
          </p>
        )}
      </div>
    )
  }

  return (
    <form ref={haut as any} onSubmit={envoyer} noValidate className="scroll-mt-28 rounded-3xl bg-white ring-1 ring-black/5 p-5 sm:p-7 md:p-9">
      {/* Progression */}
      <ol className="flex items-center gap-2" aria-label="Étapes de la candidature">
        {ETAPES.map((nom, i) => (
          <li key={nom} className="flex flex-1 items-center gap-2" aria-current={i === etape ? 'step' : undefined}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors ${i < etape ? 'bg-[#205040] text-white' : i === etape ? 'bg-[#205040] text-white ring-4 ring-[#5CD9A0]/30' : 'bg-[#F6F4EF] text-[#78716C]'}`}>
              {i < etape ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`hidden text-sm font-semibold sm:block ${i === etape ? 'text-[#14110F]' : 'text-[#A8A29E]'}`}>{nom}</span>
            {i < ETAPES.length - 1 && <span className={`h-px flex-1 ${i < etape ? 'bg-[#205040]' : 'bg-black/10'}`} />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-[#78716C] sm:hidden">Étape {etape + 1} sur {ETAPES.length} : {ETAPES[etape]}</p>

      {/* Champ piège pour les robots : invisible, jamais rempli par une personne */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>Site web<input tabIndex={-1} autoComplete="off" value={pot} onChange={(e) => setPot(e.target.value)} /></label>
      </div>

      <div className="mt-7">
        {etape === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="c-prenom" className={etiquette}>Prénom</label>
              <input id="c-prenom" autoComplete="given-name" className={champ} value={f.prenom} onChange={(e) => maj('prenom', e.target.value)} />
            </div>
            <div>
              <label htmlFor="c-nom" className={etiquette}>Nom</label>
              <input id="c-nom" autoComplete="family-name" className={champ} value={f.nom} onChange={(e) => maj('nom', e.target.value)} />
            </div>
            <div>
              <label htmlFor="c-email" className={etiquette}>E-mail</label>
              <input id="c-email" type="email" inputMode="email" autoComplete="email" className={champ} value={f.email} onChange={(e) => maj('email', e.target.value)} />
            </div>
            <div>
              <label htmlFor="c-tel" className={etiquette}>Téléphone</label>
              <input id="c-tel" type="tel" inputMode="tel" autoComplete="tel" className={champ} value={f.telephone} onChange={(e) => maj('telephone', e.target.value)} />
            </div>
            <div>
              <label htmlFor="c-ville" className={etiquette}>Ville</label>
              <input id="c-ville" autoComplete="address-level2" className={champ} value={f.ville} onChange={(e) => maj('ville', e.target.value)} />
            </div>
            <div>
              <label htmlFor="c-cp" className={etiquette}>Code postal <span className="font-normal text-[#A8A29E]">(facultatif)</span></label>
              <input id="c-cp" inputMode="numeric" autoComplete="postal-code" maxLength={5} className={champ} value={f.code_postal} onChange={(e) => maj('code_postal', e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
        )}

        {etape === 1 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="c-poste" className={etiquette}>Poste visé <span className="font-normal text-[#A8A29E]">(facultatif)</span></label>
              <select id="c-poste" className={champ} value={poste} onChange={(e) => choisirPoste(e.target.value)}>
                <option value="">Candidature spontanée</option>
                {POSTES_CANDIDATURE.map((p) => <option key={p.cle} value={p.cle}>{p.libelle}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className={etiquette}>Vos domaines <span className="font-normal text-[#A8A29E]">(un ou plusieurs)</span></legend>
              <div className="flex flex-wrap gap-2">
                {DOMAINES_CANDIDATURE.map((d) => {
                  const actif = f.domaines.includes(d.valeur)
                  return (
                    <button key={d.valeur} type="button" role="checkbox" aria-checked={actif} onClick={() => basculerDomaine(d.valeur)}
                      className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5CD9A0]/50 ${actif ? 'border-[#205040] bg-[#205040] text-white' : 'border-black/10 bg-white text-[#44403C] hover:border-[#205040]/40'}`}>
                      {d.libelle}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="c-exp" className={etiquette}>Votre expérience dans ces domaines</label>
                <select id="c-exp" className={champ} value={f.experience} onChange={(e) => maj('experience', e.target.value)}>
                  <option value="">Choisir</option>
                  {EXPERIENCES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="c-statut" className={etiquette}>Votre statut <span className="font-normal text-[#A8A29E]">(facultatif)</span></label>
                <select id="c-statut" className={champ} value={f.type_contrat} onChange={(e) => maj('type_contrat', e.target.value)}>
                  <option value="">Pas encore de statut</option>
                  {STATUTS_FORMATEUR.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="c-zone" className={etiquette}>Où pouvez-vous intervenir ? <span className="font-normal text-[#A8A29E]">(facultatif)</span></label>
                <select id="c-zone" className={champ} value={f.zone} onChange={(e) => maj('zone', e.target.value)}>
                  <option value="">Choisir</option>
                  {ZONES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="c-dispo" className={etiquette}>Disponibilité <span className="font-normal text-[#A8A29E]">(facultatif)</span></label>
                <select id="c-dispo" className={champ} value={f.disponibilite} onChange={(e) => maj('disponibilite', e.target.value)}>
                  <option value="">Choisir</option>
                  {DISPONIBILITES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {etape === 2 && (
          <div className="space-y-6">
            <div>
              <div className={etiquette}>Votre CV <span className="font-normal text-[#A8A29E]">(PDF ou Word, 8 Mo au plus)</span></div>
              <input ref={fichier} id="c-cv" type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => deposerCv(e.target.files?.[0])} />
              {cv && cvEtat === 'ok' ? (
                <div className="flex items-center gap-3 rounded-xl border border-[#205040]/25 bg-[#205040]/[0.04] px-4 py-3">
                  <FileCheck2 className="h-5 w-5 shrink-0 text-[#205040]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#14110F]">{cv.nom}</span>
                  <button type="button" onClick={() => { setCv(null); setCvEtat('vide'); if (fichier.current) fichier.current.value = '' }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[#78716C] hover:bg-black/5" aria-label="Retirer le CV">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label htmlFor="c-cv"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); deposerCv(e.dataTransfer.files?.[0]) }}
                  className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/15 bg-[#F6F4EF]/60 px-4 py-6 text-center hover:border-[#205040]/50 transition-colors">
                  {cvEtat === 'envoi'
                    ? <><Loader2 className="h-5 w-5 animate-spin text-[#205040]" /><span className="text-sm text-[#57534E]">Envoi du CV…</span></>
                    : <><span className="text-sm font-semibold text-[#205040]">Choisir un fichier</span><span className="text-sm text-[#78716C]">ou le déposer ici</span></>}
                </label>
              )}
              {cvErreur && <p className="mt-2 text-sm text-[#B91C1C]" role="alert">{cvErreur}</p>}
              <p className="mt-2 text-xs text-[#78716C]">Vous ne l&apos;avez pas sous la main ? Envoyez votre candidature, vous pourrez nous le transmettre ensuite.</p>
            </div>
            <div>
              <label htmlFor="c-message" className={etiquette}>Quelques mots sur votre parcours <span className="font-normal text-[#A8A29E]">(facultatif)</span></label>
              <textarea id="c-message" rows={4} maxLength={2000} className={`${champ} resize-none`} value={f.message} onChange={(e) => maj('message', e.target.value)}
                placeholder="Vos expériences en restauration, les formations que vous animez, vos certifications…" />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-[#57534E]">
              <input type="checkbox" checked={f.consentement} onChange={(e) => maj('consentement', e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-black/20 text-[#205040] focus:ring-[#5CD9A0]" />
              <span>J&apos;accepte que Lab Learning enregistre ces informations pour étudier ma candidature. Elles ne sont transmises à personne d&apos;autre. Voir notre <a href="/confidentialite" target="_blank" className="font-semibold text-[#205040] underline underline-offset-2">politique de confidentialité</a>.</span>
            </label>
          </div>
        )}
      </div>

      {erreur && <p className="mt-5 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]" role="alert">{erreur}</p>}

      <div className="mt-7 flex items-center justify-between gap-3">
        {etape > 0
          ? <button type="button" onClick={() => { setErreur(null); setEtape((n) => n - 1) }} className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-[#57534E] hover:text-[#14110F]"><ArrowLeft className="h-4 w-4" /> Retour</button>
          : <span />}
        {etape < ETAPES.length - 1 ? (
          <button type="button" onClick={suivant} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#205040] px-6 text-sm font-semibold text-white hover:bg-[#1a4335] transition-colors">
            Continuer <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="submit" disabled={envoi} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#205040] px-6 text-sm font-semibold text-white hover:bg-[#1a4335] disabled:opacity-60 transition-colors">
            {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer ma candidature
          </button>
        )}
      </div>
    </form>
  )
}
