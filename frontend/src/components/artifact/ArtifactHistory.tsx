import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'

import type { ArtifactSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/labels'

interface ArtifactHistoryProps {
  taskId: string
  /** Every version, oldest first, as the API returns them. */
  artifacts: ArtifactSummary[]
}

/** UC-09: the version history, newest first. Each row opens that version's prompt and code. */
export function ArtifactHistory({ taskId, artifacts }: ArtifactHistoryProps) {
  const newestFirst = [...artifacts].sort((a, b) => b.version - a.version)
  const latest = newestFirst[0]?.version

  return (
    <ol aria-label="Version history" className="divide-y rounded-lg border">
      {newestFirst.map((artifact) => (
        <li key={artifact.version}>
          <Link
            to={`/tasks/${encodeURIComponent(taskId)}/artifacts/${artifact.version}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Version {artifact.version}
                {artifact.version === latest && <Badge variant="secondary">Latest</Badge>}
              </p>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="break-all">{artifact.aiTool}</span>
                <span>by {artifact.recordedBy}</span>
                <time dateTime={artifact.createdAt}>{formatDateTime(artifact.createdAt)}</time>
              </p>
            </div>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ol>
  )
}
