import { useAuditHistory } from '@/api/approvals'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { ErrorState, LoadingState } from '@/components/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** UC-16: the audit history of a task, always visible at the bottom of the task details page. */
export function AuditCard({ taskId }: { taskId: string }) {
  const history = useAuditHistory(taskId)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>Audit history</h2>
        </CardTitle>
        <CardDescription>Every change to this task, newest first. Entries are never edited or deleted.</CardDescription>
      </CardHeader>
      <CardContent>
        {history.isPending ? (
          <LoadingState label="Loading audit history" rows={3} />
        ) : history.isError ? (
          <ErrorState
            title="Could not load the audit history"
            message={history.error.message}
            action={
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void history.refetch()}>
                Try again
              </Button>
            }
          />
        ) : history.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <AuditTimeline entries={history.data} />
        )}
      </CardContent>
    </Card>
  )
}
