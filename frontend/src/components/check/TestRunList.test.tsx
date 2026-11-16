import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from '@/api/client'
import { TestRunList } from '@/components/check/TestRunList'
import { fakeVerificationServer } from '@/test/fakeVerificationServer'
import { details, testRun } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

beforeEach(() => {
  api.mockReset()
})

describe('TestRunList', () => {
  it('shows each run with its counts, summary, author, time, and artifact version, in the given order', () => {
    render(
      <TestRunList
        runs={[
          testRun({ tool: 'Vitest', total: 8, passed: 8, failed: 0, skipped: 0, summary: '', recordedAt: '2026-10-12T11:00:00Z', artifactVersion: 2 }),
          testRun({ recordedBy: 'dana', artifactVersion: null }),
        ]}
      />,
    )

    const items = within(screen.getByRole('list', { name: 'Test runs' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Vitest')
    expect(items[0]).toHaveTextContent('8 passed · 0 failed · 0 skipped of 8')
    expect(items[0]).toHaveTextContent('Against version 2')
    expect(items[0].querySelector('time')).toHaveAttribute('dateTime', '2026-10-12T11:00:00Z')
    expect(items[1]).toHaveTextContent('JUnit')
    expect(items[1]).toHaveTextContent('12 passed · 1 failed · 1 skipped of 14')
    expect(items[1]).toHaveTextContent('1 failure in LoginCheckTest')
    expect(items[1]).toHaveTextContent('by dana')
    expect(items[1]).toHaveTextContent('No artifact yet')
  })

  it('appears only under the Testing check, and is fetched only when the task has a test run', async () => {
    const task = details({ status: 'IN_PROGRESS', latestTestRun: testRun() })
    fakeVerificationServer(api, task, [testRun()])

    renderApp(`/tasks/${task.id}`)

    const list = await screen.findByRole('list', { name: 'Test runs' })
    expect(document.getElementById('check-TESTING')).toContainElement(list)
    expect(screen.getAllByRole('heading', { name: 'Test runs' })).toHaveLength(1)
    expect(api).toHaveBeenCalledWith(`/api/tasks/${task.id}/test-runs`)
  })

  it('sends no request when the task has no test runs', async () => {
    const task = details({ status: 'IN_PROGRESS' })
    fakeVerificationServer(api, task)

    renderApp(`/tasks/${task.id}`)

    expect(await screen.findByText('No test runs recorded yet.')).toBeInTheDocument()
    expect(api.mock.calls.map(([path]) => path)).toEqual([`/api/tasks/${task.id}`])
  })

  it('shows the runs but no Record button on an APPROVED task', async () => {
    const task = details({ status: 'APPROVED', editable: false, latestTestRun: testRun() })
    fakeVerificationServer(api, task, [testRun()])

    renderApp(`/tasks/${task.id}`)

    expect(await screen.findByRole('list', { name: 'Test runs' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record test run' })).not.toBeInTheDocument()
  })
})
