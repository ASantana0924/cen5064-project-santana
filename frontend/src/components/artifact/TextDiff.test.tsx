import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { wordDiff } from '@/lib/diff'
import { TextDiff } from './TextDiff'

function renderDiff(from: string, to: string) {
  const { container } = render(<TextDiff parts={wordDiff(from, to)} />)
  return container.querySelector('p')!
}

describe('TextDiff', () => {
  it('marks the removed and added words in one text', () => {
    const text = renderDiff('Lock the account after 5 failed logins.', 'Lock the account after 3 failed logins.')

    expect(text.querySelector('del')).toHaveTextContent('5')
    expect(text.querySelector('ins')).toHaveTextContent('3')
    expect(screen.getByText(/Lock the account after/)).toBeInTheDocument()
  })

  it('tells screen readers which words were removed and which were added', () => {
    const text = renderDiff('Use a counter.', 'Use a cache.')

    expect(text).toHaveTextContent('Use a Removed: counterAdded: cache.')
    expect(screen.getByText('Removed:')).toHaveClass('sr-only')
    expect(screen.getByText('Added:')).toHaveClass('sr-only')
  })

  it('keeps line breaks', () => {
    const text = renderDiff('One line.', 'One line.\nA second line.')

    expect(text).toHaveClass('whitespace-pre-wrap')
    expect(text.querySelector('ins')?.textContent).toBe('Added: \nA second line.')
  })
})
