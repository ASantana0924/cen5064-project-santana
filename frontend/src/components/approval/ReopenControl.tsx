import { lazy, Suspense, useRef, useState, type MouseEvent } from 'react'
import { RotateCcw } from 'lucide-react'

import { useTaskBusy } from '@/api/tasks'
import type { TaskDetails } from '@/api/types'
import { Button } from '@/components/ui/button'

// Loaded when the user opens the dialog, so the form libraries (Zod, React Hook Form) stay out of the first download.
const ReopenDialog = lazy(async () => ({
  default: (await import('@/components/approval/ReopenDialog')).ReopenDialog,
}))

interface ReopenControlProps {
  task: TaskDetails
  /** The "Acting as" name. Reopening is disabled while it is empty. */
  developer: string
  /** The element that gets focus once the task is reopened and this button is gone, such as the page heading. */
  fallbackFocusId: string
}

/**
 * UC-15: the Reopen button, shown only for an APPROVED task, and its dialog.
 * The dialog stays mounted after the task is reopened, so it can close and
 * move focus instead of vanishing with the button.
 */
export function ReopenControl({ task, developer, fallbackFocusId }: ReopenControlProps) {
  const busy = useTaskBusy(task.id)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  // Counts openings, so each one starts with an empty form.
  const [openings, setOpenings] = useState(0)
  const opener = useRef<HTMLButtonElement | null>(null)
  const isApproved = task.status === 'APPROVED'

  function onOpen(event: MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget
    setMounted(true)
    setOpenings((count) => count + 1)
    setOpen(true)
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault()
    const button = opener.current
    if (button?.isConnected) {
      button.focus()
    } else {
      document.getElementById(fallbackFocusId)?.focus()
    }
  }

  return (
    <>
      {isApproved && (
        <Button variant="outline" size="sm" onClick={onOpen} disabled={developer === '' || busy}>
          <RotateCcw aria-hidden="true" />
          Reopen
        </Button>
      )}
      {mounted && (
        <Suspense fallback={null}>
          <ReopenDialog
            key={openings}
            task={task}
            developer={developer}
            // Once the task is no longer APPROVED, such as right after reopening it, the dialog closes.
            open={open && isApproved}
            onOpenChange={setOpen}
            onCloseAutoFocus={onCloseAutoFocus}
          />
        </Suspense>
      )}
    </>
  )
}
