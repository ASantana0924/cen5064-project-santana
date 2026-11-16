import type { MouseEvent } from 'react'
import { Check as CheckIcon, X } from 'lucide-react'

import type { Check, TaskDetails } from '@/api/types'
import type { CheckOutcome } from '@/components/check/CheckReviewDialog'
import { TestRunsPanel } from '@/components/check/TestRunsPanel'
import { CheckStatusBadge } from '@/components/CheckStatusBadge'
import { Button } from '@/components/ui/button'
import { checkTypeLabel, formatDate } from '@/lib/labels'

interface CheckRowProps {
  task: TaskDetails
  check: Check
  developer: string
  busy: boolean
  /** Opens the review dialog. The event's button gets focus back when the dialog closes. */
  onReview: (outcome: CheckOutcome, event: MouseEvent<HTMLButtonElement>) => void
}

/**
 * One check: its status, reviewer, date, and evidence or notes. On an
 * IN_PROGRESS task it offers the reviews the Domain allows from its status:
 * a passed check can only be failed and a failed one only passed. The TESTING
 * check also lists its test runs.
 */
export function CheckRow({ task, check, developer, busy, onReview }: CheckRowProps) {
  const label = checkTypeLabel[check.type]
  const canReview = task.status === 'IN_PROGRESS'
  const disabled = developer === '' || busy
  const detail = check.status === 'FAILED' ? check.notes : check.evidence

  return (
    <li id={`check-${check.type}`} aria-labelledby={`check-${check.type}-name`} className="space-y-3 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`check-${check.type}-name`} className="text-sm font-medium">
              {label}
            </h3>
            <CheckStatusBadge status={check.status} />
          </div>
          {detail && (
            <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
              <span className="font-medium text-foreground">{check.status === 'FAILED' ? 'Notes: ' : 'Evidence: '}</span>
              {detail}
            </p>
          )}
          {check.reviewer && (
            <p className="text-xs text-muted-foreground">
              Reviewed by {check.reviewer}
              {check.reviewedOn && <> on {formatDate(check.reviewedOn)}</>}
            </p>
          )}
        </div>
        {canReview && (
          <div className="flex shrink-0 gap-2">
            {check.status !== 'PASSED' && (
              <Button size="sm" variant="outline" disabled={disabled} onClick={(event) => onReview('pass', event)}>
                <CheckIcon aria-hidden="true" />
                Mark passed <span className="sr-only">for {label}</span>
              </Button>
            )}
            {check.status !== 'FAILED' && (
              <Button size="sm" variant="outline" disabled={disabled} onClick={(event) => onReview('fail', event)}>
                <X aria-hidden="true" />
                Mark failed <span className="sr-only">for {label}</span>
              </Button>
            )}
          </div>
        )}
      </div>
      {check.type === 'TESTING' && <TestRunsPanel task={task} developer={developer} busy={busy} />}
    </li>
  )
}
