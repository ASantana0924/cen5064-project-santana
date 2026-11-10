import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import { setDeveloper } from '@/lib/developer'
import { details } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi } from '@/test/routeApi'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)
const task = details()
const taskUrl = `/api/tasks/${task.id}`

beforeEach(() => {
  api.mockReset()
  setDeveloper('alex')
})

async function openForm() {
  renderApp(`/tasks/${task.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  return screen.findByRole('form', { name: 'Edit task' })
}

describe('EditTaskDetailsForm', () => {
  it('opens in place with the current title and description', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: task })

    await openForm()

    expect(screen.getByLabelText('Title')).toHaveValue('Rate limit login attempts')
    expect(screen.getByLabelText(/Description/)).toHaveValue('Lock an account for 15 minutes after 5 failed logins.')
    expect(screen.getByLabelText('Title')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('saves the changes and shows them without a reload', async () => {
    const saved = details({ title: 'Lock accounts after failed logins', description: 'Lock for 15 minutes.' })
    routeApi(api, { [`GET ${taskUrl}`]: task, [`PATCH ${taskUrl}`]: saved })
    await openForm()

    await userEvent.clear(screen.getByLabelText('Title'))
    await userEvent.type(screen.getByLabelText('Title'), ' Lock accounts after failed logins ')
    await userEvent.clear(screen.getByLabelText(/Description/))
    await userEvent.type(screen.getByLabelText(/Description/), 'Lock for 15 minutes.')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lock accounts after failed logins' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Lock for 15 minutes.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Edit task' })).not.toBeInTheDocument()
    expect(await screen.findByText('Task saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
    expect(api).toHaveBeenCalledWith(taskUrl, {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Lock accounts after failed logins',
        description: 'Lock for 15 minutes.',
        developer: 'alex',
      }),
    })
    expect(api.mock.calls.filter(([path]) => path === taskUrl)).toHaveLength(2)
  })

  it('shows a field error and sends nothing when the title is blank', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: task })
    await openForm()

    await userEvent.clear(screen.getByLabelText('Title'))
    await userEvent.type(screen.getByLabelText('Title'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Enter a title.')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(api).not.toHaveBeenCalledWith(taskUrl, expect.objectContaining({ method: 'PATCH' }))
  })

  it('closes without saving on Cancel', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: task })
    await openForm()

    await userEvent.type(screen.getByLabelText('Title'), ' and more')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('form', { name: 'Edit task' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Rate limit login attempts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('closes without saving on Escape', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: task })
    await openForm()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('form', { name: 'Edit task' })).not.toBeInTheDocument()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('closes without a request when nothing changed', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: task })
    await openForm()

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('form', { name: 'Edit task' })).not.toBeInTheDocument()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('shows the server error in a toast and keeps the form open', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: task,
      [`PATCH ${taskUrl}`]: new ApiError(409, 'Only a DRAFT or IN_PROGRESS task can be edited'),
    })
    await openForm()

    await userEvent.type(screen.getByLabelText('Title'), ' now')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save the task')).toBeInTheDocument()
    expect(screen.getByText('Only a DRAFT or IN_PROGRESS task can be edited')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Rate limit login attempts now')
    // A refused change may mean the page was out of date, so the task is loaded again.
    await waitFor(() => expect(api.mock.calls.filter(([path, init]) => path === taskUrl && !init)).toHaveLength(2))
  })
})
