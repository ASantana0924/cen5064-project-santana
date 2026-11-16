import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import type { TaskDetails } from '@/api/types'
import { setDeveloper } from '@/lib/developer'
import { fakeVerificationServer } from '@/test/fakeVerificationServer'
import { details, items } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

function inProgressTask(overrides: Partial<TaskDetails> = {}): TaskDetails {
  return details({
    status: 'IN_PROGRESS',
    requirements: items('Count failed logins per account'),
    acceptanceCriteria: items('The sixth failed login within 15 minutes is refused'),
    artifactCount: 1,
    ...overrides,
  })
}

async function openForm(task: TaskDetails) {
  renderApp(`/tasks/${task.id}`)
  await screen.findByRole('heading', { level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Record test run' }))
  return screen.findByRole('form', { name: 'Record test run' })
}

async function fill(form: HTMLElement, values: { tool?: string; total?: string; passed?: string; failed?: string; summary?: string }) {
  const fields = { tool: 'Tool', total: 'Total', passed: 'Passed', failed: 'Failed', summary: /Summary/ } as const
  for (const [name, label] of Object.entries(fields)) {
    const value = values[name as keyof typeof values]
    if (value !== undefined) {
      await userEvent.type(within(form).getByLabelText(label), value)
    }
  }
}

function testingRow(): HTMLElement {
  return document.getElementById('check-TESTING') as HTMLElement
}

function postCalls() {
  return api.mock.calls.filter(([, init]) => init?.method === 'POST')
}

beforeEach(() => {
  api.mockReset()
  setDeveloper('alex')
})

describe('RecordTestRunForm', () => {
  it('opens inside the Testing check with the tool focused', async () => {
    const task = inProgressTask()
    fakeVerificationServer(api, task)

    const form = await openForm(task)

    expect(testingRow()).toContainElement(form)
    expect(within(form).getByLabelText('Tool')).toHaveFocus()
  })

  it('says which fields are missing and sends nothing', async () => {
    const task = inProgressTask()
    fakeVerificationServer(api, task)
    const form = await openForm(task)

    await userEvent.click(within(form).getByRole('button', { name: 'Record test run' }))

    expect(await within(form).findByText('Enter the test tool.')).toBeInTheDocument()
    expect(within(form).getByText('Enter the total number of tests.')).toBeInTheDocument()
    expect(within(form).getByText('Enter how many tests passed.')).toBeInTheDocument()
    expect(within(form).getByText('Enter how many tests failed.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Total')).toHaveAccessibleDescription('Enter the total number of tests.')
    expect(postCalls()).toHaveLength(0)
  })

  it('refuses a total of 0', async () => {
    const task = inProgressTask()
    fakeVerificationServer(api, task)
    const form = await openForm(task)

    await fill(form, { tool: 'JUnit', total: '0', passed: '0', failed: '0' })
    await userEvent.click(within(form).getByRole('button', { name: 'Record test run' }))

    expect(await within(form).findByText('A test run must include at least one test.')).toBeInTheDocument()
    expect(postCalls()).toHaveLength(0)
  })

  it('refuses passed plus failed above the total', async () => {
    const task = inProgressTask()
    fakeVerificationServer(api, task)
    const form = await openForm(task)

    await fill(form, { tool: 'JUnit', total: '10', passed: '8', failed: '3' })
    await userEvent.click(within(form).getByRole('button', { name: 'Record test run' }))

    expect(await within(form).findByText('Passed plus failed cannot be more than the total.')).toBeInTheDocument()
    expect(within(form).queryByText(/Skipped:/)).not.toBeInTheDocument()
    expect(postCalls()).toHaveLength(0)
  })

  it('shows the skipped count as the counts are typed', async () => {
    const task = inProgressTask()
    fakeVerificationServer(api, task)
    const form = await openForm(task)

    await fill(form, { total: '14', passed: '12', failed: '1' })

    expect(within(form).getByText('Skipped: 1 (the total minus passed and failed)')).toBeInTheDocument()
  })

  it('records the run as numbers, lists it, and leaves the Testing check unchanged', async () => {
    const task = inProgressTask()
    const { url } = fakeVerificationServer(api, task)
    const form = await openForm(task)
    expect(within(testingRow()).getByText('No test runs recorded yet.')).toBeInTheDocument()

    await fill(form, { tool: 'JUnit', total: '14', passed: '12', failed: '1', summary: '1 failure in LoginCheckTest' })
    await userEvent.click(within(form).getByRole('button', { name: 'Record test run' }))

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Record test run' })).not.toBeInTheDocument())
    expect(api).toHaveBeenCalledWith(`${url}/test-runs`, {
      method: 'POST',
      body: JSON.stringify({
        tool: 'JUnit',
        total: 14,
        passed: 12,
        failed: 1,
        summary: '1 failure in LoginCheckTest',
        developer: 'alex',
      }),
    })
    const runs = await within(testingRow()).findByRole('list', { name: 'Test runs' })
    expect(runs).toHaveTextContent('JUnit')
    expect(runs).toHaveTextContent('12 passed · 1 failed · 1 skipped of 14')
    expect(runs).toHaveTextContent('Against version 1')
    expect(within(testingRow()).getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Test run recorded')).toBeInTheDocument()
    expect(
      screen.getByText('The Testing check is unchanged (Pending). Only a reviewer marks it passed or failed.'),
    ).toBeInTheDocument()
    expect(postCalls().map(([path]) => path)).toEqual([`${url}/test-runs`])
    // Focus goes back to the button that opened the form.
    expect(screen.getByRole('button', { name: 'Record test run' })).toHaveFocus()
  })

  it('shows the server message in a toast and keeps the form', async () => {
    const task = inProgressTask()
    fakeVerificationServer(api, task, [], {
      [`POST /api/tasks/${task.id}/test-runs`]: new ApiError(409, 'Test runs can only be recorded on an IN_PROGRESS task'),
    })
    const form = await openForm(task)

    await fill(form, { tool: 'JUnit', total: '3', passed: '3', failed: '0' })
    await userEvent.click(within(form).getByRole('button', { name: 'Record test run' }))

    expect(await screen.findByText('Could not record the test run')).toBeInTheDocument()
    expect(screen.getByText('Test runs can only be recorded on an IN_PROGRESS task')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Record test run' })).toBeInTheDocument()
  })

  it('closes on Escape without sending anything', async () => {
    const task = inProgressTask()
    fakeVerificationServer(api, task)
    const form = await openForm(task)

    await userEvent.type(within(form).getByLabelText('Tool'), 'JUnit{Escape}')

    expect(screen.queryByRole('form', { name: 'Record test run' })).not.toBeInTheDocument()
    expect(postCalls()).toHaveLength(0)
  })
})
