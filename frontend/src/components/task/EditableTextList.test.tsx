import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import { setDeveloper } from '@/lib/developer'
import { details, items } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi, writeCalls } from '@/test/routeApi'

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
  return screen.getByRole('heading', { level: 2, name: title }).closest('[data-slot="card"]') as HTMLElement
}

describe('EditableTextList', () => {
  it('adds a requirement, shows it, and clears the box', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details(),
      [`POST ${taskUrl}/requirements`]: details({ requirements: items('Count failed logins per account') }),
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
      [`POST ${taskUrl}/acceptance-criteria`]: details({ acceptanceCriteria: items('The sixth failed login is refused') }),
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

  it('removes the item by its id, naming the developer in the query', async () => {
    setDeveloper('dana q')
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ requirements: items('First', 'Second', 'Third') }),
      [`DELETE ${taskUrl}/requirements/item-second?developer=dana+q`]: details({ requirements: items('First', 'Third') }),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 2' }))

    expect(await screen.findByText('Requirement removed')).toBeInTheDocument()
    const rows = within(card('Requirements')).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual(['First', 'Third'])
    // The focused remove button is gone, so focus moves to the add box instead of the page.
    expect(screen.getByLabelText('New requirement')).toHaveFocus()
  })

  it('removes the chosen one of two items with the same text', async () => {
    const twins = [
      { id: 'first-copy', text: 'Log the attempt' },
      { id: 'second-copy', text: 'Log the attempt' },
    ]
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ requirements: twins }),
      [`DELETE ${taskUrl}/requirements/second-copy?developer=alex`]: details({ requirements: [twins[0]] }),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 2' }))

    await waitFor(() => expect(within(card('Requirements')).getAllByRole('listitem')).toHaveLength(1))
    expect(api).toHaveBeenCalledWith(`${taskUrl}/requirements/second-copy?developer=alex`, { method: 'DELETE' })
  })

  it('does not send blank text', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: details() })
    await openTask()
    const add = within(card('Requirements')).getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()

    await userEvent.type(screen.getByLabelText('New requirement'), '   {Enter}')

    expect(add).toBeDisabled()
    expect(writeCalls(api)).toHaveLength(0)
  })

  it('shows the server error in a toast and loads the task again when the item is already gone', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ requirements: items('First') }),
      [`DELETE ${taskUrl}/requirements/item-first?developer=alex`]: new ApiError(404, 'No requirement with id item-first'),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }))

    expect(await screen.findByText('Could not remove the requirement')).toBeInTheDocument()
    expect(screen.getByText('No requirement with id item-first')).toBeInTheDocument()
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path === taskUrl)).toHaveLength(2))
    expect(within(card('Requirements')).getByText('First')).toBeInTheDocument()
  })

  it('shows the server error when an IN_PROGRESS task would lose its last requirement', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ status: 'IN_PROGRESS', requirements: items('Only one'), acceptanceCriteria: items('A') }),
      [`DELETE ${taskUrl}/requirements/item-only-one?developer=alex`]: new ApiError(
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

  it('disables every change while one is saving, so changes are sent one at a time', async () => {
    let finish: (value: unknown) => void = () => {}
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ requirements: items('First', 'Second'), acceptanceCriteria: items('A') }),
      [`DELETE ${taskUrl}/requirements/item-first?developer=alex`]: () => new Promise((resolve) => (finish = resolve)),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }))

    expect(screen.getByRole('button', { name: 'Remove requirement 2' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove acceptance criterion 1' })).toBeDisabled()

    finish(details({ requirements: items('Second'), acceptanceCriteria: items('A') }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove requirement 1' })).toBeEnabled())
    expect(within(card('Requirements')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['Second'])
  })

  it('disables the controls until an "Acting as" name is chosen', async () => {
    localStorage.clear()
    routeApi(api, { [`GET ${taskUrl}`]: details({ requirements: items('First') }) })
    await openTask()

    expect(screen.getByLabelText('New requirement')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove requirement 1' })).toBeDisabled()
  })

  it('shows no controls when the task cannot be edited', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ status: 'APPROVED', editable: false, requirements: items('First'), acceptanceCriteria: items('A') }),
    })
    await openTask()

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
