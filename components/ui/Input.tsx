'use client'

import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CopyButton, valeurACopier } from './CopyButton'

/** Collage dans un champ date natif : « 12/05/1985 », « 12-05-85 » ou ISO
 *  sont convertis — le navigateur refuse sinon tout copier-coller. */
function collerDate(e: React.ClipboardEvent<HTMLInputElement>) {
  const texte = e.clipboardData.getData('text').trim()
  let iso: string | null = null
  let m = texte.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})$/)
  if (m) {
    let [, j, mo, a] = m
    if (a.length === 2) a = (Number(a) > 30 ? '19' : '20') + a
    iso = `${a}-${mo.padStart(2, '0')}-${j.padStart(2, '0')}`
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
    iso = texte
  }
  if (!iso) return
  e.preventDefault()
  const input = e.currentTarget
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, iso)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Copie depuis un champ date natif : le navigateur ne copie rien de lui-même (rien n'y est
 *  sélectionnable). Ctrl+C dans le champ copie la date au format JJ/MM/AAAA. */
function copierDate(e: React.ClipboardEvent<HTMLInputElement>) {
  const date = valeurACopier(e.currentTarget.value, 'date')
  if (!date) return
  e.clipboardData.setData('text/plain', date)
  e.preventDefault()
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  /** Champ date : affiche un bouton « copier » à côté du libellé (la date part au format JJ/MM/AAAA). */
  copiable?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, copiable, onInput, onPaste, onCopy, ...props }, ref) => {
    const estDate = props.type === 'date'
    // Champ non contrôlé : on suit la saisie pour que le bouton copie la date du moment, pas celle du chargement
    const [saisie, setSaisie] = useState(String(props.defaultValue ?? ''))
    const valeurDate = props.value !== undefined ? String(props.value ?? '') : saisie
    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={id} className="block text-sm font-medium text-surface-700">
              {label}
            </label>
            {estDate && copiable && <CopyButton valeur={valeurDate} format="date" libelle={`la ${label.toLowerCase()}`} className="-my-1" />}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'input-base',
            error && 'border-danger-500 focus:ring-danger-500/20 focus:border-danger-500',
            className
          )}
          {...props}
          onPaste={estDate ? collerDate : onPaste}
          onCopy={estDate ? copierDate : onCopy}
          onInput={(e) => { if (estDate) setSaisie(e.currentTarget.value); onInput?.(e) }}
        />
        {error && <p className="text-xs text-danger-600">{error}</p>}
        {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export { Input }
