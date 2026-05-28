import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Lien court de signature convention (utilisé dans le bouton WhatsApp)
// /c/{token} → /convention/{token}/signer
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  redirect(`/convention/${params.token}/signer`)
}
