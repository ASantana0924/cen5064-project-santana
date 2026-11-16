import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { useReopenTask } from '@/api/approvals'
import { useTaskBusy } from '@/api/tasks'
import type { TaskDetails } from '@/api/types'
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

// A usability check only. The backend applies the same rule and is the authority.
const reopenSchema = z.object({
  reason: z.string().trim().min(1, 'Enter why the task is being reopened.'),
})

type ReopenValues = z.infer<typeof reopenSchema>

interface ReopenDialogProps {
  task: TaskDetails
  /** The "Acting as" name, recorded with the reason. */
  developer: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Radix calls this after the dialog closes. Prevent the default to move focus yourself. */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * UC-15: reopens an APPROVED task with a required reason. The task returns to
 * IN_PROGRESS with every check PENDING and no approvals; the old approvals and
 * the reason stay in the audit history (README rule 8).
 */
export function ReopenDialog({ task, developer, open, onOpenChange, onCloseAutoFocus }: ReopenDialogProps) {
  const reopen = useReopenTask(task.id)
  const busy = useTaskBusy(task.id)
  const [serverError, setServerError] = useState<string | null>(null)
  const approvers = task.approvals.map((approval) => approval.developer).join(' and ')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReopenValues>({
    resolver: zodResolver(reopenSchema),
    defaultValues: { reason: '' },
  })

  const onSubmit = handleSubmit(({ reason }) => {
    setServerError(null)
    reopen.mutate(
      { developer, reason },
      {
        onSuccess: () => {
          toast.success('Task reopened', {
            description: 'It is in progress again, with all six checks back to Pending.',
          })
          onOpenChange(false)
        },
        onError: (error) => setServerError(error.message),
      },
    )
  })

  const error = errors.reason?.message

  return (
    <Dialog open={open} onOpenChange={(next) => !reopen.isPending && onOpenChange(next)}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Reopen this task?</DialogTitle>
            <DialogDescription>
              It goes back to In progress, all six checks are set back to Pending, and the approvals
              {approvers && <> by {approvers}</>} are cleared. They stay in the history with your reason.
            </DialogDescription>
          </DialogHeader>

          <FormField id="reopen-reason" label="Reason" error={error}>
            <Textarea
              id="reopen-reason"
              rows={3}
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'reopen-reason-error' : undefined}
              {...register('reason')}
            />
          </FormField>

          <p className="text-sm text-muted-foreground">
            You are reopening it as <span className="font-medium text-foreground">{developer}</span>.
          </p>

          {serverError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Could not reopen the task</AlertTitle>
              <AlertDescription>
                <p>{serverError}</p>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={reopen.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {reopen.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              Reopen task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
