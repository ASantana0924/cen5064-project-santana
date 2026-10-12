import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import { setDeveloper } from '@/lib/developer'
import { details, summary } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

beforeEach(() => {
  api.mockReset()
})

async function openForm() {
  const result = renderApp('/tasks/new')
  await screen.findByRole('heading', { name: 'New task' })
  return result
}

describe('CreateTaskPage', () => {
  it('shows a field error and sends no request when the title is empty', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText('Owner'), 'alex')

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByText('Enter a title.')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(api).not.toHaveBeenCalled()
  })

  it('treats a title of only spaces as empty', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText('Title'), '   ')
    await userEvent.type(screen.getByLabelText('Owner'), 'alex')

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByText('Enter a title.')).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })

  it('shows a field error when the owner is empty', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText('Title'), 'Add login page')

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByText('Enter the owner’s name.')).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })

  it('prefills the owner with the "Acting as" name', async () => {
    setDeveloper('dana')

    await openForm()

    expect(screen.getByLabelText('Owner')).toHaveValue('dana')
  })

  it('creates the task and opens its details page', async () => {
    const created = details({ id: '33333333-3333-3333-3333-333333333333', title: 'Add login page', owner: 'alex' })
    api.mockImplementation((path: string) => {
      if (path === '/api/tasks') {
        return Promise.resolve(created)
      }
      return Promise.resolve(summary())
    })
    const { router } = await openForm()

    await userEvent.type(screen.getByLabelText('Title'), '  Add login page ')
    await userEvent.type(screen.getByLabelText(/Description/), 'Email and password form')
    await userEvent.type(screen.getByLabelText('Owner'), 'alex')
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Add login page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/tasks/33333333-3333-3333-3333-333333333333')
    expect(api).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Add login page', description: 'Email and password form', developer: 'alex' }),
    })
  })

  it('shows the backend message when the request fails', async () => {
    api.mockRejectedValue(new ApiError(400, 'Title is required'))
    await openForm()

    await userEvent.type(screen.getByLabelText('Title'), 'Add login page')
    await userEvent.type(screen.getByLabelText('Owner'), 'alex')
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByText('Could not create the task')).toBeInTheDocument()
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Add login page')
  })
})
