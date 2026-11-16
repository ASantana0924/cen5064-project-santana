import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'

import { useArtifact } from '@/api/artifacts'
import { ApiError } from '@/api/client'
import type { Artifact } from '@/api/types'
import { ErrorState, LoadingState } from '@/components/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/labels'

/** UC-09: one artifact version with its prompt and code. */
export function ArtifactVersionPage() {
  const { id = '', version: versionParam = '' } = useParams()
  // Only a whole number of 1 or more can be a version, so anything else is "not found" without asking the server.
  const version = /^[1-9]\d*$/.test(versionParam) ? Number(versionParam) : null

  return (
    <div className="space-y-6">
      <BackLink taskId={id} />
      {version === null ? <NotFound taskId={id} /> : <ArtifactLoader taskId={id} version={version} />}
    </div>
  )
}

function ArtifactLoader({ taskId, version }: { taskId: string; version: number }) {
  const artifact = useArtifact(taskId, version)

  if (artifact.isPending) {
    return <LoadingState label="Loading version" rows={4} />
  }
  if (artifact.isError) {
    // 404 for an unknown task or version, or 400 when the task ID in the URL is not a valid UUID.
    if (artifact.error instanceof ApiError && (artifact.error.status === 404 || artifact.error.status === 400)) {
      return <NotFound taskId={taskId} />
    }
    return (
      <ErrorState
        title="Could not load the version"
        message={artifact.error.message}
        action={
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void artifact.refetch()}>
            Try again
          </Button>
        }
      />
    )
  }
  return <ArtifactView artifact={artifact.data} />
}

function ArtifactView({ artifact }: { artifact: Artifact }) {
  return (
    <>
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Version {artifact.version}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <Meta term="AI tool">{artifact.aiTool}</Meta>
          <Meta term="Recorded by">{artifact.recordedBy}</Meta>
          <Meta term="Recorded">
            <time dateTime={artifact.createdAt}>{formatDateTime(artifact.createdAt)}</time>
          </Meta>
        </dl>
      </header>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>
            <h2>Prompt</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-prose text-sm break-words whitespace-pre-wrap">{artifact.prompt}</p>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>
            <h2 id="artifact-code-heading">Code</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {/* Lines never wrap, so long ones scroll inside this block instead of widening the page. */}
          <pre
            role="region"
            tabIndex={0}
            aria-labelledby="artifact-code-heading"
            className="max-w-full overflow-x-auto rounded-md border bg-muted p-4 font-mono text-sm leading-relaxed whitespace-pre outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <code>{artifact.codeContent}</code>
          </pre>
        </CardContent>
      </Card>
    </>
  )
}

function Meta({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium break-all">{children}</dd>
    </div>
  )
}

function NotFound({ taskId }: { taskId: string }) {
  return (
    <ErrorState
      title="Version not found"
      message="This task has no artifact version with this number."
      action={<BackLink taskId={taskId} className="mt-2" />}
    />
  )
}

function BackLink({ taskId, className = '' }: { taskId: string; className?: string }) {
  return (
    <Link
      to={`/tasks/${encodeURIComponent(taskId)}`}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground ${className}`}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to task
    </Link>
  )
}
