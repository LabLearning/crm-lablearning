'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { ClientForm } from '../ClientForm'
import type { Client } from '@/lib/types/crm'

export function ClientEditButton({ client, users = [], canAssign = false, franchises = [], apporteurs = [] }: { client: Client; users?: { id: string; first_name: string | null; last_name: string | null }[]; canAssign?: boolean; franchises?: { id: string; nom: string }[]; apporteurs?: { id: string; label: string }[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} icon={<Pencil className="h-4 w-4" />} className="w-full sm:w-auto">
        Modifier
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Modifier le client" size="lg">
        <ClientForm
          client={client}
          users={users}
          franchises={franchises}
          apporteurs={apporteurs}
          canAssign={canAssign}
          onSuccess={() => { setOpen(false); toast('success', 'Client mis à jour'); router.refresh() }}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
