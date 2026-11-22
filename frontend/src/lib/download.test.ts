import { afterEach, describe, expect, it, vi } from 'vitest'

import { saveFile } from './download'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('saveFile', () => {
  it('clicks a hidden download link for the file, then removes it and frees the URL', () => {
    vi.useFakeTimers()
    // jsdom has no object URLs, so URL is swapped for a version that has them until the test ends.
    const createObjectURL = vi.fn(() => 'blob:report')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL
        static revokeObjectURL = revokeObjectURL
      },
    )
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })
    const blob = new Blob(['# Report'], { type: 'text/markdown' })

    saveFile(blob, 'verifai-report.md')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toHaveLength(1)
    expect(clicked[0].getAttribute('href')).toBe('blob:report')
    expect(clicked[0].download).toBe('verifai-report.md')
    expect(clicked[0].hidden).toBe(true)
    expect(document.body.contains(clicked[0])).toBe(false)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })
})
