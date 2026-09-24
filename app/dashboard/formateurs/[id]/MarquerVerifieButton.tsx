'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, useToast } from '@/components/ui'
import { CheckCircle2 } from '@/components/ui/icons'
import { marquerFormateurVerifieAction } from '../inscription-actions'

export function MarquerVerifieButton({ formateurId }: { formateurId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [attente, setAttente] = useState(false)
  return (
    <Button size="sm" isLoading={attente} icon={<CheckCircle2 className="h-4 w-4" />}
      onClick={async () => {
        setAttente(true)
        const r = await marquerFormateurVerifieAction(formateurId)
        setAttente(false)
        if (!r.success) { toast('error', r.error || 'Échec'); return }
        toast('success', 'Fiche marquée comme vérifiée')
        router.refresh()
      }}>
      Marquer comme vérifiée
    </Button>
  )
}
