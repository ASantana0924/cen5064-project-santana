import { useRef, type ReactNode } from 'react'

import type { TaskDetails } from '@/api/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmResetDialogProps {
  task: TaskDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** What resets the checks, completing "… sets all six checks back to Pending". */
  cause: string
  confirmLabel: string
  onConfirm: () => void
  /** Optional detail, such as the text being added or removed. */
  children?: ReactNode
}

/**
 * Asks before a change that resets every check and clears every approval
 * (README rule 7), and says what the task will lose.
 */
export function ConfirmResetDialog({
  task,
  open,
  onOpenChange,
  title,
  cause,
  confirmLabel,
  onConfirm,
  children,
}: ConfirmResetDialogProps) {
  // The dialog is opened from code, not by a Radix trigger, so Radix does not know where focus came from.
  const returnFocusTo = useRef<Element | null>(null)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          returnFocusTo.current = document.activeElement
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocusTo.current
          if (target instanceof HTMLElement && target.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {cause} sets all six checks back to Pending and clears all approvals. {describeLoss(task)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** For example "You will lose 2 passed checks, 1 failed check, and 1 approval." */
function describeLoss(task: TaskDetails): string {
  const passed = task.checks.filter((check) => check.status === 'PASSED').length
  const failed = task.checks.filter((check) => check.status === 'FAILED').length
  const losses = [
    count(passed, 'passed check', 'passed checks'),
    count(failed, 'failed check', 'failed checks'),
    count(task.approvals.length, 'approval', 'approvals'),
  ].filter((loss) => loss !== '')

  if (losses.length === 0) {
    return 'No checks have been reviewed yet, so nothing is lost.'
  }
  return `You will lose ${joinWithAnd(losses)}.`
}

function count(n: number, singular: string, plural: string): string {
  if (n === 0) {
    return ''
  }
  return `${n} ${n === 1 ? singular : plural}`
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 2) {
    return items.join(' and ')
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
