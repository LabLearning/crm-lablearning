import Link from 'next/link'
import { Mail, PhoneCall, MapPin } from './icons'

export function SiteFooter() {
  return (
    <footer className="bg-[#14110F] text-[#E7E5E4]">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-9 w-auto brightness-0 invert opacity-90" />
          <p className="mt-4 text-sm text-[#A8A29E] max-w-sm leading-relaxed">
            Organisme de formation professionnelle certifié Qualiopi, spécialiste des métiers de bouche
            et de la performance en restauration. Formations en établissement, dans toute la France.
          </p>
          {/*
            Règle d'usage de la marque Qualiopi : le logo ne s'affiche jamais
            sans la mention de la catégorie d'action, dans le même bloc.
          */}
          <div className="mt-6 max-w-sm rounded-2xl bg-white p-4">
            <img src="/site/logos/qualiopi.png" alt="Qualiopi, processus certifié, République française" className="h-20 w-auto" />
            <p className="mt-2.5 text-[10px] leading-snug text-[#57534E]">
              La certification qualité a été délivrée au titre de la catégorie d&apos;action suivante&nbsp;:{' '}
              <strong className="text-[#14110F]">ACTIONS DE FORMATION</strong>
            </p>
            <a href="/site/documents/certificat-qualiopi-lab-learning.pdf" target="_blank" rel="noopener noreferrer"
              className="mt-1.5 inline-block text-[10px] font-semibold text-[#205040] underline underline-offset-2 hover:text-[#123f34]">
              Consulter notre certificat (PDF)
            </a>
          </div>
          <p className="mt-3 text-[11px] text-[#78716C] max-w-sm leading-relaxed">
            Certificat n° CERT_S1024_0345_1 délivré par CEVA SOLUTION, valable jusqu&apos;au 04/11/2027.
            Inscrit sur la liste de la DRAAF pour la formation hygiène alimentaire (HACCP).
          </p>
        </div>

        <div className="md:col-span-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-4">Nos formations</div>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/site/branches/restauration-rapide" className="text-[#D6D3D1] hover:text-white transition-colors">Restauration rapide</Link></li>
            <li><Link href="/site/branches/restaurant-hcr" className="text-[#D6D3D1] hover:text-white transition-colors">Restaurant &amp; HCR</Link></li>
            <li><Link href="/site/branches/boucherie-charcuterie" className="text-[#D6D3D1] hover:text-white transition-colors">Boucherie-charcuterie</Link></li>
            <li><Link href="/site/branches/boulangerie-patisserie" className="text-[#D6D3D1] hover:text-white transition-colors">Boulangerie-pâtisserie</Link></li>
            <li><Link href="/site/formations" className="text-[#D6D3D1] hover:text-white transition-colors">Tout le catalogue</Link></li>
            <li><Link href="/site/financements" className="text-[#D6D3D1] hover:text-white transition-colors">Financements</Link></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-4">Lab Learning</div>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/site" className="text-[#D6D3D1] hover:text-white transition-colors">Accueil</Link></li>
            <li><Link href="/site/partenaires" className="text-[#D6D3D1] hover:text-white transition-colors">Clients</Link></li>
            <li><Link href="/site/resultats" className="text-[#D6D3D1] hover:text-white transition-colors">Nos résultats</Link></li>
            <li><Link href="/site/a-propos" className="text-[#D6D3D1] hover:text-white transition-colors">À propos</Link></li>
            <li><Link href="/site/faq" className="text-[#D6D3D1] hover:text-white transition-colors">Questions fréquentes</Link></li>
            <li><Link href="/site/recrutement" className="text-[#D6D3D1] hover:text-white transition-colors">Recrutement</Link></li>
            <li><Link href="/site/contact" className="text-[#D6D3D1] hover:text-white transition-colors">Contact</Link></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-4">Contact</div>
          <div className="space-y-2.5 text-sm">
            <a href="mailto:contact@lab-learning.fr" className="flex items-center gap-2 text-[#D6D3D1] hover:text-white transition-colors">
              <Mail className="h-4 w-4 shrink-0" /> contact@lab-learning.fr
            </a>
            <a href="tel:+33451330330" className="flex items-center gap-2 text-[#D6D3D1] hover:text-white transition-colors">
              <PhoneCall className="h-4 w-4 shrink-0" /> 04 51 330 330
            </a>
            <div className="flex items-start gap-2 text-[#A8A29E]">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> 6b boulevard Berthelot, Bureau 3, 34000 Montpellier
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-5 space-y-2 text-xs text-[#78716C]">
          <p className="leading-relaxed">
            {/* Forme imposée par l'article L6352-12 du Code du travail */}
            Lab Learning · SAS au capital de 5 000 € · SIRET 931 658 561 00036 · TVA FR41931658561 ·
            Enregistrée sous le numéro 76341315134. Cet enregistrement ne vaut pas agrément de l’État.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/site/mentions-legales" className="hover:text-[#D6D3D1]">Mentions légales</Link>
            <Link href="/site/cgv" className="hover:text-[#D6D3D1]">CGV</Link>
            <Link href="/site/reglement-interieur" className="hover:text-[#D6D3D1]">Règlement intérieur</Link>
            <Link href="/site/reclamation" className="hover:text-[#D6D3D1]">Réclamations</Link>
            <Link href="/site/confidentialite" className="hover:text-[#D6D3D1]">Confidentialité</Link>
            <Link href="/site/cookies" className="hover:text-[#D6D3D1]">Cookies</Link>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} Lab Learning. Tous droits réservés.</span>
            <span>Restauration · Boucherie · Boulangerie · Pâtisserie · Hôtellerie</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
