import { Link } from 'react-router'

import { EmptyState } from '@/components/PageStates'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="There is nothing at this address."
      action={
        <Button asChild variant="outline">
          <Link to="/">Go to tasks</Link>
        </Button>
      }
    />
  )
}
