import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  FilePlus2,
  FlaskConical,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  ThumbsUp,
  Undo2,
  type LucideIcon,
} from 'lucide-react'

import type { AuditEntry, AuditEventType } from '@/api/types'
import { auditEventLabel, formatDateTime } from '@/lib/labels'
import { cn } from '@/lib/utils'

const eventStyle: Record<AuditEventType, { Icon: LucideIcon; className: string }> = {
  TASK_CREATED: { Icon: Plus, className: 'text-muted-foreground' },
  TASK_EDITED: { Icon: Pencil, className: 'text-muted-foreground' },
  TASK_STARTED: { Icon: Play, className: 'text-muted-foreground' },
  ARTIFACT_RECORDED: { Icon: FilePlus2, className: 'text-muted-foreground' },
  TEST_RESULTS_RECORDED: { Icon: FlaskConical, className: 'text-muted-foreground' },
  CHECK_PASSED: { Icon: CircleCheck, className: 'text-success' },
  CHECK_FAILED: { Icon: CircleX, className: 'text-destructive' },
  CHECKS_RESET: { Icon: RotateCcw, className: 'text-muted-foreground' },
  APPROVAL_RECORDED: { Icon: ThumbsUp, className: 'text-success' },
  TASK_APPROVED: { Icon: BadgeCheck, className: 'text-success' },
  TASK_REOPENED: { Icon: Undo2, className: 'text-destructive' },
}

/**
 * UC-16: every audit entry with its event, developer, time, and details,
 * newest first. The API lists entries oldest first, so they are reversed here.
 */
export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  // Entries are never edited or deleted (README rule 9), so the position in the API's list is a stable key.
  const newestFirst = entries.map((entry, index) => ({ entry, key: index })).reverse()

  return (
    <ol aria-label="Audit entries">
      {newestFirst.map(({ entry, key }, position) => {
        const { Icon, className } = eventStyle[entry.eventType]
        const isLast = position === newestFirst.length - 1
        return (
          <li key={key} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && <span aria-hidden="true" className="absolute top-7 bottom-0 left-3 w-px -translate-x-1/2 bg-border" />}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon aria-hidden="true" className={cn('size-3.5', className)} />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{auditEventLabel[entry.eventType]}</span>
                <span className="text-muted-foreground">by {entry.developer}</span>
              </p>
              {entry.details && <p className="text-sm break-words text-muted-foreground">{entry.details}</p>}
              <time dateTime={entry.recordedAt} className="block text-xs text-muted-foreground">
                {formatDateTime(entry.recordedAt)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
