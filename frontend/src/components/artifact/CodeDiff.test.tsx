import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { lineDiff } from '@/lib/diff'
import { CodeDiff } from './CodeDiff'

const version1 = 'boolean isLocked(int failures) {\n  return failures >= 5;\n}'
const version2 = 'boolean isLocked(int failures) {\n  log(failures);\n  return failures >= MAX_FAILURES;\n}'

function renderDiff(from = version1, to = version2) {
  render(<CodeDiff rows={lineDiff(from, to)} fromVersion={1} toVersion={2} />)
  const block = screen.getByRole('region', { name: 'Code changes from version 1 to version 2' })
  // The first row holds the column headers.
  const rows = within(block).getAllByRole('row').slice(1)
  return { block, rows }
}

/** A row as [line in version 1, line in version 2, change, code]. */
function cells(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '')
}

describe('CodeDiff', () => {
  it('marks the lines that changed between version 1 and version 2', () => {
    const { rows } = renderDiff()

    expect(rows.map(cells)).toEqual([
      ['1', '1', '', 'boolean isLocked(int failures) {'],
      ['2', '', '−Removed', '  return failures >= 5;'],
      ['', '2', '+Added', '  log(failures);'],
      ['', '3', '+Added', '  return failures >= MAX_FAILURES;'],
      ['3', '4', '', '}'],
    ])
  })

  it('wraps added code in ins and removed code in del', () => {
    const { rows } = renderDiff()

    expect(rows[1].querySelector('del')).toHaveTextContent('return failures >= 5;')
    expect(rows[2].querySelector('ins')).toHaveTextContent('log(failures);')
    expect(rows[0].querySelector('ins, del')).toBeNull()
  })

  it('names the change for screen readers instead of relying on color', () => {
    const { rows } = renderDiff()

    expect(within(rows[1]).getByText('Removed')).toHaveClass('sr-only')
    expect(within(rows[1]).getByText('−')).toHaveAttribute('aria-hidden', 'true')
  })

  it('counts the added and removed lines', () => {
    const { block } = renderDiff()

    const summary = document.getElementById(block.getAttribute('aria-describedby') ?? '')
    expect(summary).toHaveTextContent('2 lines added · 1 line removed')
  })

  it('keeps indentation and scrolls long lines inside the block', () => {
    const longLine = `String message = "${'x'.repeat(300)}";`
    const { block, rows } = renderDiff(version1, `${version1}\n${longLine}`)

    const code = rows.at(-1)!.querySelectorAll('td')[3]
    expect(code).toHaveClass('whitespace-pre')
    expect(rows[1].querySelectorAll('td')[3].textContent).toBe('  return failures >= 5;')
    expect(block).toHaveClass('overflow-x-auto', 'max-w-full')
    // Focusable, so keyboard users can scroll it.
    expect(block).toHaveAttribute('tabindex', '0')
  })
})
