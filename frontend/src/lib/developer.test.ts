import { afterEach, describe, expect, it, vi } from 'vitest'

import { CURRENT_KEY, getDeveloper, getRecentDevelopers, RECENT_KEY, setDeveloper } from './developer'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('developer storage', () => {
  it('returns an empty name when nothing is saved', () => {
    expect(getDeveloper()).toBe('')
    expect(getRecentDevelopers()).toEqual([])
  })

  it('saves the trimmed name and puts it first in the recent list', () => {
    setDeveloper('  alex  ')
    setDeveloper('dana')

    expect(getDeveloper()).toBe('dana')
    expect(localStorage.getItem(CURRENT_KEY)).toBe('dana')
    expect(getRecentDevelopers()).toEqual(['dana', 'alex'])
  })

  it('keeps no duplicates and at most five recent names', () => {
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'b']) {
      setDeveloper(name)
    }

    expect(getRecentDevelopers()).toEqual(['b', 'f', 'e', 'd', 'c'])
  })

  it('ignores a blank name', () => {
    setDeveloper('alex')
    setDeveloper('   ')

    expect(getDeveloper()).toBe('alex')
  })

  it('ignores a corrupted recent list', () => {
    localStorage.setItem(RECENT_KEY, 'not json')

    expect(getRecentDevelopers()).toEqual([])
  })

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => setDeveloper('alex')).not.toThrow()
    expect(getDeveloper()).toBe('')
    expect(getRecentDevelopers()).toEqual([])
  })
})
