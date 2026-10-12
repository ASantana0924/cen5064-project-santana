import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { z } from 'zod'

import { useCreateTask } from '@/api/tasks'
import { ErrorState } from '@/components/PageStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDeveloper } from '@/lib/useDeveloper'

// Usability checks only. The backend applies the same rules and is the authority.
const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.'),
  description: z.string().trim(),
  owner: z.string().trim().min(1, 'Enter the owner’s name.'),
})

type CreateTaskForm = z.infer<typeof createTaskSchema>

/** UC-01: create a DRAFT task. The owner defaults to the "Acting as" name. */
export function CreateTaskPage() {
  const navigate = useNavigate()
  const { developer } = useDeveloper()
  const createTask = useCreateTask()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { title: '', description: '', owner: developer },
  })

  const onSubmit = handleSubmit((values) => {
    createTask.mutate(
      { title: values.title, description: values.description, developer: values.owner },
      { onSuccess: (task) => void navigate(`/tasks/${task.id}`) },
    )
  })

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All tasks
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New task</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe what the AI should build. The task starts as a draft.
          </p>
        </div>
      </div>

      {createTask.isError && <ErrorState title="Could not create the task" message={createTask.error.message} />}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field id="title" label="Title" error={errors.title?.message}>
          <Input
            id="title"
            autoFocus
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'title-error' : undefined}
            {...register('title')}
          />
        </Field>

        <Field id="description" label="Description" hint="Optional">
          <Textarea id="description" rows={4} {...register('description')} />
        </Field>

        <Field id="owner" label="Owner" error={errors.owner?.message}>
          <Input
            id="owner"
            autoComplete="off"
            aria-invalid={errors.owner ? true : undefined}
            aria-describedby={errors.owner ? 'owner-error' : undefined}
            {...register('owner')}
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={createTask.isPending}>
            {createTask.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Create task
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}

interface FieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
