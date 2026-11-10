import { lazy, Suspense, useCallback, useRef, useState, type ReactNode, type Ref } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, LoaderCircle, Pencil, Play, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError } from '@/api/client'
import { useStartTask, useTask, useTaskBusy } from '@/api/tasks'
import type { Check, TaskDetails } from '@/api/types'
import { CheckStatusBadge } from '@/components/CheckStatusBadge'
import { ErrorState, LoadingState } from '@/components/PageStates'
import { ProgressBar } from '@/components/ProgressBar'
import { EditableTextList } from '@/components/task/EditableTextList'
import { TaskStatusBadge } from '@/components/TaskStatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { checkTypeLabel, formatDate, formatDateTime } from '@/lib/labels'
import { useDeveloper } from '@/lib/useDeveloper'

// Loaded when the user clicks Edit, so the form libraries (Zod, React Hook Form) stay out of the first download.
const EditTaskDetailsForm = lazy(async () => ({
  default: (await import('@/components/task/EditTaskDetailsForm')).EditTaskDetailsForm,
}))

/**
 * UC-06: one task in full. UC-02 to UC-04: edit it, manage its requirements
 * and acceptance criteria, and start it. The editable and canStart flags from
 * the API decide which controls show and which are enabled.
 */
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
  const { developer } = useDeveloper()
  const busy = useTaskBusy(task.id)
  const [editing, setEditing] = useState(false)
  const passed = task.checks.filter((check) => check.status === 'PASSED').length
  // If the task stops being editable while the form is open, such as after a refresh, the form closes.
  const showEditForm = editing && task.editable

  // After the form closes, focus goes back to the Edit button instead of being lost.
  const refocusEditButton = useRef(false)
  const editButtonRef = useCallback((button: HTMLButtonElement | null) => {
    if (button && refocusEditButton.current) {
      refocusEditButton.current = false
      button.focus()
    }
  }, [])
  const closeEditForm = useCallback(() => {
    refocusEditButton.current = true
    setEditing(false)
  }, [])

  return (
    <>
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{task.title}</h1>
            <TaskStatusBadge status={task.status} />
          </div>
          {task.editable && !showEditForm && (
            <TaskActions
              task={task}
              developer={developer}
              busy={busy}
              onEdit={() => setEditing(true)}
              editButtonRef={editButtonRef}
            />
          )}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <Meta term="Owner">{task.owner}</Meta>
          <Meta term="Artifacts">{task.artifactCount === 1 ? '1 version' : `${task.artifactCount} versions`}</Meta>
        </dl>
        {showEditForm ? (
          <Suspense fallback={<LoadingState label="Loading form" rows={2} />}>
            <EditTaskDetailsForm task={task} developer={developer} onClose={closeEditForm} />
          </Suspense>
        ) : task.description ? (
          <p className="max-w-prose whitespace-pre-line text-muted-foreground">{task.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No description.</p>
        )}
      </header>

      {task.editable && developer === '' && (
        <Alert role="note">
          <UserRound aria-hidden="true" />
          <AlertTitle>Choose a name to make changes</AlertTitle>
          <AlertDescription>
            <p>Every change is recorded with a name. Choose yours with “Choose a name” at the top of the page.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <EditableTextList task={task} list="requirements" developer={developer} busy={busy} />
        <EditableTextList task={task} list="acceptanceCriteria" developer={developer} busy={busy} />
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

interface TaskActionsProps {
  task: TaskDetails
  developer: string
  busy: boolean
  onEdit: () => void
  editButtonRef: Ref<HTMLButtonElement>
}

/** Edit and, for a draft, Start. Shown only while the task is editable. */
function TaskActions({ task, developer, busy, onEdit, editButtonRef }: TaskActionsProps) {
  const start = useStartTask(task.id)
  const hasName = developer !== ''
  const isDraft = task.status === 'DRAFT'

  function onStart() {
    start.mutate(developer, {
      onSuccess: () => {
        toast.success('Task started', { description: 'It is now in progress, so its checks can be reviewed.' })
      },
      onError: (error) => {
        toast.error('Could not start the task', { description: error.message })
      },
    })
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <div className="flex gap-2">
        <Button ref={editButtonRef} variant="outline" size="sm" onClick={onEdit} disabled={!hasName}>
          <Pencil aria-hidden="true" />
          Edit
        </Button>
        {isDraft && (
          <Button
            size="sm"
            onClick={onStart}
            disabled={!task.canStart || !hasName || busy}
            aria-describedby={task.canStart ? undefined : 'start-hint'}
          >
            {start.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
            Start task
          </Button>
        )}
      </div>
      {isDraft && !task.canStart && (
        <p id="start-hint" className="text-xs text-muted-foreground">
          Add at least one requirement and one acceptance criterion to start.
        </p>
      )}
    </div>
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
