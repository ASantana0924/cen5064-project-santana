import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { useTaskBusy } from '@/api/tasks'
import type { Check, CheckType, TaskDetails } from '@/api/types'
import { useFailCheck, usePassCheck } from '@/api/verification'
import { FormField } from '@/components/FormField'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { checkTypeLabel, formatDate } from '@/lib/labels'

export type CheckOutcome = 'pass' | 'fail'

/** The check being reviewed and the result being recorded. */
export interface CheckReview {
  type: CheckType
  outcome: CheckOutcome
}

const copy = {
  pass: {
    title: (label: string) => `Mark ${label} passed`,
    field: 'Evidence',
    hint: 'What you checked and what shows it passes, such as a test name, a review note, or a link.',
    required: 'Enter the evidence that this check passes.',
    confirm: 'Mark passed',
    success: (label: string) => `${label} passed`,
    errorTitle: 'Could not mark the check passed',
  },
  fail: {
    title: (label: string) => `Mark ${label} failed`,
    field: 'Notes',
    hint: 'What is wrong, so it can be fixed.',
    required: 'Enter notes on why this check fails.',
    confirm: 'Mark failed',
    success: (label: string) => `${label} failed`,
    errorTitle: 'Could not mark the check failed',
  },
} as const

// A usability check only. The backend applies the same rule and is the authority.
const reviewSchema = (message: string) => z.object({ text: z.string().trim().min(1, message) })

type ReviewValues = z.infer<ReturnType<typeof reviewSchema>>

interface CheckReviewDialogProps {
  task: TaskDetails
  review: CheckReview
  /** The "Acting as" name, recorded as the reviewer. */
  developer: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Radix calls this after the dialog closes. Prevent the default to move focus yourself. */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * UC-11 and UC-12: marks one check passed with evidence, or failed with notes.
 * Failing a check clears every approval, so the fail dialog says which
 * approvals will be lost. An empty field is blocked here; the server applies
 * the same rule and its message is shown if it refuses.
 */
export function CheckReviewDialog({
  task,
  review,
  developer,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: CheckReviewDialogProps) {
  const { type, outcome } = review
  const text = copy[outcome]
  const label = checkTypeLabel[type]
  const check = task.checks.find((candidate) => candidate.type === type)
  const pass = usePassCheck(task.id)
  const fail = useFailCheck(task.id)
  const saving = pass.isPending || fail.isPending
  const busy = useTaskBusy(task.id)
  const [serverError, setServerError] = useState<string | null>(null)
  const fieldId = `check-review-${outcome}`

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema(text.required)),
    defaultValues: { text: '' },
  })

  const callbacks = {
    onSuccess: () => {
      toast.success(text.success(label), {
        description: outcome === 'fail' && task.approvals.length > 0 ? 'Approvals were cleared.' : undefined,
      })
      onOpenChange(false)
    },
    onError: (error: Error) => setServerError(error.message),
  }

  const onSubmit = handleSubmit(({ text: value }) => {
    setServerError(null)
    if (outcome === 'pass') {
      pass.mutate({ type, evidence: value, reviewer: developer }, callbacks)
    } else {
      fail.mutate({ type, notes: value, reviewer: developer }, callbacks)
    }
  })

  const error = errors.text?.message
  const describedBy = [`${fieldId}-hint`, error ? `${fieldId}-error` : null].filter(Boolean).join(' ')

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{text.title(label)}</DialogTitle>
            <DialogDescription>
              You are recording this review as <span className="font-medium text-foreground">{developer}</span>.
            </DialogDescription>
          </DialogHeader>

          {check && check.status !== 'PENDING' && <CurrentResult check={check} />}

          <FormField id={fieldId} label={text.field} error={error}>
            <p id={`${fieldId}-hint`} className="text-sm text-muted-foreground">
              {text.hint}
            </p>
            <Textarea
              id={fieldId}
              rows={4}
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              {...register('text')}
            />
          </FormField>

          {outcome === 'fail' && <ApprovalWarning task={task} />}

          {serverError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>{text.errorTitle}</AlertTitle>
              <AlertDescription>
                <p>{serverError}</p>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant={outcome === 'fail' ? 'destructive' : 'default'} disabled={busy}>
              {saving && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {text.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The review being replaced, so the reviewer sees what they are changing. */
function CurrentResult({ check }: { check: Check }) {
  const passed = check.status === 'PASSED'
  const detail = passed ? check.evidence : check.notes
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <p className="font-medium">
        Currently {passed ? 'passed' : 'failed'}
        {check.reviewer && <> by {check.reviewer}</>}
        {check.reviewedOn && <> on {formatDate(check.reviewedOn)}</>}
      </p>
      {detail && <p className="break-words whitespace-pre-line text-muted-foreground">{detail}</p>}
    </div>
  )
}

/** Failing a check clears every approval (README rule 7). Says which ones. */
function ApprovalWarning({ task }: { task: TaskDetails }) {
  const count = task.approvals.length
  const names = task.approvals.map((approval) => approval.developer).join(', ')
  return (
    <div role="note" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p>
        {count === 0 ? (
          <>Marking a check failed clears all approvals. This task has none yet.</>
        ) : (
          <>
            Marking this check failed clears {count === 1 ? '1 approval' : `${count} approvals`} ({names}). The task
            goes back to 0 of {task.requiredApprovals} and must be approved again after every check passes.
          </>
        )}
      </p>
    </div>
  )
}
