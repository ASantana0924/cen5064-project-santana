import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { Link } from 'react-router'
import { FilePlus2, GitCompareArrows } from 'lucide-react'

import { useArtifacts } from '@/api/artifacts'
import type { TaskDetails } from '@/api/types'
import { ArtifactHistory } from '@/components/artifact/ArtifactHistory'
import { ErrorState, LoadingState } from '@/components/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Loaded when the user opens the form, so the form libraries (Zod, React Hook Form) stay out of the first download.
const RecordArtifactForm = lazy(async () => ({
  default: (await import('@/components/artifact/RecordArtifactForm')).RecordArtifactForm,
}))

interface ArtifactsCardProps {
  task: TaskDetails
  /** The "Acting as" name. Recording is disabled while it is empty. */
  developer: string
  /** True while any change to the task is saving. */
  busy: boolean
}

/**
 * UC-07 to UC-09: the AI artifacts of a task. Lists every version and, on an
 * IN_PROGRESS task, records the next one. UC-17: opens the comparison of two
 * versions once there are at least two.
 */
export function ArtifactsCard({ task, developer, busy }: ArtifactsCardProps) {
  const artifacts = useArtifacts(task.id, task.artifactCount)
  const [recording, setRecording] = useState(false)
  const canRecordNow = task.status === 'IN_PROGRESS'
  // If the task stops being IN_PROGRESS while the form is open, such as after a refresh, the form closes.
  const showForm = recording && canRecordNow
  const hasArtifacts = task.artifactCount > 0

  // After the form closes, focus goes back to the Record button instead of being lost.
  const refocusRecordButton = useRef(false)
  const recordButtonRef = useCallback((button: HTMLButtonElement | null) => {
    if (button && refocusRecordButton.current) {
      refocusRecordButton.current = false
      button.focus()
    }
  }, [])
  const closeForm = useCallback(() => {
    refocusRecordButton.current = true
    setRecording(false)
  }, [])

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>Artifacts</h2>
        </CardTitle>
        <CardDescription>AI-generated code recorded on this task, with the prompt and tool that produced it.</CardDescription>
        {task.editable && !showForm && (
          <CardAction className="flex flex-col items-end gap-1.5">
            <Button
              ref={recordButtonRef}
              size="sm"
              variant="outline"
              onClick={() => setRecording(true)}
              disabled={!canRecordNow || developer === '' || busy}
              aria-describedby={canRecordNow ? undefined : 'record-artifact-hint'}
            >
              <FilePlus2 aria-hidden="true" />
              {hasArtifacts ? 'Record new version' : 'Record artifact'}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {task.editable && !canRecordNow && (
          <p id="record-artifact-hint" className="text-sm text-muted-foreground">
            Start the task to record artifacts.
          </p>
        )}
        {showForm && (
          <Suspense fallback={<LoadingState label="Loading form" rows={2} />}>
            <RecordArtifactForm task={task} developer={developer} onClose={closeForm} />
          </Suspense>
        )}
        {hasArtifacts && <CompareVersionsLink taskId={task.id} artifactCount={task.artifactCount} />}
        {!hasArtifacts ? (
          <p className="text-sm text-muted-foreground">No artifacts yet.</p>
        ) : artifacts.isPending ? (
          <LoadingState label="Loading versions" rows={2} />
        ) : artifacts.isError ? (
          <ErrorState
            title="Could not load the versions"
            message={artifacts.error.message}
            action={
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void artifacts.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <ArtifactHistory taskId={task.id} artifacts={artifacts.data} />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Opens the comparison page. With one version there is nothing to compare, so
 * the button is disabled and says what is needed. Shown on every status,
 * since approved work is worth comparing too.
 */
function CompareVersionsLink({ taskId, artifactCount }: { taskId: string; artifactCount: number }) {
  if (artifactCount >= 2) {
    return (
      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline">
          <Link to={`/tasks/${encodeURIComponent(taskId)}/artifacts/compare`}>
            <GitCompareArrows aria-hidden="true" />
            Compare versions
          </Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <p id="compare-versions-hint" className="text-sm text-muted-foreground">
        Record a second version to compare.
      </p>
      <Button size="sm" variant="outline" disabled aria-describedby="compare-versions-hint">
        <GitCompareArrows aria-hidden="true" />
        Compare versions
      </Button>
    </div>
  )
}
