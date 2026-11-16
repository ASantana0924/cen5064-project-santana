import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import type { Artifact, ArtifactSummary, TaskDetails } from '@/api/types'
import { setDeveloper } from '@/lib/developer'
import { artifact, details, pendingChecks } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi } from '@/test/routeApi'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)

const PROMPT = 'Write a Java method that locks an account after 5 failed logins.'
// Indented, with braces, to check the code is sent exactly as pasted.
const CODE = '  boolean isLocked(int failures) {\n    return failures >= 5;\n  }'

/** An IN_PROGRESS task with 2 passed checks, 1 failed check, and 1 approval. */
function reviewedTask(overrides: Partial<TaskDetails> = {}): TaskDetails {
  const checks = pendingChecks()
  checks[0] = { ...checks[0], status: 'PASSED', evidence: 'Matches both requirements', reviewer: 'dana', reviewedOn: '2026-10-11' }
  checks[1] = { ...checks[1], status: 'PASSED', evidence: 'Tried it by hand', reviewer: 'dana', reviewedOn: '2026-10-11' }
  checks[2] = { ...checks[2], status: 'FAILED', notes: 'No test for the lockout window', reviewer: 'alex', reviewedOn: '2026-10-11' }
  return details({
    status: 'IN_PROGRESS',
    requirements: ['Count failed logins per account'],
    acceptanceCriteria: ['The sixth failed login within 15 minutes is refused'],
    checks,
    approvals: [{ developer: 'dana', approvedAt: '2026-10-11T14:30:00Z' }],
    ...overrides,
  })
}

/**
 * A fake backend for one task: GET returns the current task and versions, and
 * POST records the next version the way the Domain does, resetting the checks
 * and clearing the approvals.
 */
function fakeServer(initial: TaskDetails, initialArtifacts: Artifact[] = []) {
  let task = initial
  const artifacts = [...initialArtifacts]
  const url = `/api/tasks/${task.id}`
  const toSummary = ({ version, aiTool, recordedBy, createdAt }: Artifact): ArtifactSummary => ({
    version,
    aiTool,
    recordedBy,
    createdAt,
  })

  routeApi(api, {
    [`GET ${url}`]: async () => task,
    [`GET ${url}/artifacts`]: async () => artifacts.map(toSummary),
    [`POST ${url}/artifacts`]: async (init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { prompt: string; aiTool: string; codeContent: string; developer: string }
      const recorded = artifact({
        version: artifacts.length + 1,
        prompt: body.prompt,
        aiTool: body.aiTool,
        codeContent: body.codeContent,
        recordedBy: body.developer,
        createdAt: '2026-10-13T10:00:00Z',
      })
      artifacts.push(recorded)
      task = { ...task, artifactCount: artifacts.length, checks: pendingChecks(), approvals: [] }
      return recorded
    },
  })
  return { url }
}

async function openTask(task: TaskDetails) {
  renderApp(`/tasks/${task.id}`)
  await screen.findByRole('heading', { level: 1 })
}

async function fillForm(prompt: string, aiTool: string, code: string) {
  await userEvent.type(screen.getByLabelText('Prompt'), prompt)
  await userEvent.type(screen.getByLabelText('AI tool'), aiTool)
  await userEvent.click(screen.getByLabelText('Code'))
  await userEvent.paste(code)
}

function artifactsCard(): HTMLElement {
  return screen.getByRole('heading', { name: 'Artifacts' }).closest('[data-slot="card"]') as HTMLElement
}

function postCalls() {
  return api.mock.calls.filter(([, init]) => init?.method === 'POST')
}

beforeEach(() => {
  api.mockReset()
  setDeveloper('alex')
})

describe('RecordArtifactForm', () => {
  it('opens from the Artifacts card with the prompt focused', async () => {
    const task = reviewedTask()
    fakeServer(task)
    await openTask(task)

    expect(within(artifactsCard()).getByText('No artifacts yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Record artifact' }))

    expect(await screen.findByRole('form', { name: 'Record version 1' })).toBeInTheDocument()
    expect(screen.getByLabelText('Prompt')).toHaveFocus()
  })

  it('says which fields are missing and sends nothing', async () => {
    const task = reviewedTask()
    fakeServer(task)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Record artifact' }))

    await userEvent.type(await screen.findByLabelText('Code'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Record version 1' }))

    expect(await screen.findByText('Enter the prompt you gave the AI tool.')).toBeInTheDocument()
    expect(screen.getByText('Enter the AI tool.')).toBeInTheDocument()
    expect(screen.getByText('Paste the code the AI tool generated.')).toBeInTheDocument()
    expect(screen.getByLabelText('Prompt')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Prompt')).toHaveAccessibleDescription('Enter the prompt you gave the AI tool.')
    expect(postCalls()).toHaveLength(0)
  })

  it('suggests common AI tools in a monospace code box', async () => {
    const task = reviewedTask()
    fakeServer(task)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Record artifact' }))

    const aiTool = await screen.findByLabelText('AI tool')
    const suggestions = document.getElementById(aiTool.getAttribute('list') ?? '')
    expect([...(suggestions?.querySelectorAll('option') ?? [])].map((option) => option.value)).toEqual([
      'Claude',
      'ChatGPT',
      'GitHub Copilot',
      'Cursor',
      'Gemini',
    ])
    expect(screen.getByLabelText('Code')).toHaveClass('font-mono')
    expect(screen.getByLabelText('Code')).toHaveAttribute('wrap', 'off')
  })

  it('records the first artifact as version 1 without asking', async () => {
    const task = reviewedTask()
    const { url } = fakeServer(task)
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Record artifact' }))

    // Any tool name is accepted, not only the suggestions.
    await fillForm(`  ${PROMPT}  `, 'Aider', CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Record version 1' }))

    expect(await screen.findByText('Version 1 recorded')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // The prompt and tool are trimmed; the code keeps its indentation.
    expect(api).toHaveBeenCalledWith(`${url}/artifacts`, {
      method: 'POST',
      body: JSON.stringify({ prompt: PROMPT, aiTool: 'Aider', codeContent: CODE, developer: 'alex' }),
    })
    expect(screen.queryByRole('form', { name: /Record version/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 version')).toBeInTheDocument()
    const history = await within(artifactsCard()).findByRole('list', { name: 'Version history' })
    expect(within(history).getByRole('link', { name: /Version 1/ })).toHaveTextContent('Aider')
    expect(screen.getByRole('button', { name: 'Record new version' })).toHaveFocus()
  })

  it('keeps what was typed and shows the server message when recording fails', async () => {
    const task = reviewedTask()
    const url = `/api/tasks/${task.id}`
    routeApi(api, {
      [`GET ${url}`]: task,
      [`POST ${url}/artifacts`]: new ApiError(409, 'Artifacts can only be recorded on an IN_PROGRESS task'),
    })
    await openTask(task)
    await userEvent.click(screen.getByRole('button', { name: 'Record artifact' }))

    await fillForm(PROMPT, 'Claude', CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Record version 1' }))

    expect(await screen.findByText('Could not record the artifact')).toBeInTheDocument()
    expect(screen.getByText('Artifacts can only be recorded on an IN_PROGRESS task')).toBeInTheDocument()
    expect(screen.getByLabelText('Prompt')).toHaveValue(PROMPT)
    expect(screen.getByLabelText('Code')).toHaveValue(CODE)
  })

  it('closes on Cancel and on Escape without sending anything', async () => {
    const task = reviewedTask()
    fakeServer(task)
    await openTask(task)

    await userEvent.click(screen.getByRole('button', { name: 'Record artifact' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'Record version 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record artifact' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Record artifact' }))
    await screen.findByLabelText('Prompt')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('form', { name: 'Record version 1' })).not.toBeInTheDocument()
    expect(postCalls()).toHaveLength(0)
  })
})

describe('confirming a new artifact version', () => {
  const task = reviewedTask({ artifactCount: 1 })

  async function submitRevision() {
    await openTask(task)
    await userEvent.click(await screen.findByRole('button', { name: 'Record new version' }))
    await fillForm('Also reset the count after a successful login.', 'Claude', CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Record version 2' }))
    return screen.findByRole('alertdialog', { name: 'Record version 2?' })
  }

  it('warns in the form that the new version resets the checks', async () => {
    fakeServer(task, [artifact()])
    await openTask(task)
    await userEvent.click(await screen.findByRole('button', { name: 'Record new version' }))

    expect(
      await screen.findByText(
        'This will be version 2. Recording it sets all six checks back to Pending and clears all approvals.',
      ),
    ).toBeInTheDocument()
  })

  it('asks before recording and sends nothing on Cancel', async () => {
    fakeServer(task, [artifact()])

    const dialog = await submitRevision()

    expect(dialog).toHaveAccessibleDescription(
      'Recording version 2 sets all six checks back to Pending and clears all approvals. ' +
        'You will lose 2 passed checks, 1 failed check, and 1 approval.',
    )
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Prompt')).toHaveValue('Also reset the count after a successful login.')
    expect(postCalls()).toHaveLength(0)
  })

  it('closes only the dialog on Escape, keeping the form open', async () => {
    fakeServer(task, [artifact()])

    await submitRevision()
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Record version 2' })).toBeInTheDocument()
    expect(postCalls()).toHaveLength(0)
  })

  it('records version 2 after confirming, and then every check shows Pending', async () => {
    fakeServer(task, [artifact()])

    const dialog = await submitRevision()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record and reset checks' }))

    expect(await screen.findByText('Version 2 recorded')).toBeInTheDocument()
    expect(screen.getByText('All six checks are back to Pending and approvals were cleared.')).toBeInTheDocument()
    expect(postCalls()).toHaveLength(1)

    const checks = screen.getByRole('heading', { name: 'Checks' }).closest('[data-slot="card"]') as HTMLElement
    expect(within(checks).getAllByText('Pending')).toHaveLength(6)
    expect(within(checks).getByRole('meter', { name: 'Checks passed' })).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText('0 of 2 approvals')).toBeInTheDocument()
    expect(screen.getByText('2 versions')).toBeInTheDocument()

    await waitFor(() => expect(within(artifactsCard()).getAllByRole('link')).toHaveLength(2))
    const links = within(artifactsCard()).getAllByRole('link')
    expect(links[0]).toHaveTextContent('Version 2')
    expect(links[1]).toHaveTextContent('Version 1')
  })
})

describe('when artifacts can be recorded', () => {
  it('disables recording on a DRAFT task and says why', async () => {
    const task = details()
    fakeServer(task)
    await openTask(task)

    const record = screen.getByRole('button', { name: 'Record artifact' })
    expect(record).toBeDisabled()
    expect(record).toHaveAccessibleDescription('Start the task to record artifacts.')
  })

  it('disables recording until an "Acting as" name is chosen', async () => {
    localStorage.clear()
    const task = reviewedTask()
    fakeServer(task)
    await openTask(task)

    expect(screen.getByRole('button', { name: 'Record artifact' })).toBeDisabled()
  })

  it('shows the history but no Record button on an APPROVED task', async () => {
    const task = details({ status: 'APPROVED', editable: false, artifactCount: 1 })
    fakeServer(task, [artifact()])
    await openTask(task)

    expect(await within(artifactsCard()).findByRole('link', { name: /Version 1/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Record/ })).not.toBeInTheDocument()
  })
})
