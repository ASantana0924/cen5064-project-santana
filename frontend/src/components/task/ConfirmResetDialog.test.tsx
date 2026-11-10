import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from '@/api/client'
import type { TaskDetails } from '@/api/types'
import { setDeveloper } from '@/lib/developer'
import { details, pendingChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi } from '@/test/routeApi'
import { ConfirmResetDialog } from './ConfirmResetDialog'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

/** An IN_PROGRESS task with 2 passed checks, 1 failed check, and 1 approval. */
function reviewedTask(overrides: Partial<TaskDetails> = {}): TaskDetails {
  const checks = pendingChecks()
  checks[0] = { ...checks[0], status: 'PASSED', evidence: 'Matches both requirements', reviewer: 'dana', reviewedOn: '2026-10-11' }
  checks[1] = { ...checks[1], status: 'PASSED', evidence: 'Tried it by hand', reviewer: 'dana', reviewedOn: '2026-10-11' }
  checks[2] = { ...checks[2], status: 'FAILED', notes: 'No test for the lockout window', reviewer: 'alex', reviewedOn: '2026-10-11' }
  return details({
    status: 'IN_PROGRESS',
    requirements: ['Count failed logins per account', 'Reset the count after a successful login'],
    acceptanceCriteria: ['The sixth failed login within 15 minutes is refused'],
    checks,
    approvals: [{ developer: 'dana', approvedAt: '2026-10-11T14:30:00Z' }],
    ...overrides,
  })
}

describe('ConfirmResetDialog', () => {
  function renderDialog(task: TaskDetails) {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmResetDialog
        task={task}
        open
        onOpenChange={onOpenChange}
        title="Remove this requirement?"
        cause="This task is in progress, so changing its requirements"
        confirmLabel="Remove and reset checks"
        onConfirm={onConfirm}
      >
        <p>Count failed logins per account</p>
      </ConfirmResetDialog>,
    )
    return { onConfirm, onOpenChange }
  }

  it('says what resets and what the task will lose', () => {
    renderDialog(reviewedTask())

    const dialog = screen.getByRole('alertdialog', { name: 'Remove this requirement?' })
    expect(dialog).toHaveAccessibleDescription(
      'This task is in progress, so changing its requirements sets all six checks back to Pending and clears all approvals. ' +
        'You will lose 2 passed checks, 1 failed check, and 1 approval.',
    )
    expect(within(dialog).getByText('Count failed logins per account')).toBeInTheDocument()
  })

  it('says nothing is lost when no check has been reviewed', () => {
    renderDialog(details({ status: 'IN_PROGRESS' }))

    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      expect.stringContaining('No checks have been reviewed yet, so nothing is lost.'),
    )
  })

  it('focuses Cancel first, so Enter does not reset the checks by accident', () => {
    renderDialog(reviewedTask())

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('calls onConfirm only when the change is confirmed', async () => {
    const { onConfirm, onOpenChange } = renderDialog(reviewedTask())

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await userEvent.click(screen.getByRole('button', { name: 'Remove and reset checks' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe('confirming list changes on an IN_PROGRESS task', () => {
  const task = reviewedTask()
  const taskUrl = `/api/tasks/${task.id}`
  // The server resets every check and clears the approvals.
  const reset = (changes: Partial<TaskDetails>) => ({ ...task, checks: pendingChecks(), approvals: [], ...changes })

  beforeEach(() => {
    api.mockReset()
    setDeveloper('alex')
  })

  async function openTask() {
    renderApp(`/tasks/${task.id}`)
    await screen.findByRole('heading', { level: 1 })
  }

  it('asks before adding a requirement and sends nothing on Cancel', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: task })
    await openTask()

    await userEvent.type(screen.getByLabelText('New requirement'), 'Log every lockout{Enter}')

    const dialog = await screen.findByRole('alertdialog', { name: 'Add this requirement?' })
    expect(within(dialog).getByText('Log every lockout')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('New requirement')).toHaveValue('Log every lockout')
    expect(screen.getByLabelText('New requirement')).toHaveFocus()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the remove button when the dialog is closed with Escape', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: task })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 2' }))
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove requirement 2' })).toHaveFocus()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('adds the requirement after confirming, and then every check shows Pending', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: task,
      [`POST ${taskUrl}/requirements`]: reset({ requirements: [...task.requirements, 'Log every lockout'] }),
    })
    await openTask()
    expect(screen.getByRole('meter', { name: 'Checks passed' })).toHaveAttribute('aria-valuenow', '2')

    await userEvent.type(screen.getByLabelText('New requirement'), 'Log every lockout')
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Add and reset checks' }))

    expect(await screen.findByText('Log every lockout')).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith(`${taskUrl}/requirements`, {
      method: 'POST',
      body: JSON.stringify({ text: 'Log every lockout', developer: 'alex' }),
    })
    const checks = screen.getByRole('heading', { name: 'Checks' }).closest('[data-slot="card"]') as HTMLElement
    expect(within(checks).getAllByText('Pending')).toHaveLength(6)
    expect(within(checks).getByRole('meter', { name: 'Checks passed' })).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText('0 of 2 approvals')).toBeInTheDocument()
    expect(screen.getByText('Requirement added')).toBeInTheDocument()
    expect(screen.getByText('All six checks are back to Pending and approvals were cleared.')).toBeInTheDocument()
  })

  it('asks before removing an acceptance criterion', async () => {
    const withTwo = reviewedTask({ acceptanceCriteria: ['The sixth failed login is refused', 'A locked account shows a message'] })
    routeApi(api, {
      [`GET ${taskUrl}`]: withTwo,
      [`DELETE ${taskUrl}/acceptance-criteria/0?developer=alex`]: reset({
        acceptanceCriteria: ['A locked account shows a message'],
      }),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove acceptance criterion 1' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove this acceptance criterion?' })
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining('changing its acceptance criteria sets all six checks'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove and reset checks' }))

    expect(await screen.findByText('Acceptance criterion removed')).toBeInTheDocument()
    expect(screen.queryByText('The sixth failed login is refused')).not.toBeInTheDocument()
    expect(screen.getByText('A locked account shows a message')).toBeInTheDocument()
  })

  it('does not ask on a DRAFT task, because nothing resets', async () => {
    const draft = details({ requirements: ['Count failed logins per account'] })
    routeApi(api, {
      [`GET ${taskUrl}`]: draft,
      [`DELETE ${taskUrl}/requirements/0?developer=alex`]: details(),
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }))

    expect(await screen.findByText('Requirement removed')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
