import type { KeyboardEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { useTaskBusy } from '@/api/tasks'
import type { TaskDetails } from '@/api/types'
import { useRecordTestRun } from '@/api/verification'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { checkStatusLabel } from '@/lib/labels'

/** Offered as suggestions only. Any tool name is accepted. */
const TOOL_SUGGESTIONS = ['JUnit', 'Vitest', 'Jest', 'pytest', 'Playwright']

const WHOLE_NUMBER = /^\d+$/

function count(missing: string) {
  return z.string().trim().min(1, missing).regex(WHOLE_NUMBER, 'Enter a whole number, 0 or more.')
}

// Usability checks only, matching README rule 11. The backend applies the same rules and is the authority.
const recordTestRunSchema = z
  .object({
    tool: z.string().trim().min(1, 'Enter the test tool.'),
    total: count('Enter the total number of tests.'),
    passed: count('Enter how many tests passed.'),
    failed: count('Enter how many tests failed.'),
    summary: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const total = Number(values.total)
    if (total === 0) {
      ctx.addIssue({ code: 'custom', path: ['total'], message: 'A test run must include at least one test.' })
    } else if (Number(values.passed) + Number(values.failed) > total) {
      ctx.addIssue({ code: 'custom', path: ['failed'], message: 'Passed plus failed cannot be more than the total.' })
    }
  })

type RecordTestRunValues = z.infer<typeof recordTestRunSchema>

interface RecordTestRunFormProps {
  task: TaskDetails
  developer: string
  /** Called after a successful save, and on Cancel or Escape. */
  onClose: () => void
}

/**
 * UC-10: records the results of an automated test run as evidence for the
 * TESTING check. It never changes the check (ADR-006), and the success message
 * says so.
 */
export function RecordTestRunForm({ task, developer, onClose }: RecordTestRunFormProps) {
  const record = useRecordTestRun(task.id)
  const busy = useTaskBusy(task.id)
  const testingStatus = task.checks.find((check) => check.type === 'TESTING')?.status ?? 'PENDING'

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RecordTestRunValues>({
    resolver: zodResolver(recordTestRunSchema),
    defaultValues: { tool: '', total: '', passed: '', failed: '', summary: '' },
  })
  const [total, passed, failed] = useWatch({ control, name: ['total', 'passed', 'failed'] })
  const skipped = skippedCount(total, passed, failed)

  const onSubmit = handleSubmit((values) => {
    record.mutate(
      {
        tool: values.tool,
        total: Number(values.total),
        passed: Number(values.passed),
        failed: Number(values.failed),
        summary: values.summary,
        developer,
      },
      {
        onSuccess: () => {
          toast.success('Test run recorded', {
            description: `The Testing check is unchanged (${checkStatusLabel[testingStatus]}). Only a reviewer marks it passed or failed.`,
          })
          onClose()
        },
        onError: (error) => {
          toast.error('Could not record the test run', { description: error.message })
        },
      },
    )
  })

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !record.isPending) {
      event.preventDefault()
      onClose()
    }
  }

  function describedBy(id: string, hasError: boolean): string | undefined {
    return hasError ? `${id}-error` : undefined
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      aria-label="Record test run"
      className="space-y-4 rounded-md border bg-background p-4"
    >
      <FormField id="test-run-tool" label="Tool" error={errors.tool?.message}>
        <Input
          id="test-run-tool"
          list="test-run-tool-suggestions"
          autoComplete="off"
          autoFocus
          className="sm:max-w-xs"
          aria-invalid={errors.tool ? true : undefined}
          aria-describedby={describedBy('test-run-tool', !!errors.tool)}
          {...register('tool')}
        />
        <datalist id="test-run-tool-suggestions">
          {TOOL_SUGGESTIONS.map((tool) => (
            <option key={tool} value={tool} />
          ))}
        </datalist>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ['total', 'Total'],
            ['passed', 'Passed'],
            ['failed', 'Failed'],
          ] as const
        ).map(([name, label]) => {
          const id = `test-run-${name}`
          const error = errors[name]?.message
          return (
            <FormField key={name} id={id} label={label} error={error}>
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="tabular-nums"
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(id, !!error)}
                {...register(name)}
              />
            </FormField>
          )
        })}
      </div>
      {skipped !== null && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Skipped: {skipped} (the total minus passed and failed)
        </p>
      )}

      <FormField id="test-run-summary" label="Summary" hint=" (optional)">
        <Textarea id="test-run-summary" rows={2} {...register('summary')} />
      </FormField>

      <p className="text-sm text-muted-foreground">
        A test run is evidence for a reviewer. It does not change the Testing check.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {record.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
          Record test run
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={record.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/** The skipped count once all three counts are whole numbers that add up, otherwise null. */
function skippedCount(total: string, passed: string, failed: string): number | null {
  if (![total, passed, failed].every((value) => WHOLE_NUMBER.test(value.trim()))) {
    return null
  }
  const skipped = Number(total) - Number(passed) - Number(failed)
  return skipped >= 0 ? skipped : null
}
