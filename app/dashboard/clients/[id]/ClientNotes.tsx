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
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-400 uppercase tracking-wider">
          <StickyNote className="h-3.5 w-3.5" /> Commentaires
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSave} isLoading={saving} icon={<Save className="h-3.5 w-3.5" />}>
            Enregistrer
          </Button>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Ajouter un commentaire, une note interne sur ce client..."
        className="input-base resize-none w-full text-sm"
      />
    </div>
  )
}
