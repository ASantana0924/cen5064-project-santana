import { CircleCheck, CircleDashed, CircleX } from 'lucide-react'

import type { CheckStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { checkStatusLabel } from '@/lib/labels'

const style = {
  PENDING: { variant: 'secondary', Icon: CircleDashed },
  PASSED: { variant: 'success', Icon: CircleCheck },
  FAILED: { variant: 'destructive', Icon: CircleX },
} as const

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  const { variant, Icon } = style[status]
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {checkStatusLabel[status]}
    </Badge>
  )
}
