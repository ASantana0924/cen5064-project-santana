import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import type { CheckType, TaskDetails } from '@/api/types'
import { setDeveloper } from '@/lib/developer'
import { fakeVerificationServer } from '@/test/fakeVerificationServer'
import { details, items, pendingChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

/** An IN_PROGRESS task with REQUIREMENTS passed, TESTING failed, and one approval by dana. */
function reviewedTask(overrides: Partial<TaskDetails> = {}): TaskDetails {
  const checks = pendingChecks()
  checks[0] = { ...checks[0], status: 'PASSED', evidence: 'Matches both requirements', reviewer: 'dana', reviewedOn: '2026-10-11' }
  checks[2] = { ...checks[2], status: 'FAILED', notes: 'No test for the lockout window', reviewer: 'sam', reviewedOn: '2026-10-11' }
  return details({
    status: 'IN_PROGRESS',
    requirements: items('Count failed logins per account'),
    acceptanceCriteria: items('The sixth failed login within 15 minutes is refused'),
    checks,
    approvals: [{ developer: 'dana', approvedAt: '2026-10-11T14:30:00Z' }],
    ...overrides,
  })
}

async function openTask(task: TaskDetails) {
  renderApp(`/tasks/${task.id}`)
  await screen.findByRole('heading', { level: 1 })
}

function checkRow(type: CheckType): HTMLElement {
  return document.getElementById(`check-${type}`) as HTMLElement
}

function postCalls() {
  return api.mock.calls.filter(([, init]) => init?.method === 'POST')
}

beforeEach(() => {
  api.mockReset()
  setDeveloper('alex')
})

describe('Check review buttons', () => {
  it('offers both reviews on a pending check, and only the other one on a reviewed check', async () => {
    const task = reviewedTask()
    fakeVerificationServer(api, task)
    await openTask(task)

    const pending = within(checkRow('SECURITY'))
    expect(pending.getByRole('button', { name: 'Mark passed for Security' })).toBeEnabled()
    expect(pending.getByRole('button', { name: 'Mark failed for Security' })).toBeEnabled()

    const passed = within(checkRow('REQUIREMENTS'))
    expect(passed.queryByRole('button', { name: /Mark passed/ })).not.toBeInTheDocument()
    expect(passed.getByRole('button', { name: 'Mark failed for Requirements' })).toBeInTheDocument()

    const failed = within(checkRow('TESTING'))
    expect(failed.getByRole('button', { name: 'Mark passed for Testing' })).toBeInTheDocument()
    expect(failed.queryByRole('button', { name: /Mark failed/ })).not.toBeInTheDocument()
  })

  it('shows no review buttons on a DRAFT task and says why', async () => {
    const task = details()
    fakeVerificationServer(api, task)
    await openTask(task)

    expect(screen.queryByRole('button', { name: /Mark (passed|failed)/ })).not.toBeInTheDocument()
    expect(screen.getByText('Start the task to review checks.')).toBeInTheDocument()
  })

  it('shows no review buttons on an APPROVED task', async () => {
    const task = reviewedTask({ status: 'APPROVED', editable: false })
    fakeVerificationServer(api, task)
    await openTask(task)

    expect(screen.queryByRole('button', { name: /Mark (passed|failed)/ })).not.toBeInTheDocument()
  })

  it('disables the review buttons until a name is chosen', async () => {
    localStorage.clear()
    const task = reviewedTask()
    fakeVerificationServer(api, task)
    await openTask(task)

    expect(screen.getByRole('button', { name: 'Mark passed for Security' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark failed for Security' })).toBeDisabled()
  })
})

describe('Mark passed dialog', () => {
  it('opens with the evidence box focused and names the reviewer', async () => {
    const task = reviewedTask()
    fakeVerificationServer(api, task)
    await openTask(task)

    await userEvent.click(screen.getByRole('button', { name: 'Mark passed for Security' }))

    const dialog = await screen.findByRole('dialog', { name: 'Mark Security passed' })
    expect(within(dialog).getByLabelText('Evidence')).toHaveFocus()
    expect(dialog).toHaveTextContent('You are recording this review as alex.')
  })

  it('blocks passing without evidence and sends nothing', async () => {
    const task = reviewedTask()
    fakeVerificationServer(api, task)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Mark passed for Security' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText('Evidence'), '   ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark passed' }))

    expect(await within(dialog).findByText('Enter the evidence that this check passes.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Evidence')).toHaveAttribute('aria-invalid', 'true')
    expect(postCalls()).toHaveLength(0)
  })

  it('marks the check passed with the evidence and the reviewer, and updates the summary', async () => {
    const task = reviewedTask()
    const { url } = fakeVerificationServer(api, task)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Mark passed for Security' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText('Evidence'), 'No secrets in the code; inputs are validated')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark passed' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api).toHaveBeenCalledWith(`${url}/checks/SECURITY/pass`, {
      method: 'POST',
      body: JSON.stringify({ evidence: 'No secrets in the code; inputs are validated', reviewer: 'alex' }),
    })
    const row = within(checkRow('SECURITY'))
    expect(row.getByText('Passed')).toBeInTheDocument()
    expect(row.getByText('No secrets in the code; inputs are validated')).toBeInTheDocument()
    expect(row.getByText(/Reviewed by alex on/)).toBeInTheDocument()
    expect(screen.getByText('Security passed')).toBeInTheDocument()
    expect(screen.getByText('2 passed')).toBeInTheDocument()
    expect(screen.getByText('3 pending')).toBeInTheDocument()
    // "Mark passed" is gone from the row, so focus moves to the row's other button.
    expect(row.getByRole('button', { name: 'Mark failed for Security' })).toHaveFocus()
  })

  it('shows the failure being replaced when passing a failed check', async () => {
    const task = reviewedTask()
    fakeVerificationServer(api, task)
    await openTask(task)

    await userEvent.click(screen.getByRole('button', { name: 'Mark passed for Testing' }))

    const dialog = await screen.findByRole('dialog', { name: 'Mark Testing passed' })
    expect(within(dialog).getByText(/Currently failed by sam on/)).toBeInTheDocument()
    expect(within(dialog).getByText('No test for the lockout window')).toBeInTheDocument()
  })

  it('shows the server message in the dialog when the server refuses, and loads the task again', async () => {
    const task = reviewedTask()
    const { url } = fakeVerificationServer(api, task, [], {
      [`POST /api/tasks/${task.id}/checks/SECURITY/pass`]: new ApiError(409, 'Evidence is required to pass a check'),
    })
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Mark passed for Security' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText('Evidence'), 'Looked fine')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark passed' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Evidence is required to pass a check')
    expect(within(dialog).getByText('Could not mark the check passed')).toBeInTheDocument()
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path === url)).toHaveLength(2))
    expect(within(checkRow('SECURITY')).getByText('Pending')).toBeInTheDocument()
  })

  it('sends nothing on Cancel and returns focus to the button that opened it', async () => {
    const task = reviewedTask()
    fakeVerificationServer(api, task)
    await openTask(task)
    const button = screen.getByRole('button', { name: 'Mark passed for Security' })

    await userEvent.click(button)
    await userEvent.type(await screen.findByLabelText('Evidence'), 'Half written')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(postCalls()).toHaveLength(0)
    expect(button).toHaveFocus()

    // Opening it again starts with an empty form.
    await userEvent.click(button)
    expect(await screen.findByLabelText('Evidence')).toHaveValue('')
  })
})

describe('Mark failed dialog', () => {
  it('blocks failing without notes and sends nothing', async () => {
    const task = reviewedTask()
    fakeVerificationServer(api, task)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Mark failed for Security' }))
    const dialog = await screen.findByRole('dialog', { name: 'Mark Security failed' })

    expect(within(dialog).getByLabelText('Notes')).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark failed' }))

    expect(await within(dialog).findByText('Enter notes on why this check fails.')).toBeInTheDocument()
    expect(postCalls()).toHaveLength(0)
  })

  it('says which approvals will be cleared', async () => {
    const task = reviewedTask({
      approvals: [
        { developer: 'dana', approvedAt: '2026-10-11T14:30:00Z' },
        { developer: 'sam', approvedAt: '2026-10-11T15:00:00Z' },
      ],
    })
    fakeVerificationServer(api, task)
    await openTask(task)

    await userEvent.click(screen.getByRole('button', { name: 'Mark failed for Security' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      'Marking this check failed clears 2 approvals (dana, sam). The task goes back to 0 of 2',
    )
  })

  it('says there are no approvals to clear when there are none', async () => {
    const task = reviewedTask({ approvals: [] })
    fakeVerificationServer(api, task)
    await openTask(task)

    await userEvent.click(screen.getByRole('button', { name: 'Mark failed for Security' }))

    expect(await screen.findByRole('note')).toHaveTextContent(
      'Marking a check failed clears all approvals. This task has none yet.',
    )
  })

  it('marks the check failed with the notes, and the approvals show 0 of 2', async () => {
    const task = reviewedTask()
    const { url } = fakeVerificationServer(api, task)
    await openTask(task)
    expect(screen.getByText('1 of 2 approvals')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mark failed for Requirements' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText(/Currently passed by dana on/)).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Notes'), 'Misses the reset requirement')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark failed' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api).toHaveBeenCalledWith(`${url}/checks/REQUIREMENTS/fail`, {
      method: 'POST',
      body: JSON.stringify({ notes: 'Misses the reset requirement', reviewer: 'alex' }),
    })
    const row = within(checkRow('REQUIREMENTS'))
    expect(row.getByText('Failed')).toBeInTheDocument()
    expect(row.getByText('Misses the reset requirement')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 approvals')).toBeInTheDocument()
    expect(screen.getByText('No approvals yet.')).toBeInTheDocument()
    expect(screen.getByText('Requirements failed')).toBeInTheDocument()
    expect(screen.getByText('Approvals were cleared.')).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Mark passed for Requirements' })).toHaveFocus()
  })
})
