import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { setDeveloper } from '@/lib/developer'
import { fakeApprovalServer } from '@/test/fakeApprovalServer'
import { auditEntry, details, passedChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi } from '@/test/routeApi'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)
const taskUrl = '/api/tasks/11111111-1111-1111-1111-111111111111'

function auditCard(): HTMLElement {
  return screen.getByRole('heading', { level: 2, name: 'Audit history' }).closest('[data-slot="card"]') as HTMLElement
}

beforeEach(() => {
  api.mockReset()
})

describe('AuditTimeline', () => {
  it('shows every entry newest first with its event, developer, time, and details', () => {
    render(
      <AuditTimeline
        entries={[
          auditEntry(),
          auditEntry({ eventType: 'TASK_STARTED', developer: 'sam', details: '', recordedAt: '2026-10-10T09:30:00Z' }),
          auditEntry({
            eventType: 'CHECK_FAILED',
            developer: 'dana',
            details: 'SECURITY: Leaks account names. Approvals cleared: none',
            recordedAt: '2026-10-11T12:00:00Z',
          }),
        ]}
      />,
    )

    const entries = within(screen.getByRole('list', { name: 'Audit entries' })).getAllByRole('listitem')
    expect(entries).toHaveLength(3)
    expect(entries[0]).toHaveTextContent('Check failed')
    expect(entries[0]).toHaveTextContent('by dana')
    expect(entries[0]).toHaveTextContent('SECURITY: Leaks account names. Approvals cleared: none')
    expect(entries[0].querySelector('time')).toHaveAttribute('dateTime', '2026-10-11T12:00:00Z')
    expect(entries[1]).toHaveTextContent('Task started')
    expect(entries[2]).toHaveTextContent('Task created')
    expect(entries[2]).toHaveTextContent('Rate limit login attempts')
  })
})

describe('Audit history card', () => {
  it('is at the bottom of the task details page and shows the entries', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details(),
      [`GET ${taskUrl}/audit`]: [auditEntry()],
    })

    renderApp('/tasks/11111111-1111-1111-1111-111111111111')

    expect(await within(await screen.findByRole('list', { name: 'Audit entries' })).findByText('Task created')).toBeInTheDocument()
    const cards = Array.from(document.querySelectorAll('[data-slot="card"]'))
    expect(cards[cards.length - 1]).toBe(auditCard())
  })

  it('shows a loading state, then an empty state', async () => {
    let answer: (entries: unknown) => void = () => {}
    routeApi(api, {
      [`GET ${taskUrl}`]: details(),
      [`GET ${taskUrl}/audit`]: () => new Promise((resolve) => (answer = resolve)),
    })

    renderApp('/tasks/11111111-1111-1111-1111-111111111111')

    expect(await screen.findByRole('status', { name: 'Loading audit history' })).toBeInTheDocument()
    answer([])
    expect(await within(auditCard()).findByText('No audit entries yet.')).toBeInTheDocument()
  })

  it('shows the error with a retry', async () => {
    let fail = true
    routeApi(api, {
      [`GET ${taskUrl}`]: details(),
      [`GET ${taskUrl}/audit`]: async () => {
        if (fail) {
          throw new ApiError(500, 'Unexpected server error')
        }
        return [auditEntry()]
      },
    })
    renderApp('/tasks/11111111-1111-1111-1111-111111111111')
    await screen.findByRole('heading', { level: 2, name: 'Audit history' })

    expect(await within(auditCard()).findByText('Could not load the audit history')).toBeInTheDocument()
    fail = false
    await userEvent.click(within(auditCard()).getByRole('button', { name: 'Try again' }))

    expect(await within(auditCard()).findByText('Task created')).toBeInTheDocument()
  })

  it('refreshes after a change to the task', async () => {
    setDeveloper('alex')
    const task = details({ status: 'IN_PROGRESS', checks: passedChecks(), canApprove: true })
    fakeApprovalServer(api, task, [auditEntry()])
    renderApp(`/tasks/${task.id}`)
    const timeline = await screen.findByRole('list', { name: 'Audit entries' })
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await within(timeline).findByText('Approval recorded')).toBeInTheDocument()
    const first = within(timeline).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('by alex')
    expect(first).toHaveTextContent('1 of 2 approvals')
  })
})
