import { useRef, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { useAddListItem, useRemoveListItem } from '@/api/tasks'
import type { TaskDetails, TaskListName } from '@/api/types'
import { ConfirmResetDialog } from '@/components/task/ConfirmResetDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const copy: Record<TaskListName, { title: string; noun: string; Noun: string; empty: string }> = {
  requirements: {
    title: 'Requirements',
    noun: 'requirement',
    Noun: 'Requirement',
    empty: 'No requirements yet.',
  },
  acceptanceCriteria: {
    title: 'Acceptance criteria',
    noun: 'acceptance criterion',
    Noun: 'Acceptance criterion',
    empty: 'No acceptance criteria yet.',
  },
}

const RESET_NOTE = 'All six checks are back to Pending and approvals were cleared.'

type Change = { kind: 'add'; text: string } | { kind: 'remove'; index: number; text: string }

interface EditableTextListProps {
  task: TaskDetails
  list: TaskListName
  /** The "Acting as" name. Controls are disabled while it is empty. */
  developer: string
  /** True while any change to the task is saving. */
  busy: boolean
}

/**
 * UC-02 and UC-03: the requirements or acceptance criteria of a task. While
 * the task is editable, items can be added and removed. On an IN_PROGRESS task
 * every change resets the checks, so it is confirmed first.
 */
export function EditableTextList({ task, list, developer, busy }: EditableTextListProps) {
  const { title, noun, Noun, empty } = copy[list]
  const items = task[list]
  const add = useAddListItem(task.id, list)
  const remove = useRemoveListItem(task.id, list)
  const [draft, setDraft] = useState('')
  // The change waiting for confirmation. It is kept after the dialog closes so the text does not change while the dialog fades out.
  const [confirming, setConfirming] = useState<Change | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasName = developer !== ''
  const canChange = task.editable && hasName && !busy
  const resetsChecks = task.status === 'IN_PROGRESS'
  const inputId = `new-${list}`

  // After a change, a removed item's button is gone and an Add button that just emptied is disabled, so focus
  // would drop to the page. Move it to the add box instead, unless the user has already moved on.
  function keepFocusInList() {
    const focused = document.activeElement
    if (focused === null || focused === document.body || cardRef.current?.contains(focused)) {
      inputRef.current?.focus()
    }
  }

  function save(change: Change) {
    const description = resetsChecks ? RESET_NOTE : undefined
    if (change.kind === 'add') {
      add.mutate(
        { text: change.text, developer },
        {
          onSuccess: () => {
            setDraft('')
            keepFocusInList()
            toast.success(`${Noun} added`, { description })
          },
          onError: (error) => {
            toast.error(`Could not add the ${noun}`, { description: error.message })
          },
        },
      )
    } else {
      remove.mutate(
        { index: change.index, developer },
        {
          onSuccess: () => {
            keepFocusInList()
            toast.success(`${Noun} removed`, { description })
          },
          onError: (error) => {
            toast.error(`Could not remove the ${noun}`, { description: error.message })
          },
        },
      )
    }
  }

  function request(change: Change) {
    if (resetsChecks) {
      setConfirming(change)
      setDialogOpen(true)
    } else {
      save(change)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (canChange && text !== '') {
      request({ kind: 'add', text })
    }
  }

  return (
    <Card ref={cardRef} className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
            {items.map((item, index) => (
              <li key={`${index}-${item}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 py-0.5 break-words">{item}</span>
                  {task.editable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      aria-label={`Remove ${noun} ${index + 1}`}
                      disabled={!canChange}
                      onClick={() => request({ kind: 'remove', index, text: item })}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {task.editable && (
          <form onSubmit={onSubmit} className="flex gap-2">
            <Label htmlFor={inputId} className="sr-only">
              New {noun}
            </Label>
            <Input
              ref={inputRef}
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`New ${noun}`}
              autoComplete="off"
              disabled={!hasName}
            />
            <Button type="submit" variant="outline" className="h-9" disabled={!canChange || draft.trim() === ''}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </form>
        )}
      </CardContent>

      <ConfirmResetDialog
        task={task}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={confirming?.kind === 'remove' ? `Remove this ${noun}?` : `Add this ${noun}?`}
        cause={`This task is in progress, so changing its ${title.toLowerCase()}`}
        confirmLabel={confirming?.kind === 'remove' ? 'Remove and reset checks' : 'Add and reset checks'}
        onConfirm={() => confirming && save(confirming)}
      >
        {confirming && (
          <p className="rounded-md border bg-muted px-3 py-2 text-sm break-words">{confirming.text}</p>
        )}
      </ConfirmResetDialog>
    </Card>
  )
}
