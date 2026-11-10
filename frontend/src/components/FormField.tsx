import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

interface FormFieldProps {
  id: string
  label: string
  hint?: string
  /** Shown under the control with the id `${id}-error`. Point the control's aria-describedby at it. */
  error?: string
  children: ReactNode
}

/** A label, one form control, and its error message. */
export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
