/**
 * WhatsApp de Lab Learning pour le site public : le numéro professionnel
 * 07 80 95 01 47, utilisé aujourd'hui dans l'application WhatsApp. Si ce
 * numéro passe un jour sur l'API WhatsApp Cloud (voir lib/whatsapp.ts), les
 * messages reçus arriveront sur l'API et non plus dans l'application.
 */
export const WHATSAPP_NUMERO = '33780950147'
export const WHATSAPP_AFFICHE = '07 80 95 01 47'

/** Lien « cliquer pour discuter » avec un premier message déjà rédigé. */
export const lienWhatsapp = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(message)}`
