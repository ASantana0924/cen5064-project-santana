import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { ArtifactSummary } from '@/api/types'
import { formatDateTime } from '@/lib/labels'
import { artifactSummary } from '@/test/fixtures'
import { ArtifactHistory } from './ArtifactHistory'

const taskId = '11111111-1111-1111-1111-111111111111'

function renderHistory(artifacts: ArtifactSummary[]) {
  const router = createMemoryRouter([{ path: '/', element: <ArtifactHistory taskId={taskId} artifacts={artifacts} /> }])
  render(<RouterProvider router={router} />)
}

describe('ArtifactHistory', () => {
  // The API lists versions oldest first.
  const versions = [
    artifactSummary({ version: 1, aiTool: 'Claude', recordedBy: 'alex', createdAt: '2026-10-12T09:15:00Z' }),
    artifactSummary({ version: 2, aiTool: 'GitHub Copilot', recordedBy: 'sam', createdAt: '2026-10-12T11:40:00Z' }),
    artifactSummary({ version: 3, aiTool: 'ChatGPT', recordedBy: 'dana', createdAt: '2026-10-13T08:05:00Z' }),
  ]

  it('lists every version newest first', () => {
    renderHistory(versions)

    const rows = within(screen.getByRole('list', { name: 'Version history' })).getAllByRole('listitem')
    expect(rows.map((row) => row.querySelector('p')?.textContent)).toEqual([
      'Version 3Latest',
      'Version 2',
      'Version 1',
    ])
  })

  it('shows the AI tool, author, and time of each version', () => {
    renderHistory(versions)

    const row = screen.getByRole('link', { name: /Version 2/ })
    expect(row).toHaveTextContent('GitHub Copilot')
    expect(row).toHaveTextContent('by sam')
    const time = within(row).getByText(formatDateTime('2026-10-12T11:40:00Z'))
    expect(time).toHaveAttribute('dateTime', '2026-10-12T11:40:00Z')
  })

  it('marks only the newest version as Latest', () => {
    renderHistory(versions)

    expect(screen.getAllByText('Latest')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Version 3/ })).toHaveTextContent('Latest')
  })

  it('links each version to its own page', () => {
    renderHistory(versions)

    expect(screen.getByRole('link', { name: /Version 1/ })).toHaveAttribute('href', `/tasks/${taskId}/artifacts/1`)
    expect(screen.getByRole('link', { name: /Version 3/ })).toHaveAttribute('href', `/tasks/${taskId}/artifacts/3`)
  })

  it('shows a single first artifact as version 1', () => {
    renderHistory([artifactSummary()])

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link')).toHaveTextContent('Version 1')
  })
})
