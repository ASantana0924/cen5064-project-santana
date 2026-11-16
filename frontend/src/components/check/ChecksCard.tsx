import { lazy, Suspense, useRef, useState, type MouseEvent } from 'react'
import { CircleCheck, CircleDashed, CircleX } from 'lucide-react'

import type { CheckStatus, TaskDetails } from '@/api/types'
import type { CheckOutcome, CheckReview } from '@/components/check/CheckReviewDialog'
import { CheckRow } from '@/components/check/CheckRow'
import { ProgressBar } from '@/components/ProgressBar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Loaded when the user opens a dialog, so the form libraries (Zod, React Hook Form) stay out of the first download.
const CheckReviewDialog = lazy(async () => ({
  default: (await import('@/components/check/CheckReviewDialog')).CheckReviewDialog,
}))

interface ChecksCardProps {
  task: TaskDetails
  /** The "Acting as" name, recorded as the reviewer. Reviewing is disabled while it is empty. */
  developer: string
  /** True while any change to the task is saving. */
  busy: boolean
}

/**
 * UC-10 to UC-13: the six checks with a summary of how many are passed,
 * failed, and pending. On an IN_PROGRESS task each check can be marked passed
 * or failed, and the TESTING check lists and records test runs.
 */
export function ChecksCard({ task, developer, busy }: ChecksCardProps) {
  // The review in the dialog. Kept after the dialog closes so its text does not change while it fades out.
  const [review, setReview] = useState<CheckReview | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  // Counts dialog openings, so each opening starts with an empty form.
  const [openings, setOpenings] = useState(0)
  const returnFocusTo = useRef<HTMLButtonElement | null>(null)
  const canReview = task.status === 'IN_PROGRESS'

  function openReview(type: CheckReview['type'], outcome: CheckOutcome, event: MouseEvent<HTMLButtonElement>) {
    returnFocusTo.current = event.currentTarget
    setReview({ type, outcome })
    setOpenings((count) => count + 1)
    setDialogOpen(true)
  }

  /**
   * Focus goes back to the button that opened the dialog. After a review that
   * button is often gone, such as "Mark passed" on a check that just passed,
   * so focus moves to the other review button in the same row.
   */
  function onCloseAutoFocus(event: Event) {
    event.preventDefault()
    const opener = returnFocusTo.current
    if (opener?.isConnected && !opener.disabled) {
      opener.focus()
      return
    }
    if (review) {
      const row = document.getElementById(`check-${review.type}`)
      row?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>Checks</h2>
        </CardTitle>
        <CardDescription>All six must pass before the task can be approved.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <ProgressBar value={countOf(task, 'PASSED')} max={task.checks.length} label="Checks passed" />
          <VerificationSummary task={task} />
        </div>
        {task.status === 'DRAFT' && <p className="text-sm text-muted-foreground">Start the task to review checks.</p>}
        <ul aria-label="Checks" className="divide-y rounded-lg border">
          {task.checks.map((check) => (
            <CheckRow
              key={check.type}
              task={task}
              check={check}
              developer={developer}
              busy={busy}
              onReview={(outcome, event) => openReview(check.type, outcome, event)}
            />
          ))}
        </ul>
      </CardContent>
      {review && (
        <Suspense fallback={null}>
          <CheckReviewDialog
            key={openings}
            task={task}
            review={review}
            developer={developer}
            // If the task stops being IN_PROGRESS while the dialog is open, such as after a refresh, the dialog closes.
            open={dialogOpen && canReview}
            onOpenChange={setDialogOpen}
            onCloseAutoFocus={onCloseAutoFocus}
          />
        </Suspense>
      )}
    </Card>
  )
}

const summaryItems: { status: CheckStatus; label: string; Icon: typeof CircleCheck; className: string }[] = [
  { status: 'PASSED', label: 'passed', Icon: CircleCheck, className: 'text-success' },
  { status: 'FAILED', label: 'failed', Icon: CircleX, className: 'text-destructive' },
  { status: 'PENDING', label: 'pending', Icon: CircleDashed, className: 'text-muted-foreground' },
]

/** UC-13: how many checks are passed, failed, and pending. */
function VerificationSummary({ task }: { task: TaskDetails }) {
  return (
    <ul aria-label="Verification summary" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {summaryItems.map(({ status, label, Icon, className }) => (
        <li key={status} className="flex items-center gap-1.5">
          <Icon aria-hidden="true" className={cn('size-4', className)} />
          <span className="tabular-nums">
            {countOf(task, status)} {label}
          </span>
        </li>
      ))}
    </ul>
  )
}

function countOf(task: TaskDetails, status: CheckStatus): number {
  return task.checks.filter((check) => check.status === status).length
}
