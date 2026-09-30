/**
 * WhatsApp de Lab Learning pour le site public : +33 6 24 48 62 04, numéro
 * donné par Brahim le 30/09/2026. Distinct du numéro prévu pour l'API
 * WhatsApp Cloud (lib/whatsapp.ts), qui sert aux envois automatiques.
 */
export const WHATSAPP_NUMERO = '33624486204'
export const WHATSAPP_AFFICHE = '06 24 48 62 04'

/** Lien « cliquer pour discuter » avec un premier message déjà rédigé. */
export const lienWhatsapp = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(message)}`
