import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import { details, pendingChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)
const taskPath = '/tasks/11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  api.mockReset()
})

describe('TaskDetailsPage', () => {
  it('shows a loading state while the task loads', () => {
    api.mockReturnValue(new Promise(() => {}))

    renderApp(taskPath)

    expect(screen.getByRole('status', { name: 'Loading task' })).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/api/tasks/11111111-1111-1111-1111-111111111111')
  })

  it('shows "Task not found" with a way back for an unknown task', async () => {
    api.mockRejectedValue(new ApiError(404, 'No task with id 11111111-1111-1111-1111-111111111111'))

    renderApp(taskPath)

    expect(await screen.findByText('Task not found')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'All tasks' }).length).toBeGreaterThan(0)
  })

  it('shows "Task not found" when the ID in the address is not valid', async () => {
    api.mockRejectedValue(new ApiError(400, 'Invalid value for id: abc'))

    renderApp('/tasks/abc')

    expect(await screen.findByText('Task not found')).toBeInTheDocument()
  })

  it('shows the backend message for other errors', async () => {
    api.mockRejectedValue(new ApiError(500, 'Unexpected server error'))

    renderApp(taskPath)

    expect(await screen.findByText('Could not load the task')).toBeInTheDocument()
    expect(screen.getByText('Unexpected server error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows empty lists for a new draft task', async () => {
    api.mockResolvedValue(details())

    renderApp(taskPath)

    expect(await screen.findByRole('heading', { level: 1, name: 'Rate limit login attempts' })).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('No requirements yet.')).toBeInTheDocument()
    expect(screen.getByText('No acceptance criteria yet.')).toBeInTheDocument()
    expect(screen.getByText('No approvals yet.')).toBeInTheDocument()
    expect(screen.getByText('0 versions')).toBeInTheDocument()
  })

  it('shows requirements, criteria, all six checks, artifacts, and approvals', async () => {
    const checks = pendingChecks()
    checks[0] = { ...checks[0], status: 'PASSED', evidence: 'Matches both requirements', reviewer: 'dana', reviewedOn: '2026-10-11' }
    checks[2] = { ...checks[2], status: 'FAILED', notes: 'No test for the lockout window', reviewer: 'alex', reviewedOn: '2026-10-11' }
    api.mockResolvedValue(
      details({
        status: 'IN_PROGRESS',
        requirements: ['Count failed logins per account', 'Reset the count after a successful login'],
        acceptanceCriteria: ['The sixth failed login within 15 minutes is refused'],
        checks,
        artifactCount: 2,
        approvals: [{ developer: 'dana', approvedAt: '2026-10-11T14:30:00Z' }],
      }),
    )

    renderApp(taskPath)

    expect(await screen.findByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('Owner').nextElementSibling).toHaveTextContent('sam')
    expect(screen.getByText('2 versions')).toBeInTheDocument()
    expect(screen.getByText('Count failed logins per account')).toBeInTheDocument()
    expect(screen.getByText('The sixth failed login within 15 minutes is refused')).toBeInTheDocument()

    const checkList = screen.getByRole('heading', { name: 'Checks' }).closest('[data-slot="card"]') as HTMLElement
    const items = within(checkList).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
      'Requirements',
      'Functionality',
      'Testing',
      'Architecture',
      'Code quality',
      'Security',
    ])
    expect(within(items[0]).getByText('Passed')).toBeInTheDocument()
    expect(within(items[0]).getByText('Matches both requirements')).toBeInTheDocument()
    expect(within(items[2]).getByText('Failed')).toBeInTheDocument()
    expect(within(items[2]).getByText('No test for the lockout window')).toBeInTheDocument()
    expect(within(items[5]).getByText('Pending')).toBeInTheDocument()
    expect(within(checkList).getByRole('meter', { name: 'Checks passed' })).toHaveAttribute('aria-valuenow', '1')

    expect(screen.getByText('1 of 2 approvals')).toBeInTheDocument()
    expect(screen.getByText('dana', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows no action buttons, since editing and starting are not built yet', async () => {
    api.mockResolvedValue(details({ canStart: true, editable: true }))

    renderApp(taskPath)

    await screen.findByRole('heading', { level: 1 })
    const main = screen.getByRole('main')
    expect(within(main).queryAllByRole('button')).toHaveLength(0)
  })
})
