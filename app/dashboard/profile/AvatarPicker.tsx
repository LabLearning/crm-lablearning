'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Upload, Trash2, CircleUserRound, Check, Loader2 } from 'lucide-react'
import { Avatar, Badge, useToast } from '@/components/ui'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { setAvatarAction } from './actions'
import type { User } from '@/lib/types'

// Avatars préfaits — générés (DiceBear, SVG). Trois familles, mêmes graines
// pour une grille cohérente. L'URL est stockée telle quelle dans avatar_url.
const SEEDS = ['Atlas', 'Nova', 'Sage', 'Orion', 'Luna', 'Milo', 'Iris', 'Ezra', 'Wren', 'Cleo', 'Hugo', 'Zoe']
const FAMILIES: { key: string; label: string; style: string; bg?: string }[] = [
  { key: 'people', label: 'Personnages', style: 'notionists', bg: 'c0e8d5,d9f0e6,e6e1f5,fbe4d6,d6e6fb' },
  { key: 'fun', label: 'Illustrations', style: 'adventurer-neutral', bg: 'c0e8d5,d9f0e6,e6e1f5,fbe4d6,d6e6fb' },
  { key: 'bots', label: 'Robots', style: 'bottts', bg: '195245,2f6f5e,0ea5e9,6366f1,f59e0b' },
]
const avatarUrl = (style: string, seed: string, bg?: string) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}${bg ? `&backgroundColor=${bg}` : ''}&radius=50`

export function AvatarPicker({ user }: { user: User }) {
  const { toast } = useToast()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [gallery, setGallery] = useState(false)
  const [family, setFamily] = useState(FAMILIES[0])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/profile/upload-avatar', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (res.ok) { toast('success', 'Photo mise à jour'); setGallery(false); router.refresh() }
    else toast('error', json.error || "Échec de l'envoi")
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function choose(url: string) {
    setBusy(true)
    const r = await setAvatarAction(url)
    if (r.success) { toast('success', 'Avatar mis à jour'); router.refresh() }
    else toast('error', r.error || 'Erreur')
    setBusy(false)
  }

  async function remove() {
    setBusy(true)
    const res = await fetch('/api/profile/upload-avatar', { method: 'DELETE' })
    if (res.ok) { toast('success', 'Avatar retiré'); setGallery(false); router.refresh() }
    else toast('error', 'Erreur')
    setBusy(false)
  }

  return (
    <div className="card p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="relative shrink-0">
          <Avatar firstName={user.first_name} lastName={user.last_name} src={user.avatar_url} size="xl" className="!h-20 !w-20 !text-xl" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Importer une photo"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm ring-2 ring-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="min-w-0">
          <h2 className="text-xl font-heading font-bold text-surface-900">{user.first_name} {user.last_name}</h2>
          <p className="text-sm text-surface-500 mt-0.5">{user.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={ROLE_COLORS[user.role]} dot>{ROLE_LABELS[user.role]}</Badge>
            <span className="text-xs text-surface-400">Membre depuis {formatDate(user.created_at)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-60">
            <Upload className="h-4 w-4 text-surface-400" /> Importer une photo
          </button>
          <button type="button" onClick={() => setGallery((v) => !v)} disabled={busy}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${gallery ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-surface-200 text-surface-700 hover:bg-surface-50'}`}>
            <CircleUserRound className="h-4 w-4" /> Choisir un avatar
          </button>
          {user.avatar_url && (
            <button type="button" onClick={remove} disabled={busy} title="Retirer l'avatar"
              className="inline-flex items-center gap-2 rounded-xl border border-surface-200 px-3 py-2 text-sm font-medium text-surface-500 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-60">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />

      {gallery && (
        <div className="mt-6 pt-5 border-t border-surface-100">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex gap-1 p-1 bg-surface-100 rounded-xl">
              {FAMILIES.map((f) => (
                <button key={f.key} type="button" onClick={() => setFamily(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${family.key === f.key ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-surface-400 hidden sm:block">Clique sur un avatar pour le choisir</p>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {SEEDS.map((seed) => {
              const url = avatarUrl(family.style, seed, family.bg)
              const active = user.avatar_url === url
              return (
                <button key={seed} type="button" onClick={() => choose(url)} disabled={busy}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:scale-[1.04] disabled:opacity-60 ${active ? 'border-brand-500 ring-2 ring-brand-200' : 'border-surface-100 hover:border-surface-200'}`}>
                  <img src={url} alt={seed} className="h-full w-full object-cover bg-surface-50" />
                  {active && (
                    <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-sm">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
