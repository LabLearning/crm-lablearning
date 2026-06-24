'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Icônes SVG inline (pas d'emoji) ─────────────────────────────────────────
const I = {
  trending: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>,
  cap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.84l8.57 3.9a2 2 0 0 0 1.66 0z" /><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></svg>,
  receipt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8M8 11h6" /></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84z" /><path d="m6.08 9.5-3.49 1.59a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83L17.92 9.5" /></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>,
}

const FEATS = [
  { icon: I.trending, t: 'Commercial', s: 'Leads, devis, apporteurs et pipeline de vente.' },
  { icon: I.cap, t: 'Formations', s: 'Catalogue, sessions, apprenants et émargement.' },
  { icon: I.file, t: 'Administratif', s: 'Conventions, dossiers OPCO, facturation.' },
  { icon: I.shield, t: 'Qualité', s: 'Qualiopi, preuves, évaluations et réclamations.' },
]

const FLOW = [
  { icon: I.user, l: 'Lead' },
  { icon: I.file, l: 'Devis' },
  { icon: I.pen, l: 'Convention' },
  { icon: I.calendar, l: 'Session' },
  { icon: I.receipt, l: 'Facture' },
]

const START = [
  { icon: I.grid, t: 'Tableau de bord', s: 'Vue d\'ensemble + guide pas à pas', href: '/dashboard' },
  { icon: I.trending, t: 'Leads', s: 'Suivre et convertir tes opportunités', href: '/dashboard/leads' },
  { icon: I.calendar, t: 'Sessions', s: 'Planifier et piloter les formations', href: '/dashboard/sessions' },
]

export function OnboardingWizard({ prenom }: { prenom: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  function done() {
    try { localStorage.setItem('ll_onboarding_wizard_done', '1') } catch {}
    router.push('/dashboard')
  }

  return (
    <div className="ob">
      <div className="ob-orb ob-orb-1" aria-hidden />
      <div className="ob-orb ob-orb-2" aria-hidden />
      <div className="ob-grid" aria-hidden />

      <header className="ob-topbar">
        <div className="ob-logo">
          <img src="/logo-lablearning.svg" alt="Lab Learning" className="ob-logo-img" />
        </div>
        <button className="ob-skip" onClick={done}>Passer</button>
      </header>

      <main className="ob-stage">
        <div key={step} className="ob-screen">
          <div className="ob-eyebrow"><span className="ob-dot" />{step === 1 ? 'Bienvenue' : `Étape ${step} sur 3`}</div>

          {step === 1 && (
            <>
              <h1 className="ob-title">{prenom ? `${prenom}, ` : ''}ton CRM pour piloter <span className="ob-accent">toute l'activité</span></h1>
              <p className="ob-sub">Un seul outil pour l'équipe Lab Learning : du premier contact à la facturation, en passant par les sessions, les conventions et le suivi Qualiopi.</p>
              <div className="ob-feats">
                {FEATS.map((f) => (
                  <div key={f.t} className="ob-feat">
                    <span className="ob-feat-ic">{f.icon}</span>
                    <span className="ob-feat-body"><span className="ob-feat-t">{f.t}</span><span className="ob-feat-s">{f.s}</span></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="ob-title">Tout est <span className="ob-accent">connecté</span>, du lead à la facture</h1>
              <p className="ob-sub">Chaque étape alimente la suivante — pas de double saisie. Voici le cycle d'une action de formation dans le CRM.</p>
              <div className="ob-flow">
                {FLOW.map((n, i) => (
                  <div className="ob-flow-item" key={n.l}>
                    <div className="ob-node">
                      <span className="ob-node-ic">{n.icon}</span>
                      <span className="ob-node-l">{n.l}</span>
                    </div>
                    {i < FLOW.length - 1 && <span className="ob-conn">{I.chevron}</span>}
                  </div>
                ))}
              </div>
              <p className="ob-note"><span className="ob-note-dot" />Un lead « gagné » crée déjà un dossier ; la convention et la facture reprennent automatiquement les données de l'organisme et de la formation.</p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="ob-title">Prêt à <span className="ob-accent">démarrer</span> ?</h1>
              <p className="ob-sub">Le guide de démarrage t'attend sur le tableau de bord et coche les étapes automatiquement à mesure que tu avances. Accède à l'essentiel :</p>
              <div className="ob-start">
                {START.map((s) => (
                  <Link key={s.t} href={s.href} className="ob-slink" onClick={() => { try { localStorage.setItem('ll_onboarding_wizard_done', '1') } catch {} }}>
                    <span className="ob-slink-ic">{s.icon}</span>
                    <span className="ob-slink-t">{s.t}</span>
                    <span className="ob-slink-s">{s.s}</span>
                    <span className="ob-slink-go">Ouvrir {I.arrow}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="ob-footer">
            <div className="ob-progress">
              {[1, 2, 3].map((n) => <span key={n} className={`ob-pdot ${n === step ? 'is-on' : n < step ? 'is-done' : ''}`} />)}
            </div>
            <div className="ob-actions">
              {step > 1 && <button className="ob-back" onClick={() => setStep((s) => s - 1)}>Retour</button>}
              {step < 3 ? (
                <button className="ob-cta" onClick={() => setStep((s) => s + 1)}>{step === 1 ? 'Découvrir le parcours' : 'Continuer'} <span className="ob-cta-ic">{I.arrow}</span></button>
              ) : (
                <button className="ob-cta" onClick={done}>Accéder au CRM <span className="ob-cta-ic">{I.arrow}</span></button>
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
.ob-orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.4;pointer-events:none;z-index:0;}
.ob-orb-1{width:560px;height:560px;top:-160px;left:-140px;background:radial-gradient(circle at 30% 30%,#2FAE76,transparent 70%);animation:obFloat1 24s ease-in-out infinite;}
.ob-orb-2{width:620px;height:620px;bottom:-220px;right:-160px;background:radial-gradient(circle at 60% 40%,#195245,transparent 70%);animation:obFloat2 26s ease-in-out infinite;}
@keyframes obFloat1{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,30px)}}
@keyframes obFloat2{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,-30px)}}
.ob-grid{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(25,82,69,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(25,82,69,.05) 1px,transparent 1px);background-size:46px 46px;-webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 42%,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse 70% 60% at 50% 42%,#000 30%,transparent 75%);}
.ob-topbar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:20px 28px;}
.ob-logo{display:flex;align-items:center;gap:10px;}
.ob-logo-img{height:30px;width:auto;max-width:150px;display:block;}
.ob-skip{border:0;background:transparent;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;padding:8px 12px;border-radius:9px;transition:.15s;font-family:inherit;}
.ob-skip:hover{background:rgba(15,23,42,.05);color:#0F172A;}
.ob-stage{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 70px);padding:24px;}
.ob-screen{width:100%;max-width:660px;animation:obIn .5s cubic-bezier(.16,1,.3,1);}
@keyframes obIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.ob-eyebrow{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid #EEF2F1;box-shadow:0 2px 10px rgba(15,23,42,.04);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;color:#475569;}
.ob-dot{width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 0 0 rgba(16,185,129,.5);animation:obPulse 1.8s ease-out infinite;}
@keyframes obPulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}70%{box-shadow:0 0 0 7px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
.ob-title{font-family:'General Sans',system-ui,sans-serif;font-feature-settings:'ss01' on;font-weight:700;font-size:38px;line-height:1.08;letter-spacing:-.03em;margin:18px 0 10px;}
.ob-accent{background:linear-gradient(135deg,#2FAE76 0%,#195245 50%,#0f3a30 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.ob-sub{font-size:15.5px;line-height:1.55;color:#64748B;max-width:560px;margin:0 0 26px;}
/* Step 1 — features */
.ob-feats{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.ob-feat{display:flex;align-items:flex-start;gap:13px;background:#fff;border:1px solid #EEF2F1;border-radius:16px;padding:15px 16px;box-shadow:0 1px 3px rgba(15,23,42,.03);transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s;}
.ob-feat:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(15,23,42,.07);}
.ob-feat-ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2FAE76,#195245);color:#fff;flex:0 0 auto;box-shadow:0 5px 13px rgba(25,82,69,.22);}
.ob-feat-ic svg{width:20px;height:20px;}
.ob-feat-body{display:flex;flex-direction:column;gap:2px;}
.ob-feat-t{font-size:14px;font-weight:700;color:#0F172A;letter-spacing:-.01em;}
.ob-feat-s{font-size:12.5px;color:#64748B;line-height:1.4;}
/* Step 2 — flow */
.ob-flow{display:flex;align-items:flex-start;justify-content:space-between;background:#fff;border:1px solid #EEF2F1;border-radius:18px;padding:24px 14px;box-shadow:0 2px 14px rgba(15,23,42,.05);}
.ob-flow-item{display:flex;align-items:flex-start;flex:1;}
.ob-flow-item:last-child{flex:0 0 auto;}
.ob-node{display:flex;flex-direction:column;align-items:center;gap:9px;width:100%;text-align:center;}
.ob-node-ic{width:48px;height:48px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2FAE76 0%,#195245 60%,#0f3a30 100%);color:#fff;box-shadow:0 7px 18px rgba(25,82,69,.24);}
.ob-node-ic svg{width:22px;height:22px;}
.ob-node-l{font-size:12px;font-weight:700;color:#334155;letter-spacing:-.01em;}
.ob-conn{display:flex;align-items:center;color:#9FD9BE;margin-top:14px;}
.ob-conn svg{width:18px;height:18px;}
.ob-note{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;line-height:1.5;color:#64748B;margin:16px 2px 0;}
.ob-note-dot{width:7px;height:7px;border-radius:50%;background:#2FAE76;margin-top:5px;flex:0 0 auto;}
/* Step 3 — start */
.ob-start{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
.ob-slink{display:flex;flex-direction:column;gap:7px;background:#fff;border:1px solid #EEF2F1;border-radius:16px;padding:16px;text-decoration:none;color:inherit;box-shadow:0 1px 3px rgba(15,23,42,.03);transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s,border-color .18s;}
.ob-slink:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,23,42,.09);border-color:#D6F0E2;}
.ob-slink-ic{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#ECFDF3;color:#195245;border:1px solid #D6F0E2;}
.ob-slink-ic svg{width:21px;height:21px;}
.ob-slink-t{font-size:14.5px;font-weight:700;color:#0F172A;letter-spacing:-.01em;margin-top:2px;}
.ob-slink-s{font-size:12px;color:#64748B;line-height:1.4;flex:1;}
.ob-slink-go{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:#195245;margin-top:4px;}
.ob-slink-go svg{width:14px;height:14px;}
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
.ob-slink:focus-visible,.ob-cta:focus-visible,.ob-skip:focus-visible,.ob-back:focus-visible{outline:2px solid #2FAE76;outline-offset:2px;}
@media (max-width:620px){
  .ob-title{font-size:27px;}
  .ob-sub{font-size:14.5px;margin-bottom:20px;}
  .ob-feats{grid-template-columns:1fr;}
  .ob-start{grid-template-columns:1fr;}
  .ob-stage{padding:18px;}
  .ob-flow{flex-direction:column;gap:6px;padding:18px;}
  .ob-flow-item{flex-direction:column;align-items:center;width:100%;}
  .ob-node{flex-direction:row;justify-content:flex-start;gap:12px;text-align:left;}
  .ob-conn{margin:2px 0;transform:rotate(90deg);}
  .ob-footer{flex-direction:column-reverse;align-items:stretch;gap:14px;}
  .ob-actions{justify-content:space-between;}
  .ob-cta{flex:1;justify-content:center;}
  .ob-progress{justify-content:center;}
}
`
