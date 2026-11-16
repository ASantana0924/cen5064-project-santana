import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import type { TaskDetails } from '@/api/types'
import { setDeveloper } from '@/lib/developer'
import { fakeApprovalServer } from '@/test/fakeApprovalServer'
import { details, items, passedChecks, pendingChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { writeCalls } from '@/test/routeApi'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

/** An IN_PROGRESS task with every check PASSED, so it can be approved. */
function readyTask(overrides: Partial<TaskDetails> = {}): TaskDetails {
  return details({
    status: 'IN_PROGRESS',
    requirements: items('Count failed logins per account'),
    acceptanceCriteria: items('The sixth failed login within 15 minutes is refused'),
    checks: passedChecks(),
    canApprove: true,
    ...overrides,
  })
}

async function openTask(task: TaskDetails) {
  renderApp(`/tasks/${task.id}`)
  await screen.findByRole('heading', { level: 1 })
}

/** The toast area, so toast text is not confused with the same words in the audit timeline. */
function toasts() {
  return within(document.querySelector('[data-sonner-toaster]') as HTMLElement)
}

function approvalCard(): HTMLElement {
  return screen.getByRole('heading', { level: 2, name: 'Approvals' }).closest('[data-slot="card"]') as HTMLElement
}

beforeEach(() => {
  api.mockReset()
  setDeveloper('alex')
})

describe('ApprovalCard', () => {
  it('shows progress such as "1 of 2" and lists the approvers', async () => {
    const task = readyTask({ approvals: [{ developer: 'dana', approvedAt: '2026-10-11T14:30:00Z' }] })
    fakeApprovalServer(api, task)
    await openTask(task)

    const card = within(approvalCard())
    expect(card.getByText('1 of 2 approvals')).toBeInTheDocument()
    expect(card.getByRole('meter', { name: 'Approvals' })).toHaveAttribute('aria-valuetext', '1 of 2')
    const approvers = card.getAllByRole('listitem')
    expect(approvers).toHaveLength(1)
    expect(approvers[0]).toHaveTextContent('dana')
    expect(approvers[0].querySelector('time')).toHaveAttribute('dateTime', '2026-10-11T14:30:00Z')
  })

  it('disables Approve and says why while canApprove is false', async () => {
    const task = readyTask({ checks: pendingChecks(), canApprove: false })
    fakeApprovalServer(api, task)
    await openTask(task)

    const approve = within(approvalCard()).getByRole('button', { name: 'Approve' })
    expect(approve).toBeDisabled()
    expect(approve).toHaveAccessibleDescription('Every check must pass before the task can be approved.')
  })

  it('disables Approve for a developer who already approved, ignoring case', async () => {
    setDeveloper('Alex')
    const task = readyTask({ approvals: [{ developer: 'alex', approvedAt: '2026-10-11T14:30:00Z' }] })
    fakeApprovalServer(api, task)
    await openTask(task)

    const approve = within(approvalCard()).getByRole('button', { name: 'Approve' })
    expect(approve).toBeDisabled()
    expect(approve).toHaveAccessibleDescription(
      'You approved this task as Alex. A different developer must give the next approval.',
    )
  })

  it('disables Approve until a name is chosen', async () => {
    localStorage.clear()
    const task = readyTask()
    fakeApprovalServer(api, task)
    await openTask(task)

    expect(within(approvalCard()).getByRole('button', { name: 'Approve' })).toBeDisabled()
  })

  it('shows no Approve button on a DRAFT or APPROVED task', async () => {
    const task = readyTask({
      status: 'APPROVED',
      editable: false,
      canApprove: false,
      approvals: [
        { developer: 'alex', approvedAt: '2026-10-11T14:30:00Z' },
        { developer: 'dana', approvedAt: '2026-10-11T15:00:00Z' },
      ],
    })
    fakeApprovalServer(api, task)
    await openTask(task)

    expect(within(approvalCard()).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(within(approvalCard()).getByText('2 of 2 approvals')).toBeInTheDocument()
  })

  it('records the first approval as "1 of 2", and the task stays in progress', async () => {
    const task = readyTask()
    const { url } = fakeApprovalServer(api, task)
    await openTask(task)

    await userEvent.click(within(approvalCard()).getByRole('button', { name: 'Approve' }))

    expect(await within(approvalCard()).findByText('1 of 2 approvals')).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith(`${url}/approvals`, { method: 'POST', body: JSON.stringify({ developer: 'alex' }) })
    expect(toasts().getByText('Approval recorded')).toBeInTheDocument()
    expect(toasts().getByText('1 of 2 approvals. One more developer must approve.')).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(within(approvalCard()).getByRole('button', { name: 'Approve' })).toHaveAccessibleDescription(
      'You approved this task as alex. A different developer must give the next approval.',
    )
  })

  it('shows APPROVED after the second approval by a different developer', async () => {
    const task = readyTask({ approvals: [{ developer: 'dana', approvedAt: '2026-10-11T14:30:00Z' }] })
    fakeApprovalServer(api, task)
    await openTask(task)

    await userEvent.click(within(approvalCard()).getByRole('button', { name: 'Approve' }))

    expect(await within(approvalCard()).findByText('2 of 2 approvals')).toBeInTheDocument()
    expect(screen.getByText('Approved', { selector: '[data-slot="badge"]' })).toBeInTheDocument()
    expect(toasts().getByText('Task approved')).toBeInTheDocument()
    expect(within(approvalCard()).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument()
  })

  it('shows the server message when the server refuses, and loads the task again', async () => {
    // The page said the task could be approved, but a check failed in another tab.
    const task = readyTask()
    const { url } = fakeApprovalServer(api, task, [], {
      [`POST /api/tasks/${task.id}/approvals`]: new ApiError(409, 'All six checks must be PASSED before approval'),
    })
    await openTask(task)

    await userEvent.click(within(approvalCard()).getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText('Could not approve the task')).toBeInTheDocument()
    expect(screen.getByText('All six checks must be PASSED before approval')).toBeInTheDocument()
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path === url)).toHaveLength(2))
    expect(writeCalls(api)).toHaveLength(1)
  })
})
