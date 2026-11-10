import { screen, waitFor, within } from '@testing-library/react'
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
const id = details().id
const taskUrl = `/api/tasks/${id}`

beforeEach(() => {
  api.mockReset()
  setDeveloper('alex')
})

async function openTask() {
  renderApp(`/tasks/${id}`)
  await screen.findByRole('heading', { level: 1 })
}

function card(title: string): HTMLElement {
  return screen.getByRole('heading', { name: title }).closest('[data-slot="card"]') as HTMLElement
}

describe('EditableTextList', () => {
  it('adds a requirement, shows it, and clears the box', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details(),
      [`POST ${taskUrl}/requirements`]: details({ requirements: ['Count failed logins per account'] }),
    })
    await openTask()

    await userEvent.type(screen.getByLabelText('New requirement'), '  Count failed logins per account {Enter}')

    expect(await within(card('Requirements')).findByText('Count failed logins per account')).toBeInTheDocument()
    expect(screen.getByLabelText('New requirement')).toHaveValue('')
    expect(screen.getByText('Requirement added')).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith(`${taskUrl}/requirements`, {
      method: 'POST',
      body: JSON.stringify({ text: 'Count failed logins per account', developer: 'alex' }),
    })
  })

  it('adds an acceptance criterion', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details(),
      [`POST ${taskUrl}/acceptance-criteria`]: details({ acceptanceCriteria: ['The sixth failed login is refused'] }),
    })
    await openTask()

    await userEvent.type(screen.getByLabelText('New acceptance criterion'), 'The sixth failed login is refused')
    await userEvent.click(within(card('Acceptance criteria')).getByRole('button', { name: 'Add' }))

    expect(await within(card('Acceptance criteria')).findByText('The sixth failed login is refused')).toBeInTheDocument()
    expect(screen.getByText('Acceptance criterion added')).toBeInTheDocument()
    // The Add button is disabled once the box is empty, so focus moves to the box, ready for the next one.
    expect(screen.getByLabelText('New acceptance criterion')).toHaveFocus()
    expect(within(card('Acceptance criteria')).queryByText('No acceptance criteria yet.')).not.toBeInTheDocument()
  })

  it('removes the item at its position, naming the developer in the query', async () => {
    setDeveloper('dana q')
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ requirements: ['First', 'Second', 'Third'] }),
      [`DELETE ${taskUrl}/requirements/1?developer=dana+q`]: details({ requirements: ['First', 'Third'] }),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 2' }))

    expect(await screen.findByText('Requirement removed')).toBeInTheDocument()
    const items = within(card('Requirements')).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['First', 'Third'])
    // The focused remove button is gone, so focus moves to the add box instead of the page.
    expect(screen.getByLabelText('New requirement')).toHaveFocus()
  })

  it('does not send blank text', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: details() })
    await openTask()
    const add = within(card('Requirements')).getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()

    await userEvent.type(screen.getByLabelText('New requirement'), '   {Enter}')

    expect(add).toBeDisabled()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('shows the server error in a toast and loads the task again', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ requirements: ['First'] }),
      [`DELETE ${taskUrl}/requirements/0?developer=alex`]: new ApiError(400, 'No requirement at position 0'),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }))

    expect(await screen.findByText('Could not remove the requirement')).toBeInTheDocument()
    expect(screen.getByText('No requirement at position 0')).toBeInTheDocument()
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path === taskUrl)).toHaveLength(2))
    expect(within(card('Requirements')).getByText('First')).toBeInTheDocument()
  })

  it('shows the server error when an IN_PROGRESS task would lose its last requirement', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ status: 'IN_PROGRESS', requirements: ['Only one'], acceptanceCriteria: ['A'] }),
      [`DELETE ${taskUrl}/requirements/0?developer=alex`]: new ApiError(
        409,
        'An IN_PROGRESS task needs at least one requirement',
      ),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Remove and reset checks' }))

    expect(await screen.findByText('An IN_PROGRESS task needs at least one requirement')).toBeInTheDocument()
    expect(within(card('Requirements')).getByText('Only one')).toBeInTheDocument()
  })

  it('disables every change while one is saving, so positions cannot go stale', async () => {
    let finish: (value: unknown) => void = () => {}
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ requirements: ['First', 'Second'], acceptanceCriteria: ['A'] }),
      [`DELETE ${taskUrl}/requirements/0?developer=alex`]: () => new Promise((resolve) => (finish = resolve)),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }))

    expect(screen.getByRole('button', { name: 'Remove requirement 2' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove acceptance criterion 1' })).toBeDisabled()

    finish(details({ requirements: ['Second'], acceptanceCriteria: ['A'] }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove requirement 1' })).toBeEnabled())
    expect(within(card('Requirements')).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Second'])
  })

  it('disables the controls until an "Acting as" name is chosen', async () => {
    localStorage.clear()
    routeApi(api, { [`GET ${taskUrl}`]: details({ requirements: ['First'] }) })
    await openTask()

    expect(screen.getByLabelText('New requirement')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove requirement 1' })).toBeDisabled()
  })

  it('shows no controls when the task cannot be edited', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ status: 'APPROVED', editable: false, requirements: ['First'], acceptanceCriteria: ['A'] }),
    })
    await openTask()

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
