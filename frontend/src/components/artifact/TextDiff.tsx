import type { DiffPart } from '@/lib/diff'

/**
 * UC-17: a word diff of two pieces of prose, such as two prompts, shown as one
 * text. Removed words are struck through and added words underlined, so the
 * change does not depend on color alone, and screen readers hear "removed" or
 * "added" before each change.
 */
export function TextDiff({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="max-w-prose text-sm break-words whitespace-pre-wrap">
      {parts.map((part, index) =>
        part.kind === 'added' ? (
          <ins key={index} className="rounded-sm bg-success/15 decoration-success/60">
            <span className="sr-only">Added: </span>
            {part.text}
          </ins>
        ) : part.kind === 'removed' ? (
          <del key={index} className="rounded-sm bg-destructive/15 decoration-destructive/60">
            <span className="sr-only">Removed: </span>
            {part.text}
          </del>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  )
}
