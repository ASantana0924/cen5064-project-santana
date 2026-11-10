import type { KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { useEditTask, useTaskBusy } from '@/api/tasks'
import type { TaskDetails } from '@/api/types'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// Usability checks only. The backend applies the same rules and is the authority.
const editTaskSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.'),
  description: z.string().trim(),
})

type EditTaskForm = z.infer<typeof editTaskSchema>

interface EditTaskDetailsFormProps {
  task: TaskDetails
  developer: string
  /** Called after a successful save, and on Cancel or Escape. */
  onClose: () => void
}

/** UC-03: edits the title and description in place. Editing these never resets checks. */
export function EditTaskDetailsForm({ task, developer, onClose }: EditTaskDetailsFormProps) {
  const editTask = useEditTask(task.id)
  const busy = useTaskBusy(task.id)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditTaskForm>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: { title: task.title, description: task.description },
  })

  const onSubmit = handleSubmit((values) => {
    if (values.title === task.title && values.description === task.description) {
      onClose()
      return
    }
    editTask.mutate(
      { title: values.title, description: values.description, developer },
      {
        onSuccess: () => {
          toast.success('Task saved')
          onClose()
        },
        onError: (error) => {
          toast.error('Could not save the task', { description: error.message })
        },
      },
    )
  })

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !editTask.isPending) {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate aria-label="Edit task" className="max-w-prose space-y-4">
      <FormField id="edit-title" label="Title" error={errors.title?.message}>
        <Input
          id="edit-title"
          autoFocus
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? 'edit-title-error' : undefined}
          {...register('title')}
        />
      </FormField>

      <FormField id="edit-description" label="Description" hint="Optional">
        <Textarea id="edit-description" rows={4} {...register('description')} />
      </FormField>

      <p className="text-sm text-muted-foreground">Changing the title or description does not reset any checks.</p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {editTask.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={editTask.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
