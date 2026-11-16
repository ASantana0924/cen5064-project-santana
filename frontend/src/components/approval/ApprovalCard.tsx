import { LoaderCircle, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'

import { useApproveTask } from '@/api/approvals'
import type { TaskDetails } from '@/api/types'
import { ProgressBar } from '@/components/ProgressBar'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/labels'

interface ApprovalCardProps {
  task: TaskDetails
  /** The "Acting as" name, recorded as the approver. Approving is disabled while it is empty. */
  developer: string
  /** True while any change to the task is saving. */
  busy: boolean
}

/**
 * UC-14: approval progress such as "1 of 2", the approvers, and, on an
 * IN_PROGRESS task, an Approve button enabled by canApprove. The button is
 * also disabled for a developer who already approved; the server applies the
 * same rule and is the authority.
 */
export function ApprovalCard({ task, developer, busy }: ApprovalCardProps) {
  const approve = useApproveTask(task.id)
  const count = task.approvals.length
  const required = task.requiredApprovals
  const showApprove = task.status === 'IN_PROGRESS'
  const alreadyApproved = hasApproved(task, developer)
  const hint = !task.canApprove
    ? 'Every check must pass before the task can be approved.'
    : alreadyApproved
      ? `You approved this task as ${developer}. A different developer must give the next approval.`
      : null

  function onApprove() {
    approve.mutate(developer, {
      onSuccess: (result) => {
        if (result.taskStatus === 'APPROVED') {
          toast.success('Task approved', { description: `${result.progress} approvals. Every check passed.` })
        } else {
          const remaining = result.requiredApprovals - result.approvalCount
          toast.success('Approval recorded', {
            description: `${result.progress} approvals. ${remaining === 1 ? 'One more developer' : `${remaining} more developers`} must approve.`,
          })
        }
      },
      onError: (error) => {
        toast.error('Could not approve the task', { description: error.message })
      },
    })
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>Approvals</h2>
        </CardTitle>
        <CardDescription>
          {count} of {required} approvals
        </CardDescription>
        {showApprove && (
          <CardAction>
            <Button
              size="sm"
              onClick={onApprove}
              disabled={hint !== null || developer === '' || busy}
              aria-describedby={hint ? 'approve-hint' : undefined}
            >
              {approve.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <ThumbsUp aria-hidden="true" />
              )}
              Approve
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressBar value={count} max={required} label="Approvals" />
        {showApprove && hint && (
          <p id="approve-hint" className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">No approvals yet.</p>
        ) : (
          <ul aria-label="Approvers" className="divide-y rounded-lg border">
            {task.approvals.map((approval) => (
              <li key={approval.developer} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{approval.developer}</span>
                <time dateTime={approval.approvedAt} className="text-muted-foreground">
                  {formatDateTime(approval.approvedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** The Domain compares approvers ignoring case, so this does too. */
function hasApproved(task: TaskDetails, developer: string): boolean {
  const name = developer.trim().toLowerCase()
  return name !== '' && task.approvals.some((approval) => approval.developer.trim().toLowerCase() === name)
}
