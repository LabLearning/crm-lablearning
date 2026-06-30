'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button, Modal, useToast } from '@/components/ui'
import { ClientForm } from '../ClientForm'
import type { Client } from '@/lib/types/crm'

export function ClientEditButton({ client }: { client: Client }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} icon={<Pencil className="h-4 w-4" />}>
        Modifier
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Modifier le client" size="lg">
        <ClientForm
          client={client}
          onSuccess={() => { setOpen(false); toast('success', 'Client mis à jour'); router.refresh() }}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
