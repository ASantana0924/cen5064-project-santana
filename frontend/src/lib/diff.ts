import { diffLines, diffWordsWithSpace } from 'diff'

/** Whether a line or a piece of text is only in the "to" version, only in the "from" version, or in both. */
export type DiffKind = 'added' | 'removed' | 'unchanged'

/** One row of a line diff. A removed line has only an old number and an added line only a new one. */
export interface DiffLine {
  kind: DiffKind
  oldNumber?: number
  newNumber?: number
  text: string
}

/** One run of text in a word diff. */
export interface DiffPart {
  kind: DiffKind
  text: string
}

function kindOf(change: { added: boolean; removed: boolean }): DiffKind {
  return change.added ? 'added' : change.removed ? 'removed' : 'unchanged'
}

/** The lines of one diff chunk. A chunk ends with a newline, which does not start another line. */
function splitLines(value: string): string[] {
  const lines = value.split('\n')
  if (lines.at(-1) === '') {
    lines.pop()
  }
  return lines
}

/**
 * Compares two versions of code line by line, numbering each line as it
 * appears in its own version. Windows line endings and a missing newline at
 * the end are not counted as changes, but indentation is, since it can
 * change what code does.
 */
export function lineDiff(from: string, to: string): DiffLine[] {
  const rows: DiffLine[] = []
  let oldNumber = 1
  let newNumber = 1
  for (const change of diffLines(from, to, { stripTrailingCr: true, ignoreNewlineAtEof: true })) {
    const kind = kindOf(change)
    for (const text of splitLines(change.value)) {
      if (kind === 'added') {
        rows.push({ kind, newNumber: newNumber++, text })
      } else if (kind === 'removed') {
        rows.push({ kind, oldNumber: oldNumber++, text })
      } else {
        rows.push({ kind, oldNumber: oldNumber++, newNumber: newNumber++, text })
      }
    }
  }
  return rows
}

/** Compares two pieces of prose word by word. Spaces and line breaks count, so a new paragraph shows. */
export function wordDiff(from: string, to: string): DiffPart[] {
  return diffWordsWithSpace(from, to).map((change) => ({ kind: kindOf(change), text: change.value }))
}

/** True when the diff holds at least one added or removed line or word. */
export function hasChanges(diff: readonly { kind: DiffKind }[]): boolean {
  return diff.some((part) => part.kind !== 'unchanged')
}
