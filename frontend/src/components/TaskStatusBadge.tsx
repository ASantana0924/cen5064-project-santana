import type { TaskStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { taskStatusLabel } from '@/lib/labels'

const variant = { DRAFT: 'secondary', IN_PROGRESS: 'info', APPROVED: 'success' } as const

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={variant[status]}>{taskStatusLabel[status]}</Badge>
}
