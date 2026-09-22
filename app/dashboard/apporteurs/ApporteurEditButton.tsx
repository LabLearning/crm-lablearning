'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from '@/components/ui/icons'
import { Button, Modal } from '@/components/ui'
import { ApporteurForm } from './ApporteursList'
import type { ApporteurAffaires } from '@/lib/types/crm'

/** Bouton Modifier de la fiche apporteur : même formulaire que la liste. */
export function ApporteurEditButton({ apporteur }: { apporteur: ApporteurAffaires }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} icon={<Pencil className="h-4 w-4" />} className="w-full sm:w-auto">
        Modifier
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Modifier l'apporteur" size="lg">
        <ApporteurForm apporteur={apporteur} onDone={() => { setOpen(false); router.refresh() }} />
      </Modal>
    </>
  )
}
