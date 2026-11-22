import { useId } from 'react'

import type { DiffKind, DiffLine } from '@/lib/diff'
import { cn } from '@/lib/utils'

interface CodeDiffProps {
  rows: DiffLine[]
  fromVersion: number
  toVersion: number
}

const rowStyle: Record<DiffKind, string> = {
  added: 'bg-success/10',
  removed: 'bg-destructive/10',
  unchanged: '',
}

// The + and − are what sighted users scan for; screen readers hear the word instead.
const marker: Record<DiffKind, { symbol: string; label: string; className: string }> = {
  added: { symbol: '+', label: 'Added', className: 'text-success' },
  removed: { symbol: '−', label: 'Removed', className: 'text-destructive' },
  unchanged: { symbol: '', label: '', className: '' },
}

/**
 * UC-17: a unified line diff of two code versions. Each line shows its number
 * in the "from" version, its number in the "to" version, and whether it was
 * added or removed. Lines never wrap; long ones scroll inside the block.
 */
export function CodeDiff({ rows, fromVersion, toVersion }: CodeDiffProps) {
  const summaryId = useId()
  const added = rows.filter((row) => row.kind === 'added').length
  const removed = rows.filter((row) => row.kind === 'removed').length

  return (
    <div className="min-w-0 space-y-3">
      <p id={summaryId} className="text-sm text-muted-foreground">
        <span className="font-medium text-success">{lines(added)} added</span>
        {' · '}
        <span className="font-medium text-destructive">{lines(removed)} removed</span>
      </p>
      <div
        role="region"
        tabIndex={0}
        aria-label={`Code changes from version ${fromVersion} to version ${toVersion}`}
        aria-describedby={summaryId}
        className="max-w-full overflow-x-auto rounded-md border bg-muted/40 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <table className="w-full border-collapse font-mono text-sm leading-relaxed">
          <caption className="sr-only">
            Lines only in version {fromVersion} are removed, and lines only in version {toVersion} are added.
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Version {fromVersion} line</th>
              <th scope="col">Version {toVersion} line</th>
              <th scope="col">Change</th>
              <th scope="col">Code</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} data-kind={row.kind} className={rowStyle[row.kind]}>
                <td className="w-px pr-2 pl-3 text-right text-muted-foreground tabular-nums select-none">
                  {row.oldNumber}
                </td>
                <td className="w-px pr-2 text-right text-muted-foreground tabular-nums select-none">{row.newNumber}</td>
                <td className={cn('w-px pr-2 text-center select-none', marker[row.kind].className)}>
                  <span aria-hidden="true">{marker[row.kind].symbol}</span>
                  <span className="sr-only">{marker[row.kind].label}</span>
                </td>
                <td className="pr-4 whitespace-pre">
                  {row.kind === 'added' ? (
                    <ins className="no-underline">{row.text}</ins>
                  ) : row.kind === 'removed' ? (
                    <del className="no-underline">{row.text}</del>
                  ) : (
                    row.text
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function lines(count: number): string {
  return count === 1 ? '1 line' : `${count} lines`
}
