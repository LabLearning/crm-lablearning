'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveOnboardingAction } from './actions'

// ─── Icônes SVG inline (pas d'emoji) ─────────────────────────────────────────
const I = {
  cap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.84l8.57 3.9a2 2 0 0 0 1.66 0z" /><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></svg>,
  building: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  trending: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84z" /><path d="m6.08 9.5-3.49 1.59a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83L17.92 9.5" /><path d="m6.08 14.5-3.49 1.59a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.51-1.6" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>,
}

const ACCOUNT_TYPES = [
  { id: 'of', icon: I.cap, title: 'Organisme de formation', sub: 'Catalogue, sessions, Qualiopi — le cœur de ton activité.' },
  { id: 'cfa', icon: I.building, title: 'Centre / CFA', sub: 'Plusieurs sites, volumes importants, alternance.' },
  { id: 'solo', icon: I.user, title: 'Formateur indépendant', sub: 'En solo : prospection, conventions, factures simplifiées.' },
]

const FOCUS = [
  { id: 'commercial', icon: I.trending, title: 'Croissance commerciale', tag: 'Leads · Devis' },
  { id: 'admin', icon: I.file, title: 'Pilotage administratif', tag: 'Conventions · OPCO' },
  { id: 'qualiopi', icon: I.shield, title: 'Excellence Qualiopi', tag: 'Qualité · Preuves' },
  { id: 'all', icon: I.layers, title: 'Vue 360°', tag: 'Tout-en-un' },
]

export function OnboardingWizard({ defaultName, defaultPrenom, defaultNom }: { defaultName: string; defaultPrenom: string; defaultNom: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState(defaultName || '')
  const [type, setType] = useState('of')
  const [focus, setFocus] = useState('all')
  const [prenom, setPrenom] = useState(defaultPrenom || '')
  const [nom, setNom] = useState(defaultNom || '')

  const initials = `${(prenom[0] || '')}${(nom[0] || '')}`.toUpperCase() || (name[0] || 'L').toUpperCase()
  const focusLabel = FOCUS.find((f) => f.id === focus)?.title || ''

  function skip() {
    try { localStorage.setItem('ll_onboarding_wizard_done', '1') } catch {}
    router.push('/dashboard')
  }

  async function finish() {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('name', name.trim())
      fd.set('prenom', prenom.trim())
      fd.set('nom', nom.trim())
      await saveOnboardingAction(fd)
    } catch {}
    try { localStorage.setItem('ll_onboarding_wizard_done', '1') } catch {}
    router.push('/dashboard')
  }

  const canNext = step === 1 ? name.trim().length > 0 && !!type : true

  return (
    <div className="ob">
      {/* Ambiance cockpit */}
      <div className="ob-orb ob-orb-1" aria-hidden />
      <div className="ob-orb ob-orb-2" aria-hidden />
      <div className="ob-grid" aria-hidden />

      {/* Topbar */}
      <header className="ob-topbar">
        <div className="ob-logo">
          <span className="ob-logo-mark">{I.layers}</span>
          <span className="ob-logo-text">Lab Learning</span>
        </div>
        <button className="ob-skip" onClick={skip}>Passer</button>
      </header>

      {/* Stage */}
      <main className="ob-stage">
        <div key={step} className="ob-screen">
          <div className="ob-eyebrow">
            <span className="ob-dot" />
            {step === 1 ? 'Bienvenue' : `Étape ${step} sur 3`}
          </div>

          {step === 1 && (
            <>
              <h1 className="ob-title">Donne un nom à ton <span className="ob-accent">espace de travail</span></h1>
              <p className="ob-sub">Il t'accompagnera partout. Choisis un nom reconnaissable — tu pourras toujours le modifier plus tard.</p>

              <div className="ob-field">
                <label htmlFor="ws" className="ob-label">Nom de l'espace</label>
                <input id="ws" className="ob-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Lab Learning" autoFocus />
                <span className="ob-help">Visible dans l'en-tête, sur tes documents et tes emails.</span>
              </div>

              <div className="ob-cards">
                {ACCOUNT_TYPES.map((t) => (
                  <button key={t.id} type="button" className={`ob-card ${type === t.id ? 'is-sel' : ''}`} onClick={() => setType(t.id)} aria-pressed={type === t.id}>
                    <span className="ob-card-ic">{t.icon}</span>
                    <span className="ob-card-body">
                      <span className="ob-card-title">{t.title}</span>
                      <span className="ob-card-sub">{t.sub}</span>
                    </span>
                    <span className="ob-tick">{I.check}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="ob-title">Quel est ton <span className="ob-accent">objectif principal</span> ?</h1>
              <p className="ob-sub">On adapte ta prise en main à ce qui compte le plus pour toi. Tu pourras le faire évoluer au fil de ta progression.</p>

              <div className="ob-grid-cards">
                {FOCUS.map((f) => (
                  <button key={f.id} type="button" className={`ob-gcard ${focus === f.id ? 'is-sel' : ''}`} onClick={() => setFocus(f.id)} aria-pressed={focus === f.id}>
                    <span className="ob-gframe">{f.icon}</span>
                    <span className="ob-gname">{f.title}</span>
                    <span className="ob-gtag">{f.tag}</span>
                    <span className="ob-gtick">{I.check}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="ob-title">Personnalise ton <span className="ob-accent">profil</span></h1>
              <p className="ob-sub">Une dernière touche. Ton profil évoluera avec toi à mesure que tu avances dans le CRM.</p>

              <div className="ob-profile">
                <div className="ob-avatar">{initials}</div>
                <div className="ob-profile-meta">
                  <div className="ob-profile-name">{[prenom, nom].filter(Boolean).join(' ') || 'Ton nom'}</div>
                  <div className="ob-profile-ws">{name || 'Ton espace'}{focusLabel ? ` · ${focusLabel}` : ''}</div>
                </div>
              </div>

              <div className="ob-row">
                <div className="ob-field">
                  <label htmlFor="pn" className="ob-label">Prénom</label>
                  <input id="pn" className="ob-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" />
                </div>
                <div className="ob-field">
                  <label htmlFor="nm" className="ob-label">Nom</label>
                  <input id="nm" className="ob-input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" />
                </div>
              </div>
            </>
          )}

          {/* Footer : progression + actions */}
          <div className="ob-footer">
            <div className="ob-progress">
              {[1, 2, 3].map((n) => <span key={n} className={`ob-pdot ${n === step ? 'is-on' : n < step ? 'is-done' : ''}`} />)}
            </div>
            <div className="ob-actions">
              {step > 1 && <button className="ob-back" onClick={() => setStep((s) => s - 1)}>Retour</button>}
              {step < 3 ? (
                <button className="ob-cta" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                  Continuer <span className="ob-cta-ic">{I.arrow}</span>
                </button>
              ) : (
                <button className="ob-cta" disabled={busy} onClick={finish}>
                  {busy ? 'Un instant…' : 'Accéder au CRM'} <span className="ob-cta-ic">{I.arrow}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{css}</style>
    </div>
  )
}

const css = `
.ob{position:relative;min-height:100vh;background:#FAFAFA;color:#0F172A;overflow:hidden;font-family:'General Sans',system-ui,sans-serif;}
.ob *{box-sizing:border-box;}
/* Orbes */
.ob-orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.4;pointer-events:none;z-index:0;}
.ob-orb-1{width:560px;height:560px;top:-160px;left:-140px;background:radial-gradient(circle at 30% 30%,#2FAE76,transparent 70%);animation:obFloat1 24s ease-in-out infinite;}
.ob-orb-2{width:620px;height:620px;bottom:-220px;right:-160px;background:radial-gradient(circle at 60% 40%,#195245,transparent 70%);animation:obFloat2 26s ease-in-out infinite;}
@keyframes obFloat1{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,30px)}}
@keyframes obFloat2{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,-30px)}}
/* Grille */
.ob-grid{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(25,82,69,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(25,82,69,.05) 1px,transparent 1px);background-size:46px 46px;-webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 42%,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse 70% 60% at 50% 42%,#000 30%,transparent 75%);}
/* Topbar */
.ob-topbar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:20px 28px;}
.ob-logo{display:flex;align-items:center;gap:10px;}
.ob-logo-mark{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#2FAE76 0%,#195245 55%,#0f3a30 100%);box-shadow:0 6px 16px rgba(25,82,69,.28);}
.ob-logo-mark svg{width:17px;height:17px;}
.ob-logo-text{font-weight:700;font-size:15px;letter-spacing:-.02em;}
.ob-skip{border:0;background:transparent;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;padding:8px 12px;border-radius:9px;transition:.15s;font-family:inherit;}
.ob-skip:hover{background:rgba(15,23,42,.05);color:#0F172A;}
/* Stage */
.ob-stage{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 70px);padding:24px;}
.ob-screen{width:100%;max-width:640px;animation:obIn .5s cubic-bezier(.16,1,.3,1);}
@keyframes obIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
/* Eyebrow */
.ob-eyebrow{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid #EEF2F1;box-shadow:0 2px 10px rgba(15,23,42,.04);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;color:#475569;letter-spacing:.01em;}
.ob-dot{width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 0 0 rgba(16,185,129,.5);animation:obPulse 1.8s ease-out infinite;}
@keyframes obPulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}70%{box-shadow:0 0 0 7px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
/* Titres */
.ob-title{font-family:'General Sans',system-ui,sans-serif;font-feature-settings:'ss01' on;font-weight:700;font-size:38px;line-height:1.08;letter-spacing:-.03em;margin:18px 0 10px;}
.ob-accent{background:linear-gradient(135deg,#2FAE76 0%,#195245 50%,#0f3a30 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.ob-sub{font-size:15.5px;line-height:1.55;color:#64748B;max-width:540px;margin:0 0 26px;}
/* Champ */
.ob-field{display:flex;flex-direction:column;gap:7px;margin-bottom:18px;flex:1;}
.ob-label{font-size:13px;font-weight:600;color:#334155;}
.ob-input{width:100%;border:1px solid #E6EAE9;background:#fff;border-radius:13px;padding:14px 16px;font-size:15px;color:#0F172A;outline:none;transition:.15s;font-family:inherit;box-shadow:0 1px 2px rgba(15,23,42,.03);}
.ob-input::placeholder{color:#94A3B8;}
.ob-input:focus{border-color:#2FAE76;box-shadow:0 0 0 4px rgba(47,174,118,.15);}
.ob-help{font-size:12.5px;color:#94A3B8;}
.ob-row{display:flex;gap:14px;}
/* Cartes choix (radio) */
.ob-cards{display:flex;flex-direction:column;gap:11px;}
.ob-card{position:relative;display:flex;align-items:center;gap:14px;text-align:left;background:#fff;border:1.5px solid #EEF2F1;border-radius:16px;padding:15px 16px;cursor:pointer;transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s,border-color .18s;font-family:inherit;box-shadow:0 1px 3px rgba(15,23,42,.03);}
.ob-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(15,23,42,.08);}
.ob-card-ic{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#ECFDF3;color:#195245;flex:0 0 auto;transition:.18s;}
.ob-card-ic svg{width:21px;height:21px;}
.ob-card-body{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.ob-card-title{font-size:14.5px;font-weight:700;color:#0F172A;letter-spacing:-.01em;}
.ob-card-sub{font-size:12.5px;color:#64748B;line-height:1.4;}
.ob-tick{width:22px;height:22px;border-radius:50%;border:1.5px solid #E2E8F0;color:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto;transition:.18s;transform:scale(.8);}
.ob-tick svg{width:13px;height:13px;opacity:0;transition:.18s;}
.ob-card.is-sel{border-color:#2FAE76;box-shadow:0 0 0 4px rgba(47,174,118,.13),0 10px 26px rgba(15,23,42,.07);}
.ob-card.is-sel .ob-card-ic{background:linear-gradient(135deg,#2FAE76,#195245);color:#fff;}
.ob-card.is-sel .ob-tick{border-color:transparent;background:linear-gradient(135deg,#2FAE76,#195245);transform:scale(1);}
.ob-card.is-sel .ob-tick svg{opacity:1;}
/* Cartes gamifiées (grille) */
.ob-grid-cards{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
.ob-gcard{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:10px;background:#fff;border:1.5px solid #EEF2F1;border-radius:18px;padding:18px;cursor:pointer;transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s,border-color .18s;font-family:inherit;box-shadow:0 1px 3px rgba(15,23,42,.03);overflow:hidden;}
.ob-gcard:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,23,42,.09);}
.ob-gframe{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#ECFDF3;color:#195245;border:1px solid #D6F0E2;transition:.18s;}
.ob-gframe svg{width:24px;height:24px;}
.ob-gname{font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-.01em;}
.ob-gtag{font-size:11.5px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.05em;}
.ob-gtick{position:absolute;top:14px;right:14px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#2FAE76,#195245);color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.5);transition:.2s cubic-bezier(.16,1,.3,1);}
.ob-gtick svg{width:13px;height:13px;}
.ob-gcard.is-sel{border-color:#2FAE76;box-shadow:0 0 0 4px rgba(47,174,118,.13),0 14px 30px rgba(15,23,42,.08);}
.ob-gcard.is-sel .ob-gframe{background:linear-gradient(135deg,#2FAE76,#195245);color:#fff;border-color:transparent;}
.ob-gcard.is-sel .ob-gtick{opacity:1;transform:scale(1);}
/* Profil */
.ob-profile{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #EEF2F1;border-radius:18px;padding:16px 18px;margin-bottom:18px;box-shadow:0 2px 12px rgba(15,23,42,.04);}
.ob-avatar{width:58px;height:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700;color:#fff;background:linear-gradient(135deg,#2FAE76 0%,#195245 55%,#0f3a30 100%);box-shadow:0 8px 20px rgba(25,82,69,.28);letter-spacing:.02em;}
.ob-profile-name{font-size:16px;font-weight:700;color:#0F172A;letter-spacing:-.01em;}
.ob-profile-ws{font-size:13px;color:#64748B;margin-top:2px;}
/* Footer */
.ob-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:30px;}
.ob-progress{display:flex;gap:7px;}
.ob-pdot{width:24px;height:5px;border-radius:999px;background:#E2E8F0;transition:.3s;}
.ob-pdot.is-on{background:linear-gradient(135deg,#2FAE76,#195245);width:34px;}
.ob-pdot.is-done{background:#9FD9BE;}
.ob-actions{display:flex;align-items:center;gap:10px;}
.ob-back{border:0;background:transparent;color:#475569;font-size:14px;font-weight:600;cursor:pointer;padding:11px 14px;border-radius:11px;transition:.15s;font-family:inherit;}
.ob-back:hover{background:rgba(15,23,42,.05);}
.ob-cta{display:inline-flex;align-items:center;gap:9px;border:0;cursor:pointer;color:#fff;font-size:14.5px;font-weight:700;font-family:inherit;letter-spacing:-.01em;padding:13px 22px;border-radius:13px;background:linear-gradient(135deg,#2FAE76 0%,#195245 50%,#0f3a30 100%);box-shadow:0 8px 22px rgba(25,82,69,.30);transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s,opacity .15s;}
.ob-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 32px rgba(25,82,69,.40);}
.ob-cta:disabled{opacity:.45;cursor:not-allowed;}
.ob-cta-ic{display:flex;}
.ob-cta-ic svg{width:17px;height:17px;}
/* Focus visibles (a11y) */
.ob-card:focus-visible,.ob-gcard:focus-visible,.ob-cta:focus-visible,.ob-skip:focus-visible,.ob-back:focus-visible{outline:2px solid #2FAE76;outline-offset:2px;}
.ob-input:focus-visible{outline:none;}
/* Responsive */
@media (max-width:600px){
  .ob-title{font-size:28px;}
  .ob-sub{font-size:14.5px;margin-bottom:20px;}
  .ob-grid-cards{grid-template-columns:1fr;}
  .ob-row{flex-direction:column;gap:0;}
  .ob-stage{padding:18px;}
  .ob-footer{flex-direction:column-reverse;align-items:stretch;gap:14px;}
  .ob-actions{justify-content:space-between;}
  .ob-cta{flex:1;justify-content:center;}
  .ob-progress{justify-content:center;}
}
`
