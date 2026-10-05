// Lecture du relevé bancaire pour un organisme. Fichier à part de lib/tresorerie.ts : celui-ci
// est aussi importé par des composants du navigateur, qui ne doivent pas embarquer le client Qonto.

import { lireBanqueQonto, messageErreurQonto, qontoConfigure, type BanqueQonto } from '@/lib/qonto'
import { JOURS_RELEVE } from '@/lib/tresorerie'

/**
 * Le relevé Qonto de l'organisme, ou la raison pour laquelle il ne peut pas
 * être montré. Le relevé d'une société n'est donné qu'à l'organisme qui porte
 * le même SIREN : un autre organisme hébergé sur le même CRM ne le verra jamais.
 */
export async function banqueDeLOrganisme(supabase: any, organizationId: string): Promise<{ banque: BanqueQonto | null; erreur: string | null }> {
  if (!qontoConfigure()) return { banque: null, erreur: null }
  const [org, lecture] = await Promise.all([
    supabase.from('organizations').select('siret').eq('id', organizationId).single(),
    lireBanqueQonto(JOURS_RELEVE).then((b) => ({ banque: b as BanqueQonto | null, erreur: null as string | null }))
      .catch((e) => ({ banque: null, erreur: messageErreurQonto(e) })),
  ])
  if (!lecture.banque) return lecture
  const sirenOrganisme = String(org.data?.siret || '').replace(/\D/g, '').slice(0, 9)
  if (!lecture.banque.siren || lecture.banque.siren !== sirenOrganisme) {
    return { banque: null, erreur: 'Le compte Qonto relié appartient à une autre société que cet organisme (SIREN différent). Vérifiez le SIRET dans les paramètres, ou la clé enregistrée.' }
  }
  return lecture
}
