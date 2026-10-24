import { lireJetonDesinscription } from '@/lib/campagnes/desinscription'
import { Kicker } from '../../Kicker'
import { BoutonDesinscription } from './BoutonDesinscription'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Désinscription',
  robots: { index: false, follow: false },
  // Le jeton du lien ne part pas vers les sites ouverts depuis cette page
  referrer: 'no-referrer' as const,
}

/** Adresse ou numéro masqué : on montre à qui s'applique le lien, sans tout afficher. */
function masquer(canal: 'email' | 'sms', valeur: string): string {
  if (canal === 'email') {
    const [nom, domaine] = valeur.split('@')
    return `${nom.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, nom.length - 1)))}@${domaine || ''}`
  }
  return `•• •• •• ${valeur.slice(-4, -2)} ${valeur.slice(-2)}`
}

/**
 * Page de désinscription des campagnes (lien en pied de chaque e-mail) : un
 * bouton confirme, pour qu'un logiciel qui ouvre les liens d'un message ne
 * désinscrive personne à sa place.
 */
export default function Desinscription({ params }: { params: { jeton: string } }) {
  const cible = lireJetonDesinscription(params.jeton)
  return (
    <section className="max-w-2xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-24">
      <Kicker className="mb-5">Désinscription</Kicker>
      {cible ? (
        <>
          <h1 className="ll-display text-3xl md:text-4xl text-[#14110F] text-balance">Ne plus recevoir nos {cible.canal === 'email' ? 'e-mails' : 'SMS'}</h1>
          <p className="mt-5 text-lg text-[#57534E]">
            Pour {cible.canal === 'email' ? 'l’adresse' : 'le numéro'} <strong className="text-[#14110F]">{masquer(cible.canal, cible.valeur)}</strong> :
            plus aucune actualité ni offre de Lab Learning par {cible.canal === 'email' ? 'e-mail' : 'SMS'}. Les messages liés à une formation en cours
            (convocation, attestation) continueront d’arriver.
          </p>
          <div className="mt-8"><BoutonDesinscription jeton={params.jeton} canal={cible.canal} /></div>
        </>
      ) : (
        <>
          <h1 className="ll-display text-3xl md:text-4xl text-[#14110F] text-balance">Lien de désinscription invalide</h1>
          <p className="mt-5 text-lg text-[#57534E]">
            Ce lien est incomplet ou a été modifié. Pour ne plus recevoir nos messages, écrivez-nous à{' '}
            <a href="mailto:contact@lab-learning.fr" className="font-semibold text-[#205040] underline underline-offset-2">contact@lab-learning.fr</a>.
          </p>
        </>
      )}
    </section>
  )
}
