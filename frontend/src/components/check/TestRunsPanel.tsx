import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { FlaskConical } from 'lucide-react'

import type { TaskDetails } from '@/api/types'
import { useTestRuns } from '@/api/verification'
import { TestRunList } from '@/components/check/TestRunList'
import { ErrorState, LoadingState } from '@/components/PageStates'
import { Button } from '@/components/ui/button'

// Loaded when the user opens the form, so the form libraries (Zod, React Hook Form) stay out of the first download.
const RecordTestRunForm = lazy(async () => ({
  default: (await import('@/components/check/RecordTestRunForm')).RecordTestRunForm,
}))

interface TestRunsPanelProps {
  task: TaskDetails
  /** The "Acting as" name. Recording is disabled while it is empty. */
  developer: string
  /** True while any change to the task is saving. */
  busy: boolean
}

/**
 * UC-10: the automated test runs recorded as evidence for the TESTING check,
 * and, on an IN_PROGRESS task, a form to record another.
 */
export function TestRunsPanel({ task, developer, busy }: TestRunsPanelProps) {
  const runs = useTestRuns(task.id, task.latestTestRun?.recordedAt ?? null)
  const [recording, setRecording] = useState(false)
  const canRecordNow = task.status === 'IN_PROGRESS'
  // If the task stops being IN_PROGRESS while the form is open, such as after a refresh, the form closes.
  const showForm = recording && canRecordNow
  const hasRuns = task.latestTestRun !== null

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
    <section aria-labelledby="test-runs-heading" className="space-y-3 rounded-md bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h4 id="test-runs-heading" className="text-sm font-medium">
            Test runs
          </h4>
          <p className="text-xs text-muted-foreground">Automated test results, as evidence for this check.</p>
        </div>
        {canRecordNow && !showForm && (
          <Button
            ref={recordButtonRef}
            size="sm"
            variant="outline"
            onClick={() => setRecording(true)}
            disabled={developer === '' || busy}
          >
            <FlaskConical aria-hidden="true" />
            Record test run
          </Button>
        )}
      </div>

      {showForm && (
        <Suspense fallback={<LoadingState label="Loading form" rows={2} />}>
          <RecordTestRunForm task={task} developer={developer} onClose={closeForm} />
        </Suspense>
      )}

      {!hasRuns ? (
        <p className="text-sm text-muted-foreground">No test runs recorded yet.</p>
      ) : runs.isPending ? (
        <LoadingState label="Loading test runs" rows={1} />
      ) : runs.isError ? (
        <ErrorState
          title="Could not load the test runs"
          message={runs.error.message}
          action={
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void runs.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <TestRunList runs={runs.data} />
      )}
    </section>
  )
}
