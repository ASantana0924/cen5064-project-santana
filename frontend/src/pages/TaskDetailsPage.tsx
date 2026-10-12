import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'

import { ApiError } from '@/api/client'
import { useTask } from '@/api/tasks'
import type { Check, TaskDetails } from '@/api/types'
import { CheckStatusBadge } from '@/components/CheckStatusBadge'
import { ErrorState, LoadingState } from '@/components/PageStates'
import { ProgressBar } from '@/components/ProgressBar'
import { TaskStatusBadge } from '@/components/TaskStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { checkTypeLabel, formatDate, formatDateTime } from '@/lib/labels'

/** UC-06: one task in full. Read only for now; editing and starting come in #56. */
export function TaskDetailsPage() {
  const { id = '' } = useParams()
  const task = useTask(id)

  return (
    <div className="space-y-6">
      <BackLink />
      {task.isPending ? (
        <LoadingState label="Loading task" rows={4} />
      ) : task.isError ? (
        isMissingTask(task.error) ? (
          <ErrorState
            title="Task not found"
            message="No task has this ID. Tasks are kept in memory, so they are lost when the server restarts."
            action={<BackLink className="mt-2" />}
          />
        ) : (
          <ErrorState
            title="Could not load the task"
            message={task.error.message}
            action={
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void task.refetch()}>
                Try again
              </Button>
            }
          />
        )
      ) : (
        <TaskView task={task.data} />
      )}
    </div>
  )
}

/** 404 for an unknown task, or 400 when the ID in the URL is not a valid UUID. */
function isMissingTask(error: Error): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400)
}

function BackLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground ${className}`}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      All tasks
    </Link>
  )
}

function TaskView({ task }: { task: TaskDetails }) {
  const passed = task.checks.filter((check) => check.status === 'PASSED').length

  return (
    <>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{task.title}</h1>
          <TaskStatusBadge status={task.status} />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <Meta term="Owner">{task.owner}</Meta>
          <Meta term="Artifacts">{task.artifactCount === 1 ? '1 version' : `${task.artifactCount} versions`}</Meta>
        </dl>
        {task.description ? (
          <p className="max-w-prose whitespace-pre-line text-muted-foreground">{task.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No description.</p>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <TextList title="Requirements" items={task.requirements} empty="No requirements yet." />
        <TextList title="Acceptance criteria" items={task.acceptanceCriteria} empty="No acceptance criteria yet." />
      </div>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>
            <h2>Checks</h2>
          </CardTitle>
          <CardDescription>All six must pass before the task can be approved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar value={passed} max={task.checks.length} label="Checks passed" />
          <ul className="divide-y rounded-lg border">
            {task.checks.map((check) => (
              <CheckRow key={check.type} check={check} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>
            <h2>Approvals</h2>
          </CardTitle>
          <CardDescription>
            {task.approvals.length} of {task.requiredApprovals} approvals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {task.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approvals yet.</p>
          ) : (
            <ul className="space-y-2">
              {task.approvals.map((approval) => (
                <li key={approval.developer} className="flex flex-wrap justify-between gap-2 text-sm">
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
    </>
  )
}

function Meta({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function TextList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
            {items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function CheckRow({ check }: { check: Check }) {
  const detail = check.status === 'FAILED' ? check.notes : check.evidence
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{checkTypeLabel[check.type]}</p>
        {detail && <p className="text-sm break-words text-muted-foreground">{detail}</p>}
        {check.reviewer && (
          <p className="text-xs text-muted-foreground">
            {check.reviewer}
            {check.reviewedOn && <> on {formatDate(check.reviewedOn)}</>}
          </p>
        )}
      </div>
      <CheckStatusBadge status={check.status} />
    </li>
  )
}
