import { useMemo, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { useArtifact, useArtifacts } from '@/api/artifacts'
import { ApiError } from '@/api/client'
import { useTask } from '@/api/tasks'
import type { Artifact, ArtifactSummary, TaskDetails } from '@/api/types'
import { CodeDiff } from '@/components/artifact/CodeDiff'
import { TextDiff } from '@/components/artifact/TextDiff'
import { EmptyState, ErrorState, LoadingState } from '@/components/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { hasChanges, lineDiff, wordDiff } from '@/lib/diff'

/**
 * UC-17: compares two artifact versions of a task: the AI tool, the prompt,
 * and the code. The diff is worked out here from the existing artifact
 * endpoints (ADR-011). The chosen versions live in the URL as ?from=&to=, so a
 * comparison can be bookmarked or shared.
 */
export function ArtifactComparePage() {
  const { id = '' } = useParams()
  const task = useTask(id)

  return (
    <div className="space-y-6">
      <BackLink taskId={id} />
      {task.isPending ? (
        <LoadingState label="Loading versions" rows={3} />
      ) : task.isError ? (
        isMissingTask(task.error) ? (
          <ErrorState
            title="Task not found"
            message="No task has this ID."
            action={<BackLink taskId={id} className="mt-2" />}
          />
        ) : (
          <ErrorState
            title="Could not load the task"
            message={task.error.message}
            action={<RetryButton onRetry={() => void task.refetch()} />}
          />
        )
      ) : (
        <CompareVersions task={task.data} />
      )}
    </div>
  )
}

/** 404 for an unknown task, or 400 when the ID in the URL is not a valid UUID. */
function isMissingTask(error: Error): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400)
}

function CompareVersions({ task }: { task: TaskDetails }) {
  const versions = useArtifacts(task.id, task.artifactCount)
  const [searchParams, setSearchParams] = useSearchParams()
  const canCompare = task.artifactCount >= 2
  const list = versions.data ?? []
  const { from, to } = pickVersions(list, searchParams)

  // Replaces the history entry, so Back returns to the task instead of stepping through every pick.
  const choose = (picked: { from?: number; to?: number }) => {
    const next = { from, to, ...picked }
    setSearchParams({ from: String(next.from), to: String(next.to) }, { replace: true })
  }

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Compare versions</h1>
        <p className="text-sm break-words text-muted-foreground">{task.title}</p>
      </header>

      {versions.isError ? (
        <ErrorState
          title="Could not load the versions"
          message={versions.error.message}
          action={<RetryButton onRetry={() => void versions.refetch()} />}
        />
      ) : task.artifactCount > 0 && versions.isPending ? (
        <LoadingState label="Loading versions" rows={2} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <VersionSelect
              id="compare-from"
              label="From version"
              versions={list}
              value={from}
              disabled={!canCompare}
              onChange={(version) => choose({ from: version })}
            />
            <ArrowRight aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:mb-2.5 sm:block" />
            <VersionSelect
              id="compare-to"
              label="To version"
              versions={list}
              value={to}
              disabled={!canCompare}
              onChange={(version) => choose({ to: version })}
            />
          </div>

          {!canCompare || from === undefined || to === undefined ? (
            <EmptyState
              title="Nothing to compare yet"
              description={
                task.artifactCount === 0
                  ? 'This task has no artifact versions. Record two versions to compare them.'
                  : 'This task has one artifact version. Record a second version to compare them.'
              }
            />
          ) : (
            <Comparison taskId={task.id} from={from} to={to} />
          )}
        </>
      )}
    </>
  )
}

/**
 * The versions to compare: the ones in the URL if the task has them, and
 * otherwise the two newest, older one first. With one version, both are it.
 */
function pickVersions(versions: ArtifactSummary[], params: URLSearchParams): { from?: number; to?: number } {
  const numbers = versions.map((version) => version.version).sort((a, b) => a - b)
  const newest = numbers.at(-1)
  const previous = numbers.at(-2) ?? newest
  const fromUrl = (name: string, fallback: number | undefined) => {
    const value = Number(params.get(name))
    return numbers.includes(value) ? value : fallback
  }
  return { from: fromUrl('from', previous), to: fromUrl('to', newest) }
}

interface VersionSelectProps {
  id: string
  label: string
  versions: ArtifactSummary[]
  value: number | undefined
  disabled: boolean
  onChange: (version: number) => void
}

/** A version picker, newest first like the version history. */
function VersionSelect({ id, label, versions, value, disabled, onChange }: VersionSelectProps) {
  const newestFirst = [...versions].sort((a, b) => b.version - a.version)
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
      >
        {newestFirst.length === 0 && <option value="">No versions</option>}
        {newestFirst.map((version) => (
          <option key={version.version} value={version.version}>
            Version {version.version} · {version.aiTool} · {version.recordedBy}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Loads both versions in full. Picking the same version twice sends one request. */
function Comparison({ taskId, from, to }: { taskId: string; from: number; to: number }) {
  const fromQuery = useArtifact(taskId, from)
  const toQuery = useArtifact(taskId, to)

  if (fromQuery.isError || toQuery.isError) {
    const error = fromQuery.error ?? toQuery.error
    return (
      <ErrorState
        title="Could not load the versions"
        message={error?.message ?? 'Unknown error'}
        action={
          <RetryButton
            onRetry={() => {
              if (fromQuery.isError) void fromQuery.refetch()
              if (toQuery.isError) void toQuery.refetch()
            }}
          />
        }
      />
    )
  }
  if (fromQuery.isPending || toQuery.isPending) {
    return <LoadingState label="Loading comparison" rows={4} />
  }
  return <ComparisonView from={fromQuery.data} to={toQuery.data} />
}

function ComparisonView({ from, to }: { from: Artifact; to: Artifact }) {
  const code = useMemo(() => lineDiff(from.codeContent, to.codeContent), [from.codeContent, to.codeContent])
  const prompt = useMemo(() => wordDiff(from.prompt, to.prompt), [from.prompt, to.prompt])
  const toolChanged = from.aiTool !== to.aiTool
  const promptChanged = hasChanges(prompt)
  const codeChanged = hasChanges(code)

  if (from.version === to.version || (!toolChanged && !promptChanged && !codeChanged)) {
    return (
      <EmptyState
        title="No differences"
        description={
          from.version === to.version
            ? `Both pickers show version ${from.version}. Pick two different versions to see what changed.`
            : `Version ${from.version} and version ${to.version} have the same AI tool, prompt, and code.`
        }
      />
    )
  }

  return (
    <>
      <Section title="AI tool">
        {toolChanged ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <del className="rounded-sm bg-destructive/15 px-1 break-all decoration-destructive/60">
              <span className="sr-only">Removed: </span>
              {from.aiTool}
            </del>
            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
            <ins className="rounded-sm bg-success/15 px-1 break-all decoration-success/60">
              <span className="sr-only">Added: </span>
              {to.aiTool}
            </ins>
          </p>
        ) : (
          <Unchanged>
            Unchanged: <span className="font-medium break-all text-foreground">{from.aiTool}</span>
          </Unchanged>
        )}
      </Section>

      <Section title="Prompt">
        {promptChanged ? <TextDiff parts={prompt} /> : <Unchanged>The prompt is the same in both versions.</Unchanged>}
      </Section>

      <Section
        title="Code"
        description={
          codeChanged
            ? `Lines only in version ${from.version} are marked −, and lines only in version ${to.version} are marked +.`
            : undefined
        }
      >
        {codeChanged ? (
          <CodeDiff rows={code} fromVersion={from.version} toVersion={to.version} />
        ) : (
          <Unchanged>The code is the same in both versions.</Unchanged>
        )}
      </Section>
    </>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

function Unchanged({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
      Try again
    </Button>
  )
}

function BackLink({ taskId, className = '' }: { taskId: string; className?: string }) {
  return (
    <Link
      to={`/tasks/${encodeURIComponent(taskId)}`}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground ${className}`}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to task
    </Link>
  )
}
