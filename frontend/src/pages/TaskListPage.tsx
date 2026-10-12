import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'

import { useTasks } from '@/api/tasks'
import type { TaskSummary } from '@/api/types'
import { EmptyState, ErrorState, LoadingState } from '@/components/PageStates'
import { ProgressBar } from '@/components/ProgressBar'
import { TaskStatusBadge } from '@/components/TaskStatusBadge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** UC-05: every task with its status, check progress, and approval progress. */
export function TaskListPage() {
  const tasks = useTasks()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A task is approved once all six checks pass and enough developers sign off.
        </p>
      </div>
      {tasks.isPending ? (
        <LoadingState label="Loading tasks" />
      ) : tasks.isError ? (
        <ErrorState
          title="Could not load tasks"
          message={tasks.error.message}
          action={
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void tasks.refetch()}>
              Try again
            </Button>
          }
        />
      ) : tasks.data.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create a task to describe what the AI should build and how you will check it."
          action={
            <Button asChild>
              <Link to="/tasks/new">
                <Plus aria-hidden="true" />
                Create a task
              </Link>
            </Button>
          }
        />
      ) : (
        <TaskTable tasks={tasks.data} />
      )}
    </div>
  )
}

function TaskTable({ tasks }: { tasks: TaskSummary[] }) {
  const navigate = useNavigate()

  return (
    <>
      {/* Wider screens: a table. The title is the link; the whole row is clickable as a shortcut. */}
      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Checks passed</TableHead>
              <TableHead className="pr-4">Approvals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className="cursor-pointer" onClick={() => void navigate(`/tasks/${task.id}`)}>
                <TableCell className="max-w-80 truncate py-3 pl-4 font-medium">
                  <Link to={`/tasks/${task.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {task.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{task.owner}</TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status} />
                </TableCell>
                <TableCell>
                  <ProgressBar value={task.passedChecks} max={task.totalChecks} label={`Checks passed for ${task.title}`} />
                </TableCell>
                <TableCell className="pr-4 text-muted-foreground tabular-nums">
                  {task.approvalCount} of {task.requiredApprovals}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phones: one card per task. */}
      <ul className="space-y-3 md:hidden">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              to={`/tasks/${task.id}`}
              className="block space-y-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{task.title}</span>
                <TaskStatusBadge status={task.status} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{task.owner}</span>
                <span className="tabular-nums">
                  {task.approvalCount} of {task.requiredApprovals} approvals
                </span>
              </div>
              <ProgressBar value={task.passedChecks} max={task.totalChecks} label={`Checks passed for ${task.title}`} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
