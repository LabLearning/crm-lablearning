'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StickyNote, Save } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { updateClientNotesAction } from '../actions'

export function ClientNotes({ clientId, initialNotes }: { clientId: string; initialNotes: string | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [notes, setNotes] = useState(initialNotes || '')
  const [saving, setSaving] = useState(false)

  const dirty = notes !== (initialNotes || '')

  async function handleSave() {
    setSaving(true)
    const result = await updateClientNotesAction(clientId, notes)
    if (result.success) {
      toast('success', 'Commentaire enregistré')
      router.refresh()
    } else {
      toast('error', result.error || 'Erreur')
    }
    setSaving(false)
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Commentaires</span>
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSave} isLoading={saving} icon={<Save className="h-3.5 w-3.5" />}>
            Enregistrer
          </Button>
        )}
      </div>
      <div className="p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Ajouter un commentaire, une note interne sur ce client..."
          className="input-base resize-none w-full text-sm"
        />
      </div>
    </div>
  )
}
