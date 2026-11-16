import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import type { AuditEntry, TaskDetails } from '@/api/types'
import { setDeveloper } from '@/lib/developer'
import { fakeApprovalServer } from '@/test/fakeApprovalServer'
import { auditEntry, details, items, passedChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { writeCalls } from '@/test/routeApi'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

function approvedTask(overrides: Partial<TaskDetails> = {}): TaskDetails {
  return details({
    status: 'APPROVED',
    editable: false,
    requirements: items('Count failed logins per account'),
    acceptanceCriteria: items('The sixth failed login within 15 minutes is refused'),
    checks: passedChecks(),
    approvals: [
      { developer: 'alex', approvedAt: '2026-10-11T14:30:00Z' },
      { developer: 'dana', approvedAt: '2026-10-11T15:00:00Z' },
    ],
    ...overrides,
  })
}

/** The audit entries of the two approvals that approved the task. */
const approvalHistory: AuditEntry[] = [
  auditEntry(),
  auditEntry({ eventType: 'APPROVAL_RECORDED', developer: 'alex', details: '1 of 2 approvals', recordedAt: '2026-10-11T14:30:00Z' }),
  auditEntry({ eventType: 'APPROVAL_RECORDED', developer: 'dana', details: '2 of 2 approvals', recordedAt: '2026-10-11T15:00:00Z' }),
  auditEntry({ eventType: 'TASK_APPROVED', developer: 'dana', details: 'Approved by alex, dana', recordedAt: '2026-10-11T15:00:00Z' }),
]

/** The toast area, so toast text is not confused with the same words in the audit timeline. */
function toasts() {
  return within(document.querySelector('[data-sonner-toaster]') as HTMLElement)
}

async function openTask(task: TaskDetails) {
  renderApp(`/tasks/${task.id}`)
  await screen.findByRole('heading', { level: 1 })
}

beforeEach(() => {
  api.mockReset()
  setDeveloper('sam')
})

describe('Reopen', () => {
  it('is offered only on an APPROVED task', async () => {
    const task = approvedTask({ status: 'IN_PROGRESS', editable: true, approvals: [] })
    fakeApprovalServer(api, task)
    await openTask(task)

    expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument()
  })

  it('is disabled until a name is chosen, with a note saying so', async () => {
    localStorage.clear()
    const task = approvedTask()
    fakeApprovalServer(api, task)
    await openTask(task)

    expect(screen.getByRole('button', { name: 'Reopen' })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent('Choose a name to make changes')
  })
})

describe('ReopenDialog', () => {
  it('opens with the reason focused and says what reopening does', async () => {
    const task = approvedTask()
    fakeApprovalServer(api, task)
    await openTask(task)

    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }))

    const dialog = await screen.findByRole('dialog', { name: 'Reopen this task?' })
    expect(within(dialog).getByLabelText('Reason')).toHaveFocus()
    expect(dialog).toHaveAccessibleDescription(
      'It goes back to In progress, all six checks are set back to Pending, and the approvals by alex and dana are cleared. They stay in the history with your reason.',
    )
    expect(dialog).toHaveTextContent('You are reopening it as sam.')
  })

  it('blocks reopening without a reason and sends nothing', async () => {
    const task = approvedTask()
    fakeApprovalServer(api, task)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText('Reason'), '   ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reopen task' }))

    expect(await within(dialog).findByText('Enter why the task is being reopened.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Reason')).toHaveAccessibleDescription('Enter why the task is being reopened.')
    expect(writeCalls(api)).toHaveLength(0)
  })

  it('returns the task to IN_PROGRESS, and the timeline keeps the old approvals and the reason', async () => {
    const task = approvedTask()
    const { url } = fakeApprovalServer(api, task, approvalHistory)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Missed the bcrypt cost factor')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reopen task' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api).toHaveBeenCalledWith(`${url}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ developer: 'sam', reason: 'Missed the bcrypt cost factor' }),
    })
    expect(screen.getByText('In progress', { selector: '[data-slot="badge"]' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument()
    expect(screen.getByText('0 of 2 approvals')).toBeInTheDocument()
    expect(screen.getByText('6 pending')).toBeInTheDocument()
    expect(toasts().getByText('Task reopened')).toBeInTheDocument()
    // The Reopen button is gone, so focus moves to the task heading.
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()

    const timeline = await screen.findByRole('list', { name: 'Audit entries' })
    await within(timeline).findByText(/Reason: Missed the bcrypt cost factor/)
    const entries = within(timeline).getAllByRole('listitem')
    expect(entries.map((entry) => entry.querySelector('.font-medium')?.textContent)).toEqual([
      'Checks reset',
      'Task reopened',
      'Task approved',
      'Approval recorded',
      'Approval recorded',
      'Task created',
    ])
    expect(entries[1]).toHaveTextContent('Reason: Missed the bcrypt cost factor. Previous approvals: alex, dana')
    expect(entries[3]).toHaveTextContent('by dana')
    expect(entries[4]).toHaveTextContent('by alex')
  })

  it('shows the server message in the dialog when the server refuses', async () => {
    const task = approvedTask()
    fakeApprovalServer(api, task, [], {
      [`POST /api/tasks/${task.id}/reopen`]: new ApiError(409, 'Only an APPROVED task can be reopened'),
    })
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Found a bug')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reopen task' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Only an APPROVED task can be reopened')
    expect(within(dialog).getByText('Could not reopen the task')).toBeInTheDocument()
  })

  it('sends nothing on Cancel, returns focus to Reopen, and starts empty next time', async () => {
    const task = approvedTask()
    fakeApprovalServer(api, task)
    await openTask(task)
    const reopen = screen.getByRole('button', { name: 'Reopen' })

    await userEvent.click(reopen)
    await userEvent.type(await screen.findByLabelText('Reason'), 'Not sure yet')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(writeCalls(api)).toHaveLength(0)
    expect(reopen).toHaveFocus()

    await userEvent.click(reopen)
    expect(await screen.findByLabelText('Reason')).toHaveValue('')
  })
})
