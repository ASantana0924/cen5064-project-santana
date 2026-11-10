import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import { setDeveloper } from '@/lib/developer'
import { details, pendingChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi } from '@/test/routeApi'

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
})

describe('TaskDetailsPage actions', () => {
  const taskUrl = '/api/tasks/11111111-1111-1111-1111-111111111111'
  const ready = details({
    requirements: ['Count failed logins per account'],
    acceptanceCriteria: ['The sixth failed login within 15 minutes is refused'],
    canStart: true,
  })

  beforeEach(() => {
    setDeveloper('alex')
  })

  it('shows no edit or start controls on an APPROVED task', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ status: 'APPROVED', editable: false, canStart: false, requirements: ['A'] }),
    })

    renderApp(taskPath)

    await screen.findByRole('heading', { level: 1 })
    const main = screen.getByRole('main')
    expect(within(main).queryAllByRole('button')).toHaveLength(0)
    expect(within(main).queryAllByRole('textbox')).toHaveLength(0)
  })

  it('shows Edit but not Start on an IN_PROGRESS task', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: { ...ready, status: 'IN_PROGRESS', canStart: false } })

    renderApp(taskPath)

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Start task' })).not.toBeInTheDocument()
  })

  it('disables Start and says why when canStart is false', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: details({ canStart: false }) })

    renderApp(taskPath)

    const start = await screen.findByRole('button', { name: 'Start task' })
    expect(start).toBeDisabled()
    expect(start).toHaveAccessibleDescription('Add at least one requirement and one acceptance criterion to start.')
  })

  it('starts the task when canStart is true', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: ready,
      [`POST ${taskUrl}/start`]: { ...ready, status: 'IN_PROGRESS', canStart: false },
    })
    renderApp(taskPath)

    await userEvent.click(await screen.findByRole('button', { name: 'Start task' }))

    expect(await screen.findByText('In progress')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start task' })).not.toBeInTheDocument()
    expect(screen.getByText('Task started')).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith(`${taskUrl}/start`, { method: 'POST', body: JSON.stringify({ developer: 'alex' }) })
  })

  it('shows the server message when the server refuses to start the task', async () => {
    // The page said the task could start, but its requirement was removed in another tab.
    routeApi(api, {
      [`GET ${taskUrl}`]: ready,
      [`POST ${taskUrl}/start`]: new ApiError(409, 'At least one requirement is needed to start a task'),
    })
    renderApp(taskPath)

    await userEvent.click(await screen.findByRole('button', { name: 'Start task' }))

    expect(await screen.findByText('Could not start the task')).toBeInTheDocument()
    expect(screen.getByText('At least one requirement is needed to start a task')).toBeInTheDocument()
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path === taskUrl)).toHaveLength(2))
  })

  it('asks for an "Acting as" name before any change', async () => {
    localStorage.clear()
    routeApi(api, { [`GET ${taskUrl}`]: ready })

    renderApp(taskPath)

    expect(await screen.findByRole('note')).toHaveTextContent('Choose a name to make changes')
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start task' })).toBeDisabled()
  })
})
