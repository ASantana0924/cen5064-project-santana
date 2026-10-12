import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest, NETWORK_ERROR_MESSAGE } from '@/api/client'
import { renderApp } from '@/test/renderApp'
import { details, summary } from '@/test/fixtures'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

beforeEach(() => {
  api.mockReset()
})

describe('TaskListPage', () => {
  it('shows a loading state while tasks load', () => {
    api.mockReturnValue(new Promise(() => {}))

    renderApp('/')

    expect(screen.getByRole('status', { name: 'Loading tasks' })).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/api/tasks')
  })

  it('shows an empty state with a link to create a task', async () => {
    api.mockResolvedValue([])

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute('href', '/tasks/new')
  })

  it('shows a readable message when the backend cannot be reached', async () => {
    api.mockRejectedValue(new ApiError(0, NETWORK_ERROR_MESSAGE))

    renderApp('/')

    expect(await screen.findByText('Could not load tasks')).toBeInTheDocument()
    expect(screen.getByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows each task with owner, status, check progress, and approval progress', async () => {
    api.mockResolvedValue([
      summary(),
      summary({
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Add password reset email',
        owner: 'alex',
        status: 'DRAFT',
        passedChecks: 0,
        approvalCount: 0,
      }),
    ])

    renderApp('/')

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)

    const first = within(rows[1])
    expect(first.getByRole('link', { name: 'Rate limit login attempts' })).toHaveAttribute(
      'href',
      '/tasks/11111111-1111-1111-1111-111111111111',
    )
    expect(first.getByText('sam')).toBeInTheDocument()
    expect(first.getByText('In progress')).toBeInTheDocument()
    expect(first.getByRole('meter', { name: 'Checks passed for Rate limit login attempts' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    )
    expect(first.getByText('3/6')).toBeInTheDocument()
    expect(first.getByText('1 of 2')).toBeInTheDocument()

    expect(within(rows[2]).getByText('Draft')).toBeInTheDocument()
  })

  it('opens the details page when a task is clicked', async () => {
    api.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/tasks' ? [summary()] : details()),
    )
    const { router } = renderApp('/')

    const table = await screen.findByRole('table')
    await userEvent.click(within(table).getByRole('link', { name: 'Rate limit login attempts' }))

    expect(router.state.location.pathname).toBe('/tasks/11111111-1111-1111-1111-111111111111')
    expect(await screen.findByRole('heading', { level: 1, name: 'Rate limit login attempts' })).toBeInTheDocument()
  })
})
