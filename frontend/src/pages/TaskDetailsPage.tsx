import { lazy, Suspense, useCallback, useRef, useState, type ReactNode, type Ref } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, LoaderCircle, Pencil, Play, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError } from '@/api/client'
import { useStartTask, useTask, useTaskBusy } from '@/api/tasks'
import type { TaskDetails } from '@/api/types'
import { ApprovalCard } from '@/components/approval/ApprovalCard'
import { ReopenControl } from '@/components/approval/ReopenControl'
import { ArtifactsCard } from '@/components/artifact/ArtifactsCard'
import { AuditCard } from '@/components/audit/AuditCard'
import { ChecksCard } from '@/components/check/ChecksCard'
import { ErrorState, LoadingState } from '@/components/PageStates'
import { DownloadReportButton } from '@/components/task/DownloadReportButton'
import { EditableTextList } from '@/components/task/EditableTextList'
import { TaskStatusBadge } from '@/components/TaskStatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDeveloper } from '@/lib/useDeveloper'

// Loaded when the user clicks Edit, so the form libraries (Zod, React Hook Form) stay out of the first download.
const EditTaskDetailsForm = lazy(async () => ({
  default: (await import('@/components/task/EditTaskDetailsForm')).EditTaskDetailsForm,
}))

/**
 * UC-06: one task in full. UC-02 to UC-04: edit it, manage its requirements
 * and acceptance criteria, and start it. UC-07 to UC-09: record and browse its
 * artifact versions. UC-10 to UC-13: review its checks and record test runs.
 * UC-14 to UC-16: approve it, reopen it, and read its audit history. UC-18:
 * download its verification report. The
 * editable, canStart, and canApprove flags and the status from the API decide
 * which controls show and which are enabled.
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
            {/* Focusable from code only, so focus has somewhere to go after the Reopen button disappears. */}
            <h1 id="task-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight break-words outline-none">
              {task.title}
            </h1>
            <TaskStatusBadge status={task.status} />
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {task.editable && !showEditForm && (
              <TaskActions
                task={task}
                developer={developer}
                busy={busy}
                onEdit={() => setEditing(true)}
                editButtonRef={editButtonRef}
              />
            )}
            <ReopenControl task={task} developer={developer} fallbackFocusId="task-title" />
            <DownloadReportButton taskId={task.id} />
          </div>
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

      {(task.editable || task.status === 'APPROVED') && developer === '' && (
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

      <ArtifactsCard task={task} developer={developer} busy={busy} />

      <ChecksCard task={task} developer={developer} busy={busy} />

      <ApprovalCard task={task} developer={developer} busy={busy} />

      <AuditCard taskId={task.id} />
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
