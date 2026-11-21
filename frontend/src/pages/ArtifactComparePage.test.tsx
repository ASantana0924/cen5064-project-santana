import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import type { Artifact } from '@/api/types'
import { artifact, artifactSummary, details } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi, type Reply } from '@/test/routeApi'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)
const taskId = '11111111-1111-1111-1111-111111111111'
const taskUrl = `/api/tasks/${taskId}`
const comparePath = `/tasks/${taskId}/artifacts/compare`

const version1 = artifact({
  version: 1,
  aiTool: 'Claude',
  recordedBy: 'alex',
  prompt: 'Lock the account after 5 failed logins.',
  codeContent: 'boolean isLocked(int failures) {\n  return failures >= 5;\n}',
})
const version2 = artifact({
  version: 2,
  aiTool: 'GitHub Copilot',
  recordedBy: 'sam',
  prompt: 'Lock the account after 3 failed logins.',
  codeContent: 'boolean isLocked(int failures) {\n  return failures >= MAX_FAILURES;\n}',
})
const version3 = artifact({
  version: 3,
  aiTool: 'GitHub Copilot',
  recordedBy: 'dana',
  prompt: version2.prompt,
  codeContent: `${version2.codeContent}\n\nstatic final int MAX_FAILURES = 3;`,
})

beforeEach(() => {
  api.mockReset()
})

/** Answers the task, its version list, and each version in full. */
function serve(versions: Artifact[], extra: Record<string, Reply> = {}) {
  routeApi(api, {
    [`GET ${taskUrl}`]: details({ status: 'IN_PROGRESS', artifactCount: versions.length }),
    [`GET ${taskUrl}/artifacts`]: versions.map(artifactSummary),
    ...Object.fromEntries(versions.map((v) => [`GET ${taskUrl}/artifacts/${v.version}`, v])),
    ...extra,
  })
}

const fromPicker = () => screen.getByRole('combobox', { name: 'From version' })
const toPicker = () => screen.getByRole('combobox', { name: 'To version' })
const codeDiff = (from: number, to: number) =>
  screen.findByRole('region', { name: `Code changes from version ${from} to version ${to}` })

/** The code rows of the diff as "change code", such as "Removed   return failures >= 5;". */
async function changedLines(from: number, to: number): Promise<string[]> {
  const rows = within(await codeDiff(from, to)).getAllByRole('row').slice(1)
  return rows
    .filter((row) => row.dataset.kind !== 'unchanged')
    .map((row) => `${within(row).getByText(/^(Added|Removed)$/).textContent} ${row.querySelectorAll('td')[3].textContent}`)
}

function section(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('[data-slot="card"]') as HTMLElement
}

describe('ArtifactComparePage', () => {
  it('shows a loading state while the versions load', async () => {
    api.mockReturnValue(new Promise(() => {}))

    renderApp(comparePath)

    // The page is loaded on demand, so its loading state appears after a moment.
    expect(await screen.findByRole('status', { name: 'Loading versions' })).toBeInTheDocument()
  })

  it('compares the two newest versions by default, older one first', async () => {
    serve([version1, version2, version3])

    renderApp(comparePath)

    expect(await changedLines(2, 3)).toEqual(['Added ', 'Added static final int MAX_FAILURES = 3;'])
    expect(screen.getByRole('heading', { level: 1, name: 'Compare versions' })).toBeInTheDocument()
    expect(screen.getByText('Rate limit login attempts')).toBeInTheDocument()
    expect(fromPicker()).toHaveValue('2')
    expect(toPicker()).toHaveValue('3')
  })

  it('lists every version in both pickers, newest first, with its tool and author', async () => {
    serve([version1, version2, version3])

    renderApp(comparePath)

    await codeDiff(2, 3)
    const options = within(fromPicker())
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual([
      'Version 3 · GitHub Copilot · dana',
      'Version 2 · GitHub Copilot · sam',
      'Version 1 · Claude · alex',
    ])
    expect(within(toPicker()).getAllByRole('option')).toHaveLength(3)
  })

  it('marks the lines that changed when comparing versions 1 and 2', async () => {
    serve([version1, version2, version3])
    const { router } = renderApp(comparePath)
    await codeDiff(2, 3)

    await userEvent.selectOptions(fromPicker(), '1')
    await userEvent.selectOptions(toPicker(), '2')

    expect(await changedLines(1, 2)).toEqual([
      'Removed   return failures >= 5;',
      'Added   return failures >= MAX_FAILURES;',
    ])
    expect(router.state.location.search).toBe('?from=1&to=2')
  })

  it('shows the AI tool and prompt changes', async () => {
    serve([version1, version2])

    renderApp(`${comparePath}?from=1&to=2`)

    await codeDiff(1, 2)
    const tool = section('AI tool')
    expect(within(tool).getByRole('deletion')).toHaveTextContent('Claude')
    expect(within(tool).getByRole('insertion')).toHaveTextContent('GitHub Copilot')
    const prompt = section('Prompt')
    expect(within(prompt).getByRole('deletion')).toHaveTextContent('5')
    expect(within(prompt).getByRole('insertion')).toHaveTextContent('3')
  })

  it('says when the AI tool or the prompt did not change', async () => {
    serve([version1, version2, version3])

    renderApp(`${comparePath}?from=2&to=3`)

    await codeDiff(2, 3)
    expect(section('AI tool')).toHaveTextContent('Unchanged: GitHub Copilot')
    expect(section('Prompt')).toHaveTextContent('The prompt is the same in both versions.')
  })

  it('shows "No differences" when the same version is picked twice', async () => {
    serve([version1, version2])
    renderApp(comparePath)
    await codeDiff(1, 2)

    await userEvent.selectOptions(fromPicker(), '2')

    expect(await screen.findByRole('heading', { name: 'No differences' })).toBeInTheDocument()
    expect(screen.getByText(/Both pickers show version 2/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Code' })).not.toBeInTheDocument()
    // Version 2 was already loaded, so picking it twice asks the server for nothing new.
    expect(api.mock.calls.filter(([path]) => path === `${taskUrl}/artifacts/2`)).toHaveLength(1)
  })

  it('shows "No differences" for two versions with the same tool, prompt, and code', async () => {
    const copy = { ...version2, version: 3, recordedBy: 'dana' }
    serve([version1, version2, copy])

    renderApp(comparePath)

    expect(await screen.findByRole('heading', { name: 'No differences' })).toBeInTheDocument()
    expect(screen.getByText('Version 2 and version 3 have the same AI tool, prompt, and code.')).toBeInTheDocument()
  })

  it('compares in the order picked, so a newer "from" version shows its lines as removed', async () => {
    serve([version1, version2, version3])

    renderApp(`${comparePath}?from=3&to=2`)

    expect(await changedLines(3, 2)).toEqual(['Removed ', 'Removed static final int MAX_FAILURES = 3;'])
  })

  it('falls back to the two newest versions when the URL names a version the task does not have', async () => {
    serve([version1, version2, version3])

    renderApp(`${comparePath}?from=9&to=abc`)

    await codeDiff(2, 3)
    expect(fromPicker()).toHaveValue('2')
    expect(toPicker()).toHaveValue('3')
  })

  it('disables the pickers and says why when the task has one version', async () => {
    serve([version1])

    renderApp(comparePath)

    expect(await screen.findByRole('heading', { name: 'Nothing to compare yet' })).toBeInTheDocument()
    expect(screen.getByText(/Record a second version to compare them/)).toBeInTheDocument()
    expect(fromPicker()).toBeDisabled()
    expect(toPicker()).toBeDisabled()
    expect(api).not.toHaveBeenCalledWith(`${taskUrl}/artifacts/1`)
  })

  it('disables the pickers when the task has no versions, without asking for any', async () => {
    serve([])

    renderApp(comparePath)

    expect(await screen.findByText(/This task has no artifact versions/)).toBeInTheDocument()
    expect(fromPicker()).toBeDisabled()
    expect(api).not.toHaveBeenCalledWith(`${taskUrl}/artifacts`)
  })

  it('shows "Task not found" for an unknown task', async () => {
    routeApi(api, { [`GET ${taskUrl}`]: new ApiError(404, `No task with id ${taskId}`) })

    renderApp(comparePath)

    expect(await screen.findByText('Task not found')).toBeInTheDocument()
  })

  it('shows the error and a way to retry when a version fails to load', async () => {
    let fail = true
    serve([version1, version2], {
      [`GET ${taskUrl}/artifacts/1`]: () =>
        fail ? Promise.reject(new Error('Server unreachable')) : Promise.resolve(version1),
    })
    renderApp(comparePath)

    expect(await screen.findByText('Could not load the versions')).toBeInTheDocument()
    expect(screen.getByText('Server unreachable')).toBeInTheDocument()

    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await codeDiff(1, 2)).toBeInTheDocument()
  })

  it('links back to the task', async () => {
    serve([version1, version2])

    renderApp(comparePath)

    await codeDiff(1, 2)
    expect(screen.getByRole('link', { name: 'Back to task' })).toHaveAttribute('href', `/tasks/${taskId}`)
  })
})
