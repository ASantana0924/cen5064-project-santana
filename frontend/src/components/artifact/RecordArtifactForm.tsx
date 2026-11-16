import { useState, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { useRecordArtifact } from '@/api/artifacts'
import { useTaskBusy } from '@/api/tasks'
import type { TaskDetails } from '@/api/types'
import { FormField } from '@/components/FormField'
import { ConfirmResetDialog } from '@/components/task/ConfirmResetDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/** Offered as suggestions only. Any tool name is accepted. */
const AI_TOOL_SUGGESTIONS = ['Claude', 'ChatGPT', 'GitHub Copilot', 'Cursor', 'Gemini']

const RESET_NOTE = 'All six checks are back to Pending and approvals were cleared.'

// Usability checks only. The backend applies the same rules and is the authority.
// The code is checked but not trimmed, because leading indentation can matter.
const recordArtifactSchema = z.object({
  prompt: z.string().trim().min(1, 'Enter the prompt you gave the AI tool.'),
  aiTool: z.string().trim().min(1, 'Enter the AI tool.'),
  codeContent: z.string().refine((code) => code.trim() !== '', 'Paste the code the AI tool generated.'),
})

type RecordArtifactValues = z.infer<typeof recordArtifactSchema>

interface RecordArtifactFormProps {
  task: TaskDetails
  developer: string
  /** Called after a successful save, and on Cancel or Escape. */
  onClose: () => void
}

/**
 * UC-07 and UC-08: records the prompt, AI tool, and code of a new artifact
 * version. When the task already has an artifact, the new version is a
 * revision that resets every check and clears every approval, so it is
 * confirmed first.
 */
export function RecordArtifactForm({ task, developer, onClose }: RecordArtifactFormProps) {
  const record = useRecordArtifact(task.id)
  const busy = useTaskBusy(task.id)
  const nextVersion = task.artifactCount + 1
  const isRevision = task.artifactCount > 0
  // The values waiting for confirmation. Kept after the dialog closes so its text does not change while it fades out.
  const [confirming, setConfirming] = useState<RecordArtifactValues | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordArtifactValues>({
    resolver: zodResolver(recordArtifactSchema),
    defaultValues: { prompt: '', aiTool: '', codeContent: '' },
  })

  function save(values: RecordArtifactValues) {
    record.mutate(
      { prompt: values.prompt, aiTool: values.aiTool, codeContent: values.codeContent, developer },
      {
        onSuccess: (artifact) => {
          toast.success(`Version ${artifact.version} recorded`, { description: isRevision ? RESET_NOTE : undefined })
          onClose()
        },
        onError: (error) => {
          toast.error('Could not record the artifact', { description: error.message })
        },
      },
    )
  }

  const onSubmit = handleSubmit((values) => {
    if (isRevision) {
      setConfirming(values)
      setDialogOpen(true)
    } else {
      save(values)
    }
  })

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !record.isPending) {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        noValidate
        aria-label={`Record version ${nextVersion}`}
        className="space-y-4 rounded-lg border p-4"
      >
        <FormField id="artifact-prompt" label="Prompt" error={errors.prompt?.message}>
          <Textarea
            id="artifact-prompt"
            rows={3}
            autoFocus
            aria-invalid={errors.prompt ? true : undefined}
            aria-describedby={errors.prompt ? 'artifact-prompt-error' : undefined}
            {...register('prompt')}
          />
        </FormField>

        <FormField id="artifact-ai-tool" label="AI tool" error={errors.aiTool?.message}>
          <Input
            id="artifact-ai-tool"
            list="artifact-ai-tool-suggestions"
            autoComplete="off"
            className="sm:max-w-xs"
            aria-invalid={errors.aiTool ? true : undefined}
            aria-describedby={errors.aiTool ? 'artifact-ai-tool-error' : undefined}
            {...register('aiTool')}
          />
          <datalist id="artifact-ai-tool-suggestions">
            {AI_TOOL_SUGGESTIONS.map((tool) => (
              <option key={tool} value={tool} />
            ))}
          </datalist>
        </FormField>

        <FormField id="artifact-code" label="Code" error={errors.codeContent?.message}>
          <Textarea
            id="artifact-code"
            rows={10}
            wrap="off"
            spellCheck={false}
            className="field-sizing-fixed overflow-x-auto font-mono text-sm whitespace-pre"
            aria-invalid={errors.codeContent ? true : undefined}
            aria-describedby={errors.codeContent ? 'artifact-code-error' : undefined}
            {...register('codeContent')}
          />
        </FormField>

        {isRevision && (
          <p className="text-sm text-muted-foreground">
            This will be version {nextVersion}. Recording it sets all six checks back to Pending and clears all
            approvals.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {record.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Record version {nextVersion}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={record.isPending}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Outside the form, so Escape in the dialog closes only the dialog, not the form. */}
      <ConfirmResetDialog
        task={task}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={`Record version ${nextVersion}?`}
        cause={`Recording version ${nextVersion}`}
        confirmLabel="Record and reset checks"
        onConfirm={() => confirming && save(confirming)}
      />
    </>
  )
}
