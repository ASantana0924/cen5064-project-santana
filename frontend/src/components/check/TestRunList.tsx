import type { TestRun } from '@/api/types'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/labels'

/** UC-10: recorded test runs, newest first as the API returns them. */
export function TestRunList({ runs }: { runs: TestRun[] }) {
  return (
    <ol aria-label="Test runs" className="divide-y rounded-md border bg-background">
      {runs.map((run) => (
        <li key={`${run.recordedAt}-${run.recordedBy}-${run.tool}`} className="space-y-1 px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-sm font-medium break-all">{run.tool}</p>
            <p className="text-sm tabular-nums">
              <span className="text-success">{run.passed} passed</span>
              {' · '}
              <span className={cn(run.failed > 0 && 'font-medium text-destructive')}>{run.failed} failed</span>
              {' · '}
              <span>{run.skipped} skipped</span>
              <span className="text-muted-foreground"> of {run.total}</span>
            </p>
          </div>
          {run.summary && <p className="text-sm break-words whitespace-pre-line text-muted-foreground">{run.summary}</p>}
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>by {run.recordedBy}</span>
            <time dateTime={run.recordedAt}>{formatDateTime(run.recordedAt)}</time>
            <span>{run.artifactVersion === null ? 'No artifact yet' : `Against version ${run.artifactVersion}`}</span>
          </p>
        </li>
      ))}
    </ol>
  )
}
