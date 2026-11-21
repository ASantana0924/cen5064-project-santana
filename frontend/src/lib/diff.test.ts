import { describe, expect, it } from 'vitest'

import { hasChanges, lineDiff, wordDiff } from './diff'

describe('lineDiff', () => {
  it('numbers unchanged lines in both versions', () => {
    expect(lineDiff('a\nb', 'a\nb')).toEqual([
      { kind: 'unchanged', oldNumber: 1, newNumber: 1, text: 'a' },
      { kind: 'unchanged', oldNumber: 2, newNumber: 2, text: 'b' },
    ])
  })

  it('marks a changed line as removed from the old version and added to the new one', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toEqual([
      { kind: 'unchanged', oldNumber: 1, newNumber: 1, text: 'a' },
      { kind: 'removed', oldNumber: 2, text: 'b' },
      { kind: 'added', newNumber: 2, text: 'B' },
      { kind: 'unchanged', oldNumber: 3, newNumber: 3, text: 'c' },
    ])
  })

  it('keeps counting each version on its own after lines are added or removed', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\ny\nc\nd')).toEqual([
      { kind: 'unchanged', oldNumber: 1, newNumber: 1, text: 'a' },
      { kind: 'removed', oldNumber: 2, text: 'b' },
      { kind: 'added', newNumber: 2, text: 'x' },
      { kind: 'added', newNumber: 3, text: 'y' },
      { kind: 'unchanged', oldNumber: 3, newNumber: 4, text: 'c' },
      { kind: 'added', newNumber: 5, text: 'd' },
    ])
  })

  it('keeps empty lines as lines', () => {
    expect(lineDiff('a\n\nb', 'a\n\nb').map((line) => line.text)).toEqual(['a', '', 'b'])
  })

  it('does not count Windows line endings or a final newline as changes', () => {
    expect(hasChanges(lineDiff('a\r\nb\r\n', 'a\nb'))).toBe(false)
  })

  it('counts a change in indentation', () => {
    expect(hasChanges(lineDiff('if x:\n    y()', 'if x:\ny()'))).toBe(true)
  })
})

describe('wordDiff', () => {
  it('marks only the words that changed', () => {
    expect(wordDiff('Lock after 5 failed logins.', 'Lock after 3 failed logins.')).toEqual([
      { kind: 'unchanged', text: 'Lock after ' },
      { kind: 'removed', text: '5' },
      { kind: 'added', text: '3' },
      { kind: 'unchanged', text: ' failed logins.' },
    ])
  })

  it('counts a new line break as a change', () => {
    expect(hasChanges(wordDiff('One. Two.', 'One.\nTwo.'))).toBe(true)
  })

  it('finds no changes in the same text', () => {
    expect(hasChanges(wordDiff('Same prompt', 'Same prompt'))).toBe(false)
  })
})
