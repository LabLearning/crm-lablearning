import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Lien court de signature contrat formateur (utilisé dans le bouton WhatsApp)
// /f/{token} → /contrat-formateur/{token}/signer
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  redirect(`/contrat-formateur/${params.token}/signer`)
}
